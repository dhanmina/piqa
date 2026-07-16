import * as Haptics from 'expo-haptics';
import { Aperture } from 'lucide-react-native';
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
 *
 * The shutter is an ACTION, never a status: it always shows a camera, and its
 * only variable is urgency. Brightness means "a daily is waiting for you".
 *  live: safelight fill + pulsing ring, ink aperture → shoot your daily now.
 *  done / default: calm ink2 camera, no ring → daily's in (or no drop is live),
 *    but the camera never closes, so it still opens a practice shot. No check —
 *    "today's shot is in" is status, and it lives on Today, not on a nav button.
 */
export function Shutter({ state, onPress }: ShutterProps) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const isLive = state === 'live';

  useEffect(() => {
    if (isLive && !reducedMotion) {
      pulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
        -1,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [isLive, reducedMotion, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
    transform: [{ scale: 1 + pulse.value * 0.07 }],
  }));

  return (
    <View style={styles.slot}>
      {isLive && <Animated.View style={[styles.ring, ringStyle]} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isLive
            ? "Shoot today's photo"
            : state === 'done'
              ? "Open camera for a practice shot. Today's shot is already in."
              : 'Open camera'
        }
        onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        onPress={onPress}
        style={({ pressed }) => [
          styles.circle,
          isLive ? styles.circleLive : styles.circleCalm,
          pressed && { transform: [{ scale: motion.pressScale }] },
        ]}
      >
        <Aperture size={28} strokeWidth={icons.strokeWidth} color={isLive ? colors.ink : colors.paper} />
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
  // Loud: a daily is waiting.
  circleLive: {
    backgroundColor: colors.safelight,
  },
  // Calm: daily handled or no live drop — still a camera, just quiet.
  circleCalm: {
    backgroundColor: colors.ink2,
    borderWidth: 1.5,
    borderColor: colors.paper30,
  },
});
