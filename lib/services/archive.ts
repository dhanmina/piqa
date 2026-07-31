import { patch, signThumb, signThumbs } from "../cache";
import { type QueueItem } from "./captureQueue";
import { getConfig } from "./config";
import { type PhotoStatus } from "../frames";
import { profileKey, type ProfileData } from "./profile";
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

// Studio challenge shots never reach here — lib/hooks/archive.ts filters them
// out before calling either of these (they're a shared Studio submission, not
// a personal archive item).
type ArchivableQueueItem = QueueItem & { kind: ArchiveType };

function rowMatchesQueued(dbThumbPath: string | null, q: ArchivableQueueItem): boolean {
  if (!dbThumbPath) return false;
  return q.kind === "daily" && q.dropId ? dbThumbPath.includes(q.dropId) : dbThumbPath.includes(q.id);
}

function queuedToItem(q: ArchivableQueueItem): ArchiveItem {
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
  const t0 = Date.now();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) {
    console.log("[archive] fetchArchive: no authenticated user, returning empty");
    return { items: [], starsUsed: 0, starsCap: 5, since: null };
  }

  const [{ data: free, error: freeErr }, { data: daily, error: dailyErr }, cap] = await Promise.all([
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
  const tQuery = Date.now();
  console.log(
    `[archive] fetchArchive: rows free=${free?.length ?? 0} (err=${freeErr?.message ?? "none"}) daily=${daily?.length ?? 0} (err=${dailyErr?.message ?? "none"}) query_ms=${tQuery - t0}`,
  );

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

  const tSignStart = Date.now();
  const signed = await signThumbs(merged.map((m) => m.thumbPath).filter((p): p is string => !!p));
  const tSignEnd = Date.now();
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

  const blankCount = items.filter((it) => it.thumbPath && !it.uri).length;
  console.log(
    `[archive] fetchArchive: signed ${signed.size}/${merged.filter((m) => m.thumbPath).length} thumbs in ${tSignEnd - tSignStart}ms, blank_tiles=${blankCount}, total_ms=${tSignEnd - t0}`,
  );
  if (blankCount > 0) {
    console.warn(
      `[archive] fetchArchive: ${blankCount} item(s) have a thumbPath but no signed uri — will render blank`,
      items.filter((it) => it.thumbPath && !it.uri).map((it) => ({ type: it.type, id: it.id, thumbPath: it.thumbPath })),
    );
  }

  const starsUsed = merged.filter((m) => m.starred && isThisMonth(m.starredAt)).length;
  const since = merged.length > 0 ? merged[merged.length - 1].capturedAt : null;
  return { items, starsUsed, starsCap: cap, since };
}

export type StarResult = { ok: boolean; reason?: string; starred?: boolean; used?: number; cap?: number };

export type StarToggleItem = Pick<ArchiveItem, "id" | "type" | "imagePath" | "uri">;

export async function toggleStar(item: StarToggleItem): Promise<StarResult> {
  const { type, id } = item;
  const t0 = Date.now();
  console.log(`[archive] toggleStar: calling RPC type=${type} id=${id}`);
  const { data, error } = await supabase.rpc("toggle_star", { p_type: type, p_id: id });
  const rpcMs = Date.now() - t0;
  if (error) {
    console.warn(`[archive] toggleStar: RPC error after ${rpcMs}ms — ${error.message}`, error);
    return { ok: false, reason: error.message };
  }
  const res = data as unknown as StarResult;
  console.log(`[archive] toggleStar: RPC ok in ${rpcMs}ms — result=${JSON.stringify(res)}`);
  if (res.ok) {
    // Patch the one changed row + tally in place instead of refetching the
    // whole archive (two full-table selects + re-signing every thumb) for a
    // single toggle — that refetch was the "too long to load" and, when a
    // signing batch partially failed, the "blank tile" symptom.
    let matched = false;
    patch<Archive>(ARCHIVE_KEY, (archive) => {
      const items = archive.items.map((it) => {
        if (it.type === type && it.id === id) {
          matched = true;
          return { ...it, starred: res.starred ?? it.starred };
        }
        return it;
      });
      return { ...archive, starsUsed: res.used ?? archive.starsUsed, items };
    });
    console.log(`[archive] toggleStar: archive patch applied matched_row=${matched}`);
    if (!matched) {
      console.warn(
        `[archive] toggleStar: no matching item found in cached archive for type=${type} id=${id} — cache may be stale/empty, UI will not reflect the change until next fetch`,
      );
    }

    // The Profile "Starred" segment reads a SEPARATE cache key (profile:self),
    // built from its own query — patching `archive` above does nothing for it.
    // This used to call invalidate("profile:self"), which deletes the cached
    // entry and emits immediately (blanking the Starred segment on the spot)
    // but only refetches on the NEXT screen-focus event — useFocusEffect only
    // fires on navigation focus, not on switching Profile's internal segmented
    // control. Net effect: star from Archive → Starred segment goes blank and
    // stays blank until the user leaves the Profile tab and comes back. Patch
    // profile:self in place instead, same as archive, so no refetch is needed.
    const fullUri = item.imagePath ? await signThumb(item.imagePath) : null;
    let profileMatched = false;
    patch<ProfileData | null>(profileKey(null), (profile) => {
      if (!profile) return profile; // "profile:self" not cached (or found:false) — nothing to patch
      const already = profile.starred.some((s) => s.key === id);
      if (res.starred) {
        profileMatched = true;
        if (already) return profile;
        return {
          ...profile,
          starred: [{ key: id, type, uri: item.uri, fullUri }, ...profile.starred].slice(0, 12),
        };
      }
      profileMatched = already;
      return { ...profile, starred: profile.starred.filter((s) => s.key !== id) };
    });
    console.log(`[archive] toggleStar: profile:self patch applied matched=${profileMatched}`);
  }
  return res;
}

export async function deleteFreeShot(item: ArchiveItem): Promise<boolean> {
  if (item.type !== "free") return false;
  const paths = [item.imagePath, item.thumbPath].filter((p): p is string => !!p);
  if (paths.length > 0) await supabase.storage.from("submissions").remove(paths);
  const { error } = await supabase.from("free_shots").delete().eq("id", item.id);
  return !error;
}

export { rowMatchesQueued, queuedToItem };
