import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

type FieldProps = TextInputProps & {
  label: string;
  /** IBM Plex Mono input — for codes/numbers, per the all-numbers-mono law. */
  mono?: boolean;
};

/** Text input atom: ink2 surface, paper text, no colored borders (accent belongs to actions). */
export function Field({ label, mono = false, style, editable = true, ...rest }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        editable={editable}
        placeholderTextColor={colors.paper30}
        selectionColor={colors.safelight}
        style={[
          styles.input,
          mono && styles.mono,
          !editable && styles.inputDisabled,
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  input: {
    minHeight: space.target,
    backgroundColor: colors.ink2,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    fontFamily: fonts.sans,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  mono: {
    fontFamily: fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  inputDisabled: {
    color: colors.paper30,
  },
});
