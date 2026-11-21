// Recruitment helpers shared by the configuration, its pages and tests. Kept apart
// from index.ts so pages can import them without a cycle. Every rule here is pure:
// money is stored in rand on records and computed in integer cents.
import type { DemoRecord, DemoUser, Flag, IndustryData } from '../../core/types';
import { findRecord, linesTotals, lines, num, records, str } from '../../core/engine';
import { addDays, daysBetween, formatDate, parseIso, toIso } from '../../core/lib/dates';
import { formatRand, formatRandWhole, roundCents, toCents } from '../../core/lib/money';
import {
  CONSENT_WARNING_DAYS, ILLUSTRATIVE_EARNINGS_THRESHOLD, NOTICE_DAYS, OWNERSHIP_MONTHS, S198A_MONTHS, S198A_WARNING_DAYS, STAGE_PROBABILITY, STALE_JOB_DAYS,
  STANDARD_WEEK_HOURS, VAT_RATE, WEEKLY_HOURS_CAP,
} from './data';

/* ---------------- Today (pinnable for tests) ---------------- */
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  return toIso(new Date());
}

/* ---------------- Formatting ---------------- */
/** Whole-rand display of cents. */
export const rand = (cents: number) => formatRandWhole(cents);
/** Rand-and-cents display of cents (invoices). */
export const randc = (cents: number) => formatRand(cents);
/** Whole-rand display of a rand amount stored on a record. */
export const randOf = (amount: number) => formatRandWhole(toCents(amount));
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
export const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('') || '?';

/* ---------------- Dates ---------------- */
/** Same day `n` months later (clamped to the month's last day). */
export function addMonths(iso: string, n: number): string {
  const d = parseIso(iso);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toIso(target);
}
/** Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  const dow = (parseIso(iso).getDay() + 6) % 7; // 0 = Monday
  return addDays(iso, -dow);
}
export const isMonday = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && parseIso(iso).getDay() === 1;
/** The weekday `n` working days after `iso` (n may be 0: the same day if it is a weekday, else the next Monday). */
export function workday(iso: string, n: number): string {
  let d = iso;
  const isWeekend = (x: string) => [0, 6].includes(parseIso(x).getDay());
  while (isWeekend(d)) d = addDays(d, 1);
  let left = n;
  while (left > 0) { d = addDays(d, 1); if (!isWeekend(d)) left--; }
  return d;
}
export function quarterRange(today: string): { from: string; to: string; label: string } {
  const [y, m] = today.split('-').map(Number);
  const q = Math.floor((m - 1) / 3);
  const from = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
  const to = addDays(addMonths(from, 3), -1);
  return { from, to, label: `Q${q + 1} ${y}` };
}
export const monthRange = (today: string) => {
  const from = `${today.slice(0, 7)}-01`;
  return { from, to: addDays(addMonths(from, 1), -1) };
};
export const daysSince = (iso: string, today: string) => Math.max(0, daysBetween(iso.slice(0, 10), today));
const minutes = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/* ---------------- Lookups ---------------- */
export const consultantOf = (data: IndustryData, id: unknown) => findRecord(data, 'consultants', String(id ?? ''));
export const consultantName = (data: IndustryData, id: unknown) => str(consultantOf(data, id), 'name') || 'Unassigned';
export const consultantForUser = (data: IndustryData, userId: string) => records(data, 'consultants').find((c) => str(c, 'userId') === userId);
export const clientOf = (data: IndustryData, id: unknown) => findRecord(data, 'clients', String(id ?? ''));
export const clientName = (data: IndustryData, id: unknown) => str(clientOf(data, id), 'name') || 'Unknown client';
export const jobOf = (data: IndustryData, id: unknown) => findRecord(data, 'jobs', String(id ?? ''));
export const jobTitle = (data: IndustryData, id: unknown) => {
  const j = jobOf(data, id);
  return j ? `${str(j, 'title')} · ${clientName(data, j.values.client)}` : 'Unknown job';
};
export const candidateOf = (data: IndustryData, id: unknown) => findRecord(data, 'candidates', String(id ?? ''));
export const fullName = (c: DemoRecord | undefined) => `${str(c, 'firstName')} ${str(c, 'lastName')}`.trim() || 'Unknown candidate';
export const candidateName = (data: IndustryData, id: unknown) => fullName(candidateOf(data, id));
export const submissionOf = (data: IndustryData, id: unknown) => findRecord(data, 'submissions', String(id ?? ''));
/** Candidate behind a submission, interview or placement. */
export const candidateOfSubmission = (data: IndustryData, sub: DemoRecord | undefined) => candidateOf(data, str(sub, 'candidate'));
export const assignmentOf = (data: IndustryData, id: unknown) => findRecord(data, 'assignments', String(id ?? ''));

