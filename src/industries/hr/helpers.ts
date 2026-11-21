// Human resources helpers shared by the configuration, its pages, the seed and the tests.
// Kept free of page imports so index.ts and pages/*.tsx can both use them without circular
// imports. Lists (onboarding items ticked, course attendees) are stored as comma-separated text
// because demo record values are flat. Every rule here is a DEMO rule — see data.ts.
import type { DemoRecord, DemoUser, Flag, IndustryData } from '../../core/types';
import { can, findRecord, num, records, str } from '../../core/engine';
import { addDays, daysBetween, formatDate, parseIso, toIso } from '../../core/lib/dates';
import { formatRand, toCents } from '../../core/lib/money';
import {
  ANNUAL_ACCRUAL, ANNUAL_DAYS, CERT_TYPES, CERT_WARN_DAYS, DEPARTMENTS, FAMILY_DAYS, FAMILY_MIN_MONTHS, FIXED_TERM_WARN_DAYS, HEARING_NOTICE_DAYS, JOBS, LEAVE_TYPES,
  MATERNITY_MAX_MONTHS, ONBOARDING_ITEMS, OT_WEEKLY_LIMIT, PARENTAL_MAX_DAYS, PROBATION_WARN_DAYS, SICK_CERT_AFTER, SICK_CYCLE_MONTHS, SICK_DAYS, SICK_DAYS_WORKED_PER_DAY,
  SICK_FIRST_MONTHS, SITES, STUDY_DAYS, TEAM_AWAY_SHARE, WARNING_MONTHS, WORKING_DAYS_PER_MONTH, jobOf, label, type OnboardingItem,
} from './data';

/* ---------------- "Today" indirection (tests pin the date) ---------------- */
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  return toIso(new Date());
}

/* ---------------- Small utilities ---------------- */
export const csv = (v: unknown): string[] => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
export const toCsv = (list: string[]) => [...new Set(list)].join(',');
export const plural = (n: number, w: string, many = `${w}s`) => `${fmtDays(n)} ${n === 1 ? w : many}`;
/** 12.5 → "12.5", 3 → "3". */
export const fmtDays = (n: number) => (Math.round(n * 100) / 100).toString();
/** Format a rand amount (not cents). */
export const randOf = (r: number) => formatRand(toCents(r));
export const randWhole = (r: number) => formatRand(toCents(Math.round(r))).replace(/\.00$/, '');

/* ---------------- Calendar: working days and public holidays ---------------- */
/** Months added to a date, clamped to the month's last day (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const d = parseIso(iso);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toIso(target);
}
/** Whole months from `from` to `to` (e.g. 15 Jan → 14 Mar is 1, → 15 Mar is 2). */
export function completedMonths(from: string, to: string): number {
  if (to < from) return 0;
  const a = parseIso(from); const b = parseIso(to);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (addMonths(from, m) > to) m -= 1;
  return Math.max(0, m);
}

function easterSunday(year: number): string {
  // Anonymous Gregorian algorithm.
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIso(new Date(year, month - 1, day));
}
const holidayCache = new Map<number, Map<string, string>>();
/** South African public holidays for a year (a Sunday holiday moves to the Monday). */
export function publicHolidays(year: number): Map<string, string> {
  const hit = holidayCache.get(year);
  if (hit) return hit;
  const out = new Map<string, string>();
  const fixed: Array<[string, string]> = [
    ['01-01', 'New Year’s Day'], ['03-21', 'Human Rights Day'], ['04-27', 'Freedom Day'], ['05-01', 'Workers’ Day'], ['06-16', 'Youth Day'],
    ['08-09', 'National Women’s Day'], ['09-24', 'Heritage Day'], ['12-16', 'Day of Reconciliation'], ['12-25', 'Christmas Day'], ['12-26', 'Day of Goodwill'],
  ];
  for (const [md, name] of fixed) {
    const iso = `${year}-${md}`;
    out.set(iso, name);
    if (parseIso(iso).getDay() === 0) out.set(addDays(iso, 1), `${name} (observed)`);
  }
  const easter = easterSunday(year);
  out.set(addDays(easter, -2), 'Good Friday');
  out.set(addDays(easter, 1), 'Family Day');
  holidayCache.set(year, out);
  return out;
}
export const holidayName = (iso: string) => publicHolidays(Number(iso.slice(0, 4))).get(iso);
export const isWeekend = (iso: string) => [0, 6].includes(parseIso(iso).getDay());
/** Monday–Friday and not a public holiday (the demo's working week). */
export const isWorkingDay = (iso: string) => !isWeekend(iso) && !holidayName(iso);
export function workingDaysIn(start: string, end: string): string[] {
  const out: string[] = [];
  if (!start || !end || end < start) return out;
  for (let d = start; d <= end; d = addDays(d, 1)) if (isWorkingDay(d)) out.push(d);
  return out;
}
export const workingDays = (start: string, end: string) => workingDaysIn(start, end).length;
/** The date itself if it is a working day, otherwise the next one. */
export function nextWorkingDay(iso: string): string {
  let d = iso;
  while (!isWorkingDay(d)) d = addDays(d, 1);
  return d;
}
export function prevWorkingDay(iso: string): string {
  let d = iso;
  while (!isWorkingDay(d)) d = addDays(d, -1);
  return d;
}
/** Moves `n` working days forward (n > 0) or back (n < 0) from a date. */
export function addWorkingDays(iso: string, n: number): string {
  let d = iso;
  let left = Math.abs(n);
  while (left > 0) { d = addDays(d, n > 0 ? 1 : -1); if (isWorkingDay(d)) left -= 1; }
  return d;
}
/** Monday of the week containing the date. */
export const weekStart = (iso: string) => addDays(iso, -((parseIso(iso).getDay() + 6) % 7));
export const monthStart = (period: string) => `${period}-01`;
export const monthEnd = (period: string) => addDays(addMonths(`${period}-01`, 1), -1);

