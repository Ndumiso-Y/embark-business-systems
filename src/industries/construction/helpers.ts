// Construction helpers shared by the configuration, its pages, the seed and the tests.
// Kept free of page imports so index.ts and pages/*.tsx can both use them without
// circular imports. All money maths runs on integer cents.
import type { DemoRecord, IndustryData } from '../../core/types';
import { findRecord, lines, linesTotals, num, records, str } from '../../core/engine';
import { addDays, daysBetween, dueState, formatDate, type DueState } from '../../core/lib/dates';
import { formatRand, roundCents, toCents } from '../../core/lib/money';
import { EMPLOYER_RISK_CAUSES, RETENTION_CAP_PCT, VAT_RATE } from './data';

/* ---------------- "Today" indirection (tests pin the date) ---------------- */
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const isNum = (v: unknown) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));
/** Format integer cents as rand. */
export const rand = (cents: number) => formatRand(cents);
/** Format whole rand (not cents) compactly, e.g. R18.4m. */
export const randShort = (r: number) => formatRand(Math.round(r * 100), { compact: true });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/* ---------------- Projects ---------------- */
export const LIVE_PROJECT_STATES = ['awarded', 'onsite', 'practical', 'onhold'];
export const ACTIVE_PROJECT_STATES = ['onsite', 'practical'];

export function projectName(data: IndustryData, id: unknown): string {
  const p = findRecord(data, 'projects', String(id ?? ''));
  return p ? str(p, 'name') : 'Unknown project';
}
export const projectOf = (data: IndustryData, r: DemoRecord) => findRecord(data, 'projects', str(r, 'project'));
export const forProject = (data: IndustryData, collection: string, projectId: string) => records(data, collection).filter((r) => str(r, 'project') === projectId);

/** Contract completion date including any extension of time granted. */
export function completionDue(project: DemoRecord): string {
  const planned = str(project, 'plannedCompletion');
  return planned ? addDays(planned, num(project, 'eotDaysGranted')) : '';
}

/* ---------------- Variations & contract sum ---------------- */
export const variationsFor = (data: IndustryData, projectId: string, status?: string) =>
  forProject(data, 'variations', projectId).filter((v) => !status || v.status === status);

/** Approved variation value for a project (rand). */
export function approvedVariations(data: IndustryData, projectId: string): number {
  return variationsFor(data, projectId, 'approved').reduce((n, v) => n + num(v, 'value'), 0);
}

/** Original contract value plus approved variations (rand). */
export function revisedContractSum(data: IndustryData, project: DemoRecord): number {
  return num(project, 'contractValue') + approvedVariations(data, project.id);
}

/** Variations submitted to the client and awaiting a decision. */
export function pendingVariations(data: IndustryData, projectId?: string): DemoRecord[] {
  return records(data, 'variations').filter((v) => v.status === 'submitted' && (!projectId || str(v, 'project') === projectId));
}

/* ---------------- Subcontractor compliance ---------------- */
export type Expiry = { key: string; label: string; date: string; state: DueState };

export function subcontractorExpiries(r: DemoRecord, today: string): Expiry[] {
  return [
    { key: 'coidaExpiry', label: 'COIDA letter of good standing' },
    { key: 'taxExpiry', label: 'Tax compliance status' },
  ].map((e) => ({ ...e, date: str(r, e.key), state: dueState(str(r, e.key), today, 30) }));
}

export function subcontractorCompliance(r: DemoRecord, today: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const e of subcontractorExpiries(r, today)) {
    if (e.state === 'none') reasons.push(`${e.label} not recorded`);
    if (e.state === 'overdue') reasons.push(`${e.label} expired ${formatDate(e.date)}`);
  }
  if (r.values.safetyFileApproved !== true) reasons.push('Safety file not approved');
  return { ok: reasons.length === 0, reasons };
}

/** Rule: a non-compliant subcontractor cannot be assigned work through a variation. */
export function variationSubcontractorProblem(record: DemoRecord, data: IndustryData, today: string): string | null {
  const sub = findRecord(data, 'subcontractors', str(record, 'subcontractor'));
  if (!sub) return null;
  const c = subcontractorCompliance(sub, today);
  return c.ok ? null : `${str(sub, 'company')} is not compliant (${c.reasons.join('; ')}). A non-compliant or expired subcontractor cannot be assigned to a variation — renew the documents or choose another subcontractor.`;
}

export function variationPriceProblem(record: DemoRecord, data: IndustryData, today: string): string | null {
  if (!(num(record, 'value') > 0)) return 'Enter the priced value of the variation (excl. VAT) before marking it priced.';
  if (!isNum(record.values.timeImpactDays)) return 'Record the time impact in days (0 if none).';
  return variationSubcontractorProblem(record, data, today);
}

