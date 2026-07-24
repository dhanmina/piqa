import { useCallback } from "react";

import { useCached } from "./useCache";
import {
  fetchProfile,
  fetchFollowing,
  profileKey,
  type ProfileData,
  type FollowedUser,
  type MyStats,
} from "../services/profile";
import { supabase } from "../services/supabase";

export type { ProfileData, FollowedUser, MyStats };

export function useProfile(targetId: string | null) {
  const { data, loading, error, refresh } = useCached<ProfileData | null>(
    profileKey(targetId),
    useCallback(() => fetchProfile(targetId), [targetId]),
    5 * 60_000,
  );
  return { data, loading, error, refresh };
}

export function useFollowingPreview(enabled: boolean): FollowedUser[] {
  const { data } = useCached<FollowedUser[]>(
    "following:preview",
    useCallback(
      () => (enabled ? fetchFollowing() : Promise.resolve([])),
      [enabled],
    ),
    5 * 60_000,
  );
  return data ?? [];
}

export function useMyStats(enabled: boolean): MyStats | null {
  const { data } = useCached<MyStats | null>(
    "my_stats",
    useCallback(
      async () => {
        if (!enabled) return null;
        const { data } = await supabase.rpc("get_my_stats" as never);
        return (data as unknown as MyStats) ?? null;
      },
      [enabled],
    ),
    5 * 60_000,
  );
  return data ?? null;
}
