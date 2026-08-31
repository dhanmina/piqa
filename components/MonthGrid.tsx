import { useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View, ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors, spacing, type } from '../lib/theme';
import type { DayCellState } from './WeekStrip';
import { NetworkImage } from './NetworkImage';

export type MonthDay = {
  day: number;
  imageUrl: string | null;
  imageUrls: string[];
  captureIds: string[];
  state: DayCellState;
};

const FROZEN_ICON = { ios: 'snowflake', android: 'ac_unit' } as const;
const MULTI_PHOTO_ICON = { ios: 'square.stack.fill', android: 'photo_library' } as const;
const COLUMNS = 7;
const GAP = spacing.sm;
const CELL_RADIUS = 6; // tighter than the old 10 — instrument cell, not a rounded tile
const FALLBACK_CELL_SIZE = 44;
// Sunday-first, matching Date#getDay() (0 = Sunday) — same order leadingBlanks aligns against.
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dayAccessibilityLabel(year: number, month: number, d: MonthDay): string {
  const dateStr = new Date(year, month - 1, d.day).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  switch (d.state) {
    case 'captured':
      return d.imageUrls.length > 1 ? `${dateStr}, captured, ${d.imageUrls.length} photos` : `${dateStr}, captured`;
    case 'frozen':
      return `${dateStr}, missed, covered by a freeze`;
    case 'today':
      return `${dateStr}, today`;
    case 'missed':
      return `${dateStr}, missed`;
    case 'future':
    default:
      return dateStr;
  }
}

export function MonthGrid({
  year,
  month,
  leadingBlanks,
  days,
  onPressDay,
}: {
  year: number;
  month: number;
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
    <View onLayout={onLayout}>
      <View style={{ flexDirection: 'row', gap: GAP, marginBottom: spacing.xs }}>
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={i} style={{ width: cellSize, alignItems: 'center' }}>
            <Text style={{ ...type.data, fontSize: 10, color: colors.textFaint }}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <View key={`blank-${i}`} testID={`blank-cell-${i}`} style={cellSizeStyle} />
        ))}
        {days.map((d) => {
          const pressable = !!onPressDay && d.state === 'captured';
          return (
            <Pressable
              key={d.day}
              testID={`day-cell-${d.day}`}
              onPress={pressable ? () => onPressDay!(d) : undefined}
              disabled={!pressable}
              accessible
              accessibilityRole={pressable ? 'button' : 'text'}
              accessibilityLabel={dayAccessibilityLabel(year, month, d)}
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
                      borderRadius: 4,
                      backgroundColor: 'rgba(10,10,10,0.72)',
                    }}
                  >
                    <Text style={{ ...type.data, fontSize: 11, color: colors.textPrimary }}>{d.day}</Text>
                  </View>
                  {d.imageUrls.length > 1 && (
                    <View
                      testID={`multi-photo-icon-${d.day}`}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        padding: 3,
                        borderRadius: 4,
                        backgroundColor: 'rgba(10,10,10,0.72)',
                      }}
                    >
                      <SymbolView name={MULTI_PHOTO_ICON} size={11} tintColor={colors.textPrimary} />
                    </View>
                  )}
                </>
              ) : (
                <Text style={{ ...type.data, fontSize: 12, color: colors.textFaint }}>{d.day}</Text>
              )}
              {d.state === 'frozen' && (
                <View style={{ position: 'absolute', bottom: 4, right: 4 }} testID={`frozen-icon-${d.day}`}>
                  <SymbolView name={FROZEN_ICON} size={16} tintColor={colors.textMuted} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// State colors match WeekStrip's trace exactly — captured/frozen/missed/today
// mean the same ink, dash, or gap everywhere the streak is drawn in the app.
function cellStyle(state: DayCellState): ViewStyle {
  const base: ViewStyle = { borderRadius: CELL_RADIUS, overflow: 'hidden' };
  switch (state) {
    case 'captured':
      return base;
    case 'today':
      return { ...base, borderWidth: 1.5, borderColor: colors.trace };
    case 'frozen':
      return { ...base, borderWidth: 1.5, borderColor: colors.accentPressed, borderStyle: 'dashed' };
    case 'missed':
      return { ...base, backgroundColor: colors.gridLine };
    case 'future':
    default:
      return { ...base, borderWidth: 1, borderColor: colors.border };
  }
}
