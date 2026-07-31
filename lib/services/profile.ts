import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Sharing from "expo-sharing";

import { myId } from "./auth";
import { invalidate, signThumbs } from "../cache";
import { asFrameId, asStatus, type FrameId, type PhotoStatus } from "../frames";
import { supabase } from "./supabase";

export type ProfileWin = {
  id: string;
  uri: string | null;
  fullUri: string | null;
  thumbPath: string | null;
  imagePath: string | null;
  isPotd: boolean;
  dropDate: string;
  dayNumber: number;
  status: PhotoStatus;
  frameId: FrameId;
};

export type ProfileData = {
  id: string;
  username: string;
  avatarUrl: string | null;
  xp: number;
  shots: number;
  galleries: number;
  streakWeeks: number;
  hearts: number;
  crowns: number;
  wins: ProfileWin[];
  starred: { key: string; type: "free" | "daily"; uri: string | null; fullUri: string | null }[];
  equippedFrame: FrameId;
  ownedFrames: FrameId[];
  badges: string[];
  isSelf: boolean;
  isFollowing: boolean;
  blurSensitive: boolean | null;
};

type RawProfile = {
  found: boolean;
  id: string;
  username: string;
  avatar_url: string | null;
  xp: number;
  shots: number;
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
  badges: string[];
  is_self: boolean;
  is_following: boolean;
  blur_sensitive: boolean | null;
};

export const profileKey = (targetId: string | null) =>
  `profile:${targetId ?? "self"}`;

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
    .flatMap((w) => [w.thumb_path, w.image_path])
    .filter((x): x is string => !!x);

  let starRows: {
    id: string;
    type: "free" | "daily";
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
    starRows = [
      ...(sf ?? []).map((r) => ({ ...r, type: "free" as const })),
      ...(sd ?? []).map((r) => ({ ...r, type: "daily" as const })),
    ]
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
    shots: p.shots,
    galleries: p.galleries,
    streakWeeks: p.streak_weeks,
    hearts: p.hearts,
    crowns: p.crowns,
    wins: (p.wins ?? []).map((w) => ({
      id: w.id,
      thumbPath: w.thumb_path,
      imagePath: w.image_path ?? null,
      uri: w.thumb_path ? (signed.get(w.thumb_path) ?? null) : null,
      fullUri: w.image_path ? (signed.get(w.image_path) ?? null) : null,
      isPotd: w.is_potd,
      dropDate: w.drop_date,
      dayNumber: w.day_number,
      status: asStatus(w.status),
      frameId: asFrameId(w.frame_id),
    })),
    starred: starRows.map((r) => ({
      key: r.id,
      type: r.type,
      uri: r.thumb_path ? (signed.get(r.thumb_path) ?? null) : null,
      fullUri: r.image_path ? (signed.get(r.image_path) ?? null) : null,
    })),
    equippedFrame: asFrameId(p.equipped_frame),
    ownedFrames: (p.owned_frames ?? []).map(asFrameId),
    badges: p.badges ?? [],
    isSelf: p.is_self,
    isFollowing: p.is_following,
    blurSensitive: p.blur_sensitive ?? true,
  };
}

export async function follow(target: string): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: me, followee_id: target });
  if (!error) { invalidate("gallery:following"); invalidate("following:preview"); invalidate("following:all"); }
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
  if (!error) { invalidate("gallery:following"); invalidate("following:preview"); invalidate("following:all"); }
  return !error;
}

export type FollowedUser = {
  id: string;
  username: string;
  avatar_url: string | null;
};

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

/** Preview: only the first 5 — the face pile never shows more. */
export async function fetchFollowingPreview(): Promise<FollowedUser[]> {
  const me = await myId();
  if (!me) return [];
  const { data: rows } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", me)
    .limit(5);
  const ids = (rows ?? []).map((r) => r.followee_id);
  if (ids.length === 0) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", ids);
  return (profs ?? []) as FollowedUser[];
}

export async function deleteAccount(): Promise<boolean> {
  const { data, error } = await supabase.rpc("delete_account");
  if (error) return false;
  return (data as unknown as { ok: boolean }).ok;
}

export type MyStats = {
  shots: number;
  galleries: number;
  potd: number;
  best_rank: number | null;
  quick_draws: number;
};

export function bestFinishLabel(s: MyStats | null): string | null {
  if (!s) return null;
  if (s.potd > 0) return "Photo of the Day";
  if (s.best_rank != null) return `#${s.best_rank} in the gallery`;
  if (s.galleries > 0) return "Made the gallery";
  return null;
}

export async function exportMyData(): Promise<boolean> {
  const { data, error } = await supabase.rpc("export_my_data" as never);
  if (error || !data) return false;
  try {
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const file = new File(Paths.cache, `piqa-my-data-${date}.json`);
    if (file.exists) file.delete();
    file.create();
    file.write(json);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Your Piqa data",
        UTI: "public.json",
      });
    }
    return true;
  } catch (e) {
    console.warn("exportMyData failed:", e);
    return false;
  }
}

export async function updateAvatar(localUri: string): Promise<string | null> {
  const uid = await myId();
  if (!uid) return null;

  const context = ImageManipulator.manipulate(localUri);
  context.resize({ width: 512 });
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
