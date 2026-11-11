// Private security demo. Fictional business: Sentinel Ridge Security, an invented
// South African guarding and armed-response company. Not a PSIRA, Firearms Control
// Act or labour-law compliance system — every grade, expiry and SLA rule is a demo rule.
import type { CollectionDef, Flag, IndustryConfig, WorkflowDef } from '../../core/types';
import { num, str } from '../../core/engine';
import { addDays, daysBetween, formatDate, monthLabel } from '../../core/lib/dates';
import { formatRand } from '../../core/lib/money';
import {
  IcoAlert, IcoBell, IcoBriefcase, IcoCalendar, IcoChart, IcoCheck, IcoHome, IcoKey, IcoList, IcoReceipt, IcoTimer, IcoUsers,
} from '../../core/components/Icons';
import {
  CHECK_ITEMS, CONTRACT_WINDOW_DAYS, EMPLOYMENT, EQUIPMENT_CATEGORIES, GRADES, INCIDENT_TYPES, INSPECTION_INTERVAL_DAYS, OB_TYPES, OUTCOMES, PERMIT_LABEL,
  SCORES, SEVERITIES, SHIFT_KINDS, SHIFT_SHORT, SIGNALS, SITE_TYPES, label,
} from './data';
import { DAYS_AHEAD, DAYS_BACK, SEED, buildSecuritySeed } from './seed';
import {
  SAPS_RE, bookOffProblem, bookOnProblem, calloutSla, contractMonthly, daysSinceInspection, deployability, dispatchProblem, duration, equipmentLabel,
  activeShiftFor, fullName, incidentCloseProblems, incidentReportProblem, inspectionOverdue, inspectionScore, inspectionSubmitProblem, invoiceOverdue,
  isSerious, issueProblems, issuedTo, kindOf, lateBookOn, notReturned, nowTime, obSignProblem, officerExpiries, officerName, onSceneProblem,
  patrolCompleteProblem, patrolLateBy, patrolMissed, permitExpired, postProblem, postingProblems, reliefProblem, responseMinutes, sapsProblem,
  shiftTitle, siteName, siteOfPost, slaState, slotPhase, standDownProblem, suggestedTime, todayStr, workingOfficerId,
} from './helpers';
export * from './helpers';
export { SEED, DAYS_BACK, DAYS_AHEAD };
import Dashboard from './pages/Dashboard';
import Roster from './pages/Roster';
import RosterDetail from './pages/RosterDetail';
import OccurrenceBook from './pages/OccurrenceBook';
import ObDetail from './pages/ObDetail';
import IncidentDetail from './pages/IncidentDetail';
import Callouts from './pages/Callouts';
import CalloutDetail from './pages/CalloutDetail';
import Patrols from './pages/Patrols';
import Inspections from './pages/Inspections';
import InspectionDetail from './pages/InspectionDetail';
import OfficerDetail from './pages/OfficerDetail';
import EquipmentDetail from './pages/EquipmentDetail';
import SiteDetail from './pages/SiteDetail';
import ContractDetail from './pages/ContractDetail';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Reports from './pages/Reports';

/* ------------------------------------------------------------------ */
const rosterWorkflow: WorkflowDef = {
  initial: 'open',
  states: [
    { key: 'open', label: 'Unfilled', tone: 'red', hint: 'No officer posted yet' },
    { key: 'posted', label: 'Posted', tone: 'blue' },
    { key: 'absent', label: 'Absent', tone: 'red' },
    { key: 'relief', label: 'Relief assigned', tone: 'amber' },
    { key: 'onduty', label: 'On duty', tone: 'green' },
    { key: 'off', label: 'Booked off', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'open', to: 'posted', label: 'Post officer', permission: 'roster.manage', intent: 'primary', guard: ({ record, data }) => postProblem(data, record) },
    {
      from: ['posted', 'relief'], to: 'onduty', label: 'Book on', permission: 'roster.book', intent: 'primary',
      guard: ({ record, data }) => bookOnProblem(data, record, todayStr()),
      after: ({ record, api }) => { if (!str(record, 'bookedOn')) api.update('roster', record.id, { bookedOn: nowTime() }); },
    },
    { from: 'posted', to: 'absent', label: 'Mark absent', permission: 'roster.book', requiresNote: true, noteHint: 'why the officer is absent and who reported it', intent: 'danger' },
    { from: 'absent', to: 'relief', label: 'Assign relief', permission: 'roster.manage', intent: 'primary', guard: ({ record, data }) => reliefProblem(data, record) },
    {
      from: 'onduty', to: 'off', label: 'Book off', permission: 'roster.book', intent: 'primary',
      guard: ({ record, data }) => bookOffProblem(data, record),
      after: ({ record, data, api }) => {
        api.update('roster', record.id, { bookedOff: nowTime() });
        const out = issuedTo(data, workingOfficerId(record)).filter((e) => str(e, 'issuedShift') === record.id);
        if (out.length) api.toast(`${officerName(data, workingOfficerId(record))} still holds ${out.map((e) => str(e, 'assetNo')).join(', ')} — return to the armoury.`, 'info');
      },
    },
    {
      from: ['posted', 'relief'], to: 'open', label: 'Withdraw officer', permission: 'roster.manage', requiresNote: true, noteHint: 'why the officer is taken off this shift',
      after: ({ record, api }) => api.update('roster', record.id, { officer: '', reliefOfficer: '' }),
    },
  ],
};

const obWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'amber', hint: 'Can still be corrected' },
    { key: 'signed', label: 'Signed', tone: 'green', terminal: true, hint: 'Locked — add a follow-up entry instead of editing' },
  ],
  transitions: [
    { from: 'draft', to: 'signed', label: 'Sign entry', permission: 'ob.record', intent: 'primary', guard: ({ record }) => obSignProblem(record) },
  ],
};

