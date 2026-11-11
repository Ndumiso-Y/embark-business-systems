// Law-firm demo. Fictional practice: Mahlaba & Rossouw Attorneys (South Africa).
// Matters move from intake through a conflict check and engagement to closure;
// time becomes fee notes; a simulated trust ledger can never go negative.
import type { CollectionDef, IndustryConfig, WorkflowDef } from '../../core/types';
import { findRecord, num, str } from '../../core/engine';
import { daysBetween, formatDate } from '../../core/lib/dates';
import { toCents } from '../../core/lib/money';
import { IcoCalendar, IcoChart, IcoDoc, IcoReceipt, IcoScale, IcoShield, IcoTimer, IcoUsers, IcoWallet } from '../../core/components/Icons';
import {
  CLIENT_KINDS, CONFLICT_OUTCOMES, COURT_DOC_TYPES, DIARY_TYPES, DOC_TYPES, FEE_BASIS, FEE_EARNER_OPTIONS, FICA_STATUS, MATTER_TYPES, TRUST_TYPES, earner, label,
} from './data';
import { buildLegalSeed } from './seed';
import {
  activationProblems, clientName, closeProblems, conflictStatus, engagementProblem, ficaState, formatCents, hoursProblem, invoiceOutstanding, invoiceTotal,
  isOutflow, matterMoney, matterName, timeValue, trustApprovalProblems, trustBalance,
} from './helpers';
export * from './helpers';
import Dashboard from './pages/Dashboard';
import MatterDetail from './pages/MatterDetail';
import ConflictChecks from './pages/ConflictChecks';
import ClientDetail from './pages/ClientDetail';
import TrustLedger from './pages/TrustLedger';
import TrustDetail from './pages/TrustDetail';
import Diary from './pages/Diary';
import InvoiceDetail from './pages/InvoiceDetail';
import Reports from './pages/Reports';

/* ------------------------------------------------------------------ */
const matterWorkflow: WorkflowDef = {
  initial: 'intake',
  states: [
    { key: 'intake', label: 'Intake', tone: 'dark' },
    { key: 'conflict', label: 'Conflict check', tone: 'amber', hint: 'Awaiting conflict clearance' },
    { key: 'engagement', label: 'Engagement', tone: 'blue', hint: 'Engagement letter and FICA' },
    { key: 'active', label: 'Active', tone: 'accent' },
    { key: 'closing', label: 'Closing', tone: 'amber' },
    { key: 'closed', label: 'Closed', tone: 'green', terminal: true },
    { key: 'declined', label: 'Declined', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'intake', to: 'conflict', label: 'Send for conflict check', permission: 'intake', intent: 'primary',
      guard: ({ record, data }) => (findRecord(data, 'clients', str(record, 'client')) ? null : 'Link the matter to a client before running a conflict check.') },
    { from: 'conflict', to: 'engagement', label: 'Conflict cleared — prepare engagement', permission: 'matters.manage', intent: 'primary',
      guard: ({ record, data }) => engagementProblem(data, record.id) },
    { from: 'engagement', to: 'active', label: 'Open for work', permission: 'matters.manage', intent: 'primary',
      guard: ({ record }) => activationProblems(record)[0] ?? null },
    { from: 'active', to: 'closing', label: 'Start closing', permission: 'matters.manage' },
    { from: 'closing', to: 'active', label: 'Reopen', permission: 'matters.manage', requiresNote: true },
    { from: 'closing', to: 'closed', label: 'Close matter', permission: 'matters.manage', intent: 'primary',
      guard: ({ record, data }) => closeProblems(record, data)[0] ?? null },
    { from: ['intake', 'conflict', 'engagement'], to: 'declined', label: 'Decline matter', permission: 'matters.manage', requiresNote: true, intent: 'danger' },
  ],
};

