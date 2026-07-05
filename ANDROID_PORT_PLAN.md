# Android Port Plan — Powerful Weapon

Audit + implementation plan for shipping the Electron desktop app to Google Play
via Ionic Capacitor.

**Locked decisions:**
- WhatsApp workflow: **"Keep the group, semi-manual"** (§1).
- Backend: **On-device + tiny STT proxy** (§2, recommended option) — data +
  grading run in the app; the only server is a serverless STT-key proxy.

---

## 1. The two hard truths (platform/policy walls, not effort)

These are not things more code can fix. They shape the whole design.

### 1a. You cannot auto-post to a WhatsApp *group* from a Play Store app
- WhatsApp's official **Business Cloud API sends to individuals, not groups.**
- Unofficial group automation (whatsapp-web.js / Baileys) **violates WhatsApp
  ToS** (number bans) and **Google Play rejects** apps that use it.
- **Accessibility-service auto-tap** of "Send" is a Play Store **auto-removal.**
- Deep links (`whatsapp://send?text=`) can pre-fill text and open WhatsApp, but
  the admin taps Send and **cannot target a group** programmatically.

**Chosen path — semi-manual, group-preserving:** a daily local notification →
admin taps → WhatsApp opens with the verse pre-filled → admin picks the group →
Send. One tap/day. Mirrors today's desktop flow.

### 1b. You cannot read another app's messages/media on Android
- Scoped storage (Android 11+) means your app **cannot browse WhatsApp's voice
  notes**, and WhatsApp does **not pass the sender's name** through the Share
  sheet.
- **Chosen path:** admin long-presses a voice note in WhatsApp → **Share → this
  app** → app asks "who is this from?" (roster picker) → transcribe + grade.
  This is the desktop "import + match name" step, moved to mobile.

---

## 2. Architecture — the key finding that simplifies everything

**Only Whisper cannot run on-device.** Verified by reading the source:

| Module | Portable to Android webview? | Notes |
|---|---|---|
| `electron/lib/tamil.ts` | ✅ pure TS | regex + `Math` only |
| `electron/lib/fuzzy.ts` (verse ranking) | ✅ pure TS | imports only `tamil.ts` |
| `electron/lib/grading.ts` (scoring) | ✅ pure TS | imports only `tamil.ts` |
| `electron/lib/database.ts` schema/SQL | ✅ standard SQLite | port `better-sqlite3` API → `@capacitor-community/sqlite` (async) |
| `electron/ipc/files.ts` | ⚠️ replace | Electron `dialog`+`fs` → file-picker plugin + `@capacitor/filesystem` |
| `electron/ipc/scheduler.ts` | ⚠️ replace | `node-cron` → `@capacitor/local-notifications` |
| `electron/ipc/whatsapp.ts` | ⚠️ replace | clipboard+open → deep link (§4) |
| `electron/ipc/whisper.ts` | ❌ **only true blocker** | native binary + ffmpeg + 3 GB model → **cloud STT API** |

Because grading/ranking are pure TS, they can run **inside the app**. That means
a full data server is optional. Two viable shapes:

- **(Recommended) On-device + tiny STT proxy.** Data in on-device SQLite;
  ranking + grading run in the app (reuse the pure-TS libs as-is); the *only*
  network call is transcription, routed through a small serverless function that
  holds the cloud-STT key (so the key is never shipped in the APK). Cheapest,
  works offline except during grading, simplest for a single ministry admin.
- **Full Remote API server.** Node/Express reuses `lib/` + SQLite + STT and
  exposes REST; app is a thin client. Justified **only if multiple admins/devices
  must share one dataset**, at the cost of hosting, auth, and always-online.

> ⚠️ Never embed a cloud-STT API key directly in the app — it's extractable from
> the APK. Use the proxy (or full server) either way.

Cloud STT options that support **Tamil (ta-IN)** and accept WhatsApp Opus/OGG
directly (no ffmpeg needed): Google Cloud Speech-to-Text, OpenAI Whisper API,
Deepgram. Grading logic (`grade()`) is unchanged; it just receives the transcript
from the API instead of local whisper.cpp.

---

## 3. Phased roadmap

### Dev workflow — live reload (edit src/ → instant on-device HMR)
```bash
# terminal 1 — Vite dev server on your LAN
npm run dev:web
# terminal 2 — point the Android app at it, then Run ▶ in Android Studio
npm run cap:live            # detects your LAN IP; override with CAP_HOST=1.2.3.4
```
Phone/emulator must share the Mac's Wi-Fi. Edits to `src/` hot-reload live.
Driven by `CAP_SERVER_URL` in `capacitor.config.ts` (injected only for `cap:live`).
**Before any release build, return to bundled assets:** `npm run cap:bundle`
(a normal sync clears the dev URL — verified — so releases never point at your Mac).

