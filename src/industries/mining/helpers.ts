// Mining helpers shared by the configuration, its pages and the tests.
// Kept free of page imports so index.ts and pages/*.tsx can both use them
// without circular imports.
import type { DemoRecord, DemoUser, IndustryData } from '../../core/types';
import { findRecord, num, records, str } from '../../core/engine';
import { daysBetween, dueState, formatDate } from '../../core/lib/dates';
import { ENV_PARAMS, O2_MAX, O2_MIN, SECTIONS, withUnit } from './data';

/* ---------------- "Today" indirection (tests pin the date) ---------------- */
let todayOverride: string | null = null;
let timeOverride = '12:00';
export function setTodayForTests(iso: string | null, time = '12:00') { todayOverride = iso; timeOverride = time; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Current wall-clock time HH:MM (pinned to 12:00 while a test date is set). */
export function nowTime() {
  if (todayOverride) return timeOverride;
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const isNum = (v: unknown) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));

/* ---------------- Production ---------------- */
export type ProductionTotals = { tonnes: number; target: number; pct: number; shifts: number; delayMinutes: number };

function totals(list: DemoRecord[]): ProductionTotals {
  const tonnes = list.reduce((n, r) => n + num(r, 'tonnesHoisted'), 0);
  const target = list.reduce((n, r) => n + num(r, 'targetTonnes'), 0);
  return { tonnes, target, pct: target ? Math.round((tonnes / target) * 100) : 0, shifts: list.length, delayMinutes: list.reduce((n, r) => n + num(r, 'delayMinutes'), 0) };
}

/**
 * Month-to-date tonnes hoisted vs planned tonnes: completed (submitted or verified)
 * shifts dated from the 1st up to and including `today`. Open shifts are excluded
 * so a half-finished shift does not count its full target.
 */
export function productionToDate(data: IndustryData, today: string, section?: string): ProductionTotals {
  const month = today.slice(0, 7);
  return totals(records(data, 'shifts').filter((r) => r.status !== 'open' && str(r, 'date').startsWith(month) && str(r, 'date') <= today && (!section || str(r, 'section') === section)));
}

export function productionOn(data: IndustryData, date: string): ProductionTotals {
  return totals(records(data, 'shifts').filter((r) => str(r, 'date') === date));
}

export function sectionsToDate(data: IndustryData, today: string) {
  return SECTIONS.map((s) => ({ ...s, ...productionToDate(data, today, s.value) }));
}

/** Guard for verifying a shift log. Returns the first problem or null. */
export function shiftVerifyProblem(record: DemoRecord, user: DemoUser): string | null {
  if (num(record, 'delayMinutes') > 30 && !str(record, 'delayReason')) {
    return `${num(record, 'delayMinutes')} delay minutes recorded — select a delay reason before verifying (required above 30 minutes).`;
  }
  const submitter = [...record.history].reverse().find((h) => h.action === 'Submit shift')?.by;
  if (submitter && submitter === user.name) return 'You submitted this shift log. A different person must verify it.';
  return null;
}

export function shiftSubmitProblem(record: DemoRecord): string | null {
  if (!isNum(record.values.tonnesHoisted)) return 'Enter the tonnes hoisted for the shift.';
  if (!(num(record, 'targetTonnes') > 0)) return 'Enter the planned (target) tonnes for the shift.';
  if (!str(record, 'crew')) return 'Record which crew worked the shift.';
  return null;
}

/* ---------------- Safety incidents ---------------- */
export function lastLti(data: IndustryData): DemoRecord | undefined {
  return records(data, 'incidents').filter((r) => r.values.lti === true).sort((a, b) => str(b, 'date').localeCompare(str(a, 'date')))[0];
}

/** Whole days since the most recent lost-time injury, or null when none is recorded. */
export function daysSinceLastLti(data: IndustryData, today: string): number | null {
  const l = lastLti(data);
  return l ? Math.max(0, daysBetween(str(l, 'date'), today)) : null;
}

export function incidentActionsProblem(record: DemoRecord): string | null {
  if (!str(record, 'rootCause').trim()) return 'Record the root cause from the investigation before moving to corrective actions.';
  if (!str(record, 'correctiveActions').trim()) return 'Describe the corrective actions agreed with the section.';
  if (!str(record, 'actionOwner').trim() || !str(record, 'actionDue')) return 'Assign an action owner and a due date for the corrective actions.';
  return null;
}

export function incidentCloseProblem(record: DemoRecord, today: string): string | null {
  if (!str(record, 'correctiveActions').trim()) return 'Describe the corrective actions before closing.';
  if (record.values.lti === true && !(num(record, 'lostDays') > 0)) return 'Lost-time injuries need the number of lost days recorded before closing.';
  const due = str(record, 'actionDue');
  if (!record.values.actionsComplete) {
    if (!due) return 'Set an action due date or mark the corrective actions complete.';
    if (due > today) return `Corrective actions are due ${formatDate(due)} and not marked complete — the incident cannot be closed yet.`;
  }
  return null;
}

