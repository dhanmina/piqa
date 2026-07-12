/**
 * Archive — the private journal (spec §11c). Filter chips (All · Daily · Starred),
 * month-grouped grid newest-first, entries badged (bracket-mini / crown / star).
 * Tap a shot → action sheet: star (5/mo, anti-ransom messaging lives here) and
 * delete. Never empty as absence: the zero state is an invitation to shoot.
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { BookImage, Star, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteFreeShot, toggleStar, useArchive, type ArchiveItem } from '@lib/archive';
import { Button } from '@/components/atoms/Button';
import { Chip } from '@/components/atoms/Chip';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { EmptyState } from '@/components/molecules/EmptyState';
import { PhotoTile } from '@/components/molecules/PhotoTile';
import { Sheet } from '@/components/molecules/Sheet';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, icons, photo, space, typeScale } from '@/components/tokens';

type Filter = 'all' | 'daily' | 'starred';

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export default function ArchiveScreen() {
  const router = useRouter();
  const { data, loading, refresh } = useArchive();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<ArchiveItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = data?.items ?? [];
  const filtered = items.filter((it) =>
    filter === 'all' ? true : filter === 'daily' ? it.type === 'daily' : it.starred,
  );

  // Group the filtered items into month sections, newest first.
  const sections = useMemo(() => {
    const map = new Map<string, ArchiveItem[]>();
    for (const it of filtered) {
      const k = monthKey(it.capturedAt);
      (map.get(k) ?? map.set(k, []).get(k)!).push(it);
    }
    return Array.from(map.entries()).map(([k, its]) => ({ key: k, label: monthLabel(its[0].capturedAt), items: its }));
  }, [filtered]);

  const starsLeft = data ? Math.max(data.starsCap - data.starsUsed, 0) : 0;

  const onToggleStar = async (item: ArchiveItem) => {
    setBusy(true);
    const res = await toggleStar(item.type, item.id);
    setBusy(false);
    if (!res.ok && res.reason === 'cap') {
      setToast(`That's all ${res.cap ?? data?.starsCap} stars this month`);
    } else if (!res.ok) {
      setToast('Could not update the star');
    } else {
      await refresh();
      setSelected((s) => (s ? { ...s, starred: res.starred ?? s.starred } : s));
    }
  };

  const onDelete = async (item: ArchiveItem) => {
    setBusy(true);
    const ok = await deleteFreeShot(item);
    setBusy(false);
    setSelected(null);
    if (ok) {
      await refresh();
      setToast('Shot deleted');
    } else {
      setToast('Could not delete the shot');
    }
  };

  if (!loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <EmptyState
            icon={BookImage}
            line="Your journal starts with one shot"
            ctaLabel="Take a practice shot"
            onCta={() => router.push('/camera?practice=1')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Mono weight="semibold" size={typeScale.display} color={colors.paper}>
            {items.length}
          </Mono>
          <Text style={styles.sinceLine}>
            {items.length === 1 ? 'shot' : 'shots'}
            {data?.since ? ` since ${monthLabel(data.since)}` : ''}
          </Text>
        </View>

        <View style={styles.chips}>
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Daily Shots" selected={filter === 'daily'} onPress={() => setFilter('daily')} />
          <Chip label="Starred" selected={filter === 'starred'} onPress={() => setFilter('starred')} />
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyFilter}>
            <Text style={styles.emptyFilterLine}>
              {filter === 'starred' ? 'No starred shots yet. Star one to keep it full resolution.' : 'Nothing here yet.'}
            </Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <Mono size={typeScale.caption} color={colors.paper60}>
                {section.label.toUpperCase()}
              </Mono>
              <View style={styles.grid}>
                {section.items.map((it) => (
                  <Pressable
                    key={`${it.type}:${it.id}`}
                    accessibilityRole="button"
                    style={styles.cell}
                    onPress={() => setSelected(it)}
                  >
                    <PhotoTile
                      uri={it.uri}
                      badge={it.isPotd ? 'crown' : it.type === 'daily' ? 'daily' : undefined}
                    />
                    {it.starred && (
                      <View style={styles.starBadge}>
                        <Star size={13} strokeWidth={icons.strokeWidth} color={colors.safelight} fill={colors.safelight} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Sheet visible={selected !== null} onClose={() => setSelected(null)} title={undefined}>
        {selected && (
          <>
            {selected.uri && <Image source={{ uri: selected.uri }} style={styles.preview} contentFit="cover" />}
            <Text style={styles.antiRansom}>
              {selected.starred
                ? 'Starred. This shot keeps full resolution.'
                : `Starred shots keep full resolution. ${starsLeft} of ${data?.starsCap ?? 5} stars left this month.`}
            </Text>
            <Button
              label={selected.starred ? 'Starred ✓' : 'Star this shot'}
              variant={selected.starred ? 'ghost' : 'primary'}
              fullWidth
              loading={busy}
              onPress={() => void onToggleStar(selected)}
            />
            {selected.type === 'free' && (
              <Pressable
                accessibilityRole="button"
                style={styles.deleteRow}
                disabled={busy}
                onPress={() => void onDelete(selected)}
              >
                <Trash2 size={16} strokeWidth={icons.strokeWidth} color={colors.paper60} />
                <Text style={styles.deleteLabel}>Delete shot</Text>
              </Pressable>
            )}
          </>
        )}
      </Sheet>

      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const GUTTER = space.gutter;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, justifyContent: 'center' },
  content: { padding: GUTTER, gap: GUTTER, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  sinceLine: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  chips: { flexDirection: 'row', gap: 8 },
  section: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48%' },
  starBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(20, 18, 16, 0.75)',
    padding: 4,
  },
  emptyFilter: { paddingVertical: GUTTER * 2, alignItems: 'center' },
  emptyFilterLine: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, textAlign: 'center' },
  preview: { width: '100%', aspectRatio: photo.aspect, backgroundColor: colors.ink },
  antiRansom: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6 },
  deleteLabel: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper60 },
});
