import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { isNative } from './platform';

// Memorisation recorder: no pause, verses never shown, and leaving the app
// (home button, another app, a call) throws the take away — so a recording has
// to be one continuous recitation from memory.

export const MAX_SECONDS = 240;

export type RecState = 'idle' | 'recording' | 'done';
export interface Take { blob: Blob; mimeType: string; seconds: number; marks: number[] }

function pickMime(): string {
  const options = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

export function useRecorder(onAborted: (reason: string) => void) {
  const [state, setState] = useState<RecState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [marks, setMarks] = useState<number[]>([]);
  const [take, setTake] = useState<Take | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const marksRef = useRef<number[]>([]);
  const discard = useRef(false);
  const timer = useRef<number | undefined>();

  const cleanup = () => {
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    document.body.dataset.recording = '';
  };

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  }, []);

  const abort = useCallback((reason: string) => {
    if (!rec.current || rec.current.state === 'inactive') return;
    discard.current = true;
    rec.current.stop();
    onAborted(reason);
  }, [onAborted]);

  const start = useCallback(async () => {
    setTake(null);
    discard.current = false;
    chunks.current = [];
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    stream.current = s;
    const mimeType = pickMime();
    const r = new MediaRecorder(s, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
    rec.current = r;
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = () => {
      const seconds = (Date.now() - startedAt.current) / 1000;
      cleanup();
      if (discard.current) { setState('idle'); return; }
      const type = r.mimeType || mimeType || 'audio/webm';
      setTake({ blob: new Blob(chunks.current, { type }), mimeType: type.split(';')[0], seconds, marks: marksRef.current });
      setState('done');
    };
    marksRef.current = [0];
    setMarks([0]);
    startedAt.current = Date.now();
    setElapsed(0);
    r.start(1000);
    setState('recording');
    document.body.dataset.recording = '1'; // hides the tab bar
    timer.current = window.setInterval(() => {
      const s2 = (Date.now() - startedAt.current) / 1000;
      setElapsed(s2);
      if (s2 >= MAX_SECONDS) r.stop();
    }, 250);
  }, []);

  /** Member taps "Next verse": remember where the next verse starts. */
  const nextVerse = useCallback(() => {
    const t = Math.round(((Date.now() - startedAt.current) / 1000) * 10) / 10;
    marksRef.current = [...marksRef.current, t];
    setMarks(marksRef.current);
  }, []);

  // Leaving the app mid-recitation voids the take.
  useEffect(() => {
    if (state !== 'recording') return;
    const onHide = () => { if (document.visibilityState === 'hidden') abort('You left the app, so this take was cancelled.'); };
    document.addEventListener('visibilitychange', onHide);
    let sub: { remove: () => void } | undefined;
    if (isNative()) App.addListener('pause', () => abort('You left the app, so this take was cancelled.')).then((h) => { sub = h; });
    return () => { document.removeEventListener('visibilitychange', onHide); sub?.remove(); };
  }, [state, abort]);

  // Navigating away from the screen also cancels.
  useEffect(() => () => { discard.current = true; if (rec.current?.state === 'recording') rec.current.stop(); cleanup(); }, []);

  const reset = useCallback(() => { setTake(null); setState('idle'); setElapsed(0); setMarks([]); }, []);

  return { state, elapsed, marks, take, start, stop, nextVerse, reset };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '');
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

export function fmtClock(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
