// Human resources demo. Fictional company: Bluegum Distribution, a South African food-and-beverage
// distributor with a head office and depots in Johannesburg, Durban and Gqeberha. The in-house HR
// team runs employees, onboarding, leave, payroll inputs, hiring, reviews, discipline and training.
import type { CollectionDef, Flag, IndustryConfig, WorkflowDef } from '../../core/types';
import { findRecord, num, records, str } from '../../core/engine';
import { addDays, daysBetween, formatDate, monthLabel } from '../../core/lib/dates';
import {
  IcoBriefcase, IcoCalendar, IcoCap, IcoChart, IcoCheck, IcoClock, IcoDoc, IcoFlag, IcoGrid, IcoScale, IcoShield, IcoUsers, IcoWallet,
} from '../../core/components/Icons';
import {
  APPLICANT_SOURCES, CASE_CATEGORIES, CASE_KINDS, CERT_TYPES, EMPLOYMENT_TYPES, FINDINGS, INPUT_KINDS, JOBS, LEAVE_TYPES, RATINGS, REQ_REASONS, SANCTIONS, SITES,
  WARNING_MONTHS, label,
} from './data';
import { buildHrSeed } from './seed';
import {
  addMonths, approveProblem, approvePackProblem, approverProblem, cancelProblem, certFlags, certLabel, courseCompleteProblem, employeeFlags, exitProblem, fmtDays,
  fullName, hearingProblem, hireProblem, isCurrent, jobLabel, leaveDays, leaveFlags, leaveShort, LOCKED_PACK, managerReviewerProblem, nextWorkingDay, noticeProblem,
  offerProblem, openReqProblem, outcomeProblem, packIssues, packRows, packSnapshot, periodOf, pipProblem, probationProblem, empName, siteShort, startProblem,
  todayStr, warningExpiry, attended, finalRating,
} from './helpers';
export * from './helpers';
import Dashboard from './pages/Dashboard';
import EmployeeProfile from './pages/EmployeeProfile';
import Onboarding from './pages/Onboarding';
import LeaveDetail from './pages/LeaveDetail';
import LeaveRegister from './pages/LeaveRegister';
import WhosAway from './pages/WhosAway';
import MyLeave from './pages/MyLeave';
import PayrunDetail from './pages/PayrunDetail';
import RequisitionDetail from './pages/RequisitionDetail';
import ApplicantDetail from './pages/ApplicantDetail';
import ReviewDetail from './pages/ReviewDetail';
import CasesPage from './pages/CasesPage';
import CaseDetail from './pages/CaseDetail';
import CourseDetail from './pages/CourseDetail';
import Reports from './pages/Reports';

const opt = (list: ReadonlyArray<{ value: string; label: string }>) => list.map(({ value, label: l }) => ({ value, label: l }));
const phoneRule = (v: unknown) => (/^0\d{2} \d{3} \d{4}$/.test(String(v)) ? null : 'Use the format 0xx xxx xxxx.');
const emailRule = (v: unknown) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : 'Enter a valid email address.');
const periodRule = (v: unknown) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v)) ? null : 'Use the form YYYY-MM.');
const notBefore = (other: string, what: string) => (v: unknown, values: Record<string, unknown>) => (values[other] && String(v) < String(values[other]) ? `${what}` : null);

/* ------------------------------------------------------------------ */
const employeeWorkflow: WorkflowDef = {
  initial: 'onboarding',
  states: [
    { key: 'onboarding', label: 'Onboarding', tone: 'blue', hint: 'Hired, not yet started' },
    { key: 'probation', label: 'Probation', tone: 'amber' },
    { key: 'active', label: 'Active', tone: 'green' },
    { key: 'notice', label: 'On notice', tone: 'red' },
    { key: 'exited', label: 'Exited', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'onboarding', to: 'probation', label: 'Start employment', permission: 'employees.manage', intent: 'primary', guard: ({ record }) => startProblem(record, todayStr()),
      after: ({ record, api }) => api.toast(`${fullName(record)} has started — probation runs to ${formatDate(str(record, 'probationEnd') || addMonths(str(record, 'startDate'), 3))}`) },
    { from: 'probation', to: 'active', label: 'Confirm appointment', permission: 'employees.manage', intent: 'primary', guard: ({ record }) => probationProblem(record) },
    { from: ['probation', 'active'], to: 'notice', label: 'Record notice', permission: 'employees.manage', intent: 'danger', guard: ({ record }) => noticeProblem(record, todayStr()) },
    { from: 'notice', to: 'active', label: 'Withdraw notice', permission: 'employees.manage', requiresNote: true, noteHint: 'why the notice was withdrawn and who agreed',
      after: ({ record, api }) => api.update('employees', record.id, { exitReason: '', lastDay: '', exitEquipment: false, exitAccess: false }) },
    { from: 'notice', to: 'exited', label: 'Complete exit', permission: 'employees.manage', intent: 'primary', guard: ({ record }) => exitProblem(record, todayStr()) },
  ],
};

const leaveWorkflow: WorkflowDef = {
  initial: 'requested',
  states: [
    { key: 'requested', label: 'Awaiting approval', tone: 'amber' },
    { key: 'approved', label: 'Approved', tone: 'green' },
    { key: 'taken', label: 'Taken', tone: 'dark', terminal: true },
    { key: 'declined', label: 'Declined', tone: 'red', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'requested', to: 'approved', label: 'Approve', permission: 'leave.approve', intent: 'primary',
      guard: ({ record, data, user, note }) => approveProblem(data, user, record, todayStr(), note),
      after: ({ record, data, api, user, note }) => {
        api.update('leave', record.id, { decidedBy: user.name, coverNote: note ?? '' }, 'Approval message to the employee previewed — not sent');
        api.toast(`${empName(data, record.values.employee)}: ${leaveShort(str(record, 'type')).toLowerCase()} leave approved (${fmtDays(leaveDays(record))} days)`);
      } },
    { from: 'requested', to: 'declined', label: 'Decline', permission: 'leave.approve', intent: 'danger', requiresNote: true, noteHint: 'why — the employee sees this reason',
      guard: ({ record, data, user }) => approverProblem(data, user, record),
      after: ({ record, api, user }) => api.update('leave', record.id, { decidedBy: user.name }) },
    { from: 'approved', to: 'taken', label: 'Mark as taken', permission: 'leave.hr',
      guard: ({ record }) => (str(record, 'start') <= todayStr() ? null : `This leave starts on ${formatDate(str(record, 'start'))} — it can be marked as taken from its first day.`) },
    { from: ['requested', 'approved'], to: 'cancelled', label: 'Cancel request', permission: 'leave.request', requiresNote: true, noteHint: 'why the leave is no longer needed',
      guard: ({ record, data, user }) => cancelProblem(data, user, record, todayStr()) },
  ],
};

const payrunWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'checked', label: 'Checked', tone: 'blue' },
    { key: 'approved', label: 'Approved · locked', tone: 'accent' },
    { key: 'sent', label: 'Sent to payroll', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'checked', label: 'Mark as checked', permission: 'payroll.prepare', intent: 'primary',
      guard: ({ record }) => (str(record, 'period') > periodOf(todayStr()) ? 'A future pay period cannot be checked yet.' : null),
      after: ({ record, api, user }) => api.update('payruns', record.id, { checkedBy: user.name }) },
    { from: 'checked', to: 'draft', label: 'Return to draft', permission: 'payroll.prepare', requiresNote: true, noteHint: 'what needs correcting' ,
      after: ({ record, api }) => api.update('payruns', record.id, { checkedBy: '' }) },
    { from: 'checked', to: 'approved', label: 'Approve inputs', permission: 'payroll.approve', intent: 'primary',
      guard: ({ record, data, user }) => approvePackProblem(data, record, user),
      after: ({ record, data, api, user }) => {
        api.update('payruns', record.id, { approvedBy: user.name, snapshot: packSnapshot(packRows(data, str(record, 'period'))) }, 'Inputs approved and locked');
        api.toast(`${monthLabel(str(record, 'period'))} payroll inputs approved and locked`);
      } },
    { from: 'approved', to: 'sent', label: 'Send to payroll (simulated)', permission: 'payroll.prepare', intent: 'primary',
      after: ({ record, api, today }) => api.update('payruns', record.id, { sentOn: today }, 'Marked as sent to the payroll bureau — simulated, nothing was transmitted') },
  ],
};

const requisitionWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Awaiting approval', tone: 'amber' },
    { key: 'open', label: 'Open', tone: 'blue' },
    { key: 'filled', label: 'Filled', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'open', label: 'Approve & open', permission: 'hiring', intent: 'primary', guard: ({ record, user }) => openReqProblem(record, user) },
    { from: 'open', to: 'filled', label: 'Mark as filled', permission: 'hiring',
      guard: ({ record, data }) => (records(data, 'applicants').some((a) => str(a, 'requisition') === record.id && a.status === 'hired') ? null : 'No applicant has been hired for this requisition yet.') },
    { from: ['draft', 'open'], to: 'cancelled', label: 'Cancel requisition', permission: 'hiring', intent: 'danger', requiresNote: true },
  ],
};

const applicantWorkflow: WorkflowDef = {
  initial: 'applied',
  states: [
    { key: 'applied', label: 'Applied', tone: 'dark' },
    { key: 'shortlisted', label: 'Shortlisted', tone: 'blue' },
    { key: 'interviewed', label: 'Interviewed', tone: 'accent' },
    { key: 'offer', label: 'Offer made', tone: 'amber' },
    { key: 'hired', label: 'Hired', tone: 'green', terminal: true },
    { key: 'declined', label: 'Not proceeding', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'applied', to: 'shortlisted', label: 'Shortlist', permission: 'hiring', intent: 'primary' },
    { from: 'shortlisted', to: 'interviewed', label: 'Record interview', permission: 'hiring', intent: 'primary',
      guard: ({ record }) => (str(record, 'interviewDate') && str(record, 'interviewScore') ? null : 'Record the interview date and score first, under “Interview” on this page.') },
    { from: 'interviewed', to: 'offer', label: 'Make offer', permission: 'hiring', intent: 'primary',
      guard: ({ record, data }) => (num(record, 'interviewScore') <= 2 ? 'An interview score of 2 or less is below the bar for an offer (demo rule).' : offerProblem(record, data)),
      after: ({ record, api }) => api.update('applicants', record.id, {}, 'Offer letter previewed — not sent (simulated)') },
    { from: 'offer', to: 'hired', label: 'Mark as hired', permission: 'hiring', intent: 'primary', guard: ({ record, data }) => hireProblem(record, data),
      after: ({ record, data, api }) => {
        const req = findRecord(data, 'requisitions', str(record, 'requisition'));
        if (!req) return;
        const start = str(record, 'startDate');
        const e = api.create('employees', {
          firstName: str(record, 'firstName'), lastName: str(record, 'lastName'), job: str(req, 'job'), site: str(req, 'site'), manager: str(req, 'hiringManager'),
          startDate: start, employmentType: 'permanent', fixedTermEnd: '', probationEnd: addMonths(start, 3), salary: num(record, 'offerSalary'), annualCarry: 0,
          phone: str(record, 'phone'), email: str(record, 'email'), onboarding: 'contract', probationOutcome: '', probationReviewDate: '', probationNotes: '',
          exitReason: '', lastDay: '', exitEquipment: false, exitAccess: false, exitNotes: '', hrNotes: `Hired through ${req.ref} (${record.ref}).`,
        }, 'onboarding', `Created from applicant ${record.ref} — onboarding checklist opened`);
        api.update('applicants', record.id, { employee: e.id }, `Employee record ${e.ref} created`);
        const filled = api.transition('requisitions', req.id, 'filled', `Filled by ${str(record, 'firstName')} ${str(record, 'lastName')} (${record.ref})`);
        api.toast(`${e.ref} ${str(record, 'firstName')} ${str(record, 'lastName')} added to Onboarding${filled.ok ? ` · ${req.ref} filled` : ''}`);
      } },
    { from: ['applied', 'shortlisted', 'interviewed', 'offer'], to: 'declined', label: 'Not proceeding', permission: 'hiring', intent: 'danger', requiresNote: true, noteHint: 'the reason (kept on file; a regret letter is previewed, not sent)' },
  ],
};

