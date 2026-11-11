// Tyre & fitment centre demo. Fictional business: TreadRight Tyre & Fitment.
import type { CollectionDef, EffectContext, Flag, IndustryConfig, Values, WorkflowDef } from '../../core/types';
import { findRecord, lines, num, records, str } from '../../core/engine';
import { addDays, daysBetween, formatDate } from '../../core/lib/dates';
import { formatRand } from '../../core/lib/money';
import { IcoBoard, IcoBox, IcoCar, IcoChart, IcoReceipt, IcoShield, IcoTool, IcoTruck, IcoUsers } from '../../core/components/Icons';
import {
  APPROVAL_CHANNELS, BAYS, BRANDS, CUSTOMER_KINDS, DAMAGE_TYPES, PAYMENT_METHODS, ROTATION_KM, SPEED_RATINGS, TECHNICIANS, TOOL_CONDITIONS, TOOL_LOCATIONS, TOOL_TYPES,
  VEHICLE_CLASSES, label,
} from './data';
import { buildTyresSeed } from './seed';
import {
  IN_BAY, ON_SITE, alignmentProblem, approvalProblem, belowLegal, calibrationState, claimAge, claimOverdue, customerName, damageWarrantable, dotAgeYears, dotText, fittingProblem,
  fleetBalance, fleetOfCustomer, inspectionProblem, invoiceBalance, invoiceOverdue, isOldDot, jobCustomer, jobFleet, jobInvoice, jobMinutes, minText, nowHm, parseTyreSize, paymentProblem,
  quoteLines, quoteProblem, readyProblem, releaseProblem, replacePositions, rotationDue, servicesText, stockLabel, todayStr, toolCheckoutProblem, toolHoursOut, toolNotReturned,
  toolType, torqueWrench, techLabel, vehicleLabel, REFUSAL_WORDS,
} from './helpers';
export * from './helpers';
import Dashboard from './pages/Dashboard';
import JobDetail from './pages/JobDetail';
import ToolBoard from './pages/ToolBoard';
import ToolDetail from './pages/ToolDetail';
import StockPage from './pages/StockPage';
import VehicleDetail from './pages/VehicleDetail';
import FleetDetail from './pages/FleetDetail';
import InvoiceDetail from './pages/InvoiceDetail';
import ClaimDetail from './pages/ClaimDetail';
import Reports from './pages/Reports';

const opt = (list: Array<{ value: string; label: string }>) => list.map(({ value, label: l }) => ({ value, label: l }));

/* ------------------------------------------------------------------ */
const toTorque = (ctx: EffectContext) => {
  const w = torqueWrench(ctx.record, ctx.data, todayStr()).wrench;
  if (w) ctx.api.update('jobs', ctx.record.id, { torqueTool: w.id, torqueToolAsset: str(w, 'assetNo') }, `Torque wrench ${str(w, 'assetNo')} recorded on the job`);
};
const notSold = (svc: string) => `${svc} was not sold on this job.`;

