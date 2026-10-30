// Search the Tamil Bible typed in English letters ("Tanglish") or by English
// reference. Results are always the Tamil verses.
//
//   "john 3 16", "yovan 3:16", "1 cor 13", "psalm 23:1"  → that verse / chapter
//   "karthar en meippar", "kanam pannu"                   → verses with those words
//
// Both sides are reduced to a rough sound-key in Latin letters (Tamil romanised,
// typed text folded) so the many ways people spell Tamil in English still match:
// th/t/d, k/g, p/b, ch/s, zh/l, long vowels and doubled letters are merged.
// Ranking weighs longer words more and rewards words found in the typed order.

import { similarity } from './tamil';

/* ── Tamil → Latin ── */

const CONS: Record<string, string> = {
  'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'nj', 'ட': 't', 'ண': 'n', 'த': 't', 'ந': 'n', 'ப': 'p', 'ம': 'm',
  'ய': 'y', 'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'l', 'ள': 'l', 'ற': 'r', 'ன': 'n',
  'ஜ': 'j', 'ஷ': 's', 'ஸ': 's', 'ஹ': 'h',
};
const VOWEL: Record<string, string> = {
  'அ': 'a', 'ஆ': 'a', 'இ': 'i', 'ஈ': 'i', 'உ': 'u', 'ஊ': 'u', 'எ': 'e', 'ஏ': 'e', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'au',
};
const SIGN: Record<string, string> = {
  'ா': 'a', 'ி': 'i', 'ீ': 'i', 'ு': 'u', 'ூ': 'u', 'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'au',
};

function romanise(word: string): string {
  let out = '';
  const chars = Array.from(word);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (CONS[c]) {
      const next = chars[i + 1];
      out += CONS[c];
      if (next === '்') i++;           // pulli: bare consonant
      else if (next && SIGN[next]) { out += SIGN[next]; i++; }
      else out += 'a';                 // inherent vowel
    } else if (VOWEL[c]) out += VOWEL[c];
    else if (/[a-z0-9]/i.test(c)) out += c.toLowerCase();
  }
  return out;
}

/* ── Sound key, applied to both romanised Tamil and typed Tanglish ── */

export function soundKey(latin: string): string {
  return latin.toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/zh/g, 'l')
    .replace(/ch|sh/g, 's')
    .replace(/th|dh/g, 't')
    .replace(/w/g, 'v')
    .replace(/ph|f/g, 'p')
    .replace(/q|c/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/z/g, 's')
    .replace(/g/g, 'k').replace(/b/g, 'p').replace(/d/g, 't')
    .replace(/ee|ii/g, 'i').replace(/oo|uu/g, 'u').replace(/aa/g, 'a')
    .replace(/ay/g, 'ai').replace(/ei|ey|ae/g, 'e').replace(/ow/g, 'o')
    .replace(/(.)\1+/g, '$1');
}

/* ── References in English / Tanglish ── */

