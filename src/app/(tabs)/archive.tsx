/**
 * Archive — the private journal (spec §11c). Filter chips (All · Daily · Starred),
 * month-grouped grid newest-first, entries badged (bracket-mini / crown / star).
 * Tap a shot → action sheet: star (5/mo, anti-ransom messaging lives here) and
 * delete. Never empty as absence: the zero state is an invitation to shoot.
 */
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { BookImage, CloudOff, Star, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteFreeShot, toggleStar, useArchive, type ArchiveItem } from '@lib/archive';
import { Button } from '@/components/atoms/Button';
import { Chip } from '@/components/atoms/Chip';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { PhotoTile } from '@/components/molecules/PhotoTile';
import { Sheet } from '@/components/molecules/Sheet';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, icons, photo, radius, space, typeScale } from '@/components/tokens';

type Filter = 'all' | 'daily' | 'starred';

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// Camera-readout stamp for the action sheet header, e.g. "JUL 12, 09:14".
const capturedStamp = (iso: string) =>
  new Date(iso)
    .toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .toUpperCase();

const metaLine = (it: ArchiveItem) => {
  const kind = it.type === 'daily' ? 'Daily Shot' : 'Practice shot';
  const placement = it.isPotd ? 'Photo of the Day' : it.inGallery ? 'In gallery' : null;
  return placement ? `${kind} · ${placement}` : kind;
};

