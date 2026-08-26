import { Text, Pressable } from 'react-native';
import { colors, spacing, radius, type, height } from '../lib/theme';

export function Button({
  label,
  loadingLabel,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  loadingLabel?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => {
        if (isPrimary) {
          return {
            backgroundColor: isDisabled ? colors.border : pressed ? colors.accentPressed : colors.accent,
            minHeight: height.control,
            justifyContent: 'center',
            paddingHorizontal: spacing.lg,
            borderRadius: radius.button,
            alignItems: 'center',
          };
        }
        return {
          backgroundColor: pressed ? colors.border : 'transparent',
          borderColor: colors.border,
          borderWidth: 1,
          minHeight: height.control,
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          borderRadius: radius.button,
          alignItems: 'center',
        };
      }}
    >
      <Text
        style={{
          ...type.bodyBold,
          color: isPrimary ? (isDisabled ? colors.textMuted : colors.background) : colors.textPrimary,
        }}
      >
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}
