import { StyleSheet, View } from 'react-native';
import Svg, { Circle, SvgXml } from 'react-native-svg';

import { avatarRing } from '@lib/cosmetics';
import { useFrameDef } from '@lib/frames';
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

/**
 * An avatar wearing its owner's PROFILE frame. The frame art is ADMIN-MANAGED: a
 * frame's `profileSvg` (from the frames table) is a self-contained SVG rendered here
 * via react-native-svg's SvgXml, so a new frame DESIGN ships as a Studio row with no
 * app release. Frames with no art fall back to a plain ring (ring_color / level ring).
 * Contract: viewBox "-6 -6 76 76", avatar at center (32,32) r28. Reference art in
 * assets/frames/profile/*.svg.
 */
export function FramedAvatar({ uri, username, frameId, level, size }: FramedAvatarProps) {
  const def = useFrameDef(frameId);
  const ring = avatarRing(def, level);
  const avatarSize = Math.round(size * AVATAR_RATIO);

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Avatar uri={uri} username={username} size={avatarSize} />
      {def.profileSvg ? (
        <SvgXml xml={def.profileSvg} width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : (
        <Svg style={StyleSheet.absoluteFill} viewBox="-6 -6 76 76" pointerEvents="none">
          {ring.color ? (
            <Circle cx={32} cy={32} r={28} fill="none" stroke={ring.color} strokeWidth={2.6} />
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
