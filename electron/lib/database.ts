import Database from 'better-sqlite3';
import fs from 'node:fs';
import { dbPath, sampleBiblePath, fullBiblePath } from './paths';

let db: Database.Database | null = null;

const SCHEMA = `
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
  week_start_date TEXT NOT NULL,   -- ISO date of Monday
  slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 7),
  verse_id INTEGER NOT NULL,
  posted_at TEXT,                  -- ISO timestamp when user marked sent
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
  accuracy_score REAL,            -- /60
  fluency_score REAL,             -- /25
  reference_score REAL,           -- /15
  total_score REAL,               -- /100
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

const DEFAULT_SETTINGS: Record<string, string> = {
  send_time: '00:00',              // IST, HH:MM
  timezone: 'Asia/Kolkata',
  group_name: '',
  backup_folder: '',
  backup_enabled: 'true',
  backup_frequency_days: '7',
};

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath());
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
    seedSettings();
    seedBibleIfEmpty();
  }
  return db;
}

function seedSettings() {
  if (!db) return;
  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insert.run(k, v);
}

function seedBibleIfEmpty() {
  if (!db) return;

  // Prefer the full Tamil OV file if it exists (the user ran `npm run import:bible`).
  // Otherwise fall back to the 17-verse sample bundled with the source.
  const fullPath = fullBiblePath();
  const samplePath = sampleBiblePath();
  const preferredPath = fs.existsSync(fullPath) ? fullPath : samplePath;
  if (!fs.existsSync(preferredPath)) return;

  const row = db.prepare('SELECT COUNT(*) as n FROM verses').get() as { n: number };

  // Re-seed if: empty DB, OR DB is the sample (<1000 verses) but the full file is now present.
  // The user's memory-verse tags are preserved via the COALESCE-based insert below.
  const needsFullImport = fs.existsSync(fullPath) && row.n < 1000;
  if (row.n > 0 && !needsFullImport) return;

  const raw = JSON.parse(fs.readFileSync(preferredPath, 'utf8'));
  // Preserve existing memory-verse tags by ON CONFLICT update that only refreshes text fields.
  const insert = db.prepare(
    `INSERT INTO verses (book, chapter, verse, text_tamil, text_normalized, is_memory_verse)
       VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(book, chapter, verse) DO UPDATE SET
       text_tamil = excluded.text_tamil,
       text_normalized = excluded.text_normalized`
  );
  const tx = db.transaction((rows: any[]) => {
    for (const r of rows) {
      insert.run(
        r.book,
        r.chapter,
        r.verse,
        r.text_tamil,
        r.text_normalized ?? normalizeForStorage(r.text_tamil),
        r.is_memory_verse ? 1 : 0
      );
    }
  });
  tx(raw);
  console.log(`Loaded ${raw.length.toLocaleString()} verses into DB.`);
}

// Lightweight normalizer used at storage time (avoid circular import of src/lib/tamil)
function normalizeForStorage(s: string): string {
  return s
    .replace(/[​-‍﻿]/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/[।.,;:!?"()\[\]{}'"‘’“”\-—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
