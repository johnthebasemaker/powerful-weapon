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

## 0.0.3 checks (before uploading to Closed testing)

Install the release APK on the phone first (USB debugging on):

```bash
~/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/release/app-release.apk
```

- [ ] Launcher icon shows the open Bible with வார்த்தை, sharp, not shrunk; splash shows the poster.
- [ ] Upgrading from 0.0.2 opens straight into admin mode (existing members/verses kept).
- [ ] Fresh install shows the Welcome screen; "Start receiving daily verses" → Today screen.
- [ ] Settings → Notifications: Allowed + "Exact time: On time" (tap **Fix** if not). "Send a test", lock the phone → arrives in ~5 s.
- [ ] Admin: Settings → Members' phones → admin key → **Save & verify** shows Connected; Publish this week succeeds.
- [ ] Member phone: Today shows the published verse; Settings shows "14 upcoming daily notifications".
- [ ] Set the time 2 minutes ahead, lock the phone, wait → notification with the Tamil verse arrives on time.
- [ ] Every tab fits a portrait phone: no sideways scrolling, buttons not cut off, text not squashed.
- [ ] Voice Inbox: share a WhatsApp voice note → Import + Grade still works (release build uses R8).

## 0.0.4 checks (members recording in the app)

Run `scripts/setup-worker.sh` first, then update the app on two phones through Internal testing.

- [ ] Admin phone: Settings → Admin account → log in with the admin password.
- [ ] Members → **+ Add** a test member → note the PIN (WhatsApp/Copy buttons work).
- [ ] Settings → Recording time → set today, a window that is open now → Save.
- [ ] Second phone: fresh install → "I'm a group member" → pick the name → PIN → Verses shows all 7 verses in full.
- [ ] Record: Android asks for microphone permission; countdown → verses hidden, no pause button.
- [ ] While recording, press Home → take is cancelled with a message and counts as a try.
- [ ] Record again, tap **Next verse** for each verse, Finish → listen → **Send to admin**.
- [ ] Group tab shows the member as Sent with a play button, no marks.
- [ ] Admin: Voice → App recordings → play it → **Auto-mark** (per-verse marks + transcripts) → give your own mark.
- [ ] **Compare engines** (only if the Sarvam key is set) shows both totals.
- [ ] **Backup** shares the week's audio files (save to Drive).
- [ ] Not-sent list → **Remind** opens WhatsApp with the message.
- [ ] Home tab: today's verse and the week's verses are shown in full.

## 0.0.5 checklist

**Before installing:** deploy the Worker (`cd stt-proxy && npx wrangler deploy`) — the app needs the new try counter.

Member phone
- [ ] Settings → Display: switch தமிழ் / English; every member screen changes. Text size Large / Extra large scales everything. Theme Dark works.
- [ ] Record: "5 of 5 tries left". Start → lock the phone / take a call → reopen: toast says the try came back (2 times a week), then it costs a try.
- [ ] Recording keeps the screen on for 3+ minutes without touching it.
- [ ] Finish → the player plays immediately. Turn on flight mode → Send fails → leave the screen and come back → recording is still there → flight mode off → Send works.
- [ ] Use every try → "Ask the admin for one more try" → admin phone gets an urgent push.
- [ ] Your progress shows the streak and last 8 weeks (no marks).
- [ ] Practice opens on today's verse; "First letters" shows full Tamil letters (கு, not க). Voice check gives a % and the missed words; 10 a day.
- [ ] Group highlights "You".
- [ ] Reinstall the app → log in → tries used are still counted.

Admin phone
- [ ] Only one admin password prompt for the whole app.
- [ ] Push "<name> has no tries left" arrives with the app closed; tap → Voice → Needs a try → Give 1 more try → member gets "One more try".
- [ ] "Allow re-record" gives the member all tries back.
- [ ] Share list / Share + top 3 open WhatsApp with the week summary.
- [ ] Verse Picker search: `kanam pannu`, `karthar en meippar`, `john 3:16`, `psalm 23`, `யோவான் 3:16`.
- [ ] Settings → Auto-marking → Export grading log saves a .json.
- [ ] Settings → Recording time → Tries per member offers 1–10 (default 5).
- [ ] Home: each day's verse uses the full width.
