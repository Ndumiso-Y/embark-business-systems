// Optometry helpers shared by the configuration and its pages.
import type { DemoRecord, IndustryData, Values } from '../../core/types';
import { findRecord, linesTotals, lines, num, records, str } from '../../core/engine';
import { daysBetween, formatDate } from '../../core/lib/dates';
import { APPOINTMENT_TYPES, TARIFFS } from './data';
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

/** Scheme + patient payments still missing on a claim, in cents (never negative). */
export const claimOutstanding = (r: DemoRecord) => Math.max(0, claimTotal(r) - Math.round(num(r, 'schemePaid') * 100) - Math.round(num(r, 'patientPaid') * 100));

/** Demo tariff line for an exam, chosen from the linked appointment type. */
export function tariffForExam(exam: DemoRecord, data: IndustryData) {
  const type = str(findRecord(data, 'appointments', str(exam, 'appointment')), 'type');
  const code = type === 'diabetic' ? 'DEMO-SC1' : type === 'clfit' ? 'DEMO-CL1' : type === 'claftercare' ? 'DEMO-CL2' : 'DEMO-EX1';
  return TARIFFS.find((t) => t.code === code) ?? TARIFFS[0];
}

export const FRAME_CATEGORIES = ['frame', 'sunglass'];

export type OrderProblem = { key: 'rx' | 'expired' | 'pd' | 'frame' | 'stock' | 'deposit'; message: string };

/** Everything that stops a quoted optical order from going to the lab, in the order it is checked. */
export function orderProblems(r: DemoRecord, data: IndustryData, today = todayStr()): OrderProblem[] {
  const out: OrderProblem[] = [];
  const spectacles = str(r, 'kind') !== 'cl';
  const rx = findRecord(data, 'prescriptions', str(r, 'prescription'));
  if (!rx) out.push({ key: 'rx', message: 'Link a prescription before ordering.' });
  else if (str(rx, 'expiry') < today) out.push({ key: 'expired', message: `Prescription ${rx.ref} expired on ${formatDate(str(rx, 'expiry'))}. Re-examine first.` });
  if (spectacles && !num(r, 'pd')) out.push({ key: 'pd', message: 'Enter the pupillary distance (PD).' });
  const frame = findRecord(data, 'stock', str(r, 'frame'));
  if (spectacles && !frame) out.push({ key: 'frame', message: 'Select a frame from stock.' });
  else if (spectacles && frame && !FRAME_CATEGORIES.includes(str(frame, 'category'))) out.push({ key: 'frame', message: `${str(frame, 'name')} is not a frame — select a frame from stock.` });
  else if (frame && num(frame, 'qty') < 1) out.push({ key: 'stock', message: `${str(frame, 'name')} is out of stock.` });
  if (num(r, 'deposit') <= 0 && str(r, 'funding') === 'private') out.push({ key: 'deposit', message: 'Private orders need a deposit before going to the lab.' });
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

/* ---------------- Diary ---------------- */

export const byDateTime = (a: DemoRecord, b: DemoRecord) => (str(a, 'date') + str(a, 'time')).localeCompare(str(b, 'date') + str(b, 'time'));

/** Half-hour planner slots, 08:00–16:30. */
export const SLOTS = Array.from({ length: 18 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
export const slotOf = (t: string) => `${t.slice(0, 2)}:${Number(t.slice(3, 5)) >= 30 ? '30' : '00'}`;
const ACTIVE = ['booked', 'arrived', 'pretest', 'inexam', 'dispensing', 'completed'];

/** True if the practitioner already has an active appointment at that date/time. */
export function clashes(all: DemoRecord[], v: Values, ignoreId?: string) {
  return all.some((a) => a.id !== ignoreId && ACTIVE.includes(a.status ?? '') && str(a, 'date') === v.date && str(a, 'practitioner') === v.practitioner && slotOf(str(a, 'time')) === slotOf(String(v.time ?? '')));
}
