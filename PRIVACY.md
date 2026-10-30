# Privacy Policy — Powerful Weapon

_Last updated: 2026-10-30_

Powerful Weapon is a Tamil Bible-study tool. A group administrator uses it to
choose weekly memory verses and grade members' recitation voice notes; group
members use it to receive the daily verse as a notification.

## What the app stores
The administrator's working data is stored **on the administrator's device** (a local database):
- Member names, phone numbers, and join dates (entered by the administrator).
- Imported voice-note recordings and their transcripts and scores.
- Weekly verse selections and app settings.

Members' app logins, their weekly voice recordings, the administrator's marks and the
weekly verses are stored on the group's server — see the sections below.

The app does **not** contain advertising or third-party analytics/tracking SDKs.

## Daily verses on members' phones
When the administrator saves a week, the 7 Bible verses and the daily send time
are uploaded to the group's verse feed (a small server run by the
administrator). Members' apps download that feed to show the daily verse. The
feed contains **only Bible verses and a time** — no names, phone numbers,
recordings or other personal data. Members' apps send nothing about the member;
their reminder time and settings stay on their own phone.

## Members' accounts and recordings
To send a weekly recitation from the app, the administrator creates an app login
for each member: the member's **name** and a 4-digit PIN (stored only as a
salted hash). These, and each member's **voice recordings**, are stored on the
group's server (Cloudflare, run by the administrator) so the administrator can
listen and mark them.

- Other members can see who has sent a recording and can play it. They never
  see phone numbers, marks or reports — only the administrator sees marks.
- Recordings are **deleted automatically 8 weeks** after they are sent. The
  administrator may save a copy before then. Marks are kept.
- Recordings sent for marking are transcribed by the speech-to-text provider
  the administrator chooses (Groq Whisper or Sarvam AI), only to produce marks.
- Phone numbers entered by the administrator stay on the administrator's phone.
- A member can ask the administrator to delete their login and recordings at any
  time; deleting a member removes all their recordings and marks from the server.

- The server also keeps, per member and week, how many recording tries were used,
  so the try limit can't be reset by reinstalling the app.

## Practice voice check
On the Practice screen a member can say one verse aloud to check it. That short
clip is sent to the speech-to-text provider (Groq Whisper) through the group's
server, only to return the text; it is **not stored** and is **never** sent to the
administrator. The server only counts how many checks a member used that day.

## Microphone
The microphone is used only while a member records on the Record screen or uses
the Practice voice check.

## Notifications
The app schedules local notifications on the device for the daily verse.
It also uses **Firebase Cloud Messaging** (Google) for a few real-time messages:
the administrator is alerted when a member has used all their tries, and members
are told when new verses are published or when they get another try. For this the
group's server stores the phone's push token together with the member's login (or
the administrator role). The token is deleted when the member is removed, and it
is not used for anything else.

## Voice notes and speech-to-text
To grade a recitation, the app sends the **audio of an imported voice note** to a
speech-to-text service configured by the administrator (the "STT proxy"), which
returns a text transcript. The audio is sent only for transcription and is not
used for any other purpose by this app. The transcription provider's own terms
govern their handling of that audio; the administrator chooses the provider.

## What the app does NOT do
- It does not post to WhatsApp automatically or read your WhatsApp messages.
  Sharing the daily verse and importing voice notes are manual actions the
  administrator performs.
- It does not sell or share personal data with advertisers.

## Data retention and deletion
Data lives on the administrator's device and can be deleted at any time from
within the app (remove users, clear voice notes) or by uninstalling the app,
which removes the local database.

## Contact
For questions or data requests, contact: **johnsonandrew.j@outlook.com**
