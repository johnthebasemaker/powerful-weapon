import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { getDb, closeDb } from './lib/database';
import { registerDbIpc } from './ipc/db';
import { registerWhatsAppIpc } from './ipc/whatsapp';
import { registerSchedulerIpc, startScheduler } from './ipc/scheduler';
import { registerWhisperIpc } from './ipc/whisper';
import { registerBackupIpc, maybeAutoBackup } from './ipc/backup';
import { registerFilesIpc } from './ipc/files';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'Powerful Weapon',
    backgroundColor: '#f5f7ff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173/');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize DB (creates schema + seeds sample Bible on first launch)
  const db = getDb();

  // Register IPC handlers
  registerDbIpc();
  registerWhatsAppIpc();
  registerSchedulerIpc();
  registerWhisperIpc();
  registerBackupIpc();
  registerFilesIpc();

  // Start scheduler from saved setting
  const sendTime = (db.prepare('SELECT value FROM settings WHERE key = ?').get('send_time') as { value: string } | undefined)?.value ?? '00:00';
  startScheduler(sendTime);

  // Auto-backup if configured
  try { maybeAutoBackup(); } catch (e) { console.error('Backup failed:', e); }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});
