import { useMemo, useState } from 'react';
import { addDays, currentWeekStart, weekdayLabel } from '../lib/dates';
import { useFeed } from '../lib/useFeed';
import { Button, Card, Empty, PageHeader, Segmented, cx } from '../components/ui';

type Mode = 'hidden' | 'letters' | 'words';

/** Memorise without recording: hide the verse, recite, then check. Nothing is sent. */
export default function Practice() {
  const { weeks, loading } = useFeed();
  const thisWeek = currentWeekStart();
  // Practise the week whose verses exist: this week, else last week (during an extended window).
  const week = weeks.find((w) => w.weekStart === thisWeek) ?? weeks.find((w) => w.weekStart === addDays(thisWeek, -7));
  const verses = useMemo(() => [...(week?.verses ?? [])].sort((a, b) => a.slot - b.slot), [week]);
  const [slot, setSlot] = useState(1);
  const [mode, setMode] = useState<Mode>('hidden');
  const [revealed, setRevealed] = useState(false);
  const [shownWords, setShownWords] = useState(0);
  const v = verses.find((x) => x.slot === slot) ?? verses[0];

  const words = useMemo(() => (v ? v.text.split(/\s+/) : []), [v]);

  function pick(s: number) { setSlot(s); setRevealed(false); setShownWords(0); }

  if (!v) {
    return (
      <div className="space-y-4">
        <PageHeader title="Practice" />
        <Empty icon="🧠" title={loading ? 'Loading…' : 'No verses yet'}>Verses appear here once your admin publishes the week.</Empty>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Practice" subtitle="Recite from memory, then check yourself. Nothing is recorded." />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
        {verses.map((x) => (
          <button key={x.slot} onClick={() => pick(x.slot)}
            className={cx('h-10 px-3.5 rounded-full text-sm font-medium shrink-0 border',
              x.slot === v.slot ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-gray-700 border-gray-200')}>
            {weekdayLabel(x.slot)}
          </button>
        ))}
      </div>

      <Segmented<Mode> value={mode} onChange={(m) => { setMode(m); setRevealed(false); setShownWords(0); }}
        options={[{ value: 'hidden', label: 'Hidden' }, { value: 'letters', label: 'First letters' }, { value: 'words', label: 'Words' }]} />

      <Card className="space-y-4">
        <div className="text-sm font-semibold text-brand-800">{v.book} {v.chapter}:{v.verse}</div>
        <div className="tamil text-[18px] text-ink min-h-[7rem]" style={{ lineHeight: 1.9 }}>
          {revealed ? v.text
            : mode === 'hidden' ? <span className="text-gray-300 select-none">{'● '.repeat(Math.min(24, words.length))}</span>
            : mode === 'letters' ? words.map((w, i) => <span key={i} className="mr-2">{Array.from(w)[0]}<span className="text-gray-300">…</span></span>)
            : words.map((w, i) => <span key={i} className={cx('mr-1.5', i >= shownWords && 'text-transparent bg-gray-100 rounded')}>{w}</span>)}
        </div>
        {mode === 'words' && !revealed ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setShownWords(Math.min(words.length, shownWords + 1))}>Next word</Button>
            <Button onClick={() => setRevealed(true)}>Show all</Button>
          </div>
        ) : (
          <Button block variant={revealed ? 'secondary' : 'primary'} onClick={() => { setRevealed(!revealed); setShownWords(0); }}>
            {revealed ? 'Hide again' : 'Check — show the verse'}
          </Button>
        )}
      </Card>
      <p className="text-xs text-gray-500 text-center">Tip: say the reference ({v.book} {v.chapter}:{v.verse}) before the verse, just like in the recording.</p>
    </div>
  );
}
