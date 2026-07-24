import { useCallback, useEffect } from "react";

import { subscribeQueue } from "./services/captureQueue";
import { fetchKey, revalidate, useCached } from "./cache";
import type { FrameId, PhotoStatus } from "./frames";
import { supabase } from "./services/supabase";

/** The photography tip for the user's current Subject, or null (learning loop). */
export function useTodayHint(): string | null {
  const { data } = useCached<string | null>(
    "today_hint",
    useCallback(async () => {
      const { data } = await supabase.rpc("get_today_hint" as never);
      return (data as string | null) ?? null;
    }, []),
    60_000,
  );
  return data ?? null;
}

/** Whether the user's current Subject is a Golden Shot (weekly special event). */
export function useTodayGolden(): boolean {
  const { data } = useCached<boolean>(
    "today_golden",
    useCallback(async () => {
      const { data } = await supabase.rpc("get_today_golden" as never);
      return data === true;
    }, []),
    60_000,
  );
  return data ?? false;
}

export type HomeDrop = {
  id: string;
  prompt: string;
  category: string;
  drops_at: string;
  submit_closes_at: string;
  voting_closes_at: string;
  /** Global day counter, server-owned. Printed on the frame rail. */
  day_number: number;
  is_live: boolean;
};

export type HomeSubmission = {
  id: string;
  captured_at: string;
  image_path: string | null;
  thumb_path: string | null;
  vote_count: number;
  reaction_count: number;
  quick_draw: boolean;
  in_gallery: boolean;
  is_potd: boolean;
  /** null until the day closes — status is only ever written by close_day. */
  status: PhotoStatus;
  day_number: number;
};

export type YesterdayPotd = {
  submission_id: string;
  drop_id: string;
  thumb_path: string | null;
  hearts: number;
  shooter: string;
  /** The winner's CURRENT frame, read live — not frozen at close. */
  equipped_frame: FrameId;
  day_number: number;
  status: PhotoStatus;
};

export type HomeStreak = {
  current_weeks: number;
  days_this_week: number;
  shields: number;
  is_alive: boolean;
};

/** The viewer's own result on the most recent revealed drop (the done state). */
export type LastResult = {
  drop_id: string;
  drop_date: string;
  day_number: number;
  thumb_path: string | null;
  /** Signed likes (reactions) on this shot. 0 for a non-gallery shot — nobody
   *  could see it to react. Use `votes` for the "picked by curators" line. */
  hearts: number;
  /** Blind-curation picks (the ranking signal). This is what a non-gallery shot
   *  earns; shown as "Picked N times by curators", never as hearts. */
  votes: number;
  in_gallery: boolean;
  is_potd: boolean;
  status: PhotoStatus;
  xp_awarded: number;
};

export type HomeState = {
  /** Active cycle drop (submit window through 8am voting tail), or null. */
  drop: HomeDrop | null;
  /** Countdown target for the waiting state; null when nothing is scheduled. */
  next_drop_at: string | null;
  submission: HomeSubmission | null;
  yesterday_potd: YesterdayPotd | null;
  streak: HomeStreak | null;
  /** Viewer total XP (level is derived; quiet-mode surface). */
  xp: number;
  /** The viewer's own equipped frame — their in-flight shot wears it. */
  equipped_frame: FrameId;
  /** Result to reveal between close and the next drop; null otherwise. */
  last_result: LastResult | null;
};

export const HOME_KEY = "home_state";
// Home state is mostly time-derived on the client (is_live/votingOpen from
// timestamps); the fetched data (submission, streak, PotD) changes on events
// we invalidate explicitly (a landed submission) or at fixed cycle times
// (close/reveal), never within a minute. So focus revisits can serve cache.
const HOME_TTL_MS = 60_000;

export async function fetchHomeState(): Promise<HomeState> {
  const { data, error } = await supabase.rpc("get_home_state");
  if (error) throw new Error(error.message);
  return data as unknown as HomeState;
}

/**
 * One screen = one RPC — now shared. Every useHomeState (TabBar, Today, Camera)
 * reads the same cached key, so a screen visit fetches get_home_state at most
 * once, and only when the cached value is older than the TTL. A landed
 * submission bypasses the TTL so "uploading" flips to "In the running ✓" at once.
 */
export function useHomeState() {
  const { data, loading, error, refresh } = useCached<HomeState>(HOME_KEY, fetchHomeState, HOME_TTL_MS);

  useEffect(() => {
    const unsubscribe = subscribeQueue((event) => {
      if (event.type === "done" || event.type === "duplicate") {
        // Revalidate, don't invalidate: the submitted shot's upload just landed,
        // so pull the real submission row — but keep the current home state on
        // screen meanwhile. Blanking it here is what made the shutter aperture
        // (and Today) reset for a beat right after a shot uploaded.
        revalidate(HOME_KEY);
        void fetchKey(HOME_KEY, fetchHomeState);
      }
    });
    return unsubscribe;
  }, []);

  return { data, loading, error, refresh };
}
