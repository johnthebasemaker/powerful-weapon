import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { api } from './api';
import { addDays, currentWeekStart, localIso } from './dates';
import { cachedFeed, refreshFeed, verseFor, WeekFeed } from './feed';
import { isNative } from './platform';
import { getConfig, myStatus } from './remote';
import { translate, Lang } from './strings';

// Daily verse notifications (Android).
//
// Why not one repeating `schedule.on` alarm (0.0.2): after its first fire the
// plugin re-arms it with a non-waking AlarmManager.RTC alarm, so on a sleeping
// phone — and on Oppo/Vivo/Xiaomi battery savers — it only appeared once the
// screen was turned on. Instead we schedule one-shot, wake-up alarms
// (allowWhileIdle) for the next DAYS days, each carrying that day's verse, and
// rebuild the set every time the app starts or comes back to the foreground.
// 30 days ahead: a member who doesn't open the app for weeks still gets a daily
// reminder (days whose verse isn't downloaded yet say "tap to read"; a push
// when the admin publishes brings them back to download it).

const CHANNEL_ID = 'daily-verse';
const BASE_ID = 1000;
const DAYS = 30;
const LEGACY_REPEATING_ID = 1;

function slotOf(d: Date): number {
  const day = d.getDay(); // Sun=0..Sat=6 → Mon=1..Sun=7
  return day === 0 ? 7 : day;
}

function parseTime(t: string): [number, number] {
  const [h, m] = (t || '').split(':').map((n) => parseInt(n, 10));
  return Number.isNaN(h) || Number.isNaN(m) ? [6, 0] : [h, m];
}

interface DayVerse { book: string; chapter: number; verse: number; text: string }

async function adminVerses(): Promise<Map<string, DayVerse>> {
  const out = new Map<string, DayVerse>();
  const ws = currentWeekStart();
  for (const w of [ws, addDays(ws, 7), addDays(ws, 14)]) {
    const sels = (await api().selections.get(w)) as any[];
    for (const s of sels) out.set(`${w}|${s.slot}`, { book: s.book, chapter: s.chapter, verse: s.verse, text: s.text_tamil });
  }
  return out;
}

/** Member's reminder time: their own choice, else the time the admin published, else 06:00. */
export function memberTime(settings: Record<string, string>, weeks: WeekFeed[]): string {
  if (settings.member_time) return settings.member_time;
  const ws = currentWeekStart();
  return weeks.find((w) => w.weekStart === ws)?.sendTime ?? weeks[0]?.sendTime ?? '06:00';
}

export interface RefreshResult { scheduled: number; withVerse: number; permission: string; time: string }

/** Rebuild the next DAYS daily notifications from local selections (admin) or the feed (member). */
export async function refreshNotifications(): Promise<RefreshResult | null> {
  if (!isNative()) return null;
  const settings = (await api().settings.getAll()) as Record<string, string>;
  const role = settings.app_role;
  if (role !== 'admin' && role !== 'member') return null;
  if (settings.notifications_enabled === 'false') {
    await cancelAll();
    return { scheduled: 0, withVerse: 0, permission: 'off', time: '' };
  }

  let perm = (await LocalNotifications.checkPermissions()).display;
  if (perm === 'prompt' || perm === 'prompt-with-rationale') {
    perm = (await LocalNotifications.requestPermissions()).display;
  }
  if (perm !== 'granted') return { scheduled: 0, withVerse: 0, permission: perm, time: '' };

  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Daily verse',
    description: "Today's memory verse at the group's send time",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#2B7A6F',
  });

  const weeks = role === 'member' ? await cachedFeed() : [];
  const admin = role === 'admin' ? await adminVerses() : new Map<string, DayVerse>();
  const time = role === 'member' ? memberTime(settings, weeks) : settings.send_time || '06:00';
  const [hh, mm] = parseTime(time);
  const lang: Lang = settings.ui_lang === 'ta' ? 'ta' : 'en';

  const now = Date.now();
  const list: LocalNotificationSchema[] = [];
  let withVerse = 0;
  for (let i = 0; i < DAYS + 1 && list.length < DAYS; i++) {
    const at = new Date();
    at.setDate(at.getDate() + i);
    at.setHours(hh, mm, 0, 0);
    if (at.getTime() <= now + 30_000) continue;
    const ws = currentWeekStart(at);
    const slot = slotOf(at);
    const v: DayVerse | undefined = role === 'member'
      ? verseFor(weeks, ws, slot)
      : admin.get(`${ws}|${slot}`);
    if (v) withVerse++;
    const ref = v ? `${v.book} ${v.chapter}:${v.verse}` : '';
    const base = {
      id: BASE_ID + list.length,
      channelId: CHANNEL_ID,
      smallIcon: 'ic_stat_verse',
      iconColor: '#1F6158',
      schedule: { at, allowWhileIdle: true },
      extra: { action: role === 'member' ? 'open-today' : 'post-verse', weekStart: ws, slot, date: localIso(at) },
    };
    if (role === 'member') {
      list.push({
        ...base,
        title: v ? `இன்றைய வசனம் · ${ref}` : 'இன்றைய வசனம்',
        body: v ? v.text : translate(lang, 'notif.tapToRead'),
        largeBody: v ? v.text : undefined,
      });
    } else {
      list.push({
        ...base,
        title: v ? `Post today's verse · ${ref}` : "Pick this week's verses",
        body: v ? v.text : 'No verses are saved for this week yet. Tap to open the Verse Picker.',
        largeBody: v ? v.text : undefined,
      });
    }
  }

  list.push(...windowNotifications(settings, role, now, lang));

  await cancelAll();
  if (list.length) await LocalNotifications.schedule({ notifications: list });
  return { scheduled: list.length, withVerse, permission: perm, time };
}

