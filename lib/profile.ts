import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useCallback } from "react";

import { invalidate, signThumbs, useCached } from "./cache";
import { asFrameId, asStatus, type FrameId, type PhotoStatus } from "./frames";
import { supabase } from "./supabase";

export type ProfileWin = {
  id: string;
  uri: string | null;
  thumbPath: string | null;
  /** Full-res object, for the in-place fullscreen lightbox. Null on old payloads. */
  imagePath: string | null;
  isPotd: boolean;
  dropDate: string;
  /** Everything the wins wall needs to draw the print. */
  dayNumber: number;
  status: PhotoStatus;
  /** The photo's contextual frame (its day's event, else default) — from decorate_photos. */
  frameId: FrameId;
};

export type ProfileData = {
  id: string;
  username: string;
  avatarUrl: string | null;
  xp: number;
  galleries: number;
  streakWeeks: number;
  hearts: number;
  crowns: number;
  wins: ProfileWin[];
  /** Private starred shots (own profile only) — a mix of practice free shots and
   *  gallery submissions, shown unframed. fullUri is the full-res for the lightbox. */
  starred: { key: string; uri: string | null; fullUri: string | null }[];
  /** This profile's equipped frame — every photo they own wears it. */
  equippedFrame: FrameId;
  /** The VIEWER's unlocked frames (never someone else's). Drives the equip picker. */
  ownedFrames: FrameId[];
  isSelf: boolean;
  isFollowing: boolean;
};

type RawProfile = {
  found: boolean;
  id: string;
  username: string;
  avatar_url: string | null;
  xp: number;
  galleries: number;
  streak_weeks: number;
  hearts: number;
  crowns: number;
  wins: {
    id: string;
    thumb_path: string | null;
    image_path: string | null;
    is_potd: boolean;
    drop_date: string;
    day_number: number;
    status: string | null;
    frame_id: string | null;
  }[];
  equipped_frame: string;
  owned_frames: string[];
  is_self: boolean;
  is_following: boolean;
};

export const profileKey = (targetId: string | null) =>
  `profile:${targetId ?? "self"}`;

/**
 * Standalone so it can be prefetched at login (prefetchEssentials) as well as read
 * live by the hook — that's what lets the Profile tab render from cache instead of
 * cold-loading the first time it's opened.
 */
export async function fetchProfile(
  targetId: string | null,
): Promise<ProfileData | null> {
  const { data: res, error: rpcError } = await supabase.rpc("get_profile", {
    p_user: targetId ?? undefined,
  });
  if (rpcError) throw rpcError;

  const p = res as unknown as RawProfile;
  if (!p || p.found === false) return null;

  const winPaths = (p.wins ?? [])
    .map((w) => w.thumb_path)
    .filter((x): x is string => !!x);

  let starRows: {
    id: string;
    thumb_path: string | null;
    image_path: string | null;
    starred_at: string | null;
  }[] = [];
  if (p.is_self) {
    const [{ data: sf }, { data: sd }] = await Promise.all([
      supabase
        .from("free_shots")
        .select("id, thumb_path, image_path, starred_at")
        .eq("user_id", p.id)
        .eq("starred", true)
        .order("starred_at", { ascending: false })
        .limit(12),
      supabase
        .from("submissions")
        .select("id, thumb_path, image_path, starred_at")
        .eq("user_id", p.id)
        .eq("starred", true)
        .order("starred_at", { ascending: false })
        .limit(12),
    ]);
    starRows = [...(sf ?? []), ...(sd ?? [])]
      .sort(
        (a, b) =>
          Date.parse(b.starred_at ?? "") - Date.parse(a.starred_at ?? ""),
      )
      .slice(0, 12);
  }

  const starThumbPaths = starRows
    .map((r) => r.thumb_path)
    .filter((x): x is string => !!x);
  const starImagePaths = starRows
    .map((r) => r.image_path)
    .filter((x): x is string => !!x);
  const signed = await signThumbs([
    ...winPaths,
    ...starThumbPaths,
    ...starImagePaths,
  ]);

  return {
    id: p.id,
    username: p.username,
    avatarUrl: p.avatar_url,
    xp: p.xp,
    galleries: p.galleries,
    streakWeeks: p.streak_weeks,
    hearts: p.hearts,
    crowns: p.crowns,
    wins: (p.wins ?? []).map((w) => ({
      id: w.id,
      thumbPath: w.thumb_path,
      imagePath: w.image_path ?? null,
      uri: w.thumb_path ? (signed.get(w.thumb_path) ?? null) : null,
      isPotd: w.is_potd,
      dropDate: w.drop_date,
      dayNumber: w.day_number,
      status: asStatus(w.status),
      frameId: asFrameId(w.frame_id),
    })),
    starred: starRows.map((r) => ({
      key: r.id,
      uri: r.thumb_path ? (signed.get(r.thumb_path) ?? null) : null,
      fullUri: r.image_path ? (signed.get(r.image_path) ?? null) : null,
    })),
    equippedFrame: asFrameId(p.equipped_frame),
    ownedFrames: (p.owned_frames ?? []).map(asFrameId),
    isSelf: p.is_self,
    isFollowing: p.is_following,
  };
}

