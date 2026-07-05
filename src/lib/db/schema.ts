// On-device SQLite schema for the Android build.
//
// This is the SAME schema as electron/lib/database.ts. It is duplicated here
// (not imported) on purpose: database.ts imports `better-sqlite3` + `node:fs` at
// the top, which cannot be bundled into a browser/webview. Keep the two in sync —
// they describe one logical database (desktop file vs. on-device SQLite).

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text_tamil TEXT NOT NULL,
  text_normalized TEXT NOT NULL,
  is_memory_verse INTEGER NOT NULL DEFAULT 0,
  UNIQUE(book, chapter, verse)
);
CREATE INDEX IF NOT EXISTS idx_verses_normalized ON verses(text_normalized);
CREATE INDEX IF NOT EXISTS idx_verses_memory ON verses(is_memory_verse);

CREATE TABLE IF NOT EXISTS weekly_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start_date TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 7),
  verse_id INTEGER NOT NULL,
  posted_at TEXT,
  root_word TEXT,
  UNIQUE(week_start_date, slot),
  FOREIGN KEY(verse_id) REFERENCES verses(id)
);
CREATE INDEX IF NOT EXISTS idx_selections_week ON weekly_selections(week_start_date);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  joined_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS voice_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  week_start_date TEXT NOT NULL,
  verse_slot INTEGER NOT NULL CHECK(verse_slot BETWEEN 1 AND 7),
  file_path TEXT NOT NULL,
  transcript TEXT,
  accuracy_score REAL,
  fluency_score REAL,
  reference_score REAL,
  total_score REAL,
  duration_seconds REAL,
  graded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_vn_user_week ON voice_notes(user_id, week_start_date);

CREATE TABLE IF NOT EXISTS send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_at TEXT NOT NULL,
  sent_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('queued','sent','skipped','failed')),
  verse_id INTEGER NOT NULL,
  week_start_date TEXT NOT NULL,
  slot INTEGER NOT NULL,
  FOREIGN KEY(verse_id) REFERENCES verses(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const DEFAULT_SETTINGS: Record<string, string> = {
  send_time: '00:00',
  timezone: 'Asia/Kolkata',
  group_name: '',
  backup_folder: '',
  backup_enabled: 'true',
  backup_frequency_days: '7',
};
