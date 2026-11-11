// Automotive workshop helpers shared by the configuration, the seed and the
// pages. Kept separate from index.ts so pages can import them without a
// circular dependency.
import type { DemoRecord, IndustryData, Line } from '../../core/types';
import { findRecord, lines, linesTotals, num, records, str } from '../../core/engine';
import { daysBetween } from '../../core/lib/dates';
import { formatRand, group } from '../../core/lib/money';
import { DAY_HOURS, LABOUR_RATE, SERVICE_INTERVAL } from './data';

// Indirection so tests can pin "today" (see tests/automotive.test.ts).
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------------- Dates ---------------- */

/** Add whole months to an ISO date, clamping to the end of the month (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** The last `n` calendar months ending with today's month, oldest first, as YYYY-MM keys. */
export const lastMonths = (today: string, n: number) => Array.from({ length: n }, (_, i) => addMonths(`${today.slice(0, 7)}-01`, i - (n - 1)).slice(0, 7));

/** Kilometres with comma grouping, e.g. "118,400 km". */
export const kmText = (n: number) => `${n < 0 ? '-' : ''}${group(Math.round(n))} km`;

/* ---------------- Names & lookups ---------------- */

export const customerName = (data: IndustryData, id: unknown) => {
  const c = findRecord(data, 'customers', String(id ?? ''));
  return c ? str(c, 'name') : 'Unknown customer';
};

export const vehicleOf = (data: IndustryData, r: DemoRecord | undefined) => findRecord(data, 'vehicles', str(r, 'vehicle'));

export function vehicleLabel(data: IndustryData, id: unknown) {
  const v = findRecord(data, 'vehicles', String(id ?? ''));
  return v ? `${str(v, 'reg')} · ${str(v, 'make')} ${str(v, 'model')}` : 'Unknown vehicle';
}

export const vehicleCustomer = (data: IndustryData, vehicleId: unknown) => findRecord(data, 'customers', str(findRecord(data, 'vehicles', String(vehicleId ?? '')), 'customer'));

/** The invoice raised for a job card, if any (void invoices ignored). */
export const jobInvoice = (data: IndustryData, jobId: string) => records(data, 'invoices').find((i) => str(i, 'job') === jobId && i.status !== 'void');

/** States in which a job card is physically in (or waiting at) the workshop. */
export const IN_WORKSHOP = ['checkedin', 'diagnosing', 'approval', 'inprogress', 'qc', 'ready'];
export const OPEN_JOB = ['booked', ...IN_WORKSHOP];

export const activeJobFor = (data: IndustryData, vehicleId: string) => records(data, 'jobs').find((j) => str(j, 'vehicle') === vehicleId && OPEN_JOB.includes(j.status ?? ''));

/* ---------------- Lines: labour vs parts ---------------- */

export const isLabour = (l: Line) => (l.code ?? '').toUpperCase().startsWith('LAB');

/** A labour line: hours × hourly rate. */
export const labourLine = (id: string, description: string, hours: number, rate = LABOUR_RATE): Line => ({ id, code: 'LAB', description, qty: hours, unitPrice: rate });

/** VAT-exclusive cents split into labour and parts, plus document totals. */
export function splitTotals(ls: Line[]) {
  const t = linesTotals(ls);
  let labour = 0;
  let parts = 0;
  let hours = 0;
  ls.forEach((l, i) => {
    if (isLabour(l)) { labour += t.lines[i].excl; hours += l.qty; } else parts += t.lines[i].excl;
  });
  return { labour, parts, hours, net: t.net, vat: t.vat, total: t.total };
}

/** Cost of parts on a set of lines (cents), using the parts catalogue cost price. */
export function partsCost(data: IndustryData, ls: Line[]) {
  return ls.filter((l) => !isLabour(l)).reduce((n, l) => {
    const p = records(data, 'parts').find((x) => str(x, 'partNo') === l.code);
    return n + Math.round((p ? num(p, 'cost') : l.unitPrice) * l.qty * 100);
  }, 0);
}

/* ---------------- Invoices & payments ---------------- */

export const invoiceTotal = (r: DemoRecord) => linesTotals(lines(r)).total;
export const invoiceBalance = (r: DemoRecord) => invoiceTotal(r) - Math.round(num(r, 'paid') * 100);
export const invoiceOverdue = (r: DemoRecord, today: string) =>
  ['issued', 'partpaid'].includes(r.status ?? '') && !!str(r, 'issuedOn') && daysBetween(str(r, 'issuedOn'), today) > 30;

