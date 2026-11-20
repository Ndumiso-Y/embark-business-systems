// Numbers and short lists behind the optometry dashboard. Pure functions over the
// day's appointment records (unit tested in tests/optometry-dashboard.test.ts), so
// every figure on the dashboard has one documented definition.
import type { DemoRecord } from '../../core/types';
import { str } from '../../core/engine';

/** Appointment statuses that mean the patient is physically in the practice. */
export const IN_PRACTICE = ['arrived', 'pretest', 'inexam', 'dispensing'] as const;

export type FlowSummary = {
  /** Appointments today that were not cancelled — the denominator for `completedPct`. */
  expected: number;
  booked: number;
  inPractice: number;
  completed: number;
  noShow: number;
  cancelled: number;
  /** Per in-practice status, in workflow order. */
  stages: Array<{ key: string; count: number }>;
  /** completed ÷ expected, rounded to a whole percent; 0 when nothing is expected. */
  completedPct: number;
};

export function flowSummary(todays: DemoRecord[]): FlowSummary {
  const count = (status: string) => todays.filter((a) => a.status === status).length;
  const stages = IN_PRACTICE.map((key) => ({ key, count: count(key) }));
  const cancelled = count('cancelled');
  const expected = todays.length - cancelled;
  const completed = count('completed');
  return {
    expected,
    booked: count('booked'),
    inPractice: stages.reduce((n, s) => n + s.count, 0),
    completed,
    noShow: count('noshow'),
    cancelled,
    stages,
    completedPct: expected > 0 ? Math.round((completed / expected) * 100) : 0,
  };
}

const byTime = (a: DemoRecord, b: DemoRecord) => str(a, 'time').localeCompare(str(b, 'time'));

/**
 * The diary preview: patients in the practice first, then those still to arrive; if the
 * day is nearly over, the most recently finished visits fill the remaining rows.
 * Returned in time order.
 */
export function nowAndNext(todays: DemoRecord[], limit = 4): DemoRecord[] {
  const active = todays.filter((a) => (IN_PRACTICE as readonly string[]).includes(a.status ?? '')).sort(byTime);
  const upcoming = todays.filter((a) => a.status === 'booked').sort(byTime);
  const done = todays.filter((a) => a.status === 'completed').sort(byTime).reverse();
  return [...active, ...upcoming, ...done].slice(0, limit).sort(byTime);
}

/**
 * Patients seen or being seen today, most recent appointment first, one row per patient.
 * Patients who are only booked, did not attend or cancelled are not "recent".
 */
export function recentPatients(todays: DemoRecord[], limit = 3): DemoRecord[] {
  const seen = new Set<string>();
  const out: DemoRecord[] = [];
  for (const a of todays.filter((x) => x.status === 'completed' || (IN_PRACTICE as readonly string[]).includes(x.status ?? '')).sort(byTime).reverse()) {
    const patient = str(a, 'patient');
    if (!patient || seen.has(patient)) continue;
    seen.add(patient);
    out.push(a);
    if (out.length >= limit) break;
  }
  return out;
}

/** Donut segments as fractions of the ring, in drawing order. */
export function flowSegments(f: FlowSummary): Array<{ key: 'completed' | 'inPractice' | 'booked' | 'noShow'; share: number }> {
  if (f.expected <= 0) return [];
  return ([
    { key: 'completed', share: f.completed / f.expected },
    { key: 'inPractice', share: f.inPractice / f.expected },
    { key: 'booked', share: f.booked / f.expected },
    { key: 'noShow', share: f.noShow / f.expected },
  ] as const).filter((s) => s.share > 0).map((s) => ({ ...s }));
}
