import { records, str } from '../../../core/engine';
import { useActions, useData, useUser } from '../../../core/context';
import { Notice, Panel, Stat } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { invoiceOverdue, invoiceTotals, monthRange, plural, randc, todayStr } from '../helpers';

/** Invoices & credit notes: totals by state and a bulk issue of drafts. */
export default function Invoices() {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const { from, to } = monthRange(today);
  const all = records(data, 'invoices').filter((i) => i.status !== 'void');
  const sum = (list: typeof all) => list.reduce((n, i) => { const t = invoiceTotals(i); return n + t.sign * t.total; }, 0);
  const issued = all.filter((i) => i.status === 'issued');
  const overdue = all.filter((i) => invoiceOverdue(i, today));
  const drafts = all.filter((i) => i.status === 'draft');
  const paid = all.filter((i) => i.status === 'paid' && str(i, 'paidOn') >= from && str(i, 'paidOn') <= to);
  const issueAll = () => {
    let n = 0;
    for (const inv of drafts) { const res = act.transition('invoices', inv.id, 'issued'); if (res.ok) n++; else act.toast(`${inv.ref}: ${res.reason}`, 'err'); }
    if (n) act.toast(`${plural(n, 'invoice')} recorded as issued (simulated — nothing is sent)`);
  };
  return (
    <RegisterPage intro={
      <>
        <div className="stat-grid">
          <Stat label="Outstanding" value={randc(sum(issued))} sub={`${plural(issued.length, 'document')} issued, incl. VAT`} />
          <Stat label="Overdue" value={randc(sum(overdue))} tone={overdue.length ? 'red' : undefined} sub={`${plural(overdue.length, 'invoice')} past the due date`} />
          <Stat label="Received this month" value={randc(sum(paid))} tone="accent" sub={`${plural(paid.length, 'payment')} recorded`} />
          <Stat label="Drafts to issue" value={drafts.length} sub={`${drafts.filter((i) => str(i, 'kind') === 'credit').length} credit notes · ${randc(sum(drafts))}`} />
        </div>
        <Panel title="Raised automatically" meta="Fee invoices when a placement starts · contractor invoices from approved timesheets · credit notes from fall-offs inside the guarantee"
          right={can('invoices.manage') && drafts.length ? <button className="btn sm" onClick={issueAll} data-testid="issue-drafts">Issue all {drafts.length} drafts</button> : undefined}>
          <Notice tone="grey">Demonstration documents only: not tax invoices, VAT at 15% is a demo default, nothing is emailed and nothing is posted to an accounting system.</Notice>
        </Panel>
        <div className="section-gap" />
      </>
    } />
  );
}
