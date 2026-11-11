// General-practice helpers shared by the configuration, its pages and tests.
// Kept separate from index.ts so pages can import them without a cycle.
// Every rule here is a demo data-entry rule, NOT clinical decision support.
import type { DemoRecord, Flag, IndustryData, Values } from '../../core/types';
import { findRecord, lines, linesTotals, records, str } from '../../core/engine';
import { daysBetween } from '../../core/lib/dates';
import { MEDICINES, TARIFFS, VISIT_TYPES } from './data';

export const patientName = (data: IndustryData, id: unknown) => {
  const p = findRecord(data, 'patients', String(id ?? ''));
  return p ? `${str(p, 'firstName')} ${str(p, 'lastName')}` : 'Unknown patient';
};

// Indirection so tests can pin "today" (see tests/medical.test.ts).
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * A seeded clock time for today, or '' when it is still ahead of the real clock.
 * The seeded queue is a mid-morning snapshot; opened earlier in the day, its
 * arrival times would read as being in the future.
 */
export const shownTime = (t: string, now = nowTime()) => (t && t <= now ? t : '');

/* ---------------- Visits & triage ---------------- */

export const needsDoctor = (r: DemoRecord) => VISIT_TYPES.find((t) => t.value === str(r, 'type'))?.doctor ?? true;

const has = (v: Values, k: string) => v[k] !== undefined && v[k] !== null && v[k] !== '' && Number.isFinite(Number(v[k]));

/** Required triage observations (glucose is optional). */
export const REQUIRED_VITALS: Array<[string, string]> = [['bpSys', 'BP systolic'], ['bpDia', 'BP diastolic'], ['pulse', 'pulse'], ['temp', 'temperature'], ['spo2', 'SpO2'], ['weight', 'weight']];

const RANGES: Record<string, [number, number, string]> = {
  bpSys: [60, 260, 'BP systolic'], bpDia: [30, 160, 'BP diastolic'], pulse: [30, 220, 'Pulse'], temp: [33, 43, 'Temperature'],
  spo2: [50, 100, 'SpO2'], weight: [1, 300, 'Weight'], glucose: [1, 40, 'Glucose'],
};

/**
 * Problems that stop a visit being marked as triaged. Empty means vitals are
 * complete and within plausible entry ranges. BP is optional for children under 12.
 */
export function vitalsProblems(v: Values, child = false): string[] {
  const missing = REQUIRED_VITALS.filter(([k]) => !(child && k.startsWith('bp')) && !has(v, k)).map(([, l]) => l);
  if (missing.length) return [`Capture vitals before triage — missing: ${missing.join(', ')}.`];
  const out: string[] = [];
  for (const [k, [lo, hi, l]] of Object.entries(RANGES)) {
    if (has(v, k) && (Number(v[k]) < lo || Number(v[k]) > hi)) out.push(`${l} ${v[k]} is outside the accepted entry range (${lo}–${hi}).`);
  }
  if (has(v, 'bpSys') && has(v, 'bpDia') && Number(v.bpDia) >= Number(v.bpSys)) out.push('Diastolic BP must be lower than systolic.');
  return out;
}

/**
 * Demo attention rules on triage vitals. These only highlight a visit "for
 * doctor review" in the demo; they are not clinical thresholds or advice.
 */
export function vitalAlerts(v: Values): Flag[] {
  const out: Flag[] = [];
  if (has(v, 'bpSys') && has(v, 'bpDia') && (Number(v.bpSys) >= 140 || Number(v.bpDia) >= 90)) out.push({ tone: 'amber', label: `BP ${v.bpSys}/${v.bpDia} — for doctor review (demo rule)` });
  if (has(v, 'temp') && Number(v.temp) >= 38) out.push({ tone: 'amber', label: `Temp ${Number(v.temp).toFixed(1)} °C — for doctor review (demo rule)` });
  if (has(v, 'spo2') && Number(v.spo2) < 94) out.push({ tone: 'red', label: `SpO2 ${v.spo2}% — for doctor review (demo rule)` });
  return out;
}

/** Minutes since arrival, only when it makes sense on the current clock (else null). */
export function minutesWaiting(r: DemoRecord, today: string, now = nowTime()): number | null {
  const at = str(r, 'arrivedAt');
  if (!at || str(r, 'date') !== today) return null;
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const diff = m(now) - m(at);
  return diff >= 0 && diff <= 300 ? diff : null;
}