export function variationSubmitProblem(record: DemoRecord, data: IndustryData, today: string): string | null {
  if (!str(record, 'instructionRef').trim()) return 'No written site instruction reference — a verbal instruction cannot be submitted. Record the instruction reference (e.g. SI-014) first.';
  if (!(num(record, 'value') > 0)) return 'The variation has no price. Price it before submitting to the client.';
  return variationSubcontractorProblem(record, data, today);
}

/* ---------------- Payment valuations ---------------- */
export type ValuationInput = {
  /** Value of permanent work done to date (rand, cumulative). */
  workDone: number;
  /** Unfixed materials on site (rand). */
  materialsOnSite: number;
  /** Approved variations included to date (rand, cumulative). */
  variations: number;
  /** Retention percentage on the project. */
  retentionPct: number;
  /** Original contract value (rand) — used for the retention cap. */
  contractValue: number;
  /** Sum of amounts certified on earlier valuations (rand, excl. VAT). */
  previousCertified: number;
};

/** All figures in integer cents. */
export type ValuationFigures = {
  gross: number;
  retentionCalculated: number;
  retentionCap: number;
  retention: number;
  capped: boolean;
  netCumulative: number;
  previous: number;
  amountDue: number;
  vat: number;
  total: number;
};

/**
 * Illustrative interim valuation:
 * gross = work done + materials on site + approved variations (all to date);
 * retention = gross × project %, capped at a demo 5 % of the original contract value;
 * amount due (excl. VAT) = gross − retention − previous certificates; VAT at 15 %.
 */
export function computeValuation(i: ValuationInput): ValuationFigures {
  const gross = toCents(i.workDone) + toCents(i.materialsOnSite) + toCents(i.variations);
  const pct = Math.max(0, Number.isFinite(i.retentionPct) ? i.retentionPct : 0);
  const retentionCalculated = roundCents((gross * pct) / 100);
  const retentionCap = roundCents((toCents(i.contractValue) * RETENTION_CAP_PCT) / 100);
  const retention = Math.max(0, Math.min(retentionCalculated, retentionCap));
  const netCumulative = gross - retention;
  const previous = toCents(i.previousCertified);
  const amountDue = netCumulative - previous;
  const vat = roundCents((amountDue * VAT_RATE) / 100);
  return { gross, retentionCalculated, retentionCap, retention, capped: retentionCalculated > retentionCap, netCumulative, previous, amountDue, vat, total: amountDue + vat };
}

export const CERTIFIED_STATES = ['certified', 'paid'];
export const OPEN_VALUATION_STATES = ['draft', 'submitted'];

export const valuationsFor = (data: IndustryData, projectId: string) =>
  forProject(data, 'valuations', projectId).sort((a, b) => num(a, 'valuationNo') - num(b, 'valuationNo'));

/** Amounts certified on earlier valuations of the same project (rand, excl. VAT). */
export function previousCertified(data: IndustryData, valuation: DemoRecord): number {
  const no = num(valuation, 'valuationNo');
  return valuationsFor(data, str(valuation, 'project'))
    .filter((v) => v.id !== valuation.id && num(v, 'valuationNo') < no && CERTIFIED_STATES.includes(v.status ?? ''))
    .reduce((n, v) => n + num(v, 'certifiedAmount'), 0);
}

export function valuationFigures(data: IndustryData, valuation: DemoRecord): ValuationFigures {
  const project = projectOf(data, valuation);
  return computeValuation({
    workDone: num(valuation, 'workDone'),
    materialsOnSite: num(valuation, 'materialsOnSite'),
    variations: num(valuation, 'variationsToDate'),
    retentionPct: num(project, 'retentionPct'),
    contractValue: num(project, 'contractValue'),
    previousCertified: previousCertified(data, valuation),
  });
}

/** Total certified to date for a project (rand, excl. VAT). */
export function certifiedToDate(data: IndustryData, projectId: string): number {
  return forProject(data, 'valuations', projectId).filter((v) => CERTIFIED_STATES.includes(v.status ?? '')).reduce((n, v) => n + num(v, 'certifiedAmount'), 0);
}

export function openValuations(data: IndustryData, projectId: string, exceptId?: string): DemoRecord[] {
  return forProject(data, 'valuations', projectId).filter((v) => v.id !== exceptId && OPEN_VALUATION_STATES.includes(v.status ?? ''));
}