### Phase 0 — Renderer hardening ✅ DONE (this session)
- `src/lib/platform.ts` — platform detection + safe `getApi()` (no more
  `window.api` TypeErrors on Android).
- `src/lib/toast.tsx` — `toast()` + `safeCall()` graceful network handling.
- `src/components/Layout.tsx` — responsive; sidebar collapses to a safe-area top
  bar on phones (removed the fixed 240px sidebar that broke mobile).
- `index.html` `viewport-fit=cover`; `src/index.css` `.safe-top/.safe-bottom/.safe-x`.

### Phase 1 — Capacitor bootstrap ✅ DONE (branch `android-port`)
- Installed `@capacitor/core|cli|android|app|local-notifications|filesystem|
  clipboard|app-launcher` + `@capacitor-community/sqlite`.
- `capacitor.config.ts` (appId `com.andrewjohnson.powerfulweapon`, webDir `dist`).
- `npx cap add android` → native `android/` project generated; 6 plugins detected.
- Manifest: added WhatsApp `<queries>` + `POST_NOTIFICATIONS`.
- **Manual step remaining:** open `android/` in Android Studio once so Gradle
  syncs (CLI couldn't — no Java on shell PATH), then run on an emulator/device.
- Still TODO here: share-receiver plugin for voice notes (e.g. `send-intent`) +
  file picker (`@capawesome/capacitor-file-picker`) — added in Phase 4.

### Phase 2 — Data layer ✅ DONE
- Decision revised: the shared pure-TS libs (`tamil/fuzzy/grading`) **stay in
  `electron/lib/`** (single source of truth) and are imported into the mobile
  layer. Moving them would break electron's `composite` tsconfig (`rootDir: "."`).
- `src/lib/db/schema.ts` — schema mirrored from `database.ts` (can't import it —
  it pulls `better-sqlite3`).
- `src/lib/db/sqlite.ts` — `@capacitor-community/sqlite` connection, first-launch
  schema + settings + verse seed (`public/verses.full.json` → fallback
  `verses.json`), async `all/get/run/runSet` helpers.
- `public/verses.json` — committed 17-verse sample seed; drop the full
  `tamil-ov.json` in as `public/verses.full.json` (gitignored) for release.

### Phase 3 — Unified data access ✅ DONE (killed the `window.api` dependency)
- `src/lib/db/mobileApi.ts` — the **entire** `window.api` surface reimplemented
  on SQLite, typed as `Window['api']` so the compiler enforces parity. Ranking +
  grading reuse the shared pure-TS libs. Whisper/file-pick/backup are graceful
  stubs until Phase 4.
- `src/lib/api.ts` — `api()` facade: desktop → `window.api`, Android → SQLite.
- All 6 pages switched from `window.api.*` to `api()`. Renderer **and** electron
  tsc both green; desktop build untouched.

### Phase 4 — Mobile-native features (mostly ✅)
- ✅ **Back button** — `src/lib/useAndroidBackButton.ts`, wired into `App.tsx`.
- ✅ **Daily reminder** — `src/lib/scheduler.ts` (local-notifications), replaces
  `node-cron`. (Still to wire: call it from Settings save + `initReminderTapHandler`
  at boot to trigger `postVerseToWhatsApp` on tap.)
- ✅ **Semi-manual WhatsApp post** — `src/lib/whatsapp.ts`. (Still to wire into the
  Dashboard "Copy + Open WhatsApp" button on native.)
- ✅ **CSV export** — `src/lib/exportFile.ts` (`@capacitor/filesystem` + Share sheet);
  Leaderboards `exportCsv` now uses it.
- ✅ **Voice import + grading** — `mobileApi.files` uses `@capawesome/capacitor-file-picker`
  → stores audio via Filesystem; `mobileApi.whisper.*` transcribes via a vendor-agnostic
  **STT proxy** (`src/lib/stt.ts`) then grades locally with `grade()`. Proxy URL set in
  Settings → `stt_proxy_url` (new mobile-only `MobileSttSection`).
- ⏳ **Share-intent** (WhatsApp → Share → app) — smoother than the file picker for
  grabbing WhatsApp voice notes; needs a `send-intent` plugin + an `ACTION_SEND`
  intent-filter in AndroidManifest. File picker works today as the baseline.

### STT proxy contract (deploy once, server-side — holds the vendor API key)
`POST <stt_proxy_url>` with JSON `{ audioBase64, mimeType, language }` →
`{ transcript: string, durationSeconds?: number }`. Any vendor (Google STT ta-IN,
OpenAI Whisper API, Deepgram) behind it. The app never sees the key.

### Phase 5 — Play Store packaging (mostly ✅)
- ✅ **Icons + splash** generated from `resources/icons/icon.png` via
  `@capacitor/assets` (74 assets in `android/app/src/main/res`).
- ✅ **Version**: `versionCode 1`, `versionName "0.1.1"`; `targetSdk 36` (Play-OK).
- ✅ **Release signing config** in `android/app/build.gradle`, driven by
  `android/keystore.properties` (gitignored; template = `keystore.properties.example`).
- ✅ **Privacy policy** drafted: `PRIVACY.md` (host it, put the URL in Play).
- ✅ Permissions: `INTERNET`, `POST_NOTIFICATIONS` (Android 13+ runtime prompt via
  the local-notifications plugin).

**Build the upload AAB:**
```bash
# 1. One-time: create the upload keystore + keystore.properties
keytool -genkey -v -keystore android/upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
cp android/keystore.properties.example android/keystore.properties   # fill in passwords

# 2. Every release:
npm run build:renderer && npx cap sync android
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab   (upload this)
```
Then in Play Console: create the app → **Internal testing** track → upload the AAB
→ add testers → share the opt-in link. Complete the **Data safety** form (declare:
voice recordings + transcripts sent to your STT provider for transcription; no
data shared with advertisers) and paste the `PRIVACY.md` URL.

> Before first upload, drop the full Bible in: `cp resources/bible/tamil-ov.json public/verses.full.json`
> then rebuild — otherwise testers get only the 17-verse sample.

---

## 4. Semi-manual WhatsApp — reference code

```ts
// src/lib/whatsapp.ts  (Android; desktop keeps electron/ipc/whatsapp.ts)
import { Clipboard } from '@capacitor/clipboard';
import { AppLauncher } from '@capacitor/app-launcher';

/** Copy the verse and open WhatsApp with it pre-filled; admin picks the group + Send. */
export async function postVerseToWhatsApp(message: string) {
  await Clipboard.write({ string: message });            // fallback: manual paste
  const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
  const { value } = await AppLauncher.canOpenUrl({ url: 'whatsapp://send' });
  await AppLauncher.openUrl({ url: value ? url : `https://wa.me?text=${encodeURIComponent(message)}` });
}
```

```ts
// src/lib/scheduler.ts  — replaces node-cron on mobile
import { LocalNotifications } from '@capacitor/local-notifications';

