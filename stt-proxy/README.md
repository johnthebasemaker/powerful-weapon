# Powerful Weapon — STT proxy

A tiny Cloudflare Worker that transcribes voice notes for the Android app. It
holds the speech-to-text vendor API key **server-side**, so the key never ships
inside the APK (where it could be extracted).

## Contract

```
POST <your-worker-url>
Content-Type: application/json

{ "audioBase64": "...", "mimeType": "audio/ogg", "language": "ta" }
  ->  { "transcript": "…", "durationSeconds": 42.1 }
```

This is exactly what `src/lib/stt.ts` in the app sends. After deploying, paste
the worker URL into the app: **Settings → Speech-to-Text (cloud)**.

## Deploy — $0 with Groq (≈5 minutes)

Default vendor is **Groq** (free API access to `whisper-large-v3`, supports Tamil),
served from Cloudflare Workers' free `workers.dev` URL. Total cost: nothing.

1. **Get a free Groq key:** sign up at <https://console.groq.com> → **API Keys** →
   Create key (starts with `gsk_...`).
2. **Deploy the Worker:**
   ```bash
   cd stt-proxy
   npm install
   npx wrangler login                    # opens browser, one time (free Cloudflare acct)
   npx wrangler secret put STT_API_KEY   # paste your Groq key when prompted
   npm run deploy                        # prints https://pw-stt.workers.dev
   ```
3. Paste that printed URL into the app: **Settings → Speech-to-Text (cloud) → Save**.

Local test first (optional):
```bash
cp .dev.vars.example .dev.vars           # edit in your Groq key
npm run dev
```

## Protecting the endpoint (recommended)

An open proxy could let strangers spend your OpenAI credits. Two easy guards:
- **Shared secret:** `npx wrangler secret put PROXY_SECRET` (a long random string).
  The Worker then requires header `x-stt-secret`. (Add that header in
  `src/lib/stt.ts`'s fetch to use it.)
- **Cloudflare rate limiting / WAF** on the Worker route.

## Swapping the STT vendor

The proxy is provider-agnostic via env vars — no code change needed for any
OpenAI-compatible vendor. Just set extra secrets alongside `STT_API_KEY`:
- **OpenAI Whisper** (paid): `STT_ENDPOINT=https://api.openai.com/v1/audio/transcriptions`,
  `STT_MODEL=whisper-1`.
- **Groq** (free, default): leave `STT_ENDPOINT`/`STT_MODEL` unset.

For a non-OpenAI-shaped API (e.g. Google `speech:recognize`, Deepgram), edit the
`callVendor()` function in `worker.js` — return `{ transcript, durationSeconds }`.
