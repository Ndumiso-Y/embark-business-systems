import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, lines, num, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { Field, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { PAYMENT_METHODS, label } from '../data';
import { invoiceBalance, invoiceOverdue, paymentProblem, todayStr } from '../helpers';
import { LinesTable, VehicleCard } from './shared';

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
  const base = useBase();
  const { hasModule } = useUser();
  const inv = findRecord(data, 'invoices', id)!;
  const today = todayStr();
  const job = findRecord(data, 'jobs', str(inv, 'job'));
  return (
    <Panel title="Invoice" meta="VAT 15% demo calculation — not a tax invoice">
      {invoiceOverdue(inv, today) && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone="red">Overdue: issued {formatDate(str(inv, 'issuedOn'))}, {daysBetween(str(inv, 'issuedOn'), today)} days ago (30-day terms).</Notice>
        </div>
      )}
      {job && <p className="muted-note" style={{ marginBottom: 10 }}>For job card {hasModule('jobs') ? <Link to={`${base}/jobs/${job.id}`}>{job.ref}</Link> : job.ref} · {str(job, 'complaint')}</p>}
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
  const balance = invoiceBalance(inv);
  const [amount, setAmount] = useState<string>(String(balance / 100));
  const [method, setMethod] = useState('card');
  const [err, setErr] = useState('');
  const open = ['issued', 'partpaid'].includes(inv.status ?? '');

  const record = () => {
    const amt = Number(amount);
    const mode = Math.round(amt * 100) === balance ? 'full' : 'part';
    const problem = paymentProblem(inv, amt, mode);
    if (problem) { setErr(problem); return; }
    act.update('invoices', inv.id, { paymentAmount: amt, paymentMethod: method });
    const res = act.transition('invoices', inv.id, mode === 'full' ? 'paid' : 'partpaid');
    if (!res.ok) { act.update('invoices', inv.id, { paymentAmount: 0 }); setErr(res.reason); return; }
    act.toast(mode === 'full' ? `${inv.ref} paid in full` : `Part payment recorded on ${inv.ref}`);
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
              <Field label="Amount received (R)" error={err || undefined}>
                <input className="input num" type="number" min={0} step="0.01" aria-label="Payment amount" data-testid="payment-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label="Method">
                <select className="select" aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <button className="btn primary sm" data-testid="record-payment" onClick={record}>Record payment</button>
              <p className="muted-note">A payment cannot exceed the outstanding balance. Less than the balance is recorded as a part payment.</p>
            </div>
          ) : <p className="muted-note">Your simulated role cannot record payments (needs “Invoicing”). Switch to the service advisor, the parts &amp; admin clerk or the owner in the top bar.</p>}
        </Panel>
      )}
    </>
  );
}
