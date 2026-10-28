import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api } from '../lib/api';
import { addDays, currentWeekStart, localIso, weekdayLabel } from '../lib/dates';
import { isNative } from '../lib/platform';
import { fmtWhen, myStatus, MyStatus } from '../lib/remote';
import { memberTime, refreshNotifications } from '../lib/scheduler';
import { copyText, shareText, verseMessage } from '../lib/share';
import { useFeed } from '../lib/useFeed';
import { Button, Card, Empty, Notice, Segmented, cx, dayLabel } from '../components/ui';
import { IconCopy, IconMic, IconRefresh, IconShare } from '../components/icons';

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** Member home: today's verse up top, then the whole week — every verse in full. */
export default function Today() {
  const { weeks, loading, error, refresh } = useFeed();
  const [time, setTime] = useState('06:00');
  const [perm, setPerm] = useState<string>('granted');
  const [status, setStatus] = useState<MyStatus | null>(null);

  const thisWeek = currentWeekStart();
  const nextWeek = addDays(thisWeek, 7);
  const hasNext = weeks.some((w) => w.weekStart === nextWeek);
  const [which, setWhich] = useState<'this' | 'next'>('this');
  const ws = which === 'next' && hasNext ? nextWeek : thisWeek;
  const week = weeks.find((w) => w.weekStart === ws);
  const todayIso = localIso(new Date());
  const days = Array.from({ length: 7 }, (_, i) => ({ slot: i + 1, iso: addDays(ws, i), v: week?.verses.find((x) => x.slot === i + 1) }));
  const today = which === 'this' ? days.find((d) => d.iso === todayIso) : undefined;

  useEffect(() => { api().settings.getAll().then((s: any) => setTime(memberTime(s, weeks))); }, [weeks]);
  useEffect(() => {
    if (isNative()) LocalNotifications.checkPermissions().then((p) => setPerm(p.display));
    myStatus().then(setStatus).catch(() => {});
  }, []);

  async function enableNotifications() {
    const p = await LocalNotifications.requestPermissions();
    setPerm(p.display);
    if (p.display === 'granted') refreshNotifications().catch(() => {});
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500">{dayLabel(todayIso)}</div>
          <h1 className="tamil text-xl font-semibold text-ink" style={{ lineHeight: 1.4 }}>இந்த வார வசனங்கள்</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh verses">
          <IconRefresh /> {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {status?.window.open && !status.sent && (
        <Link to="/record" className="block rounded-2xl bg-emerald-600 text-white p-4 shadow-lift">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-white/15 grid place-items-center"><IconMic /></span>
            <div className="flex-1">
              <div className="font-semibold">Recording is open</div>
              <div className="text-sm text-white/80">Until {fmtWhen(status.window.closesAt)} — tap to record</div>
            </div>
          </div>
        </Link>
      )}

      {perm !== 'granted' && isNative() && (
        <Notice tone="warn">
          <div className="font-medium mb-1">Notifications are off</div>
          Turn them on to get the verse every day at {fmtTime(time)}.
          <div className="mt-2"><Button size="sm" onClick={enableNotifications}>Turn on notifications</Button></div>
        </Notice>
      )}

      {error && weeks.length > 0 && <Notice tone="info">{error}</Notice>}

      {hasNext && (
        <Segmented value={which} onChange={setWhich} options={[{ value: 'this', label: 'This week' }, { value: 'next', label: 'Next week' }]} />
      )}

      {today?.v && (
        <section className="rounded-3xl bg-brand-900 text-white p-5 shadow-lift relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-brand-700/40" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wide text-white/60">Today · {weekdayLabel(today.slot)}</span>
              <span className="rounded-full bg-gold-400 text-brand-950 text-xs font-semibold px-2.5 py-1">
                {today.v.book} {today.v.chapter}:{today.v.verse}
              </span>
            </div>
            <p className="tamil text-[19px] mt-4 text-white/95" style={{ lineHeight: 1.85 }}>{today.v.text}</p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <Button variant="gold" onClick={() => shareText(verseMessage(today.v!, dayLabel(todayIso)))}><IconShare /> Share</Button>
              <Button className="bg-white/10 text-white hover:bg-white/15" onClick={() => copyText(verseMessage(today.v!, dayLabel(todayIso)))}><IconCopy /> Copy</Button>
            </div>
          </div>
        </section>
      )}

      {!week ? (
        <Empty
          icon="📖"
          title={loading ? "Getting this week's verses…" : 'Not published yet'}
          action={!loading && <Button variant="secondary" onClick={refresh}><IconRefresh /> Try again</Button>}
        >
          {!loading && (error ?? 'Your group admin publishes the 7 verses each week. Check back soon.')}
        </Empty>
      ) : (
        <ol className="space-y-2.5">
          {days.filter((d) => d !== today).map(({ slot, iso, v }) => (
            <li key={slot} className={cx('rounded-2xl bg-white border shadow-card p-4', iso < todayIso && which === 'this' ? 'border-black/5 opacity-80' : 'border-black/5')}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{dayLabel(iso)}</span>
                {v && <span className="text-sm font-semibold text-brand-800">{v.book} {v.chapter}:{v.verse}</span>}
              </div>
              {v ? <p className="tamil text-[16px] text-gray-800 mt-1.5" style={{ lineHeight: 1.8 }}>{v.text}</p>
                : <p className="text-sm text-gray-400 mt-1.5 italic">No verse for this day</p>}
            </li>
          ))}
        </ol>
      )}

      {isNative() && perm === 'granted' && (
        <p className="text-xs text-gray-500 text-center">Daily reminder at {fmtTime(time)} · change it in Settings</p>
      )}
    </div>
  );
}
