import { useState } from 'react';
import { Text, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, spacing, radius, type, touchTarget } from '../lib/theme';

const PRESS_SPRING = { damping: 18, stiffness: 400 };

export function SelectableRow({ label, onPress }: { label: string; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function onPressIn() {
    setPressed(true);
    scale.value = withSpring(0.97, PRESS_SPRING);
  }
  function onPressOut() {
    setPressed(false);
    scale.value = withSpring(1, PRESS_SPRING);
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={{ alignSelf: 'center' }}>
      <Animated.View
        style={[
          {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? colors.pressedOverlay : colors.surface,
            borderRadius: radius.button,
            borderWidth: 1,
            borderColor: pressed ? colors.textMuted : colors.border,
            minHeight: touchTarget.min,
            paddingHorizontal: spacing.lg,
          },
          scaleStyle,
        ]}
      >
        <Text style={{ ...type.body, color: colors.textPrimary }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}
