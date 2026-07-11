import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { Mono } from "@/components/atoms/Mono";
import { colors } from "@/components/tokens";

type AvatarProps = {
  uri?: string | null;
  username: string;
  size?: number;
  /** Cosmetic frame = a simple ring; frames are config, not art. */
  frameColor?: string;
};

export function Avatar({ uri, username, size = 40, frameColor }: AvatarProps) {
  const initials = username.slice(0, 2).toUpperCase();
  const ring = frameColor
    ? { borderWidth: 2, borderColor: frameColor, padding: 2 }
    : null;

  return (
    <View style={[styles.ring, ring, { borderRadius: (size + 8) / 2 }]}>
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
