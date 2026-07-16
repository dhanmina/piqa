import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import type { GalleryPhoto } from "@/components/molecules/GalleryGrid";
import { signThumbs, useCached, useSignedThumb } from "./cache";
import { asFrameId, asStatus } from "./frames";
import { useSession } from "./session";
import { supabase } from "./supabase";

// useSignedThumb now lives in the shared cache layer; re-exported so existing
// imports (`@lib/gallery`) keep working while signing is deduped app-wide.
export { useSignedThumb };

// A specific past gallery is immutable; the latest one changes at the 9am reveal.
const LATEST_TTL_MS = 60_000;
const PAST_TTL_MS = 10 * 60_000;

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
  /** Added by decorate_photos — the owner's CURRENT frame, not a frozen one. */
  equipped_frame: string;
  status: string | null;
  day_number: number;
};

type GetGalleryResult = {
  drop: {
    id: string | null;
    prompt: string | null;
    drop_date: string | null;
    day_number: number | null;
  } | null;
  photos: RichPhotoRow[];
  is_seed: boolean;
  past: { drop_id: string; drop_date: string; prompt: string | null }[];
  next_drop_at: string | null;
};

/** Everything a FramedPhoto needs, mapped off one decorated row. */
function toGalleryPhoto(p: RichPhotoRow, signed: Map<string, string>): GalleryDetailPhoto {
  return {
    id: p.id,
    uri: p.thumb_path ? (signed.get(p.thumb_path) ?? null) : null,
    hearts: p.hearts,
    isPotd: p.is_potd,
    shooter: p.shooter,
    userId: p.user_id,
    imagePath: p.image_path,
    thumbPath: p.thumb_path,
    capturedAt: p.captured_at,
    frameId: asFrameId(p.equipped_frame),
    status: asStatus(p.status),
    dayNumber: p.day_number,
  };
}

/** GalleryPhoto plus the fields the photo-detail route needs. */
export type GalleryDetailPhoto = GalleryPhoto & {
  userId?: string;
  imagePath?: string | null;
  thumbPath?: string | null;
  capturedAt?: string | null;
};

export type GalleryFeed = {
  drop: { id: string; prompt: string | null; drop_date: string; day_number: number } | null;
  isSeed: boolean;
  photos: GalleryDetailPhoto[];
  past: { drop_id: string; drop_date: string; prompt: string | null }[];
  nextDropAt: string | null;
};

export async function loadGallery(dropId: string | null): Promise<GalleryFeed> {
  // null (latest) → omit the arg so the RPC's `default null` applies.
  const { data: res, error } = await supabase.rpc("get_gallery", { p_drop: dropId ?? undefined });
  if (error) throw error;
  const result = res as unknown as GetGalleryResult;

  if (!result?.drop?.id) {
    return { drop: null, isSeed: false, photos: [], past: result?.past ?? [], nextDropAt: result?.next_drop_at ?? null };
  }

  const signed = await signThumbs(result.photos.map((p) => p.thumb_path).filter((p): p is string => !!p));
  const photos: GalleryDetailPhoto[] = result.photos.map((p) => toGalleryPhoto(p, signed));

  return {
    drop: {
      id: result.drop.id,
      prompt: result.drop.prompt,
      drop_date: result.drop.drop_date!,
      day_number: result.drop.day_number ?? 0,
    },
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
  return rows.map((r) => toGalleryPhoto(r, signed));
}

/** Gallery placements from the people I follow (the Following sub-tab). */
export function useFollowingGallery() {
  const { data, loading, error, refresh } = useCached<GalleryDetailPhoto[]>("gallery:following", loadFollowingGallery, 60_000);
  return { photos: data ?? [], loading, error, refresh };
}

const globalBaseHearts: Record<string, boolean> = {};
const globalOptimisticHearts: Record<string, boolean> = {};

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
          const fetchedSet = new Set((data ?? []).map((r) => r.submission_id));
          idsKey.split(",").forEach(id => {
            globalBaseHearts[id] = fetchedSet.has(id);
          });
          if (alive) setLiked(fetchedSet);
        },
        (e) => console.warn('Failed to fetch gallery hearts:', e)
      );
    return () => {
      alive = false;
    };
    // idsKey captures the photo set; myId gates the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, idsKey]);

  const getBase = useCallback((id: string) => globalBaseHearts[id] ?? liked.has(id), [liked]);
  const isLiked = useCallback((id: string) => optimistic[id] ?? globalOptimisticHearts[id] ?? getBase(id), [optimistic, getBase]);

  const count = useCallback(
    (p: { id: string; hearts: number }) => Math.max(0, p.hearts - (getBase(p.id) ? 1 : 0) + (isLiked(p.id) ? 1 : 0)),
    [getBase, isLiked],
  );

  const toggle = useCallback(
    async (id: string) => {
      if (!myId) return;
      const next = !isLiked(id);
      setOptimistic((m) => ({ ...m, [id]: next })); // flip instantly
      globalOptimisticHearts[id] = next; // persist across tab switches
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
        globalOptimisticHearts[id] = !next;
      }
    },
    [myId, isLiked],
  );

  return { isLiked, count, toggle };
}

// Two distinct "have you seen it?" flags for one drop. They cannot be the same
// key: the Today dot has to clear the moment you read your own result, while the
// gallery's confetti has to survive until the gallery itself is opened. Sharing
// one flag meant reading your result on Today never cleared Today's own dot.
//   reveal — the morning reveal animation, plays once per gallery (spec §11c / moment 2).
//   result — your personal result card on Today.
const revealKey = (dropId: string) => `piqa:reveal-seen:${dropId}`;
const resultKey = (dropId: string) => `piqa:result-seen:${dropId}`;

async function isSeen(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) !== null;
  } catch {
    return true; // fail closed — a storage hiccup shouldn't replay confetti or nag
  }
}

async function markSeen(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, "1");
  } catch {
    // best-effort
  }
}

export const isRevealSeen = (dropId: string) => isSeen(revealKey(dropId));
export const markRevealSeen = (dropId: string) => markSeen(revealKey(dropId));
export const isResultSeen = (dropId: string) => isSeen(resultKey(dropId));
export const markResultSeen = (dropId: string) => markSeen(resultKey(dropId));
