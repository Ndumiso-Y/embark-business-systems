import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, lines, linesTotals, num, str } from '../../../core/engine';
import { formatRand } from '../../../core/lib/money';
import { Field, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { claimOutstanding, claimProblems, claimTotal } from '../helpers';
import { PatientCard } from './shared';

export default function ClaimDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'claims', id);
  return (
    <RecordDetail aside={c ? <Panel title="Patient"><PatientCard data={data} patientId={c.values.patient} /></Panel> : undefined}>
      {c && <Remittance key={c.status} id={c.id} />}
      {c && <ClaimLines id={c.id} />}
    </RecordDetail>
  );
}

/**
 * Focused step for a submitted claim: type what the scheme paid and the claim
 * moves to Paid or Part paid. Nothing is received from a scheme in the demo.
 */
function Remittance({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const c = findRecord(data, 'claims', id)!;
  const total = claimTotal(c);
  const [amount, setAmount] = useState(String(total / 100));
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const due = claimOutstanding(c);

  if (c.status === 'partpaid' || c.status === 'patient') {
    return (
      <Panel title="Patient balance" meta="What the scheme did not cover is collected from the patient">
        <p className="muted-note" data-testid="patient-balance-note">
          {formatRand(due)} is due from the patient. {can('billing') ? 'Once it is paid, press “Patient balance settled” above — the payment is recorded and the account closes.' : 'A user with the Billing permission records the payment.'}
        </p>
      </Panel>
    );
  }
  if (c.status !== 'submitted') return null;
  if (!can('billing')) {
    return <Panel title="Scheme remittance"><p className="muted-note">Waiting for the scheme’s remittance. Recording it needs the Billing permission (the practice manager in this demo).</p></Panel>;
  }
  const cents = Math.round(Number(amount) * 100);
  const part = Number.isFinite(cents) && cents > 0 && cents < total - 1;
  const save = () => {
    if (!Number.isFinite(cents) || cents <= 0) { setErr('Enter the amount the scheme paid.'); return; }
    if (cents > total + 1) { setErr(`The scheme cannot pay more than the claim total of ${formatRand(total)}.`); return; }
    if (part && !note.trim()) { setErr('Add a short note for a part payment, e.g. “Paid at scheme rate”.'); return; }
    act.update('claims', c.id, { schemePaid: cents / 100 }, `Scheme remittance of ${formatRand(cents)} captured`);
    const res = act.transition('claims', c.id, part ? 'partpaid' : 'paid', part ? note : undefined);
    if (!res.ok) { setErr(res.reason); act.toast(res.reason, 'err'); return; }
    act.toast(part ? `${c.ref}: part paid — ${formatRand(total - cents)} now due from the patient` : `${c.ref}: paid in full by the scheme`);
  };
  return (
    <Panel title="Scheme remittance" meta="Typed in by hand — the demo has no scheme or switch connection">
      <div className="form-grid" data-testid="remittance">
        <Field label="Scheme paid (R)" hint={`Claim total ${formatRand(total)}. Enter less for a part payment.`}>
          <input className="input num" type="number" min={0} step={0.01} aria-label="Scheme paid amount" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(''); }} />
        </Field>
        <Field label={part ? 'Note (required for a part payment)' : 'Note (optional)'}>
          <input className="input" aria-label="Remittance note" value={note} placeholder="e.g. Paid at scheme rate" onChange={(e) => { setNote(e.target.value); setErr(''); }} />
        </Field>
      </div>
      {err && <div style={{ marginTop: 10 }}><Notice tone="red">{err}</Notice></div>}
      <div className="btns" style={{ marginTop: 12 }}>
        <button className="btn primary sm" onClick={save} data-testid="record-remittance">Save remittance</button>
        <span className="muted-note" data-testid="remittance-outcome">{part ? `Part payment — ${formatRand(total - cents)} will be due from the patient.` : 'Paid in full — the claim will close.'}</span>
      </div>
    </Panel>
  );
}

function ClaimLines({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const c = findRecord(data, 'claims', id)!;
  const t = linesTotals(lines(c));
  const scheme = Math.round(num(c, 'schemePaid') * 100);
  const patient = Math.round(num(c, 'patientPaid') * 100);
  const isPrivate = str(c, 'scheme') === 'private';
  const problems = c.status === 'draft' && !isPrivate ? claimProblems(c, data) : [];
  const exam = findRecord(data, 'exams', str(c, 'exam'));
  const order = findRecord(data, 'orders', str(c, 'order'));
  return (
    <Panel title="Account" meta="Tariff codes are invented for the demo · VAT 15% demo default">
      {problems.length > 0 && <div style={{ marginBottom: 12 }}><Notice tone="amber"><b>Cannot submit yet</b><ul className="problem-list">{problems.map((p) => <li key={p}>{p}</li>)}</ul>Use <b>Edit</b> at the top of the page to complete the claim.</Notice></div>}
      {c.status === 'draft' && isPrivate && <div style={{ marginBottom: 12 }}><Notice tone="grey">Private patient — there is no scheme to claim from. Use “Bill patient privately”, then “Patient balance settled” once paid.</Notice></div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Code</th><th>Description</th><th className="num">Qty</th><th className="num">Excl. VAT</th></tr></thead>
          <tbody>{lines(c).map((l, i) => <tr key={l.id}><td>{l.code || '—'}</td><td>{l.description}</td><td className="num">{l.qty}</td><td className="num">{formatRand(t.lines[i].excl)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="totals" style={{ marginTop: 12 }}>
        <div className="row"><span>Claim total (incl. VAT)</span><b>{formatRand(t.total)}</b></div>
        <div className="row"><span>Scheme paid</span><b>−{formatRand(scheme)}</b></div>
        <div className="row"><span>Patient paid</span><b>−{formatRand(patient)}</b></div>
        <div className="grand"><span>Balance</span><b data-testid="claim-balance">{formatRand(t.total - scheme - patient)}</b></div>
      </div>
      {str(c, 'icd10') && <p className="muted-note" style={{ marginTop: 10 }}>Diagnosis: {str(c, 'icd10')} (sample code)</p>}
      {(exam || order) && (
        <p className="muted-note" style={{ marginTop: 6 }}>
          {exam && <>From eye exam {hasModule('exams') ? <Link to={`${base}/exams/${exam.id}`}>{exam.ref}</Link> : exam.ref}</>}
          {exam && order && ' · '}
          {order && <>eyewear from order {hasModule('orders') ? <Link to={`${base}/orders/${order.id}`}>{order.ref}</Link> : order.ref}</>}
        </p>
      )}
    </Panel>
  );
}
