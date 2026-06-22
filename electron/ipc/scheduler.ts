import { ipcMain, BrowserWindow } from 'electron';
import cron from 'node-cron';
import { getDb } from '../lib/database';

let task: cron.ScheduledTask | null = null;
let currentSpec = '';

/**
 * IST (Asia/Kolkata) scheduler.
 * Setting `send_time` = "HH:MM" → cron pattern "M H * * *" in Asia/Kolkata tz.
 * Runs daily. Picks the current week's slot based on weekday (Mon=1..Sun=7).
 *
 * "Queue on wake": when the app launches, we check whether any past
 * scheduled-but-not-sent slots exist for today and surface them in the UI.
 */

function todaySlot(date = new Date()): number {
  // JS getDay: Sun=0..Sat=6. We want Mon=1..Sun=7.
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

function currentWeekStart(date = new Date()): string {
  // Monday of the week containing `date`, ISO YYYY-MM-DD.
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function dateForSlot(weekStart: string, slot: number): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + (slot - 1));
  // Format DD-MM-YY for the message header
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

function fire(slot: number, weekStart: string) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.*, v.book, v.chapter, v.verse, v.text_tamil
       FROM weekly_selections s JOIN verses v ON v.id = s.verse_id
       WHERE s.week_start_date = ? AND s.slot = ?`
    )
    .get(weekStart, slot) as any;
  if (!row) return;

  // Insert queued log row
  db.prepare(
    `INSERT INTO send_log (scheduled_at, status, verse_id, week_start_date, slot)
     VALUES (datetime('now'), 'queued', ?, ?, ?)`
  ).run(row.verse_id, weekStart, slot);

  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('scheduler:fire', {
      slot,
      weekStart,
      verse: {
        id: row.verse_id,
        book: row.book,
        chapter: row.chapter,
        verse: row.verse,
        text_tamil: row.text_tamil,
      },
      dateStr: dateForSlot(weekStart, slot),
    });
    // Focus the window so the user sees the prompt
    if (win.isMinimized()) win.restore();
    win.show();
  }
}

export function startScheduler(sendTime: string) {
  if (task) {
    task.stop();
    task = null;
  }
  const [hh, mm] = sendTime.split(':').map((s) => parseInt(s, 10));
  if (isNaN(hh) || isNaN(mm)) return;
  const spec = `${mm} ${hh} * * *`;
  currentSpec = spec;

  task = cron.schedule(
    spec,
    () => {
      const ws = currentWeekStart();
      const slot = todaySlot();
      fire(slot, ws);
    },
    { timezone: 'Asia/Kolkata' }
  );
  task.start();
}

export function registerSchedulerIpc() {
  ipcMain.handle('scheduler:start', (_e, sendTime: string) => {
    startScheduler(sendTime);
    return { ok: true, spec: currentSpec };
  });

  ipcMain.handle('scheduler:checkMissed', () => {
    // On launch: if any past slots for today's selection have no send_log row
    // (or only 'queued' status), return them so the renderer can show "queued" banner.
    const db = getDb();
    const ws = currentWeekStart();
    const todayS = todaySlot();
    const rows = db
      .prepare(
        `SELECT s.slot, s.verse_id, v.book, v.chapter, v.verse, v.text_tamil,
                (SELECT status FROM send_log WHERE week_start_date = s.week_start_date AND slot = s.slot
                  ORDER BY id DESC LIMIT 1) as last_status
         FROM weekly_selections s
         JOIN verses v ON v.id = s.verse_id
         WHERE s.week_start_date = ? AND s.slot <= ? AND s.posted_at IS NULL`
      )
      .all(ws, todayS);
    return rows.map((r: any) => ({
      ...r,
      dateStr: dateForSlot(ws, r.slot),
      weekStart: ws,
    }));
  });

  ipcMain.handle('scheduler:currentWeekStart', () => currentWeekStart());
  ipcMain.handle('scheduler:todaySlot', () => todaySlot());
}
