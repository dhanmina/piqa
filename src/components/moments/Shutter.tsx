import * as Haptics from 'expo-haptics';
import { Aperture, Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, icons, motion, space } from '@/components/tokens';

export type ShutterState = 'live' | 'done' | 'default';

type ShutterProps = {
  state: ShutterState;
  onPress: () => void;
};

/**
 * The logo's dot made tappable — moment #3 of the four allowed animations.
 *  live:    safelight fill + pulsing paper ring → shoot now
 *  done:    rests in ink2 with a check → calm
 *  default: safelight, no ring → free shooting, camera never closes
 */
export function Shutter({ state, onPress }: ShutterProps) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (state === 'live' && !reducedMotion) {
      pulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
        -1,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [state, reducedMotion, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
    transform: [{ scale: 1 + pulse.value * 0.07 }],
  }));

  return (
    <View style={styles.slot}>
      {state === 'live' && <Animated.View style={[styles.ring, ringStyle]} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open camera"
        onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        onPress={onPress}
        style={({ pressed }) => [
          styles.circle,
          state === 'done' ? styles.circleDone : styles.circleDefault,
          pressed && { transform: [{ scale: motion.pressScale }] },
        ]}
      >
        {state === 'done' ? (
          <Check size={26} strokeWidth={icons.strokeWidth} color={colors.paper} />
        ) : (
          <Aperture size={28} strokeWidth={icons.strokeWidth} color={colors.ink} />
        )}
      </Pressable>
    </View>
  );
}

const SIZE = space.shutter; // 60dp
const RING_PAD = 5;

const styles = StyleSheet.create({
  slot: {
    width: SIZE + RING_PAD * 2,
    height: SIZE + RING_PAD * 2,
    marginTop: -(SIZE / 2), // raised above the bar
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: SIZE + RING_PAD * 2,
    height: SIZE + RING_PAD * 2,
    borderRadius: (SIZE + RING_PAD * 2) / 2,
    borderWidth: 2,
    borderColor: colors.paper,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDefault: {
    backgroundColor: colors.safelight,
  },
  circleDone: {
    backgroundColor: colors.ink2,
  },
});
