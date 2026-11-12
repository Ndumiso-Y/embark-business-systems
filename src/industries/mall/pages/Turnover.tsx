import { Link } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Meters, Notice, Panel, Stat, StatusTag, Tag } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { BILLED_LEASE, RENT_TO_SALES_RISK } from '../data';
import { declarationDue, declarationFor, declarationOverdue, densityByCategory, leaseUnit, periodLabel, periodOf, plural, prevPeriod, randOf, randRound, shopLabel, tenantSales, thousands, todayStr } from '../helpers';
import { RecLink } from './shared';

/** Turnover declarations register with last month's status, sales performance and trading density. */
export default function Turnover() {
  const data = useData();
  const act = useActions();
  const base = useBase();
  const { can } = useUser();
  const today = todayStr();
  const last = prevPeriod(periodOf(today));
  const def = act.def('turnover');
  const all = records(data, 'turnover');
  const outstanding = all.filter((d) => d.status === 'awaited');
  const overdue = outstanding.filter((d) => declarationOverdue(d, today));
  const toVerify = all.filter((d) => d.status === 'declared');
  const queried = all.filter((d) => d.status === 'queried');
  const sales = tenantSales(data).sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));
  const risky = sales.filter((s) => s.atRisk);
  const density = densityByCategory(data);
  const clause = records(data, 'leases').filter((l) => BILLED_LEASE.includes(l.status ?? '') && num(l, 'turnoverPct') > 0);
  const missing = clause.filter((l) => !declarationFor(data, l.id, last) && str(l, 'startDate') <= `${last}-28`);
  const request = () => {
    for (const l of missing) act.create('turnover', { lease: l.id, period: last }, 'awaited', `Declaration for ${periodLabel(last)} requested`);
    act.toast(`${plural(missing.length, 'declaration')} for ${periodLabel(last)} opened as “awaited” (no message is sent)`);
  };
  const waiting = [...overdue, ...outstanding.filter((d) => !overdue.includes(d)), ...queried, ...toVerify];
  return (
    <RegisterPage>
      <div className="stat-grid">
        <Stat label="Declarations outstanding" value={outstanding.length} tone={overdue.length ? 'red' : undefined} sub={`${overdue.length} overdue — due by the 7th of the next month`} />
        <Stat label="Waiting to be verified" value={toVerify.length} tone="accent" sub={`${queried.length} queried with the tenant`} />
        <Stat label={`At risk (rent over ${RENT_TO_SALES_RISK}% of sales)`} value={risky.length} tone={risky.length ? 'red' : undefined} sub={`of ${sales.length} tenants with declared sales`} />
        <Stat label="Tenants with a turnover clause" value={clause.length} sub={`${sales.filter((s) => s.turnoverRent > 0).length} above their breakpoint on the latest month`} />
      </div>
      {missing.length > 0 && can('billing') && (
        <Notice tone="accent">{plural(missing.length, 'tenant')} with a turnover clause {missing.length === 1 ? 'has' : 'have'} no declaration record for {periodLabel(last)}. <button className="btn sm" style={{ marginLeft: 8 }} onClick={request} data-testid="request-declarations">Open {plural(missing.length, 'declaration')}</button></Notice>
      )}
      <div className="grid-2">
        <Panel title="To do" meta="Overdue first, then awaited, queried and waiting for verification">
          {waiting.length ? (
            <ul className="list" data-testid="turnover-todo">
              {waiting.slice(0, 12).map((d) => (
                <li key={d.id} style={{ flexWrap: 'wrap' }}>
                  <span className={`dot ${declarationOverdue(d, today) ? 'red' : d.status === 'declared' ? 'blue' : 'amber'}`} />
                  <div className="grow" style={{ minWidth: 150 }}>
                    <Link to={`${base}/turnover/${d.id}`}><b>{def.title(d, data)}</b></Link>
                    <small>{def.subtitle?.(d, data)}{d.status === 'awaited' ? ` · due ${formatDate(declarationDue(str(d, 'period')))}` : ` · ${randRound(num(d, 'amount'))} declared`}</small>
                  </div>
                  {declarationOverdue(d, today) && <Tag tone="red">Overdue</Tag>}
                  <StatusTag workflow={def.workflow} status={d.status} />
                </li>
              ))}
            </ul>
          ) : <Empty title="Nothing waiting" body="Every declaration is verified." />}
          {waiting.length > 12 && <p className="muted-note" style={{ marginTop: 8 }}>{waiting.length - 12} more in the register below.</p>}
        </Panel>
        <Panel title="Trading density by category" meta="Declared turnover ÷ GLA, latest month per tenant">
          {density.length ? <Meters items={density.map((d) => ({ label: d.label, value: d.density, sub: `${plural(d.tenants, 'tenant')} · ${randRound(d.turnover)} turnover` }))} format={(n) => `${randRound(n)}/m²`} /> : <Empty title="No turnover declared yet" />}
        </Panel>
      </div>
      <Panel title="Sales performance by tenant" meta={`Latest declared month · rent-to-sales above ${RENT_TO_SALES_RISK}% is flagged “at risk” (demo level)`}>
        {sales.length ? (
          <div className="table-wrap">
            <table className="table" data-testid="sales-table">
              <thead><tr><th>Tenant</th><th>Month</th><th className="num">Turnover</th><th className="num">Density / m²</th><th className="num">Rent-to-sales</th><th className="num">Turnover rent</th><th>Flags</th></tr></thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.lease.id}>
                    <td><RecLink module="leases" id={s.lease.id}><strong>{str(s.lease, 'tenant')}</strong></RecLink><small>{shopLabel(leaseUnit(data, s.lease))} · {thousands(s.gla)} m² · {num(s.lease, 'turnoverPct')}% clause</small></td>
                    <td>{periodLabel(s.period)}</td>
                    <td className="num">{randRound(s.turnover)}</td>
                    <td className="num">{randRound(s.density)}</td>
                    <td className="num">{s.ratio === null ? '—' : `${s.ratio}%`}</td>
                    <td className="num">{s.turnoverRent > 0 ? randOf(s.turnoverRent) : '—'}</td>
                    <td><span className="flags">{s.atRisk && <Tag tone="red">At risk</Tag>}{s.turnoverRent > 0 && <Tag tone="accent">Above breakpoint</Tag>}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No turnover declared yet" />}
      </Panel>
      <div className="section-gap" />
    </RegisterPage>
  );
}
