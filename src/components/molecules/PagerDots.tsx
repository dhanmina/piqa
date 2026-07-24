import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '@/components/tokens';

const DOT_MAX = 7;
const DOT_BASE = 8;
const DOT_SLOT = 14;
const DOT_HALF = Math.floor(DOT_MAX / 2);

function Dot({ index, scrollX, pageW }: { index: number; scrollX: SharedValue<number>; pageW: number }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(scrollX.value / pageW - index);
    return {
      transform: [{ scale: interpolate(d, [0, 1, 2, 3, 4, 5], [1, 0.75, 0.75, 0.56, 0.38, 0], Extrapolation.CLAMP) }],
      backgroundColor: interpolateColor(d, [0, 0.9], [colors.safelight, colors.paper40]),
    };
  });
  return (
    <View style={styles.dotSlot}>
      <Animated.View style={[styles.dotCircle, style]} />
    </View>
  );
}

export function PagerDots({ scrollX, total, pageW }: { scrollX: SharedValue<number>; total: number; pageW: number }) {
  const visible = Math.min(total, DOT_MAX);
  const trackStyle = useAnimatedStyle(() => {
    if (total <= DOT_MAX) return { transform: [{ translateX: 0 }] };
    const progress = scrollX.value / pageW;
    const center = Math.min(Math.max(progress, DOT_HALF), total - 1 - DOT_HALF);
    return { transform: [{ translateX: (DOT_HALF - center) * DOT_SLOT }] };
  });
  return (
    <View style={[styles.dotsViewport, { width: visible * DOT_SLOT }]}>
      <Animated.View style={[styles.dotsTrack, trackStyle]}>
        {Array.from({ length: total }, (_, i) => (
          <Dot key={i} index={i} scrollX={scrollX} pageW={pageW} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dotsViewport: { alignSelf: 'center', height: DOT_BASE, marginTop: 4, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  dotsTrack: { flexDirection: 'row', alignItems: 'center' },
  dotSlot: { width: DOT_SLOT, alignItems: 'center', justifyContent: 'center' },
  dotCircle: { width: DOT_BASE, height: DOT_BASE, borderRadius: DOT_BASE / 2 },
});
