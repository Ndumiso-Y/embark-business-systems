// School management demo. Fictional school: an independent South African primary-and-high school
// (Grade R–12). The demo holds a representative subset — one class per grade with reduced class sizes.
import type { CollectionDef, Flag, IndustryConfig, WorkflowDef } from '../../core/types';
import { findRecord, num, str } from '../../core/engine';
import { daysBetween, formatDate, monthLabel } from '../../core/lib/dates';
import {
  IcoBriefcase, IcoCalendar, IcoChart, IcoCheck, IcoClock, IcoDoc, IcoEdit, IcoFlag, IcoGrid, IcoPermit, IcoReceipt, IcoRefresh, IcoSend, IcoUsers, IcoWallet,
} from '../../core/components/Icons';
import {
  AUDIENCES, CHANNELS, DISCIPLINE_CATEGORIES, EVENT_KINDS, GENDERS, GRADES, LEAVE_REASONS, OUTCOMES, PAY_METHODS, PLAN_MONTHS, RECORD_KINDS, SEVERITIES,
  STAFF_ROLES, TASK_KINDS, TRANSPORT, ASSESSED_SUBJECTS, gradeLabel, label, subjectLabel,
} from './data';
import { buildEducationSeed } from './seed';
import {
  acceptProblem, accountBalance, accountOf, activeArrangement, ageing, ageingFlag, applicantName, arrangementProblem, assessmentProblem, captureProblem, className, classRoom,
  commentProblem, contactProblem, coverGaps, coverNeeded, coverProblem, documentsProblem, enrolApplication, familyLearners, familyName, formatResults, fullName, gradeRoom, isMerit, isTeaching,
  learnerFlags, missingDocs, moderationProblem, noticeAudience, noticeProblem, offerProblem, paymentProblem, placeForGrade, rand, registerProblem, registerState, reportAttendance,
  reportFor, reportLearner, reportResults, resolveProblem, runTotal, linesOf, signBlockers, signProblem, staffFlags, taskState, termLabel, termOf, toCents, todayStr, waitlistPosition, weightingProblem,
  classTaughtBy, siblingTasks, weightSum,
} from './helpers';
export * from './helpers';
export { CLASS_CAPACITY } from './seed';
import Dashboard from './pages/Dashboard';
import ApplicationDetail from './pages/ApplicationDetail';
import LearnerProfile from './pages/LearnerProfile';
import ClassDetail from './pages/ClassDetail';
import Attendance, { AttendanceDetail } from './pages/Attendance';
import Timetable from './pages/Timetable';
import CoverDetail from './pages/CoverDetail';
import Assessments from './pages/Assessments';
import AssessmentDetail from './pages/AssessmentDetail';
import ReportCards from './pages/ReportCards';
import ReportDetail from './pages/ReportDetail';
import Fees from './pages/Fees';
import AccountDetail from './pages/AccountDetail';
import PaymentDetail from './pages/PaymentDetail';
import Discipline from './pages/Discipline';
import DisciplineDetail from './pages/DisciplineDetail';
import StaffDetail from './pages/StaffDetail';
import Notices from './pages/Notices';
import NoticeDetail from './pages/NoticeDetail';
import Reports from './pages/Reports';

const phoneRule = (v: unknown) => (/^0\d{2} \d{3} \d{4}$/.test(String(v)) ? null : 'Use the format 0xx xxx xxxx.');
const emailRule = (v: unknown) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : 'Enter a valid email address.');
const termRule = (v: unknown) => (/^\d{4}-T[1-4]$/.test(String(v)) ? null : 'Use the form 2026-T4 (year, then T1 to T4).');
const byText = (key: string) => (a: { values: Record<string, unknown> }, b: { values: Record<string, unknown> }) => String(a.values[key] ?? '').localeCompare(String(b.values[key] ?? ''));

/* ------------------------------------------------------------------ */
const applicationWorkflow: WorkflowDef = {
  initial: 'applied',
  states: [
    { key: 'applied', label: 'New application', tone: 'dark' },
    { key: 'documents', label: 'Documents received', tone: 'blue' },
    { key: 'assessed', label: 'Assessed', tone: 'accent' },
    { key: 'waitlisted', label: 'Waiting list', tone: 'amber' },
    { key: 'offered', label: 'Offer made', tone: 'blue' },
    { key: 'enrolled', label: 'Enrolled', tone: 'green', terminal: true },
    { key: 'declined', label: 'Declined / withdrawn', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'applied', to: 'documents', label: 'Documents received', permission: 'admissions', intent: 'primary', guard: ({ record }) => documentsProblem(record) },
    { from: 'documents', to: 'assessed', label: 'Record assessment', permission: 'admissions', intent: 'primary', guard: ({ record }) => assessmentProblem(record) },
    { from: ['assessed', 'waitlisted'], to: 'offered', label: 'Make offer', permission: 'admissions', intent: 'primary',
      guard: ({ record, data }) => offerProblem(record, data),
      after: ({ record, data, api, today }) => {
        const cls = placeForGrade(data, str(record, 'grade'), record.id);
        api.update('applications', record.id, { placedClass: cls?.id ?? '', offerDate: today }, `Place held in ${str(cls, 'name')}`);
        api.toast(`Offer made — a place is held in ${str(cls, 'name')} until the family accepts or declines`);
      } },
    { from: 'assessed', to: 'waitlisted', label: 'Add to waiting list', permission: 'admissions',
      guard: ({ record, data }) => (gradeRoom(data, str(record, 'grade'), record.id).free > 0 ? `${gradeLabel(str(record, 'grade'))} still has a free place — make the offer instead.` : null),
      after: ({ record, api, today }) => api.update('applications', record.id, { waitlistedOn: today }) },
    { from: 'offered', to: 'enrolled', label: 'Accept offer & enrol', permission: 'admissions', intent: 'primary', guard: ({ record, data }) => acceptProblem(record, data), after: enrolApplication },
    { from: 'offered', to: 'declined', label: 'Offer declined', permission: 'admissions', requiresNote: true, noteHint: 'why the family declined the place', intent: 'danger' },
    { from: ['applied', 'documents', 'assessed', 'waitlisted'], to: 'declined', label: 'Withdraw application', permission: 'admissions', requiresNote: true, noteHint: 'who withdrew or declined the application, and why', intent: 'danger' },
  ],
};

const learnerWorkflow: WorkflowDef = {
  initial: 'enrolled',
  states: [{ key: 'enrolled', label: 'Enrolled', tone: 'green' }, { key: 'left', label: 'Left the school', tone: 'dark', terminal: true }],
  transitions: [{ from: 'enrolled', to: 'left', label: 'Record leaving', permission: 'learners.edit', requiresNote: true, noteHint: 'last day, reason and the school the learner is moving to', intent: 'danger' }],
};

const registerWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [{ key: 'draft', label: 'In progress', tone: 'amber' }, { key: 'submitted', label: 'Submitted · locked', tone: 'green', terminal: true }],
  transitions: [
    { from: 'draft', to: 'submitted', label: 'Submit register', permission: 'attendance', intent: 'primary',
      guard: ({ record, data }) => registerProblem(record, data, todayStr()),
      after: ({ record, api, user }) => api.update('registers', record.id, { takenBy: user.name }) },
  ],
};

const leaveWorkflow: WorkflowDef = {
  initial: 'open',
  states: [{ key: 'open', label: 'Cover needed', tone: 'red' }, { key: 'covered', label: 'Covered', tone: 'green' }],
  transitions: [
    { from: 'open', to: 'covered', label: 'Confirm cover', permission: 'timetable', intent: 'primary', guard: ({ record, data }) => coverProblem(record, data) },
    { from: 'covered', to: 'open', label: 'Reopen cover', permission: 'timetable' },
  ],
};

const assessmentWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft — capturing', tone: 'dark' },
    { key: 'captured', label: 'Captured — to moderate', tone: 'amber' },
    { key: 'moderated', label: 'Moderated', tone: 'blue' },
    { key: 'published', label: 'Published', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'captured', label: 'Submit marks for moderation', permission: 'marks.capture', intent: 'primary',
      guard: ({ record, data }) => captureProblem(record, data),
      after: ({ record, api, user }) => api.update('assessments', record.id, { capturedBy: user.name, moderatedBy: '' }) },
    { from: 'captured', to: 'moderated', label: 'Moderate marks', permission: 'marks.moderate', intent: 'primary',
      guard: ({ record, user }) => moderationProblem(record, user),
      after: ({ record, api, user }) => api.update('assessments', record.id, { moderatedBy: user.name }) },
    { from: 'captured', to: 'draft', label: 'Return for correction', permission: 'marks.moderate', requiresNote: true, noteHint: 'what the teacher must correct' },
    { from: 'moderated', to: 'published', label: 'Publish marks', permission: 'marks.publish', intent: 'primary',
      guard: ({ record, data }) => captureProblem(record, data) ?? weightingProblem(record, data),
      after: ({ record, api }) => api.toast(`${subjectLabel(str(record, 'subject'))} marks published — they now count towards term percentages and report cards`) },
  ],
};

const reportWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'commented', label: 'Teacher commented', tone: 'amber' },
    { key: 'signed', label: 'Principal signed', tone: 'blue' },
    { key: 'released', label: 'Released to parents', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'commented', label: 'Submit comment', permission: 'reports.comment', intent: 'primary', guard: ({ record }) => commentProblem(record) },
    { from: 'commented', to: 'signed', label: 'Principal sign-off', permission: 'reports.signoff', intent: 'primary',
      guard: ({ record, data }) => signProblem(record, data),
      after: ({ record, data, api, user, today }) => {
        // Freeze the figures: later changes to marks or registers no longer alter a signed report.
        const att = reportAttendance(record, data);
        api.update('reports', record.id, { results: formatResults(reportResults(record, data)), att: `${att.present}/${att.days}`, signedBy: user.name, signedOn: today });
      } },
    { from: 'commented', to: 'draft', label: 'Return to teacher', permission: 'reports.signoff', requiresNote: true, noteHint: 'what the class teacher should change' },
    { from: 'signed', to: 'released', label: 'Release to parents (simulated)', permission: 'reports.signoff', intent: 'primary',
      after: ({ record, data, api, today }) => {
        api.update('reports', record.id, { releasedOn: today }, 'Release logged — no message was sent');
        api.toast(`${fullName(reportLearner(data, record))}’s report card released — logged only, nothing was sent`);
      } },
  ],
};

const paymentWorkflow: WorkflowDef = {
  initial: 'received',
  states: [
    { key: 'received', label: 'To allocate', tone: 'amber' },
    { key: 'allocated', label: 'Allocated', tone: 'green', terminal: true },
    { key: 'returned', label: 'Returned to payer', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'received', to: 'allocated', label: 'Allocate to account', permission: 'fees', intent: 'primary',
      guard: ({ record, data }) => paymentProblem(findRecord(data, 'accounts', str(record, 'account')), num(record, 'amount'), data),
      after: ({ record, data, api }) => api.toast(`${rand(toCents(num(record, 'amount')))} allocated to the ${familyName(data, str(findRecord(data, 'accounts', str(record, 'account')), 'family'))} account`) },
    { from: 'received', to: 'returned', label: 'Return to payer', permission: 'fees', requiresNote: true, noteHint: 'why the money is going back and to whom', intent: 'danger' },
  ],
};

const arrangementWorkflow: WorkflowDef = {
  initial: 'proposed',
  states: [
    { key: 'proposed', label: 'Proposed', tone: 'amber' },
    { key: 'approved', label: 'Approved by bursar', tone: 'blue' },
    { key: 'active', label: 'Active', tone: 'accent' },
    { key: 'completed', label: 'Completed', tone: 'green', terminal: true },
    { key: 'defaulted', label: 'Defaulted', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'proposed', to: 'approved', label: 'Approve arrangement', permission: 'fees.approve', intent: 'primary', guard: ({ record }) => arrangementProblem(record) },
    { from: 'approved', to: 'active', label: 'Parent accepted — start', permission: 'fees', intent: 'primary' },
    { from: 'active', to: 'completed', label: 'Arrears cleared — close', permission: 'fees', intent: 'primary',
      guard: ({ record, data }) => {
        const account = findRecord(data, 'accounts', str(record, 'account'));
        const late = account ? ageing(account, data, todayStr()) : null;
        return late && late.d30 + late.d60 + late.d90 > 0 ? `The account still has ${rand(late.d30 + late.d60 + late.d90)} in arrears — record the payments first, or mark the arrangement as defaulted.` : null;
      } },
    { from: ['approved', 'active'], to: 'defaulted', label: 'Mark as defaulted', permission: 'fees', requiresNote: true, noteHint: 'which instalments were missed and what was tried', intent: 'danger' },
  ],
};

