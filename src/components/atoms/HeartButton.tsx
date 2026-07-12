import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { HeartGlyph } from '@/components/atoms/HeartGlyph';
import { Mono } from '@/components/atoms/Mono';
import { colors, motion, typeScale } from '@/components/tokens';

type HeartButtonProps = {
  liked: boolean;
  count?: number;
  onToggle?: () => void;
  /** Tapping the count (not the heart) opens the signed-reactor list (spec §8). */
  onCountPress?: () => void;
  size?: number;
  disabled?: boolean;
  /** Over a photo: wrap in a scrim pill + full-contrast glyph so it never washes
   *  out against a bright image. */
  onPhoto?: boolean;
};

/**
 * Outline → #E6453C fill with a 1.1 spring + haptic. No +1 floats.
 * TODO(brand): replace with custom asymmetric heart SVG — one of the 3 identity
 * icons (heart/flame/crown), stroke weight matched to Lucide 2.25.
 * (Glyph lives in HeartGlyph.tsx; tracked in TODO.md.)
 */
export function HeartButton({ liked, count, onToggle, onCountPress, size = 24, disabled = false, onPhoto = false }: HeartButtonProps) {
  const scale = useSharedValue(1);
  const restColor = onPhoto ? colors.paper : colors.paper60; // unliked glyph / count
  // Count tracks the glyph so a big heart never gets a tiny number beside it.
  const countSize = size >= 20 ? typeScale.sub : typeScale.caption;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (!liked) {
      scale.value = withSequence(
        withSpring(motion.heartSpring, { damping: 12, stiffness: 400 }),
        withTiming(1, { duration: 120 }),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: liked, disabled }}
      disabled={disabled}
      hitSlop={12}
      onPress={handlePress}
      style={styles.row}
    >
      <Animated.View style={animatedStyle}>
        <HeartGlyph
          size={size}
          color={disabled ? colors.paper30 : liked ? colors.heart : restColor}
          fill={liked && !disabled ? colors.heart : 'transparent'}
        />
      </Animated.View>
      {count !== undefined &&
        (onCountPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See who reacted"
            hitSlop={8}
            onPress={onCountPress}
          >
            <Mono size={countSize} color={disabled ? colors.paper30 : restColor}>
              {count}
            </Mono>
          </Pressable>
        ) : (
          <View>
            <Mono size={countSize} color={disabled ? colors.paper30 : restColor}>
              {count}
            </Mono>
          </View>
        ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
  },
});
