import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export function userDataDir(): string {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPath(): string {
  return path.join(userDataDir(), 'powerful-weapon.db');
}

export function voiceNotesDir(): string {
  const dir = path.join(userDataDir(), 'voice-notes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function bundledResource(...segments: string[]): string {
  // In dev: resources/ next to project root. In prod: process.resourcesPath
  const base = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '..', '..', 'resources');
  return path.join(base, ...segments);
}

export function whisperBinaryPath(): string {
  // Prefer the flat resources/whisper/whisper-cli (production layout),
  // fall back to resources/whisper/whisper.cpp/build/bin/whisper-cli (dev layout).
  const exe = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
  const flat = bundledResource('whisper', exe);
  if (fs.existsSync(flat)) return flat;
  const devBuild = bundledResource('whisper', 'whisper.cpp', 'build', 'bin', exe);
  return devBuild;
}

/**
 * Where the Whisper model lives at runtime.
 *
 * Models are 3 GB — too large to bundle in the installer (GitHub Releases
 * caps assets at 2 GB, NSIS embedded-payload limit is also 2 GB). The user
 * downloads the model on first launch via the in-app "Set up speech-to-text"
 * banner; it lands in userData where it survives app updates.
 *
 * For backward compatibility we also check the old bundled location, so any
 * existing installations that did ship the model keep working.
 */
export function whisperModelPath(): string {
  const userPath = path.join(userDataWhisperDir(), MODEL_FILENAME);
  if (fs.existsSync(userPath)) return userPath;
  const bundled = bundledResource('whisper', MODEL_FILENAME);
  if (fs.existsSync(bundled)) return bundled;
  // Default to userData — that's where the downloader writes.
  return userPath;
}

export function userDataWhisperDir(): string {
  const dir = path.join(userDataDir(), 'whisper');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const MODEL_FILENAME = 'ggml-large-v3.bin';
export const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin';
// Expected size in bytes (~3.1 GB). Used to verify download completion.
export const MODEL_SIZE_BYTES = 3094623691;

export function modelStatus(): {
  installed: boolean;
  partial: boolean;
  bytes: number;
  expectedBytes: number;
  location: string;
} {
  const p = whisperModelPath();
  if (!fs.existsSync(p)) {
    return { installed: false, partial: false, bytes: 0, expectedBytes: MODEL_SIZE_BYTES, location: p };
  }
  const bytes = fs.statSync(p).size;
  const partial = bytes < MODEL_SIZE_BYTES * 0.99;
  return {
    installed: !partial,
    partial,
    bytes,
    expectedBytes: MODEL_SIZE_BYTES,
    location: p,
  };
}

export function sampleBiblePath(): string {
  return bundledResource('bible', 'tamil-ov-sample.json');
}

/** Full Tamil OV — present only after the user runs `npm run import:bible`. */
export function fullBiblePath(): string {
  return bundledResource('bible', 'tamil-ov.json');
}
