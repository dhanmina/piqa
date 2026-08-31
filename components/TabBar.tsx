import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { colors, spacing, touchTarget, type } from '../lib/theme';

type SymbolName = NonNullable<SymbolViewProps['name']>;

const PRESS_SPRING = { damping: 18, stiffness: 400 };
const CAMERA_ROUTE = 'camera-action';
const FAB_SIZE = 56;

// Native icon system per platform (SF Symbols on iOS, Material Symbols on
// Android) instead of a generic vector-icon font, so the icons look correct
// on iOS once that platform ships.
const TABS: Record<string, { label: string; icon: SymbolName; iconFocused: SymbolName }> = {
  today: {
    label: 'Today',
    icon: { ios: 'house', android: 'home' },
    iconFocused: { ios: 'house.fill', android: 'home_filled' },
  },
  timeline: {
    label: 'Timeline',
    icon: { ios: 'calendar', android: 'calendar_month' },
    iconFocused: { ios: 'calendar', android: 'calendar_month' },
  },
  buddies: {
    label: 'Buddies',
    icon: { ios: 'person.2', android: 'group' },
    iconFocused: { ios: 'person.2.fill', android: 'group' },
  },
  profile: {
    label: 'Profile',
    icon: { ios: 'person.crop.circle', android: 'account_circle' },
    iconFocused: { ios: 'person.crop.circle.fill', android: 'account_circle' },
  },
};

const CAMERA_ICON: SymbolName = { ios: 'camera.fill', android: 'camera' };

export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  function pressRoute(routeKey: string, routeName: string, isFocused: boolean) {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  }

  const cameraRoute = state.routes.find((route) => route.name === CAMERA_ROUTE);

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xs,
          paddingHorizontal: spacing.xs,
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
              icon={isFocused ? config.iconFocused : config.icon}
              onPress={() => pressRoute(route.key, route.name, isFocused)}
            />
          );
        })}
      </View>

      {cameraRoute ? (
        <CameraTabButton
          onPress={() => pressRoute(cameraRoute.key, cameraRoute.name, state.routes[state.index].key === cameraRoute.key)}
        />
      ) : null}
    </View>
  );
}

function TabItem({
  focused,
  label,
  icon,
  onPress,
}: {
  focused: boolean;
  label: string;
  icon: SymbolName;
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
        <SymbolView
          name={icon}
          size={22}
          tintColor={focused ? colors.textPrimary : colors.textMuted}
        />
        <Text style={{ ...type.caption, color: focused ? colors.textPrimary : colors.textMuted }}>{label}</Text>
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
      style={{ position: 'absolute', top: -FAB_SIZE / 2, alignSelf: 'center' }}
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
        <SymbolView name={CAMERA_ICON} size={26} tintColor={colors.background} />
      </Animated.View>
    </Pressable>
  );
}
