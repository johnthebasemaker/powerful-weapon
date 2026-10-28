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
  The Worker then requires header `x-stt-secret`; enter the same value in the app
  under Settings → Voice grading → Proxy secret.
- **Cloudflare rate limiting / WAF** on the Worker route.

## Weekly verse feed for members' phones (app 0.0.3+)

The same Worker also stores the week's 7 verses so members' phones can show the
real verse in their daily notification. It holds **only** Bible verses and the
send time — no names or phone numbers.

One-time setup (from this `stt-proxy/` folder):

```bash
npx wrangler kv namespace create WEEKS
```

Copy the `id` it prints into `wrangler.toml` (replace `REPLACE_WITH_WEEKS_NAMESPACE_ID`). Then:

```bash
npx wrangler secret put ADMIN_KEY
```

Type a long private password — only the admin's phone needs it. Then deploy:

```bash
npm run deploy
```

In the admin's app: Settings → Members' phones → paste the same admin key →
**Save & verify**. From then on, saving a week in the Verse Picker publishes it.

Endpoints: `GET /week` (public, newest 4 weeks) · `PUT /week` and
`GET /admin/check` (need header `x-admin-key`).

## Members, in-app recordings and scores (app 0.0.4+)

The Worker also stores members (name + hashed PIN), their weekly recordings and
the admin's marks in a free **D1** database, and deletes audio after 8 weeks
(daily cron). Run the whole setup in one go from the project folder:

```bash
scripts/setup-worker.sh
```

It creates the D1 database, asks you for the **admin password** (secret
`ADMIN_PASSWORD` — the admin types it in the app; only you can change it, by
re-running the script) and optionally a **Sarvam** key (`SARVAM_API_KEY`) to
compare Sarvam with Whisper, then deploys. Changing the admin password signs the
admin out of every phone.

Members log in with their name and the 4-digit PIN the admin gives them; 5 wrong
PINs lock that member for 15 minutes, 10 wrong admin passwords lock admin login
for 15 minutes.

## Swapping the STT vendor

The proxy is provider-agnostic via env vars — no code change needed for any
OpenAI-compatible vendor. Just set extra secrets alongside `STT_API_KEY`:
- **OpenAI Whisper** (paid): `STT_ENDPOINT=https://api.openai.com/v1/audio/transcriptions`,
  `STT_MODEL=whisper-1`.
- **Groq** (free, default): leave `STT_ENDPOINT`/`STT_MODEL` unset.

For a non-OpenAI-shaped API (e.g. Google `speech:recognize`, Deepgram), edit the
`callVendor()` function in `worker.js` — return `{ transcript, durationSeconds }`.