export function nextValuationNo(data: IndustryData, projectId: string): number {
  return forProject(data, 'valuations', projectId).reduce((m, v) => Math.max(m, num(v, 'valuationNo')), 0) + 1;
}

export function valuationSubmitProblem(record: DemoRecord, data: IndustryData): string | null {
  const project = projectOf(data, record);
  if (!project) return 'Select the project this valuation is for.';
  const other = openValuations(data, project.id, record.id)[0];
  if (other) return `${other.ref} (valuation ${num(other, 'valuationNo')}) is still open on this project. Only one open valuation per project — certify or remove it first.`;
  if (!str(record, 'periodEnd')) return 'Set the valuation date.';
  if (!(num(record, 'workDone') > 0)) return 'Enter the value of work done to date.';
  const earlier = valuationsFor(data, project.id).filter((v) => v.id !== record.id && num(v, 'valuationNo') < num(record, 'valuationNo'));
  const last = earlier[earlier.length - 1];
  if (last && num(record, 'workDone') < num(last, 'workDone')) {
    return `Work done to date (${rand(toCents(num(record, 'workDone')))}) is less than on valuation ${num(last, 'valuationNo')} (${rand(toCents(num(last, 'workDone')))}). Valuations are cumulative.`;
  }
  return null;
}

export function valuationCertifyProblem(record: DemoRecord): string | null {
  if (!isNum(record.values.certifiedAmount)) return 'Record the certified amount (excl. VAT) from the payment certificate before certifying.';
  const certified = toCents(num(record, 'certifiedAmount'));
  const submitted = toCents(num(record, 'submittedAmount'));
  if (certified > submitted) return `Certified amount ${rand(certified)} exceeds the ${rand(submitted)} submitted. A certificate cannot exceed the claim.`;
  return null;
}

/* ---------------- Programme ---------------- */
export const tasksFor = (data: IndustryData, projectId: string) =>
  forProject(data, 'tasks', projectId).sort((a, b) => str(a, 'plannedStart').localeCompare(str(b, 'plannedStart')) || str(a, 'plannedFinish').localeCompare(str(b, 'plannedFinish')));

/** Percentage of the task that should be complete by `today` if it ran to plan. */
export function taskExpectedPct(t: DemoRecord, today: string): number {
  const s = str(t, 'plannedStart');
  const f = str(t, 'plannedFinish');
  if (!s || !f || today < s) return 0;
  if (today >= f) return 100;
  return Math.round(((daysBetween(s, today) + 1) / (daysBetween(s, f) + 1)) * 100);
}

export type Slip = { state: 'complete' | 'late' | 'overdue' | 'behind' | 'ok'; days: number; gap: number };

export function taskSlip(t: DemoRecord, today: string): Slip {
  const finish = str(t, 'plannedFinish');
  if (t.status === 'complete') {
    const late = str(t, 'actualFinish') && finish ? daysBetween(finish, str(t, 'actualFinish')) : 0;
    return { state: late > 0 ? 'late' : 'complete', days: Math.max(0, late), gap: 0 };
  }
  if (finish && finish < today) return { state: 'overdue', days: daysBetween(finish, today), gap: 100 - num(t, 'pctComplete') };
  const gap = taskExpectedPct(t, today) - num(t, 'pctComplete');
  return { state: gap > 15 ? 'behind' : 'ok', days: 0, gap };
}

/** Duration-weighted % complete of a project's programme and % of contract time elapsed. */
export function programmeProgress(data: IndustryData, project: DemoRecord, today: string) {
  const tasks = tasksFor(data, project.id);
  const work = tasks.filter((t) => t.values.milestone !== true);
  let w = 0;
  let done = 0;
  for (const t of work) {
    const d = Math.max(1, daysBetween(str(t, 'plannedStart'), str(t, 'plannedFinish')) + 1);
    w += d;
    done += d * Math.min(100, Math.max(0, t.status === 'complete' ? 100 : num(t, 'pctComplete')));
  }
  const start = str(project, 'startDate');
  const end = completionDue(project);
  const span = start && end ? daysBetween(start, end) : 0;
  const elapsed = span > 0 ? Math.min(100, Math.max(0, Math.round((daysBetween(start, today) / span) * 100))) : 0;
  const slips = tasks.map((t) => ({ t, slip: taskSlip(t, today) }));
  return {
    pct: w ? Math.round(done / w) : 0,
    elapsed,
    tasks,
    overdue: slips.filter((s) => s.slip.state === 'overdue').map((s) => s.t),
    behind: slips.filter((s) => s.slip.state === 'behind').map((s) => s.t),
  };
}

