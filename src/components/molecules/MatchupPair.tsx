import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Mono } from '@/components/atoms/Mono';
import { colors, fonts, typeScale } from '@/components/tokens';

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
 * The most disciplined screen in the app: two photos, a hairline divider,
 * nothing else. Blind = frameless — no brackets, no names, no hearts.
 * Tap the photo itself to pick: paper flash + haptic.
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

      <View style={styles.footer}>
        <View style={styles.dots}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.dot, i < index ? styles.dotDone : styles.dotPending]} />
          ))}
        </View>
        <Mono size={typeScale.caption} color={colors.paper60}>
          {index}/{total}
        </Mono>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onSkip}>
          <Text style={styles.skip}>skip</Text>
        </Pressable>
      </View>
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotDone: {
    backgroundColor: colors.paper,
  },
  dotPending: {
    backgroundColor: colors.paper30,
  },
  skip: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
});