export function useProfile(targetId: string | null) {
  const { data, loading, error, refresh } = useCached<ProfileData | null>(
    profileKey(targetId),
    useCallback(() => fetchProfile(targetId), [targetId]),
    5 * 60_000,
  );
  return { data, loading, error, refresh };
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Follow is one-way, one tap; counts are hidden from everyone (spec §9). */
export async function follow(target: string): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: me, followee_id: target });
  if (!error) invalidate("gallery:following"); // Following tab must reflect the new follow at once
  return !error;
}

export async function unfollow(target: string): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", me)
    .eq("followee_id", target);
  if (!error) invalidate("gallery:following");
  return !error;
}

export type FollowedUser = {
  id: string;
  username: string;
  avatar_url: string | null;
};

/**
 * The accounts the current user follows — for the profile's Following list. Two
 * steps (follow rows → profiles) mirror the reactor fetch and dodge any FK-name
 * guessing. NO counts anywhere (spec §9): this is a navigable list, not a tally.
 */
export async function fetchFollowing(): Promise<FollowedUser[]> {
  const me = await myId();
  if (!me) return [];
  const { data: rows } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", me);
  const ids = (rows ?? []).map((r) => r.followee_id);
  if (ids.length === 0) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", ids);
  return (profs ?? []) as FollowedUser[];
}

/** Permanent account deletion (spec §12) — purges storage + cascades all rows. */
export async function deleteAccount(): Promise<boolean> {
  const { data, error } = await supabase.rpc("delete_account");
  if (error) return false;
  return (data as unknown as { ok: boolean }).ok;
}

/**
 * Set the account's avatar from a locally-picked image. Downscales to a square-ish
 * 512 JPEG, uploads to the public avatars bucket at the RLS-required flat path
 * `{uid}.jpg` (the storage.filename policy rejects a subfolder), then points
 * profiles.avatar_url at the public URL. The path is fixed per user (upsert), so
 * the URL never changes — we append a version query so expo-image fetches the new
 * bytes instead of the cached face. Returns the new URL, or null on failure.
 */
export async function updateAvatar(localUri: string): Promise<string | null> {
  const uid = await myId();
  if (!uid) return null;

  const context = ImageManipulator.manipulate(localUri);
  context.resize({ width: 512 }); // the picker already crops square; keep aspect, don't distort
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  const bytes = await new File(saved.uri).bytes();

  const path = `${uid}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, bytes.buffer as ArrayBuffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) return null;

  const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const url = `${publicUrl}?v=${Date.now()}`;
  const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid);
  if (dbErr) return null;

  invalidate(profileKey(null));
  return url;
}

/**
 * Rename the account. Username is stored lowercased (matching sign-up), and the DB
 * still holds the unique + length constraints, so this is safe even against a race
 * past the live availability check. Returns a friendly error on collision.
 */
export async function updateUsername(name: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await myId();
  if (!uid) return { ok: false, error: "You're signed out." };
  const clean = name.trim().toLowerCase();
  if (clean.length < 3 || clean.length > 24) return { ok: false, error: "Use 3 to 24 characters." };

  const { error } = await supabase.from("profiles").update({ username: clean }).eq("id", uid);
  if (error) {
    const taken = error.message.toLowerCase().includes("unique") || error.code === "23505";
    return { ok: false, error: taken ? "That username is taken." : "Couldn't update your username." };
  }
  invalidate(profileKey(null));
  return { ok: true };
}
