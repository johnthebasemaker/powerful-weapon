// Split a recording into per-verse clips for transcription.
//
// Members tap "Next verse" while recording, which stores the start time of each
// verse (marks). Cutting at those marks lets every verse be transcribed and
// graded against its own text — more accurate than searching one long
// transcript — and keeps each clip under Sarvam's ~30 s sync limit. Clips are
// re-encoded as 16 kHz mono WAV, the format both Whisper and Sarvam prefer.

const RATE = 16000;
const MAX_CLIP_S = 28;

export interface Clip { base64: string; mimeType: 'audio/wav'; seconds: number }

export async function decodeTo16kMono(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    const frames = Math.ceil(decoded.duration * RATE);
    const off = new OfflineAudioContext(1, Math.max(1, frames), RATE);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    return (await off.startRendering()).getChannelData(0);
  } finally {
    ctx.close().catch(() => {});
  }
}

/** Index of the quietest 100 ms frame within [from, to) — a natural pause to cut at. */
function quietestCut(pcm: Float32Array, from: number, to: number): number {
  const win = RATE / 10;
  let best = to, bestEnergy = Infinity;
  for (let i = from; i + win <= to; i += win / 2) {
    let e = 0;
    for (let j = i; j < i + win; j++) e += pcm[j] * pcm[j];
    if (e < bestEnergy) { bestEnergy = e; best = i + win / 2; }
  }
  return Math.floor(best);
}

/** Break a long stretch into ≤28 s pieces, cutting at pauses. */
function subSplit(pcm: Float32Array): Float32Array[] {
  const out: Float32Array[] = [];
  let start = 0;
  while (pcm.length - start > MAX_CLIP_S * RATE) {
    const cut = quietestCut(pcm, start + 18 * RATE, start + MAX_CLIP_S * RATE);
    out.push(pcm.subarray(start, cut));
    start = cut;
  }
  if (pcm.length - start > RATE / 4) out.push(pcm.subarray(start));
  return out;
}

function wavBase64(pcm: Float32Array): string {
  const bytes = new Uint8Array(44 + pcm.length * 2);
  const v = new DataView(bytes.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const toClips = (parts: Float32Array[]): Clip[] =>
  parts.map((p) => ({ base64: wavBase64(p), mimeType: 'audio/wav', seconds: p.length / RATE }));

/**
 * Returns one entry per verse (each a list of ≤28 s clips) when the recording
 * has `verseCount` marks; otherwise a single entry covering the whole recording.
 */
export async function splitRecording(blob: Blob, marks: number[], verseCount: number): Promise<{ perVerse: boolean; groups: Clip[][]; seconds: number }> {
  const pcm = await decodeTo16kMono(blob);
  const seconds = pcm.length / RATE;
  const valid = marks.length === verseCount && marks.every((m, i) => i === 0 || m > marks[i - 1]);
  if (!valid) return { perVerse: false, groups: [toClips(subSplit(pcm))], seconds };
  const groups = marks.map((m, i) => {
    const a = Math.floor(Math.max(0, m) * RATE);
    const b = i + 1 < marks.length ? Math.floor(marks[i + 1] * RATE) : pcm.length;
    return toClips(subSplit(pcm.subarray(a, Math.max(a, b))));
  });
  return { perVerse: true, groups, seconds };
}
