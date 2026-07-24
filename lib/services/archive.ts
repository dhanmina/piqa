import { invalidate, signThumbs } from "../cache";
import { type QueueItem } from "./captureQueue";
import { getConfig } from "./config";
import { type PhotoStatus } from "../frames";
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
  dayNumber: number | null;
  dropDate: string | null;
  status: PhotoStatus;
  queued?: boolean;
};

export type Archive = {
  items: ArchiveItem[];
  starsUsed: number;
  starsCap: number;
  since: string | null;
};

function deriveStatus(isPotd: boolean, rank: number | null): PhotoStatus {
  if (isPotd) return "crown";
  if (rank != null && rank <= 10) return "top10";
  return null;
}

function dayOf(rel: { day_number: number } | { day_number: number }[] | null): number | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0]?.day_number ?? null) : rel.day_number;
}

function dateOf(rel: { drop_date: string } | { drop_date: string }[] | null): string | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0]?.drop_date ?? null) : rel.drop_date;
}

function rowMatchesQueued(dbThumbPath: string | null, q: QueueItem): boolean {
  if (!dbThumbPath) return false;
  return q.kind === "daily" && q.dropId ? dbThumbPath.includes(q.dropId) : dbThumbPath.includes(q.id);
}

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
    dropDate: null,
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

export async function fetchArchive(): Promise<Archive> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { items: [], starsUsed: 0, starsCap: 5, since: null };

  const [{ data: free }, { data: daily }, cap] = await Promise.all([
    supabase
      .from("free_shots")
      .select("id, image_path, thumb_path, captured_at, starred, starred_at")
      .eq("user_id", uid)
      .not("thumb_path", "is", null)
      .order("captured_at", { ascending: false }),
    supabase
      .from("submissions")
      .select(
        "id, image_path, thumb_path, captured_at, starred, starred_at, in_gallery, is_potd, gallery_rank, subject_drops(day_number, drop_date)",
      )
      .eq("user_id", uid)
      .not("thumb_path", "is", null)
      .order("captured_at", { ascending: false }),
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
    dropDate: null as string | null,
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
    dayNumber: dayOf(r.subject_drops),
    dropDate: dateOf(r.subject_drops),
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
    dropDate: m.dropDate,
    status: m.status,
  }));

  const starsUsed = merged.filter((m) => m.starred && isThisMonth(m.starredAt)).length;
  const since = merged.length > 0 ? merged[merged.length - 1].capturedAt : null;
  return { items, starsUsed, starsCap: cap, since };
}

export type StarResult = { ok: boolean; reason?: string; starred?: boolean; used?: number; cap?: number };

export async function toggleStar(type: ArchiveType, id: string): Promise<StarResult> {
  const { data, error } = await supabase.rpc("toggle_star", { p_type: type, p_id: id });
  if (error) return { ok: false, reason: error.message };
  invalidate("profile:self");
  return data as unknown as StarResult;
}

export async function deleteFreeShot(item: ArchiveItem): Promise<boolean> {
  if (item.type !== "free") return false;
  const paths = [item.imagePath, item.thumbPath].filter((p): p is string => !!p);
  if (paths.length > 0) await supabase.storage.from("submissions").remove(paths);
  const { error } = await supabase.from("free_shots").delete().eq("id", item.id);
  return !error;
}

export { rowMatchesQueued, queuedToItem };
