import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, overlay, radius, space, typeScale } from '@/components/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SCREEN_H = Dimensions.get('window').height;

type SheetProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title?: string;
}>;

/**
 * ALL secondary flows are sheets, never screens: ink2, 24dp top radius.
 *
 * One shared progress value drives both layers so the transition is smooth:
 * the backdrop fades (opacity) while the panel ONLY slides (opaque, no opacity
 * ramp) — a panel that both moves and fades reads as blurry, so it never fades.
 * The modal stays mounted through the close so the panel slides out instead of
 * blinking away. A hairline structures header from content; the foot respects
 * the home-indicator inset.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(0); // 0 = closed (offscreen), 1 = open

  useEffect(() => {
    if (visible) {
      setMounted(true); // animation kicks off from onLayout, once height is known
    } else {
      progress.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, progress]);

  const onLayout = (e: LayoutChangeEvent) => {
    setHeight(e.nativeEvent.layout.height);
    if (visible) progress.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
  };

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * (height || SCREEN_H) }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Scrim fills the whole screen BEHIND the card — no flex seam at the top
          edge, so the dim reads as a single backdrop, not a band above the card. */}
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
        onPress={onClose}
        accessibilityLabel="Close sheet"
      />
      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          onLayout={onLayout}
          style={[styles.sheet, sheetStyle, { paddingBottom: space.gutter * 1.5 + insets.bottom }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
            hitSlop={{ top: space.lg, bottom: space.lg, left: space.lg, right: space.lg }}
            onPress={onClose}
          >
            <View style={styles.grabber} />
          </Pressable>
          {title && (
            <>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <View style={styles.rule} />
            </>
          )}
          <View style={[styles.content, !title && styles.contentNoTitle]}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: overlay.scrim,
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.ink2,
    borderTopLeftRadius: radius.sheetTop,
    borderTopRightRadius: radius.sheetTop,
    paddingHorizontal: space.gutter,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.paper30,
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.paper30,
    marginTop: 12,
  },
  content: {
    gap: 16,
    marginTop: 16,
  },
  contentNoTitle: {
    marginTop: 0,
  },
});
