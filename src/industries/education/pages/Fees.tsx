import { Link } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate, monthLabel } from '../../../core/lib/dates';
import { Empty, Notice, Panel, Stat, StatusTag, Tag } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { SIBLING_DISCOUNT_PCT } from '../data';
import {
  accountsToBill, activeArrangement, arrearsOf, billingProblem, collectedIn, familyName, formatLines, linesOf, rand, refNum, runFor, runTotal, schoolAgeing, toCents, todayStr,
} from '../helpers';
import { useFeedback } from './feedback';
import { WhoCan } from './shared';

/** Fee accounts with the month-end invoice run, arrears ageing, fee plans and payment arrangements. */
export default function Fees() {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const fb = useFeedback();
  const today = todayStr();
  const month = today.slice(0, 7);
  const run = runFor(data, month);
  const toBill = accountsToBill(data, month);
  const billTotal = toBill.reduce((n, x) => n + x.cents, 0);
  const age = schoolAgeing(data, today);
  const collected = collectedIn(data, month);
  const owing = age.rows.reduce((n, r) => n + Math.max(0, r.balance), 0);
  const late = [...age.inArrears].sort((a, b) => b.age.d90 - a.age.d90 || b.age.d60 - a.age.d60 || arrearsOf(b.age) - arrearsOf(a.age));
  const waiting = records(data, 'payments').filter((p) => p.status === 'received');
  const plans = records(data, 'feePlans');
  const runs = [...records(data, 'billingRuns')].sort((a, b) => str(b, 'month').localeCompare(str(a, 'month')));
  const arrangements = records(data, 'arrangements');
  const arrDef = act.def('arrangements');

  const raise = () => {
    const problem = billingProblem(data, month);
    if (problem) { fb.fail(problem); return; }
    act.create('billingRuns', { month, date: today, lines: formatLines(new Map(toBill.map((x) => [refNum(x.account), x.cents]))) }, undefined, `${monthLabel(month)} invoices raised for ${toBill.length} accounts`);
    act.toast(`${toBill.length} invoices raised for ${monthLabel(month)} — ${rand(billTotal)} billed`);
    fb.ok(`${toBill.length} family accounts invoiced ${rand(billTotal)} for ${monthLabel(month)}, due on the 7th. Open any account below to see the new line on its statement.`);
  };

  return (
    <RegisterPage>
      <div className="stat-grid">
        <Stat label={`Collected in ${monthLabel(month)}`} value={rand(collected)} tone="accent" sub={run ? `of ${rand(runTotal(run))} billed this month` : `${monthLabel(month)} invoices not raised yet`} />
        <Stat label="Owing on all accounts" value={rand(owing)} sub={`${age.rows.filter((r) => r.balance > 0).length} of ${age.rows.length} families owe something`} />
        <Stat label="In arrears (30+ days)" value={rand(age.arrears)} tone={age.arrears ? 'red' : undefined} sub={`${age.inArrears.length} families · ${rand(age.d90)} is 90+ days old`} />
        <Stat label="Payments to allocate" value={waiting.length} tone={waiting.length ? 'red' : undefined} sub={hasModule('payments') ? <Link to={`${base}/payments`}>Open payments received</Link> : 'bank deposits not yet on an account'} />
      </div>
      <div className="grid-2">
        <Panel title="Arrears ageing" meta="Payments settle the oldest invoices first; what is left is aged from the invoice date">
          {late.length ? (
            <div className="table-wrap">
              <table className="table" data-testid="ageing">
                <thead><tr><th>Family account</th><th className="num">30 days</th><th className="num">60 days</th><th className="num">90+ days</th><th className="num">Total owing</th></tr></thead>
                <tbody>
                  {late.map(({ account, age: a, balance }) => (
                    <tr key={account.id}>
                      <td><strong><Link to={`${base}/fees/${account.id}`}>{familyName(data, str(account, 'family'))}</Link></strong><small>{account.ref}{activeArrangement(data, account.id) ? ` · arrangement ${activeArrangement(data, account.id)!.status}` : ''}</small></td>
                      <td className="num">{a.d30 ? rand(a.d30) : '—'}</td><td className="num">{a.d60 ? rand(a.d60) : '—'}</td><td className="num">{a.d90 ? <span style={{ color: 'var(--danger)' }}>{rand(a.d90)}</span> : '—'}</td>
                      <td className="num"><strong>{rand(balance)}</strong></td>
                    </tr>
                  ))}
                  <tr><td><strong>Total</strong></td><td className="num">{rand(age.d30)}</td><td className="num">{rand(age.d60)}</td><td className="num">{rand(age.d90)}</td><td className="num"><strong>{rand(late.reduce((n, r) => n + r.balance, 0))}</strong></td></tr>
                </tbody>
              </table>
            </div>
          ) : <Empty title="No account is in arrears" />}
        </Panel>
        <div className="stack">
          <Panel title={`Month-end — ${monthLabel(month)}`} meta="One invoice per family: each child’s monthly instalment, less the sibling discount"
            right={can('fees') ? <button className="btn primary" disabled={!!run} onClick={raise} data-testid="raise-invoices">{run ? 'Invoices raised' : `Raise ${monthLabel(month)} invoices (${toBill.length})`}</button> : undefined}>
            {run
              ? <Notice tone="grey">{monthLabel(month)} invoices were raised on {formatDate(str(run, 'date'))}: {linesOf(run).size} accounts, {rand(runTotal(run))}.</Notice>
              : <Notice tone="accent">{toBill.length} accounts will be billed {rand(billTotal)} for {monthLabel(month)}. Families on the 10-month plan are billed February to November only.</Notice>}
            {fb.view}
            <p className="muted-note" style={{ marginTop: 10 }}>Demo rules: the child with the highest fee pays in full and each brother or sister gets {SIBLING_DISCOUNT_PCT}% off. School fees are shown without VAT as a demo simplification; these are not tax invoices.</p>
            <WhoCan permission="fees" what="Raising invoices:" />
          </Panel>
          <Panel title="Payment arrangements" meta="Proposed → approved by the bursar → active, then completed or defaulted">
            {arrangements.length ? (
              <ul className="list" data-testid="arrangements">
                {arrangements.map((a) => (
                  <li key={a.id} style={{ padding: '9px 0' }}>
                    <div className="grow"><Link to={`${base}/fees/${str(a, 'account')}`}><b>{familyName(data, str(findRecord(data, 'accounts', str(a, 'account')), 'family'))}</b></Link><small>{rand(toCents(num(a, 'instalment')))} extra a month × {num(a, 'months')} · arrears {rand(toCents(num(a, 'arrears')))} when proposed</small></div>
                    <StatusTag workflow={arrDef.workflow} status={a.status} />
                  </li>
                ))}
              </ul>
            ) : <p className="muted-note">None. Propose one from an account that is in arrears.</p>}
          </Panel>
        </div>
      </div>
      <div className="grid-2-even">
        <Panel title="Fee plans by grade" meta="Annual school fee, paid over 12 or 10 months">
          <div className="table-wrap">
            <table className="table" data-testid="fee-plans">
              <thead><tr><th>Plan</th><th className="num">Annual fee</th><th className="num">× 12</th><th className="num">× 10</th><th className="num">Deposit</th></tr></thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}><td><strong>{str(p, 'name')}</strong></td><td className="num">{rand(toCents(num(p, 'annualFee')))}</td><td className="num">{rand(Math.round(toCents(num(p, 'annualFee')) / 12))}</td><td className="num">{rand(Math.round(toCents(num(p, 'annualFee')) / 10))}</td><td className="num">{rand(toCents(num(p, 'deposit')))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Invoice runs" meta="One run per month">
          <ul className="list" data-testid="invoice-runs">
            {runs.slice(0, 5).map((r) => (
              <li key={r.id} style={{ padding: '8px 0' }}><div className="grow"><b>{monthLabel(str(r, 'month'))}</b><small>{r.ref} · {linesOf(r).size} accounts</small></div><Tag tone="dark">{rand(runTotal(r))}</Tag></li>
            ))}
          </ul>
          {runs.length > 5 && <p className="muted-note" style={{ marginTop: 6 }}>{runs.length - 5} earlier runs are on each family’s statement.</p>}
        </Panel>
      </div>
    </RegisterPage>
  );
}
