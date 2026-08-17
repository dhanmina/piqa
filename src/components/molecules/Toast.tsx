import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { colors, fonts, motion, radius, space, typeScale } from '@/components/tokens';

type ToastProps = {
  message: string;
  visible: boolean;
  onHide: () => void;
  /** Distance from the bottom — sits above the nav bar. */
  bottom?: number;
};

/**
 * A single-line past-tense fact ("Shot saved — uploading"), 2s, never stacks.
 * The leading safelight dot is the darkroom's active light — the signature that
 * marks this as Piqa, not a generic toast. Rises in / falls out on the app's
 * motion scale; a hairline lifts it off ink. Rendering is the caller's job.
 */
export function Toast({ message, visible, onHide, bottom = 96 }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(onHide, motion.toastMs);
    return () => clearTimeout(id);
  }, [visible, onHide]);

  // Wrapper stays mounted so reanimated can play the exit as `visible` flips off.
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom }]}>
      {visible && (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(160)}
          style={styles.pill}
        >
          <View style={styles.dot} />
          <Text style={styles.text} numberOfLines={1}>
            {message}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xsPlus,
    backgroundColor: colors.ink2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.paper30,
    paddingLeft: space.smPlus,
    paddingRight: space.mdPlus,
    paddingVertical: space.xsPlus,
    maxWidth: '85%',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.safelight,
  },
  text: {
    flexShrink: 1,
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.caption,
    color: colors.paper,
  },
});
