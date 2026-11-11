// Contract-cleaning helpers shared by the configuration, its pages, the seed and the tests.
// Kept free of page imports so index.ts and pages/*.tsx can both use them without circular
// imports. Lists (rostered cleaners, clock-ins, site inductions, ticked checklist lines) are
// stored as comma-separated text because demo record values are flat.
import type { DemoRecord, DemoUser, Flag, IndustryData, Line, Values } from '../../core/types';
import { can, findRecord, lines, linesTotals, num, records, str } from '../../core/engine';
import { addDays, daysBetween, dueState, formatDate, monthLabel, type DueState } from '../../core/lib/dates';
import { formatRand, roundCents, toCents } from '../../core/lib/money';
import {
  CONTRACT_WARNING_DAYS, EQUIPMENT_TYPES, FREQUENCIES, INSPECTION_AREAS, LATE_GRACE_MIN, MIN_MARGIN_PCT, PERIODIC_TASKS, PRIORITIES,
  QUOTE_APPROVAL_THRESHOLD, TRAININGS, VAT_RATE, WORKING_DAYS_PER_MONTH, label,
} from './data';

/* ---------------- "Today" indirection (tests pin the date) ---------------- */
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Wall-clock time as HH:MM (pinned to midday when tests pin the date). */
export function nowTime() {
  if (todayOverride) return '12:00';
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export const nowStamp = () => `${todayStr()} ${nowTime()}`;

/* ---------------- Small utilities ---------------- */
export const csv = (v: unknown): string[] => String(v ?? '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
export const toCsv = (list: string[]) => [...new Set(list)].join(',');
/** Format integer cents as rand. */
export const rand = (cents: number) => formatRand(cents);
/** Format a rand amount (not cents). */
export const randOf = (r: number) => formatRand(toCents(r));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const minutes = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/* ---------------- Lookups ---------------- */
export const fullName = (s: DemoRecord | undefined) => (s ? `${str(s, 'firstName')} ${str(s, 'lastName')}` : 'Unknown');
export const siteOf = (data: IndustryData, r: DemoRecord | undefined) => findRecord(data, 'sites', str(r, 'site'));
export const siteName = (data: IndustryData, id: unknown) => str(findRecord(data, 'sites', String(id ?? '')), 'name') || 'Unknown site';
export const clientName = (data: IndustryData, id: unknown) => str(findRecord(data, 'clients', String(id ?? '')), 'name') || 'Unknown client';
export const staffName = (data: IndustryData, id: unknown) => fullName(findRecord(data, 'staff', String(id ?? '')));
export const staffByRef = (data: IndustryData, ref: string) => records(data, 'staff').find((s) => s.ref === ref);
export const forSite = (data: IndustryData, collection: string, siteId: string) => records(data, collection).filter((r) => str(r, 'site') === siteId);

/** Scope lines of a site: one task per line, e.g. "Ablutions — clean and restock". */
export const taskList = (site: DemoRecord | undefined, key: 'dailyTasks' | 'weeklyTasks' | 'monthlyTasks') =>
  String(site?.values[key] ?? '').split('\n').map((s) => s.trim()).filter(Boolean);

/* ---------------- Staff: training & inductions ---------------- */
export type TrainingKey = (typeof TRAININGS)[number]['key'];

/** A training counts only when an expiry is recorded and it has not passed on the given day. */
export function trainingValid(staff: DemoRecord | undefined, key: TrainingKey, on: string): boolean {
  const d = str(staff, key);
  return !!d && d >= on;
}

export function trainingStates(staff: DemoRecord, today: string): Array<{ key: TrainingKey; label: string; date: string; state: DueState }> {
  return TRAININGS.map((t) => ({ key: t.key, label: t.label, date: str(staff, t.key), state: dueState(str(staff, t.key), today, 30) }));
}

export function staffFlags(staff: DemoRecord, today: string): Flag[] {
  if (staff.status === 'left') return [];
  const out: Flag[] = [];
  for (const t of trainingStates(staff, today)) {
    if (t.state === 'overdue') out.push({ tone: 'red', label: `${t.label} expired` });
    if (t.state === 'due-soon') out.push({ tone: 'amber', label: `${t.label} expires ${formatDate(t.date)}` });
  }
  if (str(staff, 'ppeIssued') && daysBetween(str(staff, 'ppeIssued'), today) > 365) out.push({ tone: 'dark', label: 'PPE issue older than 12 months' });
  return out;
}

export const inductedAt = (staff: DemoRecord | undefined, site: DemoRecord | undefined) => !!site && csv(str(staff, 'inductions')).includes(site.ref);
export const isRosterable = (s: DemoRecord) => s.status === 'active' && str(s, 'role') !== 'supervisor';

/* ---------------- Shifts: roster, attendance, checklist ---------------- */
export const ON_SITE_STATES = ['clockedin', 'short', 'relief'];
export const shiftCleaners = (shift: DemoRecord | undefined) => csv(str(shift, 'cleaners'));
export const shiftAbsent = (shift: DemoRecord | undefined) => csv(str(shift, 'absentees'));
export const shiftReliefs = (shift: DemoRecord | undefined) => csv(str(shift, 'reliefs'));

/** Clock-ins are stored as "EMP-0003=05:58,EMP-0004=06:12". */
export function clockIns(shift: DemoRecord | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of csv(str(shift, 'clockIns'))) {
    const [ref, time] = part.split('=');
    if (ref && time) out[ref.trim()] = time.trim();
  }
  return out;
}
export const withClockIn = (shift: DemoRecord, ref: string, time: string) =>
  Object.entries({ ...clockIns(shift), [ref]: time }).map(([r, t]) => `${r}=${t}`).join(',');

export function overlaps(a: DemoRecord, b: DemoRecord): boolean {
  return str(a, 'date') === str(b, 'date') && minutes(str(a, 'start')) < minutes(str(b, 'end')) && minutes(str(b, 'start')) < minutes(str(a, 'end'));
}

/**
 * Rules for putting one cleaner on one shift: employed and not on leave, inducted at the
 * site, infection-control training in date for healthcare sites, and no overlapping shift.
 */
export function assignmentProblem(staff: DemoRecord | undefined, shift: DemoRecord, data: IndustryData): string | null {
  if (!staff) return 'That cleaner is not on the staff register.';
  const name = fullName(staff);
  if (staff.status === 'leave') return `${name} is on leave and cannot be rostered.`;
  if (staff.status === 'left') return `${name} no longer works here and cannot be rostered.`;
  const site = siteOf(data, shift);
  if (!site) return 'Select the site first.';
  if (!inductedAt(staff, site)) return `${name} has not completed the site induction for ${str(site, 'name')}.`;
  if (str(site, 'siteType') === 'clinic' && !trainingValid(staff, 'icExpiry', str(shift, 'date'))) {
    return `${name}’s infection-control training ${str(staff, 'icExpiry') ? `expired on ${formatDate(str(staff, 'icExpiry'))}` : 'is not on record'} — it must be in date for healthcare sites.`;
  }
  const clash = records(data, 'shifts').find((o) => o.id !== shift.id && overlaps(o, shift) && shiftCleaners(o).includes(staff.ref) && !shiftAbsent(o).includes(staff.ref));
  if (clash) return `${name} is already on an overlapping shift at ${siteName(data, clash.values.site)} (${clash.ref}, ${str(clash, 'start')}–${str(clash, 'end')}).`;
  return null;
}

/** Everything wrong with a shift's roster (empty when it can be confirmed). */
export function rosterProblems(shift: DemoRecord, data: IndustryData): string[] {
  const out: string[] = [];
  if (!siteOf(data, shift)) out.push('Select the site first.');
  if (minutes(str(shift, 'end')) <= minutes(str(shift, 'start'))) out.push('The shift must end after it starts.');
  const absent = shiftAbsent(shift);
  const team = shiftCleaners(shift).filter((r) => !absent.includes(r));
  if (!team.length) out.push('Add at least one cleaner to the roster before confirming.');
  for (const ref of team) {
    const p = assignmentProblem(staffByRef(data, ref), shift, data);
    if (p) out.push(p);
  }
  return out;
}

/** Rule for the relief cleaner chosen to cover an absence. */
export function reliefProblem(shift: DemoRecord, data: IndustryData): string | null {
  const pick = findRecord(data, 'staff', str(shift, 'reliefPick'));
  if (!pick) return 'Choose a relief cleaner first (attendance panel on the shift).';
  if (shiftCleaners(shift).includes(pick.ref)) return `${fullName(pick)} is already on this shift.`;
  return assignmentProblem(pick, shift, data);
}

export const staffingPct = (present: number, contracted: number) => (contracted > 0 ? Math.round((present / contracted) * 100) : 0);

export type Staffing = { contracted: number; rostered: number; present: number; absent: number; late: string[]; unfilled: number; pct: number };

/** Staffing level of one shift against the contracted number of cleaners for the site. */
export function staffing(shift: DemoRecord, data: IndustryData): Staffing {
  const contracted = num(siteOf(data, shift), 'cleanersPerShift');
  const absent = shiftAbsent(shift);
  const team = shiftCleaners(shift).filter((r) => !absent.includes(r));
  const ins = clockIns(shift);
  const present = team.filter((r) => ins[r]);
  const limit = minutes(str(shift, 'start')) + LATE_GRACE_MIN;
  return {
    contracted, rostered: team.length, present: present.length, absent: absent.length,
    late: present.filter((r) => minutes(ins[r]) > limit),
    unfilled: Math.max(0, contracted - team.length),
    pct: staffingPct(present.length, contracted),
  };
}

export const shiftsOn = (data: IndustryData, date: string) =>
  records(data, 'shifts').filter((s) => str(s, 'date') === date).sort((a, b) => siteName(data, a.values.site).localeCompare(siteName(data, b.values.site)) || str(a, 'start').localeCompare(str(b, 'start')));

/** Totals for one day: who is on site against who was contracted. */
export function dayStaffing(data: IndustryData, date: string) {
  const list = shiftsOn(data, date);
  const rows = list.map((s) => ({ shift: s, st: staffing(s, data) }));
  const contracted = rows.reduce((n, r) => n + r.st.contracted, 0);
  const present = rows.reduce((n, r) => n + r.st.present, 0);
  return {
    shifts: list, contracted, present, pct: staffingPct(present, contracted),
    rostered: rows.reduce((n, r) => n + r.st.rostered, 0),
    late: rows.reduce((n, r) => n + r.st.late.length, 0),
    unfilled: rows.reduce((n, r) => n + r.st.unfilled, 0),
    short: rows.filter((r) => r.st.unfilled > 0 || r.shift.status === 'short').map((r) => r.shift),
  };
}

/** Attendance over completed shifts: cleaners present ÷ cleaners contracted. */
export function attendance(shifts: DemoRecord[], data: IndustryData) {
  const done = shifts.filter((s) => s.status === 'completed');
  const contracted = done.reduce((n, s) => n + num(siteOf(data, s), 'cleanersPerShift'), 0);
  const present = done.reduce((n, s) => n + staffing(s, data).present, 0);
  return { shifts: done.length, contracted, present, pct: staffingPct(present, contracted) };
}

export function checklistState(shift: DemoRecord, data: IndustryData) {
  const tasks = taskList(siteOf(data, shift), 'dailyTasks');
  const ticked = new Set(csv(str(shift, 'checklist')).map(Number));
  return { tasks, ticked, missing: tasks.filter((_, i) => !ticked.has(i + 1)) };
}

/** A shift is completed with every daily task ticked, or with a note saying what was missed. */
export function completionProblem(shift: DemoRecord, data: IndustryData, note: string | undefined, today: string): string | null {
  if (str(shift, 'date') > today) return 'A future shift cannot be completed.';
  if (!Object.keys(clockIns(shift)).length) return 'No clock-ins are recorded — clock the team in before completing the shift.';
  const { missing } = checklistState(shift, data);
  const reason = (note ?? '').trim() || str(shift, 'missedNote').trim();
  if (missing.length && !reason) {
    return `${plural(missing.length, 'daily task')} not ticked (${missing.slice(0, 2).join('; ')}${missing.length > 2 ? '…' : ''}). Tick the checklist, or add a note saying what was missed and why.`;
  }
  return null;
}

/** Contracted cleaners who were not on site for a completed shift. */
export const shiftShortfall = (shift: DemoRecord, data: IndustryData) => (shift.status === 'completed' ? Math.max(0, num(siteOf(data, shift), 'cleanersPerShift') - staffing(shift, data).present) : 0);

/* ---------------- Periodic tasks ---------------- */
export const freqDays = (r: DemoRecord) => FREQUENCIES.find((f) => f.value === str(r, 'frequency'))?.days ?? 30;
export const periodicLabel = (r: DemoRecord) => label(PERIODIC_TASKS, str(r, 'task'));
export function periodicDue(r: DemoRecord, today: string): DueState {
  return ['planned', 'inprogress'].includes(r.status ?? '') ? dueState(str(r, 'nextDue'), today, 7) : 'none';
}
export const overduePeriodic = (data: IndustryData, today: string) => records(data, 'periodic').filter((r) => periodicDue(r, today) === 'overdue');

export function periodicStartProblem(r: DemoRecord, data: IndustryData, today: string): string | null {
  const lead = findRecord(data, 'staff', str(r, 'assignedTo'));
  if (!lead) return 'Assign a team leader before starting the task.';
  if (lead.status !== 'active') return `${fullName(lead)} is not available — assign someone else.`;
  if (r.values.atHeight === true && !trainingValid(lead, 'heightsExpiry', today)) {
    return `${fullName(lead)} does not hold in-date working-at-heights training, which this task needs.`;
  }
  return null;
}

/* ---------------- Inspections ---------------- */
export const COUNTED_INSPECTIONS = ['submitted', 'signedoff'];
export const slaTarget = (site: DemoRecord | undefined) => num(site, 'slaTarget') || 85;
const scoreOf = (r: DemoRecord, key: string) => { const n = num(r, key); return n >= 1 && n <= 5 ? n : 0; };

/** Inspection result as a percentage of the maximum for the areas scored. */
export function inspectionScore(r: DemoRecord): number | null {
  const vals = INSPECTION_AREAS.map((a) => scoreOf(r, a.key)).filter(Boolean);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 5)) * 100);
}
export const lowAreas = (r: DemoRecord) => INSPECTION_AREAS.filter((a) => { const n = scoreOf(r, a.key); return n > 0 && n <= 2; });

