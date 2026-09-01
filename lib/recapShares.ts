import { supabase } from './supabase';

export type RecapShare = { id: string; kind: 'week' | 'year'; createdAt: string; revokedAt: string | null };

function mapRow(row: { id: string; kind: string; created_at: string; revoked_at: string | null }): RecapShare {
  return { id: row.id, kind: row.kind as 'week' | 'year', createdAt: row.created_at, revokedAt: row.revoked_at };
}

// Frozen at creation, same -6/-365 day windows get_weekly_recap/get_grand_recap
// use (supabase/migrations/0007_recap.sql, 0009_grand_recap.sql) -- see
// supabase/migrations/0040_recap_shares.sql for why this doesn't re-derive
// from "today" on every view. Uses local dates, not UTC, matching how
// captures.captured_at itself is stamped (see lib/captureQueue.ts and
// app/(tabs)/today.tsx's toISODate) -- toISOString() would convert to UTC and
// could land range_end a day behind local "today" for timezones ahead of UTC.
function rangeFor(kind: 'week' | 'year'): { rangeStart: string; rangeEnd: string } {
  const days = kind === 'year' ? 365 : 6;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { rangeStart: iso(start), rangeEnd: iso(end) };
}

export async function createRecapShare(kind: 'week' | 'year'): Promise<{ data: RecapShare | null; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error('Not signed in') };

  const { rangeStart, rangeEnd } = rangeFor(kind);
  const { data, error } = await supabase
    .from('recap_shares')
    .insert({ user_id: user.id, kind, range_start: rangeStart, range_end: rangeEnd })
    .select('id, kind, created_at, revoked_at')
    .single();

  if (error || !data) return { data: null, error: error ?? new Error('No share returned') };
  return { data: mapRow(data), error: null };
}

export async function listRecapShares(): Promise<{ data: RecapShare[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('recap_shares')
    .select('id, kind, created_at, revoked_at')
    .order('created_at', { ascending: false });

  return { data: (data ?? []).map(mapRow), error };
}

export async function revokeRecapShare(id: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('recap_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);

  return { error };
}

export function recapShareUrl(id: string): string {
  const base = process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://joinpiqa.com';
  return `${base}/r/${id}`;
}
