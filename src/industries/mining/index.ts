// Mining operations demo. Fictional business: Ridgeback Minerals — Kgotso Shaft,
// an invented South African underground mine. Not a certified safety system.
import type { CollectionDef, Flag, GuardContext, IndustryConfig, Values, WorkflowDef } from '../../core/types';
import { findRecord, num, str } from '../../core/engine';
import { formatDate } from '../../core/lib/dates';
import { IcoBriefcase, IcoChart, IcoHelmet, IcoLeaf, IcoPermit, IcoPickaxe, IcoTruck, IcoWrench } from '../../core/components/Icons';
import {
  ARTISANS, AVAILABILITY, DELAY_REASONS, ENV_PARAMS, ENV_POINTS, EQUIPMENT_CATEGORIES, INCIDENT_CATEGORIES, INCIDENT_TYPES, LOCATIONS,
  PERMIT_TYPES, PRIORITIES, SECTIONS, SEVERITIES, SHIFTS, SUPERVISORS, TRADES, WO_TYPES, O2_MAX, O2_MIN, label, withUnit,
} from './data';
import { buildMiningSeed } from './seed';
import {
  contractorClearance, contractorExpiries, contractorName, envExceedance, envParam, envReviewProblem, equipmentLabel, equipmentName,
  gasTestProblem, hoursToService, incidentActionsProblem, incidentCloseProblem, permitActivationProblems, permitExpired, serviceState,
  shiftSubmitProblem, shiftVerifyProblem, todayStr, workOrderCompleteProblem,
} from './helpers';
export * from './helpers';
import Dashboard from './pages/Dashboard';
import ProductionLog from './pages/ProductionLog';
import PermitDetail from './pages/PermitDetail';
import EquipmentDetail from './pages/EquipmentDetail';
import ContractorDetail from './pages/ContractorDetail';
import EnvDetail from './pages/EnvDetail';
import Reports from './pages/Reports';
import ShiftDetail from './pages/ShiftDetail';
import IncidentDetail from './pages/IncidentDetail';
import WorkOrderDetail from './pages/WorkOrderDetail';
import { ContractorsPage, EnvironmentPage, EquipmentPage, WorkOrdersPage } from './pages/Registers';

/* ------------------------------------------------------------------ */
const shiftWorkflow: WorkflowDef = {
  initial: 'open',
  states: [
    { key: 'open', label: 'Open', tone: 'amber', hint: 'Shift in progress — figures still being captured' },
    { key: 'submitted', label: 'Submitted', tone: 'blue' },
    { key: 'verified', label: 'Verified', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'open', to: 'submitted', label: 'Submit shift', permission: 'production.log', intent: 'primary', guard: ({ record }) => shiftSubmitProblem(record) },
    { from: 'submitted', to: 'verified', label: 'Verify shift', permission: 'production.verify', intent: 'primary', guard: ({ record, user }) => shiftVerifyProblem(record, user) },
    { from: 'submitted', to: 'open', label: 'Return for correction', permission: 'production.verify', requiresNote: true },
  ],
};

/* ------------------------------------------------------------------ */
const incidentWorkflow: WorkflowDef = {
  initial: 'reported',
  states: [
    { key: 'reported', label: 'Reported', tone: 'red' },
    { key: 'investigating', label: 'Investigating', tone: 'amber' },
    { key: 'actions', label: 'Corrective actions', tone: 'blue' },
    { key: 'closed', label: 'Closed', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'reported', to: 'investigating', label: 'Start investigation', permission: 'safety.investigate', intent: 'primary' },
    { from: 'investigating', to: 'actions', label: 'Agree corrective actions', permission: 'safety.investigate', intent: 'primary', guard: ({ record }) => incidentActionsProblem(record) },
    { from: 'actions', to: 'investigating', label: 'Reopen investigation', permission: 'safety.investigate', requiresNote: true },
    { from: 'actions', to: 'closed', label: 'Close incident', permission: 'safety.investigate', requiresNote: true, intent: 'primary', guard: ({ record }) => incidentCloseProblem(record, todayStr()) },
  ],
};

