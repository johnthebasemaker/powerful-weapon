import { useCallback, useEffect, useState } from 'react';
import { cachedFeed, refreshFeed, WeekFeed } from './feed';
import { refreshNotifications } from './scheduler';

/** Members' verses: show the saved copy instantly, then refresh from the feed. */
export function useFeed() {
  const [weeks, setWeeks] = useState<WeekFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await refreshFeed();
    setWeeks(r.weeks);
    setError(r.error);
    setLoading(false);
    refreshNotifications().catch(() => {}); // new verses → new notification text
    return r;
  }, []);

  useEffect(() => {
    cachedFeed().then((w) => { if (w.length) setWeeks(w); });
    refresh();
  }, [refresh]);

  return { weeks, loading, error, refresh };
}
