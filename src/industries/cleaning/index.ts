// Contract cleaning demo. Fictional company: a South African contract cleaning and hygiene
// business with cleaners deployed to client sites (offices, schools, clinics, shopping centres).
import type { CollectionDef, Flag, IndustryConfig, WorkflowDef } from '../../core/types';
import { findRecord, lines, num, str } from '../../core/engine';
import { addDays, daysBetween, formatDate, monthLabel } from '../../core/lib/dates';
import {
  IcoBag, IcoBell, IcoBriefcase, IcoCalendar, IcoChart, IcoDoc, IcoFlask, IcoHome, IcoPermit, IcoReceipt, IcoRefresh, IcoTool, IcoTruck, IcoUsers,
} from '../../core/components/Icons';
import {
  CLIENT_SECTORS, COMPLAINT_CATEGORIES, COMPLAINT_KINDS, CONDITIONS, EQUIPMENT_TYPES, FREQUENCIES, INSPECTION_AREAS, INSPECTION_KINDS, INVOICE_KINDS,
  JOB_TYPES, PERIODIC_TASKS, PRIORITIES, QUOTE_APPROVAL_THRESHOLD, REINSPECT_DAYS, SERVICE_DAYS, SITE_TYPES, STAFF_ROLES, STOCK_CATEGORIES, label,
} from './data';
import { buildCleaningSeed } from './seed';
import {
  allocationProblem, budgetState, clientName, complaintClock, completionProblem, equipmentFlags, freqDays, fullName, inspectionFailed, inspectionProblems,
  inspectionScore, invoiceFigures, invoiceOverdue, issueProblems, issueValue, jobScheduleProblem, nowStamp, periodicDue, periodicLabel, periodicStartProblem,
  quoteApprovalReasons, quoteFigures, quoteSendProblem, rand, reliefProblem, rosterProblems, shiftAbsent, shiftCleaners, shiftReliefs, siteFlags, siteName,
  siteOf, slaTarget, staffFlags, staffing, toCsv, todayStr, clockIns,
} from './helpers';
export * from './helpers';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import ShiftDetail from './pages/ShiftDetail';
import SiteDetail from './pages/SiteDetail';
import InspectionDetail from './pages/InspectionDetail';
import ComplaintDetail from './pages/ComplaintDetail';
import StockPage from './pages/StockPage';
import IssueDetail from './pages/IssueDetail';
import QuoteDetail from './pages/QuoteDetail';
import Invoicing from './pages/Invoicing';
import InvoiceDetail from './pages/InvoiceDetail';
import StaffDetail from './pages/StaffDetail';
import Reports from './pages/Reports';

const opt = (list: Array<{ value: string; label: string }>) => list.map(({ value, label: l }) => ({ value, label: l }));
const phoneRule = (v: unknown) => (/^0\d{2} \d{3} \d{4}$/.test(String(v)) ? null : 'Use the format 0xx xxx xxxx.');
const emailRule = (v: unknown) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : 'Enter a valid email address.');

/* ------------------------------------------------------------------ */
const siteWorkflow: WorkflowDef = {
  initial: 'active',
  states: [
    { key: 'active', label: 'Active contract', tone: 'green' },
    { key: 'notice', label: 'On notice', tone: 'amber' },
    { key: 'ended', label: 'Contract ended', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'active', to: 'notice', label: 'Record notice of termination', permission: 'sites.manage', requiresNote: true, intent: 'danger' },
    { from: 'notice', to: 'active', label: 'Renew contract', permission: 'sites.manage', intent: 'primary',
      guard: ({ record }) => (str(record, 'contractEnd') > addDays(todayStr(), 60) ? null : 'Update the contract end date first (Edit) — a renewed contract must run for more than 60 days.') },
    { from: 'notice', to: 'ended', label: 'Close contract', permission: 'sites.manage', requiresNote: true },
  ],
};

/* ------------------------------------------------------------------ */
const shiftWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Roster to confirm', tone: 'dark' },
    { key: 'scheduled', label: 'Scheduled', tone: 'blue' },
    { key: 'clockedin', label: 'On site', tone: 'accent' },
    { key: 'short', label: 'Absent — relief needed', tone: 'red' },
    { key: 'relief', label: 'Relief assigned', tone: 'amber' },
    { key: 'completed', label: 'Completed', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'scheduled', label: 'Confirm roster', permission: 'schedule.manage', intent: 'primary',
      guard: ({ record, data }) => rosterProblems(record, data)[0] ?? null },
    { from: 'scheduled', to: 'clockedin', label: 'Start shift', permission: 'attendance', intent: 'primary',
      guard: ({ record }) => {
        if (str(record, 'date') !== todayStr()) return 'A shift can only be started on its own day.';
        return Object.keys(clockIns(record)).length ? null : 'Clock in at least one cleaner first (attendance panel).';
      } },
    { from: ['scheduled', 'clockedin', 'relief'], to: 'short', label: 'Log absence', permission: 'attendance', requiresNote: true, intent: 'danger',
      guard: ({ record }) => {
        if (str(record, 'date') > todayStr()) return 'An absence can only be logged on or after the day of the shift.';
        return shiftAbsent(record).some((r) => shiftCleaners(record).includes(r)) ? null : 'Mark who is absent first (attendance panel on the shift).';
      } },
    { from: 'short', to: 'relief', label: 'Assign relief cleaner', permission: 'schedule.manage', intent: 'primary',
      guard: ({ record, data }) => reliefProblem(record, data),
      after: ({ record, data, api }) => {
        const pick = findRecord(data, 'staff', str(record, 'reliefPick'));
        if (!pick) return;
        api.update('shifts', record.id, { cleaners: toCsv([...shiftCleaners(record), pick.ref]), reliefs: toCsv([...shiftReliefs(record), pick.ref]), reliefPick: '' }, `Relief: ${fullName(pick)} added to the roster`);
        api.toast(`${fullName(pick)} assigned as relief at ${siteName(data, record.values.site)}`);
      } },
    { from: ['clockedin', 'short', 'relief'], to: 'completed', label: 'Complete shift', permission: 'attendance', intent: 'primary',
      guard: ({ record, data, note }) => completionProblem(record, data, note, todayStr()) },
  ],
};

