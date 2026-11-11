// Construction contractor demo. Fictional business: Ironbark Building & Civils,
// an invented South African building and civils contractor. Not a contract
// administration, payment-certificate or Construction Regulations system.
import type { CollectionDef, Flag, IndustryConfig, WorkflowDef } from '../../core/types';
import { currentUser, findRecord, num, str } from '../../core/engine';
import { addDays, daysBetween, formatDate } from '../../core/lib/dates';
import { toCents } from '../../core/lib/money';
import { IcoAlert, IcoBox, IcoBriefcase, IcoCalendar, IcoDoc, IcoFlag, IcoHelmet, IcoReceipt, IcoTruck, IcoUsers } from '../../core/components/Icons';
import {
  CONTRACT_TYPES, DELAY_CAUSES, OWNERSHIP, PLANT_STATES, PLANT_TYPES, PROJECT_KINDS, PROJECT_MANAGERS, SAFETY_TYPES, SEVERITIES, SNAG_CATEGORIES,
  SUPPLIERS, TRADES, WEATHER, label,
} from './data';
import { buildConstructionSeed } from './seed';
import {
  completionDue, deliveryLate, deliveryProblem, diaryLabour, diarySignProblem, finalCompletionProblem, isRainDay, openCriticalSnags, openValuations,
  plantAlerts, practicalCompletionProblem, programmeProgress, projectName, purchaseOrderProblem, rand, randShort, requisitionApproveProblem,
  requisitionValue, safetyCloseProblem, startOnSiteProblem, subcontractorCompliance, subcontractorExpiries, taskSlip, todayStr, valuationCertifyProblem,
  valuationFigures, valuationSubmitProblem, variationPriceProblem, variationSubcontractorProblem, variationSubmitProblem,
} from './helpers';
export * from './helpers';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import Programme from './pages/Programme';
import SiteDiary from './pages/SiteDiary';
import ValuationDetail from './pages/ValuationDetail';
import PlantDetail from './pages/PlantDetail';
import SubcontractorDetail from './pages/SubcontractorDetail';
import DiaryDetail from './pages/DiaryDetail';
import VariationDetail from './pages/VariationDetail';
import SnagDetail from './pages/SnagDetail';
import RequisitionDetail from './pages/RequisitionDetail';
import SafetyDetail from './pages/SafetyDetail';
import { PlantPage, ProcurementPage, SafetyPage, SnagsPage, SubcontractorsPage, ValuationsPage, VariationsPage } from './pages/Registers';

const afterDate = (startKey: string, what: string) => (v: unknown, all: Record<string, unknown>) =>
  all[startKey] && String(v) < String(all[startKey]) ? `Must be on or after the ${what}.` : null;

/* ------------------------------------------------------------------ */
const projectWorkflow: WorkflowDef = {
  initial: 'tender',
  states: [
    { key: 'tender', label: 'Tender', tone: 'dark' },
    { key: 'awarded', label: 'Awarded', tone: 'blue' },
    { key: 'onsite', label: 'On site', tone: 'accent' },
    { key: 'onhold', label: 'On hold', tone: 'amber' },
    { key: 'practical', label: 'Practical completion', tone: 'green' },
    { key: 'final', label: 'Final completion', tone: 'green', terminal: true },
    { key: 'lost', label: 'Not awarded', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'tender', to: 'awarded', label: 'Mark awarded', permission: 'projects.manage', intent: 'primary', guard: ({ record }) => (num(record, 'contractValue') > 0 ? null : 'Record the contract value before marking the tender awarded.') },
    { from: 'tender', to: 'lost', label: 'Not awarded', permission: 'projects.manage', requiresNote: true, intent: 'danger' },
    { from: 'awarded', to: 'onsite', label: 'Start on site', permission: 'projects.manage', intent: 'primary', guard: ({ record }) => startOnSiteProblem(record) },
    { from: ['awarded', 'onsite'], to: 'onhold', label: 'Put on hold', permission: 'projects.manage', requiresNote: true, noteHint: 'say why work is stopping', intent: 'danger' },
    { from: 'onhold', to: 'onsite', label: 'Resume work', permission: 'projects.manage', guard: ({ record }) => startOnSiteProblem(record) },
    {
      from: 'onsite', to: 'practical', label: 'Certify practical completion', permission: 'projects.manage', intent: 'primary',
      guard: ({ record, data }) => practicalCompletionProblem(record, data),
      after: ({ record, api, today }) => api.update('projects', record.id, { practicalCompletionDate: today }),
    },
    {
      from: 'practical', to: 'final', label: 'Certify final completion', permission: 'projects.manage', intent: 'primary',
      guard: ({ record, data }) => finalCompletionProblem(record, data),
      after: ({ record, api, today }) => api.update('projects', record.id, { finalCompletionDate: today }),
    },
  ],
};

const taskWorkflow: WorkflowDef = {
  initial: 'planned',
  states: [
    { key: 'planned', label: 'Not started', tone: 'dark' },
    { key: 'inprogress', label: 'In progress', tone: 'amber' },
    { key: 'complete', label: 'Complete', tone: 'green' },
  ],
  transitions: [
    {
      from: 'planned', to: 'inprogress', label: 'Start task', permission: 'programme', intent: 'primary',
      after: ({ record, api, today }) => api.update('tasks', record.id, { actualStart: str(record, 'actualStart') || today }),
    },
    {
      from: ['planned', 'inprogress'], to: 'complete', label: 'Mark complete', permission: 'programme', intent: 'primary',
      guard: ({ record }) => (record.status === 'planned' && record.values.milestone !== true ? 'Start the task before completing it (only milestones complete directly).' : null),
      after: ({ record, api, today }) => api.update('tasks', record.id, { pctComplete: 100, actualStart: str(record, 'actualStart') || today, actualFinish: today }),
    },
    {
      from: 'complete', to: 'inprogress', label: 'Reopen task', permission: 'programme', requiresNote: true,
      after: ({ record, api }) => api.update('tasks', record.id, { actualFinish: '', pctComplete: Math.min(95, num(record, 'pctComplete')) }),
    },
  ],
};

const diaryWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'amber' },
    { key: 'signed', label: 'Signed', tone: 'green' },
  ],
  transitions: [
    {
      from: 'draft', to: 'signed', label: 'Sign diary', permission: 'diary.sign', intent: 'primary',
      guard: ({ record }) => diarySignProblem(record),
      after: ({ record, api, user }) => api.update('diary', record.id, { signedBy: user.name }),
    },
    { from: 'signed', to: 'draft', label: 'Reopen entry', permission: 'diary.sign', requiresNote: true },
  ],
};

const variationWorkflow: WorkflowDef = {
  initial: 'instructed',
  states: [
    { key: 'instructed', label: 'Instructed', tone: 'dark' },
    { key: 'priced', label: 'Priced', tone: 'blue' },
    { key: 'submitted', label: 'Submitted to client', tone: 'amber' },
    { key: 'approved', label: 'Approved', tone: 'green', terminal: true },
    { key: 'rejected', label: 'Rejected', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'instructed', to: 'priced', label: 'Mark priced', permission: 'variations.price', intent: 'primary', guard: ({ record, data }) => variationPriceProblem(record, data, todayStr()) },
    { from: 'priced', to: 'submitted', label: 'Submit to client', permission: 'variations.price', intent: 'primary', guard: ({ record, data }) => variationSubmitProblem(record, data, todayStr()) },
    {
      from: 'submitted', to: 'approved', label: 'Record client approval', permission: 'variations.approve', intent: 'primary',
      guard: ({ record, data }) => variationSubcontractorProblem(record, data, todayStr()),
      after: ({ record, api, today }) => api.update('variations', record.id, { approvedOn: today }),
    },
    { from: 'submitted', to: 'rejected', label: 'Record rejection', permission: 'variations.approve', requiresNote: true, noteHint: 'record the client’s reason', intent: 'danger' },
    { from: 'rejected', to: 'priced', label: 'Re-price for resubmission', permission: 'variations.price', requiresNote: true },
  ],
};

const valuationWorkflow: WorkflowDef = {
  initial: 'draft',
  states: [
    { key: 'draft', label: 'Draft', tone: 'dark' },
    { key: 'submitted', label: 'Submitted', tone: 'amber' },
    { key: 'certified', label: 'Certified', tone: 'blue' },
    { key: 'paid', label: 'Paid', tone: 'green', terminal: true },
  ],
  transitions: [
    {
      from: 'draft', to: 'submitted', label: 'Submit valuation', permission: 'valuations', intent: 'primary',
      guard: ({ record, data }) => valuationSubmitProblem(record, data),
      after: ({ record, data, api, today }) => api.update('valuations', record.id, { submittedAmount: valuationFigures(data, record).amountDue / 100, submittedOn: today }),
    },
    { from: 'submitted', to: 'draft', label: 'Withdraw to draft', permission: 'valuations', requiresNote: true, after: ({ record, api }) => api.update('valuations', record.id, { submittedAmount: '', submittedOn: '' }) },
    {
      from: 'submitted', to: 'certified', label: 'Record certificate', permission: 'valuations', intent: 'primary',
      guard: ({ record }) => valuationCertifyProblem(record),
      after: ({ record, api, today }) => api.update('valuations', record.id, { certifiedOn: str(record, 'certifiedOn') || today }),
    },
    { from: 'certified', to: 'paid', label: 'Mark paid', permission: 'valuations', intent: 'primary', after: ({ record, api, today }) => api.update('valuations', record.id, { paidOn: today }) },
  ],
};

const requisitionWorkflow: WorkflowDef = {
  initial: 'requested',
  states: [
    { key: 'requested', label: 'Requested', tone: 'dark' },
    { key: 'approved', label: 'Approved', tone: 'blue' },
    { key: 'ordered', label: 'PO issued', tone: 'amber' },
    { key: 'partial', label: 'Part delivered', tone: 'amber' },
    { key: 'delivered', label: 'Delivered', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'requested', to: 'approved', label: 'Approve requisition', permission: 'projects.manage', intent: 'primary', guard: ({ record }) => requisitionApproveProblem(record) },
    {
      from: 'approved', to: 'ordered', label: 'Issue purchase order', permission: 'procurement', intent: 'primary',
      guard: ({ record }) => purchaseOrderProblem(record),
      after: ({ record, api }) => { if (!str(record, 'poNumber')) api.update('requisitions', record.id, { poNumber: `PO-DEMO-${record.ref.split('-').pop()}` }); },
    },
    { from: 'ordered', to: 'partial', label: 'Receive part delivery', permission: 'procurement', guard: ({ record }) => deliveryProblem(record), after: ({ record, api, today }) => api.update('requisitions', record.id, { receivedOn: today }) },
    { from: ['ordered', 'partial'], to: 'delivered', label: 'Receive in full', permission: 'procurement', intent: 'primary', guard: ({ record }) => deliveryProblem(record), after: ({ record, api, today }) => api.update('requisitions', record.id, { receivedOn: today }) },
    { from: ['requested', 'approved'], to: 'cancelled', label: 'Cancel requisition', permission: 'procurement.request', requiresNote: true, intent: 'danger' },
  ],
};

