import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Stop, SvgXml } from 'react-native-svg';

import { avatarRing } from '@lib/utils/cosmetics';
import { useFrameDef } from '@lib/hooks/frames';
import { Avatar } from '@/components/atoms/Avatar';
import { colors } from '@/components/tokens';

type FramedAvatarProps = {
  uri?: string | null;
  username: string;
  /** The PROFILE frame worn as the ring/ornament. */
  frameId: string;
  /** Drives the level ring when the frame has no art. */
  level: number;
  /** The whole framed box (avatar + ring + ornament). */
  size: number;
};

// The avatar fills the ring (r=28 in the profile_svg contract's -6..70 / 76-unit box).
const AVATAR_RATIO = 56 / 76;
// Fixed neutral badge border, never an attempt to color-match the frame's own
// (often gradient, sometimes rotating) hue — see spec §2.2.
const BADGE_BORDER = '#F2EDE4';
const BADGE_R = 7;

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A single accent-colored dot -- the shared placeholder for every tier 1-3
 *  marker shape until final Figma art replaces it (spec §5 correction). */
function MarkerBadge({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={BADGE_R} fill={colors.ink2} stroke={BADGE_BORDER} strokeWidth={1.4} />
      <Circle cx={cx} cy={cy} r={BADGE_R - 3} fill={color} />
    </>
  );
}

/**
 * An avatar wearing its owner's PROFILE frame. The frame art is ADMIN-MANAGED: a
 * frame's `profileSvg` (from the frames table) is a self-contained SVG rendered here
 * via react-native-svg's SvgXml, so a new frame DESIGN ships as a Studio row with no
 * app release. Frames with no art fall back to a plain ring (ring_color / level ring)
 * or, from this task on, a gradient ring (ring_gradient) with Tier 3's animated
 * treatment (shimmer) and a per-frame marker badge at 6 o'clock.
 *
 * Contract: viewBox "-6 -6 76 76", avatar at center (32,32) r28. Reference art in
 * assets/frames/profile/*.svg.
 */
export function FramedAvatar({ uri, username, frameId, level, size }: FramedAvatarProps) {
  const def = useFrameDef(frameId);
  const ring = avatarRing(def, level);
  const avatarSize = Math.round(size * AVATAR_RATIO);
  const gradId = `avatar-ring-${useId()}`;

  const rotate = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!def.shimmer) return;
    rotate.value = withRepeat(withTiming(360, { duration: 3200, easing: Easing.linear }), -1);
    glow.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.shimmer]);

  const rotateProps = useAnimatedProps(() => ({ rotation: rotate.value }));
  const glowProps = useAnimatedProps(() => ({ strokeOpacity: 0.2 + glow.value * 0.35 }));
  const markerGlowProps = useAnimatedProps(() => ({ opacity: 0.7 + glow.value * 0.3 }));

  // Bottom of the ring (6 o'clock), outer edge touching the ring's own outer
  // radius from inside -- not centered on the ring's midline (an earlier
  // version tried that; ~85% of the badge hung outside the circle). See
  // spec §2.2.
  const markerCx = 32;
  const markerCy = 32 + 28 + BADGE_R - 3;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Avatar uri={uri} username={username} size={avatarSize} />
      {def.profileSvg ? (
        <SvgXml xml={def.profileSvg} width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : def.ringGradient ? (
        <Svg style={StyleSheet.absoluteFill} viewBox="-6 -6 76 76" pointerEvents="none">
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              {def.ringGradient.map((c, i) => (
                <Stop key={c + i} offset={i / (def.ringGradient!.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          {def.shimmer && (
            <AnimatedCircle
              cx={32}
              cy={32}
              r={28}
              fill="none"
              stroke={def.ringGradient[0]}
              strokeWidth={6}
              animatedProps={glowProps}
            />
          )}
          {def.shimmer ? (
            <AnimatedG originX={32} originY={32} animatedProps={rotateProps}>
              <Circle cx={32} cy={32} r={28} fill="none" stroke={`url(#${gradId})`} strokeWidth={3.2} />
            </AnimatedG>
          ) : (
            <Circle cx={32} cy={32} r={28} fill="none" stroke={`url(#${gradId})`} strokeWidth={2.6} />
          )}
          {def.shimmer ? (
            <AnimatedG animatedProps={markerGlowProps}>
              <MarkerBadge cx={markerCx} cy={markerCy} color={def.suffixColor ?? def.ringGradient[0]} />
            </AnimatedG>
          ) : (
            <MarkerBadge cx={markerCx} cy={markerCy} color={def.suffixColor ?? def.ringGradient[0]} />
          )}
        </Svg>
      ) : (
        <Svg style={StyleSheet.absoluteFill} viewBox="-6 -6 76 76" pointerEvents="none">
          {ring.color ? (
            <>
              <Circle cx={32} cy={32} r={28} fill="none" stroke={ring.color} strokeWidth={2.6} />
              {def.unlockKind === 'purchase' && def.markerShape && (
                <MarkerBadge cx={markerCx} cy={markerCy} color={ring.color} />
              )}
            </>
          ) : (
            // The default faint ring (assets/frames/profile/avatar-ring-default.svg).
            <Circle cx={32} cy={32} r={28} fill="none" stroke={colors.paper} strokeWidth={1.5} opacity={0.18} />
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
