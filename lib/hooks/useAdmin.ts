import { useCallback, useEffect, useState } from "react";

import { supabase } from "../services/supabase";
import type {
  AdminToday,
  AnalyticsData,
  AuditEntry,
  EngagementData,
  Frame,
  Member,
  RecentSubmission,
  ReportEntry,
  Subject,
  WaitlistEntry,
} from "../services/admin";

/** Whether the signed-in user is an admin (drives the Settings entry + route). */
export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    void supabase.rpc("is_admin" as never).then(({ data }) => {
      if (alive) setAdmin(data === true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return admin;
}

// Generic hook for parameterless admin read-RPCs.
function useAdminQuery<T>(rpc: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: res, error: err } = await supabase.rpc(rpc as never);
    if (err) setError(err.message);
    else {
      setData((res as unknown as T) ?? null);
      setError(null);
    }
    setLoading(false);
  }, [rpc]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/** The current drop for the admin's region + the fields they edit each day. */
export function useAdminToday() {
  return useAdminQuery<AdminToday>("admin_today");
}

/** The full Subject library, ordered as the drop queue (unused by seq first). */
export function useSubjects() {
  return useAdminQuery<Subject[]>("admin_list_prompts");
}

/** Platform health: totals + 14-day daily + recent crowns. */
export function useAnalytics() {
  return useAdminQuery<AnalyticsData>("admin_analytics");
}

/** Deep engagement metrics: DAU, participation rate, streaks, reactions. */
export function useEngagement() {
  return useAdminQuery<EngagementData>("admin_engagement");
}

/** Search photographers by username. Empty query returns all (newest first). */
export function useMembers(query: string) {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: res, error: err } = await supabase.rpc("admin_search_users" as never, {
      p_q: query,
      p_limit: 60,
    } as never);
    if (err) setError(err.message);
    else {
      setData((res as unknown as Member[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/** The full waitlist, newest first. */
export function useWaitlist() {
  return useAdminQuery<WaitlistEntry[]>("admin_list_waitlist");
}

/** Pending reports, sorted by quarantine then reporter count. */
export function useReports() {
  return useAdminQuery<ReportEntry[]>("admin_list_reports");
}

/** The 10 most recent submissions with profile info. */
export function useRecentSubmissions() {
  return useAdminQuery<RecentSubmission[]>("admin_recent_submissions");
}

/** Admin action log, newest first. */
export function useAuditFeed(limit = 60) {
  const [data, setData] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: res, error: err } = await supabase.rpc("admin_recent_audit" as never, {
      p_limit: limit,
    } as never);
    if (err) setError(err.message);
    else {
      setData((res as unknown as AuditEntry[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/** All cosmetic frames with owner counts. */
export function useFrames() {
  return useAdminQuery<Frame[]>("admin_list_frames");
}
