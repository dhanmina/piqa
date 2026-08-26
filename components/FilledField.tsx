import { TextInput } from 'react-native';
import { colors, spacing, radius, type, height } from '../lib/theme';

export function FilledField({
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  error,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address';
  error?: boolean;
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
        minHeight: height.control,
        paddingHorizontal: spacing.lg,
        color: colors.textPrimary,
        borderWidth: 1.5,
        borderColor: error ? colors.textPrimary : 'transparent',
        ...type.body,
      }}
    />
  );
}
