import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { supabase } from '../../lib/supabase';
import { getSignedUrl } from '../../lib/signedUrlCache';
import { PeekBackCard } from '../../components/PeekBackCard';
import { CapturedTodayCard } from '../../components/CapturedTodayCard';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { GearIcon } from '../../components/Icons';
import { deleteCapture } from '../../lib/deleteCapture';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, fetchTodayCaptures, invalidateCaptureQueries, type TodayCaptures } from '../../lib/captureQueries';
import { Card } from '../../components/Card';
import { WeekStrip, type DayCell, type DayCellState } from '../../components/WeekStrip';
import { Screen } from '../../components/Screen';
import { StreakWidget } from '../../widgets/StreakWidget';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar';
import { colors, spacing, touchTarget, type } from '../../lib/theme';

type TodayState = { current_count: number; longest_count: number; freezes_remaining: number; captured_today: boolean };
type Peek = { imageUrl: string; label: string; path: string } | null;

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function todayDateLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

// Matches the capturedAt format lib/captureQueue.ts already writes to `captures.captured_at`.
// Local date components, not toISOString() — that converts to UTC, so the day boundary
// lands at UTC midnight instead of the device's local midnight.
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

// No hue per the monochrome palette rule (DESIGN.md) — urgency is communicated
// via border/textMuted only, same as every other at-risk state in the app.
function StreakUrgencyDot({ capturedToday }: { capturedToday: boolean }) {
  if (capturedToday) return null;
  const hour = new Date().getHours();
  if (hour < 12) return null;
  const isUrgent = hour >= 18;
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: isUrgent ? colors.textMuted : 'transparent',
        borderWidth: isUrgent ? 0 : 1,
        borderColor: colors.border,
      }}
    />
  );
}

