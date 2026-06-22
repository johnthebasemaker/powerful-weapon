import { normalizeTamil, tokenize, stemTokens, similarity } from './tamil';

export interface GradingInput {
  transcript: string;
  referenceText: string;       // canonical Tamil verse text
  referenceCitation: {         // e.g. { book: "பிலிப்பியர்", chapter: 4, verse: 13 }
    book: string;
    chapter: number;
    verse: number;
  };
  durationSeconds: number;
  // Optional: per-segment confidence from Whisper (0..1 each)
  segmentConfidences?: number[];
}

export interface GradeResult {
  accuracy: number;       // /60
  fluency: number;        // /25
  reference: number;      // /15
  total: number;          // /100
  breakdown: {
    tokenF1: number;
    editSim: number;
    wpm: number;
    pauseRatio: number;
    avgConfidence: number;
    refBookMatch: boolean;
    refChapterMatch: boolean;
    refVerseMatch: boolean;
  };
}

/**
 * Score 0..60: accuracy of the spoken verse vs. reference text.
 *
 * Tamil orthography varies on spacing (சகோதரசிநேகத்திலே vs. சகோதர சினேகத்தில்),
 * and Whisper introduces small spelling errors (கணம்/கனம், ட்ச/ச்ச). A strict
 * token-set comparison underrates accurate recitations, so we use two signals:
 *
 *   1. compactEditSim: Levenshtein similarity on whitespace-stripped, normalized
 *      Tamil. This is the dominant signal — it tolerates spacing variation and
 *      small Whisper transcription errors while still requiring the reader to
 *      have actually said the verse.
 *
 *   2. stemmedTokenF1: F1 over Tamil-stemmed tokens (handles inflection
 *      endings like -இலே/-இல், -ஏ, plural/case markers).
 *
 *   accuracy = 60 * (0.75 * compactEditSim + 0.25 * stemmedTokenF1)
 *
 * A perfect recitation typically lands at ~85-95%; partial recitations scale
 * proportionally; reference-only (no verse text) scores near 0.
 */
function scoreAccuracy(transcript: string, reference: string): {
  score: number; tokenF1: number; editSim: number;
} {
  if (!reference) return { score: 0, tokenF1: 0, editSim: 0 };

  // Compact form: strip all whitespace so spacing variation doesn't penalize.
  const tCompact = normalizeTamil(transcript).replace(/\s+/g, '');
  const rCompact = normalizeTamil(reference).replace(/\s+/g, '');

  // Find the best matching window in the transcript. Real voice notes often
  // contain greetings ("praise the lord"), the spoken reference ("ரோமர் 12
  // பத்து"), or even other verses bundled together. Sliding a reference-length
  // window over the transcript and taking the best similarity tells us how well
  // the reader recited *this* verse, independent of surrounding content.
  const compactEditSim = bestWindowSimilarity(tCompact, rCompact);

  // Stemmed token F1 (handles -இலே/-இல், -ஏ endings, plurals, etc.)
  const tStems = new Set(stemTokens(tokenize(transcript)));
  const rStems = new Set(stemTokens(tokenize(reference)));
  let tp = 0;
  for (const w of rStems) if (tStems.has(w)) tp++;
  const precision = tStems.size ? tp / tStems.size : 0;
  const recall = rStems.size ? tp / rStems.size : 0;
  const stemmedTokenF1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const score = 60 * (0.75 * compactEditSim + 0.25 * stemmedTokenF1);
  return {
    score: Math.max(0, Math.min(60, score)),
    tokenF1: stemmedTokenF1,
    editSim: compactEditSim,
  };
}

/**
 * Score 0..25: fluency.
 *   - words-per-minute target band: 80..160 WPM → full marks
 *   - pause ratio: low pauses preferred (estimated from transcript-vs-duration)
 *   - average confidence: Whisper segment confidence
 */
function scoreFluency(
  transcript: string,
  durationSeconds: number,
  segmentConfidences?: number[]
): { score: number; wpm: number; pauseRatio: number; avgConfidence: number } {
  const words = tokenize(transcript).length;
  const minutes = Math.max(0.1, durationSeconds / 60);
  const wpm = words / minutes;

  // WPM scoring: peak at 80-160; falls off outside
  let wpmScore: number;
  if (wpm >= 80 && wpm <= 160) wpmScore = 1.0;
  else if (wpm < 80) wpmScore = Math.max(0, wpm / 80);
  else wpmScore = Math.max(0, 1 - (wpm - 160) / 160);

  // Pause ratio proxy: if WPM very low for a long clip, treat as paused
  const expectedWords = (durationSeconds / 60) * 110; // 110 WPM = typical Tamil recitation
  const pauseRatio = Math.max(0, 1 - words / Math.max(1, expectedWords));
  const pauseScore = Math.max(0, 1 - pauseRatio);

  const avgConfidence = segmentConfidences && segmentConfidences.length
    ? segmentConfidences.reduce((a, b) => a + b, 0) / segmentConfidences.length
    : 0.85; // sensible default when Whisper doesn't expose confidences

  // Weighted blend within the 25-point budget
  const score = 25 * (0.5 * wpmScore + 0.25 * pauseScore + 0.25 * avgConfidence);
  return {
    score: Math.max(0, Math.min(25, score)),
    wpm,
    pauseRatio,
    avgConfidence,
  };
}

/**
 * Score 0..15: reference citation accuracy.
 *   book name: 7 points
 *   chapter number: 4 points
 *   verse number: 4 points
 * Tamil & Arabic numerals both accepted.
 */
