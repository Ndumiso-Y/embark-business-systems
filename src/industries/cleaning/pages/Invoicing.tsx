import { useData, useActions, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { monthLabel } from '../../../core/lib/dates';
import { Notice, Panel, Stat } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { contractInvoiceValues, invoiceFigures, invoiceOverdue, rand, sitesToInvoice, todayStr, unstaffedCredit } from '../helpers';

/** Invoice register with a month-end run that drafts one contract invoice per site. */
export default function Invoicing() {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const month = today.slice(0, 7);
  const invoices = records(data, 'invoices');
  const issued = invoices.filter((i) => i.status === 'issued');
  const overdue = issued.filter((i) => invoiceOverdue(i, today));
  const sum = (list: typeof invoices) => list.reduce((n, i) => n + invoiceFigures(i).total, 0);
  const pending = sitesToInvoice(data, month);
  const credits = pending.map((s) => unstaffedCredit(data, s, month)).filter((c) => c.cleanerShifts > 0);
  const drafts = invoices.filter((i) => i.status === 'draft');
  const paidThisMonth = invoices.filter((i) => i.status === 'paid' && str(i, 'paidOn').startsWith(month));

  const run = () => {
    let n = 0;
    for (const site of pending) { act.create('invoices', contractInvoiceValues(data, site, month, today), 'draft', `Drafted in the ${monthLabel(month)} contract run`); n++; }
    act.toast(`${n} draft contract invoice${n === 1 ? '' : 's'} created for ${monthLabel(month)}`);
  };

  const issueAll = () => {
    let done = 0;
    let refused = '';
    for (const inv of drafts) { const res = act.transition('invoices', inv.id, 'issued'); if (res.ok) done++; else refused = `${inv.ref}: ${res.reason}`; }
    if (done) act.toast(`${done} invoice${done === 1 ? '' : 's'} issued (simulated — nothing is sent)`);
    if (refused) act.toast(refused, 'err');
  };

  return (
    <RegisterPage>
      <div className="stat-grid">
        <Stat label="Outstanding" value={rand(sum(issued))} sub={`${issued.length} issued invoices`} />
        <Stat label="Overdue" value={rand(sum(overdue))} tone={overdue.length ? 'red' : undefined} sub={`${overdue.length} past the due date`} />
        <Stat label="Paid this month" value={rand(sum(paidThisMonth))} tone="accent" sub={`${paidThisMonth.length} payments recorded`} />
        <Stat label="Drafts to issue" value={drafts.length} sub={rand(sum(drafts))} />
      </div>
      <Panel title={`Month-end contract run — ${monthLabel(month)}`} meta="One draft per active site: monthly fee + billable periodic extras − credit for shifts not staffed"
        right={can('invoicing') ? <button className="btn primary" disabled={!pending.length} onClick={run} data-testid="draft-invoices">Draft contract invoices ({pending.length})</button> : undefined}>
        {pending.length
          ? <Notice tone="accent">{pending.length} site{pending.length === 1 ? ' has' : 's have'} no contract invoice for {monthLabel(month)} yet. {credits.length ? `${credits.length} will carry a credit: ${credits.reduce((n, c) => n + c.cleanerShifts, 0)} contracted cleaner-shifts were not staffed so far this month.` : 'No staffing credits are due so far this month.'}</Notice>
          : <Notice tone="grey">Every active site already has a contract invoice for {monthLabel(month)}.</Notice>}
        {drafts.length > 0 && (
          <div className="btns" style={{ marginTop: 12, alignItems: 'center' }}>
            {can('invoicing') && <button className="btn sm" onClick={issueAll} data-testid="issue-drafts">Issue all {drafts.length} draft{drafts.length === 1 ? '' : 's'}</button>}
            <span className="muted-note">{drafts.length} draft{drafts.length === 1 ? '' : 's'} worth {rand(sum(drafts))} — open one below to see the fee, extras and staffing credit before it is issued.</span>
          </div>
        )}
        <p className="muted-note" style={{ marginTop: 10 }}>Demo rule: each contracted cleaner missing from a completed shift is credited at the monthly fee ÷ (contracted cleaners × 22 working days). Invoices here are not tax invoices and are not posted anywhere.</p>
      </Panel>
    </RegisterPage>
  );
}
