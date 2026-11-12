// Shopping-centre management demo. Fictional business: a South African regional shopping centre
// of about 66 shops run by an on-site centre management team for the landlord.
import type { CollectionDef, EffectContext, Flag, IndustryConfig, WorkflowDef } from '../../core/types';
import { lines, num, str } from '../../core/engine';
import { addDays, daysBetween, formatDate } from '../../core/lib/dates';
import {
  IcoAlert, IcoBriefcase, IcoCalendar, IcoChart, IcoFlag, IcoGrid, IcoHelmet, IcoKey, IcoPermit, IcoReceipt, IcoTimer, IcoTool, IcoUsers, IcoWallet, IcoWrench,
} from '../../core/components/Icons';
import {
  APPROVAL_GLA, BILLED_LEASE, BOOKING_TYPES, CAMPAIGN_KINDS, CATEGORIES, CREDIT_CHECK, DEPOSIT_TYPES, INCIDENT_TYPES, LEASE_STATES, LEVELS, PERMIT_TYPES, PERMIT_WINDOWS, PRIORITIES,
  PROSPECT_SOURCES, RENT_TO_SALES_RISK, RESPONSIBILITY, SPACES, UNIT_STATES, WO_CATEGORIES, WO_SOURCES, label,
} from './data';
import { buildMallSeed } from './seed';
import {
  activeLease, addMonths, arrangementProblem, assessProblem, assignProblem, atRisk, bookingClash, bookingConfirmProblem, bookingFigures, caseArrears, declarationDue, declarationOverdue,
  demandProblem, doubleLetProblem, expectedUnitState, fitoutOf, glaOf, hotProblems, incidentCloseProblem, inductionProblems, invoiceTotals, leaseArrears, leaseFlags, leaseOf, leaseTitle, leaseUnit,
  marketingFund, monthlyBaseRent, needsReview, overdueDays, paymentProblem, periodLabel, periodOf, periodStart, permitActivateProblem, permitExpired, permitProblems, permitTypeLabel, prevPeriod,
  previousReading, rand, randOf, readingProblem, renewProblem, rentToSales, shopLabel, signProblems, spaceLabel, tenantName, todayStr, tradingLease, tradingProblems, turnoverRent, unitOf,
  usageChange, workOrderFlags,
} from './helpers';
export * from './helpers';
import Dashboard from './pages/Dashboard';
import Units from './pages/Units';
import UnitDetail from './pages/UnitDetail';
import LeaseDetail from './pages/LeaseDetail';
import Pipeline from './pages/Pipeline';
import ProspectDetail from './pages/ProspectDetail';
import Billing from './pages/Billing';
import InvoiceDetail from './pages/InvoiceDetail';
import Arrears from './pages/Arrears';
import CaseDetail from './pages/CaseDetail';
import Turnover from './pages/Turnover';
import TurnoverDetail from './pages/TurnoverDetail';
import Meters from './pages/Meters';
import ReadingDetail from './pages/ReadingDetail';
import WorkOrderDetail from './pages/WorkOrderDetail';
import FitoutDetail from './pages/FitoutDetail';
import PermitDetail from './pages/PermitDetail';
import Operations from './pages/Operations';
import IncidentDetail from './pages/IncidentDetail';
import Bookings from './pages/Bookings';
import BookingDetail from './pages/BookingDetail';
import Marketing from './pages/Marketing';
import CampaignDetail from './pages/CampaignDetail';
import Reports from './pages/Reports';

const phoneRule = (v: unknown) => (/^0\d{2} \d{3} \d{4}$/.test(String(v)) ? null : 'Use the format 0xx xxx xxxx.');
const emailRule = (v: unknown) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : 'Enter a valid email address.');
const periodRule = (v: unknown) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v)) ? null : 'Use the form YYYY-MM.');
const byShop = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Sensible starting terms for a new lease application: fit-out time, then a five-year term. */
export function defaultLeaseTerms(today: string) {
  const start = periodStart(addMonths(periodOf(today), 2));
  return { startDate: start, endDate: addDays(periodStart(addMonths(periodOf(start), 60)), -1), escalationPct: 7, opsRate: 62, mktRate: 8, turnoverPct: 0, creditCheck: 'pending', tradingHours: 'Centre trading hours: Mon–Sat 09:00–19:00, Sun and public holidays 09:00–17:00.' };
}

/* ------------------------------------------------------------------ */
/** A unit's status follows the lease that holds it: moved by the lease's own steps, never by hand. */
function syncUnit({ record, data, api, today }: EffectContext) {
  const unit = unitOf(data, str(record, 'unit'));
  if (!unit) return;
  const to = expectedUnitState(data, unit.id);
  if (unit.status === to) return;
  const res = api.transition('units', unit.id, to);
  if (!res.ok) return;
  if (to === 'vacant' && (unit.status === 'let' || unit.status === 'fitout' || !str(unit, 'vacantSince'))) api.update('units', unit.id, { vacantSince: today });
  if (to === 'let' && str(record, 'category')) api.update('units', unit.id, { category: str(record, 'category'), vacantSince: '' });
}

const followsLease = (to: string) => ({ record, data }: { record: { id: string }; data: Parameters<typeof expectedUnitState>[0] }) =>
  (expectedUnitState(data, record.id) === to ? null : 'A unit’s status follows its lease — move the lease under Leases (heads of terms, fit-out, trading, vacated) and the unit changes with it.');

const unitWorkflow: WorkflowDef = {
  initial: 'vacant',
  states: [
    { key: 'vacant', label: UNIT_STATES.vacant, tone: 'red' },
    { key: 'offer', label: UNIT_STATES.offer, tone: 'amber' },
    { key: 'fitout', label: UNIT_STATES.fitout, tone: 'blue' },
    { key: 'let', label: UNIT_STATES.let, tone: 'green' },
  ],
  transitions: ['vacant', 'offer', 'fitout', 'let'].map((to) => ({
    from: ['vacant', 'offer', 'fitout', 'let'].filter((s) => s !== to), to, label: `Mark ${UNIT_STATES[to].toLowerCase()}`, guard: followsLease(to),
  })),
};

/* ------------------------------------------------------------------ */
const leaseWorkflow: WorkflowDef = {
  initial: 'application',
  states: [
    { key: 'application', label: LEASE_STATES.application, tone: 'dark' },
    { key: 'hot', label: LEASE_STATES.hot, tone: 'amber' },
    { key: 'signed', label: LEASE_STATES.signed, tone: 'accent' },
    { key: 'fitout', label: LEASE_STATES.fitout, tone: 'blue' },
    { key: 'trading', label: LEASE_STATES.trading, tone: 'green' },
    { key: 'renewal', label: LEASE_STATES.renewal, tone: 'amber' },
    { key: 'notice', label: LEASE_STATES.notice, tone: 'red' },
    { key: 'vacated', label: LEASE_STATES.vacated, tone: 'dark', terminal: true },
    { key: 'declined', label: LEASE_STATES.declined, tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'application', to: 'hot', label: 'Agree heads of terms', permission: 'leases.manage', intent: 'primary',
      guard: ({ record, data }) => hotProblems(data, record)[0] ?? null,
      after: (ctx) => { syncUnit(ctx); ctx.api.toast(`${shopLabel(leaseUnit(ctx.data, ctx.record))} is now under offer to ${str(ctx.record, 'tenant')}`); } },
    { from: 'hot', to: 'signed', label: 'Lease signed', permission: 'leases.manage', intent: 'primary',
      guard: ({ record, data }) => doubleLetProblem(data, record) ?? signProblems(record)[0] ?? null,
      after: ({ record, api, today }) => api.update('leases', record.id, { signedOn: today }) },
    { from: 'signed', to: 'fitout', label: 'Hand over for fit-out', permission: 'leases.manage', intent: 'primary',
      after: (ctx) => {
        const { record, data, api, today } = ctx;
        syncUnit(ctx);
        if (fitoutOf(data, record.id)) return;
        const fit = api.create('fitouts', { lease: record.id, startDate: today, targetDate: str(record, 'startDate') > today ? str(record, 'startDate') : addDays(today, 42), scope: 'Shopfront, internal partitions, electrical, signage and merchandising — per the tenant’s approved drawings.' }, 'submitted', `Opened when ${record.ref} was handed over`);
        api.toast(`Fit-out project ${fit.ref} opened — it must be signed off before the shop can trade`, 'info');
      } },
    { from: 'fitout', to: 'trading', label: 'Start trading', permission: 'leases.manage', intent: 'primary',
      guard: ({ record, data }) => tradingProblems(data, record, todayStr())[0] ?? null,
      after: (ctx) => {
        const { record, data, api, today } = ctx;
        api.update('leases', record.id, { tradingSince: today });
        syncUnit(ctx);
        api.toast(`${str(record, 'tenant')} is trading — ${shopLabel(leaseUnit(data, record))} now shows as let and joins the next month-end run`);
      } },
    { from: 'trading', to: 'renewal', label: 'Open renewal negotiation', permission: 'leases.manage' },
    { from: 'renewal', to: 'trading', label: 'Renew lease', permission: 'leases.manage', intent: 'primary',
      guard: ({ record }) => renewProblem(record),
      after: ({ record, api }) => {
        const rent = num(record, 'renewRent') > 0 ? num(record, 'renewRent') : num(record, 'baseRent');
        api.update('leases', record.id, { endDate: str(record, 'renewEnd'), baseRent: rent, renewEnd: '', renewRent: '' }, `Renewed to ${formatDate(str(record, 'renewEnd'))} at ${randOf(rent)} per m²`);
        api.toast(`${record.ref} renewed to ${formatDate(str(record, 'renewEnd'))}`);
      } },
    { from: ['trading', 'renewal'], to: 'notice', label: 'Record notice', permission: 'leases.manage', requiresNote: true, intent: 'danger', noteHint: 'who gave notice, the last trading day and why',
      after: ({ record, api, today }) => api.update('leases', record.id, { noticeDate: today }) },
    { from: 'notice', to: 'vacated', label: 'Tenant vacated', permission: 'leases.manage', requiresNote: true, noteHint: 'keys returned, condition of the unit and how the deposit will be settled',
      after: (ctx) => { ctx.api.update('leases', ctx.record.id, { vacatedOn: ctx.today }); syncUnit(ctx); ctx.api.toast(`${shopLabel(leaseUnit(ctx.data, ctx.record))} is vacant again and back on the vacancy list`, 'info'); } },
    { from: ['application', 'hot', 'signed'], to: 'declined', label: 'Decline / withdraw', permission: 'leases.manage', requiresNote: true, intent: 'danger', noteHint: 'why the application is declined or withdrawn',
      after: syncUnit },
  ],
};

