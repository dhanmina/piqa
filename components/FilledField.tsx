import { TextInput } from 'react-native';
import { colors, spacing, radius, type } from '../lib/theme';

export function FilledField({
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address';
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      secureTextEntry={secureTextEntry}
      autoCapitalize="none"
      keyboardType={keyboardType}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.button,
        paddingVertical: spacing.md + spacing.xs,
        paddingHorizontal: spacing.lg,
        color: colors.textPrimary,
        ...type.body,
      }}
    />
  );
}
