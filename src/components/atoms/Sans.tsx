import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts, typeScale } from '@/components/tokens';

type SansWeight = 'regular' | 'medium' | 'semibold';
type SansVariant = 'body' | 'label' | 'secondary' | 'caption';

type SansProps = TextProps & {
  weight?: SansWeight;
  variant?: SansVariant;
  size?: number;
  color?: string;
};

const weightToFamily: Record<SansWeight, string> = {
  regular: fonts.sans,
  medium: fonts.sansMedium,
  semibold: fonts.sansSemiBold,
};

const variantDefaults: Record<SansVariant, { size: number; color: string; weight: SansWeight }> = {
  body: { size: typeScale.body, color: colors.paper, weight: 'regular' },
  label: { size: typeScale.body, color: colors.paper, weight: 'medium' },
  secondary: { size: typeScale.sub, color: colors.paper60, weight: 'regular' },
  caption: { size: typeScale.caption, color: colors.paper60, weight: 'regular' },
};

/**
 * Sans-serif text atom — the counterpart to Mono. Handles Instrument Sans
 * rendering with a variant system so callers don't repeat font/color constants.
 *
 * `variant` sets sensible defaults; `weight`, `size`, and `color` override them.
 */
export function Sans({ variant = 'body', weight, size, color, style, ...rest }: SansProps) {
  const defaults = variantDefaults[variant];
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        {
          fontFamily: weightToFamily[weight ?? defaults.weight],
          fontSize: size ?? defaults.size,
          color: color ?? defaults.color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {},
});