/* ---------------- Clients & terms of business ---------------- */
/** Terms are current when signed and not past their expiry date. */
export function termsCurrent(client: DemoRecord | undefined, today: string): boolean {
  return !!client && client.status === 'signed' && !!str(client, 'termsExpiry') && str(client, 'termsExpiry') >= today;
}
/** Why a job order cannot be opened for this client, or null. */
export function termsProblem(client: DemoRecord | undefined, today: string): string | null {
  if (!client) return 'Choose the client first.';
  const name = str(client, 'name');
  if (client.status === 'signed' && str(client, 'termsExpiry') < today) return `${name}’s terms of business expired on ${formatDate(str(client, 'termsExpiry'))}. Re-send the terms and record the new signature before opening a job order.`;
  if (client.status === 'signed') return null;
  if (client.status === 'expired') return `${name}’s terms of business have expired. Re-send them and record the signed copy before opening a job order.`;
  if (client.status === 'sent') return `${name} has not signed the terms of business yet (sent ${formatDate(str(client, 'termsSentOn'))}). Record the signed terms — use “Record signed terms” — before opening a job order.`;
  return `${name} has no terms of business yet. Send the terms and record the signed copy before opening a job order.`;
}
export function sendTermsProblems(client: DemoRecord): string[] {
  const out: string[] = [];
  if (!(num(client, 'feePct') > 0)) out.push('Set the permanent placement fee %.');
  if (!(num(client, 'paymentDays') > 0)) out.push('Set the payment terms (days).');
  if (!(num(client, 'guaranteeMonths') > 0)) out.push('Set the guarantee period (months).');
  if (!str(client, 'remedy')) out.push('Choose what happens if a placement leaves inside the guarantee (free replacement or pro-rata refund).');
  if (!str(client, 'email')) out.push('Add the contact’s email address.');
  return out;
}
export function signTermsProblems(client: DemoRecord, today: string): string[] {
  const out: string[] = [];
  const signed = str(client, 'termsSignedOn');
  const exp = str(client, 'termsExpiry');
  if (!signed || !exp) out.push('Record the date the client signed and the expiry date — use “Record signed terms”.');
  else {
    if (signed > today) out.push('The signature date cannot be in the future.');
    if (exp <= signed) out.push('The terms must expire after the date they were signed.');
    else if (exp < today) out.push(`These terms expired on ${formatDate(exp)} — record the new expiry date.`);
  }
  return out;
}

/* ---------------- Job orders ---------------- */
export const JOB_LIVE = ['open', 'sourcing', 'shortlist', 'interviewing', 'offer'];
export const SUB_LIVE = ['submitted', 'reviewing', 'interview', 'final', 'offer'];
export const SUB_STAGES = ['longlist', 'submitted', 'reviewing', 'interview', 'final', 'offer', 'accepted'];
export const feePctOf = (job: DemoRecord | undefined, data: IndustryData) => (str(job, 'feePct') !== '' ? num(job, 'feePct') : num(clientOf(data, str(job, 'client')), 'feePct'));
/** Estimated fee in cents: annual package × fee %. A free replacement carries no fee. */
export const estFee = (job: DemoRecord | undefined, data: IndustryData) => (job && str(job, 'replacementFor') ? 0 : toCents((num(job, 'package') * feePctOf(job, data)) / 100));
export const placementFeeCents = (packageRand: number, feePct: number) => toCents((packageRand * feePct) / 100);
export const submissionsFor = (data: IndustryData, jobId: string) => records(data, 'submissions').filter((s) => str(s, 'job') === jobId);
export const sentFor = (data: IndustryData, jobId: string) => submissionsFor(data, jobId).filter((s) => !!str(s, 'submittedOn'));
export const daysOpen = (job: DemoRecord, today: string) => (str(job, 'openedOn') ? daysBetween(str(job, 'openedOn'), str(job, 'filledOn') || today) : 0);

