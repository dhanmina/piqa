'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { colors, type, spacing, radius } from '../lib/theme';

export type StreakWidgetProps = {
  streakCount: number;
  capturedToday: boolean;
};

export function StreakWidget({ streakCount, capturedToday }: StreakWidgetProps) {
  return (
    <FlexWidget
      clickAction={capturedToday ? 'OPEN_APP' : 'OPEN_URI'}
      clickActionData={capturedToday ? undefined : { uri: 'piqa://capture' }}
      accessibilityLabel="piqa streak"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        padding: spacing.md,
      }}
    >
      <TextWidget
        text={String(streakCount)}
        style={{ ...type.hero, color: colors.accent }}
      />
      <TextWidget
        text={streakCount > 0 ? 'day streak' : 'start today'}
        style={{ ...type.caption, color: colors.textMuted, marginTop: spacing.xxs }}
      />
      {!capturedToday ? (
        <TextWidget
          text="Tap to capture"
          style={{ ...type.caption, color: colors.textPrimary, marginTop: spacing.sm }}
        />
      ) : null}
    </FlexWidget>
  );
}
