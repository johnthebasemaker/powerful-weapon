import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api } from '../lib/api';
import { addDays, currentWeekStart, localIso } from '../lib/dates';
import { verseFor } from '../lib/feed';
import { isNative } from '../lib/platform';
import { memberTime, refreshNotifications } from '../lib/scheduler';
import { copyText, shareText, verseMessage } from '../lib/share';
import { useFeed } from '../lib/useFeed';
import { Badge, Button, Card, Empty, Notice, dayLabel } from '../components/ui';
import { IconCopy, IconRefresh, IconShare } from '../components/icons';

function slotOf(d: Date) { const x = d.getDay(); return x === 0 ? 7 : x; }

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function Today() {
  const { weeks, loading, error, refresh } = useFeed();
  const [time, setTime] = useState('06:00');
  const [perm, setPerm] = useState<string>('granted');

  const now = new Date();
  const ws = currentWeekStart(now);
  const today = verseFor(weeks, ws, slotOf(now));
  const tomorrowDate = new Date(now); tomorrowDate.setDate(now.getDate() + 1);
  const tomorrow = verseFor(weeks, currentWeekStart(tomorrowDate), slotOf(tomorrowDate));

  useEffect(() => {
    api().settings.getAll().then((s: any) => setTime(memberTime(s, weeks)));
  }, [weeks]);

  useEffect(() => {
    if (isNative()) LocalNotifications.checkPermissions().then((p) => setPerm(p.display));
  }, []);

  async function enableNotifications() {
    const p = await LocalNotifications.requestPermissions();
    setPerm(p.display);
    if (p.display === 'granted') refreshNotifications().catch(() => {});
  }

  const todayIso = localIso(now);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500">{dayLabel(todayIso)}</div>
          <h1 className="tamil text-xl font-semibold text-ink" style={{ lineHeight: 1.4 }}>இன்றைய வசனம்</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh verses">
          <IconRefresh /> {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {perm !== 'granted' && isNative() && (
        <Notice tone="warn">
          <div className="font-medium mb-1">Notifications are off</div>
          Turn them on to get the verse every day at {fmtTime(time)}.
          <div className="mt-2"><Button size="sm" onClick={enableNotifications}>Turn on notifications</Button></div>
        </Notice>
      )}

      {error && weeks.length > 0 && <Notice tone="info">{error}</Notice>}

      {today ? (
        <section className="rounded-3xl bg-brand-900 text-white p-5 shadow-lift relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-brand-700/40" aria-hidden />
          <div className="relative">
            <span className="inline-block rounded-full bg-gold-400 text-brand-950 text-xs font-semibold px-2.5 py-1">
              {today.book} {today.chapter}:{today.verse}
            </span>
            <p className="tamil text-[19px] mt-4 text-white/95" style={{ lineHeight: 1.85 }}>{today.text}</p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <Button variant="gold" onClick={() => shareText(verseMessage(today, dayLabel(todayIso)))}>
                <IconShare /> Share
              </Button>
              <Button className="bg-white/10 text-white hover:bg-white/15" onClick={() => copyText(verseMessage(today, dayLabel(todayIso)))}>
                <IconCopy /> Copy
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <Empty
          icon="📖"
          title={loading ? 'Getting this week\'s verses…' : 'Today\'s verse isn\'t published yet'}
          action={!loading && <Button variant="secondary" onClick={refresh}><IconRefresh /> Try again</Button>}
        >
          {!loading && (error ?? 'Your group admin publishes the 7 verses each week. Check back soon.')}
        </Empty>
      )}

      {isNative() && perm === 'granted' && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">Daily reminder</div>
              <div className="text-xs text-gray-500 mt-0.5">Every day at {fmtTime(time)}</div>
            </div>
            <Link to="/settings" className="text-sm font-medium text-brand-700 px-2 py-2">Change</Link>
          </div>
        </Card>
      )}

      {tomorrow && (
        <Card>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs uppercase tracking-wide text-gray-500">Tomorrow</span>
            <Badge tone="brand">{tomorrow.book} {tomorrow.chapter}:{tomorrow.verse}</Badge>
          </div>
          <p className="tamil text-[15px] text-gray-700 line-clamp-2">{tomorrow.text}</p>
          <Link to="/week" className="inline-block mt-2 text-sm font-medium text-brand-700">See the whole week →</Link>
        </Card>
      )}

      {!today && weeks.some((w) => w.weekStart === addDays(ws, 7)) && (
        <Notice tone="info">Next week's verses are ready — see the <Link to="/week" className="underline font-medium">week view</Link>.</Notice>
      )}
    </div>
  );
}
