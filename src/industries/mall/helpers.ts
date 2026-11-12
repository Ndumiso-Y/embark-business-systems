// Shopping-centre helpers shared by the configuration, its pages, the seed and the tests.
// Kept free of page imports so index.ts and pages/*.tsx can both use them without circular
// imports. Every rule here uses dates only — never the time of day.
import type { DemoRecord, DemoUser, Flag, IndustryData, Line, Values } from '../../core/types';
import { can, findRecord, lines, linesTotals, num, records, str } from '../../core/engine';
import { addDays, daysBetween, formatDate, monthLabel, parseIso, toIso } from '../../core/lib/dates';
import { formatRand, roundCents, toCents } from '../../core/lib/money';
import {
  ACTIVE_LEASE, APPROVAL_GLA, BILLED_LEASE, CATEGORIES, DECLARATION_DUE_DAY, DEMAND_AFTER_DAYS, ELEC_TARIFF, EXPIRY_WARNING_MONTHS, LEASE_STATES, PAYMENT_TERMS_DAYS,
  PERMIT_TYPES, PRIORITIES, RENEWAL_OVERDUE_DAYS, RENT_TO_SALES_RISK, SPACES, USAGE_REVIEW_PCT, VAT_RATE, WATER_TARIFF, label,
} from './data';

/* ---------------- "Today" indirection (tests pin the date) ---------------- */
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------------- Small utilities ---------------- */
/** Format integer cents as rand. */
export const rand = (cents: number) => formatRand(cents);
/** Format a rand amount (not cents). */
export const randOf = (r: number) => formatRand(toCents(r));
/** Whole rand with thousands separators, for large figures in tables and stats. */
export const randRound = (r: number) => formatRand(Math.round(r) * 100).replace(/\.00$/, '');
/** Short money for stat tiles: R1.92m above a million, whole rand below. */
export const randBig = (cents: number) => (Math.abs(cents) >= 1_000_000_00 ? formatRand(cents, { compact: true }) : formatRand(Math.round(cents / 100) * 100).replace(/\.00$/, ''));
export const round2 = (n: number) => roundCents(n * 100) / 100;
export const thousands = (n: number) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
export const plural = (n: number, w: string, many = `${w}s`) => `${n} ${n === 1 ? w : many}`;
export const pct1 = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/* ---------------- Months ("periods" are YYYY-MM) ---------------- */
export const periodOf = (iso: string) => iso.slice(0, 7);
export function addMonths(period: string, n: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export const prevPeriod = (period: string) => addMonths(period, -1);
export const periodStart = (period: string) => `${period}-01`;
export const periodEnd = (period: string) => addDays(periodStart(addMonths(period, 1)), -1);
export const periodLabel = (period: string) => (/^\d{4}-\d{2}$/.test(period) ? monthLabel(period) : period || '—');
/** Whole months from one date to another (never negative). */
export function monthsBetween(fromIso: string, toIsoStr: string): number {
  if (!fromIso || !toIsoStr || toIsoStr < fromIso) return 0;
  const a = parseIso(fromIso);
  const b = parseIso(toIsoStr);
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0));
}
const addYears = (iso: string, years: number, like = iso) => { const d = parseIso(like); return toIso(new Date(parseIso(iso).getFullYear() + years, d.getMonth(), d.getDate())); };

/* ---------------- Lookups ---------------- */
export const unitOf = (data: IndustryData, id: unknown) => findRecord(data, 'units', String(id ?? ''));
export const leaseOf = (data: IndustryData, id: unknown) => findRecord(data, 'leases', String(id ?? ''));
export const shopLabel = (unit: DemoRecord | undefined) => (unit ? `Shop ${str(unit, 'shop')}` : 'No unit');
export const tenantName = (data: IndustryData, leaseId: unknown) => str(leaseOf(data, leaseId), 'tenant') || 'Unknown tenant';
export const leaseUnit = (data: IndustryData, lease: DemoRecord | undefined) => unitOf(data, str(lease, 'unit'));
export const glaOf = (data: IndustryData, lease: DemoRecord | undefined) => num(leaseUnit(data, lease), 'gla');
/** "Indigo Reef · Shop G07". */
export const leaseTitle = (data: IndustryData, lease: DemoRecord | undefined) => (lease ? `${str(lease, 'tenant')} · ${shopLabel(leaseUnit(data, lease))}` : 'Unknown lease');

/** The lease that currently holds a unit (heads of terms through to notice), if any. */
export function activeLease(data: IndustryData, unitId: string, exceptId?: string): DemoRecord | undefined {
  if (!unitId) return undefined;
  return records(data, 'leases').find((l) => str(l, 'unit') === unitId && l.id !== exceptId && ACTIVE_LEASE.includes(l.status ?? ''));
}
/** The lease that is trading in (and billed for) a unit. */
export const tradingLease = (data: IndustryData, unitId: string) => records(data, 'leases').find((l) => str(l, 'unit') === unitId && BILLED_LEASE.includes(l.status ?? ''));

/** A unit's status is not typed in: it follows the lease that holds it. */
export function expectedUnitState(data: IndustryData, unitId: string): 'vacant' | 'offer' | 'fitout' | 'let' {
  const l = activeLease(data, unitId);
  if (!l) return 'vacant';
  if (l.status === 'hot' || l.status === 'signed') return 'offer';
  if (l.status === 'fitout') return 'fitout';
  return 'let';
}

