// Powerful Weapon backend — Cloudflare Worker.
//
// Holds every vendor key SERVER-SIDE so nothing secret ships inside the APK.
//
// Speech-to-text (src/lib/stt.ts, src/lib/autoMark.ts):
//   POST /   { audioBase64, mimeType, language, engine?, prompt?, keyterms? } -> { transcript, durationSeconds }
//            auth: x-stt-secret (PROXY_SECRET) or an admin bearer token.
//            engine 'whisper' (Groq, default) | 'sarvam' (Sarvam Saaras; needs SARVAM_API_KEY)
//
// Weekly verse feed (src/lib/feed.ts) — KV binding WEEKS:
//   GET  /week                           -> { weeks: WeekFeed[] }   (public, newest first)
//   PUT  /week   admin token | x-admin-key body WeekFeed
//   GET  /admin/check                     -> 200 | 401
//
// Members, in-app recordings and scores (src/lib/remote.ts) — D1 binding DB:
//   POST /auth/admin   { password }                -> { token }   password = ADMIN_PASSWORD (or ADMIN_KEY)
//   POST /auth/member  { memberId, pin }           -> { token, member }
//   GET  /members                                  -> [{ id, name }]           (names only, for the login list)
//   GET  /config                                   -> recording window settings (public)
//   GET  /me/status                                (member) window + whether this week is sent
//   POST /submissions  { weekStart, audioBase64, mimeType, durationS, takes, marks }  (member, inside the window)
//   GET  /group?week=                              (member|admin) who has sent — names only, never scores
//   GET  /audio/:id                                (member|admin) the recording
//   GET/POST/PATCH/DELETE /admin/members[/:id[/pin]], PUT /admin/config,
//   GET /admin/submissions?week=, PATCH|DELETE /admin/submissions/:id, GET /admin/scores   (admin)
//
// Scheduled (cron): audio older than 8 weeks is deleted; scores are kept.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-stt-secret, x-admin-key',
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => base64ToBytes(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ───────────────────────── Speech-to-text ───────────────────────── */

/** Groq Whisper (OpenAI-compatible). `prompt` gently biases spelling (e.g. the book name). */
async function callWhisper(env, bytes, mimeType, language, prompt) {
  if (!env.STT_API_KEY) throw new Error('STT_API_KEY not configured');
  const ext = (mimeType.split('/')[1] || 'ogg').split(';')[0];
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mimeType }), `audio.${ext}`);
  form.append('model', env.STT_MODEL || 'whisper-large-v3');
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0'); // deterministic → same audio yields the same transcript/score
  if (language) form.append('language', language);
  if (prompt) form.append('prompt', String(prompt).slice(0, 400));
  const r = await fetch(env.STT_ENDPOINT || 'https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${env.STT_API_KEY}` }, body: form,
  });
  if (!r.ok) throw new Error(`whisper HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return { transcript: data.text ?? '', durationSeconds: data.duration ?? 0 };
}

/** Sarvam Saaras (Indian-language ASR). Sync REST is meant for clips under ~30 s —
 *  the app splits recordings per verse before sending. */
async function callSarvam(env, bytes, mimeType, keyterms) {
  if (!env.SARVAM_API_KEY) throw new Error('SARVAM_API_KEY not configured on the Worker');
  const ext = (mimeType.split('/')[1] || 'wav').split(';')[0];
  const model = env.SARVAM_MODEL || 'saaras:v4';
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mimeType }), `audio.${ext}`);
  form.append('model', model);
  form.append('language_code', 'ta-IN');
  if (model === 'saaras:v3') form.append('mode', 'transcribe');
  if (model === 'saaras:v4' && Array.isArray(keyterms) && keyterms.length) {
    form.append('keyterms', JSON.stringify(keyterms.slice(0, 50).map((k) => String(k).slice(0, 64))));
  }
  const r = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST', headers: { 'api-subscription-key': env.SARVAM_API_KEY }, body: form,
  });
  if (!r.ok) throw new Error(`sarvam HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return { transcript: data.transcript ?? '', durationSeconds: 0 };
}

