// Optometry demo — PRIORITY ONE. Fictional practice: Northgate Optometry.
import type { CollectionDef, IndustryConfig, WorkflowDef } from '../../core/types';
import { findRecord, num, str } from '../../core/engine';
import { addDays, daysBetween, dueState, formatDate } from '../../core/lib/dates';
import { IcoBox, IcoCalendar, IcoChart, IcoEye, IcoGlasses, IcoPhone, IcoReceipt, IcoUsers, IcoDoc } from '../../core/components/Icons';
import { APPOINTMENT_TYPES, ICD10, LABS, LENS_OPTIONS, OPTOMETRISTS, PRACTITIONERS, RECALL_TYPES, SCHEMES, label } from './data';
import { buildOptometrySeed } from './seed';
import { claimProblems, claimTotal, examProblems, isClinical, patientName, RX_TYPES, STOCK_CATEGORIES, todayStr } from './helpers';
export * from './helpers';
import Dashboard from './pages/Dashboard';
import Diary from './pages/Diary';
import PatientProfile from './pages/PatientProfile';
import ExamDetail from './pages/ExamDetail';
import AppointmentDetail from './pages/AppointmentDetail';
import PrescriptionDetail from './pages/PrescriptionDetail';
import OrderDetail from './pages/OrderDetail';
import ClaimDetail from './pages/ClaimDetail';
import Recalls from './pages/Recalls';
import Reports from './pages/Reports';

const opt = (list: Array<{ value: string; label: string }>) => list.map(({ value, label: l }) => ({ value, label: l }));

/* ------------------------------------------------------------------ */
const appointmentWorkflow: WorkflowDef = {
  initial: 'booked',
  states: [
    { key: 'booked', label: 'Booked', tone: 'dark' },
    { key: 'arrived', label: 'Checked in', tone: 'blue' },
    { key: 'pretest', label: 'Pre-test', tone: 'accent' },
    { key: 'inexam', label: 'In consulting room', tone: 'amber' },
    { key: 'dispensing', label: 'Dispensing', tone: 'accent' },
    { key: 'completed', label: 'Completed', tone: 'green', terminal: true },
    { key: 'noshow', label: 'Did not attend', tone: 'red', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'booked', to: 'arrived', label: 'Check in', permission: 'bookings', intent: 'primary',
      guard: ({ record }) => (str(record, 'date') !== todayStr() ? 'Patients can only be checked in on the day of the appointment.' : null) },
    { from: 'arrived', to: 'pretest', label: 'Start pre-test', permission: 'bookings',
      guard: ({ record }) => (isClinical(record) ? null : 'Pre-test applies to clinical appointments only.') },
    { from: ['arrived', 'pretest'], to: 'inexam', label: 'Call into room', permission: 'clinical.record',
      guard: ({ record }) => (isClinical(record) ? null : 'Collections and adjustments go straight to dispensing.') },
    { from: ['arrived', 'inexam'], to: 'dispensing', label: 'Send to dispensing' },
    { from: ['arrived', 'inexam', 'dispensing'], to: 'completed', label: 'Complete visit', intent: 'primary' },
    { from: 'booked', to: 'noshow', label: 'Mark did not attend', permission: 'bookings', intent: 'danger',
      guard: ({ record }) => (str(record, 'date') > todayStr() ? 'A future appointment cannot be marked as a no-show.' : null) },
    { from: 'booked', to: 'cancelled', label: 'Cancel', permission: 'bookings', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const examWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'In progress', tone: 'amber' },
    { key: 'final', label: 'Finalised', tone: 'green' },
    { key: 'amending', label: 'Amendment open', tone: 'red' },
  ],
  transitions: [
    {
      from: ['draft', 'amending'], to: 'final', label: 'Finalise exam & issue Rx', permission: 'clinical.record', intent: 'primary',
      guard: ({ record }) => examProblems(record)[0] ?? null,
      after: ({ record, api, today }) => {
        const v = record.values;
        const months = Number(v.recallMonths) || 24;
        const patient = String(v.patient);
        api.update('patients', patient, { recallDue: addDays(today, Math.round(months * 30.4)), recallType: v.recallType || 'annual', lastExam: v.date as string }, `Recall set for ${months} months (exam ${record.ref})`);
        if (v.issueRx !== false) {
          api.create('prescriptions', {
            patient, exam: record.id, date: v.date, practitioner: v.optometrist, rxType: Number(v.r_add) || Number(v.l_add) ? 'multifocal' : 'distance',
            r_sph: v.r_sph, r_cyl: v.r_cyl, r_axis: v.r_axis, r_add: v.r_add, l_sph: v.l_sph, l_cyl: v.l_cyl, l_axis: v.l_axis, l_add: v.l_add,
            pd: v.pd, expiry: addDays(String(v.date), 730), notes: '',
          }, 'issued', `Issued from exam ${record.ref}`);
          api.toast('Prescription issued and recall date updated');
        }
      },
    },
    { from: 'final', to: 'amending', label: 'Open amendment', permission: 'clinical.record', requiresNote: true },
  ],
};