/* ---------------- Permits to work ---------------- */
/** Confined-space gas test: oxygen must be between 19.5 % and 23.5 % (demo band). */
export function gasTestProblem(o2: unknown): string | null {
  if (!isNum(o2)) return 'Record the pre-entry gas test (oxygen %) for confined-space entry.';
  const n = Number(o2);
  if (n < O2_MIN) return `Oxygen ${n}% is below ${O2_MIN}% — oxygen-deficient atmosphere. Ventilate and re-test before entry.`;
  if (n > O2_MAX) return `Oxygen ${n}% is above ${O2_MAX}% — oxygen-enriched atmosphere. Investigate and re-test before entry.`;
  return null;
}

/** True when the permit's validity (date + time) has passed. */
export function permitExpired(record: DemoRecord, today: string, time = nowTime()): boolean {
  const d = str(record, 'validTo');
  if (!d) return false;
  if (d < today) return true;
  return d === today && !!str(record, 'expiresAt') && str(record, 'expiresAt') <= time;
}

export function permitActivationProblems(record: DemoRecord, data: IndustryData, today: string, time = nowTime()): string[] {
  const out: string[] = [];
  if (record.values.isolationConfirmed !== true) out.push('Isolation and lock-out must be confirmed on the permit before work starts.');
  if (str(record, 'type') === 'confined') {
    const gas = gasTestProblem(record.values.gasO2);
    if (gas) out.push(gas);
  }
  if (permitExpired(record, today, time)) out.push(`The permit validity ended ${formatDate(str(record, 'validTo'))} ${str(record, 'expiresAt')}. Raise a new permit.`);
  if (str(record, 'validFrom') > today) out.push(`The permit is only valid from ${formatDate(str(record, 'validFrom'))}.`);
  const c = findRecord(data, 'contractors', str(record, 'contractor'));
  if (c && !contractorClearance(c, today).cleared) out.push(`${contractorName(c)} is not cleared for site.`);
  return out;
}

/* ---------------- Equipment & maintenance ---------------- */
export type ServiceState = 'overdue' | 'due-soon' | 'ok';
export const SERVICE_SOON_HOURS = 50;

export function hoursToService(r: DemoRecord) {
  return num(r, 'nextServiceHours') - num(r, 'engineHours');
}

export function serviceState(r: DemoRecord): ServiceState {
  const left = hoursToService(r);
  if (left <= 0) return 'overdue';
  if (left <= SERVICE_SOON_HOURS) return 'due-soon';
  return 'ok';
}

export const equipmentLabel = (r: DemoRecord | undefined) => (r ? `${str(r, 'fleetNo')} · ${str(r, 'model')}` : 'Unknown machine');
export const equipmentName = (data: IndustryData, id: unknown) => equipmentLabel(findRecord(data, 'equipment', String(id ?? '')));

export function workOrderCompleteProblem(record: DemoRecord, data: IndustryData): string | null {
  const eq = findRecord(data, 'equipment', str(record, 'equipment'));
  if (!eq) return 'Link the work order to a machine in the equipment register.';
  if (!isNum(record.values.hoursAtService)) return 'Enter the engine-hour meter reading at completion.';
  if (num(record, 'hoursAtService') < num(eq, 'lastServiceHours')) return `Hour meter ${num(record, 'hoursAtService')} h is below the last recorded service (${num(eq, 'lastServiceHours')} h). Check the reading.`;
  if (!str(record, 'workDone').trim()) return 'Describe the work done before completing.';
  return null;
}

/* ---------------- Contractors ---------------- */
export const contractorName = (r: DemoRecord) => `${str(r, 'firstName')} ${str(r, 'lastName')}`;

export const EXPIRY_FIELDS = [
  { key: 'inductionExpiry', label: 'Site induction' },
  { key: 'medicalExpiry', label: 'Medical fitness' },
  { key: 'competencyExpiry', label: 'Competency certificate' },
] as const;

export function contractorExpiries(r: DemoRecord, today: string) {
  return EXPIRY_FIELDS.map((f) => ({ ...f, date: str(r, f.key), state: dueState(str(r, f.key), today, 30) }));
}

/** Site clearance: induction and medical fitness must be current. A lapsed competency certificate restricts the trade work only. */
export function contractorClearance(r: DemoRecord, today: string): { cleared: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const e of contractorExpiries(r, today)) {
    if (e.state === 'overdue' || e.state === 'none') {
      if (e.key === 'competencyExpiry') continue;
      reasons.push(`${e.label} ${e.state === 'none' ? 'not recorded' : `expired ${formatDate(e.date)}`}`);
    }
  }
  return { cleared: reasons.length === 0, reasons };
}

/* ---------------- Environmental monitoring ---------------- */
export const envParam = (r: DemoRecord) => ENV_PARAMS.find((p) => p.value === str(r, 'parameter'));

/** Exceedance description against the DEMO threshold, or null when within it. */
export function envExceedance(r: DemoRecord): string | null {
  const p = envParam(r);
  if (!p || !isNum(r.values.value)) return null;
  const v = num(r, 'value');
  if (p.max !== undefined && v > p.max) return `${p.label} ${withUnit(v, p.unit)} above demo threshold ${withUnit(p.max, p.unit)}`;
  if (p.min !== undefined && v < p.min) return `${p.label} ${withUnit(v, p.unit)} below demo threshold ${withUnit(p.min, p.unit)}`;
  return null;
}

export function envReviewProblem(record: DemoRecord, note: string | undefined): string | null {
  const ex = envExceedance(record);
  if (ex && !note?.trim()) return `Exceedance (${ex}). Add a review note describing the follow-up — use “Review with note”.`;
  return null;
}