const reviewWorkflow: WorkflowDef = {
  initial: 'self',
  states: [
    { key: 'self', label: 'Self-assessment', tone: 'dark' },
    { key: 'manager', label: 'Manager review', tone: 'blue' },
    { key: 'moderation', label: 'Moderation', tone: 'amber' },
    { key: 'signed', label: 'Signed off', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'self', to: 'manager', label: 'Submit self-assessment', permission: 'reviews', intent: 'primary',
      guard: ({ record }) => (str(record, 'selfRating') ? null : 'Record the employee’s own rating first, under “Self-assessment” on this page.') },
    { from: 'manager', to: 'moderation', label: 'Send to moderation', permission: 'reviews',
      guard: ({ record, data, user }) => managerReviewerProblem(data, user, record)
        ?? (!str(record, 'managerRating') ? 'Record the manager’s rating first, under “Manager review” on this page.' : null)
        ?? (['1', '5'].includes(str(record, 'managerRating')) ? null : 'Only ratings of 1 or 5 go to moderation — this one can be signed off directly.') },
    { from: 'manager', to: 'signed', label: 'Sign off', permission: 'reviews', intent: 'primary',
      guard: ({ record, data, user }) => managerReviewerProblem(data, user, record)
        ?? (!str(record, 'managerRating') ? 'Record the manager’s rating first, under “Manager review” on this page.' : null)
        ?? (['1', '5'].includes(str(record, 'managerRating')) ? `A rating of ${str(record, 'managerRating')} must be moderated before sign-off — press “Send to moderation”.` : null)
        ?? pipProblem(record, num(record, 'managerRating'), todayStr()) },
    { from: 'moderation', to: 'signed', label: 'Sign off after moderation', permission: 'reviews.moderate', intent: 'primary',
      guard: ({ record }) => (!str(record, 'moderatedRating') ? 'Record the moderated rating first, under “Moderation” on this page.' : pipProblem(record, finalRating(record), todayStr())) },
    { from: 'moderation', to: 'manager', label: 'Return to manager', permission: 'reviews.moderate', requiresNote: true, noteHint: 'what the manager should reconsider' },
  ],
};

const caseWorkflow: WorkflowDef = {
  initial: 'reported',
  states: [
    { key: 'reported', label: 'Reported', tone: 'dark' },
    { key: 'investigating', label: 'Investigating', tone: 'blue' },
    { key: 'hearing', label: 'Hearing scheduled', tone: 'amber' },
    { key: 'outcome', label: 'Outcome recorded', tone: 'accent' },
    { key: 'appeal', label: 'Appeal', tone: 'red' },
    { key: 'closed', label: 'Closed', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'reported', to: 'investigating', label: 'Start investigation', permission: 'cases', intent: 'primary',
      guard: ({ record }) => (str(record, 'investigator').trim() ? null : 'Name the investigator first, under “Investigation” on this page.') },
    { from: 'investigating', to: 'hearing', label: 'Schedule hearing', permission: 'cases', intent: 'primary', guard: ({ record }) => hearingProblem(record),
      after: ({ record, api }) => api.update('cases', record.id, {}, `Notice of hearing for ${formatDate(str(record, 'hearingDate'))} previewed — not sent (hand it over in person)`) },
    { from: ['investigating', 'hearing'], to: 'outcome', label: 'Record outcome', permission: 'cases', intent: 'primary', guard: ({ record }) => outcomeProblem(record, todayStr()),
      after: ({ record, data, api, today }) => {
        const sanction = str(record, 'sanction');
        const who = findRecord(data, 'employees', str(record, 'employee'));
        if (str(record, 'finding') !== 'guilty' || !who) return;
        if (WARNING_MONTHS[sanction]) {
          const w = api.create('warnings', { employee: who.id, level: sanction, issued: today, expires: warningExpiry(sanction, today), case: record.id, reason: label(CASE_CATEGORIES, str(record, 'category')) }, undefined, `Issued after ${record.ref}`);
          api.toast(`${label(SANCTIONS, sanction)} ${w.ref} placed on ${fullName(who)}’s file until ${formatDate(warningExpiry(sanction, today))}`);
        }
        if (sanction === 'dismissal' && isCurrent(who) && who.status !== 'notice') {
          api.update('employees', who.id, { exitReason: 'dismissal', lastDay: str(who, 'lastDay') || today, exitNotes: `Dismissed after ${record.ref}.` }, `Exit started after ${record.ref}`);
          const res = api.transition('employees', who.id, 'notice', `Dismissal — ${record.ref}`);
          api.toast(res.ok ? `${fullName(who)} moved to “On notice” — complete the exit checklist on the employee’s page` : `Dismissal recorded, but the exit could not start: ${res.reason}`, res.ok ? 'info' : 'err');
        }
      } },
    { from: 'outcome', to: 'appeal', label: 'Lodge appeal', permission: 'cases', requiresNote: true, noteHint: 'the grounds of appeal',
      after: ({ record, api, note }) => api.update('cases', record.id, { appealNotes: note ?? '' }) },
    { from: 'outcome', to: 'closed', label: 'Close case', permission: 'cases', intent: 'primary' },
    { from: 'appeal', to: 'closed', label: 'Close after appeal', permission: 'cases', intent: 'primary', requiresNote: true, noteHint: 'the appeal result (upheld, varied or dismissed)' },
  ],
};

const courseWorkflow: WorkflowDef = {
  initial: 'planned',
  states: [
    { key: 'planned', label: 'Planned', tone: 'blue' },
    { key: 'completed', label: 'Completed', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'planned', to: 'completed', label: 'Complete course', permission: 'training', intent: 'primary', guard: ({ record }) => courseCompleteProblem(record, todayStr()),
      after: ({ record, data, api }) => {
        const type = str(record, 'certType');
        if (!type) return;
        const months = CERT_TYPES.find((c) => c.value === type)?.months ?? 24;
        const date = str(record, 'date');
        for (const id of attended(record)) {
          const who = findRecord(data, 'employees', id);
          if (!who) continue;
          api.create('certificates', { employee: id, type, number: `DEMO-${type.toUpperCase()}-${record.ref.slice(-4)}${id.replace(/\D/g, '')}`, issued: date, expires: addMonths(date, months), provider: str(record, 'provider') }, undefined, `Issued after ${record.ref}`);
        }
        api.toast(`${attended(record).length} × ${certLabel(type)} issued, valid ${months} months`);
      } },
    { from: 'planned', to: 'cancelled', label: 'Cancel course', permission: 'training', intent: 'danger', requiresNote: true },
  ],
};

