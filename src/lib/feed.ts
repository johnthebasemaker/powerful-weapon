// Weekly verse feed: the admin publishes the week's 7 verses to the same
// Cloudflare Worker that proxies speech-to-text; every member's phone downloads
// them so its daily notification can show the real verse.
//   GET  <feed>/week                       -> { weeks: WeekFeed[] }   (public)
//   PUT  <feed>/week  x-admin-key           body WeekFeed            (admin only)
//   GET  <feed>/admin/check  x-admin-key    -> 200 | 401
// The feed holds only Bible verses + the send time — no names or phone numbers.

import { api } from './api';

/** The group's Worker. Members never type this; the admin can override it in Settings. */
export const DEFAULT_FEED_URL = 'https://powerful-weapon-stt.pw-stt.workers.dev';

export interface FeedVerse { slot: number; book: string; chapter: number; verse: number; text: string }
export interface WeekFeed { weekStart: string; sendTime: string; publishedAt: string; verses: FeedVerse[] }

async function setting(key: string): Promise<string> {
  const s = (await api().settings.getAll()) as Record<string, string>;
  return s[key] ?? '';
}

export async function feedUrl(): Promise<string> {
  return ((await setting('feed_url')) || DEFAULT_FEED_URL).trim().replace(/\/+$/, '');
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12000): Promise<Response> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    window.clearTimeout(t);
  }
}

export async function cachedFeed(): Promise<WeekFeed[]> {
  try {
    const raw = await setting('feed_cache');
    return raw ? (JSON.parse(raw) as WeekFeed[]) : [];
  } catch {
    return [];
  }
}

/** Download the latest weeks; falls back to the cached copy when offline. */
export async function refreshFeed(): Promise<{ weeks: WeekFeed[]; fromCache: boolean; error?: string }> {
  try {
    const res = await fetchWithTimeout(`${await feedUrl()}/week`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { weeks?: WeekFeed[] };
    const weeks = Array.isArray(data.weeks) ? data.weeks : [];
    await api().settings.set('feed_cache', JSON.stringify(weeks));
    await api().settings.set('feed_fetched_at', new Date().toISOString());
    return { weeks, fromCache: false };
  } catch (e: any) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return {
      weeks: await cachedFeed(),
      fromCache: true,
      error: offline ? 'You are offline — showing saved verses.' : `Could not refresh verses (${e?.message ?? e}).`,
    };
  }
}

export function verseFor(weeks: WeekFeed[], weekStart: string, slot: number): FeedVerse | undefined {
  return weeks.find((w) => w.weekStart === weekStart)?.verses.find((v) => v.slot === slot);
}

export async function checkAdminKey(key: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${await feedUrl()}/admin/check`, { headers: { 'x-admin-key': key } });
    return res.ok;
  } catch {
    return false;
  }
}

export interface PublishResult { ok: boolean; error?: string }

/** Push one week's saved selections to the members' feed. */
export async function publishWeek(weekStart: string): Promise<PublishResult> {
  const token = await setting('admin_token');
  const key = await setting('admin_key');
  if (!token && !key) return { ok: false, error: 'Log in as admin first (Settings → Admin account).' };
  const sels = (await api().selections.get(weekStart)) as any[];
  if (!sels.length) return { ok: false, error: 'No verses saved for that week yet.' };
  const body = {
    weekStart,
    sendTime: (await setting('send_time')) || '06:00',
    verses: sels.map((s) => ({ slot: s.slot, book: s.book, chapter: s.chapter, verse: s.verse, text: s.text_tamil })),
  };
  try {
    const res = await fetchWithTimeout(`${await feedUrl()}/week`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : { 'x-admin-key': key }) },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, error: 'Admin login expired. Log in again in Settings → Admin account.' };
    if (!res.ok) return { ok: false, error: `Feed error (HTTP ${res.status}).` };
    const out = (await res.json().catch(() => ({}))) as { publishedAt?: string };
    await api().settings.set('last_published', JSON.stringify({ weekStart, at: new Date().toISOString() }));
    if (out.publishedAt) await api().settings.set(`feed_seen_${weekStart}`, out.publishedAt);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the feed. Check your internet connection.' };
  }
}

export async function lastPublished(): Promise<{ weekStart: string; at: string } | null> {
  try {
    const raw = await setting('last_published');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Two admins, two phones: each keeps the week's verses in its own database, so
 * pull the weeks the other admin published. A week is copied in when this phone
 * has none for it, or when the published copy changed since we last looked (the
 * other admin re-published). Unpublished picks on this phone are never replaced
 * by a publish this phone has already seen. Returns how many weeks changed.
 */
export async function syncPublishedWeeks(): Promise<number> {
  const s = (await api().settings.getAll()) as Record<string, string>;
  if (s.app_role !== 'admin' && s.app_role) return 0;
  const { weeks, fromCache } = await refreshFeed();
  if (fromCache) return 0;
  let changed = 0;
  for (const w of weeks) {
    const seenKey = `feed_seen_${w.weekStart}`;
    if (s[seenKey] === w.publishedAt) continue;
    const local = (await api().selections.get(w.weekStart)) as any[];
    const same = local.length === w.verses.length
      && w.verses.every((v) => local.some((l) => l.slot === v.slot && l.book === v.book && l.chapter === v.chapter && l.verse === v.verse));
    // First look at a week this phone already picked: keep its picks, just remember the publish.
    if (same || (local.length && !s[seenKey])) { await api().settings.set(seenKey, w.publishedAt); continue; }
    const ids: number[] = [];
    for (const v of [...w.verses].sort((a, b) => a.slot - b.slot)) {
      const row = (await api().verses.findRef(v.book, v.chapter, v.verse)) as { id: number } | null;
      if (row) ids.push(row.id);
    }
    if (ids.length !== w.verses.length) continue; // Bible not loaded yet — try again next time
    await api().selections.save(w.weekStart, local[0]?.root_word ?? '', ids);
    await api().settings.set(seenKey, w.publishedAt);
    changed++;
  }
  return changed;
}
