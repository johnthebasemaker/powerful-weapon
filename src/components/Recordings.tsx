import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { addDays, weekdayLabel } from '../lib/dates';
import {
  allowRedo, fetchAudio, fmtWhen, getConfig, groupStatus, GroupRow, listSubmissions, RecordWindow, Submission, updateSubmission,
} from '../lib/remote';
import { applyCalibration, autoMark, Calibration, Engine, loadCalibration, MarkResult, syncToLeaderboard, WeekVerse } from '../lib/autoMark';
import { isNative } from '../lib/platform';
import { toast } from '../lib/toast';
import AudioButton from './AudioButton';
import { Badge, Button, Card, Empty, Input, Notice, SectionTitle, Select, dayLabel } from './ui';
import { IconChevronLeft, IconChevronRight, IconRefresh, IconSend, IconUpload } from './icons';

interface Parsed { result: MarkResult | null; compare?: MarkResult[] }
const nameKey = (n: string) => n.normalize('NFC').toLowerCase().replace(/\s+/g, '');
const parse = (s: Submission): Parsed => { try { return JSON.parse(s.auto_json || 'null') ?? { result: null }; } catch { return { result: null }; } };

/** Admin inbox for recordings sent from members' phones. */
export default function Recordings() {
  const [week, setWeek] = useState('');
  const [win, setWin] = useState<RecordWindow | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [group, setGroup] = useState<GroupRow[]>([]);
  const [verses, setVerses] = useState<WeekVerse[]>([]);
  const [engine, setEngine] = useState<Engine>('whisper');
  const [calib, setCalib] = useState<Calibration | null>(null);
  const [useCalib, setUseCalib] = useState(true);
  const [busy, setBusy] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [phones, setPhones] = useState<Record<string, string>>({});

  // First load: start on the week whose recording window is open / most recent.
  useEffect(() => {
    (async () => {
      const s = (await api().settings.getAll()) as Record<string, string>;
      if (s.mark_engine === 'sarvam') setEngine('sarvam');
      setUseCalib(s.use_calibration !== 'false');
      try {
        const cfg = await getConfig();
        setWin(cfg.window);
        setWeek(cfg.window.open ? cfg.window.weekStart : addDays(cfg.window.weekStart, -7));
      } catch (e: any) { setError(e.message); }
      setCalib(await loadCalibration());
      const users = (await api().users.list()) as { name: string; phone: string }[];
      setPhones(Object.fromEntries(users.filter((u) => !u.phone.startsWith('app-member-')).map((u) => [nameKey(u.name), u.phone])));
    })();
  }, []);

  const load = useCallback(async () => {
    if (!week) return;
    setError('');
    try {
      const [s, g, sel] = await Promise.all([listSubmissions(week), groupStatus(week), api().selections.get(week)]);
      setSubs(s);
      setGroup(g.members);
      setVerses((sel as any[]).map((x) => ({ slot: x.slot, book: x.book, chapter: x.chapter, verse: x.verse, text: x.text_tamil })));
    } catch (e: any) { setError(e.message); }
  }, [week]);
  useEffect(() => { load(); }, [load]);

  const missing = useMemo(() => group.filter((g) => !g.submission_id), [group]);

  const setBusyFor = (id: number, label: string) => setBusy((b) => ({ ...b, [id]: label }));
  const clearBusy = (id: number) => setBusy((b) => { const n = { ...b }; delete n[id]; return n; });

  async function mark(s: Submission, eng: Engine | 'compare') {
    if (verses.length !== 7) { toast('Save all 7 verses for this week in the Verse Picker first.', 'error'); return; }
    setBusyFor(s.id, eng === 'compare' ? 'Comparing…' : 'Marking…');
    try {
      if (eng === 'compare') {
        const [w, sv] = [await autoMark(s, verses, 'whisper'), await autoMark(s, verses, 'sarvam')];
        await updateSubmission(s.id, { auto_json: JSON.stringify({ result: parse(s).result ?? w, compare: [w, sv] }) });
      } else {
        const r = await autoMark(s, verses, eng);
        await updateSubmission(s.id, { auto_total: r.total, engine: eng, transcript: r.transcript, auto_json: JSON.stringify({ result: r, compare: parse(s).compare }) });
        if (s.manual_total == null) await syncToLeaderboard(s, r);
      }
      await load();
    } catch (e: any) {
      toast(e.message ?? 'Auto-mark failed', 'error', 6000);
    } finally { clearBusy(s.id); }
  }

  async function markAll() {
    for (const s of subs.filter((x) => x.auto_total == null && x.audio_available)) await mark(s, engine);
    toast('All recordings marked', 'success');
  }

  async function saveManual(s: Submission, value: string, note: string) {
    const n = Number(value);
    if (value === '' || Number.isNaN(n) || n < 0 || n > 100) { toast('Enter a mark from 0 to 100', 'error'); return; }
    await updateSubmission(s.id, { manual_total: n, manual_note: note });
    // Leaderboards use the admin's mark when there is one.
    const base = parse(s).result;
    const perVerse = (base?.perVerse ?? verses.map((v) => ({ slot: v.slot, transcript: '', accuracy: 0, fluency: 0, reference: 0, seconds: 0, total: n })))
      .map((p) => ({ ...p, total: n }));
    await syncToLeaderboard(s, { engine: base?.engine ?? 'whisper', total: n, perVerse, transcript: s.transcript ?? '', split: !!base?.split });
    toast(`Saved ${n}/100 for ${s.name}`, 'success', 1800);
    setCalib(await loadCalibration());
    load();
  }

  async function redo(s: Submission) {
    if (!confirm(`Delete ${s.name}'s recording so they can record again? Their marks for this week are removed too.`)) return;
    await allowRedo(s.id);
    load();
  }

  function remind(g: GroupRow) {
    const text = `Hi ${g.name}, please send this week's memory-verse recording from the Powerful Weapon app${win?.open && win.weekStart === week ? ` before ${fmtWhen(win.closesAt)}` : ''}. 🙏`;
    const phone = (phones[nameKey(g.name)] ?? '').replace(/[^\d]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_system');
  }

  async function backup() {
    const withAudio = subs.filter((s) => s.audio_available);
    if (!withAudio.length) { toast('No recordings with audio this week', 'info'); return; }
    toast(`Preparing ${withAudio.length} recordings…`, 'info');
    try {
      if (isNative()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const files: string[] = [];
        for (const s of withAudio) {
          const blob = await fetchAudio(s.id);
          const b64 = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
          const ext = s.mime.includes('ogg') ? 'ogg' : s.mime.includes('mp4') ? 'm4a' : 'webm';
          const { uri } = await Filesystem.writeFile({ path: `recordings-${week}/${s.name.replace(/[^\w஀-௿ -]/g, '')}-${week}.${ext}`, data: b64, directory: Directory.Cache, recursive: true });
          files.push(uri);
        }
        await Share.share({ title: `Recordings — week of ${week}`, files });
      } else {
        for (const s of withAudio) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(await fetchAudio(s.id));
          a.download = `${s.name}-${week}.webm`;
          a.click();
        }
      }
    } catch (e: any) { toast(e.message ?? 'Backup failed', 'error'); }
  }

  async function changeEngine(e: Engine) {
    setEngine(e);
    await api().settings.set('mark_engine', e);
  }

  const expiry = (s: Submission) => {
    const d = new Date(s.created_at.replace(' ', 'T') + 'Z');
    d.setDate(d.getDate() + 56);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="w-10 px-0" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week"><IconChevronLeft /></Button>
          <div className="flex-1 text-center min-w-0">
            <div className="text-[15px] font-semibold truncate">{week ? `${dayLabel(week)} – ${dayLabel(addDays(week, 6))}` : '…'}</div>
            <div className="text-xs text-gray-500">{subs.length} of {group.length} members sent</div>
          </div>
          <Button variant="secondary" size="sm" className="w-10 px-0" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week"><IconChevronRight /></Button>
        </div>
        {win && win.weekStart === week && (
          <div className="text-center"><Badge tone={win.open ? 'green' : 'gray'}>{win.open ? `Open until ${fmtWhen(win.closesAt)}` : `Opens ${fmtWhen(win.opensAt)}`}</Badge></div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Select value={engine} onChange={(e) => changeEngine(e.target.value as Engine)} aria-label="Speech engine">
            <option value="whisper">Whisper</option>
            <option value="sarvam">Sarvam</option>
          </Select>
          <Button onClick={markAll} disabled={!subs.some((s) => s.auto_total == null)}>Auto-mark all</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={backup}><IconUpload /> Backup</Button>
          <Button variant="secondary" size="sm" onClick={load}><IconRefresh /> Refresh</Button>
        </div>
      </Card>

      {error && <Notice tone="error">{error}</Notice>}
      {verses.length !== 7 && week && !error && (
        <Notice tone="warn">Only {verses.length} of 7 verses are saved for this week. <Link to="/verses" className="underline font-medium">Open Verse Picker</Link> to mark recordings.</Notice>
      )}
      {calib && useCalib && calib.maeAfter < calib.maeBefore && (
        <Notice tone="info">Auto marks are adjusted to your marking style (learnt from {calib.n} of your marks; average gap {calib.maeBefore.toFixed(1)} → {calib.maeAfter.toFixed(1)}).</Notice>
      )}

      <section>
        <SectionTitle>Recordings ({subs.length})</SectionTitle>
        {subs.length === 0 ? <Empty icon="🎙️" title="No recordings yet">Members record from their phones during the recording time.</Empty> : (
          <div className="space-y-2.5">
            {subs.map((s) => <SubmissionCard key={s.id} s={s} busy={busy[s.id]} calib={useCalib ? calib : null}
              verses={verses} expiry={expiry(s)} onMark={(e) => mark(s, e)} onManual={(v, n) => saveManual(s, v, n)} onRedo={() => redo(s)} />)}
          </div>
        )}
      </section>

      {missing.length > 0 && (
        <section>
          <SectionTitle>Not sent yet ({missing.length})</SectionTitle>
          <Card pad={false} className="divide-y divide-gray-100 overflow-hidden">
            {missing.map((g) => (
              <div key={g.member_id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 text-[15px] truncate">{g.name}</span>
                <Button size="sm" variant="secondary" onClick={() => remind(g)}><IconSend /> Remind</Button>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function SubmissionCard({ s, busy, calib, verses, expiry, onMark, onManual, onRedo }: {
  s: Submission; busy?: string; calib: Calibration | null; verses: WeekVerse[]; expiry: string;
  onMark: (e: Engine | 'compare') => void; onManual: (v: string, note: string) => void; onRedo: () => void;
}) {
  const parsed = parse(s);
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(s.manual_total != null ? String(s.manual_total) : '');
  const [note, setNote] = useState(s.manual_note ?? '');
  const marks: number[] = (() => { try { return JSON.parse(s.marks || '[]'); } catch { return []; } })();
  const auto = s.auto_total != null ? applyCalibration(calib, s.auto_total) : null;
  const final = s.manual_total ?? auto;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <AudioButton submissionId={s.id} available={!!s.audio_available} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink truncate">{s.name}</div>
          <div className="text-xs text-gray-500">
            {Math.round(s.duration_s ?? 0)}s · try {s.takes ?? 1} · {Math.min(7, marks.length)}/7 verses marked
          </div>
          <div className="text-[11px] text-gray-400">{s.audio_available ? `Audio kept until ${expiry}` : 'Audio removed after 8 weeks'}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-brand-800 leading-none">{final != null ? final.toFixed(1) : '—'}</div>
          <div className="text-[11px] text-gray-500 mt-1">{s.manual_total != null ? 'your mark' : auto != null ? `auto · ${s.engine}` : 'not marked'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button size="sm" disabled={!!busy || !s.audio_available} onClick={() => onMark(s.engine === 'sarvam' ? 'sarvam' : 'whisper')}>
          {busy ?? (s.auto_total == null ? 'Auto-mark' : 'Re-mark')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Details & mark'}</Button>
      </div>

      {open && (
        <div className="mt-4 border-t border-gray-100 pt-3 space-y-4">
          <div className="grid grid-cols-[6.5rem_1fr] gap-2">
            <Input inputMode="decimal" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Mark /100" />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
          </div>
          <Button size="sm" variant="success" block onClick={() => onManual(manual, note)}>Save my mark</Button>

          {parsed.result && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Auto marks per verse ({parsed.result.engine}{parsed.result.split ? '' : ', no verse marks'})</div>
              <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
                {parsed.result.perVerse.map((p) => (
                  <div key={p.slot} className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="w-9 text-xs font-semibold text-gray-600">{weekdayLabel(p.slot)}</span>
                      <span className="flex-1 text-[11px] text-gray-500">Acc {p.accuracy.toFixed(0)}/60 · Flu {p.fluency.toFixed(0)}/25 · Ref {p.reference}/15</span>
                      <span className="text-sm font-bold w-10 text-right">{p.total.toFixed(0)}</span>
                    </div>
                    {p.transcript && <div className="tamil text-[13px] text-gray-600 mt-1">{p.transcript}</div>}
                  </div>
                ))}
              </div>
              {!parsed.result.split && s.transcript && <div className="tamil text-[13px] text-gray-600 bg-gray-50 rounded-xl p-3 mt-2">{s.transcript}</div>}
            </div>
          )}

          {parsed.compare && (
            <div className="grid grid-cols-2 gap-2">
              {parsed.compare.map((c) => (
                <div key={c.engine} className="rounded-xl bg-gray-50 p-3 text-center">
                  <div className="text-xs text-gray-500 capitalize">{c.engine}</div>
                  <div className="text-xl font-bold text-ink">{c.total.toFixed(1)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" disabled={!!busy || !s.audio_available || verses.length !== 7} onClick={() => onMark('compare')}>Compare engines</Button>
            <Button size="sm" variant="danger" onClick={onRedo}>Allow re-record</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
