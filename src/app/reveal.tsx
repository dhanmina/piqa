/**
 * Reveal — the morning ceremony (spec §11d). A one-shot, full-screen,
 * sequenced animation that plays the first time you open the app after a
 * gallery drops. Feels like developing a print: the PotD crown comes first
 * (the one gold moment of the day), then your own result, then the gallery
 * grid staggers in.
 *
 * Lives outside the tab bar. If the reveal has already been seen for the
 * latest drop, this screen immediately redirects to Today.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGallery } from '@lib/hooks/useGallery';
import { useSession } from '@lib/session';
import { capture } from '@lib/services/analytics';
import { isRevealSeen, markRevealSeen, markResultSeen } from '@lib/services/gallery';
import { useFrameForDate } from '@lib/hooks/frames';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { GalleryGrid } from '@/components/molecules/GalleryGrid';
import { colors, fonts, space, typeScale } from '@/components/tokens';

/** How long each phase waits before appearing (ms). */
const PHASE_1_DELAY = 600; // PotD crown
const PHASE_2_DELAY = 1800; // your result
const PHASE_3_DELAY = 3000; // gallery grid

const CROWN_DURATION = 800;
const RESULT_DURATION = 600;
const GRID_DURATION = 400;

export default function RevealScreen() {
  const router = useRouter();
  const { session } = useSession();
  const myId = session?.user.id;
  const { width: winW } = useWindowDimensions();
  const heroW = Math.min(winW - space.gutter * 2, 400);

  // Gallery data (already prefetched; reads from cache → instant on revisit).
  const { data, loading } = useGallery(null);

  const dropId = data?.drop?.id ?? null;
  const dropDate = data?.drop?.drop_date ?? null;
  const hasPotd = data?.photos.some((p) => p.isPotd);
  const potdPhoto = data?.photos.find((p) => p.isPotd);
  const myPhotoInGallery = data?.photos.find((p) => p.userId === myId);

  // Gallery photos already carry signed URLs from loadGallery — no second signing.
  const potdUri = potdPhoto?.fullUri ?? potdPhoto?.uri ?? null;
  const myUri = myPhotoInGallery?.fullUri ?? myPhotoInGallery?.uri ?? null;

  const potdFrame = useFrameForDate(dropDate);

  // Reveal decision — must settle before animating.
  const [decided, setDecided] = useState(false);
  const [showReveal, setShowReveal] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!dropId) {
      if (data) setDecided(true); // no drop → redirect
      return;
    }
    void isRevealSeen(dropId).then((seen) => {
      if (!alive) return;
      if (seen) {
        // Already seen — skip straight to Today.
        router.replace('/(tabs)/today');
        return;
      }
      // Mark immediately so a quick reopen doesn't replay.
      void markRevealSeen(dropId);
      void markResultSeen(dropId);
      capture('morning_reveal');
      setShowReveal(true);
      setDecided(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropId]);

  // Haptic on the PotD crown moment.
  useEffect(() => {
    if (!showReveal) return;
    const t = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, PHASE_1_DELAY + 200);
    return () => clearTimeout(t);
  }, [showReveal]);

  // Secondary haptic when the user's result appears.
  useEffect(() => {
    if (!showReveal || !myPhotoInGallery) return;
    const t = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, PHASE_2_DELAY + 150);
    return () => clearTimeout(t);
  }, [showReveal, myPhotoInGallery]);

  const goToGallery = useCallback(() => {
    router.replace('/(tabs)/gallery');
  }, [router]);

  const goToToday = useCallback(() => {
    router.replace('/(tabs)/today');
  }, [router]);

  // While deciding (async reveal check), show nothing — splash stays or black.
  if (!decided || loading) return null;

  // No drop / no photos — nothing to reveal.
  if (!showReveal || !data?.drop || data.photos.length === 0) {
    return <RedirectToToday />;
  }

  const resultLine = myPhotoInGallery
    ? myPhotoInGallery.isPotd
      ? 'Photo of the Day'
      : myPhotoInGallery.status === 'crown'
        ? 'Photo of the Day'
        : 'In the gallery'
    : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Phase 1: PotD — the one crown-gold moment. Only on days with a crown. */}
        {potdPhoto && (
        <Animated.View
          entering={FadeIn.duration(CROWN_DURATION).delay(PHASE_1_DELAY)}
          style={styles.phase}
        >
          <Mono size={typeScale.caption} color={colors.crown} weight="medium" style={styles.eyebrow}>
            PHOTO OF THE DAY
          </Mono>
          <Brackets animated color={colors.crown}>
                <FramedPhoto
                  photoUri={potdUri}
                  placeholderUri={potdUri}
                  dayNumber={potdPhoto.dayNumber}
                  frameId={potdFrame}
                  status={potdPhoto.status}
                  width={heroW}
                />
          </Brackets>
          {potdPhoto.shooter && (
            <Text style={styles.shooterName}>{potdPhoto.shooter}</Text>
          )}
        </Animated.View>
        )}

        {/* Phase 2: Your result. */}
        <Animated.View
          entering={FadeInDown.duration(RESULT_DURATION).delay(PHASE_2_DELAY)}
          style={styles.phase}
        >
          {myPhotoInGallery ? (
            <>
              <Mono size={typeScale.caption} color={colors.safelight} weight="medium" style={styles.eyebrow}>
                YOUR RESULT
              </Mono>
              <FramedPhoto
                photoUri={myUri}
                placeholderUri={myUri}
                dayNumber={myPhotoInGallery.dayNumber}
                frameId={myPhotoInGallery.frameId}
                status={myPhotoInGallery.status}
                width={heroW}
              />
              {resultLine && (
                <Text style={styles.resultText}>{resultLine}</Text>
              )}
            </>
          ) : (
            <>
              <Mono size={typeScale.caption} color={colors.paper60} weight="medium" style={styles.eyebrow}>
                YOUR RESULT
              </Mono>
              <View style={styles.noResult}>
                <Text style={styles.noResultText}>You didn&apos;t submit today</Text>
                <Text style={styles.noResultSub}>Tomorrow&apos;s shot is waiting</Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* Phase 3: Gallery grid — staggered tiles. */}
        <Animated.View
          entering={FadeInUp.duration(GRID_DURATION).delay(PHASE_3_DELAY)}
          style={styles.phase}
        >
          <Mono size={typeScale.caption} color={colors.paper60} style={styles.eyebrow}>
            TODAY&apos;S GALLERY
          </Mono>
          <GalleryGrid
            photos={data.photos}
            highlightUserId={myId}
            potdLabel={hasPotd ? 'PHOTO OF THE DAY' : undefined}
          />
        </Animated.View>

        {/* Continue — tap to enter the interactive gallery. */}
        <Animated.View
          entering={FadeIn.delay(PHASE_3_DELAY + 800)}
          style={styles.continue}
        >
          <Button label="See the full gallery" variant="ghost" fullWidth onPress={goToGallery} />
          <Pressable style={styles.laterBtn} onPress={goToToday}>
            <Mono size={typeScale.caption} color={colors.paper40}>
              Skip to Today
            </Mono>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Instant redirect when there's nothing to reveal. */
function RedirectToToday() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)/today');
  }, [router]);
  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  scroll: {
    padding: space.gutter,
    gap: space.gutter * 1.5,
    paddingBottom: 80,
  },
  phase: {
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  shooterName: {
    fontFamily: displayFamily,
    fontSize: typeScale.body,
    color: colors.paper,
    textAlign: 'center',
  },
  resultText: {
    fontFamily: displayFamily,
    fontSize: typeScale.sub,
    color: colors.paper,
    textAlign: 'center',
  },
  noResult: {
    alignItems: 'center',
    gap: space.xxsPlus,
    paddingVertical: 24,
  },
  noResultText: {
    fontFamily: displayFamily,
    fontSize: typeScale.body,
    color: colors.paper60,
    textAlign: 'center',
  },
  noResultSub: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper40,
    textAlign: 'center',
  },
  continue: {
    alignItems: 'center',
    gap: 12,
    paddingTop: space.gutter,
  },
  laterBtn: {
    padding: 8,
  },
});
