import { ipcMain, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { voiceNotesDir } from '../lib/paths';

export function registerFilesIpc() {
  ipcMain.handle('files:pickVoiceNotes', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Select WhatsApp voice notes',
      filters: [
        { name: 'Audio', extensions: ['opus', 'ogg', 'mp3', 'm4a', 'wav', 'aac'] },
      ],
    });
    if (r.canceled) return [];
    return r.filePaths;
  });

  ipcMain.handle('files:importVoiceNote', async (_e, srcPath: string) => {
    if (!fs.existsSync(srcPath)) return { ok: false, error: 'Source not found' };
    const ts = Date.now();
    const ext = path.extname(srcPath) || '.opus';
    const dest = path.join(voiceNotesDir(), `vn-${ts}-${path.basename(srcPath)}`);
    fs.copyFileSync(srcPath, dest);
    return { ok: true, path: dest, size: fs.statSync(dest).size };
  });

  ipcMain.handle('files:pickCsv', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Select users CSV',
      filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const content = fs.readFileSync(r.filePaths[0], 'utf8');
    return { path: r.filePaths[0], content };
  });
}
