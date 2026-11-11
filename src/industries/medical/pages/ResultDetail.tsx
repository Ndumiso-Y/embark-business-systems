import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { LABS, TESTS, label } from '../data';
import { PatientCard } from './shared';

export default function ResultDetail() {
  const { id } = useParams();
  const data = useData();
  const r = findRecord(data, 'results', id);
  return (
    <RecordDetail backLabel="Results inbox" aside={r ? <Panel title="Patient"><PatientCard data={data} patientId={r.values.patient} /></Panel> : undefined}>
      {r && <ResultSteps key={r.status} id={r.id} />}
      {r && <ResultPanel id={r.id} />}
    </RecordDetail>
  );
}

/** Focused steps: capture the result when it arrives, then the doctor's review. No lab feed in the demo. */
function ResultSteps({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const r = findRecord(data, 'results', id)!;
  const [summary, setSummary] = useState(str(r, 'summary'));
  const [abnormal, setAbnormal] = useState(!!r.values.abnormal);
  const [action, setAction] = useState(str(r, 'action'));
  if (r.status === 'requested' && can('clinical.view')) {
    const save = () => {
      if (!summary.trim()) { act.toast('Type the result summary first.', 'err'); return; }
      act.update('results', r.id, { summary: summary.trim(), abnormal }, 'Result captured');
      const res = act.transition('results', r.id, 'received');
      act.toast(res.ok ? `${r.ref}: result received${abnormal ? ' — flagged abnormal, waiting for a doctor’s review' : ' — waiting for a doctor’s review'}` : res.reason, res.ok ? 'ok' : 'err');
    };
    return (
      <Panel title="Capture result" meta="Typed in by hand — the demo has no laboratory feed">
        <div data-testid="capture-result">
          <Field label="Result summary"><textarea className="textarea" aria-label="Result summary" value={summary} placeholder="e.g. CRP 12 mg/L (demo value)" onChange={(e) => setSummary(e.target.value)} /></Field>
          <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={abnormal} onChange={(e) => setAbnormal(e.target.checked)} /> Flagged abnormal by the lab</label>
          <div className="btns" style={{ marginTop: 12 }}><button className="btn sm primary" onClick={save} data-testid="save-result">Save result &amp; mark received</button></div>
        </div>
      </Panel>
    );
  }
  if (r.status === 'received' && can('results.review')) {
    const save = () => {
      if (action.trim()) act.update('results', r.id, { action: action.trim() }, 'Doctor’s action recorded');
      const res = act.transition('results', r.id, 'reviewed');
      act.toast(res.ok ? `${r.ref}: reviewed — next, record that the patient was informed` : res.reason, res.ok ? 'ok' : 'err');
    };
    return (
      <Panel title="Doctor’s review" meta={r.values.abnormal ? 'Flagged abnormal — needs a decision' : undefined}>
        <div data-testid="review-result">
          <Field label="Doctor’s action (optional)"><textarea className="textarea" aria-label="Doctor’s action" value={action} placeholder="e.g. Repeat in 3 months; discuss at next visit" onChange={(e) => setAction(e.target.value)} /></Field>
          <div className="btns" style={{ marginTop: 12 }}><button className="btn sm primary" onClick={save} data-testid="save-review-result">Save action &amp; mark reviewed</button></div>
        </div>
      </Panel>
    );
  }
  if (r.status === 'reviewed') {
    return <Panel title="Inform the patient"><p className="muted-note">Reviewed by a doctor{str(r, 'action') ? `: ${str(r, 'action')}` : ''}. Press “Patient informed” above and note how they were told (phone call, at the next visit…). Nothing is sent from the demo.</p></Panel>;
  }
  return null;
}

function ResultPanel({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const { can, hasModule } = useUser();
  const r = findRecord(data, 'results', id)!;
  const consult = findRecord(data, 'consults', str(r, 'consult'));
  const span = (a: string, b: string) => (str(r, a) && str(r, b) ? `${daysBetween(str(r, a), str(r, b))} day(s)` : '—');
  return (
    <Panel title={label(TESTS, str(r, 'test'))} meta={label(LABS, str(r, 'lab'))} right={r.values.abnormal ? <Tag tone="red">Flagged abnormal</Tag> : str(r, 'receivedOn') ? <Tag tone="green">Within range</Tag> : undefined}>
      {can('clinical.view') ? (
        str(r, 'summary') ? <div className="sms-preview" data-testid="result-summary">{str(r, 'summary')}</div> : <p className="muted-note" style={{ marginBottom: 12 }}>No result captured yet. There is no lab feed in the demo — a clinical user types it in under “Capture result”.</p>
      ) : <div style={{ marginBottom: 12 }}><Notice tone="grey">Result values are hidden for your simulated role. You can still record that the patient was informed.</Notice></div>}
      <KeyValues items={[
        { label: 'Requested', value: formatDate(str(r, 'requestedOn')) },
        { label: 'Lab turnaround', value: span('requestedOn', 'receivedOn') },
        { label: 'Received → reviewed', value: span('receivedOn', 'reviewedOn') },
        { label: 'Patient informed', value: formatDate(str(r, 'informedOn')) },
      ]} />
      {str(r, 'action') && can('clinical.view') && <p className="muted-note" style={{ marginTop: 10 }}><b>Doctor’s action:</b> {str(r, 'action')}</p>}
      {consult && <p className="muted-note" style={{ marginTop: 10 }}>Requested during consultation {hasModule('consults') ? <Link to={`${base}/consults/${consult.id}`}>{consult.ref}</Link> : consult.ref}.</p>}
      {r.status === 'received' && !can('results.review') && <p className="muted-note" style={{ marginTop: 10 }}>Only doctors (Review results permission) can mark a result as reviewed.</p>}
    </Panel>
  );
}
