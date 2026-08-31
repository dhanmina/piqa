import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { Image } from 'expo-image';
import { supabase } from '../../lib/supabase';
import { getSignedUrl, getSignedUrls } from '../../lib/signedUrlCache';
import { PeekBackCard } from '../../components/PeekBackCard';
import { CapturedTodayCard } from '../../components/CapturedTodayCard';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { deleteCapture } from '../../lib/deleteCapture';
import { Card } from '../../components/Card';
import { WeekStrip, type DayCell, type DayCellState } from '../../components/WeekStrip';
import { Screen } from '../../components/Screen';
import { StreakWidget } from '../../widgets/StreakWidget';
import { Chip } from '../../components/Chip';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar';
import { colors, spacing, type } from '../../lib/theme';

type TodayState = { current_count: number; longest_count: number; freezes_remaining: number; captured_today: boolean };
type Peek = { imageUrl: string; label: string } | null;

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
  const [todayPhotoUrls, setTodayPhotoUrls] = useState<string[]>([]);
  const [todayCaptureIds, setTodayCaptureIds] = useState<string[]>([]);
  const [todayCaptureCount, setTodayCaptureCount] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [capturedDates, setCapturedDates] = useState<Set<string>>(new Set());
  const [frozenDates, setFrozenDates] = useState<Set<string>>(new Set());
  const peekStoragePathRef = useRef<string | null>(null);

  const todayISO = toISODate(new Date());
  // Stable reference across renders — a fresh Date() here recreated loadToday every
  // render, which retriggered useFocusEffect and caused an infinite refetch loop.
  const weekStart = useMemo(() => startOfWeek(new Date()), [todayISO]);

  const loadToday = useCallback(() => {
    supabase.rpc('get_today_state').then(({ data }) => setState(data?.[0] ?? null));

    supabase.rpc('get_peek_back').then(async ({ data }) => {
      const row = data?.[0];
      if (!row) return;
      // Skip re-signing the same photo on every focus — a fresh signed URL swaps
      // the Image's uri and forces a visible reload/blink even though nothing changed.
      if (row.storage_path === peekStoragePathRef.current) return;
      const signedUrl = await getSignedUrl(row.storage_path);
      if (signedUrl) {
        peekStoragePathRef.current = row.storage_path;
        setPeek({ imageUrl: signedUrl, label: row.label });
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
    setState((prev) => (prev ? { ...prev, captured_today: true } : prev));
    setCapturedDates((prev) => new Set(prev).add(todayISO));
    setTodayCaptureCount((prev) => prev + 1);
    if (params.localPreviewUri) {
      const uri = params.localPreviewUri;
      setTodayPhotoUrls((prev) => [...prev, uri]);
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

  useEffect(() => {
    if (!state?.captured_today) return;
    supabase
      .from('captures')
      .select('id, storage_path')
      .eq('captured_at', todayISO)
      .order('created_at', { ascending: true })
      .then(async ({ data }) => {
        const rows = data ?? [];
        setTodayCaptureCount(rows.length);
        const signedByPath = await getSignedUrls(rows.map((row) => row.storage_path));
        const resolvedRows = rows.filter((row) => signedByPath.has(row.storage_path));
        const urls = resolvedRows.map((row) => signedByPath.get(row.storage_path)!);
        setTodayPhotoUrls(urls);
        setTodayCaptureIds(resolvedRows.map((row) => row.id));
        // Warm the cache at full-viewer resolution ahead of the tap — the fullscreen
        // viewer renders much larger than the thumbnail, so without this the thumbnail's
        // cached decode doesn't cover it and opening the viewer still shows a blank/loading gap.
        Image.prefetch(urls, 'memory-disk');
      });
  }, [state?.captured_today, todayISO]);

  async function handleDeleteTodayCapture(index: number) {
    const captureId = todayCaptureIds[index];
    const { error } = await deleteCapture(captureId);
    if (error) throw error;
    setTodayPhotoUrls((prev) => prev.filter((_, i) => i !== index));
    setTodayCaptureIds((prev) => prev.filter((_, i) => i !== index));
    setTodayCaptureCount((prev) => Math.max(prev - 1, 0));
    loadToday();
  }

  const days: DayCell[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const iso = toISODate(d);
    let cellState: DayCellState;
    if (capturedDates.has(iso)) cellState = 'captured';
    else if (iso === todayISO) cellState = 'today';
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

          {peek ? <PeekBackCard peek={peek} /> : null}

          <Card style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xxs }}>
              <Text style={{ ...type.title, color: colors.textPrimary }}>This week</Text>
              <Text style={{ ...type.caption, color: colors.textMuted }}>
                Every capture builds your archive and keeps your streak alive.
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
              count={todayCaptureCount}
              onView={() => setViewerOpen(true)}
              onAddCapture={() => router.push('/capture')}
            />
          )}

          <Chip
            stats={[
              { value: String(state?.freezes_remaining ?? 0), label: 'Rest days left' },
              ...(state?.longest_count ? [{ value: `${state.longest_count}d`, label: 'Longest streak' }] : []),
            ]}
          />
        </Animated.View>
      </ScrollView>

      <PhotoViewerModal
        urls={todayPhotoUrls}
        initialIndex={Math.max(todayPhotoUrls.length - 1, 0)}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
        captureIds={todayCaptureIds}
        onDelete={handleDeleteTodayCapture}
      />
    </Screen>
  );
}