/* ------------------------------------------------------------------ */
const prospectWorkflow: WorkflowDef = {
  initial: 'enquiry',
  states: [
    { key: 'enquiry', label: 'Enquiry', tone: 'dark' },
    { key: 'viewing', label: 'Viewing held', tone: 'blue' },
    { key: 'proposal', label: 'Proposal sent', tone: 'amber' },
    { key: 'converted', label: 'Application taken', tone: 'green', terminal: true },
    { key: 'lost', label: 'Lost', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'enquiry', to: 'viewing', label: 'Viewing held', permission: 'leases.manage',
      guard: ({ record, data }) => (unitOf(data, str(record, 'unit')) ? null : 'Choose the unit they are interested in under “Unit of interest” first.') },
    { from: 'viewing', to: 'proposal', label: 'Send proposal (simulated)', permission: 'leases.manage', intent: 'primary',
      guard: ({ record, data }) => (unitOf(data, str(record, 'unit')) ? null : 'Choose the unit they are interested in under “Unit of interest” first.') },
    { from: ['viewing', 'proposal'], to: 'converted', label: 'Take lease application', permission: 'leases.manage', intent: 'primary',
      guard: ({ record, data }) => {
        const unit = unitOf(data, str(record, 'unit'));
        if (!unit) return 'Choose the unit they are interested in under “Unit of interest” first.';
        const held = activeLease(data, unit.id);
        return held ? `${shopLabel(unit)} is no longer available — ${str(held, 'tenant')} holds it (${held.ref}). Choose another unit under “Unit of interest”.` : null;
      },
      after: ({ record, data, api, today }) => {
        const unit = unitOf(data, str(record, 'unit'))!;
        const lease = api.create('leases', {
          ...defaultLeaseTerms(today), unit: unit.id, tenant: str(record, 'name'), contact: str(record, 'contact'), phone: str(record, 'phone'), email: str(record, 'email'),
          category: str(record, 'category') || str(unit, 'category'), baseRent: num(unit, 'askingRent'),
        }, 'application', `Application taken from prospect ${record.ref}`);
        api.update('prospects', record.id, { lease: lease.id });
        api.toast(`Lease application ${lease.ref} opened for ${shopLabel(unit)} — continue under Leases`);
      } },
    { from: ['enquiry', 'viewing', 'proposal'], to: 'lost', label: 'Mark lost', permission: 'leases.manage', requiresNote: true, intent: 'danger', noteHint: 'why the prospect fell away' },
  ],
};

