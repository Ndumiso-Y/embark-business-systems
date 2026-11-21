// Recruitment agency demo. Fictional agency: Fynbos Talent Partners (South Africa) —
// permanent placements plus a contractor desk, specialising in finance, IT, engineering
// and sales roles. Client terms of business gate job orders; POPIA consent and a
// six-month ownership rule gate CVs going to clients; an accepted offer creates the
// placement and fills the job; starting raises the fee invoice and a fall-off inside
// the guarantee raises a pro-rata credit note or a free replacement job. Contractors
// log weekly timesheets that are approved (simulated) and invoiced.
import type { CollectionDef, EffectContext, Flag, IndustryConfig, WorkflowDef } from '../../core/types';
import { findRecord, num, records, str } from '../../core/engine';
import { addDays, daysBetween, formatDate } from '../../core/lib/dates';
import { IcoBoard, IcoBriefcase, IcoCalendar, IcoChart, IcoDoc, IcoReceipt, IcoShield, IcoTimer, IcoUsers } from '../../core/components/Icons';
import { IcoBadge } from './pages/icons';
import {
  CONSULTANT_ROLES, DISCIPLINES, FORMATS, INVOICE_KINDS, JOB_TYPES, LOCATIONS, NOTICE_PERIODS, OUTCOMES, PRIORITIES, RATINGS, REMEDIES, ROUNDS, SECTORS, SOURCES,
  WEEKLY_HOURS_CAP, label,
} from './data';
import {
  JOB_LIVE, SUB_LIVE, acceptProblems, assignmentFlags, assignmentOf, candidateFlags, candidateName, candidateOf, clientName, clientOf, completeInterviewProblems,
  consentProblem, consultantForUser, consultantName, fallOffProblems, feePctOf, fullName, guaranteeEndFor, interviewClash, interviewsFor, invoiceOverdue, invoiceTotals,
  isMonday, issueProblems, jobFlags, jobOf, jobTitle, mondayOf, offerProblems, overCap, placementFeeCents, randOf, randc, refundFor, screenProblems, sendCvProblems,
  sendTermsProblems, sentFor, signTermsProblems, startAssignmentProblems, submissionOf, submissionsFor, submitTimesheetProblems, termsProblem, timesheetHours,
  timesheetsFor, todayStr,
} from './helpers';
export * from './helpers';
import { buildRecruitmentSeed } from './seed';
import Dashboard from './pages/Dashboard';
import ClientDetail from './pages/ClientDetail';
import JobDetail from './pages/JobDetail';
import PipelinePage from './pages/PipelinePage';
import SubmissionDetail from './pages/SubmissionDetail';
import CandidateDetail from './pages/CandidateDetail';
import Interviews from './pages/Interviews';
import InterviewDetail from './pages/InterviewDetail';
import Placements from './pages/Placements';
import PlacementDetail from './pages/PlacementDetail';
import Contractors from './pages/Contractors';
import AssignmentDetail from './pages/AssignmentDetail';
import Timesheets from './pages/Timesheets';
import TimesheetDetail from './pages/TimesheetDetail';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Reports from './pages/Reports';

const phoneRule = (v: unknown) => (/^0\d{2} 555 \d{4}$/.test(String(v)) ? null : 'Use a fictional number in the format 0xx 555 xxxx.');
const emailRule = (v: unknown) => (/^[^@\s]+@example\.com$/.test(String(v)) ? null : 'Use a fictional @example.com address.');
const byRefDesc = (a: { ref: string }, b: { ref: string }) => b.ref.localeCompare(a.ref);

/* ---------------- Side effects ---------------- */
/** Move a job forward to `to` when it is still at an earlier stage (its own rules still apply). */
function nudgeJob({ data, api }: EffectContext, jobId: string, to: string, from: string[]) {
  const job = jobOf(data, jobId);
  if (job && from.includes(job.status ?? '')) api.transition('jobs', job.id, to);
}

function onOfferAccepted(ctx: EffectContext) {
  const { record, data, api, today } = ctx;
  const job = jobOf(data, str(record, 'job'));
  const client = clientOf(data, str(job, 'client'));
  const cand = candidateOf(data, str(record, 'candidate'));
  api.update('submissions', record.id, { acceptedOn: today });
  const feePct = feePctOf(job, data);
  const free = !!str(job, 'replacementFor');
  const fee = free ? 0 : placementFeeCents(num(record, 'offerPackage'), feePct) / 100;
  const months = num(client, 'guaranteeMonths') || 3;
  const start = str(record, 'offerStart');
  const p = api.create('placements', {
    submission: record.id, candidate: str(record, 'candidate'), job: str(record, 'job'), client: str(job, 'client'),
    consultant: str(record, 'submittedBy') || str(job, 'owner'), acceptedOn: today, startDate: start, package: num(record, 'offerPackage'),
    feePct: free ? 0 : feePct, fee, guaranteeMonths: months, guaranteeEnd: guaranteeEndFor(start, months), remedy: str(client, 'remedy') || 'replacement',
    fellOffOn: '', invoice: '', creditNote: '', replacementJob: '', notes: free ? `Free replacement under ${str(job, 'replacementFor')} — no fee.` : '',
  }, 'accepted', `Placement created from ${record.ref} (offer accepted)`);
  if (job && job.status !== 'filled') {
    const res = api.transition('jobs', job.id, 'filled');
    if (!res.ok) api.toast(`${job.ref} could not be marked filled: ${res.reason}`, 'err');
  }
  if (cand && ['new', 'screened', 'active'].includes(cand.status ?? '')) api.transition('candidates', cand.id, 'placed');
  api.toast(`Placement ${p.ref} created · ${job?.ref ?? 'job'} is filled${fee ? ` · fee ${randOf(fee)} excl. VAT on start` : ''}`, 'info');
}

function raiseFeeInvoice({ record, data, api, today }: EffectContext) {
  const fee = num(record, 'fee');
  if (fee <= 0) { api.toast('Free replacement — no fee invoice is raised', 'info'); return; }
  const client = clientOf(data, str(record, 'client'));
  const job = jobOf(data, str(record, 'job'));
  const inv = api.create('invoices', {
    kind: 'fee', client: str(record, 'client'), placement: record.id, consultant: str(record, 'consultant'), date: today, dueDate: addDays(today, num(client, 'paymentDays') || 30),
    lines: [{ id: `ln_${record.id}_fee`, description: `Permanent placement fee — ${candidateName(data, str(record, 'candidate'))} as ${str(job, 'title')} (${num(record, 'feePct')}% of ${randOf(num(record, 'package'))} annual package)`, qty: 1, unitPrice: fee }],
    notes: '',
  }, 'draft', `Fee invoice raised on start of ${record.ref}`);
  api.update('placements', record.id, { invoice: inv.id }, `Fee invoice ${inv.ref} raised (draft)`);
  api.toast(`Fee invoice ${inv.ref} raised as a draft for Finance to issue`, 'info');
}

