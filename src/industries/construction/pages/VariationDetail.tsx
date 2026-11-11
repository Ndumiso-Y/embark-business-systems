import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { toCents } from '../../../core/lib/money';
import { Field, KeyValues, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { approvedVariations, holders, projectOf, rand, revisedContractSum, subcontractorCompliance, todayStr } from '../helpers';

/** Variation detail: the generic record screen plus pricing, the site-instruction reference
 *  and what approval does to the project's revised contract sum. */
export default function VariationDetail() {
  const { id } = useParams();
  const data = useData();
  const v = findRecord(data, 'variations', id);
  return <RecordDetail aside={v ? <Aside key={v.id} id={v.id} /> : undefined} />;
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const v = findRecord(data, 'variations', id)!;
  const p = projectOf(data, v);
  const sub = findRecord(data, 'subcontractors', str(v, 'subcontractor'));
  const compliance = sub ? subcontractorCompliance(sub, todayStr()) : null;
  const [value, setValue] = useState(() => str(v, 'value'));
  const [days, setDays] = useState(() => str(v, 'timeImpactDays') || '0');
  const [si, setSi] = useState(() => str(v, 'instructionRef'));
  const [err, setErr] = useState('');
  const [siErr, setSiErr] = useState('');

  const revised = p ? revisedContractSum(data, p) : 0;
  const approved = v.status === 'approved';
  const open = ['instructed', 'priced', 'submitted'].includes(v.status ?? '');

  const price = () => {
    const n = Number(value);
    const d = Number(days || 0);
    if (value === '' || !(n > 0)) { setErr('Enter the priced value (excl. VAT).'); return; }
    if (!Number.isFinite(d) || d < 0 || d > 365) { setErr('Time impact must be 0–365 days.'); return; }
    act.update('variations', id, { value: n, timeImpactDays: d });
    const res = act.transition('variations', id, 'priced');
    if (!res.ok) { setErr(res.reason); return; }
    act.toast(`${v.ref}: priced at ${rand(toCents(n))}`);
    setErr('');
  };
  const saveSi = () => {
    if (!si.trim()) { setSiErr('Type the written site instruction reference, e.g. SI-014.'); return; }
    act.update('variations', id, { instructionRef: si.trim() }, `Site instruction reference recorded: ${si.trim()}`);
    act.toast(`${v.ref}: site instruction ${si.trim()} recorded`);
    setSiErr('');
  };

  return (
    <>
      <div data-testid="variation-impact">
        <Panel title="Contract impact" meta="Approved variations are added to the contract sum">
          {p ? (
            <KeyValues items={[
              { label: 'Project', value: hasModule('projects') ? <Link to={`${base}/projects/${p.id}`}>{str(p, 'name')}</Link> : str(p, 'name'), wide: true },
              { label: 'Original contract value', value: rand(toCents(num(p, 'contractValue'))) },
              { label: 'Approved variations', value: rand(toCents(approvedVariations(data, p.id))) },
              { label: 'Revised contract sum', value: <b>{rand(toCents(revised))}</b> },
              { label: approved ? 'This variation (included)' : 'This variation', value: num(v, 'value') ? rand(toCents(num(v, 'value'))) : 'Not priced' },
            ]} />
          ) : <Notice tone="amber">No project linked — use “Edit” to choose the project.</Notice>}
          {p && open && num(v, 'value') > 0 && <p className="muted-note" style={{ marginTop: 10 }}>If the client approves, the revised contract sum becomes <b>{rand(toCents(revised + num(v, 'value')))}</b>{num(v, 'timeImpactDays') ? ` and ${num(v, 'timeImpactDays')} day(s) of time impact are on record` : ''}.</p>}
          {approved && <div style={{ marginTop: 10 }}><Notice tone="accent">Approved — {rand(toCents(num(v, 'value')))} is now part of the revised contract sum. Include it in the next payment valuation.</Notice></div>}
          {compliance && !compliance.ok && open && (
            <div style={{ marginTop: 10 }}><Notice tone="red">{hasModule('subcontractors') ? <Link to={`${base}/subcontractors/${sub!.id}`}>{str(sub, 'company')}</Link> : str(sub, 'company')} is not compliant: {compliance.reasons.join('; ')}. Renew the documents on the subcontractor’s record or choose another subcontractor.</Notice></div>
          )}
        </Panel>
      </div>

      {v.status === 'instructed' && (
        <Panel title="Price the variation" meta="Value excl. VAT and any effect on the completion date">
          {can('variations.price') ? (
            <div className="stack" style={{ gap: 10 }} data-testid="price-form">
              <Field label="Priced value, excl. VAT (R)" error={err || undefined}><input className="input num" type="number" min={0} step="0.01" aria-label="Priced value" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
              <Field label="Time impact (days)"><input className="input num" type="number" min={0} max={365} aria-label="Time impact days" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
              <div><button className="btn sm primary" onClick={price} data-testid="price-variation">Save price &amp; mark priced</button></div>
            </div>
          ) : <p className="muted-note">Variations are priced and submitted by {holders(data, 'variations.price')}.</p>}
        </Panel>
      )}

      {['instructed', 'priced'].includes(v.status ?? '') && !str(v, 'instructionRef') && (
        <Panel title="Written site instruction" meta="A verbal instruction cannot be submitted to the client">
          {can('variations.record') ? (
            <>
              <Field label="Site instruction reference" error={siErr || undefined}><input className="input" aria-label="Site instruction reference" value={si} onChange={(e) => setSi(e.target.value)} placeholder="e.g. SI-014" /></Field>
              <button className="btn sm primary" style={{ marginTop: 10 }} onClick={saveSi} data-testid="save-si-ref">Record reference</button>
            </>
          ) : <p className="muted-note">The reference is recorded by {holders(data, 'variations.record')}.</p>}
        </Panel>
      )}
      {v.status === 'priced' && (can('variations.price')
        ? <Notice tone="grey">“Submit to client” records that the priced variation went to the client. Nothing is e-mailed from this demo.</Notice>
        : <Notice tone="grey">Submitted to the client by {holders(data, 'variations.price')}.</Notice>)}
      {v.status === 'submitted' && !can('variations.approve') && <Notice tone="grey">The client’s decision is recorded by {holders(data, 'variations.approve')}. Switch user in the top bar to try it.</Notice>}
    </>
  );
}
