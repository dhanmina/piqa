import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, icons, motion, radius, space, typeScale } from '@/components/tokens';

type ToggleProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /**
   * Smaller well + caption label, for a secondary form row (e.g. "Remember me")
   * where the default size reads oversized next to a caption-sized link. The
   * default stays tuned for the prominent "Submit as Today's Shot" decision.
   */
  compact?: boolean;
};

/**
 * Labeled on/off row with a square check well ("submit as Today's Shot").
 * On = safelight well (it's an action-adjacent state), off = ink2 outline.
 */
export function Toggle({ label, value, onChange, disabled = false, compact = false }: ToggleProps) {
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
      <View
        style={[styles.well, compact && styles.wellCompact, value ? styles.wellOn : styles.wellOff, disabled && styles.wellDisabled]}
      >
        {value ? <Check size={compact ? 12 : 14} strokeWidth={icons.strokeWidth} color={colors.ink} /> : null}
      </View>
      <Text style={[styles.label, compact && styles.labelCompact, disabled && styles.labelDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xsPlus,
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
  wellCompact: {
    width: 18,
    height: 18,
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
  labelCompact: {
    fontSize: typeScale.caption,
  },
  labelDisabled: {
    color: colors.paper30,
  },
});
