import { useRef, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import {
  Camera,
  useCameraPermission,
  useCameraDevice,
  usePhotoOutput,
  CommonResolutions,
  type CameraRef,
  type TargetCameraPosition,
} from 'react-native-vision-camera';
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
const FOCUS_RING_SIZE = 64;

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
  const cropped = await ImageManipulator.manipulate(uri).crop(rect).renderAsync();
  const result = await cropped.saveAsync({ compress: 0.9 });
  return result.uri;
}

export default function Capture() {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<CameraRef>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // The crop runs in the background after the raw photo is already shown, so the
  // preview screen appears as soon as capture+save finish. Confirm always awaits
  // this so the file that gets saved is never the uncropped raw photo, regardless
  // of how fast the user taps.
  const cropPromiseRef = useRef<Promise<string> | null>(null);
  const [capturing, setCapturing] = useState(false);
  // Left undefined until the user actually toggles torch, same reason as `zoom`
  // below - the native controller exists slightly before the session is
  // "active" and rejects a torchMode set that early.
  const [torchMode, setTorchMode] = useState<'on' | 'off' | undefined>(undefined);
  const torchOn = torchMode === 'on';
  const [facing, setFacing] = useState<TargetCameraPosition>('back');
  const device = useCameraDevice(facing);
  // Default target (UHD_4_3, ~12MP) is far more than a phone-screen photo needs and
  // dominates capture+crop latency; FHD_4_3 is still well above every display size in
  // this app (grid tiles, full viewer) and cuts pixel count (and time) by ~4.4x.
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.FHD_4_3,
    // Resolution isn't the only cost - 'balanced' (the default) also spends time on
    // multi-frame/multi-lens fusion for quality this app's downscaled output won't
    // show anyway. 'speed' skips that, trading it for lower capture latency.
    qualityPrioritization: device?.supportsSpeedQualityPrioritization ? 'speed' : 'balanced',
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saving = saveStatus !== 'idle';
  const [saveError, setSaveError] = useState<string | null>(null);
  const shutterScale = useSharedValue(1);
  const shutterStyle = useAnimatedStyle(() => ({ transform: [{ scale: shutterScale.value }] }));

  const canFocus = device?.supportsFocusMetering ?? false;
  const focusRingX = useSharedValue(0);
  const focusRingY = useSharedValue(0);
  const focusRingOpacity = useSharedValue(0);
  const focusRingStyle = useAnimatedStyle(() => ({
    opacity: focusRingOpacity.value,
    transform: [
      { translateX: focusRingX.value - FOCUS_RING_SIZE / 2 },
      { translateY: focusRingY.value - FOCUS_RING_SIZE / 2 },
    ],
  }));

  function focusAt(point: { x: number; y: number }) {
    cameraRef.current?.focusTo(point).catch((error) => console.warn('[capture] focusTo failed', error));
  }

  const tapGesture = Gesture.Tap()
    .enabled(canFocus)
    .onEnd((event) => {
      focusRingX.value = event.x;
      focusRingY.value = event.y;
      focusRingOpacity.value = withSequence(withTiming(1, { duration: 100 }), withDelay(500, withTiming(0, { duration: 200 })));
      runOnJS(focusAt)({ x: event.x, y: event.y });
    });

  const minZoom = device?.minZoom ?? 1;
  const maxZoom = device?.maxZoom ?? 1;
  // Left undefined until the user actually pinches, so we never call setZoom(1)
  // (a no-op value) while the camera session is still starting up - the native
  // controller exists slightly before the session is "active" and rejects it.
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const zoomAtPinchStart = useSharedValue(1);
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      zoomAtPinchStart.value = zoom ?? 1;
    })
    .onUpdate((event) => {
      const next = Math.min(maxZoom, Math.max(minZoom, zoomAtPinchStart.value * event.scale));
      runOnJS(setZoom)(next);
    });

  const viewfinderGesture = Gesture.Race(tapGesture, pinchGesture);

  function flipCamera() {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
    setTorchMode(undefined); // front camera has no flash hardware on most phones
    setZoom(undefined);
  }

  async function shoot() {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const t0 = Date.now();
    try {
      const photo = await photoOutput.capturePhoto({ enableVirtualDeviceFusion: false }, {});
      const t1 = Date.now();
      // `photo.width`/`height` are sensor-native (pre-rotation) - the saved file is
      // EXIF-rotated, so swap them to match whenever that rotation is 90/270.
      const rotated = photo.orientation === 'left' || photo.orientation === 'right';
      const width = rotated ? photo.height : photo.width;
      const height = rotated ? photo.width : photo.height;
      const path = await photo.saveToTemporaryFileAsync();
      const t2 = Date.now();
      photo.dispose();
      const rawUri = `file://${path}`;
      // Show the raw (uncropped) photo right away so the preview screen appears
      // as soon as capture+save finish, instead of also waiting on the crop.
      setPreview(rawUri);
      setCapturing(false);
      console.log(`[capture] timing to preview: capturePhoto=${t1 - t0}ms saveToTemporaryFileAsync=${t2 - t1}ms`);
      const cropPromise = cropToCaptureRatio(rawUri, width, height);
      cropPromiseRef.current = cropPromise;
      cropPromise
        .then((cropped) => {
          console.log(`[capture] timing: crop=${Date.now() - t2}ms total=${Date.now() - t0}ms`);
          // Only swap the displayed preview if the user hasn't already retaken/left -
          // otherwise this would resurrect the old photo over whatever's on screen now.
          if (cropPromiseRef.current === cropPromise) setPreview(cropped);
        })
        .catch((error) => console.warn('[capture] crop failed', error));
    } catch (error) {
      console.warn('[capture] capturePhoto failed', error);
      setCapturing(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setSaveStatus('saving');
    setSaveError(null);
    const start = Date.now();
    // The crop may still be running in the background (see `shoot`) - always save
    // the cropped result, never the raw photo, regardless of how fast this fires.
    const finalUri = cropPromiseRef.current ? await cropPromiseRef.current : preview;
    const { error } = await enqueueCapture(finalUri);
    if (error) {
      setSaveStatus('idle');
      setSaveError("Couldn't save that photo. Try again.");
      return;
    }
    const remaining = MIN_SAVING_MS - (Date.now() - start);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    setSaveStatus('saved');
    await new Promise((resolve) => setTimeout(resolve, SAVED_DISPLAY_MS));
    router.dismissTo({ pathname: '/(tabs)/today', params: { justCaptured: '1', localPreviewUri: finalUri } });
  }

  if (!hasPermission) {
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
            {canRequestPermission ? (
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
                    <Button
                      label="Retake"
                      variant="secondary"
                      onPress={() => {
                        cropPromiseRef.current = null;
                        setPreview(null);
                      }}
                      disabled={saving}
                    />
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
    <GestureHandlerRootView style={styles.fill}>
      <View style={styles.viewfinderContainer}>
        <GestureDetector gesture={viewfinderGesture}>
          <View style={styles.viewfinder}>
            {device ? (
              <Camera
                ref={cameraRef}
                style={styles.fill}
                device={device}
                isActive
                outputs={[photoOutput]}
                torchMode={torchMode}
                zoom={zoom}
                // Default 'performance' mode (SurfaceView) doesn't support the focus-ring
                // overlay layered on top of this view below - that mismatch is what caused
                // the stutter while panning. 'compatible' (TextureView) supports layering.
                implementationMode="compatible"
              />
            ) : null}
            <Animated.View pointerEvents="none" style={[styles.focusRing, focusRingStyle]} />
          </View>
        </GestureDetector>
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
            {device?.hasTorch ? (
              <Pressable
                hitSlop={touchTarget.min}
                onPress={() => setTorchMode(torchOn ? 'off' : 'on')}
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
    </GestureHandlerRootView>
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
  focusRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FOCUS_RING_SIZE,
    height: FOCUS_RING_SIZE,
    borderRadius: FOCUS_RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
});
