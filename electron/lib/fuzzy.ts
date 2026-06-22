import { normalizeTamil, stripSuffix, tokenize, similarity } from './tamil';

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
