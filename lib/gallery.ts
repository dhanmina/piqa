import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import type { GalleryPhoto } from "@/components/molecules/GalleryGrid";
import { signThumbs, useCached, useSignedThumb } from "./cache";
import { useSession } from "./session";
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
  const { data, loading, error } = useCached<LatestGallery>("gallery:latest", loadLatestGallery, LATEST_TTL_MS);
  return { data, loading, error };
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
  const { data, loading, error, refresh } = useCached<GalleryFeed>(key, () => loadGallery(dropId), ttl);
  return { data, loading, error, refresh };
}

async function loadFollowingGallery(): Promise<GalleryDetailPhoto[]> {
  const { data, error } = await supabase.rpc("get_following_gallery");
  if (error) throw error;
  const rows = (data as unknown as { photos: RichPhotoRow[] }).photos ?? [];
  const signed = await signThumbs(rows.map((r) => r.thumb_path).filter((p): p is string => !!p));
  return rows.map((r) => ({
    id: r.id,
    uri: r.thumb_path ? (signed.get(r.thumb_path) ?? null) : null,
    hearts: r.hearts,
    isPotd: r.is_potd,
    shooter: r.shooter,
    userId: r.user_id,
    imagePath: r.image_path,
    thumbPath: r.thumb_path,
    capturedAt: r.captured_at,
  }));
}

/** Gallery placements from the people I follow (the Following sub-tab). */
export function useFollowingGallery() {
  const { data, loading, error, refresh } = useCached<GalleryDetailPhoto[]>("gallery:following", loadFollowingGallery, 60_000);
  return { photos: data ?? [], loading, error, refresh };
}

/**
 * Direct hearting from the gallery (grid + PotD) without opening the photo.
 * Loads which of these photos I've already hearted (the count alone can't tell),
 * then toggles a signed reaction optimistically. Hearts are signed (spec §8):
 * the shooter sees who reacted, so the heart is a deliberate button, not a
 * whole-tile tap. `count` re-derives from the base so my toggle never
 * double-counts a heart already baked into the materialized total.
 */
export function useGalleryHearts(photos: { id: string; hearts: number }[]) {
  const { session } = useSession();
  const myId = session?.user.id;
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const idsKey = photos.map((p) => p.id).join(",");
  useEffect(() => {
    if (!myId || photos.length === 0) {
      setLiked(new Set());
      return;
    }
    let alive = true;
    void supabase
      .from("reactions")
      .select("submission_id")
      .eq("user_id", myId)
      .in("submission_id", idsKey.split(","))
      .then(
        ({ data }) => {
          if (alive) setLiked(new Set((data ?? []).map((r) => (r as { submission_id: string }).submission_id)));
        },
        (e) => console.warn('Failed to fetch gallery hearts:', e)
      );
    return () => {
      alive = false;
    };
    // idsKey captures the photo set; myId gates the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, idsKey]);

  const isLiked = useCallback((id: string) => optimistic[id] ?? liked.has(id), [optimistic, liked]);

  const count = useCallback(
    (p: { id: string; hearts: number }) => Math.max(0, p.hearts - (liked.has(p.id) ? 1 : 0) + (isLiked(p.id) ? 1 : 0)),
    [liked, isLiked],
  );

  const toggle = useCallback(
    async (id: string) => {
      if (!myId) return;
      const next = !isLiked(id);
      setOptimistic((m) => ({ ...m, [id]: next })); // flip instantly
      try {
        if (next) {
          const { error } = await supabase.from("reactions").insert({ user_id: myId, submission_id: id, emoji: "heart" });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("reactions").delete().eq("user_id", myId).eq("submission_id", id);
          if (error) throw error;
        }
      } catch (e) {
        console.warn('Failed to toggle heart:', e);
        setOptimistic((m) => ({ ...m, [id]: !next })); // revert on failure
      }
    },
    [myId, isLiked],
  );

  return { isLiked, count, toggle };
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
