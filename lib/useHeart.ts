import { useCallback, useEffect, useState } from "react";

import { supabase } from "./services/supabase";

/**
 * Encapsulates the full heart (reaction) lifecycle for one submission:
 * count, toggled state, and the toggle action with optimistic update.
 *
 * Replaces the 3-prop threading (`heartCount`, `hearted`, `onToggleHeart`)
 * that every call-site had to wire manually into PhotoDetailView.
 */
export function useHeart(submissionId: string | null) {
  const [hearted, setHearted] = useState(false);
  const [count, setCount] = useState(0);

  // Load the current heart state for this submission on mount.
  useEffect(() => {
    if (!submissionId) return;
    let alive = true;

    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || !alive) return;

      // Does the current user already heart this?
      const { data: existing } = await supabase
        .from("reactions")
        .select("user_id")
        .eq("submission_id", submissionId)
        .eq("user_id", uid)
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
  }, [submissionId]);

  const toggle = useCallback(async () => {
    if (!submissionId) return;
    const next = !hearted;

    // Optimistic update
    setHearted(next);
    setCount((c) => Math.max(0, next ? c + 1 : c - 1));

    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not signed in");

      if (next) {
        const { error } = await supabase
          .from("reactions")
          .insert({ user_id: uid, submission_id: submissionId, emoji: "heart" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("reactions")
          .delete()
          .eq("user_id", uid)
          .eq("submission_id", submissionId);
        if (error) throw error;
      }
    } catch {
      // Revert on failure
      setHearted(!next);
      setCount((c) => Math.max(0, next ? c - 1 : c + 1));
    }
  }, [submissionId, hearted]);

  return { hearted, count, toggle };
}
