// Figures behind the automotive dashboard. Pure functions over job-card records (unit tested
// in tests/automotive-dashboard.test.ts), so every number has one documented definition.
// Job states come from the job-card workflow: booked → checkedin → diagnosing → approval →
// inprogress → qc → ready → collected, or cancelled.
import type { DemoRecord } from '../../core/types';
import type { RingSegment } from '../../core/components/overview';
import { num, str } from '../../core/engine';

/** Workshop stages in flow order, with the tone used in the ring and legend. */
export const STAGES = [
  { key: 'checkedin', short: 'Check in', tone: 'a40' },
  { key: 'diagnosing', short: 'Diagnose', tone: 'a65' },
  { key: 'approval', short: 'Approval', tone: 'warn' },
  { key: 'inprogress', short: 'Work', tone: 'accent' },
  { key: 'qc', short: 'Quality', tone: 'a85' },
  { key: 'ready', short: 'Ready', tone: 'ok' },
] as const satisfies ReadonlyArray<{ key: string; short: string; tone: RingSegment['tone'] }>;

export type StageCount = { key: string; short: string; tone: RingSegment['tone']; count: number; share: number };

/** Vehicles on site by stage; `share` is the stage's part of all vehicles on site (0 when none). */
export function workshopStages(jobs: DemoRecord[]): { onSite: number; stages: StageCount[] } {
  const stages = STAGES.map((s) => ({ ...s, count: jobs.filter((j) => j.status === s.key).length, share: 0 }));
  const onSite = stages.reduce((n, s) => n + s.count, 0);
  for (const s of stages) s.share = onSite ? s.count / onSite : 0;
  return { onSite, stages };
}

/** Ring segments: every stage with at least one vehicle, in flow order. Shares add up to 1. */
export const stageRing = (stages: StageCount[]): RingSegment[] => stages.filter((s) => s.count > 0).map((s) => ({ key: s.key, share: s.share, tone: s.tone }));

/** Whole-number percentage of vehicles on site for one stage. */
export const pctOf = (share: number) => Math.round(share * 100);

/** Today's planned jobs in start-time order. */
export const byStart = (a: DemoRecord, b: DemoRecord) => (str(a, 'startTime') || '99').localeCompare(str(b, 'startTime') || '99');

/** Bay capacity for a day: hours booked against bays × hours per bay. */
export function capacity(hoursByBay: Record<string, number>, bays: number, dayHours: number) {
  const booked = Object.values(hoursByBay).reduce((a, b) => a + b, 0);
  const available = bays * dayHours;
  return { booked, available, pct: available > 0 ? Math.round((booked / available) * 100) : 0 };
}

/** Open job cards (on site, not yet collected), longest on site first by check-in date, then by reference. */
export function openJobCards(jobs: DemoRecord[], onSiteStates: readonly string[]): DemoRecord[] {
  return jobs.filter((j) => onSiteStates.includes(j.status ?? ''))
    .sort((a, b) => (str(a, 'checkedInOn') || '9999').localeCompare(str(b, 'checkedInOn') || '9999') || a.ref.localeCompare(b.ref));
}

export const hoursOf = (j: DemoRecord) => num(j, 'hoursBooked');
