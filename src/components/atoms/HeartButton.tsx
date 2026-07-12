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
};

/**
 * Outline → #E6453C fill with a 1.1 spring + haptic. No +1 floats.
 * TODO(brand): replace with custom asymmetric heart SVG — one of the 3 identity
 * icons (heart/flame/crown), stroke weight matched to Lucide 2.25.
 * (Glyph lives in HeartGlyph.tsx; tracked in TODO.md.)
 */
export function HeartButton({ liked, count, onToggle, onCountPress, size = 24, disabled = false }: HeartButtonProps) {
  const scale = useSharedValue(1);

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
          color={disabled ? colors.paper30 : liked ? colors.heart : colors.paper60}
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
            <Mono size={typeScale.caption} color={disabled ? colors.paper30 : colors.paper60}>
              {count}
            </Mono>
          </Pressable>
        ) : (
          <View>
            <Mono size={typeScale.caption} color={disabled ? colors.paper30 : colors.paper60}>
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
