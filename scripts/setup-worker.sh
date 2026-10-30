#!/bin/bash
# Worker setup / upgrade (safe to re-run). Interactive: Cloudflare login opens in
# the browser if needed, and YOU type any passwords — nothing secret is stored here.
#   0.0.3: weekly verse feed (KV namespace WEEKS)
#   0.0.4: members, in-app recordings and scores (D1 database), admin password,
#          optional Sarvam speech-to-text, daily 8-week audio clean-up (cron)
set -euo pipefail
cd "$(dirname "$0")/../stt-proxy"
[ -d node_modules ] || npm ci

echo "1/5  Cloudflare login…"
npx wrangler whoami >/dev/null 2>&1 || npx wrangler login

echo "2/5  Verse storage (KV namespace WEEKS)…"
if grep -q 'REPLACE_WITH_WEEKS_NAMESPACE_ID' wrangler.toml; then
  OUT="$(npx wrangler kv namespace create WEEKS 2>&1 || true)"
  ID="$(printf '%s' "$OUT" | grep -oE '[0-9a-f]{32}' | head -1 || true)"
  [ -n "$ID" ] || { echo "Could not create the WEEKS namespace:"; echo "$OUT"; exit 1; }
  sed -i '' "s/REPLACE_WITH_WEEKS_NAMESPACE_ID/$ID/" wrangler.toml
fi
echo "     ok"

echo "3/5  Members & recordings database (D1 powerful-weapon)…"
if grep -q 'REPLACE_WITH_D1_DATABASE_ID' wrangler.toml; then
  OUT="$(npx wrangler d1 create powerful-weapon 2>&1 || true)"
  ID="$(printf '%s' "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || true)"
  if [ -z "$ID" ]; then # created on an earlier run → look it up
    ID="$(npx wrangler d1 list --json 2>/dev/null | node -e '
      let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const l=JSON.parse(s);
      const d=l.find(x=>x.name==="powerful-weapon");process.stdout.write(d?d.uuid:"")})')"
  fi
  [ -n "$ID" ] || { echo "Could not create or find the D1 database:"; echo "$OUT"; exit 1; }
  sed -i '' "s/REPLACE_WITH_D1_DATABASE_ID/$ID/" wrangler.toml
fi
echo "     ok"

SECRETS="$(npx wrangler secret list 2>/dev/null || echo '[]')"
has() { printf '%s' "$SECRETS" | grep -q "\"$1\""; }

echo "4/5  Passwords (typed by you, stored only on Cloudflare)"
if has ADMIN_PASSWORD; then
  read -r -p "     Admin password is already set. Change it? [y/N] " A
else
  A=y; echo "     Choose the ADMIN PASSWORD the admin will type in the app (only you can change it):"
fi
[[ "$A" =~ ^[Yy] ]] && npx wrangler secret put ADMIN_PASSWORD
has ADMIN_KEY || { echo "     Choose a private signing key (any long random text, never typed in the app):"; npx wrangler secret put ADMIN_KEY; }
if ! has SARVAM_API_KEY; then
  read -r -p "     Add a Sarvam API key to compare Sarvam with Whisper? [y/N] " S
  [[ "$S" =~ ^[Yy] ]] && npx wrangler secret put SARVAM_API_KEY
fi
if ! has FCM_SERVICE_ACCOUNT; then
  echo "     Push alerts (member out of tries → your phone) need the Firebase service-account key:"
  echo "     Firebase console → Project settings → Service accounts → Generate new private key (a .json file)."
  read -r -p "     Path to that .json file (Enter to skip): " F
  F="${F/#\~/$HOME}"
  if [ -n "$F" ] && [ -f "$F" ]; then
    npx wrangler secret put FCM_SERVICE_ACCOUNT < "$F"
    echo "     ✅ Stored on the Worker. You can now delete the downloaded .json file."
  fi
fi

echo "5/5  Deploying…"
npx wrangler deploy

URL="https://powerful-weapon-stt.pw-stt.workers.dev"
echo
echo "Feed:    $(curl -s "$URL/week" | head -c 80)"
echo "Members: $(curl -s "$URL/members" | head -c 80)"
echo "✅ Worker ready. In the app: Settings → Admin account → log in with the admin password."
