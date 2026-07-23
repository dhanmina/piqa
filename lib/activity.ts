import { useCallback, useEffect, useState } from "react";

import { invalidate, signThumbs, useCached } from "./cache";
import { supabase } from "./supabase";

/**
 * The activity inbox — the persisted, personal half of the push pipeline (see
 * supabase/migrations/20260724000001_activity_feed.sql). Four "about you" kinds:
 *   potd          — your shot was crowned Photo of the Day
 *   win           — your shot made the gallery
 *   appreciation  — hearts + nods on a shot, rolled up per shot (event_count)
 *   follow        — a new follower (the one kind that names the actor)
 * Copy is built in the screen from this structured data, never stored server-side.
 */
export type ActivityKind = "potd" | "win" | "appreciation" | "follow";

export type ActivityActor = { id: string; username: string; avatar_url: string | null };

/** Raw shape as returned by get_activity (thumb_path/image_path are private paths). */
type RawActivity = {
  id: string;
  kind: ActivityKind;
  created_at: string;
  seen: boolean;
  event_count: number;
  actor: ActivityActor | null;
  /** The shot this row is about (potd/win/appreciation). */
  submission_id: string | null;
  /** Raw full-res storage path (signed on demand by the photo view). */
  image_path: string | null;
  /** Raw thumb storage path (signed for the row, and a fallback for the view). */
  thumb_path: string | null;
  /** The Subject text of the shot's drop, or null. */
  subject: string | null;
};

/** A feed row with the leading thumb already signed for display. */
export type ActivityItem = RawActivity & {
  /** Signed thumb URL for the row's leading print, or null. */
  thumb: string | null;
};

const PAGE = 30;
const UNREAD_KEY = "activity:unread";
const UNREAD_TTL_MS = 30_000;

async function loadActivity(before?: string): Promise<ActivityItem[]> {
  const { data, error } = await supabase.rpc("get_activity" as never, {
    p_before: before ?? undefined,
    p_limit: PAGE,
  } as never);
  if (error) throw error;
  const rows = (data as unknown as RawActivity[]) ?? [];

  const signed = await signThumbs(rows.map((r) => r.thumb_path).filter((p): p is string => !!p));
  return rows.map((r) => ({
    ...r,
    thumb: r.thumb_path ? signed.get(r.thumb_path) ?? null : null,
  }));
}

/**
 * Paged inbox for /activity. A pushed screen, so it fetches fresh on mount
 * (mirrors /following) with pull-to-refresh and cursor pagination on created_at.
 */
export function useActivity() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  const load = useCallback(async () => {
    const first = await loadActivity();
    setItems(first);
    setAtEnd(first.length < PAGE);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadActivity().then((first) => {
      if (!alive) return;
      setItems(first);
      setAtEnd(first.length < PAGE);
    });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || atEnd || !items || items.length === 0) return;
    setLoadingMore(true);
    try {
      const before = items[items.length - 1].created_at;
      const next = await loadActivity(before);
      setItems((cur) => [...(cur ?? []), ...next]);
      if (next.length < PAGE) setAtEnd(true);
    } finally {
      setLoadingMore(false);
    }
  }, [items, loadingMore, atEnd]);

  return { items, refreshing, loadingMore, refresh, loadMore };
}

/** Stamp the whole inbox read and clear the Today dot immediately. */
export async function markActivitySeen(): Promise<void> {
  try {
    await supabase.rpc("mark_activity_seen" as never);
  } catch {
    // best-effort — a missed mark just shows the dot until the next open
  }
  invalidate(UNREAD_KEY); // force the bell dot to re-read (it will now be false)
}

async function fetchUnread(): Promise<boolean> {
  const { data, error } = await supabase.rpc("get_activity_unread" as never);
  if (error) return false;
  return data === true;
}

/** The calm Today-bell dot: true when any activity is unread. Cheap, cached. */
export function useActivityUnread(): boolean {
  const { data } = useCached<boolean>(UNREAD_KEY, fetchUnread, UNREAD_TTL_MS);
  return data === true;
}
