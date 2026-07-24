/**
 * Archive — the private journal (spec §11c). Filter chips (All · Daily · Practice · Starred),
 * month-grouped grid newest-first, entries badged (bracket-mini / crown / star).
 * Tap a shot → action sheet: star (5/mo, anti-ransom messaging lives here) and
 * delete. Never empty as absence: the zero state is an invitation to shoot.
 */
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { BookImage, CloudOff, Star, Trash2, X } from 'lucide-react-native';
import { useEffect, useCallback, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteFreeShot, toggleStar, type ArchiveItem } from '@lib/services/archive';
import { useArchive } from '@lib/hooks/archive';
import { frameForDate } from '@lib/services/frames';
import { useFrameCatalog } from '@lib/hooks/frames';
import { isOffline } from '@lib/utils/net';
import { imageCacheKey, signThumbs } from '@lib/cache';
import { useSignedThumb } from '@lib/hooks/useCache';
import { Chip } from '@/components/atoms/Chip';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { PhotoTile } from '@/components/molecules/PhotoTile';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, frame, icons, motion, photo, radius, space, typeScale } from '@/components/tokens';

type Filter = 'all' | 'daily' | 'practice' | 'starred';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Cap the fullscreen photo's height so the action bar always clears it, then let
// width follow from the print/photo aspect. Whichever the screen width limits wins.
const STAGE_MAX_H = SCREEN_H * 0.66;

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
  const kind = it.type === 'daily' ? 'Daily Shot' : 'Free shot';
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
  const [gridWidth, setGridWidth] = useState(0);
  const cellWidth = gridWidth > 0 ? Math.floor((gridWidth - space.gridGap) / 2) : undefined;
  const cellStyle = [styles.cell, cellWidth ? { width: cellWidth } : null];
  // Optimistic star state per item, so the tile fills instantly instead of
  // waiting on the server round-trip + refresh. Cleared once real data lands.
  const [optimisticStars, setOptimisticStars] = useState<Record<string, boolean>>({});
  // Optimistically-removed shots — hidden the instant delete is tapped, so the
  // grid never shows a "deleting" wait. Cleared once real data catches up (or on
  // a failed delete, when the shot comes back).
  const [optimisticDeleted, setOptimisticDeleted] = useState<Record<string, boolean>>({});
  const starKey = (it: ArchiveItem) => `${it.type}:${it.id}`;
  const isStarred = (it: ArchiveItem) => optimisticStars[starKey(it)] ?? it.starred;

  // Fullscreen star: springs the glyph on the same frame the tap lands, so the
  // fill reads as a state change, not a layout event. Never resizes anything.
  const starScale = useSharedValue(1);
  const starAnim = useAnimatedStyle(() => ({ transform: [{ scale: starScale.value }] }));

  const items = (data?.items ?? []).filter((it) => !optimisticDeleted[starKey(it)]);
  // Each daily print wears the frame of the day it was shot (event day → event frame),
  // derived from its drop_date against the catalog — never the viewer's profile frame.
  const catalog = useFrameCatalog();

  // Warm the starred shots' full-res in the background so favorites open instantly
  // sharp. Unstarred shots also open at full-res (see viewerFull below) — they just
  // fetch on demand, showing their cached thumb for the beat before it sharpens.
  useEffect(() => {
    const paths = (data?.items ?? [])
      .filter((it) => it.starred)
      .map((it) => it.imagePath)
      .filter((x): x is string => !!x);
    if (paths.length === 0) return;
    let alive = true;
    void signThumbs(paths).then((m) => {
      if (alive) void Image.prefetch([...m.values()]);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [data?.items]);

  // Full-res for the open shot, starred or not — this is a photos app, so an
  // opened shot must be sharp, never an upscaled 300px thumb. Full-res is uploaded
  // for every shot and nothing purges it today (retention is Phase 4); if a purge
  // ever lands, a missing full-res simply falls back to the thumb placeholder
  // below. The thumb stays the placeholder, so the print shows instantly with no blink.
  const viewerFull = useSignedThumb(selected?.imagePath ?? null);

  const filtered = items.filter((it) =>
    filter === 'all'
      ? true
      : filter === 'daily'
        ? it.type === 'daily'
        : filter === 'practice'
          ? it.type === 'free'
          : it.starred,
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

  // `announce`: confirm the full-resolution guarantee via a toast on a successful
  // star. It's the fullscreen viewer's replacement for the old inline note — a
  // transient channel that can't shift layout. Off for the grid tile.
  const onToggleStar = useCallback(async (item: ArchiveItem, announce = false) => {
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
      // Offline isn't an error — it's a state. A real failure (the star cap) still
      // gets a plain toast; no signal just says you're offline.
      if (res.reason === 'cap') setToast(`That's all ${res.cap ?? data?.starsCap} stars this month`);
      else setToast((await isOffline()) ? 'You\'re offline' : 'Could not update the star');
      return;
    }
    if (announce && next) setToast('Starred · kept at full resolution');
    setSelected((s) => (s ? { ...s, starred: res.starred ?? s.starred } : s));
    await refresh();
    // Real data now reflects the star; drop the optimistic override.
    setOptimisticStars((m) => {
      const copy = { ...m };
      delete copy[key];
      return copy;
    });
  }, [optimisticStars, data?.starsCap, refresh]);

  // Fullscreen star tap: spring + haptic (matching HeartButton) on the frame the
  // tap lands, then the shared optimistic toggle. `announce` fires the full-res toast.
  const onViewerStar = () => {
    if (!selected || busy) return;
    if (!isStarred(selected)) {
      starScale.value = withSequence(
        withSpring(motion.heartSpring, { damping: 12, stiffness: 400 }),
        withTiming(1, { duration: 120 }),
      );
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    void onToggleStar(selected, true);
  };

  const dropDeleted = (key: string) =>
    setOptimisticDeleted((m) => {
      const copy = { ...m };
      delete copy[key];
      return copy;
    });

  const onDelete = useCallback((item: ArchiveItem) => {
    const key = starKey(item);
    // Optimistic: the shot disappears and the viewer closes now; the actual
    // storage + row delete runs in the background. The vanish IS the confirmation
    // (no success toast). Only a failure surfaces — the shot returns with a reason.
    setOptimisticDeleted((m) => ({ ...m, [key]: true }));
    setSelected(null);
    void (async () => {
      const ok = await deleteFreeShot(item);
      if (ok) {
        await refresh(); // real data now excludes it; drop the override
        dropDeleted(key);
      } else {
        dropDeleted(key); // bring it back
        setToast((await isOffline()) ? 'You\'re offline' : 'Could not delete the shot');
      }
    })();
  }, [refresh]);

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
            ctaLabel="Take a free shot"
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
          <Chip label="Daily" selected={filter === 'daily'} onPress={() => setFilter('daily')} />
          <Chip label="Free" selected={filter === 'practice'} onPress={() => setFilter('practice')} />
          <Chip label="Starred" selected={filter === 'starred'} onPress={() => setFilter('starred')} />
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyFilter}>
            <Text style={styles.emptyFilterLine}>
              {filter === 'starred'
                ? 'No starred shots yet. Star one to keep it full resolution.'
                : filter === 'practice'
                  ? 'No free shots yet. Shoot anything, anytime.'
                  : filter === 'daily'
                    ? 'No daily shots yet. Your daily photos land here.'
                    : 'Nothing here yet.'}
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
              <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0 && w !== gridWidth) setGridWidth(w);
              }}>
                {section.items.map((it) => {
                  // A syncing capture: show it now (local image) with the queued mark,
                  // but no tap target and no star — there's no server row to act on yet.
                  if (it.queued) {
                    return (
                      <View key={`${it.type}:${it.id}`} style={cellStyle}>
                        <PhotoTile uri={it.uri} badge="queued" aspectRatio={frame.aspect} />
                      </View>
                    );
                  }
                  const starred = optimisticStars[starKey(it)] ?? it.starred;
                  return (
                    <Pressable
                      key={`${it.type}:${it.id}`}
                      accessibilityRole="button"
                      style={cellStyle}
                      onPress={() => setSelected({ ...it, starred })}
                    >
                      {/* Daily shots render as the framed print — the rail already
                          carries the day counter and any crown/top-10 status, so no
                          badge. Practice shots have no drop (no day, no status), so
                          they stay a plain tile in the same print-sized footprint. */}
                      {it.type === 'daily' ? (
                        <FramedPhoto
                          photoUri={it.uri}
                          dayNumber={it.dayNumber ?? 1}
                          frameId={frameForDate(catalog, it.dropDate)}
                          status={it.status}
                        />
                      ) : (
                        <PhotoTile uri={it.uri} aspectRatio={frame.aspect} />
                      )}
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

      {/* Tap a shot → fullscreen viewer, in place (no route push). Daily shots show
          the framed print; practice shots the bare photo. The photo is sized to fit
          above the action bar; tapping the backdrop dismisses. */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
        statusBarTranslucent
      >
        {selected && (
          <Pressable style={styles.viewer} onPress={() => setSelected(null)} accessibilityLabel="Close photo">
            <View style={styles.viewerStage} pointerEvents="none">
              {selected.type === 'daily' ? (
                <FramedPhoto
                  // Full-res for a starred shot (viewerFull); the thumb holds the frame
                  // as placeholder so it shows instantly and sharpens with no blink.
                  photoUri={viewerFull}
                  placeholderUri={selected.uri}
                  dayNumber={selected.dayNumber ?? 1}
                  frameId={frameForDate(catalog, selected.dropDate)}
                  status={selected.status}
                  width={Math.min(SCREEN_W - GUTTER * 2, STAGE_MAX_H * frame.aspect)}
                />
              ) : selected.uri || viewerFull ? (
                <Image
                  source={{
                    uri: viewerFull || selected.uri!,
                    cacheKey: imageCacheKey(viewerFull || selected.uri!),
                  }}
                  placeholder={selected.uri ? { uri: selected.uri, cacheKey: imageCacheKey(selected.uri) } : undefined}
                  placeholderContentFit="contain"
                  style={{ width: Math.min(SCREEN_W - GUTTER * 2, STAGE_MAX_H * photo.aspect), aspectRatio: photo.aspect }}
                  contentFit="contain"
                  transition={100}
                />
              ) : (
                <View style={[styles.skelTile, { width: Math.min(SCREEN_W - GUTTER * 2, STAGE_MAX_H * photo.aspect) }]} />
              )}
            </View>

            <SafeAreaView edges={['top']} style={styles.viewerClose} pointerEvents="box-none">
              <IconButton icon={X} variant="chrome" accessibilityLabel="Close" onPress={() => setSelected(null)} />
            </SafeAreaView>

            <SafeAreaView edges={['bottom']} style={styles.viewerBarSafe} pointerEvents="box-none">
              <View style={styles.viewerBar}>
                {/* Meta is height-stable: three constant lines. The quota reads the
                    same in both star states (only the digit changes), so nothing
                    reflows on toggle. */}
                <View style={styles.viewerMeta}>
                  <Mono size={typeScale.sub} color={colors.paper}>
                    {capturedStamp(selected.capturedAt)}
                  </Mono>
                  <Text style={styles.sheetMeta} numberOfLines={1}>
                    {metaLine(selected)}
                  </Text>
                  <Text style={styles.viewerQuota} numberOfLines={1}>
                    {starsLeft} of {data?.starsCap ?? 5} stars left this month
                  </Text>
                </View>

                {/* Fixed icon buttons. Star is pinned to the right edge; delete
                    inserts to its left for practice shots, so the star never moves
                    between daily and practice. */}
                <View style={styles.viewerActions}>
                  {selected.type === 'free' && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete shot"
                      style={styles.viewerAction}
                      onPress={() => onDelete(selected)}
                    >
                      <Trash2 size={20} strokeWidth={icons.strokeWidth} color={colors.paper60} />
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isStarred(selected) ? 'Unstar shot' : 'Star shot'}
                    accessibilityState={{ selected: isStarred(selected), disabled: busy }}
                    disabled={busy}
                    style={styles.viewerAction}
                    onPress={onViewerStar}
                  >
                    <Animated.View style={starAnim}>
                      <Star
                        size={20}
                        strokeWidth={icons.strokeWidth}
                        color={isStarred(selected) ? colors.safelight : colors.paper}
                        fill={isStarred(selected) ? colors.safelight : 'transparent'}
                      />
                    </Animated.View>
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>
          </Pressable>
        )}
      </Modal>

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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {},
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
  sheetMeta: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  // Fullscreen viewer: near-opaque backdrop so the print reads as a single object.
  viewer: { flex: 1, backgroundColor: 'rgba(12,11,10,0.97)', justifyContent: 'center', alignItems: 'center' },
  viewerStage: { alignItems: 'center', justifyContent: 'center' },
  // Close sits top-left in a chrome chip — the app's one close convention (camera,
  // photo detail, curate all match): safe-area inset + 8 down, 16 in.
  viewerClose: { position: 'absolute', top: 0, left: 0, paddingTop: 8, paddingLeft: 16 },
  viewerBarSafe: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Center-aligned so the meta column and the icon cluster are vertically
  // independent — neither can push the other when the star toggles.
  viewerBar: { padding: GUTTER, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  viewerMeta: { flex: 1, gap: 4 },
  viewerQuota: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  viewerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Fixed 44x44 tap target, icon-only: no label means no width change on toggle.
  viewerAction: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.ink2, alignItems: 'center', justifyContent: 'center' },
});
