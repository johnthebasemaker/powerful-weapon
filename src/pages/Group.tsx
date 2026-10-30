import { useCallback, useEffect, useState } from 'react';
import { groupStatus, GroupRow } from '../lib/remote';
import { Button, Card, Empty, Notice, PageHeader, cx } from '../components/ui';
import { api } from '../lib/api';
import { useLang, useT } from '../lib/prefs';
import { dateLabel } from '../lib/strings';
import { IconRefresh } from '../components/icons';
import AudioButton from '../components/AudioButton';

/** Who has sent this week's recording — names only, never phone numbers or marks. */
export default function Group() {
  const t = useT();
  const lang = useLang();
  const [me, setMe] = useState('');
  useEffect(() => { api().settings.getAll().then((s: any) => setMe(s.member_id ?? '')); }, []);
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
        title={t('group.title')}
        subtitle={week ? t('group.sub', { date: dateLabel(week, lang), sent: sent.length, total: rows.length }) : undefined}
        action={<Button variant="ghost" size="sm" onClick={load} disabled={loading} aria-label={t('common.refresh')}><IconRefresh /></Button>}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {!error && rows.length === 0 && !loading && <Empty icon="👥" title={t('group.none')} />}
      {rows.length > 0 && (
        <Card pad={false} className="divide-y divide-gray-100 overflow-hidden">
          {rows.map((r) => (
            <div key={r.member_id} className={cx('flex items-center gap-3 px-4 py-3', String(r.member_id) === me && 'bg-brand-50')}>
              <span className={cx('w-10 h-10 rounded-full grid place-items-center font-semibold shrink-0',
                r.submission_id ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400')}>
                {r.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[0.9375rem] font-medium truncate">{r.name}{String(r.member_id) === me && <span className="ml-2 text-xs font-semibold text-brand-700">· {t('group.you')}</span>}</div>
                <div className="text-xs text-gray-500">{r.submission_id ? t('group.sent') : t('group.notYet')}</div>
              </div>
              {r.submission_id && <AudioButton submissionId={r.submission_id} available={!!r.audio_available} />}
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs text-gray-400 text-center">{t('group.marksPrivate')}</p>
    </div>
  );
}
