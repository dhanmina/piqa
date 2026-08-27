import { View, Text, ViewStyle } from 'react-native';
import { colors, spacing, type } from '../lib/theme';

export type DayCellState = 'captured' | 'frozen' | 'today' | 'missed' | 'future';
export type DayCell = { key: string; label: string; state: DayCellState };

const CELL_SIZE = 32;

export function WeekStrip({ days }: { days: DayCell[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((day) => (
        <View key={day.key} style={{ alignItems: 'center', gap: spacing.xxs }}>
          <View style={cellStyle(day.state)} />
          <Text style={{ ...type.caption, fontSize: 11, color: colors.textMuted }}>{day.label}</Text>
        </View>
      ))}
    </View>
  );
}

function cellStyle(state: DayCellState): ViewStyle {
  const base: ViewStyle = { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 8 };
  switch (state) {
    case 'captured':
      return { ...base, backgroundColor: colors.accent };
    case 'today':
      return { ...base, borderWidth: 1.5, borderColor: colors.textPrimary };
    case 'frozen':
      return { ...base, borderWidth: 1.5, borderColor: colors.textMuted, borderStyle: 'dashed' };
    case 'missed':
      return { ...base, backgroundColor: colors.border };
    case 'future':
    default:
      return { ...base, borderWidth: 1, borderColor: colors.border };
  }
}
