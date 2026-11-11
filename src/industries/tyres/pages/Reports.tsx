import { useData, useIndustry } from '../../../core/context';
import { findRecord, lines, linesTotals, records, str } from '../../../core/engine';
import { addDays, monthShort } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { BarChart, Empty, Meters, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { BAYS, BRANDS, label } from '../data';
import { calibrationState, claimOpen, isTyreLine, jobMinutes, minText, todayStr } from '../helpers';

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const from = addDays(today, -90);
  const from30 = addDays(today, -30);
  const stock = records(data, 'stock');
  const invoices = records(data, 'invoices').filter((i) => i.status !== 'void' && str(i, 'issuedOn') >= from);

  // Tyres sold by size and brand (invoice lines whose code is a stock ref).
  const bySize: Record<string, number> = {};
  const byBrand: Record<string, number> = {};
  let tyresSold = 0;
  for (const l of invoices.flatMap((i) => lines(i)).filter(isTyreLine)) {
    const st = stock.find((s) => s.ref === l.code);
    const size = st ? str(st, 'size') : 'Unknown';
    const brand = st ? label(BRANDS, str(st, 'brand')) : 'Unknown';
    bySize[size] = (bySize[size] ?? 0) + l.qty;
    byBrand[brand] = (byBrand[brand] ?? 0) + l.qty;
    tyresSold += l.qty;
  }
  const top = (o: Record<string, number>, n: number) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);

  // Bay throughput and job duration, last 30 days.
  const done = records(data, 'jobs').filter((j) => ['ready', 'collected'].includes(j.status ?? '') && str(j, 'workDate') >= from30);
  const durations = done.map(jobMinutes).filter((m): m is number => m !== null);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const withinHour = durations.filter((m) => m <= 60).length;
  const bayOf = (j: (typeof done)[number]) => str(j, 'fitBay') || str(j, 'bay');
  const bays = BAYS.map((b) => {
    const js = done.filter((j) => bayOf(j) === b.value);
    const ms = js.map(jobMinutes).filter((m): m is number => m !== null);
    return { label: b.label, value: js.length, sub: `avg ${minText(ms.length ? ms.reduce((a, c) => a + c, 0) / ms.length : null)} arrival → ready` };
  });

  // Tools.
  const tools = records(data, 'tools');
  const used = tools.filter((t) => Number(t.values.checkouts) > 0).sort((a, b) => Number(b.values.hoursOut) - Number(a.values.hoursOut));
  const calibrated = tools.filter((t) => calibrationState(t, today) !== 'na');
  const inDate = calibrated.filter((t) => calibrationState(t, today) !== 'expired');
  const compliance = calibrated.length ? Math.round((inDate.length / calibrated.length) * 100) : 100;

  // Warranty.
  const claims = records(data, 'claims').filter((c) => str(c, 'loggedOn') >= from);
  const decided = claims.filter((c) => !claimOpen(c));
  const approved = decided.filter((c) => c.status === 'approved');
  const claimRate = tyresSold ? Math.round((claims.length / tyresSold) * 1000) / 10 : 0;

  // Fleet vs retail revenue by month.
  const isFleet = (custId: string) => str(findRecord(data, 'customers', custId), 'kind') === 'fleet';
  const months = Array.from({ length: 4 }, (_, i) => addDays(today, -30.4 * (3 - i)).slice(0, 7));
  const revenue = months.map((m) => {
    const inM = records(data, 'invoices').filter((i) => i.status !== 'void' && str(i, 'issuedOn').startsWith(m));
    const net = (f: boolean) => inM.filter((i) => isFleet(str(i, 'customer')) === f).reduce((n, i) => n + linesTotals(lines(i)).net, 0) / 100;
    return { label: monthShort(m), value: net(false), alt: net(true) };
  });
  const retailTotal = invoices.filter((i) => !isFleet(str(i, 'customer'))).reduce((n, i) => n + linesTotals(lines(i)).net, 0);
  const fleetTotal = invoices.filter((i) => isFleet(str(i, 'customer'))).reduce((n, i) => n + linesTotals(lines(i)).net, 0);

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Admin`} title="Fitment centre reports" subtitle="Computed live from the demo jobs, invoices, tools and claims. Figures are fictional and change as you use the demo." />
      <div className="stat-grid">
        <Stat label="Tyres sold (90 days)" value={tyresSold} sub={`${Object.keys(bySize).length} sizes`} />
        <Stat label="Average arrival → ready (30 days)" value={minText(avg)} tone="accent" sub={`${durations.length ? Math.round((withinHour / durations.length) * 100) : 0}% within the one-hour target`} />
        <Stat label="Calibration compliance" value={`${compliance}%`} tone={compliance < 100 ? 'red' : undefined} sub={`${inDate.length} of ${calibrated.length} calibrated tools in date`} />
        <Stat label="Warranty claim rate" value={`${claimRate}%`} sub={`${claims.length} claims per ${tyresSold} tyres · ${approved.length}/${decided.length} approved`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2-even">
        <Panel title="Tyres sold by size" meta="Last 90 days, from invoice lines">
          {tyresSold ? <Meters items={top(bySize, 8).map(([k, n]) => ({ label: k, value: n }))} /> : <Empty title="No tyres sold yet" />}
        </Panel>
        <Panel title="Tyres sold by brand" meta="Fictional brands">
          {tyresSold ? <Meters items={top(byBrand, 6).map(([k, n]) => ({ label: k, value: n, sub: `${Math.round((n / tyresSold) * 100)}% of units` }))} /> : <Empty title="No tyres sold yet" />}
        </Panel>
      </div>
      <div className="grid-2-even">
        <Panel title="Bay throughput" meta="Jobs completed per bay, last 30 days (alignment jobs counted in their fitting bay)">
          <Meters items={bays} />
        </Panel>
        <Panel title="Tool utilisation" meta="Lifetime hours checked out (recorded check-outs only)">
          {used.length ? <Meters format={(n) => `${n} h`} items={used.slice(0, 8).map((t) => ({ label: `${str(t, 'assetNo')}`, value: Math.round(Number(t.values.hoursOut)), sub: `${Number(t.values.checkouts)} check-outs${calibrationState(t, today) === 'expired' ? ' · calibration expired' : ''}`, tone: calibrationState(t, today) === 'expired' ? 'red' : undefined }))} /> : <Empty title="No check-outs recorded" />}
        </Panel>
      </div>
      <div className="grid-2-even">
        <Panel title="Fleet vs retail revenue" meta={`Excl. VAT per month · retail (accent) vs fleet (dark) · 90 days: retail ${formatRand(retailTotal, { compact: true })}, fleet ${formatRand(fleetTotal, { compact: true })}`}>
          <BarChart label="Retail and fleet revenue per month" data={revenue} alt="Fleet" format={(n) => formatRand(Math.round(n * 100), { compact: true })} />
        </Panel>
        <Panel title="Warranty claims by outcome" meta="Claims logged in the last 90 days">
          <Meters items={[
            { label: 'Open (logged, inspected or with supplier)', value: claims.filter(claimOpen).length, max: Math.max(1, claims.length), tone: 'amber' },
            { label: 'Approved for credit', value: approved.length, max: Math.max(1, claims.length), tone: 'green' },
            { label: 'Rejected', value: decided.length - approved.length, max: Math.max(1, claims.length), tone: 'red' },
          ]} />
        </Panel>
      </div>
    </>
  );
}
