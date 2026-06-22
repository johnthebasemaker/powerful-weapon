# Powerful Weapon

A desktop app for running a weekly Tamil Bible study group on WhatsApp.

- **Pick** 7 Tamil verses for the week from a single root word (fuzzy match across 31,000 verses of the Tamil OV).
- **Send** the daily verse to a WhatsApp group at a chosen time (semi-automatic: app builds the message, copies it to your clipboard, opens WhatsApp Web — one paste and one click to send).
- **Grade** Sunday voice notes by transcribing Tamil audio locally with Whisper and scoring out of 100 (accuracy, fluency, reference citation).
- **Rank** group members on consistency, weekly, and yearly leaderboards.

Built so **one non-technical user** can run it on their desktop. Everything runs locally — no cloud, no monthly fees, no accounts.

> **Looking for the end-user guide?** That's `usermanual.md` (or the generated PDF). This README is for developers and builders.

> **Coming back to this project cold?** Read `handoff.md` first — it captures every design decision and the current state.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Electron 32 + electron-builder | One-click installers, mature ecosystem |
| UI | React 18 + Vite 5 + TypeScript 5 + Tailwind 3 | Fast, simple, hot reload |
| Local DB | better-sqlite3 v12 | Sync API, single file, zero setup |
| Scheduler | node-cron (IST) + catch-up on launch | Works even if laptop sleeps |
| Tamil NLP | Custom normalizer + suffix-stripper + Levenshtein | All in TypeScript, no native deps |
| Speech-to-text | whisper.cpp + `ggml-large-v3` model | Free, offline, runs on CPU |
| Packaging | electron-builder (DMG on Mac, NSIS .exe on Windows) | Model downloaded on first launch (see [Why first-launch download](#why-first-launch-model-download)) |
| CI | GitHub Actions | Builds Mac + Windows installers on every push |

---

## Quick start (developer)

You need: **Node.js 22+**, **Homebrew (Mac) / standard tools (Windows)**, **5 GB free disk**.

```bash
# 1. System tools (Mac)
brew install node ffmpeg cmake pango

# 2. Project deps
npm install

# 3. Whisper engine (one-time, ~3 GB)
cd resources/whisper
git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j --config Release --target whisper-cli
curl -L -C - -o ../ggml-large-v3.bin \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"
cd ../../..

# 4. Full Tamil Bible (one-time)
curl -L -o resources/bible/tamil-ov-source.json \
  "https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Tamil/bible.json"
npm run import:bible

# 5. Run
npm run dev
```

Two windows appear:
- A small terminal with Vite + Electron logs.
- The "Powerful Weapon" app window.

`localhost:5173` in a browser will show a **blank page** — that's expected. The React app only works when loaded inside the Electron window (which provides the `window.api` bridge).

---

## Project layout

```
Powerful Weapon/
├── README.md                ← This file (developer reference)
├── handoff.md               ← Context for cold-start sessions
├── usermanual.md            ← End-user guide (source)
├── make_manual_pdf.py       ← Converts usermanual.md → polished PDF
│
├── package.json             ← npm scripts + deps
├── tsconfig.json            ← Root TS config
├── vite.config.ts           ← Vite renderer config
├── electron-builder.yml     ← Installer config
├── tailwind.config.js, postcss.config.js
├── index.html               ← Vite entry
│
├── .github/
│   ├── workflows/build.yml  ← CI: builds Mac DMG + Windows zip on every push
│   └── SETUP.md             ← One-time GitHub Actions setup guide
│
├── electron/                ← Main process (Node side)
│   ├── main.ts              ← Entry — window + scheduler boot
│   ├── preload.ts           ← Safe IPC bridge to renderer
│   ├── tsconfig.json
│   ├── lib/
│   │   ├── database.ts      ← SQLite schema + first-run Bible seeding
│   │   ├── paths.ts         ← User-data / bundled-resource paths
│   │   ├── tamil.ts         ← Normalize + suffix-stripper + Levenshtein
│   │   ├── fuzzy.ts         ← Verse-ranking algorithm
│   │   └── grading.ts       ← 60/25/15 scoring with best-window matching
│   └── ipc/
│       ├── db.ts            ← Verses, selections, users, voice notes, leaderboards
│       ├── whatsapp.ts      ← Message builder + clipboard + open-web
│       ├── scheduler.ts     ← node-cron (Asia/Kolkata) + queue-on-wake
│       ├── whisper.ts       ← whisper-cli child process + ffmpeg transcode
│       ├── backup.ts        ← Folder picker + DB copy + auto-backup
│       └── files.ts         ← Voice-note + CSV file dialogs
│
├── src/                     ← Renderer (React side)
│   ├── main.tsx, App.tsx, index.css, types.ts
│   ├── components/Layout.tsx       ← Sidebar + main pane
│   ├── lib/
│   │   ├── dates.ts                ← Week math, smart upload-week default
│   │   └── csv.ts                  ← Users CSV parser
│   └── pages/
│       ├── Dashboard.tsx           ← Status cards + send queue + week schedule
│       ├── VersePicker.tsx         ← Search + 7-pick + memory-tag
│       ├── Users.tsx               ← Add/edit + CSV import
│       ├── VoiceInbox.tsx          ← All-7 or per-day grading + grouped view
│       ├── Leaderboards.tsx        ← Consistency + weekly + yearly + CSV export
│       └── Settings.tsx            ← Send time, group, backup folder, Whisper
│
├── resources/
│   ├── bible/
│   │   ├── tamil-ov-sample.json    ← 17 starter verses (committed)
│   │   ├── tamil-ov-source.json    ← Full Bible source (gitignored, downloaded)
│   │   └── tamil-ov.json           ← Imported full Bible (gitignored, generated)
│   ├── whisper/
│   │   ├── README.txt              ← Reminder where to drop binary + model
│   │   ├── whisper.cpp/            ← Cloned + built (gitignored)
│   │   ├── ggml-large-v3.bin       ← Model (gitignored, ~3 GB)
│   │   ├── whisper-cli[.exe]       ← Binary in flat layout for Windows (gitignored)
│   │   └── *.dll, *.dylib          ← Native libs (gitignored)
│   └── icons/
│       └── icon.png                ← Drop your icon here (gitignored)
│
└── scripts/
    └── build-bible-db.ts           ← Tamil OV importer (5 input formats)
```

---

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Vite + Electron in dev mode with hot reload. |
| `npm run build` | Compile renderer (vite) + main (tsc). |
| `npm run package:mac` | Build `release/Powerful Weapon-0.1.0[-arm64].dmg`. |
| `npm run package:win` | Build `release/Powerful Weapon-0.1.0-win.zip` (portable). |
| `npm run import:bible` | Convert `resources/bible/tamil-ov-source.json` → `tamil-ov.json`. |
| `npm run fix-dev` | Reinstall Electron — needed after a packaging run breaks the dev binary. |
| `npm run rebuild` | `electron-rebuild` for native modules. |

---

## Building installers

### Local builds

```bash
npm run package:mac    # → release/Powerful Weapon-0.1.1-arm64.dmg (~123 MB) + .dmg (~127 MB, Intel)
npm run package:win    # → release/Powerful Weapon Setup 0.1.1.exe (~84 MB)
```

Installers are small because the **3 GB Whisper model is not bundled** — the app downloads it on first launch (into the user's `userData` folder).

Latest release: <https://github.com/johnthebasemaker/powerful-weapon/releases/latest>

Mac builds need Apple Silicon native deps. Windows builds *cross-compile* from Mac via Wine — flaky, not recommended. Use CI instead.

### CI builds (recommended)

Every push to `main` triggers `.github/workflows/build.yml` which builds both platforms in parallel on GitHub's free runners. ~15 min cold, ~10 min warm (cached Whisper model).

```bash
# Push to trigger
git push

# Or push a version tag to also publish a GitHub Release
git tag v0.1.1
git push origin v0.1.1
```

Artifacts download from the Actions tab → run → Artifacts section.

Full setup guide in `.github/SETUP.md`.

#### Why first-launch model download

NSIS's installer embeds the app payload as a 32-bit-mmapped 7z, hard-capped at ~2 GB. GitHub Releases enforces the same 2 GB-per-asset limit. The Whisper `large-v3` model alone is 2.9 GB, so a single bundled installer is structurally impossible.

Solution: ship installers *without* the model. Mac DMG ~200 MB, Windows .exe ~150 MB. On first launch, the app downloads the model from Hugging Face directly into the user's `userData/whisper/` folder with a friendly progress UI (Settings → Speech-to-Text → Download). Resume support handles flaky connections. After first launch, the app is fully offline.

---

## User manual

`usermanual.md` is the end-user-facing guide (written for a non-technical Tamil-speaking Bible study admin). Convert it to a polished PDF with:

```bash
python3 make_manual_pdf.py
```

First run installs `markdown` + `weasyprint`. On Apple Silicon, also needs `brew install pango` (the script auto-sets `DYLD_FALLBACK_LIBRARY_PATH` to find Homebrew libs).

Output: `Powerful Weapon - User Manual.pdf` (~2 MB, cover page + TOC + 6 sections + FAQ).

Edit `usermanual.md`, re-run the script, send the PDF to the user. The download links inside the manual are placeholders — replace them with your hosted URLs (Google Drive, GitHub Releases, etc.).

---

## Scoring rubric (out of 100)

| Component | Max | How |
|---|---|---|
| **Accuracy** | 60 | `60 × (0.75 × best-window edit similarity + 0.25 × stemmed-token F1)` between transcript and reference. The best-window matcher finds the verse inside longer audio (e.g., greetings + reference + verse + amen). |
| **Fluency** | 25 | `25 × (0.5 × WPM score + 0.25 × pause score + 0.25 × confidence)`. WPM target band 80–160. |
| **Reference** | 15 | Book name (7) + chapter (4) + verse (4). Accepts Arabic, Tamil (`௧௨`), and Tamil-spoken numerals (`பத்து`). |

Real-world realistic scores: **75–90 / 100** for a clean recitation. Whisper's Tamil model has small per-character errors that cap scores below 100. The grading correctly distinguishes real recitations (~75 %+) from reference-only or partial recitations (~20–40 %).

Tune in `electron/lib/grading.ts`.

---

## Database

Single SQLite file at:

- Mac: `~/Library/Application Support/Powerful Weapon/powerful-weapon.db`
- Windows: `%APPDATA%\Powerful Weapon\powerful-weapon.db`

Schema in `electron/lib/database.ts`. On first launch, the app seeds verses from `resources/bible/tamil-ov.json` if present, otherwise the 17-verse sample.

Auto-backup writes timestamped copies into a user-chosen folder (Google Drive / iCloud / OneDrive for safety) on a configurable interval (default 7 days).

---

## Troubleshooting

**App says "Whisper not installed"** — `resources/whisper/whisper-cli` (Mac) or `resources/whisper/whisper-cli.exe` (Windows) is missing, or the model `ggml-large-v3.bin` is missing. See *Quick start*.

**Verse count is 17** — full Bible not imported. Run `npm run import:bible`.

**`npm run dev` fails with "Electron failed to install correctly"** — a previous `npm run package:mac` broke the dev Electron install. Run `npm run fix-dev`.

**Cross-compiling Windows from Mac fails** — use GitHub Actions instead. Local Mac → Windows cross-compile via Wine is unreliable.

**WhatsApp Web doesn't open** — make sure you've logged into web.whatsapp.com once in your default browser. The app uses `shell.openExternal` to open the URL.

**Scheduled message didn't appear** — app must be running. On next launch, the Dashboard shows a "waiting to send" amber banner with the missed message.

**Whisper transcription is slow / poor quality** — `large-v3` is slow on CPU (~1 min per 30 s of audio). Quality is good for Tamil but has small character-level errors. The scoring algorithm accounts for this via best-window matching.

---

## License

- Code: © 2026 Andrew Johnson. Personal/gift use.
- Tamil OV Bible (1956 BSI revision): public domain.
- whisper.cpp: MIT (Georgi Gerganov). Model weights: MIT (OpenAI).

No data leaves the computer. No accounts. No analytics. No servers.