export function jobFlags(job: DemoRecord, data: IndustryData, today: string): Flag[] {
  const out: Flag[] = [];
  const st = job.status ?? '';
  if (['open', 'sourcing'].includes(st) && !sentFor(data, job.id).length && daysOpen(job, today) >= STALE_JOB_DAYS) out.push({ tone: 'red', label: `Open ${daysOpen(job, today)} days · no CVs sent` });
  else if (JOB_LIVE.includes(st) && daysOpen(job, today) > 60) out.push({ tone: 'amber', label: `Open ${daysOpen(job, today)} days` });
  if (JOB_LIVE.includes(st) && !termsCurrent(clientOf(data, str(job, 'client')), today)) out.push({ tone: 'red', label: 'Client terms not current' });
  if (str(job, 'replacementFor')) out.push({ tone: 'blue', label: 'Free replacement' });
  if (JOB_LIVE.includes(st) && str(job, 'priority') === 'high') out.push({ tone: 'accent', label: 'High priority' });
  if (str(job, 'type') === 'exclusive' && JOB_LIVE.includes(st)) out.push({ tone: 'dark', label: 'Exclusive' });
  return out;
}

/** Stage reached by the furthest live candidate on a job. */
export function furthestStage(data: IndustryData, jobId: string): string | null {
  let best: string | null = null;
  for (const s of submissionsFor(data, jobId)) {
    if (!SUB_STAGES.includes(s.status ?? '') || s.status === 'longlist') continue;
    if (!best || SUB_STAGES.indexOf(s.status!) > SUB_STAGES.indexOf(best)) best = s.status!;
  }
  return best;
}

/** Weighted pipeline value (cents): each live job's estimated fee × the probability of its furthest candidate's stage. */
export function weightedPipeline(data: IndustryData) {
  const rows = records(data, 'jobs').filter((j) => JOB_LIVE.includes(j.status ?? '')).map((j) => {
    const stage = furthestStage(data, j.id);
    const p = stage ? STAGE_PROBABILITY[stage] ?? 0 : 0;
    const fee = estFee(j, data);
    return { job: j, stage, p, fee, weighted: Math.round(fee * p) };
  });
  return { rows, total: rows.reduce((n, r) => n + r.weighted, 0), unweighted: rows.reduce((n, r) => n + r.fee, 0) };
}

/* ---------------- Candidates & POPIA consent (illustrative) ---------------- */
export type ConsentState = 'none' | 'expired' | 'expiring' | 'noshare' | 'current';
export function consentState(c: DemoRecord | undefined, today: string): ConsentState {
  if (!c || !str(c, 'consentGiven') || !str(c, 'consentExpiry')) return 'none';
  if (str(c, 'consentExpiry') < today) return 'expired';
  if (c.values.consentShare !== true) return 'noshare';
  return daysBetween(today, str(c, 'consentExpiry')) <= CONSENT_WARNING_DAYS ? 'expiring' : 'current';
}
/** Why this candidate's CV may not be shared with a client, or null. */
export function consentProblem(c: DemoRecord | undefined, today: string): string | null {
  const name = fullName(c);
  switch (consentState(c, today)) {
    case 'none': return `No POPIA consent is on record for ${name}. Record their consent (“Record consent”) before the CV can be sent.`;
    case 'expired': return `${name}’s consent expired on ${formatDate(str(c, 'consentExpiry'))}. Record renewed consent (“Record consent”) before the CV can be sent.`;
    case 'noshare': return `${name} consented to processing but not to sharing the CV with clients. Record consent to share (“Record consent”) first.`;
    default: return null;
  }
}
export function candidateFlags(c: DemoRecord, data: IndustryData, today: string): Flag[] {
  const out: Flag[] = [];
  const s = consentState(c, today);
  const open = !['archived'].includes(c.status ?? '');
  if (open && s === 'none') out.push({ tone: 'red', label: 'No POPIA consent' });
  if (open && s === 'expired') out.push({ tone: 'red', label: 'Consent expired' });
  if (open && s === 'noshare') out.push({ tone: 'amber', label: 'Consent: no sharing' });
  if (open && s === 'expiring') out.push({ tone: 'amber', label: `Consent lapses in ${daysBetween(today, str(c, 'consentExpiry'))} d` });
  const dup = duplicatesOf(data, c);
  if (dup.length) out.push({ tone: 'amber', label: `Possible duplicate of ${dup.map((d) => d.ref).join(', ')}` });
  return out;
}
const normPhone = (v: string) => v.replace(/\D/g, '');
/** Other candidates with the same email or phone number. */
export function duplicatesOf(data: IndustryData, c: DemoRecord): DemoRecord[] {
  const email = str(c, 'email').trim().toLowerCase();
  const phone = normPhone(str(c, 'phone'));
  return records(data, 'candidates').filter((o) => o.id !== c.id && ((email && str(o, 'email').trim().toLowerCase() === email) || (phone.length >= 9 && normPhone(str(o, 'phone')) === phone)));
}
export function screenProblems(c: DemoRecord, today: string): string[] {
  const out: string[] = [];
  const s = consentState(c, today);
  if (s === 'none') out.push('Record the candidate’s POPIA consent to process their details first (“Record consent”).');
  if (s === 'expired') out.push('The candidate’s consent has expired — record renewed consent first (“Record consent”).');
  if (!(num(c, 'expectedPackage') > 0)) out.push('Capture the expected package from the screening call (“Screening” panel).');
  if (!str(c, 'notice')) out.push('Capture the notice period from the screening call (“Screening” panel).');
  return out;
}
/** Date a candidate could start, from their notice period. */
export const availableFrom = (c: DemoRecord | undefined, today: string) => addDays(today, NOTICE_DAYS[str(c, 'notice')] ?? 30);