const disciplineWorkflow: WorkflowDef = {
  initial: 'logged',
  states: [
    { key: 'logged', label: 'Logged', tone: 'amber' },
    { key: 'contacted', label: 'Parent contacted', tone: 'blue' },
    { key: 'resolved', label: 'Resolved', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'logged', to: 'contacted', label: 'Parent contacted', permission: 'discipline', intent: 'primary', guard: ({ record }) => contactProblem(record) },
    { from: ['logged', 'contacted'], to: 'resolved', label: 'Resolve', permission: 'discipline', intent: 'primary', guard: ({ record, data, user }) => resolveProblem(record, data, user) },
  ],
};

const noticeWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'approved', label: 'Approved', tone: 'blue' },
    { key: 'sent', label: 'Logged as sent', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'approved', label: 'Approve notice', permission: 'comms.approve', intent: 'primary', guard: ({ record }) => noticeProblem(record) },
    { from: 'approved', to: 'draft', label: 'Withdraw approval', permission: 'comms.approve' },
    { from: 'approved', to: 'sent', label: 'Log as sent (simulated)', permission: 'comms', intent: 'primary',
      after: ({ record, data, api, today }) => {
        const to = noticeAudience(record, data);
        api.update('notices', record.id, { sentOn: today, recipients: to.families }, `Logged for ${to.families} families — no message was sent`);
        api.toast(`Logged as sent to ${to.families} families (${to.text}) — preview only, nothing left this browser`);
      } },
  ],
};

