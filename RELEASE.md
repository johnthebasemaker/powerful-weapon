# Android release (Google Play)

Package `com.andrewjohnson.powerfulweapon`. Every release bumps `versionCode`
(+1) and `versionName` in `android/app/build.gradle` and the version shown in
`src/components/Layout.tsx` / `src/pages/Settings.tsx`.

## Signing (one time per Mac)

The AAB must be signed with the **same upload key** Play already knows.
`android/upload-keystore.jks` is that key; its passwords go in
`android/keystore.properties` (gitignored). It is **not** the OT calculator's key
or password — those don't open it (checked 2026-10-27).

Upload key Play knows (from the Jul 2026 bundle, owner `CN=Johnson Andrew, O=Pw`):
`SHA256: 47:42:CB:83:EA:B8:23:59:14:82:35:E4:03:B0:A4:21:DF:A8:1C:93:19:5A:54:B9:DE:58:47:F5:EF:61:5B:62`
(changes only after a Play "upload key reset").

Create the properties file by running, and typing the password yourself:

```bash
scripts/setup-signing.sh
```

Lost the password? Make a new upload key and ask Google to switch to it
(Play App Signing keeps the real app-signing key, so users are unaffected):

```bash
scripts/setup-signing.sh --new
```

Then Play Console → App integrity → App signing → **Request upload key reset**
→ upload `android/upload_certificate.pem`. Builds signed with the new key are
accepted once Google confirms by email.

Keep the password in a password manager. Never commit `keystore.properties`,
`*.jks`, or paste the password into chat.

## Build

```bash
scripts/build-aab.sh
```

Output: `release/android-<version>/PowerfulWeapon-<version>.aab` (upload this),
the matching `.apk` for testing on a phone, and `mapping.txt` (R8 de-obfuscation;
upload it under the release's App bundle explorer if Play shows the warning).
The script refuses to finish if the bundle is debug-signed.

Toolchain (no Android Studio needed): JDK 21 in `~/Library/Java/JavaVirtualMachines`,
Android SDK in `~/Library/Android/sdk` (platform 36, build-tools 36).

## Worker (members' daily-verse feed)

One time, interactive (Cloudflare login + you choose the admin key):

```bash
scripts/setup-worker.sh
```
