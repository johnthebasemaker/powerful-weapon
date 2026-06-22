# Powerful Weapon — Project Handoff

> **What this document is:** complete context for any developer (human or AI) picking up this project cold. Captures every decision, why it was made, current state, and what's left. Read this *first* before changing anything — many design choices look arbitrary but were deliberately settled.

> **Companion docs:**
> - `README.md` — developer reference (commands, layout, troubleshooting).
> - `usermanual.md` / generated PDF — end-user guide.
> - `.github/SETUP.md` — CI setup for first-time GitHub Actions use.

---

## 1. Context

### Who this is for

Andrew Johnson is building this as a **gift for a non-technical friend** in Tamil Nadu who runs a weekly Bible study group on WhatsApp. She is the *only* end user.

Important constraints from this fact:
- **One user, one machine.** No multi-user, no auth, no cloud sync. The whole DB is one SQLite file on her computer.
- **Zero technical knowledge.** Every action must be a click. No terminals, no config files, no JSON editing. If a step requires more than reading the user manual PDF, it's too complex.
- **$0 budget.** No paid APIs, no SaaS, no certificates, no Apple Developer ID. Everything is free-tier or self-hosted.
- **Mac or Windows desktop only.** Not iOS, not Android, not web. Mobile was explicitly ruled out because WhatsApp Web automation + local Whisper need a desktop.

### What she does, week by week

1. **Monday morning:** picks one Tamil root word (e.g., `கனம்` = "honor"), searches the Tamil Bible, picks 7 verses for the week.
2. **Monday → Sunday, every day at midnight IST:** the app shows the day's verse. She clicks → message is copied to clipboard → WhatsApp Web opens → she pastes into the group → sends → marks "sent" in app.
3. **Sunday or Monday morning:** group members send recitation voice notes. She saves them from WhatsApp Desktop, drops them into the app's Voice Inbox. The app transcribes and grades.
4. **Anytime:** views leaderboards (consistency, weekly scores, yearly scores). Exports to CSV when she wants to share.

The "Sunday or Monday morning" detail matters — the app's Voice Inbox **defaults to last week** when opened on Mon/Tue, since recitations typically come in over the weekend.

---

## 2. Design decisions (settled — don't relitigate without reason)

These were all explicitly confirmed by Andrew through clarifying questions. Each has a *why* attached so you can judge edge cases without rediscussing them.

### 2.1. Bible translation: Tamil OV (1956 BSI)

- **Source:** `https://github.com/godlytalias/Bible-Database/tree/master/Tamil/bible.json` (14 MB JSON).
- **Format:** positional `Book[].Chapter[].Verse[]` — book names *not* in the JSON, mapped by index to the 66-element canonical list embedded in `scripts/build-bible-db.ts` (`TAMIL_BOOKS_66`).
- **Why this source:** clean JSON, exact 31,102-verse Protestant canonical count, public domain.
- **Why OV not BSI New Version:** OV is unambiguously public-domain; BSI New Version is copyrighted. OV is also the translation Andrew's friend already uses.

### 2.2. WhatsApp posting: semi-automatic on personal number

- **Decided:** *not* full automation. App builds the message and opens WhatsApp Web — she pastes + sends manually.
- **Why:** full automation via `whatsapp-web.js` or Baileys risks ban on her personal number and is a ToS violation. WhatsApp's official Cloud API doesn't support sending to groups. Semi-auto on her personal number = zero ban risk, ~30 seconds of effort per day.
- **Implementation:** `electron/ipc/whatsapp.ts` builds the verse message in her group's exact format (`இன்றைய ரேமா...`), copies it via `clipboard.writeText`, and calls `shell.openExternal('https://web.whatsapp.com/')`.

### 2.3. Voice note ingestion: manual drag-drop, not automated WhatsApp scraping