/* ---------------- Occupancy, vacancy and tenant mix ---------------- */
export type Occupancy = { gla: number; occupied: number; vacant: number; pct: number; vacantUnits: number; offerUnits: number; fitoutUnits: number; letUnits: number };
/** Occupancy by GLA. A unit counts as occupied once a tenant is fitting out or trading; "under offer" is still vacant. */
export function occupancy(units: DemoRecord[]): Occupancy {
  const sum = (list: DemoRecord[]) => list.reduce((n, u) => n + num(u, 'gla'), 0);
  const by = (s: string) => units.filter((u) => u.status === s);
  const gla = sum(units);
  const occupied = sum(by('let')) + sum(by('fitout'));
  return { gla, occupied, vacant: gla - occupied, pct: pct1(occupied, gla), vacantUnits: by('vacant').length, offerUnits: by('offer').length, fitoutUnits: by('fitout').length, letUnits: by('let').length };
}
export const monthsVacant = (unit: DemoRecord, today: string) => (str(unit, 'vacantSince') ? monthsBetween(str(unit, 'vacantSince'), today) : 0);

/** GLA held by a tenant (fit-out or trading) on a given date, from lease dates — used for the vacancy trend. */
export function occupiedGlaAt(data: IndustryData, date: string): number {
  return records(data, 'leases')
    .filter((l) => ['fitout', 'trading', 'renewal', 'notice', 'vacated'].includes(l.status ?? ''))
    .filter((l) => str(l, 'startDate') && str(l, 'startDate') <= date && (!str(l, 'vacatedOn') || str(l, 'vacatedOn') > date))
    .reduce((n, l) => n + glaOf(data, l), 0);
}

/** GLA share per category for units that are let or fitting out. */
export function tenantMix(data: IndustryData): Array<{ key: string; label: string; gla: number; units: number; pct: number }> {
  const held = records(data, 'units').filter((u) => u.status === 'let' || u.status === 'fitout');
  const total = held.reduce((n, u) => n + num(u, 'gla'), 0);
  return CATEGORIES.map((c) => {
    const list = held.filter((u) => str(u, 'category') === c.value);
    const gla = list.reduce((n, u) => n + num(u, 'gla'), 0);
    return { key: c.value, label: c.label, gla, units: list.length, pct: pct1(gla, total) };
  }).filter((c) => c.units > 0).sort((a, b) => b.gla - a.gla);
}

/* ---------------- Lease money ---------------- */
/** Monthly charges for a lease, in cents excl. VAT: base rent, operating-cost recovery and marketing levy are all m² × rate. */
export function monthlyCharges(lease: DemoRecord | undefined, gla: number) {
  const base = toCents(gla * num(lease, 'baseRent'));
  const ops = toCents(gla * num(lease, 'opsRate'));
  const levy = toCents(gla * num(lease, 'mktRate'));
  return { base, ops, levy, total: base + ops + levy };
}
/** Monthly base rent in rand. */
export const monthlyBaseRent = (data: IndustryData, lease: DemoRecord | undefined) => round2(glaOf(data, lease) * num(lease, 'baseRent'));

/* ---------------- Escalation ---------------- */
/** Base rent per m² after one annual escalation, rounded to the cent. */
export function escalatedRate(rate: number, pct: number): number {
  return roundCents(rate * (100 + pct)) / 100;
}
/** The next anniversary of the lease start that has not been applied yet. */
export function nextEscalation(lease: DemoRecord | undefined): string {
  const start = str(lease, 'startDate');
  if (!start) return '';
  return addYears(str(lease, 'lastEscalated') || start, 1, start);
}
/** "due" in the month of the anniversary, "overdue" once that month has passed without it being applied. */
export function escalationState(lease: DemoRecord, today: string): 'due' | 'overdue' | null {
  if (!BILLED_LEASE.includes(lease.status ?? '') || !(num(lease, 'escalationPct') > 0)) return null;
  const next = nextEscalation(lease);
  if (!next || (str(lease, 'endDate') && next > str(lease, 'endDate'))) return null;
  if (periodOf(next) === periodOf(today)) return 'due';
  return next < today ? 'overdue' : null;
}

/* ---------------- Lease term ---------------- */
export const leaseDaysLeft = (lease: DemoRecord, today: string) => (str(lease, 'endDate') ? daysBetween(today, str(lease, 'endDate')) : null);
/** Trading leases ending within six months (or already past their end date). */
export function leaseExpiring(lease: DemoRecord, today: string): boolean {
  if (!BILLED_LEASE.includes(lease.status ?? '') || !str(lease, 'endDate')) return false;
  return str(lease, 'endDate') <= periodEnd(addMonths(periodOf(today), EXPIRY_WARNING_MONTHS));
}
/** Still trading close to (or past) the end date with no renewal agreed and no notice given. */
export function renewalOverdue(lease: DemoRecord, today: string): boolean {
  const left = leaseDaysLeft(lease, today);
  if (left === null) return false;
  if (lease.status === 'trading') return left <= RENEWAL_OVERDUE_DAYS;
  return lease.status === 'renewal' && left < 0;
}

/* ---------------- Turnover ---------------- */
/** Demo formula: turnover rent = max(0, verified turnover × % − monthly base rent). */
export function turnoverRent(turnover: number, pct: number, baseRent: number): number {
  if (!(turnover > 0) || !(pct > 0)) return 0;
  return Math.max(0, round2((turnover * pct) / 100 - baseRent));
}
/** The monthly turnover above which turnover rent starts (base rent ÷ %). */
export const breakpoint = (baseRent: number, pct: number) => (pct > 0 ? round2(baseRent / (pct / 100)) : 0);
/** Trading density: rand of turnover per m² per month. */
export const tradingDensity = (turnover: number, gla: number) => (gla > 0 && turnover > 0 ? Math.round(turnover / gla) : 0);
/** Monthly base rent as a percentage of monthly turnover (one decimal), or null with no turnover. */
export const rentToSales = (baseRent: number, turnover: number) => (turnover > 0 ? Math.round((baseRent / turnover) * 1000) / 10 : null);
export const atRisk = (ratio: number | null) => ratio !== null && ratio > RENT_TO_SALES_RISK;