/* ------------------------------------------------------------------ */
const orderWorkflow: WorkflowDef = {
  initial: 'quote',
  states: [
    { key: 'quote', label: 'Quoted', tone: 'dark' },
    { key: 'ordered', label: 'At lab', tone: 'blue' },
    { key: 'received', label: 'Received', tone: 'accent' },
    { key: 'ready', label: 'Ready to collect', tone: 'green' },
    { key: 'remake', label: 'Remake', tone: 'red' },
    { key: 'collected', label: 'Collected', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    {
      from: 'quote', to: 'ordered', label: 'Send to lab', permission: 'dispense', intent: 'primary',
      guard: ({ record, data }) => {
        const rx = findRecord(data, 'prescriptions', str(record, 'prescription'));
        if (!rx) return 'Link a prescription before ordering.';
        if (str(rx, 'expiry') < todayStr()) return `Prescription ${rx.ref} expired on ${formatDate(str(rx, 'expiry'))}. Re-examine first.`;
        if (str(record, 'kind') !== 'cl' && !num(record, 'pd')) return 'Enter the pupillary distance (PD).';
        const frame = findRecord(data, 'stock', str(record, 'frame'));
        if (str(record, 'kind') !== 'cl' && !frame) return 'Select a frame from stock.';
        if (frame && num(frame, 'qty') < 1) return `${str(frame, 'name')} is out of stock.`;
        if (num(record, 'deposit') <= 0 && str(record, 'funding') === 'private') return 'Private orders need a deposit before going to the lab.';
        return null;
      },
      after: ({ record, data, api }) => {
        const frame = findRecord(data, 'stock', str(record, 'frame'));
        if (frame) api.update('stock', frame.id, { qty: num(frame, 'qty') - 1 }, `1 reserved for order ${record.ref}`);
      },
    },
    { from: ['ordered'], to: 'received', label: 'Receive from lab', permission: 'dispense' },
    { from: 'received', to: 'ready', label: 'Pass quality check', permission: 'dispense', intent: 'primary' },
    { from: 'received', to: 'remake', label: 'Fail quality check', permission: 'dispense', requiresNote: true, intent: 'danger' },
    { from: 'remake', to: 'ordered', label: 'Resend to lab', permission: 'dispense' },
    { from: 'ready', to: 'collected', label: 'Mark collected', intent: 'primary' },
    { from: 'quote', to: 'cancelled', label: 'Cancel quote', requiresNote: true, intent: 'danger' },
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
    {
      from: 'draft', to: 'submitted', label: 'Submit to scheme (simulated)', permission: 'billing', intent: 'primary',
      guard: ({ record, data }) => claimProblems(record, data)[0] ?? null,
    },
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

/* ------------------------------------------------------------------ */
const rxField = (side: 'r' | 'l', k: 'sph' | 'cyl' | 'axis' | 'add', labelText: string, extra: Partial<{ min: number; max: number; step: number }> = {}) =>
  ({ key: `${side}_${k}`, label: `${side === 'r' ? 'R' : 'L'} ${labelText}`, type: 'number' as const, permission: 'clinical.view', ...extra });

/** Prescription values are shared with dispensing staff, so no clinical permission. */
const rxOpen = (side: 'r' | 'l', k: 'sph' | 'cyl' | 'axis' | 'add', labelText: string, extra: Partial<{ min: number; max: number; step: number }> = {}) => {
  const { permission: _omit, ...rest } = rxField(side, k, labelText, extra);
  void _omit;
  return rest;
};

const collections: CollectionDef[] = [
  {
    key: 'patients', singular: 'Patient', plural: 'Patients', refPrefix: 'PT', editPermission: 'patients.edit',
    title: (r) => `${str(r, 'firstName')} ${str(r, 'lastName')}`,
    subtitle: (r) => `${label(SCHEMES, str(r, 'scheme'))}${str(r, 'dob') ? ` · born ${formatDate(str(r, 'dob'))}` : ''}`,
    sort: (a, b) => str(a, 'lastName').localeCompare(str(b, 'lastName')),
    createFields: ['firstName', 'lastName', 'dob', 'phone', 'email', 'scheme', 'memberNo', 'preferredContact', 'consentRecall'],
    flags: (r, _d, today) => {
      const f = [] as Array<{ tone: 'red' | 'amber' | 'dark'; label: string }>;
      const s = dueState(str(r, 'recallDue'), today, 30);
      if (s === 'overdue') f.push({ tone: 'red', label: 'Recall overdue' });
      if (s === 'due-soon') f.push({ tone: 'amber', label: 'Recall due' });
      if (!r.values.consentRecall) f.push({ tone: 'dark', label: 'No reminder consent' });
      return f;
    },
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'lastName', label: 'Surname', type: 'text', required: true, table: true },
      { key: 'dob', label: 'Date of birth', type: 'date', required: true, validate: (v) => (String(v) > todayStr() ? 'Date of birth cannot be in the future.' : null) },
      { key: 'phone', label: 'Mobile (fictional)', type: 'text', required: true, table: true, validate: (v) => (/^0\d{2} \d{3} \d{4}$/.test(String(v)) ? null : 'Use the format 0xx xxx xxxx.') },
      { key: 'email', label: 'Email', type: 'text', validate: (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : 'Enter a valid email address.') },
      { key: 'scheme', label: 'Medical aid', type: 'select', options: SCHEMES, required: true, table: true },
      { key: 'memberNo', label: 'Membership no. (fictional)', type: 'text', validate: (v, all) => (all.scheme !== 'private' && !v ? 'Required for medical aid patients.' : null) },
      { key: 'preferredContact', label: 'Preferred contact', type: 'select', options: [{ value: 'sms', label: 'SMS' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone call' }] },
      { key: 'consentRecall', label: 'Consents to recall reminders', type: 'boolean' },
      { key: 'lastExam', label: 'Last eye exam', type: 'date', table: true },
      { key: 'recallDue', label: 'Recall due', type: 'date', table: true },
      { key: 'recallType', label: 'Recall reason', type: 'select', options: RECALL_TYPES },
      { key: 'lastContacted', label: 'Last recall contact', type: 'date' },
      { key: 'medicalNotes', label: 'Medical history & medication', type: 'textarea', permission: 'clinical.view' },
    ],
  },
  {
    key: 'appointments', singular: 'Appointment', plural: 'Appointments', refPrefix: 'AP', workflow: appointmentWorkflow, editPermission: 'bookings',
    title: (r, d) => patientName(d, r.values.patient),
    subtitle: (r) => `${label(APPOINTMENT_TYPES, str(r, 'type'))} · ${formatDate(str(r, 'date'))} ${str(r, 'time')}`,
    sort: (a, b) => (str(b, 'date') + str(b, 'time')).localeCompare(str(a, 'date') + str(a, 'time')),
    fields: [
      { key: 'patient', label: 'Patient', type: 'ref', ref: 'patients', required: true },
      { key: 'type', label: 'Appointment type', type: 'select', options: opt(APPOINTMENT_TYPES), required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'time', label: 'Time', type: 'time', required: true, table: true, validate: (v) => (String(v) < '08:00' || String(v) > '16:30' ? 'The practice books between 08:00 and 16:30.' : null) },
      { key: 'practitioner', label: 'With', type: 'select', options: opt(PRACTITIONERS), required: true, table: true },
      { key: 'notes', label: 'Booking notes', type: 'textarea' },
    ],
  },
  {
    key: 'exams', singular: 'Eye examination', plural: 'Eye examinations', refPrefix: 'EX', workflow: examWorkflow, editPermission: 'clinical.record',
    title: (r, d) => patientName(d, r.values.patient),
    subtitle: (r) => `${formatDate(str(r, 'date'))} · ${label(PRACTITIONERS, str(r, 'optometrist'))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')),
    createFields: ['patient', 'date', 'optometrist', 'reason'],
    fields: [
      { key: 'patient', label: 'Patient', type: 'ref', ref: 'patients', required: true },
      { key: 'date', label: 'Exam date', type: 'date', required: true, table: true },
      { key: 'optometrist', label: 'Optometrist', type: 'select', options: opt(OPTOMETRISTS), required: true, table: true },
      { key: 'appointment', label: 'Appointment', type: 'ref', ref: 'appointments' },
      { key: 'reason', label: 'Reason for visit', type: 'textarea', permission: 'clinical.view' },
      { key: 'history', label: 'Ocular & general history', type: 'textarea', permission: 'clinical.view' },
      { key: 'r_vaUnaided', label: 'R VA unaided', type: 'text', permission: 'clinical.view' },
      { key: 'l_vaUnaided', label: 'L VA unaided', type: 'text', permission: 'clinical.view' },
      rxField('r', 'sph', 'sphere', { step: 0.25 }), rxField('r', 'cyl', 'cylinder', { step: 0.25 }), rxField('r', 'axis', 'axis'), rxField('r', 'add', 'add', { step: 0.25 }),
      { key: 'r_va', label: 'R VA corrected', type: 'text', permission: 'clinical.view' },
      rxField('l', 'sph', 'sphere', { step: 0.25 }), rxField('l', 'cyl', 'cylinder', { step: 0.25 }), rxField('l', 'axis', 'axis'), rxField('l', 'add', 'add', { step: 0.25 }),
      { key: 'l_va', label: 'L VA corrected', type: 'text', permission: 'clinical.view' },
      { key: 'pd', label: 'PD (mm)', type: 'number', min: 40, max: 80, step: 0.5, permission: 'clinical.view' },
      { key: 'r_iop', label: 'R IOP (mmHg)', type: 'number', min: 0, max: 70, permission: 'clinical.view' },
      { key: 'l_iop', label: 'L IOP (mmHg)', type: 'number', min: 0, max: 70, permission: 'clinical.view' },
      { key: 'anterior', label: 'Anterior eye', type: 'textarea', permission: 'clinical.view' },
      { key: 'posterior', label: 'Posterior eye / fundus', type: 'textarea', permission: 'clinical.view' },
      { key: 'diagnosis', label: 'Diagnosis (ICD-10 sample)', type: 'select', options: ICD10, table: true, permission: 'clinical.view' },
      { key: 'plan', label: 'Management plan', type: 'textarea', permission: 'clinical.view' },
      { key: 'referral', label: 'Referral', type: 'select', permission: 'clinical.view', options: [{ value: 'none', label: 'None' }, { value: 'ophth-routine', label: 'Ophthalmologist — routine' }, { value: 'ophth-urgent', label: 'Ophthalmologist — urgent' }, { value: 'gp', label: 'General practitioner' }] },
      { key: 'recallMonths', label: 'Recall in (months)', type: 'select', options: [{ value: '6', label: '6 months' }, { value: '12', label: '12 months' }, { value: '24', label: '24 months' }] },
      { key: 'recallType', label: 'Recall reason', type: 'select', options: RECALL_TYPES },
    ],
  },
  {
    key: 'prescriptions', singular: 'Prescription', plural: 'Prescriptions', refPrefix: 'RX', editPermission: 'clinical.record',
    workflow: {
      initial: 'issued',
      states: [{ key: 'issued', label: 'Current', tone: 'green' }, { key: 'superseded', label: 'Superseded', tone: 'dark', terminal: true }, { key: 'void', label: 'Voided', tone: 'red', terminal: true }],
      transitions: [
        { from: 'issued', to: 'superseded', label: 'Mark superseded', permission: 'clinical.record' },
        { from: 'issued', to: 'void', label: 'Void prescription', permission: 'clinical.record', requiresNote: true, intent: 'danger' },
      ],
    },
    title: (r, d) => patientName(d, r.values.patient),
    subtitle: (r) => `${label(RX_TYPES, str(r, 'rxType'))} · issued ${formatDate(str(r, 'date'))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')),
    flags: (r, _d, today) => {
      if (r.status !== 'issued') return [];
      const s = dueState(str(r, 'expiry'), today, 60);
      return s === 'overdue' ? [{ tone: 'red', label: 'Expired' }] : s === 'due-soon' ? [{ tone: 'amber', label: 'Expires soon' }] : [];
    },
    fields: [
      { key: 'patient', label: 'Patient', type: 'ref', ref: 'patients', required: true },
      { key: 'exam', label: 'From exam', type: 'ref', ref: 'exams' },
      { key: 'date', label: 'Issued', type: 'date', required: true, table: true },
      { key: 'practitioner', label: 'Optometrist', type: 'select', options: opt(OPTOMETRISTS), table: true },
      { key: 'rxType', label: 'Type', type: 'select', options: RX_TYPES, table: true },
      rxOpen('r', 'sph', 'sphere', { step: 0.25 }), rxOpen('r', 'cyl', 'cylinder', { step: 0.25 }), rxOpen('r', 'axis', 'axis'), rxOpen('r', 'add', 'add', { step: 0.25 }),
      rxOpen('l', 'sph', 'sphere', { step: 0.25 }), rxOpen('l', 'cyl', 'cylinder', { step: 0.25 }), rxOpen('l', 'axis', 'axis'), rxOpen('l', 'add', 'add', { step: 0.25 }),
      { key: 'pd', label: 'PD (mm)', type: 'number', min: 40, max: 80, step: 0.5 },
      { key: 'expiry', label: 'Valid until', type: 'date', required: true, table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'orders', singular: 'Optical order', plural: 'Optical orders', refPrefix: 'JOB', workflow: orderWorkflow, editPermission: 'dispense',
    title: (r, d) => patientName(d, r.values.patient),
    subtitle: (r) => `${label(LENS_OPTIONS, str(r, 'lens'))}`,
    createFields: ['patient', 'prescription', 'kind', 'frame', 'lens', 'lab', 'pd', 'heights', 'promised', 'funding', 'deposit', 'lines'],
    flags: (r, _d, today) => {
      const out: Array<{ tone: 'red' | 'amber'; label: string }> = [];
      if (['ordered', 'received', 'remake'].includes(r.status ?? '') && str(r, 'promised') && str(r, 'promised') < today) out.push({ tone: 'red', label: 'Past promised date' });
      if (r.status === 'ready' && str(r, 'readySince') && daysBetween(str(r, 'readySince'), today) >= 14) out.push({ tone: 'amber', label: 'Uncollected 14+ days' });
      return out;
    },
    fields: [
      { key: 'patient', label: 'Patient', type: 'ref', ref: 'patients', required: true },
      { key: 'prescription', label: 'Prescription', type: 'ref', ref: 'prescriptions', required: true },
      { key: 'kind', label: 'Order type', type: 'select', required: true, options: [{ value: 'spectacles', label: 'Spectacles' }, { value: 'cl', label: 'Contact lenses' }] },
      { key: 'frame', label: 'Frame (from stock)', type: 'ref', ref: 'stock' },
      { key: 'lens', label: 'Lens / product', type: 'select', options: opt(LENS_OPTIONS), required: true, table: true },
      { key: 'lab', label: 'Lab', type: 'select', options: LABS, required: true, table: true },
      { key: 'pd', label: 'PD (mm)', type: 'number', min: 40, max: 80, step: 0.5 },
      { key: 'heights', label: 'Fitting heights (mm)', type: 'text', placeholder: 'e.g. R 18 / L 18' },
      { key: 'promised', label: 'Promised date', type: 'date', required: true, table: true },
      { key: 'funding', label: 'Funding', type: 'select', required: true, options: [{ value: 'scheme', label: 'Medical aid claim' }, { value: 'private', label: 'Private payment' }] },
      { key: 'deposit', label: 'Deposit received', type: 'money', min: 0 },
      { key: 'readySince', label: 'Ready since', type: 'date' },
      { key: 'lines', label: 'Pricing', type: 'lines', wide: true },
    ],
  },
  {
    key: 'stock', singular: 'Stock item', plural: 'Frames & stock', refPrefix: 'SKU', editPermission: 'stock',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `${label(STOCK_CATEGORIES, str(r, 'category'))} · ${str(r, 'supplier')}`,
    sort: (a, b) => str(a, 'category').localeCompare(str(b, 'category')) || str(a, 'name').localeCompare(str(b, 'name')),
    flags: (r) => (num(r, 'qty') <= 0 ? [{ tone: 'red', label: 'Out of stock' }] : num(r, 'qty') <= num(r, 'reorderLevel') ? [{ tone: 'amber', label: 'Reorder' }] : []),
    fields: [
      { key: 'name', label: 'Item', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: STOCK_CATEGORIES, required: true, table: true },
      { key: 'supplier', label: 'Supplier (fictional)', type: 'text', required: true },
      { key: 'colour', label: 'Colour / size', type: 'text' },
      { key: 'cost', label: 'Cost price', type: 'money', min: 0, required: true },
      { key: 'retail', label: 'Retail price', type: 'money', min: 0, required: true, table: true, validate: (v, all) => (Number(v) < Number(all.cost) ? 'Retail is below cost.' : null) },
      { key: 'qty', label: 'On hand', type: 'number', min: 0, required: true, table: true },
      { key: 'reorderLevel', label: 'Reorder at', type: 'number', min: 0, required: true, table: true },
    ],
  },
  {
    key: 'claims', singular: 'Claim / account', plural: 'Billing & claims', refPrefix: 'CLM', workflow: claimWorkflow, editPermission: 'billing',
    title: (r, d) => patientName(d, r.values.patient),
    subtitle: (r) => `${label(SCHEMES, str(r, 'scheme'))} · ${formatDate(str(r, 'date'))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')),
    flags: (r, _d, today) => (r.status === 'submitted' && daysBetween(str(r, 'submittedOn') || str(r, 'date'), today) > 30 ? [{ tone: 'amber', label: 'No remittance 30+ days' }] : []),
    fields: [
      { key: 'patient', label: 'Patient', type: 'ref', ref: 'patients', required: true },
      { key: 'date', label: 'Service date', type: 'date', required: true, table: true },
      { key: 'scheme', label: 'Medical aid', type: 'select', options: SCHEMES, required: true, table: true },
      { key: 'memberNo', label: 'Membership no. (fictional)', type: 'text' },
      { key: 'icd10', label: 'ICD-10 (sample)', type: 'select', options: ICD10 },
      { key: 'order', label: 'Related optical order', type: 'ref', ref: 'orders' },
      { key: 'schemePaid', label: 'Scheme paid', type: 'money', min: 0, table: true },
      { key: 'patientPaid', label: 'Patient paid', type: 'money', min: 0 },
      { key: 'submittedOn', label: 'Submitted on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'lines', label: 'Claim lines (demo tariff codes)', type: 'lines', wide: true },
    ],
  },
];

const config: IndustryConfig = {
  id: 'optometry',
  industry: 'Optometry',
  businessName: 'Northgate Optometry',
  monogram: 'NO',
  workspaceTag: 'PRACTICE WORKSPACE',
  tagline: 'Eye care practice management',
  summary: 'An independent optometry practice: diary and patient flow, structured eye examinations that issue prescriptions, spectacle and contact lens orders tracked through the lab, frame stock, recalls, and medical aid claims.',
  priority: 1,
  theme: { accent: '#3b7f8c', accent2: '#4d93a1', accentSoft: '#9fd0d8', accentTint: '#e7f2f4', accentLine: '#c8e1e6', accentText: '#2b6370' },
  roles: [
    { key: 'owner', label: 'Practice owner' },
    { key: 'optometrist', label: 'Optometrist' },
    { key: 'dispenser', label: 'Optical dispenser' },
    { key: 'frontdesk', label: 'Front desk' },
    { key: 'manager', label: 'Practice manager' },
  ],
  permissions: [
    { key: 'clinical.view', label: 'View clinical', description: 'See exam findings, prescription values and medical history' },
    { key: 'clinical.record', label: 'Record exams', description: 'Record, finalise and amend eye examinations; issue prescriptions' },
    { key: 'bookings', label: 'Bookings', description: 'Book, check in, cancel and mark no-shows' },
    { key: 'patients.edit', label: 'Edit patients', description: 'Add and edit patient details' },
    { key: 'dispense', label: 'Dispense', description: 'Create optical orders and move them through the lab' },
    { key: 'stock', label: 'Stock', description: 'Add and adjust frame and product stock' },
    { key: 'billing', label: 'Billing', description: 'Create, submit and reconcile claims and accounts' },
  ],
  modules: [
    { key: 'diary', label: 'Diary & patient flow', icon: IcoCalendar, group: 'Front desk', collection: 'appointments', page: Diary, detail: AppointmentDetail, description: 'Day planner per practitioner. Check patients in and move them through pre-test, consulting room and dispensing.' },
    { key: 'patients', label: 'Patients', icon: IcoUsers, group: 'Front desk', collection: 'patients', detail: PatientProfile, description: 'Patient register with medical aid details, recall dates and the full visit history.' },
    { key: 'recalls', label: 'Recalls', icon: IcoPhone, group: 'Front desk', page: Recalls, description: 'Patients due for their next exam or aftercare. Log reminders and book them in.' },
    { key: 'exams', label: 'Eye examinations', icon: IcoEye, group: 'Clinical', collection: 'exams', detail: ExamDetail, description: 'Structured examination records: acuity, refraction, eye health, diagnosis and plan. Finalising issues the prescription.' },
    { key: 'prescriptions', label: 'Prescriptions', icon: IcoDoc, group: 'Clinical', collection: 'prescriptions', detail: PrescriptionDetail, description: 'Issued spectacle and contact lens prescriptions with expiry tracking.' },
    { key: 'orders', label: 'Optical orders', icon: IcoGlasses, group: 'Optical', collection: 'orders', view: 'board', detail: OrderDetail, description: 'Spectacle and contact lens jobs from quote to lab, quality check and collection.' },
    { key: 'stock', label: 'Frames & stock', icon: IcoBox, group: 'Optical', collection: 'stock', description: 'Frames, contact lenses and accessories with reorder alerts.' },
    { key: 'claims', label: 'Billing & claims', icon: IcoReceipt, group: 'Practice', collection: 'claims', detail: ClaimDetail, description: 'Medical aid claims and patient accounts: submit, record remittances and rejections, settle balances. Simulated — no switch connection.' },
    { key: 'reports', label: 'Practice reports', icon: IcoChart, group: 'Practice', page: Reports, description: 'Exams, conversion to eyewear, billing by funder, recall effectiveness and stock value.' },
  ],
  collections,
  seed: buildOptometrySeed,
  dashboard: Dashboard,
  boundaries: [
    'Not a medical record system: no clinical compliance, HPCSA, POPIA or record-retention controls are implemented.',
    'Prescription checks are data-entry rules for the demo, not clinical decision support.',
    'Medical aid names, membership numbers and tariff codes are invented. Claims are not sent to any scheme or switching house.',
    'Recall reminders are logged only — no SMS or email is sent.',
  ],
  guide: [
    { title: 'Check a patient in', detail: 'Open the diary, switch to “Patient flow” and press “Check in” on a booked patient. They move to the next column.', to: 'diary', as: 'u_fd' },
    { title: 'Finish an eye exam', detail: 'Open the exam marked “In progress”. It cannot be finalised until a diagnosis is chosen — pick one, save, then finalise to issue the prescription and set the recall.', to: 'exams', as: 'u_opt' },
    { title: 'Move a lab job', detail: 'On the lab board, pass a quality check or try “Send to lab” on the quoted job — it is refused because the prescription has expired.', to: 'orders', as: 'u_disp' },
    { title: 'Submit a medical aid claim', detail: 'Filter to Draft, open a claim and submit it. Checks for the member number and diagnosis code run first.', to: 'claims', as: 'u_mgr' },
    { title: 'Chase a recall', detail: 'Preview the reminder message for an overdue patient (nothing is sent) or book them straight in.', to: 'recalls', as: 'u_fd' },
    { title: 'See what each role can do', detail: 'Tick and untick modules for each staff member, then switch user in the top bar to see the menu change.', to: 'admin', as: 'u_owner' },
  ],
  highlights: [
    'Front desk → pre-test → consulting room → dispensing patient flow',
    'Eye exam finalisation issues a prescription and sets the recall date',
    'Optical jobs on a lab board with quality-check and remake loop',
    'Medical aid claim checks (ICD-10, member number) before submission',
  ],
};

export default config;
