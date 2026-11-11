// Automotive services demo. Fictional workshop: Torque Lane Auto Services.
import type { CollectionDef, EffectContext, Flag, IndustryConfig, Values, WorkflowDef } from '../../core/types';
import { findRecord, lines, linesTotals, num, records, str } from '../../core/engine';
import { daysBetween, formatDate } from '../../core/lib/dates';
import { formatRand } from '../../core/lib/money';
import { IcoBell, IcoBoard, IcoBox, IcoCalendar, IcoCar, IcoChart, IcoDoc, IcoReceipt, IcoUsers } from '../../core/components/Icons';
import { BAYS, CONTACT_METHODS, CUSTOMER_KINDS, JOB_TYPES, PART_CATEGORIES, PAYMENT_METHODS, TECHNICIANS, label } from './data';
import { buildAutomotiveSeed } from './seed';
import {
  APPROVAL_CHANNEL, IN_WORKSHOP, ageDays, ageLabel, checkInProblem, customerName, invoiceOverdue, isLabour, isServiceJob, jobEstimate, jobInvoice, kmText, nextService,
  paymentProblem, qcMissing, QC_ITEMS, releaseProblem, serviceDue, startWorkProblem, vehicleCustomer, vehicleLabel,
} from './helpers';
export * from './helpers';
import Dashboard from './pages/Dashboard';
import Planner from './pages/Planner';
import JobDetail from './pages/JobDetail';
import EstimateDetail from './pages/EstimateDetail';
import VehicleProfile from './pages/VehicleProfile';
import CustomerDetail from './pages/CustomerDetail';
import InvoiceDetail from './pages/InvoiceDetail';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';

const opt = (list: Array<{ value: string; label: string }>) => list.map(({ value, label: l }) => ({ value, label: l }));
const lastNote = (ctx: EffectContext) => ctx.record.history[ctx.record.history.length - 1]?.note ?? '';

