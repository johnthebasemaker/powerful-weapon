import { useMemo, useState } from 'react';
import { addDays, currentWeekStart, localIso } from '../lib/dates';
import { copyText, shareText, verseMessage } from '../lib/share';
import { useFeed } from '../lib/useFeed';
import { Button, Empty, PageHeader, Segmented, cx, dayLabel } from '../components/ui';
import { IconCopy, IconRefresh, IconShare } from '../components/icons';

export default function Week() {
  const { weeks, loading, refresh } = useFeed();
  const thisWeek = currentWeekStart();
  const nextWeek = addDays(thisWeek, 7);
  const hasNext = weeks.some((w) => w.weekStart === nextWeek);
  const [which, setWhich] = useState<'this' | 'next'>('this');
  const ws = which === 'next' && hasNext ? nextWeek : thisWeek;
  const week = weeks.find((w) => w.weekStart === ws);
  const todayIso = localIso(new Date());
  const [open, setOpen] = useState<number | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    slot: i + 1, iso: addDays(ws, i), v: week?.verses.find((x) => x.slot === i + 1),
  })), [ws, week]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="This week"
        subtitle={`${dayLabel(ws)} – ${dayLabel(addDays(ws, 6))}`}
        action={<Button variant="ghost" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh"><IconRefresh /></Button>}
      />
      {hasNext && (
        <Segmented value={which} onChange={setWhich} options={[{ value: 'this', label: 'This week' }, { value: 'next', label: 'Next week' }]} />
      )}
      {!week ? (
        <Empty icon="🗓️" title={loading ? 'Loading…' : 'Not published yet'}>
          {!loading && 'The verses for this week will appear here once your group admin publishes them.'}
        </Empty>
      ) : (
        <ol className="space-y-2.5">
          {days.map(({ slot, iso, v }) => {
            const isToday = iso === todayIso;
            const expanded = open === slot || isToday;
            return (
              <li key={slot}>
                <button
                  onClick={() => setOpen(open === slot ? null : slot)}
                  className={cx(
                    'w-full text-left rounded-2xl bg-white border shadow-card p-4 transition',
                    isToday ? 'border-gold-400 ring-2 ring-gold-300/50' : 'border-black/5',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cx('text-xs font-medium uppercase tracking-wide', isToday ? 'text-gold-600' : 'text-gray-500')}>
                      {isToday ? 'Today · ' : ''}{dayLabel(iso)}
                    </span>
                    {v && <span className="text-sm font-semibold text-brand-800 truncate">{v.book} {v.chapter}:{v.verse}</span>}
                  </div>
                  {v ? (
                    <p className={cx('tamil text-[15px] text-gray-800 mt-1.5', !expanded && 'line-clamp-2')}>{v.text}</p>
                  ) : (
                    <p className="text-sm text-gray-400 mt-1.5 italic">No verse for this day</p>
                  )}
                </button>
                {expanded && v && (
                  <div className="flex gap-2 mt-2 px-1">
                    <Button size="sm" variant="secondary" onClick={() => shareText(verseMessage(v, dayLabel(iso)))}><IconShare /> Share</Button>
                    <Button size="sm" variant="secondary" onClick={() => copyText(verseMessage(v, dayLabel(iso)))}><IconCopy /> Copy</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
