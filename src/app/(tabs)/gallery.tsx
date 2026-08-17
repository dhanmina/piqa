/**
 * Gallery — the ONLY sub-tabs in the app: World · Following (spec §11c).
 * World reads a materialized JSON blob (never a live query for the day's
 * photos): date + prompt → PotD full-width cover (gold brackets, crown, gold
 * eyebrow, shooter) → unnumbered 2-col grid → end card (past back-drops ·
 * what's live · tomorrow teaser). First open plays the morning reveal once; if
 * my shot made it, my tile enters last in gold brackets. Past galleries are
 * immutable and re-open identically. Following is a pull surface — invitation
 * until Profile/Follow lands in Phase 4.
 */
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { Calendar, CloudOff, Image as ImageIcon, Search, Users } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import confettiSource from '@/assets/lottie/confetti.json';

import {
  isRevealSeen,
  markRevealSeen,
  type GalleryDetailPhoto,
} from '@lib/services/gallery';
import {
  useFollowingGallery,
  useGallery,
  useGalleryHearts,
} from '@lib/hooks/useGallery';

import { signThumbs } from '@lib/cache';
import { warmImage } from '@lib/utils/warmImage';
import { useSession } from '@lib/session';
import { capture } from '@lib/services/analytics';
import { PhotoDetailView } from '@/components/PhotoDetailView';
import { Button } from '@/components/atoms/Button';
import { Countdown } from '@/components/atoms/Countdown';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { EmptyState } from '@/components/molecules/EmptyState';
import { GalleryGrid, GalleryGridSkeleton, type GalleryPhoto } from '@/components/molecules/GalleryGrid';
import { PastDropsCalendar } from '@/components/molecules/PastDropsCalendar';
import { Sheet } from '@/components/molecules/Sheet';
import { colors, fonts, icons, radius, space, typeScale } from '@/components/tokens';

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const categoryBadgeText = (category: string) => (category === 'open' ? 'OPEN FRAME' : category.toUpperCase());

