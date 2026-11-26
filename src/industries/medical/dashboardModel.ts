// Figures and short lists behind the medical dashboard. Pure functions over the day's
// visit records (unit tested in tests/medical-dashboard.test.ts), so every number on the
// dashboard has one documented definition. Visit states come from the visits workflow:
// booked → arrived → triaged → withdoctor → billing → done, or dna / cancelled.
import type { DemoRecord } from '../../core/types';
import type { RingSegment } from '../../core/components/overview';
import { str } from '../../core/engine';

/** Patients who are physically in the practice. */
export const IN_PRACTICE = ['arrived', 'triaged', 'withdoctor', 'billing'] as const;
/** Waiting to be seen: arrived (needs triage) or triaged (waiting for the doctor). */
export const WAITING = ['arrived', 'triaged'] as const;

export type VisitFlow = {
  /** Today's visits that were not cancelled — the denominator for `donePct`. */
  expected: number;
  booked: number;
  waiting: number;
  withDoctor: number;
  billing: number;
  done: number;
  dna: number;
  cancelled: number;
  /** done ÷ expected, as a whole percent; 0 when nothing is expected. */
  donePct: number;
};

export function visitFlow(todays: DemoRecord[]): VisitFlow {
  const count = (...states: string[]) => todays.filter((v) => states.includes(v.status ?? '')).length;
  const cancelled = count('cancelled');
  const expected = todays.length - cancelled;
  const done = count('done');
  return {
    expected,
    booked: count('booked'),
    waiting: count(...WAITING),
    withDoctor: count('withdoctor'),
    billing: count('billing'),
    done,
    dna: count('dna'),
    cancelled,
    donePct: expected > 0 ? Math.round((done / expected) * 100) : 0,
  };
}

/** Ring segments in flow order, lightest (still to arrive) to full colour (done). Shares add up to 1. */
export function flowRing(f: VisitFlow): RingSegment[] {
  if (f.expected <= 0) return [];
  const parts: RingSegment[] = [
    { key: 'done', share: f.done / f.expected, tone: 'accent' },
    { key: 'billing', share: f.billing / f.expected, tone: 'a85' },
    { key: 'withdoctor', share: f.withDoctor / f.expected, tone: 'a65' },
    { key: 'waiting', share: f.waiting / f.expected, tone: 'a40' },
    { key: 'booked', share: f.booked / f.expected, tone: 'muted' },
    { key: 'dna', share: f.dna / f.expected, tone: 'warn' },
  ];
  return parts.filter((p) => p.share > 0);
}

const byTime = (a: DemoRecord, b: DemoRecord) => str(a, 'time').localeCompare(str(b, 'time'));

/**
 * Schedule preview: everyone in the practice, then those still to arrive, in time order.
 * Near the end of the day the latest finished visits fill the remaining rows.
 */
export function nowAndNext(todays: DemoRecord[], limit = 5): DemoRecord[] {
  const active = todays.filter((v) => (IN_PRACTICE as readonly string[]).includes(v.status ?? '')).sort(byTime);
  const upcoming = todays.filter((v) => v.status === 'booked').sort(byTime);
  const done = todays.filter((v) => v.status === 'done').sort(byTime).reverse();
  return [...active, ...upcoming, ...done].slice(0, limit).sort(byTime);
}

/** Waiting patients, longest wait first (earliest arrival; unknown arrival times last). */
export function waitingLongest(todays: DemoRecord[]): DemoRecord[] {
  return todays.filter((v) => (WAITING as readonly string[]).includes(v.status ?? ''))
    .sort((a, b) => (str(a, 'arrivedAt') || '99').localeCompare(str(b, 'arrivedAt') || '99'));
}

/** Visits per booked hour, from the first to the last hour that has a visit (at least 07:00–17:00). */
export function visitsByHour(todays: DemoRecord[]): Array<{ hour: number; count: number }> {
  const hours = todays.map((v) => Number(str(v, 'time').slice(0, 2))).filter((h) => Number.isFinite(h));
  const from = Math.min(7, ...hours);
  const to = Math.max(17, ...hours);
  return Array.from({ length: to - from + 1 }, (_, i) => ({ hour: from + i, count: hours.filter((h) => h === from + i).length }));
}

export type ClinicianNow = { value: string; label: string; short: string; role: string; current: DemoRecord | null; seen: number; booked: number };

/** For each clinician: who they are with now (status "with doctor"), visits finished today, visits still booked. */
export function cliniciansNow(todays: DemoRecord[], clinicians: Array<{ value: string; label: string; short: string; role: string }>): ClinicianNow[] {
  return clinicians.map((c) => {
    const mine = todays.filter((v) => str(v, 'clinician') === c.value);
    return {
      ...c,
      current: mine.find((v) => v.status === 'withdoctor') ?? null,
      seen: mine.filter((v) => v.status === 'billing' || v.status === 'done').length,
      booked: mine.filter((v) => v.status === 'booked').length,
    };
  });
}
