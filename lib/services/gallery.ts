import AsyncStorage from "@react-native-async-storage/async-storage";

import type { GalleryPhoto } from "@/components/molecules/GalleryGrid";
import { signThumbs } from "../cache";
import { asFrameId, asStatus } from "../frames";
import { supabase } from "./supabase";

const LATEST_TTL_MS = 5 * 60_000;
const PAST_TTL_MS = 10 * 60_000;

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
  frame_id: string;
  status: string | null;
  day_number: number;
  nods?: Record<string, number>;
};

type GetGalleryResult = {
  drop: {
    id: string | null;
    prompt: string | null;
    drop_date: string | null;
    day_number: number | null;
    category: string | null;
  } | null;
  photos: RichPhotoRow[];
  is_seed: boolean;
  past: { drop_id: string; drop_date: string; prompt: string | null }[];
  next_drop_at: string | null;
};

export type GalleryDetailPhoto = GalleryPhoto & {
  userId?: string;
  imagePath?: string | null;
  thumbPath?: string | null;
  capturedAt?: string | null;
  nods?: import("../nods").NodCounts | null;
};

export type GalleryFeed = {
  drop: { id: string; prompt: string | null; drop_date: string; day_number: number; category: string | null } | null;
  isSeed: boolean;
  photos: GalleryDetailPhoto[];
  past: { drop_id: string; drop_date: string; prompt: string | null }[];
  nextDropAt: string | null;
};

export function toGalleryPhoto(p: RichPhotoRow, signed: Map<string, string>): GalleryDetailPhoto {
  return {
    id: p.id,
    uri: p.thumb_path ? (signed.get(p.thumb_path) ?? null) : null,
    fullUri: p.image_path ? (signed.get(p.image_path) ?? null) : null,
    hearts: p.hearts,
    isPotd: p.is_potd,
    shooter: p.shooter,
    userId: p.user_id,
    imagePath: p.image_path,
    thumbPath: p.thumb_path,
    capturedAt: p.captured_at,
    frameId: asFrameId(p.frame_id),
    status: asStatus(p.status),
    dayNumber: p.day_number,
    nods: p.nods ?? null,
  };
}

export async function loadGallery(dropId: string | null): Promise<GalleryFeed> {
  const { data: res, error } = await supabase.rpc("get_gallery", { p_drop: dropId ?? undefined });
  if (error) throw error;
  const result = res as unknown as GetGalleryResult;

  if (!result?.drop?.id) {
    return { drop: null, isSeed: false, photos: [], past: result?.past ?? [], nextDropAt: result?.next_drop_at ?? null };
  }

  const signed = await signThumbs(
    result.photos.flatMap((p) => [p.thumb_path, p.image_path]).filter((p): p is string => !!p),
  );
  const photos: GalleryDetailPhoto[] = result.photos.map((p) => toGalleryPhoto(p, signed));

  return {
    drop: {
      id: result.drop.id,
      prompt: result.drop.prompt,
      drop_date: result.drop.drop_date!,
      day_number: result.drop.day_number ?? 0,
      category: result.drop.category ?? null,
    },
    isSeed: result.is_seed,
    photos,
    past: result.past ?? [],
    nextDropAt: result.next_drop_at,
  };
}

export async function loadFollowingGallery(): Promise<GalleryDetailPhoto[]> {
  const { data, error } = await supabase.rpc("get_following_gallery");
  if (error) throw error;
  const rows = (data as unknown as { photos: RichPhotoRow[] }).photos ?? [];
  const signed = await signThumbs(
    rows.flatMap((r) => [r.thumb_path, r.image_path]).filter((p): p is string => !!p),
  );
  return rows.map((r) => toGalleryPhoto(r, signed));
}

const revealKey = (dropId: string) => `piqa:reveal-seen:${dropId}`;
const resultKey = (dropId: string) => `piqa:result-seen:${dropId}`;

async function isSeen(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) !== null;
  } catch {
    return true;
  }
}

async function markSeen(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, "1");
  } catch {
    // best-effort
  }
}

export const LATEST_GALLERY_TTL = LATEST_TTL_MS;
export const PAST_GALLERY_TTL = PAST_TTL_MS;

export const isRevealSeen = (dropId: string) => isSeen(revealKey(dropId));
export const markRevealSeen = (dropId: string) => markSeen(revealKey(dropId));
export const isResultSeen = (dropId: string) => isSeen(resultKey(dropId));
export const markResultSeen = (dropId: string) => markSeen(resultKey(dropId));
