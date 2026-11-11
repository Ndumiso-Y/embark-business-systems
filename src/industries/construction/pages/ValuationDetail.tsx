import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { Field, Notice, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RETENTION_CAP_PCT, VAT_RATE } from '../data';
import { approvedVariations, holders, projectOf, rand, valuationFigures, valuationsFor } from '../helpers';
import { roundCents } from '../../../core/lib/money';

export default function ValuationDetail() {
  const { id } = useParams();
  const data = useData();
  const v = findRecord(data, 'valuations', id);
  return (
    <RecordDetail aside={v ? <Aside key={`${v.id}-${v.status}`} id={v.id} /> : undefined}>
      {v && <Calculation id={v.id} />}
    </RecordDetail>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className="row"><span>{label}</span><b style={strong ? { color: 'var(--ink)' } : undefined}>{value}</b></div>;
}

function Calculation({ id }: { id: string }) {
  const data = useData();
  const v = findRecord(data, 'valuations', id)!;
  const p = projectOf(data, v);
  const f = valuationFigures(data, v);
  const approved = p ? approvedVariations(data, p.id) : 0;
  return (
    <Panel title="Valuation calculation" meta="Live from this valuation, the project and earlier certificates · illustrative, not a payment certificate">
      <div className="totals" data-testid="valuation-totals">
        <Row label="Work done to date" value={rand(toCents(num(v, 'workDone')))} />
        <Row label="Materials on site" value={rand(toCents(num(v, 'materialsOnSite')))} />
        <Row label="Approved variations to date" value={rand(toCents(num(v, 'variationsToDate')))} />
        <Row label="Gross value to date" value={rand(f.gross)} strong />
        <Row label={`Less retention (${num(p, 'retentionPct')}%${f.capped ? `, capped at ${RETENTION_CAP_PCT}% of contract value` : ''})`} value={`− ${rand(f.retention)}`} />
        <Row label="Net value to date" value={rand(f.netCumulative)} strong />
        <Row label="Less previous certificates" value={`− ${rand(f.previous)}`} />
        <Row label="Amount due (excl. VAT)" value={rand(f.amountDue)} strong />
        <Row label={`VAT ${VAT_RATE}%`} value={rand(f.vat)} />
        <div className="grand"><span>Total incl. VAT</span><b>{rand(f.total)}</b></div>
      </div>
      {f.capped && <p className="muted-note" style={{ marginTop: 10 }}>Retention at {num(p, 'retentionPct')}% would be {rand(f.retentionCalculated)}; the demo cap of {RETENTION_CAP_PCT}% of the {rand(toCents(num(p, 'contractValue')))} contract value limits it to {rand(f.retentionCap)}.</p>}
      {v.status === 'draft' && Math.abs(num(v, 'variationsToDate') - approved) > 0.005 && (
        <div style={{ marginTop: 10 }}><Notice tone="amber">Approved variations on the project now total {rand(toCents(approved))}; this valuation includes {rand(toCents(num(v, 'variationsToDate')))}. Edit the valuation to update it.</Notice></div>
      )}
      {['certified', 'paid'].includes(v.status ?? '') && str(v, 'certifiedAmount') !== '' && (() => {
        const cert = toCents(num(v, 'certifiedAmount'));
        const sub = toCents(num(v, 'submittedAmount'));
        const vat = roundCents((cert * VAT_RATE) / 100);
        return (
          <div className="totals" style={{ marginTop: 14 }} data-testid="certificate-totals">
            <Row label={`Certified on ${str(v, 'certificateRef') || 'certificate'} (excl. VAT)`} value={rand(cert)} strong />
            {sub > cert && <Row label="Certified less than claimed by" value={rand(sub - cert)} />}
            <Row label={`VAT ${VAT_RATE}% on the certified amount`} value={rand(vat)} />
            <div className="grand"><span>{v.status === 'paid' ? 'Paid incl. VAT' : 'Payment due incl. VAT'}</span><b>{rand(cert + vat)}</b></div>
          </div>
        );
      })()}
      {str(v, 'submittedAmount') !== '' && Math.abs(num(v, 'submittedAmount') * 100 - f.amountDue) > 1 && v.status !== 'draft' && (
        <p className="muted-note" style={{ marginTop: 10 }}>Submitted as {rand(toCents(num(v, 'submittedAmount')))} — the live figure differs because earlier certificates or project values changed since.</p>
      )}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const v = findRecord(data, 'valuations', id)!;
  const def = act.def('valuations');
  const [amount, setAmount] = useState(() => (str(v, 'certifiedAmount') || str(v, 'submittedAmount')));
  const [ref, setRef] = useState(() => str(v, 'certificateRef') || `DEMO-PC-${String(num(v, 'valuationNo')).padStart(2, '0')}`);
  const [err, setErr] = useState('');
  const others = valuationsFor(data, str(v, 'project')).filter((x) => x.id !== id).reverse().slice(0, 6);

  const certify = () => {
    const n = Number(amount);
    if (amount === '' || !Number.isFinite(n)) { setErr('Enter the certified amount (excl. VAT).'); return; }
    const before = { certifiedAmount: v.values.certifiedAmount, certificateRef: v.values.certificateRef };
    act.update('valuations', id, { certifiedAmount: n, certificateRef: ref });
    const res = act.transition('valuations', id, 'certified');
    if (!res.ok) {
      act.update('valuations', id, before);
      setErr(res.reason);
      return;
    }
    act.toast(`${v.ref}: certificate recorded`);
    setErr('');
  };

  return (
    <>
      {v.status === 'submitted' && can('valuations') && (
        <div data-testid="certificate-panel">
        <Panel title="Record payment certificate" meta="Typed from the (fictional) certificate — cannot exceed the amount submitted">
          <Field label="Certified amount, excl. VAT (R)" error={err || undefined} hint={`Submitted: ${rand(toCents(num(v, 'submittedAmount')))}`}>
            <input className="input num" type="number" step="0.01" aria-label="Certified amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <div style={{ marginTop: 10 }}>
            <Field label="Certificate reference (demo)">
              <input className="input" aria-label="Certificate reference" value={ref} onChange={(e) => setRef(e.target.value)} />
            </Field>
          </div>
          <button className="btn sm primary" style={{ marginTop: 10 }} onClick={certify} data-testid="record-certificate">Record certificate</button>
        </Panel>
        </div>
      )}
      {v.status !== 'paid' && !can('valuations') && <Notice tone="grey">Valuations are prepared, certified and marked paid by {holders(data, 'valuations')}. Switch user in the top bar to try it.</Notice>}
      <Panel title="Other valuations on this project">
        {others.length ? (
          <ul className="list">
            {others.map((o) => (
              <li key={o.id}>
                <div className="grow">
                  {hasModule('valuations') ? <Link to={`${base}/valuations/${o.id}`}><b>Valuation {num(o, 'valuationNo')}</b></Link> : <b>Valuation {num(o, 'valuationNo')}</b>}
                  <small>{formatDate(str(o, 'periodEnd'))} · {str(o, 'certifiedAmount') ? `certified ${rand(toCents(num(o, 'certifiedAmount')))}` : `due ${rand(valuationFigures(data, o).amountDue)}`}</small>
                </div>
                <StatusTag workflow={def.workflow} status={o.status} />
              </li>
            ))}
          </ul>
        ) : <p className="muted-note">This is the first valuation.</p>}
      </Panel>
      <Notice tone="grey">Illustrative calculation only — not a payment certificate or tax invoice. Retention cap and contract terms are demo rules.</Notice>
    </>
  );
}
