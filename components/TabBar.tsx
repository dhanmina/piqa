import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { CameraIcon, HomeIcon, PeopleIcon, PersonIcon, TimelineIcon } from './NavIcons';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

type IconComponent = ComponentType<{ size: number; color: string }>;

const PRESS_SPRING = { damping: 18, stiffness: 400 };
const CAMERA_ROUTE = 'camera-action';
const FAB_SIZE = 52;
const BAR_HEIGHT = 60;

// Exact icon shapes chosen by the user (see components/NavIcons.tsx) — solid,
// chunky, rounded Font Awesome-style glyphs, drawn via react-native-svg for
// pixel fidelity rather than a same-name font glyph from a different family.
// One shape per icon (no separate outline/filled pair) — focused vs.
// unfocused reads through color plus the baseline tick below, not a shape swap.
const TABS: Record<string, { label: string; Icon: IconComponent }> = {
  today: { label: 'Today', Icon: HomeIcon },
  timeline: { label: 'Timeline', Icon: TimelineIcon },
  buddies: { label: 'Buddies', Icon: PeopleIcon },
  profile: { label: 'Profile', Icon: PersonIcon },
};

export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  function pressRoute(routeKey: string, routeName: string, isFocused: boolean) {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  }

  const cameraRoute = state.routes.find((route) => route.name === CAMERA_ROUTE);

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.sm }}>
      <View style={{ position: 'relative' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.button,
            height: BAR_HEIGHT,
            paddingHorizontal: spacing.xs,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {state.routes.map((route, index) => {
            if (route.name === CAMERA_ROUTE) {
              return <View key={route.key} style={{ flex: 1 }} />;
            }
            const config = TABS[route.name];
            if (!config) return null;
            const isFocused = state.index === index;
            return (
              <TabItem
                key={route.key}
                focused={isFocused}
                label={config.label}
                Icon={config.Icon}
                onPress={() => pressRoute(route.key, route.name, isFocused)}
              />
            );
          })}
        </View>

        {cameraRoute ? (
          <CameraTabButton
            onPress={() =>
              pressRoute(cameraRoute.key, cameraRoute.name, state.routes[state.index].key === cameraRoute.key)
            }
          />
        ) : null}
      </View>
    </View>
  );
}

function TabItem({
  focused,
  label,
  Icon,
  onPress,
}: {
  focused: boolean;
  label: string;
  Icon: IconComponent;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.94, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      style={{ flex: 1, alignItems: 'center' }}
    >
      <Animated.View
        style={[
          {
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xxs,
            minWidth: touchTarget.min,
            minHeight: touchTarget.min,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
          },
          scaleStyle,
        ]}
      >
        <Icon size={20} color={focused ? colors.textPrimary : colors.textMuted} />
        <Text style={{ ...type.caption, fontSize: 11, color: focused ? colors.textPrimary : colors.textMuted }}>
          {label}
        </Text>
        {/* Baseline tick, not a filled pill — same axis-mark language as the streak trace. */}
        <View
          style={{
            width: 14,
            height: 2,
            borderRadius: 1,
            marginTop: 1,
            backgroundColor: focused ? colors.trace : 'transparent',
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

function CameraTabButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.92, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      style={{ position: 'absolute', top: -FAB_SIZE / 2 + 6, alignSelf: 'center' }}
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
        <CameraIcon size={21} color={colors.background} />
      </Animated.View>
    </Pressable>
  );
}
