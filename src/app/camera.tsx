/**
 * Camera — a mode, not a tab (spec §11c). Full-screen viewfinder, minimal
 * chrome: flip / flash / shutter ring. IN-APP CAPTURE ONLY — there is no
 * image picker or gallery import anywhere in this app, by law (spec §4).
 * No filters, no editing: the no-edit rule is a fairness feature.
 */
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { manipulateAsync } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera as CameraIcon, SwitchCamera, X, Zap, ZapOff } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { enqueueCapture } from '@lib/services/captureQueue';
import { getGridEnabledSync, getMirrorEnabledSync } from '@lib/cameraPrefs';
import { useHomeState } from '@lib/homeState';
import { Button } from '@/components/atoms/Button';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { Toggle } from '@/components/atoms/Toggle';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { EmptyState } from '@/components/molecules/EmptyState';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, motion, photo, space, typeScale } from '@/components/tokens';

type Captured = {
  uri: string;
  width: number;
  height: number;
  capturedAt: string; // stamped at the shutter moment
};

const FLASH_ORDER: FlashMode[] = ['off', 'on', 'auto'];

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const { data } = useHomeState();
  // Practice mode (from Today's "while you wait" / Archive CTA): always a
  // free shot to the archive, even if a drop is live. Same offline queue.
  const { practice, firstShot, studioChallengeId, studioTheme } = useLocalSearchParams<{
    practice?: string;
    firstShot?: string;
    studioChallengeId?: string;
    studioTheme?: string;
  }>();
  const practiceMode = practice === '1';
  const isFirstShot = firstShot === '1';
  // Studio challenge capture: walled off from the daily Shot entirely — never
  // competes with the submit-toggle, never becomes a daily submission.
  const challengeMode = typeof studioChallengeId === 'string' && studioChallengeId.length > 0;

  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  // Read once at mount — this screen is always a fresh mount when opened, so
  // there's no need to react to a Settings change made while it's open.
  const [gridEnabled] = useState(() => getGridEnabledSync());
  const [mirrorEnabled] = useState(() => getMirrorEnabledSync());
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // The camera is a fullScreenModal. Close it by dismissing the modal — not
  // router.back(), which walked history one entry at a time and needed two taps
  // to actually leave. dismissAll is safe: the camera only ever opens from a tab,
  // so it's the top (and only) modal.
  const close = () => {
    if (router.canDismiss()) router.dismissAll();
    else router.back();
  };

  const drop = data?.drop ?? null;
  const live = !practiceMode && !challengeMode && Boolean(drop?.is_live) && !data?.submission;
  // Default ON during the live window, OFF otherwise → archive (free_shots).
  const [submitDaily, setSubmitDaily] = useState<boolean | null>(null);
  const submitAsDaily = submitDaily ?? live;

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.root}>
        <IconButton icon={X} variant="chrome" accessibilityLabel="Close camera" onPress={close} />
        <View style={styles.center}>
          <EmptyState
            icon={CameraIcon}
            line="Every Piqa photo is shot in-app, today. Allow the camera to play"
            ctaLabel="Allow camera"
            onCta={() => void requestPermission()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const capture = async () => {
    if (busy || captured) return;
    setBusy(true);
    // Confirm the shutter the INSTANT it's pressed. takePictureAsync can take a
    // beat on real hardware; firing the haptic only after it resolved made the
    // press feel laggy or dropped. Fire-and-forget — never block the capture.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (shot) {
        let { uri, width, height } = shot;
        // Emulator only: expo-camera can't reach a real camera on an emulator, so
        // takePicture returns a hardcoded fake — a view-sized black bitmap (< 2000px)
        // with a yellow dd.MM.yy timestamp burned into the bottom. Crop that strip
        // off so the dev preview is clean. Real captures are ~3000–4000px and are
        // never touched (the upload queue bakes the canonical 4:5 crop later).
        if (width < 2000) {
          const cropped = await manipulateAsync(uri, [{ crop: { originX: 0, originY: 0, width, height: Math.round(height * 0.85) } }], { compress: 0.9 });
          uri = cropped.uri;
          width = cropped.width;
          height = cropped.height;
        }
        setCaptured({ uri, width, height, capturedAt: new Date().toISOString() });
      }
    } finally {
      setBusy(false);
    }
  };

  const use = async () => {
    if (!captured || busy) return;
    setBusy(true);
    try {
      // Persists locally + journals instantly; upload happens in the background.
      await enqueueCapture({
        uri: captured.uri,
        width: captured.width,
        height: captured.height,
        kind: challengeMode ? 'studio_challenge' : submitAsDaily && live && drop ? 'daily' : 'free',
        dropId: submitAsDaily && live && drop ? drop.id : null,
        dropsAt: submitAsDaily && live && drop ? drop.drops_at : null,
        challengeId: challengeMode ? studioChallengeId : null,
        capturedAt: captured.capturedAt,
      });
      if (isFirstShot) {
        router.replace('/(tabs)/today');
      } else {
        close();
      }
    } catch {
      // Local persistence failed (storage full etc.) — a real error, not connectivity.
      setToast('Could not save the shot. Check device storage');
    } finally {
      setBusy(false);
    }
  };

  if (captured) {
    const asDaily = Boolean(submitAsDaily && live && drop);
    // First-shot mode: always show the framed print — this IS the aha moment.
    const showFrame = asDaily || isFirstShot;
    const primaryLabel = isFirstShot
      ? 'See your first print'
      : challengeMode
        ? 'Add to challenge'
        : asDaily
          ? 'Use this shot'
          : 'Save to archive';
    const consequence = isFirstShot
      ? 'Your first framed print. This is the magic.'
      : challengeMode
        ? 'Everyone in your Studio can heart it. No winners, no ranking.'
        : asDaily
          ? 'One shot a day. This locks it in.'
          : live
            ? 'This won\u2019t count for today. It goes to your archive.'
            : 'Goes to your private archive. Only you see it.';
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.previewTop}>
          {/* Bail out entirely — the shot is local-only until "Use", so leaving
              just discards it. Retake, by contrast, only re-opens the finder. */}
          <IconButton
            icon={X}
            variant="chrome"
            accessibilityLabel="Discard and close"
            onPress={isFirstShot ? () => router.replace('/(tabs)/today') : close}
          />
        </View>
        <View style={styles.previewBody}>
          {/* Review it as it will land: a daily shot becomes today's print (real
              day counter); a practice/archive shot stays plain in brackets. */}
          {showFrame && drop && !isFirstShot ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.previewPrint}>
              <FramedPhoto photoUri={captured.uri} dayNumber={drop.day_number} frameId="default" status={null} />
            </Animated.View>
          ) : showFrame ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.previewPrint}>
              <FramedPhoto photoUri={captured.uri} dayNumber={0} frameId="default" status={null} />
            </Animated.View>
          ) : (
            <Brackets animated color={colors.paper} style={styles.previewBrackets}>
              <Image source={{ uri: captured.uri }} style={styles.previewImage} contentFit="cover" />
            </Brackets>
          )}
        </View>
        <View style={styles.previewFooter}>
          <View style={styles.previewInfo}>
            {live && drop && !isFirstShot && (
              <Toggle label="Submit as Today's Shot" value={submitAsDaily} onChange={setSubmitDaily} />
            )}
            <Text style={styles.consequence}>{consequence}</Text>
          </View>
          <View style={styles.previewActions}>
            <Button label={primaryLabel} onPress={() => void use()} loading={busy} fullWidth />
            <Button label="Retake" variant="text" onPress={() => setCaptured(null)} />
          </View>
        </View>
        <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} bottom={40} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.chrome} pointerEvents="box-none">
        <View style={styles.topRow}>
          <IconButton icon={X} variant="chrome" accessibilityLabel="Close camera" onPress={close} />
          <View style={styles.topActions}>
            <IconButton
              icon={flash === 'off' ? ZapOff : Zap}
              variant="chrome"
              accessibilityLabel={`Flash ${flash}`}
              fill={flash === 'on' ? colors.paper : undefined}
              onPress={() =>
                setFlash(FLASH_ORDER[(FLASH_ORDER.indexOf(flash) + 1) % FLASH_ORDER.length])
              }
            />
            <IconButton
              icon={SwitchCamera}
              variant="chrome"
              accessibilityLabel="Flip camera"
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
            />
          </View>
        </View>

        {/* Preview-first: one large 3:4 viewfinder in the piqa brackets, the same
            every time you open the cam. The 3:4 shape + brackets are the signature;
            the print (rail · day · frame) belongs on the RESULT, shown at review. */}
        <View style={styles.finderArea}>
          {/* The brief leads: the prompt is the assignment for a daily shot; a
              clear label for practice, so the cam always says what mode it's in. */}
          <View style={styles.brief}>
            {isFirstShot ? (
              <>
                <Mono size={typeScale.caption} weight="medium" color={colors.crown}>
                  YOUR FIRST SHOT
                </Mono>
                <Text style={styles.briefSub}>Shoot anything. Watch it become a print.</Text>
              </>
            ) : challengeMode ? (
              <>
                <Mono size={typeScale.caption} weight="medium" color={colors.paper60}>
                  STUDIO CHALLENGE
                </Mono>
                <Text style={styles.briefPrompt} numberOfLines={3}>
                  {studioTheme}
                </Text>
              </>
            ) : live && drop ? (
              <>
                <Mono size={typeScale.caption} weight="medium" color={colors.safelight}>
                  TODAY’S SHOT
                </Mono>
                <Text style={styles.briefPrompt} numberOfLines={3}>
                  {drop.prompt}
                </Text>
              </>
            ) : (
              <>
                <Mono size={typeScale.caption} weight="medium" color={colors.paper60}>
                  FREE SHOT
                </Mono>
                <Text style={styles.briefSub}>Shoot anything, no pressure. Goes straight to your private archive.</Text>
              </>
            )}
          </View>
          <Brackets color={colors.paper} style={styles.finder}>
            <View style={styles.camWindow}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                flash={flash}
                mirror={facing === 'front' && mirrorEnabled}
                // We own the shutter feedback (ring press + instant haptic + the
                // jump to review). The native black-flash only added a competing
                // beat that read as lag.
                animateShutter={false}
              />
              {gridEnabled ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <View style={[styles.gridLineV, { left: '33.33%' }]} />
                  <View style={[styles.gridLineV, { left: '66.66%' }]} />
                  <View style={[styles.gridLineH, { top: '33.33%' }]} />
                  <View style={[styles.gridLineH, { top: '66.66%' }]} />
                </View>
              ) : null}
            </View>
          </Brackets>
        </View>

        <View style={styles.bottomRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            disabled={busy}
            onPress={() => void capture()}
            style={({ pressed }) => [styles.shutterRing, pressed && { transform: [{ scale: motion.pressScale }] }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          {/* Know the stakes before you press it. */}
          <Text style={styles.shutterCaption}>
            {isFirstShot
              ? 'Tap to capture your first print'
              : challengeMode
                ? "Adds to your Studio's challenge"
                : live && drop
                  ? 'Counts as today\'s shot'
                  : 'Saves to your archive'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  chrome: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  topActions: {
    flexDirection: 'row',
    gap: space.xsPlus,
  },
  // Viewfinder: a daily shot composes inside the print (FramedPhoto); a practice
  // shot in plain brackets — each matches what it becomes. Dark surround around.
  finderArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    gap: 12,
  },
  finder: { alignSelf: 'stretch' },
  camWindow: {
    width: '100%',
    aspectRatio: photo.aspect,
    backgroundColor: colors.ink2,
    overflow: 'hidden',
  },
  // Rule-of-thirds lines — a composition aid, not part of the shot (an absolute-
  // fill sibling over the CameraView, since it takes no overlay children).
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.paper30,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.paper30,
  },
  // Editorial brief above the viewfinder — no chip, just an eyebrow + the prompt.
  brief: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: space.xxsPlus,
    maxWidth: '88%',
  },
  briefPrompt: {
    fontFamily: displayFamily,
    fontSize: typeScale.title,
    lineHeight: typeScale.title * 1.15,
    color: colors.paper,
    textAlign: 'center',
  },
  briefSub: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    textAlign: 'center',
  },
  bottomRow: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 24,
  },
  shutterCaption: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  shutterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.safelight,
  },
  previewTop: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  previewBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  previewPrint: {
    width: '100%',
  },
  previewBrackets: { alignSelf: 'stretch' },
  previewImage: {
    width: '100%',
    aspectRatio: photo.aspect,
    backgroundColor: colors.ink2,
  },
  previewFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: space.mdPlus,
  },
  previewInfo: {
    gap: 8,
  },
  consequence: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    lineHeight: typeScale.caption * 1.45,
    color: colors.paper60,
  },
  previewActions: {
    gap: 4,
  },
});