const incidentWorkflow: WorkflowDef = {
  initial: 'reported',
  states: [
    { key: 'reported', label: 'Reported', tone: 'red' },
    { key: 'responding', label: 'Responding', tone: 'amber' },
    { key: 'investigating', label: 'Investigating', tone: 'blue' },
    { key: 'clientreport', label: 'Report to client', tone: 'accent' },
    { key: 'closed', label: 'Closed', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'reported', to: 'responding', label: 'Respond', permission: 'incidents.manage', intent: 'primary' },
    { from: 'responding', to: 'investigating', label: 'Start investigation', permission: 'incidents.manage', intent: 'primary' },
    {
      from: 'investigating', to: 'clientreport', label: 'Log client report', permission: 'incidents.manage', intent: 'primary',
      guard: ({ record }) => incidentReportProblem(record),
      after: ({ record, api, today }) => {
        api.update('incidents', record.id, { clientReportSent: true, clientReportOn: today });
        api.toast(`${record.ref}: client report logged — nothing is actually sent in this demo.`, 'info');
      },
    },
    { from: 'clientreport', to: 'investigating', label: 'Reopen investigation', permission: 'incidents.manage', requiresNote: true, noteHint: 'what the client or new evidence has raised' },
    { from: 'clientreport', to: 'closed', label: 'Close incident', permission: 'incidents.close', intent: 'primary', guard: ({ record }) => incidentCloseProblems(record)[0] ?? null },
  ],
};

const calloutWorkflow: WorkflowDef = {
  initial: 'received',
  states: [
    { key: 'received', label: 'Signal received', tone: 'red' },
    { key: 'dispatched', label: 'Dispatched', tone: 'amber' },
    { key: 'onscene', label: 'On scene', tone: 'blue' },
    { key: 'stooddown', label: 'Stood down', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'dark', terminal: true },
  ],
  transitions: [
    {
      from: 'received', to: 'dispatched', label: 'Dispatch vehicle', permission: 'callouts.dispatch', intent: 'primary',
      guard: ({ record, data }) => dispatchProblem(data, record, todayStr()),
      after: ({ record, api }) => { if (!str(record, 'dispatchedAt')) api.update('callouts', record.id, { dispatchedAt: suggestedTime(record, 'dispatched') }); },
    },
    {
      from: 'dispatched', to: 'onscene', label: 'Arrived on scene', permission: 'callouts.dispatch', intent: 'primary',
      guard: ({ record }) => onSceneProblem(record),
      after: ({ record, data, api }) => {
        const at = str(record, 'onSceneAt') || suggestedTime(record, 'onscene');
        if (!str(record, 'onSceneAt')) api.update('callouts', record.id, { onSceneAt: at });
        const mins = responseMinutes({ ...record, values: { ...record.values, onSceneAt: at } }) ?? 0;
        const sla = calloutSla(data, record);
        api.toast(`${record.ref}: on scene in ${duration(mins)} — ${mins <= sla ? 'within' : 'outside'} the ${sla}-minute demo SLA.`, mins <= sla ? 'ok' : 'err');
      },
    },
    {
      from: 'onscene', to: 'stooddown', label: 'Stand down', permission: 'callouts.dispatch', intent: 'primary',
      guard: ({ record }) => standDownProblem(record),
      after: ({ record, api }) => { if (!str(record, 'stoodDownAt')) api.update('callouts', record.id, { stoodDownAt: suggestedTime(record, 'stooddown') }); },
    },
    { from: ['received', 'dispatched'], to: 'cancelled', label: 'Cancel call-out', permission: 'callouts.dispatch', requiresNote: true, noteHint: 'who cancelled and how they were verified (e.g. password)' },
  ],
};

const patrolWorkflow: WorkflowDef = {
  initial: 'started',
  states: [
    { key: 'started', label: 'Round in progress', tone: 'amber' },
    { key: 'completed', label: 'Completed', tone: 'green', terminal: true },
  ],
  transitions: [
    {
      from: 'started', to: 'completed', label: 'Complete round', permission: 'patrols', intent: 'primary',
      guard: ({ record, note }) => patrolCompleteProblem(record, note),
      after: ({ record, api }) => { if (!str(record, 'completedAt')) api.update('patrols', record.id, { completedAt: nowTime() }); },
    },
  ],
};

const inspectionWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'In progress', tone: 'amber' },
    { key: 'submitted', label: 'Submitted', tone: 'green', terminal: true },
  ],
  transitions: [
    {
      from: 'draft', to: 'submitted', label: 'Submit inspection', permission: 'inspections', intent: 'primary',
      guard: ({ record }) => inspectionSubmitProblem(record),
      after: ({ record, api, today }) => {
        const failed = inspectionScore(record).failed;
        for (const f of failed) {
          api.create('actions', {
            site: str(record, 'site'), inspection: record.id, description: `${f.label}: ${str(record, 'findings')}`, owner: str(record, 'inspector'), due: addDays(today, f.score === 0 ? 3 : 7),
          }, 'open', `Raised from inspection ${record.ref}`);
        }
        if (failed.length) api.toast(`${failed.length} corrective action(s) raised from ${record.ref}.`, 'info');
      },
    },
  ],
};

const actionWorkflow: WorkflowDef = {
  initial: 'open',
  states: [
    { key: 'open', label: 'Open', tone: 'amber' },
    { key: 'done', label: 'Done', tone: 'green', terminal: true },
  ],
  transitions: [{ from: 'open', to: 'done', label: 'Mark done', permission: 'inspections', requiresNote: true, noteHint: 'what was done to close the finding', intent: 'primary' }],
};

const clearIssue = { issuedTo: '', issuedShift: '', issuedOn: '' };
const equipmentWorkflow: WorkflowDef = {
  initial: 'instore',
  states: [
    { key: 'instore', label: 'In store', tone: 'green' },
    { key: 'issued', label: 'Issued', tone: 'blue' },
    { key: 'repair', label: 'In repair', tone: 'amber' },
    { key: 'lost', label: 'Lost / written off', tone: 'red', terminal: true },
  ],
  transitions: [
    {
      from: 'instore', to: 'issued', label: 'Issue to officer', permission: 'equipment.issue', intent: 'primary',
      guard: ({ record, data }) => issueProblems(data, record, str(record, 'issuedTo'), todayStr())[0] ?? null,
      after: ({ record, data, api, today }) => {
        const shift = activeShiftFor(data, str(record, 'issuedTo'), todayStr());
        api.update('equipment', record.id, { issuedShift: shift?.id ?? '', issuedOn: today });
      },
    },
    { from: 'issued', to: 'instore', label: 'Return to store', permission: 'equipment.issue', intent: 'primary', after: ({ record, api }) => api.update('equipment', record.id, clearIssue) },
    { from: 'repair', to: 'instore', label: 'Back from repair', permission: 'equipment.issue' },
    { from: ['instore', 'issued'], to: 'repair', label: 'Send for repair', permission: 'equipment.issue', requiresNote: true, noteHint: 'the fault and where the item is going', after: ({ record, api }) => api.update('equipment', record.id, clearIssue) },
    { from: ['instore', 'issued', 'repair'], to: 'lost', label: 'Report lost', permission: 'equipment.issue', requiresNote: true, noteHint: 'when it was last seen and what was done to find it', intent: 'danger' },
  ],
};

const invoiceWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'issued', label: 'Issued', tone: 'blue' },
    { key: 'paid', label: 'Paid', tone: 'green', terminal: true },
  ],
  transitions: [
    {
      from: 'draft', to: 'issued', label: 'Issue invoice', permission: 'invoicing', intent: 'primary',
      guard: ({ record }) => (Array.isArray(record.values.lines) && record.values.lines.length ? null : 'Add at least one line before issuing the invoice.'),
      after: ({ record, api, today }) => {
        api.update('invoices', record.id, { issueDate: str(record, 'issueDate') || today, dueDate: str(record, 'dueDate') || addDays(today, 30) });
        api.toast(`${record.ref} issued — logged only, nothing is sent to the client in this demo.`, 'info');
      },
    },
    { from: 'issued', to: 'draft', label: 'Withdraw to draft', permission: 'invoicing', requiresNote: true, noteHint: 'why the invoice is being withdrawn' },
    { from: 'issued', to: 'paid', label: 'Record payment', permission: 'invoicing', intent: 'primary', after: ({ record, api, today }) => api.update('invoices', record.id, { paidOn: today }) },
  ],
};

const phoneRule = (v: unknown) => (/^0\d{2} \d{3} \d{4}$/.test(String(v)) ? null : 'Use the format 0xx xxx xxxx.');
const emailRule = (v: unknown) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : 'Enter a valid email address.');
const byDateTime = (dateKey: string, timeKey: string) => (a: { values: Record<string, unknown> }, b: { values: Record<string, unknown> }) =>
  `${String(b.values[dateKey] ?? '')}${String(b.values[timeKey] ?? '')}`.localeCompare(`${String(a.values[dateKey] ?? '')}${String(a.values[timeKey] ?? '')}`);

