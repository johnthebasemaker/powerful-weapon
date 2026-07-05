import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './platform';

const DAILY_REMINDER_ID = 1;

/**
 * Mobile replacement for node-cron: schedule a repeating daily notification at
 * the admin's send-time. Tapping it opens the app to post the day's verse.
 * Desktop keeps its node-cron scheduler via IPC, so this no-ops off-native.
 */
export async function scheduleDailyPostReminder(sendTime: string): Promise<void> {
  if (!isNative()) return;
  const [hour, minute] = sendTime.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return;

  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return;

  await LocalNotifications.cancel({ notifications: [{ id: DAILY_REMINDER_ID }] });
  await LocalNotifications.schedule({
    notifications: [{
      id: DAILY_REMINDER_ID,
      title: "Post today's verse",
      body: 'Tap to open WhatsApp with the verse ready to send.',
      schedule: { on: { hour, minute }, repeats: true },
      extra: { action: 'post-verse' },
    }],
  });
}

/**
 * Wire once at app boot (App.tsx): tapping the daily reminder opens the Dashboard,
 * where today's unposted verse is already surfaced as "waiting to send".
 */
export function useReminderTap(): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNative()) return;
    let sub: { remove: () => void } | undefined;
    LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      if (event.notification.extra?.action === 'post-verse') navigate('/dashboard');
    }).then((h) => { sub = h; });
    return () => sub?.remove();
  }, [navigate]);
}
