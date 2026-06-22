import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  addDays, currentWeekStart, defaultUploadWeek, formatHuman, isPreviousWeek, weekdayLabel,
} from '../lib/dates';
import type { Selection, User, VoiceNote } from '../types';

type Mode = 'perDay' | 'allWeek';

interface GroupedNote {
  file_path: string;
  user_id: number;
  user_name: string;
  week_start_date: string;
  verse_count: number;
  avg_total: number | null;
  graded_count: number;
  latest_graded_at: string | null;
  transcript: string | null;
  min_id: number;
}

export default function VoiceInbox() {
  const [weekStart, setWeekStart] = useState(defaultUploadWeek());
  const [users, setUsers] = useState<User[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [selectionCount, setSelectionCount] = useState(0);
  const [grouped, setGrouped] = useState<GroupedNote[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<VoiceNote[]>([]);
  const [whisper, setWhisper] = useState<{ ok: boolean; reason?: string } | null>(null);

  const [mode, setMode] = useState<Mode>('allWeek');
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [importTarget, setImportTarget] = useState<{ userId: number | ''; slot: number }>({ userId: '', slot: 1 });
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  async function load() {
    const [u, s, count, g, w] = await Promise.all([
      window.api.users.list(),
      window.api.selections.get(weekStart),
      window.api.selections.count(weekStart),
      window.api.voiceNotes.listGrouped(weekStart),
      window.api.whisper.check(),
    ]);
    setUsers(u as User[]);
    setSelections(s as Selection[]);
    setSelectionCount(count as number);
    setGrouped(g as GroupedNote[]);
    setWhisper(w as any);
    setExpandedKey(null);
  }
  useEffect(() => { load(); }, [weekStart]);

  const allWeekReady = selectionCount === 7;
  const isPrev = isPreviousWeek(weekStart);
  const isCurrent = weekStart === currentWeekStart();

  async function pickFiles() {
    const paths = (await window.api.files.pickVoiceNotes()) as string[];
    setPendingFiles(paths);
    setStatusMsg('');
  }

  async function importOne(srcPath: string) {
    if (!importTarget.userId) { alert('Pick a user first.'); return; }
    if (mode === 'allWeek' && !allWeekReady) {
      alert(`Only ${selectionCount} of 7 verses are saved for the week of ${formatHuman(weekStart)}. Go to Verse Picker and save all 7 first.`);
      return;
    }

    // Duplicate check (by basename — handles cases where the same WhatsApp file is re-picked)
    const exists = await window.api.voiceNotes.fileExists(
      Number(importTarget.userId), weekStart, srcPath
    );
    if (exists) {
      const proceed = confirm(
        `A voice note with the same filename has already been imported for this user in the week of ${formatHuman(weekStart)}.\n\n` +
        `Replace it with this new one? (Old grades for this audio will be removed.)`
      );
      if (!proceed) return;
      // Caller will replace by deleting existing rows first
      const fileName = srcPath.split(/[/\\]/).pop() ?? srcPath;
      const oldRow = grouped.find(
        (g) => g.user_id === Number(importTarget.userId) && g.file_path.endsWith(fileName)
      );
      if (oldRow) {
        await window.api.voiceNotes.deleteByFile(oldRow.user_id, oldRow.week_start_date, oldRow.file_path);
      }
    }

    const imp = await window.api.files.importVoiceNote(srcPath);
    if (!imp.ok) { alert(`Import failed: ${imp.error}`); return; }

    setBusy(true);
    setStatusMsg('Transcribing… this can take ~30-90 seconds per minute of audio.');

    if (mode === 'allWeek') {
      const r = await window.api.whisper.transcribeAndGradeWeek({
        userId: Number(importTarget.userId), filePath: imp.path, weekStart,
      });
      if (!r.ok) { alert(`Grading failed: ${r.error}`); setBusy(false); setStatusMsg(''); return; }
      setStatusMsg(`✅ Graded against all 7 verses. Weekly average: ${r.weeklyAverage}/100`);
    } else {
      const sel = selections.find((s) => s.slot === importTarget.slot);
      if (!sel) { alert('No verse for that day.'); setBusy(false); setStatusMsg(''); return; }
      const vn = await window.api.voiceNotes.create({
        user_id: importTarget.userId, week_start_date: weekStart,
        verse_slot: importTarget.slot, file_path: imp.path,
      });
      if (whisper?.ok) {
        await window.api.whisper.transcribeAndGrade({
          voiceNoteId: vn.id, filePath: imp.path,
          referenceText: sel.text_tamil,
          referenceCitation: { book: sel.book, chapter: sel.chapter, verse: sel.verse },
        });
      }
      setStatusMsg('✅ Imported.');
    }
    setBusy(false);
    setPendingFiles((p) => p.filter((x) => x !== srcPath));
    load();
  }

  async function toggleDetails(g: GroupedNote) {
    const key = `${g.user_id}|${g.file_path}`;
    if (expandedKey === key) {
      setExpandedKey(null);
      setExpandedDetails([]);
      return;
    }
    const details = (await window.api.voiceNotes.detailsByFile(g.user_id, g.week_start_date, g.file_path)) as VoiceNote[];
    setExpandedDetails(details);
    setExpandedKey(key);
  }

  async function removeGroup(g: GroupedNote) {
    if (!confirm(`Remove ${g.user_name}'s voice note (${g.verse_count} graded ${g.verse_count > 1 ? 'verses' : 'verse'})?`)) return;
    await window.api.voiceNotes.deleteByFile(g.user_id, g.week_start_date, g.file_path);
    load();
  }

  async function clearAllWeek() {
    if (!confirm(`Remove ALL imported voice notes for the week of ${formatHuman(weekStart)}? This cannot be undone.`)) return;
    await window.api.voiceNotes.deleteAllForWeek(weekStart);
    load();
  }

  function jumpWeek(delta: number) {
    setWeekStart(addDays(weekStart, delta * 7));
  }

  const userOptions = useMemo(
    () => users.filter((u) => u.active).map((u) => ({ id: u.id, label: `${u.name} (${u.phone})` })),
    [users]
  );

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Voice Inbox</h1>
          <p className="text-sm text-gray-500 mt-1">Import WhatsApp voice notes, grade automatically.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => jumpWeek(-1)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">← Prev</button>
            <input
              type="date" value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            />
            <button onClick={() => jumpWeek(1)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Next →</button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full ${
              isPrev ? 'bg-amber-100 text-amber-800' : isCurrent ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
            }`}>
              {isPrev ? 'Last week' : isCurrent ? 'This week' : formatHuman(weekStart)}
            </span>
            <span className={`px-2 py-0.5 rounded-full ${
              allWeekReady ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}>
              {selectionCount}/7 verses saved
            </span>
          </div>
        </div>
      </header>

      {!whisper?.ok && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 space-y-1">
          <div><strong>Whisper not installed.</strong> Voice notes can be imported but auto-grading is disabled.</div>
          {whisper?.reason && (
            <code className="block text-xs bg-white border border-amber-200 rounded p-1.5 mt-1 break-all">
              {whisper.reason}
            </code>
          )}
        </div>
      )}

      {/* Workflow hint when on previous/old weeks */}
      {isPrev && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
          You're processing <strong>last week's</strong> recordings (verses for {formatHuman(weekStart)}–{formatHuman(addDays(weekStart, 6))}). This is the normal Monday/Tuesday workflow.
        </div>
      )}

      {/* Mode toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-medium mb-3">Grading mode</h2>
        <div className="grid grid-cols-2 gap-3">
          <ModeCard
            active={mode === 'allWeek'}
            onClick={() => setMode('allWeek')}
            title="All 7 verses in one file"
            desc="Member sends one long voice note (60s+) reciting all 7 verses. Transcribe once → grade against each verse → 7 scores + weekly average."
          />
          <ModeCard
            active={mode === 'perDay'}
            onClick={() => setMode('perDay')}
            title="One voice note per day"
            desc="Member sends 7 separate short voice notes through the week. Pick the day + the speaker, grade against that single verse."
          />
        </div>
      </div>

      {/* Import area */}
      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {mode === 'allWeek' && !allWeekReady && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-900">
            <strong>Only {selectionCount} of 7 verses are saved for this week.</strong> Open <strong>Verse Picker</strong>, search a root word, and save all 7 before importing in "All 7" mode.
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            disabled={mode === 'allWeek' && !allWeekReady}
            onClick={pickFiles}
            className="px-3 py-2 bg-brand-500 text-white text-sm rounded-md hover:bg-brand-600 disabled:opacity-50"
          >
            Pick voice note files
          </button>
          <span className="text-xs text-gray-500">
            {mode === 'allWeek' ? 'Each file will be graded against all 7 verses for this week.' : 'Each file is graded against the day you choose.'}
          </span>
        </div>

        {pendingFiles.length > 0 && (
          <div className="border-t border-gray-100 pt-3 space-y-3">
            <div className={`grid ${mode === 'allWeek' ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
              <div>
                <label className="text-xs text-gray-500">Speaker</label>
                <select
                  value={importTarget.userId}
                  onChange={(e) => setImportTarget({ ...importTarget, userId: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                >
                  <option value="">— select user —</option>
                  {userOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
              {mode === 'perDay' && (
                <div>
                  <label className="text-xs text-gray-500">Day / Verse</label>
                  <select
                    value={importTarget.slot}
                    onChange={(e) => setImportTarget({ ...importTarget, slot: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  >
                    {selections.map((s) => (
                      <option key={s.slot} value={s.slot}>
                        {weekdayLabel(s.slot)} — {s.book} {s.chapter}:{s.verse}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {pendingFiles.map((p) => (
                <li key={p} className="px-3 py-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-700 truncate">{p}</span>
                  <button
                    disabled={busy}
                    onClick={() => importOne(p)}
                    className="text-xs px-2 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50 whitespace-nowrap"
                  >
                    {busy ? 'Grading…' : 'Import + Grade'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {statusMsg && (
          <div className="text-sm text-gray-700 italic">{statusMsg}</div>
        )}
      </section>

      {/* Imported notes (grouped) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Imported notes — week of {formatHuman(weekStart)} ({grouped.length})</h2>
          {grouped.length > 0 && (
            <button onClick={clearAllWeek} className="text-xs text-red-600 hover:underline">
              Clear all this week
            </button>
          )}
        </div>
        {grouped.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            Nothing here yet.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Verses graded</th>
                  <th className="px-3 py-2 font-medium text-right">Avg score</th>
                  <th className="px-3 py-2 font-medium w-40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grouped.map((g) => {
                  const key = `${g.user_id}|${g.file_path}`;
                  const fileName = g.file_path.split(/[/\\]/).pop() ?? g.file_path;
                  const expanded = expandedKey === key;
                  return (
                    <Fragment key={key}>
                      <tr>
                        <td className="px-3 py-2 font-medium">{g.user_name}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-xs" title={g.file_path}>
                          {fileName}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            g.verse_count === 7 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {g.graded_count}/{g.verse_count} graded
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {g.avg_total !== null ? `${g.avg_total.toFixed(1)} / 100` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                          <button onClick={() => toggleDetails(g)} className="text-xs text-brand-600 hover:underline">
                            {expanded ? 'Hide' : 'View'} details
                          </button>
                          <button onClick={() => removeGroup(g)} className="text-xs text-red-600 hover:underline">
                            Remove
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-brand-50/40">
                          <td colSpan={5} className="px-3 py-3">
                            <DetailsTable rows={expandedDetails} transcript={g.transcript} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ModeCard({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-lg border-2 transition ${
        active ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
          active ? 'border-brand-500' : 'border-gray-300'
        }`}>
          {active && <div className="w-2 h-2 rounded-full bg-brand-500" />}
        </div>
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{desc}</p>
    </button>
  );
}

function DetailsTable({ rows, transcript }: { rows: VoiceNote[]; transcript: string | null }) {
  return (
    <div className="space-y-3">
      {transcript && (
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Transcript</div>
          <div className="tamil text-sm bg-white border border-gray-200 rounded p-2 leading-relaxed">
            {transcript}
          </div>
        </div>
      )}
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Per-verse scores</div>
        <table className="w-full text-sm bg-white border border-gray-200 rounded">
          <thead className="text-gray-600 text-left">
            <tr className="border-b border-gray-100">
              <th className="px-2 py-1 font-medium">Day</th>
              <th className="px-2 py-1 font-medium text-right">Acc /60</th>
              <th className="px-2 py-1 font-medium text-right">Flu /25</th>
              <th className="px-2 py-1 font-medium text-right">Ref /15</th>
              <th className="px-2 py-1 font-medium text-right">Total /100</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-1 text-gray-600">{weekdayLabel(r.verse_slot)}</td>
                <td className="px-2 py-1 text-right">{r.accuracy_score?.toFixed(1) ?? '—'}</td>
                <td className="px-2 py-1 text-right">{r.fluency_score?.toFixed(1) ?? '—'}</td>
                <td className="px-2 py-1 text-right">{r.reference_score?.toFixed(1) ?? '—'}</td>
                <td className="px-2 py-1 text-right font-semibold">{r.total_score?.toFixed(1) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
