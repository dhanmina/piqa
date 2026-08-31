import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { supabase } from '../../lib/supabase';
import { getSignedUrls } from '../../lib/signedUrlCache';
import { MonthGrid, type MonthDay } from '../../components/MonthGrid';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { Screen } from '../../components/Screen';
import { TextLink } from '../../components/TextLink';
import { deleteCapture } from '../../lib/deleteCapture';
import { colors, spacing, type } from '../../lib/theme';
import type { DayCellState } from '../../components/WeekStrip';

const EMPTY_ICON = { ios: 'calendar', android: 'calendar_month' } as const;

type MonthKey = string; // `${year}-${month}`
type MonthData = { year: number; month: number; leadingBlanks: number; days: MonthDay[] };

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
  const [monthsData, setMonthsData] = useState<Record<MonthKey, MonthData>>({});
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
    captureIds: string[];
    initialIndex: number;
    year: number;
    month: number;
  } | null>(null);
  const loadingRef = useRef(false);
  const reachedStartRef = useRef(false);
  const monthsDataRef = useRef<Record<MonthKey, MonthData>>({});
  const listRef = useRef<FlatList<MonthKey>>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('created_at')
      .single()
      .then(({ data, error }) => {
        if (error) console.error('[timeline] profile fetch failed', error);
        setCreatedAtISO(data?.created_at?.slice(0, 10) ?? null);
        setProfileLoaded(true);
      })
      .catch((err) => {
        console.error('[timeline] profile fetch threw', err);
        setProfileLoaded(true);
      });
  }, []);

  const fetchMonth = useCallback(
    async (year: number, month: number) => {
      const key = monthKey(year, month);
      let data, error;
      try {
        ({ data, error } = await supabase.rpc('get_timeline_month', { year, month }));
      } catch (err) {
        console.error('[timeline] get_timeline_month threw', year, month, err);
        return;
      }
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
        const iso = toISODate(year, month, r.day);
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
      // Skip the update when nothing actually changed — this refetches on every focus
      // (see below), and replacing days with fresh objects/arrays each time forces every
      // NetworkImage in the grid to remount and flash back through its grey placeholder,
      // same class of bug as the peek photo's re-sign flicker in today.tsx.
      const prevDays = monthsDataRef.current[key]?.days;
      if (prevDays && JSON.stringify(prevDays) === JSON.stringify(days)) return;
      // Warm the cache at full-viewer resolution ahead of the tap, same as Today's
      // captured card — otherwise the fullscreen viewer shows a blank/loading gap.
      if (signedByPath.size > 0) Image.prefetch(Array.from(signedByPath.values()), 'memory-disk');
      setMonthsData((prev) => {
        const next = { ...prev, [key]: { year, month, leadingBlanks: new Date(year, month - 1, 1).getDay(), days } };
        monthsDataRef.current = next;
        return next;
      });
    },
    [todayISO, createdAtISO]
  );

  useEffect(() => {
    monthKeys.forEach((key) => {
      if (!monthsData[key]) {
        const [y, m] = key.split('-').map(Number);
        fetchMonth(y, m);
      }
    });
  }, [monthKeys, monthsData, fetchMonth]);

  // monthsData is fetched once per key and never invalidated, so a capture taken while
  // this tab sits unmounted (it's captured from Today/camera-action, not from here) leaves
  // the current month stale until this refetch on focus picks it up.
  useFocusEffect(
    useCallback(() => {
      const key = monthKeys[0];
      if (!key) return;
      const [y, m] = key.split('-').map(Number);
      fetchMonth(y, m);
    }, [monthKeys, fetchMonth])
  );

  function loadOlderMonth() {
    // profileLoaded gates this so an older month can never slip in before we
    // know the account's created_at boundary (createdAtISO alone can't tell
    // "not fetched yet" apart from "no created_at value").
    if (loadingRef.current || reachedStartRef.current || !profileLoaded) return;
    const lastKey = monthKeys[monthKeys.length - 1];
    const [y, m] = lastKey.split('-').map(Number);
    const older = prevMonth(y, m);
    if (createdAtISO) {
      const createdMonthIndex = Number(createdAtISO.slice(0, 4)) * 12 + Number(createdAtISO.slice(5, 7));
      const olderMonthIndex = older.year * 12 + older.month;
      if (olderMonthIndex < createdMonthIndex) {
        reachedStartRef.current = true;
        return;
      }
    }
    loadingRef.current = true;
    setMonthKeys((prev) => [...prev, monthKey(older.year, older.month)]);
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
      const captureIds = prev.captureIds.filter((_, i) => i !== index);
      return urls.length > 0 ? { ...prev, urls, captureIds } : null;
    });
    fetchMonth(viewer.year, viewer.month);
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
        contentContainerStyle={{ gap: spacing.lg, paddingTop: spacing.xl }}
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
                onPressDay={(d) =>
                  setViewer({ urls: d.imageUrls, captureIds: d.captureIds, initialIndex: 0, year: data.year, month: data.month })
                }
              />
            </View>
          );
        }}
      />

      <PhotoViewerModal
        urls={viewer?.urls ?? []}
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
