import { ipcMain, BrowserWindow } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { whisperBinaryPath, whisperModelPath, voiceNotesDir } from '../lib/paths';
import { grade, GradingInput } from '../lib/grading';
import { getDb } from '../lib/database';

/**
 * Whisper.cpp bridge. The binary + model are not bundled with the source
 * (the model alone is ~1.5GB). The user runs a one-time setup script that
 * downloads whisper.cpp and the ggml-large-v3 model into resources/whisper/.
 * See README.md "First-time setup".
 */

export interface TranscribeOptions {
  filePath: string;
  language?: string; // default 'ta'
}

export interface TranscribeResult {
  ok: boolean;
  transcript: string;
  durationSeconds: number;
  segments: Array<{ start: number; end: number; text: string }>;
  error?: string;
}

function isModelReady(): { ok: boolean; reason?: string } {
  const bin = whisperBinaryPath();
  const model = whisperModelPath();
  if (!fs.existsSync(bin)) return { ok: false, reason: `Whisper binary missing: ${bin}` };
  if (!fs.existsSync(model)) return { ok: false, reason: `Whisper model missing: ${model}` };
  return { ok: true };
}

function probeDurationSeconds(filePath: string): Promise<number> {
  // Best-effort: use ffprobe if available, otherwise fall back to 0 and
  // let the renderer set duration via the HTMLAudio element.
  return new Promise((resolve) => {
    const ff = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    let out = '';
    ff.stdout.on('data', (b) => (out += b.toString()));
    ff.on('close', () => resolve(parseFloat(out.trim()) || 0));
    ff.on('error', () => resolve(0));
  });
}

