import { useCallback, useEffect, useState } from "react";

import { fetchKey } from "./cache";
import { supabase } from "./services/supabase";

/**
 * Per-user notification preferences (see docs/notification-plan.md). Six
 * category toggles + a quiet-hours switch (21:00–08:00 local). Read/written via
 * RPC (get_/update_notification_prefs) since the columns aren't in the profile
 * update grant. The server honors these in send_push before delivering.
 */
export type NotifPrefs = {
  daily: boolean; // the day's Subject is live
  results: boolean; // the gallery revealed
  wins: boolean; // your photo placed (PotD / gallery / top 10)
  appreciation: boolean; // daily batch of hearts + nods
  social: boolean; // new follower
  closingSoon: boolean; // submissions closing soon — you haven't shot today's yet
  quiet: boolean; // mute 21:00–08:00 local
};

const DEFAULTS: NotifPrefs = {
  daily: true, results: true, wins: true, appreciation: true, social: true, closingSoon: true, quiet: true,
};

export function useNotifPrefs() {
  // fetchKey deduplicates concurrent callers — multiple components mounting
  // simultaneously collapse into ONE RPC call.
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);

  // Initial load (runs once, deduped across instances)
  useEffect(() => {
    let alive = true;
    void fetchKey<NotifPrefs>("notif_prefs", async () => {
      const { data } = await supabase.rpc("get_notification_prefs" as never);
      return ((data as unknown as NotifPrefs) ?? DEFAULTS);
    }).then((p) => {
      if (alive) setPrefs(p);
    });
    return () => { alive = false; };
  }, []);

  const persist = useCallback(async (next: NotifPrefs) => {
    const { error } = await supabase.rpc("update_notification_prefs" as never, {
      p_daily: next.daily, p_results: next.results, p_wins: next.wins,
      p_appreciation: next.appreciation, p_social: next.social, p_quiet: next.quiet,
      p_closing_soon: next.closingSoon,
    } as never);
    if (error) console.warn("update_notification_prefs failed:", error);
  }, []);

  const toggle = useCallback(
    (key: keyof NotifPrefs) =>
      setPrefs((p) => {
        if (!p) return p;
        const next = { ...p, [key]: !p[key] };
        void persist(next); // optimistic; revert isn't worth it for a toggle
        return next;
      }),
    [persist],
  );

  return { prefs, toggle };
}