export default function GalleryScreen() {
  const router = useRouter();
  const { session } = useSession();
  const myId = session?.user.id;
  const insets = useSafeAreaInsets();

  // Tab bar overlays the bottom: paddingTop(8) + minHeight(56) + safe-area inset.
  // paddingBottom of that amount shifts the vertical center up by half, keeping
  // EmptyState visually centered in the visible area.
  const centerPad = { paddingBottom: 8 + 56 + insets.bottom } as const;

  const [tab, setTab] = useState<'world' | 'following'>('world');
  const [selectedDropId, setSelectedDropId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewer, setViewer] = useState<GalleryDetailPhoto | null>(null);
  // Latch: once World has shown past galleries, keep the calendar icon through
  // later loads so it doesn't blink out while `data` is briefly null (refresh,
  // switching issues). A cold first load correctly still has no icon.
  const [everHadPast, setEverHadPast] = useState(false);

  const { data, loading, error, refresh } = useGallery(selectedDropId);
  const {
    photos: followingPhotos,
    loading: followingLoading,
    error: followingError,
    refresh: refreshFollowing,
  } = useFollowingGallery();

  // Direct hearting for the active tab's photos (grid + PotD).
  const activePhotos = tab === 'following' ? followingPhotos : data?.photos ?? [];
  const gHearts = useGalleryHearts(activePhotos);

  // Phase 0A: measure Gallery opens (both sub-tabs) for the retention funnel.
  useFocusEffect(
    useCallback(() => {
      capture('gallery_opened', { tab });
    }, [tab]),
  );

  // Warm full-res in the background while the grid is browsed, so opening a shot
  // is instant AND sharp — no thumb→full-res swap (that's what blinked). It MUST
  // warm the cache under the same cacheKey FramedPhoto reads (the signed URL with
  // the query stripped, so the disk cache survives token rotation). Image.prefetch
  // can't set a cacheKey (expo-image v57), so it warms the rotating full URL — a
  // key the render never looks up, leaving full-res cold on first open. loadAsync
  // takes an ImageSource, so it can seed the exact key. Signing is cached per path;
  // loadAsync dedupes on an already-cached key, so re-runs are cheap.
  useEffect(() => {
    const photos = tab === 'following' ? followingPhotos : data?.photos ?? [];
    const paths = photos.map((p) => p.imagePath).filter((x): x is string => !!x);
    if (paths.length === 0) return;
    let alive = true;
    void signThumbs(paths).then((m) => {
      if (!alive) return;
      for (const url of m.values()) warmImage(url);
    });
    return () => {
      alive = false;
    };
  }, [tab, data?.photos, followingPhotos]);

  const onRefresh = async () => {
    setRefreshing(true);
    await (tab === 'following' ? refreshFollowing() : refresh());
    setRefreshing(false);
  };

  // Reveal decision must be settled BEFORE the grid mounts (entering animations
  // only fire on mount). Gate the grid on `ready`.
  const [reveal, setReveal] = useState(false);
  const [ready, setReady] = useState(false);
  const [celebrate, setCelebrate] = useState(false); // your shot placed → win moment

  // Settle the reveal ONCE PER DROP, not per data object. Keying on `data` re-ran
  // this on every background refetch (60s TTL), and `setReady(false)` flashed the
  // skeleton on every tab switch. The reveal is a property of the drop, so keying
  // on its id means a refetch of the same day's gallery keeps `ready` true.
  const dropId = data?.drop?.id ?? null;
  const isSeed = data?.isSeed ?? false;
  useEffect(() => {
    let alive = true;
    setReady(false);
    if (!dropId) {
      if (data) setReady(true);
      return;
    }
    // Only the latest, real (non-seed) gallery gets the one-time reveal.
    if (selectedDropId !== null || isSeed) {
      setReveal(false);
      setReady(true);
      return;
    }
    void isRevealSeen(dropId).then((seen) => {
      if (!alive) return;
      setReveal(!seen);
      if (!seen) {
        void markRevealSeen(dropId);
        capture('reveal_seen');
        // Win moment (spec §11d moment 2): if my shot placed, a success haptic
        // + a text celebration. Real Lottie confetti is a post-beta upgrade
        // (needs lottie-react-native); the spec sanctions the text version for beta.
        const placed = (data?.photos ?? []).some((p) => p.userId === myId);
        if (placed) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setCelebrate(true);
        }
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
    // data/myId are read inside, but we only re-decide when the DROP changes — a
    // refetch of the same gallery must not reset `ready`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropId, isSeed, selectedDropId]);

  useEffect(() => {
    if ((data?.past?.length ?? 0) > 0) setEverHadPast(true);
  }, [data?.past]);

  // Open the shot in-place (fullscreen modal on this tab) rather than routing to
  // /photo/[id] — the gallery zooms into the print, like the archive viewer.
  const [viewerIndex, setViewerIndex] = useState(0);
  const openPhoto = (p: GalleryPhoto) => {
    const full = (data?.photos.find((x) => x.id === p.id) ??
      followingPhotos.find((x) => x.id === p.id)) as GalleryDetailPhoto | undefined;
    setViewer(full ?? { ...p });
    const idx = activePhotos.findIndex((x) => x.id === p.id);
    setViewerIndex(idx >= 0 ? idx : 0);
  };

  // Page in the gallery's own visual order — PotD cover first, then the grid
  // top-to-bottom — and just open ON the tapped shot (initialIndex below). NOT
  // rotated: rotating put the ones before the tapped shot (the PotD included)
  // right after it, so tapping any Top 10 made the PotD read as "next". The
  // viewer's getItemLayout + onScrollToIndexFailed make initialScrollIndex
  // reliable, so no rotation is needed to land on the tapped shot.
  const orderedPhotos = activePhotos;

  // Map ordered photos to PhotoDetailData for the viewer's paging list.
  const viewerPhotos = useMemo(() => orderedPhotos.map((p) => ({
    id: p.id,
    path: (p as GalleryDetailPhoto).imagePath ?? (p as GalleryDetailPhoto).thumbPath ?? null,
    shooter: p.shooter,
    hearts: p.hearts,
    userId: p.userId,
    day: p.dayNumber,
    status: p.status,
    frame: p.frameId,
    nods: (p as GalleryDetailPhoto).nods ?? null,
    placeholderUri: p.uri,
    category: tab === 'world' ? data?.drop?.category : undefined,
    contentLabel: (p as GalleryDetailPhoto).contentLabel ?? null,
  })), [orderedPhotos, tab, data?.drop?.category]);

  // In-place fullscreen viewer — press a shot and the gallery zooms into the
  // print (no route), the same feel as the archive. Shared by both tabs, so it
  // must live outside the World-only return block. onOpenProfile closes this
  // modal first, since it sits above the navigator.
  const viewerModal = (
    <Modal
      visible={viewer !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setViewer(null)}
      statusBarTranslucent
    >
      {viewer && (
        <PhotoDetailView
          lightbox
          id={viewer.id}
          path={viewer.imagePath ?? viewer.thumbPath ?? ''}
          placeholderUri={viewer.uri}
          shooter={viewer.shooter}
          hearts={viewer.hearts}
          userId={viewer.userId}
          day={viewer.dayNumber}
          status={viewer.status}
          frame={viewer.frameId}
          // World shows one drop's photos, so its prompt is this photo's theme.
          // Following mixes days/themes, so leave it unset there.
          theme={tab === 'world' ? data?.drop?.prompt : undefined}
          // Tailor the nod picker to this Subject's category (World only — Following
          // mixes categories, so it falls back to the universal set).
          category={tab === 'world' ? data?.drop?.category : undefined}
          nods={viewer.nods}
          contentLabel={viewer.contentLabel}

          // Drive the heart off the SAME controller as the grid tile, so the
          // fullscreen and the grid always show one count and toggle together.
          heartCount={gHearts.count(viewer)}
          hearted={gHearts.isLiked(viewer.id)}
          onToggleHeart={() => void gHearts.toggle(viewer.id)}
          onClose={() => setViewer(null)}
          onOpenProfile={(uid) => {
            setViewer(null);
            router.push({ pathname: '/u/[id]', params: { id: uid } });
          }}
          // Paging follows the gallery's visual order; open ON the tapped shot and
          // page forward from there. onPageChange keeps the heart controller bound
          // to the visible photo.
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          onPageChange={(idx) => {
            const p = orderedPhotos[idx];
            if (p) setViewer(p as GalleryDetailPhoto);
          }}
        />
      )}
    </Modal>
  );

  const handleTabChange = (t: 'world' | 'following') => {
    if (t !== tab) {
      void Haptics.selectionAsync();
      setTab(t);
    }
  };

  const handleSelectDrop = (dropId: string | null) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDropId(dropId);
  };

  const hasPast = tab === 'world' && ((data?.past?.length ?? 0) > 0 || everHadPast);
  const viewingPast = selectedDropId !== null;
  const viewingDropDate = data?.drop?.drop_date;
  const viewingBanner = viewingPast && viewingDropDate ? (
    <View style={styles.viewingPill}>
      <View style={styles.viewingDot} />
      <Mono size={typeScale.caption} color={colors.paper60} weight="medium">
        VIEWING {longDate(viewingDropDate).toUpperCase()}
      </Mono>
      <Pressable
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => handleSelectDrop(null)}
      >
        <Mono size={typeScale.caption} color={colors.safelight}>
          TODAY
        </Mono>
      </Pressable>
    </View>
  ) : null;
  const segmented = (
    <View style={styles.topBar}>
      <View style={styles.segments}>
        {(['world', 'following'] as const).map((t) => (
          <Pressable key={t} accessibilityRole="button" style={styles.segment} onPress={() => handleTabChange(t)}>
            <Text style={[styles.segmentLabel, tab === t ? styles.segmentActive : styles.segmentInactive]}>
              {t === 'world' ? 'World' : 'Following'}
            </Text>
            <View style={[styles.segmentBar, tab === t && styles.segmentBarActive]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.headerIcons}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search users"
          hitSlop={10}
          style={styles.iconBtn}
          onPress={() => router.push('/search')}
        >
          <Search size={20} strokeWidth={icons.strokeWidth} color={colors.paper60} />
        </Pressable>
        {hasPast && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Past galleries"
            hitSlop={10}
            style={styles.iconBtn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPast(true);
            }}
          >
            <Calendar size={20} strokeWidth={icons.strokeWidth} color={colors.paper60} />
          </Pressable>
        )}
      </View>
    </View>
  );

  if (tab === 'following') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {segmented}
        {viewingBanner}
        {followingError && followingPhotos.length === 0 ? (
          <View style={[styles.center, centerPad]}>
            <EmptyState
              icon={CloudOff}
              line="Having trouble connecting. Give it another go."
              ctaLabel="Retry"
              onCta={() => void refreshFollowing()}
            />
          </View>
        ) : followingLoading ? (
          <View style={styles.content}>
            <GalleryGridSkeleton />
          </View>
        ) : followingPhotos.length === 0 ? (
          <View style={[styles.center, centerPad]}>
            <EmptyState
              icon={Users}
              line="Follow some photographers and their galleries will show up here"
              ctaLabel="Explore World"
              onCta={() => setTab('world')}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.paper60} />
            }
          >
            <GalleryGrid
              photos={followingPhotos}
              flat
              onPress={openPhoto}
              onHeart={(p) => void gHearts.toggle(p.id)}
              isHearted={gHearts.isLiked}
              heartCount={gHearts.count}
    
            />
          </ScrollView>
        )}
        {viewerModal}
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {segmented}
        <View style={[styles.center, centerPad]}>
          <EmptyState
            icon={CloudOff}
            line="Having trouble connecting. Give it another go."
            ctaLabel="Retry"
            onCta={() => void refresh()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (loading || !ready) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {segmented}
        {viewingBanner}
        <View style={styles.content}>
          <GalleryGridSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  if (!data?.drop || data.photos.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={{ flex: 1 }}>
          {segmented}
          {viewingBanner}
          <View style={[styles.center, centerPad]}>
            <EmptyState icon={ImageIcon} line="The gallery is just getting started." />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const hasPotd = data.photos.some((p) => p.isPotd);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {segmented}
      {viewingBanner}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.paper60} />
        }
      >
        {celebrate && reveal && (
          <View style={styles.winnerPass}>
            <Mono size={typeScale.caption} color={colors.crown} weight="medium" style={styles.winnerPassEyebrow}>
              GALLERY EXHIBITOR
            </Mono>
            <Text style={styles.winnerPassTitle}>Your shot made the gallery</Text>
            <Mono size={typeScale.caption} color={colors.paper60}>
              Scroll down to find your framed print
            </Mono>
          </View>
        )}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Mono size={typeScale.caption} color={colors.crown} weight="medium" style={styles.kicker}>
              DROP {data.photos[0]?.dayNumber ?? 1}
            </Mono>
            <Mono size={typeScale.caption} color={colors.paper40} style={styles.kickerDate}>
              {longDate(data.drop.drop_date).toUpperCase()}
            </Mono>
          </View>
          {data.drop.prompt && (
            <Text style={styles.prompt} numberOfLines={3}>
              {data.drop.prompt}
            </Text>
          )}
          <View style={styles.badgeRow}>
            {data.drop.category && (
              <View style={styles.categoryBadge}>
                <Mono size={typeScale.caption} color={colors.safelight}>
                  {categoryBadgeText(data.drop.category)}
                </Mono>
              </View>
            )}
            <View style={styles.countBadge}>
              <Mono size={typeScale.caption} color={colors.paper60}>
                {data.photos.length} SHOTS
              </Mono>
            </View>
          </View>
          {data.isSeed && <Text style={styles.rollingIn}>The gallery is just getting started.</Text>}
          <View style={styles.headerRule} />
        </View>

        {!hasPotd && (
          <View style={styles.noCrown}>
            <Mono size={typeScale.caption} color={colors.paper40} weight="medium" style={styles.noCrownEyebrow}>
              THE WHOLE GALLERY
            </Mono>
            <Text style={styles.noCrownBody}>
              Every shot that made today's drop.
            </Text>
          </View>
        )}

        <GalleryGrid
          key={`${data.drop.id}:${reveal}`}
          photos={data.photos}
          reveal={reveal}
          potdLabel="PHOTO OF THE DAY"
          highlightUserId={myId}
          onPress={openPhoto}
          onHeart={(p) => void gHearts.toggle(p.id)}
          isHearted={gHearts.isLiked}
          heartCount={gHearts.count}
        />

        {/* End card — the back cover of the magazine (spec §11c). */}
        <View style={styles.endCard}>
          <View style={styles.endRule} />
          <View style={styles.teaserCard}>
            {data.nextDropAt ? (
              <>
                <Mono size={typeScale.caption} color={colors.paper40} weight="medium" style={{ letterSpacing: 2 }}>
                  THE NEXT DROP
                </Mono>
                <Countdown until={data.nextDropAt} size={typeScale.title} onDone={() => void refresh()} />
              </>
            ) : (
              <Text style={styles.teaserSoft}>Dropping shortly</Text>
            )}
            <Button label="See what's live" variant="text" onPress={() => router.push('/(tabs)/today')} />
          </View>
        </View>
      </ScrollView>
      {celebrate && reveal && (
        <View pointerEvents="none" style={styles.confettiOverlay}>
          <LottieView source={confettiSource} autoPlay loop={false} style={StyleSheet.absoluteFill} />
        </View>
      )}

      <Sheet visible={showPast} onClose={() => setShowPast(false)} title="Past drops">
        {viewingPast && (
          <Pressable
            accessibilityRole="button"
            style={styles.pastLatestRow}
            onPress={() => {
              setSelectedDropId(null);
              setShowPast(false);
            }}
          >
            <Text style={styles.pastLatestText}>Back to the latest</Text>
          </Pressable>
        )}
        <PastDropsCalendar
          pastDrops={(data?.past ?? []).filter((p) => p.drop_date < new Date().toISOString().slice(0, 10))}
          selectedDate={viewingDropDate}
          onSelectDate={(dropId) => {
            setSelectedDropId(dropId);
          }}
        />
      </Sheet>

      {viewerModal}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, gap: space.gutter, paddingBottom: 48 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: 8,
  },
  segments: { flexDirection: 'row', gap: 24 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBtn: { padding: 4 },
  segment: { alignItems: 'center', gap: space.xxsPlus },
  segmentLabel: { fontSize: typeScale.sub },
  segmentActive: { fontFamily: fonts.sansMedium, color: colors.paper },
  segmentInactive: { fontFamily: fonts.sans, color: colors.paper60 },
  segmentBar: { height: 2, width: 20, backgroundColor: 'transparent', borderRadius: 1 },
  segmentBarActive: { backgroundColor: colors.safelight },
  winnerPass: {
    padding: space.gutter,
    borderRadius: radius.card,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.crown,
    gap: space.xxsPlus,
  },
  winnerPassEyebrow: { letterSpacing: 1.5 },
  winnerPassTitle: {
    fontFamily: displayFamily,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  confettiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  header: { gap: 8 },
  viewingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.safelight,
    paddingHorizontal: space.smPlus,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginHorizontal: space.gutter,
    marginTop: 8,
  },
  viewingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.paper,
  },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  kicker: { letterSpacing: 1.5 },
  kickerDate: { letterSpacing: 1, flex: 1 },
  prompt: { fontFamily: displayFamily, fontSize: typeScale.display, lineHeight: typeScale.display * 1.1, color: colors.paper },
  rollingIn: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  headerRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30, marginTop: space.xxsPlus },
  center: { flex: 1, justifyContent: 'center' },
  noCrown: {
    alignItems: 'center',
    gap: space.xxsPlus,
    paddingVertical: space.mdPlus,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.paper30,
  },
  noCrownEyebrow: { letterSpacing: 1.5 },
  noCrownBody: {
    fontFamily: displayFamily,
    fontSize: typeScale.sub,
    lineHeight: typeScale.sub * 1.3,
    color: colors.paper60,
    textAlign: 'center',
    maxWidth: 280,
  },
  endCard: { gap: 0 },
  endRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30, marginTop: 8 },
  pastLatestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: space.xsPlus },
  pastLatestText: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.safelight },
  teaserCard: {
    alignItems: 'center',
    gap: space.xsPlus,
    paddingTop: 16,
    paddingBottom: 8,
  },
  teaserSoft: { fontFamily: displayFamily, fontSize: typeScale.sub, color: colors.paper60 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.hair },
  countBadge: {
    backgroundColor: colors.ink2,
    paddingHorizontal: space.xsPlus,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  categoryBadge: {
    backgroundColor: colors.ink2,
    paddingHorizontal: space.xsPlus,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