const conflictWorkflow: WorkflowDef = {
  initial: 'pending',
  states: [
    { key: 'pending', label: 'Awaiting clearance', tone: 'amber' },
    { key: 'cleared', label: 'Cleared', tone: 'green', terminal: true },
    { key: 'conflict', label: 'Conflict confirmed', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'pending', to: 'cleared', label: 'Clear for engagement', permission: 'conflicts.clear', intent: 'primary',
      guard: ({ record, note }) => {
        const outcome = str(record, 'outcome');
        if (!outcome) return 'Record the outcome of the search first.';
        if (outcome === 'conflict') return 'A confirmed conflict cannot be cleared. Confirm the conflict and decline the matter.';
        if (outcome === 'potential' && !str(record, 'note').trim() && !note?.trim()) return 'A potential conflict can only be cleared with a note explaining why the firm may act (e.g. informed consent obtained).';
        return null;
      } },
    { from: 'pending', to: 'conflict', label: 'Confirm conflict', permission: 'conflicts.clear', requiresNote: true, intent: 'danger' },
  ],
};

const timeWorkflow: WorkflowDef = {
  initial: 'unbilled',
  states: [
    { key: 'unbilled', label: 'Unbilled', tone: 'amber' },
    { key: 'billed', label: 'Billed', tone: 'green', terminal: true },
    { key: 'writtenoff', label: 'Written off', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'unbilled', to: 'billed', label: 'Mark billed', permission: 'billing',
      guard: ({ record, data }) => {
        if (record.values.billable !== true) return 'Non-billable time cannot be billed.';
        if (!findRecord(data, 'invoices', str(record, 'invoice'))) return 'Time is billed through a fee note — use “Bill unbilled time” on the matter.';
        return null;
      } },
    { from: 'unbilled', to: 'writtenoff', label: 'Write off', permission: 'billing', requiresNote: true, intent: 'danger' },
  ],
};

const trustWorkflow: WorkflowDef = {
  initial: 'captured',
  states: [
    { key: 'captured', label: 'Captured — awaiting approval', tone: 'amber' },
    { key: 'approved', label: 'Approved (simulated)', tone: 'green', terminal: true },
    { key: 'rejected', label: 'Rejected', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'captured', to: 'approved', label: 'Approve (simulated)', permission: 'trust.approve', intent: 'primary',
      guard: ({ record, data }) => trustApprovalProblems(record, data)[0] ?? null,
      after: ({ record, data, api }) => {
        if (str(record, 'type') !== 'transfer') return;
        const inv = findRecord(data, 'invoices', str(record, 'invoice'));
        if (!inv) return;
        const paid = Math.round((num(inv, 'paid') + num(record, 'amount')) * 100) / 100;
        api.update('invoices', inv.id, { paid }, `Payment from trust ${record.ref} (simulated)`);
        api.toast(`Fee note ${inv.ref} payment updated — record it as paid on the fee note.`, 'info');
      } },
    { from: 'captured', to: 'rejected', label: 'Reject', permission: 'trust.approve', requiresNote: true, intent: 'danger' },
  ],
};

const diaryWorkflow: WorkflowDef = {
  initial: 'upcoming',
  states: [
    { key: 'upcoming', label: 'Upcoming', tone: 'blue' },
    { key: 'done', label: 'Done', tone: 'green', terminal: true },
    { key: 'postponed', label: 'Postponed', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'upcoming', to: 'done', label: 'Mark done', permission: 'diary', intent: 'primary' },
    { from: 'upcoming', to: 'postponed', label: 'Postpone', permission: 'diary', requiresNote: true,
      guard: ({ record }) => {
        if (str(record, 'type') === 'prescription') return 'A prescription date cannot be postponed. Serve process to interrupt prescription, then mark it done.';
        if (!str(record, 'newDate')) return 'Enter the new date first (Edit → New date).';
        if (str(record, 'newDate') <= str(record, 'date')) return 'The new date must be after the current date.';
        return null;
      },
      after: ({ record, api }) => {
        api.create('diary', { ...record.values, date: record.values.newDate, newDate: '', notes: `Postponed from ${formatDate(str(record, 'date'))} (${record.ref}).` }, 'upcoming', `Rescheduled from ${record.ref}`);
        api.toast('New diary entry created for the postponed date');
      } },
  ],
};