/** Turnover for a month is due by the 7th of the next month. */
export const declarationDue = (period: string) => `${addMonths(period, 1)}-${String(DECLARATION_DUE_DAY).padStart(2, '0')}`;
export const declarationOverdue = (d: DemoRecord, today: string) => d.status === 'awaited' && today > declarationDue(str(d, 'period'));
export const declarationFor = (data: IndustryData, leaseId: string, period: string) => records(data, 'turnover').find((d) => str(d, 'lease') === leaseId && str(d, 'period') === period);
export const leaseDeclarations = (data: IndustryData, leaseId: string) => records(data, 'turnover').filter((d) => str(d, 'lease') === leaseId).sort((a, b) => str(a, 'period').localeCompare(str(b, 'period')));
/** Declared figures count once a number is on record (declared, queried or verified). */
export const hasFigure = (d: DemoRecord) => d.status !== 'awaited' && num(d, 'amount') > 0;
export const latestFigure = (data: IndustryData, leaseId: string) => leaseDeclarations(data, leaseId).filter(hasFigure).pop();

export type TenantSales = { lease: DemoRecord; unit: DemoRecord | undefined; gla: number; base: number; period: string; turnover: number; density: number; ratio: number | null; atRisk: boolean; turnoverRent: number };
/** Latest declared month per turnover tenant, with density, rent-to-sales and the turnover rent it would bill. */
export function tenantSales(data: IndustryData): TenantSales[] {
  return records(data, 'leases').filter((l) => BILLED_LEASE.includes(l.status ?? '') && num(l, 'turnoverPct') > 0).flatMap((lease) => {
    const d = latestFigure(data, lease.id);
    if (!d) return [];
    const gla = glaOf(data, lease);
    const base = monthlyBaseRent(data, lease);
    const turnover = num(d, 'amount');
    const ratio = rentToSales(base, turnover);
    return [{ lease, unit: leaseUnit(data, lease), gla, base, period: str(d, 'period'), turnover, density: tradingDensity(turnover, gla), ratio, atRisk: atRisk(ratio), turnoverRent: turnoverRent(turnover, num(lease, 'turnoverPct'), base) }];
  });
}
/** Trading density per category: total declared turnover ÷ total GLA of the tenants that declared. */
export function densityByCategory(data: IndustryData): Array<{ key: string; label: string; density: number; tenants: number; turnover: number }> {
  const rows = tenantSales(data);
  return CATEGORIES.map((c) => {
    const list = rows.filter((r) => str(r.lease, 'category') === c.value);
    const turnover = list.reduce((n, r) => n + r.turnover, 0);
    return { key: c.value, label: c.label, tenants: list.length, turnover, density: tradingDensity(turnover, list.reduce((n, r) => n + r.gla, 0)) };
  }).filter((c) => c.tenants > 0).sort((a, b) => b.density - a.density);
}

/* ---------------- Meter readings ---------------- */
export const readingFor = (data: IndustryData, unitId: string, period: string) => records(data, 'readings').find((r) => str(r, 'unit') === unitId && str(r, 'period') === period);
/** The latest captured reading for a unit before the given month. */
export function previousReading(data: IndustryData, unitId: string, period: string): DemoRecord | undefined {
  return records(data, 'readings').filter((r) => str(r, 'unit') === unitId && r.status === 'captured' && str(r, 'period') < period)
    .sort((a, b) => str(a, 'period').localeCompare(str(b, 'period'))).pop();
}
const filled = (v: unknown) => v !== '' && v !== undefined && v !== null && Number.isFinite(Number(v));
/** Core rule: a meter cannot run backwards — a reading below the previous one is refused. */
export function readingProblem(values: Values, prev: DemoRecord | undefined, hasWater: boolean): string | null {
  if (!filled(values.elec)) return 'Type the electricity meter reading (kWh).';
  if (Number(values.elec) < 0) return 'A meter reading cannot be negative.';
  if (prev && Number(values.elec) < num(prev, 'elec')) return `The electricity reading (${thousands(Number(values.elec))} kWh) is below the previous reading (${thousands(num(prev, 'elec'))} kWh) — a meter cannot run backwards. Check the digits.`;
  if (hasWater) {
    if (!filled(values.water)) return 'Type the water meter reading (kL).';
    if (Number(values.water) < 0) return 'A meter reading cannot be negative.';
    if (prev && Number(values.water) < num(prev, 'water')) return `The water reading (${thousands(Number(values.water))} kL) is below the previous reading (${thousands(num(prev, 'water'))} kL) — a meter cannot run backwards. Check the digits.`;
  }
  return null;
}
/** Consumption between a captured reading and the one before it; null when there is nothing to compare with. */
export function consumption(data: IndustryData, reading: DemoRecord | undefined): { elec: number; water: number; prev: DemoRecord } | null {
  if (!reading || reading.status !== 'captured') return null;
  const prev = previousReading(data, str(reading, 'unit'), str(reading, 'period'));
  if (!prev) return null;
  return { elec: Math.max(0, num(reading, 'elec') - num(prev, 'elec')), water: Math.max(0, num(reading, 'water') - num(prev, 'water')), prev };
}
/** Percentage change in electricity usage against the month before (null when there is no earlier month). */
export function usageChange(data: IndustryData, reading: DemoRecord | undefined): number | null {
  const now = consumption(data, reading);
  if (!now) return null;
  const before = consumption(data, now.prev);
  if (!before || before.elec <= 0) return null;
  return Math.round(((now.elec - before.elec) / before.elec) * 100);
}
export function needsReview(data: IndustryData, reading: DemoRecord): boolean {
  if (reading.status !== 'captured' || str(reading, 'reviewedBy')) return false;
  const change = usageChange(data, reading);
  return change !== null && Math.abs(change) > USAGE_REVIEW_PCT;
}
/** Units whose meters should be read: a tenant is trading there. */
export const meteredUnits = (data: IndustryData) => records(data, 'units').filter((u) => !!tradingLease(data, u.id)).sort((a, b) => str(a, 'shop').localeCompare(str(b, 'shop'), undefined, { numeric: true }));