/* ------------------------------------------------------------------ */
const periodicWorkflow: WorkflowDef = {
  initial: 'planned',
  states: [
    { key: 'planned', label: 'Planned', tone: 'dark' },
    { key: 'inprogress', label: 'In progress', tone: 'blue' },
    { key: 'done', label: 'Done — awaiting sign-off', tone: 'accent' },
    { key: 'signedoff', label: 'Client signed off', tone: 'green' },
  ],
  transitions: [
    { from: 'planned', to: 'inprogress', label: 'Start task', permission: 'periodic', intent: 'primary',
      guard: ({ record, data }) => periodicStartProblem(record, data, todayStr()) },
    { from: 'inprogress', to: 'done', label: 'Mark done', permission: 'periodic', intent: 'primary',
      after: ({ record, api, today }) => {
        const next = addDays(today, freqDays(record));
        api.update('periodic', record.id, { lastDone: today, nextDue: next }, `Done ${formatDate(today)} — next due ${formatDate(next)}`);
        api.toast(`${periodicLabel(record)} done — next due ${formatDate(next)}`);
      } },
    { from: 'done', to: 'signedoff', label: 'Log client sign-off (simulated)', permission: 'inspections.signoff', requiresNote: true },
    { from: 'signedoff', to: 'planned', label: 'Plan next occurrence', permission: 'periodic' },
  ],
};

/* ------------------------------------------------------------------ */
const inspectionWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'amber' },
    { key: 'submitted', label: 'Submitted', tone: 'blue' },
    { key: 'signedoff', label: 'Client signed off', tone: 'green', terminal: true },
  ],
  transitions: [
    {
      from: 'draft', to: 'submitted', label: 'Submit inspection', permission: 'inspections', intent: 'primary',
      guard: ({ record, data }) => inspectionProblems(record, data)[0] ?? null,
      after: ({ record, data, api, today }) => {
        if (!inspectionFailed(record, data)) return;
        const site = siteOf(data, record);
        const due = addDays(today, REINSPECT_DAYS);
        const again = api.create('inspections', {
          site: str(record, 'site'), date: due, kind: 'reinspection', inspector: str(record, 'inspector'), followUpOf: record.id,
          notes: `Follow-up to ${record.ref}: scored ${inspectionScore(record)}% against an SLA target of ${slaTarget(site)}%.`,
        }, 'draft', `Re-inspection scheduled automatically after ${record.ref} failed`);
        api.toast(`Below SLA — re-inspection ${again.ref} scheduled for ${formatDate(due)}`, 'info');
      },
    },
    { from: 'submitted', to: 'signedoff', label: 'Log client sign-off (simulated)', permission: 'inspections.signoff', requiresNote: true, intent: 'primary' },
    { from: 'submitted', to: 'draft', label: 'Reopen for correction', permission: 'inspections', requiresNote: true },
  ],
};

/* ------------------------------------------------------------------ */
const complaintWorkflow: WorkflowDef = {
  initial: 'logged',
  states: [
    { key: 'logged', label: 'Logged', tone: 'red' },
    { key: 'acknowledged', label: 'Acknowledged', tone: 'blue' },
    { key: 'inprogress', label: 'In progress', tone: 'amber' },
    { key: 'resolved', label: 'Resolved', tone: 'accent' },
    { key: 'confirmed', label: 'Client confirmed', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'logged', to: 'acknowledged', label: 'Acknowledge', permission: 'complaints', intent: 'primary',
      after: ({ record, api }) => api.update('complaints', record.id, { ackAt: nowStamp() }) },
    { from: 'acknowledged', to: 'inprogress', label: 'Start work', permission: 'complaints',
      guard: ({ record }) => (str(record, 'assignedTo') ? null : 'Assign a supervisor or team leader first (Edit → Assigned to).') },
    { from: ['acknowledged', 'inprogress'], to: 'resolved', label: 'Mark resolved', permission: 'complaints', intent: 'primary',
      guard: ({ record }) => (str(record, 'resolution').trim() ? null : 'Record what was done to resolve it before closing (resolution).'),
      after: ({ record, api, today }) => api.update('complaints', record.id, { resolvedOn: today }) },
    { from: 'resolved', to: 'confirmed', label: 'Client confirmed (simulated)', permission: 'complaints', intent: 'primary' },
    { from: 'resolved', to: 'inprogress', label: 'Reopen', permission: 'complaints', requiresNote: true, intent: 'danger',
      after: ({ record, api }) => api.update('complaints', record.id, { resolvedOn: '' }) },
  ],
};

/* ------------------------------------------------------------------ */
const issueWorkflow: WorkflowDef = {
  initial: 'requested',
  states: [
    { key: 'requested', label: 'Requested', tone: 'amber' },
    { key: 'issued', label: 'Issued', tone: 'blue' },
    { key: 'received', label: 'Received on site', tone: 'green', terminal: true },
    { key: 'declined', label: 'Declined', tone: 'red', terminal: true },
  ],
  transitions: [
    {
      from: 'requested', to: 'issued', label: 'Issue from store', permission: 'stores.issue', intent: 'primary',
      guard: ({ record, data }) => issueProblems(record, data, todayStr())[0] ?? null,
      after: ({ record, data, api, today }) => {
        const item = findRecord(data, 'stock', str(record, 'item'));
        if (!item) return;
        const left = num(item, 'qty') - num(record, 'qty');
        api.update('stock', item.id, { qty: left }, `${num(record, 'qty')} issued to ${siteName(data, record.values.site)} (${record.ref})`);
        const site = siteOf(data, record);
        if (site && budgetState(data, site, today.slice(0, 7)).over) api.toast(`${str(site, 'name')} is now over its monthly consumables budget`, 'info');
        else if (left <= num(item, 'reorderLevel')) api.toast(`${str(item, 'name')} is at or below its reorder level (${left} left)`, 'info');
      },
    },
    { from: 'issued', to: 'received', label: 'Confirm received on site', intent: 'primary' },
    { from: 'requested', to: 'declined', label: 'Decline request', permission: 'stores.issue', requiresNote: true, intent: 'danger' },
  ],
};

