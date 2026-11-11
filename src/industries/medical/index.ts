// General medical practice demo. Fictional practice: Acacia Family Practice.
// Rules are demo data-entry rules only — not clinical decision support.
import type { CollectionDef, Flag, IndustryConfig, Transition, WorkflowDef } from '../../core/types';
import { can, findRecord, num, records, str } from '../../core/engine';
import { daysBetween, formatDate } from '../../core/lib/dates';
import { IcoCalendar, IcoChart, IcoFlask, IcoHeart, IcoPill, IcoReceipt, IcoStethoscope, IcoUsers } from '../../core/components/Icons';
import { CHRONIC_CONDITIONS, CLINICIANS, CONTROL, DOCTORS, FREQUENCIES, ICD10, LABS, MEDICINES, SCHEMES, TESTS, VISIT_TYPES, label, opt } from './data';
import { buildMedicalSeed } from './seed';
import {
  claimProblems, claimTotal, consultProblems, needsDoctor, nowTime, patientName, resultFlags, reviewState, scriptProblems, tariffForConsult, todayStr, triageBlock, vitalAlerts,
} from './helpers';
export * from './helpers';
import Dashboard from './pages/Dashboard';
import WaitingRoom from './pages/WaitingRoom';
import VisitDetail from './pages/VisitDetail';
import PatientProfile from './pages/PatientProfile';
import ConsultDetail from './pages/ConsultDetail';
import ScriptDetail from './pages/ScriptDetail';
import ResultsInbox from './pages/ResultsInbox';
import ResultDetail from './pages/ResultDetail';
import ChronicCare from './pages/ChronicCare';
import ChronicDetail from './pages/ChronicDetail';
import ClaimDetail from './pages/ClaimDetail';
import Reports from './pages/Reports';

