import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { Mono } from '@/components/atoms/Mono';
import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

type PastDrop = {
  drop_id: string;
  drop_date: string;
  prompt: string | null;
};

type Props = {
  pastDrops: PastDrop[];
  onSelectDate: (dropId: string) => void;
  selectedDate?: string | null;
};

/** Generate all YYYY-MM-DD strings from `start` to `end` inclusive. */
function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function CustomDay({
  date,
  state,
  marking,
  onPress,
  selectedDate,
}: {
  date?: DateData;
  state?: string;
  marking?: { disabled?: boolean; disableTouchEvent?: boolean };
  onPress?: (day: DateData) => void;
  selectedDate?: string | null;
}) {
  if (!date) return <View style={styles.dayCell} />;

  const isSelected = date.dateString === selectedDate;
  const isToday = state === 'today';
  const isDisabled = marking?.disabled;
  const isDrop = marking?.disableTouchEvent === false;

  return (
    <Pressable
      style={styles.dayCell}
      onPress={() => !isDisabled && onPress?.(date)}
      disabled={isDisabled}
    >
      <View
        style={[
          styles.dayNumber,
          isSelected && styles.dayCircleSelected,
          isToday && !isSelected && styles.dayCircleToday,
        ]}
      >
        <Text
          style={[
            styles.dayText,
            isDrop && !isSelected && styles.dayTextDrop,
            isSelected && styles.dayTextSelected,
            isToday && !isSelected && styles.dayTextToday,
            isDisabled && styles.dayTextDisabled,
          ]}
        >
          {date.day}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Calendar view of past drops. Days with a drop are tappable. The
 * selected/viewing date has a filled circle. Today shows a ring outline.
 * All other days are grayed out and untappable.
 */
export function PastDropsCalendar({ pastDrops, onSelectDate, selectedDate }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const dateMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of pastDrops) {
      map[d.drop_date] = d.drop_id;
    }
    return map;
  }, [pastDrops]);

  const sortedDates = useMemo(
    () => pastDrops.map((d) => d.drop_date).filter((d) => d <= today).sort(),
    [pastDrops, today],
  );
  const earliest = sortedDates.length > 0 ? sortedDates[0] : today;

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    for (const date of dateRange(earliest, today)) {
      if (dateMap[date]) {
        marks[date] = {
          customStyles: { container: {}, text: {} },
          selected: date === selectedDate,
          disableTouchEvent: false,
        };
      } else {
        marks[date] = {
          customStyles: { container: {}, text: {} },
          disabled: true,
          disableTouchEvent: true,
        };
      }
    }
    return marks;
  }, [dateMap, earliest, today, selectedDate]);

  const initialMonth = pastDrops.length > 0 ? pastDrops[0].drop_date.slice(0, 7) : undefined;

  const [visibleMonth, setVisibleMonth] = useState(initialMonth ?? today.slice(0, 7));
  const earliestMonth = earliest.slice(0, 7);
  const currentMonth = today.slice(0, 7);

  const handleMonthChange = useCallback((month: { dateString: string }) => {
    setVisibleMonth(month.dateString.slice(0, 7));
  }, []);

  const renderArrow = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left' && visibleMonth <= earliestMonth) return null;
      if (direction === 'right' && visibleMonth >= currentMonth) return null;
      const glyph = direction === 'left' ? '\u2039' : '\u203A';
      return <Text style={styles.arrow}>{glyph}</Text>;
    },
    [visibleMonth, earliestMonth, currentMonth],
  );

  const handleDayPress = (day: DateData) => {
    const dropId = dateMap[day.dateString];
    if (dropId) {
      onSelectDate(dropId);
    }
  };

  if (pastDrops.length === 0) {
    return (
      <View style={styles.empty}>
        <Mono size={typeScale.caption} color={colors.paper40}>
          No past drops yet
        </Mono>
      </View>
    );
  }

  return (
    <Calendar
      current={initialMonth}
      minDate={earliest}
      maxDate={today}
      markingType="custom"
      markedDates={markedDates}
      onDayPress={handleDayPress}
      onMonthChange={handleMonthChange}
      renderArrow={renderArrow}
      dayComponent={({ date, state, marking, onPress }) => (
        <CustomDay date={date} state={state} marking={marking} onPress={onPress} selectedDate={selectedDate} />
      )}
      theme={{
        backgroundColor: colors.ink2,
        calendarBackground: colors.ink2,
        textSectionTitleColor: colors.paper60,
        selectedDayBackgroundColor: colors.safelight,
        selectedDayTextColor: colors.ink,
        todayTextColor: colors.safelight,
        dayTextColor: colors.paper,
        textDisabledColor: colors.paper30,
        arrowColor: colors.paper,
        monthTextColor: colors.paper,
        textDayFontFamily: fonts.sans,
        textDayFontSize: typeScale.sub,
        textMonthFontFamily: fonts.sansMedium,
        textMonthFontSize: typeScale.body,
        textDayHeaderFontFamily: fonts.mono,
        textDayHeaderFontSize: typeScale.caption,
      }}
      style={styles.calendar}
    />
  );
}

const styles = StyleSheet.create({
  calendar: {
    borderRadius: radius.card,
  },
  arrow: {
    fontSize: typeScale.title,
    color: colors.paper,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.gutter * 2,
  },
  dayCell: {
    width: 46,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: colors.safelight,
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: colors.safelight,
  },
  dayText: {
    fontSize: typeScale.sub,
    fontFamily: fonts.sans,
    color: colors.paper60,
  },
  dayTextDrop: {
    color: colors.paper,
    fontFamily: fonts.sansMedium,
  },
  dayTextSelected: {
    color: colors.paper,
    fontFamily: fonts.sansSemiBold,
  },
  dayTextToday: {
    color: colors.safelight,
    fontFamily: fonts.sansSemiBold,
  },
  dayTextDisabled: {
    color: colors.paper40,
  },
});
