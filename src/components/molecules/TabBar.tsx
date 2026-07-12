import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BookImage, House, Image as ImageIcon, User, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPendingItemForDrop, subscribeQueue } from '@lib/captureQueue';
import { isRevealSeen } from '@lib/gallery';
import { useHomeState } from '@lib/homeState';
import { Shutter, type ShutterState } from '@/components/moments/Shutter';
import { colors, fonts, icons, typeScale } from '@/components/tokens';

const TAB_META: Record<string, { label: string; icon: LucideIcon }> = {
  today: { label: 'Today', icon: House },
  gallery: { label: 'Gallery', icon: ImageIcon },
  archive: { label: 'Archive', icon: BookImage },
  profile: { label: 'Profile', icon: User },
};

/**
 * 4 tabs + raised center shutter (spec §11). Bar is ink so photos above it
 * stay the brightest element. No search tab, no curate tab — deliberate.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data } = useHomeState();
  const [queueTick, setQueueTick] = useState(0);

  useEffect(() => subscribeQueue(() => setQueueTick((t) => t + 1)), []);

  const drop = data?.drop ?? null;
  // A shot sitting in the queue counts as submitted — calm, not nagging.
  void queueTick;
  const pendingDaily = drop ? getPendingItemForDrop(drop.id) : undefined;
  const hasSubmitted = Boolean(data?.submission) || Boolean(pendingDaily);

  // A revealed result the viewer hasn't opened yet also earns the Today badge.
  const lastResultDrop = data?.last_result?.drop_id ?? null;
  const [resultUnseen, setResultUnseen] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!lastResultDrop) {
      setResultUnseen(false);
      return;
    }
    void isRevealSeen(lastResultDrop).then((seen) => {
      if (alive) setResultUnseen(!seen);
    });
    return () => {
      alive = false;
    };
  }, [lastResultDrop]);

  const shutterState: ShutterState = drop?.is_live
    ? hasSubmitted
      ? 'done'
      : 'live'
    : 'default';
  const todayBadge = (Boolean(drop?.is_live) && !hasSubmitted) || resultUnseen;

  const renderTab = (name: string) => {
    const routeIndex = state.routes.findIndex((r) => r.name === name);
    const route = state.routes[routeIndex];
    if (!route) return <View key={name} style={styles.tab} />;
    const meta = TAB_META[name];
    const active = state.index === routeIndex;
    const Icon = meta.icon;
    const color = active ? colors.safelight : colors.paper40;

    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => navigation.navigate(route.name)}
        style={styles.tab}
      >
        <View>
          <Icon size={24} strokeWidth={icons.strokeWidth} color={color} />
          {name === 'today' && todayBadge && <View style={styles.badge} />}
        </View>
        <Text
          style={[
            styles.label,
            { color: active ? colors.paper : colors.paper40 },
            active && styles.labelActive,
          ]}
        >
          {meta.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {renderTab('today')}
      {renderTab('gallery')}
      <Shutter state={shutterState} onPress={() => router.push('/camera')} />
      {renderTab('archive')}
      {renderTab('profile')}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.ink,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink2,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    minHeight: 56, // 48dp+ target
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: typeScale.tabLabel,
  },
  labelActive: {
    fontFamily: fonts.sansMedium,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.safelight,
  },
});
