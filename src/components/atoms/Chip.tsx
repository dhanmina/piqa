import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, motion, radius, typeScale } from '@/components/tokens';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

/** Selected = inverted paper/ink — never colored (the accent belongs to actions). */
export function Chip({ label, selected = false, onPress, disabled = false }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && !disabled && { transform: [{ scale: motion.pressScale }] },
      ]}
    >
      <Text
        style={[
          styles.label,
          selected ? styles.labelSelected : styles.labelUnselected,
          disabled && styles.labelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  selected: {
    backgroundColor: colors.paper,
  },
  unselected: {
    backgroundColor: colors.ink2,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.caption,
  },
  labelSelected: {
    color: colors.ink,
  },
  labelUnselected: {
    color: colors.paper60,
  },
  labelDisabled: {
    color: colors.paper30,
  },
});
