'use no memo';
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { StreakWidget } from './StreakWidget';

// The OS-driven WIDGET_UPDATE tick runs in a headless JS instance with no
// Supabase session (nothing persists it there), so it can't fetch a fresh
// streak count — it intentionally no-ops and leaves the last bitmap that
// today.tsx pushed via requestWidgetUpdate on the app's last foreground open.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_RESIZED':
      props.renderWidget(<StreakWidget streakCount={0} capturedToday={false} />);
      break;
    default:
      break;
  }
}
