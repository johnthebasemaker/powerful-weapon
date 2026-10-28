// Auto-marking of in-app recordings: split per verse → transcribe on the Worker
// (Whisper or Sarvam) → grade each verse with the shared grading library →
// optional calibration learnt from the admin's own manual scores.

import { grade } from '../../electron/lib/grading';
import { normalizeTamil } from '../../electron/lib/tamil';
import { api } from './api';
import { splitRecording } from './audioChunks';
import { fetchAudio, scorePairs, Submission, transcribe } from './remote';

export type Engine = 'whisper' | 'sarvam';
export interface WeekVerse { slot: number; book: string; chapter: number; verse: number; text: string }
export interface VerseScore {
  slot: number; transcript: string; accuracy: number; fluency: number; reference: number; total: number; seconds: number;
}
export interface MarkResult { engine: Engine; total: number; perVerse: VerseScore[]; transcript: string; split: boolean }

/** Distinctive words of a verse — Sarvam "keyterms" help it spell rare Bible words. */
function keyterms(v: WeekVerse): string[] {
  const words = normalizeTamil(v.text).split(' ').filter((w) => w.length >= 6);
  return Array.from(new Set([v.book, ...words])).slice(0, 15);
}

async function transcribeClips(clips: { base64: string; mimeType: string }[], engine: Engine, v?: WeekVerse): Promise<string> {
  const parts: string[] = [];
  for (const c of clips) {
    const r = await transcribe({
      audioBase64: c.base64, mimeType: c.mimeType, engine,
      // Whisper: the book name only — enough to fix its spelling without putting
      // the verse's words in its mouth (that would inflate weak recitations).
      prompt: engine === 'whisper' && v ? `${v.book} ${v.chapter}:${v.verse}` : undefined,
      keyterms: engine === 'sarvam' && v ? keyterms(v) : undefined,
    });
    parts.push(r.transcript.trim());
  }
  return parts.join(' ').trim();
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function autoMark(sub: Submission, verses: WeekVerse[], engine: Engine): Promise<MarkResult> {
  const sorted = [...verses].sort((a, b) => a.slot - b.slot);
  const marks: number[] = (() => { try { return JSON.parse(sub.marks || '[]'); } catch { return []; } })();
  const blob = await fetchAudio(sub.id);
  const { perVerse, groups, seconds } = await splitRecording(blob, marks, sorted.length);

  const scores: VerseScore[] = [];
  let fullTranscript = '';
  if (perVerse) {
    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i];
      const t = await transcribeClips(groups[i], engine, v);
      const secs = groups[i].reduce((a, c) => a + c.seconds, 0);
      const g = grade({ transcript: t, referenceText: v.text, referenceCitation: v, durationSeconds: secs });
      scores.push({ slot: v.slot, transcript: t, accuracy: g.accuracy, fluency: g.fluency, reference: g.reference, total: g.total, seconds: secs });
    }
    fullTranscript = scores.map((s) => s.transcript).join(' | ');
  } else {
    // No verse marks (or a different count): one transcript, searched for each verse.
    fullTranscript = await transcribeClips(groups[0], engine);
    const totalChars = sorted.reduce((a, v) => a + v.text.length, 0) || 1;
    for (const v of sorted) {
      const secs = (seconds * v.text.length) / totalChars;
      const g = grade({ transcript: fullTranscript, referenceText: v.text, referenceCitation: v, durationSeconds: secs });
      scores.push({ slot: v.slot, transcript: '', accuracy: g.accuracy, fluency: g.fluency, reference: g.reference, total: g.total, seconds: secs });
    }
  }
  const total = round1(scores.reduce((a, s) => a + s.total, 0) / Math.max(1, scores.length));
  return { engine, total, perVerse: scores, transcript: fullTranscript, split: perVerse };
}

/* ── Calibration: learn the admin's marking style from their own manual scores ── */

export interface Calibration { n: number; a: number; b: number; maeBefore: number; maeAfter: number }

/** Least-squares fit manual ≈ a·auto + b. Used once there are ≥ 8 pairs. */
export function fitCalibration(pairs: { auto_total: number; manual_total: number }[]): Calibration | null {
  const n = pairs.length;
  if (n < 8) return null;
  const mx = pairs.reduce((s, p) => s + p.auto_total, 0) / n;
  const my = pairs.reduce((s, p) => s + p.manual_total, 0) / n;
  const sxx = pairs.reduce((s, p) => s + (p.auto_total - mx) ** 2, 0);
  const sxy = pairs.reduce((s, p) => s + (p.auto_total - mx) * (p.manual_total - my), 0);
  const a = sxx > 1e-6 ? Math.max(0.3, Math.min(2, sxy / sxx)) : 1;
  const b = my - a * mx;
  const mae = (f: (x: number) => number) => pairs.reduce((s, p) => s + Math.abs(f(p.auto_total) - p.manual_total), 0) / n;
  return { n, a, b, maeBefore: mae((x) => x), maeAfter: mae((x) => a * x + b) };
}

export function applyCalibration(c: Calibration | null, auto: number): number {
  if (!c || c.maeAfter >= c.maeBefore) return auto;
  return round1(Math.max(0, Math.min(100, c.a * auto + c.b)));
}

export async function loadCalibration(): Promise<Calibration | null> {
  try { return fitCalibration(await scorePairs()); } catch { return null; }
}

/* ── Keep the local leaderboards in step with in-app recordings ── */

export async function syncToLeaderboard(sub: Submission, result: MarkResult): Promise<void> {
  const users = (await api().users.list()) as { id: number; name: string }[];
  const k = (n: string) => n.normalize('NFC').toLowerCase().replace(/\s+/g, '');
  let user = users.find((u) => k(u.name) === k(sub.name));
  if (!user) {
    const r = (await api().users.create(sub.name, `app-member-${sub.member_id}`, sub.created_at.slice(0, 10))) as { id: number };
    user = { id: r.id, name: sub.name };
  }
  const file = `remote:${sub.id}`;
  await api().voiceNotes.deleteByFile(user.id, sub.week_start, file);
  for (const s of result.perVerse) {
    const vn = (await api().voiceNotes.create({ user_id: user.id, week_start_date: sub.week_start, verse_slot: s.slot, file_path: file })) as { id: number };
    await api().voiceNotes.saveGrade(vn.id, s.transcript || result.transcript, {
      accuracy: s.accuracy, fluency: s.fluency, reference: s.reference, total: s.total, durationSeconds: s.seconds,
    });
  }
}
