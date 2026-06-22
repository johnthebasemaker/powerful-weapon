# Powerful Weapon

## User Manual

**Version 0.1.0 · For weekly Tamil Bible study groups**

---

## What is Powerful Weapon?

Powerful Weapon is a small desktop app that helps you run a weekly Bible study group on WhatsApp. It does three things for you, all in one place:

1. **Picks 7 Tamil Bible verses** for the week from a single root word, with smart suggestions.
2. **Builds the daily WhatsApp message** for you. Every day at the time you choose, the app pops up, copies the verse to your clipboard, and opens WhatsApp. You just paste into the group and press Enter.
3. **Grades voice notes**. When group members send their recitations, you drop the audio files into the app and it scores each one out of 100 — for accuracy, fluency, and whether they said the reference correctly.

Everything runs on your computer. There are no monthly fees, no accounts to create, and nothing is uploaded anywhere. The whole app and its database live on your computer.

---

## Before you start

You need **one** of these two computers:

- A **Mac** (any model from the last 5 years)
- A **Windows PC** (Windows 10 or 11)

And:

- An **internet connection** (only needed to download the app once and to send WhatsApp messages)
- **WhatsApp Web** working in your browser (visit web.whatsapp.com once and scan the QR code from your phone)
- About **5 GB of free disk space** (most of it is the Tamil speech-recognition engine, which is included)

---

## Part 1 — Installing the app

### On a Mac

> **Download:** _[PASTE DOWNLOAD LINK HERE]_

1. Download the file `Powerful Weapon-0.1.0-arm64.dmg` (or `Powerful Weapon-0.1.0.dmg` if you have an older Intel-based Mac).
2. Double-click the `.dmg` file. A small window opens showing the **Powerful Weapon** icon next to an **Applications** folder.
3. **Drag the Powerful Weapon icon onto the Applications folder.** This installs the app.
4. Open Finder → Applications → double-click **Powerful Weapon**.

**The first time you open it**, macOS shows this warning:

> "Powerful Weapon" cannot be opened because Apple cannot check it for malicious software.

This is normal — it happens because the app was built for you personally and not sold through the Mac App Store. To fix it:

1. Click **OK** on the warning.
2. Open **System Settings** (the gear icon).
3. Click **Privacy & Security** in the left list.
4. Scroll down. You'll see a message: *"Powerful Weapon was blocked to protect your Mac."* Click **Open Anyway** next to it.
5. Confirm by clicking **Open** in the next dialog.

**You only do this once.** After this first time, double-clicking the icon opens the app immediately.

**Optional:** drag the Powerful Weapon icon from Applications onto your Dock so you can open it with one click forever.

---

### On a Windows PC

