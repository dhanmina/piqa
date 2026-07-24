import { useCallback } from "react";

import { useCached } from "../cache";
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

const ADMIN_TTL_MS = 30_000;

/** Whether the signed-in user is an admin (drives the Settings entry + route). */
export function useIsAdmin(): boolean {
  const { data } = useCached<boolean>(
    "is_admin",
    useCallback(
      async () => {
        const { data } = await supabase.rpc("is_admin" as never);
        return data === true;
      },
      [],
    ),
    5 * 60_000,
  );
  return data ?? false;
}

// Generic hook for parameterless admin read-RPCs, routed through useCached
// with a 30s TTL so tab switches within the admin screen are instant.
function useAdminQuery<T>(key: string, rpc: string) {
  const { data, loading, error, refresh } = useCached<T | null>(
    key,
    useCallback(
      async () => {
        const { data, error } = await supabase.rpc(rpc as never);
        if (error) throw new Error(error.message);
        return (data as T) ?? null;
      },
      [rpc],
    ),
    ADMIN_TTL_MS,
  );
  return { data, loading, error: error || false, refresh };
}

/** The current drop for the admin's region + the fields they edit each day. */
export function useAdminToday() {
  return useAdminQuery<AdminToday>("admin:today", "admin_today");
}

/** The full Subject library, ordered as the drop queue (unused by seq first). */
export function useSubjects() {
  return useAdminQuery<Subject[]>("admin:subjects", "admin_list_prompts");
}

/** Platform health: totals + 14-day daily + recent crowns. */
export function useAnalytics() {
  return useAdminQuery<AnalyticsData>("admin:analytics", "admin_analytics");
}

/** Deep engagement metrics: DAU, participation rate, streaks, reactions. */
export function useEngagement() {
  return useAdminQuery<EngagementData>("admin:engagement", "admin_engagement");
}

/** Search photographers by username. Empty query returns all (newest first). */
export function useMembers(query: string) {
  const { data, loading, error, refresh } = useCached<Member[] | null>(
    `admin:members:${query}`,
    useCallback(
      async () => {
        const { data, error } = await supabase.rpc("admin_search_users" as never, {
          p_q: query,
          p_limit: 60,
        } as never);
        if (error) throw new Error(error.message);
        return (data as Member[]) ?? [];
      },
      [query],
    ),
    ADMIN_TTL_MS,
  );
  return { data: data ?? [], loading, error: error || false, refresh };
}

/** The full waitlist, newest first. */
export function useWaitlist() {
  return useAdminQuery<WaitlistEntry[]>("admin:waitlist", "admin_list_waitlist");
}

/** Pending reports, sorted by quarantine then reporter count. */
export function useReports() {
  return useAdminQuery<ReportEntry[]>("admin:reports", "admin_list_reports");
}

/** The 10 most recent submissions with profile info. */
export function useRecentSubmissions() {
  return useAdminQuery<RecentSubmission[]>("admin:recent_subs", "admin_recent_submissions");
}

/** Admin action log, newest first. */
export function useAuditFeed(limit = 60) {
  const { data, loading, error, refresh } = useCached<AuditEntry[] | null>(
    `admin:audit:${limit}`,
    useCallback(
      async () => {
        const { data, error } = await supabase.rpc("admin_recent_audit" as never, {
          p_limit: limit,
        } as never);
        if (error) throw new Error(error.message);
        return (data as AuditEntry[]) ?? [];
      },
      [limit],
    ),
    ADMIN_TTL_MS,
  );
  return { data: data ?? [], loading, error: error || false, refresh };
}

/** All cosmetic frames with owner counts. */
export function useFrames() {
  return useAdminQuery<Frame[]>("admin:frames", "admin_list_frames");
}
