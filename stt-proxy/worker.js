// Speech-to-Text proxy for Powerful Weapon (Android) — Cloudflare Worker.
//
// Holds the vendor API key SERVER-SIDE so it never ships inside the APK. The app
// POSTs audio here; this forwards to the STT vendor and returns a transcript.
//
// Contract (matches src/lib/stt.ts):
//   POST /   { audioBase64, mimeType, language }  ->  { transcript, durationSeconds }
//
// Weekly verse feed (matches src/lib/feed.ts) — needs the WEEKS KV binding:
//   GET  /week                         -> { weeks: [WeekFeed, ...] }  (public; newest first)
//   PUT  /week   x-admin-key: ADMIN_KEY  body WeekFeed  -> { ok: true }
//   GET  /admin/check  x-admin-key        -> 200 { ok: true } | 401
//   WeekFeed = { weekStart: 'YYYY-MM-DD', sendTime: 'HH:MM', publishedAt, verses: [{ slot, book, chapter, verse, text }] }
//
// Default vendor: OpenAI Whisper API (good Tamil support). To swap to Google
// Speech-to-Text or Deepgram, replace the `callVendor` function only.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-stt-secret, x-admin-key',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Provider-agnostic transcription. Defaults to Groq (free, whisper-large-v3,
 * OpenAI-compatible). Override STT_ENDPOINT / STT_MODEL to use another vendor.
 * Returns { transcript, durationSeconds }.
 */
async function callVendor(env, bytes, mimeType, language) {
  const ext = (mimeType.split('/')[1] || 'ogg').split(';')[0];
  const endpoint = env.STT_ENDPOINT || 'https://api.groq.com/openai/v1/audio/transcriptions';
  const model = env.STT_MODEL || 'whisper-large-v3';

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mimeType }), `audio.${ext}`);
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0'); // deterministic → same audio yields the same transcript/score
  if (language) form.append('language', language);

  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STT_API_KEY}` },
    body: form,
  });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`vendor HTTP ${r.status}: ${detail.slice(0, 300)}`);
  }
  const data = await r.json();
  return { transcript: data.text ?? '', durationSeconds: data.duration ?? 0 };
}

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEEP_WEEKS = 4;

function isAdmin(request, env) {
  return !!env.ADMIN_KEY && request.headers.get('x-admin-key') === env.ADMIN_KEY;
}

/** Validate + normalise a published week; returns null if malformed. */
function cleanWeek(body) {
  if (!body || !WEEK_RE.test(body.weekStart || '') || !Array.isArray(body.verses)) return null;
  const verses = body.verses.slice(0, 7).map((v) => ({
    slot: Number(v.slot), book: String(v.book || '').slice(0, 80),
    chapter: Number(v.chapter), verse: Number(v.verse), text: String(v.text || '').slice(0, 2000),
  })).filter((v) => v.slot >= 1 && v.slot <= 7 && v.text);
  const sendTime = /^\d{2}:\d{2}$/.test(body.sendTime || '') ? body.sendTime : '06:00';
  return { weekStart: body.weekStart, sendTime, publishedAt: new Date().toISOString(), verses };
}

async function handleFeed(request, env, path) {
  if (!env.WEEKS) return json({ error: 'WEEKS KV namespace not bound' }, 500);
  if (path === '/admin/check') return isAdmin(request, env) ? json({ ok: true }) : json({ error: 'Unauthorized' }, 401);

  if (request.method === 'GET') {
    const index = (await env.WEEKS.get('index', 'json')) || [];
    const weeks = (await Promise.all(index.map((w) => env.WEEKS.get(`week:${w}`, 'json')))).filter(Boolean);
    return new Response(JSON.stringify({ weeks }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', ...CORS },
    });
  }
  if (request.method === 'PUT') {
    if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
    const week = cleanWeek(body);
    if (!week) return json({ error: 'Malformed week' }, 400);
    await env.WEEKS.put(`week:${week.weekStart}`, JSON.stringify(week));
    const index = (await env.WEEKS.get('index', 'json')) || [];
    const next = [week.weekStart, ...index.filter((w) => w !== week.weekStart)].sort().reverse();
    for (const old of next.slice(KEEP_WEEKS)) await env.WEEKS.delete(`week:${old}`);
    await env.WEEKS.put('index', JSON.stringify(next.slice(0, KEEP_WEEKS)));
    return json({ ok: true, weekStart: week.weekStart });
  }
  return json({ error: 'Method not allowed' }, 405);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (path === '/week' || path === '/admin/check') return handleFeed(request, env, path);
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    // Optional shared secret: set PROXY_SECRET to require the app to send it.
    if (env.PROXY_SECRET && request.headers.get('x-stt-secret') !== env.PROXY_SECRET) {
      return json({ error: 'Unauthorized' }, 401);
    }
    if (!env.STT_API_KEY) return json({ error: 'STT_API_KEY not configured' }, 500);

    let payload;
    try { payload = await request.json(); }
    catch { return json({ error: 'Invalid JSON body' }, 400); }

    const { audioBase64, mimeType = 'audio/ogg', language = 'ta' } = payload || {};
    if (!audioBase64) return json({ error: 'Missing audioBase64' }, 400);

    try {
      const result = await callVendor(env, base64ToBytes(audioBase64), mimeType, language);
      return json(result);
    } catch (e) {
      return json({ error: 'Transcription failed', detail: String(e.message || e) }, 502);
    }
  },
};