function onFellOffInGuarantee(ctx: EffectContext) {
  const { record, data, api, today } = ctx;
  const left = str(record, 'fellOffOn') || today;
  const job = jobOf(data, str(record, 'job'));
  if (str(record, 'remedy') === 'refund' && num(record, 'fee') > 0) {
    const r = refundFor(record, left);
    const original = findRecord(data, 'invoices', str(record, 'invoice'));
    const cn = api.create('invoices', {
      kind: 'credit', client: str(record, 'client'), placement: record.id, consultant: str(record, 'consultant'), creditFor: original?.id ?? '', date: today, dueDate: today,
      lines: [{ id: `ln_${record.id}_cn`, description: `Pro-rata refund — ${candidateName(data, str(record, 'candidate'))} left on ${formatDate(left)}, day ${r.used} of a ${r.total}-day guarantee (${r.pct}% of the fee)`, qty: 1, unitPrice: r.refund / 100 }],
      notes: '',
    }, 'draft', `Credit note raised: ${record.ref} fell off inside the guarantee`);
    api.update('placements', record.id, { creditNote: cn.id }, `Credit note ${cn.ref} raised (${r.pct}% pro-rata refund)`);
    api.toast(`Credit note ${cn.ref} raised for ${randOf(r.refund / 100)} excl. VAT (${r.pct}% of the fee)`, 'info');
  } else if (job) {
    const nj = api.create('jobs', {
      title: str(job, 'title'), client: str(job, 'client'), discipline: str(job, 'discipline'), location: str(job, 'location'), package: num(job, 'package'), feePct: 0,
      type: str(job, 'type') || 'exclusive', priority: 'high', owner: str(record, 'consultant'), openedOn: today, filledOn: '', replacementFor: record.id,
      notes: `Free replacement under the client’s terms: ${candidateName(data, str(record, 'candidate'))} left on ${formatDate(left)}, inside the guarantee.`,
    }, 'open', `Opened as a free replacement for ${record.ref}`);
    api.update('placements', record.id, { replacementJob: nj.id }, `Free replacement job ${nj.ref} opened`);
    api.toast(`Free replacement job ${nj.ref} opened — no fee`, 'info');
  }
  const cand = candidateOf(data, str(record, 'candidate'));
  if (cand?.status === 'placed') api.transition('candidates', cand.id, 'active');
}

/* ---------------- Workflows ---------------- */
const termsWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Terms: draft', tone: 'dark', hint: 'Terms of business not yet sent' },
    { key: 'sent', label: 'Terms sent (simulated)', tone: 'amber' },
    { key: 'signed', label: 'Terms signed', tone: 'green' },
    { key: 'expired', label: 'Terms expired', tone: 'red' },
  ],
  transitions: [
    { from: 'draft', to: 'sent', label: 'Send terms (simulated)', permission: 'terms.manage', intent: 'primary',
      guard: ({ record }) => sendTermsProblems(record)[0] ?? null,
      after: ({ record, api, today }) => { api.update('clients', record.id, { termsSentOn: today }); api.toast('Terms recorded as sent — nothing is emailed in this demo', 'info'); } },
    { from: 'sent', to: 'signed', label: 'Record signed terms', permission: 'terms.manage', intent: 'primary',
      guard: ({ record }) => signTermsProblems(record, todayStr())[0] ?? null },
    { from: 'signed', to: 'expired', label: 'Mark terms expired', permission: 'terms.manage',
      guard: ({ record }) => (str(record, 'termsExpiry') >= todayStr() ? `The terms run until ${formatDate(str(record, 'termsExpiry'))}.` : null) },
    { from: 'expired', to: 'sent', label: 'Re-send terms (simulated)', permission: 'terms.manage', intent: 'primary',
      guard: ({ record }) => sendTermsProblems(record)[0] ?? null,
      after: ({ record, api, today }) => api.update('clients', record.id, { termsSentOn: today }) },
  ],
};

const jobWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft — not open', tone: 'dark' },
    { key: 'open', label: 'Open', tone: 'blue' },
    { key: 'sourcing', label: 'Sourcing', tone: 'accent' },
    { key: 'shortlist', label: 'Shortlist sent', tone: 'accent' },
    { key: 'interviewing', label: 'Interviewing', tone: 'amber' },
    { key: 'offer', label: 'Offer', tone: 'amber' },
    { key: 'filled', label: 'Filled', tone: 'green' },
    { key: 'onhold', label: 'On hold', tone: 'dark' },
    { key: 'lost', label: 'Lost / cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'open', label: 'Open job order', permission: 'jobs.manage', intent: 'primary',
      guard: ({ record, data }) => termsProblem(clientOf(data, str(record, 'client')), todayStr()) ?? (num(record, 'package') > 0 ? null : 'Enter the annual package (CTC) for the role.'),
      after: ({ record, data, api, today }) => {
        const patch: Record<string, string | number> = { openedOn: str(record, 'openedOn') || today };
        if (str(record, 'feePct') === '') patch.feePct = num(clientOf(data, str(record, 'client')), 'feePct');
        api.update('jobs', record.id, patch, `Opened on the client’s terms (${patch.feePct ?? num(record, 'feePct')}% fee)`);
      } },
    { from: 'open', to: 'sourcing', label: 'Start sourcing', permission: 'jobs.manage', intent: 'primary' },
    { from: ['open', 'sourcing'], to: 'shortlist', label: 'Shortlist sent', permission: 'jobs.manage', intent: 'primary',
      guard: ({ record, data }) => (sentFor(data, record.id).length ? null : 'Send at least one CV to the client first — use “Send CV” on the pipeline board below.') },
    { from: ['sourcing', 'shortlist'], to: 'interviewing', label: 'Interviewing', permission: 'jobs.manage', intent: 'primary',
      guard: ({ record, data }) => (submissionsFor(data, record.id).some((s) => ['interview', 'final', 'offer', 'accepted'].includes(s.status ?? '') || interviewsFor(data, s.id).length)
        ? null : 'Book a client interview for one of the candidates first (open their card on the board → “Book interview”).') },
    { from: ['sourcing', 'shortlist', 'interviewing'], to: 'offer', label: 'Offer stage', permission: 'jobs.manage', intent: 'primary',
      guard: ({ record, data }) => (submissionsFor(data, record.id).some((s) => ['offer', 'accepted'].includes(s.status ?? '')) ? null : 'Record an offer on a candidate’s submission first (“Offer details”, then “Make offer”).') },
    { from: ['open', 'sourcing', 'shortlist', 'interviewing', 'offer'], to: 'filled', label: 'Mark filled', permission: 'jobs.manage', intent: 'primary',
      guard: ({ record, data }) => (submissionsFor(data, record.id).some((s) => s.status === 'accepted') ? null : 'A job is only filled by an accepted offer — record the acceptance on the candidate’s submission (“Offer accepted”).'),
      after: ({ record, api, today }) => api.update('jobs', record.id, { filledOn: str(record, 'filledOn') || today }) },
    { from: 'filled', to: 'sourcing', label: 'Re-open (placement fell off)', permission: 'jobs.manage', requiresNote: true, noteHint: 'say why the job is open again',
      guard: ({ record, data }) => {
        const live = records(data, 'placements').find((p) => str(p, 'job') === record.id && ['accepted', 'started'].includes(p.status ?? ''));
        return live ? `Placement ${live.ref} is still live — record the fall-off on the placement first.` : null;
      },
      after: ({ record, api }) => api.update('jobs', record.id, { filledOn: '' }) },
    { from: JOB_LIVE, to: 'onhold', label: 'Put on hold', permission: 'jobs.manage', requiresNote: true, noteHint: 'say why the client has paused the role' },
    { from: 'onhold', to: 'sourcing', label: 'Resume', permission: 'jobs.manage', intent: 'primary',
      guard: ({ record, data }) => termsProblem(clientOf(data, str(record, 'client')), todayStr()) },
    { from: ['draft', ...JOB_LIVE, 'onhold'], to: 'lost', label: 'Lost / cancelled', permission: 'jobs.manage', requiresNote: true, noteHint: 'e.g. filled internally, filled by another agency, budget withdrawn', intent: 'danger',
      guard: ({ record, data }) => (submissionsFor(data, record.id).some((s) => s.status === 'accepted') ? 'An offer on this job has been accepted — it is filled, not lost.' : null) },
  ],
};