export function inspectionProblems(r: DemoRecord, data: IndustryData): string[] {
  const out: string[] = [];
  if (!siteOf(data, r)) out.push('Select the site inspected.');
  const unscored = INSPECTION_AREAS.filter((a) => !scoreOf(r, a.key));
  if (unscored.length) out.push(`Score every area from 1 to 5 (still to score: ${unscored.map((a) => a.label).join(', ')}).`);
  const low = lowAreas(r);
  if (low.length) {
    const what = low.map((a) => `${a.label} (${num(r, a.key)})`).join(', ');
    if (!str(r, 'correctiveAction').trim()) out.push(`${what} scored 2 or below — record a corrective action before submitting.`);
    else if (!str(r, 'correctiveDue')) out.push(`${what} scored 2 or below — the corrective action needs a due date.`);
    else if (str(r, 'correctiveDue') < str(r, 'date')) out.push('The corrective action due date cannot be before the inspection date.');
  }
  return out;
}

/** An inspection fails when its score is below the site's SLA target. */
export function inspectionFailed(r: DemoRecord, data: IndustryData): boolean {
  const score = inspectionScore(r);
  return score !== null && score < slaTarget(siteOf(data, r));
}

/** Submitted and signed-off inspections for a site, oldest first. */
export const siteInspections = (data: IndustryData, siteId: string) =>
  forSite(data, 'inspections', siteId).filter((i) => COUNTED_INSPECTIONS.includes(i.status ?? '')).sort((a, b) => str(a, 'date').localeCompare(str(b, 'date')));

