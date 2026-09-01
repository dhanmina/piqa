import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cached capture/timeline/recap data never goes stale on its own -- it's only
// ever correct or wrong, and every screen that can make it wrong already calls
// invalidateCaptureQueries (captureQueries.ts) or targets its own query key
// directly (timeline's focus-effect, today's optimistic setQueryData). So a
// restart that finds a persisted, non-invalidated cache should render it
// straight from disk instead of re-pulling the same rows from Supabase.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: Infinity,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'piqa-query-cache',
});

// Bump this if a cached shape ever changes incompatibly (e.g. MonthData gains
// a required field) -- it invalidates every persisted cache on next launch.
export const QUERY_CACHE_BUSTER = 'v2';
export const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
