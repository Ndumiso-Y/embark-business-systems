import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, lines, linesTotals, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { Field, KeyValues, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { VAT_RATE, clientName, formatCents, invoiceOutstanding, invoiceTotal } from '../helpers';
import { MatterLink } from './shared';

export default function InvoiceDetail() {
  const { id } = useParams();
  const data = useData();
  const inv = findRecord(data, 'invoices', id);
  return (
    <RecordDetail aside={inv ? <Aside id={inv.id} /> : undefined}>
      {inv && <FeeNote id={inv.id} />}
    </RecordDetail>
  );
}

function FeeNote({ id }: { id: string }) {
  const data = useData();
  const inv = findRecord(data, 'invoices', id)!;
  const matter = findRecord(data, 'matters', str(inv, 'matter'));
  const t = linesTotals(lines(inv), VAT_RATE);
  return (
    <Panel title="Fee note" meta="Mahlaba & Rossouw Attorneys (fictional) · VAT 15% (demo)">
      <KeyValues items={[
        { label: 'Client', value: clientName(data, matter?.values.client) },
        { label: 'Matter', value: <MatterLink data={data} id={str(inv, 'matter')} /> },
        { label: 'Case number', value: str(matter, 'caseNo') },
        { label: 'Date / due', value: `${formatDate(str(inv, 'date'))} · due ${formatDate(str(inv, 'dueDate'))}` },
      ]} />
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="table">
          <thead><tr><th>Fee earner</th><th>Item</th><th className="num">Hours</th><th className="num">Rate</th><th className="num">Excl. VAT</th></tr></thead>
          <tbody>
            {lines(inv).map((l, i) => (
              <tr key={l.id}><td>{l.code}</td><td>{l.description}</td><td className="num">{l.qty.toFixed(1)}</td><td className="num">{formatCents(toCents(l.unitPrice))}</td><td className="num">{formatCents(t.lines[i].excl)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="totals" style={{ marginTop: 12 }}>
        <div className="row"><span>Fees excl. VAT</span><b>{formatCents(t.net)}</b></div>
        <div className="row"><span>VAT 15%</span><b>{formatCents(t.vat)}</b></div>
        <div className="row"><span>Payments received</span><b>−{formatCents(toCents(num(inv, 'paid')))}</b></div>
        <div className="grand"><span>Balance due</span><b>{formatCents(invoiceOutstanding(inv))}</b></div>
      </div>
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const inv = findRecord(data, 'invoices', id)!;
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');
  const open = ['issued', 'partpaid'].includes(inv.status ?? '');
  const outstanding = invoiceOutstanding(inv);
  const record = () => {
    const cents = toCents(Number(amount));
    if (!(cents > 0)) return setErr('Enter an amount greater than zero.');
    if (cents > outstanding) return setErr(`That is more than the balance due (${formatCents(outstanding)}).`);
    const paid = Math.round((num(inv, 'paid') + cents / 100) * 100) / 100;
    act.update('invoices', inv.id, { paid }, `Payment received ${formatCents(cents)} (simulated)`);
    const full = toCents(paid) >= invoiceTotal(inv);
    const res = full ? act.transition('invoices', inv.id, 'paid') : inv.status === 'issued' ? act.transition('invoices', inv.id, 'partpaid') : { ok: true as const };
    act.toast(res.ok ? `${inv.ref}: payment recorded` : res.reason, res.ok ? 'ok' : 'err');
    setAmount(''); setErr('');
  };
  return (
    <Panel title="Payments" meta="Recorded manually — no bank feed">
      <KeyValues items={[
        { label: 'Total incl. VAT', value: formatCents(invoiceTotal(inv)) },
        { label: 'Received', value: formatCents(toCents(num(inv, 'paid'))) },
        { label: 'Balance due', value: formatCents(outstanding) },
      ]} />
      {open && can('billing') && (
        <form className="stack" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); record(); }} noValidate>
          <Field label="Payment received (R)" error={err || undefined}>
            <input className="input num" type="number" min={0} step={0.01} aria-label="Payment amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <div className="btns">
            <button className="btn primary sm" type="submit">Record payment</button>
            <button className="btn sm" type="button" onClick={() => setAmount((outstanding / 100).toFixed(2))}>Full balance</button>
          </div>
        </form>
      )}
      <div style={{ marginTop: 12 }}><Notice tone="grey">Fees can also be paid by a trust transfer linked to this fee note on the Trust ledger, once approved by a partner.</Notice></div>
    </Panel>
  );
}
