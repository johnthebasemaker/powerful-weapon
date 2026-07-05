// Receive a voice note shared from WhatsApp (Share → Powerful Weapon) and route
// it into the Voice Inbox import flow. Android only; no-op elsewhere.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { isNative } from './platform';
import { registerPickedAudioFromUri } from './db/mobileApi';
import { toast } from './toast';

// Queue covers the cold-start case (audio arrives before Voice Inbox mounts);
// the listener set covers the warm case (app already open).
const pendingShared: string[] = [];
const listeners = new Set<(keys: string[]) => void>();

/** Voice Inbox drains any audio shared in before it mounted. */
export function takePendingShared(): string[] {
  return pendingShared.splice(0);
}

export function onSharedAudio(cb: (keys: string[]) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

async function checkForSharedAudio(): Promise<void> {
  try {
    const { SendIntent } = await import('send-intent');
    const result = await SendIntent.checkSendIntentReceived();
    if (result?.url) {
      const key = await registerPickedAudioFromUri(result.url, result.type, result.title);
      if (key) {
        pendingShared.push(key);
        listeners.forEach((l) => l([key]));
      } else {
        // Couldn't read the shared file — tell the admin instead of failing silently.
        toast('Couldn’t read the shared voice note. Use “Pick voice note files” in Voice Inbox instead.', 'error', 6000);
      }
      SendIntent.finish();
    }
  } catch {
    // No pending share intent — the normal case. Ignore.
  }
}

/** Call once at app boot (App.tsx). Navigates to Voice Inbox on a shared note. */
export function useShareIntent(): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNative()) return;
    const off = onSharedAudio(() => {
      toast('Voice note received — choose the speaker to grade it.', 'success');
      navigate('/voice-inbox');
    });
    checkForSharedAudio(); // cold start
    let sub: { remove: () => void } | undefined;
    App.addListener('resume', checkForSharedAudio).then((h) => { sub = h; }); // warm resume
    return () => { off(); sub?.remove(); };
  }, [navigate]);
}