const snagWorkflow: WorkflowDef = {
  initial: 'open',
  states: [
    { key: 'open', label: 'Open', tone: 'red' },
    { key: 'fixed', label: 'Fixed — awaiting check', tone: 'amber' },
    { key: 'verified', label: 'Verified closed', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'open', to: 'fixed', label: 'Mark fixed', permission: 'snags', intent: 'primary', after: ({ record, api, today }) => api.update('snags', record.id, { fixedOn: today }) },
    { from: 'fixed', to: 'verified', label: 'Verify fix', permission: 'projects.manage', requiresNote: true, noteHint: 'say what was inspected and accepted', intent: 'primary' },
    { from: 'fixed', to: 'open', label: 'Reject fix', permission: 'projects.manage', requiresNote: true, noteHint: 'say what is still wrong', intent: 'danger' },
  ],
};

const safetyWorkflow: WorkflowDef = {
  initial: 'open',
  states: [
    { key: 'open', label: 'Open', tone: 'amber' },
    { key: 'closed', label: 'Closed out', tone: 'green' },
  ],
  transitions: [
    { from: 'open', to: 'closed', label: 'Close out', permission: 'safety', intent: 'primary', guard: ({ record }) => safetyCloseProblem(record) },
    { from: 'closed', to: 'open', label: 'Reopen', permission: 'safety', requiresNote: true },
  ],
};

const phoneRule = (v: unknown) => (/^0\d{2} \d{3} \d{4}$/.test(String(v)) ? null : 'Use the format 0xx xxx xxxx.');
const emailRule = (v: unknown) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : 'Enter a valid email address.');

