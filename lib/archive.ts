import { useEffect, useMemo, useState } from "react";

import { invalidate, signThumbs, useCached } from "./cache";
import { getQueueItems, subscribeQueue, type QueueItem } from "./captureQueue";
import { getConfig } from "./config";
import { asFrameId, type FrameId, type PhotoStatus } from "./frames";
import { supabase } from "./supabase";

export type ArchiveType = "free" | "daily";

export type ArchiveItem = {
  id: string;
  type: ArchiveType;
  thumbPath: string | null;
  imagePath: string | null;
  uri: string | null;
  capturedAt: string;
  starred: boolean;
  inGallery: boolean;
  isPotd: boolean;
  /** The drop's global day counter. Only daily shots belong to a drop; free shots are null. */
  dayNumber: number | null;
  /** Competition result, server-owned. Free shots are always null. */
  status: PhotoStatus;
  /** Local capture still syncing — shown from the queue before its DB row exists. */
  queued?: boolean;
};

export type Archive = {
  items: ArchiveItem[];
  /** Stars used this calendar month (across both tables). */
  starsUsed: number;
  starsCap: number;
  /** Earliest captured_at, for the "since {month}" header. */
  since: string | null;
  /** The owner's equipped frame, applied to their framed (daily) shots. */
  equippedFrame: FrameId;
};

/** Mirror of the server's photo_status(is_potd, gallery_rank). */
function deriveStatus(isPotd: boolean, rank: number | null): PhotoStatus {
  if (isPotd) return "crown";
  if (rank != null && rank <= 10) return "top10";
  return null;
}

/** PostgREST embeds a to-one relation as an object, but types can widen to an array. */
function dayOf(rel: { day_number: number } | { day_number: number }[] | null): number | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0]?.day_number ?? null) : rel.day_number;
}

/**
 * Whether a DB row is the landed copy of a queued capture. The upload writes a
 * deterministic storage path — `free/{uid}/{id}_thumb.jpg` for free shots (carries
 * the queue id), `{dropId}/{uid}_thumb.jpg` for daily — so the queued tile can hand
 * off to its real row the moment that row appears.
 */
function rowMatchesQueued(dbThumbPath: string | null, q: QueueItem): boolean {
  if (!dbThumbPath) return false;
  return q.kind === "daily" && q.dropId ? dbThumbPath.includes(q.dropId) : dbThumbPath.includes(q.id);
}

/** A syncing capture rendered as a provisional archive tile (local image, no server fields). */
function queuedToItem(q: QueueItem): ArchiveItem {
  return {
    id: q.id,
    type: q.kind,
    thumbPath: null,
    imagePath: null,
    uri: q.thumbUri ?? q.originalUri,
    capturedAt: q.capturedAt,
    starred: false,
    inGallery: false,
    isPotd: false,
    dayNumber: null,
    status: null,
    queued: true,
  };
}