/**
 * Checks a payment about to be recorded against the outstanding balance.
 * `mode` "part" must leave something owing; "full" must settle it exactly.
 */
export function paymentProblem(r: DemoRecord, amountRand: number, mode: 'part' | 'full'): string | null {
  const amount = Math.round((Number.isFinite(amountRand) ? amountRand : 0) * 100);
  const balance = invoiceBalance(r);
  if (balance <= 0) return 'This invoice has no outstanding balance.';
  if (amount <= 0) return 'Enter the payment amount in the “Record payment” panel first.';
  if (amount > balance) return `A payment of ${formatRand(amount)} exceeds the outstanding balance of ${formatRand(balance)}.`;
  if (mode === 'part' && amount === balance) return 'That payment settles the invoice — record it as payment in full.';
  if (mode === 'full' && amount < balance) return `${formatRand(amount)} is less than the balance of ${formatRand(balance)} — record it as a part payment.`;
  return null;
}

/* ---------------- Job card rules ---------------- */

/** Odometer check at vehicle check-in. */
export function checkInProblem(job: DemoRecord, data: IndustryData): string | null {
  const v = vehicleOf(data, job);
  if (!v) return 'Link the customer’s vehicle first.';
  if (job.values.odometerIn === undefined || job.values.odometerIn === null || job.values.odometerIn === '') return 'Record the odometer reading in the “Check-in” panel on this job card before checking the vehicle in.';
  const last = num(v, 'odometer');
  if (num(job, 'odometerIn') < last) return `Odometer in (${kmText(num(job, 'odometerIn'))}) is below the last recorded reading of ${kmText(last)} for ${str(v, 'reg')}. Re-check the reading.`;
  return null;
}

/** The estimate for a job card: the linked one, else the newest estimate raised against the job (approved first). */
export function jobEstimate(data: IndustryData, job: DemoRecord): DemoRecord | undefined {
  const linked = findRecord(data, 'estimates', str(job, 'estimate'));
  if (linked) return linked;
  const mine = records(data, 'estimates').filter((e) => str(e, 'job') === job.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mine.find((e) => e.status === 'approved') ?? mine[0];
}

export function startWorkProblem(job: DemoRecord, data: IndustryData): string | null {
  const est = jobEstimate(data, job);
  if (!est) return 'No work may start without a customer-approved estimate. Prepare and send an estimate first (Estimate panel on this job card).';
  if (est.status !== 'approved') return `Estimate ${est.ref} is “${est.status === 'sent' ? 'awaiting customer approval' : est.status}”. Work can only start once the customer has approved it.`;
  if (!str(job, 'technician')) return 'Assign a technician before starting work (“Bay & technician” on this job card).';
  return null;
}

export const QC_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'qcRoadTest', label: 'Road test completed' },
  { key: 'qcTorque', label: 'Wheel nuts torqued to spec' },
  { key: 'qcFluids', label: 'Fluid levels checked, no leaks' },
  { key: 'qcClean', label: 'Seat & floor covers removed, vehicle clean' },
];

export const qcMissing = (job: DemoRecord) => QC_ITEMS.filter((i) => job.values[i.key] !== true).map((i) => i.label.toLowerCase());

export function releaseProblem(job: DemoRecord, data: IndustryData): string | null {
  const inv = jobInvoice(data, job.id);
  if (!inv) return 'Issue an invoice for this job card before releasing the vehicle (Invoices → New invoice).';
  const cust = vehicleCustomer(data, job.values.vehicle);
  if (inv.status !== 'paid' && str(cust, 'kind') !== 'account') return `Invoice ${inv.ref} has ${formatRand(invoiceBalance(inv))} outstanding. Private customers settle before the vehicle is released — record the payment on the invoice (Invoice panel on this job card).`;
  return null;
}

/** Approval note must say how the customer approved. */
export const APPROVAL_CHANNEL = /phone|call|whats\s?app|in person|in-person|e-?mail|sms|counter/i;

/* ---------------- Service due ---------------- */

export type ServiceDue = { state: 'overdue' | 'due-soon' | 'ok' | 'none'; by: 'date' | 'km' | null; estKm: number; daysLeft: number | null; kmLeft: number | null };