const employeeRef = (label_: string, extra: Partial<CollectionDef['fields'][number]> = {}) =>
  ({ key: 'employee', label: label_, type: 'ref' as const, ref: 'employees', required: true, table: true, refFilter: (t: { status?: string }) => t.status !== 'exited', ...extra });

/* ------------------------------------------------------------------ */
const collections: CollectionDef[] = [
  {
    key: 'employees', singular: 'Employee', plural: 'Employees', refPrefix: 'EMP', workflow: employeeWorkflow, editPermission: 'employees.manage',
    title: (r) => fullName(r),
    subtitle: (r) => `${jobLabel(r)} · ${siteShort(str(r, 'site'))}`,
    sort: (a, b) => str(a, 'lastName').localeCompare(str(b, 'lastName')) || str(a, 'firstName').localeCompare(str(b, 'firstName')),
    flags: (r, d, today) => employeeFlags(r, d, today),
    createFields: ['firstName', 'lastName', 'job', 'site', 'manager', 'startDate', 'employmentType', 'fixedTermEnd', 'salary', 'phone', 'email'],
    createDefaults: (today) => ({ startDate: nextWorkingDay(addDays(today, 7)), employmentType: 'permanent', annualCarry: 0, onboarding: '', phone: '', email: '' }),
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'lastName', label: 'Surname', type: 'text', required: true },
      { key: 'job', label: 'Job', type: 'select', options: opt(JOBS), required: true, table: true },
      { key: 'site', label: 'Site', type: 'select', options: opt(SITES), required: true, table: true },
      { key: 'manager', label: 'Reports to', type: 'ref', ref: 'employees', refFilter: (t) => t.status !== 'exited' && ['md', 'depotmgr', 'hrmgr', 'finmgr', 'salesmgr', 'whsup', 'fleetctl'].includes(str(t, 'job')) },
      { key: 'startDate', label: 'Start date', type: 'date', required: true, table: true },
      { key: 'employmentType', label: 'Employment type', type: 'select', options: EMPLOYMENT_TYPES, required: true,
        validate: (v, values) => (v === 'fixed' && !values.fixedTermEnd ? 'A fixed-term contract needs an end date.' : null) },
      { key: 'fixedTermEnd', label: 'Fixed-term end date', type: 'date', hint: 'Only for fixed-term contracts.', validate: notBefore('startDate', 'The contract cannot end before it starts.') },
      { key: 'probationEnd', label: 'Probation ends', type: 'date', hint: 'Three months from the start date (company policy in this demo).' },
      { key: 'salary', label: 'Monthly salary (fictional)', type: 'money', min: 0, permission: 'pay.view' },
      { key: 'annualCarry', label: 'Annual leave carried over (days)', type: 'number', min: 0, max: 15, step: 0.5 },
      { key: 'phone', label: 'Mobile (fictional)', type: 'text', validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      // Set by the on-page panels (onboarding checklist, probation review, leaving) — kept out of generic forms.
      { key: 'onboarding', label: 'Onboarding items done', type: 'text', hidden: true },
      { key: 'probationOutcome', label: 'Probation outcome', type: 'text', hidden: true },
      { key: 'probationReviewDate', label: 'Probation review date', type: 'date', hidden: true },
      { key: 'probationNotes', label: 'Probation notes', type: 'text', hidden: true },
      { key: 'exitReason', label: 'Reason for leaving', type: 'text', hidden: true },
      { key: 'lastDay', label: 'Last working day', type: 'date', hidden: true },
      { key: 'exitEquipment', label: 'Equipment returned', type: 'boolean', hidden: true },
      { key: 'exitAccess', label: 'Access removed', type: 'boolean', hidden: true },
      { key: 'exitNotes', label: 'Exit notes', type: 'text', hidden: true },
      { key: 'hrNotes', label: 'Confidential HR notes', type: 'textarea', permission: 'hr.notes' },
    ],
  },
  {
    key: 'leave', singular: 'Leave request', plural: 'Leave requests', refPrefix: 'LV', workflow: leaveWorkflow, editPermission: 'leave.hr',
    title: (r, d) => `${empName(d, r.values.employee)} · ${leaveShort(str(r, 'type'))}`,
    subtitle: (r) => `${formatDate(str(r, 'start'))}${str(r, 'end') !== str(r, 'start') ? ` – ${formatDate(str(r, 'end'))}` : ''} · ${fmtDays(leaveDays(r))} working day${leaveDays(r) === 1 ? '' : 's'}`,
    sort: (a, b) => Number(b.status === 'requested') - Number(a.status === 'requested') || str(b, 'start').localeCompare(str(a, 'start')),
    flags: (r, d, today) => leaveFlags(r, d, today),
    createFields: ['employee', 'type', 'start', 'end', 'reason', 'medicalCert'],
    createDefaults: (today) => ({ start: nextWorkingDay(addDays(today, 1)), end: nextWorkingDay(addDays(today, 1)), requestedOn: today, medicalCert: false, coverNote: '', decidedBy: '' }),
    fields: [
      employeeRef('Employee'),
      { key: 'type', label: 'Type of leave', type: 'select', options: opt(LEAVE_TYPES), required: true, table: true },
      { key: 'start', label: 'First day', type: 'date', required: true, table: true },
      { key: 'end', label: 'Last day', type: 'date', required: true, table: true, validate: notBefore('start', 'The last day cannot be before the first day.') },
      { key: 'reason', label: 'Reason', type: 'textarea' },
      { key: 'medicalCert', label: 'Medical certificate received', type: 'boolean', hint: 'Needed for sick leave of more than two days.' },
      { key: 'requestedOn', label: 'Requested on', type: 'date', hidden: true },
      { key: 'decidedBy', label: 'Decided by', type: 'text', hidden: true },
      { key: 'coverNote', label: 'Team cover note', type: 'text', hidden: true },
    ],
  },
  {
    key: 'payruns', singular: 'Payroll input pack', plural: 'Payroll input packs', refPrefix: 'PAY', workflow: payrunWorkflow, editPermission: 'payroll.prepare',
    title: (r) => `${monthLabel(str(r, 'period'))} payroll inputs`,
    subtitle: (r) => (str(r, 'sentOn') ? `Sent ${formatDate(str(r, 'sentOn'))}` : `Cut-off ${formatDate(str(r, 'cutoff'))}`),
    sort: (a, b) => str(b, 'period').localeCompare(str(a, 'period')),
    flags: (r, d) => {
      if (LOCKED_PACK.includes(r.status ?? '')) return [];
      const n = packIssues(d, str(r, 'period')).length;
      return n ? [{ tone: 'red', label: `${n} unresolved` }] : [{ tone: 'green', label: 'Ready to approve' }];
    },
    createFields: ['period', 'cutoff', 'notes'],
    createDefaults: (today, d) => {
      let p = periodOf(today);
      while (records(d, 'payruns').some((x) => str(x, 'period') === p)) p = periodOf(addMonths(`${p}-01`, 1));
      return { period: p, cutoff: addDays(addMonths(`${p}-01`, 1), -6), checkedBy: '', approvedBy: '', sentOn: '', snapshot: '' };
    },
    fields: [
      { key: 'period', label: 'Pay period (YYYY-MM)', type: 'text', required: true, table: true, validate: periodRule },
      { key: 'cutoff', label: 'Input cut-off', type: 'date', table: true },
      { key: 'checkedBy', label: 'Checked by', type: 'text', table: true, hidden: true },
      { key: 'approvedBy', label: 'Approved by', type: 'text', hidden: true },
      { key: 'sentOn', label: 'Sent on', type: 'date', hidden: true },
      { key: 'snapshot', label: 'Approved pack', type: 'text', hidden: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'inputs', singular: 'Payroll input', plural: 'Payroll inputs', refPrefix: 'IN', editPermission: 'payroll.prepare',
    title: (r, d) => `${empName(d, r.values.employee)} · ${label(INPUT_KINDS, str(r, 'kind'))}`,
    subtitle: (r) => (str(r, 'kind') === 'overtime' ? `${fmtDays(num(r, 'hours'))} h · week of ${formatDate(str(r, 'weekOf'))}` : str(r, 'description')),
    fields: [
      { key: 'period', label: 'Pay period', type: 'text', required: true, validate: periodRule },
      employeeRef('Employee'),
      { key: 'kind', label: 'Input', type: 'select', options: INPUT_KINDS, required: true, table: true },
      { key: 'weekOf', label: 'Week of (Monday)', type: 'date' },
      { key: 'hours', label: 'Hours', type: 'number', min: 0, max: 40, step: 0.5, unit: 'h' },
      { key: 'amount', label: 'Amount', type: 'money', min: 0 },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'approvedBy', label: 'Manager approval recorded by', type: 'text' },
    ],
  },
  {
    key: 'requisitions', singular: 'Requisition', plural: 'Requisitions', refPrefix: 'REQ', workflow: requisitionWorkflow, editPermission: 'hiring',
    title: (r) => str(r, 'title'),
    subtitle: (r) => `${siteShort(str(r, 'site'))} · ${r.values.budgeted ? 'budgeted' : 'not in budget'} · ${label(REQ_REASONS, str(r, 'reason'))}`,
    flags: (r, d) => {
      const out: Flag[] = [];
      if (r.status === 'draft' && !r.values.budgeted) out.push({ tone: 'amber', label: 'Needs MD approval' });
      if (r.status === 'open') {
        const n = records(d, 'applicants').filter((a) => str(a, 'requisition') === r.id && !['declined'].includes(a.status ?? '')).length;
        out.push({ tone: n ? 'blue' : 'amber', label: `${n} applicant${n === 1 ? '' : 's'} in play` });
      }
      return out;
    },
    createDefaults: () => ({ budgeted: true, reason: 'replacement', positions: 1 }),
    fields: [
      { key: 'title', label: 'Position', type: 'text', required: true, placeholder: 'e.g. Delivery driver — Durban' },
      { key: 'job', label: 'Job', type: 'select', options: opt(JOBS), required: true, table: true },
      { key: 'site', label: 'Site', type: 'select', options: opt(SITES), required: true, table: true },
      { key: 'reason', label: 'Reason', type: 'select', options: REQ_REASONS, required: true },
      { key: 'budgeted', label: 'In the approved headcount budget', type: 'boolean', hint: 'Unbudgeted positions need the managing director’s approval.' },
      { key: 'salaryBudget', label: 'Monthly salary budget', type: 'money', min: 0, permission: 'pay.view' },
      { key: 'hiringManager', label: 'Hiring manager', type: 'ref', ref: 'employees', refFilter: (t) => t.status !== 'exited' && ['md', 'depotmgr', 'hrmgr', 'finmgr', 'salesmgr', 'whsup', 'fleetctl'].includes(str(t, 'job')) },
      { key: 'positions', label: 'Positions', type: 'number', min: 1, max: 1, hidden: true },
      { key: 'notes', label: 'Motivation', type: 'textarea' },
    ],
  },
  {
    key: 'applicants', singular: 'Applicant', plural: 'Applicants', refPrefix: 'APP', workflow: applicantWorkflow, editPermission: 'hiring',
    title: (r) => fullName(r),
    subtitle: (r, d) => str(findRecord(d, 'requisitions', str(r, 'requisition')), 'title'),
    flags: (r) => (r.status === 'offer' && r.values.offerAccepted ? [{ tone: 'green', label: 'Offer accepted' }] : r.status === 'offer' ? [{ tone: 'amber', label: 'Awaiting answer' }] : []),
    createFields: ['firstName', 'lastName', 'requisition', 'phone', 'email', 'source', 'appliedOn'],
    createDefaults: (today) => ({ appliedOn: today, source: 'website', offerAccepted: false }),
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'lastName', label: 'Surname', type: 'text', required: true },
      { key: 'requisition', label: 'Requisition', type: 'ref', ref: 'requisitions', required: true, table: true, refFilter: (t) => t.status === 'open' },
      { key: 'phone', label: 'Mobile (fictional)', type: 'text', validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'source', label: 'Source', type: 'select', options: APPLICANT_SOURCES, table: true },
      { key: 'appliedOn', label: 'Applied on', type: 'date', table: true },
      { key: 'interviewDate', label: 'Interview date', type: 'date', hidden: true },
      { key: 'interviewScore', label: 'Interview score', type: 'select', options: RATINGS, hidden: true },
      { key: 'interviewNotes', label: 'Interview notes', type: 'textarea', hidden: true },
      { key: 'offerSalary', label: 'Offered monthly salary', type: 'money', hidden: true },
      { key: 'startDate', label: 'Proposed start date', type: 'date', hidden: true },
      { key: 'offerAccepted', label: 'Offer accepted', type: 'boolean', hidden: true },
      { key: 'employee', label: 'Employee record', type: 'ref', ref: 'employees', hidden: true },
    ],
  },
  {
    key: 'reviews', singular: 'Performance review', plural: 'Performance reviews', refPrefix: 'REV', workflow: reviewWorkflow, editPermission: 'reviews',
    title: (r, d) => empName(d, r.values.employee),
    subtitle: (r, d) => `${str(r, 'cycle')} · ${jobLabel(findRecord(d, 'employees', str(r, 'employee')))}`,
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      const fr = finalRating(r);
      if (r.status !== 'signed' && str(r, 'dueDate') && str(r, 'dueDate') < today) out.push({ tone: 'red', label: 'Past due' });
      if (fr && fr <= 2 && !str(r, 'pipActions')) out.push({ tone: 'red', label: 'Improvement plan needed' });
      if (r.status === 'manager' && ['1', '5'].includes(str(r, 'managerRating'))) out.push({ tone: 'amber', label: 'Needs moderation' });
      if (str(r, 'pipActions') && str(r, 'pipReview')) out.push({ tone: 'dark', label: `Plan review ${formatDate(str(r, 'pipReview'))}` });
      return out;
    },
    createFields: ['employee', 'cycle', 'dueDate'],
    createDefaults: (today) => ({ cycle: `${today.slice(0, 4)} annual review`, dueDate: addDays(today, 30) }),
    fields: [
      employeeRef('Employee'),
      { key: 'cycle', label: 'Review cycle', type: 'text', required: true, table: true },
      { key: 'dueDate', label: 'Due', type: 'date', table: true },
      { key: 'selfRating', label: 'Self rating', type: 'select', options: RATINGS, hidden: true },
      { key: 'selfComments', label: 'Self-assessment', type: 'textarea', hidden: true },
      { key: 'managerRating', label: 'Manager rating', type: 'select', options: RATINGS, hidden: true },
      { key: 'managerComments', label: 'Manager comments', type: 'textarea', hidden: true },
      { key: 'moderatedRating', label: 'Moderated rating', type: 'select', options: RATINGS, hidden: true },
      { key: 'moderationNote', label: 'Moderation note', type: 'textarea', hidden: true },
      { key: 'pipActions', label: 'Improvement plan', type: 'textarea', hidden: true },
      { key: 'pipReview', label: 'Improvement plan review date', type: 'date', hidden: true },
    ],
  },
  {
    key: 'cases', singular: 'Case', plural: 'Cases', refPrefix: 'CASE', workflow: caseWorkflow, editPermission: 'cases',
    title: (r, d) => `${empName(d, r.values.employee)} · ${label(CASE_CATEGORIES, str(r, 'category'))}`,
    subtitle: (r) => `${label(CASE_KINDS, str(r, 'kind'))} · reported ${formatDate(str(r, 'reportedOn'))}`,
    sort: (a, b) => Number(a.status === 'closed') - Number(b.status === 'closed') || str(b, 'reportedOn').localeCompare(str(a, 'reportedOn')),
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      if (r.status === 'hearing') {
        const n = daysBetween(today, str(r, 'hearingDate'));
        out.push(n < 0 ? { tone: 'red', label: 'Hearing held — outcome to record' } : { tone: 'amber', label: n === 0 ? 'Hearing today' : `Hearing in ${n} day${n === 1 ? '' : 's'}` });
      }
      if (r.status === 'appeal') out.push({ tone: 'red', label: 'Appeal open' });
      return out;
    },
    createFields: ['employee', 'kind', 'category', 'reportedOn', 'reportedBy', 'description'],
    createDefaults: (today) => ({ kind: 'disciplinary', reportedOn: today }),
    fields: [
      employeeRef('Employee'),
      { key: 'kind', label: 'Type', type: 'select', options: CASE_KINDS, required: true, table: true },
      { key: 'category', label: 'Category', type: 'select', options: CASE_CATEGORIES, required: true,
        validate: (v, values) => (values.kind === 'grievance' && !String(v).match(/shifts|workload|treatment/) ? 'Choose a grievance category for a grievance.' : values.kind === 'disciplinary' && String(v).match(/shifts|workload|treatment/) ? 'Choose a misconduct category for a disciplinary case.' : null) },
      { key: 'reportedOn', label: 'Reported on', type: 'date', required: true, table: true },
      { key: 'reportedBy', label: 'Reported by', type: 'text' },
      { key: 'description', label: 'What happened', type: 'textarea', required: true },
      { key: 'investigator', label: 'Investigator', type: 'text', hidden: true },
      { key: 'confidential', label: 'Investigation notes (restricted)', type: 'textarea', permission: 'cases' },
      { key: 'hearingDate', label: 'Hearing date', type: 'date', hidden: true },
      { key: 'noticeGiven', label: 'Notice given', type: 'date', hidden: true },
      { key: 'chairperson', label: 'Chairperson', type: 'text', hidden: true },
      { key: 'finding', label: 'Finding', type: 'select', options: FINDINGS, hidden: true },
      { key: 'sanction', label: 'Sanction', type: 'select', options: SANCTIONS, hidden: true },
      { key: 'outcomeNotes', label: 'Outcome notes', type: 'textarea', hidden: true },
      { key: 'appealNotes', label: 'Appeal', type: 'textarea', hidden: true },
    ],
  },
  {
    key: 'warnings', singular: 'Warning', plural: 'Warnings', refPrefix: 'WRN', editPermission: 'cases',
    title: (r, d) => `${empName(d, r.values.employee)} · ${label(SANCTIONS, str(r, 'level'))}`,
    subtitle: (r) => `Valid until ${formatDate(str(r, 'expires'))}`,
    flags: (r, _d, today) => (str(r, 'expires') < today ? [{ tone: 'dark', label: 'Expired' }] : [{ tone: 'amber', label: `Valid ${daysBetween(today, str(r, 'expires'))} more days` }]),
    fields: [
      employeeRef('Employee'),
      { key: 'level', label: 'Level', type: 'select', options: SANCTIONS.filter((s) => WARNING_MONTHS[s.value]), required: true, table: true },
      { key: 'issued', label: 'Issued', type: 'date', required: true, table: true },
      { key: 'expires', label: 'Expires', type: 'date', required: true, table: true },
      { key: 'case', label: 'Case', type: 'ref', ref: 'cases' },
      { key: 'reason', label: 'Reason', type: 'text' },
    ],
  },
  {
    key: 'courses', singular: 'Course', plural: 'Courses', refPrefix: 'TRN', workflow: courseWorkflow, editPermission: 'training',
    title: (r) => str(r, 'title'),
    subtitle: (r) => `${formatDate(str(r, 'date'))} · ${siteShort(str(r, 'venue'))} · ${str(r, 'attendees') ? str(r, 'attendees').split(',').length : 0} booked`,
    sort: (a, b) => Number(a.status !== 'planned') - Number(b.status !== 'planned') || str(a, 'date').localeCompare(str(b, 'date')),
    flags: (r, _d, today) => (r.status === 'planned' && str(r, 'date') <= today ? [{ tone: 'amber', label: 'Attendance to record' }] : []),
    createFields: ['title', 'certType', 'date', 'provider', 'venue', 'notes'],
    createDefaults: (today) => ({ date: nextWorkingDay(addDays(today, 14)), venue: 'ho', attendees: '', attended: '' }),
    fields: [
      { key: 'title', label: 'Course', type: 'text', required: true },
      { key: 'certType', label: 'Certificate issued', type: 'select', options: opt(CERT_TYPES), hint: 'Leave blank when the course gives no certificate.' },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'provider', label: 'Provider', type: 'text', table: true },
      { key: 'venue', label: 'Venue', type: 'select', options: opt(SITES), table: true },
      { key: 'attendees', label: 'Booked', type: 'text', hidden: true },
      { key: 'attended', label: 'Attended', type: 'text', hidden: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'certificates', singular: 'Certificate', plural: 'Certificates', refPrefix: 'CRT', editPermission: 'training',
    title: (r, d) => empName(d, r.values.employee),
    subtitle: (r) => certLabel(str(r, 'type')),
    sort: (a, b) => str(a, 'expires').localeCompare(str(b, 'expires')),
    flags: (r, d, today) => certFlags(r, d, today),
    createDefaults: (today) => ({ issued: today, number: 'DEMO-' }),
    fields: [
      employeeRef('Holder'),
      { key: 'type', label: 'Certificate', type: 'select', options: opt(CERT_TYPES), required: true, table: true },
      { key: 'number', label: 'Number (fictional)', type: 'text', table: true, validate: (v) => (String(v).startsWith('DEMO-') ? null : 'Demo certificate numbers start with DEMO-.') },
      { key: 'issued', label: 'Issued', type: 'date', required: true },
      { key: 'expires', label: 'Expires', type: 'date', required: true, table: true, validate: notBefore('issued', 'The expiry date cannot be before the issue date.') },
      { key: 'provider', label: 'Issued by', type: 'text' },
    ],
  },
];

