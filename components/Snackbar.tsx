import { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

// Total time the message stays fully visible before it starts fading out.
export const SNACKBAR_DURATION_MS = 2200;
const FADE_MS = 160;

export function Snackbar({
  message,
  onDismiss,
  bottomOffset = 0,
}: {
  message: string | null;
  onDismiss: () => void;
  bottomOffset?: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (unmountTimer.current) clearTimeout(unmountTimer.current);

    if (message) {
      opacity.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.exp) });
      translateY.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.exp) });
      hideTimer.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: FADE_MS });
        translateY.value = withTiming(8, { duration: FADE_MS });
        unmountTimer.current = setTimeout(onDismiss, FADE_MS);
      }, SNACKBAR_DURATION_MS);
    }

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (unmountTimer.current) clearTimeout(unmountTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          bottom: bottomOffset + spacing.md,
          minHeight: touchTarget.min,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceRaised,
          paddingHorizontal: spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        animatedStyle,
      ]}
    >
      <Text style={{ ...type.body, color: colors.textPrimary }}>{message}</Text>
    </Animated.View>
  );
}
