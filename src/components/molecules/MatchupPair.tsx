import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { colors, fonts, overlay, typeScale } from '@/components/tokens';

type MatchupPairProps = {
  topUri: string;
  bottomUri: string;
  /** 1-based position within the set, e.g. 7 of 10. */
  index: number;
  total: number;
  onPick?: (winner: 'top' | 'bottom') => void;
  onSkip?: () => void;
};

/**
 * The most disciplined screen in the app: two full-bleed photos, a hairline
 * divider, nothing else. Blind = frameless — no brackets, no names, no hearts.
 * Tap the photo itself to pick: paper flash + haptic. Controls float as flat
 * scrim chips so the photos own the whole screen.
 */
export function MatchupPair({ topUri, bottomUri, index, total, onPick, onSkip }: MatchupPairProps) {
  const topFlash = useSharedValue(0);
  const bottomFlash = useSharedValue(0);

  const topFlashStyle = useAnimatedStyle(() => ({ opacity: topFlash.value }));
  const bottomFlashStyle = useAnimatedStyle(() => ({ opacity: bottomFlash.value }));

  const pick = (which: 'top' | 'bottom') => {
    const flash = which === 'top' ? topFlash : bottomFlash;
    flash.value = withSequence(withTiming(0.55, { duration: 60 }), withTiming(0, { duration: 140 }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPick?.(which);
  };

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Pick top photo" style={styles.photo} onPress={() => pick('top')}>
        <Image source={{ uri: topUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, topFlashStyle]} />
      </Pressable>

      <View style={styles.divider} />

      <Pressable accessibilityRole="button" accessibilityLabel="Pick bottom photo" style={styles.photo} onPress={() => pick('bottom')}>
        <Image source={{ uri: bottomUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, bottomFlashStyle]} />
      </Pressable>

      {/* Segmented progress — floats at the top so the photos stay full-bleed. */}
      <View pointerEvents="none" style={styles.progressWrap}>
        <View style={styles.progressPill}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.seg, i < index ? styles.segDone : styles.segPending]} />
          ))}
        </View>
      </View>

      {/* One-time affordance: the interface is blind, so nothing else says the
          photo is the button. Show it only on the first pair. */}
      {index === 1 && (
        <View pointerEvents="none" style={styles.hintWrap}>
          <Text style={styles.hint}>Tap a photo to choose</Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip this pair"
        hitSlop={12}
        style={styles.skipWrap}
        onPress={onSkip}
      >
        <Text style={styles.skip}>skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  photo: {
    flex: 1,
    backgroundColor: colors.ink2,
  },
  flash: {
    backgroundColor: colors.paper,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.paper30,
  },
  progressWrap: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  progressPill: {
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: overlay.chip,
  },
  seg: {
    width: 10,
    height: 4,
    borderRadius: 2,
  },
  segDone: {
    backgroundColor: colors.paper,
  },
  segPending: {
    backgroundColor: colors.paper40,
  },
  hintWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.caption,
    color: colors.paper,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: overlay.chip,
    overflow: 'hidden',
  },
  skipWrap: {
    position: 'absolute',
    top: 10,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: overlay.chip,
  },
  skip: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
});