/** Estimated current odometer from the last reading and typical monthly distance. */
export function estimatedKm(v: DemoRecord, today: string) {
  const from = str(v, 'odometerOn');
  const months = from ? Math.max(0, daysBetween(from, today)) / 30.4 : 0;
  return Math.round(num(v, 'odometer') + num(v, 'kmPerMonth') * months);
}

/** Service due by date or by estimated kilometres, whichever comes first. Due soon = 30 days or 1,000 km. */
export function serviceDue(v: DemoRecord, today: string): ServiceDue {
  const date = str(v, 'nextServiceDate');
  const km = num(v, 'nextServiceKm');
  const estKm = estimatedKm(v, today);
  if (!date && !km) return { state: 'none', by: null, estKm, daysLeft: null, kmLeft: null };
  const daysLeft = date ? daysBetween(today, date) : null;
  const kmLeft = km ? km - estKm : null;
  const overdueDate = daysLeft !== null && daysLeft < 0;
  const overdueKm = kmLeft !== null && kmLeft <= 0;
  if (overdueDate || overdueKm) return { state: 'overdue', by: overdueKm && !overdueDate ? 'km' : 'date', estKm, daysLeft, kmLeft };
  const soonDate = daysLeft !== null && daysLeft <= 30;
  const soonKm = kmLeft !== null && kmLeft <= 1000;
  if (soonDate || soonKm) return { state: 'due-soon', by: soonKm && !soonDate ? 'km' : 'date', estKm, daysLeft, kmLeft };
  return { state: 'ok', by: null, estKm, daysLeft, kmLeft };
}

/** Next-service values after a service is completed at `odometer` on `onDate`. */
export function nextService(onDate: string, odometer: number) {
  return { nextServiceDate: addMonths(onDate, SERVICE_INTERVAL.months), nextServiceKm: odometer + SERVICE_INTERVAL.km };
}

export const isServiceJob = (job: DemoRecord) => str(job, 'jobType').startsWith('service');

/* ---------------- Planner ---------------- */

export const timeToHours = (t: string) => (t ? Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60 : NaN);

/** Jobs planned into the workshop on a date (not cancelled). */
export const plannedOn = (data: IndustryData, date: string) =>
  records(data, 'jobs').filter((j) => str(j, 'workDate') === date && j.status !== 'cancelled');

/** Hours booked per key (bay or technician) on a date. */
export function hoursBy(data: IndustryData, date: string, key: 'bay' | 'technician') {
  const out: Record<string, number> = {};
  for (const j of plannedOn(data, date)) {
    const k = str(j, key);
    if (k) out[k] = (out[k] ?? 0) + num(j, 'hoursBooked');
  }
  return out;
}

export const utilisation = (hours: number) => Math.round((hours / DAY_HOURS) * 100);

/** True if another job already occupies the bay or technician for an overlapping time. */
export function planClash(data: IndustryData, job: { id?: string; workDate: string; startTime: string; hoursBooked: number; bay?: string; technician?: string }): string | null {
  const s = timeToHours(job.startTime);
  const e = s + (job.hoursBooked || 0);
  if (!Number.isFinite(s)) return null;
  for (const o of plannedOn(data, job.workDate)) {
    if (o.id === job.id || !str(o, 'startTime')) continue;
    const os = timeToHours(str(o, 'startTime'));
    const oe = os + num(o, 'hoursBooked');
    if (s < oe && os < e) {
      if (job.bay && str(o, 'bay') === job.bay) return `${o.ref} already occupies that bay from ${str(o, 'startTime')}.`;
      if (job.technician && str(o, 'technician') === job.technician) return `That technician is already on ${o.ref} from ${str(o, 'startTime')}.`;
    }
  }
  return null;
}

/** Days from a job's check-in to it being ready (turnaround). */
export const turnaroundDays = (job: DemoRecord) => (str(job, 'checkedInOn') && str(job, 'readyOn') ? daysBetween(str(job, 'checkedInOn'), str(job, 'readyOn')) : null);

export const ageDays = (fromIso: string, today: string) => (fromIso ? daysBetween(fromIso, today) : 0);
export const ageLabel = (d: number) => (d <= 0 ? 'today' : d === 1 ? '1 day' : `${d} days`);

