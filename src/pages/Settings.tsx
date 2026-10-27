import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api } from '../lib/api';
import { checkAdminKey, DEFAULT_FEED_URL, lastPublished, publishWeek, refreshFeed } from '../lib/feed';
import { currentWeekStart } from '../lib/dates';
import { isNative } from '../lib/platform';
import { useRole } from '../lib/role';
import { exactAlarmStatus, memberTime, refreshNotifications, requestExactAlarm, syncAndSchedule } from '../lib/scheduler';
import { cachedFeed } from '../lib/feed';
import { toast } from '../lib/toast';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, SectionTitle, dayLabel } from '../components/ui';
import type { Settings } from '../types';

const APP_VERSION = '0.0.3';

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

      <MembersFeedCard settings={settings} setKey={setKey} />

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

      {isNative() && <SwitchModeCard to="member" />}
      <About />
    </div>
  );
}

function MembersFeedCard({ settings, setKey }: { settings: Settings; setKey: (k: string, v: string) => Promise<void> }) {
  const [key, setKeyInput] = useState('');
  const [url, setUrl] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<{ weekStart: string; at: string } | null>(null);

  useEffect(() => { setKeyInput(settings.admin_key ?? ''); setUrl(settings.feed_url ?? ''); }, [settings.admin_key, settings.feed_url]);
  useEffect(() => { lastPublished().then(setPublished); }, []);

  async function saveKey() {
    setBusy(true);
    await setKey('feed_url', url.trim());
    const ok = key.trim() ? await checkAdminKey(key.trim()) : false;
    setBusy(false);
    if (!key.trim()) { await setKey('admin_key', ''); toast('Admin key removed', 'info'); return; }
    if (!ok) { toast('That admin key was not accepted by the feed', 'error', 5000); return; }
    await setKey('admin_key', key.trim());
    toast('Admin key verified', 'success');
  }

  async function publishNow() {
    setBusy(true);
    const r = await publishWeek(currentWeekStart());
    setBusy(false);
    if (r.ok) { toast("This week is on members' phones", 'success'); setPublished(await lastPublished()); }
    else toast(r.error ?? 'Publish failed', 'error', 5000);
  }

  return (
    <Card className="space-y-3">
      <SectionTitle action={settings.admin_key ? <Badge tone="green">Connected</Badge> : <Badge tone="amber">Not set</Badge>}>
        Members' phones
      </SectionTitle>
      <p className="text-sm text-gray-600 leading-relaxed">
        Members install this app and choose “Start receiving daily verses”. When you save a week, its 7 verses are sent to
        their phones and shown in the daily notification. Only the verses and send time are shared — no names or numbers.
      </p>
      <Field label="Admin key" hint="The ADMIN_KEY you set on your Cloudflare Worker. Keep it private.">
        <Input type="password" value={key} onChange={(e) => setKeyInput(e.target.value)} placeholder="Paste admin key" autoComplete="off" />
      </Field>
      {advanced ? (
        <Field label="Feed URL" hint="Leave blank to use the group's default Worker.">
          <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={DEFAULT_FEED_URL} />
        </Field>
      ) : (
        <button className="text-xs text-brand-700 font-medium" onClick={() => setAdvanced(true)}>Advanced: change feed URL</button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={saveKey} disabled={busy}>Save & verify</Button>
        <Button onClick={publishNow} disabled={busy || !settings.admin_key}>Publish this week</Button>
      </div>
      {published && (
        <p className="text-xs text-gray-500">Last published: week of {dayLabel(published.weekStart)} · {new Date(published.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      )}
    </Card>
  );
}

/* ───────────────────────── Member ───────────────────────── */

function MemberSettings() {
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
    toast(`Reminder set for ${fmtTime(v)}`, 'success', 1800);
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
    toast(r.error ?? 'Verses updated', r.error ? 'error' : 'success');
    load();
  }

  const enabled = settings.notifications_enabled !== 'false';

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />

      <Card className="space-y-4">
        <SectionTitle
          action={
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="w-5 h-5 accent-brand-600" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
              {enabled ? 'On' : 'Off'}
            </label>
          }
        >
          Daily reminder
        </SectionTitle>
        <Field label="Reminder time" hint={settings.member_time ? 'Your own time.' : "Using your group's send time."}>
          <Input type="time" value={time} disabled={!enabled} onChange={(e) => changeTime(e.target.value)} />
        </Field>
        {settings.member_time && <button className="text-sm text-brand-700 font-medium" onClick={useGroupTime}>Use the group's time instead</button>}
      </Card>

      {isNative() && <NotificationsCard />}

      <Card className="space-y-3">
        <SectionTitle>Verses</SectionTitle>
        <p className="text-sm text-gray-600">
          {settings.feed_fetched_at
            ? `Last updated ${new Date(settings.feed_fetched_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`
            : 'Not downloaded yet.'}
        </p>
        <Button variant="secondary" block onClick={refreshNow} disabled={refreshing}>{refreshing ? 'Updating…' : 'Update verses now'}</Button>
      </Card>

      {isNative() && <SwitchModeCard to="admin" />}
      <About />
    </div>
  );
}

/* ───────────────────────── Shared ───────────────────────── */

function NotificationsCard() {
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
        title: 'Test notification', body: 'If you can see this, daily verses will arrive here.',
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      }],
    });
    toast('A test notification will arrive in 5 seconds — you can lock the phone.', 'info', 5000);
  }

  return (
    <Card className="space-y-3">
      <SectionTitle>Notifications</SectionTitle>
      <StatusRow label="Notifications" ok={perm === 'granted'} okText="Allowed" badText={perm === 'denied' ? 'Blocked' : 'Not allowed'}
        action={perm !== 'granted' && <Button size="sm" onClick={allow}>Allow</Button>} />
      {exact !== 'na' && (
        <StatusRow label="Exact time" ok={exact === 'granted'} okText="On time" badText="May be late"
          action={exact !== 'granted' && <Button size="sm" variant="secondary" onClick={async () => { await requestExactAlarm(); check(); }}>Fix</Button>} />
      )}
      {scheduled !== null && perm === 'granted' && (
        <p className="text-xs text-gray-500">{scheduled} upcoming daily notifications are scheduled.</p>
      )}
      {perm === 'denied' && (
        <Notice tone="warn">Notifications are blocked. Open phone <strong>Settings → Apps → Powerful Weapon → Notifications</strong> and turn them on.</Notice>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={test}>Send a test</Button>
        <Button variant="secondary" onClick={() => setShowBattery(!showBattery)}>Battery tips</Button>
      </div>
      {showBattery && (
        <div className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 space-y-2 leading-relaxed">
          <p>Some phones stop apps in the background to save battery, which delays the daily verse. Allow Powerful Weapon to run:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Oppo / Realme / OnePlus:</strong> Settings → Battery → App battery management (or More settings) → Powerful Weapon → allow <em>Auto launch</em> and <em>Background activity</em>.</li>
            <li><strong>Vivo / iQOO:</strong> Settings → Battery → Background power consumption → Powerful Weapon → Allow.</li>
            <li><strong>Xiaomi / Redmi / Poco:</strong> Settings → Apps → Powerful Weapon → Autostart on, Battery saver → No restrictions.</li>
            <li><strong>Samsung:</strong> Settings → Battery → Background usage limits → Never sleeping apps → add Powerful Weapon.</li>
          </ul>
          <p className="text-xs text-gray-500">Then tap “Send a test” and lock the phone to check.</p>
        </div>
      )}
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
  const navigate = useNavigate();
  async function go() {
    const msg = to === 'admin'
      ? 'Switch to admin mode? This is only for the person who picks the verses and grades voice notes.'
      : 'Switch this phone to member mode? You will only see the daily verse. Your admin data stays on the phone.';
    if (!confirm(msg)) return;
    await setRole(to);
    syncAndSchedule().catch(() => {});
    navigate(to === 'admin' ? '/dashboard' : '/today', { replace: true });
  }
  return (
    <Card>
      <SectionTitle>App mode</SectionTitle>
      <p className="text-sm text-gray-600 mb-3">
        {to === 'admin' ? 'This phone is in member mode.' : 'This phone is in admin mode.'}
      </p>
      <Button variant="secondary" block onClick={go}>{to === 'admin' ? "I'm the group admin" : 'Switch to member mode'}</Button>
    </Card>
  );
}

function About() {
  return (
    <div className="text-center text-xs text-gray-400 py-4 space-y-1">
      <img src="brand/icon-192.png" alt="" className="w-12 h-12 rounded-xl mx-auto mb-2 opacity-90" />
      <div>Powerful Weapon v{APP_VERSION}</div>
      <div>For non-commercial use</div>
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
