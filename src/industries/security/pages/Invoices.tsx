import { Link } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { formatRand } from '../../../core/lib/money';
import { monthLabel } from '../../../core/lib/dates';
import { Empty, Notice, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { buildInvoiceValues, calloutExtras, contractMonthly, invoiceOverdue, invoiceTotals, unfilledShifts } from '../helpers';
import { money } from '../../../core/components/fields';
import { useClock } from './format';

export default function Invoices() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can } = useUser();
  const { today } = useClock();
  const def = act.def('invoices');
  const period = today.slice(0, 7);
  const all = [...records(data, 'invoices')].sort(def.sort);
  const contracts = records(data, 'contracts');
  const missing = contracts.filter((c) => !all.some((i) => str(i, 'contract') === c.id && str(i, 'period') === period));
  const issued = all.filter((i) => i.status === 'issued');
  const overdue = issued.filter((i) => invoiceOverdue(i, today));
  const sum = (list: typeof all) => list.reduce((n, i) => n + invoiceTotals(i).total, 0);
  const penalties = all.filter((i) => str(i, 'period') >= period.slice(0, 4)).reduce((n, i) => n + invoiceTotals(i).penalty, 0);

  const build = () => {
    for (const c of missing) act.create('invoices', buildInvoiceValues(data, c, period, today), 'draft', `Draft built for ${monthLabel(period)}`);
    act.toast(`${missing.length} draft invoice${missing.length === 1 ? '' : 's'} built for ${monthLabel(period)}`);
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Commercial`} title="Invoicing" subtitle="One invoice per contract per month: each contracted post at its monthly rate, less a penalty for every shift left unfilled (demo rule), plus armed response call-outs above the contract’s allowance. VAT at 15%."
        actions={can('invoicing') && missing.length ? <button className="btn primary" onClick={build} data-testid="build-invoices">Build {missing.length} draft{missing.length === 1 ? '' : 's'} for {monthLabel(period)}</button> : undefined} />
      <div className="stat-grid">
        <Stat label="Outstanding" value={formatRand(sum(issued), { compact: true })} tone="accent" sub={`${issued.length} issued invoices awaiting payment`} />
        <Stat label="Overdue" value={formatRand(sum(overdue), { compact: true })} tone={overdue.length ? 'red' : undefined} sub={`${overdue.length} past the due date`} />
        <Stat label="Monthly contract value" value={formatRand(contracts.reduce((n, c) => n + contractMonthly(data, c.id), 0) * 100, { compact: true })} sub={`${contracts.length} contracts, excl. VAT`} />
        <Stat label="Penalties this year" value={formatRand(penalties, { compact: true })} tone={penalties ? 'red' : undefined} sub="credits for unfilled shifts" />
      </div>
      <div className="section-gap" />
      <Panel title={`Building ${monthLabel(period)}`} meta="What the next invoice run will pick up from the live roster and call-out records">
        <div className="table-wrap">
          <table className="table" data-testid="invoice-build">
            <thead><tr><th>Contract</th><th className="num">Posts × rate</th><th className="num">Unfilled shifts</th><th className="num">Call-outs</th><th>Invoice</th></tr></thead>
            <tbody>
              {contracts.map((c) => {
                const inv = all.find((i) => str(i, 'contract') === c.id && str(i, 'period') === period);
                const ex = calloutExtras(data, c, period);
                return (
                  <tr key={c.id}>
                    <td><Link to={`${base}/contracts/${c.id}`}><strong>{str(c, 'client')}</strong></Link></td>
                    <td className="num">{money(contractMonthly(data, c.id))}</td>
                    <td className="num">{unfilledShifts(data, c.id, period, today).length}</td>
                    <td className="num">{ex.count} <small>{ex.billable} billable</small></td>
                    <td>{inv ? <Link to={`${base}/invoices/${inv.id}`}>{inv.ref} · {inv.status}</Link> : 'Not built yet'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!can('invoicing') && <Notice tone="grey">Your simulated role cannot build or issue invoices.</Notice>}
      </Panel>
      <Panel title="Invoices" meta="Newest month first">
        {all.length ? <RecordTable def={def} rows={all} moduleKey="invoices" extra={{ head: 'Total incl. VAT', cell: (r) => <b>{formatRand(invoiceTotals(r).total)}</b> }} /> : <Empty title="No invoices yet" />}
      </Panel>
    </>
  );
}