// whisper.cpp accepts wav/mp3/ogg/flac but not opus. We transcode to mono 16kHz WAV
// (Whisper's native rate) AND apply loudness normalization — WhatsApp voice
// notes are low-bitrate Opus, and Whisper's decoder is very sensitive to level.
// Without normalization, fallbacks fire mid-clip and content gets dropped.
function transcodeToWav(srcPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const dest = path.join(os.tmpdir(), `pw-${Date.now()}-${path.basename(srcPath)}.wav`);
    const ff = spawn('ffmpeg', [
      '-y', '-i', srcPath,
      '-af', 'loudnorm=I=-16:LRA=11:TP=-1.5',
      '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
      dest,
    ]);
    let stderr = '';
    ff.stderr.on('data', (b) => (stderr += b.toString()));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0 && fs.existsSync(dest)) resolve(dest);
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-300)}`));
    });
  });
}

function runWhisper(filePath: string, language = 'ta'): Promise<TranscribeResult> {
  return new Promise(async (resolve) => {
    const bin = whisperBinaryPath();
    const model = whisperModelPath();
    const outBase = path.join(voiceNotesDir(), `transcript-${Date.now()}`);

    // Transcode if not already wav/mp3/ogg/flac
    let inputPath = filePath;
    let tempWav: string | null = null;
    const ext = path.extname(filePath).toLowerCase();
    if (!['.wav', '.mp3', '.ogg', '.flac'].includes(ext)) {
      try {
        tempWav = await transcodeToWav(filePath);
        inputPath = tempWav;
      } catch (e: any) {
        return resolve({
          ok: false, transcript: '', durationSeconds: 0, segments: [],
          error: `ffmpeg transcode failed: ${e.message}`,
        });
      }
    }

    const args = [
      '-m', model,
      '-f', inputPath,
      '-l', language,
      '-bs', '5',       // beam search (vs. greedy) — much better for Tamil
      '-bo', '5',       // best-of: keep 5 candidates
      '--max-len', '80',// limit segment length so silences don't swallow content
      '-oj',
      '-of', outBase,
      '-nt',
    ];
    const proc = spawn(bin, args);
    let stderr = '';
    proc.stderr.on('data', (b) => (stderr += b.toString()));
    proc.on('error', (err) => {
      if (tempWav) try { fs.unlinkSync(tempWav); } catch {}
      resolve({
        ok: false, transcript: '', durationSeconds: 0, segments: [],
        error: err.message,
      });
    });
    proc.on('close', async (code) => {
      if (code !== 0) {
        if (tempWav) try { fs.unlinkSync(tempWav); } catch {}
        return resolve({
          ok: false, transcript: '', durationSeconds: 0, segments: [],
          error: `whisper exit ${code}: ${stderr.slice(-500)}`,
        });
      }
      try {
        const json = JSON.parse(fs.readFileSync(outBase + '.json', 'utf8'));
        const segments = (json.transcription ?? []).map((t: any) => ({
          start: (t.offsets?.from ?? 0) / 1000,
          end: (t.offsets?.to ?? 0) / 1000,
          text: (t.text ?? '').trim(),
        }));
        const transcript = segments.map((s: any) => s.text).join(' ').trim();
        const durationSeconds = await probeDurationSeconds(filePath);
        try { fs.unlinkSync(outBase + '.json'); } catch {}
        if (tempWav) try { fs.unlinkSync(tempWav); } catch {}
        resolve({ ok: true, transcript, durationSeconds, segments });
      } catch (e: any) {
        if (tempWav) try { fs.unlinkSync(tempWav); } catch {}
        resolve({
          ok: false, transcript: '', durationSeconds: 0, segments: [],
          error: `parse error: ${e.message}`,
        });
      }
    });
  });
}

export function registerWhisperIpc() {
  ipcMain.handle('whisper:check', () => isModelReady());

  ipcMain.handle('whisper:transcribe', async (_e, opts: TranscribeOptions) => {
    const ready = isModelReady();
    if (!ready.ok) return { ok: false, error: ready.reason };
    return runWhisper(opts.filePath, opts.language ?? 'ta');
  });

  ipcMain.handle(
    'whisper:transcribeAndGrade',
    async (_e, payload: {
      voiceNoteId: number;
      filePath: string;
      referenceText: string;
      referenceCitation: GradingInput['referenceCitation'];
    }) => {
      const ready = isModelReady();
      if (!ready.ok) return { ok: false, error: ready.reason };

      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('whisper:progress', { id: payload.voiceNoteId, stage: 'transcribing' });

      const res = await runWhisper(payload.filePath, 'ta');
      if (!res.ok) return res;

      const gradeResult = grade({
        transcript: res.transcript,
        referenceText: payload.referenceText,
        referenceCitation: payload.referenceCitation,
        durationSeconds: res.durationSeconds,
      });

      getDb()
        .prepare(
          `UPDATE voice_notes
           SET transcript = ?, accuracy_score = ?, fluency_score = ?, reference_score = ?, total_score = ?, duration_seconds = ?, graded_at = datetime('now')
           WHERE id = ?`
        )
        .run(
          res.transcript,
          gradeResult.accuracy,
          gradeResult.fluency,
          gradeResult.reference,
          gradeResult.total,
          res.durationSeconds,
          payload.voiceNoteId
        );

      win?.webContents.send('whisper:progress', { id: payload.voiceNoteId, stage: 'done' });
      return { ok: true, transcript: res.transcript, grade: gradeResult };
    }
  );

  /**
   * "Grade all 7 verses" mode — used when a member sends a single long voice
   * note containing all 7 weekly verses recited in sequence.
   *
   * - Transcribes ONCE (expensive Whisper run happens only once).
   * - Grades the transcript against each of the 7 weekly selections, using the
   *   grader's best-window logic to find each verse inside the longer audio.
   * - Inserts 7 voice_notes rows (one per slot) sharing the same audio file,
   *   each with its own transcript / scores / graded_at.
   * - Returns per-verse grades + computed weekly average.
   */
  ipcMain.handle(
    'whisper:transcribeAndGradeWeek',
    async (_e, payload: {
      userId: number;
      filePath: string;
      weekStart: string;
    }) => {
      const ready = isModelReady();
      if (!ready.ok) return { ok: false, error: ready.reason };

      const db = getDb();
      const selections = db
        .prepare(
          `SELECT s.slot, v.book, v.chapter, v.verse, v.text_tamil
           FROM weekly_selections s JOIN verses v ON v.id = s.verse_id
           WHERE s.week_start_date = ?
           ORDER BY s.slot ASC`
        )
        .all(payload.weekStart) as Array<{
          slot: number; book: string; chapter: number; verse: number; text_tamil: string;
        }>;

      if (selections.length === 0) {
        return { ok: false, error: 'No verses saved for this week. Go to Verse Picker first.' };
      }

      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('whisper:progress', { stage: 'transcribing', weekStart: payload.weekStart });

      const res = await runWhisper(payload.filePath, 'ta');
      if (!res.ok) return res;

      const insertVn = db.prepare(
        `INSERT INTO voice_notes (user_id, week_start_date, verse_slot, file_path, transcript,
           accuracy_score, fluency_score, reference_score, total_score, duration_seconds, graded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      );

      const results: Array<{
        slot: number; book: string; chapter: number; verse: number;
        accuracy: number; fluency: number; reference: number; total: number;
      }> = [];

      const tx = db.transaction(() => {
        for (const sel of selections) {
          const g = grade({
            transcript: res.transcript,
            referenceText: sel.text_tamil,
            referenceCitation: { book: sel.book, chapter: sel.chapter, verse: sel.verse },
            durationSeconds: res.durationSeconds,
          });
          insertVn.run(
            payload.userId, payload.weekStart, sel.slot, payload.filePath,
            res.transcript, g.accuracy, g.fluency, g.reference, g.total, res.durationSeconds
          );
          results.push({
            slot: sel.slot, book: sel.book, chapter: sel.chapter, verse: sel.verse,
            accuracy: g.accuracy, fluency: g.fluency, reference: g.reference, total: g.total,
          });
        }
      });
      tx();

      const avgTotal = results.reduce((a, b) => a + b.total, 0) / results.length;
      win?.webContents.send('whisper:progress', { stage: 'done', weekStart: payload.weekStart });
      return { ok: true, transcript: res.transcript, results, weeklyAverage: Math.round(avgTotal * 10) / 10 };
    }
  );
}
