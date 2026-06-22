export interface Verse {
  id: number;
  book: string;
  chapter: number;
  verse: number;
  text_tamil: string;
  text_normalized: string;
  is_memory_verse: number;
}

export interface RankedVerse extends Verse {
  score: number;
  matched_token: string | null;
}

export interface Selection {
  id: number;
  week_start_date: string;
  slot: number;
  verse_id: number;
  posted_at: string | null;
  root_word: string | null;
  book: string;
  chapter: number;
  verse: number;
  text_tamil: string;
}

export interface User {
  id: number;
  name: string;
  phone: string;
  joined_date: string;
  active: number;
  created_at: string;
}

export interface VoiceNote {
  id: number;
  user_id: number;
  user_name: string;
  week_start_date: string;
  verse_slot: number;
  file_path: string;
  transcript: string | null;
  accuracy_score: number | null;
  fluency_score: number | null;
  reference_score: number | null;
  total_score: number | null;
  duration_seconds: number | null;
  graded_at: string | null;
  created_at: string;
}

export interface ConsistencyRow {
  id: number;
  name: string;
  weeks_present: number;
  notes_count: number;
}

export interface ScoreRow {
  id: number;
  name: string;
  avg_score: number;
  notes_count: number;
}

export type Settings = Record<string, string>;

declare global {
  interface Window {
    api: import('../electron/preload').Api;
  }
}
