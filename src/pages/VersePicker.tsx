import { FormEvent, useEffect, useState } from 'react';
import { addDays, currentWeekStart, weekdayLabel } from '../lib/dates';
import { api } from '../lib/api';
import { publishWeek } from '../lib/feed';
import { refreshNotifications } from '../lib/scheduler';
import { toast } from '../lib/toast';
import { Badge, Button, Card, Input, PageHeader, SectionTitle, Segmented, cx, dayLabel } from '../components/ui';
import { IconCheck, IconSearch, IconStar } from '../components/icons';
import type { RankedVerse, Selection } from '../types';

export default function VersePicker() {
  const thisWeek = currentWeekStart();
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [rootWord, setRootWord] = useState('');
  const [results, setResults] = useState<RankedVerse[]>([]);
  const [picked, setPicked] = useState<Map<number, RankedVerse>>(new Map());
  const [existing, setExisting] = useState<Selection[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);

  async function loadExisting(ws: string) {
    const sel = (await api().selections.get(ws)) as Selection[];
    setExisting(sel);
    if (sel.length && sel[0].root_word) setRootWord(sel[0].root_word);
  }

  useEffect(() => { loadExisting(weekStart); }, [weekStart]);

  async function handleSearch(e?: FormEvent) {
    e?.preventDefault();
    if (!rootWord.trim()) return;
    (document.activeElement as HTMLElement | null)?.blur(); // close the keyboard to show results
    setSearching(true);
    const rows = (await api().verses.search(rootWord.trim(), 50)) as RankedVerse[];
    setResults(rows);
    setSearching(false);
    setSearched(true);
  }

  function togglePick(v: RankedVerse) {
    const next = new Map(picked);
    if (next.has(v.id)) next.delete(v.id);
    else {
      if (next.size >= 7) { toast('You already picked 7 verses', 'info', 1800); return; }
      next.set(v.id, v);
    }
    setPicked(next);
  }

  async function toggleMemory(v: RankedVerse) {
    const newVal = !v.is_memory_verse;
    await api().verses.toggleMemory(v.id, newVal);
    setResults((r) => r.map((x) => (x.id === v.id ? { ...x, is_memory_verse: newVal ? 1 : 0 } : x)));
  }

  async function save() {
    if (picked.size !== 7) return;
    setSaving(true);
    const ids = Array.from(picked.values()).map((v) => v.id);
    await api().selections.save(weekStart, rootWord.trim(), ids);
    await loadExisting(weekStart);
    setPicked(new Map());
    setResults([]);
    setSearched(false);
    refreshNotifications().catch(() => {});
    // Push straight to members' phones when an admin key is configured.
    const s = (await api().settings.getAll()) as Record<string, string>;
    if (s.admin_token || s.admin_key) {
      const r = await publishWeek(weekStart);
      toast(r.ok ? 'Week saved and sent to members' : `Saved. Not sent to members: ${r.error}`, r.ok ? 'success' : 'error', 5000);
    } else {
      toast('Week saved', 'success');
    }
    setSaving(false);
    document.getElementById('app-main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function clearWeek() {
    if (!confirm('Clear the 7 selected verses for this week?')) return;
    await api().selections.save(weekStart, '', []);
    loadExisting(weekStart);
    refreshNotifications().catch(() => {});
  }

  const pickedCount = picked.size;
  const which = weekStart === thisWeek ? 'this' : weekStart === addDays(thisWeek, 7) ? 'next' : 'other';

  return (
    <div className="space-y-4">
      <PageHeader title="Verse Picker" subtitle="Search a Tamil root word and pick 7 verses for the week." />

      <Card className="space-y-3">
        <Segmented
          value={which}
          onChange={(v) => v !== 'other' && setWeekStart(v === 'this' ? thisWeek : addDays(thisWeek, 7))}
          options={[
            { value: 'this', label: 'This week' },
            { value: 'next', label: 'Next week' },
            ...(which === 'other' ? [{ value: 'other' as const, label: dayLabel(weekStart) }] : []),
          ]}
        />
        <label className="flex items-center justify-between gap-3 text-sm text-gray-600">
          <span>Week starting</span>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => e.target.value && setWeekStart(currentWeekStart(new Date(e.target.value + 'T00:00:00')))}
            className="h-10 rounded-xl border border-gray-300 px-3 bg-white text-ink"
          />
        </label>
      </Card>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><IconSearch /></span>
          <Input
            value={rootWord}
            onChange={(e) => setRootWord(e.target.value)}
            placeholder="Root word, e.g. கனம்"
            className="tamil pl-10"
            enterKeyHint="search"
          />
        </div>
        <Button type="submit" disabled={searching || !rootWord.trim()} className="shrink-0">
          {searching ? '…' : 'Search'}
        </Button>
      </form>
      <p className="text-xs text-gray-500 -mt-2 px-1">
        Finds word variants too (கனம், கனப்பண்ணுங்கள், கனப்பண்ணி). Memory verses ⭐ rank higher.
      </p>

      {existing.length > 0 && results.length === 0 && (
        <Card>
          <SectionTitle action={<Button variant="danger" size="sm" onClick={clearWeek}>Clear</Button>}>
            Saved for {dayLabel(weekStart)}
          </SectionTitle>
          <ol className="divide-y divide-gray-100 -mx-4 md:-mx-5">
            {existing.map((s) => (
              <li key={s.id} className="flex gap-3 px-4 md:px-5 py-2.5">
                <span className="w-9 shrink-0 text-xs font-semibold text-gray-500 pt-0.5">{weekdayLabel(s.slot)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{s.book} {s.chapter}:{s.verse}</div>
                  <div className="tamil text-[13px] text-gray-500 line-clamp-1">{s.text_tamil}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {searched && results.length === 0 && !searching && (
        <p className="text-sm text-gray-500 text-center py-6">No verses matched “{rootWord}”. Try a shorter root word.</p>
      )}

      {results.length > 0 && (
        <section className="pb-20">
          <SectionTitle action={<span className="text-sm text-gray-500">{results.length} found</span>}>Suggestions</SectionTitle>
          <div className="space-y-2">
            {results.map((v) => {
              const isPicked = picked.has(v.id);
              const order = isPicked ? Array.from(picked.keys()).indexOf(v.id) + 1 : 0;
              return (
                <div
                  key={v.id}
                  className={cx(
                    'rounded-2xl border bg-white shadow-card transition flex',
                    isPicked ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-black/5',
                  )}
                >
                  <button onClick={() => togglePick(v)} className="flex-1 min-w-0 text-left p-3.5 flex gap-3">
                    <span className={cx(
                      'mt-0.5 w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0 border-2',
                      isPicked ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 text-transparent',
                    )}>
                      {isPicked ? order : ''}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold">{v.book} {v.chapter}:{v.verse}</span>
                        {v.matched_token && <Badge tone="brand"><span className="tamil">{v.matched_token}</span></Badge>}
                        <span className="text-[11px] text-gray-400">{(v.score * 100).toFixed(0)}%</span>
                      </span>
                      <span className="tamil block text-[15px] text-gray-800 mt-1">{v.text_tamil}</span>
                    </span>
                  </button>
                  <button
                    onClick={() => toggleMemory(v)}
                    aria-label={v.is_memory_verse ? 'Unmark memory verse' : 'Mark as memory verse'}
                    className={cx('px-3 shrink-0', v.is_memory_verse ? 'text-gold-500' : 'text-gray-300')}
                  >
                    <IconStar filled={!!v.is_memory_verse} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Sticky save bar, above the tab bar on phones */}
      {pickedCount > 0 && (
        <div className="fixed inset-x-0 z-20 px-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-64">
          <div className="max-w-3xl mx-auto rounded-2xl bg-brand-900 text-white shadow-lift px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{pickedCount} of 7 picked</div>
              <div className="h-1.5 rounded-full bg-white/15 mt-1.5 overflow-hidden">
                <div className="h-full bg-gold-400 transition-all" style={{ width: `${(pickedCount / 7) * 100}%` }} />
              </div>
            </div>
            <Button variant="gold" size="sm" disabled={pickedCount !== 7 || saving} onClick={save}>
              <IconCheck /> {saving ? 'Saving…' : 'Save week'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
