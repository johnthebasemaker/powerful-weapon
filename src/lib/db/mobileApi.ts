// Android implementation of the same surface as electron/preload.ts's `api`.
// Data lives in on-device SQLite (./sqlite); ranking + grading reuse the pure-TS
// libs shared with desktop. Platform-specific features (Whisper, file dialogs,
// desktop backup) are stubbed here and land properly in Phase 4.

import { Clipboard } from '@capacitor/clipboard';
import { AppLauncher } from '@capacitor/app-launcher';
import { all, get, run, runSet } from './sqlite';
import { rankVerses, VerseRow } from '../../../electron/lib/fuzzy';
import { normalizeTamil } from '../../../electron/lib/tamil';
import { grade } from '../../../electron/lib/grading';
import { currentWeekStart as weekStartOf, dateForSlot } from '../dates';
import { scheduleDailyPostReminder } from '../scheduler';
import { transcribeViaProxy, getAudioDurationSeconds } from '../stt';

function todaySlot(date = new Date()): number {
  const d = date.getDay(); // Sun=0..Sat=6 → Mon=1..Sun=7
  return d === 0 ? 7 : d;
}

/** Same WhatsApp message format as electron/ipc/whatsapp.ts:formatVerseMessage. */
function formatVerseMessage(
  book: string, chapter: number, verse: number, text: string, dateStr: string,
): string {
  return [
    'இன்றைய ரேமா (வார்த்தை)',
    `(${dateStr})`,
    '',
    `*${book} ${chapter}:${verse}*`,
    `*${text}*`,
  ].join('\n');
}

async function openWhatsApp(text?: string): Promise<void> {
  const encoded = text ? `?text=${encodeURIComponent(text)}` : '';
  const { value } = await AppLauncher.canOpenUrl({ url: 'whatsapp://send' });
  await AppLauncher.openUrl({
    url: value ? `whatsapp://send${encoded}` : `https://wa.me/${encoded}`,
  });
}

const STT_TODO = 'Set a Speech-to-text proxy URL in Settings to enable voice grading.';

async function getSetting(key: string): Promise<string> {
  const r = await get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return r?.value ?? '';
}

// Audio captured at pick time (base64), consumed by files.importVoiceNote.
const pickedAudio = new Map<string, { base64: string; mimeType: string; name: string; size: number }>();

/** Read a stored voice note back and transcribe it via the configured proxy. */
async function transcribeStoredFile(fileName: string): Promise<{ transcript: string; durationSeconds: number }> {
  const url = await getSetting('stt_proxy_url');
  if (!url) throw new Error(STT_TODO);
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const read = await Filesystem.readFile({ path: fileName, directory: Directory.Data });
  const base64 = typeof read.data === 'string' ? read.data : '';
  const mime = 'audio/ogg';
  const clientDuration = await getAudioDurationSeconds(`data:${mime};base64,${base64}`);
  const r = await transcribeViaProxy(url, base64, mime, 'ta');
  return { transcript: r.transcript, durationSeconds: r.durationSeconds || clientDuration };
}

/**
 * Read a shared content:// URI (from a WhatsApp Share) into base64 and register
 * it as a picked file, returning the key VoiceInbox feeds to importVoiceNote.
 */