const candidateWorkflow: WorkflowDef = {
  initial: 'new',
  states: [
    { key: 'new', label: 'New', tone: 'dark' },
    { key: 'screened', label: 'Screened', tone: 'blue' },
    { key: 'active', label: 'Active — can be submitted', tone: 'accent' },
    { key: 'placed', label: 'Placed', tone: 'green' },
    { key: 'notlooking', label: 'Not looking', tone: 'dark' },
    { key: 'archived', label: 'Archived', tone: 'dark' },
  ],
  transitions: [
    { from: 'new', to: 'screened', label: 'Mark screened', permission: 'candidates.manage', intent: 'primary',
      guard: ({ record }) => screenProblems(record, todayStr())[0] ?? null },
    { from: 'screened', to: 'active', label: 'Activate', permission: 'candidates.manage', intent: 'primary',
      guard: ({ record }) => consentProblem(record, todayStr()) },
    { from: ['new', 'screened', 'active'], to: 'placed', label: 'Mark placed', permission: 'submit',
      guard: ({ record, data }) => (records(data, 'submissions').some((s) => str(s, 'candidate') === record.id && s.status === 'accepted') ? null : 'A candidate is placed automatically when an offer on one of their submissions is accepted.') },
    { from: 'placed', to: 'active', label: 'Back on the market', permission: 'candidates.manage' },
    { from: ['new', 'screened', 'active', 'placed'], to: 'notlooking', label: 'Not looking', permission: 'candidates.manage', requiresNote: true, noteHint: 'e.g. accepted a counter-offer, staying put for now' },
    { from: 'notlooking', to: 'active', label: 'Looking again', permission: 'candidates.manage', intent: 'primary',
      guard: ({ record }) => consentProblem(record, todayStr()) },
    { from: ['new', 'screened', 'active', 'notlooking'], to: 'archived', label: 'Archive', permission: 'candidates.manage', requiresNote: true, noteHint: 'e.g. consent withdrawn, duplicate record, no longer relevant', intent: 'danger' },
    { from: 'archived', to: 'new', label: 'Reactivate', permission: 'candidates.manage', requiresNote: true },
  ],
};

const submissionWorkflow: WorkflowDef = {
  initial: 'longlist',
  states: [
    { key: 'longlist', label: 'Longlisted — CV not sent', tone: 'dark' },
    { key: 'submitted', label: 'CV sent', tone: 'blue' },
    { key: 'reviewing', label: 'Client reviewing', tone: 'blue' },
    { key: 'interview', label: 'Interview', tone: 'accent' },
    { key: 'final', label: 'Final interview', tone: 'accent' },
    { key: 'offer', label: 'Offer', tone: 'amber' },
    { key: 'accepted', label: 'Offer accepted', tone: 'green', terminal: true },
    { key: 'rejected', label: 'Rejected', tone: 'red', terminal: true },
    { key: 'withdrawn', label: 'Withdrawn', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'longlist', to: 'submitted', label: 'Send CV (simulated)', permission: 'submit', intent: 'primary',
      guard: ({ record, data }) => sendCvProblems(record, data, todayStr())[0] ?? null,
      after: (ctx) => {
        const { record, data, api, today, user } = ctx;
        const me = consultantForUser(data, user.id);
        api.update('submissions', record.id, { submittedOn: today, submittedBy: me?.id ?? str(jobOf(data, str(record, 'job')), 'owner') }, `CV sent by ${me ? str(me, 'name') : user.name} (simulated — nothing is emailed)`);
        nudgeJob(ctx, str(record, 'job'), 'sourcing', ['open']);
      } },
    { from: 'submitted', to: 'reviewing', label: 'Client reviewing', permission: 'submit', intent: 'primary' },
    { from: ['submitted', 'reviewing'], to: 'interview', label: 'Interview stage', permission: 'interviews', intent: 'primary',
      guard: ({ record, data }) => (interviewsFor(data, record.id).some((i) => i.status !== 'cancelled') ? null : 'Book the interview first — use “Book interview” on this submission.'),
      after: (ctx) => nudgeJob(ctx, str(ctx.record, 'job'), 'interviewing', ['sourcing', 'shortlist']) },
    { from: 'interview', to: 'final', label: 'Final interview', permission: 'interviews', intent: 'primary',
      guard: ({ record, data }) => (interviewsFor(data, record.id).some((i) => i.status === 'completed') ? null : 'Capture the client’s feedback on the first interview first — open the interview and use “Complete with feedback”.') },
    { from: ['reviewing', 'interview', 'final'], to: 'offer', label: 'Make offer', permission: 'submit', intent: 'primary',
      guard: ({ record }) => offerProblems(record)[0] ?? null,
      after: (ctx) => {
        ctx.api.update('submissions', ctx.record.id, { offerMadeOn: ctx.today });
        nudgeJob(ctx, str(ctx.record, 'job'), 'offer', ['sourcing', 'shortlist', 'interviewing']);
      } },
    { from: 'offer', to: 'accepted', label: 'Offer accepted', permission: 'submit', intent: 'primary',
      guard: ({ record, data }) => acceptProblems(record, data)[0] ?? null,
      after: onOfferAccepted },
    { from: SUB_LIVE, to: 'rejected', label: 'Rejected', permission: 'submit', requiresNote: true, noteHint: 'record the client’s (or our) reason — it helps the next shortlist', intent: 'danger' },
    { from: ['longlist', ...SUB_LIVE], to: 'withdrawn', label: 'Withdraw', permission: 'longlist', requiresNote: true, noteHint: 'e.g. candidate accepted another offer, not a fit after screening' },
  ],
};

const interviewWorkflow: WorkflowDef = {
  initial: 'scheduled',
  states: [
    { key: 'scheduled', label: 'Scheduled', tone: 'blue' },
    { key: 'completed', label: 'Feedback captured', tone: 'green', terminal: true },
    { key: 'noshow', label: 'Candidate no-show', tone: 'red', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'scheduled', to: 'completed', label: 'Complete with feedback', permission: 'interviews', intent: 'primary',
      guard: ({ record }) => completeInterviewProblems(record, todayStr())[0] ?? null,
      after: ({ record, data, api }) => {
        const sub = submissionOf(data, str(record, 'submission'));
        if (str(record, 'outcome') === 'reject' && sub && ['interview', 'final'].includes(sub.status ?? '')) api.toast('The client does not want to progress — reject the submission with their reason', 'info');
        if (str(record, 'outcome') === 'progress' && sub?.status === 'interview') api.toast('Client wants to progress — move the submission to “Final interview” or “Make offer”', 'info');
      } },
    { from: 'scheduled', to: 'noshow', label: 'Candidate no-show', permission: 'interviews',
      guard: ({ record }) => (str(record, 'date') > todayStr() ? 'The interview has not happened yet.' : null) },
    { from: 'scheduled', to: 'cancelled', label: 'Cancel interview', permission: 'interviews', requiresNote: true, noteHint: 'who cancelled and why', intent: 'danger' },
  ],
};

