import { useEffect, useMemo, useRef, useState } from 'react';
import { grade } from '../../electron/lib/grading';
import { phoneticTamil, similarity, stripSuffix } from '../../electron/lib/tamil';
import { addDays, currentWeekStart } from '../lib/dates';
import { useLang, useT } from '../lib/prefs';
import { practiceCheck } from '../lib/remote';
import { dayName } from '../lib/strings';
import { toast } from '../lib/toast';
import { blobToBase64, fmtClock } from '../lib/useRecorder';
import { useFeed } from '../lib/useFeed';
import { Button, Card, Empty, PageHeader, Segmented, cx } from '../components/ui';
import { IconMic } from '../components/icons';

type Mode = 'hidden' | 'letters' | 'words';

/** First grapheme (letter + its vowel sign), so "கு" stays "கு", not "க". */
const firstLetter = (w: string) => {
  const Seg = (Intl as any).Segmenter;
  return Seg ? (new Seg('ta', { granularity: 'grapheme' }).segment(w)[Symbol.iterator]().next().value?.segment ?? w[0]) : Array.from(w)[0];
};

/** Verse words the transcript doesn't contain (spoken-Tamil spelling, endings ignored). */
function missedWords(verse: string, transcript: string): string[] {
  const heard = transcript.split(/\s+/).map((w) => phoneticTamil(stripSuffix(w))).filter(Boolean);
  const heardCompact = phoneticTamil(transcript).replace(/\s+/g, '');
  return verse.split(/\s+/).filter((w) => {
    const p = phoneticTamil(stripSuffix(w));
    if (!p || p.length < 2) return false;
    if (heardCompact.includes(p)) return false;
    return !heard.some((h) => similarity(h, p) >= 0.75);
  });
}

/** Memorise: hide the verse, recite, then check — or let the app listen. Nothing reaches the admin. */
export default function Practice() {
  const t = useT();
  const lang = useLang();
  const { weeks, loading } = useFeed();
  const thisWeek = currentWeekStart();
  // Practise the week whose verses exist: this week, else last week (during an extended window).
  const week = weeks.find((w) => w.weekStart === thisWeek) ?? weeks.find((w) => w.weekStart === addDays(thisWeek, -7));
  const verses = useMemo(() => [...(week?.verses ?? [])].sort((a, b) => a.slot - b.slot), [week]);
  const todaySlot = new Date().getDay() || 7;
  const [slot, setSlot] = useState(todaySlot); // open on today's verse
  const [mode, setMode] = useState<Mode>('hidden');
  const [revealed, setRevealed] = useState(false);
  const [shownWords, setShownWords] = useState(0);
  const v = verses.find((x) => x.slot === slot) ?? verses[0];

  const words = useMemo(() => (v ? v.text.split(/\s+/) : []), [v]);

  function pick(s: number) { setSlot(s); setRevealed(false); setShownWords(0); }

  if (!v) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('practice.title')} />
        <Empty icon="🧠" title={loading ? t('common.loading') : t('practice.none')}>{t('practice.noneBody')}</Empty>
      </div>
    );
  }
  const ref = `${v.book} ${v.chapter}:${v.verse}`;

  return (
    <div className="space-y-4">
      <PageHeader title={t('practice.title')} subtitle={t('practice.subtitle')} />

      <div className="grid grid-cols-7 gap-1">
        {verses.map((x) => (
          <button key={x.slot} onClick={() => pick(x.slot)}
            className={cx('h-10 rounded-xl text-[0.8125rem] font-medium border relative',
              x.slot === v.slot ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-gray-700 border-gray-200')}>
            {lang === 'ta' ? dayName(x.slot, 'ta').slice(0, 3) : dayName(x.slot, 'en')}
            {x.slot === todaySlot && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-gold-400" />}
          </button>
        ))}
      </div>

      <Segmented<Mode> value={mode} onChange={(m) => { setMode(m); setRevealed(false); setShownWords(0); }}
        options={[{ value: 'hidden', label: t('practice.hidden') }, { value: 'letters', label: t('practice.letters') }, { value: 'words', label: t('practice.words') }]} />

      <Card className="space-y-4">
        <div className="text-sm font-semibold text-brand-800">{ref}</div>
        <div className="tamil text-[1.125rem] text-ink min-h-[7rem]" style={{ lineHeight: 1.9 }}>
          {revealed ? v.text
            : mode === 'hidden' ? <span className="text-gray-300 select-none">{'● '.repeat(Math.min(24, words.length))}</span>
            : mode === 'letters' ? words.map((w, i) => <span key={i} className="mr-2">{firstLetter(w)}<span className="text-gray-300">…</span></span>)
            : words.map((w, i) => <span key={i} className={cx('mr-1.5', i >= shownWords && 'text-transparent bg-gray-100 rounded')}>{w}</span>)}
        </div>
        {mode === 'words' && !revealed ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setShownWords(Math.min(words.length, shownWords + 1))}>{t('practice.nextWord')}</Button>
            <Button onClick={() => setRevealed(true)}>{t('practice.showAll')}</Button>
          </div>
        ) : (
          <Button block variant={revealed ? 'secondary' : 'primary'} onClick={() => { setRevealed(!revealed); setShownWords(0); }}>
            {revealed ? t('practice.hide') : t('practice.check')}
          </Button>
        )}
      </Card>

      <VoiceCheck key={`${week?.weekStart}-${v.slot}`} verse={v} />

      <p className="text-xs text-gray-500 text-center">{t('practice.tip', { ref })}</p>
    </div>
  );
}