/* ---------------- Submissions: ownership rule, CVs, offers ---------------- */
export type Ownership = { other: DemoRecord; by: string; on: string; until: string; client: string };
/** Has anyone already sent this candidate's CV to the same client within the ownership window? */
export function ownershipConflict(data: IndustryData, sub: DemoRecord, today: string): Ownership | null {
  const cand = str(sub, 'candidate');
  const clientId = str(jobOf(data, str(sub, 'job')), 'client');
  for (const o of records(data, 'submissions')) {
    if (o.id === sub.id || str(o, 'candidate') !== cand || !str(o, 'submittedOn')) continue;
    if (str(jobOf(data, str(o, 'job')), 'client') !== clientId) continue;
    const until = addMonths(str(o, 'submittedOn'), OWNERSHIP_MONTHS);
    if (until > today) return { other: o, by: consultantName(data, str(o, 'submittedBy')), on: str(o, 'submittedOn'), until, client: clientName(data, clientId) };
  }
  return null;
}
export const ownershipMessage = (data: IndustryData, sub: DemoRecord, own: Ownership) =>
  `${candidateName(data, str(sub, 'candidate'))} was already sent to ${own.client} by ${own.by} on ${formatDate(own.on)} (${own.other.ref}, ${str(jobOf(data, str(own.other, 'job')), 'title')}). Under the ${OWNERSHIP_MONTHS}-month ownership rule nobody may submit them to this client again until ${formatDate(own.until)}.`;

/** Every reason the CV cannot be sent to the client yet (permission is checked by the engine). */
export function sendCvProblems(sub: DemoRecord, data: IndustryData, today: string): string[] {
  const out: string[] = [];
  const job = jobOf(data, str(sub, 'job'));
  const cand = candidateOf(data, str(sub, 'candidate'));
  if (!job || !cand) return ['Link the submission to a job order and a candidate.'];
  if (!JOB_LIVE.includes(job.status ?? '')) out.push(`${job.ref} is not open for submissions (status: ${job.status === 'draft' ? 'draft — not yet opened' : job.status === 'onhold' ? 'on hold' : job.status}).`);
  if (['placed', 'notlooking', 'archived'].includes(cand.status ?? '')) out.push(`${fullName(cand)} is ${cand.status === 'placed' ? 'already placed' : cand.status === 'notlooking' ? 'marked “not looking”' : 'archived'}.`);
  const consent = consentProblem(cand, today);
  if (consent) out.push(consent);
  const own = ownershipConflict(data, sub, today);
  if (own) out.push(ownershipMessage(data, sub, own));
  return out;
}
export function offerProblems(sub: DemoRecord): string[] {
  const out: string[] = [];
  if (!(num(sub, 'offerPackage') > 0)) out.push('Enter the offered annual package (CTC) — use “Offer details”.');
  if (!str(sub, 'offerStart')) out.push('Enter the agreed start date — use “Offer details”.');
  return out;
}
export function acceptProblems(sub: DemoRecord, data: IndustryData): string[] {
  const out = offerProblems(sub);
  const job = jobOf(data, str(sub, 'job'));
  const other = job && submissionsFor(data, job.id).find((s) => s.id !== sub.id && s.status === 'accepted');
  if (other) out.push(`${job!.ref} has already been filled by ${candidateName(data, str(other, 'candidate'))} (${other.ref}).`);
  return out;
}
export const interviewsFor = (data: IndustryData, subId: string) => records(data, 'interviews').filter((i) => str(i, 'submission') === subId);

