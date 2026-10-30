import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api } from '../lib/api';
import { DEFAULT_FEED_URL, lastPublished, publishWeek, refreshFeed } from '../lib/feed';
import { fmtWhen, getConfig, gradingLog, loginAdmin, logoutAdmin, RecordConfig, saveConfig, scorePairs } from '../lib/remote';
import { saveTextFile } from '../lib/exportFile';
import { Calibration, fitCalibration } from '../lib/autoMark';
import AdminGate from '../components/AdminGate';
import { currentWeekStart } from '../lib/dates';
import { isNative } from '../lib/platform';
import { useRole } from '../lib/role';
import { exactAlarmStatus, memberTime, refreshNotifications, requestExactAlarm, syncAndSchedule } from '../lib/scheduler';
import { cachedFeed } from '../lib/feed';
import { toast } from '../lib/toast';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, SectionTitle, Segmented, Select, dayLabel } from '../components/ui';
import type { Settings } from '../types';
import { usePrefs, useT } from '../lib/prefs';

const APP_VERSION = '0.0.6';

export default function SettingsPage() {
  const { role } = useRole();
  return role === 'member' ? <MemberSettings /> : <AdminSettings />;
}

/* ───────────────────────── Admin ───────────────────────── */

function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({});
  const [whisper, setWhisper] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [verseCount, setVerseCount] = useState(0);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  async function load() {
    const [s, w, c, b] = await Promise.all([
      api().settings.getAll(),
      api().whisper.check(),
      api().verses.count(),
      api().backup.lastRun(),
    ]);
    setSettings(s as Settings);
    setWhisper(w as any);
    setVerseCount(c as number);
    setLastBackup(b as string | null);
  }
  useEffect(() => { load(); }, []);

  async function setKey(key: string, value: string) {
    await api().settings.set(key, value);
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function setSendTime(value: string) {
    if (!value) return;
    await setKey('send_time', value);
    await api().scheduler.start(value); // desktop: node-cron · phone: rebuild notifications
    toast(`Daily time set to ${fmtTime(value)}`, 'success', 1800);
  }

  async function pickBackupFolder() {
    const folder = (await api().backup.pickFolder()) as string | null;
    if (folder) setKey('backup_folder', folder);
  }

  async function runBackup() {
    const r = await api().backup.runNow();
    if (r.ok) {
      setLastBackup(r.path);
      if (!isNative()) toast(`Backup written: ${r.path}`, 'success', 5000);
    } else {
      toast(`Backup failed: ${r.error}`, 'error', 5000);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Daily time, members, notifications and grading." />

      <Card className="space-y-4">
        <SectionTitle>Daily verse</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Send time (IST)" hint="Your reminder to post — and members' notification time.">
            <Input type="time" value={settings.send_time ?? '06:00'} onChange={(e) => setSendTime(e.target.value)} />
          </Field>
          <Field label="WhatsApp group name" hint="Just a label for you.">
            <Input value={settings.group_name ?? ''} onChange={(e) => setKey('group_name', e.target.value)} placeholder="e.g. Powerful Weapon Group" />
          </Field>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          WhatsApp doesn't let apps post into groups by themselves. At send time you get a notification; tap it,
          tap <strong>Post</strong>, choose the group and press Send.
        </p>
        {settings.send_time === '00:00' && (
          <Notice tone="warn">Your send time is <strong>12:00 AM (midnight)</strong>. Most groups prefer an early-morning time like 6:00 AM.</Notice>
        )}
      </Card>

      <AdminAccountCard />
      <AdminGate what="set the recording time"><RecordingWindowCard /></AdminGate>
      <MarkingCard />

      {isNative() && <NotificationsCard />}

      {isNative() ? (
        <MobileSttSection
          url={settings.stt_proxy_url ?? ''}
          secret={settings.stt_proxy_secret ?? ''}
          onSave={async (url, secret) => { await setKey('stt_proxy_url', url); await setKey('stt_proxy_secret', secret); toast('Saved', 'success', 1500); load(); }}
        />
      ) : (
        <WhisperSection whisperOk={whisper?.ok ?? false} whisperReason={whisper?.reason} onChange={load} />
      )}

      <Card className="space-y-3">
        <SectionTitle>Backup</SectionTitle>
        {isNative() ? (
          <>
            <p className="text-sm text-gray-600">Save members, verse selections, grades and settings as a file — send it to Google Drive, email or WhatsApp.</p>
            <Button variant="secondary" block onClick={runBackup}>Export backup file</Button>
          </>
        ) : (
          <>
            <Field label="Backup folder" hint="Choose a folder synced by Google Drive / iCloud / Dropbox for offsite safety.">
              <div className="flex gap-2">
                <Input value={settings.backup_folder ?? ''} readOnly placeholder="No folder selected" className="bg-gray-50 min-w-0" />
                <Button variant="secondary" onClick={pickBackupFolder}>Browse…</Button>
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Frequency (days)">
                <Input type="number" min={1} max={30} value={settings.backup_frequency_days ?? '7'} onChange={(e) => setKey('backup_frequency_days', e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:pt-7">
                <input type="checkbox" className="w-5 h-5 accent-brand-600" checked={settings.backup_enabled === 'true'}
                  onChange={(e) => setKey('backup_enabled', e.target.checked ? 'true' : 'false')} />
                Automatic backups
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={runBackup}>Run backup now</Button>
              {lastBackup && <span className="text-xs text-gray-500 truncate">Last: {lastBackup}</span>}
            </div>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Bible database</SectionTitle>
        <p className="text-sm text-gray-700">
          {verseCount.toLocaleString('en-IN')} verses loaded.
          {verseCount < 1000 && <span className="text-amber-700"> (Sample only — see README to load the full Tamil OV.)</span>}
        </p>
      </Card>

      <DisplayCard />
      {isNative() && <SwitchModeCard to="member" />}
      <About />
    </div>
  );
}

function AdminAccountCard() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<{ weekStart: string; at: string } | null>(null);
  const [url, setUrl] = useState('');
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    api().settings.getAll().then((s: any) => { setLoggedIn(!!s.admin_token); setUrl(s.feed_url ?? ''); });
    lastPublished().then(setPublished);
  }, []);

  async function publishNow() {
    setBusy(true);
    const r = await publishWeek(currentWeekStart());
    setBusy(false);
    if (r.ok) { toast("This week is on members' phones", 'success'); setPublished(await lastPublished()); }
    else toast(r.error ?? 'Publish failed', 'error', 5000);
  }

  return (
    <Card className="space-y-3">
      <SectionTitle action={loggedIn ? <Badge tone="green">Logged in</Badge> : <Badge tone="amber">Not logged in</Badge>}>
        Admin account
      </SectionTitle>
      {loggedIn === false && (
        <AdminGate what="manage members, recordings and the verse feed"><span /></AdminGate>
      )}
      {loggedIn && (
        <>
          <p className="text-sm text-gray-600 leading-relaxed">
            Saving a week in the Verse Picker sends its 7 verses to members' phones. The admin password can only be
            changed by the app owner on the server.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={publishNow} disabled={busy}>Publish this week</Button>
            <Button variant="secondary" onClick={async () => { await logoutAdmin(); setLoggedIn(false); }}>Log out</Button>
          </div>
          {published && (
            <p className="text-xs text-gray-500">Last published: week of {dayLabel(published.weekStart)} · {new Date(published.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          )}
        </>
      )}
      {advanced ? (
        <Field label="Server URL" hint="Leave blank for the group's default Worker.">
          <Input type="url" value={url} placeholder={DEFAULT_FEED_URL} onChange={(e) => setUrl(e.target.value)}
            onBlur={() => api().settings.set('feed_url', url.trim())} />
        </Field>
      ) : (
        <button className="text-xs text-brand-700 font-medium" onClick={() => setAdvanced(true)}>Advanced: server URL</button>
      )}
    </Card>
  );
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function RecordingWindowCard() {
  const [cfg, setCfg] = useState<RecordConfig | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getConfig().then(setCfg).catch((e) => setError(e.message)); }, []);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      const { window: _w, ...rest } = cfg;
      setCfg(await saveConfig(rest));
      toast('Recording time saved', 'success');
    } catch (e: any) { toast(e.message, 'error', 5000); } finally { setSaving(false); }
  }

  const set = (k: keyof RecordConfig, v: string) => cfg && setCfg({ ...cfg, [k]: v });
  const ext = Number(cfg?.extend_days ?? 0);
  const lastDay = cfg ? DAYS[(Number(cfg.record_dow) - 1 + ext) % 7] : '';

  return (
    <Card className="space-y-4">
      <SectionTitle>Recording time</SectionTitle>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {cfg && (
        <>
          <p className="text-sm text-gray-600">Weeks start on Monday. Members can record only inside this window.</p>
          <Field label="Recording day">
            <Select value={cfg.record_dow} onChange={(e) => set('record_dow', e.target.value)}>
              {DAYS.map((d, i) => <option key={d} value={String(i + 1)}>{d}{i === 6 ? ' (last day of the week)' : ''}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opens at"><Input type="time" value={cfg.record_from} onChange={(e) => set('record_from', e.target.value)} /></Field>
            <Field label="Closes at"><Input type="time" value={cfg.record_to} onChange={(e) => set('record_to', e.target.value)} /></Field>
          </div>
          <Field label="Extra days" hint={ext ? `Stays open until ${lastDay} at the closing time.` : 'Closes the same day.'}>
            <Segmented value={cfg.extend_days} onChange={(v) => set('extend_days', v)}
              options={[{ value: '0', label: 'None' }, { value: '1', label: '+1 day' }, { value: '2', label: '+2 days' }]} />
          </Field>
          <Field label="Tries per member" hint="You can give a member one more try any time from Voice → Needs a try.">
            <Select value={cfg.max_takes} onChange={(e) => set('max_takes', e.target.value)}>
              {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => <option key={n} value={n}>{n} {n === '1' ? 'try' : 'tries'}{n === '5' ? ' (default)' : ''}</option>)}
            </Select>
          </Field>
          <Notice tone={cfg.window.open ? 'ok' : 'info'}>
            {cfg.window.open ? `Open now — closes ${fmtWhen(cfg.window.closesAt)}` : `Next: ${fmtWhen(cfg.window.opensAt)} → ${fmtWhen(cfg.window.closesAt)}`}
          </Notice>
          <Button block onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save recording time'}</Button>
        </>
      )}
    </Card>
  );
}

function MarkingCard() {
  const [engine, setEngine] = useState('whisper');
  const [useCalib, setUseCalib] = useState(true);
  const [calib, setCalib] = useState<Calibration | null>(null);
  const [pairs, setPairs] = useState(0);

  async function exportLog() {
    try {
      const rows = await gradingLog();
      const weeks = Array.from(new Set(rows.map((r) => r.week_start)));
      const verses: Record<string, unknown[]> = {};
      for (const w of weeks) {
        verses[w] = ((await api().selections.get(w)) as any[]).map((x) => ({ slot: x.slot, ref: `${x.book} ${x.chapter}:${x.verse}`, text: x.text_tamil }));
      }
      const log = {
        exportedAt: new Date().toISOString(), app: APP_VERSION, calibration: calib, engineSetting: engine,
        summary: {
          recordings: rows.length,
          bothMarked: rows.filter((r) => r.auto_total != null && r.manual_total != null).length,
          avgGap: (() => { const p = rows.filter((r) => r.auto_total != null && r.manual_total != null); return p.length ? +(p.reduce((a, r) => a + Math.abs(r.auto_total! - r.manual_total!), 0) / p.length).toFixed(1) : null; })(),
        },
        verses,
        recordings: rows.map((r) => ({ ...r, auto_json: (() => { try { return JSON.parse(r.auto_json || 'null'); } catch { return r.auto_json; } })() })),
      };
      await saveTextFile(`grading-log-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(log, null, 1), 'application/json');
      toast(`Exported ${rows.length} recordings`, 'success');
    } catch (e: any) { toast(e.message, 'error', 5000); }
  }

  useEffect(() => {
    api().settings.getAll().then((s: any) => { setEngine(s.mark_engine || 'whisper'); setUseCalib(s.use_calibration !== 'false'); });
    scorePairs().then((p) => { setPairs(p.length); setCalib(fitCalibration(p)); }).catch(() => {});
  }, []);

  return (
    <Card className="space-y-3">
      <SectionTitle>Auto-marking</SectionTitle>
      <Field label="Speech engine" hint="Whisper is free (Groq). Sarvam is built for Indian languages — needs SARVAM_API_KEY on the Worker. Use “Compare engines” on a recording to decide.">
        <Select value={engine} onChange={async (e) => { setEngine(e.target.value); await api().settings.set('mark_engine', e.target.value); }}>
          <option value="whisper">Whisper large-v3 (Groq)</option>
          <option value="sarvam">Sarvam Saaras</option>
        </Select>
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="w-5 h-5 mt-0.5 accent-brand-600" checked={useCalib}
          onChange={async (e) => { setUseCalib(e.target.checked); await api().settings.set('use_calibration', e.target.checked ? 'true' : 'false'); }} />
        <span>Learn from my marks — adjust auto marks to match how I mark.</span>
      </label>
      <p className="text-xs text-gray-500">
        {calib
          ? `Learnt from ${calib.n} recordings you marked: average gap ${calib.maeBefore.toFixed(1)} → ${calib.maeAfter.toFixed(1)} points.`
          : `Give your own mark to ${Math.max(0, 8 - pairs)} more auto-marked recording${8 - pairs === 1 ? '' : 's'} to start learning (${pairs}/8).`}
      </p>
      <div className="rounded-xl bg-gray-50 p-3 space-y-2">
        <p className="text-sm text-gray-700 leading-relaxed">
          <strong>Grading log</strong> — every recording with the AI's mark, what it heard, and your mark. During a trial,
          auto-mark <em>and</em> give your own mark to each recording, then export this and send it to the developer to tune the marking.
        </p>
        <Button variant="secondary" block onClick={exportLog}>Export grading log</Button>
      </div>
    </Card>
  );
}

/* ───────────────────────── Member ───────────────────────── */

function MemberSettings() {
  const t = useT();
  const [settings, setSettings] = useState<Settings>({});
  const [time, setTime] = useState('06:00');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const s = (await api().settings.getAll()) as Settings;
    setSettings(s);
    setTime(memberTime(s, await cachedFeed()));
  }
  useEffect(() => { load(); }, []);

  async function changeTime(v: string) {
    if (!v) return;
    await api().settings.set('member_time', v);
    setTime(v);
    await refreshNotifications();
    toast(t('settings.reminderSet', { time: fmtTime(v) }), 'success', 1800);
  }

  async function useGroupTime() {
    await api().settings.set('member_time', '');
    await load();
    await refreshNotifications();
  }

  async function toggle(on: boolean) {
    await api().settings.set('notifications_enabled', on ? 'true' : 'false');
    setSettings((s) => ({ ...s, notifications_enabled: on ? 'true' : 'false' }));
    await refreshNotifications();
  }

  async function refreshNow() {
    setRefreshing(true);
    const r = await refreshFeed();
    await refreshNotifications();
    setRefreshing(false);
    toast(r.error ?? t('settings.updated'), r.error ? 'error' : 'success');
    load();
  }

  const enabled = settings.notifications_enabled !== 'false';

  return (
    <div className="space-y-4">
      <PageHeader title={t('settings.title')} />

      <DisplayCard member />

      <Card className="space-y-4">
        <SectionTitle
          action={
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="w-5 h-5 accent-brand-600" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
              {enabled ? t('common.on') : t('common.off')}
            </label>
          }
        >
          {t('settings.reminder')}
        </SectionTitle>
        <Field label={t('settings.reminderTime')} hint={settings.member_time ? t('settings.ownTime') : t('settings.groupTime')}>
          <Input type="time" value={time} disabled={!enabled} onChange={(e) => changeTime(e.target.value)} />
        </Field>
        {settings.member_time && <button className="text-sm text-brand-700 font-medium" onClick={useGroupTime}>{t('settings.useGroupTime')}</button>}
      </Card>

      {isNative() && <NotificationsCard />}

      <Card className="space-y-3">
        <SectionTitle>{t('settings.verses')}</SectionTitle>
        <p className="text-sm text-gray-600">
          {settings.feed_fetched_at
            ? t('settings.lastUpdated', { when: new Date(settings.feed_fetched_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) })
            : t('settings.notDownloaded')}
        </p>
        <Button variant="secondary" block onClick={refreshNow} disabled={refreshing}>{refreshing ? t('settings.updating') : t('settings.updateNow')}</Button>
      </Card>

      <MemberAccountCard name={settings.member_name} />
      {isNative() && <SwitchModeCard to="admin" />}
      <About />
    </div>
  );
}

/* ───────────────────────── Shared ───────────────────────── */

function NotificationsCard() {
  const t = useT();
  const [perm, setPerm] = useState<string>('…');
  const [exact, setExact] = useState<'granted' | 'denied' | 'na'>('na');
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [showBattery, setShowBattery] = useState(false);

  async function check() {
    setPerm((await LocalNotifications.checkPermissions()).display);
    setExact(await exactAlarmStatus());
    setScheduled((await LocalNotifications.getPending()).notifications.filter((n) => n.id >= 1000).length);
  }
  useEffect(() => {
    check();
    const onFocus = () => check(); // returning from Android settings
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, []);

  async function allow() {
    const p = await LocalNotifications.requestPermissions();
    setPerm(p.display);
    if (p.display === 'granted') { await syncAndSchedule(); check(); }
  }

  async function test() {
    if (perm !== 'granted') { await allow(); return; }
    await LocalNotifications.schedule({
      notifications: [{
        id: 999, channelId: 'daily-verse', smallIcon: 'ic_stat_verse', iconColor: '#1F6158',
        title: t('notif.testTitle'), body: t('notif.testBody'),
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      }],
    });
    toast(t('notif.testToast'), 'info', 5000);
  }

  return (
    <Card className="space-y-3">
      <SectionTitle>{t('notif.title')}</SectionTitle>
      <StatusRow label={t('notif.title')} ok={perm === 'granted'} okText={t('notif.allowed')} badText={perm === 'denied' ? t('notif.blocked') : t('notif.notAllowed')}
        action={perm !== 'granted' && <Button size="sm" onClick={allow}>{t('notif.allow')}</Button>} />
      {exact !== 'na' && (
        <StatusRow label={t('notif.exact')} ok={exact === 'granted'} okText={t('notif.onTime')} badText={t('notif.mayBeLate')}
          action={exact !== 'granted' && <Button size="sm" variant="secondary" onClick={async () => { await requestExactAlarm(); check(); }}>{t('notif.fix')}</Button>} />
      )}
      {scheduled !== null && perm === 'granted' && (
        <p className="text-xs text-gray-500">{t('notif.scheduled', { n: scheduled })}</p>
      )}
      {perm === 'denied' && (
        <Notice tone="warn">{t('notif.blockedHelp')}</Notice>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={test}>{t('notif.test')}</Button>
        <Button variant="secondary" onClick={() => setShowBattery(!showBattery)}>{t('notif.battery')}</Button>
      </div>
      {showBattery && (
        <div className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 space-y-2 leading-relaxed">
          <p>{t('notif.batteryIntro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Oppo / Realme / OnePlus:</strong> Settings → Battery → App battery management (or More settings) → Powerful Weapon → allow <em>Auto launch</em> and <em>Background activity</em>.</li>
            <li><strong>Vivo / iQOO:</strong> Settings → Battery → Background power consumption → Powerful Weapon → Allow.</li>
            <li><strong>Xiaomi / Redmi / Poco:</strong> Settings → Apps → Powerful Weapon → Autostart on, Battery saver → No restrictions.</li>
            <li><strong>Samsung:</strong> Settings → Battery → Background usage limits → Never sleeping apps → add Powerful Weapon.</li>
          </ul>
          <p className="text-xs text-gray-500">{t('notif.batteryAfter')}</p>
        </div>
      )}
    </Card>
  );
}

function MemberAccountCard({ name }: { name?: string }) {
  const { signOutMember } = useRole();
  const t = useT();
  return (
    <Card>
      <SectionTitle>{t('settings.account')}</SectionTitle>
      <p className="text-sm text-gray-600 mb-3">{t('settings.loggedInAs', { name: name || '—' })}</p>
      <Button variant="secondary" block onClick={async () => { if (confirm(t('settings.logoutConfirm'))) await signOutMember(); }}>{t('settings.logout')}</Button>
    </Card>
  );
}

function DisplayCard({ member }: { member?: boolean }) {
  const t = useT();
  const { lang, textSize, theme, set } = usePrefs();
  return (
    <Card className="space-y-4">
      <SectionTitle>{t('settings.display')}</SectionTitle>
      {member && (
        <Field label={t('settings.language')}>
          <Segmented value={lang} onChange={(v) => set('ui_lang', v)} options={[{ value: 'en', label: 'English' }, { value: 'ta', label: 'தமிழ்' }]} />
        </Field>
      )}
      <Field label={t('settings.textSize')}>
        <Segmented value={textSize} onChange={(v) => set('text_size', v)}
          options={[{ value: 'normal', label: t('size.normal') }, { value: 'large', label: t('size.large') }, { value: 'xl', label: t('size.xl') }]} />
      </Field>
      <Field label={t('settings.theme')}>
        <Segmented value={theme} onChange={(v) => set('theme', v)}
          options={[{ value: 'system', label: t('theme.system') }, { value: 'light', label: t('theme.light') }, { value: 'dark', label: t('theme.dark') }]} />
      </Field>
    </Card>
  );
}

function StatusRow({ label, ok, okText, badText, action }: { label: string; ok: boolean; okText: string; badText: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="flex items-center gap-2">
        <Badge tone={ok ? 'green' : 'amber'}>{ok ? okText : badText}</Badge>
        {action}
      </span>
    </div>
  );
}

function SwitchModeCard({ to }: { to: 'admin' | 'member' }) {
  const { setRole } = useRole();
  const t = useT();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function finish() {
    await setRole(to);
    syncAndSchedule().catch(() => {});
    navigate(to === 'admin' ? '/dashboard' : '/today', { replace: true });
  }

  async function go() {
    if (to === 'admin') { setAsking(true); return; }
    if (!confirm('Switch this phone to member mode? You will need a member name and PIN. Your admin data stays on the phone.')) return;
    await finish();
  }

  async function confirmAdmin() {
    setError('');
    try { await loginAdmin(password); await finish(); } catch (e: any) { setError(e.message); }
  }

  return (
    <Card>
      <SectionTitle>{t('mode.title')}</SectionTitle>
      <p className="text-sm text-gray-600 mb-3">
        {to === 'admin' ? t('mode.isMember') : 'This phone is in admin mode.'}
      </p>
      {asking ? (
        <div className="space-y-2">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('mode.password')} />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button block disabled={!password} onClick={confirmAdmin}>{t('mode.switch')}</Button>
        </div>
      ) : (
        <Button variant="secondary" block onClick={go}>{to === 'admin' ? t('mode.imAdmin') : 'Switch to member mode'}</Button>
      )}
    </Card>
  );
}

function About() {
  const t = useT();
  return (
    <div className="text-center text-xs text-gray-400 py-4 space-y-1">
      <img src="brand/icon-192.png" alt="" className="w-12 h-12 rounded-xl mx-auto mb-2 opacity-90" />
      <div>Powerful Weapon v{APP_VERSION}</div>
      <div>{t('about.nonCommercial')}</div>
    </div>
  );
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function MobileSttSection({ url, secret, onSave }: {
  url: string; secret: string; onSave: (url: string, secret: string) => void;
}) {
  const [u, setU] = useState(url);
  const [s, setS] = useState(secret);
  useEffect(() => { setU(url); setS(secret); }, [url, secret]);
  return (
    <Card className="space-y-3">
      <SectionTitle action={url ? <Badge tone="green">Ready</Badge> : <Badge tone="amber">Not set</Badge>}>Voice grading</SectionTitle>
      <p className="text-sm text-gray-600">
        Voice notes are transcribed by your speech-to-text Worker, which keeps the API key off the phone.
      </p>
      <Field label="Speech-to-text URL">
        <Input type="url" value={u} onChange={(e) => setU(e.target.value)} placeholder="https://your-worker.workers.dev" />
      </Field>
      <Field label="Proxy secret (optional)" hint="Only if PROXY_SECRET is set on the Worker.">
        <Input type="password" value={s} onChange={(e) => setS(e.target.value)} placeholder="Proxy secret" autoComplete="off" />
      </Field>
      <Button block onClick={() => onSave(u.trim(), s.trim())}>Save</Button>
    </Card>
  );
}

interface ModelStatus {
  installed: boolean;
  partial: boolean;
  bytes: number;
  expectedBytes: number;
  location: string;
}

interface DownloadProgress {
  stage: 'connecting' | 'downloading' | 'done' | 'cancelled' | 'error';
  bytes?: number;
  total?: number;
  percent?: number;
  error?: string;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function WhisperSection({ whisperOk, whisperReason, onChange }: {
  whisperOk: boolean; whisperReason?: string; onChange: () => void;
}) {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  async function refresh() {
    const s = (await api().whisper.modelStatus()) as ModelStatus;
    setStatus(s);
  }

  useEffect(() => {
    refresh();
    const off = api().on('whisper:download-progress', (p: DownloadProgress) => {
      setProgress(p);
      if (p.stage === 'done' || p.stage === 'error' || p.stage === 'cancelled') {
        setDownloading(false);
        refresh();
        if (p.stage === 'done') onChange();
      }
    });
    return () => off();
  }, []);

  async function startDownload() {
    setDownloading(true);
    setProgress({ stage: 'connecting' });
    const r = await api().whisper.downloadModel();
    setDownloading(false);
    if (!r.ok && r.error !== 'Cancelled') {
      alert(`Download failed: ${r.error}`);
    }
    refresh();
    onChange();
  }

  async function cancel() {
    await api().whisper.cancelDownload();
  }

  async function remove() {
    if (!confirm('Delete the downloaded Whisper model? You can re-download it later, but it\'s a 3 GB transfer.')) return;
    await api().whisper.deleteModel();
    refresh();
    onChange();
  }

  const pct = progress?.percent ?? (progress?.bytes && progress?.total
    ? (progress.bytes / progress.total) * 100 : 0);

  return (
    <Card>
      <SectionTitle>Speech-to-text (Whisper)</SectionTitle>

      {whisperOk ? (
        <div className="space-y-3">
          <div className="text-sm text-emerald-700">✅ Whisper is set up and ready.</div>
          {status?.installed && (
            <div className="text-xs text-gray-500 space-y-0.5">
              <div>Size: <strong>{formatBytes(status.bytes)}</strong></div>
              <div>Location: <code className="text-xs">{status.location}</code></div>
            </div>
          )}
          <button onClick={remove} className="text-xs text-red-600 hover:underline">
            Delete model (frees ~3 GB)
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm space-y-1">
            <div className="text-amber-900">
              ⚠️ <strong>Speech-to-text engine not installed.</strong>
            </div>
            <p className="text-amber-800">
              Voice notes can be imported but won't be auto-graded until you download the model. It's a one-time ~3 GB download from Hugging Face. Lives in your user data folder so app updates won't wipe it.
            </p>
            {whisperReason && (
              <code className="block text-xs bg-white border border-amber-200 rounded p-1.5 mt-1 break-all">
                {whisperReason}
              </code>
            )}
          </div>

          {!downloading && (
            <div className="flex items-center gap-3">
              <button
                onClick={startDownload}
                className="px-4 py-2 bg-brand-500 text-white text-sm rounded-md hover:bg-brand-600"
              >
                {status?.partial ? `Resume download (${formatBytes(status.bytes)} / ${formatBytes(status.expectedBytes)})` : 'Download model (~3 GB)'}
              </button>
              {status?.partial && (
                <button onClick={remove} className="text-xs text-gray-600 hover:underline">
                  Start over
                </button>
              )}
            </div>
          )}

          {downloading && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {progress.stage === 'connecting' && 'Connecting to Hugging Face…'}
                  {progress.stage === 'downloading' && 'Downloading model…'}
                  {progress.stage === 'error' && `Error: ${progress.error}`}
                </span>
                <span className="text-gray-500 text-xs tabular-nums">
                  {progress.bytes !== undefined && progress.total !== undefined
                    ? `${formatBytes(progress.bytes)} / ${formatBytes(progress.total)}`
                    : ''}
                </span>
              </div>
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                />
              </div>
              <button onClick={cancel} className="text-xs text-red-600 hover:underline">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
