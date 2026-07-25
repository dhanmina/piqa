/**
 * Gallery — the ONLY sub-tabs in the app: World · Following (spec §11c).
 * World reads a materialized JSON blob (never a live query for the day's
 * photos): date + prompt → PotD full-width cover (gold brackets, crown, gold
 * eyebrow, shooter) → unnumbered 2-col grid → end card (past back-issues ·
 * what's live · tomorrow teaser). First open plays the morning reveal once; if
 * my shot made it, my tile enters last in gold brackets. Past galleries are
 * immutable and re-open identically. Following is a pull surface — invitation
 * until Profile/Follow lands in Phase 4.
 */
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { ArrowLeft, Calendar, ChevronRight, CloudOff, Image as ImageIcon, Search, Users } from 'lucide-react-native';
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
import { useProfile } from '@lib/hooks/useProfile';
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
import { Sheet } from '@/components/molecules/Sheet';
import { colors, fonts, icons, radius, space, typeScale } from '@/components/tokens';

// Row eyebrow drops the month — the section header carries it, so rows read "SUN 13".
const issueDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }).toUpperCase();

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

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

  // Blur preference — read from the viewer's own profile.
  const { data: myProfile } = useProfile(null);
  const blurEnabled = myProfile?.blurSensitive ?? true;

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

  // Group back-issues into month sections so a long archive stays legible and
  // you can orient by month instead of scrolling one flat list (kept in the
  // payload's order, newest first).
  const pastGroups = useMemo(() => {
    type PastEntry = { drop_id: string; drop_date: string; prompt: string | null };
    const groups: { key: string; label: string; items: PastEntry[] }[] = [];
    for (const g of data?.past ?? []) {
      const label = monthLabel(g.drop_date);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(g);
      else groups.push({ key: label, label, items: [g] });
    }
    return groups;
  }, [data?.past]);

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
          blurEnabled={blurEnabled}
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

  const hasPast = tab === 'world' && ((data?.past?.length ?? 0) > 0 || everHadPast);
  const segmented = (
    <View style={styles.topBar}>
      <View style={styles.segments}>
        {(['world', 'following'] as const).map((t) => (
          <Pressable key={t} accessibilityRole="button" style={styles.segment} onPress={() => setTab(t)}>
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
            onPress={() => setShowPast(true)}
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
        {followingError && followingPhotos.length === 0 ? (
          <View style={[styles.center, centerPad]}>
            <EmptyState
              icon={CloudOff}
              line="Couldn't load Following. Check your connection."
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
              line="Follow shooters and their winning galleries land here"
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
              blurEnabled={blurEnabled}
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
            line="Couldn't load the gallery. Check your connection."
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
          <View style={[styles.center, centerPad]}>
            <EmptyState icon={ImageIcon} line="The first galleries are rolling in." />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const viewingPast = selectedDropId !== null;
  // The crowd only crowns a Photo of the Day above the vote floor (close_day →
  // potd_requires_votes). On a thin day nobody is crowned, so there is NO hero —
  // faking one would counterfeit the app's one scarce honor. Instead the page
  // leads with a quiet editorial note where the crown would sit, and the grid
  // stays equal-weight (every shot already made the gallery).
  const hasPotd = data.photos.some((p) => p.isPotd);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {segmented}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.paper60} />
        }
      >
        {celebrate && reveal && (
          <View style={styles.celebrate}>
            <Text style={styles.celebrateText}>Your shot made the gallery</Text>
            <Mono size={typeScale.caption} color={colors.paper60}>
              scroll down to your framed tile
            </Mono>
          </View>
        )}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Mono size={typeScale.caption} color={colors.paper60} style={styles.kicker}>
              {longDate(data.drop.drop_date).toUpperCase()}
            </Mono>
            {viewingPast && (
              <Pressable
                accessibilityRole="button"
                hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                onPress={() => setSelectedDropId(null)}
              >
                <Mono size={typeScale.caption} color={colors.safelight}>
                  ← Latest
                </Mono>
              </Pressable>
            )}
          </View>
          {data.drop.prompt && (
            <Text style={styles.prompt} numberOfLines={3}>
              {data.drop.prompt}
            </Text>
          )}
          {data.isSeed && <Text style={styles.rollingIn}>The first galleries are rolling in.</Text>}
          <View style={styles.headerRule} />
        </View>

        {!hasPotd && (
          <View style={styles.noCrown}>
            <Mono size={typeScale.caption} color={colors.paper60} style={styles.noCrownEyebrow}>
              NO CROWN TODAY
            </Mono>
            <Text style={styles.noCrownBody}>
              Not enough votes to crown a Photo of the Day. Here’s the whole gallery.
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
          blurEnabled={blurEnabled}
        />

        {/* End card — the real bottom of the magazine (spec §11c). One clean
            forward block: what's next. Past issues live in the header calendar. */}
        <View style={styles.endCard}>
          <View style={styles.rule} />
          <View style={styles.teaser}>
            {data.nextDropAt ? (
              <>
                <Mono size={typeScale.caption} color={colors.paper60}>
                  NEXT SHOT IN
                </Mono>
                {/* onDone matters here: without it the clock hits 00:00:00 and freezes,
                    so the back page keeps showing a dead timer after the drop lands. */}
                <Countdown until={data.nextDropAt} size={typeScale.title} onDone={() => void refresh()} />
              </>
            ) : (
              <Text style={styles.teaserSoft}>Next shot drops soon</Text>
            )}
            <Button label="See what’s live" variant="text" onPress={() => router.push('/(tabs)/today')} />
          </View>
        </View>
      </ScrollView>
      {celebrate && reveal && (
        <View pointerEvents="none" style={styles.confettiOverlay}>
          <LottieView source={confettiSource} autoPlay loop={false} style={StyleSheet.absoluteFill} />
        </View>
      )}

      <Sheet visible={showPast} onClose={() => setShowPast(false)} title="Past galleries">
        {/* Viewing a back-issue only lists issues older than it, so pin a way home
            here — otherwise the only route to latest is closing the sheet. */}
        {viewingPast && (
          <Pressable
            accessibilityRole="button"
            style={styles.pastLatestRow}
            onPress={() => {
              setSelectedDropId(null);
              setShowPast(false);
            }}
          >
            <ArrowLeft size={16} strokeWidth={icons.strokeWidth} color={colors.safelight} />
            <Text style={styles.pastLatestText}>Back to the latest gallery</Text>
          </Pressable>
        )}
        <Text style={styles.pastIntro}>Tap a gallery to open it again.</Text>
        <ScrollView style={styles.pastScroll}>
          {pastGroups.map((grp) => (
            <View key={grp.key}>
              <Text style={styles.pastMonth}>{grp.label}</Text>
              {grp.items.map((g) => (
                <Pressable
                  key={g.drop_id}
                  accessibilityRole="button"
                  style={styles.pastRow}
                  onPress={() => {
                    setSelectedDropId(g.drop_id);
                    setShowPast(false);
                  }}
                >
                  <View style={styles.pastRowText}>
                    <Mono size={typeScale.caption} color={colors.paper60} style={styles.pastEyebrow}>
                      {issueDate(g.drop_date)}
                    </Mono>
                    <Text style={styles.pastTitle} numberOfLines={2}>
                      {g.prompt ?? 'Untitled gallery'}
                    </Text>
                  </View>
                  <ChevronRight size={18} strokeWidth={icons.strokeWidth} color={colors.paper60} />
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
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
  segment: { alignItems: 'center', gap: 6 },
  segmentLabel: { fontSize: typeScale.sub },
  segmentActive: { fontFamily: fonts.sansMedium, color: colors.paper },
  segmentInactive: { fontFamily: fonts.sans, color: colors.paper60 },
  segmentBar: { height: 2, width: 20, backgroundColor: 'transparent', borderRadius: 1 },
  segmentBarActive: { backgroundColor: colors.safelight },
  celebrate: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: radius.card,
    backgroundColor: colors.ink2,
  },
  celebrateText: {
    fontFamily: displayFamily,
    fontSize: typeScale.title,
    color: colors.safelight,
    textAlign: 'center',
  },
  confettiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  header: { gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { letterSpacing: 1.5 },
  prompt: { fontFamily: displayFamily, fontSize: typeScale.display, lineHeight: typeScale.display * 1.1, color: colors.paper },
  rollingIn: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  headerRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30, marginTop: 6 },
  center: { flex: 1, justifyContent: 'center' },
  // Editorial note that stands in for the hero on a no-crown day. Centered and
  // hairline-bracketed so the empty front page reads as deliberate whitespace,
  // not a failed load. Never gold — the crown treatment is reserved for a real
  // Photo of the Day.
  noCrown: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 18,
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
  endCard: { gap: 14 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30, marginTop: 8 },
  pastLatestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  pastLatestText: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.safelight },
  pastIntro: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60, marginBottom: 4 },
  pastScroll: { maxHeight: 360 },
  pastMonth: {
    fontFamily: fonts.monoMedium,
    fontSize: typeScale.caption,
    letterSpacing: 1.5,
    color: colors.paper60,
    paddingTop: 18,
    paddingBottom: 6,
  },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink2,
  },
  pastRowText: { flex: 1, gap: 4 },
  pastEyebrow: { letterSpacing: 1 },
  pastTitle: { fontFamily: displayFamily, fontSize: typeScale.body, lineHeight: typeScale.body * 1.15, color: colors.paper },
  teaser: { alignItems: 'center', gap: 6, paddingTop: 8 },
  teaserSoft: { fontFamily: displayFamily, fontSize: typeScale.sub, color: colors.paper60 },
});
