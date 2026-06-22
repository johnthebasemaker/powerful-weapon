import { ipcMain } from 'electron';
import { getDb } from '../lib/database';
import { rankVerses, VerseRow } from '../lib/fuzzy';
import { normalizeTamil } from '../lib/tamil';

export function registerDbIpc() {
  // -------- Verses ---------
  ipcMain.handle('verses:search', (_e, rootWord: string, limit = 30) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM verses').all() as VerseRow[];
    return rankVerses(rootWord, rows, limit);
  });

  ipcMain.handle('verses:get', (_e, id: number) => {
    return getDb().prepare('SELECT * FROM verses WHERE id = ?').get(id);
  });

  ipcMain.handle('verses:toggleMemory', (_e, id: number, isMemory: boolean) => {
    getDb()
      .prepare('UPDATE verses SET is_memory_verse = ? WHERE id = ?')
      .run(isMemory ? 1 : 0, id);
    return { ok: true };
  });

  ipcMain.handle('verses:count', () => {
    const r = getDb().prepare('SELECT COUNT(*) as n FROM verses').get() as { n: number };
    return r.n;
  });

  ipcMain.handle('verses:importBulk', (_e, rows: any[]) => {
    const db = getDb();
    const insert = db.prepare(
      'INSERT OR REPLACE INTO verses (book, chapter, verse, text_tamil, text_normalized, is_memory_verse) VALUES (?, ?, ?, ?, ?, COALESCE((SELECT is_memory_verse FROM verses WHERE book=? AND chapter=? AND verse=?), 0))'
    );
    const tx = db.transaction((items: any[]) => {
      for (const r of items) {
        insert.run(
          r.book, r.chapter, r.verse, r.text_tamil,
          r.text_normalized ?? normalizeTamil(r.text_tamil),
          r.book, r.chapter, r.verse
        );
      }
    });
    tx(rows);
    return { inserted: rows.length };
  });

  // -------- Weekly selections ---------
  ipcMain.handle('selections:get', (_e, weekStart: string) => {
    return getDb()
      .prepare(`
        SELECT s.*, v.book, v.chapter, v.verse, v.text_tamil
        FROM weekly_selections s
        JOIN verses v ON v.id = s.verse_id
        WHERE s.week_start_date = ?
        ORDER BY s.slot ASC
      `)
      .all(weekStart);
  });

  ipcMain.handle(
    'selections:save',
    (_e, weekStart: string, rootWord: string, verseIds: number[]) => {
      const db = getDb();
      const del = db.prepare('DELETE FROM weekly_selections WHERE week_start_date = ?');
      const ins = db.prepare(
        'INSERT INTO weekly_selections (week_start_date, slot, verse_id, root_word) VALUES (?, ?, ?, ?)'
      );
      const tx = db.transaction(() => {
        del.run(weekStart);
        verseIds.slice(0, 7).forEach((vid, i) => {
          ins.run(weekStart, i + 1, vid, rootWord);
        });
      });
      tx();
      return { ok: true, count: Math.min(verseIds.length, 7) };
    }
  );

  ipcMain.handle('selections:count', (_e, weekStart: string) => {
    const r = getDb()
      .prepare(`SELECT COUNT(*) as n FROM weekly_selections WHERE week_start_date = ?`)
      .get(weekStart) as { n: number };
    return r.n;
  });

  ipcMain.handle('selections:markPosted', (_e, weekStart: string, slot: number) => {
    getDb()
      .prepare(
        `UPDATE weekly_selections SET posted_at = datetime('now') WHERE week_start_date = ? AND slot = ?`
      )
      .run(weekStart, slot);
    return { ok: true };
  });

  // -------- Users ---------
  ipcMain.handle('users:list', () => {
    return getDb().prepare('SELECT * FROM users ORDER BY name').all();
  });

  ipcMain.handle('users:create', (_e, name: string, phone: string, joinedDate: string) => {
    const r = getDb()
      .prepare('INSERT INTO users (name, phone, joined_date) VALUES (?, ?, ?)')
      .run(name, phone, joinedDate);
    return { id: Number(r.lastInsertRowid) };
  });

  ipcMain.handle('users:update', (_e, id: number, patch: any) => {
    const fields: string[] = [];
    const values: any[] = [];
    for (const k of ['name', 'phone', 'joined_date', 'active']) {
      if (k in patch) {
        fields.push(`${k} = ?`);
        values.push(patch[k]);
      }
    }
    if (!fields.length) return { ok: true };
    values.push(id);
    getDb().prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { ok: true };
  });

  ipcMain.handle('users:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
    return { ok: true };
  });

  ipcMain.handle('users:importCsv', (_e, rows: { name: string; phone: string; joined_date: string }[]) => {
    const db = getDb();
    const insert = db.prepare(
      'INSERT OR IGNORE INTO users (name, phone, joined_date) VALUES (?, ?, ?)'
    );
    let inserted = 0;
    const tx = db.transaction(() => {
      for (const r of rows) {
        const result = insert.run(r.name.trim(), r.phone.trim(), r.joined_date);
        if (result.changes) inserted++;
      }
    });
    tx();
    return { inserted, total: rows.length };
  });

  // -------- Voice notes ---------
  ipcMain.handle('voiceNotes:list', (_e, weekStart?: string) => {
    const sql = weekStart
      ? `SELECT vn.*, u.name as user_name FROM voice_notes vn JOIN users u ON u.id = vn.user_id WHERE vn.week_start_date = ? ORDER BY vn.created_at DESC`
      : `SELECT vn.*, u.name as user_name FROM voice_notes vn JOIN users u ON u.id = vn.user_id ORDER BY vn.created_at DESC LIMIT 200`;
    const stmt = getDb().prepare(sql);
    return weekStart ? stmt.all(weekStart) : stmt.all();
  });

  ipcMain.handle('voiceNotes:create', (_e, vn: any) => {
    const r = getDb()
      .prepare(
        `INSERT INTO voice_notes (user_id, week_start_date, verse_slot, file_path) VALUES (?, ?, ?, ?)`
      )
      .run(vn.user_id, vn.week_start_date, vn.verse_slot, vn.file_path);
    return { id: Number(r.lastInsertRowid) };
  });

  ipcMain.handle('voiceNotes:listGrouped', (_e, weekStart: string) => {
    // Group rows that share (user_id, week, file_path) into a single visual entry.
    // "All 7" mode produces 7 rows with the same file_path → collapses to one card.
    // "Per day" mode produces 1 row per file → already one entry.
    return getDb()
      .prepare(
        `SELECT
           vn.file_path,
           vn.user_id,
           u.name as user_name,
           vn.week_start_date,
           COUNT(*) as verse_count,
           AVG(vn.total_score) as avg_total,
           SUM(CASE WHEN vn.graded_at IS NOT NULL THEN 1 ELSE 0 END) as graded_count,
           MAX(vn.graded_at) as latest_graded_at,
           MIN(vn.transcript) as transcript,
           MIN(vn.id) as min_id
         FROM voice_notes vn
         JOIN users u ON u.id = vn.user_id
         WHERE vn.week_start_date = ?
         GROUP BY vn.file_path, vn.user_id, vn.week_start_date
         ORDER BY latest_graded_at DESC, min_id DESC`
      )
      .all(weekStart);
  });

  ipcMain.handle('voiceNotes:detailsByFile', (_e, userId: number, weekStart: string, filePath: string) => {
    return getDb()
      .prepare(
        `SELECT vn.*, u.name as user_name
         FROM voice_notes vn JOIN users u ON u.id = vn.user_id
         WHERE vn.user_id = ? AND vn.week_start_date = ? AND vn.file_path = ?
         ORDER BY vn.verse_slot ASC`
      )
      .all(userId, weekStart, filePath);
  });

  ipcMain.handle('voiceNotes:fileExists', (_e, userId: number, weekStart: string, filePath: string) => {
    const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
    const r = getDb()
      .prepare(
        `SELECT COUNT(*) as n FROM voice_notes
         WHERE user_id = ? AND week_start_date = ? AND (file_path = ? OR file_path LIKE ?)`
      )
      .get(userId, weekStart, filePath, `%${fileName}`) as { n: number };
    return r.n > 0;
  });

  ipcMain.handle('voiceNotes:deleteByFile', (_e, userId: number, weekStart: string, filePath: string) => {
    const r = getDb()
      .prepare(
        `DELETE FROM voice_notes WHERE user_id = ? AND week_start_date = ? AND file_path = ?`
      )
      .run(userId, weekStart, filePath);
    return { deleted: r.changes };
  });

  ipcMain.handle('voiceNotes:deleteAllForWeek', (_e, weekStart: string) => {
    const r = getDb()
      .prepare(`DELETE FROM voice_notes WHERE week_start_date = ?`)
      .run(weekStart);
    return { deleted: r.changes };
  });

  ipcMain.handle('voiceNotes:deleteOne', (_e, id: number) => {
    const r = getDb().prepare(`DELETE FROM voice_notes WHERE id = ?`).run(id);
    return { deleted: r.changes };
  });

  ipcMain.handle('voiceNotes:saveGrade', (_e, id: number, transcript: string, grades: any) => {
    getDb()
      .prepare(
        `UPDATE voice_notes
         SET transcript = ?, accuracy_score = ?, fluency_score = ?, reference_score = ?, total_score = ?, duration_seconds = ?, graded_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        transcript,
        grades.accuracy,
        grades.fluency,
        grades.reference,
        grades.total,
        grades.durationSeconds ?? null,
        id
      );
    return { ok: true };
  });

  // -------- Leaderboards ---------
  ipcMain.handle('leaderboard:consistency', (_e, yearStart: string, yearEnd: string) => {
    return getDb()
      .prepare(
        `SELECT u.id, u.name, COUNT(DISTINCT vn.week_start_date) as weeks_present,
                COUNT(vn.id) as notes_count
         FROM users u
         LEFT JOIN voice_notes vn ON vn.user_id = u.id
              AND vn.week_start_date >= ? AND vn.week_start_date <= ?
         WHERE u.active = 1
         GROUP BY u.id
         ORDER BY weeks_present DESC, notes_count DESC, u.name ASC`
      )
      .all(yearStart, yearEnd);
  });

  ipcMain.handle('leaderboard:scores', (_e, weekStart: string | null, yearStart: string, yearEnd: string) => {
    if (weekStart) {
      return getDb()
        .prepare(
          `SELECT u.id, u.name, AVG(vn.total_score) as avg_score, COUNT(vn.id) as notes_count
           FROM users u
           JOIN voice_notes vn ON vn.user_id = u.id
           WHERE vn.week_start_date = ? AND vn.total_score IS NOT NULL
           GROUP BY u.id
           ORDER BY avg_score DESC`
        )
        .all(weekStart);
    }
    return getDb()
      .prepare(
        `SELECT u.id, u.name, AVG(vn.total_score) as avg_score, COUNT(vn.id) as notes_count
         FROM users u
         JOIN voice_notes vn ON vn.user_id = u.id
         WHERE vn.week_start_date >= ? AND vn.week_start_date <= ? AND vn.total_score IS NOT NULL
         GROUP BY u.id
         ORDER BY avg_score DESC`
      )
      .all(yearStart, yearEnd);
  });

  // -------- Settings ---------
  ipcMain.handle('settings:getAll', () => {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  });

  ipcMain.handle('settings:set', (_e, key: string, value: string) => {
    getDb()
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, value);
    return { ok: true };
  });

  // -------- Send log ---------
  ipcMain.handle('sendLog:recent', (_e, limit = 50) => {
    return getDb()
      .prepare(
        `SELECT sl.*, v.book, v.chapter, v.verse, v.text_tamil
         FROM send_log sl JOIN verses v ON v.id = sl.verse_id
         ORDER BY sl.scheduled_at DESC LIMIT ?`
      )
      .all(limit);
  });

  ipcMain.handle('sendLog:pendingQueue', () => {
    return getDb()
      .prepare(`SELECT * FROM send_log WHERE status = 'queued' ORDER BY scheduled_at ASC`)
      .all();
  });
}
