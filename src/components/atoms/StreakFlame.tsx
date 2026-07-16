import { Flame, Shield } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Mono } from '@/components/atoms/Mono';
import { colors, icons, typeScale } from '@/components/tokens';

type StreakFlameProps = {
  /** Days the flame has been alive (0 = not lit). */
  days: number;
  alive?: boolean;
  shields?: number; // a held shield rides one missed day; shown only when > 0
  /** The real last-7-days pattern, oldest first, index 6 = today. */
  last7?: boolean[];
  /** Fallback when last7 isn't wired (dev showcase): a 0–7 count. */
  daysThisWeek?: number;
};

/**
 * No guilt state: a dead streak is just an unfilled flame, never a broken one.
 * Streak is a safelight surface (spec: accent = actions, streak, live). The dots
 * are the ACTUAL last seven days — a day you shot always lights its dot, today's
 * is ringed — so the sliding window reads honestly instead of a decrementing
 * count. A held shield reads as protection (paper, calm), never as a warning.
 */
export function StreakFlame({ days, alive = true, shields = 0, last7, daysThisWeek }: StreakFlameProps) {
  // Full 7-day pattern when we have it; otherwise a count-based fallback (dev
  // showcase, or the brief moment before the pattern loads) so 7 dots always show.
  const pattern =
    last7 && last7.length === 7 ? last7 : Array.from({ length: 7 }, (_, i) => i < (daysThisWeek ?? 0));

  return (
    <View style={styles.row}>
      <Flame
        size={20}
        strokeWidth={icons.strokeWidth}
        color={alive ? colors.safelight : colors.paper40}
        fill={alive ? colors.safelight : 'transparent'}
      />
      <Mono weight="semibold" size={typeScale.body} color={alive ? colors.paper : colors.paper60}>
        {days}
      </Mono>
      <View style={styles.dots}>
        {pattern.map((filled, i) => {
          const isToday = i === pattern.length - 1;
          return (
            <View key={i} style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty, isToday && styles.today]} />
          );
        })}
      </View>
      {shields > 0 && (
        <View style={styles.shield}>
          <Shield size={13} strokeWidth={icons.strokeWidth} color={colors.paper60} fill={colors.paper60} />
          {shields > 1 && (
            <Mono size={typeScale.caption} color={colors.paper60}>
              {shields}
            </Mono>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 4 },
  shield: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotFilled: { backgroundColor: colors.safelight },
  dotEmpty: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.paper30 },
  // Today's dot is ringed so the window's leading edge is always legible.
  today: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: colors.paper60 },
});