async function handleTranscribe(request, env) {
  const secretOk = !env.PROXY_SECRET || request.headers.get('x-stt-secret') === env.PROXY_SECRET;
  const admin = await bearer(request, env, 'admin');
  if (!secretOk && !admin) return json({ error: 'Unauthorized' }, 401);
  let p;
  try { p = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const { audioBase64, mimeType = 'audio/ogg', language = 'ta', engine = 'whisper', prompt, keyterms } = p || {};
  if (!audioBase64) return json({ error: 'Missing audioBase64' }, 400);
  try {
    const bytes = base64ToBytes(audioBase64);
    const result = engine === 'sarvam'
      ? await callSarvam(env, bytes, mimeType, keyterms)
      : await callWhisper(env, bytes, mimeType, language, prompt);
    return json({ ...result, engine });
  } catch (e) {
    return json({ error: 'Transcription failed', detail: String(e.message || e) }, 502);
  }
}

/* ───────────────────────── Auth tokens ───────────────────────── */

function sessionSecret(env) {
  return env.SESSION_SECRET || env.ADMIN_KEY || env.ADMIN_PASSWORD || '';
}
function adminPassword(env) {
  return env.ADMIN_PASSWORD || env.ADMIN_KEY || '';
}

async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(sessionSecret(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

async function makeToken(env, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(env, body)}`;
}

/** Returns the token payload if valid for `role` ('admin' | 'member' | 'any'), else null. */
async function bearer(request, env, role) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+([\w-]+)\.([\w-]+)$/);
  if (!m || !sessionSecret(env)) return null;
  if ((await hmac(env, m[1])) !== m[2]) return null;
  let p;
  try { p = JSON.parse(new TextDecoder().decode(fromB64url(m[1]))); } catch { return null; }
  if (!p || p.exp < Date.now()) return null;
  if (role !== 'any' && p.role !== role) return null;
  // Changing ADMIN_PASSWORD signs every admin out.
  if (p.role === 'admin' && p.pv !== (await sha256Hex(adminPassword(env))).slice(0, 12)) return null;
  return p;
}

/* ───────────────────────── Database ───────────────────────── */

let schemaReady = false;
async function db(env) {
  if (!env.DB) throw new Error('DB (D1) binding not configured — see stt-proxy/README.md');
  if (!schemaReady) {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, pin_hash TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1, fail_count INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')))`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, week_start TEXT NOT NULL,
        mime TEXT NOT NULL, duration_s REAL, takes INTEGER, marks TEXT, audio BLOB,
        transcript TEXT, auto_total REAL, auto_json TEXT, engine TEXT,
        manual_total REAL, manual_note TEXT, graded_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(member_id, week_start))`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_fail (ts INTEGER NOT NULL)`),
    ]);
    schemaReady = true;
  }
  return env.DB;
}

const DEFAULT_CONFIG = { record_dow: '7', record_from: '18:00', record_to: '22:00', extend_days: '0', max_takes: '3' };

async function getConfig(env) {
  const { results } = await (await db(env)).prepare('SELECT key, value FROM config').all();
  const cfg = { ...DEFAULT_CONFIG };
  for (const r of results) cfg[r.key] = r.value;
  return cfg;
}

/* ───────────────────────── Recording window (IST) ───────────────────────── */
// Mirrors src/lib/recordWindow.ts. Weeks start on Monday (the app's verse weeks).
// The window opens on day `record_dow` (1=Mon … 7=Sun) at record_from and closes
// `extend_days` later at record_to — one continuous period.

const IST_MS = 5.5 * 3600 * 1000;