export function latestInspection(data: IndustryData, siteId: string): DemoRecord | undefined {
  const list = siteInspections(data, siteId);
  return list[list.length - 1];
}
export function siteBelowSla(data: IndustryData, site: DemoRecord): boolean {
  const last = latestInspection(data, site.id);
  return !!last && inspectionFailed(last, data);
}

/** Average inspection score and average SLA target for the inspections in a month (YYYY-MM). */
export function monthScores(data: IndustryData, month: string) {
  const list = records(data, 'inspections').filter((i) => COUNTED_INSPECTIONS.includes(i.status ?? '') && str(i, 'date').startsWith(month));
  const scores = list.map((i) => inspectionScore(i) ?? 0);
  const targets = list.map((i) => slaTarget(siteOf(data, i)));
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  return { count: list.length, avg: avg(scores), target: avg(targets), failed: list.filter((i) => inspectionFailed(i, data)).length };
}

/* ---------------- Complaints & requests ---------------- */
export const OPEN_COMPLAINT_STATES = ['logged', 'acknowledged', 'inprogress'];
export const slaHours = (r: DemoRecord) => PRIORITIES.find((p) => p.value === str(r, 'priority'))?.hours ?? 24;
const stampMs = (stamp: string) => {
  const [d, t = '00:00'] = stamp.trim().split(/[ T]/);
  const [y, m, day] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  return new Date(y, (m || 1) - 1, day || 1, h || 0, min || 0).getTime();
};
/** Hours between two "YYYY-MM-DD HH:MM" stamps, never negative, to one decimal. */
export const hoursBetween = (a: string, b: string) => Math.max(0, Math.round(((stampMs(b) - stampMs(a)) / 3_600_000) * 10) / 10);
export const loggedStamp = (r: DemoRecord) => `${str(r, 'date')} ${str(r, 'time') || '08:00'}`;