const purchaseWorkflow: WorkflowDef = {
  initial: 'toorder',
  states: [
    { key: 'toorder', label: 'To order', tone: 'dark' },
    { key: 'ordered', label: 'Ordered', tone: 'blue' },
    { key: 'received', label: 'Received', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'toorder', to: 'ordered', label: 'Place order (simulated)', permission: 'stores.order', intent: 'primary',
      guard: ({ record }) => (!(num(record, 'qty') > 0) ? 'Enter the quantity to order.' : !str(record, 'supplier').trim() ? 'Enter the supplier.' : null) },
    { from: 'ordered', to: 'received', label: 'Receive into store', permission: 'stores.order', intent: 'primary',
      after: ({ record, data, api }) => {
        const item = findRecord(data, 'stock', str(record, 'item'));
        if (!item) return;
        api.update('stock', item.id, { qty: num(item, 'qty') + num(record, 'qty') }, `${num(record, 'qty')} received on ${record.ref}`);
        api.toast(`${num(record, 'qty')} × ${str(item, 'name')} added to stock`);
      } },
    { from: ['toorder', 'ordered'], to: 'cancelled', label: 'Cancel order', permission: 'stores.order', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const equipmentWorkflow: WorkflowDef = {
  initial: 'available',
  states: [
    { key: 'available', label: 'In store', tone: 'dark' },
    { key: 'onsite', label: 'On site', tone: 'green' },
    { key: 'repair', label: 'In repair', tone: 'red' },
    { key: 'scrapped', label: 'Scrapped', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: ['available', 'repair'], to: 'onsite', label: 'Allocate to site', permission: 'equipment', intent: 'primary',
      guard: ({ record, data }) => allocationProblem(record, data, todayStr()) },
    { from: ['available', 'onsite'], to: 'repair', label: 'Send for repair', permission: 'equipment', requiresNote: true },
    { from: ['onsite', 'repair'], to: 'available', label: 'Return to store', permission: 'equipment',
      after: ({ record, api }) => api.update('equipment', record.id, { site: '' }) },
    { from: ['available', 'repair'], to: 'scrapped', label: 'Scrap', permission: 'equipment', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const quoteWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'sent', label: 'Sent', tone: 'blue' },
    { key: 'accepted', label: 'Accepted', tone: 'accent' },
    { key: 'scheduled', label: 'Scheduled', tone: 'amber' },
    { key: 'completed', label: 'Completed', tone: 'green' },
    { key: 'invoiced', label: 'Invoiced', tone: 'green', terminal: true },
    { key: 'declined', label: 'Declined', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'sent', label: 'Send quote (simulated)', permission: 'quotes', intent: 'primary',
      guard: ({ record, user }) => quoteSendProblem(record, user),
      after: ({ record, api, today, user }) => api.update('quotes', record.id, { sentOn: today, approvedBy: quoteApprovalReasons(record).length ? user.name : '' }) },
    { from: 'sent', to: 'accepted', label: 'Client accepted', permission: 'quotes', intent: 'primary' },
    { from: 'sent', to: 'declined', label: 'Client declined', permission: 'quotes', requiresNote: true, intent: 'danger' },
    { from: 'accepted', to: 'scheduled', label: 'Schedule job', permission: 'quotes', intent: 'primary',
      guard: ({ record }) => jobScheduleProblem(record, todayStr()) },
    { from: 'scheduled', to: 'completed', label: 'Job completed', permission: 'quotes', intent: 'primary',
      guard: ({ record }) => (str(record, 'jobDate') > todayStr() ? `The job is only scheduled for ${formatDate(str(record, 'jobDate'))}.` : null) },
    { from: 'completed', to: 'invoiced', label: 'Raise invoice', permission: 'invoicing', intent: 'primary',
      after: ({ record, api, today }) => {
        const inv = api.create('invoices', {
          kind: 'onceoff', billTo: str(record, 'clientName'), quote: record.id, period: today.slice(0, 7), date: today, dueDate: addDays(today, 14),
          lines: lines(record).map((l) => ({ ...l, id: `inv_${l.id}` })), credit: 0, creditNote: '',
        }, 'draft', `Drafted from job ${record.ref}`);
        api.update('quotes', record.id, { invoice: inv.id });
        api.toast(`Draft invoice ${inv.ref} raised from ${record.ref}`);
      } },
  ],
};

const invoiceWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'issued', label: 'Issued', tone: 'blue' },
    { key: 'paid', label: 'Paid', tone: 'green', terminal: true },
    { key: 'void', label: 'Void', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'issued', label: 'Issue invoice (simulated)', permission: 'invoicing', intent: 'primary',
      guard: ({ record }) => {
        if (!lines(record).length) return 'Add at least one invoice line.';
        if (invoiceFigures(record).total <= 0) return 'The invoice total must be above zero.';
        if (str(record, 'dueDate') < str(record, 'date')) return 'The due date cannot be before the invoice date.';
        return null;
      } },
    { from: 'issued', to: 'paid', label: 'Record payment', permission: 'invoicing', intent: 'primary',
      after: ({ record, api, today }) => api.update('invoices', record.id, { paidOn: today }) },
    { from: ['draft', 'issued'], to: 'void', label: 'Void invoice', permission: 'invoicing', requiresNote: true, intent: 'danger' },
  ],
};

