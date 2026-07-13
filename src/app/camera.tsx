/**
 * Camera — a mode, not a tab (spec §11c). Full-screen viewfinder, minimal
 * chrome: flip / flash / shutter ring. IN-APP CAPTURE ONLY — there is no
 * image picker or gallery import anywhere in this app, by law (spec §4).
 * No filters, no editing: the no-edit rule is a fairness feature.
 */
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera as CameraIcon, SwitchCamera, X, Zap, ZapOff } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { enqueueCapture } from '@lib/captureQueue';
import { useHomeState } from '@lib/homeState';
import { Button } from '@/components/atoms/Button';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { Toggle } from '@/components/atoms/Toggle';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { EmptyState } from '@/components/molecules/EmptyState';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, motion, overlay, photo, radius, typeScale } from '@/components/tokens';

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
  const { practice } = useLocalSearchParams<{ practice?: string }>();
  const practiceMode = practice === '1';

  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const drop = data?.drop ?? null;
  const live = !practiceMode && Boolean(drop?.is_live) && !data?.submission;
  // Default ON during the live window, OFF otherwise → archive (free_shots).
  const [submitDaily, setSubmitDaily] = useState<boolean | null>(null);
  const submitAsDaily = submitDaily ?? live;

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.root}>
        <IconButton icon={X} variant="chrome" accessibilityLabel="Close camera" onPress={() => router.back()} />
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
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (photo) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setCaptured({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          capturedAt: new Date().toISOString(),
        });
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
        kind: submitAsDaily && live && drop ? 'daily' : 'free',
        dropId: submitAsDaily && live && drop ? drop.id : null,
        dropsAt: submitAsDaily && live && drop ? drop.drops_at : null,
        capturedAt: captured.capturedAt,
      });
      router.back();
    } catch {
      // Local persistence failed (storage full etc.) — a real error, not connectivity.
      setToast('Could not save the shot. Check device storage');
    } finally {
      setBusy(false);
    }
  };

  if (captured) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.previewBody}>
          <Brackets animated color={colors.paper} style={styles.previewBrackets}>
            <Image
              source={{ uri: captured.uri }}
              style={styles.previewImage}
              contentFit="cover"
            />
          </Brackets>
        </View>
        <View style={styles.previewFooter}>
          {live && drop && (
            <Toggle
              label="Submit as Today’s Shot"
              value={submitAsDaily}
              onChange={setSubmitDaily}
            />
          )}
          {!live && (
            <Text style={styles.archiveNote}>Goes to your private archive</Text>
          )}
          <View style={styles.previewActions}>
            <Button label="Retake" variant="ghost" onPress={() => setCaptured(null)} />
            <Button label="Use" onPress={() => void use()} loading={busy} />
          </View>
        </View>
        <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} bottom={40} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} flash={flash} />
      <SafeAreaView style={styles.chrome} pointerEvents="box-none">
        <View style={styles.topRow}>
          <IconButton icon={X} variant="chrome" accessibilityLabel="Close camera" onPress={() => router.back()} />
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

        {live && drop && (
          <View style={styles.promptStrip}>
            <Mono size={10} color={colors.paper60}>
              TODAY’S SHOT
            </Mono>
            <Text style={styles.promptText} numberOfLines={2}>
              {drop.prompt}
            </Text>
          </View>
        )}

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
    gap: 10,
  },
  promptStrip: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: 2,
    backgroundColor: overlay.badge,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.card,
    maxWidth: '85%',
  },
  promptText: {
    fontFamily: displayFamily,
    fontSize: typeScale.body,
    color: colors.paper,
    textAlign: 'center',
  },
  bottomRow: {
    alignItems: 'center',
    paddingBottom: 28,
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
  previewBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  previewBrackets: {
    alignSelf: 'stretch',
  },
  previewImage: {
    width: '100%',
    aspectRatio: photo.aspect,
    backgroundColor: colors.ink2,
  },
  previewFooter: {
    padding: 20,
    gap: 16,
  },
  archiveNote: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
});