/* ------------------------------------------------------------------ */
export const jobWorkflow: WorkflowDef = {
  initial: 'booked',
  states: [
    { key: 'booked', label: 'Booked', tone: 'dark' },
    { key: 'checkedin', label: 'Checked in', tone: 'blue' },
    { key: 'diagnosing', label: 'Diagnosing', tone: 'accent' },
    { key: 'approval', label: 'Awaiting approval', tone: 'amber' },
    { key: 'inprogress', label: 'In progress', tone: 'accent' },
    { key: 'qc', label: 'Quality check', tone: 'blue' },
    { key: 'ready', label: 'Ready for collection', tone: 'green' },
    { key: 'collected', label: 'Collected', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    {
      from: 'booked', to: 'checkedin', label: 'Check in vehicle', permission: 'jobs.manage', intent: 'primary',
      guard: ({ record, data }) => checkInProblem(record, data),
      after: ({ record, api, today }) => api.update('jobs', record.id, { checkedInOn: today }),
    },
    {
      from: 'checkedin', to: 'diagnosing', label: 'Start diagnosis', permission: 'jobs.work',
      guard: ({ record }) => (!str(record, 'technician') ? 'Assign a technician first — use “Bay & technician” on this job card.' : !str(record, 'bay') ? 'Allocate a bay first — use “Bay & technician” on this job card or the planner.' : null),
    },
    {
      from: 'diagnosing', to: 'approval', label: 'Send estimate to customer', permission: 'estimates',
      guard: ({ record, data }) => {
        const est = jobEstimate(data, record);
        if (!est) return 'Prepare an estimate for this job card first (Estimate panel below).';
        if (est.status === 'draft') return `Send estimate ${est.ref} to the customer first — use “Send to customer” in the Estimate panel below. The job card then moves here automatically.`;
        if (est.status === 'approved') return `Estimate ${est.ref} is already approved — start work instead.`;
        if (est.status === 'declined') return `Estimate ${est.ref} was declined. Revise it or cancel the job card.`;
        return null;
      },
    },
    {
      from: ['checkedin', 'diagnosing', 'approval'], to: 'inprogress', label: 'Start work', permission: 'jobs.work', intent: 'primary',
      guard: ({ record, data }) => startWorkProblem(record, data),
    },
    { from: 'inprogress', to: 'qc', label: 'Send to quality check', permission: 'jobs.work' },
    {
      from: 'qc', to: 'ready', label: 'Pass quality check', permission: 'qc', intent: 'primary',
      guard: ({ record }) => {
        const missing = qcMissing(record);
        return missing.length ? `QC checklist incomplete: ${missing.join(', ')}.` : null;
      },
      after: ({ record, data, api, today }) => {
        api.update('jobs', record.id, { readyOn: today });
        const est = jobEstimate(data, record);
        if (est && !jobInvoice(data, record.id)) {
          const cust = vehicleCustomer(data, record.values.vehicle);
          const inv = api.create('invoices', {
            job: record.id, customer: cust?.id ?? '', vehicle: str(record, 'vehicle'), issuedOn: today, lines: lines(est).map((l) => ({ ...l })), paid: 0, paymentMethod: '', lastPaymentOn: '', notes: '',
          }, 'issued', `Invoice issued from ${record.ref} on quality check pass`);
          api.toast(`Invoice ${inv.ref} issued — ${formatRand(linesTotals(lines(est)).total)}`);
        }
      },
    },
    {
      from: 'qc', to: 'inprogress', label: 'Fail QC — back to technician', permission: 'qc', requiresNote: true, intent: 'danger',
      after: ({ record, api }) => api.update('jobs', record.id, Object.fromEntries(QC_ITEMS.map((i) => [i.key, false]))),
    },
    {
      from: 'ready', to: 'collected', label: 'Hand over to customer', permission: 'jobs.manage', intent: 'primary',
      guard: ({ record, data }) => releaseProblem(record, data),
      after: ({ record, data, api, today }) => {
        api.update('jobs', record.id, { collectedOn: today });
        const v = findRecord(data, 'vehicles', str(record, 'vehicle'));
        if (!v) return;
        const odo = Math.max(num(v, 'odometer'), num(record, 'odometerIn'));
        const vals: Values = { odometer: odo, odometerOn: str(record, 'checkedInOn') || today };
        if (isServiceJob(record)) {
          Object.assign(vals, { lastServiceDate: today }, nextService(today, odo));
          api.update('vehicles', v.id, vals, `Service recorded on ${record.ref} at ${kmText(odo)}`, `Next service due ${formatDate(String(vals.nextServiceDate))} or ${kmText(Number(vals.nextServiceKm))}`);
          api.toast(`Next service set: ${formatDate(String(vals.nextServiceDate))} / ${kmText(Number(vals.nextServiceKm))}`);
        } else {
          api.update('vehicles', v.id, vals, `Odometer ${kmText(odo)} recorded from ${record.ref}`);
        }
      },
    },
    { from: ['booked', 'checkedin', 'diagnosing', 'approval'], to: 'cancelled', label: 'Cancel job card', permission: 'jobs.manage', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
export const estimateWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'sent', label: 'Sent to customer', tone: 'blue' },
    { key: 'approved', label: 'Approved', tone: 'green', terminal: true },
    { key: 'declined', label: 'Declined', tone: 'red' },
  ],
  transitions: [
    {
      from: 'draft', to: 'sent', label: 'Send to customer (simulated)', permission: 'estimates', intent: 'primary',
      guard: ({ record, data }) => {
        if (!findRecord(data, 'jobs', str(record, 'job'))) return 'Link the estimate to a job card.';
        if (!lines(record).length) return 'Add at least one parts or labour line.';
        if (!lines(record).some(isLabour)) return 'Add a labour line (code LAB, quantity = hours) so the customer sees the labour cost.';
        return null;
      },
      after: ({ record, data, api, today }) => {
        api.update('estimates', record.id, { sentOn: today });
        const job = findRecord(data, 'jobs', str(record, 'job'));
        if (job) api.update('jobs', job.id, { estimate: record.id }, `Estimate ${record.ref} sent to customer (${formatRand(linesTotals(lines(record)).total)})`);
        // The job card follows the estimate: once it is with the customer the vehicle is "Awaiting approval".
        if (job?.status === 'diagnosing') api.transition('jobs', job.id, 'approval');
      },
    },
    {
      from: 'sent', to: 'approved', label: 'Record customer approval', permission: 'estimates', requiresNote: true, intent: 'primary',
      guard: ({ note }) => (note === undefined || APPROVAL_CHANNEL.test(note) ? null : 'Record how the customer approved — by phone, WhatsApp, in person or email — and who approved it.'),
      after: (ctx) => {
        const { record, data, api, today } = ctx;
        const note = lastNote(ctx);
        api.update('estimates', record.id, { approvedOn: today, approvalNote: note });
        const job = findRecord(data, 'jobs', str(record, 'job'));
        if (job) api.update('jobs', job.id, { estimate: record.id }, `Customer approved estimate ${record.ref} (${formatRand(linesTotals(lines(record)).total)})`, note);
        // Allocate stocked parts to the job.
        const short: string[] = [];
        for (const l of lines(record).filter((x) => !isLabour(x))) {
          const p = records(data, 'parts').find((x) => str(x, 'partNo') === l.code);
          if (!p) continue;
          const have = num(p, 'qty');
          if (have < l.qty) short.push(str(p, 'partNo'));
          api.update('parts', p.id, { qty: Math.max(0, have - l.qty) }, `${Math.min(have, l.qty)} allocated to ${job?.ref ?? record.ref}`);
        }
        api.toast(short.length ? `Approved. Parts short: ${short.join(', ')} — order from supplier (not connected).` : 'Approved — parts allocated and logged on the job card');
      },
    },
    {
      from: 'sent', to: 'declined', label: 'Record customer decline', permission: 'estimates', requiresNote: true, intent: 'danger',
      after: (ctx) => {
        const job = findRecord(ctx.data, 'jobs', str(ctx.record, 'job'));
        if (job) ctx.api.update('jobs', job.id, {}, `Customer declined estimate ${ctx.record.ref}`, lastNote(ctx));
      },
    },
    { from: ['sent', 'declined'], to: 'draft', label: 'Revise estimate', permission: 'estimates' },
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
    { key: 'partpaid', label: 'Part paid', tone: 'amber' },
    { key: 'paid', label: 'Paid', tone: 'green', terminal: true },
    { key: 'void', label: 'Voided', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: ['issued', 'partpaid'], to: 'partpaid', label: 'Record part payment', permission: 'invoicing', guard: ({ record }) => paymentProblem(record, num(record, 'paymentAmount'), 'part'), after: applyPayment },
    { from: ['issued', 'partpaid'], to: 'paid', label: 'Record payment in full', permission: 'invoicing', intent: 'primary', guard: ({ record }) => paymentProblem(record, num(record, 'paymentAmount'), 'full'), after: applyPayment },
    { from: 'issued', to: 'void', label: 'Void invoice', permission: 'invoicing', requiresNote: true, intent: 'danger',
      guard: ({ record }) => (num(record, 'paid') > 0 ? 'Payments are recorded on this invoice — refund or credit them before voiding.' : null) },
  ],
};

/* ------------------------------------------------------------------ */
const phoneRule = (v: unknown) => (/^0\d{2} \d{3} \d{4}$/.test(String(v)) ? null : 'Use the format 0xx xxx xxxx.');

const collections: CollectionDef[] = [
  {
    key: 'jobs', singular: 'Job card', plural: 'Job cards', refPrefix: 'JC', workflow: jobWorkflow, editPermission: 'jobs.manage',
    title: (r, d) => vehicleLabel(d, r.values.vehicle),
    subtitle: (r, d) => `${vehicleCustomer(d, r.values.vehicle) ? str(vehicleCustomer(d, r.values.vehicle), 'name') : '—'} · ${label(JOB_TYPES, str(r, 'jobType'))}`,
    sort: (a, b) => (str(b, 'workDate') + str(b, 'startTime')).localeCompare(str(a, 'workDate') + str(a, 'startTime')),
    createFields: ['vehicle', 'jobType', 'complaint', 'workDate', 'startTime', 'hoursBooked', 'bay', 'technician', 'promisedDate', 'promisedTime', 'comebackOf'],
    flags: (r, d, today) => {
      const out: Flag[] = [];
      const open = !['ready', 'collected', 'cancelled'].includes(r.status ?? '');
      if (open && str(r, 'promisedDate') && str(r, 'promisedDate') < today) out.push({ tone: 'red', label: 'Past promised date' });
      if (str(r, 'jobType') === 'comeback') out.push({ tone: 'red', label: 'Comeback' });
      if (r.status === 'approval') {
        const est = jobEstimate(d, r);
        const age = ageDays(str(est, 'sentOn'), today);
        if (age >= 1) out.push({ tone: 'amber', label: `Waiting ${ageLabel(age)}` });
      }
      if (r.status === 'ready' && str(r, 'readyOn') && daysBetween(str(r, 'readyOn'), today) >= 2) out.push({ tone: 'amber', label: `Uncollected ${daysBetween(str(r, 'readyOn'), today)} days` });
      return out;
    },
    fields: [
      { key: 'vehicle', label: 'Customer vehicle', type: 'ref', ref: 'vehicles', required: true },
      { key: 'jobType', label: 'Job type', type: 'select', options: JOB_TYPES, required: true, table: true },
      { key: 'complaint', label: 'Customer complaint / request', type: 'textarea', required: true },
      { key: 'workDate', label: 'Workshop date', type: 'date', required: true, table: true },
      { key: 'startTime', label: 'Planned start', type: 'time', validate: (v) => (v && (String(v) < '07:30' || String(v) > '16:00') ? 'The workshop plans work between 07:30 and 16:00.' : null) },
      { key: 'hoursBooked', label: 'Planned labour (hours)', type: 'number', min: 0.25, max: 12, step: 0.25 },
      { key: 'bay', label: 'Bay', type: 'select', options: BAYS, table: true },
      { key: 'technician', label: 'Technician', type: 'select', options: opt(TECHNICIANS), table: true },
      { key: 'odometerIn', label: 'Odometer in (km)', type: 'number', min: 0, hint: 'Must not be below the vehicle’s last recorded reading.' },
      { key: 'estimate', label: 'Estimate', type: 'ref', ref: 'estimates' },
      { key: 'promisedDate', label: 'Promised date', type: 'date', table: true },
      { key: 'promisedTime', label: 'Promised time', type: 'time' },
      { key: 'comebackOf', label: 'Comeback of job card', type: 'ref', ref: 'jobs', hint: 'Set when the vehicle returns for rework of an earlier job.' },
      { key: 'checkedInOn', label: 'Checked in on', type: 'date' },
      { key: 'readyOn', label: 'Ready on', type: 'date' },
      { key: 'collectedOn', label: 'Collected on', type: 'date' },
      { key: 'workNotes', label: 'Technician notes', type: 'textarea' },
      ...QC_ITEMS.map((i) => ({ key: i.key, label: `QC: ${i.label}`, type: 'boolean' as const })),
    ],
  },
  {
    key: 'estimates', singular: 'Estimate', plural: 'Estimates', refPrefix: 'EST', workflow: estimateWorkflow, editPermission: 'estimates',
    title: (r, d) => vehicleLabel(d, r.values.vehicle),
    subtitle: (r, d) => `${findRecord(d, 'jobs', str(r, 'job'))?.ref ?? 'No job card'} · ${formatRand(linesTotals(lines(r)).total)} incl. VAT`,
    sort: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.ref.localeCompare(a.ref),
    createFields: ['job', 'vehicle', 'validUntil', 'lines'],
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      if (r.status === 'sent' && ageDays(str(r, 'sentOn'), today) >= 2) out.push({ tone: 'amber', label: `No reply ${ageDays(str(r, 'sentOn'), today)} days` });
      if (['draft', 'sent'].includes(r.status ?? '') && str(r, 'validUntil') && str(r, 'validUntil') < today) out.push({ tone: 'red', label: 'Expired' });
      return out;
    },
    fields: [
      { key: 'job', label: 'Job card', type: 'ref', ref: 'jobs', required: true },
      { key: 'vehicle', label: 'Vehicle', type: 'ref', ref: 'vehicles', required: true },
      { key: 'validUntil', label: 'Valid until', type: 'date' },
      { key: 'sentOn', label: 'Sent on', type: 'date', table: true },
      { key: 'approvedOn', label: 'Approved on', type: 'date' },
      { key: 'approvalNote', label: 'How the customer approved', type: 'text' },
      { key: 'lines', label: 'Parts & labour (labour: code LAB, qty = hours)', type: 'lines', required: true, wide: true, table: true },
    ],
  },
  {
    key: 'vehicles', singular: 'Vehicle', plural: 'Vehicles', refPrefix: 'VEH', editPermission: 'customers',
    title: (r) => `${str(r, 'reg')} · ${str(r, 'make')} ${str(r, 'model')}`,
    subtitle: (r, d) => `${customerName(d, r.values.customer)} · ${str(r, 'year')} ${str(r, 'colour')}`,
    sort: (a, b) => str(a, 'reg').localeCompare(str(b, 'reg')),
    createFields: ['customer', 'reg', 'make', 'model', 'year', 'colour', 'vin', 'fuel', 'odometer', 'odometerOn', 'kmPerMonth', 'nextServiceDate', 'nextServiceKm'],
    flags: (r, d, today) => {
      const out: Flag[] = [];
      const s = serviceDue(r, today);
      if (s.state === 'overdue') out.push({ tone: 'red', label: s.by === 'km' ? 'Service overdue (km)' : 'Service overdue' });
      if (s.state === 'due-soon') out.push({ tone: 'amber', label: s.by === 'km' ? 'Service due (km)' : 'Service due' });
      if (records(d, 'jobs').some((j) => str(j, 'vehicle') === r.id && IN_WORKSHOP.includes(j.status ?? ''))) out.push({ tone: 'blue', label: 'In workshop' });
      return out;
    },
    fields: [
      { key: 'customer', label: 'Owner / customer', type: 'ref', ref: 'customers', required: true },
      { key: 'reg', label: 'Registration (fictional)', type: 'text', required: true, placeholder: 'DEMO 123 GP', hint: 'Demo plates only — not a real registration.' },
      { key: 'make', label: 'Make', type: 'text', required: true },
      { key: 'model', label: 'Model', type: 'text', required: true, table: true },
      { key: 'year', label: 'Year', type: 'number', min: 1970, max: 2030, table: true },
      { key: 'colour', label: 'Colour', type: 'text' },
      { key: 'vin', label: 'VIN (fictional)', type: 'text', hint: 'Demo VINs start with DEMO. No VIN decoding.', validate: (v) => (String(v).length !== 17 ? 'A VIN has 17 characters.' : !/^DEMO/i.test(String(v)) ? 'Use a fictional VIN starting with DEMO.' : null) },
      { key: 'fuel', label: 'Fuel', type: 'select', options: [{ value: 'petrol', label: 'Petrol' }, { value: 'diesel', label: 'Diesel' }, { value: 'hybrid', label: 'Hybrid' }] },
      { key: 'odometer', label: 'Last recorded odometer (km)', type: 'number', min: 0, required: true, table: true },
      { key: 'odometerOn', label: 'Odometer recorded on', type: 'date' },
      { key: 'kmPerMonth', label: 'Typical km per month', type: 'number', min: 0, hint: 'Used to estimate when a service falls due by kilometres.' },
      { key: 'lastServiceDate', label: 'Last service', type: 'date' },
      { key: 'nextServiceDate', label: 'Next service due (date)', type: 'date', table: true },
      { key: 'nextServiceKm', label: 'Next service due (km)', type: 'number', min: 0, table: true },
      { key: 'lastReminder', label: 'Last reminder logged', type: 'date' },
    ],
  },
  {
    key: 'customers', singular: 'Customer', plural: 'Customers', refPrefix: 'CUS', editPermission: 'customers',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `${label(CUSTOMER_KINDS, str(r, 'kind'))}${str(r, 'area') ? ` · ${str(r, 'area')}` : ''}`,
    sort: (a, b) => str(a, 'name').localeCompare(str(b, 'name')),
    flags: (r, d, today) => {
      const out: Flag[] = [];
      if (str(r, 'kind') === 'account') out.push({ tone: 'dark', label: 'Fleet account' });
      if (records(d, 'invoices').some((i) => str(i, 'customer') === r.id && invoiceOverdue(i, today))) out.push({ tone: 'red', label: 'Overdue invoice' });
      if (!r.values.consentReminders) out.push({ tone: 'dark', label: 'No reminder consent' });
      return out;
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'kind', label: 'Customer type', type: 'select', options: CUSTOMER_KINDS, required: true, table: true },
      { key: 'contactPerson', label: 'Contact person (fleet)', type: 'text' },
      { key: 'phone', label: 'Mobile (fictional)', type: 'text', required: true, table: true, validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : 'Enter a valid email address.') },
      { key: 'preferredContact', label: 'Preferred contact', type: 'select', options: CONTACT_METHODS, table: true },
      { key: 'consentReminders', label: 'Consents to service reminders', type: 'boolean' },
      { key: 'area', label: 'Area', type: 'text', table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'parts', singular: 'Part', plural: 'Parts inventory', refPrefix: 'PRT', editPermission: 'parts',
    title: (r) => str(r, 'description'),
    subtitle: (r) => `${str(r, 'partNo')} · fits ${str(r, 'fits') || '—'}`,
    sort: (a, b) => str(a, 'partNo').localeCompare(str(b, 'partNo')),
    flags: (r) => (num(r, 'qty') <= 0 ? [{ tone: 'red', label: 'Out of stock' }] : num(r, 'qty') <= num(r, 'reorderLevel') ? [{ tone: 'amber', label: 'Low stock — reorder' }] : []),
    fields: [
      { key: 'partNo', label: 'Part number (fictional)', type: 'text', required: true, table: true },
      { key: 'description', label: 'Description', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: PART_CATEGORIES, required: true, table: true },
      { key: 'fits', label: 'Fits (general)', type: 'text', hint: 'Free text — no OEM fitment data.' },
      { key: 'supplier', label: 'Supplier (fictional)', type: 'text' },
      { key: 'bin', label: 'Bin location', type: 'text' },
      { key: 'cost', label: 'Cost (excl. VAT)', type: 'money', min: 0, required: true },
      { key: 'sell', label: 'Sell (excl. VAT)', type: 'money', min: 0, required: true, table: true, validate: (v, all) => (Number(v) < Number(all.cost) ? 'Sell price is below cost.' : null) },
      { key: 'qty', label: 'On hand', type: 'number', min: 0, required: true, table: true },
      { key: 'reorderLevel', label: 'Reorder at', type: 'number', min: 0, required: true, table: true },
    ],
  },
  {
    key: 'invoices', singular: 'Invoice', plural: 'Invoices', refPrefix: 'INV', workflow: invoiceWorkflow, editPermission: 'invoicing',
    title: (r, d) => customerName(d, r.values.customer),
    subtitle: (r, d) => `${findRecord(d, 'vehicles', str(r, 'vehicle')) ? str(findRecord(d, 'vehicles', str(r, 'vehicle')), 'reg') : 'No vehicle'} · issued ${formatDate(str(r, 'issuedOn'))}`,
    sort: (a, b) => str(b, 'issuedOn').localeCompare(str(a, 'issuedOn')) || b.ref.localeCompare(a.ref),
    createFields: ['customer', 'vehicle', 'job', 'issuedOn', 'lines', 'notes'],
    flags: (r, _d, today) => (invoiceOverdue(r, today) ? [{ tone: 'red', label: `Overdue ${daysBetween(str(r, 'issuedOn'), today) - 30} days` }] : []),
    fields: [
      { key: 'customer', label: 'Customer', type: 'ref', ref: 'customers', required: true },
      { key: 'vehicle', label: 'Vehicle', type: 'ref', ref: 'vehicles' },
      { key: 'job', label: 'Job card', type: 'ref', ref: 'jobs' },
      { key: 'issuedOn', label: 'Issued on', type: 'date', required: true, table: true },
      { key: 'paid', label: 'Paid to date', type: 'money', min: 0, table: true },
      { key: 'paymentMethod', label: 'Last payment method', type: 'select', options: PAYMENT_METHODS },
      { key: 'lastPaymentOn', label: 'Last payment on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'lines', label: 'Parts & labour', type: 'lines', required: true, wide: true, table: true },
    ],
  },
];

const config: IndustryConfig = {
  id: 'automotive',
  industry: 'Automotive services',
  businessName: 'Torque Lane Auto Services',
  monogram: 'TL',
  workspaceTag: 'WORKSHOP',
  tagline: 'Service & repair workshop management',
  summary: 'An independent service and repair workshop: job cards on a workshop board from booking to collection, bay and technician planning, parts-and-labour estimates that need customer approval before work starts, parts stock, invoices and service reminders.',
  priority: 3,
  theme: { accent: '#b4572e', accent2: '#c66a40', accentSoft: '#f0b89a', accentTint: '#faece4', accentLine: '#f0d3c3', accentText: '#8c3f1f' },
  roles: [
    { key: 'owner', label: 'Workshop owner' },
    { key: 'advisor', label: 'Service advisor' },
    { key: 'foreman', label: 'Workshop foreman' },
    { key: 'technician', label: 'Technician' },
    { key: 'clerk', label: 'Parts & admin clerk' },
  ],
  permissions: [
    { key: 'jobs.manage', label: 'Manage job cards', description: 'Book, check in, plan, release and cancel job cards' },
    { key: 'jobs.work', label: 'Work on vehicles', description: 'Start diagnosis and work, send work to quality check' },
    { key: 'estimates', label: 'Estimates', description: 'Prepare estimates, send them and record customer approval or decline' },
    { key: 'qc', label: 'Quality check', description: 'Pass or fail the quality check before a vehicle is ready' },
    { key: 'parts', label: 'Parts', description: 'Add and adjust parts stock' },
    { key: 'invoicing', label: 'Invoicing', description: 'Edit invoices, record payments and void invoices' },
    { key: 'customers', label: 'Customers & vehicles', description: 'Add and edit customers and their vehicles' },
  ],
  modules: [
    { key: 'jobs', label: 'Workshop board', icon: IcoBoard, group: 'Front office', collection: 'jobs', view: 'board', detail: JobDetail, description: 'Job cards from booking through check-in, diagnosis, customer approval, work, quality check and collection.' },
    { key: 'estimates', label: 'Estimates', icon: IcoDoc, group: 'Front office', collection: 'estimates', detail: EstimateDetail, description: 'Parts and labour estimates (labour as hours × rate). No work starts until the customer approves.' },
    { key: 'vehicles', label: 'Vehicles', icon: IcoCar, group: 'Front office', collection: 'vehicles', detail: VehicleProfile, description: 'Customer vehicles with odometer, next service due by date or kilometres, and full service history.' },
    { key: 'customers', label: 'Customers', icon: IcoUsers, group: 'Front office', collection: 'customers', detail: CustomerDetail, description: 'Private customers and fleet accounts with their vehicles and invoices.' },
    { key: 'reminders', label: 'Service reminders', icon: IcoBell, group: 'Front office', page: Reminders, description: 'Vehicles due or overdue for a service by date or kilometres. Preview and log reminders, book job cards.' },
    { key: 'planner', label: 'Bay & technician planner', icon: IcoCalendar, group: 'Workshop', page: Planner, description: 'Today’s job cards by bay or technician, with utilisation against an 8-hour day.' },
    { key: 'parts', label: 'Parts inventory', icon: IcoBox, group: 'Workshop', collection: 'parts', description: 'Parts with cost, sell, stock on hand and reorder levels. Approved estimates allocate stock.' },
    { key: 'invoices', label: 'Invoices', icon: IcoReceipt, group: 'Admin', collection: 'invoices', detail: InvoiceDetail, description: 'Invoices raised on quality check pass. Record part and full payments; overdue after 30 days.' },
    { key: 'reports', label: 'Workshop reports', icon: IcoChart, group: 'Admin', page: Reports, description: 'Revenue (labour vs parts), turnaround, labour hours by technician, comebacks and parts margin.' },
  ],
  collections,
  seed: buildAutomotiveSeed,
  dashboard: Dashboard,
  boundaries: [
    'Not connected to any parts supplier: stock levels, prices and part numbers are invented and orders are not placed.',
    'No OEM data, service schedules, fitment catalogues or VIN decoding. Plates and VINs are fictional (DEMO…).',
    'No payments are processed — payment amounts are recorded by hand for the demo.',
    'Service reminders and estimate messages are previewed and logged, never sent.',
    'Not a tax-compliant invoicing or accounting system; VAT at 15% is a demo calculation.',
  ],
  guide: [
    { title: 'Check a vehicle in', detail: 'Type the odometer reading in the “Check-in” panel and check the vehicle in. Try a reading below the last recorded one first — it is refused.', to: 'jobs/jobs_open_10', as: 'u_adv' },
    { title: 'Try to start work without approval', detail: 'Press “Start work” on this job card. It is refused: the estimate is still with the customer, and no work starts without an approved estimate.', to: 'jobs/jobs_open_6', as: 'u_tech' },
    { title: 'Record the customer’s approval', detail: 'In the Estimate panel press “Record customer approval” and say how they approved, e.g. “Approved by phone — Ms Govender”. Parts are allocated from stock and work can start.', to: 'jobs/jobs_open_6', as: 'u_adv' },
    { title: 'Pass a quality check', detail: 'Tick the two outstanding checklist items, then “Pass quality check”. The invoice is raised automatically from the approved estimate.', to: 'jobs/jobs_open_3', as: 'u_fore' },
    { title: 'Take payment and hand over', detail: '“Hand over to customer” is refused until the invoice is paid. Use “Record payment” in the Invoice panel, come back and hand over — the vehicle’s odometer and service history are updated.', to: 'jobs/jobs_open_1', as: 'u_adv' },
    { title: 'Chase a service reminder', detail: 'Vehicles due by date or kilometres. Preview a reminder (nothing is sent) or press “Book” to put the vehicle on the workshop board.', to: 'reminders', as: 'u_adv' },
  ],
  highlights: [
    'Workshop board: booked → diagnosis → customer approval → work → QC → collection',
    'No work starts without a customer-approved estimate; approval note must say how',
    'Odometer check at check-in; collection updates odometer and next service due',
    'Bay & technician planner with utilisation, service reminders and workshop reports',
  ],
};

export default config;
