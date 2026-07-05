// Speech-to-Text proxy for Powerful Weapon (Android) — Cloudflare Worker.
//
// Holds the vendor API key SERVER-SIDE so it never ships inside the APK. The app
// POSTs audio here; this forwards to the STT vendor and returns a transcript.
//
// Contract (matches src/lib/stt.ts):
//   POST /   { audioBase64, mimeType, language }  ->  { transcript, durationSeconds }
//
// Default vendor: OpenAI Whisper API (good Tamil support). To swap to Google
// Speech-to-Text or Deepgram, replace the `callVendor` function only.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-stt-secret',
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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
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
