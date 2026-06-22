import { useEffect, useState } from 'react';
import { currentWeekStart, yearBounds } from '../lib/dates';
import type { ConsistencyRow, ScoreRow } from '../types';

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
      setConsistency((await window.api.leaderboard.consistency(start, end)) as ConsistencyRow[]);
    } else if (tab === 'weekly') {
      setWeekly((await window.api.leaderboard.scores(weekStart, start, end)) as ScoreRow[]);
    } else {
      setYearly((await window.api.leaderboard.scores(null, start, end)) as ScoreRow[]);
    }
  }
  useEffect(() => { load(); }, [tab, year, weekStart]);

  function exportCsv() {
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
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaderboard-${tab}-${year}${tab === 'weekly' ? '-' + weekStart : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leaderboards</h1>
          <p className="text-sm text-gray-500 mt-1">Track consistency and recitation quality.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="w-20 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
          {tab === 'weekly' && (
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          )}
          <button onClick={exportCsv} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50">
            Export CSV
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['consistency', 'weekly', 'yearly'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'consistency' && 'Consistency'}
            {t === 'weekly' && 'Weekly Scores'}
            {t === 'yearly' && 'Yearly Scores'}
          </button>
        ))}
      </div>

      {/* Tables */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {tab === 'consistency' && (
          <Table
            headers={['Rank', 'Name', 'Weeks present', 'Voice notes']}
            rows={consistency.map((r, i) => [String(i + 1), r.name, String(r.weeks_present), String(r.notes_count)])}
            emptyMsg="No data yet."
          />
        )}
        {tab === 'weekly' && (
          <Table
            headers={['Rank', 'Name', 'Avg score', 'Voice notes']}
            rows={weekly.map((r, i) => [String(i + 1), r.name, r.avg_score.toFixed(1), String(r.notes_count)])}
            emptyMsg="No graded notes in this week."
          />
        )}
        {tab === 'yearly' && (
          <Table
            headers={['Rank', 'Name', 'Avg score', 'Voice notes']}
            rows={yearly.map((r, i) => [String(i + 1), r.name, r.avg_score.toFixed(1), String(r.notes_count)])}
            emptyMsg="No graded notes this year."
          />
        )}
      </div>
    </div>
  );
}

function Table({ headers, rows, emptyMsg }: { headers: string[]; rows: string[][]; emptyMsg: string }) {
  if (rows.length === 0) {
    return <div className="text-center text-gray-400 py-10 text-sm">{emptyMsg}</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-gray-600 text-left">
        <tr>{headers.map((h, i) => <th key={i} className="px-4 py-2 font-medium">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((r, i) => (
          <tr key={i} className={i < 3 ? 'bg-amber-50/40' : ''}>
            {r.map((c, j) => (
              <td key={j} className={`px-4 py-2 ${j === 0 ? 'font-semibold w-16' : ''}`}>
                {j === 0 && i < 3 ? ['🥇', '🥈', '🥉'][i] + ' ' + c : c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
