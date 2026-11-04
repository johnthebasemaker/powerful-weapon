import { localIso } from './dates';
// Tiny CSV parser — handles quoted fields, commas inside quotes, CRLF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (field.length || cur.length) { cur.push(field); rows.push(cur); }
        cur = []; field = '';
        if (c === '\r' && text[i + 1] === '\n') i++;
      } else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v.trim().length));
}

export interface CsvUserRow {
  name: string;
  phone: string;
  joined_date: string;
}

/** Largest members file accepted (~2,000 rows); anything bigger is not a members list. */
export const MAX_CSV_BYTES = 100 * 1024;
export const MAX_CSV_ROWS = 1000;

const HEADER: Record<keyof CsvUserRow, string[]> = {
  name: ['name', 'membername', 'fullname'],
  phone: ['mobilenumber', 'mobile', 'mobileno', 'phone', 'phonenumber', 'phoneno', 'whatsapp', 'whatsappnumber', 'number'],
  joined_date: ['joineddate', 'joined', 'joinedon', 'joiningdate', 'datejoined', 'date'],
};
const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');

/** "2026-03-05", "05-03-2026", "5/3/2026", "05.03.2026" (day first, as written in India) → ISO, or null. */
export function parseJoinedDate(raw: string): string | null {
  const v = raw.trim();
  let y: number, m: number, d: number;
  let r = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (r) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return localIso(dt);
}

export function parseUsersCsv(text: string): { rows: CsvUserRow[]; errors: string[] } {
  const raw = parseCsv(text.replace(/^﻿/, '')); // Excel adds a byte-order mark
  if (!raw.length) return { rows: [], errors: ['The file is empty.'] };
  const errors: string[] = [];
  const header = raw[0].map(headerKey);
  const col = (k: keyof CsvUserRow) => header.findIndex((h) => HEADER[k].includes(h));
  let [iName, iPhone, iJoined] = [col('name'), col('phone'), col('joined_date')];
  let dataStart = 1;
  if (iName < 0) {
    // No header row: assume Name, Mobile number, Joined date.
    if (raw[0].length >= 2 && /\d{6}/.test(raw[0][1] ?? '')) { [iName, iPhone, iJoined] = [0, 1, 2]; dataStart = 0; }
    else return { rows: [], errors: ['The first row must be the headings: Name, Mobile number, Joined date'] };
  }
  if (iPhone < 0) return { rows: [], errors: ['No "Mobile number" column found.'] };
  if (raw.length - dataStart > MAX_CSV_ROWS) return { rows: [], errors: [`Too many rows — up to ${MAX_CSV_ROWS} members per file.`] };
  const rows: CsvUserRow[] = [];
  const seen = new Set<string>();
  for (let i = dataStart; i < raw.length; i++) {
    const r = raw[i];
    const name = (r[iName] ?? '').trim();
    const phone = (r[iPhone] ?? '').trim().replace(/[^\d+]/g, '');
    const joinedRaw = iJoined >= 0 ? (r[iJoined] ?? '').trim() : '';
    if (!name) { errors.push(`Row ${i + 1}: no name`); continue; }
    if (phone.replace(/\D/g, '').length < 10) { errors.push(`Row ${i + 1} (${name}): mobile number "${r[iPhone] ?? ''}" is too short`); continue; }
    if (seen.has(phone)) { errors.push(`Row ${i + 1} (${name}): same number as an earlier row`); continue; }
    const joined = joinedRaw ? parseJoinedDate(joinedRaw) : localIso(new Date());
    if (!joined) { errors.push(`Row ${i + 1} (${name}): joined date "${joinedRaw}" — use DD-MM-YYYY`); continue; }
    seen.add(phone);
    rows.push({ name, phone, joined_date: joined });
  }
  return { rows, errors };
}