export function ageOn(dob: string, today: string): number {
  if (!dob) return 0;
  const [y, m, d] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** Triage guard used by the visit workflow. */
export function triageBlock(r: DemoRecord, data: IndustryData, today = todayStr()): string | null {
  const p = findRecord(data, 'patients', str(r, 'patient'));
  return vitalsProblems(r.values, ageOn(str(p, 'dob'), today) < 12)[0] ?? null;
}

export const byDateTime = (a: DemoRecord, b: DemoRecord) => (str(a, 'date') + str(a, 'time')).localeCompare(str(b, 'date') + str(b, 'time'));

const BOOKED_STATES = ['booked', 'arrived', 'triaged', 'withdoctor', 'billing', 'done'];
/** True if the clinician already has an active visit at that date and time. */
export function clashes(all: DemoRecord[], v: Values, ignoreId?: string) {
  return all.some((a) => a.id !== ignoreId && BOOKED_STATES.includes(a.status ?? '') && str(a, 'date') === v.date && str(a, 'clinician') === v.clinician && str(a, 'time') === v.time);
}

export const WAITING_STATES = ['arrived', 'triaged', 'withdoctor', 'billing'];

/* ---------------- Consultations ---------------- */

export function consultProblems(r: DemoRecord): string[] {
  const out: string[] = [];
  if (!str(r, 'subjective').trim()) out.push('Record the subjective history (S) before signing.');
  if (!str(r, 'assessment').trim()) out.push('Record an assessment (A) before signing.');
  if (!str(r, 'icd10')) out.push('Select an ICD-10 code before signing.');
  if (!str(r, 'plan').trim()) out.push('Record the plan (P) before signing.');
  return out;
}

/** Tariff line for a consultation, chosen from the linked visit type. */
export function tariffForConsult(r: DemoRecord, data: IndustryData) {
  const visit = findRecord(data, 'visits', str(r, 'visit'));
  const code = VISIT_TYPES.find((t) => t.value === str(visit, 'type'))?.tariff ?? 'DEMO-GP1';
  return TARIFFS.find((t) => t.code === code) ?? TARIFFS[0];
}

/* ---------------- Prescriptions & allergies ---------------- */

const NO_ALLERGY = /^\s*(nka|nkda|none|no known)/i;

/**
 * Text match of a medicine (name or group) against the recorded allergy text.
 * Returns the matched group or null. A demo data-entry check only.
 */
export function allergyConflict(allergies: string, medicine: string): { term: string; group: string; medicine: string } | null {
  const text = allergies.toLowerCase();
  if (!text.trim() || NO_ALLERGY.test(text)) return null;
  const med = MEDICINES.find((m) => m.value === medicine);
  if (!med) return null;
  const term = med.match.find((t) => text.includes(t));
  return term ? { term, group: med.group, medicine: med.label } : null;
}

export function scriptAllergyBlock(r: DemoRecord, data: IndustryData): string | null {
  const p = findRecord(data, 'patients', str(r, 'patient'));
  const c = allergyConflict(str(p, 'allergies'), str(r, 'medicine'));
  return c ? `Recorded allergy: "${str(p, 'allergies')}". ${c.medicine} is in the ${c.group} group — choose another medicine or update the allergy record. (Demo text match, not clinical decision support.)` : null;
}

export function scriptProblems(r: DemoRecord, data: IndustryData): string[] {
  const out: string[] = [];
  const allergy = scriptAllergyBlock(r, data);
  if (allergy) out.push(allergy);
  if (!str(r, 'medicine')) out.push('Select a medicine.');
  if (!str(r, 'dose') || !str(r, 'frequency')) out.push('Enter the dose and frequency.');
  const rep = Number(r.values.repeats ?? 0);
  if (!Number.isInteger(rep) || rep < 0 || rep > 5) out.push('Repeats must be a whole number from 0 to 5.');
  return out;
}

/* ---------------- Results ---------------- */

export function resultFlags(r: DemoRecord, today: string): Flag[] {
  const out: Flag[] = [];
  if (r.status === 'requested' && str(r, 'requestedOn') && daysBetween(str(r, 'requestedOn'), today) > 7) out.push({ tone: 'amber', label: 'Awaiting result > 7 days' });
  if (r.status === 'received' && r.values.abnormal) out.push({ tone: 'red', label: 'Abnormal, not yet reviewed' });
  if (r.status === 'reviewed' && r.values.abnormal) out.push({ tone: 'amber', label: 'Patient not yet informed' });
  return out;
}

export const unreviewedAbnormal = (data: IndustryData) => records(data, 'results').filter((r) => r.status === 'received' && r.values.abnormal);

/* ---------------- Chronic care ---------------- */

export type ReviewState = 'overdue' | 'due-soon' | 'ok' | 'none';
export function reviewState(r: DemoRecord, today: string, window = 30): ReviewState {
  const due = str(r, 'nextReview');
  if (!due) return 'none';
  const d = daysBetween(today, due);
  return d < 0 ? 'overdue' : d <= window ? 'due-soon' : 'ok';
}

export const overdueChronic = (data: IndustryData, today: string) =>
  records(data, 'chronic').filter((r) => r.status === 'active' && reviewState(r, today) === 'overdue').sort((a, b) => str(a, 'nextReview').localeCompare(str(b, 'nextReview')));

/* ---------------- Claims ---------------- */

export const claimTotal = (r: DemoRecord) => linesTotals(lines(r)).total;

export function claimProblems(r: DemoRecord, data: IndustryData): string[] {
  const out: string[] = [];
  if (!findRecord(data, 'patients', str(r, 'patient'))) out.push('Select a patient.');
  if (!str(r, 'scheme') || str(r, 'scheme') === 'private') out.push('Private patients are billed directly, not claimed from a scheme.');
  if (!str(r, 'memberNo')) out.push('Enter the (fictional) membership number.');
  if (!str(r, 'icd10')) out.push('An ICD-10 code is required on every scheme claim.');
  if (!lines(r).length) out.push('Add at least one tariff line.');
  const bad = lines(r).find((l) => !TARIFFS.some((t) => t.code === l.code));
  if (bad) out.push(`Line "${bad.description}" needs a code from the demo tariff list (DEMO-…).`);
  return out;
}

export const outstandingCents = (r: DemoRecord) => claimTotal(r) - Math.round((Number(r.values.schemePaid) || 0) * 100) - Math.round((Number(r.values.patientPaid) || 0) * 100);
