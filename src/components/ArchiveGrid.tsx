/**
 * Archive — the private journal (spec §11c), embedded as a Profile segment
 * (relocated from its own tab per the 2026-07 nav decision: Studios took the
 * tab, Archive is solo/private and doesn't need top-level real estate).
 * Filter chips (All · Daily · Free · Starred), month-grouped grid newest-first.
 * Tap a shot → fullscreen viewer with star (5/mo, anti-ransom messaging lives
 * here) and delete. Never empty as absence: the zero state is an invitation.
 */
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { BookImage, CloudOff, Star, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
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
import { Skeleton } from '@/components/molecules/Skeleton';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, frame, icons, motion, overlay, photo, radius, space, typeScale } from '@/components/tokens';

type Filter = 'all' | 'daily' | 'practice' | 'starred';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STAGE_MAX_H = SCREEN_H * 0.66;
const GUTTER = space.gutter;

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const capturedStamp = (iso: string) =>
  new Date(iso)
    .toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .toUpperCase();

const metaLine = (it: ArchiveItem) => {
  const kind = it.type === 'daily' ? 'Daily Shot' : 'Free shot';
  const placement = it.isPotd ? 'Photo of the Day' : it.inGallery ? 'In gallery' : null;
  return placement ? `${kind} · ${placement}` : kind;
};

/** Drop-in section: no SafeAreaView/ScrollView of its own — the parent (Profile) owns those. */
export function ArchiveGrid() {
  const router = useRouter();
  const { data, loading, error, refresh } = useArchive();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<ArchiveItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const cellWidth = gridWidth > 0 ? Math.floor((gridWidth - space.gridGap) / 2) : undefined;
  const cellStyle = [styles.cell, cellWidth ? { width: cellWidth } : null];
  const [optimisticStars, setOptimisticStars] = useState<Record<string, boolean>>({});
  const [optimisticDeleted, setOptimisticDeleted] = useState<Record<string, boolean>>({});
  const starKey = (it: ArchiveItem) => `${it.type}:${it.id}`;
  const isStarred = (it: ArchiveItem) => optimisticStars[starKey(it)] ?? it.starred;

  const starScale = useSharedValue(1);
  const starAnim = useAnimatedStyle(() => ({ transform: [{ scale: starScale.value }] }));

  const items = (data?.items ?? []).filter((it) => !optimisticDeleted[starKey(it)]);
  const catalog = useFrameCatalog();

  useEffect(() => {
    const blank = items.filter((it) => !it.queued && !it.uri);
    console.log(
      `[ArchiveGrid] data changed: loading=${loading} error=${error} items=${items.length} blank_uri=${blank.length} starred=${items.filter((it) => it.starred).length}`,
    );
    if (blank.length > 0) {
      console.warn(
        '[ArchiveGrid] items rendering blank (no uri):',
        blank.map((it) => ({ type: it.type, id: it.id, thumbPath: it.thumbPath })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading, error]);

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

  const sections = useMemo(() => {
    const map = new Map<string, ArchiveItem[]>();
    for (const it of filtered) {
      const k = monthKey(it.capturedAt);
      (map.get(k) ?? map.set(k, []).get(k)!).push(it);
    }
    return Array.from(map.entries()).map(([k, its]) => ({ key: k, label: monthLabel(its[0].capturedAt), items: its }));
  }, [filtered]);

  const starsLeft = data ? Math.max(data.starsCap - data.starsUsed, 0) : 0;

  const onToggleStar = useCallback(async (item: ArchiveItem, announce = false) => {
    const t0 = Date.now();
    const key = starKey(item);
    const next = !(optimisticStars[key] ?? item.starred);
    console.log(`[ArchiveGrid] onToggleStar: tap type=${item.type} id=${item.id} -> next=${next}`);
    setOptimisticStars((m) => ({ ...m, [key]: next }));
    setBusy(true);
    const res = await toggleStar(item);
    setBusy(false);
    console.log(`[ArchiveGrid] onToggleStar: toggleStar() resolved in ${Date.now() - t0}ms ok=${res.ok}`);
    if (!res.ok) {
      console.warn(`[ArchiveGrid] onToggleStar: failed — reason=${res.reason}`);
      setOptimisticStars((m) => {
        const copy = { ...m };
        delete copy[key];
        return copy;
      });
      if (res.reason === 'cap') setToast(`That's all ${res.cap ?? data?.starsCap} stars this month`);
      else setToast((await isOffline()) ? 'You\'re offline' : 'Could not update the star');
      return;
    }
    if (announce && next) setToast('Starred · kept at full resolution');
    setSelected((s) => (s ? { ...s, starred: res.starred ?? s.starred } : s));
    // toggleStar() already patched the cached archive entry with this row's new
    // starred state, so the real data is in sync now — no refetch needed.
    setOptimisticStars((m) => {
      const copy = { ...m };
      delete copy[key];
      return copy;
    });
  }, [optimisticStars, data?.starsCap]);

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
    setOptimisticDeleted((m) => ({ ...m, [key]: true }));
    setSelected(null);
    void (async () => {
      const ok = await deleteFreeShot(item);
      if (ok) {
        await refresh();
        dropDeleted(key);
      } else {
        dropDeleted(key);
        setToast((await isOffline()) ? 'You\'re offline' : 'Could not delete the shot');
      }
    })();
  }, [refresh]);

  if (error && !data) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon={CloudOff}
          line="Couldn't load your archive. Check your connection."
          ctaLabel="Retry"
          onCta={() => void refresh()}
        />
      </View>
    );
  }

  if (loading && !data) {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.chips}>
          <Skeleton width={64} height={34} borderRadius={radius.pill} />
          <Skeleton width={64} height={34} borderRadius={radius.pill} />
          <Skeleton width={104} height={34} borderRadius={radius.pill} />
          <Skeleton width={64} height={34} borderRadius={radius.pill} />
        </View>
        <View style={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.cell}>
              <View style={styles.skelTile} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon={BookImage}
          line="Your journal starts with one shot"
          ctaLabel="Take a free shot"
          onCta={() => router.push('/camera?practice=1')}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
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
                  cachePolicy="memory-disk"
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.gutter },
  center: { paddingVertical: space.gutter },
  header: { gap: 2 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  unit: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper60 },
  sinceLine: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {},
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
  viewer: { flex: 1, backgroundColor: overlay.scrimHeavy, justifyContent: 'center', alignItems: 'center' },
  viewerStage: { alignItems: 'center', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 0, left: 0, paddingTop: 8, paddingLeft: 16 },
  viewerBarSafe: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  viewerBar: { padding: GUTTER, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  viewerMeta: { flex: 1, gap: 4 },
  viewerQuota: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  viewerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  viewerAction: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.ink2, alignItems: 'center', justifyContent: 'center' },
});
