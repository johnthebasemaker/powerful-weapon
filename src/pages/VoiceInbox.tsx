import { useEffect, useMemo, useState } from 'react';
import {
  addDays, currentWeekStart, defaultUploadWeek, formatHuman, isPreviousWeek, weekdayLabel,
} from '../lib/dates';
import { api } from '../lib/api';
import { takePendingShared, onSharedAudio } from '../lib/shareIntent';
import { isNative } from '../lib/platform';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Empty, Field, Notice, PageHeader, SectionTitle, Segmented, Select, cx, dayLabel } from '../components/ui';
import { IconChevronLeft, IconChevronRight, IconMic, IconTrash } from '../components/icons';
import Recordings from '../components/Recordings';
import AdminGate from '../components/AdminGate';
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

type Source = 'app' | 'whatsapp';

export default function VoiceInbox() {
  const [source, setSource] = useState<Source>('app');
  return (
    <div className="space-y-4">
      <PageHeader title="Voice" subtitle="Recordings from the app, or voice notes imported from WhatsApp." />
      <Segmented<Source> value={source} onChange={setSource}
        options={[{ value: 'app', label: 'App recordings' }, { value: 'whatsapp', label: 'WhatsApp import' }]} />
      {source === 'app'
        ? <AdminGate what="see members' recordings"><Recordings /></AdminGate>
        : <WhatsAppImport />}
    </div>
  );
}

