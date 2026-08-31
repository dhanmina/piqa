import { Text, View } from 'react-native';
import { colors, spacing, type } from '../lib/theme';

export type Stat = { value: string; label: string };

// A quiet two-up (or more) readout strip: monospace value over a caps label,
// divided by hairlines — not a bordered pill. Pill "chips" read as social/
// gamified tags, which the product's no-badges rule rules out; this reads as
// an instrument readout instead. Replaces the old single-label pill Chip.
export function Chip({ stats }: { stats: Stat[] }) {
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
      {stats.map((stat, i) => (
        <View
          key={stat.label}
          style={{
            flex: 1,
            gap: 3,
            paddingVertical: spacing.sm,
            paddingLeft: i > 0 ? spacing.md : 0,
            borderLeftWidth: i > 0 ? 1 : 0,
            borderLeftColor: colors.border,
          }}
        >
          <Text style={{ ...type.dataLg, color: colors.textPrimary }}>{stat.value}</Text>
          <Text
            style={{
              ...type.caption,
              fontSize: 10.5,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: colors.textFaint,
            }}
          >
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
