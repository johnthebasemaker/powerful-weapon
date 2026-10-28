// Vendor-agnostic speech-to-text. The app never holds an STT API key: it POSTs
// audio to a small proxy URL (configured in Settings → stt_proxy_url) that the
// admin deploys once. The proxy picks the vendor (Google / OpenAI / Deepgram)
// and returns a transcript. Contract:
//   POST <url>  { audioBase64, mimeType, language }  ->  { transcript, durationSeconds? }

export interface SttResult {
  transcript: string;
  durationSeconds: number;
}

/** Read audio duration client-side from a data URL (proxy may not return it). */
export function getAudioDurationSeconds(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => resolve(0);
    audio.src = dataUrl;
  });
}

export async function transcribeViaProxy(
  proxyUrl: string,
  base64: string,
  mimeType: string,
  language = 'ta',
  secret?: string,
): Promise<SttResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['x-stt-secret'] = secret; // matches PROXY_SECRET on the Worker
  let res: Response;
  try {
    res = await fetch(proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ audioBase64: base64, mimeType, language }),
    });
  } catch {
    throw new Error('Could not reach the Speech-to-text proxy. Check the URL in Settings and your internet connection.');
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`STT proxy error (HTTP ${res.status}). ${detail.slice(0, 140)}`);
  }
  const data = await res.json();
  return {
    transcript: String(data.transcript ?? ''),
    durationSeconds: Number(data.durationSeconds ?? 0),
  };
}
