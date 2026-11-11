/** Date helpers. All stored dates are ISO `YYYY-MM-DD` strings. */

export function todayIso(): string {
  return toIso(new Date());
}

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function daysBetween(fromIso: string, toIsoStr: string): number {
  const a = parseIso(fromIso).getTime();
  const b = parseIso(toIsoStr).getTime();
  return Math.round((b - a) / 86_400_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = parseIso(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(isoTs: string): string {
  const d = new Date(isoTs);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}

/**
 * The last `n` calendar months ending with today's month, oldest first, as YYYY-MM keys.
 * Use this for month charts — subtracting ~30 days at a time skips or repeats months.
 */
export function monthKeys(today: string, n: number): string[] {
  const [y, m] = today.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function monthShort(key: string): string {
  const m = Number(key.split('-')[1]);
  return MONTHS[(m || 1) - 1];
}

/** Relative description like "Today, 10:42" or "Yesterday" or a date. */
export function relativeWhen(isoTs: string, now = new Date()): string {
  const d = new Date(isoTs);
  if (Number.isNaN(d.getTime())) return '—';
  const sameDay = toIso(d) === toIso(now);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `Today, ${hh}:${mm}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (toIso(d) === toIso(y)) return 'Yesterday';
  return formatDate(toIso(d));
}

export type DueState = 'overdue' | 'due-soon' | 'ok' | 'none';

/** Classify a due date relative to today. "Due soon" is within `window` days. */
export function dueState(iso: string | undefined | null, today = todayIso(), window = 30): DueState {
  if (!iso) return 'none';
  const diff = daysBetween(today, iso);
  if (diff < 0) return 'overdue';
  if (diff <= window) return 'due-soon';
  return 'ok';
}
