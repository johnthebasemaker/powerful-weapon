// A finished-but-unsent recording is kept on the phone (IndexedDB) until it is
// sent, so a failed upload or leaving the Record screen never loses a take.

import type { Take } from './useRecorder';

export interface PendingTake extends Take { weekStart: string; savedAt: number }

const DB_NAME = 'pw-pending';
const STORE = 'takes';
const KEY = 'current';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export async function savePending(weekStart: string, take: Take): Promise<void> {
  try { await tx('readwrite', (s) => s.put({ ...take, weekStart, savedAt: Date.now() }, KEY)); } catch { /* storage unavailable */ }
}

export async function loadPending(weekStart: string): Promise<PendingTake | null> {
  try {
    const p = await tx<PendingTake | undefined>('readonly', (s) => s.get(KEY));
    return p && p.weekStart === weekStart && p.blob ? p : null;
  } catch {
    return null;
  }
}

export async function clearPending(): Promise<void> {
  try { await tx('readwrite', (s) => s.delete(KEY)); } catch { /* ignore */ }
}