/* ------------------------------------------------------------------ */
const collections: CollectionDef[] = [
  {
    key: 'applications', singular: 'Application', plural: 'Applications', refPrefix: 'AP', workflow: applicationWorkflow, editPermission: 'admissions',
    title: (r) => applicantName(r),
    subtitle: (r) => `${gradeLabel(str(r, 'grade'))} · ${str(r, 'guardian')}`,
    createFields: ['firstName', 'lastName', 'dob', 'gender', 'grade', 'guardian', 'guardianPhone', 'guardianEmail', 'family', 'previousSchool'],
    createDefaults: () => ({ grade: 'R', docBirth: false, docReport: false, docImmunisation: false, depositAmount: 0 }),
    flags: (r, d) => {
      const out: Flag[] = [];
      const missing = missingDocs(r);
      if (['applied', 'documents', 'assessed'].includes(r.status ?? '') && missing.length) out.push({ tone: 'amber', label: `${missing.length} document${missing.length === 1 ? '' : 's'} outstanding` });
      if (r.status === 'assessed' && gradeRoom(d, str(r, 'grade'), r.id).free <= 0) out.push({ tone: 'red', label: `${gradeLabel(str(r, 'grade'))} is full` });
      if (r.status === 'waitlisted') out.push({ tone: gradeRoom(d, str(r, 'grade'), r.id).free > 0 ? 'green' : 'amber', label: `Waiting list #${waitlistPosition(r, d)}${gradeRoom(d, str(r, 'grade'), r.id).free > 0 ? ' — a place has opened' : ''}` });
      if (r.status === 'offered') out.push(acceptProblem(r, d) ? { tone: 'amber', label: 'Deposit outstanding' } : { tone: 'green', label: 'Deposit paid — ready to enrol' });
      if (str(r, 'family') && r.status !== 'enrolled') out.push({ tone: 'blue', label: 'Sibling in the school' });
      return out;
    },
    fields: [
      { key: 'firstName', label: 'Child’s first name', type: 'text', required: true },
      { key: 'lastName', label: 'Surname', type: 'text', required: true },
      { key: 'dob', label: 'Date of birth', type: 'date', required: true },
      { key: 'gender', label: 'Gender', type: 'select', options: GENDERS },
      { key: 'grade', label: 'Grade applied for', type: 'select', options: GRADES, required: true, table: true },
      { key: 'guardian', label: 'Parent / guardian', type: 'text', required: true, table: true },
      { key: 'guardianPhone', label: 'Phone (fictional)', type: 'text', required: true, validate: phoneRule, placeholder: '082 555 0100', table: true },
      { key: 'guardianEmail', label: 'Email', type: 'text', validate: emailRule, placeholder: 'name@example.com' },
      { key: 'family', label: 'Existing family (sibling already in the school)', type: 'ref', ref: 'families', hint: 'Leave empty for a new family — a family record and fee account are created on enrolment.' },
      { key: 'previousSchool', label: 'Previous school', type: 'text' },
      // Captured with the controls on the application page.
      { key: 'docBirth', label: 'Birth certificate', type: 'boolean', hidden: true },
      { key: 'docReport', label: 'Previous school report', type: 'boolean', hidden: true },
      { key: 'docImmunisation', label: 'Immunisation card', type: 'boolean', hidden: true },
      { key: 'assessmentDate', label: 'Assessment date', type: 'date', hidden: true },
      { key: 'outcome', label: 'Assessment outcome', type: 'select', options: OUTCOMES, hidden: true },
      { key: 'assessmentNote', label: 'Assessment note', type: 'textarea', hidden: true },
      { key: 'depositAmount', label: 'Deposit received', type: 'money', hidden: true },
      { key: 'depositMethod', label: 'Deposit method', type: 'select', options: PAY_METHODS, hidden: true },
      { key: 'placedClass', label: 'Place held in', type: 'ref', ref: 'classes', hidden: true },
      { key: 'learner', label: 'Learner record', type: 'ref', ref: 'learners', hidden: true },
      { key: 'offerDate', label: 'Offer made on', type: 'date', hidden: true },
      { key: 'waitlistedOn', label: 'On the waiting list since', type: 'date', hidden: true },
    ],
  },
  {
    key: 'learners', singular: 'Learner', plural: 'Learners', refPrefix: 'LR', workflow: learnerWorkflow, editPermission: 'learners.edit',
    title: (r) => fullName(r),
    subtitle: (r, d) => `${className(d, str(r, 'class'))} · ${familyName(d, str(r, 'family'))}`,
    sort: (a, b) => byText('lastName')(a, b) || byText('firstName')(a, b),
    createFields: ['firstName', 'lastName', 'class', 'family', 'dob', 'gender', 'transport', 'aftercare'],
    createDefaults: (today) => ({ enrolled: today, transport: 'own', aftercare: false }),
    flags: learnerFlags,
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'lastName', label: 'Surname', type: 'text', required: true },
      { key: 'class', label: 'Class', type: 'ref', ref: 'classes', required: true, table: true },
      { key: 'family', label: 'Family', type: 'ref', ref: 'families', required: true },
      { key: 'dob', label: 'Date of birth', type: 'date', required: true, table: true },
      { key: 'gender', label: 'Gender', type: 'select', options: GENDERS },
      { key: 'enrolled', label: 'Enrolled on', type: 'date' },
      { key: 'transport', label: 'Transport', type: 'select', options: TRANSPORT, table: true },
      { key: 'aftercare', label: 'Aftercare', type: 'boolean', table: true },
      { key: 'allergies', label: 'Allergies (restricted)', type: 'text', permission: 'medical.view' },
      { key: 'medical', label: 'Medical notes (restricted)', type: 'textarea', permission: 'medical.view' },
    ],
  },
  {
    key: 'families', singular: 'Family', plural: 'Families', refPrefix: 'FM', editPermission: 'learners.edit',
    title: (r) => `${str(r, 'surname')} family`,
    subtitle: (r) => `${str(r, 'guardian1')} · ${str(r, 'phone1')}`,
    sort: byText('surname'),
    fields: [
      { key: 'surname', label: 'Family surname', type: 'text', required: true },
      { key: 'guardian1', label: 'First guardian', type: 'text', required: true, table: true },
      { key: 'relation1', label: 'Relationship', type: 'text', table: true },
      { key: 'phone1', label: 'Phone (fictional)', type: 'text', required: true, validate: phoneRule, table: true },
      { key: 'email1', label: 'Email', type: 'text', validate: emailRule },
      { key: 'guardian2', label: 'Second guardian', type: 'text' },
      { key: 'phone2', label: 'Second phone (fictional)', type: 'text', validate: phoneRule },
      { key: 'suburb', label: 'Suburb', type: 'text' },
    ],
  },
  {
    key: 'classes', singular: 'Class', plural: 'Classes', refPrefix: 'CL', editPermission: 'timetable',
    title: (r) => str(r, 'name'),
    subtitle: (r, d) => `${fullName(findRecord(d, 'staff', str(r, 'teacher')))} · ${str(r, 'room')}`,
    sort: (a, b) => GRADES.findIndex((g) => g.value === str(a, 'grade')) - GRADES.findIndex((g) => g.value === str(b, 'grade')) || byText('name')(a, b),
    createDefaults: () => ({ capacity: 12 }),
    flags: (r, d) => {
      const room = classRoom(d, r);
      const out: Flag[] = [];
      if (room.free <= 0) out.push({ tone: 'red', label: room.held ? `Full — ${room.held} place${room.held === 1 ? '' : 's'} held by offers` : 'Full' });
      else out.push({ tone: 'green', label: `${room.free} place${room.free === 1 ? '' : 's'} free` });
      return out;
    },
    fields: [
      { key: 'name', label: 'Class', type: 'text', required: true },
      { key: 'grade', label: 'Grade', type: 'select', options: GRADES, required: true, table: true },
      { key: 'teacher', label: 'Class teacher', type: 'ref', ref: 'staff', required: true, table: true, refFilter: (t) => isTeaching(t) },
      { key: 'capacity', label: 'Places', type: 'number', min: 1, max: 40, required: true, table: true },
      { key: 'room', label: 'Room', type: 'text', table: true },
    ],
  },
  {
    key: 'registers', singular: 'Register', plural: 'Registers', refPrefix: 'RG', workflow: registerWorkflow, editPermission: 'attendance',
    title: (r, d) => `${className(d, str(r, 'class'))} — ${formatDate(str(r, 'date'))}`,
    subtitle: (r) => (str(r, 'takenBy') ? `Taken by ${str(r, 'takenBy')}` : 'Daily register'),
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')),
    createDefaults: (today) => ({ date: today }),
    flags: (r, d) => { const st = registerState(r, d); return st.absent.length ? [{ tone: 'amber', label: `${st.absent.length} absent` }] : []; },
    fields: [
      { key: 'class', label: 'Class', type: 'ref', ref: 'classes', required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'takenBy', label: 'Taken by', type: 'text', table: true },
      { key: 'marks', label: 'Marks', type: 'text', hidden: true },
    ],
  },
  {
    key: 'timetables', singular: 'Timetable', plural: 'Timetables', refPrefix: 'TT', editPermission: 'timetable',
    title: (r, d) => `${className(d, str(r, 'class'))} timetable`,
    fields: [
      { key: 'class', label: 'Class', type: 'ref', ref: 'classes', required: true, table: true },
      { key: 'slots', label: 'Lessons', type: 'text', hidden: true },
    ],
  },
  {
    key: 'leave', singular: 'Staff absence', plural: 'Staff absences', refPrefix: 'AB', workflow: leaveWorkflow, editPermission: 'staff.manage',
    title: (r, d) => `${fullName(findRecord(d, 'staff', str(r, 'staff')))} — ${formatDate(str(r, 'date'))}`,
    subtitle: (r) => label(LEAVE_REASONS, str(r, 'reason')),
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')),
    createDefaults: (today) => ({ date: today, reason: 'sick' }),
    createFields: ['staff', 'date', 'reason', 'note'],
    flags: (r, d, today) => {
      const need = coverNeeded(r, d).length;
      const gaps = coverGaps(r, d).length;
      const out: Flag[] = [];
      if (!need) out.push({ tone: 'dark', label: 'No lessons to cover' });
      else if (gaps && r.status === 'open') out.push({ tone: str(r, 'date') <= today ? 'red' : 'amber', label: `${gaps} of ${need} periods without a substitute` });
      else out.push({ tone: 'green', label: `${need} periods covered` });
      if (str(r, 'date') === today) out.push({ tone: 'blue', label: 'Today' });
      return out;
    },
    fields: [
      { key: 'staff', label: 'Staff member', type: 'ref', ref: 'staff', required: true, refFilter: (t) => isTeaching(t), hint: 'Teaching staff — their lessons on the day need a substitute.' },
      { key: 'date', label: 'Day absent', type: 'date', required: true, table: true },
      { key: 'reason', label: 'Reason', type: 'select', options: LEAVE_REASONS, required: true, table: true },
      { key: 'note', label: 'Note', type: 'textarea' },
      { key: 'cover', label: 'Cover', type: 'text', hidden: true },
    ],
  },
  {
    key: 'assessments', singular: 'Assessment task', plural: 'Assessment tasks', refPrefix: 'AS', workflow: assessmentWorkflow, editPermission: 'marks.capture',
    title: (r) => `${subjectLabel(str(r, 'subject'))} — ${str(r, 'title')}`,
    subtitle: (r, d) => `${className(d, str(r, 'class'))} · ${termLabel(str(r, 'term'))} · out of ${num(r, 'total')} · counts ${num(r, 'weight')}%`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || a.ref.localeCompare(b.ref),
    createFields: ['class', 'subject', 'term', 'title', 'kind', 'total', 'weight', 'date'],
    createDefaults: (today) => ({ term: termOf(today), date: today, kind: 'test', total: 50, weight: 50 }),
    flags: (r, d) => {
      const out: Flag[] = [];
      const st = taskState(r, d);
      if (r.status === 'draft' && st.unmarked.length) out.push({ tone: 'amber', label: `${st.unmarked.length} of ${st.roll.length} not marked` });
      if (r.status !== 'published' && st.over.length) out.push({ tone: 'red', label: 'Mark above the total' });
      const sum = weightSum(siblingTasks(r, d));
      if (sum !== 100) out.push({ tone: r.status === 'published' ? 'dark' : 'amber', label: `Term weightings add up to ${sum}%` });
      return out;
    },
    fields: [
      { key: 'class', label: 'Class', type: 'ref', ref: 'classes', required: true, table: true },
      { key: 'subject', label: 'Subject', type: 'select', options: ASSESSED_SUBJECTS, required: true },
      { key: 'term', label: 'Term', type: 'text', required: true, validate: termRule, hint: 'Year and term, e.g. 2026-T4' },
      { key: 'title', label: 'Task', type: 'text', required: true, placeholder: 'e.g. Term test' },
      { key: 'kind', label: 'Type', type: 'select', options: TASK_KINDS, table: true },
      { key: 'total', label: 'Total marks', type: 'number', min: 1, max: 500, required: true, table: true },
      { key: 'weight', label: 'Weighting', type: 'number', min: 0, max: 100, required: true, unit: '%', table: true, hint: 'A subject’s tasks for the term must add up to 100%.' },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'marks', label: 'Marks', type: 'text', hidden: true },
      { key: 'capturedBy', label: 'Captured by', type: 'text', hidden: true },
      { key: 'moderatedBy', label: 'Moderated by', type: 'text', hidden: true },
    ],
  },
  {
    key: 'reports', singular: 'Report card', plural: 'Report cards', refPrefix: 'RC', workflow: reportWorkflow, editPermission: 'reports.comment',
    title: (r, d) => fullName(reportLearner(d, r)),
    subtitle: (r, d) => `${termLabel(str(r, 'term'))} · ${className(d, str(reportLearner(d, r), 'class'))}`,
    sort: (a, b) => str(b, 'term').localeCompare(str(a, 'term')) || a.ref.localeCompare(b.ref),
    createFields: ['learner', 'term'],
    createDefaults: (today) => ({ term: termOf(today) }),
    flags: (r, d) => {
      if (r.status !== 'commented' && r.status !== 'draft') return [];
      const blockers = signBlockers(r, d).filter((b) => b.text !== 'No teacher comment yet');
      if (blockers.length) return [{ tone: 'amber', label: `${blockers.length} mark${blockers.length === 1 ? '' : 's'} not published` }];
      return r.status === 'commented' ? [{ tone: 'green', label: 'Ready for sign-off' }] : [{ tone: 'dark', label: 'Needs the teacher’s comment' }];
    },
    fields: [
      { key: 'learner', label: 'Learner', type: 'ref', ref: 'learners', required: true, refFilter: (t, v, d) => t.status !== 'left' && !reportFor(d, t.id, String(v.term ?? '')), hint: 'Learners without a report card for the term. “Generate report cards” on the register does a whole class at once.' },
      { key: 'term', label: 'Term', type: 'text', required: true, validate: termRule, hint: 'Year and term, e.g. 2026-T4' },
      { key: 'comment', label: 'Class teacher’s comment', type: 'textarea' },
      { key: 'results', label: 'Frozen results', type: 'text', hidden: true },
      { key: 'att', label: 'Frozen attendance', type: 'text', hidden: true },
      { key: 'signedBy', label: 'Signed by', type: 'text', hidden: true },
      { key: 'signedOn', label: 'Signed on', type: 'date', hidden: true },
      { key: 'releasedOn', label: 'Released on', type: 'date', hidden: true },
    ],
  },
  {
    key: 'feePlans', singular: 'Fee plan', plural: 'Fee plans', refPrefix: 'FP', editPermission: 'fees',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `${rand(toCents(num(r, 'annualFee')))} a year`,
    fields: [
      { key: 'name', label: 'Plan', type: 'text', required: true },
      { key: 'fromGrade', label: 'From grade', type: 'select', options: GRADES, required: true, table: true },
      { key: 'toGrade', label: 'To grade', type: 'select', options: GRADES, required: true, table: true },
      { key: 'annualFee', label: 'Annual school fee', type: 'money', min: 0, required: true, table: true },
      { key: 'deposit', label: 'Enrolment deposit', type: 'money', min: 0, required: true, table: true },
    ],
  },
  {
    key: 'accounts', singular: 'Fee account', plural: 'Fee accounts', refPrefix: 'FA', editPermission: 'fees',
    title: (r, d) => `${familyName(d, str(r, 'family'))} account`,
    subtitle: (r, d) => { const kids = familyLearners(d, str(r, 'family')); return `${kids.length} learner${kids.length === 1 ? '' : 's'} · ${label(PLAN_MONTHS, str(r, 'months'))} · owing ${rand(accountBalance(r, d))}`; },
    sort: (a, b) => a.ref.localeCompare(b.ref),
    createDefaults: () => ({ months: '12' }),
    flags: (r, d, today) => {
      const out: Flag[] = [];
      const flag = ageingFlag(ageing(r, d, today));
      if (flag) out.push(flag);
      const arr = activeArrangement(d, r.id);
      if (arr) out.push({ tone: 'blue', label: `Payment arrangement ${arr.status}` });
      if (accountBalance(r, d) < 0) out.push({ tone: 'green', label: 'In credit' });
      return out;
    },
    fields: [
      { key: 'family', label: 'Family', type: 'ref', ref: 'families', required: true, refFilter: (t, _v, d) => !accountOf(d, t.id), hint: 'Families that do not have a fee account yet.' },
      { key: 'months', label: 'Paid over', type: 'select', options: PLAN_MONTHS, required: true, table: true },
      { key: 'notes', label: 'Bursar’s notes', type: 'textarea' },
      { key: 'ledger', label: 'Payments', type: 'text', hidden: true },
    ],
  },
  {
    key: 'billingRuns', singular: 'Invoice run', plural: 'Invoice runs', refPrefix: 'BR', editPermission: 'fees',
    title: (r) => `School fee invoices — ${monthLabel(str(r, 'month'))}`,
    subtitle: (r) => `${linesOf(r).size} accounts · ${rand(runTotal(r))}`,
    sort: (a, b) => str(b, 'month').localeCompare(str(a, 'month')),
    fields: [
      { key: 'month', label: 'Month (YYYY-MM)', type: 'text', required: true, table: true },
      { key: 'date', label: 'Raised on', type: 'date', table: true },
      { key: 'lines', label: 'Lines', type: 'text', hidden: true },
    ],
  },
  {
    key: 'payments', singular: 'Payment', plural: 'Payments received', refPrefix: 'PY', workflow: paymentWorkflow, editPermission: 'fees',
    title: (r) => `${rand(toCents(num(r, 'amount')))} · ${label(PAY_METHODS, str(r, 'method'))}`,
    subtitle: (r, d) => `${str(r, 'reference') || 'No reference'} · ${str(r, 'account') ? familyName(d, str(findRecord(d, 'accounts', str(r, 'account')), 'family')) : 'no account chosen'}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || b.ref.localeCompare(a.ref),
    createDefaults: (today) => ({ date: today, method: 'eft' }),
    flags: (r, d) => {
      if (r.status !== 'received') return [];
      const problem = paymentProblem(findRecord(d, 'accounts', str(r, 'account')), num(r, 'amount'), d);
      return [!str(r, 'account') ? { tone: 'amber', label: 'No account chosen' } : problem ? { tone: 'red', label: 'More than the balance owing' } : { tone: 'green', label: 'Ready to allocate' }];
    },
    fields: [
      { key: 'date', label: 'Date received', type: 'date', required: true, table: true },
      { key: 'amount', label: 'Amount', type: 'money', min: 0.01, required: true, table: true },
      { key: 'method', label: 'Method', type: 'select', options: PAY_METHODS, required: true, table: true },
      { key: 'reference', label: 'Bank or receipt reference', type: 'text', table: true },
      { key: 'account', label: 'Family account', type: 'ref', ref: 'accounts' },
    ],
  },
  {
    key: 'arrangements', singular: 'Payment arrangement', plural: 'Payment arrangements', refPrefix: 'PA', workflow: arrangementWorkflow, editPermission: 'fees',
    title: (r, d) => `${familyName(d, str(findRecord(d, 'accounts', str(r, 'account')), 'family'))} arrangement`,
    subtitle: (r) => `${rand(toCents(num(r, 'instalment')))} extra a month for ${num(r, 'months')} months`,
    fields: [
      { key: 'account', label: 'Fee account', type: 'ref', ref: 'accounts', required: true },
      { key: 'arrears', label: 'Arrears when proposed', type: 'money', min: 0, required: true, table: true },
      { key: 'instalment', label: 'Extra monthly instalment', type: 'money', min: 0, required: true, table: true },
      { key: 'months', label: 'Months', type: 'number', min: 1, max: 12, required: true, table: true },
      { key: 'startDate', label: 'First instalment', type: 'date', table: true },
      { key: 'note', label: 'Background', type: 'textarea' },
    ],
  },
  {
    key: 'discipline', singular: 'Discipline record', plural: 'Discipline & merits', refPrefix: 'DC', workflow: disciplineWorkflow, editPermission: 'discipline',
    title: (r, d) => fullName(findRecord(d, 'learners', str(r, 'learner'))),
    subtitle: (r, d) => `${isMerit(r) ? 'Merit' : `${label(SEVERITIES, str(r, 'severity'))} incident`} · ${label(DISCIPLINE_CATEGORIES, str(r, 'category'))} · ${className(d, str(findRecord(d, 'learners', str(r, 'learner')), 'class'))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || b.ref.localeCompare(a.ref),
    createFields: ['learner', 'date', 'kind', 'category', 'severity', 'points', 'description'],
    createDefaults: (today) => ({ date: today, kind: 'incident', severity: 'minor', points: 1, detention: false }),
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      out.push(isMerit(r) ? { tone: 'green', label: `+${Math.abs(num(r, 'points'))} merit` } : { tone: str(r, 'severity') === 'serious' ? 'red' : 'amber', label: `−${Math.abs(num(r, 'points'))} demerit${str(r, 'severity') === 'serious' ? ' · serious' : ''}` });
      if (!isMerit(r) && r.values.detention === true && r.status !== 'resolved') out.push({ tone: 'dark', label: str(r, 'detentionDate') ? `Detention ${formatDate(str(r, 'detentionDate'))}` : 'Detention — date to set' });
      if (!isMerit(r) && r.status === 'logged' && daysBetween(str(r, 'date'), today) >= 2) out.push({ tone: 'red', label: 'Parent not contacted yet' });
      return out;
    },
    fields: [
      { key: 'learner', label: 'Learner', type: 'ref', ref: 'learners', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'kind', label: 'Record type', type: 'select', options: RECORD_KINDS, required: true },
      { key: 'category', label: 'Category', type: 'select', options: DISCIPLINE_CATEGORIES, required: true, table: true },
      { key: 'severity', label: 'Severity (incidents)', type: 'select', options: SEVERITIES, hint: 'Serious incidents are resolved by the deputy or the principal.' },
      { key: 'points', label: 'Points', type: 'number', min: 0, max: 10, required: true, table: true, hint: 'Merits add points, incidents take them away.' },
      { key: 'description', label: 'What happened', type: 'textarea', required: true },
      { key: 'detention', label: 'Detention', type: 'boolean', hidden: true },
      { key: 'detentionDate', label: 'Detention date', type: 'date', hidden: true },
      { key: 'parentNote', label: 'Parent contact', type: 'textarea', hidden: true },
      { key: 'resolution', label: 'Outcome', type: 'textarea', hidden: true },
    ],
  },
  {
    key: 'staff', singular: 'Staff member', plural: 'Staff', refPrefix: 'EMP', editPermission: 'staff.manage',
    title: (r) => fullName(r),
    subtitle: (r, d) => { const cls = classTaughtBy(d, r.id); return `${label(STAFF_ROLES, str(r, 'role'))} · ${str(r, 'subjects')}${cls ? ` · class teacher of ${str(cls, 'name')}` : ''}`; },
    sort: (a, b) => byText('lastName')(a, b) || byText('firstName')(a, b),
    createDefaults: () => ({ role: 'teacher', policeClearance: false }),
    flags: (r, d, today) => staffFlags(r, d, today),
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'lastName', label: 'Surname', type: 'text', required: true },
      { key: 'role', label: 'Role', type: 'select', options: STAFF_ROLES, required: true, table: true },
      { key: 'subjects', label: 'Subjects / duties', type: 'text', table: true },
      { key: 'phone', label: 'Mobile (fictional)', type: 'text', validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'saceNo', label: 'SACE number (fictional)', type: 'text', hint: 'Visibly fake in this demo, e.g. DEMO-SACE-10240.' },
      { key: 'saceExpiry', label: 'SACE registration valid until', type: 'date', table: true },
      { key: 'policeClearance', label: 'Police clearance on file', type: 'boolean', table: true },
      { key: 'login', label: 'Demo user', type: 'text', hidden: true },
    ],
  },
  {
    key: 'notices', singular: 'Notice', plural: 'Notices', refPrefix: 'NT', workflow: noticeWorkflow, editPermission: 'comms',
    title: (r) => str(r, 'title'),
    subtitle: (r, d) => `${noticeAudience(r, d).text} · ${label(CHANNELS, str(r, 'channel'))}`,
    createFields: ['title', 'audience', 'grade', 'class', 'channel', 'body'],
    createDefaults: () => ({ audience: 'school', channel: 'sms' }),
    flags: (r, d) => (r.status === 'sent' ? [{ tone: 'dark', label: `${num(r, 'recipients')} families · ${formatDate(str(r, 'sentOn'))}` }] : [{ tone: 'blue', label: `${noticeAudience(r, d).families} families` }]),
    fields: [
      { key: 'title', label: 'Subject', type: 'text', required: true },
      { key: 'audience', label: 'Send to', type: 'select', options: AUDIENCES, required: true, table: true },
      { key: 'grade', label: 'Grade (if one grade)', type: 'select', options: GRADES },
      { key: 'class', label: 'Class (if one class)', type: 'ref', ref: 'classes' },
      { key: 'channel', label: 'Channel', type: 'select', options: CHANNELS, required: true, table: true },
      { key: 'body', label: 'Message', type: 'textarea', required: true },
      { key: 'sentOn', label: 'Logged as sent on', type: 'date', hidden: true },
      { key: 'recipients', label: 'Families', type: 'number', hidden: true },
    ],
  },
  {
    key: 'events', singular: 'Calendar entry', plural: 'Calendar', refPrefix: 'EV', editPermission: 'comms',
    title: (r) => str(r, 'title'),
    subtitle: (r) => `${label(EVENT_KINDS, str(r, 'kind'))} · ${formatDate(str(r, 'date'))}${str(r, 'endDate') ? ` to ${formatDate(str(r, 'endDate'))}` : ''}`,
    sort: (a, b) => str(a, 'date').localeCompare(str(b, 'date')),
    createDefaults: (today) => ({ date: today, kind: 'event' }),
    flags: (r, _d, today) => { const n = daysBetween(today, str(r, 'date')); return (str(r, 'endDate') || str(r, 'date')) < today ? [{ tone: 'dark', label: 'Past' }] : n <= 0 ? [{ tone: 'accent', label: n === 0 ? 'Today' : 'Under way' }] : n <= 7 ? [{ tone: 'amber', label: `In ${n} day${n === 1 ? '' : 's'}` }] : []; },
    fields: [
      { key: 'title', label: 'What', type: 'text', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'endDate', label: 'Until (if more than a day)', type: 'date', table: true, validate: (v, values) => (String(v) < String(values.date ?? '') ? 'The end date cannot be before the start.' : null) },
      { key: 'kind', label: 'Type', type: 'select', options: EVENT_KINDS, required: true, table: true },
      { key: 'details', label: 'Details', type: 'textarea' },
    ],
  },
];

