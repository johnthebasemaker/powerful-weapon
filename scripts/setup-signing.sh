#!/bin/bash
# One-time Play signing setup. YOU type the passwords (hidden); this script checks
# them against the keystore and writes android/keystore.properties (gitignored),
# after which `scripts/build-aab.sh` can build signed AABs without asking again.
#
#   scripts/setup-signing.sh          use the existing android/upload-keystore.jks
#   scripts/setup-signing.sh --new    password lost: make a NEW upload key + the
#                                     certificate Play Console needs for an
#                                     "upload key reset"
set -euo pipefail
cd "$(dirname "$0")/../android"

KEYTOOL="$(ls -d "$HOME"/Library/Java/JavaVirtualMachines/jdk-21*/Contents/Home 2>/dev/null | head -1)/bin/keytool"
[ -x "$KEYTOOL" ] || KEYTOOL="$(command -v keytool || true)"
[ -x "$KEYTOOL" ] || { echo "keytool not found (needs a JDK)."; exit 1; }

write_props() { # $1 storeFile  $2 alias
  umask 077
  cat > keystore.properties <<EOF
# Written by scripts/setup-signing.sh — gitignored, never commit or share.
storeFile=../$1
storePassword=$PW_STORE
keyAlias=$2
keyPassword=$PW_KEY
EOF
  echo "✅ Saved android/keystore.properties"
}

if [ "${1:-}" = "--new" ]; then
  STORE="upload-keystore-$(date +%Y%m%d).jks"
  echo "Creating a NEW upload key: android/$STORE"
  read -r -s -p "Choose a password (6+ characters, save it in your password manager): " PW_STORE; echo
  read -r -s -p "Type it again: " PW2; echo
  [ "$PW_STORE" = "$PW2" ] || { echo "Passwords don't match."; exit 1; }
  export PW_STORE
  PW_KEY="$PW_STORE"; export PW_KEY
  "$KEYTOOL" -genkeypair -v -keystore "$STORE" -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass:env PW_STORE -keypass:env PW_KEY -dname "CN=Andrew Johnson, O=Powerful Weapon, C=IN" >/dev/null
  "$KEYTOOL" -export -rfc -keystore "$STORE" -alias upload -storepass:env PW_STORE -file upload_certificate.pem
  write_props "$STORE" upload
  echo
  echo "Next: Play Console → Powerful Weapon → Test and release → App integrity → App signing →"
  echo "      'Request upload key reset' → upload android/upload_certificate.pem."
  echo "      Google emails you when the new key is active (usually 1–2 days)."
  exit 0
fi

[ -f upload-keystore.jks ] || { echo "android/upload-keystore.jks not found."; exit 1; }
read -r -s -p "Keystore password for upload-keystore.jks: " PW_STORE; echo
export PW_STORE
if ! "$KEYTOOL" -list -keystore upload-keystore.jks -storepass:env PW_STORE >/dev/null 2>&1; then
  echo "❌ That password doesn't open the keystore. Try another, or run: scripts/setup-signing.sh --new"
  exit 1
fi
ALIAS="$("$KEYTOOL" -list -keystore upload-keystore.jks -storepass:env PW_STORE 2>/dev/null \
  | awk -F, '/PrivateKeyEntry/{print $1; exit}')"
echo "✅ Password correct. Key alias: $ALIAS"
read -r -s -p "Key password (press Enter if it's the same): " PW_KEY; echo
[ -n "$PW_KEY" ] || PW_KEY="$PW_STORE"
export PW_KEY
write_props upload-keystore.jks "$ALIAS"
"$KEYTOOL" -list -v -keystore upload-keystore.jks -storepass:env PW_STORE 2>/dev/null | grep -m1 "SHA256:" \
  | sed 's/^ */Upload key fingerprint: /'