/* ---------------- Employees ---------------- */
export const fullName = (r: DemoRecord | undefined) => (r ? `${str(r, 'firstName')} ${str(r, 'lastName')}`.trim() : 'Unknown');
export const emp = (data: IndustryData, id: unknown) => findRecord(data, 'employees', String(id ?? ''));
export const empName = (data: IndustryData, id: unknown) => { const e = emp(data, id); return e ? fullName(e) : '—'; };
export const jobLabel = (r: DemoRecord | undefined) => jobOf(str(r, 'job'))?.label ?? str(r, 'job');
export const deptOf = (r: DemoRecord | undefined) => jobOf(str(r, 'job'))?.dept ?? '';
export const deptLabel = (dept: string) => label(DEPARTMENTS, dept);
export const siteLabel = (site: string) => label(SITES, site);
export const siteShort = (site: string) => SITES.find((s) => s.value === site)?.short ?? site;
/** On the books today: started and not yet gone (onboarding hires have not started). */
export const CURRENT = ['probation', 'active', 'notice'];
export const isCurrent = (r: DemoRecord | undefined) => !!r && CURRENT.includes(r.status ?? '');
export const currentEmployees = (data: IndustryData) => records(data, 'employees').filter(isCurrent);
export const teamKey = (r: DemoRecord | undefined) => `${deptOf(r)}|${str(r, 'site')}`;
export const teamLabelOf = (key: string) => { const [d, s] = key.split('|'); return `${deptLabel(d)} · ${siteShort(s)}`; };
export const teamMembers = (data: IndustryData, r: DemoRecord | undefined) => currentEmployees(data).filter((e) => teamKey(e) === teamKey(r));
/** Most people away from a team on one day without a cover note: 25% of the team, rounded up. */
export const teamLimit = (size: number) => Math.max(1, Math.ceil(size * TEAM_AWAY_SHARE));
export const directReports = (data: IndustryData, id: string) => records(data, 'employees').filter((e) => str(e, 'manager') === id && e.status !== 'exited');
/** The employee record behind a simulated user (matched by name; users added in Users & permissions have none). */
export const employeeOfUser = (data: IndustryData, user: DemoUser | undefined) =>
  user ? records(data, 'employees').find((e) => fullName(e) === user.name && e.status !== 'exited') : undefined;
export const isHr = (user: DemoUser | undefined) => can(user, 'leave.hr');
export const dailyRate = (r: DemoRecord | undefined) => num(r, 'salary') / WORKING_DAYS_PER_MONTH;
export const serviceMonths = (r: DemoRecord | undefined, on: string) => completedMonths(str(r, 'startDate'), on);
export function serviceLabel(r: DemoRecord | undefined, on: string) {
  const m = serviceMonths(r, on);
  return m >= 12 ? `${Math.floor(m / 12)} yr${m >= 24 ? 's' : ''}${m % 12 ? ` ${m % 12} mo` : ''}` : `${m} month${m === 1 ? '' : 's'}`;
}

/* ---------------- Onboarding ---------------- */
export function requiredOnboarding(r: DemoRecord | undefined): OnboardingItem[] {
  const job = jobOf(str(r, 'job'));
  return ONBOARDING_ITEMS.filter((i) => !i.when || (i.when === 'ppe' && job?.ppe) || (i.when === 'driver' && job?.driver));
}
export const onboardingDone = (r: DemoRecord | undefined) => new Set(csv(str(r, 'onboarding')));
export const onboardingMissing = (r: DemoRecord | undefined) => { const done = onboardingDone(r); return requiredOnboarding(r).filter((i) => !done.has(i.key)); };
export function startProblem(r: DemoRecord, today: string): string | null {
  const missing = onboardingMissing(r);
  if (missing.length) return `Complete the onboarding checklist first — ${missing.length} required item${missing.length === 1 ? '' : 's'} still open: ${missing.map((i) => i.label.split(' (')[0]).join('; ')}. Tick them under “Onboarding checklist” on this page.`;
  if (str(r, 'startDate') > today) return `The start date is ${formatDate(str(r, 'startDate'))} — employment can only start on or after it.`;
  return null;
}

/* ---------------- Probation, fixed-term and exit ---------------- */
export function probationProblem(r: DemoRecord): string | null {
  const outcome = str(r, 'probationOutcome');
  if (!outcome || !str(r, 'probationReviewDate')) return 'Record the probation review first — the outcome and the review date, under “Probation review” on this page.';
  if (outcome === 'extended') return `Probation was extended to ${formatDate(str(r, 'probationEnd'))}. Record a new review outcome when the extension ends.`;
  if (outcome === 'notconfirmed') return 'The review outcome is “Not confirmed” — use “Give notice” with the reason “Not confirmed after probation” instead.';
  return null;
}
export function noticeProblem(r: DemoRecord, today: string): string | null {
  if (!str(r, 'exitReason')) return 'Choose the reason for leaving first, under “Leaving” on this page.';
  if (!str(r, 'lastDay')) return 'Set the last working day first, under “Leaving” on this page.';
  if (str(r, 'lastDay') < addDays(today, -31)) return 'The last working day is more than a month ago — check the date.';
  return null;
}
export function exitProblem(r: DemoRecord, today: string): string | null {
  const reason = noticeProblem(r, '0000-01-01');
  if (reason) return reason;
  if (str(r, 'lastDay') > today) return `The last working day is ${formatDate(str(r, 'lastDay'))} — the exit can only be completed on or after it.`;
  const open = [!r.values.exitEquipment && 'equipment returned', !r.values.exitAccess && 'access removed'].filter(Boolean);
  if (open.length) return `Complete the exit checklist first: ${open.join(' and ')} (under “Leaving” on this page).`;
  return null;
}
export const probationDaysLeft = (r: DemoRecord, today: string) => (r.status === 'probation' && str(r, 'probationEnd') ? daysBetween(today, str(r, 'probationEnd')) : null);
export const fixedTermDaysLeft = (r: DemoRecord, today: string) =>
  (str(r, 'employmentType') === 'fixed' && str(r, 'fixedTermEnd') && isCurrent(r) ? daysBetween(today, str(r, 'fixedTermEnd')) : null);

