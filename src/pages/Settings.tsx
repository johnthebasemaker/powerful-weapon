import { useEffect, useState } from 'react';
import type { Settings } from '../types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [whisper, setWhisper] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [verseCount, setVerseCount] = useState(0);
  const [savedMsg, setSavedMsg] = useState('');
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  async function load() {
    const [s, w, c, b] = await Promise.all([
      window.api.settings.getAll(),
      window.api.whisper.check(),
      window.api.verses.count(),
      window.api.backup.lastRun(),
    ]);
    setSettings(s as Settings);
    setWhisper(w as any);
    setVerseCount(c as number);
    setLastBackup(b as string | null);
  }
  useEffect(() => { load(); }, []);

  async function setKey(key: string, value: string) {
    await window.api.settings.set(key, value);
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    if (settings.send_time) {
      await window.api.scheduler.start(settings.send_time);
    }
    setSavedMsg('Saved.');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  async function pickBackupFolder() {
    const folder = (await window.api.backup.pickFolder()) as string | null;
    if (folder) setKey('backup_folder', folder);
  }

  async function runBackup() {
    const r = await window.api.backup.runNow();
    if (r.ok) {
      setLastBackup(r.path);
      alert(`Backup written:\n${r.path}`);
    } else {
      alert(`Backup failed: ${r.error}`);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure daily send time, group, backups, and STT.</p>
      </header>

      {/* WhatsApp / Scheduler */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium mb-4">Daily send schedule</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Send time (IST)" hint="Each day's verse will be queued for sending at this time.">
            <input
              type="time"
              value={settings.send_time ?? '00:00'}
              onChange={(e) => setKey('send_time', e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full"
            />
          </Field>
          <Field label="WhatsApp group name" hint="Just a label, used in the dashboard.">
            <input
              type="text"
              value={settings.group_name ?? ''}
              onChange={(e) => setKey('group_name', e.target.value)}
              placeholder="e.g. Powerful Weapon Group"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full"
            />
          </Field>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Note: WhatsApp doesn't allow apps to post directly to groups. At send time, the app copies the message to your clipboard and opens WhatsApp Web — you just paste into the group and press Enter.
        </p>
      </section>

      {/* Backups */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium mb-4">Automatic backups</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Backup folder" hint="Choose a folder synced by Google Drive / iCloud / Dropbox for offsite safety.">
            <div className="flex gap-2">
              <input
                value={settings.backup_folder ?? ''}
                readOnly
                placeholder="No folder selected"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50"
              />
              <button onClick={pickBackupFolder} className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50">
                Browse…
              </button>
            </div>
          </Field>
          <Field label="Frequency (days)">
            <input
              type="number"
              min={1}
              max={30}
              value={settings.backup_frequency_days ?? '7'}
              onChange={(e) => setKey('backup_frequency_days', e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full"
            />
          </Field>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={runBackup} className="px-3 py-1.5 bg-brand-500 text-white text-sm rounded-md hover:bg-brand-600">
            Run backup now
          </button>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.backup_enabled === 'true'}
              onChange={(e) => setKey('backup_enabled', e.target.checked ? 'true' : 'false')}
            />
            Auto-backup enabled
          </label>
          {lastBackup && <span className="text-xs text-gray-500 truncate">Last: {lastBackup}</span>}
        </div>
      </section>

      {/* Speech-to-Text */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium mb-4">Speech-to-Text (Whisper)</h2>
        {whisper?.ok ? (
          <div className="text-sm text-emerald-700">✅ Whisper is set up and ready.</div>
        ) : (
          <div className="text-sm space-y-2">
            <div className="text-amber-700">⚠️ Whisper isn't installed yet.</div>
            {whisper?.reason && <code className="block text-xs bg-gray-50 border border-gray-200 rounded p-2">{whisper.reason}</code>}
            <p className="text-gray-600">
              Follow the steps in <code>README.md → First-time setup → Whisper</code> to download the binary and Tamil model.
              Until then, voice notes can be imported but won't be auto-graded.
            </p>
          </div>
        )}
      </section>

      {/* Bible data */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium mb-4">Bible database</h2>
        <p className="text-sm text-gray-700">
          {verseCount.toLocaleString()} verses loaded.
          {verseCount < 1000 && (
            <span className="text-amber-700"> (Sample only. Run <code>npm run import:bible</code> to load the full Tamil OV — see README.)</span>
          )}
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} className="px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600">
          Apply schedule
        </button>
        {savedMsg && <span className="text-sm text-emerald-700">{savedMsg}</span>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
