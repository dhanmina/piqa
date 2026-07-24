import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** The heart glyph that blooms at a double-tap and flies into the heart control. */
const FLY_HEART = 64;

/**
 * Encapsulates the "double-tap to like" flying heart animation from
 * PhotoDetailView. The view mounts the heart overlay via `flyHeartStyle` and
 * triggers the animation via `flyTo(startX, startY, targetX, targetY)`.
 *
 * The measurement logic (rootOrigin, heartRef) lives in the view because it
 * needs refs to mounted elements; this hook owns only the animation shared
 * values and the `flyTo` worklet.
 */
export function usePhotoFlyHeart() {
  const flyX = useSharedValue(0);
  const flyY = useSharedValue(0);
  const flyScale = useSharedValue(0);
  const flyOpacity = useSharedValue(0);

  const flyHeartStyle = useAnimatedStyle(() => ({
    opacity: flyOpacity.value,
    transform: [
      { translateX: flyX.value - FLY_HEART / 2 },
      { translateY: flyY.value - FLY_HEART / 2 },
      { scale: flyScale.value },
    ],
  }));

  /** A slow, soft beat: bloom gently at the tap, hold, then glide into the heart. */
  /* eslint-disable react-hooks/immutability -- reanimated shared values are mutable by design */
  const flyTo = (startX: number, startY: number, targetX: number, targetY: number) => {
    flyX.value = startX;
    flyY.value = startY;
    flyScale.value = 0.3;
    const glide = { duration: 620, easing: Easing.inOut(Easing.cubic) };
    flyOpacity.value = withSequence(
      withTiming(1, { duration: 160 }),
      withDelay(320, withTiming(0, { duration: 540 })),
    );
    flyScale.value = withSequence(
      withSpring(1, { damping: 13, stiffness: 130 }),
      withDelay(180, withTiming(0.4, { duration: 620, easing: Easing.in(Easing.cubic) })),
    );
    flyX.value = withDelay(360, withTiming(targetX, glide));
    flyY.value = withDelay(360, withTiming(targetY, glide));
  };
  /* eslint-enable react-hooks/immutability */

  return { flyHeartStyle, flyTo, FLY_HEART };
}
