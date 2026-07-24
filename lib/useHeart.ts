import { useCallback, useEffect, useState } from "react";

import { useSession } from "./session";
import { supabase } from "./services/supabase";

/**
 * Encapsulates the full heart (reaction) lifecycle for one submission:
 * count, toggled state, and the toggle action with optimistic update.
 *
 * Replaces the 3-prop threading (`heartCount`, `hearted`, `onToggleHeart`)
 * that every call-site had to wire manually into PhotoDetailView.
 */
export function useHeart(submissionId: string | null) {
  const { session } = useSession();
  const myId = session?.user.id;

  const [hearted, setHearted] = useState(false);
  const [count, setCount] = useState(0);

  // Load the current heart state for this submission on mount.
  useEffect(() => {
    if (!submissionId || !myId) return;
    let alive = true;

    if (__DEV__) console.log(`[useHeart] load for ${submissionId.slice(0, 8)}… (session userId, no getUser)`);
    void (async () => {
      // Does the current user already heart this?
      const { data: existing } = await supabase
        .from("reactions")
        .select("user_id")
        .eq("submission_id", submissionId)
        .eq("user_id", myId)
        .maybeSingle();

      if (!alive) return;
      setHearted(!!existing);

      // Get the total count.
      const { data: sub } = await supabase
        .from("submissions")
        .select("reaction_count")
        .eq("id", submissionId)
        .maybeSingle();

      if (alive) setCount(sub?.reaction_count ?? 0);
    })();

    return () => { alive = false; };
  }, [submissionId, myId]);

  const toggle = useCallback(async () => {
    if (!submissionId || !myId) return;
    const next = !hearted;

    // Optimistic update
    setHearted(next);
    setCount((c) => Math.max(0, next ? c + 1 : c - 1));

    try {
      if (next) {
        const { error } = await supabase
          .from("reactions")
          .insert({ user_id: myId, submission_id: submissionId, emoji: "heart" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("reactions")
          .delete()
          .eq("user_id", myId)
          .eq("submission_id", submissionId);
        if (error) throw error;
      }
    } catch {
      // Revert on failure
      setHearted(!next);
      setCount((c) => Math.max(0, next ? c - 1 : c + 1));
    }
  }, [submissionId, hearted, myId]);

  return { hearted, count, toggle };
}
