// Client for the Worker's members / recordings / scores API (stt-proxy/worker.js).
// Tokens live in app settings: admin_token (admin password login) and
// member_token + member_id + member_name (name + PIN login).

import { api } from './api';
import { feedUrl } from './feed';

export interface RecordWindow { weekStart: string; opensAt: number; closesAt: number; open: boolean }
export interface RecordConfig {
  record_dow: string; record_from: string; record_to: string; extend_days: string; max_takes: string;
  window: RecordWindow;
}
export interface PublicMember { id: number; name: string }
export interface AdminMember { id: number; name: string; active: number; created_at: string }
export interface GroupRow {
  member_id: number; name: string; submission_id: number | null; created_at: string | null;
  duration_s: number | null; audio_available: number | null;
}
export interface Submission {
  id: number; member_id: number; name: string; week_start: string; mime: string; duration_s: number | null;
  takes: number | null; marks: string | null; transcript: string | null; auto_total: number | null;
  auto_json: string | null; engine: string | null; manual_total: number | null; manual_note: string | null;
  graded_at: string | null; created_at: string; audio_available: number;
}

export class RemoteError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function settings(): Promise<Record<string, string>> {
  return (await api().settings.getAll()) as Record<string, string>;
}

async function call<T>(method: string, path: string, body?: unknown, token?: string, timeoutMs = 30000): Promise<T> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${await feedUrl()}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
  } catch {
    throw new RemoteError(navigator.onLine === false ? 'You are offline.' : 'Could not reach the server. Check your internet.', 0);
  } finally {
    window.clearTimeout(t);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data as { error?: string; detail?: string };
    if (res.status === 401 && path.startsWith('/admin/') && token) {
      await api().settings.set('admin_token', ''); // expired or password changed → one fresh login
      window.dispatchEvent(new Event('pw-admin-signed-out'));
    }
    throw new RemoteError(`${d.error ?? `Server error (HTTP ${res.status})`}${d.detail ? ` — ${d.detail.slice(0, 160)}` : ''}`, res.status);
  }
  return data as T;
}

/* ── tokens ── */

export async function adminToken(): Promise<string> {
  const t = (await settings()).admin_token;
  if (!t) throw new RemoteError('Admin login required', 401);
  return t;
}
async function memberToken(): Promise<string> {
  const t = (await settings()).member_token;
  if (!t) throw new RemoteError('Please log in', 401);
  return t;
}
/** Whichever login this phone has (admin preferred) — for group list / audio. */
async function anyToken(): Promise<string> {
  const s = await settings();
  const t = s.admin_token || s.member_token;
  if (!t) throw new RemoteError('Please log in', 401);
  return t;
}

/* ── login ── */

export async function loginAdmin(password: string): Promise<void> {
  const { token } = await call<{ token: string }>('POST', '/auth/admin', { password });
  await api().settings.set('admin_token', token);
  window.dispatchEvent(new Event('pw-login'));
}

export async function logoutAdmin(): Promise<void> {
  await api().settings.set('admin_token', '');
}

export async function loginMember(memberId: number, pin: string): Promise<PublicMember> {
  const { token, member } = await call<{ token: string; member: PublicMember }>('POST', '/auth/member', { memberId, pin });
  await api().settings.set('member_token', token);
  await api().settings.set('member_id', String(member.id));
  await api().settings.set('member_name', member.name);
  window.dispatchEvent(new Event('pw-login'));
  return member;
}

export async function logoutMember(): Promise<void> {
  for (const k of ['member_token', 'member_id', 'member_name']) await api().settings.set(k, '');
}

export const listPublicMembers = () => call<PublicMember[]>('GET', '/members');
export const getConfig = () => call<RecordConfig>('GET', '/config');

/* ── member ── */

export interface MyStatus {
  member: PublicMember; window: RecordWindow; maxTakes: number; takesUsed: number; refundsLeft: number;
  sent: { id: number; created_at: string } | null;
}
export const myStatus = async () => call<MyStatus>('GET', '/me/status', undefined, await memberToken());

/** Start a try: the server counts it (so reinstalling the app doesn't reset tries). */
export const startTake = async (weekStart: string) =>
  call<{ takesUsed: number; maxTakes: number }>('POST', '/me/take', { weekStart }, await memberToken());
