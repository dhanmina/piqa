import { useEffect } from "react";

import { subscribeQueue } from "./captureQueue";
import { fetchKey, invalidate, useCached } from "./cache";
import { supabase } from "./supabase";

export type HomeDrop = {
  id: string;
  prompt: string;
  category: string;
  drops_at: string;
  submit_closes_at: string;
  voting_closes_at: string;
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
};

export type YesterdayPotd = {
  submission_id: string;
  drop_id: string;
  thumb_path: string | null;
  hearts: number;
  shooter: string;
};

export type HomeStreak = {
  current_weeks: number;
  days_this_week: number;
  shields: number;
  is_alive: boolean;
};

export type HomeState = {
  /** Active cycle drop (submit window through 8am voting tail), or null. */
  drop: HomeDrop | null;
  /** Countdown target for the waiting state; null when nothing is scheduled. */
  next_drop_at: string | null;
  submission: HomeSubmission | null;
  yesterday_potd: YesterdayPotd | null;
  streak: HomeStreak | null;
};

const HOME_KEY = "home_state";
// Home state is mostly time-derived on the client (is_live/votingOpen from
// timestamps); the fetched data (submission, streak, PotD) changes on events
// we invalidate explicitly (a landed submission) or at fixed cycle times
// (close/reveal), never within a minute. So focus revisits can serve cache.
const HOME_TTL_MS = 60_000;

async function fetchHomeState(): Promise<HomeState> {
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
  const { data, loading, refresh } = useCached<HomeState>(HOME_KEY, fetchHomeState, HOME_TTL_MS);

  useEffect(() => {
    const unsubscribe = subscribeQueue((event) => {
      if (event.type === "done" || event.type === "duplicate") {
        invalidate(HOME_KEY);
        void fetchKey(HOME_KEY, fetchHomeState);
      }
    });
    return unsubscribe;
  }, []);

  return { data, loading, refresh };
}
