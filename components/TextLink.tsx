import { Text, Pressable } from 'react-native';
import { colors, spacing, touchTarget, type } from '../lib/theme';

export function TextLink({
  label,
  onPress,
  disabled,
  loading,
  variant = 'default',
  inline,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'muted';
  inline?: boolean;
  accessibilityLabel?: string;
}) {
  const isMuted = variant === 'muted';
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled }}
      style={{
        alignSelf: inline ? undefined : 'center',
        minHeight: touchTarget.min,
        paddingHorizontal: inline ? spacing.sm : spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={
          isMuted
            ? { ...type.body, color: colors.textMuted }
            : { ...type.caption, color: colors.textPrimary, fontWeight: '600' }
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