/* ---------------- Invoices, payments and arrears ---------------- */
export function invoiceTotals(inv: DemoRecord | undefined) {
  const t = linesTotals(lines(inv), VAT_RATE);
  const paid = toCents(num(inv, 'paid'));
  return { net: t.net, vat: t.vat, total: t.total, paid, balance: Math.max(0, t.total - paid) };
}
export const invoiceOpen = (inv: DemoRecord) => inv.status === 'issued' || inv.status === 'partpaid';
export const invoiceBilled = (inv: DemoRecord) => ['issued', 'partpaid', 'paid'].includes(inv.status ?? '');
/** Days past the due date for an issued, unpaid invoice (0 when not overdue). */
export const overdueDays = (inv: DemoRecord, today: string) => (invoiceOpen(inv) && str(inv, 'dueDate') && str(inv, 'dueDate') < today ? daysBetween(str(inv, 'dueDate'), today) : 0);

/** Core rule: a payment can never be more than the balance still owed. Amount in rand. */
export function paymentProblem(inv: DemoRecord, amount: number): string | null {
  if (!invoiceOpen(inv)) return 'Payments can only be recorded against an issued invoice.';
  const { balance } = invoiceTotals(inv);
  const cents = toCents(amount);
  if (!(cents > 0)) return 'Type the amount received in the “Record a payment” panel.';
  if (cents > balance) return `A payment of ${rand(cents)} is more than the balance of ${rand(balance)} — a tenant account cannot be overpaid here.`;
  return null;
}

export type Ageing = { current: number; d30: number; d60: number; d90: number; d90plus: number; overdue: number; total: number; oldest: number };
/** Arrears ageing in cents: balances by how long past the due date they are. Interest is not calculated. */
export function ageing(invoices: DemoRecord[], today: string): Ageing {
  const out: Ageing = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, overdue: 0, total: 0, oldest: 0 };
  for (const inv of invoices) {
    if (!invoiceOpen(inv)) continue;
    const { balance } = invoiceTotals(inv);
    const days = overdueDays(inv, today);
    if (days <= 0) out.current += balance;
    else if (days <= 30) out.d30 += balance;
    else if (days <= 60) out.d60 += balance;
    else if (days <= 90) out.d90 += balance;
    else out.d90plus += balance;
    out.total += balance;
    if (days > 0) { out.overdue += balance; out.oldest = Math.max(out.oldest, days); }
  }
  return out;
}
export const leaseInvoices = (data: IndustryData, leaseId: string) => records(data, 'invoices').filter((i) => str(i, 'lease') === leaseId);
export const leaseArrears = (data: IndustryData, leaseId: string, today: string) => ageing(leaseInvoices(data, leaseId), today);
export const AGE_BUCKETS: Array<{ key: keyof Ageing; label: string }> = [
  { key: 'd30', label: '1–30 days' }, { key: 'd60', label: '31–60 days' }, { key: 'd90', label: '61–90 days' }, { key: 'd90plus', label: 'Over 90 days' },
];
export const worstBucket = (a: Ageing) => (a.d90plus ? '90+' : a.d90 ? '61–90' : a.d60 ? '31–60' : a.d30 ? '1–30' : '');

/** Tenants with an overdue balance, worst first. */
export function arrearsList(data: IndustryData, today: string): Array<{ lease: DemoRecord; age: Ageing; caseRec: DemoRecord | undefined }> {
  const cases = records(data, 'cases');
  return records(data, 'leases').map((lease) => ({ lease, age: leaseArrears(data, lease.id, today), caseRec: cases.find((c) => str(c, 'lease') === lease.id && !['settled'].includes(c.status ?? '')) }))
    .filter((r) => r.age.overdue > 0).sort((a, b) => b.age.oldest - a.age.oldest || b.age.overdue - a.age.overdue);
}

/** Billed and collected (cents) for invoices of one month. */
export function monthBilling(data: IndustryData, period: string) {
  const list = records(data, 'invoices').filter((i) => str(i, 'period') === period && invoiceBilled(i));
  const billed = list.reduce((n, i) => n + invoiceTotals(i).total, 0);
  const collected = list.reduce((n, i) => n + Math.min(invoiceTotals(i).total, invoiceTotals(i).paid), 0);
  return { count: list.length, billed, collected, pct: pct1(collected, billed) };
}
/** What a full month should bill before utilities and turnover rent (cents incl. VAT). */
export function expectedRentRoll(data: IndustryData): { leases: number; net: number; total: number } {
  const list = records(data, 'leases').filter((l) => BILLED_LEASE.includes(l.status ?? ''));
  const net = list.reduce((n, l) => n + monthlyCharges(l, glaOf(data, l)).total, 0);
  return { leases: list.length, net, total: net + Math.round((net * VAT_RATE) / 100) };
}

/* ---------------- Month-end invoice drafting ---------------- */
export const pendingRecharges = (data: IndustryData, unitId: string) => records(data, 'workorders').filter((w) => str(w, 'unit') === unitId && str(w, 'responsibility') === 'tenant'
  && num(w, 'rechargeAmount') > 0 && ['completed', 'confirmed'].includes(w.status ?? '') && !str(w, 'rechargeInvoice'));

