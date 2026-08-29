import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { supabase } from '../../lib/supabase';
import { PeekBackCard } from '../../components/PeekBackCard';
import { CapturedTodayCard } from '../../components/CapturedTodayCard';
import { Card } from '../../components/Card';
import { WeekStrip, type DayCell, type DayCellState } from '../../components/WeekStrip';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StreakWidget } from '../../widgets/StreakWidget';
import { colors, radius, spacing, type } from '../../lib/theme';

type TodayState = { current_count: number; longest_count: number; freezes_remaining: number; captured_today: boolean };
type Peek = { imageUrl: string; label: string } | null;

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function todayDateLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function streakHeroLabel(count: number | undefined): string {
  if (!count) return 'Start today';
  return `${count} day streak`;
}

// Matches the capturedAt format lib/captureQueue.ts already writes to `captures.captured_at`.
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
  const [todayPhotoUrl, setTodayPhotoUrl] = useState<string | null>(null);
  const [capturedDates, setCapturedDates] = useState<Set<string>>(new Set());
  const [frozenDates, setFrozenDates] = useState<Set<string>>(new Set());

  const todayISO = toISODate(new Date());
  const weekStart = startOfWeek(new Date());

  const loadToday = useCallback(() => {
    supabase.rpc('get_today_state').then(({ data }) => setState(data?.[0] ?? null));

    supabase.rpc('get_peek_back').then(async ({ data }) => {
      const row = data?.[0];
      if (!row) return;
      const { data: signed } = await supabase.storage.from('captures').createSignedUrl(row.storage_path, 3600);
      if (signed?.signedUrl) setPeek({ imageUrl: signed.signedUrl, label: row.label });
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
    if (params.localPreviewUri) setTodayPhotoUrl(params.localPreviewUri);
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
      .select('storage_path')
      .eq('captured_at', todayISO)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(async ({ data }) => {
        const row = data?.[0];
        if (!row) return;
        const { data: signed } = await supabase.storage.from('captures').createSignedUrl(row.storage_path, 3600);
        if (signed?.signedUrl) setTodayPhotoUrl(signed.signedUrl);
      });
  }, [state?.captured_today, todayISO]);

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <Animated.View entering={FadeInUp.duration(220)} style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xxs }}>
            <Text style={{ ...type.caption, color: colors.textMuted }}>{todayDateLabel()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text
                style={{ ...type.hero, color: colors.textPrimary, flexShrink: 1 }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {streakHeroLabel(state?.current_count)}
              </Text>
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
            <View style={{ gap: spacing.sm }}>
              <Button label="Capture today's photo" onPress={() => router.push('/capture')} />
              <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
                Any time today, no pressure.
              </Text>
            </View>
          ) : (
            <CapturedTodayCard imageUrl={todayPhotoUrl} onPress={() => router.push('/capture')} />
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label={`Rest days: ${state?.freezes_remaining ?? 0} left this week`} />
            {state?.longest_count ? (
              <Chip label={`Longest streak: ${state.longest_count} ${pluralize(state.longest_count, 'day')}`} />
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: radius.button,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <Text style={{ ...type.caption, color: colors.textMuted }}>{label}</Text>
    </View>
  );
}
