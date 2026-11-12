import { useData, useIndustry } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, monthKeys, monthLabel, monthShort } from '../../../core/lib/dates';
import { BarChart, Meters, PageHeader, Panel, Stat } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { BILLED_LEASE, LEVELS } from '../data';
import {
  AGE_BUCKETS, ageing, densityByCategory, glaOf, monthBilling, occupancy, occupiedGlaAt, pct1, periodEnd, periodOf, plural, prevPeriod, rand, randBig, randRound, tenantMix, tenantSales, thousands,
  todayStr,
} from '../helpers';

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const period = periodOf(today);
  const units = records(data, 'units');
  const occ = occupancy(units);
  const months = monthKeys(today, 6);

  // Vacancy at each month end, from lease dates; the current month uses the live unit statuses.
  const vacancy = months.map((m) => ({ label: monthShort(m), value: m === period ? Math.round((100 - occ.pct) * 10) / 10 : Math.round((100 - pct1(Math.min(occ.gla, occupiedGlaAt(data, periodEnd(m))), occ.gla)) * 10) / 10 }));
  const byLevel = LEVELS.map((lv) => ({ lv, o: occupancy(units.filter((u) => str(u, 'level') === lv.value)) })).filter((x) => x.o.gla > 0);

  // Six completed months plus the current one (empty until the month-end run).
  const billing = monthKeys(today, 7).map((m) => ({ m, ...monthBilling(data, m) }));
  const billedMonths = billing.filter((b) => b.count > 0);
  const last = monthBilling(data, prevPeriod(period));
  const age = ageing(records(data, 'invoices'), today);

  const density = densityByCategory(data);
  const sales = tenantSales(data);
  const totalTurnover = sales.reduce((n, s) => n + s.turnover, 0);
  const totalGla = sales.reduce((n, s) => n + s.gla, 0);

  const logs = records(data, 'opslog');
  const weeks = [3, 2, 1, 0].map((w) => {
    const from = addDays(today, -7 * (w + 1));
    const to = addDays(today, -7 * w - 1);
    return { label: `to ${to.slice(8)} ${monthShort(to.slice(0, 7))}`, value: logs.filter((l) => str(l, 'date') >= from && str(l, 'date') <= to).reduce((n, l) => n + num(l, 'footfall'), 0) };
  });

  const leases = records(data, 'leases').filter((l) => BILLED_LEASE.includes(l.status ?? '') && str(l, 'endDate'));
  const years = [...new Set(leases.map((l) => str(l, 'endDate').slice(0, 4)))].sort();
  const expiry = years.map((y) => { const list = leases.filter((l) => str(l, 'endDate').startsWith(y)); return { label: y < today.slice(0, 4) ? `${y} (expired — holding over)` : y, value: list.reduce((n, l) => n + glaOf(data, l), 0), sub: plural(list.length, 'lease') }; });
  const mix = tenantMix(data);

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Finance`} title="Reports" subtitle="Built live from the demo records: occupancy and vacancy, rent roll and collections, arrears ageing, trading density, footfall, lease expiries and tenant mix." />
      <div className="stat-grid">
        <Stat label="Occupancy by GLA" value={`${occ.pct}%`} tone="accent" sub={`${thousands(occ.vacant)} m² vacant of ${thousands(occ.gla)} m²`} />
        <Stat label={`Collections · ${monthLabel(prevPeriod(period))}`} value={`${last.pct}%`} sub={`${randBig(last.collected)} of ${randBig(last.billed)} billed`} />
        <Stat label="Arrears" value={randBig(age.overdue)} tone={age.overdue ? 'red' : undefined} sub={`${randBig(age.d90plus)} over 90 days`} />
        <Stat label="Trading density" value={`${randRound(totalGla ? totalTurnover / totalGla : 0)}/m²`} sub={`${plural(sales.length, 'tenant')} with declared turnover, latest month`} />
      </div>
      <div className="grid-2-even">
        <Panel title="Vacancy trend" meta="Vacant GLA as a share of the centre, at each month end">
          <BarChart label="Vacancy percentage by month" data={vacancy} format={(n) => `${n}%`} />
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table" data-testid="report-occupancy">
              <thead><tr><th>Level</th><th className="num">GLA</th><th className="num">Occupied</th><th className="num">Vacant units</th></tr></thead>
              <tbody>{byLevel.map(({ lv, o }) => <tr key={lv.value}><td>{lv.label}</td><td className="num">{thousands(o.gla)} m²</td><td className="num">{o.pct}%</td><td className="num">{o.vacantUnits + o.offerUnits}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Rent roll & collections" meta="Billed (accent) against collected (dark) per invoice month, incl. VAT">
          <BarChart label="Billed and collected by month" alt="Collected" data={billing.map((b) => ({ label: monthShort(b.m), value: b.billed / 100, alt: b.collected / 100 }))} format={(n) => randBig(n * 100)} />
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table" data-testid="report-collections">
              <thead><tr><th>Month</th><th className="num">Invoices</th><th className="num">Billed</th><th className="num">Collected</th><th className="num">%</th></tr></thead>
              <tbody>{billedMonths.map((b) => <tr key={b.m}><td>{monthLabel(b.m)}</td><td className="num">{b.count}</td><td className="num">{randBig(b.billed)}</td><td className="num">{randBig(b.collected)}</td><td className="num">{b.pct}%</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      </div>
      <div className="grid-2-even">
        <Panel title="Arrears ageing" meta="Unpaid balances by days past the due date · interest is not calculated">
          <Meters format={(n) => rand(n)} items={[{ label: 'Not yet due', value: age.current, tone: 'green' as const }, ...AGE_BUCKETS.map((b) => ({ label: b.label, value: age[b.key], tone: b.key === 'd90plus' ? 'red' as const : 'amber' as const }))]} />
        </Panel>
        <Panel title="Trading density by category" meta="Declared turnover ÷ GLA per month, tenants with a turnover clause">
          <Meters items={density.map((d) => ({ label: d.label, value: d.density, sub: plural(d.tenants, 'tenant') }))} format={(n) => `${randRound(n)}/m²`} />
        </Panel>
      </div>
      <div className="grid-2-even">
        <Panel title="Footfall trend" meta="Typed daily counts, totalled over the last four weeks">
          <BarChart label="Footfall per week" data={weeks} format={(n) => thousands(n)} />
        </Panel>
        <Panel title="Lease-expiry profile" meta="GLA of trading leases by the year they end">
          <Meters items={expiry} format={(n) => `${thousands(n)} m²`} />
        </Panel>
      </div>
      <Panel title="Tenant mix" meta="Share of let GLA by category">
        <Meters items={mix.map((m) => ({ label: m.label, value: m.pct, sub: `${thousands(m.gla)} m² · ${plural(m.units, 'unit')}` }))} format={(n) => `${n}%`} />
      </Panel>
      <div className="section-gap" />
      <RoleBar />
    </>
  );
}