const placementWorkflow: WorkflowDef = {
  initial: 'accepted',
  states: [
    { key: 'accepted', label: 'Offer accepted — not started', tone: 'blue' },
    { key: 'started', label: 'Started — in guarantee', tone: 'accent' },
    { key: 'guaranteed', label: 'Guarantee passed', tone: 'green', terminal: true },
    { key: 'felloff', label: 'Fell off', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'accepted', to: 'started', label: 'Candidate started', permission: 'placements.manage', intent: 'primary',
      guard: ({ record, data }) => (str(record, 'startDate') && str(record, 'startDate') <= todayStr() ? null : `${candidateName(data, str(record, 'candidate'))} only starts on ${formatDate(str(record, 'startDate'))} — confirm the start on or after that day.`),
      after: raiseFeeInvoice },
    { from: 'started', to: 'guaranteed', label: 'Guarantee passed', permission: 'placements.manage', intent: 'primary',
      guard: ({ record }) => (str(record, 'guaranteeEnd') < todayStr() ? null : `The guarantee runs until ${formatDate(str(record, 'guaranteeEnd'))}.`) },
    { from: 'started', to: 'felloff', label: 'Fell off in guarantee', permission: 'placements.manage', requiresNote: true, noteHint: 'why the candidate left (resigned, dismissed, role changed)', intent: 'danger',
      guard: ({ record }) => fallOffProblems(record, todayStr())[0] ?? null,
      after: onFellOffInGuarantee },
    { from: 'accepted', to: 'felloff', label: 'Fell off before start', permission: 'placements.manage', requiresNote: true, noteHint: 'e.g. counter-offered by current employer — the job re-opens', intent: 'danger',
      after: ({ record, data, api }) => {
        const job = jobOf(data, str(record, 'job'));
        if (job?.status === 'filled') api.transition('jobs', job.id, 'sourcing', `${record.ref} fell off before the start date`);
        const cand = candidateOf(data, str(record, 'candidate'));
        if (cand?.status === 'placed') api.transition('candidates', cand.id, 'active');
        api.toast(`${job?.ref ?? 'The job'} is open again — no fee is due`, 'info');
      } },
  ],
};

const assignmentWorkflow: WorkflowDef = {
  initial: 'pending',
  states: [
    { key: 'pending', label: 'Confirmed — not started', tone: 'dark' },
    { key: 'active', label: 'Active', tone: 'accent' },
    { key: 'ended', label: 'Ended', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'pending', to: 'active', label: 'Start assignment', permission: 'assignments.manage', intent: 'primary',
      guard: ({ record }) => startAssignmentProblems(record)[0] ?? (str(record, 'startDate') > todayStr() ? `The assignment only starts on ${formatDate(str(record, 'startDate'))}.` : null) },
    { from: 'active', to: 'ended', label: 'End assignment', permission: 'assignments.manage',
      guard: ({ record, data }) => {
        const open = timesheetsFor(data, record.id).filter((t) => t.status !== 'invoiced');
        return open.length ? `${open.map((t) => t.ref).join(', ')} still ${open.length === 1 ? 'needs' : 'need'} to be submitted, approved and invoiced before the assignment can end.` : null;
      } },
    { from: 'pending', to: 'cancelled', label: 'Cancel assignment', permission: 'assignments.manage', requiresNote: true, intent: 'danger' },
  ],
};

const timesheetWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'submitted', label: 'Submitted', tone: 'blue' },
    { key: 'approved', label: 'Client approved (simulated)', tone: 'accent' },
    { key: 'invoiced', label: 'Invoiced', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'submitted', label: 'Submit timesheet', permission: 'timesheets.manage', intent: 'primary',
      guard: ({ record, data }) => submitTimesheetProblems(record, data, todayStr())[0] ?? null },
    { from: 'submitted', to: 'approved', label: 'Log client approval (simulated)', permission: 'timesheets.manage', intent: 'primary', requiresNote: true,
      noteHint: 'who at the client approved the hours, and how (email, portal, signed sheet)' },
    { from: 'submitted', to: 'draft', label: 'Return for correction', permission: 'timesheets.manage', requiresNote: true },
    { from: ['draft', 'submitted', 'approved'], to: 'invoiced', label: 'Invoice timesheet', permission: 'timesheets.invoice', intent: 'primary',
      guard: ({ record }) => (record.status === 'approved' ? null : 'Only a client-approved timesheet can be invoiced — log the client’s approval first.'),
      after: ({ record, data, api, today }) => {
        const a = assignmentOf(data, str(record, 'assignment'));
        const client = clientOf(data, str(a, 'client'));
        const hours = timesheetHours(record);
        const inv = api.create('invoices', {
          kind: 'contract', client: str(a, 'client'), timesheet: record.id, consultant: str(a, 'consultant'), date: today, dueDate: addDays(today, num(client, 'paymentDays') || 30),
          lines: [{ id: `ln_${record.id}_hrs`, description: `${candidateName(data, str(a, 'candidate'))} — ${str(a, 'role')}, week of ${formatDate(str(record, 'weekStart'))}`, qty: hours, unitPrice: num(a, 'chargeRate') }],
          notes: '',
        }, 'draft', `Raised from timesheet ${record.ref}`);
        api.update('timesheets', record.id, { invoice: inv.id }, `Invoice ${inv.ref} raised (draft)`);
        api.toast(`Invoice ${inv.ref} raised: ${hours} h × ${randOf(num(a, 'chargeRate'))}`, 'info');
      } },
  ],
};

const invoiceWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'issued', label: 'Issued (simulated)', tone: 'blue' },
    { key: 'paid', label: 'Paid / settled', tone: 'green', terminal: true },
    { key: 'void', label: 'Void', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'issued', label: 'Issue (simulated)', permission: 'invoices.manage', intent: 'primary',
      guard: ({ record, data }) => issueProblems(record, data)[0] ?? null,
      after: ({ api }) => api.toast('Recorded as issued — nothing is emailed and nothing is posted to accounting', 'info') },
    { from: 'issued', to: 'paid', label: 'Record payment', permission: 'invoices.manage', intent: 'primary',
      after: ({ record, api, today }) => api.update('invoices', record.id, { paidOn: str(record, 'paidOn') || today }, 'Payment / settlement date recorded') },
    { from: 'draft', to: 'void', label: 'Void draft', permission: 'invoices.manage', requiresNote: true, intent: 'danger' },
  ],
};