const invoiceWorkflow: WorkflowDef = {
  initial: 'issued',
  states: [
    { key: 'issued', label: 'Issued', tone: 'blue' },
    { key: 'partpaid', label: 'Part paid', tone: 'amber' },
    { key: 'paid', label: 'Paid', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'issued', to: 'partpaid', label: 'Record part payment', permission: 'billing',
      guard: ({ record }) => (num(record, 'paid') > 0 && toCents(num(record, 'paid')) < invoiceTotal(record) ? null : 'Enter a payment received that is less than the total first.') },
    { from: ['issued', 'partpaid'], to: 'paid', label: 'Record payment in full', permission: 'billing', intent: 'primary',
      guard: ({ record }) => (toCents(num(record, 'paid')) >= invoiceTotal(record) ? null : `Payments received (${formatCents(toCents(num(record, 'paid')))}) are less than the total (${formatCents(invoiceTotal(record))}).`) },
  ],
};

const documentWorkflow: WorkflowDef = {
  initial: 'drafting',
  states: [
    { key: 'drafting', label: 'Drafting', tone: 'dark' },
    { key: 'review', label: 'Partner review', tone: 'amber' },
    { key: 'signed', label: 'Signed', tone: 'green' },
    { key: 'filed', label: 'Filed (simulated)', tone: 'accent', terminal: true },
  ],
  transitions: [
    { from: 'drafting', to: 'review', label: 'Send for partner review', permission: 'time.record', intent: 'primary',
      guard: ({ record }) => (str(record, 'version') ? null : 'Record the version number first.') },
    { from: 'review', to: 'drafting', label: 'Return for changes', permission: 'documents.approve', requiresNote: true },
    { from: 'review', to: 'signed', label: 'Approve & sign', permission: 'documents.approve', intent: 'primary' },
    { from: 'signed', to: 'filed', label: 'Mark filed (simulated)', permission: 'diary',
      guard: ({ record }) => {
        if (!COURT_DOC_TYPES.includes(str(record, 'docType'))) return 'Only pleadings, notices and affidavits are filed at court.';
        if (!str(record, 'filedOn')) return 'Enter the filing date first (Edit → Filed on).';
        return null;
      } },
  ],
};

/* ------------------------------------------------------------------ */
const phoneRule = (v: unknown) => (/^0\d{2} 555 \d{4}$/.test(String(v)) ? null : 'Use a fictional number in the format 0xx 555 xxxx.');
const emailRule = (v: unknown) => (/^[^@\s]+@example\.com$/.test(String(v)) ? null : 'Use a fictional @example.com address.');

