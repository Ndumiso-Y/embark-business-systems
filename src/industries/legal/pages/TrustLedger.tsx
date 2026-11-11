import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { Empty, Field, Notice, PageHeader, Panel, Stat, StatusTag } from '../../../core/components/ui';
import { WorkflowActions } from '../../../core/components/records';
import { TRUST_TYPES, label } from '../data';
import {
  captureProblem, clientName, formatCents, invoiceOutstanding, isOutflow, ledgerRows, pendingOutflowCents, todayStr, trustBalance, trustBalanceOf,
} from '../helpers';
import { MatterLink } from './shared';

export function TrustNotice() {
  return (
    <Notice tone="red">
      <b>Simulation only — not a trust accounting system.</b> This ledger is not Legal Practice Act or Legal Practice Council compliant,
      has no bank integration, reconciliation, interest calculation or statutory audit trail, and no money moves. It demonstrates one rule:
      a matter’s trust balance can never go negative.
    </Notice>
  );
}

export default function TrustLedger() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can } = useUser();
  const def = act.def('trust');
  const today = todayStr();
  const [params, setParams] = useSearchParams();
  const txns = records(data, 'trust');
  const matterIds = [...new Set(txns.map((t) => str(t, 'matter')))];
  const summary = matterIds.map((id) => ({ id, matter: findRecord(data, 'matters', id), balance: trustBalanceOf(txns, id), pending: pendingOutflowCents(data, id) }))
    .filter((x) => x.matter)
    .sort((a, b) => b.balance - a.balance);
  const selected = params.get('matter') || summary[0]?.id || '';
  const matter = findRecord(data, 'matters', selected);
  const rows = matter ? ledgerRows(data, selected) : [];
  const bal = matter ? trustBalance(data, selected) : 0;
  const pend = matter ? pendingOutflowCents(data, selected) : 0;
  const totalHeld = summary.reduce((n, s) => n + s.balance, 0);
  const awaiting = txns.filter((t) => t.status === 'captured');
  const selectable = records(data, 'matters').filter((m) => ['engagement', 'active', 'closing'].includes(m.status ?? '') || matterIds.includes(m.id));

  const blank = { type: 'deposit', amount: '', date: today, payee: '', invoice: '', bankRef: '', description: '' };
  const [form, setForm] = useState<Record<string, string>>(blank);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const invoices = records(data, 'invoices').filter((i) => str(i, 'matter') === selected && invoiceOutstanding(i) > 0);
  const capture = () => {
    const amount = Number(form.amount);
    const problem = captureProblem(data, selected, form.type, amount)
      ?? (!form.payee.trim() ? 'Enter who the money was received from or paid to.' : null)
      ?? (!form.description.trim() ? 'Enter a description.' : null)
      ?? (form.type === 'transfer' && !form.invoice ? 'Link the transfer to the fee note it pays.' : null);
    if (problem) { setErr(problem); return; }
    const r = act.create('trust', { matter: selected, type: form.type, amount: Math.round(amount * 100) / 100, date: form.date || today, payee: form.payee.trim(), invoice: form.invoice, bankRef: form.bankRef.trim(), description: form.description.trim() }, 'captured', 'Trust transaction captured');
    act.toast(`${r.ref} captured — awaiting partner approval (simulated)`);
    setForm(blank); setErr('');
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Time & money`} title="Trust ledger (simulated)" subtitle="Per-matter deposits, payments to third parties and fee transfers. Captured by the bookkeeper or secretary, approved by a partner." />
      <TrustNotice />
      <div className="section-gap" />
      <div className="stat-grid">
        <Stat label="Held in trust (simulated)" value={formatCents(totalHeld)} sub={`${summary.filter((s) => s.balance > 0).length} matters with a balance`} />
        <Stat label="Awaiting approval" value={awaiting.length} tone={awaiting.length ? 'red' : undefined} sub="Captured, not yet approved" />
        <Stat label={matter ? `${matter.ref} balance` : 'Matter balance'} value={formatCents(bal)} tone="accent" sub="Approved transactions only" />
        <Stat label="Available to pay" value={formatCents(bal - pend)} sub={`After ${formatCents(pend)} pending payments`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title={matter ? `Ledger — ${str(matter, 'name')}` : 'Ledger'} meta={matter ? `${matter.ref} · client ${clientName(data, matter.values.client)}` : undefined}
          right={(
            <select className="select sm" aria-label="Select matter" value={selected} onChange={(e) => setParams({ matter: e.target.value })} data-testid="trust-matter">
              {selectable.map((m) => <option key={m.id} value={m.id}>{m.ref} · {str(m, 'name')}</option>)}
            </select>
          )}>
          {rows.length ? (
            <div className="table-wrap">
              <table className="table" data-testid="trust-ledger" style={{ minWidth: 720 }}>
                <thead><tr><th>Date</th><th>Transaction</th><th className="num">In</th><th className="num">Out</th><th className="num">Balance</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map(({ record: t, balance }) => {
                    const amt = formatCents(toCents(num(t, 'amount')));
                    return (
                      <tr key={t.id}>
                        <td>{formatDate(str(t, 'date'))}</td>
                        <td><Link to={`${base}/trust/${t.id}`}><strong>{label(TRUST_TYPES, str(t, 'type'))}</strong></Link><small>{t.ref} · {str(t, 'payee')} · {str(t, 'description')}</small></td>
                        <td className="num">{isOutflow(str(t, 'type')) ? '' : amt}</td>
                        <td className="num">{isOutflow(str(t, 'type')) ? amt : ''}</td>
                        <td className="num">{t.status === 'approved' ? formatCents(balance) : '—'}</td>
                        <td><StatusTag workflow={def.workflow} status={t.status} />{t.status === 'captured' && <WorkflowActions def={def} record={t} compact />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty title="No trust transactions for this matter" />}
        </Panel>
        <Panel title="Capture transaction" meta={matter ? `For ${matter.ref}` : 'Select a matter'}>
          {can('trust.record') && matter ? (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); capture(); }} noValidate>
              <Field label="Transaction">
                <select className="select" aria-label="Transaction type" value={form.type} onChange={(e) => set('type', e.target.value)}>
                  {TRUST_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Amount (R)" hint={isOutflow(form.type) ? `Available: ${formatCents(bal - pend)}` : undefined}>
                <input className="input num" type="number" min={0} step={0.01} aria-label="Amount" value={form.amount} onChange={(e) => set('amount', e.target.value)} data-testid="trust-amount" />
              </Field>
              <Field label="Date"><input className="input" type="date" aria-label="Date" value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
              <Field label={form.type === 'deposit' ? 'Received from' : 'Paid to'}><input className="input" aria-label="Payee" value={form.payee} onChange={(e) => set('payee', e.target.value)} /></Field>
              {form.type === 'transfer' && (
                <Field label="Fee note paid">
                  <select className="select" aria-label="Fee note" value={form.invoice} onChange={(e) => set('invoice', e.target.value)}>
                    <option value="">Select fee note…</option>
                    {invoices.map((i) => <option key={i.id} value={i.id}>{i.ref} · outstanding {formatCents(invoiceOutstanding(i))}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Reference (fictional)"><input className="input" aria-label="Reference" placeholder="DEMO-EFT-…" value={form.bankRef} onChange={(e) => set('bankRef', e.target.value)} /></Field>
              <Field label="Description" error={err || undefined}><textarea className="textarea" aria-label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
              <div className="btns"><button className="btn primary" type="submit" data-testid="capture-trust">Capture for approval</button></div>
            </form>
          ) : <Notice tone="grey">{matter ? 'Your simulated role cannot capture trust transactions.' : 'Select a matter.'}</Notice>}
        </Panel>
      </div>
      <Panel title="Balances by matter" meta="Approved balances · simulated">
        {summary.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Matter</th><th>Client</th><th className="num">Approved balance</th><th className="num">Pending payments</th><th /></tr></thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.id}>
                    <td><MatterLink data={data} id={s.id} /><small>{s.matter!.ref}</small></td>
                    <td>{clientName(data, s.matter!.values.client)}</td>
                    <td className="num">{formatCents(s.balance)}</td>
                    <td className="num">{s.pending ? formatCents(s.pending) : '—'}</td>
                    <td><button className="btn xs" onClick={() => setParams({ matter: s.id })}>View ledger</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No trust activity" />}
      </Panel>
    </>
  );
}
