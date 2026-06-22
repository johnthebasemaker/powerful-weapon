import { ipcMain, shell, clipboard, BrowserWindow } from 'electron';
import { getDb } from '../lib/database';

/**
 * WhatsApp's deep-link only supports individual phone numbers, NOT groups.
 * Practical flow for $0 group posting:
 *   1. Build the formatted message
 *   2. Copy to clipboard
 *   3. Open WhatsApp Web (or WhatsApp Desktop if installed)
 *   4. User pastes (Ctrl/Cmd+V) into the target group and presses Enter
 *   5. User clicks "Mark as sent" in our app
 */

export function formatVerseMessage(book: string, chapter: number, verse: number, text: string, dateStr: string): string {
  return [
    'இன்றைய ரேமா (வார்த்தை)',
    `(${dateStr})`,
    '',
    `*${book} ${chapter}:${verse}*`,
    `*${text}*`,
  ].join('\n');
}

export function registerWhatsAppIpc() {
  ipcMain.handle('whatsapp:openWeb', async () => {
    await shell.openExternal('https://web.whatsapp.com/');
    return { ok: true };
  });

  ipcMain.handle('whatsapp:prepareSend', async (_e, payload: {
    book: string; chapter: number; verse: number; text: string; dateStr: string;
    verseId: number; weekStart: string; slot: number;
  }) => {
    const message = formatVerseMessage(
      payload.book, payload.chapter, payload.verse, payload.text, payload.dateStr
    );
    clipboard.writeText(message);

    // Log as queued in send_log so the dashboard shows pending state
    getDb()
      .prepare(
        `INSERT INTO send_log (scheduled_at, status, verse_id, week_start_date, slot)
         VALUES (datetime('now'), 'queued', ?, ?, ?)`
      )
      .run(payload.verseId, payload.weekStart, payload.slot);

    await shell.openExternal('https://web.whatsapp.com/');
    return { ok: true, message };
  });

  ipcMain.handle('whatsapp:markSent', (_e, sendLogId: number) => {
    getDb()
      .prepare(`UPDATE send_log SET status = 'sent', sent_at = datetime('now') WHERE id = ?`)
      .run(sendLogId);
    return { ok: true };
  });

  ipcMain.handle('whatsapp:markSentBySlot', (_e, weekStart: string, slot: number) => {
    const db = getDb();
    db.prepare(
      `UPDATE send_log SET status = 'sent', sent_at = datetime('now')
       WHERE week_start_date = ? AND slot = ? AND status = 'queued'`
    ).run(weekStart, slot);
    db.prepare(
      `UPDATE weekly_selections SET posted_at = datetime('now')
       WHERE week_start_date = ? AND slot = ?`
    ).run(weekStart, slot);
    return { ok: true };
  });

  ipcMain.handle('whatsapp:copyMessage', (_e, message: string) => {
    clipboard.writeText(message);
    return { ok: true };
  });

  // Notify renderer when a scheduled message fires
  ipcMain.on('whatsapp:notify-fire', (_e, slot: number, weekStart: string) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send('whatsapp:fire', { slot, weekStart });
  });
}