/** Trading leases with no invoice yet for the month. */
export function leasesToInvoice(data: IndustryData, period: string): DemoRecord[] {
  // A once-off invoice in the same month does not count: only one that carries the month's rent.
  const done = new Set(records(data, 'invoices').filter((i) => str(i, 'period') === period && i.status !== 'void' && lines(i).some((l) => l.id === 'rent' || l.id === 's')).map((i) => str(i, 'lease')));
  return records(data, 'leases').filter((l) => BILLED_LEASE.includes(l.status ?? '') && !done.has(l.id) && (str(l, 'tradingSince') || str(l, 'startDate')) <= periodEnd(period))
    .sort((a, b) => str(a, 'tenant').localeCompare(str(b, 'tenant')));
}

export type InvoiceDraft = { values: Values; notes: string[]; recharged: DemoRecord[]; missingReading: boolean; unverifiedTurnover: boolean };
/**
 * One month's invoice for a trading lease:
 *   base rent (m² × rate) + operating costs (m² × rate) + marketing levy (m² × rate)
 *   + last month's metered electricity and water (consumption × demo tariff)
 *   + turnover rent on last month's VERIFIED turnover: max(0, turnover × % − base rent)
 *   + any tenant-responsibility work orders to recharge.
 * A missing reading or an unverified declaration never stops the draft: the line is left off and a note says why.
 */
export function buildInvoice(data: IndustryData, lease: DemoRecord, period: string, today: string): InvoiceDraft {
  const unit = leaseUnit(data, lease);
  const gla = num(unit, 'gla');
  const last = prevPeriod(period);
  const notes: string[] = [];
  const out: Line[] = [
    { id: 'rent', description: `Base rent ${periodLabel(period)}`, qty: gla, unitPrice: num(lease, 'baseRent') },
  ];
  if (num(lease, 'opsRate') > 0) out.push({ id: 'ops', description: 'Operating costs recovery', qty: gla, unitPrice: num(lease, 'opsRate') });
  if (num(lease, 'mktRate') > 0) out.push({ id: 'mkt', description: 'Marketing levy', qty: gla, unitPrice: num(lease, 'mktRate') });

  // Utilities: last month's reading against the one before it.
  let missingReading = false;
  const reading = unit ? readingFor(data, unit.id, last) : undefined;
  const used = consumption(data, reading);
  if (!reading || reading.status !== 'captured') {
    missingReading = true;
    notes.push(`Utilities for ${periodLabel(last)} not billed: no meter reading captured for ${shopLabel(unit)}. Capture it under Utilities metering and add the line, or bill it next month.`);
  } else if (!used) {
    notes.push(`Utilities for ${periodLabel(last)} not billed: this is the first reading on the meter, so consumption starts next month.`);
  } else {
    if (used.elec > 0) out.push({ id: 'elec', description: `Electricity ${periodLabel(last)} (kWh, sub-meter)`, qty: used.elec, unitPrice: ELEC_TARIFF });
    if (unit?.values.waterMeter === true && used.water > 0) out.push({ id: 'water', description: `Water ${periodLabel(last)} (kL, sub-meter)`, qty: used.water, unitPrice: WATER_TARIFF });
  }

  // Turnover rent on last month's verified declaration.
  let unverifiedTurnover = false;
  const pct = num(lease, 'turnoverPct');
  if (pct > 0) {
    const d = declarationFor(data, lease.id, last);
    const base = round2(gla * num(lease, 'baseRent'));
    if (d?.status === 'verified') {
      const tr = turnoverRent(num(d, 'amount'), pct, base);
      if (tr > 0) out.push({ id: 'tr', description: `Turnover rent ${periodLabel(last)} (${pct}% of ${randRound(num(d, 'amount'))} less base rent)`, qty: 1, unitPrice: tr });
      else notes.push(`No turnover rent for ${periodLabel(last)}: ${pct}% of ${randOf(num(d, 'amount'))} is below the base rent of ${randOf(base)}.`);
    } else {
      unverifiedTurnover = true;
      notes.push(`Turnover rent for ${periodLabel(last)} not billed: the declaration is ${!d || d.status === 'awaited' ? 'still awaited' : d.status === 'queried' ? 'queried' : 'declared but not yet verified'}.`);
    }
  }

  // Tenant-responsibility repairs done by the landlord.
  const recharged = unit ? pendingRecharges(data, unit.id) : [];
  for (const w of recharged) out.push({ id: `wo-${w.id}`, description: `Recharge ${w.ref} — ${str(w, 'title')}`, qty: 1, unitPrice: num(w, 'rechargeAmount') });

  return {
    values: { lease: lease.id, period, date: today, dueDate: addDays(today, PAYMENT_TERMS_DAYS), lines: out, paid: 0, levy: round2(gla * num(lease, 'mktRate')), notes: notes.join('\n') },
    notes, recharged, missingReading, unverifiedTurnover,
  };
}

/**
 * Lines a draft left off (utilities, turnover rent) that can be added now because the reading
 * has since been captured or the declaration verified.
 */
export function draftCatchUp(data: IndustryData, inv: DemoRecord): { add: Line[]; notes: string } | null {
  const lease = leaseOf(data, inv.values.lease);
  if (inv.status !== 'draft' || !lease || !/^\d{4}-\d{2}$/.test(str(inv, 'period'))) return null;
  const fresh = buildInvoice(data, lease, str(inv, 'period'), str(inv, 'date'));
  const have = new Set(lines(inv).map((l) => l.id));
  const add = (fresh.values.lines as Line[]).filter((l) => ['elec', 'water', 'tr'].includes(l.id) && !have.has(l.id));
  return add.length ? { add, notes: fresh.notes.join('\n') } : null;
}

