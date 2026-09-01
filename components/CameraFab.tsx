import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { CameraIcon } from './NavIcons';
import { BAR_HEIGHT, FAB_GAP_ABOVE_BAR, FAB_SIZE } from './TabBar';
import { colors, spacing } from '../lib/theme';

const PRESS_SPRING = { damping: 18, stiffness: 400 };

// Standalone floating capture button, not part of the tab bar or its route
// list. No FAB-as-fake-tab interception hack -- this is just a button that
// pushes /capture, rendered as its own layer above the Tabs navigator.
export function CameraFab() {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => router.push('/capture')}
      onPressIn={() => (scale.value = withSpring(0.92, PRESS_SPRING))}
      onPressOut={() => (scale.value = withSpring(1, PRESS_SPRING))}
      accessibilityRole="button"
      accessibilityLabel="Capture a photo"
      style={{
        position: 'absolute',
        right: spacing.lg,
        bottom: insets.bottom + spacing.sm + BAR_HEIGHT + FAB_GAP_ABOVE_BAR,
      }}
    >
      <Animated.View
        style={[
          {
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_SIZE / 2,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          },
          scaleStyle,
        ]}
      >
        <CameraIcon size={31} color={colors.background} />
      </Animated.View>
    </Pressable>
  );
}
