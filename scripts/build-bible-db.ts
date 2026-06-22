/**
 * Tamil OV (Old Version, 1956 — public domain) Bible importer.
 *
 * Two ways to run:
 *
 *   1. Drop a JSON file at resources/bible/tamil-ov-source.json (or pass --file)
 *      → fastest, no network. Recommended.
 *
 *   2. Set BIBLE_SOURCE_URL to a known-good Tamil OV mirror, then run.
 *      → requires you to find a stable mirror (see README → Bible source notes).
 *
 * Expected input format (one of):
 *   A) Array of objects with our native fields:
 *      [{ book, chapter, verse, text_tamil }, ...]
 *   B) Array with `text` instead of `text_tamil`:
 *      [{ book, chapter, verse, text }, ...]
 *   C) scrollmapper-style resultset:
 *      { resultset: { row: [{ field: [id, book, ch, vs, text] }, ...] } }
 *   D) bolls.life / bible-api style (nested):
 *      { books: [{ name, chapters: [{ chapter, verses: [{ verse, text }] }] }] }
 *
 * Output: resources/bible/tamil-ov.json (the app loads this on next launch).
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const args = process.argv.slice(2);
const fileArgIdx = args.indexOf('--file');
const FILE_ARG = fileArgIdx >= 0 ? args[fileArgIdx + 1] : null;

const DEFAULT_LOCAL = path.join(__dirname, '..', 'resources', 'bible', 'tamil-ov-source.json');
const OUT = path.join(__dirname, '..', 'resources', 'bible', 'tamil-ov.json');
const SOURCE_URL = process.env.BIBLE_SOURCE_URL ?? '';

interface VerseOut {
  book: string;
  chapter: number;
  verse: number;
  text_tamil: string;
  text_normalized: string;
  is_memory_verse: number;
}

function download(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(download(res.headers.location!));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function normalizeForStorage(s: string): string {
  return s
    .replace(/[​-‍﻿]/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/[।.,;:!?"()\[\]{}'"‘’“”\-—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Tamil OV book names in canonical Protestant order — used when source uses
// positional indices instead of explicit names (godlytalias format).
const TAMIL_BOOKS_66 = [
  'ஆதியாகமம்', 'யாத்திராகமம்', 'லேவியராகமம்', 'எண்ணாகமம்', 'உபாகமம்',
  'யோசுவா', 'நியாயாதிபதிகள்', 'ரூத்', '1 சாமுவேல்', '2 சாமுவேல்',
  '1 இராஜாக்கள்', '2 இராஜாக்கள்', '1 நாளாகமம்', '2 நாளாகமம்', 'எஸ்றா',
  'நெகேமியா', 'எஸ்தர்', 'யோபு', 'சங்கீதம்', 'நீதிமொழிகள்',
  'பிரசங்கி', 'உன்னதப்பாட்டு', 'ஏசாயா', 'எரேமியா', 'புலம்பல்',
  'எசேக்கியேல்', 'தானியேல்', 'ஓசியா', 'யோவேல்', 'ஆமோஸ்',
  'ஒபதியா', 'யோனா', 'மீகா', 'நாகூம்', 'ஆபகூக்',
  'செப்பனியா', 'ஆகாய்', 'சகரியா', 'மல்கியா',
  'மத்தேயு', 'மாற்கு', 'லூக்கா', 'யோவான்', 'அப்போஸ்தலர்',
  'ரோமர்', '1 கொரிந்தியர்', '2 கொரிந்தியர்', 'கலாத்தியர்', 'எபேசியர்',
  'பிலிப்பியர்', 'கொலோசெயர்', '1 தெசலோனிக்கேயர்', '2 தெசலோனிக்கேயர்', '1 தீமோத்தேயு',
  '2 தீமோத்தேயு', 'தீத்து', 'பிலேமோன்', 'எபிரெயர்', 'யாக்கோபு',
  '1 பேதுரு', '2 பேதுரு', '1 யோவான்', '2 யோவான்', '3 யோவான்',
  'யூதா', 'வெளி',
];

function adapt(parsed: any): { book: string; chapter: number; verse: number; text: string }[] {
  // Format A or B: array of verse objects
  if (Array.isArray(parsed)) {
    return parsed.map((v: any) => ({
      book: String(v.book),
      chapter: Number(v.chapter),
      verse: Number(v.verse),
      text: String(v.text_tamil ?? v.text ?? ''),
    }));
  }
  // Format C: scrollmapper resultset
  if (parsed?.resultset?.row) {
    return parsed.resultset.row.map((r: any) => ({
      book: String(r.field[1]),
      chapter: Number(r.field[2]),
      verse: Number(r.field[3]),
      text: String(r.field[4]),
    }));
  }
  // Format D: nested books > chapters > verses (with explicit names)
  if (Array.isArray(parsed?.books)) {
    const out: any[] = [];
    for (const b of parsed.books) {
      for (const c of b.chapters ?? []) {
        for (const v of c.verses ?? []) {
          out.push({
            book: String(b.name),
            chapter: Number(c.chapter),
            verse: Number(v.verse),
            text: String(v.text),
          });
        }
      }
    }
    return out;
  }
  // Format E: godlytalias/Bible-Database — positional Book[].Chapter[].Verse[]
  // Books are indexed (no names in JSON), so we map by position to TAMIL_BOOKS_66.
  if (Array.isArray(parsed?.Book) && parsed.Book[0]?.Chapter) {
    const out: any[] = [];
    parsed.Book.forEach((b: any, bi: number) => {
      const bookName = TAMIL_BOOKS_66[bi] ?? `Book${bi + 1}`;
      (b.Chapter ?? []).forEach((c: any, ci: number) => {
        (c.Verse ?? []).forEach((v: any, vi: number) => {
          out.push({
            book: bookName,
            chapter: ci + 1,
            verse: vi + 1,
            text: String(v.Verse ?? v.text ?? ''),
          });
        });
      });
    });
    return out;
  }
  throw new Error('Unrecognized source format — edit the adapt() function for your source.');
}

async function loadSource(): Promise<any> {
  // Priority: --file arg → default local file → URL
  const localPath = FILE_ARG ?? DEFAULT_LOCAL;
  if (fs.existsSync(localPath)) {
    console.log(`Reading local source: ${localPath}`);
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  }
  if (!SOURCE_URL) {
    throw new Error(
      `No Bible source found.\n\n` +
      `Option 1: drop a Tamil OV JSON file here:\n  ${DEFAULT_LOCAL}\n\n` +
      `Option 2: run with an explicit file path:\n  npm run import:bible -- --file /path/to/tamil.json\n\n` +
      `Option 3: set a URL:\n  BIBLE_SOURCE_URL=https://... npm run import:bible\n\n` +
      `See README.md → "Full Tamil Bible" for source suggestions.`
    );
  }
  console.log(`Fetching from URL: ${SOURCE_URL}`);
  return JSON.parse(await download(SOURCE_URL));
}

async function main() {
  const parsed = await loadSource();
  const adapted = adapt(parsed);
  console.log(`Adapted ${adapted.length.toLocaleString()} rows.`);

  const output: VerseOut[] = adapted.map((v) => ({
    book: v.book,
    chapter: v.chapter,
    verse: v.verse,
    text_tamil: v.text,
    text_normalized: normalizeForStorage(v.text),
    is_memory_verse: 0,
  }));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(output));
  console.log(`✅ Wrote ${output.length.toLocaleString()} verses → ${OUT}`);

  if (output.length < 30000 || output.length > 32000) {
    console.warn(
      `⚠️  Expected ~31,102 verses (the standard Protestant count). ` +
      `Got ${output.length}. Spot-check the output before relying on it.`
    );
  } else {
    console.log(`Verse count looks healthy. Restart the app to load the full Bible.`);
  }
}

main().catch((e) => {
  console.error('\n❌ Import failed:\n');
  console.error(e.message);
  process.exit(1);
});
