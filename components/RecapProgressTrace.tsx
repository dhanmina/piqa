import { Animated, View } from 'react-native';
import { colors, spacing } from '../lib/theme';

const SEGMENT_HEIGHT = 2;

// Recap's own progress indicator, drawn as the same ink-trace language as
// WeekStrip/MonthGrid instead of a generic Stories progress bar -- filled
// segments are slides already shown, the current segment fills left-to-right
// as it plays (driven by the same Animated.Value the slideshow advances on),
// the rest sit at gridLine like unwritten days ahead of today.
export function RecapProgressTrace({
  count,
  index,
  progressAnim,
}: {
  count: number;
  index: number;
  progressAnim: Animated.Value;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: SEGMENT_HEIGHT, borderRadius: 1, backgroundColor: colors.gridLine, overflow: 'hidden' }}
        >
          {i < index && <View style={{ height: '100%', backgroundColor: colors.trace }} />}
          {i === index && (
            <Animated.View
              style={{
                height: '100%',
                backgroundColor: colors.trace,
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }}
            />
          )}
        </View>
      ))}
    </View>
  );
}
