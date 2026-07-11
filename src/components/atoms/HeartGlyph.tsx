import Svg, { Path } from 'react-native-svg';

// TODO(brand): replace with custom asymmetric heart SVG — one of the 3 identity
// icons (heart/flame/crown), stroke weight matched to Lucide 2.25.
// Tracked in TODO.md — this placeholder is a stock symmetric heart and must not ship.
const HEART_PATH =
  'M12 20.6 C 7.1 17.7 3.5 14.4 3.1 10.5 C 2.8 7.7 4.8 5.3 7.4 5.1 C 9.1 5 10.9 6.1 11.9 7.7 C 12.7 5.9 14.7 4.6 16.5 4.9 C 19.1 5.3 20.9 7.5 20.6 10.3 C 20.2 14.3 16.6 17.8 12 20.6 Z';

type HeartGlyphProps = {
  size?: number;
  color: string;
  fill?: string;
  strokeWidth?: number;
};

/** The single heart drawing used everywhere — never an OS emoji glyph. */
export function HeartGlyph({ size = 24, color, fill = 'transparent', strokeWidth = 1.8 }: HeartGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={HEART_PATH} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" fill={fill} />
    </Svg>
  );
}
