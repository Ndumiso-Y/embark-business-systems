import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { useStore } from '../../../core/store';
import { findRecord, num, records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Panel, Stat, StatusTag } from '../../../core/components/ui';
import { RecordDetail, WorkflowActions } from '../../../core/components/records';
import { PAY_METHODS, SIBLING_DISCOUNT_PCT } from '../data';
import {
  accountBalance, accountEntries, accountMonths, ageing, arrearsOf, classOf, familyFees, familyName, fullName, paymentProblem, rand, toCents, todayStr,
} from '../helpers';
import { useFeedback } from './feedback';
import { ModuleLink, WhoCan } from './shared';

/** A family's fee account: balance and ageing, a payment form, the children's fees, the statement and any payment arrangement. */
export default function AccountDetail() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const fb = useFeedback();
  const arrFb = useFeedback();
  const account = findRecord(data, 'accounts', id);
  const today = todayStr();
  const [pay, setPay] = useState({ amount: '', method: 'eft', date: today, reference: '' });
  const [terms, setTerms] = useState<{ instalment: string; months: string } | null>(null);
  if (!account) return <RecordDetail />;

  const family = findRecord(data, 'families', str(account, 'family'));
  const balance = accountBalance(account, data);
  const age = ageing(account, data, today);
  const fees = familyFees(data, str(account, 'family'), accountMonths(account));
  const entries = accountEntries(account, data);
  const paid = entries.filter((e) => e.kind === 'payment').reduce((n, e) => n + e.cents, 0);
  const arrDef = act.def('arrangements');
  const arrangements = records(data, 'arrangements').filter((a) => str(a, 'account') === account.id);
  const arrangement = arrangements.find((a) => !['completed', 'defaulted'].includes(a.status ?? ''));
  const past = arrangements.filter((a) => a !== arrangement);
  const tf = terms ?? { instalment: String(num(arrangement, 'instalment') || ''), months: String(num(arrangement, 'months') || '') };
  let running = 0;

  const recordPayment = () => {
    const amount = Number(pay.amount);
    const live = useStore.getState().data[config.id]!;
    const problem = pay.date > today ? 'A payment cannot be dated in the future.' : !pay.date ? 'Enter the date the payment was received.' : paymentProblem(account, amount, live);
    if (problem) { fb.fail(problem); return; }
    const rec = act.create('payments', { account: account.id, date: pay.date, amount, method: pay.method, reference: pay.reference.trim() }, 'allocated', `Payment recorded on the ${familyName(data, str(account, 'family'))} account`);
    act.toast(`${rand(toCents(amount))} recorded (${rec.ref})`);
    fb.ok(`${rand(toCents(amount))} recorded as ${rec.ref}. The balance is now ${rand(balance - toCents(amount))}.`);
    setPay({ amount: '', method: pay.method, date: today, reference: '' });
  };
  const propose = () => {
    const arrears = Math.max(arrearsOf(age), 0) / 100;
    act.create('arrangements', { account: account.id, arrears, instalment: Math.ceil(arrears / 6 / 50) * 50, months: 6, startDate: addDays(today, 7), note: '' }, 'proposed', 'Payment arrangement proposed');
    arrFb.ok('Arrangement proposed with the arrears spread over six months. Adjust the terms if needed — the bursar approves it.');
  };
  const saveTerms = () => {
    if (!arrangement) return;
    const [instalment, months] = [Number(tf.instalment), Number(tf.months)];
    if (!(instalment > 0) || !(months >= 1 && months <= 12)) { arrFb.fail('Enter an instalment above zero and between 1 and 12 months.'); return; }
    act.update('arrangements', arrangement.id, { instalment, months }, `Terms set: ${rand(toCents(instalment))} × ${months} months`);
    setTerms(null);
    arrFb.ok(instalment * months * 100 >= toCents(num(arrangement, 'arrears')) ? 'Terms saved — they clear the arrears. The bursar can approve the arrangement.' : `Terms saved, but ${rand(toCents(instalment))} × ${months} does not clear the arrears of ${rand(toCents(num(arrangement, 'arrears')))}.`);
  };

  return (
    <RecordDetail
      aside={
        <>
          <Panel title="Family" meta={family?.ref}>
            <KeyValues items={[
              { label: str(family, 'relation1') || 'Guardian', value: str(family, 'guardian1') },
              { label: 'Phone (fictional)', value: str(family, 'phone1') },
              { label: 'Email', value: str(family, 'email1'), wide: true },
            ]} />
          </Panel>
          <Panel title="Ageing" meta="What is owing, by the age of the invoice">
            <KeyValues items={[
              { label: 'Current (under 30 days)', value: rand(age.current) },
              { label: '30 days', value: rand(age.d30) },
              { label: '60 days', value: rand(age.d60) },
              { label: '90+ days', value: rand(age.d90) },
            ]} />
          </Panel>
        </>
      }>
      <div className="stat-grid compact" style={{ marginBottom: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Stat label="Balance owing" value={<span data-testid="balance">{rand(balance)}</span>} tone={arrearsOf(age) > 0 ? 'red' : 'accent'} sub={balance < 0 ? 'in credit' : arrearsOf(age) > 0 ? `${rand(arrearsOf(age))} is 30+ days old` : 'nothing overdue'} />
        <Stat label="Monthly instalment" value={rand(fees.monthly)} sub={`${fees.rows.length} learner${fees.rows.length === 1 ? '' : 's'} · over ${accountMonths(account)} months`} />
        <Stat label="Paid to date" value={rand(paid)} sub={`${entries.filter((e) => e.kind === 'payment').length} payments`} />
        <Stat label="Invoiced to date" value={rand(entries.filter((e) => e.kind === 'invoice').reduce((n, e) => n + e.cents, 0))} sub={`${entries.filter((e) => e.kind === 'invoice').length} monthly invoices`} />
      </div>

      <Panel title="Record a payment" meta="EFT, card or cash received at the office. A payment cannot be more than the balance owing.">
        {can('fees') ? (
          <>
            <div className="form-grid">
              <Field label="Amount (R)"><input className="input num" type="number" min={0} step="0.01" aria-label="Payment amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder={balance > 0 ? (balance / 100).toFixed(2) : '0.00'} /></Field>
              <Field label="Method">
                <select className="select" aria-label="Payment method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                  {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Date received"><input className="input" type="date" aria-label="Payment date" max={today} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
              <Field label="Reference"><input className="input" aria-label="Payment reference" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="e.g. bank reference or receipt number" /></Field>
            </div>
            <div className="btns" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={recordPayment} data-testid="record-payment">Record payment</button>
              {balance > 0 && <button className="btn" onClick={() => setPay({ ...pay, amount: (balance / 100).toFixed(2) })}>Fill in the full balance ({rand(balance)})</button>}
              {fees.monthly > 0 && fees.monthly < balance && <button className="btn" onClick={() => setPay({ ...pay, amount: (fees.monthly / 100).toFixed(2) })}>One instalment ({rand(fees.monthly)})</button>}
            </div>
          </>
        ) : null}
        {fb.view}
        <WhoCan permission="fees" what="Recording payments:" />
        <p className="muted-note" style={{ marginTop: 10 }}>Typed in by the office — no card machine, bank feed or payment gateway is connected to this demo.</p>
      </Panel>

      <Panel title="Children & monthly fee" meta={`Annual fee ÷ ${accountMonths(account)} months · the child with the highest fee pays in full, each sibling gets ${SIBLING_DISCOUNT_PCT}% off (demo rule)`}>
        <div className="table-wrap">
          <table className="table" data-testid="family-fees">
            <thead><tr><th>Learner</th><th>Fee plan</th><th className="num">Annual fee</th><th className="num">Sibling discount</th><th className="num">Monthly</th></tr></thead>
            <tbody>
              {fees.rows.map((r) => (
                <tr key={r.learner.id}>
                  <td><strong><ModuleLink module="learners" id={r.learner.id}>{fullName(r.learner)}</ModuleLink></strong><small>{str(classOf(data, r.learner), 'name')}</small></td>
                  <td>{str(r.plan, 'name') || '—'}</td>
                  <td className="num">{rand(r.annual)}</td>
                  <td className="num">{r.discount ? `−${rand(r.discount)}` : '—'}</td>
                  <td className="num">{rand(r.monthly)}</td>
                </tr>
              ))}
              <tr><td colSpan={4} className="num"><strong>Monthly instalment</strong></td><td className="num"><strong>{rand(fees.monthly)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Statement" meta="Invoices and payments, oldest first">
        <div className="table-wrap">
          <table className="table" data-testid="statement">
            <thead><tr><th>Date</th><th>Description</th><th className="num">Invoiced</th><th className="num">Paid</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {entries.map((e, i) => {
                running += e.kind === 'invoice' ? e.cents : -e.cents;
                return (
                  <tr key={`${e.date}${e.label}${i}`}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(e.date)}</td><td>{e.label}</td>
                    <td className="num">{e.kind === 'invoice' ? rand(e.cents) : ''}</td><td className="num">{e.kind === 'payment' ? rand(e.cents) : ''}</td><td className="num">{rand(running)}</td>
                  </tr>
                );
              })}
              {!entries.length && <tr><td colSpan={5}>No invoices or payments yet — the first invoice comes with the next monthly run.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Payment arrangement" meta="For accounts in arrears: an extra monthly instalment on top of the fee, approved by the bursar"
        right={arrangement ? <StatusTag workflow={arrDef.workflow} status={arrangement.status} /> : undefined}>
        {arrangement ? (
          <div data-testid="arrangement">
            <KeyValues items={[
              { label: 'Arrears when proposed', value: rand(toCents(num(arrangement, 'arrears'))) },
              { label: 'Terms', value: `${rand(toCents(num(arrangement, 'instalment')))} extra a month × ${num(arrangement, 'months')} months = ${rand(toCents(num(arrangement, 'instalment')) * num(arrangement, 'months'))}` },
              { label: 'First instalment', value: formatDate(str(arrangement, 'startDate')) },
              { label: 'Background', value: str(arrangement, 'note'), wide: true },
            ]} />
            {arrangement.status === 'proposed' && can('fees') && (
              <div className="toolbar" style={{ marginTop: 12, marginBottom: 0, alignItems: 'flex-end' }}>
                <Field label="Terms — extra a month (R)"><input className="input num" style={{ width: 140 }} type="number" min={0} step="50" aria-label="Arrangement instalment" value={tf.instalment} onChange={(e) => setTerms({ ...tf, instalment: e.target.value })} /></Field>
                <Field label="Months"><input className="input num" style={{ width: 90 }} type="number" min={1} max={12} aria-label="Arrangement months" value={tf.months} onChange={(e) => setTerms({ ...tf, months: e.target.value })} /></Field>
                <button className="btn" onClick={saveTerms} disabled={terms === null} data-testid="save-terms">Save terms</button>
              </div>
            )}
            <div style={{ marginTop: 14 }}><WorkflowActions def={arrDef} record={arrangement} /></div>
          </div>
        ) : (
          <>
            <p className="muted-note">{arrearsOf(age) > 0 ? `No arrangement in place. ${rand(arrearsOf(age))} is 30 or more days overdue.` : 'No arrangement needed — nothing on this account is 30 days overdue.'}</p>
            {arrearsOf(age) > 0 && can('fees') && <div className="btns" style={{ marginTop: 10 }}><button className="btn" onClick={propose} data-testid="propose-arrangement">Propose an arrangement</button></div>}
          </>
        )}
        {arrFb.view}
        {past.length > 0 && <p className="muted-note" style={{ marginTop: 12 }}>Earlier: {past.map((a) => `${a.ref} — ${a.status} (${rand(toCents(num(a, 'instalment')))} × ${num(a, 'months')})`).join('; ')}.</p>}
      </Panel>
    </RecordDetail>
  );
}