/* ------------------------------------------------------------------ */
const activation = ({ record, data }: GuardContext) => permitActivationProblems(record, data, todayStr())[0] ?? null;

const permitWorkflow: WorkflowDef = {
  initial: 'requested',
  states: [
    { key: 'requested', label: 'Requested', tone: 'dark' },
    { key: 'approved', label: 'Approved', tone: 'blue' },
    { key: 'active', label: 'Active', tone: 'green' },
    { key: 'suspended', label: 'Suspended', tone: 'red' },
    { key: 'closed', label: 'Closed', tone: 'dark', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    {
      from: 'requested', to: 'approved', label: 'Approve permit', permission: 'permits.issue', intent: 'primary',
      guard: ({ record, data }) => {
        if (str(record, 'validTo') < todayStr()) return `The requested validity ended ${formatDate(str(record, 'validTo'))}. Ask for a new permit.`;
        const c = findRecord(data, 'contractors', str(record, 'contractor'));
        if (c) {
          const cl = contractorClearance(c, todayStr());
          if (!cl.cleared) return `${contractorName(c)} is not cleared for site: ${cl.reasons.join('; ')}.`;
        }
        return null;
      },
    },
    { from: 'approved', to: 'active', label: 'Activate permit', permission: 'permits.issue', intent: 'primary', guard: activation },
    { from: 'active', to: 'suspended', label: 'Suspend permit', permission: 'permits.issue', requiresNote: true, intent: 'danger' },
    { from: 'suspended', to: 'active', label: 'Resume permit', permission: 'permits.issue', guard: activation },
    { from: ['active', 'suspended'], to: 'closed', label: 'Close permit', permission: 'permits.issue', requiresNote: true },
    { from: ['requested', 'approved'], to: 'cancelled', label: 'Cancel permit', permission: 'permits.request', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const workOrderWorkflow: WorkflowDef = {
  initial: 'raised',
  states: [
    { key: 'raised', label: 'Raised', tone: 'dark' },
    { key: 'planned', label: 'Planned', tone: 'blue' },
    { key: 'inprogress', label: 'In progress', tone: 'amber' },
    { key: 'completed', label: 'Completed', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    {
      from: 'raised', to: 'planned', label: 'Plan & assign', permission: 'maintenance', intent: 'primary',
      guard: ({ record }) => (!str(record, 'plannedDate') ? 'Set a planned date.' : !str(record, 'assignedTo') ? 'Assign an artisan.' : null),
    },
    {
      from: ['raised', 'planned'], to: 'inprogress', label: 'Start work', permission: 'maintenance',
      guard: ({ record }) => {
        if (record.status === 'raised' && str(record, 'type') === 'planned') return 'Planned services must be planned and assigned before work starts. Breakdowns can start straight away.';
        if (!str(record, 'assignedTo')) return 'Assign an artisan before starting work.';
        return null;
      },
      after: ({ record, data, api }) => {
        const eq = findRecord(data, 'equipment', str(record, 'equipment'));
        if (eq && str(eq, 'availability') !== 'down') api.update('equipment', eq.id, { availability: 'down' }, `Taken out of service for ${record.ref}`);
      },
    },
    {
      from: 'inprogress', to: 'completed', label: 'Complete work order', permission: 'maintenance', intent: 'primary',
      guard: ({ record, data }) => workOrderCompleteProblem(record, data),
      after: ({ record, data, api, today }) => {
        const eq = findRecord(data, 'equipment', str(record, 'equipment'));
        if (!eq) return;
        const hrs = num(record, 'hoursAtService');
        const v: Values = { engineHours: Math.max(num(eq, 'engineHours'), hrs), availability: 'available' };
        let msg = `Returned to service after ${record.ref}`;
        if (str(record, 'type') === 'planned') {
          const next = hrs + (num(eq, 'serviceInterval') || 250);
          Object.assign(v, { lastServiceHours: hrs, nextServiceHours: next, lastServiceDate: today });
          msg = `Service recorded at ${hrs} h (${record.ref}) — next service due at ${next} h`;
        }
        api.update('equipment', eq.id, v, msg);
        api.update('workorders', record.id, { completedOn: today });
        api.toast(`${str(eq, 'fleetNo')} updated: ${msg}`);
      },
    },
    { from: ['raised', 'planned'], to: 'cancelled', label: 'Cancel', permission: 'maintenance', requiresNote: true, intent: 'danger' },
  ],
};

/* ------------------------------------------------------------------ */
const envWorkflow: WorkflowDef = {
  initial: 'recorded',
  states: [
    { key: 'recorded', label: 'Recorded', tone: 'amber' },
    { key: 'reviewed', label: 'Reviewed', tone: 'green' },
  ],
  transitions: [
    { from: 'recorded', to: 'reviewed', label: 'Mark reviewed', permission: 'environment', intent: 'primary', guard: ({ record, note }) => envReviewProblem(record, note) },
    { from: 'reviewed', to: 'recorded', label: 'Reopen review', permission: 'environment', requiresNote: true },
  ],
};

const phoneRule = (v: unknown) => (/^0\d{2} \d{3} \d{4}$/.test(String(v)) ? null : 'Use the format 0xx xxx xxxx.');

/* ------------------------------------------------------------------ */
const collections: CollectionDef[] = [
  {
    key: 'shifts', singular: 'Shift log', plural: 'Shift logs', refPrefix: 'SHF', workflow: shiftWorkflow, editPermission: 'production.log',
    title: (r) => `${label(SECTIONS, str(r, 'section'))} — ${str(r, 'shift') === 'night' ? 'Night' : 'Day'} shift`,
    subtitle: (r) => `${formatDate(str(r, 'date'))} · ${str(r, 'crew')}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || str(b, 'shift').localeCompare(str(a, 'shift')) || str(a, 'section').localeCompare(str(b, 'section')),
    flags: (r) => {
      const f: Flag[] = [];
      if (r.status !== 'open' && num(r, 'targetTonnes') > 0 && num(r, 'tonnesHoisted') < num(r, 'targetTonnes') * 0.85) f.push({ tone: 'red', label: 'Below 85% of target' });
      if (num(r, 'delayMinutes') > 30 && !str(r, 'delayReason')) f.push({ tone: 'amber', label: 'Delay reason missing' });
      return f;
    },
    fields: [
      { key: 'date', label: 'Shift date', type: 'date', required: true, table: true, validate: (v) => (String(v) > todayStr() ? 'A shift cannot be logged for a future date.' : null) },
      { key: 'shift', label: 'Shift', type: 'select', options: SHIFTS, required: true },
      { key: 'section', label: 'Section', type: 'select', options: SECTIONS, required: true },
      { key: 'crew', label: 'Crew', type: 'text', required: true, placeholder: 'e.g. Crew A — TL name' },
      { key: 'supervisor', label: 'Shift supervisor', type: 'select', options: SUPERVISORS },
      { key: 'tonnesHoisted', label: 'Tonnes hoisted', type: 'number', min: 0, max: 2000, table: true },
      { key: 'targetTonnes', label: 'Target tonnes', type: 'number', min: 0, max: 2000, required: true, table: true, hint: 'From the (fictional) mine plan. Check it if you change the section or shift.' },
      { key: 'delayMinutes', label: 'Delay minutes', type: 'number', min: 0, max: 480, table: true },
      { key: 'delayReason', label: 'Main delay reason', type: 'select', options: DELAY_REASONS, table: true, hint: 'Required before verification when delays exceed 30 minutes.' },
      { key: 'notes', label: 'Shift notes', type: 'textarea' },
    ],
  },
  {
    key: 'incidents', singular: 'Incident', plural: 'Incidents & near misses', refPrefix: 'INC', workflow: incidentWorkflow, editPermission: 'safety.report',
    title: (r) => str(r, 'title'),
    subtitle: (r) => `${label(INCIDENT_TYPES, str(r, 'type'))} · ${label(LOCATIONS, str(r, 'location'))} · ${formatDate(str(r, 'date'))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')),
    createFields: ['date', 'title', 'type', 'category', 'severity', 'lti', 'lostDays', 'location', 'reportedBy', 'description'],
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      if (r.values.lti === true) f.push({ tone: 'red', label: 'Lost-time injury' });
      if (r.status !== 'closed' && ['high', 'critical'].includes(str(r, 'severity'))) f.push({ tone: 'amber', label: `${label(SEVERITIES, str(r, 'severity'))} severity` });
      if (r.status === 'actions' && !r.values.actionsComplete && str(r, 'actionDue') && str(r, 'actionDue') < today) f.push({ tone: 'red', label: 'Actions overdue' });
      return f;
    },
    fields: [
      { key: 'date', label: 'Date of event', type: 'date', required: true, table: true, validate: (v) => (String(v) > todayStr() ? 'The event date cannot be in the future.' : null) },
      { key: 'title', label: 'What happened (short)', type: 'text', required: true, wide: true },
      { key: 'type', label: 'Type', type: 'select', options: INCIDENT_TYPES, required: true, table: true },
      { key: 'category', label: 'Category', type: 'select', options: INCIDENT_CATEGORIES, required: true, table: true },
      { key: 'severity', label: 'Potential severity', type: 'select', options: SEVERITIES, required: true, table: true },
      { key: 'lti', label: 'Lost-time injury (LTI)', type: 'boolean', validate: (v, all) => (v === true && all.type !== 'injury' ? 'A lost-time injury must be recorded as type "Injury".' : null) },
      { key: 'lostDays', label: 'Lost days', type: 'number', min: 0, max: 365 },
      { key: 'location', label: 'Location', type: 'select', options: LOCATIONS, required: true, table: true },
      { key: 'reportedBy', label: 'Reported by', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'rootCause', label: 'Root cause', type: 'textarea' },
      { key: 'correctiveActions', label: 'Corrective actions', type: 'textarea' },
      { key: 'actionOwner', label: 'Action owner', type: 'text' },
      { key: 'actionDue', label: 'Actions due', type: 'date' },
      { key: 'actionsComplete', label: 'Corrective actions complete', type: 'boolean' },
    ],
  },
  {
    key: 'permits', singular: 'Permit to work', plural: 'Permits to work', refPrefix: 'PTW', workflow: permitWorkflow, editPermission: 'permits.request',
    title: (r) => str(r, 'description'),
    subtitle: (r) => `${label(PERMIT_TYPES, str(r, 'type'))} · ${label(LOCATIONS, str(r, 'location'))} · until ${formatDate(str(r, 'validTo'))} ${str(r, 'expiresAt')}`,
    sort: (a, b) => str(b, 'validFrom').localeCompare(str(a, 'validFrom')),
    // Isolation and the gas test are recorded on the permit itself, at the workplace, not when it is requested.
    createFields: ['type', 'location', 'description', 'holder', 'contractor', 'validFrom', 'validTo', 'expiresAt', 'precautions'],
    flags: (r, data, today) => {
      const f: Flag[] = [];
      if (r.status === 'active' && permitExpired(r, today)) f.push({ tone: 'red', label: 'Active past expiry' });
      if (str(r, 'type') === 'confined' && ['requested', 'approved'].includes(r.status ?? '') && gasTestProblem(r.values.gasO2)) f.push({ tone: 'amber', label: r.values.gasO2 === null || r.values.gasO2 === undefined || r.values.gasO2 === '' ? 'Gas test outstanding' : 'Gas test failed' });
      if (['requested', 'approved'].includes(r.status ?? '') && r.values.isolationConfirmed !== true) f.push({ tone: 'amber', label: 'Isolation not confirmed' });
      const c = findRecord(data, 'contractors', str(r, 'contractor'));
      if (c && !['closed', 'cancelled'].includes(r.status ?? '') && !contractorClearance(c, today).cleared) f.push({ tone: 'red', label: 'Contractor not cleared' });
      return f;
    },
    fields: [
      { key: 'type', label: 'Permit type', type: 'select', options: PERMIT_TYPES, required: true, table: true },
      { key: 'location', label: 'Location', type: 'select', options: LOCATIONS, required: true, table: true },
      { key: 'description', label: 'Work to be done', type: 'text', required: true, wide: true },
      { key: 'holder', label: 'Permit holder', type: 'text', required: true, table: true },
      { key: 'contractor', label: 'Contractor (if any)', type: 'ref', ref: 'contractors', hint: 'A contractor must be cleared for site (induction and medical) before approval.' },
      { key: 'validFrom', label: 'Valid from', type: 'date', required: true },
      { key: 'validTo', label: 'Valid until', type: 'date', required: true, table: true, validate: (v, all) => (all.validFrom && String(v) < String(all.validFrom) ? 'Must be on or after the start date.' : null) },
      { key: 'expiresAt', label: 'Expires at', type: 'time', required: true, hint: 'Time on the last day of validity, e.g. 16:00.' },
      { key: 'isolationConfirmed', label: 'Isolation & lock-out confirmed', type: 'boolean' },
      { key: 'isolationPoints', label: 'Isolation points / lock numbers', type: 'textarea' },
      { key: 'gasO2', label: 'Gas test — oxygen (%)', type: 'number', min: 0, max: 30, step: 0.1, hint: `Confined space only. Demo acceptance band ${O2_MIN}–${O2_MAX} %.` },
      { key: 'gasTestedBy', label: 'Gas tested by', type: 'text' },
      { key: 'precautions', label: 'Precautions', type: 'textarea' },
    ],
  },
  {
    key: 'equipment', singular: 'Machine', plural: 'Equipment', refPrefix: 'EQ', editPermission: 'maintenance',
    title: (r) => equipmentLabel(r),
    subtitle: (r) => `${label(EQUIPMENT_CATEGORIES, str(r, 'category'))} · ${label(LOCATIONS, str(r, 'location'))}`,
    sort: (a, b) => str(a, 'fleetNo').localeCompare(str(b, 'fleetNo')),
    createFields: ['fleetNo', 'model', 'category', 'location', 'availability', 'engineHours', 'lastServiceHours', 'serviceInterval', 'nextServiceHours'],
    flags: (r) => {
      const f: Flag[] = [];
      const s = serviceState(r);
      const left = hoursToService(r);
      if (s === 'overdue') f.push({ tone: 'red', label: `Service overdue by ${Math.abs(left)} h` });
      if (s === 'due-soon') f.push({ tone: 'amber', label: `Service due in ${left} h` });
      if (str(r, 'availability') === 'down') f.push({ tone: 'red', label: 'Down for repair' });
      return f;
    },
    fields: [
      { key: 'fleetNo', label: 'Fleet number', type: 'text', required: true },
      { key: 'model', label: 'Model (fictional)', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: EQUIPMENT_CATEGORIES, required: true, table: true },
      { key: 'location', label: 'Location', type: 'select', options: LOCATIONS, table: true },
      { key: 'availability', label: 'Availability', type: 'select', options: AVAILABILITY, required: true, table: true },
      { key: 'engineHours', label: 'Engine / run hours', type: 'number', min: 0, required: true, table: true },
      { key: 'lastServiceHours', label: 'Last service at (h)', type: 'number', min: 0 },
      { key: 'serviceInterval', label: 'Service interval (h)', type: 'number', min: 1, required: true },
      { key: 'nextServiceHours', label: 'Next service at (h)', type: 'number', min: 0, required: true, table: true },
      { key: 'lastServiceDate', label: 'Last service date', type: 'date' },
    ],
  },
  {
    key: 'workorders', singular: 'Work order', plural: 'Work orders', refPrefix: 'WO', workflow: workOrderWorkflow, editPermission: 'maintenance',
    title: (r) => str(r, 'title'),
    subtitle: (r, d) => `${equipmentName(d, r.values.equipment)} · ${label(WO_TYPES, str(r, 'type'))}`,
    sort: (a, b) => str(b, 'raisedOn').localeCompare(str(a, 'raisedOn')),
    createFields: ['equipment', 'type', 'title', 'priority', 'raisedOn', 'plannedDate', 'assignedTo', 'description'],
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      if (['raised', 'planned'].includes(r.status ?? '') && str(r, 'plannedDate') && str(r, 'plannedDate') < today) f.push({ tone: 'red', label: 'Past planned date' });
      if (str(r, 'priority') === 'emergency' && r.status !== 'completed' && r.status !== 'cancelled') f.push({ tone: 'red', label: 'Emergency' });
      if (str(r, 'type') === 'breakdown' && ['raised', 'planned', 'inprogress'].includes(r.status ?? '')) f.push({ tone: 'amber', label: 'Breakdown' });
      return f;
    },
    fields: [
      { key: 'equipment', label: 'Machine', type: 'ref', ref: 'equipment', required: true, table: true },
      { key: 'type', label: 'Type', type: 'select', options: WO_TYPES, required: true, table: true },
      { key: 'title', label: 'Job', type: 'text', required: true, wide: true },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, required: true, table: true },
      { key: 'raisedOn', label: 'Raised on', type: 'date', required: true },
      { key: 'plannedDate', label: 'Planned date', type: 'date', table: true },
      { key: 'assignedTo', label: 'Artisan', type: 'select', options: ARTISANS },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'workDone', label: 'Work done', type: 'textarea' },
      { key: 'hoursAtService', label: 'Hour meter at completion (h)', type: 'number', min: 0 },
      { key: 'downtimeHours', label: 'Downtime (h)', type: 'number', min: 0, max: 720 },
      { key: 'completedOn', label: 'Completed on', type: 'date' },
    ],
  },
  {
    key: 'contractors', singular: 'Contractor', plural: 'Contractors', refPrefix: 'CON', editPermission: 'contractors',
    title: (r) => contractorName(r),
    subtitle: (r) => `${str(r, 'company')} · ${label(TRADES, str(r, 'trade'))}`,
    sort: (a, b) => str(a, 'lastName').localeCompare(str(b, 'lastName')),
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      if (!contractorClearance(r, today).cleared) f.push({ tone: 'red', label: 'Not cleared for site' });
      for (const e of contractorExpiries(r, today)) {
        if (e.state === 'overdue') f.push({ tone: 'red', label: `${e.label} expired` });
        if (e.state === 'due-soon') f.push({ tone: 'amber', label: `${e.label} expires ≤ 30 days` });
      }
      return f;
    },
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true },
      { key: 'lastName', label: 'Surname', type: 'text', required: true },
      { key: 'company', label: 'Company (fictional)', type: 'text', required: true, table: true },
      { key: 'trade', label: 'Trade', type: 'select', options: TRADES, required: true },
      { key: 'phone', label: 'Mobile (fictional)', type: 'text', required: true, validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : 'Enter a valid email address.') },
      { key: 'accessCard', label: 'Access card (demo)', type: 'text' },
      { key: 'inductionExpiry', label: 'Site induction expires', type: 'date', required: true, table: true },
      { key: 'medicalExpiry', label: 'Medical fitness expires', type: 'date', required: true, table: true },
      { key: 'competency', label: 'Competency certificate', type: 'text' },
      { key: 'competencyExpiry', label: 'Competency expires', type: 'date', table: true },
    ],
  },
  {
    key: 'envreadings', singular: 'Monitoring reading', plural: 'Monitoring readings', refPrefix: 'ENV', workflow: envWorkflow, editPermission: 'environment',
    title: (r) => `${envParam(r)?.label ?? 'Reading'} — ${label(ENV_POINTS, str(r, 'point'))}`,
    subtitle: (r) => `${withUnit(str(r, 'value'), envParam(r)?.unit)} · ${formatDate(str(r, 'date'))} ${str(r, 'time')}`,
    sort: (a, b) => (str(b, 'date') + str(b, 'time')).localeCompare(str(a, 'date') + str(a, 'time')),
    flags: (r) => (envExceedance(r) ? [{ tone: 'red', label: 'Outside demo threshold' }] : []),
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, table: true, validate: (v) => (String(v) > todayStr() ? 'A reading cannot be dated in the future.' : null) },
      { key: 'time', label: 'Time', type: 'time' },
      { key: 'point', label: 'Monitoring point', type: 'select', options: ENV_POINTS, required: true, table: true },
      {
        key: 'parameter', label: 'Parameter', type: 'select', options: ENV_PARAMS.map((p) => ({ value: p.value, label: p.unit ? `${p.label} (${p.unit})` : p.label })), required: true, table: true,
        validate: (v, all) => {
          const p = ENV_PARAMS.find((x) => x.value === v);
          if (!p || !all.point || p.points.includes(String(all.point))) return null;
          return `${p.label} is not monitored at ${label(ENV_POINTS, all.point)} in this demo. It is measured at: ${p.points.map((x) => label(ENV_POINTS, x)).join(', ')}.`;
        },
      },
      {
        key: 'value', label: 'Reading', type: 'number', step: 0.01, required: true, table: true,
        validate: (v, all) => {
          const n = Number(v);
          if (all.parameter === 'ph' && (n < 0 || n > 14)) return 'pH must be between 0 and 14.';
          if (all.parameter === 'noise' && (n < 30 || n > 140)) return 'Noise readings are expected between 30 and 140 dB(A).';
          if (n < 0) return 'Readings cannot be negative.';
          return null;
        },
      },
      { key: 'instrument', label: 'Instrument (demo)', type: 'text' },
      { key: 'recordedBy', label: 'Recorded by', type: 'text', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
];