/* ------------------------------------------------------------------ */
const visitWorkflow: WorkflowDef = {
  initial: 'booked',
  states: [
    { key: 'booked', label: 'Booked', tone: 'dark' },
    { key: 'arrived', label: 'Arrived', tone: 'blue', hint: 'Waiting for triage' },
    { key: 'triaged', label: 'Triaged', tone: 'accent', hint: 'Vitals captured, waiting for the doctor' },
    { key: 'withdoctor', label: 'With doctor', tone: 'amber' },
    { key: 'billing', label: 'Billing', tone: 'accent' },
    { key: 'done', label: 'Done', tone: 'green', terminal: true },
    { key: 'dna', label: 'Did not attend', tone: 'red', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'booked', to: 'arrived', label: 'Check in', permission: 'bookings', intent: 'primary',
      guard: ({ record }) => (str(record, 'date') !== todayStr() ? 'Patients can only be checked in on the day of the visit.' : null),
      after: ({ record, api }) => api.update('visits', record.id, { arrivedAt: nowTime() }) },
    { from: 'arrived', to: 'triaged', label: 'Record triage', permission: 'triage', intent: 'primary',
      guard: ({ record, data }) => triageBlock(record, data),
      after: ({ record, api }) => {
        api.update('visits', record.id, { triagedAt: nowTime() });
        const alerts = vitalAlerts(record.values);
        if (alerts.length) api.toast(`${alerts.map((a) => a.label).join(' · ')}`, 'info');
      } },
    { from: 'triaged', to: 'withdoctor', label: 'Call in to doctor', permission: 'clinical.record', intent: 'primary',
      guard: ({ record }) => (needsDoctor(record) || vitalAlerts(record.values).length ? null : 'Nurse-only visit. Use “Nurse visit complete”, or flag vitals for doctor review.') },
    { from: 'triaged', to: 'billing', label: 'Nurse visit complete', permission: 'triage',
      guard: ({ record }) => (needsDoctor(record) ? 'This visit type needs a doctor consultation before billing.' : null) },
    { from: 'withdoctor', to: 'billing', label: 'Send to billing', permission: 'clinical.record', intent: 'primary',
      guard: ({ record, data }) => {
        const consult = records(data, 'consults').find((c) => str(c, 'visit') === record.id);
        if (!consult) return 'Start and sign a consultation for this visit first.';
        if (consult.status !== 'signed') return `Sign consultation ${consult.ref} before sending the patient to billing.`;
        return null;
      } },
    { from: 'billing', to: 'done', label: 'Check out', permission: 'bookings', intent: 'primary' },
    { from: 'booked', to: 'dna', label: 'Mark did not attend', permission: 'bookings', intent: 'danger',
      guard: ({ record }) => (str(record, 'date') > todayStr() ? 'A future visit cannot be marked as did not attend.' : null) },
    { from: ['booked', 'arrived'], to: 'cancelled', label: 'Cancel', permission: 'bookings', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const signTransition = (from: string, labelText: string): Transition => ({
  from, to: 'signed', label: labelText, permission: 'clinical.record', intent: 'primary',
  guard: ({ record }) => consultProblems(record)[0] ?? null,
  after: ({ record, data, api, today }) => {
    if (records(data, 'claims').some((c) => str(c, 'consult') === record.id)) return;
    const p = findRecord(data, 'patients', str(record, 'patient'));
    const t = tariffForConsult(record, data);
    const claim = api.create('claims', {
      patient: str(record, 'patient'), consult: record.id, visit: str(record, 'visit'), date: str(record, 'date') || today, doctor: str(record, 'doctor'),
      scheme: str(p, 'scheme'), memberNo: str(p, 'memberNo'), icd10: str(record, 'icd10'), schemePaid: 0, patientPaid: 0, submittedOn: '', notes: '',
      lines: [{ id: `ln_${record.id}`, code: t.code, description: t.description, qty: 1, unitPrice: t.price }],
    }, 'draft', `Draft claim from consultation ${record.ref}`);
    api.toast(`Draft claim ${claim.ref} created (${t.code})`);
  },
});

const consultWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'amber' },
    { key: 'signed', label: 'Signed', tone: 'green' },
    { key: 'addendum', label: 'Addendum open', tone: 'red' },
  ],
  transitions: [
    signTransition('draft', 'Sign consultation'),
    { from: 'signed', to: 'addendum', label: 'Add addendum', permission: 'clinical.record', requiresNote: true },
    signTransition('addendum', 'Sign addendum'),
  ],
};

