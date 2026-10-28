import { useCallback, useEffect, useState } from 'react';
import { groupStatus, GroupRow } from '../lib/remote';
import { Button, Card, Empty, Notice, PageHeader, cx, dayLabel } from '../components/ui';
import { IconRefresh } from '../components/icons';
import AudioButton from '../components/AudioButton';

/** Who has sent this week's recording — names only, never phone numbers or marks. */
export default function Group() {
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [week, setWeek] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await groupStatus();
      setRows(r.members);
      setWeek(r.week);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sent = rows.filter((r) => r.submission_id);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Group"
        subtitle={week ? `Week of ${dayLabel(week)} · ${sent.length} of ${rows.length} sent` : undefined}
        action={<Button variant="ghost" size="sm" onClick={load} disabled={loading} aria-label="Refresh"><IconRefresh /></Button>}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {!error && rows.length === 0 && !loading && <Empty icon="👥" title="No members yet" />}
      {rows.length > 0 && (
        <Card pad={false} className="divide-y divide-gray-100 overflow-hidden">
          {rows.map((r) => (
            <div key={r.member_id} className="flex items-center gap-3 px-4 py-3">
              <span className={cx('w-10 h-10 rounded-full grid place-items-center font-semibold shrink-0',
                r.submission_id ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400')}>
                {r.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium truncate">{r.name}</div>
                <div className="text-xs text-gray-500">{r.submission_id ? '✓ Sent' : 'Not yet'}</div>
              </div>
              {r.submission_id && <AudioButton submissionId={r.submission_id} available={!!r.audio_available} />}
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs text-gray-400 text-center">Marks are seen only by the admin.</p>
    </div>
  );
}
