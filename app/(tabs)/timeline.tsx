import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { MonthGrid, type MonthDay } from '../../components/MonthGrid';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { Screen } from '../../components/Screen';
import { colors, spacing, type } from '../../lib/theme';
import type { DayCellState } from '../../components/WeekStrip';

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

export default function Timeline() {
  const now = new Date();
  const todayISO = toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const [createdAtISO, setCreatedAtISO] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [monthKeys, setMonthKeys] = useState<MonthKey[]>([monthKey(now.getFullYear(), now.getMonth() + 1)]);
  const [monthsData, setMonthsData] = useState<Record<MonthKey, MonthData>>({});
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const reachedStartRef = useRef(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('created_at')
      .single()
      .then(({ data }) => {
        setCreatedAtISO(data?.created_at?.slice(0, 10) ?? null);
        setProfileLoaded(true);
      });
  }, []);

  const fetchMonth = useCallback(
    async (year: number, month: number) => {
      const key = monthKey(year, month);
      const { data } = await supabase.rpc('get_timeline_month', { year, month });
      const rows: { day: number; storage_path: string | null; frozen: boolean }[] = data ?? [];
      const paths = rows.filter((r) => r.storage_path).map((r) => r.storage_path as string);
      const signedByPath = new Map<string, string>();
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage.from('captures').createSignedUrls(paths, 3600);
        signed?.forEach((s) => {
          if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl);
        });
      }
      const days: MonthDay[] = rows.map((r) => {
        const iso = toISODate(year, month, r.day);
        const imageUrl = r.storage_path ? (signedByPath.get(r.storage_path) ?? null) : null;
        let state: DayCellState;
        if (imageUrl) state = 'captured';
        else if (iso === todayISO) state = 'today';
        else if (r.frozen) state = 'frozen';
        else if (createdAtISO && iso < createdAtISO) state = 'future';
        else if (iso < todayISO) state = 'missed';
        else state = 'future';
        return { day: r.day, imageUrl, state };
      });
      setMonthsData((prev) => ({
        ...prev,
        [key]: { year, month, leadingBlanks: new Date(year, month - 1, 1).getDay(), days },
      }));
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

  const firstMonth = monthsData[monthKeys[0]];
  const hasAnyCaptureSoFar = Object.values(monthsData).some((m) => m.days.some((d) => d.imageUrl));

  return (
    <Screen style={{ paddingHorizontal: spacing.md }}>
      <Text style={{ ...type.title, color: colors.textPrimary, marginBottom: spacing.md }}>Timeline</Text>

      {firstMonth && !hasAnyCaptureSoFar ? (
        <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center', paddingTop: spacing.xl }}>
          Nothing captured yet. Your archive starts with your first photo.
        </Text>
      ) : null}

      <FlatList
        data={monthKeys}
        keyExtractor={(key) => key}
        inverted
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        onEndReached={loadOlderMonth}
        contentContainerStyle={{ gap: spacing.lg, paddingTop: spacing.xl }}
        renderItem={({ item }) => {
          const data = monthsData[item];
          if (!data) return null;
          return (
            <View style={{ gap: spacing.sm }}>
              <Text style={{ ...type.body, color: colors.textMuted }}>{monthLabel(data.year, data.month)}</Text>
              <MonthGrid
                leadingBlanks={data.leadingBlanks}
                days={data.days}
                onPressDay={(d) => setViewerUrl(d.imageUrl)}
              />
            </View>
          );
        }}
      />

      <PhotoViewerModal url={viewerUrl} onClose={() => setViewerUrl(null)} />
    </Screen>
  );
}