> **Download:** (https://github.com/johnthebasemaker/powerful-weapon/actions/runs/27950557358/artifacts/7791566374)

1. Download the file `Powerful Weapon-0.1.0-win.zip`.
2. Find the downloaded zip in your Downloads folder.
3. **Right-click** the zip → **Extract All...** → choose a folder you'll remember (for example, `C:\Powerful Weapon`).
4. Open the folder you extracted to. You'll see a file called **Powerful Weapon.exe**.
5. **Double-click Powerful Weapon.exe** to open the app.

**The first time you open it**, Windows shows this warning:

> Windows protected your PC. Microsoft Defender SmartScreen prevented an unrecognized app from starting.

This is normal — it happens because the app was built for you personally. To fix it:

1. Click **More info**.
2. Click **Run anyway**.

**You only do this once.** After this, double-clicking opens the app immediately.

**Recommended:** right-click `Powerful Weapon.exe` → **Send to → Desktop (create shortcut)**. Now you can open the app from your Desktop with one click forever.

---

## Part 2 — A tour of the app

When you open Powerful Weapon, you'll see a sidebar on the left with six tabs, and a main area on the right that changes based on which tab is selected.

### Sidebar overview

| Icon | Tab | When you use it |
|---|---|---|
| 🏠 | Dashboard | First thing you see every day — overview of the week. |
| 📖 | Verse Picker | Every Monday morning — pick the 7 verses for the week. |
| 👥 | Users | When members join or leave the group. |
| 🎙️ | Voice Inbox | Every Sunday — drop in voice notes and grade them. |
| 🏆 | Leaderboards | Anytime — see who's most consistent and accurate. |
| ⚙️ | Settings | Once at the start, then rarely — change send time, set up backups. |

---

### Tab 1 — Dashboard 🏠

This is the home screen. It shows you everything important at a glance.

**At the top** you'll see three cards:

- **Bible verses** — how many verses are loaded (should be around 31,000 once the full Tamil Bible is loaded).
- **This week's selections** — how many of the 7 daily verses you've picked. Goes from 0/7 to 7/7.
- **Whisper STT** — whether the speech-to-text engine is ready. Should say "Ready".

**Below that**, if there's a message waiting to be sent (because the scheduled time arrived), you'll see an **amber-coloured banner** showing the verse. Two buttons next to it:

- **Copy + Open WhatsApp** — copies the message and opens WhatsApp Web. You paste into the group.
- **Mark as sent** — click this *after* you've pasted and sent.

**At the bottom**, you see the **week schedule** — a list of all 7 days of the current week, which verse is assigned to each, and a green "Sent" tag once you mark a day as sent.

> 💡 **Tip:** if your laptop was closed when the send time arrived, the message waits for you. As soon as you open the app, the amber banner appears.

---

### Tab 2 — Verse Picker 📖

This is where you choose the 7 verses for the week. Use it **every Monday morning**.

**Step by step:**

1. Make sure the **Week starting** date (top right) is set to the correct Monday.
2. In the search box, type one Tamil root word. For example: `கனம்` (honor).
3. Click **Search**.
4. The app finds every verse in the Tamil Bible containing that word or a variation of it (கனம், கனப்பண்ணுங்கள், கனப்பண்ணி, etc.) and ranks them from best match to worst.
5. **Tick the boxes** next to the 7 verses you want for the week. The counter at top shows "0 / 7 picked", "1 / 7 picked", etc.
6. Once you have **7 / 7 picked**, click the green **Save week** button.

**Memory verses** are marked with a yellow star (⭐). Tap the star next to any verse to mark it as a memory verse — these get boosted in future searches.

> 💡 **To change a week later**, come back to this tab, pick the right week date, and you can:
> - Click **Clear all** to start over.
> - Or search a new root word and pick 7 fresh verses.

---

### Tab 3 — Users 👥

Manage the people in your WhatsApp group here.

**To add one person:**

1. Type their **Name** and **Phone** (with country code, e.g. `+916369719235`).
2. Pick the date they joined.
3. Click **Add**.

**To add many people at once (CSV import):**

1. Open a spreadsheet program (Excel, Google Sheets, Numbers).
2. Create three columns: `name`, `phone`, `joined_date`.
3. Save as CSV.
4. In the app, click **Import CSV** (top right).
5. Pick your file. The app imports everyone in one go.

**Each row in the table** shows the user's status:

- **Active** (green) — counts in leaderboards and can submit voice notes.
- **Inactive** (gray) — historical data is kept but they don't appear in the current leaderboard.

Click the status badge to toggle it. Click **Remove** to delete a user (their old voice notes stay in the history).

---

### Tab 4 — Voice Inbox 🎙️

This is where you process voice notes every Sunday (or early Monday next week).

**Important first:** the app shows you "X / 7 verses saved" near the top right. **This must say 7 / 7 before you can grade voice notes** — because grading needs all 7 reference verses.

#### The two grading modes

At the top there's a **Grading mode** panel with two big buttons:

**🅰️ All 7 verses in one file** *(default — most common)*
- Use this when members send **one long voice note** that contains all 7 verses recited in sequence (typical Sunday submission).
- The app transcribes it once and grades it against each of the 7 verses — you get 7 scores plus a weekly average.

**🅱️ One voice note per day**
- Use this when members send **7 short voice notes** through the week, one per day.
- You import each file and pick which day it's for.

#### How to import and grade

1. Click **Pick voice note files**. A file picker opens.
2. Find the WhatsApp voice notes (usually they download to your Downloads folder when you save them from WhatsApp).
3. Select one or many — click **Open**.
4. Below the picker, choose the **Speaker** (the person who recorded it) from the dropdown.
5. *(Only in mode B)* Choose the **Day / Verse** from the dropdown.
6. Click the green **Import + Grade** button.
7. Wait — Whisper transcribes the audio. For a 60-second voice note, this takes about 30–90 seconds.
8. A **green panel appears** showing the scores.

#### Reading the scores

Each voice note gets four numbers:

| Score | Out of | What it measures |
|---|---|---|
| **Accuracy** | 60 | Did they say the verse correctly? Whisper transcribes the speech, then compares it word-by-word to the real verse. |
| **Fluency** | 25 | Did they speak smoothly? Based on speaking speed (target: 80–160 words per minute) and how clear the recording sounds. |
| **Reference** | 15 | Did they say the book name, chapter, and verse number? E.g. "ரோமர் பன்னிரண்டு பத்து". |
| **Total** | 100 | All three added together. |

**Realistic scores:** A clean, careful recitation usually scores **75–90 out of 100**. Whisper has small Tamil transcription errors that cap scores below 100. Lower scores (40–60) usually mean the recording was rushed, the wrong verse was recited, or the reference wasn't said.

#### Managing imported notes

Below the import area, the **Imported notes** table shows one row per voice note. Each row has:

- **User** name
- **File** name (the original WhatsApp filename)
- **Verses graded** (green chip if 7/7)
- **Avg score** out of 100
- **View details** — click to expand and see the per-verse scores + transcript.
- **Remove** — click to delete this voice note's grades (with confirmation).

At the top right of this section: **Clear all this week** removes every voice note for the current week (with confirmation).

> 💡 **Tip:** the file name is shown so you can spot duplicates. If you accidentally import the same voice note twice, the app warns you and asks to replace.

#### Late uploads

It's normal for members to send their Sunday voice notes on **Monday morning**. The app knows this — when you open Voice Inbox on Monday or Tuesday, it automatically selects **last week** as the active week. A blue banner tells you: *"You're processing last week's recordings."*

To process the current week instead, use the **Next →** button or click the date picker.

---

### Tab 5 — Leaderboards 🏆

Three rankings, switchable by tabs at the top:

**Consistency** — who shows up most often? Ranks members by *how many weeks of the year* they sent at least one voice note. This is the best measure of dedication.

**Weekly scores** — who recited best *this week*? Ranks by average score for the currently selected week.

**Yearly scores** — who's the strongest reciter *across the whole year*? Average of all their graded voice notes from January to December.

The top 3 in each tab get medal emojis (🥇 🥈 🥉) and a soft yellow highlight.

**Export to CSV:** the **Export CSV** button (top right) downloads the current view as a spreadsheet you can share or print.

**Change the year:** use the year box (top right) to view past years' rankings.

> 💡 **Yearly rollover:** on January 1st, the leaderboards reset to zero. The history isn't lost — switch the year to the previous year to see it.

---

### Tab 6 — Settings ⚙️

Set up once, rarely change.

**Daily send schedule**
- **Send time (IST)**: what time of day the app shows you the daily verse popup. Default is `00:00` (midnight IST). Change to whatever works for your group.
- **WhatsApp group name**: just a label, used in messages and the dashboard.

**Automatic backups**
- **Backup folder**: pick a folder synced by Google Drive, iCloud, OneDrive, or Dropbox. The app will automatically save a copy of its database into that folder every 7 days.
- **Frequency (days)**: how often the backup runs. Default: 7 days.
- **Run backup now**: do a backup immediately.
- **Auto-backup enabled**: turn the schedule on/off.

> ⚠️ **Strongly recommended:** turn on auto-backup. The database file contains your entire year of work. If your computer ever crashes, the backup folder is your only way to get it back.

**Speech-to-Text (Whisper)**
- Shows whether Whisper is set up. If it says **✅ Ready**, you're good. If it says something else, the auto-grading won't work — voice notes can still be imported but you'll have to grade them manually.

**Bible database**
- Shows how many verses are loaded. Should be around 31,000.

After changing settings, click **Apply schedule** at the bottom to save.

---

## Part 3 — The weekly rhythm

Here's what a typical week looks like:

### Monday morning (5 minutes)

1. Open the app.
2. Go to **Verse Picker**.
3. Search a Tamil root word (e.g. `கனம்`, `அன்பு`, `விசுவாசம்`).
4. Tick 7 verses.
5. Click **Save week**.

You're done for the week's planning. The app will handle posting from here.

### Every day, automatically

At the time you set in Settings, the app pops up showing today's verse. You:

1. Click **Copy + Open WhatsApp**.
2. WhatsApp Web opens.
3. Click on your group.
4. Paste (Cmd+V on Mac, Ctrl+V on Windows).
5. Press Enter.
6. Come back to the app → click **Mark as sent**.

Total time: about 30 seconds per day.

### Sunday evening or Monday morning (15 minutes)

1. Save all voice notes from WhatsApp into a folder on your computer. (In WhatsApp Desktop, right-click each voice note → Save as.)
2. Open the app → **Voice Inbox**.
3. Make sure mode is set to **"All 7 verses in one file"** (default).
4. Click **Pick voice note files** → select all voice notes.
5. For each file: pick the speaker → click **Import + Grade**.
6. Wait for grading (about 1–2 minutes per voice note).
7. Done.

### Anytime — celebrate

Go to **Leaderboards** to see how everyone is doing. Export to CSV at the end of each month if you want to share the rankings.

---

## Part 4 — Tips and recommendations

**Pick verses with related words.** The fuzzy search looks for word variations automatically. If you search `அன்பு` (love), you'll get verses with `அன்புகூருங்கள்`, `அன்பானவர்`, etc. all ranked.

**Star your favourite verses.** When you find a verse you'd want to use again as a memory verse, tap the star. Future searches will boost it to the top.

**Save voice notes with the person's name.** WhatsApp names files like "WhatsApp Audio 2026-06-22 at 19.30.45.opus". If you rename them to "Johnson 2026-06-22.opus" before importing, you can match speakers faster.

**Set the send time to when you're awake.** Default is midnight, but if you'd rather be in front of the computer when the popup appears, set it to 7:00 AM or whatever suits you.

**Back up to Google Drive.** In Settings, point the backup folder at your "Google Drive" folder (or iCloud Drive). Now your data is safe even if your laptop is lost.

---

## Part 5 — Troubleshooting

**The app doesn't open after I double-click.**
On macOS first launch only: see *Part 1 → On a Mac → first launch* above. On Windows: see *Part 1 → On a Windows PC → first launch*.

**The scheduled message didn't pop up.**
The app must be running at the scheduled time. If your computer was off or asleep, the message waits — open the app and you'll see an amber banner with the missed message on the Dashboard.

**"X / 7 verses saved" is red in Voice Inbox.**
You haven't picked all 7 verses for the week yet. Go to Verse Picker, pick 7, save.

**Voice grading is very slow.**
Normal — Whisper takes 30–90 seconds for each minute of audio. The first voice note of the day is sometimes slower because the engine "warms up". Just be patient.

**Whisper isn't installed.**
Open Settings → if the Whisper section shows ⚠️, the speech engine wasn't installed properly. The app will still let you import voice notes, just without auto-grading.

**Bible verses count is too low.**
The full Bible should be loaded (~31,000 verses). If you see only 17, the app is using sample data only. This shouldn't happen with a properly built version.

**My data disappeared!**
First, don't panic. Look at your backup folder (Settings → Backup folder). Inside, you should see files named `powerful-weapon-backup-XXXX.db`. Copy the most recent one to your `~/Library/Application Support/Powerful Weapon/` (Mac) or `%APPDATA%\Powerful Weapon\` (Windows) folder, renaming it to `powerful-weapon.db`. Restart the app.

---

## Frequently asked questions

**Q: Does it work without internet?**
Yes, for everything except actually sending WhatsApp messages. The Tamil Bible, the verse picker, and the speech-to-text engine all run offline on your computer.

**Q: Can I use a different Bible translation?**
The app ships with the Tamil Old Version (1956). If you have another translation as JSON, you can import it — ask Andrew.

**Q: Can two people use the app for the same group?**
The database is on one computer. Two people on different computers would each have their own copy. For now, designate one "admin" computer.

**Q: My computer was off all weekend. Did I miss anything?**
No. Open the app and you'll see banners showing what wasn't sent. You can still send those messages — they just go later.

**Q: Is my data private?**
Yes. Nothing ever leaves your computer. There are no servers, no analytics, no cloud accounts. The only network connections the app makes are: (1) opening WhatsApp Web in your browser when you send a daily verse, (2) checking for updates if enabled.

**Q: How do I update the app?**
When a new version is ready, you'll get a new `.dmg` or `.zip` from Andrew. Install it the same way — your existing data is kept (it lives in a separate folder).

---

## Need help?

Contact **Johnson Andrew** for any technical issues, questions, or feature requests.

---

*Powerful Weapon · Built with love for studying the Word of God together.*