/* ---------------- Interviews ---------------- */
/** A scheduled interview for the same candidate that overlaps this slot, if any. */
export function interviewClash(data: IndustryData, slot: { candidate: string; date: string; time: string; duration: number; excludeId?: string }): DemoRecord | null {
  const start = minutes(slot.time);
  const end = start + Math.max(15, slot.duration || 60);
  for (const iv of records(data, 'interviews')) {
    if (iv.id === slot.excludeId || iv.status !== 'scheduled' || str(iv, 'date') !== slot.date) continue;
    if (str(submissionOf(data, str(iv, 'submission')), 'candidate') !== slot.candidate) continue;
    const s = minutes(str(iv, 'time'));
    const e = s + Math.max(15, num(iv, 'duration') || 60);
    if (start < e && s < end) return iv;
  }
  return null;
}
export const clashMessage = (data: IndustryData, iv: DemoRecord) => {
  const sub = submissionOf(data, str(iv, 'submission'));
  return `${candidateName(data, str(sub, 'candidate'))} already has an interview at ${str(iv, 'time')} on ${formatDate(str(iv, 'date'))} (${iv.ref}, ${jobTitle(data, str(sub, 'job'))}). Choose another time.`;
};
export function completeInterviewProblems(iv: DemoRecord, today: string): string[] {
  const out: string[] = [];
  if (str(iv, 'date') > today) out.push(`The interview is only on ${formatDate(str(iv, 'date'))}.`);
  if (!str(iv, 'rating')) out.push('Choose the client’s rating — use “Interview feedback”.');
  if (!str(iv, 'outcome')) out.push('Choose the outcome — use “Interview feedback”.');
  if (str(iv, 'feedback').trim().length < 10) out.push('Write the client’s feedback (at least a sentence) — use “Interview feedback”.');
  return out;
}

/* ---------------- Placements ---------------- */
export const guaranteeEndFor = (start: string, months: number) => addDays(addMonths(start, months), -1);
/** Pro-rata refund when a placement leaves inside the guarantee: the unused share of the guarantee period. */
export function refundFor(p: DemoRecord, leftOn: string) {
  const fee = toCents(num(p, 'fee'));
  const start = str(p, 'startDate');
  const end = str(p, 'guaranteeEnd');
  const total = Math.max(1, daysBetween(start, end) + 1);
  const used = Math.min(total, Math.max(0, daysBetween(start, leftOn)));
  const remaining = total - used;
  return { fee, total, used, remaining, pct: Math.round((remaining / total) * 1000) / 10, refund: roundCents((fee * remaining) / total) };
}
export function fallOffProblems(p: DemoRecord, today: string): string[] {
  const left = str(p, 'fellOffOn');
  if (!left) return ['Record the date the candidate left — use “Record leaving date”.'];
  if (left > today) return ['The leaving date cannot be in the future.'];
  if (left < str(p, 'startDate')) return ['The leaving date is before the start date — use “Fell off before start” for a candidate who never started.'];
  if (left > str(p, 'guaranteeEnd')) return [`The candidate left after the guarantee ended on ${formatDate(str(p, 'guaranteeEnd'))}; no replacement or refund is due. Mark the guarantee as passed instead.`];
  return [];
}

