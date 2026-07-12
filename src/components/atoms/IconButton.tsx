import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, control, icons, overlay } from '@/components/tokens';

type IconButtonVariant = 'chrome' | 'plain';

type IconButtonProps = {
  /** Any lucide icon component, e.g. X, Settings, ChevronLeft. */
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress?: () => void;
  /**
   * chrome = a circular ink-scrim chip for controls floating over a photo
   * (full-paper glyph for contrast). plain = a bare glyph for headers on ink
   * (paper60 secondary chrome). Both hit a 48dp target via hitSlop.
   */
  variant?: IconButtonVariant;
  /** Optional fill for the glyph (e.g. a filled crown). */
  fill?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The one close/chrome control in the app. Every X, back arrow, and camera
 * chrome button routes through here so size, glyph, tap target, and scrim are
 * identical everywhere — you never have to hand-roll an rgba chip again.
 */
export function IconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  variant = 'plain',
  fill,
  style,
}: IconButtonProps) {
  const glyph = variant === 'chrome' ? colors.paper : colors.paper60;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      onPress={onPress}
      style={[variant === 'chrome' ? styles.chrome : styles.plain, style]}
    >
      <Icon size={control.icon} strokeWidth={icons.strokeWidth} color={glyph} fill={fill ?? 'transparent'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chrome: {
    width: control.chrome,
    height: control.chrome,
    borderRadius: control.chrome / 2,
    backgroundColor: overlay.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
