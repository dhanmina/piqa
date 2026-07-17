import Animated, { useAnimatedProps, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { colors } from '@/components/tokens';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ShutterMarkState = 'live' | 'done' | 'default';

type Props = {
  state: ShutterMarkState;
  size?: number;
  /**
   * Drives the capture-snap: 0 at rest, 1 fully contracted. Owned by the Shutter
   * (set on press) so the whole button and its mark move as one gesture. Optional
   * so the mark can render statically (e.g. in the dev kit) without a driver.
   */
  snap?: SharedValue<number>;
};

/**
 * Piqa's own shutter glyph — the brandmark made tappable (see Brandmark.tsx):
 * four viewfinder corners closing on the single safelight dot. It's ONE geometry,
 * re-coloured and re-inset per state, so live/done/default are the same mark, not
 * three drawings:
 *   default — paper corners around a quiet filled dot: the shot's target, waiting.
 *   live    — ink corners + ink dot (on the safelight button): loud, shoot now.
 *   done    — the frame closes tighter on a filled dot: the shot is locked. No
 *             checkmark — "today's shot is in" is status, and status lives on Today.
 *
 * On press the whole frame contracts toward the dot (the capture snap), echoing
 * the focus-lock brackets used elsewhere.
 */
const GEO: Record<
  ShutterMarkState,
  { corner: number; arm: number; bracket: string; dotFill: string; dotStroke: string; dotR: number }
> = {
  default: { corner: 20, arm: 16, bracket: colors.paper60, dotFill: colors.paper60, dotStroke: 'transparent', dotR: 7 },
  live: { corner: 20, arm: 16, bracket: colors.ink, dotFill: colors.ink, dotStroke: 'transparent', dotR: 10 },
  done: { corner: 27, arm: 21, bracket: colors.paper60, dotFill: colors.paper, dotStroke: 'transparent', dotR: 8 },
};

/** The four L-corners on a 100×100 grid, inset by `corner` with arm length `arm`. */
function cornerPaths(corner: number, arm: number): string[] {
  const a = corner;
  const b = 100 - corner;
  const e = arm;
  return [
    `M${a} ${a + e} L${a} ${a} L${a + e} ${a}`, // top-left
    `M${b - e} ${a} L${b} ${a} L${b} ${a + e}`, // top-right
    `M${a} ${b - e} L${a} ${b} L${a + e} ${b}`, // bottom-left
    `M${b - e} ${b} L${b} ${b} L${b} ${b - e}`, // bottom-right
  ];
}

export function ShutterMark({ state, size = 28, snap }: Props) {
  const internal = useSharedValue(0);
  const s = snap ?? internal;
  const g = GEO[state];
  const paths = cornerPaths(g.corner, g.arm);
  const dotR = g.dotR;

  // Frame contracts toward the dot; the dot blinks a touch larger at the same time.
  const bracketProps = useAnimatedProps(() => ({ scale: 1 - 0.12 * s.value }));
  const dotProps = useAnimatedProps(() => ({ r: dotR * (1 + 0.35 * s.value) }));

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <AnimatedG
        originX={50}
        originY={50}
        animatedProps={bracketProps}
        fill="none"
        stroke={g.bracket}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </AnimatedG>
      <AnimatedCircle
        cx={50}
        cy={50}
        fill={g.dotFill}
        stroke={g.dotStroke}
        strokeWidth={7}
        animatedProps={dotProps}
      />
    </Svg>
  );
}