/** Recording-window alerts from the cached server config (see syncAndSchedule). */
function windowNotifications(settings: Record<string, string>, role: string, now: number, lang: Lang): LocalNotificationSchema[] {
  let w: { weekStart: string; opensAt: number; closesAt: number } | undefined;
  try { w = JSON.parse(settings.record_cfg || '{}').window; } catch { return []; }
  if (!w?.opensAt) return [];
  const sent = settings.record_sent_week === w.weekStart;
  const at = (ms: number) => ({ at: new Date(ms), allowWhileIdle: true });
  const base = { channelId: CHANNEL_ID, smallIcon: 'ic_stat_verse', iconColor: '#1F6158' };
  const out: LocalNotificationSchema[] = [];
  const close = new Date(w.closesAt).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  if (role === 'member' && !sent) {
    const ta = lang === 'ta';
    if (w.opensAt > now + 30_000) out.push({ ...base, id: 1100, schedule: at(w.opensAt),
      title: ta ? 'பதிவு செய்யும் நேரம் தொடங்கியது 🎙️' : 'Recording time is open 🎙️',
      body: ta ? `இந்த வாரத்தின் 7 வசனங்களையும் மனப்பாடமாகச் சொல்லி, ${close}-க்குள் அனுப்புங்கள்.` : `Recite this week's 7 verses from memory and send them before ${close}.`,
      extra: { action: 'open-record' } });
    const remind = w.closesAt - 2 * 3600_000;
    if (remind > now + 30_000) out.push({ ...base, id: 1101, schedule: at(remind),
      title: ta ? 'பதிவை அனுப்ப இன்னும் 2 மணி நேரமே உள்ளது' : '2 hours left to send your recording',
      body: ta ? `பதிவு ${close}-க்கு மூடப்படும்.` : `Recording closes ${close}.`, extra: { action: 'open-record' } });
  }
  if (role === 'admin' && w.closesAt > now + 30_000) {
    out.push({ ...base, id: 1102, schedule: at(w.closesAt), title: 'Recording time closed',
      body: "Open Voice → App recordings to mark this week's recordings.", extra: { action: 'open-recordings' } });
  }
  return out;
}

async function cancelAll(): Promise<void> {
  const pending = await LocalNotifications.getPending();
  const ids = pending.notifications.map((n) => ({ id: n.id }));
  ids.push({ id: LEGACY_REPEATING_ID }); // 0.0.2's repeating reminder
  await LocalNotifications.cancel({ notifications: ids });
}

/** Members: pull the latest published week first, then rebuild the schedule. */
export async function syncAndSchedule(): Promise<RefreshResult | null> {
  if (!isNative()) return null;
  const s = (await api().settings.getAll()) as Record<string, string>;
  if (s.app_role === 'member') await refreshFeed();
  // Cache the recording window (and whether this member already sent) for offline scheduling.
  try {
    const cfg = await getConfig();
    await api().settings.set('record_cfg', JSON.stringify(cfg));
    if (s.app_role === 'member' && s.member_token) {
      const st = await myStatus();
      await api().settings.set('record_sent_week', st.sent ? st.window.weekStart : '');
    }
  } catch { /* offline: keep the last cached window */ }
  return refreshNotifications();
}

/** Kept for the scheduler.start() IPC shape used by Settings. */
export async function scheduleDailyPostReminder(_sendTime: string): Promise<void> {
  await refreshNotifications();
}

/** Android 12+: exact alarms need the user's "Alarms & reminders" permission. */
export async function exactAlarmStatus(): Promise<'granted' | 'denied' | 'na'> {
  if (!isNative()) return 'na';
  try {
    const r = await LocalNotifications.checkExactNotificationSetting();
    return r.exact_alarm === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'na';
  }
}

export async function requestExactAlarm(): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.changeExactNotificationSetting();
}

/**
 * Wire once at app boot: tapping a notification opens the right screen, and the
 * schedule is rebuilt on launch and whenever the app returns to the foreground.
 */
export function useNotifications(): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNative()) return;
    const subs: { remove: () => void }[] = [];
    LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const action = event.notification.extra?.action;
      if (action === 'post-verse') navigate('/dashboard');
      else if (action === 'open-today') navigate('/today');
      else if (action === 'open-record') navigate('/record');
      else if (action === 'open-recordings') navigate('/voice-inbox');
    }).then((h) => subs.push(h));
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) syncAndSchedule().catch(() => {});
    }).then((h) => subs.push(h));
    syncAndSchedule().catch(() => {});
    return () => subs.forEach((s) => s.remove());
  }, [navigate]);
}