/* ------------------------------------------------------------------ */
const invoiceWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'issued', label: 'Issued', tone: 'blue' },
    { key: 'partpaid', label: 'Part paid', tone: 'amber' },
    { key: 'paid', label: 'Paid', tone: 'green', terminal: true },
    { key: 'void', label: 'Void', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'draft', to: 'issued', label: 'Issue invoice (simulated)', permission: 'billing', intent: 'primary',
      guard: ({ record }) => {
        if (!lines(record).length) return 'Add at least one charge under “Add a charge” first.';
        if (invoiceTotals(record).total <= 0) return 'The invoice total must be above zero.';
        if (str(record, 'dueDate') < str(record, 'date')) return 'The due date cannot be before the invoice date.';
        return null;
      } },
    { from: ['issued', 'partpaid'], to: 'partpaid', label: 'Record part payment', permission: 'billing',
      guard: ({ record }) => paymentProblem(record, num(record, 'receipt'))
        ?? (Math.round(num(record, 'receipt') * 100) === invoiceTotals(record).balance ? 'That amount settles the invoice — it is recorded as payment in full.' : null),
      after: ({ record, api, today }) => {
        const paid = Math.round((num(record, 'paid') + num(record, 'receipt')) * 100) / 100;
        api.update('invoices', record.id, { paid, paidOn: today, receipt: 0 }, `Part payment of ${randOf(num(record, 'receipt'))} received (typed in — no bank feed)`);
        api.toast(`${record.ref}: ${randOf(num(record, 'receipt'))} received — ${rand(invoiceTotals({ ...record, values: { ...record.values, paid } }).balance)} still owed`);
      } },
    { from: ['issued', 'partpaid'], to: 'paid', label: 'Record payment in full', permission: 'billing', intent: 'primary',
      guard: ({ record }) => {
        const { balance } = invoiceTotals(record);
        const cents = Math.round(num(record, 'receipt') * 100);
        if (cents === 0 || cents === balance) return null;
        return paymentProblem(record, num(record, 'receipt')) ?? `${randOf(num(record, 'receipt'))} is less than the balance of ${rand(balance)} — it is recorded as a part payment.`;
      },
      after: ({ record, api, today }) => {
        const t = invoiceTotals(record);
        api.update('invoices', record.id, { paid: t.total / 100, paidOn: today, receipt: 0 }, `Payment of ${rand(t.balance)} received — invoice settled (typed in — no bank feed)`);
        api.toast(`${record.ref} settled — ${rand(t.balance)} received`);
      } },
    { from: ['draft', 'issued'], to: 'void', label: 'Void invoice', permission: 'billing', requiresNote: true, noteHint: 'why the invoice is void', intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const caseWorkflow: WorkflowDef = {
  initial: 'open',
  states: [
    { key: 'open', label: 'New arrears', tone: 'red' },
    { key: 'reminded', label: 'Reminder logged', tone: 'amber' },
    { key: 'demand', label: 'Letter of demand', tone: 'amber' },
    { key: 'arrangement', label: 'Payment arrangement', tone: 'blue' },
    { key: 'handedover', label: 'Handed over', tone: 'dark', terminal: true },
    { key: 'settled', label: 'Settled', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'open', to: 'reminded', label: 'Log reminder (nothing is sent)', permission: 'credit.control', intent: 'primary',
      guard: ({ record, data }) => (caseArrears(data, record, todayStr()).overdue > 0 ? null : 'This tenant has no overdue balance — mark the case settled instead.'),
      after: ({ record, api, today }) => api.update('cases', record.id, { reminderOn: today }) },
    { from: 'reminded', to: 'demand', label: 'Log letter of demand', permission: 'credit.control', intent: 'primary',
      guard: ({ record, data }) => demandProblem(data, record, todayStr()),
      after: ({ record, api, today }) => api.update('cases', record.id, { demandOn: today }) },
    { from: ['reminded', 'demand'], to: 'arrangement', label: 'Record payment arrangement', permission: 'credit.control',
      guard: ({ record }) => arrangementProblem(record, todayStr()) },
    { from: ['demand', 'arrangement'], to: 'handedover', label: 'Hand over to attorneys', permission: 'credit.control', requiresNote: true, intent: 'danger', noteHint: 'which attorneys, the amount handed over and the landlord’s instruction' },
    { from: ['open', 'reminded', 'demand', 'arrangement'], to: 'settled', label: 'Mark settled', permission: 'credit.control',
      guard: ({ record, data }) => { const a = caseArrears(data, record, todayStr()); return a.overdue > 0 ? `${tenantName(data, record.values.lease)} still owes ${rand(a.overdue)} overdue — record the payments on the invoices listed under “Overdue invoices” first.` : null; } },
  ],
};

/* ------------------------------------------------------------------ */
const turnoverWorkflow: WorkflowDef = {
  initial: 'awaited',
  states: [
    { key: 'awaited', label: 'Awaited', tone: 'amber' },
    { key: 'declared', label: 'Declared', tone: 'blue' },
    { key: 'queried', label: 'Queried', tone: 'red' },
    { key: 'verified', label: 'Verified', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: ['awaited', 'queried'], to: 'declared', label: 'Record declaration', permission: 'billing', intent: 'primary',
      guard: ({ record }) => (num(record, 'amount') > 0 ? null : 'Type the turnover the tenant declared under “Declared turnover” first.'),
      after: ({ record, api, today }) => api.update('turnover', record.id, { declaredOn: today }) },
    { from: 'declared', to: 'verified', label: 'Verify', permission: 'turnover.verify', intent: 'primary',
      after: ({ record, data, api, user }) => {
        api.update('turnover', record.id, { verifiedBy: user.name });
        const lease = leaseOf(data, record.values.lease);
        const tr = turnoverRent(num(record, 'amount'), num(lease, 'turnoverPct'), monthlyBaseRent(data, lease));
        api.toast(tr > 0 ? `Verified — turnover rent of ${randOf(tr)} will be on the next invoice` : 'Verified — below the breakpoint, so no turnover rent is due', 'info');
      } },
    { from: 'declared', to: 'queried', label: 'Query with tenant', permission: 'turnover.verify', requiresNote: true, intent: 'danger', noteHint: 'what looks wrong and what the tenant must send (nothing is sent from this demo)' },
  ],
};

/* ------------------------------------------------------------------ */
const readingWorkflow: WorkflowDef = {
  initial: 'due',
  states: [
    { key: 'due', label: 'Reading due', tone: 'amber' },
    { key: 'captured', label: 'Captured', tone: 'green' },
  ],
  transitions: [
    { from: 'due', to: 'captured', label: 'Capture reading', permission: 'meters', intent: 'primary',
      guard: ({ record, data }) => readingProblem(record.values, previousReading(data, str(record, 'unit'), str(record, 'period')), unitOf(data, str(record, 'unit'))?.values.waterMeter === true),
      after: ({ record, data, api }) => {
        const fresh = { ...record, status: 'captured' };
        const change = usageChange(data, fresh);
        if (needsReview(data, fresh)) api.toast(`Usage is ${change! > 0 ? '+' : ''}${change}% against last month — flagged for review`, 'info');
      } },
    { from: 'captured', to: 'due', label: 'Reopen for correction', permission: 'meters', requiresNote: true, noteHint: 'what was wrong with the reading' },
  ],
};

/* ------------------------------------------------------------------ */
const workOrderWorkflow: WorkflowDef = {
  initial: 'logged',
  states: [
    { key: 'logged', label: 'Logged', tone: 'red' },
    { key: 'assessed', label: 'Assessed', tone: 'amber' },
    { key: 'assigned', label: 'Assigned', tone: 'blue' },
    { key: 'inprogress', label: 'In progress', tone: 'accent' },
    { key: 'completed', label: 'Completed', tone: 'green' },
    { key: 'confirmed', label: 'Tenant confirmed', tone: 'green', terminal: true },
    { key: 'closed', label: 'Closed — tenant to attend', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'logged', to: 'assessed', label: 'Mark assessed', permission: 'maintenance', intent: 'primary', guard: ({ record }) => assessProblem(record) },
    { from: 'assessed', to: 'assigned', label: 'Assign contractor', permission: 'maintenance', intent: 'primary', guard: ({ record }) => assignProblem(record) },
    { from: 'assigned', to: 'inprogress', label: 'Work started', permission: 'maintenance' },
    { from: 'inprogress', to: 'completed', label: 'Work completed', permission: 'maintenance', intent: 'primary',
      after: ({ record, api, today }) => {
        api.update('workorders', record.id, { completedOn: today });
        if (str(record, 'responsibility') === 'tenant' && num(record, 'rechargeAmount') > 0) api.toast(`${randOf(num(record, 'rechargeAmount'))} will be recharged on the tenant’s next invoice`, 'info');
      } },
    { from: 'completed', to: 'confirmed', label: 'Log tenant confirmation', permission: 'maintenance', intent: 'primary' },
    { from: 'completed', to: 'inprogress', label: 'Reopen', permission: 'maintenance', requiresNote: true, intent: 'danger', noteHint: 'what is still not right' },
    { from: ['logged', 'assessed'], to: 'closed', label: 'Close — tenant to attend', permission: 'maintenance', requiresNote: true, noteHint: 'what the tenant was told to fix, and by when',
      guard: ({ record }) => (str(record, 'responsibility') === 'tenant' ? null : 'Only a tenant-responsibility job is closed this way — choose “Tenant” under “Assessment” first.') },
  ],
};

/* ------------------------------------------------------------------ */
const fitoutWorkflow: WorkflowDef = {
  initial: 'submitted',
  states: [
    { key: 'submitted', label: 'Drawings submitted', tone: 'dark' },
    { key: 'approved', label: 'Drawings approved', tone: 'blue' },
    { key: 'inducted', label: 'Contractor inducted', tone: 'accent' },
    { key: 'works', label: 'Works under way', tone: 'amber' },
    { key: 'snag', label: 'Snagging', tone: 'amber' },
    { key: 'signedoff', label: 'Signed off', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'submitted', to: 'approved', label: 'Approve drawings', permission: 'fitout.manage', intent: 'primary' },
    { from: 'approved', to: 'inducted', label: 'Contractor inducted', permission: 'fitout.manage', intent: 'primary',
      guard: ({ record }) => inductionProblems(record, todayStr())[0] ?? null },
    { from: 'inducted', to: 'works', label: 'Start works', permission: 'fitout.manage', intent: 'primary' },
    { from: 'works', to: 'snag', label: 'Works complete — start snagging', permission: 'fitout.manage', intent: 'primary' },
    { from: 'snag', to: 'signedoff', label: 'Sign off fit-out', permission: 'fitout.signoff', intent: 'primary',
      guard: ({ record }) => (record.values.snagsCleared === true ? null : 'Snags are still open — tick “All snags cleared” under “Snag list” once they are done.'),
      after: ({ record, data, api, today }) => {
        api.update('fitouts', record.id, { signedOffOn: today });
        const lease = leaseOf(data, record.values.lease);
        if (lease?.status === 'fitout') api.toast(`Fit-out signed off — ${str(lease, 'tenant')} can start trading once the certificate of occupancy and insurance are on the lease`, 'info');
      } },
    { from: 'snag', to: 'works', label: 'Back to works', permission: 'fitout.manage', requiresNote: true, noteHint: 'what must be redone' },
  ],
};

const permitWorkflow: WorkflowDef = {
  initial: 'requested',
  states: [
    { key: 'requested', label: 'Requested', tone: 'amber' },
    { key: 'approved', label: 'Approved', tone: 'blue' },
    { key: 'active', label: 'Active', tone: 'green' },
    { key: 'closed', label: 'Closed', tone: 'dark', terminal: true },
    { key: 'rejected', label: 'Rejected', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'requested', to: 'approved', label: 'Approve permit', permission: 'permits.issue', intent: 'primary',
      guard: ({ record }) => permitProblems(record)[0] ?? null,
      after: ({ record, api, user }) => api.update('permits', record.id, { approvedBy: user.name }) },
    { from: 'approved', to: 'active', label: 'Make active', permission: 'permits.issue', intent: 'primary',
      guard: ({ record }) => permitProblems(record)[0] ?? permitActivateProblem(record, todayStr()) },
    { from: 'active', to: 'closed', label: 'Close permit', permission: 'permits.issue', intent: 'primary',
      guard: ({ record }) => {
        if (str(record, 'type') === 'sprinkler' && record.values.reinstated !== true) return 'Confirm the sprinklers are reinstated under “Close-out” before closing.';
        if (str(record, 'type') === 'hot' && record.values.fireWatchDone !== true) return 'Confirm the fire watch stayed for 60 minutes after the work under “Close-out” before closing.';
        return null;
      } },
    { from: ['requested', 'approved'], to: 'rejected', label: 'Reject permit', permission: 'permits.issue', requiresNote: true, intent: 'danger', noteHint: 'why the permit is refused' },
  ],
};

/* ------------------------------------------------------------------ */
const incidentWorkflow: WorkflowDef = {
  initial: 'reported',
  states: [
    { key: 'reported', label: 'Reported', tone: 'red' },
    { key: 'responded', label: 'Responded', tone: 'amber' },
    { key: 'investigated', label: 'Investigated', tone: 'blue' },
    { key: 'closed', label: 'Closed', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'reported', to: 'responded', label: 'Log response', permission: 'incidents', intent: 'primary',
      guard: ({ record }) => (str(record, 'responder').trim() && str(record, 'action').trim() ? null : 'Record who responded and what was done under “Response” first.') },
    { from: 'responded', to: 'investigated', label: 'Investigation complete', permission: 'incidents', intent: 'primary',
      guard: ({ record }) => (str(record, 'findings').trim() ? null : 'Write up the findings under “Investigation” first.') },
    { from: 'investigated', to: 'closed', label: 'Close incident', permission: 'incidents', intent: 'primary', guard: ({ record }) => incidentCloseProblem(record) },
  ],
};

/* ------------------------------------------------------------------ */
const bookingWorkflow: WorkflowDef = {
  initial: 'enquiry',
  states: [
    { key: 'enquiry', label: 'Enquiry', tone: 'dark' },
    { key: 'quoted', label: 'Quoted', tone: 'blue' },
    { key: 'confirmed', label: 'Confirmed', tone: 'accent' },
    { key: 'live', label: 'Live', tone: 'green' },
    { key: 'completed', label: 'Completed', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'enquiry', to: 'quoted', label: 'Send quote (simulated)', permission: 'marketing', intent: 'primary',
      guard: ({ record }) => (bookingFigures(record).days <= 0 ? 'Set the booking dates under “Dates & space” first.' : !(num(record, 'dailyRate') > 0) ? 'Set the daily rate under “Quote & deposit” first.' : null) },
    { from: 'quoted', to: 'confirmed', label: 'Confirm booking', permission: 'marketing', intent: 'primary',
      guard: ({ record, data }) => bookingConfirmProblem(data, record) },
    { from: 'confirmed', to: 'live', label: 'Exhibitor set up — go live', permission: 'marketing', intent: 'primary',
      guard: ({ record }) => (str(record, 'startDate') > todayStr() ? `This booking only starts on ${formatDate(str(record, 'startDate'))}.` : null) },
    { from: 'live', to: 'completed', label: 'Booking completed', permission: 'marketing', intent: 'primary' },
    { from: ['enquiry', 'quoted', 'confirmed'], to: 'cancelled', label: 'Cancel booking', permission: 'marketing', requiresNote: true, intent: 'danger', noteHint: 'who cancelled and what happens to the deposit' },
  ],
};

const campaignWorkflow: WorkflowDef = {
  initial: 'planned',
  states: [
    { key: 'planned', label: 'Planned', tone: 'dark' },
    { key: 'approved', label: 'Spend approved', tone: 'blue' },
    { key: 'running', label: 'Running', tone: 'accent' },
    { key: 'done', label: 'Completed', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'planned', to: 'approved', label: 'Approve spend', permission: 'marketing', intent: 'primary',
      guard: ({ record, data }) => {
        if (!(num(record, 'cost') > 0)) return 'Type the cost under “Budget” first.';
        const fund = marketingFund(data);
        return Math.round(num(record, 'cost') * 100) > fund.balance ? `${randOf(num(record, 'cost'))} is more than the ${rand(Math.max(0, fund.balance))} left in the marketing fund — reduce the cost under “Budget”.` : null;
      } },
    { from: 'approved', to: 'running', label: 'Start', permission: 'marketing', intent: 'primary' },
    { from: 'running', to: 'done', label: 'Mark completed', permission: 'marketing', intent: 'primary' },
    { from: ['planned', 'approved'], to: 'cancelled', label: 'Cancel', permission: 'marketing', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const collections: CollectionDef[] = [
  {
    key: 'units', singular: 'Unit', plural: 'Units', refPrefix: 'SH', workflow: unitWorkflow, editPermission: 'leases.manage',
    title: (r) => shopLabel(r),
    subtitle: (r, d) => { const l = activeLease(d, r.id); return l ? str(l, 'tenant') : `Vacant · asking ${randOf(num(r, 'askingRent'))}/m²`; },
    sort: (a, b) => byShop(str(a, 'shop'), str(b, 'shop')),
    createDefaults: (today) => ({ level: 'ground', category: 'fashion', vacantSince: today, waterMeter: false }),
    fields: [
      { key: 'shop', label: 'Shop number', type: 'text', required: true, placeholder: 'G23' },
      { key: 'level', label: 'Level / zone', type: 'select', options: LEVELS, required: true, table: true },
      { key: 'gla', label: 'GLA', type: 'number', min: 1, required: true, unit: 'm²', table: true },
      { key: 'category', label: 'Category / intended use', type: 'select', options: CATEGORIES, required: true, table: true },
      { key: 'askingRent', label: 'Asking rent per m²', type: 'money', min: 0, hint: 'Shown on the vacancy list.' },
      { key: 'waterMeter', label: 'Has a water sub-meter', type: 'boolean' },
      { key: 'vacantSince', label: 'Vacant since', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'leases', singular: 'Lease', plural: 'Leases', refPrefix: 'LS', workflow: leaseWorkflow, editPermission: 'leases.manage',
    title: (r) => str(r, 'tenant'),
    subtitle: (r, d) => `${shopLabel(leaseUnit(d, r))} · ${glaOf(d, r)} m² · ${label(CATEGORIES, str(r, 'category'))}`,
    sort: (a, b) => str(a, 'tenant').localeCompare(str(b, 'tenant')),
    flags: (r, d, today) => leaseFlags(r, d, today),
    createFields: ['unit', 'tenant', 'entity', 'contact', 'phone', 'email', 'category', 'baseRent', 'escalationPct', 'turnoverPct', 'opsRate', 'mktRate', 'startDate', 'endDate'],
    createDefaults: (today) => defaultLeaseTerms(today),
    fields: [
      { key: 'unit', label: 'Unit', type: 'ref', ref: 'units', required: true, refFilter: (u) => u.status === 'vacant' || u.status === 'offer', hint: 'Only vacant units are offered.' },
      { key: 'tenant', label: 'Trading name (fictional)', type: 'text', required: true },
      { key: 'entity', label: 'Legal entity', type: 'text' },
      { key: 'contact', label: 'Contact person', type: 'text' },
      { key: 'phone', label: 'Phone (fictional)', type: 'text', validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'category', label: 'Category', type: 'select', options: CATEGORIES, required: true, table: true },
      { key: 'baseRent', label: 'Base rent per m² per month', type: 'money', min: 0, required: true, table: true },
      { key: 'escalationPct', label: 'Annual escalation', type: 'number', min: 0, max: 20, step: 0.5, unit: '%' },
      { key: 'turnoverPct', label: 'Turnover rent', type: 'number', min: 0, max: 30, step: 0.25, unit: '%', hint: '0 = no turnover clause. Demo formula: turnover × % − base rent, when positive.' },
      { key: 'opsRate', label: 'Operating-cost recovery per m²', type: 'money', min: 0 },
      { key: 'mktRate', label: 'Marketing levy per m²', type: 'money', min: 0 },
      { key: 'startDate', label: 'Lease start', type: 'date', required: true },
      { key: 'endDate', label: 'Lease end', type: 'date', required: true, table: true, validate: (v, values) => (String(v) <= String(values.startDate ?? '') ? 'The lease must end after it starts.' : null) },
      { key: 'tradingHours', label: 'Trading-hours clause', type: 'textarea' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      // Recorded with the controls on the lease page and shown in its own panels.
      { key: 'creditCheck', label: 'Credit check', type: 'select', options: CREDIT_CHECK, hidden: true },
      { key: 'approvedBy', label: 'Letting approved by', type: 'text', hidden: true },
      { key: 'depositType', label: 'Security', type: 'select', options: DEPOSIT_TYPES, hidden: true },
      { key: 'depositAmount', label: 'Deposit / guarantee amount', type: 'money', hidden: true },
      { key: 'depositRef', label: 'Deposit / guarantee reference', type: 'text', hidden: true },
      { key: 'depositReceived', label: 'Security received', type: 'boolean', hidden: true },
      { key: 'fica', label: 'FICA documents verified', type: 'boolean', hidden: true },
      { key: 'cooNumber', label: 'Certificate of occupancy', type: 'text', hidden: true },
      { key: 'insuranceExpiry', label: 'Tenant insurance valid until', type: 'date', hidden: true },
      { key: 'lastEscalated', label: 'Escalation applied for', type: 'date', hidden: true },
      { key: 'signedOn', label: 'Signed on', type: 'date', hidden: true },
      { key: 'tradingSince', label: 'Trading since', type: 'date', hidden: true },
      { key: 'noticeDate', label: 'Notice given', type: 'date', hidden: true },
      { key: 'vacatedOn', label: 'Vacated on', type: 'date', hidden: true },
      { key: 'renewEnd', label: 'Proposed new end date', type: 'date', hidden: true },
      { key: 'renewRent', label: 'Proposed new base rent', type: 'money', hidden: true },
    ],
  },
  {
    key: 'prospects', singular: 'Prospect', plural: 'Prospects', refPrefix: 'PR', workflow: prospectWorkflow, editPermission: 'leases.manage',
    title: (r) => str(r, 'name'),
    subtitle: (r, d) => `${label(CATEGORIES, str(r, 'category'))}${unitOf(d, str(r, 'unit')) ? ` · ${shopLabel(unitOf(d, str(r, 'unit')))}` : ' · no unit chosen'}`,
    flags: (r, d) => {
      const out: Flag[] = [];
      const unit = unitOf(d, str(r, 'unit'));
      if (['enquiry', 'viewing', 'proposal'].includes(r.status ?? '') && unit && activeLease(d, unit.id)) out.push({ tone: 'red', label: `${shopLabel(unit)} no longer available` });
      return out;
    },
    createFields: ['name', 'contact', 'phone', 'email', 'category', 'unit', 'glaWanted', 'source', 'notes'],
    createDefaults: () => ({ source: 'broker', category: 'fashion' }),
    fields: [
      { key: 'name', label: 'Trading name (fictional)', type: 'text', required: true },
      { key: 'contact', label: 'Contact person', type: 'text', required: true, table: true },
      { key: 'phone', label: 'Phone (fictional)', type: 'text', validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'category', label: 'Category', type: 'select', options: CATEGORIES, required: true, table: true },
      { key: 'unit', label: 'Unit of interest', type: 'ref', ref: 'units', refFilter: (u) => u.status === 'vacant', hint: 'Vacant units only.' },
      { key: 'glaWanted', label: 'Space wanted', type: 'number', min: 0, unit: 'm²', table: true },
      { key: 'source', label: 'Source', type: 'select', options: PROSPECT_SOURCES, table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'lease', label: 'Lease application', type: 'ref', ref: 'leases', hidden: true },
    ],
  },
  {
    key: 'invoices', singular: 'Invoice', plural: 'Invoices', refPrefix: 'INV', workflow: invoiceWorkflow, editPermission: 'billing',
    title: (r, d) => tenantName(d, r.values.lease),
    subtitle: (r, d) => `${shopLabel(leaseUnit(d, leaseOf(d, r.values.lease)))} · ${periodLabel(str(r, 'period'))} · ${rand(invoiceTotals(r).total)}`,
    sort: (a, b) => str(b, 'period').localeCompare(str(a, 'period')) || str(b, 'date').localeCompare(str(a, 'date')) || a.ref.localeCompare(b.ref),
    createDefaults: (today) => ({ period: periodOf(today), date: today, dueDate: addDays(today, 7), paid: 0 }),
    createFields: ['lease', 'period', 'date', 'dueDate', 'lines', 'notes'],
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      const days = overdueDays(r, today);
      if (days > 0) out.push({ tone: 'red', label: `Overdue ${days} days` });
      if (r.status === 'draft' && str(r, 'notes')) out.push({ tone: 'amber', label: 'Has billing notes' });
      return out;
    },
    fields: [
      { key: 'lease', label: 'Lease', type: 'ref', ref: 'leases', required: true, refFilter: (l) => BILLED_LEASE.includes(l.status ?? '') },
      { key: 'period', label: 'Month (YYYY-MM)', type: 'text', required: true, validate: periodRule },
      { key: 'date', label: 'Invoice date', type: 'date', required: true, table: true },
      { key: 'dueDate', label: 'Due date', type: 'date', required: true, table: true, validate: (v, values) => (String(v) < String(values.date ?? '') ? 'The due date cannot be before the invoice date.' : null) },
      { key: 'paidOn', label: 'Last payment', type: 'date', table: true, hint: 'Stamped when a payment is recorded.' },
      { key: 'notes', label: 'Billing notes', type: 'textarea', hint: 'Why a line was left off, for example a missing meter reading.' },
      { key: 'lines', label: 'Invoice lines (excl. VAT)', type: 'lines', wide: true },
      { key: 'paid', label: 'Paid so far', type: 'money', hidden: true },
      { key: 'receipt', label: 'Payment being captured', type: 'money', hidden: true },
      { key: 'levy', label: 'Marketing levy in this invoice', type: 'money', hidden: true },
    ],
  },
  {
    key: 'cases', singular: 'Credit-control case', plural: 'Credit-control cases', refPrefix: 'CC', workflow: caseWorkflow, editPermission: 'credit.control',
    title: (r, d) => leaseTitle(d, leaseOf(d, r.values.lease)),
    subtitle: (r, d) => { const a = caseArrears(d, r, todayStr()); return a.overdue > 0 ? `${rand(a.overdue)} overdue · oldest ${a.oldest} days` : 'Nothing overdue'; },
    createFields: ['lease', 'notes'],
    createDefaults: (today) => ({ openedOn: today }),
    flags: (r, d, today) => {
      const out: Flag[] = [];
      if (['handedover', 'settled'].includes(r.status ?? '')) return out;
      const a = caseArrears(d, r, today);
      if (a.d90plus > 0) out.push({ tone: 'red', label: 'Over 90 days' });
      if (a.overdue === 0) out.push({ tone: 'green', label: 'Paid up — settle the case' });
      if (r.status === 'arrangement' && num(r, 'instalment') > 0) out.push({ tone: 'blue', label: `${randOf(num(r, 'instalment'))} a month from ${formatDate(str(r, 'firstPayment'))}` });
      return out;
    },
    fields: [
      { key: 'lease', label: 'Tenant (lease)', type: 'ref', ref: 'leases', required: true, refFilter: (l, _v, d) => leaseArrears(d, l.id, todayStr()).overdue > 0, hint: 'Only tenants with an overdue balance are offered.' },
      { key: 'openedOn', label: 'Opened', type: 'date', table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'reminderOn', label: 'Reminder logged', type: 'date', hidden: true },
      { key: 'demandOn', label: 'Letter of demand logged', type: 'date', hidden: true },
      { key: 'instalment', label: 'Monthly instalment', type: 'money', hidden: true },
      { key: 'firstPayment', label: 'First instalment', type: 'date', hidden: true },
    ],
  },
  {
    key: 'turnover', singular: 'Turnover declaration', plural: 'Turnover declarations', refPrefix: 'TD', workflow: turnoverWorkflow, editPermission: 'billing',
    title: (r, d) => tenantName(d, r.values.lease),
    subtitle: (r, d) => `${shopLabel(leaseUnit(d, leaseOf(d, r.values.lease)))} · ${periodLabel(str(r, 'period'))}`,
    sort: (a, b) => str(b, 'period').localeCompare(str(a, 'period')) || a.ref.localeCompare(b.ref),
    createFields: ['lease', 'period'],
    createDefaults: (today) => ({ period: prevPeriod(periodOf(today)) }),
    flags: (r, d, today) => {
      const out: Flag[] = [];
      if (declarationOverdue(r, today)) out.push({ tone: 'red', label: `Overdue — was due ${formatDate(declarationDue(str(r, 'period')))}` });
      if (r.status === 'awaited' || !(num(r, 'amount') > 0)) return out;
      const lease = leaseOf(d, r.values.lease);
      const base = monthlyBaseRent(d, lease);
      const ratio = rentToSales(base, num(r, 'amount'));
      if (atRisk(ratio)) out.push({ tone: 'red', label: `At risk — rent is ${ratio}% of sales` });
      if (turnoverRent(num(r, 'amount'), num(lease, 'turnoverPct'), base) > 0) out.push({ tone: 'accent', label: 'Above breakpoint' });
      return out;
    },
    fields: [
      { key: 'lease', label: 'Tenant (lease)', type: 'ref', ref: 'leases', required: true, table: false, refFilter: (l) => BILLED_LEASE.includes(l.status ?? '') && num(l, 'turnoverPct') > 0, hint: 'Only trading tenants with a turnover clause.' },
      { key: 'period', label: 'Month (YYYY-MM)', type: 'text', required: true, validate: periodRule },
      { key: 'amount', label: 'Declared turnover (excl. VAT)', type: 'money', min: 0, table: true },
      { key: 'declaredOn', label: 'Declared on', type: 'date', table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'verifiedBy', label: 'Verified by', type: 'text', hidden: true },
    ],
  },
  {
    key: 'readings', singular: 'Meter reading', plural: 'Meter readings', refPrefix: 'MR', workflow: readingWorkflow, editPermission: 'meters',
    title: (r, d) => `${shopLabel(unitOf(d, str(r, 'unit')))} · ${periodLabel(str(r, 'period'))}`,
    subtitle: (r, d) => str(tradingLease(d, str(r, 'unit')), 'tenant') || 'No tenant trading',
    sort: (a, b) => str(b, 'period').localeCompare(str(a, 'period')) || a.ref.localeCompare(b.ref),
    createFields: ['unit', 'period', 'date'],
    createDefaults: (today) => ({ period: prevPeriod(periodOf(today)), date: today }),
    flags: (r, d) => {
      const out: Flag[] = [];
      const change = usageChange(d, r);
      if (needsReview(d, r)) out.push({ tone: 'amber', label: `Usage ${change! > 0 ? '+' : ''}${change}% — review` });
      else if (str(r, 'reviewedBy')) out.push({ tone: 'dark', label: `Reviewed by ${str(r, 'reviewedBy')}` });
      return out;
    },
    fields: [
      { key: 'unit', label: 'Unit', type: 'ref', ref: 'units', required: true },
      { key: 'period', label: 'Month read for (YYYY-MM)', type: 'text', required: true, validate: periodRule },
      { key: 'date', label: 'Read on', type: 'date', table: true },
      { key: 'elec', label: 'Electricity reading', type: 'number', min: 0, unit: 'kWh', table: true },
      { key: 'water', label: 'Water reading', type: 'number', min: 0, unit: 'kL', table: true },
      { key: 'reviewedBy', label: 'Reviewed by', type: 'text', hidden: true },
    ],
  },
  {
    key: 'workorders', singular: 'Work order', plural: 'Work orders', refPrefix: 'WO', workflow: workOrderWorkflow, editPermission: 'maintenance',
    title: (r) => str(r, 'title'),
    subtitle: (r, d) => { const u = unitOf(d, str(r, 'unit')); return u ? `${shopLabel(u)}${activeLease(d, u.id) ? ` · ${str(activeLease(d, u.id), 'tenant')}` : ''}` : str(r, 'area') || 'Common area'; },
    sort: (a, b) => str(b, 'reportedOn').localeCompare(str(a, 'reportedOn')) || b.ref.localeCompare(a.ref),
    flags: (r, _d, today) => workOrderFlags(r, today),
    createFields: ['title', 'unit', 'area', 'category', 'source', 'priority', 'reportedBy', 'description'],
    createDefaults: (today) => ({ reportedOn: today, priority: 'routine', source: 'tenant', category: 'general' }),
    fields: [
      { key: 'title', label: 'What is wrong', type: 'text', required: true, wide: true },
      { key: 'unit', label: 'Unit (leave empty for a common area)', type: 'ref', ref: 'units', table: true },
      { key: 'area', label: 'Common area / exact location', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: WO_CATEGORIES, required: true, table: true },
      { key: 'source', label: 'Source', type: 'select', options: WO_SOURCES, required: true },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, required: true, table: true },
      { key: 'reportedOn', label: 'Reported on', type: 'date', table: true },
      { key: 'reportedBy', label: 'Reported by', type: 'text' },
      { key: 'description', label: 'Details', type: 'textarea' },
      { key: 'responsibility', label: 'Responsibility', type: 'select', options: RESPONSIBILITY, hidden: true },
      { key: 'rechargeAmount', label: 'Recharge to tenant (excl. VAT)', type: 'money', hidden: true },
      { key: 'contractor', label: 'Contractor', type: 'text', hidden: true },
      { key: 'completedOn', label: 'Completed on', type: 'date', hidden: true },
      { key: 'rechargeInvoice', label: 'Recharged on invoice', type: 'text', hidden: true },
    ],
  },
  {
    key: 'fitouts', singular: 'Fit-out', plural: 'Fit-outs', refPrefix: 'FO', workflow: fitoutWorkflow, editPermission: 'fitout.manage',
    title: (r, d) => leaseTitle(d, leaseOf(d, r.values.lease)),
    subtitle: (r) => (str(r, 'contractor') ? `Contractor: ${str(r, 'contractor')}` : 'No contractor named yet'),
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      if (r.status !== 'signedoff' && str(r, 'targetDate') && str(r, 'targetDate') < today) out.push({ tone: 'red', label: `Behind programme — target was ${formatDate(str(r, 'targetDate'))}` });
      if (!['submitted', 'approved', 'signedoff'].includes(r.status ?? '') && str(r, 'insuranceExpiry') && str(r, 'insuranceExpiry') < today) out.push({ tone: 'red', label: 'Contractor insurance expired' });
      return out;
    },
    createFields: ['lease', 'contractor', 'startDate', 'targetDate', 'scope'],
    createDefaults: (today) => ({ startDate: today, targetDate: addDays(today, 42) }),
    fields: [
      { key: 'lease', label: 'Tenant (lease)', type: 'ref', ref: 'leases', required: true, refFilter: (l) => ['signed', 'fitout', 'trading', 'renewal'].includes(l.status ?? '') },
      { key: 'contractor', label: 'Fit-out contractor (fictional)', type: 'text' },
      { key: 'startDate', label: 'Works start', type: 'date', table: true },
      { key: 'targetDate', label: 'Target trading date', type: 'date', table: true },
      { key: 'scope', label: 'Scope of works', type: 'textarea' },
      { key: 'insuranceExpiry', label: 'Contractor public-liability insurance valid until', type: 'date', hidden: true },
      { key: 'inducted', label: 'Site induction done', type: 'boolean', hidden: true },
      { key: 'snags', label: 'Snag list', type: 'textarea', hidden: true },
      { key: 'snagsCleared', label: 'All snags cleared', type: 'boolean', hidden: true },
      { key: 'signedOffOn', label: 'Signed off on', type: 'date', hidden: true },
    ],
  },
  {
    key: 'permits', singular: 'Work permit', plural: 'Work permits', refPrefix: 'WP', workflow: permitWorkflow, editPermission: 'permits.issue',
    title: (r) => `${permitTypeLabel(r)} — ${str(r, 'contractor')}`,
    subtitle: (r, d) => `${unitOf(d, str(r, 'unit')) ? shopLabel(unitOf(d, str(r, 'unit'))) : str(r, 'location') || 'Common area'} · ${formatDate(str(r, 'validFrom'))}${str(r, 'validTo') && str(r, 'validTo') !== str(r, 'validFrom') ? ` – ${formatDate(str(r, 'validTo'))}` : ''}`,
    sort: (a, b) => str(b, 'validFrom').localeCompare(str(a, 'validFrom')) || b.ref.localeCompare(a.ref),
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      if (permitExpired(r, today)) out.push({ tone: 'red', label: 'Expired but still active' });
      if (r.status === 'requested' && permitProblems(r).length) out.push({ tone: 'amber', label: `${permitProblems(r).length} thing${permitProblems(r).length === 1 ? '' : 's'} missing` });
      if (r.status === 'approved' && str(r, 'validFrom') === today) out.push({ tone: 'blue', label: 'Starts today' });
      return out;
    },
    createFields: ['type', 'unit', 'location', 'contractor', 'work', 'window', 'validFrom', 'validTo'],
    createDefaults: (today) => ({ type: 'general', window: 'afterhours', validFrom: today, validTo: today }),
    fields: [
      { key: 'type', label: 'Permit type', type: 'select', options: PERMIT_TYPES, required: true, table: true },
      { key: 'unit', label: 'Unit (leave empty for a common area)', type: 'ref', ref: 'units' },
      { key: 'location', label: 'Exact location', type: 'text' },
      { key: 'contractor', label: 'Contractor (fictional)', type: 'text', required: true },
      { key: 'work', label: 'Work to be done', type: 'textarea' },
      { key: 'window', label: 'When', type: 'select', options: PERMIT_WINDOWS, required: true, table: true },
      { key: 'validFrom', label: 'Valid from', type: 'date', required: true, table: true },
      { key: 'validTo', label: 'Valid to', type: 'date', required: true, table: true, validate: (v, values) => (String(v) < String(values.validFrom ?? '') ? 'The permit cannot end before it starts.' : null) },
      { key: 'insuranceExpiry', label: 'Public-liability insurance valid until', type: 'date', hidden: true },
      { key: 'inducted', label: 'Site induction done', type: 'boolean', hidden: true },
      { key: 'fireWatch', label: 'Fire watch', type: 'text', hidden: true },
      { key: 'reinstateDate', label: 'Sprinklers reinstated by (date)', type: 'date', hidden: true },
      { key: 'reinstateTime', label: 'Sprinklers reinstated by (time)', type: 'time', hidden: true },
      { key: 'reinstated', label: 'Sprinklers reinstated', type: 'boolean', hidden: true },
      { key: 'fireWatchDone', label: 'Fire watch completed', type: 'boolean', hidden: true },
      { key: 'approvedBy', label: 'Approved by', type: 'text', hidden: true },
    ],
  },
  {
    key: 'opslog', singular: 'Daily log', plural: 'Daily logs', refPrefix: 'DL', editPermission: 'ops.log',
    title: (r) => formatDate(str(r, 'date')),
    subtitle: (r) => str(r, 'hoursException') || 'Normal trading hours',
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')),
    createDefaults: (today) => ({ date: today }),
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'footfall', label: 'Footfall', type: 'number', min: 0, table: true, hint: 'Typed from the door counters.' },
      { key: 'parkingIncome', label: 'Parking income', type: 'money', min: 0, table: true },
      { key: 'hoursException', label: 'Trading-hours exception', type: 'text', table: true, placeholder: 'e.g. Late-night trade to 21:00' },
      { key: 'generatorHours', label: 'Generator run', type: 'number', min: 0, step: 0.5, unit: 'h', table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'incidents', singular: 'Incident', plural: 'Incidents', refPrefix: 'IN', workflow: incidentWorkflow, editPermission: 'incidents',
    title: (r) => `${label(INCIDENT_TYPES, str(r, 'type'))} — ${str(r, 'location')}`,
    subtitle: (r) => `${formatDate(str(r, 'date'))} · reported by ${str(r, 'reportedBy') || 'unknown'}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || b.ref.localeCompare(a.ref),
    flags: (r, _d, today) => {
      const out: Flag[] = [];
      if (r.values.injury === true) out.push({ tone: 'red', label: 'Injury' });
      if (r.values.damage === true) out.push({ tone: 'amber', label: 'Damage' });
      if (r.status !== 'closed' && str(r, 'date') && daysBetween(str(r, 'date'), today) > 7) out.push({ tone: 'amber', label: `Open ${daysBetween(str(r, 'date'), today)} days` });
      if (r.status === 'investigated' && incidentCloseProblem(r)) out.push({ tone: 'red', label: 'Insurance reference needed' });
      return out;
    },
    createFields: ['date', 'type', 'location', 'unit', 'description', 'injury', 'damage', 'reportedBy'],
    createDefaults: (today) => ({ date: today, type: 'slip' }),
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'type', label: 'Type', type: 'select', options: INCIDENT_TYPES, required: true, table: true },
      { key: 'location', label: 'Where', type: 'text', required: true },
      { key: 'unit', label: 'Unit involved (optional)', type: 'ref', ref: 'units' },
      { key: 'description', label: 'What happened', type: 'textarea' },
      { key: 'injury', label: 'Someone was injured', type: 'boolean' },
      { key: 'damage', label: 'Property was damaged', type: 'boolean' },
      { key: 'reportedBy', label: 'Reported by', type: 'text', table: true },
      { key: 'responder', label: 'Responder', type: 'text', hidden: true },
      { key: 'action', label: 'Action taken', type: 'textarea', hidden: true },
      { key: 'findings', label: 'Findings', type: 'textarea', hidden: true },
      { key: 'insuranceRef', label: 'Insurance reference', type: 'text', hidden: true },
    ],
  },
  {
    key: 'bookings', singular: 'Booking', plural: 'Exhibition bookings', refPrefix: 'EX', workflow: bookingWorkflow, editPermission: 'marketing',
    title: (r) => str(r, 'exhibitor'),
    subtitle: (r) => `${spaceLabel(r)} · ${formatDate(str(r, 'startDate'))} – ${formatDate(str(r, 'endDate'))}`,
    sort: (a, b) => str(a, 'startDate').localeCompare(str(b, 'startDate')),
    flags: (r, d, today) => {
      const out: Flag[] = [];
      const clash = ['enquiry', 'quoted'].includes(r.status ?? '') ? bookingClash(d, r) : undefined;
      if (clash) out.push({ tone: 'red', label: `Clashes with ${clash.ref}` });
      if (r.status === 'quoted' && r.values.depositPaid !== true) out.push({ tone: 'amber', label: 'Deposit outstanding' });
      if (r.status === 'confirmed' && str(r, 'startDate') <= today) out.push({ tone: 'blue', label: 'Due to set up' });
      if (r.status === 'live' && str(r, 'endDate') < today) out.push({ tone: 'amber', label: 'Past its end date' });
      return out;
    },
    createFields: ['exhibitor', 'contact', 'phone', 'email', 'type', 'space', 'startDate', 'endDate', 'dailyRate', 'depositAmount'],
    createDefaults: (today) => ({ type: 'promotion', startDate: addDays(today, 14), endDate: addDays(today, 16), dailyRate: 1800, depositAmount: 2500 }),
    fields: [
      { key: 'exhibitor', label: 'Exhibitor (fictional)', type: 'text', required: true },
      { key: 'contact', label: 'Contact person', type: 'text' },
      { key: 'phone', label: 'Phone (fictional)', type: 'text', validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'type', label: 'Type', type: 'select', options: BOOKING_TYPES, required: true, table: true },
      { key: 'space', label: 'Space', type: 'select', options: SPACES, required: true, table: true },
      { key: 'startDate', label: 'From', type: 'date', required: true, table: true },
      { key: 'endDate', label: 'To', type: 'date', required: true, table: true, validate: (v, values) => (String(v) < String(values.startDate ?? '') ? 'The end date cannot be before the start date.' : null) },
      { key: 'dailyRate', label: 'Daily rate (excl. VAT)', type: 'money', min: 0 },
      { key: 'depositAmount', label: 'Deposit', type: 'money', min: 0 },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'depositPaid', label: 'Deposit received', type: 'boolean', hidden: true },
    ],
  },
  {
    key: 'campaigns', singular: 'Campaign', plural: 'Campaigns & events', refPrefix: 'MK', workflow: campaignWorkflow, editPermission: 'marketing',
    title: (r) => str(r, 'title'),
    subtitle: (r) => `${label(CAMPAIGN_KINDS, str(r, 'kind'))} · ${formatDate(str(r, 'startDate'))}${str(r, 'endDate') && str(r, 'endDate') !== str(r, 'startDate') ? ` – ${formatDate(str(r, 'endDate'))}` : ''}`,
    sort: (a, b) => str(b, 'startDate').localeCompare(str(a, 'startDate')),
    createFields: ['title', 'kind', 'startDate', 'endDate', 'cost', 'notes'],
    createDefaults: (today) => ({ kind: 'event', startDate: addDays(today, 21), endDate: addDays(today, 21) }),
    fields: [
      { key: 'title', label: 'Campaign or event', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'select', options: CAMPAIGN_KINDS, required: true, table: true },
      { key: 'startDate', label: 'From', type: 'date', required: true, table: true },
      { key: 'endDate', label: 'To', type: 'date' },
      { key: 'cost', label: 'Cost to the marketing fund (excl. VAT)', type: 'money', min: 0, table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
];

const config: IndustryConfig = {
  id: 'mall',
  industry: 'Shopping centre',
  businessName: 'Harbour Crossing Mall',
  monogram: 'HC',
  workspaceTag: 'CENTRE MANAGEMENT',
  tagline: 'Shopping-centre management',
  summary: 'A regional shopping centre run by an on-site management team for the landlord: the stacking plan and unit register, leases from application to trading, the leasing pipeline, the monthly rent roll with turnover rent and metered utilities, arrears and credit control, maintenance, fit-outs and work permits, daily centre operations, and exhibition bookings.',
  priority: 12,
  theme: { accent: '#a8327e', accent2: '#ba4390', accentSoft: '#e6b0d2', accentTint: '#f9ebf4', accentLine: '#f0d1e5', accentText: '#7f2460' },
  roles: [
    { key: 'centre', label: 'Centre manager' },
    { key: 'leasing', label: 'Leasing manager' },
    { key: 'leasingadmin', label: 'Leasing administrator' },
    { key: 'operations', label: 'Operations / facilities manager' },
    { key: 'coordinator', label: 'Tenant coordinator' },
    { key: 'accounts', label: 'Accounts / credit controller' },
    { key: 'marketing', label: 'Marketing manager' },
    { key: 'security', label: 'Security & risk supervisor' },
  ],
  permissions: [
    { key: 'leases.manage', label: 'Manage leases', description: 'Capture prospects and lease terms and move leases through their steps' },
    { key: 'leases.approve', label: 'Approve lettings', description: `Approve lettings above ${APPROVAL_GLA} m² before heads of terms` },
    { key: 'billing', label: 'Billing', description: 'Draft and issue invoices, record payments and capture turnover declarations' },
    { key: 'credit.control', label: 'Credit control', description: 'Open arrears cases, log reminders, letters of demand, arrangements and hand-overs' },
    { key: 'turnover.verify', label: 'Verify turnover', description: 'Verify or query a tenant’s declared turnover' },
    { key: 'meters', label: 'Meter readings', description: 'Capture and review electricity and water sub-meter readings' },
    { key: 'maintenance', label: 'Maintenance', description: 'Log, assess, assign and close work orders' },
    { key: 'fitout.manage', label: 'Run fit-outs', description: 'Approve drawings, record contractor insurance and induction, and manage snags' },
    { key: 'fitout.signoff', label: 'Sign off fit-outs', description: 'Sign a fit-out off so the shop can trade' },
    { key: 'permits.issue', label: 'Issue work permits', description: 'Approve, activate, close and reject contractor work permits' },
    { key: 'ops.log', label: 'Daily log', description: 'Capture footfall, parking income and trading-hours exceptions' },
    { key: 'incidents', label: 'Incidents', description: 'Report, respond to, investigate and close incidents' },
    { key: 'marketing', label: 'Marketing', description: 'Run exhibition bookings, campaigns and the marketing fund' },
  ],
  modules: [
    { key: 'units', label: 'Shops & stacking plan', icon: IcoGrid, group: 'Leasing', collection: 'units', page: Units, detail: UnitDetail, description: 'Every unit by level, coloured by status or category: let, fitting out, under offer or vacant.' },
    { key: 'leases', label: 'Leases', icon: IcoKey, group: 'Leasing', collection: 'leases', detail: LeaseDetail, description: 'Each lease from application to trading, renewal and exit — rent per m², escalation, turnover rent, recoveries and security.' },
    { key: 'pipeline', label: 'Leasing pipeline & vacancies', icon: IcoBriefcase, group: 'Leasing', collection: 'prospects', view: 'board', page: Pipeline, detail: ProspectDetail, description: 'Prospects for vacant units, the vacancy list with months vacant and asking rent, and the tenant mix by GLA.' },
    { key: 'billing', label: 'Monthly billing', icon: IcoReceipt, group: 'Finance', collection: 'invoices', page: Billing, detail: InvoiceDetail, description: 'The rent roll: month-end drafting of base rent, recoveries, metered utilities and turnover rent, then issue and collect.' },
    { key: 'arrears', label: 'Arrears & credit control', icon: IcoWallet, group: 'Finance', collection: 'cases', page: Arrears, detail: CaseDetail, description: 'Arrears ageing per tenant and the steps taken: reminder, letter of demand, payment arrangement, hand-over.' },
    { key: 'turnover', label: 'Turnover declarations', icon: IcoChart, group: 'Finance', collection: 'turnover', page: Turnover, detail: TurnoverDetail, description: `Monthly sales declared by tenants with turnover clauses: trading density, rent-to-sales (at risk above ${RENT_TO_SALES_RISK}%) and turnover rent.` },
    { key: 'reports', label: 'Reports', icon: IcoFlag, group: 'Finance', page: Reports, description: 'Occupancy and vacancy trend, rent roll and collections, arrears ageing, trading density, footfall, lease expiries and tenant mix.' },
    { key: 'meters', label: 'Utilities metering', icon: IcoTimer, group: 'Operations', collection: 'readings', page: Meters, detail: ReadingDetail, description: 'Monthly electricity and water sub-meter readings per shop. Consumption × tariff goes onto the tenant’s invoice.' },
    { key: 'workorders', label: 'Maintenance & work orders', icon: IcoWrench, group: 'Operations', collection: 'workorders', view: 'board', detail: WorkOrderDetail, description: 'Tenant requests and common-area jobs: landlord or tenant responsibility, contractor, completion and recharges.' },
    { key: 'fitouts', label: 'Fit-outs', icon: IcoTool, group: 'Operations', collection: 'fitouts', detail: FitoutDetail, description: 'Tenant fit-out projects from drawings to sign-off. A shop cannot trade until its fit-out is signed off.' },
    { key: 'permits', label: 'Work permits', icon: IcoPermit, group: 'Operations', collection: 'permits', view: 'board', detail: PermitDetail, description: 'Permits for tenant contractors: hot work, heights, sprinkler isolation — insurance, induction and fire watch checked first.' },
    { key: 'ops', label: 'Centre operations log', icon: IcoUsers, group: 'Operations', collection: 'opslog', page: Operations, description: 'The daily log: footfall, parking income, trading-hours exceptions and generator runs — all typed in.' },
    { key: 'incidents', label: 'Incidents', icon: IcoAlert, group: 'Operations', collection: 'incidents', detail: IncidentDetail, description: 'Slip-and-falls, theft, fire alarms, medical calls and outages from report to close-out, with insurance references.' },
    { key: 'bookings', label: 'Exhibitions & promotions', icon: IcoCalendar, group: 'Marketing', collection: 'bookings', page: Bookings, detail: BookingDetail, description: 'Short-term bookings of the promotions courts and kiosk pads. A space cannot be double-booked.' },
    { key: 'marketing', label: 'Marketing fund & events', icon: IcoHelmet, group: 'Marketing', collection: 'campaigns', page: Marketing, detail: CampaignDetail, description: 'Marketing levies billed to tenants against campaign spend, and the events calendar.' },
  ],
  collections,
  seed: buildMallSeed,
  dashboard: Dashboard,
  boundaries: [
    'Not an accounting system or a lease-administration system of record: invoices here are not tax invoices and nothing is posted to a ledger.',
    'No integration with a property-management system (such as an MDA-type system), a bank, smart meters, footfall counters, the parking system or tenant point-of-sale. Every reading, payment, footfall count and turnover figure is typed in by hand.',
    'Turnover rent, the natural breakpoint, operating-cost recoveries, utility tariffs and the rent-to-sales “at risk” level are demo rules, not lease terms. Interest on arrears is not calculated.',
    'Credit checks, FICA verification, deposits and bank guarantees are simulated ticks. This is not Consumer Protection Act, Rental Housing Act or FICA compliance.',
    'Reminders, letters of demand, quotes and proposals are previews or log entries only — no email, SMS or letter is sent.',
    'Work permits, inductions, certificates of occupancy and insurance references are illustrative (DEMO-…), not occupational health and safety or fire compliance.',
    'All tenants, shops, people, contractors, amounts and reference numbers are fictional.',
  ],
  guide: [
    { title: 'Let a vacant shop from the stacking plan', detail: 'Click the vacant shop G14 on the plan and open its lease application. “Agree heads of terms” is refused until a credit check is recorded and — because the shop is over 500 m² — the leasing manager approves it. Do both on the same screen (switch to the leasing manager in the top bar for the approval) and the shop turns “under offer”.', to: 'units', as: 'u_la' },
    { title: 'Open a shop for trading', detail: 'The fit-out is signed off, but “Start trading” is still refused: there is no certificate of occupancy number and no tenant insurance on file. Record both under “Before the shop can trade”, start trading, and the unit turns “let”.', to: 'leases/leases_2', as: 'u_lm' },
    { title: 'Capture the month’s meter readings', detail: 'Four shops still need last month’s readings. Type one lower than the previous reading — it is refused. Type a believable one and it is captured; a jump of more than 40% is flagged for review.', to: 'meters', as: 'u_ops' },
    { title: 'Draft the month’s invoices', detail: 'Press “Draft this month’s invoices”: each trading tenant gets base rent, operating costs, marketing levy, metered utilities and turnover rent on last month’s verified sales. Open a draft to see how it was built, issue it and record a part payment — more than the balance is refused.', to: 'billing', as: 'u_acc' },
    { title: 'Chase a tenant 90 days in arrears', detail: 'Read the reminder preview (nothing is sent), log the letter of demand, then record a payment arrangement — it is refused until the instalment and first date are typed in.', to: 'arrears/cases_1', as: 'u_acc' },
    { title: 'Approve a hot-work permit', detail: '“Approve permit” is refused: the contractor’s insurance has expired and no fire watch is named. Fix both under “Before approval” and approve it.', to: 'permits/permits_1', as: 'u_tc' },
  ],
  highlights: [
    'Stacking plan by level: every shop coloured by status or category, straight into its lease',
    'Month-end rent roll: base rent, recoveries, metered utilities and turnover rent on verified sales',
    'Lease rules: credit check and approval, deposit and FICA, fit-out sign-off, occupancy certificate and insurance',
    'Arrears ageing with credit-control steps; hot-work permits; no double-booked exhibition space',
  ],
};

export default config;
