import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry } from '../../../core/context';
import { findRecord, lines, num, records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate, monthShort } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { BarChart, Empty, Meters, Notice, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { DAY_HOURS, PART_CATEGORIES, TECHNICIANS, label } from '../data';
import { isLabour, partsCost, splitTotals, todayStr, turnaroundDays, vehicleLabel } from '../helpers';

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const today = todayStr();
  const months = Array.from({ length: 4 }, (_, i) => addDays(today, -30.4 * (3 - i)).slice(0, 7));
  const from = addDays(today, -91);
  const invoices = records(data, 'invoices').filter((i) => i.status !== 'void' && str(i, 'issuedOn') >= from);
  const jobs = records(data, 'jobs');
  const done = jobs.filter((j) => ['ready', 'collected'].includes(j.status ?? '') && str(j, 'readyOn') >= from);

  const revenue = months.map((m) => {
    const inMonth = invoices.filter((i) => str(i, 'issuedOn').startsWith(m)).map((i) => splitTotals(lines(i)));
    return { label: monthShort(m), value: inMonth.reduce((n, s) => n + s.labour, 0) / 100, alt: inMonth.reduce((n, s) => n + s.parts, 0) / 100 };
  });
  const split = invoices.map((i) => splitTotals(lines(i)));
  const labourTotal = split.reduce((n, s) => n + s.labour, 0);
  const partsTotal = split.reduce((n, s) => n + s.parts, 0);

  const turnarounds = done.map(turnaroundDays).filter((d): d is number => d !== null);
  const avgTurn = turnarounds.length ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length : 0;
  const sameDay = turnarounds.filter((d) => d === 0).length;
  const promisedKept = done.filter((j) => str(j, 'promisedDate') && str(j, 'readyOn') <= str(j, 'promisedDate')).length;

  // Technician productivity: labour hours sold on their jobs vs hours available (working days × 8 h).
  const workingDays = Array.from({ length: 91 }, (_, i) => addDays(today, -i)).filter((d) => new Date(`${d}T00:00:00`).getDay() % 6 !== 0).length;
  const productivity = TECHNICIANS.map((t) => {
    const sold = invoices.filter((i) => str(findRecord(data, 'jobs', str(i, 'job')), 'technician') === t.value).reduce((n, i) => n + splitTotals(lines(i)).hours, 0);
    const pct = Math.round((sold / (workingDays * DAY_HOURS)) * 100);
    return { label: t.label, value: Math.round(sold * 10) / 10, max: workingDays * DAY_HOURS, tone: pct >= 50 ? 'green' as const : 'amber' as const, sub: `${pct}% of ${workingDays * DAY_HOURS} h available · ${done.filter((j) => str(j, 'technician') === t.value).length} jobs` };
  });

  const comebacks = jobs.filter((j) => str(j, 'jobType') === 'comeback' && str(j, 'workDate') >= from);
  const comebackRate = done.length ? Math.round((comebacks.length / done.length) * 1000) / 10 : 0;

  const partsLines = invoices.flatMap((i) => lines(i).filter((l) => !isLabour(l)));
  const partsSell = partsLines.reduce((n, l) => n + Math.round(l.unitPrice * l.qty * 100), 0);
  const cost = partsCost(data, partsLines);
  const margin = partsSell ? Math.round(((partsSell - cost) / partsSell) * 1000) / 10 : 0;
  const byCategory = PART_CATEGORIES.map((c) => {
    const ls = partsLines.filter((l) => str(records(data, 'parts').find((p) => str(p, 'partNo') === l.code), 'category') === c.value);
    const sell = ls.reduce((n, l) => n + Math.round(l.unitPrice * l.qty * 100), 0);
    const cst = partsCost(data, ls);
    return { sell, item: { label: c.label, value: sell ? Math.round(((sell - cst) / sell) * 100) : 0, max: 100, sub: `${formatRand(sell - cst, { compact: true })} margin on ${formatRand(sell, { compact: true })}` } };
  }).filter((x) => x.sell > 0).map((x) => x.item);
  const stockValue = records(data, 'parts').reduce((n, p) => n + Math.round(num(p, 'cost') * num(p, 'qty') * 100), 0);
  const rand = (n: number) => formatRand(Math.round(n * 100), { compact: true });

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Admin`} title="Workshop reports" subtitle="Last three months, computed from the demo job cards and invoices. Figures are fictional and change as you use the demo." />
      <div className="stat-grid">
        <Stat label="Revenue excl. VAT (3 months)" value={formatRand(labourTotal + partsTotal, { compact: true })} sub={`Labour ${formatRand(labourTotal, { compact: true })} · parts ${formatRand(partsTotal, { compact: true })}`} />
        <Stat label="Average turnaround" value={`${avgTurn.toFixed(1)} days`} tone="accent" sub={`${sameDay} of ${turnarounds.length} jobs same day · ${done.length ? Math.round((promisedKept / done.length) * 100) : 0}% on promised date`} />
        <Stat label="Comeback rate" value={`${comebackRate}%`} tone={comebacks.length ? 'red' : undefined} sub={`${comebacks.length} rework job(s) of ${done.length} completed`} />
        <Stat label="Parts margin" value={`${margin}%`} sub={`Stock on hand at cost ${formatRand(stockValue, { compact: true })}`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Revenue per month" meta="Invoiced, excl. VAT · labour (accent) vs parts (dark)">
          <BarChart label="Labour and parts revenue per month" data={revenue} alt="Parts" format={(n) => rand(n)} />
        </Panel>
        <Panel title="Technician productivity" meta="Labour hours sold vs hours available">
          <Meters format={(n) => `${n} h`} items={productivity} />
        </Panel>
      </div>
      <div className="grid-2">
        <Panel title="Comebacks" meta="Vehicles returned for rework of an earlier job">
          {comebacks.length ? (
            <ul className="list" data-testid="comeback-list">
              {comebacks.map((j) => {
                const orig = findRecord(data, 'jobs', str(j, 'comebackOf'));
                return (
                  <li key={j.id}>
                    <span className="time-chip">{formatDate(str(j, 'workDate'))}</span>
                    <div className="grow">
                      <Link to={`${base}/jobs/${j.id}`}><b>{vehicleLabel(data, j.values.vehicle)}</b></Link>
                      <small>{j.ref}{orig ? ` · rework of ${orig.ref} (${daysBetween(str(orig, 'workDate'), str(j, 'workDate'))} days later)` : ''} · {label(TECHNICIANS, str(j, 'technician'))}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="No comebacks in the period" />}
        </Panel>
        <Panel title="Parts margin by category" meta="(sell − cost) ÷ sell on invoiced parts">
          <Meters format={(n) => `${n}%`} items={byCategory} />
        </Panel>
      </div>
      <Notice tone="grey">Reports are illustrative. A production system would reconcile against the accounting system, supplier invoices and physical stock counts.</Notice>
    </>
  );
}