// The 66 books in the order of the Tamil Bible's book list, with the names
// people type: English, short forms, and common Tanglish spellings.
const BOOK_ALIASES: string[][] = [
  ['genesis', 'gen', 'gn', 'aathiyagamam', 'adhiyagamam', 'athiyagamam'],
  ['exodus', 'exo', 'ex', 'yathiragamam', 'yaathiraagamam'],
  ['leviticus', 'lev', 'leviyaragamam'],
  ['numbers', 'num', 'ennagamam'],
  ['deuteronomy', 'deut', 'deu', 'dt', 'ubagamam', 'upagamam'],
  ['joshua', 'josh', 'yosuva', 'yoshuva'],
  ['judges', 'judg', 'jdg', 'niyayathipathigal'],
  ['ruth', 'rut', 'ruth'],
  ['1 samuel', '1samuel', '1 sam', '1sam', '1 samuvel'],
  ['2 samuel', '2samuel', '2 sam', '2sam', '2 samuvel'],
  ['1 kings', '1kings', '1 kgs', '1 ki', '1 rajakkal', '1 irajakkal'],
  ['2 kings', '2kings', '2 kgs', '2 ki', '2 rajakkal', '2 irajakkal'],
  ['1 chronicles', '1chronicles', '1 chr', '1 chron', '1 nalagamam'],
  ['2 chronicles', '2chronicles', '2 chr', '2 chron', '2 nalagamam'],
  ['ezra', 'ezr', 'esra'],
  ['nehemiah', 'neh', 'negemiya', 'nehemiya'],
  ['esther', 'est', 'esthar', 'ester'],
  ['job', 'yobu'],
  ['psalms', 'psalm', 'ps', 'psa', 'sangeetham', 'sangitham', 'sankeetham'],
  ['proverbs', 'prov', 'pro', 'prv', 'neethimozhigal', 'nithimozhigal', 'neethimoligal'],
  ['ecclesiastes', 'eccl', 'ecc', 'prasangi'],
  ['song of songs', 'song of solomon', 'song', 'sos', 'unnathappattu', 'unnathapattu'],
  ['isaiah', 'isa', 'esaya', 'yesaya', 'eesaya'],
  ['jeremiah', 'jer', 'eremiya', 'jeremiya'],
  ['lamentations', 'lam', 'pulambal'],
  ['ezekiel', 'ezek', 'eze', 'esekkiyel', 'ezekiyel'],
  ['daniel', 'dan', 'thaniyel', 'daniyel'],
  ['hosea', 'hos', 'osiya'],
  ['joel', 'yovel'],
  ['amos', 'aamos'],
  ['obadiah', 'obad', 'obathiya'],
  ['jonah', 'jon', 'yona'],
  ['micah', 'mic', 'meega', 'mika'],
  ['nahum', 'nah', 'naagum', 'nagum'],
  ['habakkuk', 'hab', 'aabakook', 'abakuk'],
  ['zephaniah', 'zeph', 'zep', 'seppaniya'],
  ['haggai', 'hag', 'aagai', 'agai'],
  ['zechariah', 'zech', 'zec', 'sagariya'],
  ['malachi', 'mal', 'malkiya'],
  ['matthew', 'matt', 'mat', 'mt', 'matheyu', 'mathayu', 'mattheyu'],
  ['mark', 'mrk', 'mk', 'marku', 'maarku'],
  ['luke', 'luk', 'lk', 'lukka', 'lookka'],
  ['john', 'jhn', 'jn', 'yovan', 'yovaan'],
  ['acts', 'act', 'apposthalar', 'apostalar', 'appostalar'],
  ['romans', 'rom', 'ro', 'romar'],
  ['1 corinthians', '1corinthians', '1 cor', '1cor', '1 korinthiyar', '1 korinthiar'],
  ['2 corinthians', '2corinthians', '2 cor', '2cor', '2 korinthiyar', '2 korinthiar'],
  ['galatians', 'gal', 'galathiyar', 'kalathiyar'],
  ['ephesians', 'eph', 'ebesiyar', 'epesiyar'],
  ['philippians', 'phil', 'php', 'pilippiyar', 'philippiyar'],
  ['colossians', 'col', 'kolosseyar', 'kolosiyar'],
  ['1 thessalonians', '1thessalonians', '1 thess', '1 thes', '1 thesalonikkeyar'],
  ['2 thessalonians', '2thessalonians', '2 thess', '2 thes', '2 thesalonikkeyar'],
  ['1 timothy', '1timothy', '1 tim', '1tim', '1 theemotheyu', '1 timotheyu'],
  ['2 timothy', '2timothy', '2 tim', '2tim', '2 theemotheyu', '2 timotheyu'],
  ['titus', 'tit', 'theethu', 'teethu'],
  ['philemon', 'phlm', 'philem', 'pilemon'],
  ['hebrews', 'heb', 'ebireyar', 'epireyar'],
  ['james', 'jas', 'jam', 'yakkobu', 'yakobu'],
  ['1 peter', '1peter', '1 pet', '1pet', '1 pethuru', '1 peturu'],
  ['2 peter', '2peter', '2 pet', '2pet', '2 pethuru', '2 peturu'],
  ['1 john', '1john', '1 jn', '1jn', '1 yovan'],
  ['2 john', '2john', '2 jn', '2jn', '2 yovan'],
  ['3 john', '3john', '3 jn', '3jn', '3 yovan'],
  ['jude', 'yutha', 'yudha'],
  ['revelation', 'revelations', 'rev', 're', 'veli', 'velippaduthal'],
];

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface RefQuery { bookIndex: number; chapter?: number; verse?: number }

/** "john 3:16" / "1 cor 13 4" / "yovan 3" → book index (0..65) + chapter/verse. */
export function parseReference(q: string): RefQuery | null {
  const m = q.trim().toLowerCase().match(/^([1-3]?\s*[a-z][a-z .]*?)\s*(\d+)?(?:\s*[:.\s]\s*(\d+))?\s*$/);
  if (!m) return null;
  const name = compact(m[1]);
  if (name.length < 2) return null;
  let best = -1;
  let bestLen = 0;
  BOOK_ALIASES.forEach((aliases, i) => {
    for (const a of aliases) {
      const ca = compact(a);
      // Exact alias, or a prefix of a full name ("philip" → philippians), longest wins.
      if ((ca === name || (name.length >= 3 && ca.startsWith(name))) && ca.length > bestLen) { best = i; bestLen = ca.length; }
    }
  });
  if (best < 0) return null;
  return { bookIndex: best, chapter: m[2] ? Number(m[2]) : undefined, verse: m[3] ? Number(m[3]) : undefined };
}

/* ── Word search in Tanglish ── */

// Sound keys per verse text, kept across searches (the phone re-reads the rows each time).
const verseKeys = new Map<string, string[]>();

function keysFor(v: { text_normalized?: string; text_tamil: string }): string[] {
  const text = v.text_normalized || v.text_tamil;
  let k = verseKeys.get(text);
  if (!k) {
    k = text.split(/\s+/).map((w) => soundKey(romanise(w))).filter((x) => x.length >= 2);
    verseKeys.set(text, k);
  }
  return k;
}

/** 0..1+: how well a verse matches the typed Tanglish words (longer words count more; in-order matches get a bonus). */
export function tanglishScore(query: string, v: { text_normalized?: string; text_tamil: string }): number {
  const q = query.toLowerCase().split(/\s+/).map(soundKey).filter((x) => x.length >= 2);
  if (!q.length) return 0;
  const words = keysFor(v);
  let sum = 0;
  let weight = 0;
  let lastPos = -1;
  let inOrder = 0;
  for (const qk of q) {
    let best = 0;
    let pos = -1;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const s = w === qk ? 1
        : qk.length >= 3 && w.startsWith(qk) ? 0.92 // typed the start of a long word
        : similarity(w.slice(0, qk.length + 2), qk) * 0.95;
      if (s > best) { best = s; pos = i; }
      if (best === 1) break;
    }
    const wgt = Math.min(qk.length, 8);
    weight += wgt;
    if (best >= 0.72) {
      sum += best * wgt;
      if (pos > lastPos) inOrder++;
      lastPos = pos;
    }
  }
  return sum / weight + (q.length > 1 ? (0.1 * (inOrder - 1)) / (q.length - 1) : 0);
}

export const isLatin = (s: string) => /[a-z]/i.test(s) && !/[஀-௿]/.test(s);