const MAX_CHECK_SECONDS = 45;

function VoiceCheck({ verse }: { verse: { book: string; chapter: number; verse: number; text: string } }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'listening' | 'checking' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ pct: number; missed: string[]; refOk: boolean; heard: string; left: number } | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>();

  useEffect(() => () => { window.clearInterval(timer.current); rec.current?.stream.getTracks().forEach((x) => x.stop()); }, []);

  async function start() {
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch {
      toast(t('record.micNeeded'), 'error', 5000); return;
    }
    const chunks: Blob[] = [];
    const r = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
    rec.current = r;
    const began = Date.now();
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = async () => {
      window.clearInterval(timer.current);
      stream.getTracks().forEach((x) => x.stop());
      const seconds = (Date.now() - began) / 1000;
      const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
      setState('checking');
      try {
        const res = await practiceCheck({ audioBase64: await blobToBase64(blob), mimeType: blob.type.split(';')[0], prompt: `${verse.book} ${verse.chapter}:${verse.verse}` });
        const g = grade({ transcript: res.transcript, referenceText: verse.text, referenceCitation: verse, durationSeconds: seconds });
        setResult({
          pct: Math.round((g.accuracy / 60) * 100),
          missed: missedWords(verse.text, res.transcript),
          refOk: g.breakdown.refBookMatch && g.breakdown.refChapterMatch && g.breakdown.refVerseMatch,
          heard: res.transcript, left: res.left,
        });
        setState('done');
      } catch (e: any) {
        toast(e.message, 'error', 6000);
        setState('idle');
      }
    };
    r.start(1000);
    setElapsed(0);
    setState('listening');
    timer.current = window.setInterval(() => {
      const s = (Date.now() - began) / 1000;
      setElapsed(s);
      if (s >= MAX_CHECK_SECONDS && r.state === 'recording') r.stop();
    }, 250);
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-ink">{t('practice.voiceTitle')}</div>
        {result && <span className="text-xs text-gray-500">{t('practice.left', { n: result.left })}</span>}
      </div>
      {state === 'idle' && <p className="text-sm text-gray-600">{t('practice.voiceHint')}</p>}
      {state === 'listening' && (
        <div className="flex items-center gap-3 text-sm">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="flex-1">{t('practice.listening')}</span>
          <span className="tabular-nums text-gray-500">{fmtClock(elapsed)}</span>
        </div>
      )}
      {state === 'checking' && <p className="text-sm text-gray-500">{t('practice.checking')}</p>}
      {state === 'done' && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={cx('text-3xl font-bold tabular-nums', result.pct >= 85 ? 'text-emerald-600' : result.pct >= 60 ? 'text-gold-600' : 'text-red-600')}>
              {t('practice.match', { pct: result.pct })}
            </div>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className={cx('h-full rounded-full', result.pct >= 85 ? 'bg-emerald-500' : result.pct >= 60 ? 'bg-gold-400' : 'bg-red-500')} style={{ width: `${result.pct}%` }} />
          </div>
          <p className={cx('text-sm', result.refOk ? 'text-emerald-700' : 'text-amber-700')}>{result.refOk ? t('practice.refOk') : t('practice.refMissing')}</p>
          {result.missed.length ? (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">{t('practice.missed')}</div>
              <div className="flex flex-wrap gap-1.5">
                {result.missed.map((w, i) => <span key={i} className="tamil px-2.5 py-1 rounded-lg bg-red-50 text-red-800 text-sm" style={{ lineHeight: 1.5 }}>{w}</span>)}
              </div>
            </div>
          ) : result.pct >= 85 ? <p className="text-sm text-emerald-700">{t('practice.allGood')}</p>
            : <p className="text-sm text-gray-600">{t('practice.almost')}</p>}
          <details className="text-xs text-gray-500">
            <summary>{t('practice.heard')}</summary>
            <p className="tamil mt-1 text-gray-700">{result.heard || '—'}</p>
          </details>
        </div>
      )}
      {state === 'listening' ? (
        <Button block variant="danger" onClick={() => rec.current?.stop()}>{t('practice.voiceStop')}</Button>
      ) : (
        <Button block variant="secondary" disabled={state === 'checking'} onClick={start}><IconMic /> {t('practice.voiceStart')}</Button>
      )}
    </Card>
  );
}
