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
): Promise<SttResult> {
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64: base64, mimeType, language }),
  });
  if (!res.ok) throw new Error(`STT proxy returned HTTP ${res.status}`);
  const data = await res.json();
  return {
    transcript: String(data.transcript ?? ''),
    durationSeconds: Number(data.durationSeconds ?? 0),
  };
}
