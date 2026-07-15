import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useFrameDef, type FrameId, type MarkerShape, type PhotoStatus } from '@lib/frames';
import { colors, fonts, frame } from '@/components/tokens';

/**
 * Markers are literal native paths, drawn straight into the rail's SVG at reference
 * coordinates — the only mechanism that renders reliably (a nested/parsed SVG did
 * not). Each shape is authored centred on the origin, then scaled to fill the marker
 * slot as fully as the rail allows.
 *
 * The frame marker sits at the spec position (~x178, between PIQA and the counter at
 * x205), drawn with LITERAL absolute coordinates — no <G>/scale transforms. It is the
 * frame's identity mark and stays spec-sized; the prominent "Photo of the Day" crown
 * is the STATUS glyph on the right (StatusGlyph), not this.
 *
 * Adding a new SHAPE is a code change; adding a FRAME that reuses a shape is data.
 */
function MarkerGlyph({ shape }: { shape: MarkerShape }) {
  switch (shape) {
    case 'crown':
      return (
        <>
          <Path d="M165 955 L165 945 L172 950 L178 941 L184 950 L191 945 L191 955 Z" fill={colors.crown} />
          <Rect x={165} y={957} width={26} height={3} fill={colors.crown} />
        </>
      );
    case 'heart':
      return (
        <Path
          d="M178 958 C167 947 169 936 175 939 C177 941 178 942 178 944 C178 942 179 941 181 939 C187 936 189 947 178 958 Z"
          fill={colors.heart}
        />
      );
    default:
      // The default frame's advance mark — the spec triangle at x169-187.
      return <Path d="M169 940 L187 951 L169 962 Z" fill={colors.paper} fillOpacity={0.75} />;
  }
}

type FramedPhotoProps = {
  photoUri?: string | null;
  /**
   * An already-loaded (cached) image to show instantly under photoUri — e.g. the
   * grid's signed thumb when opening a shot fullscreen, so the print appears with
   * no reload while the sharper photoUri decodes in behind it.
   */
  placeholderUri?: string | null;
  /** Global day, from the server. Never computed on device. */
  dayNumber: number;
  /** The photo OWNER's equipped frame id — resolved to a definition from the catalog. */
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

/**
 * The status glyph — the "Photo of the Day" (crown) or "Top 10" (ring) mark — is
 * system-owned and NOT data: it says what THIS photo did, independent of the frame.
 * Drawn with LITERAL absolute coordinates (no <G>/scale transforms — those were
 * being ignored on-device, which is why it stayed tiny).
 *
 * Size is set by the rail's own scale: the crown is ~32 wide / 25 tall — a peer of
 * the red dot (22 across) and the counter's cap height (~21), a touch larger since
 * it's the meaningful mark, but not dominating. Centred on (610, 950) in the status
 * zone (x560-660), well clear of the dot at x694.
 */
function StatusGlyph({ status }: { status: PhotoStatus }) {
  if (!status) return null;
  if (status === 'crown') {
    return (
      <>
        <Path d="M594 956 L594 943 L602 949 L610 937 L618 949 L626 943 L626 956 Z" fill={colors.crown} />
        <Rect x={594} y={959} width={32} height={4} fill={colors.crown} />
      </>
    );
  }
  return (
    <Circle
      cx={610}
      cy={950}
      r={15}
      stroke={colors.safelight}
      strokeWidth={5}
      fill="none"
      strokeDasharray="75 20"
      strokeLinecap="round"
    />
  );
}

/**
 * A photo as a print: the image, then the frame over it. Reference canvas is
 * 750x1000 and every fixed coordinate is a raw reference unit — the viewBox scales
 * the geometry, so this renders identically at a 3-column thumbnail and full width
 * with no scale arithmetic.
 *
 * The rail is LOCKED in code (border, PIQA, counter, dot, status) — that is what
 * keeps it legible at any size. Only the parts that vary between frames come from
 * the frame definition (hairline, marker glyph, suffix, counter color), so a new
 * frame is a data row, not a code change. See lib/frames.tsx.
 *
 * The frame is an OVERLAY and stays one: never baked into a saved or uploaded file,
 * and never used on the voting screens.
 */
export function FramedPhoto({
  photoUri,
  placeholderUri,
  dayNumber,
  frameId = 'default',
  status = null,
  width,
  style,
}: FramedPhotoProps) {
  const def = useFrameDef(frameId);

  // Zero-pad to three while the counter still fits three; after that let it grow.
  // The rail is laid out so nothing shifts up to five digits.
  const counter = dayNumber <= 999 ? String(dayNumber).padStart(3, '0') : String(dayNumber);

  return (
    <View style={[styles.print, width !== undefined && { width }, style]}>
      {photoUri || placeholderUri ? (
        <Image
          // Progressive, no blink: the cached thumb sits in `placeholder` and holds
          // the frame; `source` (full-res) is the ONLY thing that loads, crossfading
          // in on top. Keeping source stable — never thumb→full-res — avoids a reload.
          source={photoUri ? { uri: photoUri } : undefined}
          placeholder={placeholderUri ? { uri: placeholderUri } : undefined}
          placeholderContentFit="cover"
          style={styles.window}
          contentFit="cover"
          transition={100}
        />
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
          stroke={def.hairlineColor}
          strokeWidth={2}
          strokeOpacity={def.hairlineOpacity}
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

        <MarkerGlyph shape={def.markerShape} />

        <SvgText
          x={205}
          y={962}
          fontFamily={fonts.mono}
          fontSize={30}
          letterSpacing={6}
          fill={def.counterColor}
          fillOpacity={0.75}
        >
          {counter}
        </SvgText>

        {def.suffixText && (
          <SvgText
            x={330}
            y={960}
            fontFamily={fonts.mono}
            fontSize={22}
            letterSpacing={4}
            fill={def.suffixColor ?? colors.paper}
            fillOpacity={0.85}
          >
            {def.suffixText}
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