const config: IndustryConfig = {
  id: 'hr',
  industry: 'Human resources',
  businessName: 'Bluegum Distribution',
  monogram: 'BG',
  workspaceTag: 'PEOPLE & HR',
  tagline: 'In-house HR for a multi-depot distributor',
  summary: 'The in-house HR team of a food-and-beverage distributor with a head office and three depots: employee records and onboarding, leave with balances and a who’s-away calendar, monthly payroll inputs, hiring, performance reviews, discipline and grievances, training and certificates.',
  priority: 13,
  theme: { accent: '#5e39b1', accent2: '#6d46c3', accentSoft: '#bcaae4', accentTint: '#f0ecf9', accentLine: '#d8cfed', accentText: '#3d2574' },
  roles: [
    { key: 'hrmgr', label: 'HR manager' },
    { key: 'hrofficer', label: 'HR officer' },
    { key: 'payroll', label: 'Payroll administrator' },
    { key: 'linemgr', label: 'Line manager' },
    { key: 'md', label: 'Managing director' },
    { key: 'employee', label: 'Employee (self-service)' },
  ],
  permissions: [
    { key: 'employees.manage', label: 'Manage employees', description: 'Add and edit employees, tick onboarding items, record probation reviews, notice and exits' },
    { key: 'pay.view', label: 'See salaries', description: 'See monthly salaries and salary budgets' },
    { key: 'hr.notes', label: 'Confidential HR notes', description: 'See the confidential notes on employee records' },
    { key: 'leave.request', label: 'Request leave', description: 'Request and cancel your own leave (My leave)' },
    { key: 'leave.approve', label: 'Approve leave', description: 'Approve or decline leave for the people who report to you' },
    { key: 'leave.hr', label: 'Leave administration', description: 'Decide on anyone’s leave, record leave for others and mark leave as taken' },
    { key: 'overtime.approve', label: 'Approve overtime', description: 'Record manager approval for overtime above 10 hours in a week' },
    { key: 'payroll.prepare', label: 'Prepare payroll inputs', description: 'Capture inputs, check the monthly pack and send it to payroll (simulated)' },
    { key: 'payroll.approve', label: 'Approve payroll inputs', description: 'Approve and lock the monthly payroll input pack' },
    { key: 'hiring', label: 'Hiring', description: 'Requisitions and the applicant pipeline' },
    { key: 'hiring.unbudgeted', label: 'Approve unbudgeted posts', description: 'Approve requisitions that are not in the headcount budget' },
    { key: 'reviews', label: 'Performance reviews', description: 'Capture self-assessments and manager reviews and sign them off' },
    { key: 'reviews.moderate', label: 'Moderate ratings', description: 'Moderate ratings of 1 or 5 and sign them off' },
    { key: 'cases', label: 'Discipline & grievances', description: 'Run investigations, hearings, outcomes and appeals' },
    { key: 'training', label: 'Training', description: 'Plan courses, record attendance and maintain certificates' },
  ],
  modules: [
    { key: 'employees', label: 'Employees', icon: IcoUsers, group: 'People', collection: 'employees', detail: EmployeeProfile, description: 'Everyone on the books: job, site, manager, start date, probation, contract end, leave balances, certificates and warnings.' },
    { key: 'onboarding', label: 'Onboarding', icon: IcoCheck, group: 'People', collection: 'employees', page: Onboarding, detail: EmployeeProfile, description: 'New hires and the checklist each job needs before day one. Nobody starts until the required items are done.' },
    { key: 'leave', label: 'Leave requests', icon: IcoCalendar, group: 'Time off', collection: 'leave', page: LeaveRegister, detail: LeaveDetail, description: 'Requests from request to approval, with balances, medical certificates and team cover checked before anything is approved.' },
    { key: 'calendar', label: 'Who’s away', icon: IcoGrid, group: 'Time off', page: WhosAway, description: 'Two weeks at a glance, team by team: who is away, on what kind of leave, and where a team is over its limit.' },
    { key: 'myleave', label: 'My leave', icon: IcoClock, group: 'Time off', page: MyLeave, description: 'Your own balances and requests. Request leave and see it checked before it goes to your manager.' },
    { key: 'payroll', label: 'Payroll inputs', icon: IcoWallet, group: 'Pay', collection: 'payruns', detail: PayrunDetail, description: 'The monthly input pack for the payroll bureau: overtime, unpaid leave, allowances, deductions, starters and leavers. Inputs only — no pay or tax is calculated.' },
    { key: 'hiring', label: 'Requisitions', icon: IcoBriefcase, group: 'Hiring', collection: 'requisitions', detail: RequisitionDetail, description: 'Positions to fill. Budgeted posts are opened by HR; anything outside the headcount budget needs the managing director.' },
    { key: 'applicants', label: 'Applicants', icon: IcoDoc, group: 'Hiring', collection: 'applicants', view: 'board', detail: ApplicantDetail, description: 'A light pipeline from application to hire. Hiring someone creates their employee record in Onboarding.' },
    { key: 'reviews', label: 'Performance reviews', icon: IcoFlag, group: 'Performance & conduct', collection: 'reviews', detail: ReviewDetail, description: 'Self-assessment, manager review, moderation of 1s and 5s, and an improvement plan for ratings of 2 or below.' },
    { key: 'cases', label: 'Discipline & grievances', icon: IcoScale, group: 'Performance & conduct', collection: 'cases', page: CasesPage, detail: CaseDetail, description: 'Disciplinary cases from report to outcome and appeal, grievances with their timeline, and the warnings on file. Demo process — not legal advice.' },
    { key: 'training', label: 'Training', icon: IcoCap, group: 'Training', collection: 'courses', detail: CourseDetail, description: 'Courses with bookings and attendance. Completing a course issues the certificates.' },
    { key: 'certificates', label: 'Certificates', icon: IcoShield, group: 'Training', collection: 'certificates', description: 'PrDPs, forklift, first aid and fire marshal certificates with expiry dates.' },
    { key: 'reports', label: 'Reports', icon: IcoChart, group: 'Insight', page: Reports, description: 'Headcount, turnover, absenteeism, leave liability, overtime and open cases — computed from the records.' },
  ],
  collections,
  seed: buildHrSeed,
  dashboard: Dashboard,
  boundaries: [
    'No payroll is run: no salary, PAYE, UIF, SDL or tax is calculated. The monthly pack lists inputs for a payroll bureau and “sending” it is simulated (a CSV download).',
    'Leave, overtime and probation rules are demo rules modelled on the Basic Conditions of Employment Act. Disciplinary steps are in the style of the LRA Code of Good Practice. These are demo rules — not legal advice and not a compliance check.',
    'Employment-equity reporting, skills-development (WSP/ATR) returns and COIDA claims are not modelled.',
    'No e-signatures: contracts, warnings and offer letters are recorded as done by whoever is using this browser.',
    'Nothing is sent. Approval messages, hearing notices, offer and regret letters are previewed and logged as “not sent”.',
    'No ID numbers, tax numbers or bank details are stored — the onboarding checklist only records that an item was captured. All people, certificates and amounts are fictional.',
  ],
  guide: [
    { title: 'Request leave as an employee', detail: 'On “My leave”, ask for more annual leave than you have: the request is refused and you are offered unpaid leave instead. Then ask for two days — it goes to your manager.', to: 'myleave', as: 'u_emp' },
    { title: 'Approve leave with a team clash', detail: 'Two of Priya’s colleagues are already away next week, so “Approve” is held back. Read the team-cover check, then approve with a cover note. Open the Who’s away calendar to see the clash.', to: 'leave/leave_1', as: 'u_mgr' },
    { title: 'Start a new driver', detail: 'Press “Start employment”: refused — banking details, PPE and the PrDP check are still open on the checklist. Tick them and start; probation begins.', to: 'onboarding/employees_53', as: 'u_hro' },
    { title: 'Hire an applicant', detail: 'Sizwe accepted the offer. “Mark as hired” creates his employee record in Onboarding with a driver’s checklist and fills the requisition.', to: 'applicants/applicants_1', as: 'u_hro' },
    { title: 'Run a disciplinary case', detail: 'Schedule Ricardo’s hearing with one working day’s notice — refused, because this demo needs two. Give more notice and it is scheduled. Then open the forklift case, whose hearing was held, and record the outcome: the warning lands on the employee’s file.', to: 'cases/cases_1', as: 'u_hro' },
    { title: 'Approve this month’s payroll inputs', detail: 'Mark the pack as checked, then switch to the managing director: approval is blocked by overtime above 10 hours, an unpaid-leave request and a starter’s banking details. Fix each from the pack and approve.', to: 'payroll/payruns_1', as: 'u_pay' },
  ],
  highlights: [
    'Leave balances from the records, with BCEA-style rules and a who’s-away calendar by team',
    'Onboarding checklists per job — nobody starts without PPE, a PrDP check or banking details',
    'Monthly payroll inputs with an overtime limit and a lock on approval (no pay calculated)',
    'Hearings with notice checks, warnings that expire, and certificates that flag before they lapse',
  ],
};

export default config;