/** Response clock: hours waited for an acknowledgement against the demo target for the priority. */
export function complaintClock(r: DemoRecord, now = nowStamp()) {
  const target = slaHours(r);
  const ack = str(r, 'ackAt');
  const waited = hoursBetween(loggedStamp(r), ack || now);
  return { target, waited, breached: r.status === 'logged' && waited > target, late: !!ack && waited > target };
}
export const openComplaints = (data: IndustryData) => records(data, 'complaints').filter((c) => OPEN_COMPLAINT_STATES.includes(c.status ?? ''));
export const breachedComplaints = (data: IndustryData, now = nowStamp()) => records(data, 'complaints').filter((c) => complaintClock(c, now).breached);
export const daysToResolve = (r: DemoRecord) => (str(r, 'resolvedOn') ? Math.max(0, daysBetween(str(r, 'date'), str(r, 'resolvedOn'))) : null);

/* ---------------- Stock, issues & budgets ---------------- */
export const ISSUED_STATES = ['issued', 'received'];
export const lowStock = (data: IndustryData) => records(data, 'stock').filter((s) => num(s, 'qty') <= num(s, 'reorderLevel'));
/** Cost value of an issue in rand (quantity × item cost). */
export const issueValue = (issue: DemoRecord, data: IndustryData) => num(issue, 'qty') * num(findRecord(data, 'stock', str(issue, 'item')), 'cost');

