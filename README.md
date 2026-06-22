# Powerful Weapon

A simple desktop app for managing a weekly Tamil Bible study group:

- Pick 7 verses for the week from a Tamil root word (fuzzy match).
- Auto-prepare a daily WhatsApp message with the verse reference + text.
- Drop in Sunday voice notes, get them transcribed (Tamil) and graded.
- See weekly + yearly leaderboards for consistency and recitation quality.

Built so one non-technical user can run it on their desktop. Everything runs **locally** — no cloud, no monthly fees, no accounts.

---

## 🚀 Quick start — open the app

There are two double-clickable launchers at the top of this folder:

| Mac | Windows |
|---|---|
| **Open Powerful Weapon.command** | **Open Powerful Weapon.bat** |

Double-click the one for your computer. A small black window will open and stay open while the app runs. The first time, it'll install some pieces (takes a few minutes); after that, every launch takes ~5 seconds.

**A new "Powerful Weapon" window will appear** — that's the app.

To stop the app: close the small black window.

> **Mac safety prompt on first launch:** macOS may say *"can't be opened because Apple cannot check it for malicious software."* Open System Settings → Privacy & Security → scroll down → click **"Open anyway"** next to the file's name. You only do this once.

---

## First-time setup (before the launcher will work)

The launcher needs three things on the computer:

1. **Node.js** — runs the app's engine.
2. **Whisper** — the Tamil speech-to-text engine.
3. **Tamil Bible data** — the verse database.

Skip Whisper if you don't need automatic voice grading yet — the app still works.

### 🖥️ Mac

```bash
# 1) Install the tools (Homebrew first if you don't have it: https://brew.sh )
brew install node ffmpeg cmake

# 2) Install the app's dependencies (one-time)
cd "/path/to/Powerful Weapon"
npm install

# 3) Open the app once to verify
open "Open Powerful Weapon.command"
```

### 🪟 Windows

1. Download and install **Node.js LTS** from <https://nodejs.org/> — accept the default options.
2. Download and install **FFmpeg** for Windows: <https://www.gyan.dev/ffmpeg/builds/> → "release essentials" → unzip → add the `bin/` folder to your PATH ([how](https://www.architectryan.com/2018/03/17/add-to-the-path-on-windows-10/)).
3. Open **Command Prompt** and run:
   ```bat
   cd "C:\path\to\Powerful Weapon"
   npm install
   ```
4. Double-click **Open Powerful Weapon.bat**.