- **Decided:** she saves voice notes from WhatsApp Desktop manually, then imports via file picker.
- **Why:** consistent with the no-WhatsApp-automation principle. ~5 minutes of weekly admin work, zero risk.
- **Speaker identification:** dropdown on import (because filenames don't contain sender info).

### 2.4. Speech-to-text: Whisper large-v3 local

- **Decided:** OpenAI Whisper via `whisper.cpp` running locally, `ggml-large-v3.bin` model (~3 GB).
- **Why:** best free Tamil quality; runs offline on any modern CPU. AI4Bharat / IndicWhisper considered but Whisper's tooling is more mature.
- **Performance:** ~30–90 seconds to transcribe each 30 seconds of audio on CPU (Apple Silicon uses Metal, faster).
- **Audio decode:** `whisper-cli` only reads WAV/MP3/OGG/FLAC. WhatsApp's `.opus` is transcoded to WAV via `ffmpeg` first (`electron/ipc/whisper.ts → transcodeToWav`).

### 2.5. Grading: 60/25/15

- **Decided rubric:** Accuracy /60 + Fluency /25 + Reference /15 = Total /100.
- **Why these weights:** Andrew's explicit choice. Accuracy dominates because it's what they actually grade; reference is a small bonus for full citation.
- **Algorithm details** (in `electron/lib/grading.ts`):
  - Accuracy: `60 × (0.75 × bestWindowSimilarity(transcript, reference) + 0.25 × stemmedTokenF1)`. Best-window matching slides a reference-length window across the transcript, returning the best Levenshtein similarity — handles greetings + verse + amen audio gracefully.
  - Fluency: blend of WPM (target 80–160), pause ratio (vs. 110 WPM expected), and Whisper segment confidence.
  - Reference: book (7 pts) + chapter (4 pts) + verse (4 pts), accepts Arabic, Tamil (`௧௨`), and Tamil-spoken-word (`பத்து`) numerals.
- **Realistic scores:** 75–90/100 for clean recitations. Whisper has small per-character errors (கனம்↔கணம், ட்ச↔ச்ச) that cap above 90.

### 2.6. Voice Inbox: "all 7 in one file" is the default mode

- **Decided:** the typical Sunday submission is ONE long voice note containing all 7 verses recited in sequence.
- **Why:** that's what her group actually does. The original "one note per day" pattern is supported too but as the secondary mode.
- **Implementation:** the all-week mode (`whisper:transcribeAndGradeWeek` in `electron/ipc/whisper.ts`) transcribes once and grades against all 7 weekly selections, inserting 7 voice_notes rows that share the same `file_path`. The Imported notes UI groups by `(user_id, week, file_path)` so the user sees one row per audio file with an expandable details panel.

### 2.7. Smart default for Voice Inbox week selector

- **Decided:** on Monday/Tuesday default to *previous* week; Wed–Sun default to current week.
- **Why:** uploads come in Sunday/Monday, so when she opens Voice Inbox on Mon/Tue she's processing last week's recordings.
- **Implementation:** `src/lib/dates.ts → defaultUploadWeek()`. Blue banner "You're processing last week's recordings" surfaces when on the previous week.

### 2.8. Strict 7/7 requirement before grading in all-week mode

- **Decided:** if fewer than 7 verses are saved for the chosen week, the **"Pick voice note files" button is disabled** and a red message appears.
- **Why:** silent failure before this was the cause of confusing low scores (only 1 verse was being graded but app didn't say so).

### 2.9. Duplicate detection

- **Decided:** before importing a voice note, check if a file with the same basename was already imported for the same user + week. If so, confirm "replace?".
- **Why:** common error during real use — she opens the file picker twice and re-imports the same .opus by accident.

### 2.10. Backups: user-chosen folder + auto-copy

- **Decided:** Settings has a "Backup folder" picker. App copies the SQLite DB into it every N days (default 7).
- **Why:** the database is a single point of failure. Pointing the backup folder at a Google Drive / iCloud sync directory gives offsite safety with zero extra effort.

### 2.11. Send-time scheduler

- **Decided:** configurable send time in IST. Default 00:00.
- **Why:** her group expects midnight delivery. Customizable in case she wants to be awake when the popup appears.
- **Implementation:** `node-cron` with `timezone: 'Asia/Kolkata'`. On app launch, `scheduler:checkMissed` returns any past slots from today with `posted_at IS NULL` so the Dashboard shows them as a "waiting to send" banner.

### 2.12. Whisper model: downloaded on first launch, not bundled

- **Decided:** the installer does NOT contain the 3 GB Whisper model. App downloads it on first launch.
- **Why:** GitHub Releases has a 2 GB per-asset cap, and NSIS embedded-payload is the same. Bundling the model made distribution impossible. First-launch download:
  - Drops Mac DMG from ~3 GB to ~200 MB.
  - Drops Windows installer from impossible-to-build to ~150 MB NSIS .exe with Start Menu + Desktop shortcuts.
  - Both fit GitHub Releases comfortably.
- **Implementation:** `electron/ipc/whisper.ts → downloadModel()` streams from Hugging Face into `userData/whisper/ggml-large-v3.bin` with progress events and `.part` resume support. Dashboard nudges via banner; Settings has full UI.
- **Trade-off accepted:** first-time users need internet for ~3 GB on first launch. Acceptable since they need internet to use WhatsApp anyway. After first launch, the app is fully offline.

### 2.13. Windows installer: NSIS .exe (one-click installer with shortcuts)

- **Decided:** real NSIS installer with Start Menu shortcut, Desktop shortcut, and Add/Remove Programs entry.
- **Why:** with the model no longer bundled (see 2.12), the installer fits under NSIS's 2 GB cap. No reason to use a zip.
- **User flow:** double-click .exe → install wizard → Start Menu icon appears → first launch downloads the model.

### 2.14. macOS distribution: unsigned DMG

- **Decided:** no Apple Developer ID ($99/yr). She accepts the one-time "Open Anyway" prompt in System Settings.
- **Why:** $0 budget. Trade-off accepted.

### 2.15. UI language: English only

- **Decided:** all UI strings in English.
- **Why:** her preference. Data and processing are still Tamil — only the UI chrome is English.

### 2.16. Year rollover

- **Decided:** January 1 resets leaderboards to zero. Historical data stays viewable via the year selector in Leaderboards.
- **Why:** matches the natural annual cycle the group runs on.

---

## 3. Architecture

### High level

```
┌─────────────────────────────────────────┐
│  Electron BrowserWindow                 │
│  ┌─────────────────────────────────┐    │
│  │  React renderer (src/)          │    │
│  │  Calls window.api.* for         │    │
│  │  everything (no Node.js access) │    │
│  └────────────┬────────────────────┘    │
│               │ contextBridge (preload) │
│  ┌────────────▼────────────────────┐    │
│  │  Electron main (electron/)      │    │
│  │  - IPC handlers                 │    │
│  │  - SQLite (better-sqlite3)      │    │
│  │  - node-cron scheduler          │    │
│  │  - Child process: whisper-cli   │    │
│  │  - Child process: ffmpeg        │    │
│  │  - shell.openExternal (WA Web)  │    │
│  │  - clipboard                    │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
       │                  │
       │                  └─── SQLite DB (~/Library/Application Support/...)
       │
       └─── Whisper model + binary + Tamil Bible (resources/whisper, resources/bible)
```

### IPC channel naming convention

`<domain>:<verb>`, e.g. `verses:search`, `whisper:transcribeAndGradeWeek`, `voiceNotes:deleteByFile`. All channels are registered in `electron/ipc/*.ts` and exposed via the preload's whitelist.

### Database schema (`electron/lib/database.ts`)

- `verses` — id, book, chapter, verse, text_tamil, text_normalized, is_memory_verse. ~31,102 rows.
- `weekly_selections` — week_start_date, slot (1–7), verse_id, posted_at, root_word.
- `users` — id, name, phone (UNIQUE), joined_date, active.
- `voice_notes` — id, user_id, week_start_date, verse_slot, file_path, transcript, accuracy_score, fluency_score, reference_score, total_score, duration_seconds, graded_at. One row per (user × week × slot) — "all-7" mode inserts 7 rows sharing the same `file_path`.
- `send_log` — scheduled_at, sent_at, status (queued/sent/skipped/failed), verse_id, week_start_date, slot.
- `settings` — key/value pairs (send_time, timezone, group_name, backup_folder, backup_enabled, backup_frequency_days).

### Tamil NLP (`electron/lib/tamil.ts`)

- **`normalizeTamil`**: NFC normalize, strip zero-width chars, strip Markdown asterisks (the user's source verses come with `*bold*` markers), strip punctuation, lowercase.
- **`stripSuffix`**: hand-crafted suffix list covering common Tamil verb endings, case markers, plurals. Two-pass to handle compound suffixes. Not a proper stemmer — works well enough for fuzzy verse search and stemmed-token F1 scoring.
- **`levenshtein` / `similarity`**: standard edit-distance, used by both the verse ranker and the grader's best-window matcher.

### Verse ranking (`electron/lib/fuzzy.ts`)

- For each verse, tokenize + stem + find best per-token similarity to the rooted query.
- Score = best similarity + bonus for multi-occurrence + 0.25 boost if memory-tagged.
- Returns top N (default 30). Threshold 0.6 — verses below are dropped.

### Grading (`electron/lib/grading.ts`)

The current implementation reflects a fix Andrew applied himself (visible in his edits to the file):

- **Accuracy**: best-window edit similarity dominates (0.75) over stemmed-token F1 (0.25). The best-window matcher slides a reference-length window over the transcript and returns the max Levenshtein similarity. Critical for "all-7 in one file" mode — finds each verse inside the longer audio.
- **Fluency**: WPM (peak 80–160) + pause ratio + Whisper segment confidence. Tunable weights inside the function.
- **Reference**: regex/substring match on book name tokens + chapter/verse numerals (Arabic, Tamil, spoken Tamil word forms).

---

## 4. Build & deploy

### Local development

`npm run dev` runs Vite (port 5173) + Electron concurrently. Hot reload works for the renderer; the main process needs `npm run dev` to be restarted to pick up changes.

### Local packaging

```bash
npm run package:mac    # → release/Powerful Weapon-0.1.0-arm64.dmg (also x64.dmg)
npm run package:win    # cross-compile from Mac — flaky, prefer CI
```

`electron-builder.yml` controls everything. `extraResources` bundles `resources/whisper/` and `resources/bible/` into the .app/.exe. `asarUnpack` keeps better-sqlite3 + whisper unpacked (they need real filesystem paths, not asar paths).

After a packaging run, the dev Electron is sometimes broken — run `npm run fix-dev` to repair.

### CI builds

`.github/workflows/build.yml` runs on every push to `main` and on `v*` tags. Two jobs in parallel:

- **build-mac** (`macos-14`, Apple Silicon): brew install cmake+ffmpeg, clone+build whisper.cpp, download model (cached), `npm install`, import Bible, `npm run package:mac`, upload `.dmg` artifacts.
- **build-windows** (`windows-latest`): download model (cached), download prebuilt `whisper-bin-x64.zip` from whisper.cpp releases pinned to `v1.7.6`, copy `whisper-cli.exe` + DLLs (only — not the 16 example .exes), `npm install`, import Bible, `npm run package:win`, upload `.zip` artifacts.

A third `release` job runs only on tag pushes and publishes both artifacts to a GitHub Release.

Key environment:
- `env.GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` at workflow level — electron-builder requires it even when `--publish never` is set.
- `--publish never` flag on `package:mac`/`package:win` scripts to prevent the build job from trying to push to Releases.

Cache key for the model: `whisper-model-ggml-large-v3[-windows]-v1`. Bump the version suffix if a different model is needed.

---

## 5. Current state (as of latest commit)

### What works end-to-end

- ✅ Full Tamil OV Bible loaded (31,102 verses).
- ✅ Verse picker with fuzzy match + memory verse tagging.
- ✅ User management with CSV bulk import.
- ✅ Daily scheduler in IST with queue-on-wake.
- ✅ Semi-automatic WhatsApp posting (build message → clipboard → open web).
- ✅ Whisper transcription of `.opus` voice notes (with ffmpeg transcode).
- ✅ All-7-verses grading mode with grouped collapsed view.
- ✅ Per-day grading mode.
- ✅ Smart default week (Mon/Tue → previous, Wed–Sun → current).
- ✅ X/7 selections badge + import-blocker if not 7/7.
- ✅ Duplicate file detection on import.
- ✅ Delete one + clear all this week.
- ✅ Consistency / weekly / yearly leaderboards with CSV export.
- ✅ Automatic backups to user-chosen folder.
- ✅ macOS DMG build (signed=no, but works after one-time Privacy & Security override).
- ✅ Windows NSIS .exe installer with Start Menu + Desktop shortcuts.
- ✅ First-launch model download with progress + resume.
- ✅ CI builds both platforms on every push.
- ✅ Generated PDF user manual.

### Known rough edges

- ⚠️ **First launch needs internet for ~3 GB.** Model is downloaded on first run from Hugging Face. UI is friendly (progress bar, resume support) but users without good internet will struggle. After first launch, the app is fully offline.
- ⚠️ **No code signing.** Both Mac and Windows show a one-time security warning. Documented in the user manual. Fix would cost $99/yr (Apple) + $200/yr (Windows) — out of scope.
- ⚠️ **Whisper Tamil character errors.** `large-v3` makes small character-level mistakes (கனம் ↔ கணம், ட்ச ↔ ச்ச). The grading's best-window matcher compensates; scores cap around 90% for clean recitations.
- ⚠️ **Single-user assumption.** No way to merge databases across machines. If she ever wanted help from someone else, they'd need to handoff the SQLite file.
- ⚠️ **Tamil OV import is godlytalias-specific.** Other Tamil Bible sources need a new adapter in `scripts/build-bible-db.ts`.

### Open work (not done, ranked by value)

1. **App icon** (low effort, visible polish). Drop a 1024×1024 `icon.png` into `resources/icons/` and re-build. Both Mac and Windows builds will pick it up automatically.

2. **Tag a fresh release after the first-launch-download change lands** (5 min). `git tag v0.1.1 && git push origin v0.1.1`. CI's `release` job will create a permanent download page. Installers will be ~200 MB each — well under the 2 GB cap.

3. **Real download links in the user manual** (immediate next step after #2). Replace `[PASTE DOWNLOAD LINK HERE]` in `usermanual.md` with actual GitHub Release URLs, then re-run `python3 make_manual_pdf.py`.

4. **Replace placeholders for screenshots in usermanual.md** (medium effort). The current PDF describes UI in text. Adding screenshots would make it easier for the friend. Take screenshots, add them to `resources/manual/`, reference from the markdown.

5. **Code signing** (cost: $99/yr Apple + ~$200/yr Windows). Would remove the one-time security warnings. Out of scope for personal-gift project.

---

## 6. Important files map

If you only need to know where things live:

| Concept | File |
|---|---|
| Schedule a daily send | `electron/ipc/scheduler.ts` |
| Build the WhatsApp message | `electron/ipc/whatsapp.ts → formatVerseMessage` |
| Tamil text normalization | `electron/lib/tamil.ts` |
| Verse search ranking | `electron/lib/fuzzy.ts` |
| Grading formula | `electron/lib/grading.ts` |
| Whisper invocation | `electron/ipc/whisper.ts → runWhisper` |
| DB schema | `electron/lib/database.ts` |
| Bible import adapter (5 formats) | `scripts/build-bible-db.ts → adapt()` |
| Voice Inbox UI logic | `src/pages/VoiceInbox.tsx` |
| Verse Picker UI | `src/pages/VersePicker.tsx` |
| Smart default week | `src/lib/dates.ts → defaultUploadWeek` |
| CI build | `.github/workflows/build.yml` |
| Installer config | `electron-builder.yml` |
| End-user docs | `usermanual.md` + `make_manual_pdf.py` |

---

## 7. Constraints — please do not change without checking

- **English UI**, Tamil data. (User asked.)
- **Tamil OV translation**, not BSI New. (Copyright + user preference.)
- **Single admin**, no auth. (User asked.)
- **Local-only**, no cloud. (User asked.)
- **$0 budget.** No paid services. (User asked.)
- **Semi-automatic WhatsApp**, no automation. (Ban-risk + ToS + user asked.)
- **Manual voice-note ingestion**, no WhatsApp scraping. (Same.)
- **Whisper large-v3**, not medium. (User asked; quality matters.)
- **60/25/15 grading weights.** (User asked.)
- **Mon/Tue smart-default to previous week.** (Matches her workflow.)
- **All-7-in-one-file as default Voice Inbox mode.** (That's what her group does.)
- **No screenshots in source-controlled docs** *unless added explicitly.* The PDF generator just renders text descriptions.

---

## 8. How to verify the system end-to-end (manual smoke test)

1. `npm run dev` — Electron window opens.
2. Dashboard shows "Bible verses: 31,102" (if not, run `npm run import:bible`).
3. Verse Picker → search `கனம்` → 7 verses appear with high match scores → tick 7 → Save week.
4. Dashboard now shows "7 / 7" for "This week's selections".
5. Users → add at least one user (name + phone).
6. Voice Inbox → mode = "All 7 verses in one file" → status bar shows green "7/7 verses saved".
7. Pick the sample voice note in `Sample Verses and Voice Note/`.
8. Select user, click Import + Grade. Wait ~60 s.
9. Green panel appears with 7 per-verse scores + weekly average.
10. Imported notes table shows ONE collapsed row → View details → 7 per-verse scores + transcript visible.
11. Leaderboards → all three tabs show the user with non-zero values.
12. Settings → set a backup folder → Run backup now → confirm `.db` file appears in that folder.

If any step fails, check `electron/ipc/*.ts` corresponding handler and the renderer page that uses it. Most failures are stale `dist-electron/` builds — `npm run dev` rebuilds.

---

## 9. Git + GitHub state

- Repo: `https://github.com/johnthebasemaker/powerful-weapon` (johnthebasemaker is Andrew's GitHub username).
- Branch: `main`.
- Commits so far: initial commit + CI fixes + Windows .zip switch + this doc batch.
- CI: builds Mac DMG + Windows zip on every push. Latest run as of writing: Mac green, Windows green (after the NSIS → zip switch).
- No tags pushed yet. `v0.1.0` tag would trigger a GitHub Release.

To pick up where things stand: clone, run *Quick start* in README.md, then re-trigger the workflow if needed.

---

*Last updated by Claude during the project build session. Edit liberally — this file is for whoever picks up next.*
