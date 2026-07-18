import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { avatarRing } from '@lib/cosmetics';
import { useFrameDef } from '@lib/frames';
import { Avatar } from '@/components/atoms/Avatar';
import { colors } from '@/components/tokens';

type FramedAvatarProps = {
  uri?: string | null;
  username: string;
  /** The PROFILE frame worn as the ring/ornament. Bespoke art for crown/valentines;
   *  every other frame falls back to a plain ring (its ring_color / the level ring). */
  frameId: string;
  /** Drives the level ring when no frame ring applies. */
  level: number;
  /** The whole framed box (avatar + ring + ornament). */
  size: number;
};

// The avatar sits inside the ring (r=28 in the assets' -6..70 / 76-unit box).
const AVATAR_RATIO = 56 / 76;

/**
 * An avatar wearing its owner's PROFILE frame — the earned flex. The frame art lives
 * in assets/frames/profile/*.svg (crown = gold band + jewel, valentines = rose band +
 * heart); those are ported here to react-native-svg since the app has no svg loader.
 * Any frame without bespoke art draws a plain ring in its accent (or the level ring).
 */
export function FramedAvatar({ uri, username, frameId, level, size }: FramedAvatarProps) {
  const def = useFrameDef(frameId);
  const ring = avatarRing(def, level);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const avatarSize = Math.round(size * AVATAR_RATIO);

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Avatar uri={uri} username={username} size={avatarSize} />
      <Svg style={StyleSheet.absoluteFill} viewBox="-6 -6 76 76" pointerEvents="none">
        {frameId === 'crown' ? (
          <CrownFrame gid={gid} />
        ) : frameId === 'valentines' ? (
          <ValentinesFrame gid={gid} />
        ) : ring.color ? (
          <Circle cx={32} cy={32} r={28} fill="none" stroke={ring.color} strokeWidth={2.6} />
        ) : (
          // The default faint ring (assets/frames/profile/avatar-ring-default.svg).
          <Circle cx={32} cy={32} r={28} fill="none" stroke={colors.paper} strokeWidth={1.5} opacity={0.18} />
        )}
      </Svg>
    </View>
  );
}

function CrownFrame({ gid }: { gid: string }) {
  const band = `band${gid}`;
  return (
    <>
      <Defs>
        <LinearGradient id={band} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F6D57A" />
          <Stop offset="0.5" stopColor="#E3B341" />
          <Stop offset="1" stopColor="#A87B1F" />
        </LinearGradient>
      </Defs>
      <Circle cx={32} cy={32} r={28} fill="none" stroke={`url(#${band})`} strokeWidth={3} />
      <Circle cx={32} cy={4.5} r={3.4} fill={`url(#${band})`} />
      <Circle cx={32} cy={4.5} r={1.9} fill={colors.safelight} />
    </>
  );
}

function ValentinesFrame({ gid }: { gid: string }) {
  const band = `rose${gid}`;
  return (
    <>
      <Defs>
        <LinearGradient id={band} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F9D4C6" />
          <Stop offset="0.5" stopColor="#E8997F" />
          <Stop offset="1" stopColor="#A85B42" />
        </LinearGradient>
      </Defs>
      <Circle cx={32} cy={32} r={28} fill="none" stroke={`url(#${band})`} strokeWidth={3} />
      {/* Heart ornament at 12 o'clock (from crown-frame-valentines-rose-small.svg). */}
      <G transform="translate(32 4.8) scale(0.078) translate(-101 -101)">
        <Path
          d="M100 162 C74 138 44 116 42 84 C41 60 56 46 74 46 C85 46 94 52 99 62 C102 50 112 40 127 40 C148 40 162 56 160 80 C157 114 126 138 100 162 Z"
          fill={colors.safelight}
          stroke={`url(#${band})`}
          strokeWidth={8}
          strokeLinejoin="round"
        />
      </G>
    </>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
