import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { addDays, currentWeekStart, dateForSlot, weekdayLabel } from '../lib/dates';
import { lastPublished, publishWeek } from '../lib/feed';
import { isNative } from '../lib/platform';
import { refreshNotifications } from '../lib/scheduler';
import { toast } from '../lib/toast';
import { Badge, Button, Card, Empty, SectionTitle, Stat, cx, dayLabel } from '../components/ui';
import { IconCheck, IconSend, IconUpload } from '../components/icons';
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
  const [todaySlot, setTodaySlot] = useState(1);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [pending, setPending] = useState<PendingSlot[]>([]);
  const [verseCount, setVerseCount] = useState(0);
  const [stt, setStt] = useState<{ ok: boolean } | null>(null);
  const [published, setPublished] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function load() {
    const ws = await api().scheduler.currentWeekStart();
    setWeekStart(ws);
    const [sels, miss, cnt, w, slot, pub] = await Promise.all([
      api().selections.get(ws),
      api().scheduler.checkMissed(),
      api().verses.count(),
      api().whisper.check(),
      api().scheduler.todaySlot(),
      lastPublished(),
    ]);
    setSelections(sels as Selection[]);
    setPending(miss as PendingSlot[]);
    setVerseCount(cnt as number);
    setStt(w as any);
    setTodaySlot(slot as number);
    setPublished(pub?.weekStart ?? null);
  }

  useEffect(() => {
    load();
    const off = api().on('scheduler:fire', () => load());
    return () => off();
  }, []);

  const today = selections.find((s) => s.slot === todaySlot);
  const earlier = pending.filter((p) => p.slot !== todaySlot);
  const isPublished = !!published && published >= weekStart;

  async function post(p: { slot: number; verse_id: number; book: string; chapter: number; verse: number; text_tamil: string }) {
    await api().whatsapp.prepareSend({
      book: p.book, chapter: p.chapter, verse: p.verse,
      text: p.text_tamil, dateStr: dateForSlot(weekStart, p.slot),
      verseId: p.verse_id, weekStart, slot: p.slot,
    });
    toast(isNative()
      ? 'Verse copied. Pick your group in WhatsApp and tap Send, then come back and tap “Mark sent”.'
      : 'Copied. Paste into the WhatsApp group (Ctrl+V), press Enter, then click “Mark sent”.', 'info', 6000);
  }

  async function markSent(slot: number) {
    await api().whatsapp.markSentBySlot(weekStart, slot);
    toast('Marked as sent', 'success', 1800);
    load();
  }

  async function publish() {
    setPublishing(true);
    const r = await publishWeek(weekStart);
    setPublishing(false);
    if (r.ok) { toast("This week's verses are now on members' phones", 'success'); load(); refreshNotifications().catch(() => {}); }
    else toast(r.error ?? 'Publish failed', 'error', 5000);
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm text-gray-500">Week of {dayLabel(weekStart)} – {dayLabel(addDays(weekStart, 6))}</div>
        <h1 className="text-xl md:text-2xl font-semibold text-ink">Good {greeting()}!</h1>
      </div>

      {/* Today */}
      {today ? (
        <section className="rounded-3xl bg-brand-900 text-white p-5 shadow-lift relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-brand-700/40" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wide text-white/60">Today · {weekdayLabel(todaySlot)}</span>
              {today.posted_at
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300"><IconCheck /> Sent</span>
                : <span className="text-xs font-medium text-gold-300">Not sent yet</span>}
            </div>
            <span className="inline-block mt-3 rounded-full bg-gold-400 text-brand-950 text-xs font-semibold px-2.5 py-1">
              {today.book} {today.chapter}:{today.verse}
            </span>
            <p className="tamil text-[17px] mt-3 text-white/95 line-clamp-5" style={{ lineHeight: 1.8 }}>{today.text_tamil}</p>
            {!today.posted_at && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="gold" onClick={() => post(today)}><IconSend /> Post</Button>
                <Button className="bg-white/10 text-white hover:bg-white/15" onClick={() => markSent(todaySlot)}><IconCheck /> Mark sent</Button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <Empty icon="📖" title="No verse for today" action={<Link to="/verses"><Button>Pick this week's verses</Button></Link>}>
          Choose 7 verses with the Verse Picker. They'll be posted one per day.
        </Empty>
      )}

      {/* Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="This week" value={`${selections.length} / 7`} hint={selections.length < 7 ? 'Pick verses' : 'Ready'} tone={selections.length < 7 ? 'warn' : 'ok'} />
        <Stat label="Members" value={isPublished ? 'Published' : 'Not sent'} hint={isPublished ? 'On their phones' : 'Publish below'} tone={isPublished ? 'ok' : 'warn'} />
        <Stat label="Grading" value={stt?.ok ? 'Ready' : 'Not set up'} hint={stt?.ok ? 'Speech-to-text on' : 'See Settings'} tone={stt?.ok ? 'ok' : 'warn'} />
        <Stat label="Bible" value={verseCount.toLocaleString('en-IN')} hint={verseCount < 1000 ? 'Sample only' : 'Full Bible'} />
      </div>

      {/* Publish to members */}
      {selections.length === 7 && !isPublished && (
        <Card className="border-gold-300 bg-gold-100/40">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-gold-400 text-brand-950 grid place-items-center shrink-0"><IconUpload /></span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink">Send this week to members' phones</div>
              <p className="text-sm text-gray-600 mt-0.5">Their app will show each day's verse in a notification at your send time.</p>
              <Button className="mt-3" onClick={publish} disabled={publishing}>{publishing ? 'Publishing…' : 'Publish week'}</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Missed earlier days */}
      {earlier.length > 0 && (
        <section>
          <SectionTitle>Waiting to send ({earlier.length})</SectionTitle>
          <div className="space-y-2">
            {earlier.map((p) => (
              <Card key={p.slot}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">{weekdayLabel(p.slot)} · {p.dateStr}</span>
                  <Badge tone="amber">Pending</Badge>
                </div>
                <div className="text-sm font-semibold mt-1">{p.book} {p.chapter}:{p.verse}</div>
                <div className="tamil text-sm text-gray-700 line-clamp-2">{p.text_tamil}</div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button size="sm" onClick={() => post(p)}><IconSend /> Post</Button>
                  <Button size="sm" variant="secondary" onClick={() => markSent(p.slot)}><IconCheck /> Mark sent</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Week schedule */}
      <section>
        <SectionTitle action={<Link to="/verses" className="text-sm font-medium text-brand-700">Edit</Link>}>This week</SectionTitle>
        {selections.length === 0 ? (
          <Empty title="No verses selected yet">Open the Verse Picker to set up the week.</Empty>
        ) : (
          <Card pad={false} className="divide-y divide-gray-100 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => {
              const slot = i + 1;
              const sel = selections.find((s) => s.slot === slot);
              return (
                <div key={slot} className={cx('px-4 py-3 flex items-center gap-3', slot === todaySlot && 'bg-gold-100/40')}>
                  <div className="w-11 shrink-0 text-center">
                    <div className="text-xs font-semibold text-gray-700">{weekdayLabel(slot)}</div>
                    <div className="text-[11px] text-gray-400">{dateForSlot(weekStart, slot).slice(0, 5)}</div>
                  </div>
                  {sel ? (
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{sel.book} {sel.chapter}:{sel.verse}</div>
                      <div className="tamil text-[13px] text-gray-500 truncate">{sel.text_tamil}</div>
                    </div>
                  ) : (
                    <div className="flex-1 text-sm text-gray-400 italic">No verse</div>
                  )}
                  {sel && (sel.posted_at ? <Badge tone="green">Sent</Badge> : <Badge>Pending</Badge>)}
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
