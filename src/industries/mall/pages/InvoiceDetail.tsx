import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, lines, num, permissionHint, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import type { Line } from '../../../core/types';
import { draftCatchUp, invoiceOpen, invoiceTotals, leaseOf, leaseUnit, overdueDays, paymentProblem, periodLabel, plural, rand, randOf, shopLabel, todayStr } from '../helpers';
import { LinesTable, MallStyles, RecLink, TenantCard } from './shared';

export default function InvoiceDetail() {
  const { id } = useParams();
  const data = useData();
  const config = useIndustry();
  const inv = findRecord(data, 'invoices', id);
  const notes = str(inv, 'notes').split('\n').map((s) => s.trim()).filter(Boolean);
  return (
    // Payments are captured with an amount in the panel below, so the two generic payment buttons are hidden.
    <RecordDetail hideTransitions={['partpaid', 'paid']} aside={inv ? <Aside id={inv.id} /> : undefined}>
      {inv && <MallStyles />}
      {inv && invoiceOpen(inv) && <Payment key={`${inv.id}-${num(inv, 'paid')}`} id={inv.id} />}
      {inv && (
        <Panel title="Invoice" meta={`From ${config.businessName} · demonstration document, not a tax invoice`} right={<Tag tone="accent">{rand(invoiceTotals(inv).total)} incl. VAT</Tag>}>
          <LinesTable lines={lines(inv)} paid={invoiceTotals(inv).paid} />
          {notes.length > 0 && (
            <div style={{ marginTop: 12 }} data-testid="billing-notes">
              <Notice tone="amber"><b>Billing notes</b><ul className="problem-list">{notes.map((n) => <li key={n}>{n}</li>)}</ul></Notice>
            </div>
          )}
          {inv.status === 'draft' && <p className="muted-note" style={{ marginTop: 10 }}>Still a draft: add a charge below or correct a line with Edit, then issue it. Issuing sends nothing and posts nothing.</p>}
        </Panel>
      )}
      {inv && inv.status === 'draft' && <DraftTools key={`${inv.id}-${lines(inv).length}`} id={inv.id} />}
    </RecordDetail>
  );
}

/** For a draft: pick up lines that can now be billed, or add a once-off charge. */
function DraftTools({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const inv = findRecord(data, 'invoices', id)!;
  const catchUp = draftCatchUp(data, inv);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  if (!can('billing')) return <Panel title="Add a charge"><p className="muted-note">{permissionHint(config, data, 'billing')}</p></Panel>;
  const addCharge = () => {
    if (!description.trim() || !(Number(amount) > 0)) return act.toast('Type what the charge is for and an amount above zero.', 'err');
    const line: Line = { id: `x${lines(inv).length + 1}-${Math.round(Number(amount) * 100)}`, description: description.trim(), qty: 1, unitPrice: Number(amount) };
    act.update('invoices', id, { lines: [...lines(inv), line] }, `Charge added: ${description.trim()} ${randOf(Number(amount))}`);
    act.toast(`${inv.ref}: charge added`);
  };
  return (
    <Panel title="Add a charge" meta="Once-off charges on this draft, excl. VAT — for example a signage fee or an after-hours air-conditioning charge">
      {catchUp && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone="accent">
            <span data-testid="catch-up">Since this draft was made, {catchUp.add.map((l) => l.description).join(' and ')} can be billed.</span>
            <div style={{ marginTop: 8 }}><button className="btn sm primary" data-testid="add-catch-up" onClick={() => { act.update('invoices', id, { lines: [...lines(inv), ...catchUp.add], notes: catchUp.notes }, `Added to the draft: ${catchUp.add.map((l) => l.description).join(', ')}`); act.toast(`${inv.ref}: ${plural(catchUp.add.length, 'line')} added from the meter reading or verified turnover`); }}>Add {plural(catchUp.add.length, 'line')} to this draft</button></div>
          </Notice>
        </div>
      )}
      <div className="mall-inline">
        <Field label="What for"><input className="input" aria-label="Charge description" placeholder="e.g. After-hours air-conditioning" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="charge-description" /></Field>
        <Field label="Amount (excl. VAT)"><input className="input num" type="number" min={0} step="0.01" aria-label="Charge amount" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="charge-amount" /></Field>
        <button className="btn" onClick={addCharge} data-testid="add-charge">Add charge</button>
      </div>
    </Panel>
  );
}

/** Amount received against the invoice. Never more than the balance. */
function Payment({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const inv = findRecord(data, 'invoices', id)!;
  const t = invoiceTotals(inv);
  const [amount, setAmount] = useState(String(t.balance / 100));
  const [err, setErr] = useState('');
  const pay = () => {
    const value = Number(amount);
    const problem = paymentProblem(inv, value);
    if (problem) { setErr(problem); act.toast(problem, 'err'); return; }
    setErr('');
    act.update('invoices', id, { receipt: value });
    const res = act.transition('invoices', id, toCents(value) === t.balance ? 'paid' : 'partpaid');
    if (!res.ok) { act.update('invoices', id, { receipt: 0 }); setErr(res.reason); act.toast(res.reason, 'err'); }
  };
  return (
    <Panel title="Record a payment" meta="Typed in from the bank statement — there is no bank feed in this demo" right={<Tag tone={t.paid ? 'amber' : 'blue'}>Balance {rand(t.balance)}</Tag>}>
      {can('billing') ? (
        <div className="mall-inline">
          <Field label="Amount received (incl. VAT)" error={err || undefined}>
            <input className="input num" type="number" min={0} step="0.01" aria-label="Amount received" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(''); }} data-testid="payment-amount" />
          </Field>
          <button className="btn primary" onClick={pay} data-testid="record-payment">Record payment</button>
        </div>
      ) : <p className="muted-note">{permissionHint(config, data, 'billing')}</p>}
      <p className="muted-note" style={{ marginTop: 10 }}>The full balance settles the invoice; a smaller amount leaves it part paid. More than the balance is refused.</p>
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const inv = findRecord(data, 'invoices', id)!;
  const lease = leaseOf(data, inv.values.lease);
  const unit = leaseUnit(data, lease);
  const t = invoiceTotals(inv);
  const days = overdueDays(inv, today);
  return (
    <>
      <Panel title="Summary" right={days ? <Tag tone="red">Overdue {days} d</Tag> : undefined}>
        <KeyValues items={[
          { label: 'Month', value: periodLabel(str(inv, 'period')) },
          { label: 'Unit', value: unit ? <RecLink module="units" id={unit.id}>{shopLabel(unit)}</RecLink> : '—' },
          { label: 'Excl. VAT', value: rand(t.net) },
          { label: 'VAT', value: rand(t.vat) },
          { label: 'Total', value: <b>{rand(t.total)}</b> },
          { label: 'Paid so far', value: rand(t.paid) },
          { label: 'Balance', value: inv.status === 'draft' || inv.status === 'void' ? '—' : <b>{rand(t.balance)}</b> },
          { label: 'Due', value: formatDate(str(inv, 'dueDate')) },
          { label: 'Last payment', value: str(inv, 'paidOn') ? formatDate(str(inv, 'paidOn')) : '' },
        ]} />
        {days > 0 && <p className="muted-note" style={{ marginTop: 10 }}>Follow-up is logged under <RecLink module="arrears">Arrears & credit control</RecLink>. Interest is not calculated.</p>}
      </Panel>
      <Panel title="Tenant"><TenantCard data={data} lease={lease} /></Panel>
    </>
  );
}
