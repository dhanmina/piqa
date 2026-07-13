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
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { Calendar, CloudOff, Image as ImageIcon, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import confettiSource from '@/assets/lottie/confetti.json';

import {
  isRevealSeen,
  markRevealSeen,
  useFollowingGallery,
  useGallery,
  useGalleryHearts,
  type GalleryDetailPhoto,
} from '@lib/gallery';
import { useSession } from '@lib/session';
import { Button } from '@/components/atoms/Button';
import { Countdown } from '@/components/atoms/Countdown';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { EmptyState } from '@/components/molecules/EmptyState';
import { GalleryGrid, GalleryGridSkeleton, type GalleryPhoto } from '@/components/molecules/GalleryGrid';
import { Sheet } from '@/components/molecules/Sheet';
import { colors, fonts, icons, radius, space, typeScale } from '@/components/tokens';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export default function GalleryScreen() {
  const router = useRouter();
  const { session } = useSession();
  const myId = session?.user.id;

  const [tab, setTab] = useState<'world' | 'following'>('world');
  const [selectedDropId, setSelectedDropId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    let alive = true;
    setReady(false);
    const d = data?.drop;
    if (!d) {
      if (data) setReady(true);
      return;
    }
    // Only the latest, real (non-seed) gallery gets the one-time reveal.
    if (selectedDropId !== null || data.isSeed) {
      setReveal(false);
      setReady(true);
      return;
    }
    void isRevealSeen(d.id).then((seen) => {
      if (!alive) return;
      setReveal(!seen);
      if (!seen) {
        void markRevealSeen(d.id);
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
  }, [data, selectedDropId]);

  const openPhoto = (p: GalleryPhoto) => {
    const full = (data?.photos.find((x) => x.id === p.id) ??
      followingPhotos.find((x) => x.id === p.id)) as GalleryDetailPhoto | undefined;
    router.push({
      pathname: '/photo/[id]',
      params: {
        id: p.id,
        path: full?.imagePath ?? full?.thumbPath ?? '',
        shooter: full?.shooter ?? '',
        hearts: String(full?.hearts ?? 0),
        captured: full?.capturedAt ?? '',
        potd: full?.isPotd ? '1' : '',
        user: full?.userId ?? '',
      },
    });
  };

  const hasPast = tab === 'world' && (data?.past?.length ?? 0) > 0;
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
      {hasPast && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Past galleries"
          hitSlop={10}
          style={styles.calBtn}
          onPress={() => setShowPast(true)}
        >
          <Calendar size={20} strokeWidth={icons.strokeWidth} color={colors.paper60} />
        </Pressable>
      )}
    </View>
  );

  if (tab === 'following') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {segmented}
        {followingError && followingPhotos.length === 0 ? (
          <View style={styles.center}>
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
          <View style={styles.center}>
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
            />
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {segmented}
        <View style={styles.center}>
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
        {segmented}
        <View style={styles.center}>
          <EmptyState icon={ImageIcon} line="The first galleries are rolling in." />
        </View>
      </SafeAreaView>
    );
  }

  const viewingPast = selectedDropId !== null;

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
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSelectedDropId(null)}>
                <Mono size={typeScale.caption} color={colors.safelight}>
                  ← Latest
                </Mono>
              </Pressable>
            )}
          </View>
          {data.drop.prompt && <Text style={styles.prompt}>{data.drop.prompt}</Text>}
          {data.isSeed && <Text style={styles.rollingIn}>The first galleries are rolling in.</Text>}
          <View style={styles.headerRule} />
        </View>

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
                <Countdown until={data.nextDropAt} size={typeScale.title} />
              </>
            ) : (
              <Text style={styles.teaserSoft}>Tomorrow’s shot is loading</Text>
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
        <ScrollView style={styles.pastScroll}>
          {(data.past ?? []).map((g) => (
            <Pressable
              key={g.drop_id}
              accessibilityRole="button"
              style={styles.pastRow}
              onPress={() => {
                setSelectedDropId(g.drop_id);
                setShowPast(false);
              }}
            >
              <Mono size={typeScale.caption} color={colors.safelight}>
                {shortDate(g.drop_date)}
              </Mono>
              <Text style={styles.pastPrompt} numberOfLines={1}>
                {g.prompt ?? '—'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
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
  calBtn: { padding: 4 },
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
  endCard: { gap: 14 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30, marginTop: 8 },
  pastScroll: { maxHeight: 360 },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink2,
  },
  pastPrompt: { flex: 1, fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper },
  teaser: { alignItems: 'center', gap: 6, paddingTop: 8 },
  teaserSoft: { fontFamily: displayFamily, fontSize: typeScale.sub, color: colors.paper60 },
});
