import { useRef, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { enqueueCapture } from '../lib/captureQueue';
import { Button } from '../components/Button';
import { FieldError } from '../components/FieldError';
import { colors, spacing, radius, type, touchTarget } from '../lib/theme';

const PRESS_SPRING = { damping: 18, stiffness: 400 };
const SHUTTER_SIZE = 72;
const TORCH_ON_ICON = { ios: 'bolt.fill', android: 'flash_on' } as const;
const TORCH_OFF_ICON = { ios: 'bolt.slash.fill', android: 'flash_off' } as const;

export default function Capture() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const shutterScale = useSharedValue(1);
  const shutterStyle = useAnimatedStyle(() => ({ transform: [{ scale: shutterScale.value }] }));

  async function shoot() {
    if (capturing) return;
    setCapturing(true);
    const photo = await cameraRef.current?.takePictureAsync();
    setCapturing(false);
    if (photo) setPreview(photo.uri);
  }

  async function confirm() {
    if (!preview) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await enqueueCapture(preview);
    setSaving(false);
    if (error) {
      setSaveError("Couldn't save that photo. Try again.");
      return;
    }
    router.dismissTo('/(tabs)/today');
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
        <Image
          source={{ uri: preview }}
          style={styles.fill}
          resizeMode="cover"
          accessibilityLabel="Photo you just captured"
        />
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
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
          <View style={styles.previewScrim}>
            <View style={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
              <FieldError message={saveError} />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button label="Retake" variant="secondary" onPress={() => setPreview(null)} disabled={saving} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Confirm" loadingLabel="Saving…" loading={saving} onPress={confirm} />
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
      <CameraView ref={cameraRef} style={styles.fill} enableTorch={torchOn} />
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
