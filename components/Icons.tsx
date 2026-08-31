import Svg, { Path } from 'react-native-svg';

// Exact Font Awesome Free solid paths, as provided — rendered directly via
// react-native-svg rather than an icon font, so the shape is pixel-faithful
// to what was approved instead of an approximate same-name glyph from a
// different family/version.
type IconProps = { size: number; color: string };

export function CloseIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 640 640" fill="none">
      <Path
        fill={color}
        d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"
      />
    </Svg>
  );
}

export function TrashIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 640 640" fill="none">
      <Path
        fill={color}
        d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"
      />
    </Svg>
  );
}