const staffWorkflow: WorkflowDef = {
  initial: 'active',
  states: [
    { key: 'active', label: 'Active', tone: 'green' },
    { key: 'leave', label: 'On leave', tone: 'amber' },
    { key: 'left', label: 'Left', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'active', to: 'leave', label: 'Place on leave', permission: 'staff.manage', requiresNote: true },
    { from: 'leave', to: 'active', label: 'Return from leave', permission: 'staff.manage', intent: 'primary' },
    { from: ['active', 'leave'], to: 'left', label: 'End employment', permission: 'staff.manage', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const collections: CollectionDef[] = [
  {
    key: 'clients', singular: 'Client', plural: 'Clients', refPrefix: 'CL', editPermission: 'sites.manage',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `${label(CLIENT_SECTORS, str(r, 'sector'))} · ${str(r, 'contact')}`,
    sort: (a, b) => str(a, 'name').localeCompare(str(b, 'name')),
    fields: [
      { key: 'name', label: 'Client (fictional)', type: 'text', required: true },
      { key: 'sector', label: 'Sector', type: 'select', options: CLIENT_SECTORS, required: true, table: true },
      { key: 'contact', label: 'Contact person', type: 'text', required: true, table: true },
      { key: 'phone', label: 'Phone (fictional)', type: 'text', table: true, validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'termsDays', label: 'Payment terms (days)', type: 'number', min: 0, max: 90, table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'sites', singular: 'Site', plural: 'Sites & contracts', refPrefix: 'ST', workflow: siteWorkflow, editPermission: 'sites.manage',
    title: (r) => str(r, 'name'),
    subtitle: (r, d) => `${label(SITE_TYPES, str(r, 'siteType'))} · ${clientName(d, r.values.client)}`,
    sort: (a, b) => str(a, 'name').localeCompare(str(b, 'name')),
    flags: (r, d, today) => siteFlags(r, d, today),
    fields: [
      { key: 'name', label: 'Site', type: 'text', required: true },
      { key: 'client', label: 'Client', type: 'ref', ref: 'clients', required: true },
      { key: 'siteType', label: 'Site type', type: 'select', options: SITE_TYPES, required: true, table: true },
      { key: 'suburb', label: 'Area', type: 'text' },
      { key: 'm2', label: 'Floor area (m²)', type: 'number', min: 0 },
      { key: 'cleanersPerShift', label: 'Cleaners per shift', type: 'number', min: 1, max: 30, required: true, table: true },
      { key: 'serviceDays', label: 'Service days', type: 'select', options: SERVICE_DAYS, required: true },
      { key: 'shiftStart', label: 'Shift starts', type: 'time', required: true },
      { key: 'shiftEnd', label: 'Shift ends', type: 'time', required: true, validate: (v, all) => (String(v) <= String(all.shiftStart ?? '') ? 'The shift must end after it starts.' : null) },
      { key: 'monthlyFee', label: 'Monthly fee (excl. VAT)', type: 'money', min: 0, required: true, table: true },
      { key: 'contractStart', label: 'Contract start', type: 'date', required: true },
      { key: 'contractEnd', label: 'Contract end', type: 'date', required: true, table: true, validate: (v, all) => (String(v) <= String(all.contractStart ?? '') ? 'The contract must end after it starts.' : null) },
      { key: 'slaTarget', label: 'SLA target score (%)', type: 'number', min: 50, max: 100, required: true, table: true },
      { key: 'consumablesBudget', label: 'Consumables budget per month', type: 'money', min: 0 },
      { key: 'supervisor', label: 'Area supervisor', type: 'ref', ref: 'staff' },
      { key: 'dailyTasks', label: 'Scope — daily tasks', type: 'textarea', hint: 'One task per line, e.g. "Ablutions — clean and restock". These become the daily shift checklist.' },
      { key: 'weeklyTasks', label: 'Scope — weekly tasks', type: 'textarea', hint: 'One task per line.' },
      { key: 'monthlyTasks', label: 'Scope — monthly tasks', type: 'textarea', hint: 'One task per line.' },
    ],
  },
  {
    key: 'shifts', singular: 'Shift', plural: 'Shifts', refPrefix: 'SH', workflow: shiftWorkflow, editPermission: 'schedule.manage',
    title: (r, d) => siteName(d, r.values.site),
    subtitle: (r) => `${formatDate(str(r, 'date'))} · ${str(r, 'start')}–${str(r, 'end')}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || str(a, 'start').localeCompare(str(b, 'start')),
    createFields: ['site', 'date', 'start', 'end'],
    flags: (r, d, today) => {
      const out: Flag[] = [];
      if (r.status === 'completed' && str(r, 'date') < today) {
        const st = staffing(r, d);
        if (st.present < st.contracted) out.push({ tone: 'amber', label: `Ran ${st.present}/${st.contracted} — credit due` });
        return out;
      }
      const st = staffing(r, d);
      if (st.unfilled > 0) out.push({ tone: 'red', label: `${st.unfilled} unfilled` });
      if (st.late.length) out.push({ tone: 'amber', label: `${st.late.length} late clock-in${st.late.length === 1 ? '' : 's'}` });
      if (r.status === 'draft' && daysBetween(today, str(r, 'date')) <= 1) out.push({ tone: 'amber', label: 'Roster not confirmed' });
      return out;
    },
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'start', label: 'Starts', type: 'time', required: true, table: true },
      { key: 'end', label: 'Ends', type: 'time', required: true, table: true, validate: (v, all) => (String(v) <= String(all.start ?? '') ? 'The shift must end after it starts.' : null) },
      { key: 'cleaners', label: 'Rostered cleaners (staff refs)', type: 'text', hint: 'Managed from the roster panel on the shift.' },
      { key: 'clockIns', label: 'Clock-ins', type: 'text' },
      { key: 'absentees', label: 'Absent', type: 'text' },
      { key: 'reliefs', label: 'Relief cleaners', type: 'text' },
      { key: 'reliefPick', label: 'Relief cleaner chosen', type: 'ref', ref: 'staff' },
      { key: 'checklist', label: 'Daily checklist (ticked lines)', type: 'text' },
      { key: 'missedNote', label: 'Tasks missed and why', type: 'textarea' },
    ],
  },
  {
    key: 'periodic', singular: 'Periodic task', plural: 'Periodic tasks', refPrefix: 'PT', workflow: periodicWorkflow, editPermission: 'periodic',
    title: (r, d) => `${periodicLabel(r)} — ${siteName(d, r.values.site)}`,
    subtitle: (r) => `${label(FREQUENCIES, str(r, 'frequency'))} · next due ${formatDate(str(r, 'nextDue'))}`,
    sort: (a, b) => str(a, 'nextDue').localeCompare(str(b, 'nextDue')),
    flags: (r, _d, today) => {
      const s = periodicDue(r, today);
      const out: Flag[] = s === 'overdue' ? [{ tone: 'red', label: `Overdue ${daysBetween(str(r, 'nextDue'), today)} days` }] : s === 'due-soon' ? [{ tone: 'amber', label: 'Due this week' }] : [];
      if (num(r, 'chargeExtra') > 0) out.push({ tone: 'dark', label: 'Billable extra' });
      return out;
    },
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true },
      { key: 'task', label: 'Task', type: 'select', options: PERIODIC_TASKS, required: true },
      { key: 'frequency', label: 'Frequency', type: 'select', options: opt(FREQUENCIES), required: true, table: true },
      { key: 'nextDue', label: 'Next due', type: 'date', required: true, table: true },
      { key: 'lastDone', label: 'Last done', type: 'date', table: true },
      { key: 'assignedTo', label: 'Team leader', type: 'ref', ref: 'staff' },
      { key: 'atHeight', label: 'Work above ground level (needs working-at-heights training)', type: 'boolean' },
      { key: 'chargeExtra', label: 'Billable extra per occurrence (0 = in contract)', type: 'money', min: 0 },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'inspections', singular: 'Inspection', plural: 'Quality inspections', refPrefix: 'QI', workflow: inspectionWorkflow, editPermission: 'inspections',
    title: (r, d) => siteName(d, r.values.site),
    subtitle: (r, d) => {
      const score = inspectionScore(r);
      return `${formatDate(str(r, 'date'))} · ${score === null ? 'not scored yet' : `${score}% against SLA ${slaTarget(siteOf(d, r))}%`}`;
    },
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')),
    createFields: ['site', 'date', 'kind', 'inspector'],
    flags: (r, d, today) => {
      const out: Flag[] = [];
      if (r.status === 'draft' && str(r, 'kind') === 'reinspection') out.push(str(r, 'date') < today ? { tone: 'red', label: 'Re-inspection overdue' } : { tone: 'amber', label: 'Re-inspection due' });
      if (r.status !== 'draft' && inspectionFailed(r, d)) out.push({ tone: 'red', label: 'Below SLA' });
      if (r.status !== 'draft' && str(r, 'correctiveAction') && r.values.correctiveDone !== true && str(r, 'correctiveDue') && str(r, 'correctiveDue') < today) out.push({ tone: 'red', label: 'Corrective action overdue' });
      return out;
    },
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true },
      { key: 'date', label: 'Inspection date', type: 'date', required: true, table: true },
      { key: 'kind', label: 'Type', type: 'select', options: INSPECTION_KINDS, required: true, table: true },
      { key: 'inspector', label: 'Inspected by', type: 'ref', ref: 'staff', required: true, table: true },
      ...INSPECTION_AREAS.map((a) => ({ key: a.key, label: `${a.label} (1–5)`, type: 'number' as const, min: 1, max: 5 })),
      { key: 'notes', label: 'Findings', type: 'textarea' },
      { key: 'correctiveAction', label: 'Corrective action', type: 'textarea' },
      { key: 'correctiveDue', label: 'Corrective action due', type: 'date' },
      { key: 'correctiveDone', label: 'Corrective action completed', type: 'boolean' },
      { key: 'followUpOf', label: 'Follow-up to', type: 'ref', ref: 'inspections' },
    ],
  },
  {
    key: 'complaints', singular: 'Complaint / request', plural: 'Complaints & requests', refPrefix: 'CR', workflow: complaintWorkflow, editPermission: 'complaints',
    title: (r, d) => `${label(COMPLAINT_CATEGORIES, str(r, 'category'))} — ${siteName(d, r.values.site)}`,
    subtitle: (r) => `${label(COMPLAINT_KINDS, str(r, 'kind'))} · ${label(PRIORITIES, str(r, 'priority'))} · ${formatDate(str(r, 'date'))} ${str(r, 'time')}`,
    sort: (a, b) => (str(b, 'date') + str(b, 'time')).localeCompare(str(a, 'date') + str(a, 'time')),
    createFields: ['site', 'kind', 'category', 'priority', 'date', 'time', 'reportedBy', 'description'],
    flags: (r) => {
      const c = complaintClock(r);
      const out: Flag[] = [];
      if (c.breached) out.push({ tone: 'red', label: `Response SLA breached (${c.target} h)` });
      else if (c.late) out.push({ tone: 'amber', label: `Acknowledged late (${c.waited} h)` });
      return out;
    },
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true },
      { key: 'kind', label: 'Type', type: 'select', options: COMPLAINT_KINDS, required: true },
      { key: 'category', label: 'Category', type: 'select', options: COMPLAINT_CATEGORIES, required: true },
      { key: 'priority', label: 'Priority', type: 'select', options: opt(PRIORITIES), required: true, table: true, hint: 'Response target (demo): urgent 2 h · high 4 h · normal 24 h · low 48 h' },
      { key: 'date', label: 'Logged on', type: 'date', required: true, table: true },
      { key: 'time', label: 'Logged at', type: 'time', required: true },
      { key: 'reportedBy', label: 'Reported by', type: 'text', required: true, table: true },
      { key: 'description', label: 'What the client reported', type: 'textarea', required: true },
      { key: 'assignedTo', label: 'Assigned to', type: 'ref', ref: 'staff' },
      { key: 'ackAt', label: 'Acknowledged at', type: 'text' },
      { key: 'resolution', label: 'Resolution — what was done', type: 'textarea' },
      { key: 'resolvedOn', label: 'Resolved on', type: 'date' },
    ],
  },
  {
    key: 'stock', singular: 'Stock item', plural: 'Consumables & chemicals', refPrefix: 'SKU', editPermission: 'stores.order',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `${label(STOCK_CATEGORIES, str(r, 'category'))} · ${str(r, 'unit')}`,
    sort: (a, b) => str(a, 'category').localeCompare(str(b, 'category')) || str(a, 'name').localeCompare(str(b, 'name')),
    flags: (r) => {
      const out: Flag[] = num(r, 'qty') <= 0 ? [{ tone: 'red', label: 'Out of stock' }] : num(r, 'qty') <= num(r, 'reorderLevel') ? [{ tone: 'amber', label: 'Reorder' }] : [];
      if (r.values.hazardous === true) out.push(r.values.sdsOnFile === true ? { tone: 'dark', label: 'Hazardous · SDS on file' } : { tone: 'red', label: 'Hazardous · SDS missing' });
      return out;
    },
    fields: [
      { key: 'name', label: 'Item', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: STOCK_CATEGORIES, required: true, table: true },
      { key: 'unit', label: 'Unit', type: 'text', required: true, placeholder: 'e.g. case of 48' },
      { key: 'supplier', label: 'Supplier (fictional)', type: 'text' },
      { key: 'cost', label: 'Cost per unit', type: 'money', min: 0, required: true, table: true },
      { key: 'qty', label: 'In store', type: 'number', min: 0, required: true, table: true },
      { key: 'reorderLevel', label: 'Reorder at', type: 'number', min: 0, required: true, table: true },
      { key: 'hazardous', label: 'Hazardous chemical', type: 'boolean' },
      { key: 'sdsOnFile', label: 'Safety data sheet (SDS) on file — illustrative', type: 'boolean' },
    ],
  },
  {
    key: 'issues', singular: 'Stock issue', plural: 'Issues to sites', refPrefix: 'ISS', workflow: issueWorkflow, editPermission: 'stores.request',
    title: (r, d) => `${str(findRecord(d, 'stock', str(r, 'item')), 'name') || 'Item'} → ${siteName(d, r.values.site)}`,
    subtitle: (r, d) => `${num(r, 'qty')} × ${str(findRecord(d, 'stock', str(r, 'item')), 'unit')} · ${formatDate(str(r, 'date'))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')),
    flags: (r, d, today) => {
      if (r.status !== 'requested') return [];
      const out: Flag[] = [];
      const item = findRecord(d, 'stock', str(r, 'item'));
      const site = siteOf(d, r);
      if (item && num(r, 'qty') > num(item, 'qty')) out.push({ tone: 'red', label: `Only ${num(item, 'qty')} in store` });
      if (item?.values.hazardous === true) out.push({ tone: issueProblems(r, d, today).some((p) => /hazardous/.test(p)) ? 'red' : 'dark', label: 'Hazardous chemical' });
      if (site) {
        const b = budgetState(d, site, str(r, 'date').slice(0, 7));
        if (b.budget > 0 && b.used + issueValue(r, d) > b.budget) out.push({ tone: 'amber', label: 'Takes site over budget' });
      }
      return out;
    },
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true },
      { key: 'item', label: 'Stock item', type: 'ref', ref: 'stock', required: true },
      { key: 'qty', label: 'Quantity', type: 'number', min: 1, required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'requestedBy', label: 'Requested by', type: 'text', table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'purchaseOrders', singular: 'Purchase order', plural: 'Purchase orders', refPrefix: 'PO', workflow: purchaseWorkflow, editPermission: 'stores.order',
    title: (r, d) => str(findRecord(d, 'stock', str(r, 'item')), 'name') || 'Stock item',
    subtitle: (r) => `${num(r, 'qty')} from ${str(r, 'supplier') || 'supplier to be chosen'}`,
    sort: (a, b) => str(b, 'expected').localeCompare(str(a, 'expected')),
    flags: (r, _d, today) => (r.status === 'ordered' && str(r, 'expected') && str(r, 'expected') < today ? [{ tone: 'red', label: 'Delivery overdue' }] : []),
    fields: [
      { key: 'item', label: 'Stock item', type: 'ref', ref: 'stock', required: true },
      { key: 'qty', label: 'Quantity', type: 'number', min: 1, required: true, table: true },
      { key: 'supplier', label: 'Supplier (fictional)', type: 'text', table: true },
      { key: 'unitCost', label: 'Unit cost', type: 'money', min: 0, table: true },
      { key: 'expected', label: 'Expected delivery', type: 'date', table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'equipment', singular: 'Equipment item', plural: 'Equipment register', refPrefix: 'EQ', workflow: equipmentWorkflow, editPermission: 'equipment',
    title: (r) => `${label(EQUIPMENT_TYPES, str(r, 'type'))} ${str(r, 'assetNo')}`,
    subtitle: (r, d) => `${str(r, 'model')} · ${str(r, 'site') ? siteName(d, r.values.site) : 'In store'}`,
    sort: (a, b) => str(a, 'assetNo').localeCompare(str(b, 'assetNo')),
    flags: (r, _d, today) => equipmentFlags(r, today),
    fields: [
      { key: 'assetNo', label: 'Asset no.', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'select', options: opt(EQUIPMENT_TYPES), required: true },
      { key: 'model', label: 'Make & model (fictional)', type: 'text' },
      { key: 'site', label: 'Site located', type: 'ref', ref: 'sites', table: true },
      { key: 'serviceDue', label: 'Service due', type: 'date', table: true },
      { key: 'electricalTestDue', label: 'Electrical test due', type: 'date', table: true, hint: 'Portable-appliance style safety test (demo). Leave blank for non-electrical items.' },
      { key: 'condition', label: 'Condition', type: 'select', options: CONDITIONS, table: true },
      { key: 'purchased', label: 'Purchased', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'quotes', singular: 'Quote / job', plural: 'Once-off jobs & quotes', refPrefix: 'QT', workflow: quoteWorkflow, editPermission: 'quotes',
    title: (r) => str(r, 'clientName'),
    subtitle: (r) => `${label(JOB_TYPES, str(r, 'jobType'))} · ${rand(quoteFigures(r).net)} excl. VAT`,
    createFields: ['clientName', 'contact', 'phone', 'email', 'jobType', 'address', 'description', 'costEstimate', 'lines'],
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      if (r.status === 'draft' && quoteApprovalReasons(r).length) out.push({ tone: 'amber', label: 'Needs approval to send' });
      if (r.status === 'sent' && str(r, 'sentOn') && daysBetween(str(r, 'sentOn'), today) > 14) out.push({ tone: 'amber', label: 'No response 14+ days' });
      if (r.status === 'accepted' && !str(r, 'jobDate')) out.push({ tone: 'amber', label: 'Not scheduled' });
      return out;
    },
    fields: [
      { key: 'clientName', label: 'Client (fictional)', type: 'text', required: true },
      { key: 'contact', label: 'Contact person', type: 'text' },
      { key: 'phone', label: 'Phone (fictional)', type: 'text', validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'jobType', label: 'Job type', type: 'select', options: JOB_TYPES, required: true, table: true },
      { key: 'address', label: 'Where', type: 'text' },
      { key: 'description', label: 'Scope of work', type: 'textarea' },
      { key: 'costEstimate', label: 'Estimated cost (internal)', type: 'money', min: 0, hint: `Labour and consumables at cost. Quotes above ${rand(QUOTE_APPROVAL_THRESHOLD * 100)} or below the minimum margin need approval.` },
      { key: 'jobDate', label: 'Job date', type: 'date', table: true },
      { key: 'teamSize', label: 'Team size', type: 'number', min: 1, max: 40, table: true },
      { key: 'teamLeader', label: 'Team leader', type: 'ref', ref: 'staff' },
      { key: 'sentOn', label: 'Sent on', type: 'date' },
      { key: 'approvedBy', label: 'Approved by', type: 'text' },
      { key: 'invoice', label: 'Invoice', type: 'ref', ref: 'invoices' },
      { key: 'lines', label: 'Quote lines (hours × rate, consumables, equipment)', type: 'lines', wide: true },
    ],
  },
  {
    key: 'invoices', singular: 'Invoice', plural: 'Invoices', refPrefix: 'INV', workflow: invoiceWorkflow, editPermission: 'invoicing',
    title: (r) => str(r, 'billTo'),
    subtitle: (r, d) => `${str(r, 'site') ? siteName(d, r.values.site) : label(INVOICE_KINDS, str(r, 'kind'))} · ${str(r, 'period') ? monthLabel(str(r, 'period')) : ''} · ${rand(invoiceFigures(r).total)}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || str(a, 'billTo').localeCompare(str(b, 'billTo')),
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      if (invoiceOverdue(r, today)) out.push({ tone: 'red', label: `Overdue ${daysBetween(str(r, 'dueDate'), today)} days` });
      if (num(r, 'credit') > 0) out.push({ tone: 'dark', label: 'Staffing credit applied' });
      return out;
    },
    fields: [
      { key: 'kind', label: 'Type', type: 'select', options: INVOICE_KINDS, required: true, table: true },
      { key: 'billTo', label: 'Bill to', type: 'text', required: true },
      { key: 'client', label: 'Client', type: 'ref', ref: 'clients' },
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites' },
      { key: 'quote', label: 'Once-off job', type: 'ref', ref: 'quotes' },
      { key: 'period', label: 'Period (YYYY-MM)', type: 'text', validate: (v) => (/^\d{4}-\d{2}$/.test(String(v)) ? null : 'Use the form YYYY-MM.') },
      { key: 'date', label: 'Invoice date', type: 'date', required: true, table: true },
      { key: 'dueDate', label: 'Due date', type: 'date', required: true, table: true },
      { key: 'credit', label: 'Credit — shifts not staffed (excl. VAT)', type: 'money', min: 0 },
      { key: 'creditNote', label: 'Credit basis', type: 'text' },
      { key: 'paidOn', label: 'Paid on', type: 'date', table: true },
      { key: 'lines', label: 'Invoice lines', type: 'lines', wide: true },
    ],
  },
  {
    key: 'staff', singular: 'Staff member', plural: 'Staff', refPrefix: 'EMP', workflow: staffWorkflow, editPermission: 'staff.manage',
    title: (r) => fullName(r),
    subtitle: (r, d) => `${label(STAFF_ROLES, str(r, 'role'))}${str(r, 'homeSite') ? ` · ${siteName(d, r.values.homeSite)}` : ''}`,
    sort: (a, b) => str(a, 'lastName').localeCompare(str(b, 'lastName')) || str(a, 'firstName').localeCompare(str(b, 'firstName')),
    createFields: ['firstName', 'lastName', 'role', 'phone', 'employmentStart', 'homeSite'],
    flags: (r, _d, today) => staffFlags(r, today),
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'lastName', label: 'Surname', type: 'text', required: true },
      { key: 'role', label: 'Role', type: 'select', options: STAFF_ROLES, required: true, table: true },
      { key: 'phone', label: 'Mobile (fictional)', type: 'text', table: true, validate: phoneRule },
      { key: 'employmentStart', label: 'Employment start', type: 'date', required: true },
      { key: 'homeSite', label: 'Based at', type: 'ref', ref: 'sites', table: true },
      { key: 'inductions', label: 'Site inductions (site refs)', type: 'text', hint: 'Comma-separated site references, e.g. ST-0001, ST-0004. Easier to manage from the staff profile.' },
      { key: 'icExpiry', label: 'Infection control — valid until', type: 'date', table: true },
      { key: 'chemExpiry', label: 'Chemical handling — valid until', type: 'date', table: true },
      { key: 'heightsExpiry', label: 'Working at heights — valid until', type: 'date' },
      { key: 'uniformIssued', label: 'Uniform issued', type: 'date' },
      { key: 'ppeIssued', label: 'PPE issued', type: 'date' },
      { key: 'hrNotes', label: 'HR notes (restricted)', type: 'textarea', permission: 'hr.view' },
    ],
  },
];

const config: IndustryConfig = {
  id: 'cleaning',
  industry: 'Cleaning services',
  businessName: 'BrightPath Cleaning Services',
  monogram: 'BP',
  workspaceTag: 'OPERATIONS',
  tagline: 'Contract cleaning & hygiene operations',
  summary: 'A contract cleaning and hygiene company with cleaners deployed to offices, schools, clinics and shopping centres: site contracts and scopes, daily shifts and attendance, deep-clean schedules, quality inspections against SLA, client complaints, consumables and chemical stock, equipment, once-off jobs and monthly contract invoicing.',
  priority: 10,
  theme: { accent: '#0f8f83', accent2: '#1ea296', accentSoft: '#9fdcd5', accentTint: '#e3f5f3', accentLine: '#c2e7e3', accentText: '#0b6159' },
  roles: [
    { key: 'md', label: 'Managing director' },
    { key: 'ops', label: 'Operations manager' },
    { key: 'supervisor', label: 'Area supervisor' },
    { key: 'stores', label: 'Stores & procurement clerk' },
    { key: 'accounts', label: 'Accounts clerk' },
    { key: 'liaison', label: 'Client liaison' },
  ],
  permissions: [
    { key: 'sites.manage', label: 'Manage contracts', description: 'Add and edit clients, sites, scopes, fees and contract dates' },
    { key: 'schedule.manage', label: 'Manage roster', description: 'Create shifts, confirm rosters and assign relief cleaners' },
    { key: 'attendance', label: 'Attendance', description: 'Clock cleaners in, log absences, tick the daily checklist and complete shifts' },
    { key: 'periodic', label: 'Periodic tasks', description: 'Plan, start and complete deep cleans and other periodic tasks' },
    { key: 'inspections', label: 'Inspect', description: 'Capture and submit quality inspections' },
    { key: 'inspections.signoff', label: 'Client sign-off', description: 'Log the client’s sign-off on inspections and periodic tasks (simulated)' },
    { key: 'complaints', label: 'Complaints', description: 'Log, acknowledge, resolve and reopen complaints and requests' },
    { key: 'stores.request', label: 'Request stock', description: 'Request consumables and chemicals for a site' },
    { key: 'stores.issue', label: 'Issue stock', description: 'Issue stock from the store to sites, or decline a request' },
    { key: 'stores.order', label: 'Purchasing', description: 'Maintain stock items and place and receive purchase orders' },
    { key: 'equipment', label: 'Equipment', description: 'Allocate, repair and service equipment' },
    { key: 'quotes', label: 'Quotes & jobs', description: 'Prepare quotes and run once-off jobs' },
    { key: 'quotes.approve', label: 'Approve quotes', description: 'Send quotes above the value threshold or below the minimum margin' },
    { key: 'invoicing', label: 'Invoicing', description: 'Draft, issue and void invoices and record payments' },
    { key: 'staff.manage', label: 'Manage staff', description: 'Edit staff records, training, inductions and leave' },
    { key: 'hr.view', label: 'View HR notes', description: 'See restricted HR notes on staff records' },
  ],
  modules: [
    { key: 'sites', label: 'Sites & contracts', icon: IcoHome, group: 'Operations', collection: 'sites', detail: SiteDetail, description: 'Every client site with its scope of work, contracted cleaners, fee, contract dates and SLA target.' },
    { key: 'schedule', label: 'Daily schedule & attendance', icon: IcoCalendar, group: 'Operations', collection: 'shifts', page: Schedule, detail: ShiftDetail, description: 'Today’s shifts by site: who is rostered, who has clocked in, absences, relief cover and the daily checklist.' },
    { key: 'periodic', label: 'Periodic tasks', icon: IcoRefresh, group: 'Operations', collection: 'periodic', view: 'board', description: 'Deep cleans on a cycle — carpet extraction, window cleaning, strip & seal, high dusting — with next due dates and client sign-off.' },
    { key: 'inspections', label: 'Quality inspections', icon: IcoPermit, group: 'Quality', collection: 'inspections', detail: InspectionDetail, description: 'Supervisor inspections scored by area against each site’s SLA target. A failed inspection schedules a re-inspection.' },
    { key: 'complaints', label: 'Complaints & requests', icon: IcoBell, group: 'Quality', collection: 'complaints', view: 'board', detail: ComplaintDetail, description: 'Client complaints and extra requests from logging to client confirmation, with a response clock per priority.' },
    { key: 'stock', label: 'Consumables & chemicals', icon: IcoFlask, group: 'Stores', collection: 'stock', page: StockPage, description: 'Store stock with reorder levels, hazardous chemicals and SDS on file, and each site’s consumables budget.' },
    { key: 'issues', label: 'Issues to sites', icon: IcoTruck, group: 'Stores', collection: 'issues', view: 'board', detail: IssueDetail, description: 'Stock requested by sites, issued from the store and confirmed on site. Issuing deducts stock.' },
    { key: 'purchasing', label: 'Purchase orders', icon: IcoBag, group: 'Stores', collection: 'purchaseOrders', description: 'Replenishment orders: to order, ordered and received into stock.' },
    { key: 'equipment', label: 'Equipment register', icon: IcoTool, group: 'Stores', collection: 'equipment', description: 'Vacuums, scrubber-driers, polishers and trolleys: where each is, service dates and electrical safety tests.' },
    { key: 'quotes', label: 'Once-off jobs & quotes', icon: IcoDoc, group: 'Commercial', collection: 'quotes', view: 'board', detail: QuoteDetail, description: 'Post-construction, event and deep cleans for non-contract clients, from quote to invoice.' },
    { key: 'invoices', label: 'Invoicing', icon: IcoReceipt, group: 'Commercial', collection: 'invoices', page: Invoicing, detail: InvoiceDetail, description: 'Monthly contract invoices (fee, billable extras, credit for shifts not staffed) and once-off job invoices.' },
    { key: 'clients', label: 'Clients', icon: IcoBriefcase, group: 'Commercial', collection: 'clients', description: 'Contract clients with contacts and payment terms.' },
    { key: 'reports', label: 'Reports', icon: IcoChart, group: 'Commercial', page: Reports, description: 'Attendance, inspection scores against SLA, complaints, consumables against budget and revenue by client type.' },
    { key: 'staff', label: 'Staff', icon: IcoUsers, group: 'People', collection: 'staff', detail: StaffDetail, description: 'Cleaners, team leaders and supervisors with site inductions, training expiries and uniform and PPE issue dates.' },
  ],
  collections,
  seed: buildCleaningSeed,
  dashboard: Dashboard,
  boundaries: [
    'No time-and-attendance hardware, biometric or GPS clock-in: clock-in times are typed or stamped by whoever is using this browser.',
    'No payroll, overtime, leave pay or bargaining-council wage calculations. The credit for shifts not staffed is a demo rule, not a contract term.',
    'Safety data sheets and training records are illustrative. This is not Occupational Health and Safety Act, hazardous chemical agents or infection-control compliance.',
    'Client sign-offs on inspections and periodic tasks are simulated: a staff member logs them. Nothing is signed by a client.',
    'Messages to clients are previewed only — no email or SMS is sent. Quotes and invoices are not tax invoices and are not posted to any accounting system.',
    'All clients, sites, people, suppliers, chemicals, asset numbers and amounts are fictional.',
  ],
  guide: [
    { title: 'Take attendance for today', detail: 'On today’s board, clock a cleaner in and watch the site’s staffing level change. Late clock-ins and unfilled places are flagged per site.', to: 'schedule', as: 'u_sup' },
    { title: 'Cover an absence at a clinic', detail: 'A cleaner is absent at the day clinic. Try the relief cleaners in turn: they are refused for an overlapping shift, a missing site induction or expired infection-control training — only one is eligible.', to: 'schedule/shifts_1', as: 'u_sup' },
    { title: 'Submit a failed inspection', detail: 'Press “Submit inspection”: it is refused because an area scored 2 has no corrective action. Add one with a due date and submit — the score is below SLA, so a re-inspection is scheduled.', to: 'inspections/inspections_1', as: 'u_sup' },
    { title: 'Issue stock to sites', detail: 'Issue the three requests. One is refused because there is not enough in store, one because a hazardous chemical is going to a site with no trained cleaner. The third goes through and deducts stock.', to: 'issues', as: 'u_stores' },
    { title: 'Send a quote that needs approval', detail: 'This post-construction quote is above the approval threshold, so the client liaison cannot send it. Switch to the operations manager in the top bar and it goes.', to: 'quotes/quotes_1', as: 'u_liaison' },
    { title: 'Draft the month’s invoices', detail: 'Press “Draft contract invoices”. Each site gets its fee plus billable extras, less a credit for every contracted cleaner missing from a completed shift.', to: 'invoices', as: 'u_acc' },
  ],
  highlights: [
    'Today’s board by site: staffing level, late clock-ins, absences and relief cover',
    'Rostering rules: site induction, no overlapping shifts, infection-control training for clinics',
    'Inspections scored against SLA — a failed inspection schedules its own re-inspection',
    'Stock issues deduct the store; hazardous chemicals only to trained sites with an SDS on file',
  ],
};

export default config;
