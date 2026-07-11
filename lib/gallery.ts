import AsyncStorage from "@react-native-async-storage/async-storage";

import type { GalleryPhoto } from "@/components/molecules/GalleryGrid";
import { signThumbs, useCached, useSignedThumb } from "./cache";
import { supabase } from "./supabase";

// useSignedThumb now lives in the shared cache layer; re-exported so existing
// imports (`@lib/gallery`) keep working while signing is deduped app-wide.
export { useSignedThumb };

type GalleryRow = {
  id: string;
  thumb_path: string | null;
  hearts: number;
  shooter: string;
  is_potd: boolean;
};

type LatestGalleryResult = {
  drop: { id: string; prompt: string | null; drop_date: string } | null;
  photos: GalleryRow[];
  is_seed: boolean;
};

export type LatestGallery = {
  drop: { id: string; prompt: string | null; drop_date: string } | null;
  /** Whether this is the seed fallback (no real gallery has closed yet). */
  isSeed: boolean;
  photos: GalleryPhoto[];
};

// The latest gallery only changes at the 9am reveal; a specific past gallery is
// immutable. Short TTL for "latest", long for a pinned back-issue.
const LATEST_TTL_MS = 60_000;
const PAST_TTL_MS = 10 * 60_000;

async function loadLatestGallery(): Promise<LatestGallery> {
  const { data: res, error } = await supabase.rpc("get_latest_gallery");
  if (error) throw error;
  const result = res as unknown as LatestGalleryResult;
  if (!result?.drop) return { drop: null, isSeed: false, photos: [] };

  const signed = await signThumbs(result.photos.map((p) => p.thumb_path).filter((p): p is string => !!p));
  const photos: GalleryPhoto[] = result.photos.map((p) => ({
    id: p.id,
    uri: p.thumb_path ? (signed.get(p.thumb_path) ?? null) : null,
    hearts: p.hearts,
    isPotd: p.is_potd,
    shooter: p.shooter,
  }));
  return { drop: result.drop, isSeed: result.is_seed, photos };
}

/** The most recent revealed gallery for my region, or the seed fallback. */
export function useLatestGallery() {
  const { data, loading } = useCached<LatestGallery>("gallery:latest", loadLatestGallery, LATEST_TTL_MS);
  return { data, loading };
}

// ---------------------------------------------------------------------------
// The full World view — one RPC (get_gallery) returns the latest (or a
// specific) materialized gallery, its past back-issues, and the live teaser.
// ---------------------------------------------------------------------------

type RichPhotoRow = {
  id: string;
  thumb_path: string | null;
  image_path: string | null;
  user_id: string;
  shooter: string;
  hearts: number;
  is_potd: boolean;
  bt_score: number | null;
  captured_at: string | null;
};

type GetGalleryResult = {
  drop: { id: string | null; prompt: string | null; drop_date: string | null } | null;
  photos: RichPhotoRow[];
  is_seed: boolean;
  past: { drop_id: string; drop_date: string; prompt: string | null }[];
  next_drop_at: string | null;
};

/** GalleryPhoto plus the fields the photo-detail route needs. */
export type GalleryDetailPhoto = GalleryPhoto & {
  userId?: string;
  imagePath?: string | null;
  thumbPath?: string | null;
  capturedAt?: string | null;
};

export type GalleryFeed = {
  drop: { id: string; prompt: string | null; drop_date: string } | null;
  isSeed: boolean;
  photos: GalleryDetailPhoto[];
  past: { drop_id: string; drop_date: string; prompt: string | null }[];
  nextDropAt: string | null;
};

async function loadGallery(dropId: string | null): Promise<GalleryFeed> {
  // null (latest) → omit the arg so the RPC's `default null` applies.
  const { data: res, error } = await supabase.rpc("get_gallery", { p_drop: dropId ?? undefined });
  if (error) throw error;
  const result = res as unknown as GetGalleryResult;

  if (!result?.drop?.id) {
    return { drop: null, isSeed: false, photos: [], past: result?.past ?? [], nextDropAt: result?.next_drop_at ?? null };
  }

  const signed = await signThumbs(result.photos.map((p) => p.thumb_path).filter((p): p is string => !!p));
  const photos: GalleryDetailPhoto[] = result.photos.map((p) => ({
    id: p.id,
    uri: p.thumb_path ? (signed.get(p.thumb_path) ?? null) : null,
    hearts: p.hearts,
    isPotd: p.is_potd,
    shooter: p.shooter,
    userId: p.user_id,
    imagePath: p.image_path,
    thumbPath: p.thumb_path,
    capturedAt: p.captured_at,
  }));

  return {
    drop: { id: result.drop.id, prompt: result.drop.prompt, drop_date: result.drop.drop_date! },
    isSeed: result.is_seed,
    photos,
    past: result.past ?? [],
    nextDropAt: result.next_drop_at,
  };
}

/**
 * Reads a materialized gallery blob (never a live query for the day's photos).
 * `dropId` null → the latest revealed gallery for my region; a specific id →
 * that immutable back-issue (cached longer, since it never changes).
 */
export function useGallery(dropId: string | null) {
  const key = `gallery:${dropId ?? "latest"}`;
  const ttl = dropId ? PAST_TTL_MS : LATEST_TTL_MS;
  const { data, loading } = useCached<GalleryFeed>(key, () => loadGallery(dropId), ttl);
  return { data, loading };
}

// Morning reveal plays once per gallery, then never again (spec §11c / moment 2).
const revealKey = (dropId: string) => `piqa:reveal-seen:${dropId}`;

export async function isRevealSeen(dropId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(revealKey(dropId))) !== null;
  } catch {
    return true; // fail closed — a storage hiccup shouldn't replay confetti
  }
}

export async function markRevealSeen(dropId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(revealKey(dropId), "1");
  } catch {
    // best-effort
  }
}
