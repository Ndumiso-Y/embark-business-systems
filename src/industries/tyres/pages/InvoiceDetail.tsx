import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, lines, num, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { Field, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { PAYMENT_METHODS, label } from '../data';
import { fleetOfCustomer, invoiceBalance, invoiceOverdue, paymentProblem, servicesText, todayStr } from '../helpers';
import { LinesTable, RecordLink, VehicleCard } from './shared';

export default function InvoiceDetail() {
  const { id } = useParams();
  const data = useData();
  const inv = findRecord(data, 'invoices', id);
  return (
    <RecordDetail aside={inv ? <Aside id={inv.id} /> : undefined}>
      {inv && <Body id={inv.id} />}
    </RecordDetail>
  );
}

function Body({ id }: { id: string }) {
  const data = useData();
  const inv = findRecord(data, 'invoices', id)!;
  const today = todayStr();
  const job = findRecord(data, 'jobs', str(inv, 'job'));
  return (
    <Panel title="Invoice" meta="VAT 15% demo calculation — not a tax invoice">
      {invoiceOverdue(inv, today) && <div style={{ marginBottom: 12 }}><Notice tone="red">Overdue: due {formatDate(str(inv, 'dueOn'))}, {daysBetween(str(inv, 'dueOn'), today)} days ago (30-day fleet terms).</Notice></div>}
      {job && <p className="muted-note" style={{ marginBottom: 10 }}>For <RecordLink module="jobs" record={job} /> · {servicesText(job)}{str(inv, 'fleetPo') ? ` · PO ${str(inv, 'fleetPo')}` : ''}</p>}
      <LinesTable lines={lines(inv)} paid={Math.round(num(inv, 'paid') * 100)} />
      {str(inv, 'lastPaymentOn') && <p className="muted-note" style={{ marginTop: 10 }}>Last payment {formatDate(str(inv, 'lastPaymentOn'))} · {label(PAYMENT_METHODS, str(inv, 'paymentMethod'))}</p>}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const inv = findRecord(data, 'invoices', id)!;
  const fleet = fleetOfCustomer(data, findRecord(data, 'customers', str(inv, 'customer')));
  const balance = invoiceBalance(inv);
  const [amount, setAmount] = useState<string>(String(balance / 100));
  const [method, setMethod] = useState(fleet ? 'remittance' : 'card');
  const [err, setErr] = useState('');
  const open = ['issued', 'onaccount'].includes(inv.status ?? '');

  const record = () => {
    const amt = Number(amount);
    const mode = Math.round(amt * 100) === balance ? 'full' : 'part';
    if (mode === 'part' && inv.status !== 'onaccount') { setErr(paymentProblem({ ...inv, values: { ...inv.values, paymentMethod: method } }, amt, 'full') ?? 'Retail invoices are settled in full.'); return; }
    const problem = paymentProblem({ ...inv, values: { ...inv.values, paymentMethod: method } }, amt, mode);
    if (problem) { setErr(problem); return; }
    act.update('invoices', inv.id, { paymentAmount: amt, paymentMethod: method });
    const res = act.transition('invoices', inv.id, mode === 'full' ? 'paid' : 'onaccount');
    if (!res.ok) { act.update('invoices', inv.id, { paymentAmount: 0 }); setErr(res.reason); return; }
    act.toast(mode === 'full' ? `${inv.ref} paid in full` : `Part remittance recorded on ${inv.ref}`);
    setErr('');
    setAmount(String(Math.max(0, balance - Math.round(amt * 100)) / 100));
  };

  return (
    <>
      <Panel title="Vehicle & customer"><VehicleCard data={data} vehicleId={inv.values.vehicle} /></Panel>
      {open && (
        <Panel title="Record payment" meta={`Outstanding ${formatRand(balance)} · no payment is processed`}>
          {can('invoicing') ? (
            <div className="stack" style={{ gap: 10 }}>
              <Field label="Amount received (R)" error={err || undefined} hint={inv.status === 'onaccount' ? 'Part remittances are allowed on fleet accounts.' : 'Retail invoices are settled in full at the counter.'}>
                <input className="input num" type="number" min={0} step="0.01" aria-label="Payment amount" data-testid="payment-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label="Method">
                <select className="select" aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <button className="btn primary" type="button" onClick={record} data-testid="record-payment">Record payment</button>
              {fleet && inv.status === 'issued' && <p className="muted-note">Fleet customer — use “Put on fleet account (30 days)” in the workflow panel instead of taking payment.</p>}
            </div>
          ) : <p className="muted-note">Your simulated role cannot record payments.</p>}
        </Panel>
      )}
    </>
  );
}