/** Consumables issued to a site in a month (YYYY-MM), in rand at cost. */
export function consumablesUsed(data: IndustryData, siteId: string, month: string): number {
  return forSite(data, 'issues', siteId)
    .filter((i) => ISSUED_STATES.includes(i.status ?? '') && str(i, 'date').startsWith(month))
    .reduce((n, i) => n + toCents(issueValue(i, data)), 0) / 100;
}

export function budgetState(data: IndustryData, site: DemoRecord, month: string) {
  const used = consumablesUsed(data, site.id, month);
  const budget = num(site, 'consumablesBudget');
  return { used, budget, pct: budget > 0 ? Math.round((used / budget) * 100) : 0, over: budget > 0 && used > budget };
}
export const sitesOverBudget = (data: IndustryData, month: string) => records(data, 'sites').filter((s) => s.status !== 'ended' && budgetState(data, s, month).over);

/** Cleaners based at a site who hold in-date chemical-handling training. */
export const chemTrainedAt = (data: IndustryData, site: DemoRecord, today: string) =>
  records(data, 'staff').filter((s) => s.status === 'active' && str(s, 'homeSite') === site.id && trainingValid(s, 'chemExpiry', today));

/** Rules for issuing stock to a site: enough in store, and the hazardous-chemical demo rule. */
export function issueProblems(issue: DemoRecord, data: IndustryData, today: string): string[] {
  const out: string[] = [];
  const item = findRecord(data, 'stock', str(issue, 'item'));
  const site = siteOf(data, issue);
  if (!item) out.push('Select the stock item.');
  if (!site) out.push('Select the site.');
  const qty = num(issue, 'qty');
  if (!(qty > 0)) out.push('Enter a quantity above zero.');
  if (!item || !site) return out;
  const name = str(item, 'name');
  if (qty > num(item, 'qty')) out.push(`Only ${num(item, 'qty')} × ${name} in store — ${qty} cannot be issued. Reduce the quantity or receive a purchase order first.`);
  if (item.values.hazardous === true) {
    if (item.values.sdsOnFile !== true) out.push(`${name} is hazardous and has no safety data sheet (SDS) on file — it cannot be issued until one is filed.`);
    if (!chemTrainedAt(data, site, today).length) out.push(`${name} is hazardous: no cleaner based at ${str(site, 'name')} holds in-date chemical-handling training.`);
  }
  return out;
}