/* ---------------- Contractors & timesheets ---------------- */
export function margin(a: DemoRecord | undefined) {
  const pay = toCents(num(a, 'payRate'));
  const charge = toCents(num(a, 'chargeRate'));
  const perHour = charge - pay;
  return { pay, charge, perHour, pct: charge > 0 ? Math.round((perHour / charge) * 1000) / 10 : 0 };
}
export function startAssignmentProblems(a: DemoRecord): string[] {
  const out: string[] = [];
  if (!(num(a, 'payRate') > 0) || !(num(a, 'chargeRate') > 0)) out.push('Set the hourly pay rate and charge rate.');
  else if (num(a, 'chargeRate') <= num(a, 'payRate')) out.push('The charge rate must be higher than the pay rate, or the assignment runs at a loss.');
  if (!str(a, 'startDate') || !str(a, 'endDate')) out.push('Set the start and end dates.');
  else if (str(a, 'endDate') < str(a, 'startDate')) out.push('The end date is before the start date.');
  return out;
}
/** Illustrative flag modelled on LRA s198A: approaching 3 months on an assignment while earning below a demo threshold. */
export function s198aCheck(a: DemoRecord, today: string) {
  const start = str(a, 'startDate');
  if (!start || !['active'].includes(a.status ?? '')) return null;
  const threeMonths = addMonths(start, S198A_MONTHS);
  const annual = num(a, 'payRate') * (num(a, 'hoursPerWeek') || STANDARD_WEEK_HOURS) * 52;
  const below = annual < ILLUSTRATIVE_EARNINGS_THRESHOLD;
  const daysLeft = daysBetween(today, threeMonths);
  if (!below || daysLeft > S198A_WARNING_DAYS) return null;
  return { threeMonths, annual, daysLeft, passed: daysLeft <= 0 };
}
export function assignmentFlags(a: DemoRecord, data: IndustryData, today: string): Flag[] {
  const out: Flag[] = [];
  const s = s198aCheck(a, today);
  if (s) out.push({ tone: s.passed ? 'red' : 'amber', label: s.passed ? 'Past 3 months · below threshold (s198A demo flag)' : `3 months in ${s.daysLeft} d · below threshold (s198A demo flag)` });
  if (a.status === 'active' && str(a, 'endDate') && daysBetween(today, str(a, 'endDate')) <= 14 && str(a, 'endDate') >= today) out.push({ tone: 'amber', label: `Ends in ${daysBetween(today, str(a, 'endDate'))} d` });
  const open = timesheetsFor(data, a.id).filter((t) => t.status === 'submitted').length;
  if (open) out.push({ tone: 'blue', label: `${plural(open, 'timesheet')} awaiting approval` });
  if (margin(a).perHour <= 0 && num(a, 'chargeRate') > 0) out.push({ tone: 'red', label: 'No margin' });
  return out;
}
export const timesheetsFor = (data: IndustryData, assignmentId: string) => records(data, 'timesheets').filter((t) => str(t, 'assignment') === assignmentId);
export const HOUR_KEYS = ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
export const timesheetDays = (t: DemoRecord) => HOUR_KEYS.map((k, i) => ({ key: k, date: addDays(str(t, 'weekStart'), i), hours: num(t, k) }));
export const timesheetHours = (t: DemoRecord | undefined) => (t ? HOUR_KEYS.reduce((n, k) => n + num(t, k), 0) : 0);
export const inAssignment = (a: DemoRecord | undefined, date: string) => !!a && date >= str(a, 'startDate') && (!str(a, 'endDate') || date <= str(a, 'endDate'));
export function submitTimesheetProblems(t: DemoRecord, data: IndustryData, today: string): string[] {
  const out: string[] = [];
  const a = assignmentOf(data, str(t, 'assignment'));
  if (!a) return ['Link the timesheet to a contractor assignment.'];
  if (!isMonday(str(t, 'weekStart'))) out.push('The week must start on a Monday.');
  const days = timesheetDays(t);
  if (timesheetHours(t) <= 0) out.push('Enter the hours worked — use the day-by-day hours on the timesheet.');
  const outside = days.filter((d) => d.hours > 0 && !inAssignment(a, d.date));
  if (outside.length) out.push(`Hours are logged outside the assignment (${formatDate(str(a, 'startDate'))} to ${formatDate(str(a, 'endDate'))}) on ${outside.map((d) => formatDate(d.date)).join(', ')}. Clear those days first.`);
  const future = days.filter((d) => d.hours > 0 && d.date > today);
  if (future.length) out.push(`Hours cannot be logged for days that have not happened yet (${future.map((d) => formatDate(d.date)).join(', ')}).`);
  if (days.some((d) => d.hours > 24 || d.hours < 0)) out.push('A day cannot have more than 24 hours or negative hours.');
  const twin = timesheetsFor(data, a.id).find((o) => o.id !== t.id && str(o, 'weekStart') === str(t, 'weekStart'));
  if (twin) out.push(`${twin.ref} already covers the week of ${formatDate(str(t, 'weekStart'))} for this assignment.`);
  return out;
}
export const overCap = (t: DemoRecord) => timesheetHours(t) > WEEKLY_HOURS_CAP;
export function timesheetValue(t: DemoRecord, data: IndustryData) {
  const a = assignmentOf(data, str(t, 'assignment'));
  const hours = timesheetHours(t);
  return { hours, charge: roundCents(hours * toCents(num(a, 'chargeRate'))), pay: roundCents(hours * toCents(num(a, 'payRate'))) };
}

