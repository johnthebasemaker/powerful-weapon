import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { addDays } from '../lib/dates';
import { clearPending, loadPending, savePending } from '../lib/pendingTake';
import { useLang, useT } from '../lib/prefs';
import { PUSH_EVENT } from '../lib/push';
import { cancelTake, myHistory, myStatus, MyStatus, requestTry, RemoteError, startTake, submitRecording } from '../lib/remote';
import { refreshNotifications } from '../lib/scheduler';
import { dayName, whenLabel } from '../lib/strings';
import { toast } from '../lib/toast';
import { blobToBase64, fmtClock, MAX_SECONDS, Take, useRecorder } from '../lib/useRecorder';
import { Button, Card, Empty, Notice, PageHeader, cx } from '../components/ui';
import { IconCheck, IconMic, IconRefresh } from '../components/icons';

const VERSES = 7;

export default function Record() {
  const t = useT();
  const lang = useLang();
  const [status, setStatus] = useState<MyStatus | null>(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [rulesOk, setRulesOk] = useState(false);
  const [pending, setPending] = useState<Take | null>(null);
  const [asked, setAsked] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const s = await myStatus();
      setStatus(s);
      setPending(s.sent ? null : await loadPending(s.window.weekStart));
      if (s.sent) clearPending();
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  // The admin gave a try / opened a re-record while this screen is open.
  useEffect(() => {
    window.addEventListener(PUSH_EVENT, load);
    return () => window.removeEventListener(PUSH_EVENT, load);
  }, [load]);

  const onAborted = useCallback(async (_reason: string, interrupted: boolean) => {
    const week = status?.window.weekStart;
    if (!week) return;
    try {
      const r = await cancelTake(week, interrupted);
      toast(t(r.refunded ? 'record.refunded' : 'record.cancelled'), r.refunded ? 'info' : 'error', 6000);
    } catch {
      toast(t('record.cancelled'), 'error', 5000);
    }
    load();
  }, [status, t, load]);
  const rec = useRecorder(onAborted);

  // A finished take is saved on the phone at once, so it survives a failed send or leaving the screen.
  useEffect(() => {
    if (rec.take && status) { savePending(status.window.weekStart, rec.take); setPending(rec.take); }
  }, [rec.take, status]);

  const maxTakes = status?.maxTakes ?? 5;
  const takesLeft = Math.max(0, maxTakes - (status?.takesUsed ?? 0));
  const verseNo = Math.min(VERSES, rec.marks.length);

  // Built during render so the player gets its source on the first paint (a ref set in an effect left it empty).
  const audioUrl = useMemo(() => (pending ? URL.createObjectURL(pending.blob) : ''), [pending]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function begin() {
    if (!status || takesLeft <= 0) return;
    try {
      const r = await startTake(status.window.weekStart); // counted on the server
      setStatus({ ...status, takesUsed: r.takesUsed, maxTakes: r.maxTakes });
    } catch (e: any) {
      toast(e.message, 'error', 6000);
      load();
      return;
    }
    for (let i = 3; i > 0; i--) { setCountdown(i); await new Promise((r) => setTimeout(r, 800)); }
    setCountdown(0);
    try {
      await rec.start();
    } catch {
      toast(t('record.micNeeded'), 'error', 5000);
      await cancelTake(status.window.weekStart, false, true).catch(() => {}); // nothing was recorded
      load();
    }
  }

  async function discard() {
    const last = takesLeft <= 0;
    if (!confirm(t(last ? 'record.lastTryConfirm' : 'record.discardConfirm'))) return;
    await clearPending();
    setPending(null);
    rec.reset();
  }

  async function send() {
    if (!pending || !status) return;
    setSending(true);
    try {
      await submitRecording({
        weekStart: status.window.weekStart,
        audioBase64: await blobToBase64(pending.blob),
        mimeType: pending.mimeType,
        durationS: Math.round(pending.seconds),
        takes: status.takesUsed,
        marks: pending.marks,
      });
      toast(t('record.sentToast'), 'success', 4000);
      await api().settings.set('record_sent_week', status.window.weekStart); // stops the "2 hours left" reminder
      await clearPending();
      setPending(null);
      rec.reset();
      await load();
      refreshNotifications().catch(() => {});
    } catch (e: any) {
      toast(e instanceof RemoteError && e.status === 0 ? t('record.unsent') : e.message, 'error', 7000);
      if (e instanceof RemoteError && e.status === 409) { await clearPending(); setPending(null); load(); }
    } finally {
      setSending(false);
    }
  }

  async function askForTry() {
    try { await requestTry(); setAsked(true); } catch (e: any) { toast(e.message, 'error', 5000); }
  }

  const closesIn = useMemo(() => {
    if (!status?.window.open) return '';
    const mins = Math.max(0, Math.round((status.window.closesAt - Date.now()) / 60000));
    return mins >= 120 ? t('record.hoursLeft', { n: Math.floor(mins / 60) }) : t('record.minsLeft', { n: mins });
  }, [status, t]);

  /* ── recording (full screen, verses hidden, no pause) ── */
  if (countdown || rec.state === 'recording') {
    const last = verseNo >= VERSES;
    return (
      <div className="fixed inset-0 z-50 bg-brand-950 text-white flex flex-col safe-top safe-bottom">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          {countdown ? (
            <>
              <div className="text-white/60 mb-4">{t('record.getReady')}</div>
              <div className="text-8xl font-bold">{countdown}</div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-red-400 font-semibold">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" /> {t('record.recording')}
              </div>
              <div className="text-6xl font-bold tabular-nums mt-3">{fmtClock(rec.elapsed)}</div>
              <div className="text-white/50 text-sm mt-1">{t('record.max', { t: fmtClock(MAX_SECONDS) })}</div>
              <div className="mt-10 text-white/70 text-sm">{t('record.nowReciting')}</div>
              <div className="text-3xl font-semibold mt-1">{t('record.verseOf', { n: verseNo, total: VERSES })}</div>
              <div className="text-gold-300 mt-1">{t('record.daysVerse', { day: dayName(verseNo, lang) })}</div>
            </>
          )}
        </div>
        {!countdown && (
          <div className="px-6 pb-8 space-y-3">
            {!last ? (
              <Button variant="gold" size="lg" block onClick={rec.nextVerse}>{t('record.next')}</Button>
            ) : (
              <Button variant="gold" size="lg" block onClick={rec.stop}><IconCheck /> {t('record.finish')}</Button>
            )}
            {!last && (
              <button className="w-full h-11 text-sm text-white/60" onClick={rec.stop}>{t('record.finishEarly')}</button>
            )}
            <p className="text-center text-xs text-white/40">{t('record.noPause')}</p>
          </div>
        )}
      </div>
    );
  }

  const canRecord = status && !status.sent && status.window.open && !pending && rec.state !== 'done';

  return (
    <div className="space-y-4">
      <PageHeader title={t('record.title')} subtitle={status ? t('record.hi', { name: status.member.name }) : undefined}
        action={<Button variant="ghost" size="sm" onClick={load} aria-label={t('common.refresh')}><IconRefresh /></Button>} />

      {error && <Notice tone="error">{error}</Notice>}
      {!status && !error && <p className="text-sm text-gray-500">{t('common.loading')}</p>}

      {status?.sent && (
        <Card className="text-center py-8">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center mx-auto"><IconCheck /></div>
          <div className="font-semibold text-ink mt-3">{t('record.sentTitle')}</div>
          <div className="text-sm text-gray-500 mt-1">{new Date(status.sent.created_at.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
          <p className="text-xs text-gray-400 mt-3">{t('record.sentNote')}</p>
        </Card>
      )}

      {status && !status.sent && !status.window.open && !pending && (
        <Empty icon="⏳" title={t('record.closed')}>
          {t('record.closedBody', { open: whenLabel(status.window.opensAt, lang), close: whenLabel(status.window.closesAt, lang) })}
        </Empty>
      )}

      {pending && status && !status.sent && (
        <Card className="space-y-4">
          <div className="font-semibold text-ink">{t('record.listen')}</div>
          <audio controls src={audioUrl} className="w-full" />
          <div className="text-xs text-gray-500">
            {fmtClock(pending.seconds)} · {t('record.marked', { n: Math.min(VERSES, pending.marks.length), total: VERSES })}
          </div>
          {rec.state !== 'done' && <Notice tone="info">{t('record.unsent')}</Notice>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={sending || takesLeft <= 0 || !status.window.open} onClick={discard}>
              {t('record.retry', { n: takesLeft })}
            </Button>
            <Button variant="success" disabled={sending} onClick={send}>{sending ? t('record.sending') : t('record.send')}</Button>
          </div>
        </Card>
      )}

      {canRecord && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-700">● {t('record.open')}</span>
            <span className="text-xs text-gray-500">{closesIn}</span>
          </div>
          <div className="text-sm text-gray-700 space-y-2 leading-relaxed">
            <p className="font-medium">{t('record.intro')}</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>{t('record.rule1')}</li>
              <li>{t('record.rule2')}</li>
              <li>{status.refundsLeft > 0 ? t('record.rule3', { n: status.refundsLeft }) : t('record.rule3none')}</li>
              <li><strong>{t('record.rule4', { left: takesLeft, max: maxTakes })}</strong></li>
            </ul>
          </div>
          {takesLeft > 0 ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="w-5 h-5 accent-brand-600" checked={rulesOk} onChange={(e) => setRulesOk(e.target.checked)} />
                {t('record.ready')}
              </label>
              <Button size="lg" block disabled={!rulesOk} onClick={begin}><IconMic /> {t('record.start')}</Button>
            </>
          ) : (
            <div className="space-y-2">
              <Button size="lg" block disabled><IconMic /> {t('record.noTries')}</Button>
              {asked ? <Notice tone="ok">{t('record.asked')}</Notice>
                : <Button variant="gold" block onClick={askForTry}>{t('record.askAdmin')}</Button>}
            </div>
          )}
        </Card>
      )}

      {status && <Progress currentWeek={status.window.weekStart} sentNow={!!status.sent} />}
    </div>
  );
}

/** Streak and the last 8 weeks — sent or not. Never marks. */
function Progress({ currentWeek, sentNow }: { currentWeek: string; sentNow: boolean }) {
  const t = useT();
  const [weeks, setWeeks] = useState<string[] | null>(null);
  useEffect(() => { myHistory().then((h) => setWeeks(h.weeks)).catch(() => setWeeks(null)); }, [currentWeek, sentNow]);
  if (!weeks) return null;

  const sent = new Set(weeks);
  // Count back from this week (if sent) or last week — an unsent current week doesn't break the streak yet.
  let streak = 0;
  for (let w = sent.has(currentWeek) ? currentWeek : addDays(currentWeek, -7); sent.has(w); w = addDays(w, -7)) streak++;
  const last8 = Array.from({ length: 8 }, (_, i) => addDays(currentWeek, -7 * (7 - i)));

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="font-semibold text-ink">{t('streak.title')}</div>
        {streak > 0 && <span className="text-sm font-semibold text-gold-600 whitespace-nowrap">🔥 {streak === 1 ? t('streak.week') : t('streak.weeks', { n: streak })}</span>}
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1.5">{t('streak.last8')}</div>
        <div className="grid grid-cols-8 gap-1.5">
          {last8.map((w) => (
            <span key={w} title={w} className={cx('h-7 rounded-lg', sent.has(w) ? 'bg-emerald-500' : w === currentWeek ? 'bg-gray-100 ring-1 ring-inset ring-gray-300' : 'bg-gray-100')} />
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500">{weeks.length === 1 ? t('streak.totalOne') : weeks.length ? t('streak.total', { n: weeks.length }) : t('streak.start')}</p>
    </Card>
  );
}
