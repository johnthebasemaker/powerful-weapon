#!/bin/bash
# One-time Worker upgrade for app 0.0.3 (weekly verse feed for members' phones).
# Interactive: opens the browser for Cloudflare login and asks YOU for the admin key.
set -euo pipefail
cd "$(dirname "$0")/../stt-proxy"
[ -d node_modules ] || npm ci

echo "1/4  Cloudflare login (a browser window opens if needed)…"
npx wrangler whoami >/dev/null 2>&1 || npx wrangler login

echo "2/4  Verse storage (KV namespace WEEKS)…"
if grep -q 'REPLACE_WITH_WEEKS_NAMESPACE_ID' wrangler.toml; then
  OUT="$(npx wrangler kv namespace create WEEKS 2>&1 || true)"
  ID="$(printf '%s' "$OUT" | grep -oE '[0-9a-f]{32}' | head -1 || true)"
  if [ -z "$ID" ]; then # already created on an earlier run → look it up
    ID="$(npx wrangler kv namespace list 2>/dev/null | node -e '
      let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const l=JSON.parse(s.slice(s.indexOf("[")));
      const n=l.find(x=>/WEEKS$/.test(x.title));process.stdout.write(n?n.id:"")})')"
  fi
  [ -n "$ID" ] || { echo "Could not create or find the WEEKS namespace:"; echo "$OUT"; exit 1; }
  sed -i '' "s/REPLACE_WITH_WEEKS_NAMESPACE_ID/$ID/" wrangler.toml
  echo "     WEEKS = $ID"
else
  echo "     already configured."
fi

echo "3/4  Admin key — type a long private password. Only the admin's phone needs it;"
echo "     paste the same value in the app: Settings → Members' phones."
npx wrangler secret put ADMIN_KEY

echo "4/4  Deploying…"
npx wrangler deploy

URL="https://powerful-weapon-stt.pw-stt.workers.dev"
echo
echo "Feed check: $(curl -s "$URL/week")"
echo "✅ Worker ready."