/* ---------------- Marketing fund ---------------- */
/** Levies billed to tenants against campaign spend that has been approved (cents). */
export function marketingFund(data: IndustryData) {
  const levies = records(data, 'invoices').filter(invoiceBilled).reduce((n, i) => n + toCents(num(i, 'levy')), 0);
  const committed = (states: string[]) => records(data, 'campaigns').filter((c) => states.includes(c.status ?? '')).reduce((n, c) => n + toCents(num(c, 'cost')), 0);
  const spent = committed(['running', 'done']);
  const approved = committed(['approved']);
  return { levies, spent, approved, balance: levies - spent - approved, planned: committed(['planned']) };
}

/* ---------------- Rules: leases ---------------- */
const termsProblem = (lease: DemoRecord): string | null => {
  if (!(num(lease, 'baseRent') > 0)) return 'Capture the base rent per m² (“Commercial terms” panel).';
  if (!str(lease, 'startDate') || !str(lease, 'endDate')) return 'Capture the lease start and end dates (“Commercial terms” panel).';
  if (str(lease, 'endDate') <= str(lease, 'startDate')) return 'The lease must end after it starts (“Commercial terms” panel).';
  return null;
};
/** Core rule: a unit can only be let once. */
export function doubleLetProblem(data: IndustryData, lease: DemoRecord): string | null {
  const other = activeLease(data, str(lease, 'unit'), lease.id);
  if (!other) return null;
  return `${shopLabel(leaseUnit(data, lease))} already has an active lease (${other.ref} ${str(other, 'tenant')} — ${LEASE_STATES[other.status ?? ''] ?? other.status}). A unit cannot be let twice: choose another unit under “Commercial terms”, or wait until that lease is vacated.`;
}
export const needsApproval = (data: IndustryData, lease: DemoRecord) => glaOf(data, lease) > APPROVAL_GLA;
/** What stops heads of terms being agreed. */
export function hotProblems(data: IndustryData, lease: DemoRecord): string[] {
  const out: string[] = [];
  if (!leaseUnit(data, lease)) return ['Choose the unit this application is for (“Commercial terms” panel).'];
  const twice = doubleLetProblem(data, lease);
  if (twice) out.push(twice);
  const terms = termsProblem(lease);
  if (terms) out.push(terms);
  if (str(lease, 'creditCheck') === 'declined') out.push('The credit check was declined — decline the application, or record a new outcome under “Before heads of terms”.');
  else if (str(lease, 'creditCheck') !== 'approved') out.push('An approved credit check is needed first — record the outcome under “Before heads of terms” (simulated: no bureau is contacted).');
  if (needsApproval(data, lease) && !str(lease, 'approvedBy')) out.push(`A letting above ${APPROVAL_GLA} m² needs the leasing manager’s approval — “Approve letting” under “Before heads of terms”.`);
  return out;
}
/** What stops the lease being signed. */
export function signProblems(lease: DemoRecord): string[] {
  const out: string[] = [];
  if (lease.values.depositReceived !== true || !(num(lease, 'depositAmount') > 0)) out.push('Record the deposit or bank guarantee received under “Before the lease can be signed”.');
  if (lease.values.fica !== true) out.push('The tenant’s FICA documents are not verified — tick it under “Before the lease can be signed” (simulated).');
  const terms = termsProblem(lease);
  if (terms) out.push(terms);
  return out;
}
/** The fit-out project for a lease: the signed-off one when there is one, otherwise the latest. */
export function fitoutOf(data: IndustryData, leaseId: string): DemoRecord | undefined {
  const list = records(data, 'fitouts').filter((f) => str(f, 'lease') === leaseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return list.find((f) => f.status === 'signedoff') ?? list.pop();
}
export const cooProblem = (coo: string) => (!coo.trim() ? 'Type the certificate of occupancy number.' : /^DEMO-COO-\w+/.test(coo.trim()) ? null : 'Use a fictional number that starts with DEMO-COO- (for example DEMO-COO-0412).');
export const insuranceOnFile = (lease: DemoRecord, today: string) => !!str(lease, 'insuranceExpiry') && str(lease, 'insuranceExpiry') >= today;
/** What stops a shop opening for trade. */
export function tradingProblems(data: IndustryData, lease: DemoRecord, today: string): string[] {
  const out: string[] = [];
  const fit = fitoutOf(data, lease.id);
  if (!fit) out.push('There is no fit-out project for this lease — open one under Fit-outs and have it signed off.');
  else if (fit.status !== 'signedoff') out.push(`The fit-out (${fit.ref}) is not signed off yet — see “Before the shop can trade”.`);
  if (cooProblem(str(lease, 'cooNumber'))) out.push('Record the certificate of occupancy number under “Before the shop can trade”.');
  if (!str(lease, 'insuranceExpiry')) out.push('The tenant’s insurance is not on file — record its expiry date under “Before the shop can trade”.');
  else if (!insuranceOnFile(lease, today)) out.push(`The tenant’s insurance expired on ${formatDate(str(lease, 'insuranceExpiry'))} — record the renewed cover under “Before the shop can trade”.`);
  return out;
}
export function renewProblem(lease: DemoRecord): string | null {
  if (!str(lease, 'renewEnd')) return 'Set the new end date under “Renewal terms” first.';
  if (str(lease, 'renewEnd') <= str(lease, 'endDate')) return `The new end date must be after the current end date (${formatDate(str(lease, 'endDate'))}) — change it under “Renewal terms”.`;
  return null;
}

export function leaseFlags(lease: DemoRecord, data: IndustryData, today: string): Flag[] {
  const out: Flag[] = [];
  const s = lease.status ?? '';
  if (s === 'application' && needsApproval(data, lease) && !str(lease, 'approvedBy')) out.push({ tone: 'amber', label: 'Needs leasing-manager approval' });
  if (!BILLED_LEASE.includes(s)) return out;
  const left = leaseDaysLeft(lease, today);
  if (left !== null && left < 0) out.push({ tone: 'red', label: 'Lease expired — holding over' });
  else if (leaseExpiring(lease, today) && left !== null) out.push({ tone: 'amber', label: left <= 60 ? `Expires in ${left} days` : `Expires in ${Math.max(1, monthsBetween(today, str(lease, 'endDate')))} months` });
  if (renewalOverdue(lease, today)) out.push({ tone: 'red', label: 'Renewal overdue' });
  const esc = escalationState(lease, today);
  if (esc === 'due') out.push({ tone: 'blue', label: 'Escalation due this month' });
  if (esc === 'overdue') out.push({ tone: 'red', label: 'Escalation overdue' });
  const arrears = leaseArrears(data, lease.id, today);
  if (arrears.overdue > 0) out.push({ tone: 'red', label: `Arrears ${rand(arrears.overdue)}${arrears.d90plus ? ' · 90+ days' : ''}` });
  if (str(lease, 'insuranceExpiry') && !insuranceOnFile(lease, today)) out.push({ tone: 'amber', label: 'Tenant insurance expired' });
  return out;
}

/* ---------------- Rules: work orders ---------------- */
export const priorityDays = (p: string) => PRIORITIES.find((x) => x.value === p)?.days ?? 7;
/** Days past the response target while no contractor has been assigned (date-only). */
export function responseOverdue(wo: DemoRecord, today: string): number {
  if (!['logged', 'assessed'].includes(wo.status ?? '') || !str(wo, 'reportedOn')) return 0;
  return Math.max(0, daysBetween(str(wo, 'reportedOn'), today) - priorityDays(str(wo, 'priority')));
}
export const woOpen = (wo: DemoRecord) => !['confirmed', 'closed'].includes(wo.status ?? '');
export const assessProblem = (wo: DemoRecord) => (str(wo, 'responsibility') ? null : 'Decide who is responsible first — “Landlord” or “Tenant” under “Assessment”.');
/** Core rule: no contractor is assigned until responsibility is decided (and a tenant job has a recharge agreed). */
export function assignProblem(wo: DemoRecord): string | null {
  const first = assessProblem(wo);
  if (first) return first;
  if (str(wo, 'responsibility') === 'tenant' && !(num(wo, 'rechargeAmount') > 0)) return 'This is the tenant’s responsibility: either agree a recharge amount under “Assessment” (the landlord does the work and bills it), or close the job with a note.';
  if (!str(wo, 'contractor').trim()) return 'Name the contractor under “Contractor” first.';
  return null;
}
export function workOrderFlags(wo: DemoRecord, today: string): Flag[] {
  const out: Flag[] = [];
  const late = responseOverdue(wo, today);
  if (late > 0) out.push({ tone: 'red', label: `Response overdue ${late} d` });
  if (woOpen(wo) && str(wo, 'priority') === 'emergency') out.push({ tone: 'red', label: 'Emergency' });
  if (str(wo, 'responsibility') === 'tenant' && num(wo, 'rechargeAmount') > 0) out.push({ tone: str(wo, 'rechargeInvoice') ? 'dark' : 'amber', label: str(wo, 'rechargeInvoice') ? `Recharged on ${str(wo, 'rechargeInvoice')}` : 'To recharge' });
  return out;
}

/* ---------------- Rules: fit-outs and work permits ---------------- */
export const insuranceProblem = (expiry: string, until: string, who = 'The contractor’s') =>
  (!expiry ? `${who} public-liability insurance is not on file — record its expiry date.` : expiry < until ? `${who} public-liability insurance expires on ${formatDate(expiry)}, before the work ends (${formatDate(until)}).` : null);

export function inductionProblems(fitout: DemoRecord, today: string): string[] {
  const out: string[] = [];
  if (!str(fitout, 'contractor').trim()) out.push('Name the fit-out contractor under “Contractor on site”.');
  const ins = insuranceProblem(str(fitout, 'insuranceExpiry'), str(fitout, 'targetDate') > today ? str(fitout, 'targetDate') : today);
  if (ins) out.push(`${ins} (“Contractor on site” panel)`);
  if (fitout.values.inducted !== true) out.push('The contractor’s site induction is not recorded — tick it under “Contractor on site”.');
  return out;
}

export const permitTypeLabel = (p: DemoRecord) => label(PERMIT_TYPES, str(p, 'type'));
/** What stops a work permit being approved. */
export function permitProblems(p: DemoRecord): string[] {
  const out: string[] = [];
  const from = str(p, 'validFrom');
  const to = str(p, 'validTo') || from;
  if (!from) out.push('Set the date of the work under “Permit dates”.');
  else if (to < from) out.push('The permit ends before it starts — correct the dates under “Permit dates”.');
  const ins = insuranceProblem(str(p, 'insuranceExpiry'), to || from);
  if (ins) out.push(`${ins} (“Before approval” panel)`);
  if (p.values.inducted !== true) out.push('The contractor has not done the site induction — record it under “Before approval”.');
  if (str(p, 'type') === 'hot' && !str(p, 'fireWatch').trim()) out.push('Hot work needs a named fire watch — add the name under “Before approval”.');
  if (str(p, 'type') === 'sprinkler') {
    if (!str(p, 'reinstateDate') || !str(p, 'reinstateTime')) out.push('A sprinkler isolation needs a reinstatement date and time — set them under “Before approval”.');
    else if (from && str(p, 'reinstateDate') < from) out.push('The sprinklers cannot be reinstated before the work starts — correct the reinstatement date.');
  }
  return out;
}
export const permitExpired = (p: DemoRecord, today: string) => p.status === 'active' && (str(p, 'validTo') || str(p, 'validFrom')) < today;
export function permitActivateProblem(p: DemoRecord, today: string): string | null {
  const from = str(p, 'validFrom');
  const to = str(p, 'validTo') || from;
  if (today < from) return `This permit is only valid from ${formatDate(from)} — it cannot be made active before then.`;
  if (today > to) return `This permit expired on ${formatDate(to)} — set new dates under “Permit dates” or reject it.`;
  return null;
}

/* ---------------- Rules: incidents ---------------- */
export const needsClaimRef = (i: DemoRecord) => i.values.injury === true || i.values.damage === true;
export const claimRefProblem = (ref: string) => (/^DEMO-CLM-\w+/.test(ref.trim()) ? null : 'Use a fictional reference that starts with DEMO-CLM- (for example DEMO-CLM-2291).');
export function incidentCloseProblem(i: DemoRecord): string | null {
  if (!needsClaimRef(i)) return null;
  if (!str(i, 'insuranceRef').trim()) return 'There was an injury or damage, so an insurance reference is needed before closing — add it under “Insurance”.';
  return claimRefProblem(str(i, 'insuranceRef'));
}

/* ---------------- Rules: exhibition bookings ---------------- */
export const spaceLabel = (b: DemoRecord | undefined) => label(SPACES, str(b, 'space'));
export const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart <= bEnd && bStart <= aEnd;
/** Another confirmed or live booking for the same space on overlapping dates. */
export function bookingClash(data: IndustryData, b: DemoRecord): DemoRecord | undefined {
  if (!str(b, 'space') || !str(b, 'startDate') || !str(b, 'endDate')) return undefined;
  return records(data, 'bookings').find((o) => o.id !== b.id && ['confirmed', 'live'].includes(o.status ?? '') && str(o, 'space') === str(b, 'space')
    && overlaps(str(b, 'startDate'), str(b, 'endDate'), str(o, 'startDate'), str(o, 'endDate')));
}
/** Core rule: a space cannot be double-booked, and a booking is only confirmed once the deposit is in. */
export function bookingConfirmProblem(data: IndustryData, b: DemoRecord): string | null {
  if (!str(b, 'startDate') || !str(b, 'endDate') || str(b, 'endDate') < str(b, 'startDate')) return 'Set the booking dates (the end cannot be before the start) under “Dates & space”.';
  const clash = bookingClash(data, b);
  if (clash) return `${spaceLabel(b)} is already booked by ${str(clash, 'exhibitor')} (${clash.ref}) from ${formatDate(str(clash, 'startDate'))} to ${formatDate(str(clash, 'endDate'))} — a space cannot be double-booked. Change the dates or the space under “Dates & space”.`;
  if (b.values.depositPaid !== true) return 'The booking is only confirmed once the deposit is received — record it under “Quote & deposit”.';
  return null;
}
export function bookingFigures(b: DemoRecord) {
  const days = str(b, 'startDate') && str(b, 'endDate') && str(b, 'endDate') >= str(b, 'startDate') ? daysBetween(str(b, 'startDate'), str(b, 'endDate')) + 1 : 0;
  const net = toCents(days * num(b, 'dailyRate'));
  const vat = Math.round((net * VAT_RATE) / 100);
  return { days, net, vat, total: net + vat, deposit: toCents(num(b, 'depositAmount')) };
}

/* ---------------- Centre operations ---------------- */
export const logFor = (data: IndustryData, date: string) => records(data, 'opslog').find((l) => str(l, 'date') === date);
/** The latest captured day (today if captured) against the same weekday a week earlier. */
export function footfallCompare(data: IndustryData, today: string) {
  const latest = records(data, 'opslog').filter((l) => str(l, 'date') <= today && num(l, 'footfall') > 0).sort((a, b) => str(a, 'date').localeCompare(str(b, 'date'))).pop();
  if (!latest) return null;
  const date = str(latest, 'date');
  const before = logFor(data, addDays(date, -7));
  const lastWeek = num(before, 'footfall');
  return { date, isToday: date === today, footfall: num(latest, 'footfall'), lastWeek, changePct: lastWeek > 0 ? Math.round(((num(latest, 'footfall') - lastWeek) / lastWeek) * 100) : null };
}

/* ---------------- Credit control ---------------- */
export const caseArrears = (data: IndustryData, c: DemoRecord, today: string) => leaseArrears(data, str(c, 'lease'), today);
export function demandProblem(data: IndustryData, c: DemoRecord, today: string): string | null {
  const a = caseArrears(data, c, today);
  if (a.overdue <= 0) return 'This tenant has no overdue balance any more — mark the case settled instead.';
  if (a.oldest < DEMAND_AFTER_DAYS) return `A letter of demand is only logged once the oldest invoice is ${DEMAND_AFTER_DAYS} days overdue (it is ${a.oldest} days).`;
  return null;
}
export function arrangementProblem(c: DemoRecord, today: string): string | null {
  if (!(num(c, 'instalment') > 0)) return 'Type the monthly instalment agreed with the tenant under “Payment arrangement”.';
  if (!str(c, 'firstPayment')) return 'Set the date of the first instalment under “Payment arrangement”.';
  if (str(c, 'firstPayment') < today) return 'The first instalment cannot be in the past — change the date under “Payment arrangement”.';
  return null;
}
/** Reminder wording. It is only ever shown as a preview: this demo sends nothing. */
export function reminderText(businessName: string, tenant: string, shop: string, a: Ageing): string {
  return `Dear ${tenant} (${shop}). Our records at ${businessName} show ${rand(a.overdue)} overdue on your account, the oldest invoice by ${a.oldest} days. Please settle or contact the centre management office to discuss. If you have paid in the last few days, thank you — please ignore this reminder.`;
}

/* ---------------- Access helper for pages ---------------- */
export const holds = (user: DemoUser, permission: string) => can(user, permission);
