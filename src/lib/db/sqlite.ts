// On-device SQLite connection + query helpers for the Android build.
//
// Only used on native platforms. Desktop/web route through window.api instead
// (see ../api.ts), so nothing here runs under Electron.

import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { SCHEMA, DEFAULT_SETTINGS } from './schema';
// Pure-TS normalizer shared with the desktop build (single source of truth).
import { normalizeTamil } from '../../../electron/lib/tamil';

const DB_NAME = 'powerful-weapon';

let connection: SQLiteConnection | null = null;
let dbPromise: Promise<SQLiteDBConnection> | null = null;

function conn(): SQLiteConnection {
  if (!connection) connection = new SQLiteConnection(CapacitorSQLite);
  return connection;
}

/** Lazily open (once) the on-device database, running schema + first-launch seed. */
export function getDb(): Promise<SQLiteDBConnection> {
  if (!dbPromise) dbPromise = openAndInit();
  return dbPromise;
}

async function openAndInit(): Promise<SQLiteDBConnection> {
  const c = conn();
  // Reuse an existing connection if the plugin already holds one (hot reload, etc.).
  const already = (await c.isConnection(DB_NAME, false)).result;
  const db = already
    ? await c.retrieveConnection(DB_NAME, false)
    : await c.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute('PRAGMA foreign_keys = ON;');
  await db.execute(SCHEMA);
  await seedSettings(db);
  await seedVersesIfEmpty(db);
  return db;
}

async function seedSettings(db: SQLiteDBConnection): Promise<void> {
  const set = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
    statement: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);',
    values: [key, value],
  }));
  await db.executeSet(set, true);
}

interface SeedVerse {
  book: string;
  chapter: number;
  verse: number;
  text_tamil: string;
  text_normalized?: string;
  is_memory_verse?: number | boolean;
}

async function fetchVerses(name: string): Promise<SeedVerse[] | null> {
  try {
    const res = await fetch(name);
    if (!res.ok) return null;
    return (await res.json()) as SeedVerse[];
  } catch {
    return null;
  }
}

/**
 * On first launch the verses table is empty. Seed it from a bundled JSON asset
 * (public/verses.json → served at the web root). Batched so a full ~31k-verse
 * DB doesn't block on one giant statement.
 */
async function seedVersesIfEmpty(db: SQLiteDBConnection): Promise<void> {
  const countRes = await db.query('SELECT COUNT(*) AS n FROM verses;');
  const n = Number(countRes.values?.[0]?.n ?? 0);

  // Prefer the full Tamil OV (public/verses.full.json — gitignored, dropped in
  // for release); fall back to the committed 17-verse sample.
  const full = await fetchVerses('verses.full.json');

  // Already full-sized → done. Some verses but no larger set to upgrade to → done.
  // Otherwise seed/upgrade (n===0 first launch, or sample-sized DB + full now bundled).
  if (n >= 1000) return;
  if (n > 0 && !full) return;

  const rows = full ?? (n === 0 ? await fetchVerses('verses.json') : null);
  if (!rows) return; // no seed asset available; app still runs, just empty

  const CHUNK = 400;
  for (let i = 0; i < rows.length; i += CHUNK) {
    // Upsert: refresh text but preserve any existing is_memory_verse tags,
    // so a sample → full upgrade doesn't wipe the admin's memory-verse picks.
    const set = rows.slice(i, i + CHUNK).map((r) => ({
      statement:
        'INSERT INTO verses (book, chapter, verse, text_tamil, text_normalized, is_memory_verse) VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(book, chapter, verse) DO UPDATE SET text_tamil = excluded.text_tamil, text_normalized = excluded.text_normalized;',
      values: [
        r.book,
        r.chapter,
        r.verse,
        r.text_tamil,
        r.text_normalized ?? normalizeTamil(r.text_tamil),
        r.is_memory_verse ? 1 : 0,
      ],
    }));
    await db.executeSet(set, true);
  }
}

// ---- Query helpers (thin wrappers over the plugin's row/`changes` shapes) ----

export async function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  const res = await db.query(sql, params);
  return (res.values ?? []) as T[];
}

export async function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return (await all<T>(sql, params))[0];
}

export async function run(
  sql: string,
  params: any[] = [],
): Promise<{ changes: number; lastId: number }> {
  const db = await getDb();
  const res = await db.run(sql, params, true);
  return { changes: res.changes?.changes ?? 0, lastId: res.changes?.lastId ?? 0 };
}

/** Run several statements atomically (delete+insert, bulk import, etc.). */
export async function runSet(set: { statement: string; values: any[] }[]): Promise<void> {
  if (!set.length) return;
  const db = await getDb();
  await db.executeSet(set, true);
}