function isThisMonth(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

export const ARCHIVE_KEY = "archive";
const ARCHIVE_TTL_MS = 5 * 60_000;

/**
 * The private journal: free captures + daily submissions merged, newest first.
 * Owner-only by RLS, so both tables are queried directly. Standalone + shared via
 * the cache, so it's prefetched at login and survives cold starts / tab switches
 * (it used to hold local state and cold-load on the first open).
 */
export async function fetchArchive(): Promise<Archive> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { items: [], starsUsed: 0, starsCap: 5, since: null, equippedFrame: "default" };

  const [{ data: free }, { data: daily }, { data: prof }, cap] = await Promise.all([
    supabase
      .from("free_shots")
      .select("id, image_path, thumb_path, captured_at, starred, starred_at")
      .eq("user_id", uid)
      .order("captured_at", { ascending: false }),
    supabase
      .from("submissions")
      .select(
        "id, image_path, thumb_path, captured_at, starred, starred_at, in_gallery, is_potd, gallery_rank, prompt_drops(day_number)",
      )
      .eq("user_id", uid)
      .not("thumb_path", "is", null)
      .order("captured_at", { ascending: false }),
    supabase.from("profiles").select("equipped_frame").eq("id", uid).maybeSingle(),
    getConfig("stars_per_month"),
  ]);

  const rawFree = (free ?? []).map((r) => ({
    id: r.id,
    type: "free" as const,
    thumbPath: r.thumb_path,
    imagePath: r.image_path,
    capturedAt: r.captured_at,
    starred: r.starred,
    starredAt: r.starred_at,
    inGallery: false,
    isPotd: false,
    dayNumber: null as number | null,
    status: null as PhotoStatus,
  }));
  const rawDaily = (daily ?? []).map((r) => ({
    id: r.id,
    type: "daily" as const,
    thumbPath: r.thumb_path,
    imagePath: r.image_path,
    capturedAt: r.captured_at,
    starred: r.starred,
    starredAt: r.starred_at,
    inGallery: r.in_gallery,
    isPotd: r.is_potd,
    dayNumber: dayOf(r.prompt_drops),
    status: deriveStatus(r.is_potd, r.gallery_rank),
  }));

  const merged = [...rawFree, ...rawDaily].sort(
    (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt),
  );

  const signed = await signThumbs(merged.map((m) => m.thumbPath).filter((p): p is string => !!p));
  const items: ArchiveItem[] = merged.map((m) => ({
    id: m.id,
    type: m.type,
    thumbPath: m.thumbPath,
    imagePath: m.imagePath,
    uri: m.thumbPath ? (signed.get(m.thumbPath) ?? null) : null,
    capturedAt: m.capturedAt,
    starred: m.starred,
    inGallery: m.inGallery,
    isPotd: m.isPotd,
    dayNumber: m.dayNumber,
    status: m.status,
  }));

  const starsUsed = merged.filter((m) => m.starred && isThisMonth(m.starredAt)).length;
  const since = merged.length > 0 ? merged[merged.length - 1].capturedAt : null;
  return { items, starsUsed, starsCap: cap, since, equippedFrame: asFrameId(prof?.equipped_frame) };
}

export function useArchive() {
  const { data, loading, error, refresh } = useCached<Archive>(ARCHIVE_KEY, fetchArchive, ARCHIVE_TTL_MS);

  // Local-first: surface captures the instant they're taken, straight from the
  // upload queue, instead of waiting on the compress → upload → insert round-trip
  // (the DB query above only sees a shot once its row lands). Every other photo
  // surface already reads the queue; the archive was the one that didn't.
  //
  // On each queue event we re-snapshot. The queue removes an item only AFTER it
  // emits 'done', so that snapshot still holds the just-finished shot — it bridges
  // (shown as queued) until the refetch below brings in its real row, at which
  // point the merge filters it out. The stale entry is dropped on the next event.
  const [pending, setPending] = useState<QueueItem[]>(() => [...getQueueItems()]);
  useEffect(() => {
    const unsubscribe = subscribeQueue((event) => {
      setPending([...getQueueItems()]);
      if (event.type === "done" || event.type === "duplicate") void refresh();
    });
    return unsubscribe;
  }, [refresh]);

  const merged = useMemo<Archive | null>(() => {
    if (!data) return data;
    const queued = pending
      .filter((q) => q.status !== "blocked") // blocked = real error, surfaced on Today
      .filter((q) => !data.items.some((db) => rowMatchesQueued(db.thumbPath, q)))
      .map(queuedToItem);
    if (queued.length === 0) return data;
    const items = [...queued, ...data.items].sort(
      (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt),
    );
    return { ...data, items };
  }, [data, pending]);

  return { data: merged, loading, error, refresh };
}

export type StarResult = { ok: boolean; reason?: string; starred?: boolean; used?: number; cap?: number };

export async function toggleStar(type: ArchiveType, id: string): Promise<StarResult> {
  const { data, error } = await supabase.rpc("toggle_star", { p_type: type, p_id: id });
  if (error) return { ok: false, reason: error.message };
  // The starred shelf lives on your own profile too, so drop its cache — otherwise
  // it keeps showing the pre-star list until the TTL expires.
  invalidate("profile:self");
  return data as unknown as StarResult;
}

/** Delete a free capture (row + storage objects). Daily shots are competition history and are not deletable here. */
export async function deleteFreeShot(item: ArchiveItem): Promise<boolean> {
  if (item.type !== "free") return false;
  const paths = [item.imagePath, item.thumbPath].filter((p): p is string => !!p);
  if (paths.length > 0) await supabase.storage.from("submissions").remove(paths);
  const { error } = await supabase.from("free_shots").delete().eq("id", item.id);
  return !error;
}
