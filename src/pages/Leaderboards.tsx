import { useEffect, useState } from 'react';
import { currentWeekStart, yearBounds } from '../lib/dates';
import { api } from '../lib/api';
import { saveTextFile } from '../lib/exportFile';
import type { ConsistencyRow, ScoreRow } from '../types';
import { addDays } from '../lib/dates';
import { Button, Card, Empty, PageHeader, Segmented, cx, dayLabel } from '../components/ui';
import { IconChevronLeft, IconChevronRight, IconUpload } from '../components/icons';

type Tab = 'consistency' | 'weekly' | 'yearly';

export default function Leaderboards() {
  const [tab, setTab] = useState<Tab>('consistency');
  const [year, setYear] = useState(new Date().getFullYear());
  const [weekStart, setWeekStart] = useState(currentWeekStart());
  const [consistency, setConsistency] = useState<ConsistencyRow[]>([]);
  const [weekly, setWeekly] = useState<ScoreRow[]>([]);
  const [yearly, setYearly] = useState<ScoreRow[]>([]);

  async function load() {
    const { start, end } = yearBounds(year);
    if (tab === 'consistency') {
      setConsistency((await api().leaderboard.consistency(start, end)) as ConsistencyRow[]);
    } else if (tab === 'weekly') {
      setWeekly((await api().leaderboard.scores(weekStart, start, end)) as ScoreRow[]);
    } else {
      setYearly((await api().leaderboard.scores(null, start, end)) as ScoreRow[]);
    }
  }
  useEffect(() => { load(); }, [tab, year, weekStart]);

  async function exportCsv() {
    let rows: string[][] = [];
    if (tab === 'consistency') {
      rows = [['Rank', 'Name', 'Weeks Present', 'Voice Notes']];
      consistency.forEach((r, i) => rows.push([String(i + 1), r.name, String(r.weeks_present), String(r.notes_count)]));
    } else {
      const data = tab === 'weekly' ? weekly : yearly;
      rows = [['Rank', 'Name', 'Average Score', 'Voice Notes']];
      data.forEach((r, i) => rows.push([String(i + 1), r.name, r.avg_score.toFixed(1), String(r.notes_count)]));
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const filename = `leaderboard-${tab}-${year}${tab === 'weekly' ? '-' + weekStart : ''}.csv`;
    await saveTextFile(filename, csv, 'text/csv');
  }

  const rows: { name: string; main: string; sub: string }[] =
    tab === 'consistency'
      ? consistency.map((r) => ({ name: r.name, main: String(r.weeks_present), sub: `weeks · ${r.notes_count} notes` }))
      : (tab === 'weekly' ? weekly : yearly).map((r) => ({ name: r.name, main: r.avg_score.toFixed(1), sub: `avg · ${r.notes_count} notes` }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leaderboards"
        subtitle="Consistency and recitation quality."
        action={<Button variant="secondary" size="sm" onClick={exportCsv}><IconUpload /> Export</Button>}
      />

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[{ value: 'consistency', label: 'Consistency' }, { value: 'weekly', label: 'Weekly' }, { value: 'yearly', label: 'Yearly' }]}
      />

      <div className="flex items-center gap-2">
        {tab === 'weekly' ? (
          <>
            <Button variant="secondary" size="sm" className="w-10 px-0" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><IconChevronLeft /></Button>
            <div className="flex-1 text-center text-sm font-medium text-ink">{dayLabel(weekStart)} – {dayLabel(addDays(weekStart, 6))}</div>
            <Button variant="secondary" size="sm" className="w-10 px-0" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><IconChevronRight /></Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="sm" className="w-10 px-0" onClick={() => setYear(year - 1)} aria-label="Previous year"><IconChevronLeft /></Button>
            <div className="flex-1 text-center text-sm font-medium text-ink">{year}</div>
            <Button variant="secondary" size="sm" className="w-10 px-0" onClick={() => setYear(year + 1)} aria-label="Next year"><IconChevronRight /></Button>
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty icon="🏆" title="No data yet">
          {tab === 'consistency' ? 'Graded voice notes will appear here.' : tab === 'weekly' ? 'No graded notes in this week.' : 'No graded notes this year.'}
        </Empty>
      ) : (
        <Card pad={false} className="divide-y divide-gray-100 overflow-hidden">
          {rows.map((r, i) => (
            <div key={i} className={cx('flex items-center gap-3 px-4 py-3', i < 3 && 'bg-gold-100/30')}>
              <span className={cx(
                'w-8 h-8 rounded-full grid place-items-center text-sm font-bold shrink-0',
                i === 0 ? 'bg-gold-400 text-brand-950' : i === 1 ? 'bg-gray-200 text-gray-700' : i === 2 ? 'bg-amber-200 text-amber-900' : 'text-gray-500',
              )}>
                {i + 1}
              </span>
              <span className="flex-1 min-w-0 text-[15px] font-medium truncate">{r.name}</span>
              <span className="text-right shrink-0">
                <span className="block text-base font-bold text-brand-800 leading-tight">{r.main}</span>
                <span className="block text-[11px] text-gray-500">{r.sub}</span>
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