function scoreReference(
  transcript: string,
  citation: GradingInput['referenceCitation']
): {
  score: number;
  refBookMatch: boolean;
  refChapterMatch: boolean;
  refVerseMatch: boolean;
} {
  const norm = normalizeTamil(transcript);
  const bookTokens = tokenize(citation.book);
  const refBookMatch = bookTokens.every((t) => norm.includes(t));

  const arabicCh = String(citation.chapter);
  const arabicVs = String(citation.verse);
  const tamilCh = toTamilNumeral(citation.chapter);
  const tamilVs = toTamilNumeral(citation.verse);
  const wordCh = tamilNumberWord(citation.chapter);
  const wordVs = tamilNumberWord(citation.verse);

  const chMatch = norm.includes(arabicCh) || norm.includes(tamilCh) || (wordCh ? norm.includes(wordCh) : false);
  const vsMatch = norm.includes(arabicVs) || norm.includes(tamilVs) || (wordVs ? norm.includes(wordVs) : false);

  let score = 0;
  if (refBookMatch) score += 7;
  if (chMatch) score += 4;
  if (vsMatch) score += 4;

  return {
    score,
    refBookMatch,
    refChapterMatch: chMatch,
    refVerseMatch: vsMatch,
  };
}

/**
 * Find the substring of `haystack` (within ±20% of `needle`'s length) that has
 * the highest Levenshtein similarity to `needle`. Used to score a recitation
 * even when surrounded by greetings, references, or other verses.
 *
 * Stride based on needle length to stay fast (O(haystack × needle) worst case).
 */
function bestWindowSimilarity(haystack: string, needle: string): number {
  if (!haystack.length || !needle.length) return 0;
  if (haystack.length <= needle.length * 1.25) {
    return similarity(haystack, needle);
  }
  const lo = Math.floor(needle.length * 0.80);
  const hi = Math.ceil(needle.length * 1.20);
  const stride = Math.max(1, Math.floor(needle.length / 20)); // 5% of needle
  let best = 0;
  for (let len = lo; len <= hi; len += Math.max(1, Math.floor(needle.length / 10))) {
    for (let i = 0; i + len <= haystack.length; i += stride) {
      const sim = similarity(haystack.slice(i, i + len), needle);
      if (sim > best) best = sim;
    }
  }
  return best;
}

const TAMIL_DIGITS = ['௦', '௧', '௨', '௩', '௪', '௫', '௬', '௭', '௮', '௯'];
function toTamilNumeral(n: number): string {
  return String(n).split('').map((d) => TAMIL_DIGITS[parseInt(d, 10)] ?? d).join('');
}

// Tamil spoken-form number words for 1-50 (covers typical chapter/verse ranges).
// Beyond 50, recitations almost always use Arabic or Tamil digits, so we skip.
const TAMIL_WORDS_1_50: Record<number, string> = {
  1: 'ஒன்று', 2: 'இரண்டு', 3: 'மூன்று', 4: 'நான்கு', 5: 'ஐந்து',
  6: 'ஆறு', 7: 'ஏழு', 8: 'எட்டு', 9: 'ஒன்பது', 10: 'பத்து',
  11: 'பதினொன்று', 12: 'பன்னிரண்டு', 13: 'பதிமூன்று', 14: 'பதினான்கு', 15: 'பதினைந்து',
  16: 'பதினாறு', 17: 'பதினேழு', 18: 'பதினெட்டு', 19: 'பத்தொன்பது', 20: 'இருபது',
  21: 'இருபத்தொன்று', 22: 'இருபத்திரண்டு', 23: 'இருபத்துமூன்று', 24: 'இருபத்துநான்கு', 25: 'இருபத்தைந்து',
  26: 'இருபத்தாறு', 27: 'இருபத்தேழு', 28: 'இருபத்தெட்டு', 29: 'இருபத்தொன்பது', 30: 'முப்பது',
  31: 'முப்பத்தொன்று', 32: 'முப்பத்திரண்டு', 33: 'முப்பத்துமூன்று', 34: 'முப்பத்துநான்கு', 35: 'முப்பத்தைந்து',
  36: 'முப்பத்தாறு', 37: 'முப்பத்தேழு', 38: 'முப்பத்தெட்டு', 39: 'முப்பத்தொன்பது', 40: 'நாற்பது',
  41: 'நாற்பத்தொன்று', 42: 'நாற்பத்திரண்டு', 43: 'நாற்பத்துமூன்று', 44: 'நாற்பத்துநான்கு', 45: 'நாற்பத்தைந்து',
  46: 'நாற்பத்தாறு', 47: 'நாற்பத்தேழு', 48: 'நாற்பத்தெட்டு', 49: 'நாற்பத்தொன்பது', 50: 'ஐம்பது',
};
function tamilNumberWord(n: number): string | null {
  return TAMIL_WORDS_1_50[n] ?? null;
}

export function grade(input: GradingInput): GradeResult {
  const acc = scoreAccuracy(input.transcript, input.referenceText);
  const flu = scoreFluency(input.transcript, input.durationSeconds, input.segmentConfidences);
  const ref = scoreReference(input.transcript, input.referenceCitation);
  const total = acc.score + flu.score + ref.score;
  return {
    accuracy: round1(acc.score),
    fluency: round1(flu.score),
    reference: round1(ref.score),
    total: round1(total),
    breakdown: {
      tokenF1: round2(acc.tokenF1),
      editSim: round2(acc.editSim),
      wpm: Math.round(flu.wpm),
      pauseRatio: round2(flu.pauseRatio),
      avgConfidence: round2(flu.avgConfidence),
      refBookMatch: ref.refBookMatch,
      refChapterMatch: ref.refChapterMatch,
      refVerseMatch: ref.refVerseMatch,
    },
  };
}

function round1(n: number) { return Math.round(n * 10) / 10; }
function round2(n: number) { return Math.round(n * 100) / 100; }