const config: IndustryConfig = {
  id: 'education',
  industry: 'Education',
  businessName: 'Marula Ridge Academy',
  monogram: 'MA',
  workspaceTag: 'SCHOOL OFFICE',
  tagline: 'School management for an independent Grade R–12 school',
  summary: 'An independent South African primary-and-high school: admissions from application to enrolled learner, class lists, daily registers, the timetable and substitute cover, assessment marks with moderation, report cards, fee accounts and arrears, discipline and merits, staff records and parent notices.',
  priority: 11,
  theme: { accent: '#2456c9', accent2: '#3667d6', accentSoft: '#a9bff2', accentTint: '#e8eefb', accentLine: '#cddaf6', accentText: '#1a3f96' },
  roles: [
    { key: 'principal', label: 'Principal' },
    { key: 'deputy', label: 'Deputy / academic head' },
    { key: 'classteacher', label: 'Class teacher' },
    { key: 'subjectteacher', label: 'Subject teacher' },
    { key: 'secretary', label: 'School secretary / admissions' },
    { key: 'bursar', label: 'Bursar' },
    { key: 'liaison', label: 'Parent liaison' },
  ],
  permissions: [
    { key: 'admissions', label: 'Admissions', description: 'Capture applications, documents and assessments, make offers and enrol learners' },
    { key: 'learners.edit', label: 'Edit learners', description: 'Edit learner and family records and record a learner leaving' },
    { key: 'medical.view', label: 'View medical notes', description: 'See allergies and medical notes on learner records' },
    { key: 'attendance', label: 'Take registers', description: 'Mark and submit daily class registers' },
    { key: 'timetable', label: 'Timetable & cover', description: 'Change the timetable and classes, and assign substitute teachers' },
    { key: 'staff.manage', label: 'Manage staff', description: 'Edit staff records and record staff absences' },
    { key: 'marks.capture', label: 'Capture marks', description: 'Create assessment tasks, capture marks and submit them for moderation' },
    { key: 'marks.moderate', label: 'Moderate marks', description: 'Moderate marks captured by someone else, or return them for correction' },
    { key: 'marks.publish', label: 'Publish marks', description: 'Publish moderated marks so they count towards term percentages' },
    { key: 'reports.comment', label: 'Report comments', description: 'Generate report cards and write the class teacher’s comment' },
    { key: 'reports.signoff', label: 'Sign off reports', description: 'Principal sign-off and release of report cards' },
    { key: 'fees', label: 'Fees', description: 'Raise invoices, record and allocate payments, and manage fee accounts' },
    { key: 'fees.approve', label: 'Approve arrangements', description: 'Approve payment arrangements on accounts in arrears' },
    { key: 'discipline', label: 'Discipline & merits', description: 'Log incidents and merits, record parent contact and resolve minor incidents' },
    { key: 'discipline.serious', label: 'Resolve serious incidents', description: 'Resolve incidents marked serious' },
    { key: 'comms', label: 'Notices', description: 'Draft notices and calendar entries and log approved notices as sent' },
    { key: 'comms.approve', label: 'Approve notices', description: 'Approve a notice before it goes to parents' },
  ],
  modules: [
    { key: 'admissions', label: 'Admissions', icon: IcoDoc, group: 'Admissions & learners', collection: 'applications', view: 'board', detail: ApplicationDetail, description: 'Applications from first enquiry to enrolled learner: documents, assessment, offer, deposit and the waiting list for full grades.' },
    { key: 'learners', label: 'Learners', icon: IcoUsers, group: 'Admissions & learners', collection: 'learners', detail: LearnerProfile, description: 'The learner register. Open a learner for guardians, attendance, latest marks, discipline, report cards and — for the bursar — the fee balance.' },
    { key: 'classes', label: 'Classes', icon: IcoGrid, group: 'Admissions & learners', collection: 'classes', detail: ClassDetail, description: 'Class lists with the class teacher and places taken against capacity.' },
    { key: 'attendance', label: 'Daily attendance', icon: IcoCheck, group: 'Teaching', collection: 'registers', page: Attendance, detail: AttendanceDetail, description: 'Take the class register in one tap per learner, then submit it. Submitted registers are locked.' },
    { key: 'timetable', label: 'Timetable', icon: IcoCalendar, group: 'Teaching', collection: 'timetables', page: Timetable, description: 'Six periods a day by class or by teacher. A teacher cannot be put in two classes in the same period.' },
    { key: 'cover', label: 'Staff absence & cover', icon: IcoRefresh, group: 'Teaching', collection: 'leave', detail: CoverDetail, description: 'When a teacher is away for a day, each of their periods needs a substitute who is free.' },
    { key: 'assessments', label: 'Assessments & marks', icon: IcoEdit, group: 'Teaching', collection: 'assessments', page: Assessments, detail: AssessmentDetail, description: 'Assessment tasks per subject and class: capture marks, moderate, publish. Published marks give the term percentage.' },
    { key: 'reportcards', label: 'Report cards', icon: IcoPermit, group: 'Teaching', collection: 'reports', page: ReportCards, detail: ReportDetail, description: 'One report per learner per term from published marks: teacher comment, principal sign-off, release to parents.' },
    { key: 'fees', label: 'Fees & accounts', icon: IcoWallet, group: 'Finance', collection: 'accounts', page: Fees, detail: AccountDetail, description: 'One fee account per family: monthly invoices, payments, statements, arrears ageing and payment arrangements.' },
    { key: 'payments', label: 'Payments received', icon: IcoReceipt, group: 'Finance', collection: 'payments', detail: PaymentDetail, description: 'Bank deposits and receipts waiting to be allocated to a family account.' },
    { key: 'discipline', label: 'Discipline & merits', icon: IcoFlag, group: 'School office', collection: 'discipline', page: Discipline, detail: DisciplineDetail, description: 'Incidents and merits with points per learner, parent contact, detentions and outcomes.' },
    { key: 'staff', label: 'Staff', icon: IcoBriefcase, group: 'School office', collection: 'staff', detail: StaffDetail, description: 'Teachers and office staff: subjects, class, SACE registration and police clearance, and days absent.' },
    { key: 'notices', label: 'Notices', icon: IcoSend, group: 'School office', collection: 'notices', page: Notices, detail: NoticeDetail, description: 'Announcements to the whole school, a grade or a class: drafted, approved, then logged as sent with a preview.' },
    { key: 'calendar', label: 'Term calendar', icon: IcoClock, group: 'School office', collection: 'events', description: 'Term dates, tests, sport, meetings and holidays.' },
    { key: 'reports', label: 'Reports', icon: IcoChart, group: 'School office', page: Reports, description: 'Enrolment against capacity, attendance by grade, results by subject, fees billed and collected, and the admissions pipeline.' },
  ],
  collections,
  seed: buildEducationSeed,
  dashboard: Dashboard,
  boundaries: [
    'Children’s information here is entirely invented. The demo has no POPIA or child-data controls: no consent records, no access logging, no retention rules and no real access control.',
    'Not connected to SA-SAMS, LURITS or any education department system, and not a learning management system: no lessons, homework or online classes.',
    'Marks, weightings, the pass mark and the report card scale are demo rules, not CAPS assessment or promotion policy. Nothing here decides whether a learner progresses.',
    'No messages are sent. Absence messages, notices and report releases are previews that are logged in this browser only.',
    'No payment processing and no bank feed: payments are typed in by whoever is using this browser. School fees are shown without VAT as a demo simplification, and this is not an accounting system.',
    'Report cards carry a DEMONSTRATION watermark and are not official school reports. Withholding reports for unpaid fees is deliberately not part of the demo.',
    'The school is shown as a representative subset — one class per grade with small classes — and every learner, parent, staff member, SACE number and amount is fictional.',
  ],
  guide: [
    { title: 'Take today’s register', detail: 'Press “Mark all present”, then tap “Absent” next to the learner who was away the last two school days and try to submit: an absence needs a reason. Choose one and submit — the register locks, the third day in a row is flagged and the message to the parent is previewed.', to: 'attendance', as: 'u_teacher' },
    { title: 'Enrol a new learner', detail: 'Press “Documents received”: it is refused until the immunisation card is ticked. Then record the assessment, make the offer, record the deposit and accept — the learner is placed in a class and the family’s fee account opens by itself.', to: 'admissions/applications_1', as: 'u_secretary' },
    { title: 'Cover an absent teacher', detail: 'The Sciences teacher is off sick today. Each of his periods lists who can stand in and exactly why the others cannot (teaching another class, absent, already covering). Assign one, then fill the rest in one click.', to: 'cover/leave_1', as: 'u_deputy' },
    { title: 'Capture, moderate and publish marks', detail: 'Two learners have no mark, so submitting is refused. Enter them (a mark above the total is refused too) and submit. “Moderate” is then refused because you captured the marks — switch to the deputy in the top bar to moderate and publish.', to: 'assessments/assessments_1', as: 'u_teacher' },
    { title: 'Sign and release a report card', detail: 'This report is built from published marks, with the class average and attendance. Press “Principal sign-off”, then “Release to parents” (logged, never sent) and “Print” for the watermarked copy. A report with unpublished marks cannot be signed.', to: 'reportcards/reports_1', as: 'u_principal' },
    { title: 'Raise the month’s invoices and take a payment', detail: 'Press “Raise invoices” — every family is billed its instalment with the sibling discount applied. Then open an account in arrears from the ageing list and record a payment; more than the balance is refused.', to: 'fees', as: 'u_bursar' },
  ],
  highlights: [
    'Admissions to enrolment: documents, capacity and deposit checks, then the learner, class place and fee account are created',
    'Daily registers in one tap per learner, locked on submission, with chronic-absence flags',
    'Marks captured, moderated by a second person and published into term percentages and report cards',
    'Family fee accounts with sibling discount, arrears ageing and payment arrangements',
  ],
};

export default config;
