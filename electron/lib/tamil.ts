// Tamil text normalization + lightweight stemming for fuzzy matching.
// Used by both the main process (verse search) and renderer (preview).

const ZW = /[​-‍﻿]/g;
const MD = /[*_~`]/g;
const PUNCT = /[।.,;:!?"()\[\]{}'"‘’“”\-—–]/g;

// Common Tamil grammatical suffixes (case markers, verb endings, plurals).
// Order matters — longest first.
const SUFFIXES = [
  'க்களுக்கு', 'ங்களுக்கு', 'களுக்கு', 'யினுடைய', 'யுடைய', 'ஆகிய',
  'கின்றன', 'கின்றார்', 'கின்றாள்', 'கின்றான்', 'கின்றேன்', 'கின்றோம்',
  'கின்ற', 'கிறார்', 'கிறாள்', 'கிறான்', 'கிறேன்', 'கிறோம்', 'கிறது',
  'பண்ணுங்கள்', 'பண்ணுகிற', 'பண்ணும்', 'பண்ணி', 'பண்ணு', 'பண்ண',
  'ங்களை', 'களை', 'களின்', 'களில்', 'களோடு', 'களுக்கு', 'களும்',
  'ஆலும்', 'ஆலே', 'ஆலும', 'ஓடும்', 'உடைய', 'இருந்து',
  'க்கு', 'ஐ', 'ஆல்', 'இல்', 'இன்', 'ஓடு', 'உம்',
  'ஆர்', 'ஆள்', 'ஆன்', 'ஆம்', 'ஓம்', 'ஏன்',
  'கள்', 'ங்கள்', 'ய', 'ு', 'ா', 'ி', 'ீ',
];

export function normalizeTamil(input: string): string {
  if (!input) return '';
  let s = input.normalize('NFC');
  s = s.replace(ZW, '');
  s = s.replace(MD, '');
  s = s.replace(PUNCT, ' ');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
}

export function stripSuffix(token: string): string {
  let t = token;
  // Try repeatedly, but cap at 2 passes to avoid over-stripping
  for (let pass = 0; pass < 2; pass++) {
    let changed = false;
    for (const suf of SUFFIXES) {
      if (t.length > suf.length + 1 && t.endsWith(suf)) {
        t = t.slice(0, -suf.length);
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return t;
}

export function tokenize(input: string): string[] {
  return normalizeTamil(input).split(/\s+/).filter(Boolean);
}

export function stemTokens(tokens: string[]): string[] {
  return tokens.map(stripSuffix);
}

// Levenshtein for ranking near-matches when stemming alone isn't enough.
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1).fill(0);
  const v1 = new Array(b.length + 1).fill(0);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}
