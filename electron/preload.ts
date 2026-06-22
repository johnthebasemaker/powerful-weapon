import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Verses
  verses: {
    search: (rootWord: string, limit?: number) => ipcRenderer.invoke('verses:search', rootWord, limit),
    get: (id: number) => ipcRenderer.invoke('verses:get', id),
    toggleMemory: (id: number, isMemory: boolean) =>
      ipcRenderer.invoke('verses:toggleMemory', id, isMemory),
    count: () => ipcRenderer.invoke('verses:count'),
    importBulk: (rows: any[]) => ipcRenderer.invoke('verses:importBulk', rows),
  },

  // Weekly selections
  selections: {
    get: (weekStart: string) => ipcRenderer.invoke('selections:get', weekStart),
    save: (weekStart: string, rootWord: string, verseIds: number[]) =>
      ipcRenderer.invoke('selections:save', weekStart, rootWord, verseIds),
    count: (weekStart: string) => ipcRenderer.invoke('selections:count', weekStart),
    markPosted: (weekStart: string, slot: number) =>
      ipcRenderer.invoke('selections:markPosted', weekStart, slot),
  },

  // Users
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (name: string, phone: string, joinedDate: string) =>
      ipcRenderer.invoke('users:create', name, phone, joinedDate),
    update: (id: number, patch: any) => ipcRenderer.invoke('users:update', id, patch),
    delete: (id: number) => ipcRenderer.invoke('users:delete', id),
    importCsv: (rows: any[]) => ipcRenderer.invoke('users:importCsv', rows),
  },

  // Voice notes
  voiceNotes: {
    list: (weekStart?: string) => ipcRenderer.invoke('voiceNotes:list', weekStart),
    listGrouped: (weekStart: string) => ipcRenderer.invoke('voiceNotes:listGrouped', weekStart),
    detailsByFile: (userId: number, weekStart: string, filePath: string) =>
      ipcRenderer.invoke('voiceNotes:detailsByFile', userId, weekStart, filePath),
    fileExists: (userId: number, weekStart: string, filePath: string) =>
      ipcRenderer.invoke('voiceNotes:fileExists', userId, weekStart, filePath),
    deleteByFile: (userId: number, weekStart: string, filePath: string) =>
      ipcRenderer.invoke('voiceNotes:deleteByFile', userId, weekStart, filePath),
    deleteAllForWeek: (weekStart: string) => ipcRenderer.invoke('voiceNotes:deleteAllForWeek', weekStart),
    deleteOne: (id: number) => ipcRenderer.invoke('voiceNotes:deleteOne', id),
    create: (vn: any) => ipcRenderer.invoke('voiceNotes:create', vn),
    saveGrade: (id: number, transcript: string, grades: any) =>
      ipcRenderer.invoke('voiceNotes:saveGrade', id, transcript, grades),
  },

  // Files (dialogs)
  files: {
    pickVoiceNotes: () => ipcRenderer.invoke('files:pickVoiceNotes'),
    importVoiceNote: (srcPath: string) => ipcRenderer.invoke('files:importVoiceNote', srcPath),
    pickCsv: () => ipcRenderer.invoke('files:pickCsv'),
  },

  // Leaderboards
  leaderboard: {
    consistency: (yearStart: string, yearEnd: string) =>
      ipcRenderer.invoke('leaderboard:consistency', yearStart, yearEnd),
    scores: (weekStart: string | null, yearStart: string, yearEnd: string) =>
      ipcRenderer.invoke('leaderboard:scores', weekStart, yearStart, yearEnd),
  },

  // Settings
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  },

  // WhatsApp
  whatsapp: {
    openWeb: () => ipcRenderer.invoke('whatsapp:openWeb'),
    prepareSend: (payload: any) => ipcRenderer.invoke('whatsapp:prepareSend', payload),
    markSentBySlot: (weekStart: string, slot: number) =>
      ipcRenderer.invoke('whatsapp:markSentBySlot', weekStart, slot),
    copyMessage: (message: string) => ipcRenderer.invoke('whatsapp:copyMessage', message),
  },

  // Scheduler
  scheduler: {
    start: (sendTime: string) => ipcRenderer.invoke('scheduler:start', sendTime),
    checkMissed: () => ipcRenderer.invoke('scheduler:checkMissed'),
    currentWeekStart: () => ipcRenderer.invoke('scheduler:currentWeekStart'),
    todaySlot: () => ipcRenderer.invoke('scheduler:todaySlot'),
  },

  // Whisper
  whisper: {
    check: () => ipcRenderer.invoke('whisper:check'),
    transcribe: (filePath: string) => ipcRenderer.invoke('whisper:transcribe', { filePath }),
    transcribeAndGrade: (payload: any) => ipcRenderer.invoke('whisper:transcribeAndGrade', payload),
    transcribeAndGradeWeek: (payload: { userId: number; filePath: string; weekStart: string }) =>
      ipcRenderer.invoke('whisper:transcribeAndGradeWeek', payload),
  },

  // Backup
  backup: {
    pickFolder: () => ipcRenderer.invoke('backup:pickFolder'),
    runNow: () => ipcRenderer.invoke('backup:runNow'),
    lastRun: () => ipcRenderer.invoke('backup:lastRun'),
  },

  // Send log
  sendLog: {
    recent: (limit?: number) => ipcRenderer.invoke('sendLog:recent', limit),
    pendingQueue: () => ipcRenderer.invoke('sendLog:pendingQueue'),
  },

  // Event listeners (renderer subscribes)
  on: (channel: string, listener: (...args: any[]) => void) => {
    const allowed = ['scheduler:fire', 'whatsapp:fire', 'whisper:progress'];
    if (!allowed.includes(channel)) return () => {};
    const sub = (_e: any, ...args: any[]) => listener(...args);
    ipcRenderer.on(channel, sub);
    return () => ipcRenderer.removeListener(channel, sub);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