export async function registerPickedAudioFromUri(
  url: string, mimeType?: string, name?: string,
): Promise<string | null> {
  const { Filesystem } = await import('@capacitor/filesystem');
  // WhatsApp hands over a content:// URI; different Android versions want it raw
  // vs. decoded, so try both before giving up.
  const candidates = Array.from(new Set([url, decodeURIComponent(url)]));
  for (const path of candidates) {
    try {
      const read = await Filesystem.readFile({ path });
      const base64 = typeof read.data === 'string' ? read.data : '';
      if (!base64) continue;
      const key = `shared://${Date.now()}-${name ?? 'audio'}`;
      pickedAudio.set(key, {
        base64,
        mimeType: mimeType || 'audio/ogg',
        name: name || 'shared-audio.ogg',
        size: Math.floor((base64.length * 3) / 4),
      });
      return key;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export const mobileApi: Window['api'] = {
  verses: {
    async search(rootWord: string, limit = 30) {
      const rows = await all<VerseRow>('SELECT * FROM verses');
      return rankVerses(rootWord, rows, limit);
    },
    get: (id: number) => get('SELECT * FROM verses WHERE id = ?', [id]),
    async toggleMemory(id: number, isMemory: boolean) {
      await run('UPDATE verses SET is_memory_verse = ? WHERE id = ?', [isMemory ? 1 : 0, id]);
      return { ok: true };
    },
    async count() {
      const r = await get<{ n: number }>('SELECT COUNT(*) AS n FROM verses');
      return r?.n ?? 0;
    },
    async importBulk(rows: any[]) {
      await runSet(rows.map((r) => ({
        statement:
          'INSERT OR REPLACE INTO verses (book, chapter, verse, text_tamil, text_normalized, is_memory_verse) ' +
          'VALUES (?, ?, ?, ?, ?, COALESCE((SELECT is_memory_verse FROM verses WHERE book=? AND chapter=? AND verse=?), 0))',
        values: [
          r.book, r.chapter, r.verse, r.text_tamil,
          r.text_normalized ?? normalizeTamil(r.text_tamil),
          r.book, r.chapter, r.verse,
        ],
      })));
      return { inserted: rows.length };
    },
  },

  selections: {
    get: (weekStart: string) => all(
      `SELECT s.*, v.book, v.chapter, v.verse, v.text_tamil
       FROM weekly_selections s JOIN verses v ON v.id = s.verse_id
       WHERE s.week_start_date = ? ORDER BY s.slot ASC`, [weekStart]),
    async save(weekStart: string, rootWord: string, verseIds: number[]) {
      const set: { statement: string; values: any[] }[] = [{
        statement: 'DELETE FROM weekly_selections WHERE week_start_date = ?',
        values: [weekStart],
      }];
      verseIds.slice(0, 7).forEach((vid, i) => set.push({
        statement: 'INSERT INTO weekly_selections (week_start_date, slot, verse_id, root_word) VALUES (?, ?, ?, ?)',
        values: [weekStart, i + 1, vid, rootWord],
      }));
      await runSet(set);
      return { ok: true, count: Math.min(verseIds.length, 7) };
    },
    async count(weekStart: string) {
      const r = await get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM weekly_selections WHERE week_start_date = ?', [weekStart]);
      return r?.n ?? 0;
    },
    async markPosted(weekStart: string, slot: number) {
      await run(
        `UPDATE weekly_selections SET posted_at = datetime('now') WHERE week_start_date = ? AND slot = ?`,
        [weekStart, slot]);
      return { ok: true };
    },
  },

  users: {
    list: () => all('SELECT * FROM users ORDER BY name'),
    async create(name: string, phone: string, joinedDate: string) {
      const r = await run('INSERT INTO users (name, phone, joined_date) VALUES (?, ?, ?)', [name, phone, joinedDate]);
      return { id: r.lastId };
    },
    async update(id: number, patch: any) {
      const fields: string[] = [];
      const values: any[] = [];
      for (const k of ['name', 'phone', 'joined_date', 'active']) {
        if (k in patch) { fields.push(`${k} = ?`); values.push(patch[k]); }
      }
      if (!fields.length) return { ok: true };
      values.push(id);
      await run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
      return { ok: true };
    },
    async delete(id: number) {
      await run('DELETE FROM users WHERE id = ?', [id]);
      return { ok: true };
    },
    async importCsv(rows: { name: string; phone: string; joined_date: string }[]) {
      await runSet(rows.map((r) => ({
        statement: 'INSERT OR IGNORE INTO users (name, phone, joined_date) VALUES (?, ?, ?)',
        values: [r.name.trim(), r.phone.trim(), r.joined_date],
      })));
      return { inserted: rows.length, total: rows.length };
    },
  },

  voiceNotes: {
    list: (weekStart?: string) => weekStart
      ? all(`SELECT vn.*, u.name AS user_name FROM voice_notes vn JOIN users u ON u.id = vn.user_id
             WHERE vn.week_start_date = ? ORDER BY vn.created_at DESC`, [weekStart])
      : all(`SELECT vn.*, u.name AS user_name FROM voice_notes vn JOIN users u ON u.id = vn.user_id
             ORDER BY vn.created_at DESC LIMIT 200`),
    listGrouped: (weekStart: string) => all(
      `SELECT vn.file_path, vn.user_id, u.name AS user_name, vn.week_start_date,
              COUNT(*) AS verse_count, AVG(vn.total_score) AS avg_total,
              SUM(CASE WHEN vn.graded_at IS NOT NULL THEN 1 ELSE 0 END) AS graded_count,
              MAX(vn.graded_at) AS latest_graded_at, MIN(vn.transcript) AS transcript, MIN(vn.id) AS min_id
       FROM voice_notes vn JOIN users u ON u.id = vn.user_id
       WHERE vn.week_start_date = ?
       GROUP BY vn.file_path, vn.user_id, vn.week_start_date
       ORDER BY latest_graded_at DESC, min_id DESC`, [weekStart]),
    detailsByFile: (userId: number, weekStart: string, filePath: string) => all(
      `SELECT vn.*, u.name AS user_name FROM voice_notes vn JOIN users u ON u.id = vn.user_id
       WHERE vn.user_id = ? AND vn.week_start_date = ? AND vn.file_path = ? ORDER BY vn.verse_slot ASC`,
      [userId, weekStart, filePath]),
    async fileExists(userId: number, weekStart: string, filePath: string) {
      const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
      const r = await get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM voice_notes
         WHERE user_id = ? AND week_start_date = ? AND (file_path = ? OR file_path LIKE ?)`,
        [userId, weekStart, filePath, `%${fileName}`]);
      return (r?.n ?? 0) > 0;
    },
    async deleteByFile(userId: number, weekStart: string, filePath: string) {
      const r = await run('DELETE FROM voice_notes WHERE user_id = ? AND week_start_date = ? AND file_path = ?',
        [userId, weekStart, filePath]);
      return { deleted: r.changes };
    },
    async deleteAllForWeek(weekStart: string) {
      const r = await run('DELETE FROM voice_notes WHERE week_start_date = ?', [weekStart]);
      return { deleted: r.changes };
    },
    async deleteOne(id: number) {
      const r = await run('DELETE FROM voice_notes WHERE id = ?', [id]);
      return { deleted: r.changes };
    },
    async create(vn: any) {
      const r = await run(
        'INSERT INTO voice_notes (user_id, week_start_date, verse_slot, file_path) VALUES (?, ?, ?, ?)',
        [vn.user_id, vn.week_start_date, vn.verse_slot, vn.file_path]);
      return { id: r.lastId };
    },
    async saveGrade(id: number, transcript: string, grades: any) {
      await run(
        `UPDATE voice_notes SET transcript = ?, accuracy_score = ?, fluency_score = ?, reference_score = ?,
                total_score = ?, duration_seconds = ?, graded_at = datetime('now') WHERE id = ?`,
        [transcript, grades.accuracy, grades.fluency, grades.reference, grades.total, grades.durationSeconds ?? null, id]);
      return { ok: true };
    },
  },

  files: {
    async pickVoiceNotes() {
      const { FilePicker } = await import('@capawesome/capacitor-file-picker');
      const res = await FilePicker.pickFiles({ types: ['audio/*'], readData: true } as any);
      const paths: string[] = [];
      (res.files ?? []).forEach((f: any, i: number) => {
        const key = `picked://${i}-${f.size ?? 0}-${f.name ?? 'audio'}`;
        pickedAudio.set(key, {
          base64: f.data ?? '',
          mimeType: f.mimeType ?? 'audio/ogg',
          name: f.name ?? 'audio.ogg',
          size: f.size ?? 0,
        });
        paths.push(key);
      });
      return paths;
    },
    async importVoiceNote(srcPath: string) {
      const picked = pickedAudio.get(srcPath);
      if (!picked || !picked.base64) return { ok: false, error: 'Audio unavailable — please re-pick the file.' };
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const fileName = `vn-${Date.now()}-${picked.name.replace(/[^\w.\-]+/g, '_')}`;
      await Filesystem.writeFile({ path: fileName, data: picked.base64, directory: Directory.Data });
      pickedAudio.delete(srcPath);
      return { ok: true, path: fileName, size: picked.size };
    },
    pickCsv: async () => null,
  },

  leaderboard: {
    consistency: (yearStart: string, yearEnd: string) => all(
      `SELECT u.id, u.name, COUNT(DISTINCT vn.week_start_date) AS weeks_present, COUNT(vn.id) AS notes_count
       FROM users u LEFT JOIN voice_notes vn ON vn.user_id = u.id
            AND vn.week_start_date >= ? AND vn.week_start_date <= ?
       WHERE u.active = 1 GROUP BY u.id
       ORDER BY weeks_present DESC, notes_count DESC, u.name ASC`, [yearStart, yearEnd]),
    scores: (weekStart: string | null, yearStart: string, yearEnd: string) => weekStart
      ? all(`SELECT u.id, u.name, AVG(vn.total_score) AS avg_score, COUNT(vn.id) AS notes_count
             FROM users u JOIN voice_notes vn ON vn.user_id = u.id
             WHERE vn.week_start_date = ? AND vn.total_score IS NOT NULL GROUP BY u.id ORDER BY avg_score DESC`,
             [weekStart])
      : all(`SELECT u.id, u.name, AVG(vn.total_score) AS avg_score, COUNT(vn.id) AS notes_count
             FROM users u JOIN voice_notes vn ON vn.user_id = u.id
             WHERE vn.week_start_date >= ? AND vn.week_start_date <= ? AND vn.total_score IS NOT NULL
             GROUP BY u.id ORDER BY avg_score DESC`, [yearStart, yearEnd]),
  },

  settings: {
    async getAll() {
      const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings');
      const out: Record<string, string> = {};
      for (const r of rows) out[r.key] = r.value;
      return out;
    },
    async set(key: string, value: string) {
      await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value]);
      return { ok: true };
    },
  },

  whatsapp: {
    async openWeb() { await openWhatsApp(); return { ok: true }; },
    async prepareSend(payload: any) {
      const message = formatVerseMessage(payload.book, payload.chapter, payload.verse, payload.text, payload.dateStr);
      await Clipboard.write({ string: message });
      await run(
        `INSERT INTO send_log (scheduled_at, status, verse_id, week_start_date, slot)
         VALUES (datetime('now'), 'queued', ?, ?, ?)`,
        [payload.verseId, payload.weekStart, payload.slot]);
      await openWhatsApp(message);
      return { ok: true, message };
    },
    async markSentBySlot(weekStart: string, slot: number) {
      await run(`UPDATE send_log SET status = 'sent', sent_at = datetime('now')
                 WHERE week_start_date = ? AND slot = ? AND status = 'queued'`, [weekStart, slot]);
      await run(`UPDATE weekly_selections SET posted_at = datetime('now')
                 WHERE week_start_date = ? AND slot = ?`, [weekStart, slot]);
      return { ok: true };
    },
    async copyMessage(message: string) { await Clipboard.write({ string: message }); return { ok: true }; },
  },

  scheduler: {
    async start(sendTime: string) { await scheduleDailyPostReminder(sendTime); return { ok: true, spec: sendTime }; },
    async checkMissed() {
      const ws = weekStartOf();
      const rows = await all<any>(
        `SELECT s.slot, s.verse_id, v.book, v.chapter, v.verse, v.text_tamil,
                (SELECT status FROM send_log WHERE week_start_date = s.week_start_date AND slot = s.slot
                  ORDER BY id DESC LIMIT 1) AS last_status
         FROM weekly_selections s JOIN verses v ON v.id = s.verse_id
         WHERE s.week_start_date = ? AND s.slot <= ? AND s.posted_at IS NULL`,
        [ws, todaySlot()]);
      return rows.map((r) => ({ ...r, dateStr: dateForSlot(ws, r.slot), weekStart: ws }));
    },
    currentWeekStart: async () => weekStartOf(),
    todaySlot: async () => todaySlot(),
  },

  whisper: {
    async check() {
      const url = await getSetting('stt_proxy_url');
      return url ? { ok: true } : { ok: false, reason: STT_TODO };
    },
    modelStatus: async () => ({ installed: false, partial: false, bytes: 0, expectedBytes: 0, location: 'cloud (STT proxy)' }),
    downloadModel: async () => ({ ok: true }), // nothing to download on mobile
    cancelDownload: async () => ({ ok: true }),
    deleteModel: async () => ({ ok: true, deleted: 0 }),
    async transcribe(payload: any) {
      try {
        const { transcript, durationSeconds } = await transcribeStoredFile(payload.filePath);
        return { ok: true, transcript, durationSeconds, segments: [] };
      } catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
    },
    async transcribeAndGrade(payload: any) {
      try {
        const { transcript, durationSeconds } = await transcribeStoredFile(payload.filePath);
        const g = grade({
          transcript, referenceText: payload.referenceText,
          referenceCitation: payload.referenceCitation, durationSeconds,
        });
        await run(
          `UPDATE voice_notes SET transcript = ?, accuracy_score = ?, fluency_score = ?, reference_score = ?,
                  total_score = ?, duration_seconds = ?, graded_at = datetime('now') WHERE id = ?`,
          [transcript, g.accuracy, g.fluency, g.reference, g.total, durationSeconds, payload.voiceNoteId]);
        return { ok: true, transcript, grade: g };
      } catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
    },
    async transcribeAndGradeWeek(payload: any) {
      try {
        const selections = await all<any>(
          `SELECT s.slot, v.book, v.chapter, v.verse, v.text_tamil
           FROM weekly_selections s JOIN verses v ON v.id = s.verse_id
           WHERE s.week_start_date = ? ORDER BY s.slot ASC`, [payload.weekStart]);
        if (!selections.length) return { ok: false, error: 'No verses saved for this week. Go to Verse Picker first.' };
        const { transcript, durationSeconds } = await transcribeStoredFile(payload.filePath);
        const results: any[] = [];
        const set: { statement: string; values: any[] }[] = [];
        for (const sel of selections) {
          const g = grade({
            transcript, referenceText: sel.text_tamil,
            referenceCitation: { book: sel.book, chapter: sel.chapter, verse: sel.verse }, durationSeconds,
          });
          set.push({
            statement:
              `INSERT INTO voice_notes (user_id, week_start_date, verse_slot, file_path, transcript,
                 accuracy_score, fluency_score, reference_score, total_score, duration_seconds, graded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            values: [payload.userId, payload.weekStart, sel.slot, payload.filePath, transcript,
              g.accuracy, g.fluency, g.reference, g.total, durationSeconds],
          });
          results.push({ slot: sel.slot, book: sel.book, chapter: sel.chapter, verse: sel.verse,
            accuracy: g.accuracy, fluency: g.fluency, reference: g.reference, total: g.total });
        }
        await runSet(set);
        const weeklyAverage = Math.round((results.reduce((a, b) => a + b.total, 0) / results.length) * 10) / 10;
        return { ok: true, transcript, results, weeklyAverage };
      } catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
    },
  },

  backup: {
    pickFolder: async () => null,
    runNow: async () => ({ ok: false, error: 'On Android, export via the Share sheet (Phase 4).' }),
    lastRun: async () => null,
  },

  sendLog: {
    recent: (limit = 50) => all(
      `SELECT sl.*, v.book, v.chapter, v.verse, v.text_tamil
       FROM send_log sl JOIN verses v ON v.id = sl.verse_id
       ORDER BY sl.scheduled_at DESC LIMIT ?`, [limit]),
    pendingQueue: () => all(`SELECT * FROM send_log WHERE status = 'queued' ORDER BY scheduled_at ASC`),
  },

  // Desktop pushes IPC events (whisper progress, scheduler fire). On mobile these
  // are delivered differently (local notifications); nothing subscribes here yet.
  on: () => () => {},
};