/** A take was cancelled; `interrupted` (call, alarm, screen off) asks for the try back. */
export const cancelTake = async (weekStart: string, interrupted: boolean, micFailed = false) =>
  call<{ refunded: boolean; takesUsed: number; maxTakes: number; refundsLeft: number }>(
    'POST', '/me/take/cancel', { weekStart, interrupted, micFailed }, await memberToken());
export const requestTry = async () => call<{ ok: true; pushed?: boolean; already?: boolean }>('POST', '/me/request-try', {}, await memberToken());
export const myHistory = async () => call<{ weeks: string[]; current: string }>('GET', '/me/history', undefined, await memberToken());
export const practiceCheck = async (p: { audioBase64: string; mimeType: string; prompt?: string }) =>
  call<{ transcript: string; left: number }>('POST', '/me/practice', p, await memberToken(), 90000);

/** Register this phone for push notifications (admin alerts / member news). */
export async function registerDevice(token: string): Promise<void> {
  await call('POST', '/devices', { token }, await anyToken());
}

export async function submitRecording(p: {
  weekStart: string; audioBase64: string; mimeType: string; durationS: number; takes: number; marks: number[];
}): Promise<{ ok: true; id: number }> {
  return call('POST', '/submissions', p, await memberToken(), 120000);
}

export const groupStatus = async (week?: string) =>
  call<{ week: string; members: GroupRow[] }>('GET', `/group${week ? `?week=${week}` : ''}`, undefined, await anyToken());

/** Download a recording as a Blob (both roles). */
export async function fetchAudio(submissionId: number): Promise<Blob> {
  const res = await fetch(`${await feedUrl()}/audio/${submissionId}`, { headers: { Authorization: `Bearer ${await anyToken()}` } });
  if (res.status === 410) throw new RemoteError('This recording was deleted after 8 weeks.', 410);
  if (!res.ok) throw new RemoteError(`Could not load audio (HTTP ${res.status})`, res.status);
  return res.blob();
}

/* ── admin ── */

export const adminMembers = async () => call<AdminMember[]>('GET', '/admin/members', undefined, await adminToken());
export const addMember = async (name: string) =>
  call<AdminMember & { pin: string }>('POST', '/admin/members', { name }, await adminToken());
export const resetPin = async (id: number) => call<{ id: number; pin: string }>('POST', `/admin/members/${id}/pin`, {}, await adminToken());
export const updateMember = async (id: number, patch: { name?: string; active?: boolean }) =>
  call('PATCH', `/admin/members/${id}`, patch, await adminToken());
export const deleteMember = async (id: number) => call('DELETE', `/admin/members/${id}`, undefined, await adminToken());

export const saveConfig = async (cfg: Omit<RecordConfig, 'window'>) =>
  call<RecordConfig>('PUT', '/admin/config', cfg, await adminToken());

export const listSubmissions = async (week: string) =>
  call<Submission[]>('GET', `/admin/submissions?week=${week}`, undefined, await adminToken());
export const updateSubmission = async (id: number, patch: Partial<Submission>) =>
  call('PATCH', `/admin/submissions/${id}`, patch, await adminToken());
export const allowRedo = async (id: number) => call('DELETE', `/admin/submissions/${id}`, undefined, await adminToken());
export const giveExtraTry = async (memberId: number) =>
  call<{ ok: true }>('POST', `/admin/members/${memberId}/extra-try`, {}, await adminToken());
export interface NeedsTry { member_id: number; name: string; used: number; bonus: number; alerted_at: number }
export const needsTry = async () =>
  call<{ weekStart: string; open: boolean; members: NeedsTry[] }>('GET', '/admin/needs-try', undefined, await adminToken());
export const gradingLog = async () => call<Submission[]>('GET', '/admin/scores?full=1', undefined, await adminToken());
export const scorePairs = async () =>
  call<{ auto_total: number; manual_total: number }[]>('GET', '/admin/scores', undefined, await adminToken());

/** Transcribe one clip on the Worker with the admin token (no proxy secret needed). */
export async function transcribe(p: {
  audioBase64: string; mimeType: string; engine: 'whisper' | 'sarvam'; prompt?: string; keyterms?: string[];
}): Promise<{ transcript: string; durationSeconds: number }> {
  return call('POST', '/', { ...p, language: 'ta' }, await adminToken(), 120000);
}

/* ── formatting ── */

export function fmtWhen(ms: number): string {
  return new Date(ms).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
