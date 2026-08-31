import type { QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import type { DayCellState } from '../components/WeekStrip';
import { supabase } from './supabase';
import { getSignedUrls } from './signedUrlCache';

export const queryKeys = {
  todayCaptures: (dateISO: string) => ['todayCaptures', dateISO] as const,
  timelineMonth: (year: number, month: number) => ['timelineMonth', year, month] as const,
  recap: (kind: 'week' | 'year') => ['recap', kind] as const,
};

export type TodayCaptures = { ids: string[]; urls: string[]; count: number };

const EMPTY_RETRY_ATTEMPTS = 3;
const EMPTY_RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The queued upload (lib/captureQueue.ts processQueue) runs in the background and may not
// have landed yet, so an empty result doesn't mean "no photos" -- retry briefly before
// giving up. This query only ever runs when the caller already knows a capture exists for
// the date (today.tsx gates it on captured_today), so an empty result is always transient.
export async function fetchTodayCaptures(dateISO: string): Promise<TodayCaptures> {
  for (let attempt = 0; attempt < EMPTY_RETRY_ATTEMPTS; attempt++) {
    const { data } = await supabase
      .from('captures')
      .select('id, storage_path')
      .eq('captured_at', dateISO)
      .order('created_at', { ascending: true });
    const rows = data ?? [];
    if (rows.length > 0 || attempt === EMPTY_RETRY_ATTEMPTS - 1) {
      const signedByPath = await getSignedUrls(rows.map((row) => row.storage_path));
      const resolvedRows = rows.filter((row) => signedByPath.has(row.storage_path));
      const urls = resolvedRows.map((row) => signedByPath.get(row.storage_path)!);
      // Warm the cache at full-viewer resolution ahead of the tap -- the fullscreen viewer
      // renders much larger than the thumbnail, so without this the thumbnail's cached
      // decode doesn't cover it and opening the viewer still shows a blank/loading gap.
      Image.prefetch(urls, 'memory-disk');
      return { ids: resolvedRows.map((row) => row.id), urls, count: rows.length };
    }
    await sleep(EMPTY_RETRY_DELAY_MS);
  }
  return { ids: [], urls: [], count: 0 };
}

export type MonthDay = {
  day: number;
  imageUrl: string | null;
  imageUrls: string[];
  captureIds: string[];
  state: DayCellState;
};
export type MonthData = { year: number; month: number; leadingBlanks: number; days: MonthDay[] };

export async function fetchTimelineMonth(
  year: number,
  month: number,
  todayISO: string,
  createdAtISO: string | null
): Promise<MonthData> {
  const { data, error } = await supabase.rpc('get_timeline_month', { year, month });
  if (error) console.error('[timeline] get_timeline_month failed', year, month, error);
  const rows: { day: number; storage_paths: string[] | null; capture_ids: string[] | null; frozen: boolean }[] =
    data ?? [];
  const paths = rows.flatMap((r) => r.storage_paths ?? []);
  let signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    try {
      signedByPath = await getSignedUrls(paths);
    } catch (err) {
      console.error('[timeline] getSignedUrls failed', err);
    }
  }
  const days: MonthDay[] = rows.map((r) => {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`;
    const dayPaths = r.storage_paths ?? [];
    const dayIds = r.capture_ids ?? [];
    const resolvedMask = dayPaths.map((p) => signedByPath.has(p));
    const capturedCount = dayPaths.length;
    const imageUrls = dayPaths.filter((_, i) => resolvedMask[i]).map((p) => signedByPath.get(p)!);
    const captureIds = dayIds.filter((_, i) => resolvedMask[i]);
    if (imageUrls.length !== capturedCount) {
      console.error(
        '[timeline] signed url count mismatch for day',
        iso,
        'expected',
        capturedCount,
        'got',
        imageUrls.length,
        'paths',
        r.storage_paths
      );
    }
    const imageUrl = imageUrls.length > 0 ? imageUrls[imageUrls.length - 1] : null;
    let state: DayCellState;
    if (imageUrl) state = 'captured';
    else if (iso === todayISO) state = 'today';
    else if (r.frozen) state = 'frozen';
    else if (createdAtISO && iso < createdAtISO) state = 'future';
    else if (iso < todayISO) state = 'missed';
    else state = 'future';
    return { day: r.day, imageUrl, imageUrls, captureIds, state };
  });
  // Warm the cache at full-viewer resolution ahead of the tap, same as Today's captured
  // card -- otherwise the fullscreen viewer shows a blank/loading gap.
  if (signedByPath.size > 0) Image.prefetch(Array.from(signedByPath.values()), 'memory-disk');
  return { year, month, leadingBlanks: new Date(year, month - 1, 1).getDay(), days };
}

export async function fetchRecapPhotos(kind: 'week' | 'year'): Promise<string[]> {
  const rpc = kind === 'year' ? 'get_grand_recap' : 'get_weekly_recap';
  const { data } = await supabase.rpc(rpc);
  const paths: string[] = (data ?? []).map((r: any) => r.storage_path);
  if (paths.length === 0) return [];
  const signedByPath = await getSignedUrls(paths);
  return paths.map((p) => signedByPath.get(p)).filter((url): url is string => !!url);
}

// Every screen that shows a capture list calls this after a successful delete, so a
// delete on any one screen refreshes every other mounted screen's list too -- this is
// the single place that knows every query key family a delete can affect.
export function invalidateCaptureQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['todayCaptures'] });
  queryClient.invalidateQueries({ queryKey: ['timelineMonth'] });
  queryClient.invalidateQueries({ queryKey: ['recap'] });
}