/* ---------------- Collections ---------------- */
const collections: CollectionDef[] = [
  {
    key: 'clients', singular: 'Client', plural: 'Clients', refPrefix: 'CLI', workflow: termsWorkflow, editPermission: 'clients.manage',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `${label(SECTORS, str(r, 'sector'))} · ${num(r, 'feePct')}% fee · ${num(r, 'guaranteeMonths')}-month guarantee (${label(REMEDIES, str(r, 'remedy')).toLowerCase()})`,
    sort: (a, b) => str(a, 'name').localeCompare(str(b, 'name')),
    createFields: ['name', 'sector', 'contactName', 'contactRole', 'email', 'phone', 'feePct', 'paymentDays', 'guaranteeMonths', 'remedy', 'owner'],
    createDefaults: () => ({ feePct: 18, paymentDays: 30, guaranteeMonths: 3, remedy: 'replacement' }),
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      const exp = str(r, 'termsExpiry');
      if (r.status === 'signed' && exp && exp < today) out.push({ tone: 'red', label: 'Terms past expiry' });
      else if (r.status === 'signed' && exp && daysBetween(today, exp) <= 30) out.push({ tone: 'amber', label: `Terms expire in ${daysBetween(today, exp)} d` });
      if (r.status === 'sent' && str(r, 'termsSentOn') && daysBetween(str(r, 'termsSentOn'), today) > 7) out.push({ tone: 'amber', label: `Unsigned ${daysBetween(str(r, 'termsSentOn'), today)} days` });
      return out;
    },
    fields: [
      { key: 'name', label: 'Company (fictional)', type: 'text', required: true, wide: true },
      { key: 'sector', label: 'Sector', type: 'select', options: SECTORS, required: true, table: true },
      { key: 'contactName', label: 'Hiring contact (fictional)', type: 'text', required: true, table: true },
      { key: 'contactRole', label: 'Contact’s role', type: 'text' },
      { key: 'email', label: 'Contact email', type: 'text', validate: emailRule },
      { key: 'phone', label: 'Contact phone', type: 'text', validate: phoneRule },
      { key: 'feePct', label: 'Permanent fee %', type: 'number', min: 0, max: 35, step: 0.5, table: true, unit: '%', hint: 'Percentage of the annual package (CTC), excl. VAT.' },
      { key: 'paymentDays', label: 'Payment terms (days)', type: 'number', min: 0, max: 120, unit: 'days' },
      { key: 'guaranteeMonths', label: 'Guarantee period (months)', type: 'number', min: 0, max: 12, unit: 'months' },
      { key: 'remedy', label: 'If a placement leaves inside the guarantee', type: 'select', options: REMEDIES },
      { key: 'termsSentOn', label: 'Terms sent on (simulated)', type: 'date' },
      { key: 'termsSignedOn', label: 'Terms signed on', type: 'date' },
      { key: 'termsExpiry', label: 'Terms expire', type: 'date', table: true },
      { key: 'owner', label: 'Account owner', type: 'ref', ref: 'consultants' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'jobs', singular: 'Job order', plural: 'Job orders', refPrefix: 'JOB', workflow: jobWorkflow, editPermission: 'jobs.manage',
    title: (r) => str(r, 'title'),
    subtitle: (r, d) => `${clientName(d, r.values.client)} · ${randOf(num(r, 'package'))} CTC · ${label(JOB_TYPES, str(r, 'type')).toLowerCase()} · ${consultantName(d, r.values.owner)}`,
    sort: byRefDesc,
    createFields: ['title', 'client', 'discipline', 'location', 'package', 'feePct', 'type', 'priority', 'owner', 'notes'],
    createDefaults: () => ({ type: 'contingent', priority: 'normal' }),
    flags: (r, d, today) => jobFlags(r, d, today),
    fields: [
      { key: 'title', label: 'Role', type: 'text', required: true, wide: true },
      { key: 'client', label: 'Client', type: 'ref', ref: 'clients', required: true, table: true, hint: 'A job order can only be opened once this client’s terms of business are signed and current.' },
      { key: 'discipline', label: 'Discipline', type: 'select', options: DISCIPLINES, required: true, table: true },
      { key: 'location', label: 'Location', type: 'select', options: LOCATIONS },
      { key: 'package', label: 'Annual package (CTC)', type: 'money', min: 0, required: true, table: true },
      { key: 'feePct', label: 'Fee %', type: 'number', min: 0, max: 35, step: 0.5, unit: '%', permission: 'fees.view', hint: 'Leave blank to use the client’s terms of business.' },
      { key: 'type', label: 'Exclusive or contingent', type: 'select', options: JOB_TYPES, required: true },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, required: true },
      { key: 'owner', label: 'Owner consultant', type: 'ref', ref: 'consultants', required: true, table: true, refFilter: (c) => str(c, 'role') !== 'resourcer' },
      { key: 'openedOn', label: 'Opened on', type: 'date' },
      { key: 'filledOn', label: 'Filled on', type: 'date' },
      { key: 'replacementFor', label: 'Free replacement for', type: 'ref', ref: 'placements' },
      { key: 'notes', label: 'Brief / notes', type: 'textarea' },
    ],
  },
  {
    key: 'candidates', singular: 'Candidate', plural: 'Candidates', refPrefix: 'CAN', workflow: candidateWorkflow, editPermission: 'candidates.manage',
    title: (r) => fullName(r),
    subtitle: (r) => `${str(r, 'headline')} · ${label(LOCATIONS, str(r, 'location'))} · notice ${label(NOTICE_PERIODS, str(r, 'notice')).toLowerCase()}`,
    sort: byRefDesc,
    createFields: ['firstName', 'lastName', 'email', 'phone', 'discipline', 'headline', 'skills', 'location', 'source', 'owner'],
    createDefaults: () => ({ source: 'database', consentShare: false }),
    flags: (r, d, today) => candidateFlags(r, d, today),
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'lastName', label: 'Surname', type: 'text', required: true },
      { key: 'email', label: 'Email (fictional)', type: 'text', required: true, validate: emailRule, hint: 'Same email or phone as another candidate is flagged as a possible duplicate.' },
      { key: 'phone', label: 'Mobile (fictional)', type: 'text', required: true, validate: phoneRule },
      { key: 'discipline', label: 'Discipline', type: 'select', options: DISCIPLINES, required: true, table: true },
      { key: 'headline', label: 'Current role', type: 'text', required: true },
      { key: 'skills', label: 'Key skills', type: 'textarea', placeholder: 'IFRS, consolidations, SAP …' },
      { key: 'currentPackage', label: 'Current package (CTC)', type: 'money', min: 0 },
      { key: 'expectedPackage', label: 'Expected package (CTC)', type: 'money', min: 0, table: true },
      { key: 'notice', label: 'Notice period', type: 'select', options: NOTICE_PERIODS, table: true },
      { key: 'location', label: 'Location', type: 'select', options: LOCATIONS, required: true },
      { key: 'source', label: 'Source', type: 'select', options: SOURCES, required: true },
      { key: 'consentGiven', label: 'POPIA consent given on', type: 'date' },
      { key: 'consentExpiry', label: 'Consent valid until', type: 'date', table: true },
      { key: 'consentShare', label: 'Consents to CV being shared with clients', type: 'boolean' },
      { key: 'owner', label: 'Candidate owner', type: 'ref', ref: 'consultants' },
      { key: 'notes', label: 'Screening notes', type: 'textarea' },
    ],
  },
  {
    key: 'submissions', singular: 'Submission', plural: 'Submissions', refPrefix: 'SUB', workflow: submissionWorkflow, editPermission: 'longlist',
    title: (r, d) => candidateName(d, r.values.candidate),
    subtitle: (r, d) => `${jobTitle(d, r.values.job)}${str(r, 'submittedOn') ? ` · sent ${formatDate(str(r, 'submittedOn'))} by ${consultantName(d, r.values.submittedBy)}` : ' · not sent'}`,
    sort: byRefDesc,
    flags: (r, d, today) => {
      const out: Flag[] = [];
      if (r.status === 'longlist') {
        const p = sendCvProblems(r, d, today);
        if (p.some((x) => x.includes('ownership rule'))) out.push({ tone: 'red', label: 'Ownership rule' });
        if (p.some((x) => x.includes('consent'))) out.push({ tone: 'red', label: 'Consent needed' });
      }
      if (r.status === 'offer' && num(r, 'offerPackage') < num(candidateOf(d, str(r, 'candidate')), 'expectedPackage')) out.push({ tone: 'amber', label: 'Offer below expectation' });
      if (['submitted', 'reviewing'].includes(r.status ?? '') && str(r, 'submittedOn') && daysBetween(str(r, 'submittedOn'), today) > 7) out.push({ tone: 'amber', label: `No client feedback ${daysBetween(str(r, 'submittedOn'), today)} d` });
      if (SUB_LIVE.includes(r.status ?? '') && jobOf(d, str(r, 'job'))?.status === 'filled') out.push({ tone: 'dark', label: 'Job filled — close this off' });
      return out;
    },
    fields: [
      { key: 'candidate', label: 'Candidate', type: 'ref', ref: 'candidates', required: true },
      { key: 'job', label: 'Job order', type: 'ref', ref: 'jobs', required: true, table: true },
      { key: 'longlistedBy', label: 'Longlisted by', type: 'ref', ref: 'consultants' },
      { key: 'submittedBy', label: 'CV sent by', type: 'ref', ref: 'consultants', table: true },
      { key: 'submittedOn', label: 'CV sent on', type: 'date', table: true },
      { key: 'offerPackage', label: 'Offered package (CTC)', type: 'money', min: 0 },
      { key: 'offerStart', label: 'Agreed start date', type: 'date' },
      { key: 'offerMadeOn', label: 'Offer made on', type: 'date' },
      { key: 'acceptedOn', label: 'Offer accepted on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'interviews', singular: 'Interview', plural: 'Interviews', refPrefix: 'INT', workflow: interviewWorkflow, editPermission: 'interviews',
    title: (r, d) => `${candidateName(d, str(submissionOf(d, str(r, 'submission')), 'candidate'))} — ${label(ROUNDS, str(r, 'round')).toLowerCase()}`,
    subtitle: (r, d) => `${formatDate(str(r, 'date'))} ${str(r, 'time')} · ${jobTitle(d, str(submissionOf(d, str(r, 'submission')), 'job'))}`,
    sort: (a, b) => (str(b, 'date') + str(b, 'time')).localeCompare(str(a, 'date') + str(a, 'time')),
    flags: (r, d, today) => {
      const out: Flag[] = [];
      if (r.status !== 'scheduled') return out;
      const sub = submissionOf(d, str(r, 'submission'));
      const clash = interviewClash(d, { candidate: str(sub, 'candidate'), date: str(r, 'date'), time: str(r, 'time'), duration: num(r, 'duration'), excludeId: r.id });
      if (clash) out.push({ tone: 'red', label: `Clashes with ${clash.ref}` });
      if (str(r, 'date') < today) out.push({ tone: 'red', label: 'Feedback outstanding' });
      else if (str(r, 'date') === today) out.push({ tone: 'accent', label: 'Today' });
      return out;
    },
    fields: [
      { key: 'submission', label: 'Submission', type: 'ref', ref: 'submissions', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'time', label: 'Time', type: 'time', required: true, table: true },
      { key: 'duration', label: 'Duration', type: 'number', min: 15, max: 480, step: 15, unit: 'min' },
      { key: 'format', label: 'Format', type: 'select', options: FORMATS, required: true, table: true },
      { key: 'round', label: 'Round', type: 'select', options: ROUNDS, required: true },
      { key: 'interviewer', label: 'Client interviewer (fictional)', type: 'text', required: true },
      { key: 'location', label: 'Where / link (fictional)', type: 'text' },
      { key: 'rating', label: 'Client rating', type: 'select', options: RATINGS, table: true },
      { key: 'outcome', label: 'Outcome', type: 'select', options: OUTCOMES },
      { key: 'feedback', label: 'Client feedback', type: 'textarea' },
      { key: 'reminderLogged', label: 'Reminder logged (not sent)', type: 'date' },
    ],
  },
  {
    key: 'placements', singular: 'Placement', plural: 'Placements', refPrefix: 'PLC', workflow: placementWorkflow, editPermission: 'placements.manage',
    title: (r, d) => candidateName(d, r.values.candidate),
    subtitle: (r, d) => `${jobTitle(d, r.values.job)} · starts ${formatDate(str(r, 'startDate'))}`,
    sort: (a, b) => str(b, 'acceptedOn').localeCompare(str(a, 'acceptedOn')),
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      if (r.status === 'started') {
        const left = daysBetween(today, str(r, 'guaranteeEnd'));
        if (left < 0) out.push({ tone: 'accent', label: 'Guarantee ended — mark passed' });
        else out.push({ tone: left <= 14 ? 'amber' : 'dark', label: `Guarantee ${left} d left` });
      }
      if (r.status === 'accepted' && str(r, 'startDate') <= today) out.push({ tone: 'amber', label: 'Start date reached — confirm start' });
      if (num(r, 'fee') === 0) out.push({ tone: 'blue', label: 'Free replacement' });
      return out;
    },
    fields: [
      { key: 'submission', label: 'Submission', type: 'ref', ref: 'submissions', required: true },
      { key: 'candidate', label: 'Candidate', type: 'ref', ref: 'candidates', required: true },
      { key: 'job', label: 'Job order', type: 'ref', ref: 'jobs', required: true },
      { key: 'client', label: 'Client', type: 'ref', ref: 'clients', required: true, table: true },
      { key: 'consultant', label: 'Consultant credited', type: 'ref', ref: 'consultants', table: true },
      { key: 'acceptedOn', label: 'Offer accepted on', type: 'date' },
      { key: 'startDate', label: 'Start date', type: 'date', required: true, table: true },
      { key: 'package', label: 'Annual package (CTC)', type: 'money', min: 0, required: true },
      { key: 'feePct', label: 'Fee %', type: 'number', min: 0, max: 35, step: 0.5, unit: '%', permission: 'fees.view' },
      { key: 'fee', label: 'Fee (excl. VAT)', type: 'money', min: 0, table: true, permission: 'fees.view' },
      { key: 'guaranteeMonths', label: 'Guarantee (months)', type: 'number', min: 0, max: 12, unit: 'months' },
      { key: 'guaranteeEnd', label: 'Guarantee ends', type: 'date', table: true },
      { key: 'remedy', label: 'If they leave inside the guarantee', type: 'select', options: REMEDIES },
      { key: 'fellOffOn', label: 'Left on', type: 'date' },
      { key: 'invoice', label: 'Fee invoice', type: 'ref', ref: 'invoices' },
      { key: 'creditNote', label: 'Credit note', type: 'ref', ref: 'invoices' },
      { key: 'replacementJob', label: 'Replacement job order', type: 'ref', ref: 'jobs' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'assignments', singular: 'Contractor assignment', plural: 'Contractor assignments', refPrefix: 'ASG', workflow: assignmentWorkflow, editPermission: 'assignments.manage',
    title: (r, d) => candidateName(d, r.values.candidate),
    subtitle: (r, d) => `${str(r, 'role')} · ${clientName(d, r.values.client)} · ${formatDate(str(r, 'startDate'))} – ${formatDate(str(r, 'endDate'))}`,
    sort: byRefDesc,
    createDefaults: (today) => ({ startDate: today, endDate: addDays(today, 90), hoursPerWeek: 40 }),
    flags: (r, d, today) => assignmentFlags(r, d, today),
    fields: [
      { key: 'candidate', label: 'Contractor', type: 'ref', ref: 'candidates', required: true },
      { key: 'client', label: 'Client', type: 'ref', ref: 'clients', required: true, table: true },
      { key: 'role', label: 'Role', type: 'text', required: true, table: true },
      { key: 'consultant', label: 'Consultant', type: 'ref', ref: 'consultants' },
      { key: 'payRate', label: 'Pay rate per hour', type: 'money', min: 0, required: true, table: true },
      { key: 'chargeRate', label: 'Charge rate per hour', type: 'money', min: 0, required: true, table: true,
        validate: (v, all) => (Number(v) > 0 && Number(all.payRate) > 0 && Number(v) <= Number(all.payRate) ? 'The charge rate must be above the pay rate.' : null) },
      { key: 'hoursPerWeek', label: 'Contracted hours per week', type: 'number', min: 1, max: 60, unit: 'h' },
      { key: 'startDate', label: 'Start date', type: 'date', required: true, table: true },
      { key: 'endDate', label: 'End date', type: 'date', required: true, table: true,
        validate: (v, all) => (all.startDate && String(v) < String(all.startDate) ? 'The end date is before the start date.' : null) },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'timesheets', singular: 'Timesheet', plural: 'Timesheets', refPrefix: 'TS', workflow: timesheetWorkflow, editPermission: 'timesheets.manage',
    title: (r, d) => `${candidateName(d, str(assignmentOf(d, str(r, 'assignment')), 'candidate'))} — week of ${formatDate(str(r, 'weekStart'))}`,
    subtitle: (r, d) => `${timesheetHours(r)} h · ${clientName(d, str(assignmentOf(d, str(r, 'assignment')), 'client'))}`,
    sort: (a, b) => str(b, 'weekStart').localeCompare(str(a, 'weekStart')) || b.ref.localeCompare(a.ref),
    createFields: ['assignment', 'weekStart'],
    createDefaults: (today) => ({ weekStart: mondayOf(today), h0: 0, h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 }),
    flags: (r, d, today) => {
      const out: Flag[] = [];
      if (overCap(r)) out.push({ tone: 'red', label: `${timesheetHours(r)} h — above the ${WEEKLY_HOURS_CAP} h weekly cap` });
      if (r.status === 'draft' && str(r, 'weekStart') && addDays(str(r, 'weekStart'), 7) < today) out.push({ tone: 'amber', label: 'Week over — submit' });
      if (r.status === 'submitted' && submitTimesheetProblems(r, d, today).length) out.push({ tone: 'red', label: 'Hours outside the assignment' });
      return out;
    },
    fields: [
      { key: 'assignment', label: 'Contractor assignment', type: 'ref', ref: 'assignments', required: true, refFilter: (a) => ['pending', 'active'].includes(a.status ?? '') },
      { key: 'weekStart', label: 'Week starting (Monday)', type: 'date', required: true, table: true, validate: (v) => (isMonday(String(v)) ? null : 'Choose the Monday the week starts on.') },
      { key: 'h0', label: 'Mon', type: 'number', hidden: true }, { key: 'h1', label: 'Tue', type: 'number', hidden: true }, { key: 'h2', label: 'Wed', type: 'number', hidden: true },
      { key: 'h3', label: 'Thu', type: 'number', hidden: true }, { key: 'h4', label: 'Fri', type: 'number', hidden: true }, { key: 'h5', label: 'Sat', type: 'number', hidden: true },
      { key: 'h6', label: 'Sun', type: 'number', hidden: true },
      { key: 'invoice', label: 'Invoice', type: 'ref', ref: 'invoices' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'invoices', singular: 'Invoice', plural: 'Invoices & credit notes', refPrefix: 'INV', workflow: invoiceWorkflow, editPermission: 'invoices.manage',
    title: (r, d) => clientName(d, r.values.client),
    subtitle: (r) => { const t = invoiceTotals(r); return `${label(INVOICE_KINDS, str(r, 'kind'))} · ${randc(t.sign * t.total)} incl. VAT`; },
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || b.ref.localeCompare(a.ref),
    createFields: ['kind', 'client', 'creditFor', 'consultant', 'date', 'dueDate', 'lines', 'notes'],
    createDefaults: (today) => ({ kind: 'fee', date: today, dueDate: addDays(today, 30), lines: [] }),
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      if (invoiceOverdue(r, today)) out.push({ tone: 'red', label: `Overdue ${daysBetween(str(r, 'dueDate'), today)} days` });
      if (str(r, 'kind') === 'credit') out.push({ tone: 'dark', label: 'Credit note' });
      return out;
    },
    fields: [
      { key: 'kind', label: 'Type', type: 'select', options: INVOICE_KINDS, required: true, table: true },
      { key: 'client', label: 'Client', type: 'ref', ref: 'clients', required: true },
      { key: 'placement', label: 'Placement', type: 'ref', ref: 'placements' },
      { key: 'timesheet', label: 'Timesheet', type: 'ref', ref: 'timesheets' },
      { key: 'creditFor', label: 'Credit note against', type: 'ref', ref: 'invoices', refFilter: (i) => str(i, 'kind') === 'fee' },
      { key: 'consultant', label: 'Consultant credited', type: 'ref', ref: 'consultants' },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'dueDate', label: 'Due', type: 'date', required: true, table: true },
      { key: 'paidOn', label: 'Paid / settled on', type: 'date', table: true },
      { key: 'lines', label: 'Lines (excl. VAT)', type: 'lines', wide: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'consultants', singular: 'Consultant', plural: 'Consultants', refPrefix: 'CON', editPermission: 'targets.manage',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `${label(CONSULTANT_ROLES, str(r, 'role'))}${num(r, 'monthlyTarget') ? ` · target ${randOf(num(r, 'monthlyTarget'))}/month` : ''}`,
    sort: (a, b) => a.ref.localeCompare(b.ref),
    fields: [
      { key: 'name', label: 'Name (fictional)', type: 'text', required: true },
      { key: 'role', label: 'Role', type: 'select', options: CONSULTANT_ROLES, required: true, table: true },
      { key: 'discipline', label: 'Desk', type: 'select', options: DISCIPLINES, table: true },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'monthlyTarget', label: 'Monthly fee target (excl. VAT)', type: 'money', min: 0, table: true },
      { key: 'userId', label: 'Demo user', type: 'text', hidden: true },
    ],
  },
];

/* ---------------- Configuration ---------------- */
const config: IndustryConfig = {
  id: 'recruitment',
  industry: 'Recruitment agency',
  businessName: 'Fynbos Talent Partners',
  monogram: 'FT',
  workspaceTag: 'RECRUITMENT DESK',
  tagline: 'Permanent placements and a contractor desk for finance, IT, engineering and sales roles',
  summary: 'A specialist recruitment agency: client terms of business gate every job order, POPIA consent and a six-month ownership rule gate every CV sent, a pipeline board per job takes candidates from longlist to accepted offer, placements raise fee invoices and pro-rata credit notes, and a contractor desk runs weekly timesheets through client approval to invoice.',
  priority: 14,
  theme: { accent: '#11728d', accent2: '#1588a8', accentSoft: '#a5dae9', accentTint: '#ecf6f9', accentLine: '#cfe6ed', accentText: '#0e5c71' },
  roles: [
    { key: 'director', label: 'Director' },
    { key: 'senior', label: 'Senior consultant' },
    { key: 'consultant', label: 'Consultant' },
    { key: 'resourcer', label: 'Resourcer' },
    { key: 'contracts', label: 'Contracts & timesheet administrator' },
    { key: 'finance', label: 'Finance' },
  ],
  permissions: [
    { key: 'clients.manage', label: 'Manage clients', description: 'Add and edit client companies, contacts and their fee, payment and guarantee terms' },
    { key: 'terms.manage', label: 'Terms of business', description: 'Send terms of business (simulated) and record the signed copy and expiry' },
    { key: 'jobs.manage', label: 'Job orders', description: 'Open, progress, hold and close job orders' },
    { key: 'candidates.manage', label: 'Candidates', description: 'Capture and screen candidates and record POPIA consent' },
    { key: 'longlist', label: 'Longlist candidates', description: 'Add candidates to a job’s longlist and withdraw them' },
    { key: 'submit', label: 'Send CVs & manage offers', description: 'Send CVs to clients (simulated) and move submissions through interviews, offers and acceptance' },
    { key: 'interviews', label: 'Interviews', description: 'Book client interviews, log reminders and capture feedback' },
    { key: 'placements.manage', label: 'Placements', description: 'Confirm starts, record fall-offs and guarantee outcomes' },
    { key: 'fees.view', label: 'See fees', description: 'See fee percentages, placement fees and consultant fee figures' },
    { key: 'assignments.manage', label: 'Contractor assignments', description: 'Set up contractor assignments with pay and charge rates' },
    { key: 'timesheets.manage', label: 'Timesheets', description: 'Capture and submit weekly timesheets and log client approval (simulated)' },
    { key: 'timesheets.invoice', label: 'Invoice timesheets', description: 'Raise contractor invoices from client-approved timesheets' },
    { key: 'invoices.manage', label: 'Invoices', description: 'Issue invoices and credit notes (simulated) and record payments' },
    { key: 'targets.manage', label: 'Consultant targets', description: 'Edit consultants and their monthly fee targets' },
  ],
  modules: [
    { key: 'jobs', label: 'Job orders', icon: IcoBriefcase, group: 'Desk', collection: 'jobs', detail: JobDetail, description: 'Draft → open → sourcing → shortlist sent → interviewing → offer → filled. A job only opens once the client’s terms of business are signed and current; filled needs an accepted offer.' },
    { key: 'pipeline', label: 'Pipeline', icon: IcoBoard, group: 'Desk', collection: 'submissions', page: PipelinePage, detail: SubmissionDetail, description: 'A board per job: longlist → CV sent → client reviewing → interview → final → offer → accepted. CVs need current POPIA consent and pass the six-month ownership rule.' },
    { key: 'candidates', label: 'Candidates', icon: IcoUsers, group: 'Desk', collection: 'candidates', detail: CandidateDetail, description: 'Skills, packages, notice and source, with POPIA consent dates (illustrative) and duplicate warnings on the same email or phone.' },
    { key: 'interviews', label: 'Interviews', icon: IcoCalendar, group: 'Desk', collection: 'interviews', page: Interviews, detail: InterviewDetail, description: 'Client interviews with a clash check per candidate, feedback capture and reminders that are previewed and logged, never sent.' },
    { key: 'clients', label: 'Clients & terms', icon: IcoDoc, group: 'Clients & placements', collection: 'clients', detail: ClientDetail, description: 'Client companies and contacts with terms of business: fee %, payment terms, guarantee period and what happens if a placement leaves inside it.' },
    { key: 'placements', label: 'Placements', icon: IcoShield, group: 'Clients & placements', collection: 'placements', page: Placements, detail: PlacementDetail, description: 'Offer accepted → started → guarantee passed, or fell off. Starting raises the fee invoice; a fall-off inside the guarantee raises a pro-rata credit note or a free replacement job.' },
    { key: 'contractors', label: 'Contractors', icon: IcoBadge, group: 'Contractor desk', collection: 'assignments', page: Contractors, detail: AssignmentDetail, description: 'Contractor assignments with pay rate, charge rate and margin, plus an illustrative flag modelled on LRA s198A for lower earners approaching three months.' },
    { key: 'timesheets', label: 'Timesheets', icon: IcoTimer, group: 'Contractor desk', collection: 'timesheets', page: Timesheets, detail: TimesheetDetail, description: `Weekly timesheets: draft → submitted → client approved (simulated) → invoiced. Hours must fall inside the assignment; weeks above ${WEEKLY_HOURS_CAP} h are flagged.` },
    { key: 'invoices', label: 'Invoices', icon: IcoReceipt, group: 'Finance', collection: 'invoices', page: Invoices, detail: InvoiceDetail, description: 'Placement fee invoices, contractor invoices and credit notes with VAT at 15%: draft → issued → paid, with overdue flags. Demonstration documents, not tax invoices.' },
    { key: 'reports', label: 'Consultants & reports', icon: IcoChart, group: 'Finance', collection: 'consultants', page: Reports, description: 'Fees billed against target per consultant (month and quarter), the submission-to-placement funnel, time to fill and the weighted pipeline.' },
  ],
  collections,
  seed: buildRecruitmentSeed,
  dashboard: Dashboard,
  boundaries: [
    'Nothing is sent: CVs, terms of business, interview reminders, invoices and credit notes are recorded as “sent” or previewed only — no email, SMS or WhatsApp leaves the browser.',
    'No job-board, LinkedIn, careers-site or email integration, and no CV parsing: candidates and jobs are typed in by hand.',
    'POPIA consent tracking is an illustration of a consent rule, not a POPIA compliance tool, and is not legal advice.',
    'The contractor flag modelled on LRA section 198A uses an illustrative earnings figure and a simple three-month count. It is not the current legal threshold and is not legal advice.',
    'Invoices and credit notes are demonstration documents, not tax invoices. VAT at 15% is a demo default and nothing is posted to an accounting system. No payments are processed.',
    'Timesheet approval by the client is simulated: a staff member logs who approved. There is no client portal.',
    'The six-month ownership rule, fee percentages, guarantee terms, weekly hours cap and stage probabilities are demo settings.',
    'All people, companies, contact details and amounts are fictional.',
  ],
  guide: [
    { title: 'Open a job order', detail: '“Open job order” is refused: the client has not signed the terms of business. Press “Record signed terms” right there on the job, then “Open job order”.', to: 'jobs/jobs_1', as: 'u_senior' },
    { title: 'Send CVs from the pipeline board', detail: 'On the board, one longlisted CV is blocked by expired POPIA consent and one by the six-month ownership rule (it says who sent it and when). Record the consent on the card, then “Send CV”.', to: 'jobs/jobs_2', as: 'u_cons' },
    { title: 'Book an interview without a clash', detail: 'Use “Book interview”. Try the same slot as the candidate’s other interview (listed beside the form) — it is refused as a clash; pick another time and the submission moves to Interview.', to: 'pipeline/submissions_5', as: 'u_res' },
    { title: 'Make and accept an offer', detail: '“Make offer” needs a package and start date — fill in “Offer details”. Then “Offer accepted”: a placement is created and the job is marked filled.', to: 'pipeline/submissions_4', as: 'u_cons' },
    { title: 'Handle a fall-off inside the guarantee', detail: 'Record the leaving date, then “Fell off in guarantee”. This client’s terms give a pro-rata refund, so a credit note is raised for the unused part of the guarantee.', to: 'placements/placements_1', as: 'u_senior' },
    { title: 'Approve and invoice a timesheet', detail: 'This week is above the 45-hour cap. “Invoice timesheet” is refused until the client’s approval is logged — log it, then invoice: a draft contractor invoice is raised.', to: 'timesheets/timesheets_1', as: 'u_contracts' },
  ],
  highlights: [
    'Job orders only open on signed, current terms of business',
    'Pipeline board per job with POPIA consent and a six-month ownership rule on every CV',
    'Accepted offer → placement → fee invoice; fall-offs raise a pro-rata credit note or free replacement',
    'Contractor timesheets: approval before invoice, weekly cap and an illustrative s198A flag',
  ],
};

export default config;