> **If `npm install` errors on Windows mentioning `better-sqlite3`**: install the [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (check the "Desktop development with C++" workload during install), then re-run `npm install`.

---

## Setting up Whisper (Tamil speech-to-text)

This is the engine that transcribes WhatsApp voice notes. It's free, runs offline. You do this once.

### Mac / Linux

```bash
cd "resources/whisper"

# 1. Get whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# 2. Build it (~2 minutes)
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j --config Release --target whisper-cli

# 3. Download the Tamil-capable model (~3 GB — slow but one-time)
curl -L -C - -o ../ggml-large-v3.bin \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"

cd ../../..
```

### Windows

1. Go to <https://github.com/ggerganov/whisper.cpp/releases>, download the latest **whisper-bin-x64.zip**, unzip it. Copy **whisper-cli.exe** into `resources\whisper\`.
2. Download the model from <https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin> (~3 GB), save it as `resources\whisper\ggml-large-v3.bin`.

### Verify

Restart the app. Open **Settings** → "Speech-to-Text" should say **✅ Whisper is set up and ready**.

> **Speed:** 30 seconds of audio takes ~30–60 seconds to transcribe on a typical Mac (Metal acceleration). Slower on plain CPU.
>
> **Bad connection?** The model download has `-C -` (resume). If it dies, re-run the same `curl` and it picks up where it left off.

---

## Loading the full Tamil Bible

The app ships with **17 sample verses** so you can try it immediately. To use the full Bible (~31,000 verses):

1. Get a Tamil OV (Old Version, 1956 — public domain) JSON. Three options:
   - **Easy:** download from <https://github.com/godlytalias/Bible-Database/tree/master/Tamil> or <https://github.com/openbible-io/tamil-bible>
   - **Manual:** create a JSON file in this shape:
     ```json
     [
       { "book": "ஆதியாகமம்", "chapter": 1, "verse": 1, "text_tamil": "ஆதியிலே..." },
       { "book": "ஆதியாகமம்", "chapter": 1, "verse": 2, "text_tamil": "..." }
     ]
     ```
   - **Other formats** (scrollmapper-style, nested books-chapters-verses) are auto-detected — see `scripts/build-bible-db.ts`.
2. Save the file as `resources/bible/tamil-ov-source.json`.
3. In a terminal here, run:
   ```bash
   npm run import:bible
   ```
4. Restart the app. The Dashboard will show "Full Bible loaded" with ~31,000 verses.

---

## 👵 Making this easy for your friend (non-technical)

For real use, you don't want her opening a terminal. Build a real installer once and hand her the file:

```bash
# Mac
npm run package:mac
# → release/Powerful Weapon-0.1.0-arm64.dmg

# Windows
npm run package:win
# → release/Powerful Weapon Setup 0.1.0.exe
```

Send her the `.dmg` or `.exe`. She:

1. Double-clicks the installer → installs like any normal app.
2. Drags **Powerful Weapon** to her Applications (Mac) — or Start Menu shows it automatically (Windows).
3. On Mac, drag the app icon to the Dock for one-click access.
4. On Windows, the installer creates a Desktop shortcut automatically.

After that, opening the app is just **one click on the icon** — no terminal, no commands, no thought required.

**Important before packaging:**
- Drop your `icon.png` (512×512 or larger PNG) into `resources/icons/`.
- Install Whisper *first* — the model gets bundled into the installer (the installer will be ~3.5 GB).
- Import the full Bible *first* — same reason.

> **First launch on her Mac:** she'll get the same "Apple can't verify" prompt. She does the same one-time "Open anyway" step in Privacy & Security. After that, the app opens normally.

---

## Daily use (once it's running)

### 🗓️ Monday — pick the week's verses

1. Open **Verse Picker**.
2. Type the Tamil root word (e.g. `கனம்`) and hit **Search**.
3. The app ranks verses by match quality; memory verses are boosted (⭐).
4. Tick 7 verses (the counter shows "X / 7 picked").
5. **Save week**.

You can come back and edit any day's selection at any time.

### ⏰ Every day at the scheduled time

The app builds a message in your friend's exact format:

```
இன்றைய ரேமா (வார்த்தை)
(DD-MM-YY)

*பிலிப்பியர் 4:13*
*என்னைப் பெலப்படுத்துகிற கிறிஸ்துவினாலே...*
```

At the set time, the app pops up showing the verse. She:
1. Clicks **Copy + Open WhatsApp** — message is copied to her clipboard; WhatsApp Web/Desktop opens.
2. Clicks the target group, pastes (Cmd+V / Ctrl+V), presses Enter.
3. Clicks **Mark as sent** back in the app.

**If the laptop was off**, on next launch the Dashboard shows a "waiting to send" banner and she can still send it (or skip).

Change the send time anytime in **Settings**.

### 🎙️ Sunday — grade voice notes

1. In WhatsApp Desktop, find each voice note → right-click → **Save as** → into any folder.
2. In the app, open **Voice Inbox**.
3. **Pick voice note files** and select them.
4. For each: choose the **speaker** from the dropdown + the **day**.
5. **Import + Grade** — file is transcribed (Tamil) and scored automatically.
6. Scores appear instantly: **Accuracy / 60 + Fluency / 25 + Reference / 15 = Total / 100**.

### 🏆 Leaderboards

- **Consistency** — ranks by how many weeks each person posted at least one voice note.
- **Weekly scores** — current week's recitations ranked.
- **Yearly scores** — running yearly average.

All three export to CSV for sharing.

---

## Backups (don't skip this)

The whole database is one file. **Set up backups in Settings**:

1. Pick a folder synced by Google Drive / iCloud / OneDrive / Dropbox.
2. Check **Auto-backup enabled** (default: every 7 days).
3. Click **Run backup now** once to confirm it works.

The app then drops timestamped `.db` files into that folder on schedule.

---

## Scoring rubric (out of 100)

| Component | Max | How it works |
|---|---|---|
| **Accuracy** | 60 | Best-window Tamil similarity (75%) + stemmed-token F1 (25%). Handles spacing variations and Whisper's minor transcription errors. |
| **Fluency** | 25 | Words-per-minute (target 80–160) + pause ratio + Whisper segment confidence. |
| **Reference** | 15 | Book name (7 pts) + chapter (4 pts) + verse (4 pts). Tamil numerals (`௧௦`), Arabic (`10`), and spoken Tamil words (`பத்து`) all accepted. |

> Realistic scores for a clean recitation: **75–90%**. Whisper's Tamil model has small character-level errors (கனம் ↔ கணம், ட்ச ↔ ச்ச) that cap how high you can go. The grading correctly distinguishes real recitations (~75%+) from reference-only or partial recitations (~20-40%).

---

## Project layout (for the curious)

| Folder | Purpose |
|---|---|
| `Open Powerful Weapon.command` / `.bat` | Double-clickable launchers |
| `electron/main.ts` | App entry — window + scheduler |
| `electron/preload.ts` | Safe bridge between UI and backend |
| `electron/lib/database.ts` | SQLite schema + first-run seeding |
| `electron/lib/tamil.ts` | Tamil normalization + lightweight stemmer |
| `electron/lib/fuzzy.ts` | Verse-ranking algorithm |
| `electron/lib/grading.ts` | 60 / 25 / 15 scoring |
| `electron/ipc/*.ts` | Backend handlers (verses, users, WhatsApp, scheduler, Whisper, backup) |
| `src/pages/*.tsx` | The six screens |
| `resources/bible/tamil-ov-sample.json` | 17 starter verses |
| `resources/whisper/` | Whisper binary + model (you download these) |
| `scripts/build-bible-db.ts` | Full Tamil OV importer |

---

## Troubleshooting

**"npm: command not found" when double-clicking the launcher (Mac)**
The launcher couldn't find Node.js. Open Terminal and run `which node`. If it's empty, Node isn't installed — `brew install node`. If it returns a path, your shell config sets PATH differently — open the `.command` file in a text editor and adjust the `export PATH=` line.

**The launcher window flashes and closes immediately (Windows)**
Right-click `Open Powerful Weapon.bat` → "Run as administrator" once. If that doesn't help, open Command Prompt manually, `cd` to this folder, and run `npm run dev` to see the actual error.

**Dashboard says "0 verses loaded"**
The sample didn't seed. Quit the app, delete the database file, and relaunch:
- Mac: `rm "$HOME/Library/Application Support/Powerful Weapon/powerful-weapon.db"`
- Windows: delete `%APPDATA%\Powerful Weapon\powerful-weapon.db`

**Whisper says "binary missing"**
Make sure the binary is named exactly `whisper-cli` (Mac/Linux) or `whisper-cli.exe` (Windows) and lives directly in `resources/whisper/` — not in a subfolder.

**Scheduled message didn't pop up**
The app must be running at that time. If the laptop was asleep/off, the next launch shows a "waiting to send" banner on the Dashboard. To change the time, **Settings → Send time**.

**Verse picker finds nothing**
The sample only has 17 verses. Import the full Tamil OV (see above).

**WhatsApp Web won't open from the app**
Make sure WhatsApp Web is logged-in once in your default browser. The app just opens the URL — it doesn't manage the login.

---

## License & data

- Application code: © 2026 Andrew Johnson. Personal/gift use only.
- Tamil OV Bible (1956 BSI revision): public domain.
- whisper.cpp: MIT license. Model weights: MIT.

No data ever leaves the computer. There are no accounts, no servers, no analytics.




Now if it ever happens again, just run:

npm run fix-dev