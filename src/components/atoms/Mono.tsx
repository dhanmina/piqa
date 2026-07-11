import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts, typeScale } from '@/components/tokens';

type MonoWeight = 'regular' | 'medium' | 'semibold';

type MonoProps = TextProps & {
  weight?: MonoWeight;
  size?: number;
  color?: string;
};

const weightToFamily: Record<MonoWeight, string> = {
  regular: fonts.mono,
  medium: fonts.monoMedium,
  semibold: fonts.monoSemiBold,
};

/**
 * Every number in Piqa renders through this: countdowns, hearts, EXIF, streak.
 * Tabular figures so ticking digits never jitter.
 */
export function Mono({ weight = 'regular', size = typeScale.sub, color = colors.paper, style, ...rest }: MonoProps) {
  return (
    <Text
      {...rest}
      style={[styles.base, { fontFamily: weightToFamily[weight], fontSize: size, color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontVariant: ['tabular-nums'],
  },
});