/* ------------------------------------------------------------------ */
const scriptWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'amber' },
    { key: 'issued', label: 'Issued', tone: 'blue' },
    { key: 'dispensed', label: 'Dispensed', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'issued', label: 'Sign & issue', permission: 'prescribe', intent: 'primary', guard: ({ record, data }) => scriptProblems(record, data)[0] ?? null },
    { from: 'issued', to: 'dispensed', label: 'Mark dispensed', intent: 'primary', guard: ({ record, data }) => scriptProblems(record, data)[0] ?? null },
    { from: ['draft', 'issued'], to: 'cancelled', label: 'Cancel script', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const resultWorkflow: WorkflowDef = {
  initial: 'requested',
  states: [
    { key: 'requested', label: 'Requested', tone: 'dark' },
    { key: 'received', label: 'Received', tone: 'blue' },
    { key: 'reviewed', label: 'Reviewed', tone: 'accent' },
    { key: 'informed', label: 'Patient informed', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'requested', to: 'received', label: 'Record result received', permission: 'clinical.view',
      guard: ({ record }) => (str(record, 'summary').trim() ? null : 'Capture the result summary first (Edit → Result summary). In the demo there is no lab feed.'),
      after: ({ record, api, today }) => { if (!str(record, 'receivedOn')) api.update('results', record.id, { receivedOn: today }); } },
    { from: 'received', to: 'reviewed', label: 'Mark reviewed', permission: 'results.review', intent: 'primary',
      after: ({ record, api, today }) => api.update('results', record.id, { reviewedOn: today }) },
    { from: 'reviewed', to: 'informed', label: 'Patient informed', requiresNote: true, intent: 'primary',
      after: ({ record, api, today }) => api.update('results', record.id, { informedOn: today }) },
    { from: 'requested', to: 'cancelled', label: 'Cancel request', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const chronicWorkflow: WorkflowDef = {
  initial: 'active',
  states: [
    { key: 'active', label: 'Active', tone: 'green' },
    { key: 'lapsed', label: 'Lapsed', tone: 'amber', hint: 'Not attending reviews' },
    { key: 'discharged', label: 'Removed from register', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'active', to: 'lapsed', label: 'Mark lapsed', permission: 'chronic', requiresNote: true },
    { from: 'lapsed', to: 'active', label: 'Re-activate', permission: 'chronic', intent: 'primary' },
    { from: ['active', 'lapsed'], to: 'discharged', label: 'Remove from register', permission: 'chronic', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const claimWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'submitted', label: 'Submitted', tone: 'blue' },
    { key: 'partpaid', label: 'Part paid', tone: 'amber' },
    { key: 'paid', label: 'Paid', tone: 'green', terminal: true },
    { key: 'rejected', label: 'Rejected', tone: 'red' },
    { key: 'patient', label: 'Billed to patient', tone: 'accent' },
    { key: 'settled', label: 'Settled', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'submitted', label: 'Submit to scheme (simulated)', permission: 'billing', intent: 'primary',
      guard: ({ record, data }) => claimProblems(record, data)[0] ?? null },
    { from: 'submitted', to: 'paid', label: 'Record full remittance', permission: 'billing',
      guard: ({ record }) => (num(record, 'schemePaid') * 100 >= claimTotal(record) - 1 ? null : 'Enter the scheme payment equal to the claim total first (Edit → Scheme paid).') },
    { from: 'submitted', to: 'partpaid', label: 'Record part payment', permission: 'billing', requiresNote: true,
      guard: ({ record }) => (num(record, 'schemePaid') > 0 && num(record, 'schemePaid') * 100 < claimTotal(record) ? null : 'Enter a scheme payment that is less than the total first.') },
    { from: 'submitted', to: 'rejected', label: 'Record rejection', permission: 'billing', requiresNote: true, intent: 'danger' },
    { from: 'rejected', to: 'draft', label: 'Correct & reopen', permission: 'billing' },
    { from: ['draft', 'rejected'], to: 'patient', label: 'Bill patient privately', permission: 'billing' },
    { from: ['partpaid', 'patient'], to: 'settled', label: 'Patient balance settled', permission: 'billing', intent: 'primary' },
  ],
};

const vital = (key: string, labelText: string, min: number, max: number, step = 1) =>
  ({ key, label: labelText, type: 'number' as const, min, max, step, permission: 'clinical.view' });

const collections: CollectionDef[] = [
  {
    key: 'patients', singular: 'Patient', plural: 'Patients', refPrefix: 'PT', editPermission: 'patients.edit',
    title: (r) => `${str(r, 'firstName')} ${str(r, 'lastName')}`,
    subtitle: (r) => `${label(SCHEMES, str(r, 'scheme'))}${str(r, 'dob') ? ` · born ${formatDate(str(r, 'dob'))}` : ''}`,
    sort: (a, b) => str(a, 'lastName').localeCompare(str(b, 'lastName')),
    createFields: ['firstName', 'lastName', 'dob', 'sex', 'phone', 'email', 'scheme', 'memberNo', 'dependant', 'usualDoctor', 'allergies', 'chronicConditions'],
    flags: (r, data, today) => {
      const f: Flag[] = [];
      if (str(r, 'scheme') && str(r, 'scheme') !== 'private' && !str(r, 'memberNo')) f.push({ tone: 'amber', label: 'Membership no. missing' });
      if (records(data, 'chronic').some((c) => str(c, 'patient') === r.id && c.status === 'active' && reviewState(c, today) === 'overdue')) f.push({ tone: 'red', label: 'Chronic review overdue' });
      return f;
    },
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'lastName', label: 'Surname', type: 'text', required: true, table: true },
      { key: 'dob', label: 'Date of birth', type: 'date', required: true, validate: (v) => (String(v) > todayStr() ? 'Date of birth cannot be in the future.' : null) },
      { key: 'sex', label: 'Sex', type: 'select', options: [{ value: 'F', label: 'Female' }, { value: 'M', label: 'Male' }, { value: 'X', label: 'Other / not stated' }] },
      { key: 'phone', label: 'Mobile (fictional)', type: 'text', required: true, table: true, validate: (v) => (/^0\d{2} \d{3} \d{4}$/.test(String(v)) ? null : 'Use the format 0xx xxx xxxx.') },
      { key: 'email', label: 'Email', type: 'text', validate: (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : 'Enter a valid email address.') },
      { key: 'scheme', label: 'Medical aid', type: 'select', options: SCHEMES, required: true, table: true },
      { key: 'memberNo', label: 'Membership no. (fictional)', type: 'text', validate: (v, all) => (all.scheme !== 'private' && !v ? 'Required for medical aid patients.' : null) },
      { key: 'dependant', label: 'Dependant code', type: 'text', placeholder: '00 = main member' },
      { key: 'usualDoctor', label: 'Usual doctor', type: 'select', options: opt(DOCTORS), table: true },
      { key: 'lastVisit', label: 'Last visit', type: 'date', table: true },
      { key: 'allergies', label: 'Allergies', type: 'textarea', permission: 'clinical.view', hint: 'Free text, e.g. “Penicillin (rash)” or “No known allergies”. Scripts are checked against this text.' },
      { key: 'chronicConditions', label: 'Chronic conditions', type: 'textarea', permission: 'clinical.view' },
      { key: 'currentMeds', label: 'Current medication', type: 'textarea', permission: 'clinical.view' },
    ],
  },
  {
    key: 'visits', singular: 'Visit', plural: 'Visits', refPrefix: 'VS', workflow: visitWorkflow, editPermission: 'bookings',
    title: (r, d) => patientName(d, r.values.patient),
    subtitle: (r) => `${label(VISIT_TYPES, str(r, 'type'))} · ${formatDate(str(r, 'date'))} ${str(r, 'time')}`,
    sort: (a, b) => (str(b, 'date') + str(b, 'time')).localeCompare(str(a, 'date') + str(a, 'time')),
    createFields: ['patient', 'type', 'date', 'time', 'clinician', 'reason'],
    flags: (r, _d, _t, user) => (can(user, 'clinical.view') && ['arrived', 'triaged', 'withdoctor'].includes(r.status ?? '') ? vitalAlerts(r.values) : []),
    fields: [
      { key: 'patient', label: 'Patient', type: 'ref', ref: 'patients', required: true },
      { key: 'type', label: 'Visit type', type: 'select', options: opt(VISIT_TYPES), required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'time', label: 'Time', type: 'time', required: true, table: true, validate: (v) => (String(v) < '07:30' || String(v) > '17:00' ? 'The practice books between 07:30 and 17:00.' : null) },
      { key: 'clinician', label: 'With', type: 'select', options: opt(CLINICIANS), required: true, table: true,
        validate: (v, all) => (VISIT_TYPES.find((t) => t.value === all.type)?.doctor && v === 'nd' ? 'This visit type needs a doctor.' : null) },
      { key: 'reason', label: 'Reason (as told to reception)', type: 'text' },
      { key: 'arrivedAt', label: 'Arrived at', type: 'time' },
      { key: 'triagedAt', label: 'Triaged at', type: 'time' },
      vital('bpSys', 'BP systolic (mmHg)', 60, 260), vital('bpDia', 'BP diastolic (mmHg)', 30, 160), vital('pulse', 'Pulse (bpm)', 30, 220),
      vital('temp', 'Temperature (°C)', 33, 43, 0.1), vital('spo2', 'SpO2 (%)', 50, 100), vital('weight', 'Weight (kg)', 1, 300, 0.1), vital('glucose', 'Glucose (mmol/L, optional)', 1, 40, 0.1),
      { key: 'triageNote', label: 'Triage note', type: 'textarea', permission: 'clinical.view' },
    ],
  },
  {
    key: 'consults', singular: 'Consultation', plural: 'Consultations', refPrefix: 'CN', workflow: consultWorkflow, editPermission: 'clinical.record',
    title: (r, d) => patientName(d, r.values.patient),
    subtitle: (r) => `${formatDate(str(r, 'date'))} · ${label(CLINICIANS, str(r, 'doctor'))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || b.createdAt.localeCompare(a.createdAt),
    createFields: ['patient', 'visit', 'date', 'doctor'],
    flags: (r, _d, today) => (r.status !== 'signed' && str(r, 'date') < today ? [{ tone: 'red', label: 'Unsigned from a previous day' }] : []),
    fields: [
      { key: 'patient', label: 'Patient', type: 'ref', ref: 'patients', required: true },
      { key: 'visit', label: 'Visit', type: 'ref', ref: 'visits' },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'doctor', label: 'Doctor', type: 'select', options: opt(DOCTORS), required: true, table: true },
      { key: 'subjective', label: 'S — Subjective', type: 'textarea', permission: 'clinical.view' },
      { key: 'objective', label: 'O — Objective', type: 'textarea', permission: 'clinical.view' },
      { key: 'assessment', label: 'A — Assessment', type: 'textarea', permission: 'clinical.view' },
      { key: 'plan', label: 'P — Plan', type: 'textarea', permission: 'clinical.view' },
      { key: 'icd10', label: 'ICD-10 (sample)', type: 'select', options: ICD10, table: true, permission: 'clinical.view' },
      { key: 'sickNoteDays', label: 'Sick note (days)', type: 'number', min: 0, max: 30 },
      { key: 'followUp', label: 'Follow-up by', type: 'date' },
    ],
  },
  {
    key: 'scripts', singular: 'Script', plural: 'Scripts', refPrefix: 'RX', workflow: scriptWorkflow, editPermission: 'prescribe',
    title: (r, d) => patientName(d, r.values.patient),
    subtitle: (r) => `${label(MEDICINES, str(r, 'medicine'))} ${str(r, 'strength')} · ${formatDate(str(r, 'date'))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || b.createdAt.localeCompare(a.createdAt),
    createFields: ['patient', 'consult', 'date', 'prescriber', 'medicine', 'strength', 'dose', 'frequency', 'durationDays', 'repeats', 'instructions'],
    flags: (r, data, _t, user) => {
      if (r.status !== 'draft' && r.status !== 'issued') return [];
      const p = findRecord(data, 'patients', str(r, 'patient'));
      if (!scriptProblems(r, data).some((x) => x.startsWith('Recorded allergy'))) return [];
      // Allergy detail is clinical; other roles only see that a check is blocking.
      return [{ tone: 'red', label: can(user, 'clinical.view') ? `Allergy match: ${str(p, 'allergies')}` : 'Clinical check blocking' }];
    },
    fields: [
      { key: 'patient', label: 'Patient', type: 'ref', ref: 'patients', required: true },
      { key: 'consult', label: 'From consultation', type: 'ref', ref: 'consults' },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'prescriber', label: 'Prescriber', type: 'select', options: opt(DOCTORS), required: true },
      { key: 'medicine', label: 'Medicine (generic)', type: 'select', options: MEDICINES.map((m) => ({ value: m.value, label: `${m.label} (${m.group})` })), required: true, table: true },
      { key: 'strength', label: 'Strength / form', type: 'text', hint: 'Leave blank to use the usual strength for the medicine' },
      { key: 'dose', label: 'Dose', type: 'text', required: true, placeholder: 'e.g. 1 tablet' },
      { key: 'frequency', label: 'Frequency', type: 'select', options: FREQUENCIES, required: true, table: true },
      { key: 'durationDays', label: 'Duration (days)', type: 'number', min: 1, max: 180, required: true },
      { key: 'repeats', label: 'Repeats', type: 'number', min: 0, max: 5, step: 1, required: true, table: true, validate: (v) => (Number.isInteger(Number(v)) ? null : 'Repeats must be a whole number.') },
      { key: 'instructions', label: 'Instructions', type: 'textarea' },
    ],
  },
  {
    key: 'results', singular: 'Result', plural: 'Results', refPrefix: 'LR', workflow: resultWorkflow, editPermission: 'clinical.view',
    title: (r, d) => patientName(d, r.values.patient),
    subtitle: (r) => `${label(TESTS, str(r, 'test'))} · requested ${formatDate(str(r, 'requestedOn'))}`,
    sort: (a, b) => str(b, 'requestedOn').localeCompare(str(a, 'requestedOn')),
    createFields: ['patient', 'consult', 'test', 'lab', 'requestedOn', 'requestedBy'],
    flags: (r, _d, today) => resultFlags(r, today),
    fields: [
      { key: 'patient', label: 'Patient', type: 'ref', ref: 'patients', required: true },
      { key: 'consult', label: 'From consultation', type: 'ref', ref: 'consults' },
      { key: 'test', label: 'Test', type: 'select', options: TESTS, required: true, table: true },
      { key: 'lab', label: 'Laboratory', type: 'select', options: LABS, required: true, table: true },
      { key: 'requestedOn', label: 'Requested on', type: 'date', required: true, table: true },
      { key: 'requestedBy', label: 'Requested by', type: 'select', options: opt(DOCTORS), required: true },
      { key: 'receivedOn', label: 'Received on', type: 'date' },
      { key: 'reviewedOn', label: 'Reviewed on', type: 'date' },
      { key: 'informedOn', label: 'Patient informed on', type: 'date' },
      { key: 'abnormal', label: 'Flagged abnormal by lab', type: 'boolean' },
      { key: 'summary', label: 'Result summary', type: 'textarea', permission: 'clinical.view' },
      { key: 'action', label: 'Doctor’s action', type: 'textarea', permission: 'clinical.view' },
    ],
  },
  {
    key: 'chronic', singular: 'Chronic register entry', plural: 'Chronic care register', refPrefix: 'CC', workflow: chronicWorkflow, editPermission: 'chronic',
    title: (r, d) => patientName(d, r.values.patient),
    subtitle: (r) => `${label(CHRONIC_CONDITIONS, str(r, 'condition'))} · next review ${formatDate(str(r, 'nextReview'))}`,
    sort: (a, b) => str(a, 'nextReview').localeCompare(str(b, 'nextReview')),
    createFields: ['patient', 'condition', 'diagnosedOn', 'doctor', 'lastReview', 'nextReview', 'control', 'targets', 'carePlan'],
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      if (r.status !== 'active') return f;
      const s = reviewState(r, today);
      if (s === 'overdue') f.push({ tone: 'red', label: `Review overdue ${daysBetween(str(r, 'nextReview'), today)} days` });
      if (s === 'due-soon') f.push({ tone: 'amber', label: 'Review due within 30 days' });
      if (str(r, 'control') === 'poor') f.push({ tone: 'red', label: 'Poorly controlled' });
      return f;
    },
    fields: [
      { key: 'patient', label: 'Patient', type: 'ref', ref: 'patients', required: true },
      { key: 'condition', label: 'Condition', type: 'select', options: opt(CHRONIC_CONDITIONS), required: true, table: true },
      { key: 'diagnosedOn', label: 'Diagnosed', type: 'date' },
      { key: 'doctor', label: 'Responsible doctor', type: 'select', options: opt(DOCTORS), table: true },
      { key: 'lastReview', label: 'Last review', type: 'date', table: true },
      { key: 'nextReview', label: 'Next review due', type: 'date', required: true, table: true,
        validate: (v, all) => (all.lastReview && String(v) < String(all.lastReview) ? 'Next review must be after the last review.' : null) },
      { key: 'control', label: 'Control status', type: 'select', options: CONTROL, required: true, table: true },
      { key: 'targets', label: 'Targets (demo)', type: 'text', permission: 'clinical.view' },
      { key: 'carePlan', label: 'Care plan notes', type: 'textarea', permission: 'clinical.view' },
    ],
  },
  {
    key: 'claims', singular: 'Claim / account', plural: 'Billing & claims', refPrefix: 'CLM', workflow: claimWorkflow, editPermission: 'billing',
    title: (r, d) => patientName(d, r.values.patient),
    subtitle: (r) => `${label(SCHEMES, str(r, 'scheme'))} · ${formatDate(str(r, 'date'))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || b.createdAt.localeCompare(a.createdAt),
    flags: (r, _d, today) => (r.status === 'submitted' && daysBetween(str(r, 'submittedOn') || str(r, 'date'), today) > 30 ? [{ tone: 'amber', label: 'No remittance 30+ days' }] : []),
    fields: [
      { key: 'patient', label: 'Patient', type: 'ref', ref: 'patients', required: true },
      { key: 'date', label: 'Service date', type: 'date', required: true, table: true },
      { key: 'doctor', label: 'Treating clinician', type: 'select', options: opt(CLINICIANS) },
      { key: 'scheme', label: 'Medical aid', type: 'select', options: SCHEMES, required: true, table: true },
      { key: 'memberNo', label: 'Membership no. (fictional)', type: 'text' },
      { key: 'icd10', label: 'ICD-10 (sample)', type: 'select', options: ICD10 },
      { key: 'consult', label: 'Consultation', type: 'ref', ref: 'consults' },
      { key: 'visit', label: 'Visit', type: 'ref', ref: 'visits' },
      { key: 'schemePaid', label: 'Scheme paid', type: 'money', min: 0, table: true },
      { key: 'patientPaid', label: 'Patient paid', type: 'money', min: 0 },
      { key: 'submittedOn', label: 'Submitted on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'lines', label: 'Tariff lines (demo codes)', type: 'lines', wide: true },
    ],
  },
];

const config: IndustryConfig = {
  id: 'medical',
  industry: 'General medical practice',
  businessName: 'Acacia Family Practice',
  monogram: 'AF',
  workspaceTag: 'PRACTICE WORKSPACE',
  tagline: 'Family GP practice management',
  summary: 'A family GP practice: today’s waiting room from check-in through triage, doctor and billing; SOAP consultations with ICD-10 samples; scripts checked against recorded allergies; a results inbox; a chronic care register; and medical aid claims.',
  priority: 2,
  theme: { accent: '#3f7d5c', accent2: '#4c8f6b', accentSoft: '#a9d6bb', accentTint: '#e8f3ec', accentLine: '#cde5d6', accentText: '#2f6248' },
  roles: [
    { key: 'partner', label: 'GP partner' },
    { key: 'gp', label: 'GP / locum doctor' },
    { key: 'nurse', label: 'Practice nurse' },
    { key: 'reception', label: 'Reception' },
    { key: 'billing', label: 'Billing administrator' },
  ],
  permissions: [
    { key: 'clinical.view', label: 'View clinical', description: 'See vitals, SOAP notes, allergies, chronic conditions and result summaries' },
    { key: 'clinical.record', label: 'Record consultations', description: 'Call patients in, write and sign SOAP notes, request tests' },
    { key: 'triage', label: 'Triage', description: 'Capture vitals and complete nurse-only visits' },
    { key: 'bookings', label: 'Bookings', description: 'Book, check in, check out, cancel and mark did-not-attend' },
    { key: 'patients.edit', label: 'Edit patients', description: 'Register patients and edit demographic and medical aid details' },
    { key: 'results.review', label: 'Review results', description: 'Mark lab results as reviewed by a doctor' },
    { key: 'prescribe', label: 'Prescribe', description: 'Draft, sign and issue scripts' },
    { key: 'chronic', label: 'Chronic register', description: 'Add patients to the chronic register and record reviews' },
    { key: 'billing', label: 'Billing', description: 'Create, submit and reconcile claims and accounts' },
  ],
  modules: [
    { key: 'waiting', label: 'Waiting room & visits', icon: IcoCalendar, group: 'Front desk', collection: 'visits', page: WaitingRoom, detail: VisitDetail, description: 'Today’s queue by stage: check in, triage with vitals, doctor, billing and check-out. Book and manage visits.' },
    { key: 'patients', label: 'Patients', icon: IcoUsers, group: 'Front desk', collection: 'patients', detail: PatientProfile, description: 'Patient register with fictional medical aid details, allergies, chronic conditions and a full visit timeline.' },
    { key: 'consults', label: 'Consultations', icon: IcoStethoscope, group: 'Clinical', collection: 'consults', detail: ConsultDetail, description: 'SOAP consultation notes with sample ICD-10 codes and sick notes. Signing creates a draft claim.' },
    { key: 'scripts', label: 'Scripts', icon: IcoPill, group: 'Clinical', collection: 'scripts', detail: ScriptDetail, description: 'Prescriptions checked against the patient’s recorded allergies before issue and dispensing.' },
    { key: 'results', label: 'Results inbox', icon: IcoFlask, group: 'Clinical', collection: 'results', page: ResultsInbox, detail: ResultDetail, description: 'Lab and pathology results from request to doctor review and informing the patient.' },
    { key: 'chronic', label: 'Chronic care register', icon: IcoHeart, group: 'Clinical', collection: 'chronic', page: ChronicCare, detail: ChronicDetail, description: 'Hypertension, diabetes, asthma, thyroid and lipid patients with review dates, control status and care plans.' },
    { key: 'claims', label: 'Billing & claims', icon: IcoReceipt, group: 'Practice', collection: 'claims', detail: ClaimDetail, description: 'Medical aid claims and patient accounts with demo tariff codes. Simulated — no switch or scheme connection.' },
    { key: 'reports', label: 'Practice reports', icon: IcoChart, group: 'Practice', page: Reports, description: 'Consultations per doctor, did-not-attend rate, chronic reviews overdue, billing by funder and result turnaround.' },
  ],
  collections,
  seed: buildMedicalSeed,
  dashboard: Dashboard,
  boundaries: [
    'Not an electronic health record: no HPCSA, POPIA, record-retention, audit or consent controls are implemented.',
    'Vitals highlights (BP ≥ 140/90, temperature ≥ 38.0 °C, SpO2 < 94%) are demo display rules, not clinical thresholds or advice.',
    'Allergy checks are a simple text match for the demo — not clinical decision support and not a drug-interaction database.',
    'No laboratory, pharmacy, medical aid or switching-house integrations: results, dispensing and remittances are entered by hand.',
    'Scheme names, membership numbers, labs and tariff codes (DEMO-…) are invented. ICD-10 codes are public samples. VAT treatment is simplified.',
    'Sick notes and scripts are on-screen previews marked as demonstrations. No SMS, email or other message is sent.',
  ],
  highlights: [
    'Waiting room board: arrived → triaged → with doctor → billing, with a vitals triage form',
    'SOAP consultations need an assessment and ICD-10 before signing; signing drafts the claim',
    'Scripts blocked when the patient’s recorded allergies match the drug group',
    'Results inbox and chronic care register with overdue review tracking',
  ],
};

export default config;
