import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { colors, fonts, motion, radius, space, typeScale } from '@/components/tokens';

type ToastProps = {
  message: string;
  visible: boolean;
  onHide: () => void;
  /** Distance from the bottom — sits above the nav bar. */
  bottom?: number;
};

// Keeps the Modal mounted for exactly this long after `visible` flips off, so
// the exit animation below gets to finish before the native Modal (and its
// back-button interception) actually goes away.
const EXIT_MS = 170;

/**
 * A single-line past-tense fact ("Shot saved — uploading"), 2s, never stacks.
 * The leading safelight dot is the darkroom's active light — the signature that
 * marks this as Piqa, not a generic toast. Rises in / falls out on the app's
 * motion scale; a hairline lifts it off ink. Rendering is the caller's job.
 *
 * Wrapped in its own transparent Modal -- same reason `Sheet` uses one: a
 * Modal always renders in its own native layer above regular content, so
 * this is the only way the toast reliably shows on top of an open Sheet
 * (a plain absolute-positioned View sits underneath any Modal, invisible,
 * even though it's technically "showing"). The Modal's own `visible` tracks
 * the toast's `visible` (with a short trailing delay for the exit fade), not
 * hardcoded true -- Android's Modal swallows the hardware back button via
 * onRequestClose while visible, so a permanently-mounted one would silently
 * break back navigation on every screen that has ever shown a toast.
 */
export function Toast({ message, visible, onHide, bottom = 96 }: ToastProps) {
  const [modalVisible, setModalVisible] = useState(visible);
  // Mount synchronously the moment `visible` turns on -- React's own
  // "adjust state while rendering" pattern, not an effect, so the Modal is
  // already there for the entering animation's first frame instead of one
  // render behind it.
  if (visible && !modalVisible) setModalVisible(true);

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(onHide, motion.toastMs);
    return () => clearTimeout(id);
  }, [visible, onHide]);

  useEffect(() => {
    if (visible) return;
    const id = setTimeout(() => setModalVisible(false), EXIT_MS);
    return () => clearTimeout(id);
  }, [visible]);

  if (!modalVisible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onHide}>
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
    </Modal>
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