export const jobWorkflow: WorkflowDef = {
  initial: 'arrived',
  states: [
    { key: 'arrived', label: 'Arrived', tone: 'dark' },
    { key: 'inspected', label: 'Inspected', tone: 'blue' },
    { key: 'quoted', label: 'Quoted', tone: 'amber', hint: 'Waiting for customer / fleet approval' },
    { key: 'approved', label: 'Approved', tone: 'accent' },
    { key: 'fitting', label: 'Fitting', tone: 'accent' },
    { key: 'balancing', label: 'Balancing', tone: 'accent' },
    { key: 'alignment', label: 'Alignment', tone: 'blue' },
    { key: 'torque', label: 'Torque check', tone: 'amber' },
    { key: 'ready', label: 'Ready', tone: 'green' },
    { key: 'collected', label: 'Collected', tone: 'green', terminal: true },
    { key: 'declined', label: 'Declined', tone: 'red', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    {
      from: 'arrived', to: 'inspected', label: 'Record inspection', permission: 'fitment', intent: 'primary',
      guard: ({ record, data }) => inspectionProblem(record, data),
    },
    {
      from: 'inspected', to: 'quoted', label: 'Send quote', permission: 'jobs.manage', intent: 'primary',
      guard: ({ record, data, note }) => quoteProblem(record, data, note),
      after: ({ record, data, api, note }) => {
        const vals: Values = { lines: quoteLines(record, data), quotedAt: nowHm() };
        const unquoted = belowLegal(record).filter((p) => !replacePositions(record).some((r) => r.key === p.key));
        if (unquoted.length && note && REFUSAL_WORDS.test(note) && !str(record, 'refusalNote')) vals.refusalNote = note;
        api.update('jobs', record.id, vals, `Quote prepared: ${servicesText(record)}`, vals.refusalNote ? `Customer refused replacement of ${unquoted.map((p) => p.label).join(', ')}` : undefined);
      },
    },
    {
      from: 'quoted', to: 'approved', label: 'Record approval', permission: 'jobs.manage', intent: 'primary',
      guard: ({ record, data }) => approvalProblem(record, data),
      after: ({ record, api }) => api.update('jobs', record.id, { approvedAt: nowHm() }),
    },
    {
      from: 'approved', to: 'fitting', label: 'Start fitting', permission: 'fitment', intent: 'primary',
      guard: ({ record, data }) => fittingProblem(record, data),
      after: ({ record, data, api }) => {
        api.update('jobs', record.id, { startedAt: nowHm() });
        const qty = num(record, 'tyresQty');
        const st = findRecord(data, 'stock', str(record, 'tyreStock'));
        if (qty > 0 && st) {
          const left = Math.max(0, num(st, 'qty') - qty);
          api.update('stock', st.id, { qty: left }, `${qty} fitted on ${record.ref}`);
          api.toast(`${qty} × ${str(st, 'size')} issued from stock — ${left} left`);
        }
      },
    },
    {
      from: 'fitting', to: 'balancing', label: 'Fitting done — balance wheels', permission: 'fitment',
      guard: ({ record }) => (record.values.balancing ? null : notSold('Balancing')),
    },
    {
      from: ['fitting', 'balancing'], to: 'alignment', label: 'Send to alignment bay', permission: 'fitment',
      guard: ({ record }) => (!record.values.alignment ? notSold('Alignment') : record.status === 'fitting' && record.values.balancing ? 'Balance the wheels first.' : null),
      after: ({ record, api }) => api.update('jobs', record.id, { fitBay: str(record, 'bay'), bay: 'align' }, 'Moved to the alignment bay'),
    },
    {
      from: ['fitting', 'balancing'], to: 'torque', label: 'Start torque check', permission: 'fitment',
      guard: ({ record, data }) => {
        if (record.status === 'fitting' && record.values.balancing) return 'Balance the wheels first.';
        if (record.values.alignment) return 'Alignment was sold — send the vehicle to the alignment bay first.';
        return torqueWrench(record, data, todayStr()).problem;
      },
      after: toTorque,
    },
    {
      from: 'alignment', to: 'torque', label: 'Alignment done — torque check', permission: 'alignment',
      guard: ({ record, data }) => alignmentProblem(record) ?? torqueWrench(record, data, todayStr()).problem,
      after: toTorque,
    },
    {
      from: 'torque', to: 'ready', label: 'Pass QC — ready', permission: 'qc', intent: 'primary',
      guard: ({ record, data }) => readyProblem(record, data, todayStr()),
      after: ({ record, data, api, today }) => {
        const w = torqueWrench(record, data, todayStr()).wrench;
        api.update('jobs', record.id, { readyAt: nowHm(), ...(w ? { torqueTool: w.id, torqueToolAsset: str(w, 'assetNo') } : {}) }, w ? `Torque values signed off with ${str(w, 'assetNo')}` : undefined);
        if (!jobInvoice(data, record.id)) {
          const cust = jobCustomer(data, record);
          const inv = api.create('invoices', {
            customer: cust?.id ?? '', vehicle: str(record, 'vehicle'), job: record.id, issuedOn: today, dueOn: '', fleetPo: str(record, 'fleetPo'),
            lines: lines(record).map((l) => ({ ...l })), paid: 0, paymentMethod: '', lastPaymentOn: '', notes: '',
          }, 'issued', `Invoice issued from ${record.ref} on QC pass`);
          api.toast(`Invoice ${inv.ref} issued`);
        }
      },
    },
    {
      from: 'ready', to: 'collected', label: 'Hand over to customer', permission: 'jobs.manage', intent: 'primary',
      guard: ({ record, data }) => releaseProblem(record, data),
      after: ({ record, data, api }) => {
        api.update('jobs', record.id, { collectedAt: nowHm() });
        const v = findRecord(data, 'vehicles', str(record, 'vehicle'));
        if (!v) return;
        const odo = Math.max(num(v, 'odometer'), num(record, 'odometer'));
        const rotated = !!record.values.rotation || num(record, 'tyresQty') >= 4;
        api.update('vehicles', v.id, { odometer: odo, ...(rotated ? { lastRotationKm: odo } : {}) }, `Odometer ${odo} km recorded from ${record.ref}${rotated ? ' · rotation reset' : ''}`);
      },
    },
    { from: ['inspected', 'quoted'], to: 'declined', label: 'Record customer decline', permission: 'jobs.manage', requiresNote: true, intent: 'danger' },
    { from: ['arrived', 'inspected', 'quoted', 'approved'], to: 'cancelled', label: 'Cancel job', permission: 'jobs.manage', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
export const toolWorkflow: WorkflowDef = {
  initial: 'available',
  states: [
    { key: 'available', label: 'Available', tone: 'green' },
    { key: 'checkedout', label: 'Checked out', tone: 'accent' },
    { key: 'calibration', label: 'In calibration / repair', tone: 'amber' },
    { key: 'missing', label: 'Missing', tone: 'red' },
    { key: 'outofservice', label: 'Out of service', tone: 'red' },
  ],
  transitions: [
    {
      from: 'available', to: 'checkedout', label: 'Check out', permission: 'tools.issue', intent: 'primary',
      guard: ({ record }) => toolCheckoutProblem(record, todayStr()),
      after: ({ record, api, today }) => api.update('tools', record.id, { checkedOutOn: today, checkedOutAt: nowHm(), checkouts: num(record, 'checkouts') + 1 }, `Checked out to ${techLabel(str(record, 'holder'))}`),
    },
    {
      from: 'checkedout', to: 'available', label: 'Check in', permission: 'tools.issue', intent: 'primary',
      after: ({ record, api }) => api.update('tools', record.id, {
        hoursOut: Math.round((num(record, 'hoursOut') + toolHoursOut({ ...record, status: 'checkedout' })) * 10) / 10, lastHolder: str(record, 'holder'), holder: '', checkedOutOn: '', checkedOutAt: '', forJob: '',
      }, `Checked in from ${techLabel(str(record, 'holder'))}`),
    },
    {
      from: ['available', 'outofservice'], to: 'calibration', label: 'Send for calibration / repair', permission: 'tools.calibrate',
      after: ({ record, api }) => api.update('tools', record.id, { location: 'store' }),
    },
    {
      from: 'calibration', to: 'available', label: 'Return to service', permission: 'tools.calibrate', intent: 'primary',
      guard: ({ record }) => (str(record, 'condition') === 'poor' ? 'Record the repair first: set condition to Good or Fair (Edit) before returning the tool to service.' : null),
      after: ({ record, api, today }) => {
        const t = toolType(record);
        if (t?.calibrated) {
          const due = addDays(today, Math.round(t.months * 30.4));
          api.update('tools', record.id, { lastCalibrated: today, calibrationDue: due }, `Calibration certificate recorded (fictional) — next due ${formatDate(due)}`);
        }
      },
    },
    {
      from: ['available', 'checkedout'], to: 'missing', label: 'Report missing', permission: 'tools.issue', requiresNote: true, intent: 'danger',
      after: ({ record, api }) => api.update('tools', record.id, { lastHolder: str(record, 'holder') || str(record, 'lastHolder'), holder: '', checkedOutOn: '', checkedOutAt: '' }),
    },
    {
      from: 'missing', to: 'available', label: 'Found — return to store', permission: 'tools.issue',
      after: ({ record, api }) => api.update('tools', record.id, { location: 'store' }),
    },
    {
      from: ['available', 'checkedout', 'calibration', 'missing'], to: 'outofservice', label: 'Take out of service', permission: 'tools.calibrate', requiresNote: true, intent: 'danger',
      after: ({ record, api }) => api.update('tools', record.id, { holder: '', checkedOutOn: '', checkedOutAt: '', location: 'store' }),
    },
  ],
};

/* ------------------------------------------------------------------ */
const applyPayment = ({ record, api, today }: EffectContext) => {
  const amount = num(record, 'paymentAmount');
  const paid = Math.round((num(record, 'paid') + amount) * 100) / 100;
  api.update('invoices', record.id, { paid, paymentAmount: 0, lastPaymentOn: today }, `Payment of ${formatRand(Math.round(amount * 100))} recorded (${label(PAYMENT_METHODS, str(record, 'paymentMethod'))})`);
};

export const invoiceWorkflow: WorkflowDef = {
  initial: 'issued',
  states: [
    { key: 'issued', label: 'Issued', tone: 'blue' },
    { key: 'onaccount', label: 'On fleet account', tone: 'amber' },
    { key: 'paid', label: 'Paid', tone: 'green', terminal: true },
    { key: 'void', label: 'Voided', tone: 'red', terminal: true },
  ],
  transitions: [
    {
      from: ['issued', 'onaccount'], to: 'paid', label: 'Record payment in full', permission: 'invoicing', intent: 'primary',
      guard: ({ record }) => paymentProblem(record, num(record, 'paymentAmount'), 'full'), after: applyPayment,
    },
    {
      from: 'issued', to: 'onaccount', label: 'Put on fleet account (30 days)', permission: 'invoicing',
      guard: ({ record, data }) => (fleetOfCustomer(data, findRecord(data, 'customers', str(record, 'customer'))) ? null : 'Only fleet account customers can be invoiced on account. Retail customers pay at the counter.'),
      after: ({ record, api, today }) => api.update('invoices', record.id, { dueOn: addDays(today, 30) }, `Due ${formatDate(addDays(today, 30))} (30-day fleet terms)`),
    },
    {
      from: 'onaccount', to: 'onaccount', label: 'Record part remittance', permission: 'invoicing',
      guard: ({ record }) => paymentProblem(record, num(record, 'paymentAmount'), 'part'), after: applyPayment,
    },
    {
      from: 'issued', to: 'void', label: 'Void invoice', permission: 'invoicing', requiresNote: true, intent: 'danger',
      guard: ({ record }) => (num(record, 'paid') > 0 ? 'Payments are recorded on this invoice — refund or credit them before voiding.' : null),
    },
  ],
};

/* ------------------------------------------------------------------ */
export const claimWorkflow: WorkflowDef = {
  initial: 'logged',
  states: [
    { key: 'logged', label: 'Logged', tone: 'dark' },
    { key: 'inspected', label: 'Inspected', tone: 'blue' },
    { key: 'sent', label: 'Sent to supplier', tone: 'amber' },
    { key: 'approved', label: 'Approved (credit)', tone: 'green', terminal: true },
    { key: 'rejected', label: 'Rejected', tone: 'red', terminal: true },
  ],
  transitions: [
    {
      from: 'logged', to: 'inspected', label: 'Record casing inspection', permission: 'warranty', intent: 'primary',
      guard: ({ record }) => (str(record, 'treadRemaining') === '' ? 'Measure and record the tread remaining (mm) first.' : !str(record, 'damageType') ? 'Record the damage type found on inspection.' : null),
    },
    {
      from: 'inspected', to: 'sent', label: 'Send to supplier (simulated)', permission: 'warranty', intent: 'primary',
      guard: ({ record }) => (!damageWarrantable(record) ? `${label(DAMAGE_TYPES, str(record, 'damageType'))} is not a manufacturing defect — reject the claim with a note instead.` : !str(record, 'supplier') ? 'Record the supplier the claim goes to.' : null),
      after: ({ record, api, today }) => api.update('claims', record.id, { sentOn: today }),
    },
    {
      from: 'sent', to: 'approved', label: 'Record supplier credit', permission: 'warranty', intent: 'primary',
      guard: ({ record }) => { const c = num(record, 'creditPct'); return c >= 1 && c <= 100 ? null : 'Enter the credit % the supplier approved (1–100) first (Edit → Credit %).'; },
      after: ({ record, api, today }) => api.update('claims', record.id, { decisionOn: today }),
    },
    {
      from: ['inspected', 'sent'], to: 'rejected', label: 'Reject claim', permission: 'warranty', requiresNote: true, intent: 'danger',
      after: ({ record, api, today }) => api.update('claims', record.id, { decisionOn: today }),
    },
  ],
};

/* ------------------------------------------------------------------ */
const phoneRule = (v: unknown) => (/^0\d{2} \d{3} \d{4}$/.test(String(v)) ? null : 'Use the format 0xx xxx xxxx.');
const emailRule = (v: unknown) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : 'Enter a valid email address.');
const sizeRule = (v: unknown) => (parseTyreSize(String(v)) ? null : 'Use a tyre size like 205/55R16.');
const dotRule = (v: unknown) => (/^(0[1-9]|[1-4]\d|5[0-3])\d{2}$/.test(String(v)) ? null : 'DOT date code is the week and year, e.g. 1424.');

const collections: CollectionDef[] = [
  {
    key: 'jobs', singular: 'Fitment job', plural: 'Fitment jobs', refPrefix: 'JOB', workflow: jobWorkflow, editPermission: 'jobs.manage',
    title: (r, d) => vehicleLabel(d, r.values.vehicle),
    subtitle: (r, d) => `${str(jobCustomer(d, r), 'name') || '—'} · ${servicesText(r)}${str(r, 'bay') ? ` · ${label(BAYS, str(r, 'bay'))}` : ''}`,
    sort: (a, b) => (str(b, 'workDate') + str(b, 'arrivedAt')).localeCompare(str(a, 'workDate') + str(a, 'arrivedAt')),
    createFields: ['vehicle', 'workDate', 'arrivedAt', 'odometer', 'bay', 'technician', 'fleetPo', 'notes'],
    flags: (r, d, today) => {
      const out: Flag[] = [];
      const open = ON_SITE.includes(r.status ?? '');
      if (open && belowLegal(r).length) out.push({ tone: 'red', label: `${belowLegal(r).map((p) => p.label).join('/')} below legal tread` });
      const fleet = jobFleet(d, r);
      if (fleet?.values.poRequired && !str(r, 'fleetPo') && ['arrived', 'inspected', 'quoted'].includes(r.status ?? '')) out.push({ tone: 'amber', label: 'Fleet PO missing' });
      if (fleet) out.push({ tone: 'dark', label: 'Fleet' });
      const mins = jobMinutes(r);
      if (str(r, 'workDate') === today && mins !== null && mins > 60) out.push({ tone: 'amber', label: `${minText(mins)} to ready` });
      if (r.status === 'ready') {
        const inv = jobInvoice(d, r.id);
        if (inv && inv.status === 'issued') out.push({ tone: 'amber', label: fleet ? 'Put invoice on account' : 'Awaiting payment' });
      }
      return out;
    },
    fields: [
      { key: 'vehicle', label: 'Vehicle', type: 'ref', ref: 'vehicles', required: true },
      { key: 'workDate', label: 'Date', type: 'date', required: true, table: true },
      { key: 'arrivedAt', label: 'Arrived at', type: 'time', table: true },
      { key: 'bay', label: 'Bay', type: 'select', options: BAYS, table: true },
      { key: 'technician', label: 'Technician', type: 'select', options: opt(TECHNICIANS), table: true },
      { key: 'odometer', label: 'Odometer (km)', type: 'number', min: 0, hint: 'Must not be below the vehicle’s last recorded reading.' },
      { key: 'tyresQty', label: 'Tyres sold (qty)', type: 'number', min: 0, max: 6, hint: 'Must equal the wheel positions marked for replacement on the wheel diagram.' },
      { key: 'tyreStock', label: 'Tyre quoted (stock line)', type: 'ref', ref: 'stock' },
      { key: 'balancing', label: 'Wheel balancing', type: 'boolean' },
      { key: 'alignment', label: 'Wheel alignment', type: 'boolean' },
      { key: 'puncture', label: 'Puncture repair', type: 'boolean' },
      { key: 'nitrogen', label: 'Nitrogen fill', type: 'boolean' },
      { key: 'rotation', label: 'Tyre rotation', type: 'boolean' },
      { key: 'approvalChannel', label: 'Approval channel', type: 'select', options: APPROVAL_CHANNELS, hint: 'How the customer or fleet manager approved the quote.' },
      { key: 'fleetPo', label: 'Fleet PO number', type: 'text', placeholder: 'PO-DEMO-…', hint: 'Required before approval for fleet accounts that need a PO.' },
      { key: 'refusalNote', label: 'Customer refusal (below-legal tyre not replaced)', type: 'textarea', hint: 'Who refused, how, and what they were told.' },
      { key: 'readyAt', label: 'Ready at', type: 'time' },
      { key: 'collectedAt', label: 'Collected at', type: 'time' },
      { key: 'torqueToolAsset', label: 'Torque wrench used (asset no.)', type: 'text', hint: 'Recorded automatically at the torque check.' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'lines', label: 'Quote lines', type: 'lines', wide: true },
    ],
  },
  {
    key: 'tools', singular: 'Tool', plural: 'Tools & equipment', refPrefix: 'TL', workflow: toolWorkflow, editPermission: 'tools.calibrate',
    title: (r) => `${str(r, 'assetNo')} · ${label(TOOL_TYPES, str(r, 'toolType'))}`,
    subtitle: (r) => `${str(r, 'description')} · ${r.status === 'checkedout' ? `with ${techLabel(str(r, 'holder'))}` : label(TOOL_LOCATIONS, str(r, 'location'))}`,
    sort: (a, b) => str(a, 'assetNo').localeCompare(str(b, 'assetNo')),
    createFields: ['assetNo', 'toolType', 'description', 'location', 'rangeMin', 'rangeMax', 'calibrationDue', 'serviceDue', 'condition'],
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      const cal = calibrationState(r, today);
      if (cal === 'expired') out.push({ tone: 'red', label: 'Calibration expired' });
      if (cal === 'due') out.push({ tone: 'amber', label: `Calibration due in ${daysBetween(today, str(r, 'calibrationDue'))} d` });
      if (str(r, 'serviceDue') && str(r, 'serviceDue') < today) out.push({ tone: 'amber', label: 'Service overdue' });
      if (toolNotReturned(r)) out.push({ tone: 'red', label: `Not returned overnight (${Math.round(toolHoursOut(r))} h)` });
      if (r.status === 'missing') out.push({ tone: 'red', label: 'Missing' });
      if (str(r, 'condition') === 'poor' && r.status !== 'outofservice') out.push({ tone: 'amber', label: 'Poor condition' });
      return out;
    },
    fields: [
      { key: 'assetNo', label: 'Asset no.', type: 'text', required: true, placeholder: 'TR-TW-06' },
      { key: 'toolType', label: 'Type', type: 'select', options: opt(TOOL_TYPES), required: true, table: true },
      { key: 'description', label: 'Description (fictional make/model)', type: 'text', required: true },
      { key: 'location', label: 'Home location', type: 'select', options: TOOL_LOCATIONS, table: true },
      { key: 'holder', label: 'Checked out to', type: 'select', options: opt(TECHNICIANS), table: true },
      { key: 'rangeMin', label: 'Range from (Nm)', type: 'number', min: 0, hint: 'Torque wrenches only.' },
      { key: 'rangeMax', label: 'Range to (Nm)', type: 'number', min: 0, validate: (v, all) => (v !== '' && Number(v) <= Number(all.rangeMin) ? 'Upper range must be above the lower range.' : null) },
      { key: 'calibrationDue', label: 'Calibration due', type: 'date', table: true },
      { key: 'lastCalibrated', label: 'Last calibrated', type: 'date' },
      { key: 'serviceDue', label: 'Service due', type: 'date', table: true },
      { key: 'condition', label: 'Condition', type: 'select', options: TOOL_CONDITIONS, required: true },
      { key: 'checkedOutOn', label: 'Checked out on', type: 'date' },
      { key: 'checkedOutAt', label: 'Checked out at', type: 'time' },
      { key: 'forJob', label: 'Issued for job', type: 'ref', ref: 'jobs' },
      { key: 'lastHolder', label: 'Last held by', type: 'select', options: opt(TECHNICIANS) },
      { key: 'checkouts', label: 'Check-outs (lifetime)', type: 'number', min: 0 },
      { key: 'hoursOut', label: 'Hours checked out (lifetime)', type: 'number', min: 0 },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'stock', singular: 'Tyre stock line', plural: 'Tyre stock', refPrefix: 'STK', editPermission: 'stock',
    title: (r) => stockLabel(r),
    subtitle: (r) => `DOT ${dotText(str(r, 'dot'))} · bin ${str(r, 'bin') || '—'}`,
    sort: (a, b) => str(a, 'size').localeCompare(str(b, 'size')) || str(a, 'brand').localeCompare(str(b, 'brand')),
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      if (num(r, 'qty') <= 0) out.push({ tone: 'red', label: 'Out of stock' });
      else if (num(r, 'qty') <= num(r, 'reorderLevel')) out.push({ tone: 'amber', label: 'Low stock' });
      if (isOldDot(str(r, 'dot'), today)) out.push({ tone: 'amber', label: `Old stock (${dotAgeYears(str(r, 'dot'), today)} yrs)` });
      if (num(r, 'sell') < num(r, 'cost')) out.push({ tone: 'red', label: 'Price below cost' });
      return out;
    },
    fields: [
      { key: 'size', label: 'Size', type: 'text', required: true, table: true, placeholder: '205/55R16', validate: sizeRule },
      { key: 'loadIndex', label: 'Load index', type: 'number', min: 50, max: 130, required: true },
      { key: 'speedRating', label: 'Speed rating', type: 'select', options: SPEED_RATINGS, required: true },
      { key: 'brand', label: 'Brand (fictional)', type: 'select', options: BRANDS, required: true, table: true },
      { key: 'pattern', label: 'Pattern', type: 'text', required: true },
      { key: 'dot', label: 'DOT week/year (WWYY)', type: 'text', required: true, validate: dotRule, hint: 'Demo rule: older than 5 years is flagged as old stock.' },
      { key: 'qty', label: 'On hand', type: 'number', min: 0, required: true, table: true },
      { key: 'reorderLevel', label: 'Reorder at', type: 'number', min: 0, required: true },
      { key: 'cost', label: 'Cost (excl. VAT)', type: 'money', min: 0, required: true },
      { key: 'sell', label: 'Sell (excl. VAT)', type: 'money', min: 0, required: true, table: true },
      { key: 'bin', label: 'Rack / bin', type: 'text' },
      { key: 'supplier', label: 'Supplier (fictional)', type: 'text' },
    ],
  },
  {
    key: 'vehicles', singular: 'Vehicle', plural: 'Vehicles', refPrefix: 'VEH', editPermission: 'customers',
    title: (r) => `${str(r, 'reg')} · ${str(r, 'make')} ${str(r, 'model')}`,
    subtitle: (r, d) => `${customerName(d, r.values.customer)} · ${str(r, 'tyreSize')}`,
    sort: (a, b) => str(a, 'reg').localeCompare(str(b, 'reg')),
    createFields: ['customer', 'reg', 'make', 'model', 'year', 'vehicleClass', 'tyreSize', 'torqueMin', 'torqueMax', 'pressureKpa', 'odometer', 'lastRotationKm'],
    flags: (r, d) => {
      const out: Flag[] = [];
      const rot = rotationDue(r);
      if (rot.due) out.push({ tone: 'amber', label: `Rotation due (${Math.round(rot.since / 100) * 100} km)` });
      if (records(d, 'jobs').some((j) => str(j, 'vehicle') === r.id && IN_BAY.includes(j.status ?? ''))) out.push({ tone: 'blue', label: 'In a bay now' });
      return out;
    },
    fields: [
      { key: 'customer', label: 'Owner / fleet', type: 'ref', ref: 'customers', required: true },
      { key: 'reg', label: 'Registration (fictional)', type: 'text', required: true, placeholder: 'DEMO 123 GP', hint: 'Demo plates only.', validate: (v) => (/^DEMO /i.test(String(v)) ? null : 'Use a fictional plate starting with DEMO.') },
      { key: 'make', label: 'Make', type: 'text', required: true },
      { key: 'model', label: 'Model', type: 'text', required: true, table: true },
      { key: 'year', label: 'Year', type: 'number', min: 1980, max: 2030 },
      { key: 'vehicleClass', label: 'Class', type: 'select', options: opt(VEHICLE_CLASSES), required: true, table: true },
      { key: 'tyreSize', label: 'Tyre size', type: 'text', required: true, table: true, validate: sizeRule },
      { key: 'torqueMin', label: 'Wheel torque from (Nm)', type: 'number', min: 50, max: 400, hint: 'Demo spec — not OEM data.' },
      { key: 'torqueMax', label: 'Wheel torque to (Nm)', type: 'number', min: 50, max: 400, validate: (v, all) => (Number(v) < Number(all.torqueMin) ? 'Upper torque must be at least the lower torque.' : null) },
      { key: 'pressureKpa', label: 'Placard pressure (kPa)', type: 'number', min: 100, max: 600 },
      { key: 'odometer', label: 'Last odometer (km)', type: 'number', min: 0, table: true },
      { key: 'lastRotationKm', label: 'Last rotation at (km)', type: 'number', min: 0, hint: `Demo rule: rotate every ${ROTATION_KM.toLocaleString('en-ZA')} km.` },
      { key: 'kmPerMonth', label: 'Typical km per month', type: 'number', min: 0 },
    ],
  },
  {
    key: 'customers', singular: 'Customer', plural: 'Customers', refPrefix: 'CUS', editPermission: 'customers',
    title: (r) => str(r, 'name'),
    subtitle: (r, d) => (str(r, 'kind') === 'fleet' ? `Fleet · ${str(findRecord(d, 'fleets', str(r, 'fleet')), 'name') || 'no account'}` : `Retail${str(r, 'area') ? ` · ${str(r, 'area')}` : ''}`),
    sort: (a, b) => str(a, 'name').localeCompare(str(b, 'name')),
    flags: (r, d) => {
      const out: Flag[] = [];
      if (str(r, 'kind') === 'fleet') out.push({ tone: 'dark', label: 'Fleet account' });
      if (records(d, 'vehicles').filter((v) => str(v, 'customer') === r.id).some((v) => rotationDue(v).due)) out.push({ tone: 'amber', label: 'Rotation due' });
      return out;
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'kind', label: 'Customer type', type: 'select', options: CUSTOMER_KINDS, required: true, table: true },
      { key: 'fleet', label: 'Fleet account', type: 'ref', ref: 'fleets', validate: (v, all) => (all.kind === 'fleet' && !v ? 'Link the fleet account.' : null) },
      { key: 'contactPerson', label: 'Contact person', type: 'text' },
      { key: 'phone', label: 'Phone (fictional)', type: 'text', required: true, table: true, validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'preferredContact', label: 'Preferred contact', type: 'select', options: [{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'phone', label: 'Phone' }, { value: 'email', label: 'Email' }], table: true },
      { key: 'area', label: 'Area', type: 'text', table: true },
    ],
  },
  {
    key: 'fleets', singular: 'Fleet account', plural: 'Fleet accounts', refPrefix: 'FLT', editPermission: 'fleet',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `${str(r, 'contactPerson')} · limit ${formatRand(Math.round(num(r, 'creditLimit') * 100), { compact: true })}${r.values.poRequired ? ' · PO required' : ''}`,
    sort: (a, b) => str(a, 'name').localeCompare(str(b, 'name')),
    flags: (r, d, today) => {
      const out: Flag[] = [];
      const bal = fleetBalance(d, r.id);
      const limit = Math.round(num(r, 'creditLimit') * 100);
      if (limit && bal > limit) out.push({ tone: 'red', label: 'Over credit limit' });
      else if (limit && bal >= limit * 0.85) out.push({ tone: 'amber', label: 'Near credit limit' });
      const custIds = records(d, 'customers').filter((c) => str(c, 'fleet') === r.id).map((c) => c.id);
      if (records(d, 'invoices').some((i) => custIds.includes(str(i, 'customer')) && invoiceOverdue(i, today))) out.push({ tone: 'red', label: 'Overdue on account' });
      if (r.values.poRequired) out.push({ tone: 'dark', label: 'PO required' });
      return out;
    },
    fields: [
      { key: 'name', label: 'Company (fictional)', type: 'text', required: true },
      { key: 'contactPerson', label: 'Fleet manager', type: 'text', required: true, table: true },
      { key: 'phone', label: 'Phone (fictional)', type: 'text', validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'creditLimit', label: 'Credit limit', type: 'money', min: 0, required: true, table: true },
      { key: 'poRequired', label: 'Purchase order required on every job', type: 'boolean' },
      { key: 'terms', label: 'Terms', type: 'text', table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'claims', singular: 'Warranty claim', plural: 'Warranty & tyre claims', refPrefix: 'WC', workflow: claimWorkflow, editPermission: 'warranty',
    title: (r, d) => `${stockLabel(findRecord(d, 'stock', str(r, 'stock')))}`,
    subtitle: (r, d) => `${customerName(d, r.values.customer)} · ${str(findRecord(d, 'vehicles', str(r, 'vehicle')), 'reg')} · logged ${formatDate(str(r, 'loggedOn'))}`,
    sort: (a, b) => str(b, 'loggedOn').localeCompare(str(a, 'loggedOn')),
    createFields: ['customer', 'vehicle', 'stock', 'dot', 'purchasedOn', 'loggedOn', 'complaint', 'supplier'],
    flags: (r, _d, today) => (claimOverdue(r, today) ? [{ tone: 'red', label: `Open ${claimAge(r, today)} days` }] : []),
    fields: [
      { key: 'customer', label: 'Customer', type: 'ref', ref: 'customers', required: true },
      { key: 'vehicle', label: 'Vehicle', type: 'ref', ref: 'vehicles' },
      { key: 'stock', label: 'Tyre (stock line)', type: 'ref', ref: 'stock', required: true },
      { key: 'dot', label: 'DOT on casing (WWYY)', type: 'text', validate: dotRule },
      { key: 'purchasedOn', label: 'Fitted on', type: 'date' },
      { key: 'loggedOn', label: 'Logged on', type: 'date', required: true, table: true },
      { key: 'complaint', label: 'Customer complaint', type: 'textarea' },
      { key: 'originalTread', label: 'New tread depth (mm)', type: 'number', min: 1, max: 20, step: 0.1 },
      { key: 'treadRemaining', label: 'Tread remaining (mm)', type: 'number', min: 0, max: 20, step: 0.1, table: true },
      { key: 'damageType', label: 'Damage type', type: 'select', options: opt(DAMAGE_TYPES), table: true },
      { key: 'supplier', label: 'Supplier (fictional)', type: 'text' },
      { key: 'sentOn', label: 'Sent to supplier on', type: 'date' },
      { key: 'creditPct', label: 'Credit % approved', type: 'number', min: 0, max: 100 },
      { key: 'decisionOn', label: 'Decision on', type: 'date' },
    ],
  },
  {
    key: 'invoices', singular: 'Invoice', plural: 'Invoices', refPrefix: 'INV', workflow: invoiceWorkflow, editPermission: 'invoicing',
    title: (r, d) => customerName(d, r.values.customer),
    subtitle: (r, d) => `${str(findRecord(d, 'vehicles', str(r, 'vehicle')), 'reg') || 'No vehicle'} · issued ${formatDate(str(r, 'issuedOn'))}${str(r, 'fleetPo') ? ` · ${str(r, 'fleetPo')}` : ''}`,
    sort: (a, b) => str(b, 'issuedOn').localeCompare(str(a, 'issuedOn')) || b.ref.localeCompare(a.ref),
    createFields: ['customer', 'vehicle', 'job', 'issuedOn', 'fleetPo', 'lines', 'notes'],
    flags: (r, _d, today) => {
      if (invoiceOverdue(r, today)) return [{ tone: 'red', label: `Overdue ${daysBetween(str(r, 'dueOn'), today)} days` }];
      if (r.status === 'onaccount' || r.status === 'issued') return invoiceBalance(r) > 0 ? [{ tone: 'amber', label: `${formatRand(invoiceBalance(r), { compact: true })} open` }] : [];
      return [];
    },
    fields: [
      { key: 'customer', label: 'Customer', type: 'ref', ref: 'customers', required: true },
      { key: 'vehicle', label: 'Vehicle', type: 'ref', ref: 'vehicles' },
      { key: 'job', label: 'Fitment job', type: 'ref', ref: 'jobs' },
      { key: 'issuedOn', label: 'Issued on', type: 'date', required: true, table: true },
      { key: 'dueOn', label: 'Due on (fleet)', type: 'date', table: true },
      { key: 'fleetPo', label: 'Fleet PO', type: 'text' },
      { key: 'paid', label: 'Paid to date', type: 'money', min: 0, table: true },
      { key: 'paymentMethod', label: 'Payment method', type: 'select', options: PAYMENT_METHODS },
      { key: 'lastPaymentOn', label: 'Last payment on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'lines', label: 'Lines', type: 'lines', required: true, wide: true, table: true },
    ],
  },
];

const config: IndustryConfig = {
  id: 'tyres',
  industry: 'Tyre & fitment centre',
  businessName: 'TreadRight Tyre & Fitment',
  monogram: 'TR',
  workspaceTag: 'FITMENT CENTRE',
  tagline: 'Fast-turnaround tyre, balancing and alignment bays',
  summary: 'A busy tyre fitment centre serving retail and fleet customers: a bay queue where every wheel position is inspected and torqued, alignment before/after readings, a tool register that tracks who holds which calibrated torque wrench, tyre stock by size and DOT age, fleet accounts with purchase orders, warranty claims and invoices.',
  priority: 8,
  theme: { accent: '#6b7a2a', accent2: '#7d8d34', accentSoft: '#cbd68f', accentTint: '#f1f4e3', accentLine: '#e1e8c3', accentText: '#4f5a1c' },
  roles: [
    { key: 'manager', label: 'Branch manager' },
    { key: 'advisor', label: 'Counter sales / service advisor' },
    { key: 'fitter', label: 'Fitment technician' },
    { key: 'aligner', label: 'Alignment technician' },
    { key: 'stock', label: 'Stock controller' },
    { key: 'fleetclerk', label: 'Fleet accounts clerk' },
  ],
  permissions: [
    { key: 'jobs.manage', label: 'Manage jobs', description: 'Book vehicles in, send quotes, record approval, hand over and cancel jobs' },
    { key: 'fitment', label: 'Fitment', description: 'Inspect wheels, fit and balance tyres, start the torque check' },
    { key: 'alignment', label: 'Alignment', description: 'Record alignment readings and complete the alignment step' },
    { key: 'qc', label: 'Quality check', description: 'Sign off the torque check and QC checklist so a vehicle is ready' },
    { key: 'tools.issue', label: 'Issue tools', description: 'Check tools out and in on the tool board, report missing tools' },
    { key: 'tools.calibrate', label: 'Tool calibration', description: 'Add tools, send them for calibration or repair, take them out of service' },
    { key: 'stock', label: 'Tyre stock', description: 'Add and adjust tyre stock lines, prices and reorder levels' },
    { key: 'fleet', label: 'Fleet accounts', description: 'Edit fleet accounts, credit limits and PO rules' },
    { key: 'invoicing', label: 'Invoicing', description: 'Record payments, put fleet invoices on account and void invoices' },
    { key: 'warranty', label: 'Warranty claims', description: 'Inspect casings and process supplier warranty claims' },
    { key: 'customers', label: 'Customers & vehicles', description: 'Add and edit customers and their vehicles' },
  ],
  modules: [
    { key: 'jobs', label: 'Bay queue', icon: IcoBoard, group: 'Bays', collection: 'jobs', view: 'board', detail: JobDetail, description: 'Fitment jobs from arrival through wheel inspection, quote, approval, fitting, balancing, alignment and torque check to collection. Steps not sold are skipped.' },
    { key: 'tools', label: 'Tools & equipment', icon: IcoTool, group: 'Stock & tools', collection: 'tools', page: ToolBoard, detail: ToolDetail, description: 'Who holds which tool right now, calibration and service due dates. Expired tools cannot be issued.' },
    { key: 'stock', label: 'Tyre stock', icon: IcoBox, group: 'Stock & tools', collection: 'stock', page: StockPage, description: 'Tyres by size, brand, load/speed index and DOT age. Search a size to see stock and same-rim alternatives.' },
    { key: 'claims', label: 'Warranty claims', icon: IcoShield, group: 'Stock & tools', collection: 'claims', detail: ClaimDetail, description: 'Tyre claims against suppliers: casing inspection, send to supplier, credit or rejection.' },
    { key: 'vehicles', label: 'Vehicles', icon: IcoCar, group: 'Customers', collection: 'vehicles', detail: VehicleDetail, description: 'Customer and fleet vehicles with tyre size, torque spec, rotation due and tyre history per wheel position.' },
    { key: 'customers', label: 'Customers', icon: IcoUsers, group: 'Customers', collection: 'customers', description: 'Retail walk-in customers and fleet account customers.' },
    { key: 'fleets', label: 'Fleet accounts', icon: IcoTruck, group: 'Customers', collection: 'fleets', detail: FleetDetail, description: 'Fleet companies with credit limits, account balances, PO rules and monthly statements.' },
    { key: 'invoices', label: 'Invoices', icon: IcoReceipt, group: 'Admin', collection: 'invoices', detail: InvoiceDetail, description: 'Invoices raised on QC pass. Retail pays at the counter; fleet goes on account (30 days).' },
    { key: 'reports', label: 'Reports', icon: IcoChart, group: 'Admin', page: Reports, description: 'Tyres sold by size and brand, bay throughput, tool utilisation and calibration compliance, warranty rate, fleet vs retail revenue.' },
  ],
  collections,
  seed: buildTyresSeed,
  dashboard: Dashboard,
  boundaries: [
    'Not connected to any tyre supplier or manufacturer: brands, stock, prices, DOT codes and warranty decisions are invented; orders and claims are not sent.',
    'No alignment-machine, wheel-balancer or TPMS integration — readings are typed in by hand for the demo.',
    'Torque specs, the 1.0 mm tread minimum, 5-year stock age and alignment tolerances are demo rules, not legal, OEM or safety advice.',
    'Tool calibration dates are records only; no calibration certificates are issued or verified.',
    'No payments are processed; amounts are recorded by hand. VAT at 15% is a demo calculation, not a tax invoice.',
    'Customer and fleet messages (quotes, reminders, statements) are never sent. Plates and PO numbers are fictional (DEMO…).',
  ],
  highlights: [
    'Bay queue: arrive → inspect every wheel → quote → approve → fit → balance → align → torque → ready',
    'Top-down wheel diagram with tread colour coding; below 1.0 mm must be quoted or refused with a note',
    'Torque check needs a calibrated wrench checked out to the technician and every wheel in spec',
    'Tool board, tyre size search with alternatives, fleet POs & credit limits, warranty claims',
  ],
};

export default config;