function istMondayOf(nowMs) {
  const d = new Date(nowMs + IST_MS);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

function addDaysIso(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** UTC ms for an IST wall-clock date + HH:MM. */
function istToUtc(isoDate, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return Date.parse(`${isoDate}T00:00:00Z`) + (h * 60 + m) * 60000 - IST_MS;
}

function windowFor(cfg, weekStart) {
  const dow = Math.min(7, Math.max(1, Number(cfg.record_dow) || 7));
  const ext = Math.min(2, Math.max(0, Number(cfg.extend_days) || 0));
  const openDay = addDaysIso(weekStart, dow - 1);
  const opensAt = istToUtc(openDay, cfg.record_from || '18:00');
  let closesAt = istToUtc(addDaysIso(openDay, ext), cfg.record_to || '22:00');
  if (closesAt <= opensAt) closesAt += 24 * 3600 * 1000; // e.g. 20:00 → 01:00
  return { weekStart, opensAt, closesAt };
}

/** The window that is open now (this or last week's), else the next one to open. */
function activeWindow(cfg, nowMs = Date.now()) {
  const thisWeek = istMondayOf(nowMs);
  for (const ws of [addDaysIso(thisWeek, -7), thisWeek]) {
    const w = windowFor(cfg, ws);
    if (nowMs >= w.opensAt && nowMs < w.closesAt) return { ...w, open: true };
  }
  for (const ws of [thisWeek, addDaysIso(thisWeek, 7)]) {
    const w = windowFor(cfg, ws);
    if (nowMs < w.opensAt) return { ...w, open: false };
  }
  return { ...windowFor(cfg, addDaysIso(thisWeek, 7)), open: false };
}

/* ───────────────────────── Weekly verse feed (KV) ───────────────────────── */

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEEP_WEEKS = 4;

async function isFeedAdmin(request, env) {
  if (env.ADMIN_KEY && request.headers.get('x-admin-key') === env.ADMIN_KEY) return true;
  return !!(await bearer(request, env, 'admin'));
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
  if (path === '/admin/check') return (await isFeedAdmin(request, env)) ? json({ ok: true }) : json({ error: 'Unauthorized' }, 401);
  if (!env.WEEKS) return json({ error: 'WEEKS KV namespace not bound' }, 500);

  if (request.method === 'GET') {
    const index = (await env.WEEKS.get('index', 'json')) || [];
    const weeks = (await Promise.all(index.map((w) => env.WEEKS.get(`week:${w}`, 'json')))).filter(Boolean);
    return json({ weeks }, 200, { 'Cache-Control': 'public, max-age=60' });
  }
  if (request.method === 'PUT') {
    if (!(await isFeedAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
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

/* ───────────────────────── Members, recordings, scores (D1) ───────────────────────── */

/** "  priya   SELVARAJ " → "priya SELVARAJ": trimmed, single spaces, NFC (Tamil-safe). */
const cleanName = (n) => String(n || '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 60);
/** Same person regardless of capitals or spacing. */
const nameKey = (n) => cleanName(n).toLowerCase().replace(/\s/g, '');

async function nameTaken(D, name, exceptId = 0) {
  const { results } = await D.prepare('SELECT id, name FROM members WHERE id != ?').bind(exceptId).all();
  return results.find((m) => nameKey(m.name) === nameKey(name)) || null;
}

const MAX_AUDIO_BYTES = 1_900_000; // D1 row limit is 2 MB; 4 min of 32 kbps Opus ≈ 1 MB
const randomPin = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0');
const pinHash = (env, id, pin) => sha256Hex(`${sessionSecret(env)}|${id}|${pin}`);

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

function audioBytes(v) {
  if (!v) return null;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  if (Array.isArray(v)) return new Uint8Array(v);
  return null;
}

async function handleApi(request, env, path, url) {
  const D = await db(env);
  const method = request.method;

  // ── Logins ──
  if (path === '/auth/admin' && method === 'POST') {
    const since = Date.now() - 15 * 60000;
    const fails = await D.prepare('SELECT COUNT(*) AS n FROM admin_fail WHERE ts > ?').bind(since).first();
    if ((fails?.n ?? 0) >= 10) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
    const body = await readBody(request);
    const pw = adminPassword(env);
    if (!pw || !body || String(body.password || '') !== pw) {
      await D.prepare('INSERT INTO admin_fail (ts) VALUES (?)').bind(Date.now()).run();
      return json({ error: 'Wrong admin password' }, 401);
    }
    const pv = (await sha256Hex(pw)).slice(0, 12);
    return json({ token: await makeToken(env, { role: 'admin', pv, exp: Date.now() + 60 * 86400000 }) });
  }

  if (path === '/auth/member' && method === 'POST') {
    const body = await readBody(request);
    const id = Number(body?.memberId);
    const pin = String(body?.pin || '');
    const m = await D.prepare('SELECT id, name, pin_hash, active, fail_count, locked_until FROM members WHERE id = ?').bind(id).first();
    if (!m || !m.active) return json({ error: 'Member not found' }, 404);
    if (m.locked_until > Date.now()) return json({ error: 'Too many wrong PINs. Try again in 15 minutes.' }, 429);
    if ((await pinHash(env, id, pin)) !== m.pin_hash) {
      const fails = m.fail_count + 1;
      await D.prepare('UPDATE members SET fail_count = ?, locked_until = ? WHERE id = ?')
        .bind(fails >= 5 ? 0 : fails, fails >= 5 ? Date.now() + 15 * 60000 : 0, id).run();
      return json({ error: 'Wrong PIN' }, 401);
    }
    await D.prepare('UPDATE members SET fail_count = 0, locked_until = 0 WHERE id = ?').bind(id).run();
    const token = await makeToken(env, { role: 'member', mid: id, exp: Date.now() + 365 * 86400000 });
    return json({ token, member: { id: m.id, name: m.name } });
  }

  if (path === '/members' && method === 'GET') {
    const { results } = await D.prepare('SELECT id, name FROM members WHERE active = 1 ORDER BY name COLLATE NOCASE').all();
    return json(results);
  }

  if (path === '/config' && method === 'GET') {
    const cfg = await getConfig(env);
    return json({ ...cfg, window: activeWindow(cfg) });
  }

  // ── Member ──
  if (path === '/me/status' && method === 'GET') {
    const me = await bearer(request, env, 'member');
    if (!me) return json({ error: 'Please log in again' }, 401);
    const cfg = await getConfig(env);
    const w = activeWindow(cfg);
    const sent = await D.prepare('SELECT id, created_at FROM submissions WHERE member_id = ? AND week_start = ?').bind(me.mid, w.weekStart).first();
    const member = await D.prepare('SELECT id, name, active FROM members WHERE id = ?').bind(me.mid).first();
    if (!member?.active) return json({ error: 'Your membership was removed by the admin' }, 403);
    return json({ member: { id: member.id, name: member.name }, window: w, maxTakes: Number(cfg.max_takes) || 3, sent: sent || null });
  }

  if (path === '/submissions' && method === 'POST') {
    const me = await bearer(request, env, 'member');
    if (!me) return json({ error: 'Please log in again' }, 401);
    const body = await readBody(request);
    if (!body?.audioBase64) return json({ error: 'Missing audio' }, 400);
    const cfg = await getConfig(env);
    // Small grace so a recording finished on the last second still counts.
    const w = activeWindow(cfg, Date.now() - 5 * 60000);
    const wNow = activeWindow(cfg);
    const win = wNow.open ? wNow : w;
    if (!win.open || body.weekStart !== win.weekStart) return json({ error: 'The recording time is closed.' }, 403);
    const bytes = base64ToBytes(body.audioBase64);
    if (bytes.length > MAX_AUDIO_BYTES) return json({ error: 'Recording is too long.' }, 413);
    try {
      const r = await D.prepare(`INSERT INTO submissions (member_id, week_start, mime, duration_s, takes, marks, audio)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(me.mid, win.weekStart, String(body.mimeType || 'audio/webm').slice(0, 60),
        Number(body.durationS) || null, Number(body.takes) || 1, JSON.stringify(Array.isArray(body.marks) ? body.marks.slice(0, 20) : []), bytes).run();
      return json({ ok: true, id: r.meta?.last_row_id });
    } catch (e) {
      if (String(e).includes('UNIQUE')) return json({ error: 'You already sent your recording for this week.' }, 409);
      throw e;
    }
  }

  if (path === '/group' && method === 'GET') {
    const who = await bearer(request, env, 'any');
    if (!who) return json({ error: 'Please log in again' }, 401);
    const week = url.searchParams.get('week') || activeWindow(await getConfig(env)).weekStart;
    const { results } = await D.prepare(`SELECT m.id AS member_id, m.name, s.id AS submission_id, s.created_at, s.duration_s,
        s.audio IS NOT NULL AS audio_available
      FROM members m LEFT JOIN submissions s ON s.member_id = m.id AND s.week_start = ?
      WHERE m.active = 1 ORDER BY (s.id IS NULL), m.name COLLATE NOCASE`).bind(week).all();
    return json({ week, members: results });
  }

  const audioMatch = path.match(/^\/audio\/(\d+)$/);
  if (audioMatch && method === 'GET') {
    if (!(await bearer(request, env, 'any'))) return json({ error: 'Please log in again' }, 401);
    const row = await D.prepare('SELECT mime, audio FROM submissions WHERE id = ?').bind(Number(audioMatch[1])).first();
    const bytes = audioBytes(row?.audio);
    if (!row) return json({ error: 'Not found' }, 404);
    if (!bytes) return json({ error: 'This recording was deleted after 8 weeks.' }, 410);
    return new Response(bytes, { headers: { 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=3600', ...CORS } });
  }

  // ── Admin ──
  if (!path.startsWith('/admin/')) return json({ error: 'Not found' }, 404);
  if (!(await bearer(request, env, 'admin'))) return json({ error: 'Admin login required' }, 401);

  if (path === '/admin/members' && method === 'GET') {
    const { results } = await D.prepare(`SELECT id, name, active, created_at FROM members ORDER BY name COLLATE NOCASE`).all();
    return json(results);
  }
  if (path === '/admin/members' && method === 'POST') {
    const body = await readBody(request);
    const name = cleanName(body?.name);
    if (!name) return json({ error: 'Name required' }, 400);
    const dup = await nameTaken(D, name);
    if (dup) return json({ error: `"${dup.name}" is already a member. Use a different name (e.g. add an initial).` }, 409);
    const r = await D.prepare(`INSERT INTO members (name, pin_hash) VALUES (?, '')`).bind(name).run();
    const id = r.meta.last_row_id;
    const pin = randomPin();
    await D.prepare('UPDATE members SET pin_hash = ? WHERE id = ?').bind(await pinHash(env, id, pin), id).run();
    return json({ id, name, pin, active: 1 });
  }
  const memberMatch = path.match(/^\/admin\/members\/(\d+)(\/pin)?$/);
  if (memberMatch) {
    const id = Number(memberMatch[1]);
    if (memberMatch[2] && method === 'POST') {
      const pin = randomPin();
      await D.prepare('UPDATE members SET pin_hash = ?, fail_count = 0, locked_until = 0 WHERE id = ?').bind(await pinHash(env, id, pin), id).run();
      return json({ id, pin });
    }
    if (method === 'PATCH') {
      const body = (await readBody(request)) || {};
      if (body.name != null) {
        const name = cleanName(body.name);
        if (!name) return json({ error: 'Name required' }, 400);
        const dup = await nameTaken(D, name, id);
        if (dup) return json({ error: `"${dup.name}" is already a member.` }, 409);
        await D.prepare('UPDATE members SET name = ? WHERE id = ?').bind(name, id).run();
      }
      if (body.active != null) await D.prepare('UPDATE members SET active = ? WHERE id = ?').bind(body.active ? 1 : 0, id).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await D.batch([
        D.prepare('DELETE FROM submissions WHERE member_id = ?').bind(id),
        D.prepare('DELETE FROM members WHERE id = ?').bind(id),
      ]);
      return json({ ok: true });
    }
  }

  if (path === '/admin/config' && method === 'PUT') {
    const body = (await readBody(request)) || {};
    const clean = {
      record_dow: String(Math.min(7, Math.max(1, Number(body.record_dow) || 7))),
      record_from: /^\d{2}:\d{2}$/.test(body.record_from || '') ? body.record_from : DEFAULT_CONFIG.record_from,
      record_to: /^\d{2}:\d{2}$/.test(body.record_to || '') ? body.record_to : DEFAULT_CONFIG.record_to,
      extend_days: String(Math.min(2, Math.max(0, Number(body.extend_days) || 0))),
      max_takes: String(Math.min(5, Math.max(1, Number(body.max_takes) || 3))),
    };
    await D.batch(Object.entries(clean).map(([k, v]) =>
      D.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v)));
    return json({ ...clean, window: activeWindow(clean) });
  }

  if (path === '/admin/submissions' && method === 'GET') {
    const week = url.searchParams.get('week');
    if (!WEEK_RE.test(week || '')) return json({ error: 'week=YYYY-MM-DD required' }, 400);
    const { results } = await D.prepare(`SELECT s.id, s.member_id, m.name, s.week_start, s.mime, s.duration_s, s.takes, s.marks,
        s.transcript, s.auto_total, s.auto_json, s.engine, s.manual_total, s.manual_note, s.graded_at, s.created_at,
        s.audio IS NOT NULL AS audio_available
      FROM submissions s JOIN members m ON m.id = s.member_id WHERE s.week_start = ? ORDER BY m.name COLLATE NOCASE`).bind(week).all();
    return json(results);
  }
  const subMatch = path.match(/^\/admin\/submissions\/(\d+)$/);
  if (subMatch && method === 'PATCH') {
    const body = (await readBody(request)) || {};
    const cols = ['transcript', 'auto_total', 'auto_json', 'engine', 'manual_total', 'manual_note'];
    const sets = cols.filter((c) => body[c] !== undefined);
    if (!sets.length) return json({ error: 'Nothing to update' }, 400);
    await D.prepare(`UPDATE submissions SET ${sets.map((c) => `${c} = ?`).join(', ')}, graded_at = datetime('now') WHERE id = ?`)
      .bind(...sets.map((c) => body[c]), Number(subMatch[1])).run();
    return json({ ok: true });
  }
  if (subMatch && method === 'DELETE') { // "allow re-record"
    await D.prepare('DELETE FROM submissions WHERE id = ?').bind(Number(subMatch[1])).run();
    return json({ ok: true });
  }
  if (path === '/admin/scores' && method === 'GET') {
    const { results } = await D.prepare(`SELECT auto_total, manual_total FROM submissions
      WHERE auto_total IS NOT NULL AND manual_total IS NOT NULL ORDER BY id DESC LIMIT 500`).all();
    return json(results);
  }
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/week' || path === '/admin/check') return await handleFeed(request, env, path);
      if (path === '/') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
        return await handleTranscribe(request, env);
      }
      return await handleApi(request, env, path, url);
    } catch (e) {
      return json({ error: 'Server error', detail: String(e.message || e) }, 500);
    }
  },

  // Daily: free storage and keep members' voices private — audio is removed after
  // 8 weeks (the admin can back it up from the app before then). Scores stay.
  async scheduled(_event, env) {
    if (!env.DB) return;
    await (await db(env)).prepare(`UPDATE submissions SET audio = NULL
      WHERE audio IS NOT NULL AND created_at < datetime('now', '-56 days')`).run();
  },
};
