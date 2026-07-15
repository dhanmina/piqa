import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { FrameId, PhotoStatus } from '@lib/frames';
import { colors, fonts, frame } from '@/components/tokens';

type FramedPhotoProps = {
  photoUri?: string | null;
  /** Global day, from the server. Never computed on device. */
  dayNumber: number;
  /** The photo OWNER's equipped frame — not the viewer's. */
  frameId?: FrameId;
  /** Per-photo result, written by close_day. No client path may ever set it. */
  status?: PhotoStatus;
  /**
   * Rendered width. Optional: when omitted the print fills its parent and keeps
   * its 3:4 aspect, which is what the percentage-width grid cells need. The SVG
   * viewBox scales the geometry either way, so there is nothing to measure.
   */
  width?: number;
  style?: StyleProp<ViewStyle>;
};

/** The crown: shared by the crown frame's rail marker and the crown status glyph. */
function CrownGlyph({ color }: { color: string }) {
  return (
    <>
      <Path d="M-12 6 L-12 -4 L-6 1 L0 -8 L6 1 L12 -4 L12 6 Z" fill={color} />
      <Rect x={-12} y={8} width={24} height={3} fill={color} />
    </>
  );
}

/**
 * The status layer is system-owned and independent of the frame: it says what THIS
 * photo did, while the rail says who its owner is. Both assets are 100x100 boxes,
 * so both scale identically into the same 26-unit slot centred on (610, 951).
 */
function StatusGlyph({ status }: { status: PhotoStatus }) {
  if (!status) return null;
  return (
    <G transform="translate(597, 938) scale(0.26)">
      {status === 'crown' ? (
        <G transform="translate(50,48) scale(2.2)">
          <CrownGlyph color={colors.crown} />
        </G>
      ) : (
        <Circle
          cx={50}
          cy={50}
          r={30}
          stroke={colors.safelight}
          strokeWidth={9}
          fill="none"
          strokeDasharray="150 40"
          strokeLinecap="round"
          transform="rotate(-30 50 50)"
        />
      )}
    </G>
  );
}

/**
 * A photo as a print: the image, then the frame over it. Reference canvas is
 * 750x1000 and every coordinate below is a raw reference unit — the viewBox does
 * the scaling, so this renders identically at a 3-column thumbnail and full width
 * with no scale arithmetic and no pixel constants.
 *
 * The frame is an OVERLAY and stays one. It is never baked into a saved or
 * uploaded file, and it is never used on the voting screens — a blind matchup
 * shows a raw photo with no frame, no status and no metadata, so nothing about a
 * photo's owner or its past can bias a vote.
 */
export function FramedPhoto({
  photoUri,
  dayNumber,
  frameId = 'default',
  status = null,
  width,
  style,
}: FramedPhotoProps) {
  const isCrown = frameId === 'crown';

  // Zero-pad to three while the counter still fits three; after that let it grow.
  // The rail is laid out so nothing shifts up to five digits.
  const counter = dayNumber <= 999 ? String(dayNumber).padStart(3, '0') : String(dayNumber);

  return (
    <View style={[styles.print, width !== undefined && { width }, style]}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.window} contentFit="cover" transition={100} />
      ) : (
        <View style={[styles.window, styles.skeleton]} />
      )}

      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox="0 0 750 1000"
        style={StyleSheet.absoluteFill}
      >
        {/* Border: everything outside the photo window, punched out evenodd. */}
        <Path
          d="M0 0 H750 V1000 H0 Z M24 24 H726 V904 H24 Z"
          fill={colors.ink2}
          fillRule="evenodd"
        />

        <Line
          x1={24}
          y1={904}
          x2={726}
          y2={904}
          stroke={isCrown ? colors.crown : colors.paper}
          strokeWidth={2}
          strokeOpacity={isCrown ? 0.5 : 0.35}
        />

        <SvgText
          x={40}
          y={962}
          fontFamily={fonts.mono}
          fontSize={30}
          letterSpacing={6}
          fill={colors.paper}
          fillOpacity={0.75}
        >
          PIQA
        </SvgText>

        {isCrown ? (
          <G transform="translate(178,949) scale(1.05)">
            <CrownGlyph color={colors.crown} />
          </G>
        ) : (
          <Path d="M169 940 L187 951 L169 962 Z" fill={colors.paper} fillOpacity={0.75} />
        )}

        <SvgText
          x={205}
          y={962}
          fontFamily={fonts.mono}
          fontSize={30}
          letterSpacing={6}
          fill={colors.paper}
          fillOpacity={0.75}
        >
          {counter}
        </SvgText>

        {isCrown && (
          <SvgText
            x={330}
            y={960}
            fontFamily={fonts.mono}
            fontSize={22}
            letterSpacing={4}
            fill={colors.crown}
            fillOpacity={0.85}
          >
            · CROWN
          </SvgText>
        )}

        <StatusGlyph status={status} />

        {/* The dot is identical on every frame — it is the maker's mark, not a state. */}
        <Circle cx={694} cy={951} r={11} fill={colors.safelight} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  print: {
    width: '100%',
    aspectRatio: frame.aspect,
    backgroundColor: colors.ink2,
  },
  // The photo window: x24-726, y24-904 of the 750x1000 canvas, as percentages so
  // it tracks the print at any size.
  window: {
    position: 'absolute',
    left: frame.window.left,
    right: frame.window.right,
    top: frame.window.top,
    bottom: frame.window.bottom,
  },
  skeleton: {
    backgroundColor: colors.ink2, // flat, no shimmer (spec §11d)
  },
});