export function overdueMilestones(data: IndustryData, today: string): DemoRecord[] {
  return records(data, 'tasks').filter((t) => t.values.milestone === true && t.status !== 'complete' && str(t, 'plannedFinish') && str(t, 'plannedFinish') < today);
}

/* ---------------- Site diary ---------------- */
export const isRainDay = (r: DemoRecord) => str(r, 'weather') === 'rain';
export const LABOUR_FIELDS = ['labourGeneral', 'labourArtisans', 'labourSteel', 'labourSubcontract'];
export const diaryLabour = (r: DemoRecord) => LABOUR_FIELDS.reduce((n, k) => n + num(r, k), 0);

export function diarySignProblem(record: DemoRecord): string | null {
  if (!str(record, 'workDone').trim()) return 'Describe the work done before signing the diary.';
  const hours = num(record, 'delayHours');
  if (hours > 0 && !str(record, 'delayCause')) return `${hours} delay hour(s) recorded — select the delay cause before signing. Delays without a cause cannot support an extension of time.`;
  if (isRainDay(record) && !str(record, 'delayCause')) return 'Rain day recorded — select the delay cause before signing.';
  return null;
}

export type DiarySummary = { entries: number; signed: number; rainDays: number; delayHours: number; employerDelayDays: number; otherDelayDays: number; indicativeEot: number };

/** Rain and delay days from the site diary (optionally for one project and from a date). */
export function diarySummary(data: IndustryData, projectId?: string, from = '', to = '9999-12-31'): DiarySummary {
  const list = records(data, 'diary').filter((r) => (!projectId || str(r, 'project') === projectId) && str(r, 'date') >= from && str(r, 'date') <= to);
  const rainDays = list.filter(isRainDay).length;
  const nonRain = list.filter((r) => !isRainDay(r));
  const hoursFor = (rs: DemoRecord[]) => rs.reduce((n, r) => n + num(r, 'delayHours'), 0);
  const halfDays = (h: number) => Math.round((h / 8) * 2) / 2;
  const employer = nonRain.filter((r) => EMPLOYER_RISK_CAUSES.includes(str(r, 'delayCause')));
  const other = nonRain.filter((r) => str(r, 'delayCause') && !EMPLOYER_RISK_CAUSES.includes(str(r, 'delayCause')));
  const employerDelayDays = halfDays(hoursFor(employer));
  return {
    entries: list.length,
    signed: list.filter((r) => r.status === 'signed').length,
    rainDays,
    delayHours: hoursFor(list),
    employerDelayDays,
    otherDelayDays: halfDays(hoursFor(other)),
    indicativeEot: rainDays + employerDelayDays,
  };
}

/* ---------------- Plant ---------------- */
export const isHired = (r: DemoRecord) => str(r, 'ownership') === 'hired';
export const onHire = (r: DemoRecord, today: string) => isHired(r) && str(r, 'state') !== 'offhired' && !!str(r, 'hireStart') && str(r, 'hireStart') <= today;

/** Chargeable hire days between `from` and `to` (inclusive) for hired plant. */
export function plantHireDays(r: DemoRecord, from: string, to: string): number {
  if (!isHired(r) || !str(r, 'hireStart')) return 0;
  const start = str(r, 'hireStart') > from ? str(r, 'hireStart') : from;
  const endHire = str(r, 'offHiredOn') || to;
  const end = endHire < to ? endHire : to;
  return end < start ? 0 : daysBetween(start, end) + 1;
}

/** Hire cost since the start of hire (rand). */
export const plantRunningCost = (r: DemoRecord, today: string) => plantHireDays(r, str(r, 'hireStart'), today) * num(r, 'dailyRate');
/** Hire cost in the current calendar month to date (rand). */
export const plantCostThisMonth = (r: DemoRecord, today: string) => plantHireDays(r, `${today.slice(0, 7)}-01`, today) * num(r, 'dailyRate');

export function plantAlerts(r: DemoRecord, today: string): Array<{ tone: 'red' | 'amber'; label: string }> {
  const out: Array<{ tone: 'red' | 'amber'; label: string }> = [];
  if (onHire(r, today)) {
    if (str(r, 'state') === 'idle') out.push({ tone: 'amber', label: `Hired plant idle — ${rand(toCents(num(r, 'dailyRate')))}/day` });
    if (str(r, 'offHireDue') && str(r, 'offHireDue') < today) out.push({ tone: 'red', label: `Off-hire overdue ${plural(daysBetween(str(r, 'offHireDue'), today), 'day')}` });
  }
  if (str(r, 'state') === 'breakdown') out.push({ tone: 'red', label: 'Broken down' });
  if (str(r, 'state') !== 'offhired') {
    const s = dueState(str(r, 'nextServiceDue'), today, 14);
    if (s === 'overdue') out.push({ tone: 'red', label: 'Service overdue' });
    if (s === 'due-soon') out.push({ tone: 'amber', label: `Service due ${formatDate(str(r, 'nextServiceDue'))}` });
  }
  return out;
}

