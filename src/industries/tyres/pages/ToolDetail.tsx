import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { Empty, Field, KeyValues, Meters, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { TECHNICIANS, TOOL_LOCATIONS, TOOL_TYPES, label } from '../data';
import { calibrationState, IN_BAY, servicesText, techLabel, todayStr, toolCheckoutProblem, toolHoursOut, toolNotReturned, toolType, vehicleLabel } from '../helpers';
import { RecordLink } from './shared';

export default function ToolDetail() {
  const { id } = useParams();
  const data = useData();
  const t = findRecord(data, 'tools', id);
  return (
    <RecordDetail aside={t ? <Aside id={t.id} /> : undefined}>
      {t && t.status === 'available' && <CheckOut id={t.id} />}
      {t && t.status === 'checkedout' && <Holding id={t.id} />}
      {t && str(t, 'toolType') === 'torque' && <Traceability id={t.id} />}
    </RecordDetail>
  );
}

/** The small check-out form: choose the technician (and optionally the job), then check out. */
function CheckOut({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const t = findRecord(data, 'tools', id)!;
  const today = todayStr();
  const [holder, setHolder] = useState(str(t, 'holder'));
  const [job, setJob] = useState('');
  const [err, setErr] = useState('');
  const openJobs = records(data, 'jobs').filter((j) => str(j, 'workDate') === today && (IN_BAY.includes(j.status ?? '') || j.status === 'approved') && (!holder || str(j, 'technician') === holder));
  const blocked = toolCheckoutProblem({ ...t, values: { ...t.values, holder: holder || 'x' } }, today);

  const submit = () => {
    if (!holder) { setErr('Choose the technician receiving the tool.'); return; }
    const prev = { holder: str(t, 'holder'), forJob: str(t, 'forJob') };
    act.update('tools', t.id, { holder, forJob: job });
    const res = act.transition('tools', t.id, 'checkedout');
    if (!res.ok) { act.update('tools', t.id, prev); setErr(res.reason); act.toast(res.reason, 'err'); return; }
    act.toast(`${str(t, 'assetNo')} checked out to ${techLabel(holder)}`);
    setErr('');
  };

  return (
    <Panel title="Check out" meta="Records who holds the tool. Calibrated tools must be in date.">
      {blocked && <div style={{ marginBottom: 12 }}><Notice tone="red"><b>Cannot be issued:</b> {blocked}</Notice></div>}
      {can('tools.issue') ? (
        <div className="form-grid">
          <Field label="Technician" error={err || undefined}>
            <select className="select" aria-label="Technician receiving the tool" value={holder} onChange={(e) => { setHolder(e.target.value); setJob(''); }} data-testid="checkout-holder">
              <option value="">Select technician…</option>
              {TECHNICIANS.map((x) => <option key={x.value} value={x.value}>{x.label} · {x.skill}</option>)}
            </select>
          </Field>
          <Field label="For job (optional)">
            <select className="select" aria-label="Job the tool is issued for" value={job} onChange={(e) => setJob(e.target.value)}>
              <option value="">Not linked to a job</option>
              {openJobs.map((j) => <option key={j.id} value={j.id}>{j.ref} · {vehicleLabel(data, j.values.vehicle)} · {servicesText(j)}</option>)}
            </select>
          </Field>
          <div className="span-2"><button className="btn primary" type="button" onClick={submit} disabled={!!blocked} data-testid="checkout-submit">Check out to {holder ? techLabel(holder) : '…'}</button></div>
        </div>
      ) : <p className="muted-note">Your simulated role cannot issue tools. Switch to a technician or the stock controller.</p>}
    </Panel>
  );
}

function Holding({ id }: { id: string }) {
  const data = useData();
  const t = findRecord(data, 'tools', id)!;
  const h = toolHoursOut(t);
  const job = findRecord(data, 'jobs', str(t, 'forJob'));
  return (
    <Panel title="Currently checked out" right={toolNotReturned(t) ? <Tag tone="red">Not returned overnight</Tag> : <Tag tone="accent">In use</Tag>}>
      <KeyValues items={[
        { label: 'Held by', value: techLabel(str(t, 'holder')) },
        { label: 'Since', value: `${formatDate(str(t, 'checkedOutOn'))} ${str(t, 'checkedOutAt')}` },
        { label: 'Hours out', value: `${h} h${toolNotReturned(t) ? ' — kept overnight; tools go back on the board at close of business (demo rule)' : ''}` },
        { label: 'Issued for', value: job ? <RecordLink module="jobs" record={job}>{job.ref} · {vehicleLabel(data, job.values.vehicle)}</RecordLink> : 'General use' },
      ]} />
      <p className="muted-note" style={{ marginTop: 10 }}>Use “Check in” in the workflow panel when the tool is back in its bay or the store.</p>
    </Panel>
  );
}

/** Which jobs were torqued with this wrench — the reason the asset number goes on the job. */
function Traceability({ id }: { id: string }) {
  const data = useData();
  const t = findRecord(data, 'tools', id)!;
  const jobs = records(data, 'jobs').filter((j) => str(j, 'torqueToolAsset') === str(t, 'assetNo')).sort((a, b) => (str(b, 'workDate') + str(b, 'readyAt')).localeCompare(str(a, 'workDate') + str(a, 'readyAt')));
  return (
    <Panel title="Jobs torqued with this wrench" meta={`${jobs.length} job(s) — if calibration is later found out of tolerance, these vehicles can be recalled for a re-torque`}>
      {jobs.length ? (
        <ul className="list" data-testid="wrench-jobs">
          {jobs.slice(0, 8).map((j) => (
            <li key={j.id}><span className="time-chip">{formatDate(str(j, 'workDate'))}</span><div className="grow"><RecordLink module="jobs" record={j}><b>{vehicleLabel(data, j.values.vehicle)}</b></RecordLink><small>{j.ref} · {techLabel(str(j, 'technician'))} · {servicesText(j)}</small></div></li>
          ))}
        </ul>
      ) : <Empty title="No jobs recorded with this wrench" />}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const t = findRecord(data, 'tools', id)!;
  const today = todayStr();
  const type = toolType(t);
  const cal = calibrationState(t, today);
  const due = str(t, 'calibrationDue');
  return (
    <>
      <Panel title="Calibration & service">
        <KeyValues items={[
          { label: 'Type', value: label(TOOL_TYPES, str(t, 'toolType')) },
          { label: 'Home', value: label(TOOL_LOCATIONS, str(t, 'location')) },
          { label: 'Calibration', value: cal === 'na' ? 'Not a calibrated tool' : cal === 'expired' ? <Tag tone="red">Expired {formatDate(due)}</Tag> : cal === 'due' ? <Tag tone="amber">Due {formatDate(due)} ({daysBetween(today, due)} d)</Tag> : <Tag tone="green">Valid to {formatDate(due)}</Tag> },
          { label: 'Interval', value: type?.calibrated ? `${type.months} months (demo)` : '—' },
          { label: 'Service due', value: str(t, 'serviceDue') ? `${formatDate(str(t, 'serviceDue'))}${str(t, 'serviceDue') < today ? ' (overdue)' : ''}` : '' },
          { label: 'Range', value: num(t, 'rangeMax') ? `${num(t, 'rangeMin')}–${num(t, 'rangeMax')} Nm` : '' },
        ]} />
      </Panel>
      <Panel title="Utilisation" meta="Lifetime, from check-outs recorded in this demo">
        <Meters format={(n) => `${n}`} items={[
          { label: 'Check-outs', value: num(t, 'checkouts') },
          { label: 'Hours out', value: Math.round(num(t, 'hoursOut')), sub: num(t, 'checkouts') ? `≈ ${Math.round((num(t, 'hoursOut') / num(t, 'checkouts')) * 10) / 10} h per check-out` : undefined },
        ]} />
        {str(t, 'lastHolder') && <p className="muted-note" style={{ marginTop: 8 }}>Last held by {techLabel(str(t, 'lastHolder'))}.</p>}
      </Panel>
    </>
  );
}
