import { useEffect } from "react";

import { fetchKey, invalidate, useCached } from "./cache";
import { subscribeQueue } from "./captureQueue";
import { useSession } from "./session";
import { supabase } from "./supabase";

const DAY = 86_400_000;

/** Local YYYY-MM-DD for a date, to compare against subject_drops.drop_date. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Row = { subject_drops: { drop_date: string } | { drop_date: string }[] | null };

/**
 * The real last-7-days submission pattern for the flame's dots — one boolean per
 * calendar day, oldest first, index 6 = today. Reads the viewer's own recent
 * submissions (owner RLS) rather than a rolling count, so a day you shot always
 * lights its dot and the sliding window is legible. A submitted-but-not-closed
 * shot already has a thumb, so today's dot fills the moment you submit.
 */
async function fetchLast7(userId: string): Promise<boolean[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select("subject_drops(drop_date)")
    .eq("user_id", userId)
    .not("thumb_path", "is", null)
    .order("captured_at", { ascending: false })
    .limit(30);
  if (error) throw error;

  const shot = new Set<string>();
  for (const r of (data ?? []) as Row[]) {
    const pd = Array.isArray(r.subject_drops) ? r.subject_drops[0] : r.subject_drops;
    if (pd?.drop_date) shot.add(pd.drop_date);
  }

  const today = Date.now();
  return Array.from({ length: 7 }, (_, i) => shot.has(ymd(new Date(today - (6 - i) * DAY))));
}

export function useLast7Pattern(): boolean[] {
  const { session } = useSession();
  const uid = session?.user.id ?? null;
  const key = uid ? `streak7:${uid}` : "streak7:none";
  const { data } = useCached<boolean[]>(key, () => (uid ? fetchLast7(uid) : Promise.resolve([])), 60_000);

  // Fill today's dot the instant a shot lands, like the home state does.
  useEffect(() => {
    const unsubscribe = subscribeQueue((event) => {
      if (event.type === "done" || event.type === "duplicate") {
        invalidate(key);
        if (uid) void fetchKey(key, () => fetchLast7(uid));
      }
    });
    return unsubscribe;
  }, [key, uid]);

  return data ?? [];
}
