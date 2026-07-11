import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { brackets, colors, motion } from '@/components/tokens';

type BracketsProps = PropsWithChildren<{
  /** paper for live/submitted moments, crown gold ONLY for PotD. */
  color?: string;
  /** Space between the brackets and the content edge. */
  gap?: number;
  /** Snap in corner-by-corner (200ms total) — the focus-lock moment. */
  animated?: boolean;
  style?: ViewStyle;
}>;

type CornerName = 'tl' | 'tr' | 'bl' | 'br';
const CORNERS: CornerName[] = ['tl', 'tr', 'br', 'bl'];

/**
 * The viewfinder motif — 2dp corner ticks. ON: live Shot card, capture preview,
 * submitted photo, PotD (gold). NEVER on voting pairs or plain tiles (blind = frameless).
 */
export function Brackets({
  color = colors.paper,
  gap = brackets.gap,
  animated = false,
  style,
  children,
}: BracketsProps) {
  const inset = gap + brackets.thickness;
  const perCorner = motion.bracketSnapMs / CORNERS.length;

  return (
    <View style={[{ padding: inset }, style]}>
      {children}
      {CORNERS.map((corner, i) => {
        const content = (
          <>
            <View style={[styles.barH, { backgroundColor: color }]} />
            <View style={[styles.barV, { backgroundColor: color }]} />
          </>
        );
        return animated ? (
          <Animated.View
            key={corner}
            entering={ZoomIn.duration(perCorner).delay(i * perCorner)}
            style={[styles.corner, cornerStyles[corner]]}
          >
            {content}
          </Animated.View>
        ) : (
          <View key={corner} style={[styles.corner, cornerStyles[corner]]}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    width: brackets.armLength,
    height: brackets.armLength,
  },
  barH: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: brackets.armLength,
    height: brackets.thickness,
  },
  barV: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: brackets.thickness,
    height: brackets.armLength,
  },
});

const cornerStyles = StyleSheet.create({
  tl: { top: 0, left: 0 },
  tr: { top: 0, right: 0, transform: [{ rotate: '90deg' }] },
  br: { bottom: 0, right: 0, transform: [{ rotate: '180deg' }] },
  bl: { bottom: 0, left: 0, transform: [{ rotate: '270deg' }] },
});
