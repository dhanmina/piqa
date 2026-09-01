import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Foreground presentation is set here (not app/_layout.tsx) so it's configured
// wherever this module first loads -- settings.tsx and the onboarding
// permissions screen both import it, and a once-daily reminder rarely fires
// while the app is actually open, but it should still show up if it does.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const STORAGE_KEY = 'piqa/reminder-prefs';
const NOTIFICATION_ID = 'piqa-daily-reminder';

export type ReminderTime = { hour: number; minute: number };

// One reminder a day, evening by default -- most captures land earlier in the
// day, so this nudges someone who hasn't shot anything before the day is gone.
export const DEFAULT_REMINDER_TIME: ReminderTime = { hour: 20, minute: 0 };

export const REMINDER_TIME_PRESETS: { label: string; time: ReminderTime }[] = [
  { label: 'Morning · 9:00 AM', time: { hour: 9, minute: 0 } },
  { label: 'Afternoon · 2:00 PM', time: { hour: 14, minute: 0 } },
  { label: 'Evening · 8:00 PM', time: { hour: 20, minute: 0 } },
];

type ReminderPrefs = { enabled: boolean; time: ReminderTime };

async function readPrefs(): Promise<ReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, time: DEFAULT_REMINDER_TIME };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      time: parsed.time ?? DEFAULT_REMINDER_TIME,
    };
  } catch {
    return { enabled: false, time: DEFAULT_REMINDER_TIME };
  }
}

async function writePrefs(prefs: ReminderPrefs): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export async function getReminderPrefs(): Promise<ReminderPrefs> {
  return readPrefs();
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getNotificationPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return String(status) as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  const { status } = await Notifications.requestPermissionsAsync();
  return String(status) as PermissionState;
}

async function scheduleAt(time: ReminderTime): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: { title: 'piqa', body: "Today's photo is still waiting." },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: time.hour,
      minute: time.minute,
    },
  });
}

// Called from Settings' toggle and from onboarding once notification
// permission is granted there -- same underlying schedule either way.
export async function setReminderEnabled(enabled: boolean, time?: ReminderTime): Promise<void> {
  const prefs = await readPrefs();
  const nextTime = time ?? prefs.time;
  await writePrefs({ enabled, time: nextTime });

  if (enabled) {
    await scheduleAt(nextTime);
  } else {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});
  }
}

export async function setReminderTime(time: ReminderTime): Promise<void> {
  const prefs = await readPrefs();
  await writePrefs({ enabled: prefs.enabled, time });
  if (prefs.enabled) await scheduleAt(time);
}
