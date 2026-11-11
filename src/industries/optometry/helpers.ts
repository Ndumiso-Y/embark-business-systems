// Optometry helpers shared by the configuration and its pages.
import type { DemoRecord, IndustryData } from '../../core/types';
import { findRecord, linesTotals, lines, records, str } from '../../core/engine';
import { daysBetween } from '../../core/lib/dates';
import { APPOINTMENT_TYPES } from './data';
import { eyeFrom, validateEye, validVA } from './rx';

export const patientName = (data: IndustryData, id: unknown) => {
  const p = findRecord(data, 'patients', String(id ?? ''));
  return p ? `${str(p, 'firstName')} ${str(p, 'lastName')}` : 'Unknown patient';
};

export function isClinical(r: DemoRecord) {
  return APPOINTMENT_TYPES.find((t) => t.value === str(r, 'type'))?.clinical ?? true;
}

// Indirection so tests can pin "today" (see tests/optometry.test.ts).
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function examProblems(r: DemoRecord): string[] {
  const out: string[] = [];
  const re = validateEye(eyeFrom(r.values, 'r'));
  const le = validateEye(eyeFrom(r.values, 'l'));
  for (const [k, m] of Object.entries(re)) out.push(`Right eye ${k}: ${m}`);
  for (const [k, m] of Object.entries(le)) out.push(`Left eye ${k}: ${m}`);
  for (const k of ['r_vaUnaided', 'l_vaUnaided', 'r_va', 'l_va']) if (!validVA(str(r, k))) out.push(`Visual acuity "${str(r, k)}" is not in 6/x, CF, HM, PL or NPL form.`);
  if (!str(r, 'diagnosis')) out.push('Select a diagnosis code before finalising.');
  return out;
}

export const claimTotal = (r: DemoRecord) => linesTotals(lines(r)).total;

export function claimProblems(r: DemoRecord, data: IndustryData): string[] {
  const out: string[] = [];
  const p = findRecord(data, 'patients', str(r, 'patient'));
  if (!p) out.push('Select a patient.');
  if (!str(r, 'scheme') || str(r, 'scheme') === 'private') out.push('Private patients are billed directly, not claimed from a scheme.');
  if (!str(r, 'memberNo')) out.push('Enter the (fictional) membership number.');
  if (!str(r, 'icd10')) out.push('An ICD-10 diagnosis code is required on every claim line.');
  if (!lines(r).length) out.push('Add at least one claim line.');
  return out;
}

export const RX_TYPES = [
  { value: 'distance', label: 'Distance' }, { value: 'near', label: 'Reading' }, { value: 'multifocal', label: 'Multifocal' }, { value: 'cl', label: 'Contact lenses' },
];

export const STOCK_CATEGORIES = [
  { value: 'frame', label: 'Frame' }, { value: 'sunglass', label: 'Sunglasses' }, { value: 'cl', label: 'Contact lenses' }, { value: 'solution', label: 'Solutions & care' }, { value: 'accessory', label: 'Accessories' },
];

/** Due recalls (overdue or within the next 45 days), most overdue first. */
export function dueRecalls(data: IndustryData, today: string) {
  return records(data, 'patients')
    .filter((p) => str(p, 'recallDue') && daysBetween(today, str(p, 'recallDue')) <= 45)
    .sort((a, b) => str(a, 'recallDue').localeCompare(str(b, 'recallDue')));
}
