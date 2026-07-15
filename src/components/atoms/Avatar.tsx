import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { Mono } from "@/components/atoms/Mono";
import { colors } from "@/components/tokens";

type AvatarProps = {
  uri?: string | null;
  username: string;
  size?: number;
  /** Level-earned ring around the face. NOT a photo frame — see lib/frames.ts. */
  ringColor?: string | null;
  /** Ring thickness (defaults to 2). */
  ringWidth?: number;
};

const RING_PAD = 2;

export function Avatar({ uri, username, size = 40, ringColor, ringWidth = 2 }: AvatarProps) {
  const initials = username.slice(0, 2).toUpperCase();
  // Border-box sizing: width/height include padding + border, so the outer box
  // is size + the ring's padding and stroke on both sides. Radius = outer / 2
  // is an exact circle — never rely on RN clamping an oversized radius (which
  // renders square once a borderWidth is present on Fabric).
  const outer = ringColor ? size + RING_PAD * 2 + ringWidth * 2 : size;
  const ring = ringColor
    ? { borderWidth: ringWidth, borderColor: ringColor, padding: RING_PAD }
    : null;

  return (
    <View style={[styles.ring, ring, { width: outer, height: outer, borderRadius: outer / 2 }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={100}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Mono weight="medium" size={size * 0.32} color={colors.paper60}>
            {initials}
          </Mono>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: {
    backgroundColor: colors.ink2,
    alignItems: "center",
    justifyContent: "center",
  },
});
