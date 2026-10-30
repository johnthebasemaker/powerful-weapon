// Push notifications (Firebase Cloud Messaging) — real-time messages from the Worker:
//   admin:  "<member> has no tries left" → tap → Voice → Needs a try
//   member: "One more try", "This week's verses are ready"
// Built in only when android/app/google-services.json exists (scripts/build-aab.sh
// sets VITE_PUSH=1); without Firebase the plugin would crash on register().

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from './api';
import { refreshFeed } from './feed';
import { isNative } from './platform';
import { registerDevice } from './remote';
import { useRole } from './role';
import { refreshNotifications } from './scheduler';
import { toast } from './toast';

export const pushAvailable = () => isNative() && import.meta.env.VITE_PUSH === '1';

/** Fired when a push arrives while the app is open, so screens can reload. */
export const PUSH_EVENT = 'pw-push';
/** Fired after an admin or member login, so the phone registers for push straight away. */
export const LOGIN_EVENT = 'pw-login';

function routeFor(action?: string): string | null {
  if (action === 'needs-try') return '/voice-inbox?tab=needs';
  if (action === 'open-record') return '/record';
  if (action === 'open-today') return '/today';
  return null;
}

export function usePush() {
  const { role, memberAuthed } = useRole();
  const navigate = useNavigate();
  const [logins, setLogins] = useState(0);

  useEffect(() => {
    const on = () => setLogins((n) => n + 1);
    window.addEventListener(LOGIN_EVENT, on);
    return () => window.removeEventListener(LOGIN_EVENT, on);
  }, []);

  useEffect(() => {
    if (!pushAvailable() || !role) return;
    let cancelled = false;
    const subs: { remove: () => void }[] = [];

    (async () => {
      const s = (await api().settings.getAll()) as Record<string, string>;
      const loggedIn = role === 'admin' ? !!s.admin_token : memberAuthed && !!s.member_token;
      if (!loggedIn) return;

      await PushNotifications.createChannel({
        id: 'admin-alerts', name: 'Urgent alerts', description: 'A member needs another try',
        importance: 5, visibility: 1, vibration: true, lights: true, lightColor: '#D6B05A',
      }).catch(() => {});

      subs.push(await PushNotifications.addListener('registration', async ({ value }) => {
        const key = `${role}:${s.member_id ?? ''}:${value}`;
        if (s.push_registered === key) return;
        try { await registerDevice(value); await api().settings.set('push_registered', key); } catch { /* retried next launch */ }
      }));
      subs.push(await PushNotifications.addListener('pushNotificationReceived', (n) => {
        const action = n.data?.action;
        if (action === 'open-today') refreshFeed().then(() => refreshNotifications()).catch(() => {});
        window.dispatchEvent(new CustomEvent(PUSH_EVENT, { detail: n.data }));
        toast(n.title ?? 'New message', action === 'needs-try' ? 'error' : 'info', 6000);
      }));
      subs.push(await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const action = notification.data?.action;
        if (action === 'open-today') refreshFeed().then(() => refreshNotifications()).catch(() => {});
        const to = routeFor(action);
        if (to) navigate(to);
      }));

      let perm = (await PushNotifications.checkPermissions()).receive;
      if (perm === 'prompt' || perm === 'prompt-with-rationale') perm = (await PushNotifications.requestPermissions()).receive;
      if (perm === 'granted' && !cancelled) await PushNotifications.register();
    })().catch(() => {});

    return () => { cancelled = true; subs.forEach((h) => h.remove()); };
  }, [role, memberAuthed, navigate, logins]);
}
