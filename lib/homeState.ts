import { useCallback, useEffect, useState } from "react";

import { subscribeQueue } from "./captureQueue";
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
  quick_draw: boolean;
  in_gallery: boolean;
  is_potd: boolean;
};

export type HomeStreak = {
  current_weeks: number;
  days_this_week: number;
  shields: number;
};

export type HomeState = {
  drop: HomeDrop | null;
  submission: HomeSubmission | null;
  streak: HomeStreak | null;
};

/**
 * One screen = one RPC. Refetches whenever the capture queue lands a
 * submission row, so "Shot saved ✓ — uploading" flips to "In the running ✓"
 * without user action.
 */
export function useHomeState() {
  const [data, setData] = useState<HomeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("get_home_state");
    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }
    setData(result as unknown as HomeState);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeQueue((event) => {
      if (event.type === "done" || event.type === "duplicate") {
        void refresh();
      }
    });
    return unsubscribe;
  }, [refresh]);

  return { data, loading, error, refresh };
}
