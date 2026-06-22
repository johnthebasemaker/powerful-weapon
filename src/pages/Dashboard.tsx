import { useEffect, useState } from 'react';
import { currentWeekStart, dateForSlot, weekdayLabel } from '../lib/dates';
import type { Selection } from '../types';

interface PendingSlot {
  slot: number;
  verse_id: number;
  book: string;
  chapter: number;
  verse: number;
  text_tamil: string;
  weekStart: string;
  dateStr: string;
  last_status: string | null;
}

export default function Dashboard() {
  const [weekStart, setWeekStart] = useState(currentWeekStart());
  const [selections, setSelections] = useState<Selection[]>([]);
  const [pending, setPending] = useState<PendingSlot[]>([]);
  const [verseCount, setVerseCount] = useState(0);
  const [whisper, setWhisper] = useState<{ ok: boolean; reason?: string } | null>(null);

  async function load() {
    const ws = await window.api.scheduler.currentWeekStart();
    setWeekStart(ws);
    const [sels, miss, cnt, ws2] = await Promise.all([
      window.api.selections.get(ws),
      window.api.scheduler.checkMissed(),
      window.api.verses.count(),
      window.api.whisper.check(),
    ]);
    setSelections(sels as Selection[]);
    setPending(miss as PendingSlot[]);
    setVerseCount(cnt as number);
    setWhisper(ws2 as any);
  }

  useEffect(() => {
    load();
    const off = window.api.on('scheduler:fire', () => load());
    return () => off();
  }, []);

  async function handleSend(p: PendingSlot) {
    await window.api.whatsapp.prepareSend({
      book: p.book, chapter: p.chapter, verse: p.verse,
      text: p.text_tamil, dateStr: p.dateStr,
      verseId: p.verse_id, weekStart: p.weekStart, slot: p.slot,
    });
    alert(
      'Message copied to clipboard.\n\n' +
      '1. Open the target WhatsApp group\n' +
      '2. Paste (Ctrl+V / Cmd+V)\n' +
      '3. Press Enter\n\n' +
      'Then come back and click "Mark as sent".'
    );
  }

  async function handleMarkSent(p: PendingSlot) {
    await window.api.whatsapp.markSentBySlot(p.weekStart, p.slot);
    load();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Week starting <span className="font-medium">{weekStart}</span>
        </p>
      </header>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card title="Bible verses" value={verseCount.toLocaleString()} hint={verseCount < 1000 ? 'Sample only — import full Tamil OV' : 'Full Bible loaded'} />
        <Card title="This week's selections" value={`${selections.length} / 7`} hint={selections.length < 7 ? 'Go to Verse Picker' : 'Ready'} />
        <Card title="Whisper STT" value={whisper?.ok ? 'Ready' : 'Not installed'} hint={whisper?.ok ? 'Model loaded' : 'See README → setup'} />
      </div>

      {/* Pending / queued sends */}
      {pending.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="font-semibold text-amber-900 mb-2">
            {pending.length} message{pending.length > 1 ? 's' : ''} waiting to send
          </h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.slot} className="bg-white rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-xs text-gray-500">
                    {weekdayLabel(p.slot)} · {p.dateStr}
                  </div>
                  <div className="text-sm font-medium mt-0.5">
                    {p.book} {p.chapter}:{p.verse}
                  </div>
                  <div className="tamil text-sm text-gray-700 mt-1 line-clamp-2">{p.text_tamil}</div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => handleSend(p)} className="px-3 py-1.5 bg-brand-500 text-white text-xs rounded-md hover:bg-brand-600">
                    Copy + Open WhatsApp
                  </button>
                  <button onClick={() => handleMarkSent(p)} className="px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-md hover:bg-emerald-600">
                    Mark as sent
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Week schedule */}
      <section>
        <h2 className="font-semibold text-gray-900 mb-3">This week's schedule</h2>
        {selections.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            No verses selected yet. Go to <span className="font-medium text-brand-600">Verse Picker</span> to set up the week.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {Array.from({ length: 7 }).map((_, i) => {
              const slot = i + 1;
              const sel = selections.find((s) => s.slot === slot);
              return (
                <div key={slot} className="px-4 py-3 flex items-center gap-4">
                  <div className="w-20 text-xs text-gray-500">
                    <div className="font-medium text-gray-700">{weekdayLabel(slot)}</div>
                    <div>{dateForSlot(weekStart, slot)}</div>
                  </div>
                  {sel ? (
                    <>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{sel.book} {sel.chapter}:{sel.verse}</div>
                        <div className="tamil text-sm text-gray-600 line-clamp-1">{sel.text_tamil}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${sel.posted_at ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {sel.posted_at ? 'Sent' : 'Pending'}
                      </span>
                    </>
                  ) : (
                    <div className="flex-1 text-sm text-gray-400 italic">No verse assigned</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