/* ---------------- Equipment ---------------- */
export const isElectrical = (r: DemoRecord) => EQUIPMENT_TYPES.find((t) => t.value === str(r, 'type'))?.electrical ?? false;

export function equipmentFlags(r: DemoRecord, today: string): Flag[] {
  if (r.status === 'scrapped') return [];
  const out: Flag[] = [];
  const svc = dueState(str(r, 'serviceDue'), today, 21);
  if (svc === 'overdue') out.push({ tone: 'red', label: 'Service overdue' });
  if (svc === 'due-soon') out.push({ tone: 'amber', label: 'Service due' });
  if (isElectrical(r)) {
    const test = dueState(str(r, 'electricalTestDue'), today, 21);
    if (test === 'overdue') out.push({ tone: 'red', label: 'Electrical test overdue' });
    if (test === 'due-soon') out.push({ tone: 'amber', label: 'Electrical test due' });
    if (test === 'none') out.push({ tone: 'red', label: 'No electrical test on record' });
  }
  if (str(r, 'condition') === 'poor') out.push({ tone: 'amber', label: 'Poor condition' });
  return out;
}

/** Equipment goes to a site only with a site chosen and an in-date electrical test (demo rule). */
export function allocationProblem(r: DemoRecord, data: IndustryData, today: string): string | null {
  if (!siteOf(data, r)) return 'Choose the site this equipment is going to (Edit → Site located).';
  if (isElectrical(r)) {
    const due = str(r, 'electricalTestDue');
    if (!due) return 'No electrical safety test is on record — test the appliance before it goes to a site.';
    if (due < today) return `The electrical safety test was due on ${formatDate(due)} — equipment with an overdue test cannot be allocated.`;
  }
  return null;
}

/* ---------------- Quotes for once-off jobs ---------------- */
export function quoteFigures(r: DemoRecord) {
  const t = linesTotals(lines(r), VAT_RATE);
  const cost = toCents(num(r, 'costEstimate'));
  return { net: t.net, vat: t.vat, total: t.total, cost, marginPct: t.net > 0 ? Math.round(((t.net - cost) / t.net) * 1000) / 10 : 0 };
}

/** Why a quote needs a user with "Approve quotes" to send it (empty when it does not). */
export function quoteApprovalReasons(r: DemoRecord): string[] {
  const f = quoteFigures(r);
  const out: string[] = [];
  if (f.net > toCents(QUOTE_APPROVAL_THRESHOLD)) out.push(`the value of ${rand(f.net)} excl. VAT is above the ${rand(toCents(QUOTE_APPROVAL_THRESHOLD))} threshold`);
  if (f.net > 0 && f.marginPct < MIN_MARGIN_PCT) out.push(`the margin of ${f.marginPct}% is below the ${MIN_MARGIN_PCT}% minimum`);
  return out;
}

export function quoteSendProblem(r: DemoRecord, user: DemoUser): string | null {
  if (!str(r, 'clientName').trim()) return 'Enter the client name.';
  if (!lines(r).length) return 'Add at least one quote line (labour hours × rate, consumables, equipment).';
  if (!(num(r, 'costEstimate') > 0)) return 'Enter the estimated cost of the job so the margin can be checked.';
  const reasons = quoteApprovalReasons(r);
  if (reasons.length && !can(user, 'quotes.approve')) return `Approval needed: ${reasons.join(' and ')}. Only a user with “Approve quotes” can send this quote.`;
  return null;
}

export function jobScheduleProblem(r: DemoRecord, today: string): string | null {
  if (!str(r, 'jobDate')) return 'Set the job date before scheduling.';
  if (str(r, 'jobDate') < today) return 'The job date is in the past — choose a new date.';
  if (!(num(r, 'teamSize') >= 1)) return 'Set the team size (at least one cleaner) before scheduling.';
  return null;
}

/* ---------------- Invoicing ---------------- */
/** Invoice totals in cents: lines less the credit for shifts not staffed, then VAT. */
export function invoiceFigures(r: DemoRecord) {
  const gross = linesTotals(lines(r), VAT_RATE).net;
  const credit = Math.min(gross, toCents(num(r, 'credit')));
  const net = gross - credit;
  const vat = roundCents((net * VAT_RATE) / 100);
  return { gross, credit, net, vat, total: net + vat };
}
export const invoiceOverdue = (r: DemoRecord, today: string) => r.status === 'issued' && !!str(r, 'dueDate') && str(r, 'dueDate') < today;

