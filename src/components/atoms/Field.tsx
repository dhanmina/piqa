import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

type FieldProps = TextInputProps & {
  label: string;
  /** IBM Plex Mono input — for codes/numbers, per the all-numbers-mono law. */
  mono?: boolean;
  /** A quiet line under the input: guidance, or a validation message when error. */
  hint?: string;
  error?: boolean;
  /** Trailing control inside the input (e.g. a password show/hide toggle). */
  rightSlot?: ReactNode;
};

/** Text input atom: ink2 surface, paper text, no colored borders (accent belongs to actions). */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, mono = false, hint, error = false, rightSlot, style, editable = true, ...rest },
  ref,
) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          ref={ref}
          // Match the darkroom — the default light keyboard flashes white against ink.
          keyboardAppearance="dark"
          {...rest}
          editable={editable}
          placeholderTextColor={colors.paper30}
          selectionColor={colors.safelight}
          style={[
            styles.input,
            mono && styles.mono,
            !!rightSlot && styles.inputWithSlot,
            !editable && styles.inputDisabled,
            style,
          ]}
        />
        {rightSlot && <View style={styles.rightSlot}>{rightSlot}</View>}
      </View>
      {hint ? <Text style={[styles.hint, error && styles.hintError]}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: space.xxsPlus,
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  inputWrap: {
    justifyContent: 'center',
  },
  input: {
    minHeight: space.target,
    backgroundColor: colors.ink2,
    borderRadius: radius.card,
    paddingHorizontal: space.smPlus,
    fontFamily: fonts.sans,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  inputWithSlot: {
    paddingRight: 48,
  },
  rightSlot: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: space.xxsPlus,
  },
  mono: {
    fontFamily: fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  inputDisabled: {
    color: colors.paper30,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  hintError: {
    color: colors.heart,
  },
});
