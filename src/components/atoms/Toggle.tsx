import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, icons, motion, radius, typeScale } from '@/components/tokens';

type ToggleProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

/**
 * Labeled on/off row with a square check well ("submit as Today's Shot").
 * On = safelight well (it's an action-adjacent state), off = ink2 outline.
 */
export function Toggle({ label, value, onChange, disabled = false }: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(!value);
      }}
      style={({ pressed }) => [styles.row, pressed && !disabled && { transform: [{ scale: motion.pressScale }] }]}
    >
      <View style={[styles.well, value ? styles.wellOn : styles.wellOff, disabled && styles.wellDisabled]}>
        {value ? <Check size={14} strokeWidth={icons.strokeWidth} color={colors.ink} /> : null}
      </View>
      <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 36,
  },
  well: {
    width: 22,
    height: 22,
    borderRadius: radius.card / 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wellOn: {
    backgroundColor: colors.safelight,
  },
  wellOff: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.paper40,
  },
  wellDisabled: {
    borderColor: colors.paper30,
    backgroundColor: colors.ink2,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.sub,
    color: colors.paper,
  },
  labelDisabled: {
    color: colors.paper30,
  },
});
