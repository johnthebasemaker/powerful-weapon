import { ipcMain, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { dbPath } from '../lib/paths';
import { getDb } from '../lib/database';

export function registerBackupIpc() {
  ipcMain.handle('backup:pickFolder', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose backup folder',
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return r.filePaths[0];
  });

  ipcMain.handle('backup:runNow', async () => {
    const settings = getDb().prepare('SELECT value FROM settings WHERE key = ?').get('backup_folder') as { value: string } | undefined;
    const folder = settings?.value;
    if (!folder || !fs.existsSync(folder)) return { ok: false, error: 'Backup folder not set' };
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(folder, `powerful-weapon-backup-${ts}.db`);
    fs.copyFileSync(dbPath(), dest);
    return { ok: true, path: dest };
  });

  ipcMain.handle('backup:lastRun', async () => {
    const settings = getDb().prepare('SELECT value FROM settings WHERE key = ?').get('backup_folder') as { value: string } | undefined;
    const folder = settings?.value;
    if (!folder || !fs.existsSync(folder)) return null;
    const files = fs.readdirSync(folder)
      .filter((f) => f.startsWith('powerful-weapon-backup-') && f.endsWith('.db'))
      .sort()
      .reverse();
    return files[0] ? path.join(folder, files[0]) : null;
  });
}

/**
 * Auto-backup runner: copies DB into the configured folder if the last backup
 * is older than backup_frequency_days. Called from main on app launch.
 */
export function maybeAutoBackup() {
  const db = getDb();
  const enabled = db.prepare('SELECT value FROM settings WHERE key = ?').get('backup_enabled') as { value: string } | undefined;
  if (enabled?.value !== 'true') return;
  const folderRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('backup_folder') as { value: string } | undefined;
  const folder = folderRow?.value;
  if (!folder || !fs.existsSync(folder)) return;
  const freqRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('backup_frequency_days') as { value: string } | undefined;
  const freqDays = parseInt(freqRow?.value ?? '7', 10);

  const files = fs.readdirSync(folder)
    .filter((f) => f.startsWith('powerful-weapon-backup-') && f.endsWith('.db'))
    .sort()
    .reverse();
  if (files.length) {
    const lastPath = path.join(folder, files[0]);
    const ageDays = (Date.now() - fs.statSync(lastPath).mtimeMs) / (1000 * 60 * 60 * 24);
    if (ageDays < freqDays) return;
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(dbPath(), path.join(folder, `powerful-weapon-backup-${ts}.db`));
}
