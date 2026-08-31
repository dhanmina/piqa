import { View, Text } from 'react-native';
import { colors, spacing, type } from '../lib/theme';

export type DayCellState = 'captured' | 'frozen' | 'today' | 'missed' | 'future';
export type DayCell = { key: string; label: string; state: DayCellState };

const NODE_SIZE = 6;
const TODAY_NODE_SIZE = 8;
const TODAY_HALO_SIZE = 16;

// The streak drawn as one continuous ink trace rather than a row of discrete
// cells: captured days join into a solid line, a freeze continues it dashed
// (forgiving, still honest — never erased), a miss is a real gap in the ink,
// and today is the pen head still writing. No SVG/canvas dependency — pure
// View segments, since react-native-svg isn't installed and this doesn't need it.
export function WeekStrip({ days }: { days: DayCell[] }) {
  const columnWidthPct = 100 / days.length;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ position: 'relative', height: TODAY_HALO_SIZE, justifyContent: 'center' }}>
        {/* Line lives on its own absolute layer, positioned purely by column-center
            percentages, so it never has to fight fixed-size nodes for flex space
            (which is what caused the day-over-day drift). */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: (TODAY_HALO_SIZE - 2) / 2, height: 2 }}>
          {days.slice(0, -1).map((day, i) => (
            <View
              key={day.key}
              style={{
                position: 'absolute',
                left: `${(i + 0.5) * columnWidthPct}%`,
                width: `${columnWidthPct}%`,
                height: 2,
              }}
            >
              <Segment fromState={day.state} toState={days[i + 1].state} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row' }}>
          {days.map((day) => (
            <View key={day.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Node state={day.state} />
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {days.map((day) => (
          <Text
            key={day.key}
            style={{
              ...type.data,
              fontSize: 10,
              flex: 1,
              textAlign: 'center',
              color: day.state === 'today' ? colors.textPrimary : colors.textFaint,
            }}
          >
            {day.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// A segment renders between two nodes and takes the *earlier* day's state — the
// line records what already happened up to that point, not what's ahead of it.
function Segment({ fromState, toState }: { fromState: DayCellState; toState: DayCellState }) {
  if (fromState === 'captured' && (toState === 'captured' || toState === 'today')) {
    return <View style={{ width: '100%', height: 2, backgroundColor: colors.trace }} />;
  }
  if (fromState === 'frozen' && (toState === 'captured' || toState === 'today' || toState === 'frozen')) {
    return (
      <View
        style={{
          width: '100%',
          height: 2,
          borderTopWidth: 2,
          borderColor: colors.accentPressed,
          borderStyle: 'dashed',
        }}
      />
    );
  }
  return <View style={{ width: '100%', height: 2, backgroundColor: colors.gridLine }} />;
}

function Node({ state }: { state: DayCellState }) {
  const size = state === 'today' ? TODAY_NODE_SIZE : NODE_SIZE;
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (state === 'today') {
    return (
      <View
        style={{
          width: TODAY_HALO_SIZE,
          height: TODAY_HALO_SIZE,
          borderRadius: TODAY_HALO_SIZE / 2,
          borderWidth: 1.5,
          borderColor: colors.trace,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={[style, { backgroundColor: colors.trace }]} />
      </View>
    );
  }
  if (state === 'captured') {
    return <View style={[style, { backgroundColor: colors.trace }]} />;
  }
  if (state === 'frozen') {
    return <View style={[style, { backgroundColor: colors.accentPressed }]} />;
  }
  if (state === 'missed') {
    return <View style={[style, { backgroundColor: colors.gridLine }]} />;
  }
  // future
  return <View style={[style, { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background }]} />;
}
