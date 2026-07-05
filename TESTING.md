# On-device test checklist (Android)

Run the app on an emulator or a real phone and walk this list. Re-sync web assets
first whenever you've changed app code:

```bash
npm run build:renderer && npx cap sync android
```

## Launch it (Android Studio — uses its own JDK, no Java-PATH fix needed)
1. Toolbar shows **"No Devices"** → click it → **Device Manager** → **＋ Create Virtual Device**
   → pick e.g. *Pixel 7*, a system image (API 34/35; download if prompted) → **Finish**.
2. Select that device in the toolbar dropdown.
3. Press **Run ▶** (Ctrl+R). Gradle builds a debug APK and installs + launches it.

## Checklist

| # | Feature | Steps | Pass = |
|---|---------|-------|--------|
| 1 | **Full Bible seeds** | Open app; wait a few seconds on first launch | Dashboard "Bible verses" card shows **31,102** (or Settings → Bible database) |
| 2 | **Notch / safe area** | Look at the top bar | Title/nav sit **below** the status bar & camera cutout, not under them |
| 3 | **Data persists (SQLite)** | Add a user (Users → fill name+phone → Add), then **fully close** and reopen the app | The user is still listed |
| 4 | **Verse search + ranking** | Verse Picker → type a Tamil root (e.g. `கனம்`) → Search | Ranked results appear |
| 5 | **Save a week** | Pick exactly 7 → **Save week** → open Dashboard | Dashboard shows the 7-day schedule |
| 6 | **Hardware back button** | Go Users → press phone **back** | Returns to previous screen. On Dashboard, back **exits** the app |
| 7 | **Daily reminder** | Settings → set **Send time** to ~2 min ahead → **Apply schedule** (allow the notification prompt) → lock the phone | A notification fires at that time |
| 8 | **Reminder → post flow** | Tap that notification | App opens to **Dashboard** with the verse under "waiting to send" |
| 9 | **WhatsApp post** | Dashboard → **Copy + Open WhatsApp** | WhatsApp opens with the verse pre-filled; pick a chat to confirm |
| 10 | **CSV export** | Leaderboards → **Export CSV** | Android **Share sheet** appears with the .csv |
| 11 | **STT proxy setup** | Settings → Speech-to-Text (cloud) → paste your Worker URL → **Save** | Shows "✅ Proxy configured" |
| 12 | **Voice import + grade** | Voice Inbox → **Pick voice note files** → choose an audio file → **Import + Grade** | Transcript + scores appear (needs #11 done) |
| 13 | **Share-intent** | In **WhatsApp**, long-press a voice note → **Share → Powerful Weapon** | App opens Voice Inbox with the note queued; pick speaker → grades |

## Known caveats to watch
- **#12/#13 depend on the STT proxy** (deploy `stt-proxy/` and set the URL). Without
  it, import still works but notes stay ungraded.
- **#13 content-URI reading** varies by Android version — if it fails, note the
  toast error; the File Picker path (#12) is the fallback.
- First launch seeds 31k verses (~a few seconds) — the first data screen may pause.
