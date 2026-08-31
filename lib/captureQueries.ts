import type { QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { supabase } from './supabase';
import { getSignedUrls } from './signedUrlCache';

export const queryKeys = {
  todayCaptures: (dateISO: string) => ['todayCaptures', dateISO] as const,
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

// Every screen that shows a capture list calls this after a successful delete, so a
// delete on any one screen refreshes every other mounted screen's list too -- this is
// the single place that knows every query key family a delete can affect.
export function invalidateCaptureQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['todayCaptures'] });
  queryClient.invalidateQueries({ queryKey: ['timelineMonth'] });
  queryClient.invalidateQueries({ queryKey: ['recap'] });
}
