import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { weekdayLabel } from '../lib/dates';
import { fmtWhen, myStatus, MyStatus, submitRecording } from '../lib/remote';
import { refreshNotifications } from '../lib/scheduler';
import { toast } from '../lib/toast';
import { blobToBase64, fmtClock, MAX_SECONDS, useRecorder } from '../lib/useRecorder';
import { Button, Card, Empty, Notice, PageHeader } from '../components/ui';
import { IconCheck, IconMic, IconRefresh } from '../components/icons';

const VERSES = 7;

export default function Record() {
  const [status, setStatus] = useState<MyStatus | null>(null);
  const [error, setError] = useState('');
  const [takesUsed, setTakesUsed] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [rulesOk, setRulesOk] = useState(false);
  const audioUrl = useRef<string>('');

  const takesKey = status ? `takes_${status.window.weekStart}` : '';

  const load = useCallback(async () => {
    setError('');
    try {
      const s = await myStatus();
      setStatus(s);
      const all = (await api().settings.getAll()) as Record<string, string>;
      setTakesUsed(Number(all[`takes_${s.window.weekStart}`] || 0));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onAborted = useCallback((reason: string) => toast(reason, 'error', 5000), []);
  const rec = useRecorder(onAborted);

  const maxTakes = status?.maxTakes ?? 3;
  const takesLeft = Math.max(0, maxTakes - takesUsed);
  const verseNo = Math.min(VERSES, rec.marks.length);

  async function begin() {
    if (!status || takesLeft <= 0) return;
    // Count the take as soon as it starts (a cancelled take still uses one).
    const used = takesUsed + 1;
    await api().settings.set(takesKey, String(used));
    setTakesUsed(used);
    for (let i = 3; i > 0; i--) { setCountdown(i); await new Promise((r) => setTimeout(r, 800)); }
    setCountdown(0);
    try {
      await rec.start();
    } catch {
      toast('Microphone permission is needed to record.', 'error', 5000);
      await api().settings.set(takesKey, String(used - 1)); // refund: nothing was recorded
      setTakesUsed(used - 1);
    }
  }

  useEffect(() => {
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = rec.take ? URL.createObjectURL(rec.take.blob) : '';
  }, [rec.take]);

  async function send() {
    if (!rec.take || !status) return;
    setSending(true);
    try {
      await submitRecording({
        weekStart: status.window.weekStart,
        audioBase64: await blobToBase64(rec.take.blob),
        mimeType: rec.take.mimeType,
        durationS: Math.round(rec.take.seconds),
        takes: takesUsed,
        marks: rec.take.marks,
      });
      toast('Recording sent to the admin 🙏', 'success', 4000);
      await api().settings.set('record_sent_week', status.window.weekStart); // stops the "2 hours left" reminder
      rec.reset();
      await load();
      refreshNotifications().catch(() => {});
    } catch (e: any) {
      toast(e.message, 'error', 6000);
    } finally {
      setSending(false);
    }
  }

  const closesIn = useMemo(() => {
    if (!status?.window.open) return '';
    const mins = Math.max(0, Math.round((status.window.closesAt - Date.now()) / 60000));
    return mins >= 120 ? `${Math.floor(mins / 60)} hours left` : `${mins} minutes left`;
  }, [status]);

  /* ── recording (full screen, verses hidden, no pause) ── */
  if (countdown || rec.state === 'recording') {
    const last = verseNo >= VERSES;
    return (
      <div className="fixed inset-0 z-50 bg-brand-950 text-white flex flex-col safe-top safe-bottom">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          {countdown ? (
            <>
              <div className="text-white/60 mb-4">Get ready — recite from memory</div>
              <div className="text-8xl font-bold">{countdown}</div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-red-400 font-semibold">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" /> Recording
              </div>
              <div className="text-6xl font-bold tabular-nums mt-3">{fmtClock(rec.elapsed)}</div>
              <div className="text-white/50 text-sm mt-1">max {fmtClock(MAX_SECONDS)}</div>
              <div className="mt-10 text-white/70 text-sm">Now reciting</div>
              <div className="text-3xl font-semibold mt-1">Verse {verseNo} of {VERSES}</div>
              <div className="text-gold-300 mt-1">{weekdayLabel(verseNo)}'s verse — say the reference too</div>
            </>
          )}
        </div>
        {!countdown && (
          <div className="px-6 pb-8 space-y-3">
            {!last ? (
              <Button variant="gold" size="lg" block onClick={rec.nextVerse}>Next verse →</Button>
            ) : (
              <Button variant="gold" size="lg" block onClick={rec.stop}><IconCheck /> Finish</Button>
            )}
            {!last && (
              <button className="w-full h-11 text-sm text-white/60" onClick={rec.stop}>Finish early</button>
            )}
            <p className="text-center text-xs text-white/40">Pausing isn't possible. Leaving the app cancels this take.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Record" subtitle={status ? `Hi ${status.member.name}` : undefined}
        action={<Button variant="ghost" size="sm" onClick={load} aria-label="Refresh"><IconRefresh /></Button>} />

      {error && <Notice tone="error">{error}</Notice>}
      {!status && !error && <p className="text-sm text-gray-500">Loading…</p>}

      {status?.sent && (
        <Card className="text-center py-8">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center mx-auto"><IconCheck /></div>
          <div className="font-semibold text-ink mt-3">This week's recording is sent</div>
          <div className="text-sm text-gray-500 mt-1">{new Date(status.sent.created_at.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
          <p className="text-xs text-gray-400 mt-3">Your admin will listen and mark it. Marks are private to the admin.</p>
        </Card>
      )}

      {status && !status.sent && !status.window.open && (
        <Empty icon="⏳" title="Recording is closed now">
          Opens {fmtWhen(status.window.opensAt)} and closes {fmtWhen(status.window.closesAt)}. You'll get a notification when it opens.
        </Empty>
      )}

      {status && !status.sent && status.window.open && rec.state === 'idle' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-700">● Recording is open</span>
            <span className="text-xs text-gray-500">{closesIn}</span>
          </div>
          <div className="text-sm text-gray-700 space-y-2 leading-relaxed">
            <p>Recite all <strong>7 verses from memory</strong>, Monday to Sunday, with each reference.</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>Verses are hidden while recording.</li>
              <li>Tap <strong>Next verse</strong> as you move to the next one.</li>
              <li>No pause. Leaving the app cancels the take.</li>
              <li>You have <strong>{takesLeft} of {maxTakes}</strong> tries left; you can listen before sending.</li>
            </ul>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="w-5 h-5 accent-brand-600" checked={rulesOk} onChange={(e) => setRulesOk(e.target.checked)} />
            I'm ready and I'll recite from memory
          </label>
          <Button size="lg" block disabled={!rulesOk || takesLeft <= 0} onClick={begin}>
            <IconMic /> {takesLeft > 0 ? 'Start recording' : 'No tries left'}
          </Button>
          {takesLeft <= 0 && <p className="text-xs text-gray-500 text-center">Ask your admin if you need another chance.</p>}
        </Card>
      )}

      {rec.state === 'done' && rec.take && (
        <Card className="space-y-4">
          <div className="font-semibold text-ink">Listen to your recording</div>
          <audio controls src={audioUrl.current} className="w-full" />
          <div className="text-xs text-gray-500">
            {fmtClock(rec.take.seconds)} · {Math.min(VERSES, rec.take.marks.length)} of {VERSES} verses marked
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={sending || takesLeft <= 0} onClick={() => { rec.reset(); }}>
              Try again ({takesLeft} left)
            </Button>
            <Button variant="success" disabled={sending} onClick={send}>{sending ? 'Sending…' : 'Send to admin'}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
