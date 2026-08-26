import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const PRESS_SPRING = { damping: 18, stiffness: 400 };
const CAMERA_ROUTE = 'camera-action';
const FAB_SIZE = 56;

const TABS: Record<string, { label: string; icon: IconName; iconOutline: IconName }> = {
  today: { label: 'Today', icon: 'home', iconOutline: 'home-outline' },
  timeline: { label: 'Timeline', icon: 'calendar', iconOutline: 'calendar-outline' },
  buddies: { label: 'Buddies', icon: 'account-group', iconOutline: 'account-group-outline' },
  profile: { label: 'Profile', icon: 'account-circle', iconOutline: 'account-circle-outline' },
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
              icon={isFocused ? config.icon : config.iconOutline}
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
  icon: IconName;
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
            borderRadius: radius.button,
            backgroundColor: focused ? colors.surfaceRaised : 'transparent',
          },
          scaleStyle,
        ]}
      >
        <MaterialCommunityIcons name={icon} size={22} color={focused ? colors.textPrimary : colors.textMuted} />
        <Text style={{ ...type.caption, color: focused ? colors.textPrimary : colors.textMuted }}>{label}</Text>
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
        <MaterialCommunityIcons name="camera" size={26} color={colors.background} />
      </Animated.View>
    </Pressable>
  );
}