export async function scheduleDailyPostReminder(hour: number, minute: number) {
  await LocalNotifications.requestPermissions();
  await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
  await LocalNotifications.schedule({
    notifications: [{
      id: 1,
      title: "Post today's verse",
      body: 'Tap to open WhatsApp with the verse ready to send.',
      schedule: { on: { hour, minute }, repeats: true },
      extra: { action: 'post-verse' },
    }],
  });
}
// On tap: LocalNotifications.addListener('localNotificationActionPerformed', ...)
//   → navigate to Dashboard → call postVerseToWhatsApp(today's verse).
```

---

## 5. Hardware back button — reference code

```ts
// src/lib/useAndroidBackButton.ts   (call useAndroidBackButton() atop App.tsx)
import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAndroid } from './platform';

export function useAndroidBackButton() {
  const navigate = useNavigate();
  const loc = useLocation();
  const path = useRef(loc.pathname);
  path.current = loc.pathname;
  useEffect(() => {
    if (!isAndroid()) return;
    let handle: { remove: () => void } | undefined;
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', ({ canGoBack }) => {
        const atRoot = path.current === '/' || path.current === '/dashboard';
        if (atRoot || !canGoBack) App.exitApp();   // clean exit at home
        else navigate(-1);                          // else go back in router history
      }).then((h) => { handle = h; });
    });
    return () => handle?.remove();
  }, [navigate]);
}
```

---

## 6. Decisions — RESOLVED

- Backend: **On-device + tiny STT proxy** (§2). No full data server. Scaffold the
  on-device SQLite layer (Phase 2) + a single serverless STT function.
- WhatsApp: **semi-manual, group-preserving** (§1, §4).

Next action: Phase 1 bootstrap (install Capacitor, `cap add android`) — do it on
a dedicated branch so the working Electron build on `main` stays untouched.