/* ------------------------------------------------------------------ */
const collections: CollectionDef[] = [
  {
    key: 'projects', singular: 'Project', plural: 'Projects', refPrefix: 'PRJ', workflow: projectWorkflow, editPermission: 'projects.manage',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `${str(r, 'client')} · ${randShort(num(r, 'contractValue'))} · ${label(CONTRACT_TYPES, str(r, 'contractType'))}`,
    sort: (a, b) => str(b, 'startDate').localeCompare(str(a, 'startDate')),
    createFields: ['name', 'client', 'site', 'kind', 'contractType', 'contractValue', 'startDate', 'plannedCompletion', 'retentionPct', 'projectManager', 'siteAgent', 'budgetCost'],
    createDefaults: () => ({ kind: 'building', contractType: 'lumpsum', retentionPct: 5 }),
    flags: (r, data, today) => {
      const f: Flag[] = [];
      if (r.status === 'onhold') f.push({ tone: 'amber', label: 'On hold' });
      if (r.status === 'onsite' && completionDue(r) && completionDue(r) < today) f.push({ tone: 'red', label: `Past completion date by ${daysBetween(completionDue(r), today)} d` });
      if (r.status === 'onsite') {
        const p = programmeProgress(data, r, today);
        if (p.elapsed - p.pct > 10) f.push({ tone: 'amber', label: `Programme behind (${p.pct}% done, ${p.elapsed}% time)` });
      }
      const crit = openCriticalSnags(data, r.id).length;
      if (crit && ['onsite', 'practical'].includes(r.status ?? '')) f.push({ tone: 'red', label: `${crit} open critical snag${crit === 1 ? '' : 's'}` });
      return f;
    },
    fields: [
      { key: 'name', label: 'Project name', type: 'text', required: true, wide: true },
      { key: 'client', label: 'Client (fictional)', type: 'text', required: true, table: true },
      { key: 'site', label: 'Site', type: 'text' },
      { key: 'kind', label: 'Work type', type: 'select', options: PROJECT_KINDS, required: true },
      { key: 'contractType', label: 'Contract type', type: 'select', options: CONTRACT_TYPES, required: true },
      { key: 'contractValue', label: 'Contract value (excl. VAT)', type: 'money', min: 0, required: true, table: true },
      { key: 'startDate', label: 'Start on site', type: 'date' },
      { key: 'plannedCompletion', label: 'Planned completion', type: 'date', table: true, validate: afterDate('startDate', 'start date') },
      { key: 'eotDaysGranted', label: 'Extension of time granted (days)', type: 'number', min: 0, max: 365 },
      { key: 'retentionPct', label: 'Retention %', type: 'number', min: 0, max: 10, step: 0.5, required: true, hint: 'Held on each valuation, capped at a demo 5 % of the contract value.' },
      { key: 'projectManager', label: 'Project manager', type: 'select', options: PROJECT_MANAGERS, required: true, table: true },
      { key: 'siteAgent', label: 'Site agent', type: 'text' },
      { key: 'budgetCost', label: 'Cost budget', type: 'money', min: 0 },
      { key: 'otherCostToDate', label: 'Labour & subcontract cost to date (demo)', type: 'money', min: 0, hint: 'Typed figure; materials and plant hire are added from the records.' },
      { key: 'practicalCompletionDate', label: 'Practical completion date', type: 'date' },
      { key: 'finalCompletionDate', label: 'Final completion date', type: 'date' },
      { key: 'retentionReleaseCert', label: 'Retention release certificate received (demo)', type: 'boolean' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'tasks', singular: 'Programme task', plural: 'Programme tasks', refPrefix: 'TSK', workflow: taskWorkflow, editPermission: 'programme',
    title: (r) => str(r, 'name'),
    subtitle: (r, d) => `${projectName(d, r.values.project)} · ${formatDate(str(r, 'plannedStart'))} → ${formatDate(str(r, 'plannedFinish'))}`,
    sort: (a, b) => str(a, 'project').localeCompare(str(b, 'project')) || str(a, 'plannedStart').localeCompare(str(b, 'plannedStart')),
    createFields: ['project', 'name', 'milestone', 'plannedStart', 'plannedFinish', 'pctComplete', 'subcontractor'],
    flags: (r, data, today) => {
      const f: Flag[] = [];
      const s = taskSlip(r, today);
      if (s.state === 'overdue') f.push({ tone: 'red', label: `${r.values.milestone === true ? 'Milestone' : 'Task'} overdue ${s.days} d` });
      if (s.state === 'behind') f.push({ tone: 'amber', label: `Slipping — ${s.gap} pts behind plan` });
      if (s.state === 'late') f.push({ tone: 'dark', label: `Finished ${s.days} d late` });
      const sub = findRecord(data, 'subcontractors', str(r, 'subcontractor'));
      if (sub && r.status !== 'complete' && !subcontractorCompliance(sub, today).ok) f.push({ tone: 'red', label: 'Subcontractor not compliant' });
      return f;
    },
    fields: [
      { key: 'project', label: 'Project', type: 'ref', ref: 'projects', required: true, table: true },
      { key: 'name', label: 'Task / activity', type: 'text', required: true, wide: true },
      { key: 'milestone', label: 'Milestone', type: 'boolean' },
      { key: 'plannedStart', label: 'Planned start', type: 'date', required: true, table: true },
      { key: 'plannedFinish', label: 'Planned finish', type: 'date', required: true, table: true, validate: afterDate('plannedStart', 'planned start') },
      { key: 'actualStart', label: 'Actual start', type: 'date' },
      { key: 'actualFinish', label: 'Actual finish', type: 'date', validate: afterDate('actualStart', 'actual start') },
      { key: 'pctComplete', label: '% complete', type: 'number', min: 0, max: 100, table: true },
      { key: 'subcontractor', label: 'Subcontractor', type: 'ref', ref: 'subcontractors' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'diary', singular: 'Site diary entry', plural: 'Site diary', refPrefix: 'SD', workflow: diaryWorkflow, editPermission: 'diary',
    title: (r, d) => `${projectName(d, r.values.project)} — ${formatDate(str(r, 'date'))}`,
    subtitle: (r) => `${label(WEATHER, str(r, 'weather'))} · ${diaryLabour(r)} on site${num(r, 'delayHours') ? ` · ${num(r, 'delayHours')} h delay` : ''}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')) || str(a, 'project').localeCompare(str(b, 'project')),
    createFields: ['project', 'date', 'weather', 'labourGeneral', 'labourArtisans', 'labourSteel', 'labourSubcontract', 'plantOnSite', 'workDone', 'delayHours', 'delayCause', 'delayNotes', 'visitors'],
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      if (isRainDay(r)) f.push({ tone: 'blue', label: 'Rain day' });
      if ((num(r, 'delayHours') > 0 || isRainDay(r)) && !str(r, 'delayCause')) f.push({ tone: 'red', label: 'Delay cause missing' });
      if (r.status === 'draft' && str(r, 'date') && daysBetween(str(r, 'date'), today) > 1) f.push({ tone: 'amber', label: 'Unsigned' });
      return f;
    },
    fields: [
      { key: 'project', label: 'Project', type: 'ref', ref: 'projects', required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true, validate: (v) => (String(v) > todayStr() ? 'A diary entry cannot be dated in the future.' : null) },
      { key: 'weather', label: 'Weather', type: 'select', options: WEATHER, required: true, table: true },
      { key: 'labourGeneral', label: 'General workers', type: 'number', min: 0, max: 500 },
      { key: 'labourArtisans', label: 'Artisans (bricklayers, carpenters, operators)', type: 'number', min: 0, max: 500 },
      { key: 'labourSteel', label: 'Steel fixers / shutterhands', type: 'number', min: 0, max: 500 },
      { key: 'labourSubcontract', label: 'Subcontractor labour', type: 'number', min: 0, max: 500 },
      { key: 'plantOnSite', label: 'Plant on site', type: 'text', wide: true },
      { key: 'workDone', label: 'Work done', type: 'textarea' },
      { key: 'delayHours', label: 'Delay (hours)', type: 'number', min: 0, max: 24, table: true },
      { key: 'delayCause', label: 'Delay cause', type: 'select', options: DELAY_CAUSES, table: true, hint: 'Required before signing when a delay or rain day is recorded.' },
      { key: 'delayNotes', label: 'Delay details', type: 'textarea' },
      { key: 'visitors', label: 'Visitors', type: 'text', wide: true },
      { key: 'signedBy', label: 'Signed by', type: 'text' },
    ],
  },
  {
    key: 'variations', singular: 'Variation', plural: 'Variations', refPrefix: 'VO', workflow: variationWorkflow, editPermission: 'variations.record',
    title: (r) => str(r, 'description'),
    subtitle: (r, d) => `${str(r, 'instructionRef') || 'No SI ref'} · ${projectName(d, r.values.project)}${num(r, 'value') ? ` · ${rand(toCents(num(r, 'value')))}` : ''}`,
    sort: (a, b) => str(b, 'instructedOn').localeCompare(str(a, 'instructedOn')),
    createFields: ['project', 'instructionRef', 'description', 'instructedBy', 'instructedOn', 'value', 'timeImpactDays', 'subcontractor', 'notes'],
    createDefaults: (today) => ({ instructedOn: today, timeImpactDays: 0 }),
    flags: (r, data, today) => {
      const f: Flag[] = [];
      if (!str(r, 'instructionRef') && !['approved', 'rejected'].includes(r.status ?? '')) f.push({ tone: 'amber', label: 'Verbal — no SI reference' });
      if (r.status === 'instructed' && str(r, 'instructedOn') && daysBetween(str(r, 'instructedOn'), today) > 7) f.push({ tone: 'amber', label: 'Not priced after 7 days' });
      if (r.status === 'submitted') {
        const since = r.history.filter((h) => h.action === 'Submit to client').pop();
        const days = since ? daysBetween(since.at.slice(0, 10), today) : 0;
        if (days > 14) f.push({ tone: 'amber', label: `Awaiting client ${days} d` });
      }
      const sub = findRecord(data, 'subcontractors', str(r, 'subcontractor'));
      if (sub && !['approved', 'rejected'].includes(r.status ?? '') && !subcontractorCompliance(sub, today).ok) f.push({ tone: 'red', label: 'Subcontractor not compliant' });
      return f;
    },
    fields: [
      { key: 'project', label: 'Project', type: 'ref', ref: 'projects', required: true, table: true },
      { key: 'instructionRef', label: 'Site instruction ref', type: 'text', placeholder: 'e.g. SI-014', table: true, hint: 'Required before submitting to the client.' },
      { key: 'description', label: 'Description', type: 'text', required: true, wide: true },
      { key: 'instructedBy', label: 'Instructed by', type: 'text' },
      { key: 'instructedOn', label: 'Instructed on', type: 'date', required: true },
      { key: 'value', label: 'Priced value (excl. VAT)', type: 'money', min: 0, table: true },
      { key: 'timeImpactDays', label: 'Time impact (days)', type: 'number', min: 0, max: 365, table: true },
      { key: 'subcontractor', label: 'Subcontractor carrying out the work', type: 'ref', ref: 'subcontractors', hint: 'Must be compliant (COIDA, tax, safety file) to price, submit or approve.' },
      { key: 'approvedOn', label: 'Approved on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'valuations', singular: 'Payment valuation', plural: 'Payment valuations', refPrefix: 'VAL', workflow: valuationWorkflow, editPermission: 'valuations',
    title: (r, d) => `Valuation ${num(r, 'valuationNo')} — ${projectName(d, r.values.project)}`,
    subtitle: (r, d) => `Valuation date ${formatDate(str(r, 'periodEnd'))} · due ${rand(valuationFigures(d, r).amountDue)} excl. VAT`,
    sort: (a, b) => str(b, 'periodEnd').localeCompare(str(a, 'periodEnd')) || str(a, 'project').localeCompare(str(b, 'project')),
    createFields: ['project', 'valuationNo', 'periodEnd', 'workDone', 'materialsOnSite', 'variationsToDate', 'notes'],
    createDefaults: (today) => ({ periodEnd: today, materialsOnSite: 0, variationsToDate: 0 }),
    flags: (r, data, today) => {
      const f: Flag[] = [];
      if (r.status === 'draft' && openValuations(data, str(r, 'project'), r.id).length) f.push({ tone: 'red', label: 'Another valuation is open' });
      if (r.status === 'submitted' && str(r, 'submittedOn') && daysBetween(str(r, 'submittedOn'), today) > 14) f.push({ tone: 'amber', label: `Awaiting certificate ${daysBetween(str(r, 'submittedOn'), today)} d` });
      if (r.status === 'certified' && str(r, 'certifiedOn') && daysBetween(str(r, 'certifiedOn'), today) > 30) f.push({ tone: 'red', label: 'Payment overdue' });
      return f;
    },
    fields: [
      { key: 'project', label: 'Project', type: 'ref', ref: 'projects', required: true, table: true },
      { key: 'valuationNo', label: 'Valuation no.', type: 'number', min: 1, max: 99, required: true, table: true },
      { key: 'periodEnd', label: 'Valuation date', type: 'date', required: true, table: true },
      { key: 'workDone', label: 'Work done to date', type: 'money', min: 0, required: true, table: true },
      { key: 'materialsOnSite', label: 'Materials on site', type: 'money', min: 0 },
      { key: 'variationsToDate', label: 'Approved variations to date', type: 'money', min: 0 },
      { key: 'submittedAmount', label: 'Amount submitted (excl. VAT)', type: 'money', hint: 'Set automatically when the valuation is submitted.' },
      { key: 'certifiedAmount', label: 'Amount certified (excl. VAT)', type: 'money', hint: 'From the payment certificate. Cannot exceed the amount submitted.' },
      { key: 'certificateRef', label: 'Certificate ref (demo)', type: 'text' },
      { key: 'submittedOn', label: 'Submitted on', type: 'date' },
      { key: 'certifiedOn', label: 'Certified on', type: 'date' },
      { key: 'paidOn', label: 'Paid on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'requisitions', singular: 'Requisition', plural: 'Requisitions & POs', refPrefix: 'REQ', workflow: requisitionWorkflow, editPermission: 'procurement.request',
    title: (r) => str(r, 'description'),
    subtitle: (r, d) => `${projectName(d, r.values.project)} · ${rand(requisitionValue(r))} excl. VAT${str(r, 'poNumber') ? ` · ${str(r, 'poNumber')}` : ''}`,
    sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
    createFields: ['project', 'description', 'supplier', 'requiredBy', 'lines', 'notes'],
    createDefaults: (today, data) => ({ requiredBy: addDays(today, 7), requestedBy: currentUser(data).name }),
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      if (deliveryLate(r, today)) f.push({ tone: 'red', label: `Delivery late ${daysBetween(str(r, 'expectedDelivery'), today)} d` });
      if (['requested', 'approved'].includes(r.status ?? '') && str(r, 'requiredBy') && str(r, 'requiredBy') < today) f.push({ tone: 'amber', label: 'Required-by date passed' });
      return f;
    },
    fields: [
      { key: 'project', label: 'Project', type: 'ref', ref: 'projects', required: true, table: true },
      { key: 'description', label: 'What is needed', type: 'text', required: true, wide: true },
      { key: 'supplier', label: 'Supplier', type: 'select', options: SUPPLIERS, table: true },
      { key: 'requestedBy', label: 'Requested by', type: 'text' },
      { key: 'requiredBy', label: 'Required on site by', type: 'date' },
      { key: 'lines', label: 'Items', type: 'lines' },
      { key: 'poNumber', label: 'PO number (demo)', type: 'text', table: true },
      { key: 'expectedDelivery', label: 'Expected delivery', type: 'date', table: true },
      { key: 'deliveryNote', label: 'Delivery note no.', type: 'text', hint: 'Required to receive goods.' },
      { key: 'receivedOn', label: 'Received on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'plant', singular: 'Plant item', plural: 'Plant & equipment', refPrefix: 'PL', editPermission: 'plant',
    title: (r) => `${str(r, 'fleetNo')} — ${str(r, 'description')}`,
    subtitle: (r, d) => `${label(OWNERSHIP, str(r, 'ownership'))} · ${str(r, 'project') ? projectName(d, r.values.project) : 'Yard'}`,
    sort: (a, b) => str(a, 'ownership').localeCompare(str(b, 'ownership')) || str(a, 'fleetNo').localeCompare(str(b, 'fleetNo')),
    flags: (r, _d, today) => plantAlerts(r, today),
    createDefaults: () => ({ ownership: 'owned', state: 'yard' }),
    fields: [
      { key: 'description', label: 'Description', type: 'text', required: true },
      { key: 'fleetNo', label: 'Fleet / hire no.', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'select', options: PLANT_TYPES, required: true, table: true },
      {
        key: 'ownership', label: 'Ownership', type: 'select', options: OWNERSHIP, required: true, table: true,
        validate: (v, all) => (v === 'hired' && (!all.hireStart || !(Number(all.dailyRate) > 0)) ? 'Hired plant needs a hire start date and a daily hire rate.' : null),
      },
      { key: 'project', label: 'Location (project)', type: 'ref', ref: 'projects', table: true },
      { key: 'state', label: 'State', type: 'select', options: PLANT_STATES, required: true, table: true },
      { key: 'hireCompany', label: 'Hire company (fictional)', type: 'text' },
      { key: 'hireStart', label: 'On hire from', type: 'date' },
      { key: 'offHireDue', label: 'Planned off-hire', type: 'date', table: true, validate: afterDate('hireStart', 'hire start') },
      { key: 'offHiredOn', label: 'Off-hired on', type: 'date', validate: afterDate('hireStart', 'hire start') },
      { key: 'dailyRate', label: 'Daily hire rate (excl. VAT)', type: 'money', min: 0 },
      { key: 'nextServiceDue', label: 'Next service due', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'snags', singular: 'Snag', plural: 'Snags & defects', refPrefix: 'SNG', workflow: snagWorkflow, editPermission: 'snags',
    title: (r) => str(r, 'description'),
    subtitle: (r, d) => `${projectName(d, r.values.project)} · ${str(r, 'location')} · ${str(r, 'category') ? label(SNAG_CATEGORIES, str(r, 'category')) : 'Not categorised'}`,
    sort: (a, b) => {
      const rank = (r: typeof a) => ({ critical: 0, major: 1, minor: 2 } as Record<string, number>)[str(r, 'category')] ?? -1;
      return rank(a) - rank(b) || str(b, 'raisedOn').localeCompare(str(a, 'raisedOn'));
    },
    createFields: ['project', 'location', 'description', 'category', 'responsible', 'raisedOn', 'dueBy'],
    createDefaults: (today) => ({ raisedOn: today, dueBy: addDays(today, 14) }),
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      if (str(r, 'category') === 'critical' && r.status !== 'verified') f.push({ tone: 'red', label: 'Open critical' });
      if (!str(r, 'category')) f.push({ tone: 'amber', label: 'Not categorised' });
      if (r.status === 'open' && str(r, 'dueBy') && str(r, 'dueBy') < today) f.push({ tone: 'red', label: 'Past due date' });
      return f;
    },
    fields: [
      { key: 'project', label: 'Project', type: 'ref', ref: 'projects', required: true, table: true },
      { key: 'location', label: 'Location', type: 'text', required: true, table: true },
      { key: 'description', label: 'Defect', type: 'text', required: true, wide: true },
      { key: 'category', label: 'Category', type: 'select', options: SNAG_CATEGORIES, table: true, hint: 'Every snag must be categorised before practical completion.' },
      { key: 'responsible', label: 'Responsible subcontractor', type: 'ref', ref: 'subcontractors' },
      { key: 'raisedOn', label: 'Raised on', type: 'date', required: true },
      { key: 'dueBy', label: 'Due by', type: 'date', table: true },
      { key: 'fixedOn', label: 'Fixed on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'subcontractors', singular: 'Subcontractor', plural: 'Subcontractors', refPrefix: 'SUB', editPermission: 'subcontractors',
    title: (r) => str(r, 'company'),
    subtitle: (r) => `${label(TRADES, str(r, 'trade'))} · CIDB ${str(r, 'cidbGrade') || '—'}`,
    sort: (a, b) => str(a, 'company').localeCompare(str(b, 'company')),
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      if (!subcontractorCompliance(r, today).ok) f.push({ tone: 'red', label: 'Not compliant' });
      for (const e of subcontractorExpiries(r, today)) {
        if (e.state === 'overdue') f.push({ tone: 'red', label: `${e.label} expired` });
        if (e.state === 'due-soon') f.push({ tone: 'amber', label: `${e.label} expires ≤ 30 d` });
      }
      if (r.values.safetyFileApproved !== true) f.push({ tone: 'amber', label: 'Safety file not approved' });
      return f;
    },
    fields: [
      { key: 'company', label: 'Company (fictional)', type: 'text', required: true },
      { key: 'trade', label: 'Trade', type: 'select', options: TRADES, required: true, table: true },
      { key: 'contactName', label: 'Contact person', type: 'text', required: true },
      { key: 'phone', label: 'Phone (fictional)', type: 'text', required: true, validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'cidbRegNo', label: 'CIDB registration (demo)', type: 'text' },
      { key: 'cidbGrade', label: 'CIDB grade (demo)', type: 'text', table: true },
      { key: 'coidaExpiry', label: 'COIDA letter of good standing expires', type: 'date', required: true, table: true },
      { key: 'taxExpiry', label: 'Tax compliance status expires', type: 'date', required: true, table: true },
      { key: 'safetyFileApproved', label: 'Safety file approved', type: 'boolean' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'safety', singular: 'Safety record', plural: 'Health & safety register', refPrefix: 'HS', workflow: safetyWorkflow, editPermission: 'safety.report',
    title: (r) => str(r, 'title'),
    subtitle: (r, d) => `${label(SAFETY_TYPES, str(r, 'type'))} · ${projectName(d, r.values.project)} · ${formatDate(str(r, 'date'))}`,
    sort: (a, b) => str(b, 'date').localeCompare(str(a, 'date')),
    createFields: ['date', 'type', 'project', 'title', 'severity', 'attendees', 'lostTime', 'reportedBy', 'description', 'correctiveAction'],
    createDefaults: (today, data) => ({ date: today, reportedBy: currentUser(data).name }),
    flags: (r, _d, today) => {
      const f: Flag[] = [];
      if (r.values.lostTime === true) f.push({ tone: 'red', label: 'Lost-time injury' });
      if (r.status === 'open' && str(r, 'severity') === 'high') f.push({ tone: 'red', label: 'High severity — open' });
      if (r.status === 'open' && ['incident', 'nearmiss'].includes(str(r, 'type')) && !str(r, 'correctiveAction')) f.push({ tone: 'amber', label: 'Corrective action outstanding' });
      if (r.status === 'open' && str(r, 'date') && daysBetween(str(r, 'date'), today) > 14) f.push({ tone: 'amber', label: 'Open > 14 days' });
      return f;
    },
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'type', label: 'Type', type: 'select', options: SAFETY_TYPES, required: true, table: true },
      { key: 'project', label: 'Project', type: 'ref', ref: 'projects', required: true, table: true },
      { key: 'title', label: 'Topic / what happened', type: 'text', required: true, wide: true },
      { key: 'severity', label: 'Severity', type: 'select', options: SEVERITIES, required: true, table: true },
      { key: 'attendees', label: 'Attendees (toolbox talks)', type: 'number', min: 0, max: 500 },
      { key: 'lostTime', label: 'Lost-time injury', type: 'boolean', validate: (v, all) => (v === true && all.type !== 'incident' ? 'Only an incident can be a lost-time injury.' : null) },
      { key: 'reportedBy', label: 'Recorded by', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'correctiveAction', label: 'Corrective action', type: 'textarea', hint: 'Required before closing an incident or near miss.' },
    ],
  },
];

const config: IndustryConfig = {
  id: 'construction',
  industry: 'Construction',
  businessName: 'Ironbark Building & Civils',
  monogram: 'IB',
  workspaceTag: 'PROJECTS WORKSPACE',
  tagline: 'Building and civils contractor',
  summary: 'A fictional South African building and civils contractor: projects from tender to final completion, programmes against time, the daily site diary with rain and delay days, variations, monthly payment valuations with retention and VAT, procurement, plant hire, subcontractor compliance, snag lists and site safety.',
  priority: 7,
  theme: { accent: '#2f6da3', accent2: '#3e7db3', accentSoft: '#a9c8e6', accentTint: '#e8f0f8', accentLine: '#cfe0f0', accentText: '#234f78' },
  roles: [
    { key: 'md', label: 'Managing director' },
    { key: 'pm', label: 'Project manager' },
    { key: 'site', label: 'Site agent / foreman' },
    { key: 'qs', label: 'Quantity surveyor' },
    { key: 'safety', label: 'Safety officer' },
    { key: 'procurement', label: 'Procurement & stores' },
  ],
  permissions: [
    { key: 'projects.manage', label: 'Manage projects', description: 'Create projects, move them through award, site, practical and final completion; approve requisitions; verify snags' },
    { key: 'programme', label: 'Programme', description: 'Edit programme tasks and record progress' },
    { key: 'diary', label: 'Capture site diary', description: 'Create and edit daily site diary entries' },
    { key: 'diary.sign', label: 'Sign site diary', description: 'Sign off (or reopen) daily site diary entries' },
    { key: 'variations.record', label: 'Record variations', description: 'Record site instructions and variations' },
    { key: 'variations.price', label: 'Price variations', description: 'Price variations and submit them to the client' },
    { key: 'variations.approve', label: 'Approve variations', description: 'Record the client’s approval or rejection of a variation' },
    { key: 'valuations', label: 'Payment valuations', description: 'Prepare, submit and record certificates and payment for valuations' },
    { key: 'procurement.request', label: 'Raise requisitions', description: 'Raise and cancel material requisitions' },
    { key: 'procurement', label: 'Procurement', description: 'Issue purchase orders and receive deliveries' },
    { key: 'plant', label: 'Plant', description: 'Manage owned and hired plant, off-hire and services' },
    { key: 'subcontractors', label: 'Subcontractors', description: 'Manage subcontractor records and compliance documents' },
    { key: 'snags', label: 'Snags', description: 'Raise snags and mark them fixed' },
    { key: 'safety.report', label: 'Report safety', description: 'Record toolbox talks, inspections, near misses and incidents' },
    { key: 'safety', label: 'Close out safety', description: 'Close out safety records once corrective action is recorded' },
  ],
  modules: [
    { key: 'projects', label: 'Projects', icon: IcoBriefcase, group: 'Projects', collection: 'projects', detail: ProjectDetail, description: 'Contracts from tender to final completion: value, retention, programme, variations, valuations and the diary in one place. Practical completion is blocked by open critical snags.' },
    { key: 'programme', label: 'Programme & milestones', icon: IcoCalendar, group: 'Projects', collection: 'tasks', page: Programme, description: 'Planned vs actual dates and % complete per task, with slippage and overdue milestones, drawn as a simple bar chart per project.' },
    { key: 'variations', label: 'Variations', icon: IcoFlag, group: 'Commercial', collection: 'variations', view: 'board', page: VariationsPage, detail: VariationDetail, description: 'Site instructions priced, submitted and approved or rejected. Approved variations add to the revised contract sum. No written instruction, no submission.' },
    { key: 'valuations', label: 'Payment valuations', icon: IcoReceipt, group: 'Commercial', collection: 'valuations', page: ValuationsPage, detail: ValuationDetail, description: 'Monthly progress claims: work done, materials on site and variations, less retention and previous certificates, plus VAT. Illustrative only — not payment certificates.' },
    { key: 'procurement', label: 'Procurement', icon: IcoBox, group: 'Commercial', collection: 'requisitions', view: 'board', page: ProcurementPage, detail: RequisitionDetail, description: 'Requisitions approved by the project manager, purchase orders issued by procurement and deliveries received against a delivery note.' },
    { key: 'diary', label: 'Site diary', icon: IcoDoc, group: 'Site', collection: 'diary', page: SiteDiary, detail: DiaryDetail, description: 'Daily weather, labour by trade, plant, work done, delays and visitors. Rain and employer delays feed an indicative extension-of-time summary.' },
    { key: 'plant', label: 'Plant & equipment', icon: IcoTruck, group: 'Site', collection: 'plant', page: PlantPage, detail: PlantDetail, description: 'Owned and hired plant by project, running hire cost, idle hired plant, overdue off-hire and service dates.' },
    { key: 'snags', label: 'Snags & defects', icon: IcoAlert, group: 'Site', collection: 'snags', view: 'board', page: SnagsPage, detail: SnagDetail, description: 'Snag lists per project: categorise, fix and verify. Open critical snags block practical completion; any open snag blocks final completion.' },
    { key: 'subcontractors', label: 'Subcontractors', icon: IcoUsers, group: 'Compliance', collection: 'subcontractors', page: SubcontractorsPage, detail: SubcontractorDetail, description: 'CIDB grade (demo), COIDA letter of good standing, tax compliance and safety file. Non-compliant subcontractors cannot be assigned to variations.' },
    { key: 'safety', label: 'Health & safety', icon: IcoHelmet, group: 'Compliance', collection: 'safety', page: SafetyPage, detail: SafetyDetail, description: 'Toolbox talks, inspections, near misses and incidents. Incidents close out only with a corrective action.' },
  ],
  collections,
  seed: buildConstructionSeed,
  dashboard: Dashboard,
  boundaries: [
    'Not a JBCC, NEC, GCC or FIDIC contract administration tool. Workflows, notices and time bars are simplified illustrations.',
    'Payment valuations are illustrative calculations, not payment certificates, tax invoices or a final account. The 5 % retention cap is a demo rule.',
    'No CIDB, COIDA, SARS or bank verification — grades, letters of good standing, tax status and reference numbers are invented and typed in.',
    'Not compliant with the Construction Regulations or OHS Act: the safety register, toolbox talks and safety files are demonstrations only.',
    'No accounting, ERP, scheduling (MS Project / P6), BIM or supplier integration — every figure is seed data or typed in this browser.',
    'Extension-of-time figures from the diary are indicative only and are not a claim or an entitlement.',
    'All clients, sites, people, suppliers, subcontractors and amounts are fictional.',
  ],
  guide: [
    { title: 'Sign a site diary entry', detail: 'Under “Awaiting signature” the warehouse entry is refused — a 3-hour delay with no cause. Open it, choose the cause, save and sign.', to: 'diary', as: 'u_sa' },
    { title: 'Approve a variation', detail: 'Press “Record client approval”. “Contract impact” shows the project’s revised contract sum rise by R39,800.', to: 'variations/variations_3', as: 'u_pm1' },
    { title: 'Run a payment valuation', detail: 'Check retention, previous certificates and VAT, submit it, then record the certificate — it cannot exceed the claim — and mark it paid.', to: 'valuations/valuations_6', as: 'u_qs' },
    { title: 'Unblock practical completion', detail: 'An open critical snag blocks it. Open the snag from “Completion checks”, mark it fixed and verify it, then come back and certify.', to: 'projects/projects_2', as: 'u_pm1' },
    { title: 'Issue a purchase order', detail: 'This requisition is approved. Choose the expected delivery, issue the PO, then receive the goods against a delivery note number.', to: 'procurement/requisitions_3', as: 'u_ps' },
    { title: 'Off-hire idle plant', detail: 'This hired excavator is standing idle at R3,900 a day, past its off-hire date. Press “Off-hire today” to stop the cost.', to: 'plant/plant_4', as: 'u_sa' },
  ],
  highlights: [
    'Payment valuations: retention (capped), previous certificates and VAT computed live',
    'Variations: no written instruction, no submission; approved values revise the contract sum',
    'Site diary with rain and employer-delay days feeding an indicative extension of time',
    'Practical completion blocked by open critical snags; expired subcontractors blocked from variations',
  ],
};

export default config;