function WhatsAppImport() {
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
      api().users.list(),
      api().selections.get(weekStart),
      api().selections.count(weekStart),
      api().voiceNotes.listGrouped(weekStart),
      api().whisper.check(),
    ]);
    setUsers(u as User[]);
    setSelections(s as Selection[]);
    setSelectionCount(count as number);
    setGrouped(g as GroupedNote[]);
    setWhisper(w as any);
    setExpandedKey(null);
  }
  useEffect(() => { load(); }, [weekStart]);

  // Pull in any voice note shared from WhatsApp (cold start via queue, warm via listener).
  useEffect(() => {
    const incoming = takePendingShared();
    if (incoming.length) setPendingFiles((p) => Array.from(new Set([...p, ...incoming])));
    return onSharedAudio((keys) => setPendingFiles((p) => Array.from(new Set([...p, ...keys]))));
  }, []);

  const allWeekReady = selectionCount === 7;
  const isPrev = isPreviousWeek(weekStart);
  const isCurrent = weekStart === currentWeekStart();

  async function pickFiles() {
    const paths = (await api().files.pickVoiceNotes()) as string[];
    setPendingFiles(paths);
    setStatusMsg('');
  }

  async function importOne(srcPath: string) {
    if (!importTarget.userId) { alert('Pick a user first.'); return; }
    if (mode === 'allWeek' && !allWeekReady) {
      alert(`Only ${selectionCount} of 7 verses are saved for the week of ${formatHuman(weekStart)}. Go to Verse Picker and save all 7 first.`);
      return;
    }

    // Prevent accidental double-processing of a user's weekly submission.
    // (transcribeAndGradeWeek atomically replaces this user's grades for the week.)
    if (mode === 'allWeek' && grouped.some((g) => g.user_id === Number(importTarget.userId))) {
      const userName = users.find((u) => u.id === Number(importTarget.userId))?.name ?? 'This user';
      const proceed = confirm(
        `${userName} already has grades for the week of ${formatHuman(weekStart)}.\n\n` +
        `Re-grade this voice note and replace the old scores?`
      );
      if (!proceed) return;
    }

    const imp = await api().files.importVoiceNote(srcPath);
    if (!imp.ok) { alert(`Import failed: ${imp.error}`); return; }

    setBusy(true);
    setStatusMsg('Transcribing… this can take ~30-90 seconds per minute of audio.');

    if (mode === 'allWeek') {
      const r = await api().whisper.transcribeAndGradeWeek({
        userId: Number(importTarget.userId), filePath: imp.path, weekStart,
      });
      if (!r.ok) { alert(`Grading failed: ${r.error}`); setBusy(false); setStatusMsg(''); return; }
      setStatusMsg(`✅ Graded against all 7 verses. Weekly average: ${r.weeklyAverage}/100`);
    } else {
      const sel = selections.find((s) => s.slot === importTarget.slot);
      if (!sel) { alert('No verse for that day.'); setBusy(false); setStatusMsg(''); return; }
      const vn = await api().voiceNotes.create({
        user_id: importTarget.userId, week_start_date: weekStart,
        verse_slot: importTarget.slot, file_path: imp.path,
      });
      if (whisper?.ok) {
        await api().whisper.transcribeAndGrade({
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
    const details = (await api().voiceNotes.detailsByFile(g.user_id, g.week_start_date, g.file_path)) as VoiceNote[];
    setExpandedDetails(details);
    setExpandedKey(key);
  }

  async function removeGroup(g: GroupedNote) {
    if (!confirm(`Remove ${g.user_name}'s voice note (${g.verse_count} graded ${g.verse_count > 1 ? 'verses' : 'verse'})?`)) return;
    await api().voiceNotes.deleteByFile(g.user_id, g.week_start_date, g.file_path);
    load();
  }

  async function clearAllWeek() {
    if (!confirm(`Remove ALL imported voice notes for the week of ${formatHuman(weekStart)}? This cannot be undone.`)) return;
    await api().voiceNotes.deleteAllForWeek(weekStart);
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
    <div className="space-y-4">

      {/* Week navigation */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="w-10 px-0" onClick={() => jumpWeek(-1)} aria-label="Previous week"><IconChevronLeft /></Button>
          <label className="flex-1 min-w-0 text-center relative">
            <span className="block text-[15px] font-semibold text-ink truncate">{dayLabel(weekStart)} – {dayLabel(addDays(weekStart, 6))}</span>
            <span className="block text-xs text-gray-500">Tap to choose a week</span>
            <input
              type="date" value={weekStart} aria-label="Week"
              onChange={(e) => e.target.value && setWeekStart(currentWeekStart(new Date(e.target.value + 'T00:00:00')))}
              className="absolute inset-0 opacity-0 w-full"
            />
          </label>
          <Button variant="secondary" size="sm" className="w-10 px-0" onClick={() => jumpWeek(1)} aria-label="Next week"><IconChevronRight /></Button>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          <Badge tone={isPrev ? 'amber' : isCurrent ? 'green' : 'gray'}>{isPrev ? 'Last week' : isCurrent ? 'This week' : formatHuman(weekStart)}</Badge>
          <Badge tone={allWeekReady ? 'green' : 'red'}>{selectionCount}/7 verses saved</Badge>
        </div>
      </Card>

      {!whisper?.ok && (
        <Notice tone="warn">
          {isNative() ? (
            <><strong>Speech-to-text isn't set up.</strong> Notes can be imported but won't be graded. <Link to="/settings" className="underline font-medium">Open Settings</Link></>
          ) : (
            <><strong>Whisper not installed.</strong> Voice notes can be imported but auto-grading is disabled.
              {whisper?.reason && <code className="block text-xs bg-white border border-amber-200 rounded p-1.5 mt-2 break-all">{whisper.reason}</code>}</>
          )}
        </Notice>
      )}

      {isPrev && (
        <Notice tone="info">
          You're grading <strong>last week's</strong> recordings ({formatHuman(weekStart)} – {formatHuman(addDays(weekStart, 6))}) — the normal Monday/Tuesday routine.
        </Notice>
      )}

      {/* Mode + import */}
      <Card className="space-y-4">
        <div>
          <SectionTitle>Grading mode</SectionTitle>
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[{ value: 'allWeek', label: 'All 7 in one note' }, { value: 'perDay', label: 'One per day' }]}
          />
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            {mode === 'allWeek'
              ? 'One long voice note reciting all 7 verses → 7 scores and a weekly average.'
              : 'Separate short notes through the week → pick the day and grade against that verse.'}
          </p>
        </div>

        {mode === 'allWeek' && !allWeekReady && (
          <Notice tone="error">
            Only <strong>{selectionCount} of 7</strong> verses are saved for this week. Save all 7 in the <Link to="/verses" className="underline font-medium">Verse Picker</Link> first.
          </Notice>
        )}

        <Button block disabled={mode === 'allWeek' && !allWeekReady} onClick={pickFiles}>
          <IconMic /> Choose voice notes
        </Button>
        {isNative() && (
          <p className="text-xs text-gray-500 -mt-2 text-center">Tip: in WhatsApp, long-press a voice note → Share → Powerful Weapon.</p>
        )}

        {pendingFiles.length > 0 && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className={cx('grid gap-3', mode === 'perDay' && 'sm:grid-cols-2')}>
              <Field label="Speaker">
                <Select
                  value={importTarget.userId}
                  onChange={(e) => setImportTarget({ ...importTarget, userId: e.target.value ? Number(e.target.value) : '' })}
                >
                  <option value="">Select member…</option>
                  {userOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </Select>
              </Field>
              {mode === 'perDay' && (
                <Field label="Day / verse">
                  <Select
                    value={importTarget.slot}
                    onChange={(e) => setImportTarget({ ...importTarget, slot: Number(e.target.value) })}
                  >
                    {selections.map((s) => (
                      <option key={s.slot} value={s.slot}>{weekdayLabel(s.slot)} — {s.book} {s.chapter}:{s.verse}</option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            <ul className="space-y-2">
              {pendingFiles.map((p) => (
                <li key={p} className="rounded-xl border border-gray-200 p-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">🎵 {p.split(/[/\\]/).pop()}</span>
                  <Button size="sm" variant="success" disabled={busy} onClick={() => importOne(p)}>
                    {busy ? 'Grading…' : 'Import + Grade'}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {statusMsg && <div className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">{statusMsg}</div>}
      </Card>

      {/* Imported notes */}
      <section>
        <SectionTitle action={grouped.length > 0 && <Button variant="danger" size="sm" onClick={clearAllWeek}>Clear week</Button>}>
          Graded this week ({grouped.length})
        </SectionTitle>
        {grouped.length === 0 ? (
          <Empty icon="🎙️" title="Nothing graded yet">Choose voice notes above, or share one from WhatsApp.</Empty>
        ) : (
          <div className="space-y-2.5">
            {grouped.map((g) => {
              const key = `${g.user_id}|${g.file_path}`;
              const fileName = g.file_path.split(/[/\\]/).pop() ?? g.file_path;
              const expanded = expandedKey === key;
              return (
                <Card key={key}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink truncate">{g.user_name}</div>
                      <div className="text-xs text-gray-400 truncate" title={g.file_path}>{fileName}</div>
                      <div className="mt-1.5">
                        <Badge tone={g.verse_count === 7 ? 'green' : 'amber'}>{g.graded_count}/{g.verse_count} graded</Badge>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-brand-800 leading-none">{g.avg_total != null ? g.avg_total.toFixed(1) : '—'}</div>
                      <div className="text-[11px] text-gray-500 mt-1">avg / 100</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => toggleDetails(g)}>
                      {expanded ? 'Hide details' : 'View details'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => removeGroup(g)} aria-label="Remove"><IconTrash /></Button>
                  </div>
                  {expanded && <Details rows={expandedDetails} transcript={g.transcript} />}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Details({ rows, transcript }: { rows: VoiceNote[]; transcript: string | null }) {
  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
      {transcript && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Transcript</div>
          <div className="tamil text-sm bg-gray-50 rounded-xl p-3 leading-relaxed">{transcript}</div>
        </div>
      )}
      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Per-verse scores</div>
        <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-9 text-xs font-semibold text-gray-600">{weekdayLabel(r.verse_slot)}</span>
              <span className="flex-1 text-[11px] text-gray-500 leading-tight">
                Accuracy {r.accuracy_score?.toFixed(1) ?? '—'}/60 · Fluency {r.fluency_score?.toFixed(1) ?? '—'}/25 · Reference {r.reference_score?.toFixed(1) ?? '—'}/15
              </span>
              <span className="text-sm font-bold text-ink w-12 text-right">{r.total_score?.toFixed(1) ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
