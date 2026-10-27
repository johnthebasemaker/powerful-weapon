#!/bin/bash
# Build the signed Play Store bundle: web build → cap sync → Gradle bundleRelease.
# Needs android/keystore.properties (run scripts/setup-signing.sh once).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

[ -f android/keystore.properties ] || { echo "Run scripts/setup-signing.sh first."; exit 1; }
export JAVA_HOME="${JAVA_HOME:-$(ls -d "$HOME"/Library/Java/JavaVirtualMachines/jdk-21*/Contents/Home | head -1)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

npx vite build
npx cap sync android
(cd android && ./gradlew --no-daemon bundleRelease assembleRelease)

AAB=android/app/build/outputs/bundle/release/app-release.aab
VER=$(grep -m1 versionName android/app/build.gradle | sed -E 's/.*"(.*)".*/\1/')
OUT="release/android-$VER"
mkdir -p "$OUT"
cp "$AAB" "$OUT/PowerfulWeapon-$VER.aab"
cp android/app/build/outputs/apk/release/app-release.apk "$OUT/PowerfulWeapon-$VER.apk"
cp android/app/build/outputs/mapping/release/mapping.txt "$OUT/mapping.txt"

# Refuse to hand over a debug-signed bundle (Play rejects it).
if "$JAVA_HOME/bin/keytool" -printcert -jarfile "$AAB" | grep -q "CN=Android Debug"; then
  echo "❌ Bundle is DEBUG-signed — check android/keystore.properties."; exit 1
fi
# The upload key Play Console knows (see RELEASE.md). Update after an upload key reset.
PLAY_UPLOAD_SHA256="47:42:CB:83:EA:B8:23:59:14:82:35:E4:03:B0:A4:21:DF:A8:1C:93:19:5A:54:B9:DE:58:47:F5:EF:61:5B:62"
GOT=$("$JAVA_HOME/bin/keytool" -printcert -jarfile "$AAB" | grep -m1 "SHA256:" | awk '{print $2}')
echo "✅ Signed bundle: $OUT/PowerfulWeapon-$VER.aab"
if [ "$GOT" != "$PLAY_UPLOAD_SHA256" ]; then
  echo "⚠️  Signed with a different key than Play expects ($GOT)."
  echo "    Play will reject it unless an upload key reset to this key was approved."
fi
