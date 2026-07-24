import { StyleSheet, View } from "react-native";

import { colors, radius } from "@/components/tokens";

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
};

/**
 * A flat ink2 skeleton placeholder — no shimmer, per spec §11d. Replaces the
 * identical skeleton styles duplicated across following.tsx, blocked.tsx,
 * search.tsx, and archive.tsx.
 */
export function Skeleton({ width, height = 12, borderRadius = radius.card / 3, style }: SkeletonProps) {
  return (
    <View
      style={[
        styles.base,
        { width, height, borderRadius },
        style,
      ]}
    />
  );
}

/** Avatar-sized skeleton (48×48 circle). */
export function SkeletonAvatar({ size = 48 }: { size?: number }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
}

/** Text-line skeleton that fills available width. */
export function SkeletonBar({ width }: { width?: number | string }) {
  return <Skeleton width={width} height={12} borderRadius={radius.card / 3} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.ink2,
  },
});