export default function ArchiveScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useArchive();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<ArchiveItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Optimistic star state per item, so the tile fills instantly instead of
  // waiting on the server round-trip + refresh. Cleared once real data lands.
  const [optimisticStars, setOptimisticStars] = useState<Record<string, boolean>>({});
  const starKey = (it: ArchiveItem) => `${it.type}:${it.id}`;

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
    const key = starKey(item);
    const next = !(optimisticStars[key] ?? item.starred);
    setOptimisticStars((m) => ({ ...m, [key]: next })); // flip instantly
    setBusy(true);
    const res = await toggleStar(item.type, item.id);
    setBusy(false);
    if (!res.ok) {
      // Roll back the optimistic flip and explain.
      setOptimisticStars((m) => {
        const copy = { ...m };
        delete copy[key];
        return copy;
      });
      setToast(res.reason === 'cap' ? `That's all ${res.cap ?? data?.starsCap} stars this month` : 'Could not update the star');
      return;
    }
    setSelected((s) => (s ? { ...s, starred: res.starred ?? s.starred } : s));
    await refresh();
    // Real data now reflects the star; drop the optimistic override.
    setOptimisticStars((m) => {
      const copy = { ...m };
      delete copy[key];
      return copy;
    });
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

  // Fetch failed with nothing to show → a recoverable error, not an endless skeleton.
  if (error && !data) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <EmptyState
            icon={CloudOff}
            line="Couldn't load your archive. Check your connection."
            ctaLabel="Retry"
            onCta={() => void refresh()}
          />
        </View>
      </SafeAreaView>
    );
  }

  // First load with nothing cached yet: a stable skeleton, so the screen never
  // flashes "0 shots / Nothing here yet" before the real state settles.
  if (loading && !data) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View
          style={styles.content}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.header}>
            <View style={styles.skelNum} />
          </View>
          <View style={styles.chips}>
            <View style={styles.skelChip} />
            <View style={styles.skelChipWide} />
            <View style={styles.skelChip} />
          </View>
          <View style={styles.grid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={styles.cell}>
                <View style={styles.skelTile} />
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Settled with no shots at all → the invitation (spec: never empty as absence).
  if (items.length === 0) {
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
          <View style={styles.statRow}>
            <Mono weight="semibold" size={typeScale.display} color={colors.paper}>
              {items.length}
            </Mono>
            <Text style={styles.unit}>{items.length === 1 ? 'shot' : 'shots'}</Text>
          </View>
          {data?.since && <Text style={styles.sinceLine}>Since {monthLabel(data.since)}</Text>}
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
              <View style={styles.sectionHead}>
                <Mono size={typeScale.caption} color={colors.paper60}>
                  {section.label.toUpperCase()}
                </Mono>
                <Mono size={typeScale.caption} color={colors.paper40}>
                  {section.items.length}
                </Mono>
              </View>
              <View style={styles.grid}>
                {section.items.map((it) => {
                  const starred = optimisticStars[starKey(it)] ?? it.starred;
                  return (
                    <Pressable
                      key={`${it.type}:${it.id}`}
                      accessibilityRole="button"
                      style={styles.cell}
                      onPress={() => setSelected({ ...it, starred })}
                    >
                      {/* Only the meaningful mark: crown = PotD. The daily/practice
                          split lives in the filter + detail sheet, not a per-tile
                          badge (the bracket glyph read as a fullscreen icon). */}
                      <PhotoTile uri={it.uri} badge={it.isPotd ? 'crown' : undefined} />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={starred ? 'Unstar shot' : 'Star shot'}
                        hitSlop={10}
                        style={styles.starToggle}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          void onToggleStar(it);
                        }}
                      >
                        {/* Dark halo behind the glyph → legible on bright photos
                            without a chip; the star floats instead of a button. */}
                        <Star
                          size={18}
                          strokeWidth={3.5}
                          color="rgba(20, 18, 16, 0.55)"
                          fill={starred ? 'rgba(20, 18, 16, 0.55)' : 'transparent'}
                          style={styles.starHalo}
                        />
                        <Star
                          size={16}
                          strokeWidth={icons.strokeWidth}
                          color={starred ? colors.safelight : colors.paper}
                          fill={starred ? colors.safelight : 'transparent'}
                        />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Sheet visible={selected !== null} onClose={() => setSelected(null)} title={undefined}>
        {selected && (
          <>
            <View style={styles.sheetHead}>
              {selected.uri ? (
                <Image source={{ uri: selected.uri }} style={styles.sheetThumb} contentFit="cover" />
              ) : (
                <View style={[styles.sheetThumb, styles.skelTile]} />
              )}
              <View style={styles.sheetInfo}>
                <Mono size={typeScale.sub} color={colors.paper}>
                  {capturedStamp(selected.capturedAt)}
                </Mono>
                <Text style={styles.sheetMeta}>{metaLine(selected)}</Text>
                {selected.starred && (
                  <View style={styles.starLine}>
                    <Star size={12} strokeWidth={icons.strokeWidth} color={colors.safelight} fill={colors.safelight} />
                    <Text style={styles.starText}>Starred · full resolution</Text>
                  </View>
                )}
              </View>
            </View>

            {!selected.starred && (
              <Text style={styles.antiRansom}>
                Starred shots keep full resolution. {starsLeft} of {data?.starsCap ?? 5} stars left this month.
              </Text>
            )}
            <Button
              label={selected.starred ? 'Starred' : 'Star this shot'}
              variant={selected.starred ? 'ghost' : 'primary'}
              fullWidth
              loading={busy}
              onPress={() => void onToggleStar(selected)}
            />
            {selected.type === 'free' ? (
              <Pressable
                accessibilityRole="button"
                style={styles.deleteRow}
                disabled={busy}
                onPress={() => void onDelete(selected)}
              >
                <Trash2 size={16} strokeWidth={icons.strokeWidth} color={colors.paper60} />
                <Text style={styles.deleteLabel}>Delete shot</Text>
              </Pressable>
            ) : (
              <Text style={styles.recordNote}>Daily Shots stay in your record and can’t be deleted.</Text>
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
  header: { gap: 2 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  unit: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper60 },
  sinceLine: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  chips: { flexDirection: 'row', gap: 8 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48.8%' },
  skelNum: { width: 56, height: typeScale.display, borderRadius: 4, backgroundColor: colors.ink2 },
  skelChip: { width: 64, height: 34, borderRadius: radius.pill, backgroundColor: colors.ink2 },
  skelChipWide: { width: 104, height: 34, borderRadius: radius.pill, backgroundColor: colors.ink2 },
  skelTile: { width: '100%', aspectRatio: photo.aspect, backgroundColor: colors.ink2 },
  starToggle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starHalo: { position: 'absolute', top: 5, left: 5 },
  emptyFilter: { paddingVertical: GUTTER * 2, alignItems: 'center' },
  emptyFilterLine: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, textAlign: 'center' },
  sheetHead: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  sheetThumb: { width: 64, aspectRatio: photo.aspect, backgroundColor: colors.ink2 },
  sheetInfo: { flex: 1, gap: 4 },
  sheetMeta: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  starLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  starText: { fontFamily: fonts.sansMedium, fontSize: typeScale.caption, color: colors.safelight },
  antiRansom: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6 },
  deleteLabel: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper60 },
  recordNote: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
    textAlign: 'center',
    paddingVertical: 6,
  },
});