/* ---------------- Invoices (demo documents, not tax invoices) ---------------- */
export function invoiceTotals(inv: DemoRecord | undefined) {
  const t = linesTotals(lines(inv), VAT_RATE);
  const sign = str(inv, 'kind') === 'credit' ? -1 : 1;
  return { net: t.net, vat: t.vat, total: t.total, sign };
}
export const invoiceOverdue = (inv: DemoRecord, today: string) => inv.status === 'issued' && str(inv, 'kind') !== 'credit' && !!str(inv, 'dueDate') && str(inv, 'dueDate') < today;
export function issueProblems(inv: DemoRecord, data: IndustryData): string[] {
  const out: string[] = [];
  if (!str(inv, 'client')) out.push('Choose the client being billed.');
  if (!lines(inv).length || invoiceTotals(inv).net <= 0) out.push('Add at least one line with an amount.');
  if (str(inv, 'kind') === 'credit' && !findRecord(data, 'invoices', str(inv, 'creditFor'))) out.push('Link the credit note to the invoice it reduces.');
  if (!str(inv, 'dueDate')) out.push('Set the due date.');
  return out;
}
/** Fees billed (cents, excl. VAT) in a date range: placement-fee invoices less credit notes, optionally for one consultant. */
export function feesBilled(data: IndustryData, from: string, to: string, consultantId?: string) {
  return records(data, 'invoices')
    .filter((i) => i.status !== 'void' && ['fee', 'credit'].includes(str(i, 'kind')) && str(i, 'date') >= from && str(i, 'date') <= to)
    .filter((i) => !consultantId || str(i, 'consultant') === consultantId)
    .reduce((n, i) => { const t = invoiceTotals(i); return n + t.sign * t.net; }, 0);
}
export const teamTarget = (data: IndustryData) => records(data, 'consultants').reduce((n, c) => n + toCents(num(c, 'monthlyTarget')), 0);

/* ---------------- Reports ---------------- */
/** Submissions → interviews → offers → placements for CVs sent since `from`. */
export function funnel(data: IndustryData, from = '0000-01-01') {
  const sent = records(data, 'submissions').filter((s) => str(s, 'submittedOn') && str(s, 'submittedOn') >= from);
  const interviewed = sent.filter((s) => interviewsFor(data, s.id).some((i) => i.status !== 'cancelled'));
  const offered = sent.filter((s) => !!str(s, 'offerMadeOn'));
  const placed = sent.filter((s) => s.status === 'accepted');
  return { submitted: sent.length, interviewed: interviewed.length, offered: offered.length, placed: placed.length };
}
/** Average days from opening to filled, over filled jobs. */
export function timeToFill(data: IndustryData) {
  const filled = records(data, 'jobs').filter((j) => j.status === 'filled' && str(j, 'openedOn') && str(j, 'filledOn'));
  const days = filled.map((j) => daysBetween(str(j, 'openedOn'), str(j, 'filledOn')));
  return { count: days.length, avg: days.length ? Math.round(days.reduce((n, d) => n + d, 0) / days.length) : 0 };
}

/** The demo user's consultant record, if they carry a desk. */
export const deskOf = (data: IndustryData, user: DemoUser) => consultantForUser(data, user.id);
