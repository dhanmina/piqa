import { useCallback, useEffect, useState } from "react";

import { useCached } from "../cache";
import { supabase } from "../services/supabase";
import {
  fetchProfile,
  fetchFollowing,
  profileKey,
  type ProfileData,
  type FollowedUser,
  type MyStats,
} from "../services/profile";

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
  const [stats, setStats] = useState<MyStats | null>(null);
  useEffect(() => {
    if (!enabled) {
      setStats(null);
      return;
    }
    let alive = true;
    void supabase.rpc("get_my_stats" as never).then(({ data }) => {
      if (alive && data) setStats(data as MyStats);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return stats;
}
