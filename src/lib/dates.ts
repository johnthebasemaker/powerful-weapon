export function currentWeekStart(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dateForSlot(weekStart: string, slot: number): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + (slot - 1));
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

export function yearBounds(year = new Date().getFullYear()): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function weekdayLabel(slot: number): string {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][slot - 1];
}

/**
 * Smart default for the Voice Inbox week picker.
 *
 * Workflow context: members memorize Mon–Sat, recite on Sunday or early Monday.
 * Admin processes recordings on Mon/Tue → those uploads belong to the *previous*
 * week's verses. From Wed onward she's caught up, so default to current week.
 */
export function defaultUploadWeek(date = new Date()): string {
  const day = date.getDay(); // 0=Sun, 1=Mon, 2=Tue, ...
  const isEarlyWeek = day === 1 || day === 2; // Mon or Tue
  const cur = currentWeekStart(date);
  return isEarlyWeek ? addDays(cur, -7) : cur;
}

export function isPreviousWeek(weekStart: string, today = new Date()): boolean {
  return weekStart === addDays(currentWeekStart(today), -7);
}

export function formatHuman(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
