import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, lines, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { Empty, Field, KeyValues, Notice, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { BAYS, JOB_TEMPLATES, TECHNICIANS, label } from '../data';
import { invoiceBalance, jobEstimate, jobInvoice, QC_ITEMS, qcMissing, todayStr, vehicleOf } from '../helpers';
import { LinesTable, VehicleCard } from './shared';
import { km, templateLines } from './format';

export default function JobDetail() {
  const { id } = useParams();
  const data = useData();
  const j = findRecord(data, 'jobs', id);
  return (
    <RecordDetail aside={j ? <Aside id={j.id} /> : undefined}>
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
  const estWf = config.collections.find((c) => c.key === 'estimates')!.workflow;
  const showQc = ['inprogress', 'qc', 'ready', 'collected'].includes(j.status ?? '');

  return (
    <>
      <Panel title="Job card" meta="What the customer asked for and where the vehicle is in the workshop">
        <KeyValues items={[
          { label: 'Complaint / request', value: str(j, 'complaint'), wide: true },
          { label: 'Bay · technician', value: `${label(BAYS, str(j, 'bay'))} · ${label(TECHNICIANS, str(j, 'technician'))}` },
          { label: 'Planned', value: `${formatDate(str(j, 'workDate'))}${str(j, 'startTime') ? ` from ${str(j, 'startTime')}` : ''} · ${str(j, 'hoursBooked') || '—'} h` },
          { label: 'Odometer in', value: str(j, 'odometerIn') ? km(Number(j.values.odometerIn)) : `Not recorded (last known ${v ? km(Number(v.values.odometer)) : '—'})` },
          { label: 'Promised', value: `${formatDate(str(j, 'promisedDate'))} ${str(j, 'promisedTime')}` },
        ]} />
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
          </>
        ) : (
          <>
            <Empty title="No estimate yet" body="Diagnose the fault, then prepare a parts & labour estimate for the customer to approve." />
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
          </p>
        ) : <p className="muted-note">Raised automatically from the approved estimate when the job passes quality check.</p>}
      </Panel>
    </>
  );
}
