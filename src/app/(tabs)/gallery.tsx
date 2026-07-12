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
import { Image as ImageIcon, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import confettiSource from '@/assets/lottie/confetti.json';

import {
  isRevealSeen,
  markRevealSeen,
  useFollowingGallery,
  useGallery,
  type GalleryDetailPhoto,
} from '@lib/gallery';
import { useSession } from '@lib/session';
import { Button } from '@/components/atoms/Button';
import { Countdown } from '@/components/atoms/Countdown';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { EmptyState } from '@/components/molecules/EmptyState';
import { GalleryGrid, type GalleryPhoto } from '@/components/molecules/GalleryGrid';
import { colors, fonts, space, typeScale } from '@/components/tokens';

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

  const { data, loading } = useGallery(selectedDropId);
  const { photos: followingPhotos, loading: followingLoading } = useFollowingGallery();

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

  const segmented = (
    <View style={styles.segmented}>
      {(['world', 'following'] as const).map((t) => (
        <Pressable key={t} accessibilityRole="button" style={styles.segment} onPress={() => setTab(t)}>
          <Text style={[styles.segmentLabel, tab === t ? styles.segmentActive : styles.segmentInactive]}>
            {t === 'world' ? 'World' : 'Following'}
          </Text>
          <View style={[styles.segmentBar, tab === t && styles.segmentBarActive]} />
        </Pressable>
      ))}
    </View>
  );

  if (tab === 'following') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {segmented}
        {followingLoading ? (
          <View style={styles.skeleton} />
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
          <ScrollView contentContainerStyle={styles.content}>
            <GalleryGrid photos={followingPhotos} reveal={false} highlightUserId={myId} onPress={openPhoto} />
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  if (loading || !ready) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {segmented}
        <View style={styles.skeleton} />
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
      <ScrollView contentContainerStyle={styles.content}>
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
            <Mono size={typeScale.caption} color={colors.paper60}>
              {longDate(data.drop.drop_date)}
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
        </View>

        <GalleryGrid
          key={`${data.drop.id}:${reveal}`}
          photos={data.photos}
          reveal={reveal}
          potdLabel={`PHOTO OF THE DAY · ${shortDate(data.drop.drop_date)}`}
          highlightUserId={myId}
          onPress={openPhoto}
        />

        {/* End card — the real bottom of the magazine (spec §11c). */}
        <View style={styles.endCard}>
          <View style={styles.rule} />

          {data.past.length > 0 && (
            <>
              <Button
                label={showPast ? 'Hide past galleries' : 'View past galleries'}
                variant="ghost"
                fullWidth
                onPress={() => setShowPast((s) => !s)}
              />
              {showPast &&
                data.past.map((g) => (
                  <Pressable
                    key={g.drop_id}
                    accessibilityRole="button"
                    style={styles.pastRow}
                    onPress={() => {
                      setSelectedDropId(g.drop_id);
                      setShowPast(false);
                    }}
                  >
                    <Mono size={typeScale.caption} color={colors.paper60}>
                      {shortDate(g.drop_date)}
                    </Mono>
                    <Text style={styles.pastPrompt} numberOfLines={1}>
                      {g.prompt ?? '—'}
                    </Text>
                  </Pressable>
                ))}
            </>
          )}

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
            <Button label="See what’s live →" variant="text" onPress={() => router.push('/(tabs)/today')} />
          </View>
        </View>
      </ScrollView>
      {celebrate && reveal && (
        <View pointerEvents="none" style={styles.confettiOverlay}>
          <LottieView source={confettiSource} autoPlay loop={false} style={StyleSheet.absoluteFill} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, gap: space.gutter, paddingBottom: 48 },
  segmented: {
    flexDirection: 'row',
    paddingHorizontal: space.gutter,
    paddingTop: 8,
    gap: 24,
  },
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
    borderRadius: 12,
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
  header: { gap: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prompt: { fontFamily: displayFamily, fontSize: typeScale.title, color: colors.paper },
  rollingIn: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  center: { flex: 1, justifyContent: 'center' },
  skeleton: { flex: 1, margin: space.gutter, borderRadius: 12, backgroundColor: colors.ink2 },
  endCard: { gap: 14 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30, marginTop: 8 },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink2,
  },
  pastPrompt: { flex: 1, fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper },
  teaser: { alignItems: 'center', gap: 6, paddingTop: 8 },
  teaserSoft: { fontFamily: displayFamily, fontSize: typeScale.sub, color: colors.paper60 },
});
