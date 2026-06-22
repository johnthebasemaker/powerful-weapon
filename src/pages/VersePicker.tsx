import { useEffect, useMemo, useState } from 'react';
import { currentWeekStart } from '../lib/dates';
import type { RankedVerse, Selection } from '../types';

export default function VersePicker() {
  const [weekStart, setWeekStart] = useState(currentWeekStart());
  const [rootWord, setRootWord] = useState('');
  const [results, setResults] = useState<RankedVerse[]>([]);
  const [picked, setPicked] = useState<Map<number, RankedVerse>>(new Map());
  const [existing, setExisting] = useState<Selection[]>([]);
  const [searching, setSearching] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  async function loadExisting(ws: string) {
    const sel = (await window.api.selections.get(ws)) as Selection[];
    setExisting(sel);
    if (sel.length && sel[0].root_word) setRootWord(sel[0].root_word);
  }

  useEffect(() => {
    loadExisting(weekStart);
  }, [weekStart]);

  async function handleSearch() {
    if (!rootWord.trim()) return;
    setSearching(true);
    const rows = (await window.api.verses.search(rootWord.trim(), 50)) as RankedVerse[];
    setResults(rows);
    setSearching(false);
  }

  function togglePick(v: RankedVerse) {
    const next = new Map(picked);
    if (next.has(v.id)) next.delete(v.id);
    else {
      if (next.size >= 7) return;
      next.set(v.id, v);
    }
    setPicked(next);
  }

  async function toggleMemory(v: RankedVerse) {
    const newVal = !v.is_memory_verse;
    await window.api.verses.toggleMemory(v.id, newVal);
    setResults((r) => r.map((x) => (x.id === v.id ? { ...x, is_memory_verse: newVal ? 1 : 0 } : x)));
  }

  async function save() {
    if (picked.size !== 7) {
      alert(`Pick exactly 7 verses (currently ${picked.size}).`);
      return;
    }
    const ids = Array.from(picked.values()).map((v) => v.id);
    await window.api.selections.save(weekStart, rootWord.trim(), ids);
    setSavedMsg('Saved.');
    setTimeout(() => setSavedMsg(''), 2000);
    loadExisting(weekStart);
    setPicked(new Map());
  }

  async function clearWeek() {
    if (!confirm('Clear the 7 selected verses for this week?')) return;
    await window.api.selections.save(weekStart, '', []);
    loadExisting(weekStart);
  }

  const pickedCount = picked.size;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Verse Picker</h1>
          <p className="text-sm text-gray-500 mt-1">
            Search by Tamil root word · Pick 7 verses for the week
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Week starting</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
        </div>
      </header>

      {/* Search bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={rootWord}
            onChange={(e) => setRootWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Tamil root word, e.g. கனம்"
            className="tamil flex-1 border border-gray-300 rounded-md px-3 py-2"
            autoFocus
          />
          <button
            onClick={handleSearch}
            disabled={searching || !rootWord.trim()}
            className="px-4 py-2 bg-brand-500 text-white rounded-md disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Fuzzy matching includes word variants (e.g. கனம், கனப்பண்ணுங்கள், கனப்பண்ணி). Memory verses get a boost in ranking.
        </p>
      </div>

      {/* Existing selections */}
      {existing.length > 0 && (
        <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-emerald-900">
              Current selections for {weekStart}
            </h2>
            <button onClick={clearWeek} className="text-xs text-red-600 hover:underline">Clear all</button>
          </div>
          <ol className="mt-2 space-y-1 text-sm">
            {existing.map((s) => (
              <li key={s.id} className="flex items-baseline gap-2">
                <span className="text-xs text-gray-500 w-12">Day {s.slot}</span>
                <span className="font-medium">{s.book} {s.chapter}:{s.verse}</span>
                <span className="tamil text-gray-700 truncate">— {s.text_tamil}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Results */}
      {results.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">
              Suggestions ({results.length})
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{pickedCount} / 7 picked</span>
              <button
                onClick={save}
                disabled={pickedCount !== 7}
                className="px-4 py-2 bg-emerald-500 text-white text-sm rounded-md disabled:opacity-50 hover:bg-emerald-600"
              >
                Save week
              </button>
              {savedMsg && <span className="text-sm text-emerald-700">{savedMsg}</span>}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
            {results.map((v) => {
              const isPicked = picked.has(v.id);
              return (
                <div key={v.id} className={`px-4 py-3 flex items-start gap-3 ${isPicked ? 'bg-brand-50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isPicked}
                    onChange={() => togglePick(v)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{v.book} {v.chapter}:{v.verse}</span>
                      <span className="text-xs text-gray-400">match {(v.score * 100).toFixed(0)}%</span>
                      {v.matched_token && (
                        <span className="tamil text-xs px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded">
                          {v.matched_token}
                        </span>
                      )}
                      {v.is_memory_verse ? (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">⭐ Memory</span>
                      ) : null}
                    </div>
                    <div className="tamil text-gray-800 mt-1">{v.text_tamil}</div>
                  </div>
                  <button
                    onClick={() => toggleMemory(v)}
                    title={v.is_memory_verse ? 'Unmark memory verse' : 'Mark as memory verse'}
                    className="text-lg"
                  >
                    {v.is_memory_verse ? '⭐' : '☆'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
