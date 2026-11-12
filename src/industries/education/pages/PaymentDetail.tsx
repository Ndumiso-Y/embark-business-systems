import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { Field, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { accountBalance, familyName, paymentProblem, rand, toCents } from '../helpers';
import { useFeedback } from './feedback';
import { ModuleLink, WhoCan } from './shared';

/** A payment waiting to be allocated: choose the family account, and split off any surplus above the balance. */
export default function PaymentDetail() {
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const fb = useFeedback();
  const payment = findRecord(data, 'payments', id);
  const [filter, setFilter] = useState('');
  if (!payment) return <RecordDetail />;

  const account = findRecord(data, 'accounts', str(payment, 'account'));
  const amount = num(payment, 'amount');
  const open = payment.status === 'received';
  const editable = open && can('fees');
  const problem = open ? paymentProblem(account, amount, data) : null;
  const balance = account ? accountBalance(account, data) : 0;
  const surplus = account && balance > 0 ? toCents(amount) - balance : 0;
  const needle = filter.trim().toLowerCase();
  const options = records(data, 'accounts')
    .map((a) => ({ a, name: familyName(data, str(a, 'family')), balance: accountBalance(a, data) }))
    .filter((o) => o.a.id === account?.id || !needle || o.name.toLowerCase().includes(needle) || o.a.ref.toLowerCase().includes(needle))
    .sort((x, y) => x.name.localeCompare(y.name));

  const choose = (accountId: string) => {
    const a = findRecord(data, 'accounts', accountId);
    act.update('payments', payment.id, { account: accountId }, a ? `Account chosen: ${familyName(data, str(a, 'family'))} (${a.ref})` : 'Account cleared');
    fb.clear();
  };
  const split = () => {
    act.update('payments', payment.id, { amount: balance / 100 }, `Amount reduced to the balance owing (${rand(balance)}); surplus of ${rand(surplus)} split off`);
    const rest = act.create('payments', { account: '', date: str(payment, 'date'), amount: surplus / 100, method: str(payment, 'method'), reference: `Surplus of ${payment.ref} — ${str(payment, 'reference')}` }, 'received', `Surplus split from ${payment.ref}`);
    fb.ok(`${rand(balance)} can now be allocated. The other ${rand(surplus)} is held as ${rest.ref} — allocate it to another account or return it to the payer.`);
  };

  return (
    <RecordDetail>
      {open && (
        <Panel title="Allocate to" meta="Match the bank reference to a family account. A payment cannot be more than the account owes."
          right={!account ? <Tag tone="amber">No account chosen</Tag> : problem ? <Tag tone="red">Cannot allocate yet</Tag> : <Tag tone="green">Ready to allocate</Tag>}>
          {editable ? (
            <div className="form-grid">
              <Field label="Find a family" hint={`Reference on the deposit: “${str(payment, 'reference') || 'none'}”`}><input className="input" aria-label="Find a family" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Type a surname…" /></Field>
              <Field label="Family account">
                <select className="select" aria-label="Allocate to account" value={account?.id ?? ''} onChange={(e) => choose(e.target.value)}>
                  <option value="">{needle ? `${options.length} match${options.length === 1 ? '' : 'es'} — choose…` : 'Choose the family account…'}</option>
                  {options.map((o) => <option key={o.a.id} value={o.a.id}>{o.name} · {o.a.ref} · owes {rand(o.balance)}</option>)}
                </select>
              </Field>
            </div>
          ) : account ? <p className="muted-note">Chosen account: {familyName(data, str(account, 'family'))} ({account.ref}).</p> : <p className="muted-note">No account has been chosen yet.</p>}
          {account && <p className="muted-note" style={{ marginTop: 10 }}><ModuleLink module="fees" id={account.id}>{familyName(data, str(account, 'family'))} account ({account.ref})</ModuleLink> owes {rand(balance)}; this payment is {rand(toCents(amount))}.</p>}
          {problem && account && (
            <div style={{ marginTop: 12 }} data-testid="allocation-problem">
              <Notice tone="red">{problem}</Notice>
              {editable && surplus > 0 && <div className="btns" style={{ marginTop: 10 }}><button className="btn" onClick={split} data-testid="split-payment">Split off the surplus of {rand(surplus)}</button></div>}
              {editable && surplus > 0 && <p className="muted-note" style={{ marginTop: 8 }}>Splitting leaves {rand(balance)} on this payment to allocate here, and holds the other {rand(surplus)} as a separate receipt to allocate elsewhere or return.</p>}
            </div>
          )}
          {!problem && account && <div style={{ marginTop: 12 }}><Notice tone="accent">Ready — press “Allocate to account” above. The payment then appears on the family’s statement and reduces what they owe.</Notice></div>}
          {fb.view}
          <WhoCan permission="fees" what="Allocating payments:" />
        </Panel>
      )}
      {payment.status === 'allocated' && account && (
        <Notice tone="accent">Allocated to the <ModuleLink module="fees" id={account.id}><b>{familyName(data, str(account, 'family'))} account ({account.ref})</b></ModuleLink> — it shows on the family’s statement.</Notice>
      )}
    </RecordDetail>
  );
}
