import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { lines, linesTotals, num, records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { BarChart, Empty, Flags, Meters, Notice, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { DAILY_TARGET_HOURS, DIARY_TYPES, FEE_EARNERS, MATTER_TYPES, label } from '../data';
import { OPEN_MATTER_STATES, formatCents, invoiceTotal, isWip, timeValue, todayStr, upcomingDeadlines, weekStart, workingDays } from '../helpers';
import { MatterLink } from './shared';

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const today = todayStr();
  const time = records(data, 'time');
  const from28 = addDays(today, -27);
  const days28 = workingDays(from28, today);
  const target = days28 * DAILY_TARGET_HOURS;
  const diaryDef = config.collections.find((c) => c.key === 'diary')!;

  const perEarner = FEE_EARNERS.map((f) => {
    const mine = time.filter((t) => str(t, 'feeEarner') === f.value);
    const recent = mine.filter((t) => str(t, 'date') >= from28);
    const billableHours = Math.round(recent.filter((t) => t.values.billable === true).reduce((n, t) => n + num(t, 'hours'), 0) * 10) / 10;
    const allHours = Math.round(recent.reduce((n, t) => n + num(t, 'hours'), 0) * 10) / 10;
    const processed = mine.filter((t) => t.values.billable === true && (t.status === 'billed' || t.status === 'writtenoff'));
    const billed = processed.filter((t) => t.status === 'billed').reduce((n, t) => n + timeValue(t), 0);
    const processedValue = processed.reduce((n, t) => n + timeValue(t), 0);
    return { f, billableHours, allHours, wip: mine.filter(isWip).reduce((n, t) => n + timeValue(t), 0), billed, processedValue };
  });
  const totalWip = perEarner.reduce((n, e) => n + e.wip, 0);
  const totalBillable = perEarner.reduce((n, e) => n + e.billableHours, 0);
  const totalBilled = perEarner.reduce((n, e) => n + e.billed, 0);
  const totalProcessed = perEarner.reduce((n, e) => n + e.processedValue, 0);
  const invoices = records(data, 'invoices');
  const invoiced = invoices.reduce((n, i) => n + invoiceTotal(i), 0);
  const collected = invoices.reduce((n, i) => n + Math.min(invoiceTotal(i), toCents(num(i, 'paid'))), 0);
  const feesNet = invoices.reduce((n, i) => n + linesTotals(lines(i)).net, 0);

  // Weekly hours, last 8 weeks (billable vs non-billable)
  const thisWeek = weekStart(today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i)));
  const chart = weeks.map((w) => {
    const inWeek = time.filter((t) => str(t, 'date') >= w && str(t, 'date') < addDays(w, 7));
    return {
      label: formatDate(w).slice(0, 6),
      value: Math.round(inWeek.filter((t) => t.values.billable === true).reduce((n, t) => n + num(t, 'hours'), 0)),
      alt: Math.round(inWeek.filter((t) => t.values.billable !== true).reduce((n, t) => n + num(t, 'hours'), 0)),
    };
  });
  const open = records(data, 'matters').filter((m) => OPEN_MATTER_STATES.includes(m.status ?? ''));
  const deadlines = upcomingDeadlines(data, today, 30);

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Practice`} title="Practice reports" subtitle="Computed from the demo records. Figures are fictional and change as you record time, bill and receive payments." />
      <div className="stat-grid">
        <Stat label="Unbilled WIP" value={formatCents(totalWip)} sub="Billable time not yet on a fee note (excl. VAT)" />
        <Stat label="Utilisation (4 weeks)" value={`${pct(totalBillable, target * FEE_EARNERS.length)}%`} tone="accent" sub={`${totalBillable} billable h vs ${DAILY_TARGET_HOURS} h/day demo target`} />
        <Stat label="Realisation" value={`${pct(totalBilled, totalProcessed)}%`} sub={`${formatCents(totalBilled)} billed of ${formatCents(totalProcessed)} recorded and processed`} />
        <Stat label="Collected vs billed" value={`${pct(collected, invoiced)}%`} sub={`${formatCents(collected)} of ${formatCents(invoiced)} incl. VAT`} />
      </div>
      <div className="section-gap" />
      <div className="grid-3">
        <Panel title="WIP by fee earner" meta="Unbilled billable time, excl. VAT">
          <Meters format={(n) => formatCents(n)} items={perEarner.map((e) => ({ label: e.f.label, value: e.wip, sub: e.f.role }))} />
        </Panel>
        <Panel title="Billable utilisation" meta={`Last 4 weeks · target ${target} h each (${days28} working days × ${DAILY_TARGET_HOURS} h)`}>
          <Meters format={(n) => `${n} h`} items={perEarner.map((e) => ({ label: `${e.f.label} · ${pct(e.billableHours, target)}%`, value: e.billableHours, max: target, tone: pct(e.billableHours, target) >= 80 ? 'green' : pct(e.billableHours, target) >= 50 ? 'accent' : 'amber', sub: `${e.allHours} h recorded in total` }))} />
        </Panel>
        <Panel title="Realisation by fee earner" meta="Billed value ÷ value of time that went through billing (billed + written off)">
          <Meters format={(n) => `${n}%`} items={perEarner.map((e) => ({ label: e.f.label, value: pct(e.billed, e.processedValue), max: 100, tone: pct(e.billed, e.processedValue) >= 95 ? 'green' : 'amber', sub: `${formatCents(e.billed)} billed · ${formatCents(e.processedValue - e.billed)} written off` }))} />
        </Panel>
      </div>
      <div className="grid-2">
        <Panel title="Hours per week" meta="Billable (accent) vs non-billable (dark), last 8 weeks">
          <BarChart label="Hours recorded per week" data={chart} alt="Non-billable" format={(n) => `${n} h`} />
        </Panel>
        <Panel title="Open matters by type" meta={`${open.length} open matters · fees billed to date ${formatCents(feesNet)} excl. VAT`}>
          <Meters items={MATTER_TYPES.map((t) => ({ label: t.label, value: open.filter((m) => str(m, 'type') === t.value).length }))} />
        </Panel>
      </div>
      <Panel title="Upcoming deadlines" meta="Next 30 days and anything overdue · prescription dates first">
        {deadlines.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Deadline</th><th>Type</th><th>Matter</th><th>Days</th></tr></thead>
              <tbody>
                {deadlines.map((d) => (
                  <tr key={d.id}>
                    <td>{formatDate(str(d, 'date'))}</td>
                    <td>{hasModule('diary') ? <Link to={`${base}/diary/${d.id}`}><strong>{str(d, 'title')}</strong></Link> : <strong>{str(d, 'title')}</strong>}<Flags flags={diaryDef.flags?.(d, data, today) ?? []} /></td>
                    <td>{label(DIARY_TYPES, str(d, 'type'))}</td>
                    <td><MatterLink data={data} id={d.values.matter} /></td>
                    <td className="num">{daysBetween(today, str(d, 'date'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No deadlines in the next 30 days" />}
      </Panel>
      <div className="section-gap" />
      <Notice tone="grey">Reports are illustrative. The 6-hour daily target is a demo setting; a production system would reconcile against the accounting system and actual receipts.</Notice>
    </>
  );
}
