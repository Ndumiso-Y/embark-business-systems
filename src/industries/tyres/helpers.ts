// TreadRight Tyre & Fitment helpers shared by the configuration, the seed and
// the pages. Kept apart from index.ts so pages can import them without a
// circular dependency. Every limit here is a demo rule, not legal/OEM advice.
import type { DemoRecord, IndustryData, Line } from '../../core/types';
import { findRecord, lines, linesTotals, num, records, str } from '../../core/engine';
import { addDays, daysBetween, formatDate, toIso } from '../../core/lib/dates';
import { formatRand, group } from '../../core/lib/money';
import {
  ALIGN_READINGS, ALIGN_SPEC, BAYS, BRANDS, CALIBRATION_WARN_DAYS, CLAIM_OPEN_DAYS, DAMAGE_TYPES, OLD_STOCK_YEARS, POSITIONS, PRICES, QC_ITEMS, ROTATION_KM,
  TECHNICIANS, TOOL_TYPES, TREAD_ADVISE, TREAD_LEGAL_MIN, VEHICLE_CLASSES, label, type PosKey,
} from './data';

// Indirection so tests can pin "today" (see tests/tyres.test.ts).
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  return toIso(new Date());
}

/** Current wall-clock time as HH:MM (used when a step is recorded). */
export function nowHm(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const hmToMin = (t: string) => (/^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : NaN);

/** Minutes between two HH:MM times (null if either is missing). */
export function minutesBetween(from: string, to: string): number | null {
  const a = hmToMin(from);
  const b = hmToMin(to);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null;
}

export const minText = (m: number | null) => (m === null ? '—' : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`);

export const kmText = (n: number) => `${group(Math.round(n))} km`;

/** The last `n` calendar months ending with today's month, oldest first, as YYYY-MM keys. */
export function lastMonths(today: string, n: number) {
  const [y, m] = today.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const t = y * 12 + (m - 1) - (n - 1 - i);
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  });
}

/* ---------------- Tyre sizes ---------------- */

export type TyreSize = { width: number; profile: number; rim: number; commercial: boolean; key: string };

/** Parse "205/55R16 91V", "205/55 R16", "185R14C" or "195/70R15C" (profile defaults to 80 when omitted). */
export function parseTyreSize(s: string | undefined | null): TyreSize | null {
  const m = /^\s*(\d{3})(?:\s*\/\s*(\d{2}))?\s*Z?R\s*(\d{2})\s*(C)?(?![0-9])/i.exec(String(s ?? ''));
  if (!m) return null;
  const width = Number(m[1]);
  const profile = m[2] ? Number(m[2]) : 80;
  const rim = Number(m[3]);
  const commercial = !!m[4];
  if (width < 125 || width > 355 || profile < 25 || profile > 85 || rim < 12 || rim > 24) return null;
  return { width, profile, rim, commercial, key: `${width}${m[2] ? `/${profile}` : ''}R${rim}${commercial ? 'C' : ''}` };
}

/** Normalised size key ("205/55R16"), or '' if it cannot be read. */
export const sizeKey = (s: string | undefined | null) => parseTyreSize(s)?.key ?? '';

export function sameSize(a: string | undefined | null, b: string | undefined | null) {
  const x = parseTyreSize(a);
  const y = parseTyreSize(b);
  return !!x && !!y && x.key === y.key;
}

/** Overall diameter in mm: rim + two sidewalls. */
export function overallDiameter(s: TyreSize) {
  return s.rim * 25.4 + (2 * s.width * s.profile) / 100;
}

/** Percentage difference in overall diameter of `alt` against `base`. */
export function diameterDiffPct(base: string, alt: string): number | null {
  const a = parseTyreSize(base);
  const b = parseTyreSize(alt);
  if (!a || !b) return null;
  return Math.round(((overallDiameter(b) - overallDiameter(a)) / overallDiameter(a)) * 1000) / 10;
}

/** Demo rule: an alternative size on the same rim is acceptable within ±3% overall diameter. */
export const ALT_TOLERANCE_PCT = 3;

export type SizeMatch = { stock: DemoRecord; diff: number; exact: boolean; fits: boolean };

/** Stock on the same rim size as `size`: exact matches first, then alternatives by closeness. */
export function stockForSize(data: IndustryData, size: string): SizeMatch[] {
  const want = parseTyreSize(size);
  if (!want) return [];
  return records(data, 'stock')
    .map((st) => {
      const s = parseTyreSize(str(st, 'size'));
      if (!s || s.rim !== want.rim || s.commercial !== want.commercial) return null;
      const diff = diameterDiffPct(size, str(st, 'size')) ?? 99;
      const exact = s.key === want.key;
      return { stock: st, diff, exact, fits: exact || Math.abs(diff) <= ALT_TOLERANCE_PCT };
    })
    .filter((x): x is SizeMatch => !!x)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || Math.abs(a.diff) - Math.abs(b.diff) || num(b.stock, 'qty') - num(a.stock, 'qty'));
}

export const stockLabel = (st: DemoRecord | undefined) =>
  st ? `${label(BRANDS, str(st, 'brand'))} ${str(st, 'pattern')} ${str(st, 'size')} ${str(st, 'loadIndex')}${str(st, 'speedRating')}` : 'No tyre selected';

/* ---------------- DOT week/year ---------------- */

/** DOT date code (WWYY) for a manufacture date. */
export function dotFromDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const start = new Date(d.getFullYear(), 0, 1);
  const doy = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  const week = Math.min(52, Math.floor(doy / 7) + 1);
  return `${String(week).padStart(2, '0')}${String(d.getFullYear() % 100).padStart(2, '0')}`;
}

/** Approximate manufacture date for a DOT code (WWYY), or '' if invalid. */
export function dotDate(dot: string | undefined | null) {
  const m = /^(\d{2})(\d{2})$/.exec(String(dot ?? '').trim());
  if (!m) return '';
  const week = Number(m[1]);
  if (week < 1 || week > 53) return '';
  return addDays(`20${m[2]}-01-01`, (week - 1) * 7);
}

/** Age in years (one decimal) of a tyre from its DOT code, or null. */
export function dotAgeYears(dot: string | undefined | null, today: string): number | null {
  const d = dotDate(dot);
  if (!d) return null;
  return Math.round((daysBetween(d, today) / 365.25) * 10) / 10;
}

export const isOldDot = (dot: string | undefined | null, today: string) => (dotAgeYears(dot, today) ?? 0) > OLD_STOCK_YEARS;

export const dotText = (dot: string | undefined | null) => {
  const m = /^(\d{2})(\d{2})$/.exec(String(dot ?? ''));
  return m ? `wk ${m[1]}/20${m[2]}` : '—';
};

/* ---------------- Tread ---------------- */

export type TreadTone = 'red' | 'amber' | 'green' | 'none';

export function treadTone(mm: number | null | undefined): TreadTone {
  if (mm === null || mm === undefined || !Number.isFinite(mm)) return 'none';
  if (mm < TREAD_LEGAL_MIN) return 'red';
  if (mm < TREAD_ADVISE) return 'amber';
  return 'green';
}

/** Display colours for tread tones (wheel diagram, history). */
export const TONE_COLOURS: Record<TreadTone, string> = { red: '#c27c77', amber: '#c39550', green: '#6f9b7d', none: '#c9ccc5' };

export const treadLabel = (t: TreadTone) =>
  t === 'red' ? `Below ${TREAD_LEGAL_MIN.toFixed(1)} mm (demo legal minimum)` : t === 'amber' ? `Under ${TREAD_ADVISE.toFixed(1)} mm — advise replacement` : t === 'green' ? 'Serviceable' : 'Not measured';

/** Key for a per-wheel value on a job, e.g. wk('lf', 'tread') → "lf_tread". */
export const wk = (pos: PosKey, field: string) => `${pos}_${field}`;

/** Number stored on a record, or null if not recorded. */
export function numOrNull(r: DemoRecord | undefined, key: string): number | null {
  const v = r?.values[key];
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export const treadOf = (job: DemoRecord | undefined, pos: PosKey) => numOrNull(job, wk(pos, 'tread'));

/** Positions (LF…RR) whose recorded tread is below the demo legal minimum. */
export const belowLegal = (job: DemoRecord) => POSITIONS.filter((p) => { const t = treadOf(job, p.key); return t !== null && t < TREAD_LEGAL_MIN; });

export const replacePositions = (job: DemoRecord) => POSITIONS.filter((p) => job.values[wk(p.key, 'replace')] === true);

/* ---------------- Lookups ---------------- */

export const vehicleOf = (data: IndustryData, job: DemoRecord | undefined) => findRecord(data, 'vehicles', str(job, 'vehicle'));
export const customerOfVehicle = (data: IndustryData, v: DemoRecord | undefined) => findRecord(data, 'customers', str(v, 'customer'));
export const jobCustomer = (data: IndustryData, job: DemoRecord | undefined) => customerOfVehicle(data, vehicleOf(data, job));
export const fleetOfCustomer = (data: IndustryData, c: DemoRecord | undefined) => (str(c, 'kind') === 'fleet' ? findRecord(data, 'fleets', str(c, 'fleet')) : undefined);
export const jobFleet = (data: IndustryData, job: DemoRecord | undefined) => fleetOfCustomer(data, jobCustomer(data, job));

export const customerName = (data: IndustryData, id: unknown) => str(findRecord(data, 'customers', String(id ?? '')), 'name') || 'Unknown customer';

export function vehicleLabel(data: IndustryData, id: unknown) {
  const v = findRecord(data, 'vehicles', String(id ?? ''));
  return v ? `${str(v, 'reg')} · ${str(v, 'make')} ${str(v, 'model')}` : 'Unknown vehicle';
}

export const techLabel = (v: unknown) => label(TECHNICIANS, v);

/** Torque spec for a vehicle (Nm), falling back to its class default. */
export function torqueSpec(v: DemoRecord | undefined): { min: number; max: number } {
  const cls = VEHICLE_CLASSES.find((c) => c.value === str(v, 'vehicleClass')) ?? VEHICLE_CLASSES[0];
  const min = numOrNull(v, 'torqueMin') ?? cls.torque[0];
  const max = numOrNull(v, 'torqueMax') ?? cls.torque[1];
  return { min, max };
}

export function servicesText(job: DemoRecord) {
  const parts: string[] = [];
  const q = num(job, 'tyresQty');
  if (q) parts.push(`${q} tyre${q > 1 ? 's' : ''}`);
  if (job.values.balancing) parts.push('balance');
  if (job.values.alignment) parts.push('alignment');
  if (job.values.puncture) parts.push('puncture');
  if (job.values.nitrogen) parts.push('N₂');
  if (job.values.rotation) parts.push('rotation');
  return parts.join(' + ') || 'Inspection only';
}

/* ---------------- Job stages ---------------- */

/** States where the vehicle is physically in a bay. */
export const IN_BAY = ['fitting', 'balancing', 'alignment', 'torque'];
/** States where the vehicle is on site. */
export const ON_SITE = ['arrived', 'inspected', 'quoted', 'approved', ...IN_BAY, 'ready'];

/** Minutes from arrival to ready (null if not ready yet). */
export const jobMinutes = (job: DemoRecord) => minutesBetween(str(job, 'arrivedAt'), str(job, 'readyAt'));

/** Quote lines built from the services sold on a job and the live tyre stock price. */
export function quoteLines(job: DemoRecord, data: IndustryData, mkId: (i: number) => string = (i) => `ln_${job.id}_${i}`): Line[] {
  const out: Line[] = [];
  let i = 0;
  const add = (description: string, qty: number, unitPrice: number, code: string) => out.push({ id: mkId(++i), description, qty, unitPrice, code });
  const qty = num(job, 'tyresQty');
  const st = findRecord(data, 'stock', str(job, 'tyreStock'));
  if (qty > 0 && st) {
    add(`Tyre ${stockLabel(st)} (DOT ${str(st, 'dot')})`, qty, num(st, 'sell'), st.ref);
    add('Fitment incl. new valve', qty, PRICES.fitment, 'FIT');
    add('Old tyre disposal levy (demo)', qty, PRICES.disposal, 'ENV');
  }
  if (job.values.balancing) add('Wheel balancing incl. weights', qty > 0 ? qty : 4, PRICES.balancing, 'BAL');
  if (job.values.alignment) add('Wheel alignment (before/after printout)', 1, PRICES.alignment, 'ALN');
  if (job.values.puncture) add('Puncture repair (plug & patch)', 1, PRICES.puncture, 'PUN');
  if (job.values.nitrogen) add('Nitrogen fill', 4, PRICES.nitrogen, 'N2');
  if (job.values.rotation) add('Tyre rotation', 1, PRICES.rotation, 'ROT');
  return out;
}

export const isTyreLine = (l: Line) => /^STK-/.test(l.code ?? '');

export function inspectionProblem(job: DemoRecord, data: IndustryData): string | null {
  const v = vehicleOf(data, job);
  if (!v) return 'Link the vehicle first.';
  if (numOrNull(job, 'odometer') === null) return 'Record the odometer reading in “Arrival, bay & technician” on this job before completing the inspection.';
  if (num(job, 'odometer') < num(v, 'odometer')) return `Odometer ${kmText(num(job, 'odometer'))} is below the last recorded ${kmText(num(v, 'odometer'))} for ${str(v, 'reg')}. Re-check the reading.`;
  const missing = POSITIONS.filter((p) => treadOf(job, p.key) === null).map((p) => p.label);
  if (missing.length) return `Record the tread depth for every wheel position in the wheel table and save — missing ${missing.join(', ')}.`;
  const silly = POSITIONS.filter((p) => { const t = treadOf(job, p.key)!; return t < 0 || t > 20; }).map((p) => p.label);
  if (silly.length) return `Tread depth for ${silly.join(', ')} must be between 0 and 20 mm.`;
  return null;
}

/** Note text that records the customer's refusal of a below-minimum replacement. */
export const REFUSAL_WORDS = /refus|declin|does not want|doesn't want|will not replace|won't replace/i;

export function quoteProblem(job: DemoRecord, data: IndustryData, note?: string): string | null {
  const qty = num(job, 'tyresQty');
  const reps = replacePositions(job);
  const unquoted = belowLegal(job).filter((p) => !reps.some((r) => r.key === p.key));
  if (unquoted.length) {
    const refusal = str(job, 'refusalNote').trim() || (note && REFUSAL_WORDS.test(note) ? note : '');
    if (!refusal) {
      return `${unquoted.map((p) => `${p.label} ${treadOf(job, p.key)} mm`).join(', ')} below the ${TREAD_LEGAL_MIN.toFixed(1)} mm legal minimum (demo rule). Quote a replacement, or record the customer’s refusal in a note (“Quote with customer refusal”).`;
    }
  }
  const soldSomething = qty > 0 || ['balancing', 'alignment', 'puncture', 'nitrogen', 'rotation'].some((k) => job.values[k] === true);
  if (!soldSomething) return 'Nothing to quote yet: tick a service under “Services & quote”, or tick “Replace” on a wheel, save, and press “Quote for … marked positions”.';
  if (qty > 0) {
    const st = findRecord(data, 'stock', str(job, 'tyreStock'));
    if (!st) return 'Choose the tyre being quoted under “Services & quote” and press “Quote for … marked positions”.';
    const v = vehicleOf(data, job);
    if (v && !sameSize(str(st, 'size'), str(v, 'tyreSize'))) return `Quoted tyre ${str(st, 'size')} does not match ${str(v, 'reg')}’s fitted size ${str(v, 'tyreSize')}. Use Tyre stock → size search for an exact match.`;
    if (reps.length !== qty) return `Tyres quoted (${qty}) must match the wheel positions marked for replacement (${reps.length}). Press “Quote for … marked positions” again under “Services & quote”.`;
  } else if (reps.length) {
    return `${reps.map((p) => p.label).join(', ')} marked for replacement but no tyres are quoted.`;
  }
  return null;
}

/** Customer on account balance (cents) for a fleet: open on-account invoices. */
export function fleetBalance(data: IndustryData, fleetId: string) {
  const custIds = new Set(records(data, 'customers').filter((c) => str(c, 'fleet') === fleetId).map((c) => c.id));
  return records(data, 'invoices').filter((i) => i.status === 'onaccount' && custIds.has(str(i, 'customer'))).reduce((n, i) => n + invoiceBalance(i), 0);
}

export const jobQuoteTotal = (job: DemoRecord) => linesTotals(lines(job)).total;

export function approvalProblem(job: DemoRecord, data: IndustryData): string | null {
  if (!lines(job).length) return 'There is no quote on this job yet.';
  const fleet = jobFleet(data, job);
  if (fleet) {
    if (fleet.values.poRequired && !str(job, 'fleetPo').trim()) return `${str(fleet, 'name')} requires a fleet purchase order number before work is approved. Enter the PO number under “Services & quote” on this job.`;
    const limit = Math.round(num(fleet, 'creditLimit') * 100);
    const after = fleetBalance(data, fleet.id) + jobQuoteTotal(job);
    if (limit > 0 && after > limit) return `This quote takes ${str(fleet, 'name')} to ${formatRand(after)}, over its ${formatRand(limit)} credit limit. Ask the fleet accounts clerk to collect a remittance first.`;
    if (!fleet.values.poRequired && !str(job, 'approvalChannel')) return 'Record how the fleet manager approved the quote — choose the approval channel under “Services & quote” on this job.';
    return null;
  }
  if (!str(job, 'approvalChannel')) return 'Record how the customer approved the quote — in person, phone, WhatsApp or email. Choose it under “Services & quote” on this job.';
  return null;
}

export function fittingProblem(job: DemoRecord, data: IndustryData): string | null {
  if (!str(job, 'technician')) return 'Assign a fitment technician first (“Arrival, bay & technician” on this job).';
  if (!str(job, 'bay') || str(job, 'bay') === 'align') return 'Allocate a fitment bay (Bay 1–4) first (“Arrival, bay & technician” on this job).';
  const busy = records(data, 'jobs').find((j) => j.id !== job.id && str(j, 'bay') === str(job, 'bay') && IN_BAY.includes(j.status ?? ''));
  if (busy) return `${label(BAYS, str(job, 'bay'))} is occupied by ${busy.ref}. Choose a free bay (“Arrival, bay & technician” on this job).`;
  const qty = num(job, 'tyresQty');
  if (qty > 0) {
    const st = findRecord(data, 'stock', str(job, 'tyreStock'));
    if (!st) return 'The quoted tyre is no longer in the stock register.';
    const v = vehicleOf(data, job);
    if (v && !sameSize(str(st, 'size'), str(v, 'tyreSize'))) return `Stock line ${st.ref} is ${str(st, 'size')}, but ${str(v, 'reg')} runs ${str(v, 'tyreSize')}.`;
    if (num(st, 'qty') < qty) return `Only ${num(st, 'qty')} × ${str(st, 'size')} (${label(BRANDS, str(st, 'brand'))}) in stock — ${qty} needed. Re-quote an alternative or wait for stock.`;
  }
  return null;
}

export function alignmentProblem(job: DemoRecord): string | null {
  const missing: string[] = [];
  for (const r of ALIGN_READINGS) {
    if (numOrNull(job, `al_before_${r.key}`) === null) missing.push(`${r.label.toLowerCase()} before`);
    if (numOrNull(job, `al_after_${r.key}`) === null) missing.push(`${r.label.toLowerCase()} after`);
  }
  if (missing.length) return `Record all alignment readings before and after adjustment — missing ${missing.join(', ')}.`;
  const out = ALIGN_READINGS.filter((r) => {
    const spec = ALIGN_SPEC[r.kind];
    const v = numOrNull(job, `al_after_${r.key}`)!;
    return v < spec.min || v > spec.max;
  });
  if (out.length) return `${out.map((r) => r.label).join(', ')} still outside the demo tolerance after adjustment (toe ${ALIGN_SPEC.toe.min} to +${ALIGN_SPEC.toe.max} mm, camber ${ALIGN_SPEC.camber.min}° to +${ALIGN_SPEC.camber.max}°).`;
  return null;
}

/* ---------------- Tools ---------------- */

export const toolType = (tool: DemoRecord | undefined) => TOOL_TYPES.find((t) => t.value === str(tool, 'toolType'));

export type CalState = 'expired' | 'due' | 'ok' | 'na';

/** Calibration state of a tool. Tools that are not calibrated return "na". */
export function calibrationState(tool: DemoRecord, today: string): CalState {
  if (!toolType(tool)?.calibrated) return 'na';
  const due = str(tool, 'calibrationDue');
  if (!due || due < today) return 'expired';
  return daysBetween(today, due) <= CALIBRATION_WARN_DAYS ? 'due' : 'ok';
}

/** Hours a checked-out tool has been out (0 if not checked out). */
export function toolHoursOut(tool: DemoRecord, now: Date = new Date()): number {
  if (tool.status !== 'checkedout' || !str(tool, 'checkedOutOn')) return 0;
  const at = new Date(`${str(tool, 'checkedOutOn')}T${str(tool, 'checkedOutAt') || '07:30'}:00`);
  return Math.max(0, Math.round(((now.getTime() - at.getTime()) / 3_600_000) * 10) / 10);
}

/** Demo rule: a tool still checked out from a previous day was not returned overnight. Independent of the time of day the demo is shown. */
export const toolNotReturned = (tool: DemoRecord, today: string = todayStr()) =>
  tool.status === 'checkedout' && !!str(tool, 'checkedOutOn') && str(tool, 'checkedOutOn') < today;

export function toolCheckoutProblem(tool: DemoRecord, today: string): string | null {
  if (calibrationState(tool, today) === 'expired') return `${str(tool, 'assetNo')} calibration ${str(tool, 'calibrationDue') ? `expired on ${formatDate(str(tool, 'calibrationDue'))}` : 'is not recorded'}. Send it for calibration — it may not be issued.`;
  if (!str(tool, 'holder')) return 'Choose the technician receiving the tool first — use “Check out to…” on the tool’s card or its check-out form.';
  return null;
}

export type WrenchCheck = { wrench?: DemoRecord; problem: string | null };

/** The calibrated torque wrench checked out to the job's technician, or why there is none. */
export function torqueWrench(job: DemoRecord, data: IndustryData, today: string): WrenchCheck {
  const tech = str(job, 'technician');
  if (!tech) return { problem: 'Assign a technician first.' };
  const held = records(data, 'tools').filter((t) => str(t, 'toolType') === 'torque' && t.status === 'checkedout' && str(t, 'holder') === tech);
  if (!held.length) return { problem: `No torque wrench is checked out to ${techLabel(tech)}. Check a calibrated wrench out on the Tool board first.` };
  const valid = held.filter((t) => calibrationState(t, today) !== 'expired');
  if (!valid.length) return { problem: `Torque wrench ${str(held[0], 'assetNo')} held by ${techLabel(tech)} is out of calibration (due ${formatDate(str(held[0], 'calibrationDue'))}). Check it in and use a calibrated wrench.` };
  const spec = torqueSpec(vehicleOf(data, job));
  const fits = valid.find((t) => num(t, 'rangeMin') <= spec.min && num(t, 'rangeMax') >= spec.max);
  if (!fits) return { problem: `${str(valid[0], 'assetNo')} (${num(valid[0], 'rangeMin')}–${num(valid[0], 'rangeMax')} Nm) does not cover this vehicle’s ${spec.min}–${spec.max} Nm spec.` };
  return { wrench: fits, problem: null };
}

/** Full torque check: valid wrench + a torque value inside the vehicle's spec for every wheel. */
export function torqueProblem(job: DemoRecord, data: IndustryData, today: string): string | null {
  const w = torqueWrench(job, data, today);
  if (w.problem) return w.problem;
  const v = vehicleOf(data, job);
  const spec = torqueSpec(v);
  const missing = POSITIONS.filter((p) => numOrNull(job, wk(p.key, 'torque')) === null).map((p) => p.label);
  if (missing.length) return `Record the torque value for every wheel — missing ${missing.join(', ')}.`;
  const out = POSITIONS.filter((p) => { const n = numOrNull(job, wk(p.key, 'torque'))!; return n < spec.min || n > spec.max; });
  if (out.length) return `${out.map((p) => `${p.label} ${numOrNull(job, wk(p.key, 'torque'))} Nm`).join(', ')} outside the ${spec.min}–${spec.max} Nm spec for ${str(v, 'reg') || 'this vehicle'} (demo rule). Re-torque and record again.`;
  return null;
}

export const qcMissing = (job: DemoRecord) => QC_ITEMS.filter((i) => job.values[i.key] !== true).map((i) => i.label.toLowerCase());

export function readyProblem(job: DemoRecord, data: IndustryData, today: string): string | null {
  const t = torqueProblem(job, data, today);
  if (t) return t;
  const missing = qcMissing(job);
  return missing.length ? `QC checklist incomplete: ${missing.join('; ')}.` : null;
}

/* ---------------- Invoices ---------------- */

export const invoiceTotal = (r: DemoRecord) => linesTotals(lines(r)).total;
export const invoiceBalance = (r: DemoRecord) => invoiceTotal(r) - Math.round(num(r, 'paid') * 100);
export const jobInvoice = (data: IndustryData, jobId: string) => records(data, 'invoices').find((i) => str(i, 'job') === jobId && i.status !== 'void');
export const invoiceOverdue = (r: DemoRecord, today: string) => r.status === 'onaccount' && !!str(r, 'dueOn') && str(r, 'dueOn') < today;

/** Payment about to be recorded: positive, never above the balance; "full" must settle exactly. */
export function paymentProblem(r: DemoRecord, amountRand: number, mode: 'part' | 'full'): string | null {
  const amount = Math.round((Number.isFinite(amountRand) ? amountRand : 0) * 100);
  const balance = invoiceBalance(r);
  if (balance <= 0) return 'This invoice has no outstanding balance.';
  if (amount <= 0) return 'Enter the amount received in the “Record payment” panel first.';
  if (amount > balance) return `A payment of ${formatRand(amount)} exceeds the outstanding balance of ${formatRand(balance)}.`;
  if (mode === 'full' && amount < balance) return `${formatRand(amount)} is less than the balance of ${formatRand(balance)}${r.status === 'onaccount' ? ' — record it as a part remittance.' : '. Retail invoices are settled in full at the counter.'}`;
  if (mode === 'part' && amount === balance) return 'That amount settles the invoice — record it as payment in full.';
  if (!str(r, 'paymentMethod')) return 'Choose the payment method.';
  return null;
}

export function releaseProblem(job: DemoRecord, data: IndustryData): string | null {
  const inv = jobInvoice(data, job.id);
  if (!inv) return 'Issue the invoice for this job before the vehicle leaves.';
  if (inv.status === 'paid' || inv.status === 'onaccount') return null;
  if (jobFleet(data, job)) return `Put invoice ${inv.ref} on the fleet account (30 days) before releasing the vehicle — open it from the Invoice panel on this job.`;
  return `Invoice ${inv.ref} has ${formatRand(invoiceBalance(inv))} outstanding. Retail customers pay before the vehicle leaves — record the payment on the invoice (Invoice panel on this job).`;
}

/* ---------------- Vehicles ---------------- */

export function rotationDue(v: DemoRecord) {
  const since = num(v, 'odometer') - num(v, 'lastRotationKm');
  return { since, due: since >= ROTATION_KM, left: ROTATION_KM - since };
}

/* ---------------- Warranty claims ---------------- */

export const damageWarrantable = (claim: DemoRecord) => DAMAGE_TYPES.find((d) => d.value === str(claim, 'damageType'))?.warrantable ?? false;

/** Demo pro-rata credit: share of usable tread remaining above the legal minimum. */
export function proRataCredit(claim: DemoRecord): number | null {
  const rem = numOrNull(claim, 'treadRemaining');
  const orig = numOrNull(claim, 'originalTread') ?? 8;
  if (rem === null || orig <= TREAD_LEGAL_MIN) return null;
  return Math.max(0, Math.min(100, Math.round(((rem - TREAD_LEGAL_MIN) / (orig - TREAD_LEGAL_MIN)) * 100)));
}

export const claimOpen = (c: DemoRecord) => !['approved', 'rejected'].includes(c.status ?? '');
export const claimAge = (c: DemoRecord, today: string) => (str(c, 'loggedOn') ? daysBetween(str(c, 'loggedOn'), today) : 0);
export const claimOverdue = (c: DemoRecord, today: string) => claimOpen(c) && claimAge(c, today) > CLAIM_OPEN_DAYS;
