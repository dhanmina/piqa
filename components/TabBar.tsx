import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { HomeIcon, PeopleIcon, TimelineIcon } from './NavIcons';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

type IconComponent = ComponentType<{ size: number; color: string }>;

const PRESS_SPRING = { damping: 18, stiffness: 400 };
export const BAR_HEIGHT = 72;

// expo-router's bottom-tabs lays the tab bar out as a normal flex sibling
// below the screen content by default — the screen's own flex:1 area stops
// exactly above it, a hard cut, not a float. Each tab screen's scrollable
// content needs this much extra bottom clearance (on top of whatever its own
// SafeAreaView already reserves for the device inset) so real content never
// sits permanently under the pill once the bar is pulled out of that flow.
export const TAB_BAR_CLEARANCE = BAR_HEIGHT + spacing.lg;

// Exact icon shapes chosen by the user (see components/NavIcons.tsx) — solid,
// chunky, rounded Font Awesome-style glyphs, drawn via react-native-svg for
// pixel fidelity rather than a same-name font glyph from a different family.
// One shape per icon (no separate outline/filled pair) — focused vs.
// unfocused reads through color plus the baseline tick below, not a shape swap.
const TABS: Record<string, { label: string; Icon: IconComponent }> = {
  today: { label: 'Today', Icon: HomeIcon },
  timeline: { label: 'Timeline', Icon: TimelineIcon },
  buddies: { label: 'Buddies', Icon: PeopleIcon },
};

export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  function pressRoute(routeKey: string, routeName: string, isFocused: boolean) {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  }

  return (
    // position: absolute pulls this out of expo-router's default flex layout
    // (screen content above, tab bar row below) — without it, the screen's
    // flex:1 area stops exactly above this component and nothing ever shows
    // through the gaps around the pill, which isn't floating, just a second
    // reserved row. Floating over real content instead of a flat color.
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: spacing.md,
        paddingBottom: insets.bottom + spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          // surfaceRaised, not surface: a drop shadow barely reads against a
          // near-black ground (this is exactly why Material's dark theme
          // convention leans on tonal elevation instead — a lighter surface
          // step reads as "closer to the viewer" even where a shadow washes
          // out). surface (#161616) sat too close to the screen's own
          // background (#0A0A0A) to separate as a distinct floating layer.
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.button,
          height: BAR_HEIGHT,
          paddingHorizontal: spacing.sm,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        {state.routes.map((route, index) => {
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
            paddingVertical: spacing.sm,
          },
          scaleStyle,
        ]}
      >
        <Icon size={26} color={focused ? colors.textPrimary : colors.textMuted} />
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
