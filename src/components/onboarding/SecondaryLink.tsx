import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, space, typeScale } from '@/components/tokens';

type SecondaryLinkProps = {
  label: string;
  onPress: () => void;
};

/**
 * The quiet second choice under a primary CTA (e.g. "Not now"): plain text at
 * paper40, no button chrome. Deliberately low-weight so it reads as an escape
 * hatch, never a competing action.
 */
export function SecondaryLink({ label, onPress }: SecondaryLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
      style={({ pressed }) => [styles.tap, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tap: {
    minHeight: space.target,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.sub,
    color: colors.paper40,
  },
});
