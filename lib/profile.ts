import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { invalidate, signThumbs, useCached } from "./cache";
import { supabase } from "./supabase";

export type ProfileWin = { id: string; uri: string | null; thumbPath: string | null; isPotd: boolean; dropDate: string };

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
  starred: { key: string; uri: string | null }[];
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
  wins: { id: string; thumb_path: string | null; is_potd: boolean; drop_date: string }[];
  is_self: boolean;
  is_following: boolean;
};

export function useProfile(targetId: string | null) {
  const key = `profile:${targetId ?? "self"}`;
  
  const fetcher = useCallback(async (): Promise<ProfileData | null> => {
    const { data: res, error: rpcError } = await supabase.rpc("get_profile", { p_user: targetId ?? undefined });
    if (rpcError) throw rpcError;
    
    const p = res as unknown as RawProfile;
    if (!p || p.found === false) return null;

    const winPaths = (p.wins ?? []).map((w) => w.thumb_path).filter((x): x is string => !!x);

    let starRows: { id: string; thumb_path: string | null; starred_at: string | null }[] = [];
    if (p.is_self) {
      const [{ data: sf }, { data: sd }] = await Promise.all([
        supabase.from("free_shots").select("id, thumb_path, starred_at").eq("user_id", p.id).eq("starred", true).order("starred_at", { ascending: false }).limit(12),
        supabase.from("submissions").select("id, thumb_path, starred_at").eq("user_id", p.id).eq("starred", true).order("starred_at", { ascending: false }).limit(12),
      ]);
      starRows = [...(sf ?? []), ...(sd ?? [])]
        .sort((a, b) => Date.parse(b.starred_at ?? "") - Date.parse(a.starred_at ?? ""))
        .slice(0, 12);
    }

    const signed = await signThumbs([...winPaths, ...starRows.map((r) => r.thumb_path).filter((x): x is string => !!x)]);

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
        uri: w.thumb_path ? (signed.get(w.thumb_path) ?? null) : null,
        isPotd: w.is_potd,
        dropDate: w.drop_date,
      })),
      starred: starRows.map((r) => ({ key: r.id, uri: r.thumb_path ? (signed.get(r.thumb_path) ?? null) : null })),
      isSelf: p.is_self,
      isFollowing: p.is_following,
    };
  }, [targetId]);

  const { data, loading, error, refresh } = useCached<ProfileData | null>(key, fetcher, 60_000);
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
  const { error } = await supabase.from("follows").insert({ follower_id: me, followee_id: target });
  if (!error) invalidate("gallery:following"); // Following tab must reflect the new follow at once
  return !error;
}

export async function unfollow(target: string): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  const { error } = await supabase.from("follows").delete().eq("follower_id", me).eq("followee_id", target);
  if (!error) invalidate("gallery:following");
  return !error;
}

/** Permanent account deletion (spec §12) — purges storage + cascades all rows. */
export async function deleteAccount(): Promise<boolean> {
  const { data, error } = await supabase.rpc("delete_account");
  if (error) return false;
  return (data as unknown as { ok: boolean }).ok;
}
