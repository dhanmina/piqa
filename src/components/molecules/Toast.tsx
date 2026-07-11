import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, motion, radius, typeScale } from '@/components/tokens';

type ToastProps = {
  message: string;
  visible: boolean;
  onHide: () => void;
  /** Distance from the bottom — sits above the nav bar. */
  bottom?: number;
};

/**
 * A single-line past-tense fact ("Shot saved ✓ — uploading"), 2s, never stacks.
 * Rendering is the caller's job: show one at a time.
 */
export function Toast({ message, visible, onHide, bottom = 96 }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(onHide, motion.toastMs);
    return () => clearTimeout(id);
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom }]}>
      <View style={styles.pill}>
        <Text style={styles.text} numberOfLines={1}>
          {message}
        </Text>
      </View>
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
    backgroundColor: colors.ink2,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxWidth: '85%',
  },
  text: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.caption,
    color: colors.paper,
  },
});
