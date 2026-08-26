import { useRef, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { enqueueCapture } from '../lib/captureQueue';
import { Button } from '../components/Button';
import { colors, spacing, radius, type, touchTarget } from '../lib/theme';

const PRESS_SPRING = { damping: 18, stiffness: 400 };
const SHUTTER_SIZE = 72;

export default function Capture() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shutterScale = useSharedValue(1);
  const shutterStyle = useAnimatedStyle(() => ({ transform: [{ scale: shutterScale.value }] }));

  async function shoot() {
    const photo = await cameraRef.current?.takePictureAsync();
    if (photo) setPreview(photo.uri);
  }

  async function confirm() {
    if (!preview) return;
    setSaving(true);
    await enqueueCapture(preview);
    router.replace('/(tabs)/today');
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
        <Image source={{ uri: preview }} style={styles.fill} resizeMode="cover" />
        <SafeAreaView style={styles.previewActions}>
          <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <Button label="Retake" variant="secondary" onPress={() => setPreview(null)} disabled={saving} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Confirm" loadingLabel="Saving…" loading={saving} onPress={confirm} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView ref={cameraRef} style={styles.fill} />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Pressable
          hitSlop={touchTarget.min}
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Text style={{ ...type.title, color: colors.textPrimary }}>✕</Text>
        </Pressable>
        <View style={styles.shutterRow}>
          <Pressable
            onPress={shoot}
            onPressIn={() => (shutterScale.value = withSpring(0.9, PRESS_SPRING))}
            onPressOut={() => (shutterScale.value = withSpring(1, PRESS_SPRING))}
          >
            <Animated.View style={[styles.shutter, shutterStyle]} />
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
  previewActions: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: spacing.md },
});
