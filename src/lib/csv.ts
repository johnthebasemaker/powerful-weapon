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

export function parseUsersCsv(text: string): { rows: CsvUserRow[]; errors: string[] } {
  const raw = parseCsv(text);
  if (!raw.length) return { rows: [], errors: ['Empty file'] };
  const errors: string[] = [];
  let header = raw[0].map((s) => s.trim().toLowerCase());
  let dataStart = 1;
  // Tolerate missing header
  if (!header.includes('name')) {
    header = ['name', 'phone', 'joined_date'];
    dataStart = 0;
  }
  const iName = header.indexOf('name');
  const iPhone = header.indexOf('phone');
  const iJoined = header.indexOf('joined_date');
  if (iName < 0 || iPhone < 0 || iJoined < 0) {
    errors.push('CSV must have columns: name, phone, joined_date');
    return { rows: [], errors };
  }
  const rows: CsvUserRow[] = [];
  for (let i = dataStart; i < raw.length; i++) {
    const r = raw[i];
    const name = (r[iName] ?? '').trim();
    const phone = (r[iPhone] ?? '').trim();
    const joined = (r[iJoined] ?? '').trim();
    if (!name || !phone) {
      errors.push(`Row ${i + 1}: missing name or phone`);
      continue;
    }
    rows.push({ name, phone, joined_date: joined || new Date().toISOString().slice(0, 10) });
  }
  return { rows, errors };
}
