import Svg, { Circle, G, Path } from 'react-native-svg';

import { colors } from '@/components/tokens';

type BrandmarkProps = {
  size?: number;
  /** Bracket-frame stroke color. Defaults to paper (dark surfaces). */
  stroke?: string;
  /** The singular shutter dot. Always the one accent; never doubled or recolored
   *  (brand rule), except gold on the Photo-of-the-Day share card. */
  dot?: string;
};

/**
 * The Piqa mark — three bracket corners of a camera frame, with the safelight
 * shutter dot as the fourth. Redrawn from assets/brand/mark/piqa-mark.svg (the
 * dark-surface variant) so it's a live vector, not a rasterized asset.
 */
export function Brandmark({ size = 56, stroke = colors.paper, dot = colors.safelight }: BrandmarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityRole="image" accessibilityLabel="Piqa">
      <G stroke={stroke} fill="none" strokeWidth={18} strokeLinecap="round">
        <Path d="M20 52 L20 20 L52 20" />
        <Path d="M148 20 L180 20 L180 52" />
        <Path d="M20 148 L20 180 L52 180" />
      </G>
      <Circle cx={166} cy={166} r={22} fill={dot} />
    </Svg>
  );
}
