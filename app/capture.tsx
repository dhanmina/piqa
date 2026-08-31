import { useRef, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { ImageManipulator } from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { enqueueCapture } from '../lib/captureQueue';
import { Button } from '../components/Button';
import { FieldError } from '../components/FieldError';
import { colors, spacing, radius, type, touchTarget, PHOTO_ASPECT_RATIO } from '../lib/theme';

const PRESS_SPRING = { damping: 18, stiffness: 400 };
const SHUTTER_SIZE = 72;
// enqueueCapture is now a local file copy, not a network round trip — it resolves in a
// few ms, which reads as "nothing happened" without a floor under the Saving state.
const MIN_SAVING_MS = 450;
// Explicit "Saved" beat so confirming reads as a positive result, not just a spinner
// that disappears into a screen change.
const SAVED_DISPLAY_MS = 450;
const TORCH_ON_ICON = { ios: 'bolt.fill', android: 'flash_on' } as const;
const TORCH_OFF_ICON = { ios: 'bolt.slash.fill', android: 'flash_off' } as const;
const FLIP_ICON = { ios: 'arrow.triangle.2.circlepath.camera', android: 'flip_camera_android' } as const;

async function cropToCaptureRatio(uri: string, width: number, height: number): Promise<string> {
  const rect =
    width / height > PHOTO_ASPECT_RATIO
      ? {
          width: Math.round(height * PHOTO_ASPECT_RATIO),
          height,
          originX: Math.round((width - height * PHOTO_ASPECT_RATIO) / 2),
          originY: 0,
        }
      : {
          width,
          height: Math.round(width / PHOTO_ASPECT_RATIO),
          originX: 0,
          originY: Math.round((height - width / PHOTO_ASPECT_RATIO) / 2),
        };
  const image = await ImageManipulator.manipulate(uri).crop(rect).renderAsync();
  const result = await image.saveAsync({ compress: 0.9 });
  return result.uri;
}

export default function Capture() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saving = saveStatus !== 'idle';
  const [saveError, setSaveError] = useState<string | null>(null);
  const shutterScale = useSharedValue(1);
  const shutterStyle = useAnimatedStyle(() => ({ transform: [{ scale: shutterScale.value }] }));

  function flipCamera() {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
    setTorchOn(false); // front camera has no flash hardware on most phones
  }

  async function shoot() {
    if (capturing) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const photo = await cameraRef.current?.takePictureAsync();
    if (photo) {
      const cropped = await cropToCaptureRatio(photo.uri, photo.width, photo.height);
      setPreview(cropped);
    }
    setCapturing(false);
  }

  async function confirm() {
    if (!preview) return;
    setSaveStatus('saving');
    setSaveError(null);
    const start = Date.now();
    const { error } = await enqueueCapture(preview);
    if (error) {
      setSaveStatus('idle');
      setSaveError("Couldn't save that photo. Try again.");
      return;
    }
    const remaining = MIN_SAVING_MS - (Date.now() - start);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    setSaveStatus('saved');
    await new Promise((resolve) => setTimeout(resolve, SAVED_DISPLAY_MS));
    router.dismissTo({ pathname: '/(tabs)/today', params: { justCaptured: '1', localPreviewUri: preview } });
  }

  if (!permission) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.deniedContainer}>
        <View style={{ gap: spacing.lg, padding: spacing.lg }}>
          <Text style={{ ...type.title, color: colors.textPrimary, textAlign: 'center' }}>
            Camera access needed
          </Text>
          <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center' }}>
            piqa needs your camera to capture the moment.
          </Text>
          <View style={{ gap: spacing.sm }}>
            {permission.canAskAgain ? (
              <Button label="Enable camera" onPress={requestPermission} />
            ) : (
              <Button label="Open Settings" onPress={() => Linking.openSettings()} />
            )}
            <Button label="Back" variant="secondary" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (preview) {
    return (
      <View style={styles.fill}>
        <SafeAreaView style={styles.fill} pointerEvents="box-none">
          <View style={styles.topRow}>
            <Pressable
              hitSlop={touchTarget.min}
              onPress={() => router.back()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Discard photo and close"
              style={styles.closeButton}
            >
              <Text style={{ ...type.title, color: colors.textPrimary }}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.previewImageContainer}>
            <Image
              source={{ uri: preview }}
              style={styles.viewfinder}
              resizeMode="cover"
              accessibilityLabel="Photo you just captured"
            />
            <View style={styles.previewScrim}>
              <View style={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                <FieldError message={saveError} />
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Button label="Retake" variant="secondary" onPress={() => setPreview(null)} disabled={saving} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Confirm"
                      loadingLabel={saveStatus === 'saved' ? 'Saved' : 'Saving…'}
                      loading={saving}
                      onPress={confirm}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <View style={styles.viewfinderContainer}>
        <CameraView ref={cameraRef} style={styles.viewfinder} facing={facing} enableTorch={torchOn} />
      </View>
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable
            hitSlop={touchTarget.min}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
            style={styles.closeButton}
          >
            <Text style={{ ...type.title, color: colors.textPrimary }}>✕</Text>
          </Pressable>
          <View style={{ flexDirection: 'row' }}>
            {facing === 'back' ? (
              <Pressable
                hitSlop={touchTarget.min}
                onPress={() => setTorchOn((on) => !on)}
                accessibilityRole="button"
                accessibilityLabel={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                accessibilityState={{ selected: torchOn }}
                style={styles.closeButton}
              >
                <SymbolView name={torchOn ? TORCH_ON_ICON : TORCH_OFF_ICON} size={22} tintColor={colors.textPrimary} />
              </Pressable>
            ) : null}
            <Pressable
              hitSlop={touchTarget.min}
              onPress={flipCamera}
              accessibilityRole="button"
              accessibilityLabel={facing === 'back' ? 'Switch to front camera' : 'Switch to back camera'}
              style={styles.closeButton}
            >
              <SymbolView name={FLIP_ICON} size={22} tintColor={colors.textPrimary} />
            </Pressable>
          </View>
        </View>
        <View style={styles.shutterRow}>
          <Pressable
            onPress={shoot}
            onPressIn={() => (shutterScale.value = withSpring(0.9, PRESS_SPRING))}
            onPressOut={() => (shutterScale.value = withSpring(1, PRESS_SPRING))}
            disabled={capturing}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityState={{ disabled: capturing, busy: capturing }}
          >
            <Animated.View style={[styles.shutter, shutterStyle, capturing && styles.shutterCapturing]} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  // Camera feed is boxed to the exact 3:4 the shutter saves, so what's framed
  // here is what ends up in the photo — no fullscreen preview promising more
  // than the crop keeps.
  viewfinderContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  previewImageContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  viewfinder: { width: '100%', aspectRatio: PHOTO_ASPECT_RATIO },
  deniedContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  closeButton: {
    margin: spacing.md,
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radius.button,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRow: { alignItems: 'center', paddingBottom: spacing.xl },
  shutter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    backgroundColor: colors.accent,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  shutterCapturing: { opacity: 0.5 },
  previewScrim: { backgroundColor: 'rgba(0,0,0,0.55)', paddingBottom: spacing.md },
});
