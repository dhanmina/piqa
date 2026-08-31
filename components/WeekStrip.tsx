import { View, Text } from 'react-native';
import { colors, spacing, type } from '../lib/theme';

export type DayCellState = 'captured' | 'frozen' | 'today' | 'missed' | 'future';
export type DayCell = { key: string; label: string; state: DayCellState };

const NODE_SIZE = 6;
const TODAY_NODE_SIZE = 10;

// The streak drawn as one continuous ink trace rather than a row of discrete
// cells: captured days join into a solid line, a freeze continues it dashed
// (forgiving, still honest — never erased), a miss is a real gap in the ink,
// and today is the pen head still writing. No SVG/canvas dependency — pure
// View segments, since react-native-svg isn't installed and this doesn't need it.
export function WeekStrip({ days }: { days: DayCell[] }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', height: TODAY_NODE_SIZE + 4 }}>
        {days.map((day, i) => (
          <View key={day.key} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            {i > 0 ? <Segment fromState={days[i - 1].state} toState={day.state} /> : null}
            <Node state={day.state} first={i === 0} />
          </View>
        ))}
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
    return <View style={{ flex: 1, height: 2, backgroundColor: colors.trace }} />;
  }
  if (fromState === 'frozen' && (toState === 'captured' || toState === 'today' || toState === 'frozen')) {
    return (
      <View
        style={{
          flex: 1,
          height: 2,
          borderTopWidth: 2,
          borderColor: colors.accentPressed,
          borderStyle: 'dashed',
        }}
      />
    );
  }
  return <View style={{ flex: 1, height: 2, backgroundColor: colors.gridLine }} />;
}

function Node({ state, first }: { state: DayCellState; first: boolean }) {
  const size = state === 'today' ? TODAY_NODE_SIZE : NODE_SIZE;
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
    marginLeft: first ? 0 : -size / 2,
  };

  if (state === 'today') {
    return (
      <View
        style={[
          style,
          {
            backgroundColor: colors.trace,
            borderWidth: 3,
            borderColor: colors.background,
          },
        ]}
      />
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