/* ------------------------------------------------------------------ */
const collections: CollectionDef[] = [
  {
    key: 'roster', singular: 'Shift', plural: 'Roster shifts', refPrefix: 'RS', workflow: rosterWorkflow, editPermission: 'roster.manage',
    title: (r, d) => shiftTitle(d, r),
    subtitle: (r, d) => `${formatDate(str(r, 'date'))} · ${SHIFT_SHORT[kindOf(d, r)]} shift · ${workingOfficerId(r) ? officerName(d, workingOfficerId(r)) : r.status === 'absent' ? `${officerName(d, r.values.officer)} absent` : 'unfilled'}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || str(a, 'post').localeCompare(str(b, 'post'), undefined, { numeric: true }),
    createFields: ['date', 'post', 'officer'],
    flags: (r, data, today) => {
      const f: Flag[] = [];
      const phase = slotPhase(str(r, 'date'), kindOf(data, r), today);
      if (r.status === 'open') f.push({ tone: 'red', label: 'Unfilled post' });
      if (r.status === 'absent') f.push({ tone: 'red', label: 'Absent — no relief' });
      if (str(r, 'reliefOfficer') && r.status !== 'absent') f.push({ tone: 'blue', label: 'Relief officer' });
      if (lateBookOn(data, r, today)) f.push({ tone: 'amber', label: 'Not booked on' });
      if (r.status === 'onduty' && phase === 'past') f.push({ tone: 'amber', label: 'Not booked off' });
      if ((r.status === 'posted' || r.status === 'relief') && phase !== 'past' && postingProblems(data, r, workingOfficerId(r)).length) f.push({ tone: 'red', label: 'Posting breaks a rule' });
      return f;
    },
    fields: [
      { key: 'date', label: 'Shift date', type: 'date', required: true, table: true },
      { key: 'post', label: 'Post', type: 'ref', ref: 'posts', required: true },
      { key: 'officer', label: 'Rostered officer', type: 'ref', ref: 'officers', table: true, hint: 'Posting runs the PSIRA, grade, competency, overlap and rest checks.' },
      { key: 'reliefOfficer', label: 'Relief officer', type: 'ref', ref: 'officers' },
      { key: 'bookedOn', label: 'Booked on', type: 'time', table: true },
      { key: 'bookedOff', label: 'Booked off', type: 'time', table: true },
    ],
  },
  {
    key: 'ob', singular: 'OB entry', plural: 'Occurrence book entries', refPrefix: 'OB', workflow: obWorkflow, editPermission: 'ob.record',
    title: (r) => `${label(OB_TYPES, str(r, 'type'))} — ${str(r, 'entry').slice(0, 70)}${str(r, 'entry').length > 70 ? '…' : ''}`,
    subtitle: (r, d) => `${siteName(d, r.values.site)} · ${formatDate(str(r, 'date'))} ${str(r, 'time')} · ${str(r, 'by')}`,
    sort: byDateTime('date', 'time'),
    createFields: ['site', 'date', 'time', 'shift', 'type', 'entry', 'by'],
    flags: (r) => (r.status === 'draft' ? [{ tone: 'amber', label: 'Not signed' }] : str(r, 'followsUp') ? [{ tone: 'blue', label: 'Follow-up' }] : []),
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true, validate: (v) => (String(v) > todayStr() ? 'An occurrence book entry cannot be dated in the future.' : null) },
      { key: 'time', label: 'Time', type: 'time', required: true, table: true },
      { key: 'shift', label: 'Shift', type: 'select', options: SHIFT_KINDS, required: true },
      { key: 'type', label: 'Entry type', type: 'select', options: OB_TYPES, required: true, table: true },
      { key: 'entry', label: 'Entry', type: 'textarea', required: true },
      { key: 'by', label: 'Entered by', type: 'text', required: true },
      { key: 'followsUp', label: 'Follows up entry', type: 'ref', ref: 'ob', hint: 'Signed entries in the same site’s book.', refFilter: (t, v) => t.status === 'signed' && (!v.site || t.values.site === v.site) },
      { key: 'shiftDate', label: 'Shift date', type: 'date', hidden: true },
    ],
  },
  {
    key: 'incidents', singular: 'Incident', plural: 'Incidents', refPrefix: 'INC', workflow: incidentWorkflow, editPermission: 'incidents.manage',
    title: (r) => str(r, 'title'),
    subtitle: (r, d) => `${label(INCIDENT_TYPES, str(r, 'type'))} · ${siteName(d, r.values.site)} · ${formatDate(str(r, 'date'))} ${str(r, 'time')}`,
    sort: byDateTime('date', 'time'),
    createFields: ['site', 'date', 'time', 'type', 'severity', 'title', 'description', 'reportedBy', 'clientNotifiedAt'],
    createDefaults: (today) => ({ date: today, severity: 'medium' }),
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      if (r.status !== 'closed' && isSerious(r)) f.push({ tone: 'red', label: 'Serious incident' });
      if (r.status !== 'closed' && sapsProblem(r)) f.push({ tone: 'amber', label: 'SAPS case number outstanding' });
      if (r.status !== 'closed' && !str(r, 'clientNotifiedAt')) f.push({ tone: 'amber', label: 'Client not yet notified' });
      if (['reported', 'responding', 'investigating'].includes(r.status ?? '') && daysBetween(str(r, 'date'), today) > 7) f.push({ tone: 'amber', label: 'Open more than 7 days' });
      return f;
    },
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true, validate: (v) => (String(v) > todayStr() ? 'The incident date cannot be in the future.' : null) },
      { key: 'time', label: 'Time', type: 'time', required: true },
      { key: 'type', label: 'Type', type: 'select', options: INCIDENT_TYPES, required: true, table: true },
      { key: 'severity', label: 'Severity', type: 'select', options: SEVERITIES, required: true, table: true },
      { key: 'title', label: 'What happened (short)', type: 'text', required: true, wide: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'reportedBy', label: 'Reported by', type: 'text', required: true },
      { key: 'clientNotifiedAt', label: 'Client notified at', type: 'time', hint: 'Time the client contact was phoned.' },
      { key: 'sapsCase', label: 'SAPS case number (fictional)', type: 'text', placeholder: 'DEMO-CAS 123/11/2026', validate: (v) => (SAPS_RE.test(String(v)) ? null : 'Use the demo format DEMO-CAS 123/11/2026.') },
      { key: 'noSapsReason', label: 'Reason no SAPS case was opened', type: 'text', wide: true, hint: 'Serious incidents need a case number or this reason.' },
      { key: 'rootCause', label: 'Root cause', type: 'textarea' },
      { key: 'outcome', label: 'Outcome', type: 'textarea' },
      // Set by the “Log client report” step only, so they are not offered in the edit form; the close-out checklist shows them.
      { key: 'clientReportSent', label: 'Client report logged as sent', type: 'boolean', hidden: true },
      { key: 'clientReportOn', label: 'Client report date', type: 'date', hidden: true },
    ],
  },
  {
    key: 'callouts', singular: 'Call-out', plural: 'Armed response call-outs', refPrefix: 'CO', workflow: calloutWorkflow, editPermission: 'callouts.dispatch',
    title: (r, d) => `${label(SIGNALS, str(r, 'signal'))} — ${siteName(d, r.values.site)}`,
    subtitle: (r) => `${formatDate(str(r, 'date'))} ${str(r, 'receivedAt')}${str(r, 'zone') ? ` · ${str(r, 'zone')}` : ''}`,
    sort: byDateTime('date', 'receivedAt'),
    createFields: ['site', 'date', 'receivedAt', 'signal', 'zone'],
    flags: (r, data) => {
      const s = slaState(data, r);
      if (s.state === 'breached') return [{ tone: 'red', label: `Response ${s.minutes} min — over ${s.sla}-min SLA` }];
      if (s.state === 'met') return [{ tone: 'green', label: `Response ${s.minutes} min` }];
      if (s.state === 'running') return [{ tone: 'amber', label: `On scene due by ${s.dueBy}` }];
      return [];
    },
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'receivedAt', label: 'Signal received', type: 'time', required: true, table: true },
      { key: 'signal', label: 'Signal', type: 'select', options: SIGNALS, required: true },
      { key: 'zone', label: 'Zone / detail', type: 'text' },
      { key: 'vehicle', label: 'Response vehicle', type: 'ref', ref: 'equipment', table: true },
      { key: 'dispatchedAt', label: 'Dispatched', type: 'time' },
      { key: 'onSceneAt', label: 'On scene', type: 'time', table: true },
      { key: 'stoodDownAt', label: 'Stood down', type: 'time' },
      { key: 'outcome', label: 'Outcome', type: 'select', options: OUTCOMES },
      { key: 'notes', label: 'Response report', type: 'textarea' },
    ],
  },
  {
    key: 'patrols', singular: 'Patrol round', plural: 'Patrol rounds', refPrefix: 'PR', workflow: patrolWorkflow, editPermission: 'patrols',
    title: (r, d) => `${siteName(d, r.values.site)} — round ${str(r, 'startedAt')}`,
    subtitle: (r, d) => `${formatDate(str(r, 'date'))} · ${SHIFT_SHORT[str(r, 'shift')] ?? ''} shift · ${officerName(d, r.values.officer)}`,
    sort: byDateTime('date', 'startedAt'),
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      const missed = patrolMissed(r);
      if (missed) f.push({ tone: 'red', label: `${missed} checkpoint${missed === 1 ? '' : 's'} missed` });
      const late = patrolLateBy(r);
      if (late) f.push({ tone: 'amber', label: `Started ${late} min late` });
      if (r.status === 'started' && str(r, 'date') < today) f.push({ tone: 'red', label: 'Round not completed' });
      return f;
    },
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'shift', label: 'Shift', type: 'select', options: SHIFT_KINDS, required: true },
      { key: 'officer', label: 'Patrolling officer', type: 'ref', ref: 'officers' },
      { key: 'dueAt', label: 'Round due', type: 'time' },
      { key: 'startedAt', label: 'Started', type: 'time', required: true, table: true },
      { key: 'completedAt', label: 'Completed', type: 'time', table: true },
      { key: 'checkpoints', label: 'Checkpoints on the round', type: 'number', min: 1, max: 10, required: true, table: true },
      { key: 'scanned', label: 'Checkpoints scanned', type: 'number', min: 0, max: 10, table: true, hint: 'Simulated scans — no guard-tour hardware is connected.' },
      { key: 'missedPoints', label: 'Missed checkpoints and reason', type: 'text', wide: true },
    ],
  },
  {
    key: 'inspections', singular: 'Site inspection', plural: 'Site inspections', refPrefix: 'INS', workflow: inspectionWorkflow, editPermission: 'inspections',
    // The checklist is scored on the inspection page, so starting one only asks where, when and who.
    createFields: ['site', 'date', 'time', 'inspector'],
    title: (r, d) => `${siteName(d, r.values.site)} — inspection`,
    subtitle: (r) => `${formatDate(str(r, 'date'))} ${str(r, 'time')} · ${str(r, 'inspector')} · score ${inspectionScore(r).score}/${inspectionScore(r).max}`,
    sort: byDateTime('date', 'time'),
    flags: (r) => {
      const s = inspectionScore(r);
      if (!s.complete) return [{ tone: 'amber', label: 'Checklist incomplete' }];
      return s.failed.length ? [{ tone: s.failed.some((x) => x.score === 0) ? 'red' : 'amber', label: `${s.failed.length} finding${s.failed.length === 1 ? '' : 's'}` }] : [{ tone: 'green', label: 'No findings' }];
    },
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true, validate: (v) => (String(v) > todayStr() ? 'An inspection cannot be dated in the future.' : null) },
      { key: 'time', label: 'Time', type: 'time' },
      { key: 'inspector', label: 'Inspector', type: 'text', required: true, table: true },
      ...CHECK_ITEMS.map((c) => ({ key: c.key, label: c.label, type: 'select' as const, options: SCORES, hint: c.hint })),
      { key: 'findings', label: 'Findings', type: 'textarea', hint: 'Required when any item is below satisfactory. Each such item raises a corrective action.' },
    ],
  },
  {
    key: 'actions', singular: 'Corrective action', plural: 'Corrective actions', refPrefix: 'CA', workflow: actionWorkflow, editPermission: 'inspections',
    title: (r) => str(r, 'description'),
    subtitle: (r, d) => `${siteName(d, r.values.site)} · ${str(r, 'owner')} · due ${formatDate(str(r, 'due'))}`,
    sort: (a, b) => str(a, 'due').localeCompare(str(b, 'due')),
    flags: (r, _d, today) => (r.status === 'open' && str(r, 'due') && str(r, 'due') < today ? [{ tone: 'red', label: `Overdue ${daysBetween(str(r, 'due'), today)} d` }] : []),
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true, table: true },
      { key: 'inspection', label: 'Raised from inspection', type: 'ref', ref: 'inspections' },
      { key: 'description', label: 'Action', type: 'textarea', required: true },
      { key: 'owner', label: 'Owner', type: 'text', required: true, table: true },
      { key: 'due', label: 'Due', type: 'date', required: true, table: true },
    ],
  },
  {
    key: 'officers', singular: 'Officer', plural: 'Officers', refPrefix: 'OF', editPermission: 'compliance',
    title: (r) => fullName(r),
    subtitle: (r) => `Grade ${str(r, 'grade')} · ${str(r, 'psiraNo')} · ${str(r, 'employeeNo')}`,
    sort: (a, b) => str(a, 'lastName').localeCompare(str(b, 'lastName')) || str(a, 'firstName').localeCompare(str(b, 'firstName')),
    createDefaults: () => ({ employment: 'active', grade: 'E' }),
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      const dep = deployability(r, today);
      f.push(dep.deployable ? { tone: 'green', label: 'Deployable' } : { tone: 'red', label: 'Not deployable' });
      for (const e of officerExpiries(r, today)) {
        if (e.state === 'overdue') f.push({ tone: e.key === 'psiraExpiry' || e.key === 'competencyExpiry' ? 'red' : 'amber', label: `${e.label} ${e.key === 'refresherDue' || e.key === 'medicalDue' ? 'overdue' : 'expired'}` });
        if (e.state === 'due-soon') f.push({ tone: 'amber', label: `${e.label} ${daysBetween(today, e.date)} d left` });
      }
      if (str(r, 'employment') !== 'active') f.push({ tone: 'dark', label: label(EMPLOYMENT, str(r, 'employment')) });
      return f;
    },
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'lastName', label: 'Surname', type: 'text', required: true },
      { key: 'employeeNo', label: 'Employee number', type: 'text', required: true },
      { key: 'psiraNo', label: 'PSIRA number (fictional)', type: 'text', required: true, placeholder: 'DEMO-PSIRA-1234567', validate: (v) => (/^DEMO-PSIRA-\d{7}$/.test(String(v)) ? null : 'Use the demo format DEMO-PSIRA-1234567.') },
      { key: 'grade', label: 'Grade', type: 'select', options: GRADES, required: true, table: true },
      { key: 'psiraExpiry', label: 'PSIRA registration expires', type: 'date', required: true, table: true },
      { key: 'competencyExpiry', label: 'Firearm competency expires', type: 'date', table: true, hint: 'Leave empty if the officer holds no firearm competency.' },
      { key: 'refresherDue', label: 'Refresher training due', type: 'date' },
      { key: 'medicalDue', label: 'Medical fitness due', type: 'date' },
      { key: 'employment', label: 'Employment status', type: 'select', options: EMPLOYMENT, required: true },
      { key: 'inductions', label: 'Site inductions (site codes)', type: 'text', placeholder: 'e.g. KLF, PHE', table: true },
      { key: 'phone', label: 'Mobile (fictional)', type: 'text', required: true, placeholder: '082 555 0100', validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'hrNotes', label: 'HR notes (restricted)', type: 'textarea', permission: 'hr.notes' },
    ],
  },
  {
    key: 'equipment', singular: 'Equipment item', plural: 'Equipment & armoury', refPrefix: 'EQ', workflow: equipmentWorkflow, editPermission: 'equipment.issue',
    title: (r) => equipmentLabel(r),
    subtitle: (r, d) => `${label(EQUIPMENT_CATEGORIES, str(r, 'category'))} · ${str(r, 'serial')}${r.status === 'issued' ? ` · issued to ${officerName(d, r.values.issuedTo)}` : ''}`,
    sort: (a, b) => str(a, 'assetNo').localeCompare(str(b, 'assetNo')),
    createFields: ['assetNo', 'category', 'description', 'serial', 'permitExpiry', 'response'],
    flags: (r, data, today) => {
      const f: Flag[] = [];
      const what = PERMIT_LABEL[str(r, 'category')] ?? 'Permit';
      if (notReturned(data, r, today)) f.push({ tone: 'red', label: 'Not returned after shift end' });
      if (r.status !== 'lost' && permitExpired(r, today)) f.push({ tone: 'red', label: `${what} expired` });
      else if (r.status !== 'lost' && str(r, 'permitExpiry') && daysBetween(today, str(r, 'permitExpiry')) <= 30) f.push({ tone: 'amber', label: `${what} ${daysBetween(today, str(r, 'permitExpiry'))} d left` });
      return f;
    },
    fields: [
      { key: 'assetNo', label: 'Asset number', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: EQUIPMENT_CATEGORIES, required: true, table: true },
      { key: 'description', label: 'Description (fictional model)', type: 'text', required: true },
      { key: 'serial', label: 'Serial number (fictional)', type: 'text', required: true, table: true },
      { key: 'permitExpiry', label: 'Licence / permit expires', type: 'date', table: true, hint: 'Firearm licence or vehicle licence disc.' },
      { key: 'response', label: 'Armed response vehicle', type: 'boolean' },
      { key: 'issuedTo', label: 'Issued to', type: 'ref', ref: 'officers', table: true },
      { key: 'issuedShift', label: 'Issued for shift', type: 'ref', ref: 'roster' },
      { key: 'issuedOn', label: 'Issued on', type: 'date' },
    ],
  },
  {
    key: 'contracts', singular: 'Contract', plural: 'Client contracts', refPrefix: 'CT', editPermission: 'contracts',
    title: (r) => str(r, 'client'),
    subtitle: (r, d) => `${formatRand(contractMonthly(d, r.id) * 100)} per month excl. VAT · ends ${formatDate(str(r, 'endDate'))}`,
    sort: (a, b) => str(a, 'endDate').localeCompare(str(b, 'endDate')),
    createDefaults: (today) => ({ startDate: today, endDate: addDays(today, 365), slaMinutes: 15, includedCallouts: 3 }),
    flags: (r, _d, today) => {
      const left = daysBetween(today, str(r, 'endDate'));
      if (!str(r, 'endDate')) return [];
      if (left < 0) return [{ tone: 'red', label: 'Contract ended' }];
      return left <= CONTRACT_WINDOW_DAYS ? [{ tone: 'amber', label: `Ends in ${left} days` }] : [];
    },
    fields: [
      { key: 'client', label: 'Client (fictional)', type: 'text', required: true },
      { key: 'contactName', label: 'Client contact', type: 'text', required: true, table: true },
      { key: 'phone', label: 'Phone (fictional)', type: 'text', placeholder: '011 555 0100', validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'startDate', label: 'Contract start', type: 'date', required: true },
      { key: 'endDate', label: 'Contract end', type: 'date', required: true, table: true, validate: (v, all) => (all.startDate && String(v) < String(all.startDate) ? 'Must be after the start date.' : null) },
      { key: 'slaMinutes', label: 'Armed response SLA', type: 'number', unit: 'min', min: 1, max: 120, required: true, table: true },
      { key: 'includedCallouts', label: 'Call-outs included per month', type: 'number', min: 0 },
      { key: 'calloutFee', label: 'Fee per extra call-out', type: 'money', min: 0 },
      { key: 'penaltyPerShift', label: 'Penalty per unfilled shift (demo rule)', type: 'money', min: 0 },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'sites', singular: 'Site', plural: 'Sites', refPrefix: 'ST', editPermission: 'contracts',
    title: (r) => str(r, 'name'),
    subtitle: (r, d) => [str(r, 'code'), label(SITE_TYPES, str(r, 'type')), str(r, 'area'), str(d.collections.contracts?.find((c) => c.id === r.values.contract), 'client')].filter(Boolean).join(' · '),
    sort: (a, b) => str(a, 'name').localeCompare(str(b, 'name')),
    flags: (r, data, today) => {
      const f: Flag[] = [];
      const days = daysSinceInspection(data, r.id, today);
      if (inspectionOverdue(data, r.id, today)) f.push({ tone: 'red', label: days === null ? 'Never inspected' : `Not inspected for ${days} days` });
      if (r.values.requiresInduction === true) f.push({ tone: 'blue', label: 'Site induction required' });
      return f;
    },
    fields: [
      { key: 'name', label: 'Site name', type: 'text', required: true },
      { key: 'code', label: 'Site code', type: 'text', required: true, table: true, placeholder: 'e.g. KLF', validate: (v) => (/^[A-Z]{3}$/.test(String(v)) ? null : 'Use three capital letters, e.g. KLF.') },
      { key: 'contract', label: 'Client contract', type: 'ref', ref: 'contracts', required: true, table: true },
      { key: 'area', label: 'Area (fictional)', type: 'text' },
      { key: 'type', label: 'Site type', type: 'select', options: SITE_TYPES, required: true },
      { key: 'checkpoints', label: 'Patrol checkpoints', type: 'number', min: 0, max: 10, required: true, table: true },
      { key: 'requiresInduction', label: 'Site induction required before posting', type: 'boolean' },
      { key: 'keyholder', label: 'Keyholder (fictional)', type: 'text' },
      { key: 'postOrders', label: 'Post orders (summary)', type: 'textarea' },
    ],
  },
  {
    key: 'posts', singular: 'Post', plural: 'Posts', refPrefix: 'PST', editPermission: 'contracts',
    title: (r, d) => `${str(siteOfPost(d, r), 'code')} · ${str(r, 'name')} · ${SHIFT_SHORT[str(r, 'shift')] ?? 'Day'}`,
    subtitle: (r) => `Grade ${str(r, 'grade')}${r.values.armed === true ? ' · armed' : ''}`,
    sort: (a, b) => a.ref.localeCompare(b.ref),
    fields: [
      { key: 'site', label: 'Site', type: 'ref', ref: 'sites', required: true, table: true },
      { key: 'name', label: 'Post', type: 'text', required: true },
      { key: 'shift', label: 'Shift', type: 'select', options: SHIFT_KINDS, required: true, table: true },
      { key: 'grade', label: 'Required grade (minimum)', type: 'select', options: GRADES, required: true, table: true },
      { key: 'armed', label: 'Armed post', type: 'boolean' },
      { key: 'monthlyRate', label: 'Monthly rate (excl. VAT)', type: 'money', min: 0, required: true, table: true },
    ],
  },
  {
    key: 'invoices', singular: 'Invoice', plural: 'Invoices', refPrefix: 'INV', workflow: invoiceWorkflow, editPermission: 'invoicing',
    title: (r, d) => `${str(d.collections.contracts?.find((c) => c.id === r.values.contract), 'client') || 'Client'} — ${/^\d{4}-\d{2}$/.test(str(r, 'period')) ? monthLabel(str(r, 'period')) : str(r, 'period')}`,
    subtitle: (r) => `${num(r, 'unfilledShifts')} unfilled shift penalt${num(r, 'unfilledShifts') === 1 ? 'y' : 'ies'}${str(r, 'dueDate') ? ` · due ${formatDate(str(r, 'dueDate'))}` : ''}`,
    sort: (a, b) => str(b, 'period').localeCompare(str(a, 'period')) || a.ref.localeCompare(b.ref),
    flags: (r, _d, today) => (invoiceOverdue(r, today) ? [{ tone: 'red', label: `Overdue ${daysBetween(str(r, 'dueDate'), today)} d` }] : []),
    fields: [
      { key: 'contract', label: 'Contract', type: 'ref', ref: 'contracts', required: true, table: true },
      { key: 'period', label: 'Month (YYYY-MM)', type: 'text', required: true, table: true, validate: (v) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v)) ? null : 'Use the format YYYY-MM.') },
      { key: 'issueDate', label: 'Issue date', type: 'date' },
      { key: 'dueDate', label: 'Due date', type: 'date', table: true },
      { key: 'lines', label: 'Posts and extras', type: 'lines', hint: 'The total under these lines is before penalties. The invoice page takes the unfilled-shift penalties off before VAT.' },
      { key: 'unfilledShifts', label: 'Unfilled shifts (penalised)', type: 'number', min: 0 },
      { key: 'penaltyPerShift', label: 'Penalty per unfilled shift', type: 'money', min: 0 },
      { key: 'paidOn', label: 'Paid on', type: 'date' },
    ],
  },
];

const config: IndustryConfig = {
  id: 'security',
  industry: 'Security services',
  businessName: 'Sentinel Ridge Security',
  monogram: 'SR',
  workspaceTag: 'CONTROL ROOM',
  tagline: 'Guarding and armed response',
  summary: 'A fictional South African guarding and armed-response company: a duty roster that refuses unregistered, under-graded or double-booked officers, site occurrence books, incidents, armed response call-outs timed against an SLA, patrols, inspections, the officer and armoury registers, client contracts and monthly invoicing.',
  priority: 9,
  theme: { accent: '#a33a47', accent2: '#b54a57', accentSoft: '#e8b3ba', accentTint: '#f9ecee', accentLine: '#f0d2d6', accentText: '#7d2936' },
  roles: [
    { key: 'director', label: 'Operations director' },
    { key: 'control', label: 'Control room operator' },
    { key: 'supervisor', label: 'Site supervisor / inspector' },
    { key: 'hr', label: 'HR & compliance officer' },
    { key: 'accounts', label: 'Accounts clerk' },
    { key: 'armoury', label: 'Armoury / equipment controller' },
  ],
  permissions: [
    { key: 'roster.manage', label: 'Manage roster', description: 'Post officers to shifts, assign relief and edit the duty roster' },
    { key: 'roster.book', label: 'Book on / off', description: 'Book officers on and off duty and mark absences' },
    { key: 'ob.record', label: 'Occurrence book', description: 'Write and sign occurrence book entries' },
    { key: 'incidents.manage', label: 'Manage incidents', description: 'Report incidents, run the response and investigation, log client reports' },
    { key: 'incidents.close', label: 'Close incidents', description: 'Close an incident once root cause, outcome and client report are on file' },
    { key: 'callouts.dispatch', label: 'Dispatch armed response', description: 'Log alarm signals, dispatch vehicles and stand them down' },
    { key: 'patrols', label: 'Patrols', description: 'Start and complete patrol rounds' },
    { key: 'inspections', label: 'Site inspections', description: 'Carry out inspections and close corrective actions' },
    { key: 'compliance', label: 'Officer compliance', description: 'Maintain the officer register: PSIRA, competency, training and medical dates' },
    { key: 'hr.notes', label: 'HR notes', description: 'See the restricted HR notes on an officer record' },
    { key: 'equipment.issue', label: 'Issue equipment', description: 'Issue and return radios, firearms and other equipment' },
    { key: 'contracts', label: 'Contracts', description: 'Maintain client contracts, sites and posts' },
    { key: 'invoicing', label: 'Invoicing', description: 'Build, issue and receipt monthly invoices' },
  ],
  modules: [
    { key: 'roster', label: 'Duty roster', icon: IcoCalendar, group: 'Control room', collection: 'roster', page: Roster, detail: RosterDetail, description: 'Day and night shifts per site and post with coverage. Posting checks PSIRA registration, grade, armed-post competency, overlaps and a demo rest rule.' },
    { key: 'ob', label: 'Occurrence book', icon: IcoList, group: 'Control room', collection: 'ob', page: OccurrenceBook, detail: ObDetail, description: 'Numbered, time-stamped entries per site. Signed entries are locked; a shift handover entry is needed before officers book off.' },
    { key: 'incidents', label: 'Incidents', icon: IcoAlert, group: 'Control room', collection: 'incidents', view: 'board', detail: IncidentDetail, description: 'From reported to closed. Serious incidents need a (fictional) SAPS case number, and closing needs root cause, outcome and a logged client report.' },
    { key: 'callouts', label: 'Armed response', icon: IcoBell, group: 'Control room', collection: 'callouts', page: Callouts, detail: CalloutDetail, description: 'Alarm signal → dispatched → on scene → stood down, with response time measured against the contract SLA.' },
    { key: 'sites', label: 'Sites & posts', icon: IcoHome, group: 'Sites & guarding', collection: 'sites', detail: SiteDetail, description: 'Each client site with its posts, today’s coverage, last inspection and open incidents.' },
    { key: 'patrols', label: 'Patrols & checkpoints', icon: IcoTimer, group: 'Sites & guarding', collection: 'patrols', page: Patrols, description: 'Patrol rounds with simulated checkpoint scans. Missed checkpoints and late rounds are flagged.' },
    { key: 'inspections', label: 'Site inspections', icon: IcoCheck, group: 'Sites & guarding', collection: 'inspections', page: Inspections, detail: InspectionDetail, description: `Scored supervisor visits. Findings raise corrective actions; sites not inspected in ${INSPECTION_INTERVAL_DAYS} days are flagged.` },
    { key: 'officers', label: 'Officers & compliance', icon: IcoUsers, group: 'People & compliance', collection: 'officers', detail: OfficerDetail, description: 'Officer register with PSIRA grade and registration, firearm competency, training and medical dates. HR notes are restricted.' },
    { key: 'equipment', label: 'Equipment & armoury', icon: IcoKey, group: 'People & compliance', collection: 'equipment', detail: EquipmentDetail, description: 'Radios, body cameras, vehicles and firearms issued at book-on and returned at book-off. Firearms only go to competent officers on armed posts.' },
    { key: 'contracts', label: 'Client contracts', icon: IcoBriefcase, group: 'Commercial', collection: 'contracts', detail: ContractDetail, description: 'Clients, their sites and posts, monthly value, SLA and contract end dates.' },
    { key: 'invoices', label: 'Invoicing', icon: IcoReceipt, group: 'Commercial', collection: 'invoices', page: Invoices, detail: InvoiceDetail, description: 'Monthly invoice per contract: posts × rate, less penalties for unfilled shifts, plus call-out extras.' },
    { key: 'reports', label: 'Reports', icon: IcoChart, group: 'Commercial', page: Reports, description: 'Coverage, absenteeism, incidents by type and site, response times and compliance expiries.' },
  ],
  collections,
  seed: buildSecuritySeed,
  dashboard: Dashboard,
  boundaries: [
    'Not a PSIRA or Firearms Control Act compliance system. Grades, registration, competency and licence checks are demo rules on invented data and prove nothing about a real officer or firearm.',
    'No connection to alarm panels, CCTV, guard-tour (checkpoint) hardware, panic buttons or vehicle tracking — signals, scans and times are typed in or simulated.',
    'No live clock: today’s day shift is always shown as the shift on duty and tonight’s as upcoming, and response times come from the times typed on the call-out, not from a timer.',
    'No link to SAPS. Case numbers are fictional and use a DEMO-CAS format.',
    'No payroll, overtime or Sectoral Determination 6 calculations. The rest rule on the roster is a simple demo rule, not labour-law advice.',
    'Client reports, invoices and messages are logged and previewed only — nothing is sent.',
    'All clients, sites, officers, PSIRA numbers, serial numbers and vehicle registrations are fictional.',
  ],
  guide: [
    { title: 'Fill an unfilled post', detail: 'Tomorrow’s armed cash-office post has nobody on it. Press “Try to post” on an officer with a lapsed PSIRA registration, too low a grade or no firearm competency — each is refused with the reason — then “Post” an eligible one.', to: `roster/${SEED.guideShift}`, as: 'u_ctl' },
    { title: 'Book an officer off', detail: 'This officer is on duty at the Kloofview Mall main entrance. Press “Book off”: it is refused until the site’s shift handover entry is written and signed in the occurrence book. The “Shift handover” panel on the same page does both — then book off works.', to: `roster/${SEED.onDutyShift}`, as: 'u_ctl' },
    { title: 'Dispatch armed response', detail: 'A panic signal is waiting for a vehicle. Pick one in the dispatch form — vehicles in repair, unlicensed or already committed are refused — mark it on scene to see the response time against the SLA, then stand it down with an outcome.', to: `callouts/${SEED.guideCallout}`, as: 'u_ctl' },
    { title: 'Close an incident properly', detail: 'This break-in cannot go to the client without a root cause and a SAPS case number (or the reason there is none), and cannot be closed without an outcome. Try the steps, fill in the close-out form on the page, log the client report, then close it.', to: `incidents/${SEED.guideIncident}`, as: 'u_dir' },
    { title: 'Issue a firearm', detail: 'Pick an officer in the issue form: one on an unarmed post, without firearm competency or already holding a firearm is refused with the reason; an officer on one of tonight’s armed posts is accepted. Then return it to store. Nothing leaves a real armoury.', to: `equipment/${SEED.guideFirearm}`, as: 'u_arm' },
    { title: 'Submit a site inspection', detail: 'Two checklist items are below satisfactory. Submit the inspection and a corrective action is raised for each; the site drops off the “overdue for inspection” list.', to: `inspections/${SEED.guideInspection}`, as: 'u_sup' },
  ],
  highlights: [
    'Duty roster that blocks expired PSIRA registration, low grades, double bookings and armed posts without competency',
    'Armed response call-outs timed from signal to on scene against the contract SLA',
    'Occurrence book with locked signed entries and a handover rule before book-off',
    'Armoury register: firearms only to competent officers on armed posts, with not-returned flags',
  ],
};

export default config;
