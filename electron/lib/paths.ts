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

export function whisperModelPath(): string {
  return bundledResource('whisper', 'ggml-large-v3.bin');
}

export function sampleBiblePath(): string {
  return bundledResource('bible', 'tamil-ov-sample.json');
}

/** Full Tamil OV — present only after the user runs `npm run import:bible`. */
export function fullBiblePath(): string {
  return bundledResource('bible', 'tamil-ov.json');
}