const config: IndustryConfig = {
  id: 'mining',
  industry: 'Mining operations',
  businessName: 'Ridgeback Minerals',
  monogram: 'RM',
  workspaceTag: 'MINE OPERATIONS',
  tagline: 'Kgotso Shaft — underground operations',
  summary: 'A fictional underground mine (Kgotso Shaft): shift production against plan, safety incidents and near misses, permits to work, the equipment fleet and its maintenance, contractor induction and medical clearance, and environmental monitoring.',
  priority: 4,
  theme: { accent: '#9a6b1f', accent2: '#ad7c2a', accentSoft: '#e5c27a', accentTint: '#f6eedd', accentLine: '#ead9b5', accentText: '#6f4c12' },
  roles: [
    { key: 'manager', label: 'Mine manager' },
    { key: 'supervisor', label: 'Shift supervisor' },
    { key: 'safety', label: 'Safety officer' },
    { key: 'maintenance', label: 'Maintenance planner' },
    { key: 'environment', label: 'Environmental officer' },
    { key: 'contractors', label: 'Contractor coordinator' },
  ],
  permissions: [
    { key: 'production.log', label: 'Log production', description: 'Capture and submit shift production logs' },
    { key: 'production.verify', label: 'Verify production', description: 'Verify or return submitted shift logs' },
    { key: 'safety.report', label: 'Report incidents', description: 'Report and edit incidents and near misses' },
    { key: 'safety.investigate', label: 'Investigate incidents', description: 'Run investigations, agree corrective actions and close incidents' },
    { key: 'permits.request', label: 'Request permits', description: 'Raise, edit and cancel permits to work' },
    { key: 'permits.issue', label: 'Issue permits', description: 'Approve, activate, suspend and close permits to work' },
    { key: 'maintenance', label: 'Maintenance', description: 'Manage the equipment register and work orders' },
    { key: 'environment', label: 'Environment', description: 'Record and review environmental monitoring readings' },
    { key: 'contractors', label: 'Contractors', description: 'Manage contractor records, induction and medical dates' },
  ],
  modules: [
    { key: 'production', label: 'Shift production log', icon: IcoPickaxe, group: 'Operations', collection: 'shifts', page: ProductionLog, detail: ShiftDetail, description: 'Tonnes hoisted per shift and section against plan, with delays. Supervisors submit; a different person verifies.' },
    { key: 'reports', label: 'Operations reports', icon: IcoChart, group: 'Operations', page: Reports, description: 'Production trend, delay reasons, incidents by category, planned vs breakdown maintenance and compliance expiries.' },
    { key: 'incidents', label: 'Incidents & near misses', icon: IcoHelmet, group: 'Safety', collection: 'incidents', detail: IncidentDetail, description: 'Report, investigate, agree corrective actions and close safety incidents. Tracks lost-time injuries.' },
    { key: 'permits', label: 'Permits to work', icon: IcoPermit, group: 'Safety', collection: 'permits', view: 'board', detail: PermitDetail, description: 'Hot work, confined space, working at height and electrical isolation permits. Activation needs isolation and, for confined spaces, a passing gas test.' },
    { key: 'equipment', label: 'Equipment register', icon: IcoTruck, group: 'Assets', collection: 'equipment', page: EquipmentPage, detail: EquipmentDetail, description: 'LHDs, drill rigs, locos, fans and pumps with hour meters and service-due tracking.' },
    { key: 'workorders', label: 'Maintenance work orders', icon: IcoWrench, group: 'Assets', collection: 'workorders', view: 'board', page: WorkOrdersPage, detail: WorkOrderDetail, description: 'Planned services and breakdowns from raised to completed. Completing a service resets the machine’s next service.' },
    { key: 'contractors', label: 'Contractors & induction', icon: IcoBriefcase, group: 'Compliance', collection: 'contractors', page: ContractorsPage, detail: ContractorDetail, description: 'Contractor induction, medical fitness and competency expiries. Expired induction or medical means not cleared for site.' },
    { key: 'environment', label: 'Environmental monitoring', icon: IcoLeaf, group: 'Compliance', collection: 'envreadings', page: EnvironmentPage, detail: EnvDetail, description: 'Dust, noise and water pH readings against demo thresholds (not regulatory limits). Exceedances need a review note.' },
  ],
  collections,
  seed: buildMiningSeed,
  dashboard: Dashboard,
  boundaries: [
    'Not a certified safety, health or Mine Health and Safety Act (MHSA) compliance system. Incident, permit and investigation steps are illustrative only.',
    'Permits shown here are not real permits to work and must never be used to authorise work. The oxygen band and other checks are demo rules.',
    'Environmental thresholds are demo thresholds, not regulatory or licence limits.',
    'No telemetry, SCADA, hoist, fleet-management or gas-monitoring integration — every number is typed in or invented seed data.',
    'Production figures are not reconciled to any survey, assay or plant measurement.',
    'All people, companies, fleet numbers, sections and access-card numbers are fictional.',
  ],
  guide: [
    { title: 'Submit a shift', detail: 'Today’s Level 7 East day shift is open. Type the tonnes in “Shift figures”, save, then press “Submit shift”.', to: 'production/shifts_535', as: 'u_pc' },
    { title: 'Verify a shift as someone else', detail: 'Verify a log under “Awaiting verification”. Level 7 West night is refused — 55 delay minutes, no reason. Open it and record one.', to: 'production', as: 'u_mm' },
    { title: 'Activate a confined-space permit', detail: 'Blocked: the oxygen reading of 18.9 % failed. Record a re-test of 20.9 %, then press “Activate permit”.', to: 'permits/permits_4', as: 'u_so' },
    { title: 'Investigate an incident', detail: 'Record the root cause and corrective actions, agree them, mark them complete — only then will the incident close.', to: 'incidents/incidents_12', as: 'u_so' },
    { title: 'Complete an overdue service', detail: 'Start the work, enter the hour-meter reading and the work done, and complete. The loader’s next service moves on 250 hours.', to: 'workorders/workorders_13', as: 'u_mp' },
    { title: 'Review a dust exceedance', detail: 'Above the demo threshold, so “Mark reviewed” is refused without a note. Add the follow-up note and review it.', to: 'environment/envreadings_40', as: 'u_eo' },
  ],
  highlights: [
    'Shift production log with month-to-date tonnes vs plan and verification rules',
    'Permits to work: isolation and confined-space gas test enforced before activation',
    'Incidents with root cause → corrective actions → close-out, and days since last LTI',
    'Fleet service tracking: completing a work order resets the machine’s next service',
  ],
};

export default config;