export function employeeFlags(r: DemoRecord, data: IndustryData, today: string): Flag[] {
  const out: Flag[] = [];
  if (r.status === 'onboarding') {
    const missing = onboardingMissing(r).length;
    if (missing) out.push({ tone: 'amber', label: `${missing} onboarding item${missing === 1 ? '' : 's'} open` });
  }
  const p = probationDaysLeft(r, today);
  if (p !== null && p < 0) out.push({ tone: 'red', label: 'Probation review overdue' });
  else if (p !== null && p <= PROBATION_WARN_DAYS) out.push({ tone: 'amber', label: `Probation ends in ${p} day${p === 1 ? '' : 's'}` });
  const f = fixedTermDaysLeft(r, today);
  if (f !== null && f < 0) out.push({ tone: 'red', label: 'Fixed-term contract has ended' });
  else if (f !== null && f <= FIXED_TERM_WARN_DAYS) out.push({ tone: 'amber', label: `Contract ends in ${f} day${f === 1 ? '' : 's'}` });
  if (r.status !== 'exited') {
    const certs = employeeCerts(data, r.id).map((c) => certState(c, data, today));
    if (certs.includes('expired')) out.push({ tone: 'red', label: 'Certificate expired' });
    else if (certs.includes('expiring')) out.push({ tone: 'amber', label: 'Certificate expiring' });
    const w = activeWarnings(data, r.id, today);
    if (w.length) out.push({ tone: 'dark', label: `${label(SANCTION_LABELS, strongestWarning(w))} on file` });
  }
  if (r.status === 'notice' && str(r, 'lastDay')) out.push({ tone: 'dark', label: `Last day ${formatDate(str(r, 'lastDay'))}` });
  return out;
}

/* ---------------- Leave: days, balances and rules ---------------- */
export const leaveLabel = (type: string) => label(LEAVE_TYPES, type);
export const leaveShort = (type: string) => LEAVE_TYPES.find((t) => t.value === type)?.short ?? type;
export const leaveColour = (type: string) => LEAVE_TYPES.find((t) => t.value === type)?.colour ?? 'annual';
/** Working days a leave request covers (weekends and public holidays are not counted). */
export const leaveDays = (r: DemoRecord | undefined) => workingDays(str(r, 'start'), str(r, 'end'));
/** Approved or taken: leave that counts against a balance and shows on the calendar. */
export const BOOKED = ['approved', 'taken'];
export const isBooked = (r: DemoRecord) => BOOKED.includes(r.status ?? '');
export const leaveOf = (data: IndustryData, empId: string) => records(data, 'leave').filter((l) => str(l, 'employee') === empId);
export const covers = (r: DemoRecord, day: string) => str(r, 'start') <= day && str(r, 'end') >= day;
/** Working days of a leave record that fall between two dates (inclusive). */
export const daysWithin = (r: DemoRecord, from: string, to: string) => {
  const s = str(r, 'start') > from ? str(r, 'start') : from;
  const e = str(r, 'end') < to ? str(r, 'end') : to;
  return workingDays(s, e);
};
/** Booked leave covering a day (optionally limited to some employees). */
export const awayOn = (data: IndustryData, day: string, filter?: (l: DemoRecord) => boolean) =>
  records(data, 'leave').filter((l) => isBooked(l) && covers(l, day) && (!filter || filter(l)));

export type Balance = { type: string; label: string; entitlement: number; used: number; available: number; basis: string; eligible: boolean };

