import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { supabase } from '../../lib/supabase';
import { MonthGrid } from '../../components/MonthGrid';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { Screen } from '../../components/Screen';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar';
import { TextLink } from '../../components/TextLink';
import { deleteCapture } from '../../lib/deleteCapture';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { queryKeys, fetchTimelineMonth, invalidateCaptureQueries, type MonthData, type MonthDay } from '../../lib/captureQueries';
import { getSignedUrls } from '../../lib/signedUrlCache';
import { colors, spacing, type } from '../../lib/theme';

const EMPTY_ICON = { ios: 'calendar', android: 'calendar_month' } as const;

type MonthKey = string; // `${year}-${month}`

function monthKey(year: number, month: number): MonthKey {
  return `${year}-${month}`;
}

function toISODate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function monthLabel(y: number, m: number): string {
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function Timeline() {
  const now = new Date();
  const todayISO = toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const [createdAtISO, setCreatedAtISO] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [monthKeys, setMonthKeys] = useState<MonthKey[]>([monthKey(now.getFullYear(), now.getMonth() + 1)]);
  // A near-empty current month (e.g. the 1st of the month, or a month with no
  // captures yet) renders content shorter than the viewport, so the inverted
  // FlatList never becomes scrollable and `onEndReached` — the only other
  // trigger for loadOlderMonth — never fires. Track both heights and backfill
  // older months until the content actually overflows, so a month with real
  // captures further back isn't stranded behind a screen nothing can scroll.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewer, setViewer] = useState<{
    urls: string[];
    cacheKeys: string[];
    captureIds: string[];
    initialIndex: number;
    year: number;
    month: number;
  } | null>(null);
  const [openingDay, setOpeningDay] = useState<number | null>(null);
  const loadingRef = useRef(false);
  const reachedStartRef = useRef(false);
  const listRef = useRef<FlatList<MonthKey>>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('created_at').single();
        if (error) console.error('[timeline] profile fetch failed', error);
        setCreatedAtISO(data?.created_at?.slice(0, 10) ?? null);
      } catch (err) {
        console.error('[timeline] profile fetch threw', err);
      } finally {
        setProfileLoaded(true);
      }
    })();
  }, []);

  const monthQueries = useQueries({
    queries: monthKeys.map((key) => {
      const [y, m] = key.split('-').map(Number);
      return {
        queryKey: queryKeys.timelineMonth(y, m),
        queryFn: () => fetchTimelineMonth(y, m, todayISO, createdAtISO),
      };
    }),
  });
  // Memoized (not rebuilt as a fresh object every render) because the viewport-backfill
  // effect below depends on this reference to know when new month data actually arrived --
  // React Query gives each query result a stable `data` reference across renders where the
  // content hasn't changed (structural sharing), so this only recomputes on a real change.
  // A fixed-length dep (dataUpdatedAt timestamps joined into one string) instead of
  // spreading monthQueries.map(q => q.data) directly -- that array grows every time
  // loadOlderMonth adds a month, and useMemo's deps array must stay a constant length
  // across renders or React throws.
  const monthsDataDepsKey = monthKeys.join(',') + '|' + monthQueries.map((q) => q.dataUpdatedAt).join(',');
  const monthsData: Record<MonthKey, MonthData> = useMemo(() => {
    const next: Record<MonthKey, MonthData> = {};
    monthKeys.forEach((key, i) => {
      const data = monthQueries[i].data;
      if (data) next[key] = data;
    });
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsDataDepsKey]);

  const queryClient = useQueryClient();

  // monthsData is fetched once per key and never invalidated by time passing, so a capture
  // taken while this tab sits unmounted (it's captured via the floating camera FAB, not from
  // here) leaves the current month stale until this refetch on focus picks it up.
  useFocusEffect(
    useCallback(() => {
      const key = monthKeys[0];
      if (!key) return;
      const [y, m] = key.split('-').map(Number);
      queryClient.invalidateQueries({ queryKey: queryKeys.timelineMonth(y, m) });
    }, [monthKeys, queryClient])
  );

  function loadOlderMonth() {
    // profileLoaded gates this so an older month can never slip in before we
    // know the account's created_at boundary (createdAtISO alone can't tell
    // "not fetched yet" apart from "no created_at value").
    if (loadingRef.current || reachedStartRef.current || !profileLoaded) return;
    loadingRef.current = true;
    // Compute the next key from `prev`, not the outer `monthKeys` closure — onEndReached
    // and the viewport-backfill effect can both call this before React commits the first
    // update, and both would otherwise compute and push the same stale "older" key twice.
    setMonthKeys((prev) => {
      const lastKey = prev[prev.length - 1];
      const [y, m] = lastKey.split('-').map(Number);
      const older = prevMonth(y, m);
      if (createdAtISO) {
        const createdMonthIndex = Number(createdAtISO.slice(0, 4)) * 12 + Number(createdAtISO.slice(5, 7));
        const olderMonthIndex = older.year * 12 + older.month;
        if (olderMonthIndex < createdMonthIndex) {
          reachedStartRef.current = true;
          return prev;
        }
      }
      const key = monthKey(older.year, older.month);
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
    loadingRef.current = false;
  }

  // Keeps requesting older months while the rendered list is shorter than the
  // screen — see the viewportHeight/contentHeight comment above. Once content
  // overflows (or reachedStartRef trips inside loadOlderMonth), this is a no-op
  // and normal scroll-triggered onEndReached takes over.
  useEffect(() => {
    if (viewportHeight === 0 || contentHeight === 0) return;
    if (contentHeight > viewportHeight) return;
    loadOlderMonth();
  }, [viewportHeight, contentHeight, monthsData, profileLoaded]);

  async function handleDeleteFromViewer(index: number) {
    if (!viewer) return;
    const captureId = viewer.captureIds[index];
    const { error } = await deleteCapture(captureId);
    if (error) throw error;
    setViewer((prev) => {
      if (!prev) return prev;
      const urls = prev.urls.filter((_, i) => i !== index);
      const cacheKeys = prev.cacheKeys.filter((_, i) => i !== index);
      const captureIds = prev.captureIds.filter((_, i) => i !== index);
      return urls.length > 0 ? { ...prev, urls, cacheKeys, captureIds } : null;
    });
    invalidateCaptureQueries(queryClient);
  }

  // The grid only ever holds a thumbnail for a day (see fetchTimelineMonth), so opening
  // the fullscreen viewer resolves full-res signed urls for that day's photos on demand
  // instead of the whole month having been eagerly pulled full-res when the grid loaded.
  async function handlePressDay(data: MonthData, d: MonthDay) {
    if (openingDay !== null) return;
    setOpeningDay(d.day);
    try {
      const signedByPath = await getSignedUrls(d.photoPaths);
      const pairs = d.photoPaths
        .map((path, i) => ({ url: signedByPath.get(path), path, id: d.captureIds[i] }))
        .filter((p): p is { url: string; path: string; id: string } => !!p.url);
      if (pairs.length === 0) return;
      setViewer({
        urls: pairs.map((p) => p.url),
        cacheKeys: pairs.map((p) => p.path),
        captureIds: pairs.map((p) => p.id),
        initialIndex: 0,
        year: data.year,
        month: data.month,
      });
    } finally {
      setOpeningDay(null);
    }
  }

  const firstMonth = monthsData[monthKeys[0]];
  const hasAnyCaptureSoFar = Object.values(monthsData).some((m) => m.days.some((d) => d.imageUrl));
  const oldestKey = monthKeys[monthKeys.length - 1];
  const loadingOlder = monthKeys.length > 1 && !monthsData[oldestKey];

  return (
    <Screen style={{ paddingHorizontal: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text style={{ ...type.title, color: colors.textPrimary }}>Timeline</Text>
        {monthKeys.length > 1 ? (
          <TextLink label="Today" inline onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
        ) : null}
      </View>

      {firstMonth && !hasAnyCaptureSoFar ? (
        <View style={{ alignItems: 'center', paddingTop: spacing.xl, gap: spacing.sm }}>
          <SymbolView name={EMPTY_ICON} size={28} tintColor={colors.textMuted} />
          <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
            Nothing captured yet. Your archive starts with your first photo.
          </Text>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={monthKeys}
        keyExtractor={(key) => key}
        inverted
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        onContentSizeChange={(_width, height) => setContentHeight(height)}
        onEndReachedThreshold={0.5}
        onEndReached={loadOlderMonth}
        // inverted flips top/bottom visually — paddingTop here lands at the
        // screen's visual bottom, where the floating nav bar now sits, so it
        // carries TAB_BAR_CLEARANCE on top of the normal breathing room.
        contentContainerStyle={{ gap: spacing.lg, paddingTop: spacing.xl + TAB_BAR_CLEARANCE }}
        ListFooterComponent={
          loadingOlder ? (
            <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md }}>
              Loading…
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const data = monthsData[item];
          if (!data) return null;
          return (
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  ...type.data,
                  fontSize: 11,
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                  color: colors.textMuted,
                }}
              >
                {monthLabel(data.year, data.month)}
              </Text>
              <MonthGrid
                year={data.year}
                month={data.month}
                leadingBlanks={data.leadingBlanks}
                days={data.days}
                onPressDay={(d) => handlePressDay(data, d)}
              />
            </View>
          );
        }}
      />

      <PhotoViewerModal
        urls={viewer?.urls ?? []}
        cacheKeys={viewer?.cacheKeys ?? []}
        initialIndex={viewer?.initialIndex ?? 0}
        visible={!!viewer}
        onClose={() => setViewer(null)}
        captureIds={viewer?.captureIds ?? []}
        onDelete={handleDeleteFromViewer}
      />
    </Screen>
  );
}

class TimelineErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[timeline] render crashed', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Screen style={{ paddingHorizontal: spacing.md }}>
          <Text style={{ ...type.body, color: colors.textMuted }}>Timeline failed to load: {this.state.error.message}</Text>
        </Screen>
      );
    }
    return this.props.children;
  }
}

export default function TimelineScreen() {
  return (
    <TimelineErrorBoundary>
      <Timeline />
    </TimelineErrorBoundary>
  );
}