const collections: CollectionDef[] = [
  {
    key: 'matters', singular: 'Matter', plural: 'Matters', refPrefix: 'MAT', workflow: matterWorkflow, editPermission: 'matters.manage',
    title: (r) => str(r, 'name'),
    subtitle: (r, d) => `${clientName(d, r.values.client)} · ${label(MATTER_TYPES, str(r, 'type'))} · ${earner(str(r, 'feeEarner'))?.short ?? '—'}`,
    sort: (a, b) => b.ref.localeCompare(a.ref),
    createFields: ['name', 'client', 'type', 'opposingParty', 'otherParties', 'feeEarner', 'feeBasis', 'estimate', 'privilegedNotes'],
    flags: (r, d) => {
      const out: Array<{ tone: 'red' | 'amber' | 'dark' | 'accent'; label: string }> = [];
      if (r.status === 'conflict' && conflictStatus(d, r.id) !== 'cleared') out.push({ tone: 'amber', label: 'Awaiting conflict clearance' });
      if (['active', 'closing'].includes(r.status ?? '')) {
        const bal = trustBalance(d, r.id);
        if (bal > 0) out.push({ tone: 'accent', label: `Trust ${formatCents(bal)}` });
        const est = toCents(num(r, 'estimate'));
        const m = matterMoney(d, r.id);
        if (est > 0 && m.recorded > est) out.push({ tone: 'red', label: 'Over fee estimate' });
        else if (est > 0 && m.recorded > est * 0.8) out.push({ tone: 'amber', label: '80% of estimate used' });
      }
      return out;
    },
    fields: [
      { key: 'name', label: 'Matter description', type: 'text', required: true, wide: true, placeholder: 'e.g. Client v Opponent — nature of claim' },
      { key: 'client', label: 'Client', type: 'ref', ref: 'clients', required: true },
      { key: 'type', label: 'Matter type', type: 'select', options: MATTER_TYPES, required: true, table: true },
      { key: 'opposingParty', label: 'Opposing party', type: 'text', hint: 'Included in conflict searches.' },
      { key: 'otherParties', label: 'Other parties', type: 'text', hint: 'Separate names with ; — included in conflict searches.' },
      { key: 'feeEarner', label: 'Responsible fee earner', type: 'select', options: FEE_EARNER_OPTIONS, required: true, table: true },
      { key: 'feeBasis', label: 'Fee basis', type: 'select', options: FEE_BASIS, required: true },
      { key: 'estimate', label: 'Fee estimate (excl. VAT)', type: 'money', min: 0, table: true },
      { key: 'caseNo', label: 'Case number (fictional)', type: 'text', placeholder: 'DEMO-1234/2026', validate: (v) => (/^DEMO-/.test(String(v)) ? null : 'Case numbers in this demo must start with DEMO- so they cannot be mistaken for real ones.') },
      { key: 'court', label: 'Court / forum', type: 'text' },
      { key: 'opened', label: 'Opened', type: 'date' },
      { key: 'engagementSigned', label: 'Engagement letter signed', type: 'boolean' },
      { key: 'ficaVerified', label: 'FICA verified for this matter (simulated)', type: 'boolean' },
      { key: 'privilegedNotes', label: 'Privileged notes', type: 'textarea', permission: 'privileged.view', hint: 'Visible only to roles holding privileged.view (simulated restriction).' },
    ],
  },
  {
    key: 'conflicts', singular: 'Conflict check', plural: 'Conflict checks', refPrefix: 'CC', workflow: conflictWorkflow, editPermission: 'intake',
    title: (r, d) => matterName(d, r.values.matter),
    subtitle: (r) => `Searched “${str(r, 'searchTerms')}” · ${label(CONFLICT_OUTCOMES, str(r, 'outcome'))}`,
    sort: (a, b) => b.ref.localeCompare(a.ref),
    flags: (r) => (r.status === 'pending' && str(r, 'outcome') === 'potential' ? [{ tone: 'amber', label: 'Potential conflict' }] : []),
    fields: [
      { key: 'matter', label: 'Matter', type: 'ref', ref: 'matters', required: true },
      { key: 'searchTerms', label: 'Names searched', type: 'text', required: true, table: true },
      { key: 'hits', label: 'Hits', type: 'number', min: 0, table: true },
      { key: 'hitSummary', label: 'Hit summary', type: 'textarea' },
      { key: 'outcome', label: 'Outcome', type: 'select', options: CONFLICT_OUTCOMES, required: true, table: true,
        validate: (v, all) => (v === 'potential' && !String(all.note ?? '').trim() ? 'A potential conflict needs a note explaining how it is resolved.' : null) },
      { key: 'note', label: 'Note / resolution', type: 'textarea' },
      { key: 'checkedOn', label: 'Searched on', type: 'date', table: true },
    ],
  },
  {
    key: 'clients', singular: 'Client', plural: 'Clients', refPrefix: 'CL', editPermission: 'intake',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `${label(CLIENT_KINDS, str(r, 'kind'))}${str(r, 'contact') ? ` · ${str(r, 'contact')}` : ''}`,
    sort: (a, b) => str(a, 'name').localeCompare(str(b, 'name')),
    flags: (r, _d, today) => {
      const s = ficaState(r, today);
      if (s === 'missing') return [{ tone: 'red', label: 'FICA outstanding' }];
      if (s === 'expired') return [{ tone: 'red', label: 'FICA expired' }];
      if (s === 'expiring') return [{ tone: 'amber', label: `FICA expires in ${daysBetween(today, str(r, 'ficaExpiry'))} days` }];
      return [];
    },
    fields: [
      { key: 'name', label: 'Client name', type: 'text', required: true },
      { key: 'kind', label: 'Client type', type: 'select', options: CLIENT_KINDS, required: true, table: true },
      { key: 'contact', label: 'Contact person', type: 'text' },
      { key: 'phone', label: 'Phone (fictional)', type: 'text', required: true, table: true, validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', required: true, validate: emailRule },
      { key: 'ficaStatus', label: 'FICA documents', type: 'select', options: FICA_STATUS, required: true, table: true },
      { key: 'ficaExpiry', label: 'FICA review due', type: 'date', table: true },
      { key: 'address', label: 'Address (fictional)', type: 'text', wide: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'time', singular: 'Time entry', plural: 'Time entries', refPrefix: 'TE', workflow: timeWorkflow, editPermission: 'time.record',
    title: (r, d) => matterName(d, r.values.matter),
    subtitle: (r) => `${earner(str(r, 'feeEarner'))?.short ?? '—'} · ${str(r, 'hours')}h · ${formatCents(timeValue(r))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || b.ref.localeCompare(a.ref),
    createFields: ['matter', 'feeEarner', 'date', 'hours', 'rate', 'billable', 'narrative'],
    flags: (r, _d, today) => {
      const out: Array<{ tone: 'amber' | 'dark'; label: string }> = [];
      if (r.values.billable !== true) out.push({ tone: 'dark', label: 'Non-billable' });
      else if (r.status === 'unbilled' && daysBetween(str(r, 'date'), today) > 60) out.push({ tone: 'amber', label: 'Unbilled 60+ days' });
      return out;
    },
    fields: [
      { key: 'matter', label: 'Matter', type: 'ref', ref: 'matters', required: true },
      { key: 'feeEarner', label: 'Fee earner', type: 'select', options: FEE_EARNER_OPTIONS, required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'hours', label: 'Hours', type: 'number', required: true, min: 0.1, max: 12, step: 0.1, table: true, hint: '0.1 h = 6 minutes. Max 12 h per entry.', validate: (v) => hoursProblem(v) },
      { key: 'rate', label: 'Hourly rate (excl. VAT)', type: 'money', required: true, min: 0, table: true },
      { key: 'billable', label: 'Billable', type: 'boolean' },
      { key: 'narrative', label: 'Narrative (appears on the fee note)', type: 'textarea', required: true },
      { key: 'invoice', label: 'Fee note', type: 'ref', ref: 'invoices' },
    ],
  },
  {
    key: 'trust', singular: 'Trust transaction', plural: 'Trust transactions', refPrefix: 'TR', workflow: trustWorkflow, editPermission: 'trust.record',
    title: (r, d) => `${label(TRUST_TYPES, str(r, 'type'))} · ${matterName(d, r.values.matter)}`,
    subtitle: (r) => `${formatDate(str(r, 'date'))} · ${isOutflow(str(r, 'type')) ? '−' : '+'}${formatCents(toCents(num(r, 'amount')))} · ${str(r, 'payee')}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')),
    flags: (r, d) => (r.status === 'captured' && trustApprovalProblems(r, d).length ? [{ tone: 'red', label: 'Cannot be approved' }] : r.status === 'captured' ? [{ tone: 'amber', label: 'Awaiting approval' }] : []),
    fields: [
      { key: 'matter', label: 'Matter', type: 'ref', ref: 'matters', required: true },
      { key: 'type', label: 'Transaction', type: 'select', options: TRUST_TYPES, required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'amount', label: 'Amount', type: 'money', required: true, min: 0.01, table: true },
      { key: 'payee', label: 'Received from / paid to', type: 'text', required: true },
      { key: 'invoice', label: 'Fee note (transfers)', type: 'ref', ref: 'invoices' },
      { key: 'bankRef', label: 'Reference (fictional)', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
    ],
  },
  {
    key: 'diary', singular: 'Diary entry', plural: 'Court diary & deadlines', refPrefix: 'DY', workflow: diaryWorkflow, editPermission: 'diary',
    title: (r) => str(r, 'title'),
    subtitle: (r, d) => `${label(DIARY_TYPES, str(r, 'type'))} · ${formatDate(str(r, 'date'))}${str(r, 'time') ? ` ${str(r, 'time')}` : ''} · ${matterName(d, r.values.matter)}`,
    sort: (a, b) => str(a, 'date').localeCompare(str(b, 'date')),
    flags: (r, _d, today) => {
      if (r.status !== 'upcoming') return [];
      const diff = daysBetween(today, str(r, 'date'));
      const presc = str(r, 'type') === 'prescription';
      if (diff < 0) return [{ tone: 'red', label: presc ? 'PRESCRIPTION DATE PASSED' : `Overdue ${-diff} day${diff === -1 ? '' : 's'}` }];
      if (presc && diff <= 30) return [{ tone: 'red', label: `PRESCRIBES IN ${diff} DAY${diff === 1 ? '' : 'S'}` }];
      if (diff <= 7) return [{ tone: 'amber', label: diff === 0 ? 'Today' : `Due in ${diff} day${diff === 1 ? '' : 's'}` }];
      if (presc) return [{ tone: 'accent', label: 'Prescription date' }];
      return [];
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, wide: true },
      { key: 'matter', label: 'Matter', type: 'ref', ref: 'matters', required: true },
      { key: 'type', label: 'Type', type: 'select', options: DIARY_TYPES, required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'time', label: 'Time', type: 'time' },
      { key: 'venue', label: 'Court / venue / action', type: 'text' },
      { key: 'feeEarner', label: 'Responsible', type: 'select', options: FEE_EARNER_OPTIONS, required: true, table: true },
      { key: 'newDate', label: 'New date (when postponing)', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'invoices', singular: 'Fee note', plural: 'Fee notes', refPrefix: 'FN', workflow: invoiceWorkflow, editPermission: 'billing',
    title: (r, d) => clientName(d, findRecord(d, 'matters', str(r, 'matter'))?.values.client),
    subtitle: (r, d) => `${matterName(d, r.values.matter)} · ${formatDate(str(r, 'date'))} · ${formatCents(invoiceTotal(r))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || b.ref.localeCompare(a.ref),
    flags: (r, _d, today) => {
      if (!['issued', 'partpaid'].includes(r.status ?? '') || !str(r, 'dueDate')) return [];
      const diff = daysBetween(str(r, 'dueDate'), today);
      return diff > 0 ? [{ tone: 'red', label: `Overdue ${diff} days · ${formatCents(invoiceOutstanding(r))}` }] : [];
    },
    fields: [
      { key: 'matter', label: 'Matter', type: 'ref', ref: 'matters', required: true },
      { key: 'date', label: 'Fee note date', type: 'date', required: true, table: true },
      { key: 'dueDate', label: 'Due', type: 'date', required: true, table: true },
      { key: 'paid', label: 'Payments received (incl. VAT)', type: 'money', min: 0, table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'lines', label: 'Fee lines (hours × rate, excl. VAT)', type: 'lines', wide: true },
    ],
  },
  {
    key: 'documents', singular: 'Document', plural: 'Documents register', refPrefix: 'DOC', workflow: documentWorkflow, editPermission: 'time.record',
    title: (r) => str(r, 'title'),
    subtitle: (r, d) => `${label(DOC_TYPES, str(r, 'docType'))} · ${str(r, 'version')} · ${matterName(d, r.values.matter)}`,
    fields: [
      { key: 'title', label: 'Document', type: 'text', required: true, wide: true },
      { key: 'matter', label: 'Matter', type: 'ref', ref: 'matters', required: true },
      { key: 'docType', label: 'Type', type: 'select', options: DOC_TYPES, required: true, table: true },
      { key: 'version', label: 'Version', type: 'text', required: true, table: true, placeholder: 'v1', validate: (v) => (/^v\d+(\.\d+)?$/.test(String(v)) ? null : 'Use v1, v2, v2.1 …') },
      { key: 'author', label: 'Author', type: 'select', options: FEE_EARNER_OPTIONS, required: true, table: true },
      { key: 'filedOn', label: 'Filed on (simulated)', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
];

const config: IndustryConfig = {
  id: 'legal',
  industry: 'Law firm',
  businessName: 'Mahlaba & Rossouw Attorneys',
  monogram: 'MR',
  workspaceTag: 'PRACTICE WORKSPACE',
  tagline: 'Matter, time and trust management for a small practice',
  summary: 'A small general practice: matter intake with conflict checks and engagement controls, time recording that becomes fee notes, a simulated trust ledger that can never go negative, the court diary with prescription dates, and a documents register.',
  priority: 5,
  theme: { accent: '#4a4f8c', accent2: '#5a5fa0', accentSoft: '#b3b7e3', accentTint: '#ecedf6', accentLine: '#d6d8ee', accentText: '#383c70' },
  roles: [
    { key: 'partner', label: 'Managing partner' },
    { key: 'associate', label: 'Associate attorney' },
    { key: 'candidate', label: 'Candidate attorney' },
    { key: 'secretary', label: 'Legal secretary / paralegal' },
    { key: 'bookkeeper', label: 'Bookkeeper' },
  ],
  permissions: [
    { key: 'matters.manage', label: 'Manage matters', description: 'Open, progress, reopen and close matters; edit matter details' },
    { key: 'intake', label: 'Client intake', description: 'Add clients, update FICA status and record conflict searches' },
    { key: 'conflicts.clear', label: 'Clear conflicts', description: 'Clear a conflict check or confirm a conflict' },
    { key: 'privileged.view', label: 'View privileged notes', description: 'See privileged matter notes (simulated restriction)' },
    { key: 'time.record', label: 'Record time', description: 'Record time entries and draft documents' },
    { key: 'diary', label: 'Court diary', description: 'Manage court dates, filing deadlines and prescription dates' },
    { key: 'trust.record', label: 'Capture trust', description: 'Capture trust deposits, payments and transfers (simulated)' },
    { key: 'trust.approve', label: 'Approve trust', description: 'Approve or reject captured trust payments and transfers' },
    { key: 'billing', label: 'Billing', description: 'Issue fee notes from time, record payments and write off time' },
    { key: 'documents.approve', label: 'Partner review', description: 'Approve and sign documents, or return them for changes' },
  ],
  modules: [
    { key: 'matters', label: 'Matters', icon: IcoScale, group: 'Matters', collection: 'matters', detail: MatterDetail, description: 'Every matter from intake, conflict check and engagement to closure. Closing needs a nil trust balance and no unbilled time.' },
    { key: 'conflicts', label: 'Conflict checks', icon: IcoShield, group: 'Matters', collection: 'conflicts', page: ConflictChecks, description: 'Search names across clients, opposing and other parties; record the outcome; a partner clears it before engagement.' },
    { key: 'clients', label: 'Clients', icon: IcoUsers, group: 'Matters', collection: 'clients', detail: ClientDetail, description: 'Individuals and companies with FICA document status and review dates (simulated — no verification is performed).' },
    { key: 'documents', label: 'Documents register', icon: IcoDoc, group: 'Matters', collection: 'documents', description: 'Drafts, partner review, signature and (simulated) filing, with version numbers.' },
    { key: 'time', label: 'Time & fees', icon: IcoTimer, group: 'Time & money', collection: 'time', description: 'Time entries in six-minute units with narratives and rates. Unbilled billable time is work in progress (WIP).' },
    { key: 'trust', label: 'Trust ledger', icon: IcoWallet, group: 'Time & money', collection: 'trust', page: TrustLedger, detail: TrustDetail, description: 'Simulated per-matter trust ledger: deposits, payments and fee transfers, approved by a partner. Not a compliant trust accounting system.' },
    { key: 'invoices', label: 'Fee notes', icon: IcoReceipt, group: 'Time & money', collection: 'invoices', detail: InvoiceDetail, description: 'Fee notes built from unbilled time, VAT at 15%, payments and overdue tracking.' },
    { key: 'diary', label: 'Court diary & deadlines', icon: IcoCalendar, group: 'Practice', collection: 'diary', page: Diary, description: 'Court dates, filing deadlines, prescription dates and client meetings with overdue and seven-day warnings.' },
    { key: 'reports', label: 'Practice reports', icon: IcoChart, group: 'Practice', page: Reports, description: 'WIP by fee earner, utilisation against a 6-hour target, realisation, matter mix and upcoming deadlines.' },
  ],
  collections,
  seed: buildLegalSeed,
  dashboard: Dashboard,
  boundaries: [
    'Not a trust accounting system: the trust ledger is a simulation. It is not Legal Practice Act or Legal Practice Council compliant, has no bank integration, reconciliation, interest or audit trail of record.',
    'No court e-filing, Deeds Office or Master’s Office integration — “filed” and “lodged” statuses are labels only. Case numbers are fictional (DEMO-…).',
    'No FICA / KYC verification is performed; FICA flags are data-entry fields.',
    'Conflict searches only cover the fictional records in this browser.',
    'The privileged-notes restriction is simulated in the browser and is not access control.',
    'Nothing here is legal advice; prescription dates and rules shown are illustrative.',
  ],
  highlights: [
    'Matter intake → conflict check → engagement → active → closing, with real guards',
    'Conflict search across clients, opposing and other parties',
    'Time in six-minute units becomes VAT fee notes in one click',
    'Simulated trust ledger that refuses to go negative, with partner approval',
  ],
};

export default config;
