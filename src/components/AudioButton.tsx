import { useEffect, useRef, useState } from 'react';
import { fetchAudio } from '../lib/remote';
import { toast } from '../lib/toast';
import { cx } from './ui';

/** Play/stop a server recording; downloads it on first tap (members and admin). */
export default function AudioButton({ submissionId, available = true, className }: { submissionId: number; available?: boolean; className?: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef('');

  useEffect(() => () => { audio.current?.pause(); if (url.current) URL.revokeObjectURL(url.current); }, []);

  async function toggle() {
    if (state === 'playing') { audio.current?.pause(); setState('idle'); return; }
    try {
      if (!audio.current) {
        setState('loading');
        url.current = URL.createObjectURL(await fetchAudio(submissionId));
        audio.current = new Audio(url.current);
        audio.current.onended = () => setState('idle');
      }
      await audio.current.play();
      setState('playing');
    } catch (e: any) {
      setState('idle');
      toast(e.message ?? 'Could not play', 'error');
    }
  }

  if (!available) return <span className="text-xs text-gray-400">Audio removed</span>;
  return (
    <button onClick={toggle} aria-label={state === 'playing' ? 'Stop' : 'Play recording'}
      className={cx('w-10 h-10 rounded-full grid place-items-center shrink-0 transition',
        state === 'playing' ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700', className)}>
      {state === 'loading' ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : state === 'playing'
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
    </button>
  );
}