/* ---------------- Snags ---------------- */
export const snagsFor = (data: IndustryData, projectId: string) => forProject(data, 'snags', projectId);
export const snagOpen = (r: DemoRecord) => r.status !== 'verified';
export const openCriticalSnags = (data: IndustryData, projectId?: string) =>
  records(data, 'snags').filter((s) => (!projectId || str(s, 'project') === projectId) && str(s, 'category') === 'critical' && snagOpen(s));

export function practicalCompletionProblem(project: DemoRecord, data: IndustryData): string | null {
  const snags = snagsFor(data, project.id);
  const uncategorised = snags.filter((s) => !str(s, 'category'));
  if (uncategorised.length) return `${plural(uncategorised.length, 'snag')} not categorised (${uncategorised.map((s) => s.ref).join(', ')}). Categorise every snag as critical, major or minor first.`;
  const critical = openCriticalSnags(data, project.id);
  if (critical.length) return `${plural(critical.length, 'critical snag')} still open (${critical.map((s) => s.ref).join(', ')}). Practical completion cannot be reached with open critical defects.`;
  return null;
}

export function finalCompletionProblem(project: DemoRecord, data: IndustryData): string | null {
  const open = snagsFor(data, project.id).filter(snagOpen);
  if (open.length) return `${plural(open.length, 'snag')} not yet verified closed. The snag list must be closed before final completion.`;
  if (project.values.retentionReleaseCert !== true) return 'Record the retention release certificate (demo) before final completion.';
  return null;
}

export function startOnSiteProblem(project: DemoRecord): string | null {
  if (!(num(project, 'contractValue') > 0)) return 'Record the contract value before starting on site.';
  if (!str(project, 'startDate')) return 'Set the site handover / start date.';
  if (!str(project, 'plannedCompletion')) return 'Set the planned completion date.';
  return null;
}

/* ---------------- Procurement ---------------- */
/** Requisition value excl. VAT (cents). */
export const requisitionValue = (r: DemoRecord) => linesTotals(lines(r)).net;
export const deliveryLate = (r: DemoRecord, today: string) => ['ordered', 'partial'].includes(r.status ?? '') && !!str(r, 'expectedDelivery') && str(r, 'expectedDelivery') < today;

export function requisitionApproveProblem(r: DemoRecord): string | null {
  if (!lines(r).length) return 'Add at least one line before approving.';
  if (!str(r, 'project')) return 'Link the requisition to a project.';
  return null;
}
export function purchaseOrderProblem(r: DemoRecord): string | null {
  if (!str(r, 'supplier')) return 'Select the supplier before issuing the purchase order.';
  if (!str(r, 'expectedDelivery')) return 'Set the expected delivery date before issuing the purchase order.';
  return null;
}
export function deliveryProblem(r: DemoRecord): string | null {
  return str(r, 'deliveryNote').trim() ? null : 'Enter the supplier delivery note number before receiving goods.';
}

/* ---------------- Cost ---------------- */
/** Cost to date for a project (rand): labour & subcontract (typed) + delivered materials + plant hire. */
export function projectCost(data: IndustryData, project: DemoRecord, today: string) {
  const other = num(project, 'otherCostToDate');
  const materials = forProject(data, 'requisitions', project.id).filter((r) => ['partial', 'delivered'].includes(r.status ?? '')).reduce((n, r) => n + requisitionValue(r) / 100, 0);
  const plant = forProject(data, 'plant', project.id).reduce((n, p) => n + plantRunningCost(p, today), 0);
  return { other, materials, plant, total: other + materials + plant };
}

/* ---------------- Safety ---------------- */
export function safetyCloseProblem(r: DemoRecord): string | null {
  const type = str(r, 'type');
  if ((type === 'incident' || type === 'nearmiss') && !str(r, 'correctiveAction').trim()) return 'Record the corrective action before closing an incident or near miss.';
  if (type === 'toolbox' && !(num(r, 'attendees') > 0)) return 'Record how many people attended the toolbox talk.';
  return null;
}

export function daysSinceLastLti(data: IndustryData, today: string): number | null {
  const last = records(data, 'safety').filter((r) => r.values.lostTime === true).map((r) => str(r, 'date')).sort().pop();
  return last ? Math.max(0, daysBetween(last, today)) : null;
}
