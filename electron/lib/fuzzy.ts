import { normalizeTamil, stripSuffix, tokenize, similarity } from './tamil';
import { isLatin, parseReference, tanglishScore } from './tanglish';

export interface VerseRow {
  id: number;
  book: string;
  chapter: number;
  verse: number;
  text_tamil: string;
  text_normalized: string;
  is_memory_verse: number;
}

export interface RankedVerse extends VerseRow {
  score: number;
  matched_token: string | null;
}

/**
 * Rank verses by how well they match a root word.
 * Strategy:
 *   1. Normalize + stem the root.
 *   2. For each verse, tokenize+stem; compute best per-token similarity to root stem.
 *   3. Sum into a score with weights:
 *        exact stem match: 1.0
 *        high similarity (>=0.85): scaled
 *        memory-verse boost: +0.25
 *        per-verse multi-occurrence bonus capped at 3 matches
 *   4. Return top N.
 */
export function rankVerses(
  rootWord: string,
  verses: VerseRow[],
  limit = 30
): RankedVerse[] {
  if (isLatin(rootWord)) return rankLatin(rootWord, verses, limit);
  const tamilRef = rankTamilReference(rootWord, verses, limit);
  if (tamilRef) return tamilRef;
  const rootNorm = normalizeTamil(rootWord);
  const rootStem = stripSuffix(rootNorm);
  if (!rootStem) return [];

  const ranked: RankedVerse[] = [];

  for (const v of verses) {
    const tokens = tokenize(v.text_normalized || v.text_tamil);
    let bestSim = 0;
    let matchCount = 0;
    let matchedToken: string | null = null;

    for (const tok of tokens) {
      const stem = stripSuffix(tok);
      let sim = 0;
      if (stem === rootStem) {
        sim = 1.0;
      } else if (stem.startsWith(rootStem) || rootStem.startsWith(stem)) {
        sim = 0.9;
      } else {
        sim = similarity(stem, rootStem);
      }
      if (sim >= 0.7) matchCount++;
      if (sim > bestSim) {
        bestSim = sim;
        matchedToken = tok;
      }
    }

    if (bestSim < 0.6) continue;

    let score = bestSim;
    score += Math.min(matchCount - 1, 2) * 0.1; // up to +0.2 for multi-occurrence
    if (v.is_memory_verse) score += 0.25;

    ranked.push({ ...v, score, matched_token: matchedToken });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

/** Books in Bible order, taken from the verse table itself (its rows are in canonical order). */
function bookOrder(verses: VerseRow[]): string[] {
  const books: string[] = [];
  for (const v of verses) if (books[books.length - 1] !== v.book && !books.includes(v.book)) books.push(v.book);
  return books;
}

function byReference(verses: VerseRow[], book: string, chapter?: number, verse?: number, limit = 30): RankedVerse[] {
  return verses
    .filter((v) => v.book === book && (chapter == null || v.chapter === chapter) && (verse == null || v.verse === verse))
    .slice(0, chapter == null ? 1 : limit)
    .map((v) => ({ ...v, score: 2, matched_token: null }));
}

/** "யோவான் 3:16" typed in Tamil. */
function rankTamilReference(q: string, verses: VerseRow[], limit: number): RankedVerse[] | null {
  const m = q.trim().match(/^(.+?)\s+(\d+)(?:\s*[:.\s]\s*(\d+))?$/);
  if (!m) return null;
  const name = m[1].trim();
  const book = bookOrder(verses).find((b) => b === name);
  return book ? byReference(verses, book, Number(m[2]), m[3] ? Number(m[3]) : undefined, limit) : null;
}

/** Typed in English letters: a reference ("john 3 16") or Tanglish words ("karthar kirubai"). */
function rankLatin(q: string, verses: VerseRow[], limit: number): RankedVerse[] {
  const ref = parseReference(q);
  if (ref && (ref.chapter != null || q.trim().split(/\s+/).length <= 2)) {
    const book = bookOrder(verses)[ref.bookIndex];
    if (book) {
      const hits = byReference(verses, book, ref.chapter, ref.verse, limit);
      if (hits.length) return hits;
    }
  }
  const ranked: RankedVerse[] = [];
  for (const v of verses) {
    const s = tanglishScore(q, v);
    if (s >= 0.6) ranked.push({ ...v, score: s + (v.is_memory_verse ? 0.25 : 0), matched_token: null });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}
