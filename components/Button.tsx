import { useState } from 'react';
import { Text, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, spacing, radius, type, height } from '../lib/theme';

const PRESS_SPRING = { damping: 18, stiffness: 400 };

export function Button({
  label,
  loadingLabel,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  loadingLabel?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function onPressIn() {
    if (isDisabled) return;
    setPressed(true);
    scale.value = withSpring(0.97, PRESS_SPRING);
  }
  function onPressOut() {
    setPressed(false);
    scale.value = withSpring(1, PRESS_SPRING);
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={isDisabled}>
      <Animated.View
        style={[
          isPrimary
            ? {
                backgroundColor: isDisabled ? colors.border : pressed ? colors.accentPressed : colors.accent,
                minHeight: height.control,
                justifyContent: 'center',
                paddingHorizontal: spacing.lg,
                borderRadius: radius.button,
                alignItems: 'center',
              }
            : {
                backgroundColor: pressed ? colors.border : 'transparent',
                borderColor: colors.border,
                borderWidth: 1,
                minHeight: height.control,
                justifyContent: 'center',
                paddingHorizontal: spacing.lg,
                borderRadius: radius.button,
                alignItems: 'center',
              },
          scaleStyle,
        ]}
      >
        <Text
          style={{
            ...type.bodyBold,
            color: isPrimary ? (isDisabled ? colors.textMuted : colors.background) : colors.textPrimary,
          }}
        >
          {loading && loadingLabel ? loadingLabel : label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