/**
 * Demo rule: every contracted cleaner missing from a completed shift is credited at
 * monthly fee ÷ (contracted cleaners × 22 working days).
 */
export function unstaffedCredit(data: IndustryData, site: DemoRecord, month: string) {
  const cleanerShifts = forSite(data, 'shifts', site.id).filter((s) => str(s, 'date').startsWith(month)).reduce((n, s) => n + shiftShortfall(s, data), 0);
  const contracted = num(site, 'cleanersPerShift');
  const rate = contracted > 0 ? toCents(num(site, 'monthlyFee') / (contracted * WORKING_DAYS_PER_MONTH)) : 0;
  return { cleanerShifts, rate: rate / 100, amount: (cleanerShifts * rate) / 100 };
}

/** Billable periodic tasks done for a site in a month. */
export const periodicExtras = (data: IndustryData, siteId: string, month: string) =>
  forSite(data, 'periodic', siteId).filter((p) => num(p, 'chargeExtra') > 0 && str(p, 'lastDone').startsWith(month));

/** Active sites with no contract invoice yet for the period. */
export function sitesToInvoice(data: IndustryData, month: string): DemoRecord[] {
  const done = new Set(records(data, 'invoices').filter((i) => str(i, 'kind') === 'contract' && str(i, 'period') === month && i.status !== 'void').map((i) => str(i, 'site')));
  return records(data, 'sites').filter((s) => s.status !== 'ended' && !done.has(s.id) && str(s, 'contractStart') <= `${month}-31`);
}

/** Values for a draft monthly contract invoice: fee + billable periodic extras − unstaffed-shift credit. */
export function contractInvoiceValues(data: IndustryData, site: DemoRecord, month: string, today: string): Values {
  const client = findRecord(data, 'clients', str(site, 'client'));
  const invoiceLines: Line[] = [
    { id: `ln_${site.id}_${month}_fee`, description: `Contract cleaning — ${str(site, 'name')} — ${monthLabel(month)}`, qty: 1, unitPrice: num(site, 'monthlyFee') },
    ...periodicExtras(data, site.id, month).map((p, i) => ({ id: `ln_${site.id}_${month}_x${i}`, description: `${periodicLabel(p)} (${p.ref}, done ${formatDate(str(p, 'lastDone'))})`, qty: 1, unitPrice: num(p, 'chargeExtra') })),
  ];
  const credit = unstaffedCredit(data, site, month);
  return {
    kind: 'contract', site: site.id, client: str(site, 'client'), billTo: str(client, 'name'), period: month, date: today,
    dueDate: addDays(today, num(client, 'termsDays') || 30), lines: invoiceLines, credit: credit.amount,
    creditNote: credit.cleanerShifts ? `${plural(credit.cleanerShifts, 'cleaner-shift')} not staffed × ${randOf(credit.rate)}` : '',
  };
}

/* ---------------- Sites & contracts ---------------- */
export function contractEnding(site: DemoRecord, today: string): number | null {
  const end = str(site, 'contractEnd');
  if (!end || site.status === 'ended') return null;
  const d = daysBetween(today, end);
  return d <= CONTRACT_WARNING_DAYS ? d : null;
}

export function siteFlags(site: DemoRecord, data: IndustryData, today: string): Flag[] {
  const out: Flag[] = [];
  const ending = contractEnding(site, today);
  if (ending !== null) out.push(ending < 0 ? { tone: 'red', label: 'Contract end date passed' } : { tone: 'amber', label: `Contract ends in ${ending} days` });
  if (site.status === 'ended') return out;
  const last = latestInspection(data, site.id);
  if (last && inspectionFailed(last, data)) out.push({ tone: 'red', label: `Below SLA (${inspectionScore(last)}% vs ${slaTarget(site)}%)` });
  if (budgetState(data, site, today.slice(0, 7)).over) out.push({ tone: 'amber', label: 'Over consumables budget' });
  return out;
}

/** Shifts for a site over the seven days ending today. */
export const weekShifts = (data: IndustryData, siteId: string, today: string) =>
  forSite(data, 'shifts', siteId).filter((s) => str(s, 'date') > addDays(today, -7) && str(s, 'date') <= today).sort((a, b) => (str(a, 'date') + str(a, 'start')).localeCompare(str(b, 'date') + str(b, 'start')));
