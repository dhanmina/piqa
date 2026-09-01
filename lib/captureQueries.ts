import type { QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import type { DayCellState } from '../components/WeekStrip';
import { supabase } from './supabase';
import { getSignedUrls } from './signedUrlCache';
import { toThumbPath } from './photoPaths';

export const queryKeys = {
  todayCaptures: (dateISO: string) => ['todayCaptures', dateISO] as const,
  timelineMonth: (year: number, month: number) => ['timelineMonth', year, month] as const,
  recap: (kind: 'week' | 'year') => ['recap', kind] as const,
};

export type TodayCaptures = { ids: string[]; urls: string[]; paths: string[]; count: number };

const EMPTY_RETRY_ATTEMPTS = 3;
const EMPTY_RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Warms the disk cache under the storage path (not the signed url, which rotates)
// so a later render with the same cacheKey never re-downloads. Best-effort --
// a failed warm just means the first render pays for the download instead.
function warmCache(pairs: { url: string; path: string }[]): void {
  Promise.all(pairs.map((p) => Image.writeToCacheAsync(p.url, p.path))).catch(() => {});
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
      const paths = resolvedRows.map((row) => row.storage_path);
      // Warm the cache at full-viewer resolution ahead of the tap -- today's photos are
      // few (usually one), so unlike the timeline month grid this eager pull stays cheap.
      warmCache(paths.map((path, i) => ({ url: urls[i], path })));
      return { ids: resolvedRows.map((row) => row.id), urls, paths, count: rows.length };
    }
    await sleep(EMPTY_RETRY_DELAY_MS);
  }
  return { ids: [], urls: [], paths: [], count: 0 };
}

export type MonthDay = {
  day: number;
  // Thumbnail for the grid tile (falls back to full-res for captures uploaded
  // before thumbnails existed, or if the thumb signed-url resolution failed).
  imageUrl: string | null;
  imageCacheKey: string | null;
  photoCount: number;
  // Full-res storage paths, resolved to signed urls on demand only when the
  // fullscreen viewer actually opens -- see timeline.tsx's onPressDay.
  photoPaths: string[];
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

  // Grid tiles only ever show the day's last photo, so only that one needs a
  // thumbnail resolved -- everything else in the day is left as bare paths
  // until (if ever) the viewer opens.
  const tilePaths = rows
    .map((r) => (r.storage_paths ?? []).at(-1))
    .filter((p): p is string => !!p);
  const tileThumbPaths = tilePaths.map(toThumbPath);
  let thumbByPath = new Map<string, string>();
  let fallbackFullByPath = new Map<string, string>();
  try {
    // Older captures (from before thumbnails shipped) have no thumb object -- that's
    // an expected, routine miss here, not something worth logging as an error.
    thumbByPath = await getSignedUrls(tileThumbPaths, { logErrors: false });
    const missing = tilePaths.filter((_, i) => !thumbByPath.has(tileThumbPaths[i]));
    if (missing.length > 0) fallbackFullByPath = await getSignedUrls(missing);
  } catch (err) {
    console.error('[timeline] resolving tile thumbnails failed', err);
  }

  const days: MonthDay[] = rows.map((r) => {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`;
    const dayPaths = r.storage_paths ?? [];
    const dayIds = r.capture_ids ?? [];
    const tilePath = dayPaths.at(-1) ?? null;
    let imageUrl: string | null = null;
    let imageCacheKey: string | null = null;
    if (tilePath) {
      const thumbPath = toThumbPath(tilePath);
      if (thumbByPath.has(thumbPath)) {
        imageUrl = thumbByPath.get(thumbPath)!;
        imageCacheKey = thumbPath;
      } else if (fallbackFullByPath.has(tilePath)) {
        imageUrl = fallbackFullByPath.get(tilePath)!;
        imageCacheKey = tilePath;
      }
    }
    let state: DayCellState;
    if (imageUrl) state = 'captured';
    else if (iso === todayISO) state = 'today';
    else if (r.frozen) state = 'frozen';
    else if (createdAtISO && iso < createdAtISO) state = 'future';
    else if (iso < todayISO) state = 'missed';
    else state = 'future';
    return { day: r.day, imageUrl, imageCacheKey, photoCount: dayPaths.length, photoPaths: dayPaths, captureIds: dayIds, state };
  });

  warmCache(
    Array.from(thumbByPath.entries()).map(([path, url]) => ({ url, path }))
  );
  return { year, month, leadingBlanks: new Date(year, month - 1, 1).getDay(), days };
}

export type RecapPhoto = { url: string; path: string };

export async function fetchRecapPhotos(kind: 'week' | 'year'): Promise<RecapPhoto[]> {
  const rpc = kind === 'year' ? 'get_grand_recap' : 'get_weekly_recap';
  const { data } = await supabase.rpc(rpc);
  const paths: string[] = (data ?? []).map((r: any) => r.storage_path);
  if (paths.length === 0) return [];
  const signedByPath = await getSignedUrls(paths);
  return paths
    .filter((p) => signedByPath.has(p))
    .map((p) => ({ url: signedByPath.get(p)!, path: p }));
}

// Every screen that shows a capture list calls this after a successful delete, so a
// delete on any one screen refreshes every other mounted screen's list too -- this is
// the single place that knows every query key family a delete can affect.
export function invalidateCaptureQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['todayCaptures'] });
  queryClient.invalidateQueries({ queryKey: ['timelineMonth'] });
  queryClient.invalidateQueries({ queryKey: ['recap'] });
}
