import { forwardRef, useState } from 'react';
import { Pressable, TextInput, View, type ReturnKeyTypeOptions, type TextInputProps } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { colors, spacing, radius, type, height, touchTarget } from '../lib/theme';

type SymbolName = NonNullable<SymbolViewProps['name']>;
const EYE_ICON: SymbolName = { ios: 'eye', android: 'visibility' };
const EYE_OFF_ICON: SymbolName = { ios: 'eye.slash', android: 'visibility_off' };

export const FilledField = forwardRef<TextInput, {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  revealable?: boolean;
  keyboardType?: 'email-address';
  error?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  onBlur?: TextInputProps['onBlur'];
  textContentType?: TextInputProps['textContentType'];
  autoComplete?: TextInputProps['autoComplete'];
}>(function FilledField(
  {
    placeholder,
    value,
    onChangeText,
    secureTextEntry,
    revealable,
    keyboardType,
    error,
    returnKeyType,
    onSubmitEditing,
    onBlur,
    textContentType,
    autoComplete,
  },
  ref,
) {
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={{ justifyContent: 'center' }}>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry && !revealed}
        autoCapitalize="none"
        keyboardType={keyboardType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        onBlur={onBlur}
        textContentType={textContentType}
        autoComplete={autoComplete}
        blurOnSubmit={false}
        accessibilityLabel={placeholder}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.button,
          minHeight: height.control,
          paddingHorizontal: spacing.lg,
          paddingRight: revealable ? spacing.xxl : spacing.lg,
          color: colors.textPrimary,
          borderWidth: 1.5,
          borderColor: error ? colors.textPrimary : 'transparent',
          ...type.body,
        }}
      />
      {revealable && (
        <Pressable
          onPress={() => setRevealed((r) => !r)}
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: spacing.md, height: touchTarget.min, width: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
        >
          <SymbolView name={revealed ? EYE_OFF_ICON : EYE_ICON} size={20} tintColor={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
});
