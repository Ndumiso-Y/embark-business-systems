import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, lines, num, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { Empty, Field, KeyValues, Notice, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail, WorkflowActions } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { BAYS, JOB_TEMPLATES, TECHNICIANS, label } from '../data';
import { invoiceBalance, jobEstimate, jobInvoice, planClash, QC_ITEMS, qcMissing, todayStr, vehicleOf } from '../helpers';
import { LinesTable, VehicleCard } from './shared';
import { km, templateLines } from './format';

export default function JobDetail() {
  const { id } = useParams();
  const data = useData();
  const j = findRecord(data, 'jobs', id);
  return (
    <RecordDetail aside={j ? <Aside id={j.id} /> : undefined}>
      {j && j.status === 'booked' && <CheckIn key={j.id} id={j.id} />}
      {j && <Work id={j.id} />}
    </RecordDetail>
  );
}

function Work({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const base = useBase();
  const { can, hasModule } = useUser();
  const j = findRecord(data, 'jobs', id)!;
  const est = jobEstimate(data, j);
  const v = vehicleOf(data, j);
  const [notes, setNotes] = useState(str(j, 'workNotes'));
  const [creating, setCreating] = useState(false);
  const [tpl, setTpl] = useState(JOB_TEMPLATES.find((t) => t.type === str(j, 'jobType'))?.key ?? 'minor');
  const qcEditable = can('qc') && j.status === 'qc';
  const missing = qcMissing(j);
  const estDef = config.collections.find((c) => c.key === 'estimates')!;
  const estWf = estDef.workflow;
  const showQc = ['inprogress', 'qc', 'ready', 'collected'].includes(j.status ?? '');

  return (
    <>
      <Panel title="Job card" meta="What the customer asked for and where the vehicle is in the workshop">
        <KeyValues items={[
          { label: 'Complaint / request', value: str(j, 'complaint'), wide: true },
          { label: 'Bay · technician', value: `${label(BAYS, str(j, 'bay'))} · ${label(TECHNICIANS, str(j, 'technician'))}` },
          { label: 'Planned', value: `${formatDate(str(j, 'workDate'))}${str(j, 'startTime') ? ` from ${str(j, 'startTime')}` : ''} · ${str(j, 'hoursBooked') || '—'} h` },
          { label: 'Odometer in', value: str(j, 'odometerIn') ? km(Number(j.values.odometerIn)) : `Not recorded (last known ${v ? km(Number(v.values.odometer)) : '—'})` },
          { label: 'Promised', value: str(j, 'promisedDate') ? `${formatDate(str(j, 'promisedDate'))} ${str(j, 'promisedTime')}`.trim() : '' },
        ]} />
        {ALLOCATABLE.includes(j.status ?? '') && <Allocate key={`${j.id}_${str(j, 'bay')}_${str(j, 'technician')}`} id={j.id} />}
      </Panel>

      <Panel title="Estimate" meta="No work may start until the customer has approved an estimate" right={est ? <StatusTag workflow={estWf} status={est.status} /> : undefined}>
        {est ? (
          <>
            <p className="muted-note" style={{ marginBottom: 10 }}>
              {hasModule('estimates') ? <Link to={`${base}/estimates/${est.id}`}>{est.ref}</Link> : est.ref}
              {str(est, 'sentOn') ? ` · sent ${formatDate(str(est, 'sentOn'))}` : ' · not yet sent'}
              {est.status === 'approved' && str(est, 'approvalNote') ? ` · approved: “${str(est, 'approvalNote')}”` : ''}
            </p>
            <LinesTable lines={lines(est)} />
            {can('estimates') && estDef.workflow && est.status !== 'approved' && !['collected', 'cancelled'].includes(j.status ?? '') && (
              <div style={{ marginTop: 14 }} data-testid="estimate-steps">
                <p className="muted-note" style={{ marginBottom: 8 }}>
                  {est.status === 'draft' && <><b>Next:</b> send the estimate to the customer (simulated — nothing is sent). The job card then waits in “Awaiting approval”.</>}
                  {est.status === 'sent' && <><b>Next:</b> when the customer replies, record the approval with a note saying <b>how</b> they approved — phone, WhatsApp, in person or email — and who. Work stays blocked until then.</>}
                  {est.status === 'declined' && <><b>Declined.</b> Revise the estimate and send it again, or cancel the job card.</>}
                </p>
                <WorkflowActions def={estDef} record={est} compact />
              </div>
            )}
          </>
        ) : (
          <>
            <Empty title="No estimate yet" body="Diagnose the fault, then prepare a parts & labour estimate for the customer to approve." />
            {!can('estimates') && !['collected', 'cancelled'].includes(j.status ?? '') && <p className="muted-note" style={{ marginTop: 8 }}>The service advisor or foreman prepares and sends the estimate — switch user in the top bar.</p>}
            {can('estimates') && !['collected', 'cancelled'].includes(j.status ?? '') && (
              <div className="toolbar" style={{ marginTop: 12 }}>
                <select className="select sm" aria-label="Start from template" value={tpl} onChange={(e) => setTpl(e.target.value)} style={{ width: 'auto' }}>
                  {JOB_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <button className="btn sm primary" data-testid="create-estimate" onClick={() => setCreating(true)}>Prepare estimate</button>
              </div>
            )}
          </>
        )}
      </Panel>

      {showQc && (
        <Panel title="Quality check" meta={qcEditable ? 'Tick each item before passing QC (foreman)' : 'Completed by the workshop foreman before the vehicle is ready'}>
          <ul className="list" data-testid="qc-checklist">
            {QC_ITEMS.map((i) => (
              <li key={i.key}>
                <label className="check">
                  <input type="checkbox" checked={j.values[i.key] === true} disabled={!qcEditable}
                    onChange={(e) => act.update('jobs', j.id, { [i.key]: e.target.checked }, `QC: ${i.label} ${e.target.checked ? 'ticked' : 'unticked'}`)} />
                  {i.label}
                </label>
              </li>
            ))}
          </ul>
          {j.status === 'qc' && missing.length > 0 && <p className="muted-note" style={{ marginTop: 8 }}>{missing.length} item(s) outstanding — “Pass quality check” stays blocked until all are ticked.</p>}
        </Panel>
      )}

      <Panel title="Technician notes" meta="Findings, advisories and parts used">
        {can('jobs.work') && !['collected', 'cancelled'].includes(j.status ?? '') ? (
          <>
            <Field label="Notes"><textarea className="textarea" aria-label="Technician notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <button className="btn sm" style={{ marginTop: 8 }} disabled={notes === str(j, 'workNotes')} onClick={() => { act.update('jobs', j.id, { workNotes: notes }, 'Technician notes updated'); act.toast('Notes saved'); }}>Save notes</button>
          </>
        ) : <p className="muted-note">{str(j, 'workNotes') || 'No notes recorded.'}</p>}
      </Panel>

      {creating && (
        <RecordFormModal def={act.def('estimates')} open title={`Estimate for ${j.ref}`}
          initial={{ job: j.id, vehicle: str(j, 'vehicle'), validUntil: addDays(todayStr(), 14), lines: templateLines(data, tpl, str(v, 'fuel') === 'diesel') }}
          onClose={() => setCreating(false)}
          onSave={(vals) => {
            const e = act.create('estimates', vals, 'draft', `Estimate prepared for ${j.ref}`);
            act.update('jobs', j.id, { estimate: e.id }, `Estimate ${e.ref} prepared`);
            act.toast(`Estimate ${e.ref} created — send it to the customer next`);
            setCreating(false);
          }} />
      )}
    </>
  );
}

const ALLOCATABLE = ['booked', 'checkedin', 'diagnosing', 'approval', 'inprogress'];

/** Focused check-in control: the odometer reading is the one thing the advisor must capture at the counter. */
function CheckIn({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const j = findRecord(data, 'jobs', id)!;
  const v = vehicleOf(data, j);
  const [odo, setOdo] = useState(str(j, 'odometerIn'));
  const [err, setErr] = useState('');
  const last = num(v, 'odometer');
  const submit = () => {
    if (odo.trim() === '' || !Number.isFinite(Number(odo)) || Number(odo) < 0) { setErr('Enter the odometer reading in kilometres.'); return; }
    const before = j.values.odometerIn ?? '';
    act.update('jobs', j.id, { odometerIn: Number(odo) });
    const res = act.transition('jobs', j.id, 'checkedin');
    if (!res.ok) { act.update('jobs', j.id, { odometerIn: before }); setErr(res.reason); act.toast(res.reason, 'err'); return; }
    act.toast(`${j.ref} checked in at ${km(Number(odo))}`);
  };
  return (
    <Panel title="Check-in" meta="Record the odometer when the customer hands over the keys">
      {can('jobs.manage') ? (
        <div className="stack" style={{ gap: 10, alignItems: 'flex-start' }}>
          <Field label="Odometer in (km)" error={err || undefined} hint={v ? `Last recorded ${km(last)}${str(v, 'odometerOn') ? ` on ${formatDate(str(v, 'odometerOn'))}` : ''} — a lower reading is refused.` : undefined}>
            <input className="input num" type="number" min={0} step={1} aria-label="Odometer in (km)" data-testid="odometer-in" value={odo} placeholder="Reading in km" onChange={(e) => { setOdo(e.target.value); setErr(''); }} style={{ maxWidth: 220 }} />
          </Field>
          <button className="btn primary" type="button" data-testid="check-in" onClick={submit}>Record odometer & check in</button>
        </div>
      ) : <p className="muted-note">The service advisor or foreman records the odometer and checks the vehicle in (needs “Manage job cards”).</p>}
    </Panel>
  );
}

/** Focused bay & technician allocation, so a blocked "Start diagnosis" can be fixed on the job card itself. */
function Allocate({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const j = findRecord(data, 'jobs', id)!;
  const [bay, setBay] = useState(str(j, 'bay'));
  const [tech, setTech] = useState(str(j, 'technician'));
  const missing = !str(j, 'bay') || !str(j, 'technician');
  const dirty = bay !== str(j, 'bay') || tech !== str(j, 'technician');
  if (!can('jobs.manage')) {
    return missing ? <p className="muted-note" style={{ marginTop: 12 }}>No bay or technician allocated yet — the service advisor or foreman allocates them (needs “Manage job cards”).</p> : null;
  }
  const save = () => {
    const clash = planClash(data, { id: j.id, workDate: str(j, 'workDate'), startTime: str(j, 'startTime'), hoursBooked: num(j, 'hoursBooked'), bay, technician: tech });
    if (clash) { act.toast(clash, 'err'); return; }
    act.update('jobs', j.id, { bay, technician: tech }, `Allocated: ${label(BAYS, bay)}, ${label(TECHNICIANS, tech)}`);
    act.toast(`${j.ref}: ${label(BAYS, bay)} · ${label(TECHNICIANS, tech)}`);
  };
  return (
    <div style={{ marginTop: 14 }} data-testid="allocate">
      {missing && <div style={{ marginBottom: 10 }}><Notice tone="amber">Allocate a bay and a technician — diagnosis and work cannot start without them.</Notice></div>}
      <div className="toolbar" style={{ alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <Field label="Bay">
          <select className="select" aria-label="Allocate bay" value={bay} onChange={(e) => setBay(e.target.value)}>
            <option value="">No bay yet</option>
            {BAYS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="Technician">
          <select className="select" aria-label="Allocate technician" value={tech} onChange={(e) => setTech(e.target.value)}>
            <option value="">No technician yet</option>
            {TECHNICIANS.map((t) => <option key={t.value} value={t.value}>{t.label} · {t.grade}</option>)}
          </select>
        </Field>
        <button className="btn sm" type="button" data-testid="save-allocation" disabled={!dirty} onClick={save}>{dirty ? 'Save bay & technician' : 'Saved'}</button>
      </div>
    </div>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const j = findRecord(data, 'jobs', id)!;
  const inv = jobInvoice(data, j.id);
  const original = findRecord(data, 'jobs', str(j, 'comebackOf'));
  return (
    <>
      <Panel title="Vehicle & customer"><VehicleCard data={data} vehicleId={j.values.vehicle} /></Panel>
      {original && (
        <Notice tone="red"><b>Comeback.</b> Rework of <Link to={`${base}/jobs/${original.id}`}>{original.ref}</Link> ({formatDate(str(original, 'workDate'))}). Counted in the comeback report.</Notice>
      )}
      <Panel title="Invoice">
        {inv ? (
          <p className="muted-note">
            {hasModule('invoices') ? <Link to={`${base}/invoices/${inv.id}`}><b>{inv.ref}</b></Link> : <b>{inv.ref}</b>} · issued {formatDate(str(inv, 'issuedOn'))} · balance {formatRand(invoiceBalance(inv))}
            {invoiceBalance(inv) > 0 && hasModule('invoices') && <><br /><Link className="btn sm" style={{ marginTop: 10 }} to={`${base}/invoices/${inv.id}`} data-testid="open-invoice">Record payment on {inv.ref} →</Link></>}
            {invoiceBalance(inv) > 0 && !hasModule('invoices') && <><br />Payment is recorded by the service advisor or the parts &amp; admin clerk.</>}
          </p>
        ) : <p className="muted-note">Raised automatically from the approved estimate when the job passes quality check.</p>}
      </Panel>
    </>
  );
}