const yearOf = (today: string) => ({ from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` });
function usedBetween(data: IndustryData, empId: string, type: string, from: string, to: string, exclude?: string) {
  return leaveOf(data, empId).filter((l) => l.id !== exclude && str(l, 'type') === type && isBooked(l)).reduce((n, l) => n + daysWithin(l, from, to), 0);
}
/** The sick-leave cycle containing a day: 36-month windows from the start date. */
export function sickCycle(r: DemoRecord | undefined, today: string) {
  const start = str(r, 'startDate') || today;
  const n = Math.floor(completedMonths(start, today) / SICK_CYCLE_MONTHS);
  const from = addMonths(start, n * SICK_CYCLE_MONTHS);
  return { from, to: addDays(addMonths(from, SICK_CYCLE_MONTHS), -1) };
}

/** Annual: 1.25 days per completed month this leave year (Jan–Dec) plus days carried over. */
export function annualBalance(data: IndustryData, r: DemoRecord, today: string, exclude?: string): Balance {
  const y = yearOf(today);
  const from = str(r, 'startDate') > y.from ? str(r, 'startDate') : y.from;
  const accrued = Math.min(ANNUAL_DAYS, completedMonths(from, today) * ANNUAL_ACCRUAL);
  const carry = num(r, 'annualCarry');
  const used = usedBetween(data, r.id, 'annual', y.from, y.to, exclude);
  return { type: 'annual', label: 'Annual leave', entitlement: carry + accrued, used, available: carry + accrued - used, eligible: true,
    basis: `${fmtDays(accrued)} earned this year (1.25 a month)${carry ? ` + ${fmtDays(carry)} carried over` : ''}` };
}
/** Sick: 30 days per 36-month cycle; in the first six months, one day per 26 days worked. */
export function sickBalance(data: IndustryData, r: DemoRecord, today: string, exclude?: string): Balance {
  const c = sickCycle(r, today);
  const start = str(r, 'startDate') || today;
  const early = completedMonths(start, today) < SICK_FIRST_MONTHS;
  const entitlement = early ? Math.floor(workingDays(start, today) / SICK_DAYS_WORKED_PER_DAY) : SICK_DAYS;
  const used = usedBetween(data, r.id, 'sick', c.from, c.to, exclude);
  return { type: 'sick', label: 'Sick leave', entitlement, used, available: entitlement - used, eligible: true,
    basis: early ? 'first six months: 1 day per 26 days worked' : `cycle ${formatDate(c.from)} – ${formatDate(c.to)}` };
}
export function familyBalance(data: IndustryData, r: DemoRecord, today: string, exclude?: string): Balance {
  const y = yearOf(today);
  const eligible = serviceMonths(r, today) >= FAMILY_MIN_MONTHS;
  const used = usedBetween(data, r.id, 'family', y.from, y.to, exclude);
  const entitlement = eligible ? FAMILY_DAYS : 0;
  return { type: 'family', label: 'Family responsibility', entitlement, used, available: entitlement - used, eligible,
    basis: eligible ? '3 days a year' : `after ${FAMILY_MIN_MONTHS} months’ service` };
}
export function studyBalance(data: IndustryData, r: DemoRecord, today: string, exclude?: string): Balance {
  const y = yearOf(today);
  const used = usedBetween(data, r.id, 'study', y.from, y.to, exclude);
  return { type: 'study', label: 'Study leave', entitlement: STUDY_DAYS, used, available: STUDY_DAYS - used, eligible: true, basis: '5 days a year (company policy)' };
}
export function balances(data: IndustryData, r: DemoRecord, today: string, exclude?: string): Balance[] {
  return [annualBalance(data, r, today, exclude), sickBalance(data, r, today, exclude), familyBalance(data, r, today, exclude), studyBalance(data, r, today, exclude)];
}
export function balanceFor(data: IndustryData, r: DemoRecord, type: string, today: string, exclude?: string): Balance | null {
  return balances(data, r, today, exclude).find((b) => b.type === type) ?? null;
}

/** The dates and type of a leave request, checked before it is requested and again before approval. */
export type LeaveAsk = { id?: string; employee: string; type: string; start: string; end: string };
export function leaveRequestProblem(data: IndustryData, ask: LeaveAsk, today: string): string | null {
  const e = emp(data, ask.employee);
  if (!e) return 'Choose the employee.';
  if (!ask.type) return 'Choose the type of leave.';
  if (!ask.start || !ask.end) return 'Choose the first and last day of leave.';
  if (ask.end < ask.start) return 'The last day is before the first day.';
  const days = workingDays(ask.start, ask.end);
  if (!days) return 'There are no working days in these dates — weekends and public holidays are not counted.';
  const clash = leaveOf(data, e.id).find((l) => l.id !== ask.id && ['requested', ...BOOKED].includes(l.status ?? '') && str(l, 'start') <= ask.end && str(l, 'end') >= ask.start);
  if (clash) return `${fullName(e)} already has ${leaveLabel(str(clash, 'type')).toLowerCase()} from ${formatDate(str(clash, 'start'))} to ${formatDate(str(clash, 'end'))} (${clash.ref}).`;
  if (ask.type === 'parental' && daysBetween(ask.start, ask.end) + 1 > PARENTAL_MAX_DAYS) return `Parental leave is up to ${PARENTAL_MAX_DAYS} consecutive days.`;
  if (ask.type === 'maternity' && ask.end >= addMonths(ask.start, MATERNITY_MAX_MONTHS)) return `Maternity leave is up to ${MATERNITY_MAX_MONTHS} consecutive months.`;
  const b = balanceFor(data, e, ask.type, today, ask.id);
  if (b && !b.eligible) return `${b.label} is available ${b.basis} — ${fullName(e)} has ${serviceLabel(e, today)}. Request unpaid leave instead.`;
  if (b && days > b.available) {
    const avail = Math.max(0, b.available);
    return `Only ${plural(avail, 'day')} of ${b.label.toLowerCase()} available — this request is ${plural(days, 'working day')}. Shorten it${avail ? ` to ${fmtDays(Math.floor(avail))} day${Math.floor(avail) === 1 ? '' : 's'}` : ''}, or request the extra ${fmtDays(Math.ceil(days - avail))} day${Math.ceil(days - avail) === 1 ? '' : 's'} as unpaid leave.`;
  }
  return null;
}
export const needsMedicalCert = (r: DemoRecord) => str(r, 'type') === 'sick' && leaveDays(r) > SICK_CERT_AFTER;
export function medicalCertProblem(r: DemoRecord): string | null {
  return needsMedicalCert(r) && !r.values.medicalCert
    ? `Sick leave of more than ${SICK_CERT_AFTER} consecutive days needs a medical certificate — tick “Medical certificate received” on this request first.`
    : null;
}
/** Nobody approves their own leave; only HR or the employee's own manager may decide. */
export function approverProblem(data: IndustryData, user: DemoUser, r: DemoRecord): string | null {
  const e = emp(data, str(r, 'employee'));
  const me = employeeOfUser(data, user);
  const mgr = emp(data, str(e, 'manager'));
  if (me && e && me.id === e.id) return `Nobody approves their own leave — this goes to ${mgr ? `${fullName(mgr)} (your manager)` : 'your manager'} or HR.`;
  if (isHr(user)) return null;
  if (!me || str(e, 'manager') !== me.id) return `Only HR or ${fullName(e)}’s own manager${mgr ? ` (${fullName(mgr)})` : ''} can decide on this request.`;
  return null;
}
export type Clash = { day: string; away: DemoRecord[]; size: number; limit: number; team: string };
/** The first working day on which approving this leave would put the team over its limit. */
export function teamClash(data: IndustryData, r: DemoRecord): Clash | null {
  const e = emp(data, str(r, 'employee'));
  if (!e) return null;
  const team = teamMembers(data, e);
  const ids = new Set(team.map((t) => t.id).filter((id) => id !== e.id));
  const size = Math.max(team.length, 1);
  const limit = teamLimit(size);
  for (const day of workingDaysIn(str(r, 'start'), str(r, 'end'))) {
    const away = awayOn(data, day, (l) => l.id !== r.id && ids.has(str(l, 'employee')));
    if (away.length + 1 > limit) return { day, away, size, limit, team: teamLabelOf(teamKey(e)) };
  }
  return null;
}
export function clashText(c: Clash) {
  return `${c.away.length} of ${c.size} in ${c.team} are already away on ${formatDate(c.day)} — the team limit is ${c.limit}.`;
}
/** Every rule checked when leave is approved, in the order a user would fix them. */
export function approveProblem(data: IndustryData, user: DemoUser, r: DemoRecord, today: string, note?: string): string | null {
  return approverProblem(data, user, r)
    ?? leaveRequestProblem(data, { id: r.id, employee: str(r, 'employee'), type: str(r, 'type'), start: str(r, 'start'), end: str(r, 'end') }, today)
    ?? medicalCertProblem(r)
    ?? (() => {
      const c = teamClash(data, r);
      if (!c || note?.trim()) return null;
      return `Team cover: ${clashText(c)} Approve with a cover note (under “Team cover” on this page) saying how the work is covered, or decline.`;
    })();
}
export function cancelProblem(data: IndustryData, user: DemoUser, r: DemoRecord, today: string): string | null {
  const me = employeeOfUser(data, user);
  if (!isHr(user) && me?.id !== str(r, 'employee')) return 'Only the employee or HR can cancel a leave request.';
  if (r.status === 'approved' && str(r, 'start') <= today) return 'This leave has already started — HR can mark it as taken instead.';
  return null;
}
export function leaveFlags(r: DemoRecord, data: IndustryData, today: string): Flag[] {
  const out: Flag[] = [];
  if (r.status === 'requested' || r.status === 'approved') {
    if (needsMedicalCert(r) && !r.values.medicalCert) out.push({ tone: 'red', label: 'Medical certificate needed' });
  }
  if (r.status === 'requested') {
    const c = teamClash(data, r);
    if (c) out.push({ tone: 'amber', label: 'Team cover clash' });
    const problem = leaveRequestProblem(data, { id: r.id, employee: str(r, 'employee'), type: str(r, 'type'), start: str(r, 'start'), end: str(r, 'end') }, today);
    if (problem?.startsWith('Only ')) out.push({ tone: 'red', label: 'Beyond balance' });
    if (str(r, 'requestedOn') && daysBetween(str(r, 'requestedOn'), today) > 3) out.push({ tone: 'amber', label: `Waiting ${daysBetween(str(r, 'requestedOn'), today)} days` });
  }
  if (isBooked(r) && covers(r, today)) out.push({ tone: 'blue', label: 'Away today' });
  return out;
}

/* ---------------- Certificates & training ---------------- */
export const certLabel = (type: string) => label(CERT_TYPES, type);
export const employeeCerts = (data: IndustryData, empId: string) => records(data, 'certificates').filter((c) => str(c, 'employee') === empId);
export type CertState = 'valid' | 'expiring' | 'expired' | 'superseded';
/** A certificate is superseded when the same person holds a later one of the same type. */
export function certState(c: DemoRecord, data: IndustryData, today: string): CertState {
  const newer = employeeCerts(data, str(c, 'employee')).some((o) => o.id !== c.id && str(o, 'type') === str(c, 'type') && str(o, 'expires') > str(c, 'expires'));
  if (newer) return 'superseded';
  const left = daysBetween(today, str(c, 'expires'));
  return left < 0 ? 'expired' : left <= CERT_WARN_DAYS ? 'expiring' : 'valid';
}
export function certFlags(c: DemoRecord, data: IndustryData, today: string): Flag[] {
  const s = certState(c, data, today);
  const left = daysBetween(today, str(c, 'expires'));
  if (s === 'expired') return [{ tone: 'red', label: `Expired ${-left} day${left === -1 ? '' : 's'} ago` }];
  if (s === 'expiring') return [{ tone: 'amber', label: `Expires in ${left} day${left === 1 ? '' : 's'}` }];
  if (s === 'superseded') return [{ tone: 'dark', label: 'Renewed' }];
  return [];
}
/** Current drivers whose latest PrDP has expired (or who have none on file). */
export function driversWithoutPrdp(data: IndustryData, today: string) {
  return currentEmployees(data).filter((e) => jobOf(str(e, 'job'))?.driver).filter((e) => {
    const prdp = employeeCerts(data, e.id).filter((c) => str(c, 'type') === 'prdp' && certState(c, data, today) !== 'superseded');
    return !prdp.length || prdp.every((c) => certState(c, data, today) === 'expired');
  });
}
export const attendees = (course: DemoRecord | undefined) => csv(str(course, 'attendees'));
export const attended = (course: DemoRecord | undefined) => csv(str(course, 'attended'));
export function courseCompleteProblem(c: DemoRecord, today: string): string | null {
  if (str(c, 'date') > today) return `The course is on ${formatDate(str(c, 'date'))} — it can only be completed on or after that day.`;
  if (!attendees(c).length) return 'Add the people booked on the course first.';
  if (!attended(c).length) return 'Mark who attended first (“Attended” next to each name under “Attendance”).';
  return null;
}

/* ---------------- Payroll inputs ---------------- */
export const periodOf = (iso: string) => iso.slice(0, 7);
export const inputsFor = (data: IndustryData, period: string) => records(data, 'inputs').filter((i) => str(i, 'period') === period);
export type OtWeek = { employee: string; weekOf: string; hours: number; lines: DemoRecord[]; approved: boolean };
/** Overtime per employee per week, with whether a manager approval is recorded on every line. */
export function overtimeWeeks(data: IndustryData, period: string): OtWeek[] {
  const map = new Map<string, OtWeek>();
  for (const i of inputsFor(data, period).filter((x) => str(x, 'kind') === 'overtime')) {
    const k = `${str(i, 'employee')}|${str(i, 'weekOf')}`;
    const w = map.get(k) ?? { employee: str(i, 'employee'), weekOf: str(i, 'weekOf'), hours: 0, lines: [], approved: true };
    w.hours += num(i, 'hours'); w.lines.push(i); w.approved = w.approved && !!str(i, 'approvedBy');
    map.set(k, w);
  }
  return [...map.values()].sort((a, b) => a.weekOf.localeCompare(b.weekOf) || b.hours - a.hours);
}
export const overLimit = (w: OtWeek) => w.hours > OT_WEEKLY_LIMIT && !w.approved;
/** Approved or taken unpaid leave, in working days that fall inside the pay period, per employee. */
export function unpaidDays(data: IndustryData, period: string) {
  const from = monthStart(period), to = monthEnd(period);
  const out = new Map<string, { days: number; refs: string[] }>();
  for (const l of records(data, 'leave').filter((x) => str(x, 'type') === 'unpaid' && isBooked(x))) {
    const d = daysWithin(l, from, to);
    if (!d) continue;
    const cur = out.get(str(l, 'employee')) ?? { days: 0, refs: [] };
    cur.days += d; cur.refs.push(l.ref);
    out.set(str(l, 'employee'), cur);
  }
  return out;
}
export const startersIn = (data: IndustryData, period: string) => records(data, 'employees').filter((e) => periodOf(str(e, 'startDate')) === period && e.status !== 'exited');
export const leaversIn = (data: IndustryData, period: string) => records(data, 'employees').filter((e) => ['notice', 'exited'].includes(e.status ?? '') && periodOf(str(e, 'lastDay')) === period);

export type PackIssue = { key: string; text: string; module: string; id: string; fix?: 'overtime' | 'banking' | 'taxno'; week?: OtWeek };
/** Everything that must be resolved before a pay period's inputs can be approved. */
export function packIssues(data: IndustryData, period: string): PackIssue[] {
  const out: PackIssue[] = [];
  for (const w of overtimeWeeks(data, period).filter(overLimit)) {
    out.push({ key: `ot-${w.employee}-${w.weekOf}`, text: `${empName(data, w.employee)}: ${fmtDays(w.hours)} h overtime in the week of ${formatDate(w.weekOf)} — above ${OT_WEEKLY_LIMIT} h, so a manager approval must be recorded.`, module: 'employees', id: w.employee, fix: 'overtime', week: w });
  }
  const from = monthStart(period), to = monthEnd(period);
  for (const l of records(data, 'leave').filter((x) => str(x, 'type') === 'unpaid' && x.status === 'requested' && str(x, 'start') <= to && str(x, 'end') >= from)) {
    out.push({ key: `lv-${l.id}`, text: `${empName(data, l.values.employee)}: unpaid leave ${l.ref} (${formatDate(str(l, 'start'))}) is still waiting for a decision — it changes this month’s pay.`, module: 'leave', id: l.id });
  }
  for (const e of startersIn(data, period)) {
    const done = onboardingDone(e);
    if (!done.has('banking')) out.push({ key: `bank-${e.id}`, text: `${fullName(e)} starts ${formatDate(str(e, 'startDate'))}: banking details not captured.`, module: 'onboarding', id: e.id, fix: 'banking' });
    if (!done.has('taxno')) out.push({ key: `tax-${e.id}`, text: `${fullName(e)} starts ${formatDate(str(e, 'startDate'))}: tax number not captured.`, module: 'onboarding', id: e.id, fix: 'taxno' });
  }
  return out;
}

export type PackRow = { ref: string; name: string; department: string; site: string; item: string; quantity: string; amount: number; note: string };
/** The pack as rows: starters, leavers, overtime, unpaid leave, allowances and deductions. No pay is calculated. */
export function packRows(data: IndustryData, period: string): PackRow[] {
  const row = (e: DemoRecord | undefined, item: string, quantity: string, amount: number, note: string): PackRow =>
    ({ ref: e?.ref ?? '', name: fullName(e), department: deptLabel(deptOf(e)), site: siteShort(str(e, 'site')), item, quantity, amount, note });
  const out: PackRow[] = [];
  for (const e of startersIn(data, period)) out.push(row(e, 'Starter', '', 0, `Starts ${str(e, 'startDate')} · ${jobLabel(e)}`));
  for (const e of leaversIn(data, period)) out.push(row(e, 'Leaver', '', 0, `Last day ${str(e, 'lastDay')} · ${label(EXIT_REASON_LABELS, str(e, 'exitReason'))}`));
  for (const w of overtimeWeeks(data, period)) out.push(row(emp(data, w.employee), 'Overtime hours', fmtDays(w.hours), 0, `Week of ${w.weekOf}${w.hours > OT_WEEKLY_LIMIT ? ` · approved by ${str(w.lines[0], 'approvedBy') || '—'}` : ''}`));
  for (const [id, u] of unpaidDays(data, period)) out.push(row(emp(data, id), 'Unpaid leave days', fmtDays(u.days), 0, u.refs.join(' ')));
  for (const i of inputsFor(data, period).filter((x) => str(x, 'kind') !== 'overtime')) {
    out.push(row(emp(data, str(i, 'employee')), str(i, 'kind') === 'allowance' ? 'Allowance' : 'Deduction', '', num(i, 'amount'), str(i, 'description')));
  }
  return out;
}
const csvCell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function packCsv(rows: PackRow[], period: string, businessName: string) {
  const head = ['Employee no', 'Name', 'Department', 'Site', 'Input', 'Quantity', 'Amount (R)', 'Note'];
  const lines = rows.map((r) => [r.ref, r.name, r.department, r.site, r.item, r.quantity, r.amount ? r.amount.toFixed(2) : '', r.note].map(csvCell).join(','));
  return [`# ${businessName} payroll inputs ${period} — DEMONSTRATION DATA, fictional people, no pay calculated`, head.join(','), ...lines].join('\n');
}
export const packSnapshot = (rows: PackRow[]) => JSON.stringify(rows);
export const readSnapshot = (r: DemoRecord | undefined): PackRow[] | null => {
  const s = str(r, 'snapshot');
  if (!s) return null;
  try { return JSON.parse(s) as PackRow[]; } catch { return null; }
};
export const LOCKED_PACK = ['approved', 'sent'];
export const packFor = (data: IndustryData, period: string) => records(data, 'payruns').find((p) => str(p, 'period') === period);
export const periodLocked = (data: IndustryData, period: string) => LOCKED_PACK.includes(packFor(data, period)?.status ?? '');
export function approvePackProblem(data: IndustryData, r: DemoRecord, user: DemoUser): string | null {
  const issues = packIssues(data, str(r, 'period'));
  if (issues.length) return `${issues.length} item${issues.length === 1 ? ' is' : 's are'} unresolved — fix ${issues.length === 1 ? 'it' : 'them'} under “Must be resolved before approval” first. ${issues[0].text}`;
  if (str(r, 'checkedBy') && str(r, 'checkedBy') === user.name) return `${user.name} checked this pack — a second person must approve it.`;
  return null;
}

/* ---------------- Hiring ---------------- */
export function offerProblem(r: DemoRecord, data: IndustryData): string | null {
  const req = findRecord(data, 'requisitions', str(r, 'requisition'));
  if (req?.status !== 'open') return 'The requisition is not open — it must be approved (and not yet filled) before an offer is made.';
  if (!num(r, 'offerSalary')) return 'Record the offered monthly salary first, under “Offer” on this page.';
  if (!str(r, 'startDate')) return 'Record the proposed start date first, under “Offer” on this page.';
  return null;
}
export function hireProblem(r: DemoRecord, data: IndustryData): string | null {
  const req = findRecord(data, 'requisitions', str(r, 'requisition'));
  if (!req || req.status !== 'open') return `The requisition ${req ? req.ref : ''} is not open — it may already be filled.`;
  if (!r.values.offerAccepted) return 'Record that the candidate accepted the offer first (“Offer accepted” under “Offer” on this page).';
  return null;
}
export function openReqProblem(r: DemoRecord, user: DemoUser): string | null {
  if (!str(r, 'job') || !str(r, 'site')) return 'Choose the job and the site first.';
  if (!r.values.budgeted && !can(user, 'hiring.unbudgeted')) return 'This position is not in the budget — only the managing director can approve an unbudgeted requisition.';
  return null;
}

/* ---------------- Performance ---------------- */
export const rating = (r: DemoRecord | undefined, key = 'managerRating') => num(r, key);
export const finalRating = (r: DemoRecord) => num(r, 'moderatedRating') || num(r, 'managerRating');
export function pipProblem(r: DemoRecord, value: number, today: string): string | null {
  if (!value || value > 2) return null;
  if (!str(r, 'pipActions').trim()) return `A rating of ${value} needs an improvement plan — write the actions under “Improvement plan” on this page.`;
  if (!str(r, 'pipReview') || str(r, 'pipReview') <= today) return 'The improvement plan needs a review date in the future.';
  return null;
}
export function managerReviewerProblem(data: IndustryData, user: DemoUser, r: DemoRecord): string | null {
  if (can(user, 'reviews.moderate') || isHr(user)) return null;
  const me = employeeOfUser(data, user);
  const e = emp(data, str(r, 'employee'));
  if (me?.id === e?.id) return 'You cannot complete the manager review of your own performance.';
  if (!me || str(e, 'manager') !== me.id) return `Only ${fullName(e)}’s own manager or HR can complete the manager review.`;
  return null;
}

/* ---------------- Discipline & grievances ---------------- */
export const SANCTION_LABELS = [
  { value: 'counselling', label: 'Counselling' }, { value: 'verbal', label: 'Verbal warning' }, { value: 'written', label: 'Written warning' },
  { value: 'final', label: 'Final written warning' }, { value: 'dismissal', label: 'Dismissal' },
];
const EXIT_REASON_LABELS = [
  { value: 'resignation', label: 'Resignation' }, { value: 'dismissal', label: 'Dismissal' }, { value: 'contract', label: 'Fixed-term ended' }, { value: 'probation', label: 'Not confirmed' },
  { value: 'retrenchment', label: 'Retrenchment' }, { value: 'retirement', label: 'Retirement' }, { value: 'mutual', label: 'Mutual separation' },
];
/** Working days strictly between the day notice is given and the hearing day. */
export const noticeWorkingDays = (notice: string, hearing: string) => (notice && hearing && hearing > notice ? workingDays(addDays(notice, 1), addDays(hearing, -1)) : 0);
export function hearingProblem(r: DemoRecord): string | null {
  if (str(r, 'kind') !== 'disciplinary') return 'Grievances are heard in a grievance meeting — record the outcome directly.';
  if (!str(r, 'hearingDate') || !str(r, 'noticeGiven')) return 'Set the hearing date and the date notice was given first, under “Hearing” on this page.';
  if (str(r, 'hearingDate') <= str(r, 'noticeGiven')) return 'The hearing must be after the day notice is given.';
  const n = noticeWorkingDays(str(r, 'noticeGiven'), str(r, 'hearingDate'));
  if (n < HEARING_NOTICE_DAYS) return `Only ${n} working day${n === 1 ? '' : 's'} between the notice and the hearing — this demo requires at least ${HEARING_NOTICE_DAYS} so the employee can prepare (demo rule in the style of the LRA Code of Good Practice).`;
  return null;
}
export function outcomeProblem(r: DemoRecord, today: string): string | null {
  const kind = str(r, 'kind');
  if (kind === 'disciplinary' && r.status !== 'hearing') return 'A disciplinary outcome needs a hearing first.';
  if (kind === 'disciplinary' && str(r, 'hearingDate') > today) return `The hearing is on ${formatDate(str(r, 'hearingDate'))} — record the outcome after it has been held.`;
  if (!str(r, 'chairperson').trim()) return `Record the ${kind === 'disciplinary' ? 'chairperson' : 'person who chaired the grievance meeting'} first, under “Outcome” on this page.`;
  if (kind === 'disciplinary' && str(r, 'chairperson').trim() === str(r, 'investigator').trim()) return 'The chairperson must not be the investigator — choose an impartial chairperson.';
  if (!str(r, 'finding')) return 'Record the finding first, under “Outcome” on this page.';
  const f = str(r, 'finding');
  if (kind === 'disciplinary' && !['guilty', 'notguilty'].includes(f)) return 'A disciplinary finding is “Guilty” or “Not guilty”.';
  if (kind === 'grievance' && !['upheld', 'partly', 'notupheld'].includes(f)) return 'A grievance finding is upheld, partly upheld or not upheld.';
  if (f === 'guilty' && !str(r, 'sanction')) return 'Choose the sanction for a guilty finding.';
  return null;
}
export const warningExpiry = (level: string, issued: string) => addMonths(issued, WARNING_MONTHS[level] ?? 6);
export const activeWarnings = (data: IndustryData, empId: string, today: string) =>
  records(data, 'warnings').filter((w) => str(w, 'employee') === empId && str(w, 'expires') >= today);
const LEVEL = ['verbal', 'written', 'final'];
export const strongestWarning = (list: DemoRecord[]) => list.map((w) => str(w, 'level')).sort((a, b) => LEVEL.indexOf(b) - LEVEL.indexOf(a))[0] ?? '';
export const openCases = (data: IndustryData) => records(data, 'cases').filter((c) => c.status !== 'closed');

/* ---------------- Reports ---------------- */
/** On the books on a date: started on or before it and not left before it. */
export function employedOn(r: DemoRecord, day: string) {
  if (r.status === 'onboarding') return false;
  if (str(r, 'startDate') > day) return false;
  if (r.status === 'exited' && str(r, 'lastDay') < day) return false;
  return true;
}
export const headcountOn = (data: IndustryData, day: string) => records(data, 'employees').filter((e) => employedOn(e, day)).length;
export function turnover(data: IndustryData, today: string) {
  const from = addMonths(today, -12);
  const leavers = records(data, 'employees').filter((e) => e.status === 'exited' && str(e, 'lastDay') > from && str(e, 'lastDay') <= today);
  const avg = (headcountOn(data, from) + headcountOn(data, today)) / 2;
  return { leavers, avg, pct: avg ? Math.round((leavers.length / avg) * 1000) / 10 : 0 };
}
/** Bradford factor over the last 52 weeks: spells² × days (sick leave only). */
export function bradford(data: IndustryData, empId: string, today: string) {
  const from = addDays(today, -364);
  const spells = leaveOf(data, empId).filter((l) => str(l, 'type') === 'sick' && isBooked(l) && str(l, 'end') >= from && str(l, 'start') <= today);
  const days = spells.reduce((n, l) => n + daysWithin(l, from, today), 0);
  return { spells: spells.length, days, score: spells.length * spells.length * days };
}
/** Annual leave owed in rand: each current employee's positive balance × daily rate (salary ÷ 21.67). */
export function leaveLiability(data: IndustryData, today: string) {
  const rows = currentEmployees(data).map((e) => {
    const b = annualBalance(data, e, today);
    const days = Math.max(0, b.available);
    return { e, days, value: days * dailyRate(e) };
  });
  return { rows, days: rows.reduce((n, r) => n + r.days, 0), value: rows.reduce((n, r) => n + r.value, 0) };
}
export { JOBS };
