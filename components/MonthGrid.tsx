import { useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View, ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors, spacing, type } from '../lib/theme';
import type { DayCellState } from './WeekStrip';
import { NetworkImage } from './NetworkImage';

export type MonthDay = { day: number; imageUrl: string | null; imageUrls: string[]; state: DayCellState };

const FROZEN_ICON = { ios: 'snowflake', android: 'ac_unit' } as const;
const COLUMNS = 7;
const GAP = spacing.sm;
const CELL_RADIUS = 10;
const FALLBACK_CELL_SIZE = 44;

export function MonthGrid({
  leadingBlanks,
  days,
  onPressDay,
}: {
  leadingBlanks: number;
  days: MonthDay[];
  onPressDay?: (day: MonthDay) => void;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const cellSize = containerWidth > 0 ? (containerWidth - GAP * (COLUMNS - 1)) / COLUMNS : FALLBACK_CELL_SIZE;
  const cellSizeStyle: ViewStyle = { width: cellSize, height: cellSize, alignItems: 'center', justifyContent: 'center' };

  function onLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  return (
    <View onLayout={onLayout} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
      {Array.from({ length: leadingBlanks }, (_, i) => (
        <View key={`blank-${i}`} testID={`blank-cell-${i}`} style={cellSizeStyle} />
      ))}
      {days.map((d) => (
        <Pressable
          key={d.day}
          testID={`day-cell-${d.day}`}
          onPress={onPressDay ? () => onPressDay(d) : undefined}
          disabled={!onPressDay || d.state !== 'captured'}
          style={[cellSizeStyle, cellStyle(d.state)]}
        >
          {d.imageUrl ? (
            <>
              <NetworkImage
                testID={`day-photo-${d.day}`}
                source={{ uri: d.imageUrl }}
                style={{ width: '100%', height: '100%', borderRadius: CELL_RADIUS }}
                contentFit="cover"
              />
              <View
                testID={`day-badge-${d.day}`}
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 7,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                }}
              >
                <Text style={{ ...type.caption, fontSize: 12, color: colors.textPrimary }}>
                  {d.imageUrls.length > 1 ? `${d.day} · ${d.imageUrls.length}` : d.day}
                </Text>
              </View>
            </>
          ) : (
            <Text style={{ ...type.body, color: colors.textMuted }}>{d.day}</Text>
          )}
          {d.state === 'frozen' && (
            <View style={{ position: 'absolute', bottom: 4, right: 4 }} testID={`frozen-icon-${d.day}`}>
              <SymbolView name={FROZEN_ICON} size={16} tintColor={colors.textMuted} />
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function cellStyle(state: DayCellState): ViewStyle {
  const base: ViewStyle = { borderRadius: CELL_RADIUS, overflow: 'hidden' };
  switch (state) {
    case 'captured':
      return base;
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
