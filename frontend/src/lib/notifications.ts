/**
 * Local task reminders via expo-notifications.
 *
 * A task with a `remind_at` ("HH:MM") gets a repeating local notification at
 * that time, cadenced by its period (daily / weekly / monthly). Everything is
 * wrapped defensively so the app never crashes if notifications are unavailable
 * (e.g. on web or when permission is denied).
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { TaskPeriod } from '../api/client';

let _configured = false;

export async function configureNotifications(): Promise<void> {
  if (_configured || Platform.OS === 'web') return;
  _configured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('tasks', {
        name: 'Przypomnienia o zadaniach',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  } catch { /* ignore */ }
}

export async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

function parseHHMM(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function buildTrigger(period: TaskPeriod, hour: number, minute: number): any {
  const T = Notifications.SchedulableTriggerInputTypes;
  const now = new Date();
  if (period === 'weekly') {
    return { type: T.WEEKLY, weekday: now.getDay() + 1, hour, minute }; // 1=Sun..7=Sat
  }
  if (period === 'monthly') {
    return { type: T.MONTHLY, day: now.getDate(), hour, minute };
  }
  return { type: T.DAILY, hour, minute };
}

/** (Re)schedule a reminder. Returns the notification id, or null if not scheduled. */
export async function scheduleTaskReminder(
  title: string,
  remindAt: string | null,
  period: TaskPeriod,
): Promise<string | null> {
  if (Platform.OS === 'web' || !remindAt) return null;
  const time = parseHHMM(remindAt);
  if (!time) return null;
  if (!(await ensurePermissions())) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: '📝 Przypomnienie',
        body: title || 'Zadanie do wykonania',
        ...(Platform.OS === 'android' ? { channelId: 'tasks' } : {}),
      },
      trigger: buildTrigger(period, time.hour, time.minute),
    });
  } catch {
    return null;
  }
}

export async function cancelReminder(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch { /* ignore */ }
}