export default function Today() {
  const params = useLocalSearchParams<{ justCaptured?: string; localPreviewUri?: string }>();
  const [state, setState] = useState<TodayState | null>(null);
  const [peek, setPeek] = useState<Peek>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [peekViewerOpen, setPeekViewerOpen] = useState(false);
  const [capturedDates, setCapturedDates] = useState<Set<string>>(new Set());
  const [frozenDates, setFrozenDates] = useState<Set<string>>(new Set());
  const peekStoragePathRef = useRef<string | null>(null);
  // Set on an optimistic capture, cleared once the server confirms it. Guards
  // loadToday's refetch (which useFocusEffect reruns on every return-to-tab,
  // including the one right after capturing) from clobbering the optimistic
  // captured_today back to false while the queued upload/insert is still in flight.
  const optimisticCapturedTodayRef = useRef(false);

  const todayISO = toISODate(new Date());
  // Stable reference across renders — a fresh Date() here recreated loadToday every
  // render, which retriggered useFocusEffect and caused an infinite refetch loop.
  const weekStart = useMemo(() => startOfWeek(new Date()), [todayISO]);

  const queryClient = useQueryClient();
  const todayCapturesQuery = useQuery({
    queryKey: queryKeys.todayCaptures(todayISO),
    queryFn: () => fetchTodayCaptures(todayISO),
    enabled: !!state?.captured_today,
  });
  const todayPhotoUrls = todayCapturesQuery.data?.urls ?? [];
  const todayPhotoPaths = todayCapturesQuery.data?.paths ?? [];
  const todayCaptureIds = todayCapturesQuery.data?.ids ?? [];
  const todayCaptureCount = todayCapturesQuery.data?.count ?? 0;

  const loadToday = useCallback(() => {
    supabase.rpc('get_today_state', { p_today: todayISO }).then(({ data }) => {
      const row = data?.[0] ?? null;
      if (row && !row.captured_today && optimisticCapturedTodayRef.current) {
        setState({ ...row, captured_today: true });
        return;
      }
      if (row?.captured_today) optimisticCapturedTodayRef.current = false;
      setState(row);
    });

    supabase.rpc('get_peek_back', { p_today: todayISO }).then(async ({ data }) => {
      const row = data?.[0];
      if (!row) return;
      // Skip re-signing the same photo on every focus — a fresh signed URL swaps
      // the Image's uri and forces a visible reload/blink even though nothing changed.
      if (row.storage_path === peekStoragePathRef.current) return;
      const signedUrl = await getSignedUrl(row.storage_path);
      if (signedUrl) {
        peekStoragePathRef.current = row.storage_path;
        setPeek({ imageUrl: signedUrl, label: row.label, path: row.storage_path });
      }
    });

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekStartISO = toISODate(weekStart);
    const weekEndISO = toISODate(weekEnd);

    supabase
      .from('captures')
      .select('captured_at')
      .gte('captured_at', weekStartISO)
      .lte('captured_at', weekEndISO)
      .then(({ data }) => setCapturedDates(new Set((data ?? []).map((r) => r.captured_at as string))));

    supabase
      .from('frozen_dates')
      .select('date')
      .gte('date', weekStartISO)
      .lte('date', weekEndISO)
      .then(({ data }) => setFrozenDates(new Set((data ?? []).map((r) => r.date as string))));
  }, [weekStart]);

  useFocusEffect(loadToday);

  // Optimistic: the remote upload (lib/captureQueue.ts processQueue) runs in the background,
  // so reflect the capture immediately instead of waiting for it to land and a refetch to pick it up.
  useEffect(() => {
    if (!params.justCaptured) return;
    optimisticCapturedTodayRef.current = true;
    setState((prev) => (prev ? { ...prev, captured_today: true } : prev));
    setCapturedDates((prev) => new Set(prev).add(todayISO));
    if (params.localPreviewUri) {
      const uri = params.localPreviewUri;
      queryClient.setQueryData(queryKeys.todayCaptures(todayISO), (prev: TodayCaptures | undefined) => ({
        ids: prev?.ids ?? [],
        urls: [...(prev?.urls ?? []), uri],
        // A local file:// uri is stable on its own (never re-signed), so it needs no
        // cacheKey -- empty string here is just a placeholder to keep this array's
        // length aligned with ids/urls until the real upload lands and a refetch
        // (via invalidateCaptureQueries) replaces it with the real storage path.
        paths: [...(prev?.paths ?? []), ''],
        count: (prev?.count ?? 0) + 1,
      }));
    }
    router.setParams({ justCaptured: undefined, localPreviewUri: undefined });
  }, [params.justCaptured, params.localPreviewUri, todayISO]);

  useEffect(() => {
    if (!state) return;
    requestWidgetUpdate({
      widgetName: 'Streak',
      renderWidget: () => (
        <StreakWidget streakCount={state.current_count} capturedToday={state.captured_today} />
      ),
    });
  }, [state]);

  async function handleDeleteTodayCapture(index: number) {
    const captureId = todayCaptureIds[index];
    const { error } = await deleteCapture(captureId);
    if (error) throw error;
    queryClient.setQueryData(queryKeys.todayCaptures(todayISO), (prev: TodayCaptures | undefined) => {
      if (!prev) return prev;
      return {
        ids: prev.ids.filter((_, i) => i !== index),
        urls: prev.urls.filter((_, i) => i !== index),
        paths: prev.paths.filter((_, i) => i !== index),
        count: Math.max(prev.count - 1, 0),
      };
    });
    invalidateCaptureQueries(queryClient);
    loadToday();
  }

  const days: DayCell[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const iso = toISODate(d);
    let cellState: DayCellState;
    if (iso === todayISO) cellState = 'today';
    else if (capturedDates.has(iso)) cellState = 'captured';
    else if (frozenDates.has(iso)) cellState = 'frozen';
    else if (iso < todayISO) cellState = 'missed';
    else cellState = 'future';
    return { key: iso, label: WEEKDAY_LABELS[i], state: cellState };
  });

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_BAR_CLEARANCE }}
      >
        <Animated.View entering={FadeInUp.duration(220)} style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xxs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text
                style={{
                  ...type.data,
                  fontSize: 11,
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                  color: colors.textMuted,
                }}
              >
                {todayDateLabel()}
              </Text>
              <Pressable
                onPress={() => router.push('/settings')}
                hitSlop={touchTarget.min}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                style={{ width: touchTarget.min, height: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
              >
                <GearIcon size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
              {state?.current_count ? (
                <>
                  <Text style={{ ...type.dataHero, color: colors.textPrimary }} numberOfLines={1}>
                    {state.current_count}
                  </Text>
                  <Text
                    style={{
                      ...type.caption,
                      fontSize: 11,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      color: colors.textMuted,
                      marginBottom: 6,
                    }}
                  >
                    {pluralize(state.current_count, 'day')} streak
                  </Text>
                </>
              ) : (
                <Text style={{ ...type.hero, color: colors.textPrimary }} numberOfLines={1}>
                  Start today
                </Text>
              )}
              <StreakUrgencyDot capturedToday={state?.captured_today ?? false} />
            </View>
          </View>

          {peek ? <PeekBackCard peek={peek} onPress={() => setPeekViewerOpen(true)} /> : null}

          <Card style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xxs }}>
              <Text style={{ ...type.title, color: colors.textPrimary }}>This week</Text>
              <Text style={{ ...type.caption, color: colors.textMuted }}>
                <Text style={{ ...type.data, color: colors.textPrimary }}>{state?.freezes_remaining ?? 0}</Text>
                {' '}{pluralize(state?.freezes_remaining ?? 0, 'freeze')} left this week
              </Text>
            </View>
            <WeekStrip days={days} />
          </Card>

          {!state?.captured_today ? (
            // No inline capture button here — the camera FAB docked in TabBar is the
            // app's one capture action everywhere, so a second full-width button on
            // Today would just duplicate it. This is a quiet pending state, not a CTA.
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.5, borderColor: colors.textFaint }} />
              <Text style={{ ...type.caption, color: colors.textFaint }}>Today's mark is still open</Text>
            </View>
          ) : (
            <CapturedTodayCard
              imageUrl={todayPhotoUrls[todayPhotoUrls.length - 1] ?? null}
              imageCacheKey={todayPhotoPaths[todayPhotoPaths.length - 1] || undefined}
              count={todayCaptureCount}
              onView={() => setViewerOpen(true)}
            />
          )}
        </Animated.View>
      </ScrollView>

      <PhotoViewerModal
        urls={todayPhotoUrls}
        cacheKeys={todayPhotoPaths}
        initialIndex={Math.max(todayPhotoUrls.length - 1, 0)}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
        captureIds={todayCaptureIds}
        onDelete={handleDeleteTodayCapture}
      />

      <PhotoViewerModal
        url={peek?.imageUrl}
        cacheKey={peek?.path}
        visible={peekViewerOpen}
        onClose={() => setPeekViewerOpen(false)}
      />
    </Screen>
  );
}
