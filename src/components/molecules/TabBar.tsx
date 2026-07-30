import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { House, Image as ImageIcon, User, Users, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPendingItemForDrop, subscribeQueue } from '@lib/services/captureQueue';
import { isResultSeen, isRevealSeen } from '@lib/services/gallery';
import { useHomeState } from '@lib/homeState';
import { Shutter, type ShutterState } from '@/components/moments/Shutter';
import { colors, fonts, iconStroke, typeScale } from '@/components/tokens';

const TAB_META: Record<string, { label: string; icon: LucideIcon }> = {
  today: { label: 'Today', icon: House },
  gallery: { label: 'Gallery', icon: ImageIcon },
  studios: { label: 'Studios', icon: Users },
  profile: { label: 'Profile', icon: User },
};

/**
 * 4 tabs + raised center shutter (spec §11, updated 2026-07-29 IA review):
 * Today · Gallery · [shutter] · Studios · Profile. Archive relocated into a
 * Profile segment — solo/private, doesn't need top-level real estate the way
 * a friends feature does. Bar is ink so photos above it stay the brightest
 * element. No search tab, no curate tab — deliberate.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data } = useHomeState();
  const [queueTick, setQueueTick] = useState(0);
  // The drop we've locally submitted a daily for. Holds the aperture on 'done'
  // across the handoff gap: once a shot uploads, its queue item is removed, but
  // the server submission may not be fetched yet — without this, hasSubmitted
  // briefly drops and the aperture flicks back to 'live'/'default'.
  const [submittedDropId, setSubmittedDropId] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeQueue((event) => {
        setQueueTick((t) => t + 1);
        if (event.type === 'saved' && event.item.kind === 'daily' && event.item.dropId) {
          setSubmittedDropId(event.item.dropId);
        }
      }),
    [],
  );

  const drop = data?.drop ?? null;
  // A shot sitting in the queue (or just uploaded) counts as submitted — calm, not nagging.
  void queueTick;
  const pendingDaily = drop ? getPendingItemForDrop(drop.id) : undefined;
  const hasSubmitted =
    Boolean(data?.submission) || Boolean(pendingDaily) || (!!drop && submittedDropId === drop.id);

  // Two dots, two meanings: Today = "your result is in", Gallery = "the reveal is
  // waiting". Re-read on every tab change so a dot clears once its screen is read.
  const lastResultDrop = data?.last_result?.drop_id ?? null;
  const [resultUnseen, setResultUnseen] = useState(false);
  const [revealUnseen, setRevealUnseen] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!lastResultDrop) {
      setResultUnseen(false);
      setRevealUnseen(false);
      return;
    }
    void isResultSeen(lastResultDrop).then((seen) => {
      if (alive) setResultUnseen(!seen);
    });
    void isRevealSeen(lastResultDrop).then((seen) => {
      if (alive) setRevealUnseen(!seen);
    });
    return () => {
      alive = false;
    };
  }, [lastResultDrop, state.index]);

  const shutterState: ShutterState = drop?.is_live
    ? hasSubmitted
      ? 'done'
      : 'live'
    : 'default';
  const badges: Record<string, boolean> = {
    today: (Boolean(drop?.is_live) && !hasSubmitted) || resultUnseen,
    gallery: revealUnseen,
  };

  const renderTab = (name: string) => {
    const routeIndex = state.routes.findIndex((r) => r.name === name);
    const route = state.routes[routeIndex];
    if (!route) return <View key={name} style={styles.tab} />;
    const meta = TAB_META[name];
    const active = state.index === routeIndex;
    const Icon = meta.icon;
    // Inactive nav is paper60, not paper40: at 40% the glyph sat at 3.45:1 on ink
    // — only just over the 3:1 non-text floor, no margin, and thin 2px strokes read
    // fainter than the ratio implies. paper60 is 6.3:1 and matches the gallery
    // sub-tabs (which already use it). Active still reads instantly — a different
    // hue (safelight) with a bolder label.
    const color = active ? colors.safelight : colors.paper60;

    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => navigation.navigate(route.name)}
        style={styles.tab}
      >
        <View>
          <Icon size={24} strokeWidth={iconStroke(24)} color={color} />
          {/* Never badge the tab you're already on — a dot means "unread", and you're
              reading it. This also keeps the nudge honest as each screen marks itself seen. */}
          {badges[name] && !active && <View style={styles.badge} />}
        </View>
        <Text
          style={[
            styles.label,
            { color: active ? colors.paper : colors.paper60 },
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
      <Shutter
        state={shutterState}
        onPress={() =>
          // Daily's in → any further shot is practice; be explicit so a still-
          // pending upload can never be mistaken for a second daily submission.
          router.push(shutterState === 'done' ? { pathname: '/camera', params: { practice: '1' } } : '/camera')
        }
      />
      {renderTab('studios')}
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
