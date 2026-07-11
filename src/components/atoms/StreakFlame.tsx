import { Flame } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Mono } from '@/components/atoms/Mono';
import { colors, icons, typeScale } from '@/components/tokens';

type StreakFlameProps = {
  weeks: number;
  daysThisWeek: number; // 0–7; the weekly goal is 4 of 7
  alive?: boolean;
};

const WEEK_GOAL_DOT = 3; // 4th dot = goal met

/**
 * No guilt state: a dead streak is just an unfilled flame, never a broken one.
 * Streak is a safelight surface (spec: accent = actions, streak, live).
 */
export function StreakFlame({ weeks, daysThisWeek, alive = true }: StreakFlameProps) {
  return (
    <View style={styles.row}>
      <Flame
        size={20}
        strokeWidth={icons.strokeWidth}
        color={alive ? colors.safelight : colors.paper40}
        fill={alive ? colors.safelight : 'transparent'}
      />
      <Mono weight="semibold" size={typeScale.body} color={alive ? colors.paper : colors.paper60}>
        {weeks}
      </Mono>
      <View style={styles.dots}>
        {Array.from({ length: 7 }, (_, i) => {
          const filled = i < daysThisWeek;
          const isGoal = i === WEEK_GOAL_DOT;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                isGoal && styles.goalDot,
                filled ? styles.dotFilled : styles.dotEmpty,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  goalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: colors.safelight,
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.paper30,
  },
});
