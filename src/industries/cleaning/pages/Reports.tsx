import { useData, useIndustry } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { addDays, formatDate, monthLabel } from '../../../core/lib/dates';
import { Meters, PageHeader, Panel, Stat, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { COMPLAINT_CATEGORIES, SITE_TYPES, label } from '../data';
import {
  attendance, budgetState, daysToResolve, inspectionScore, invoiceFigures, latestInspection, rand, randOf, siteInspections, slaTarget, todayStr,
} from '../helpers';

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const month = today.slice(0, 7);
  const from = addDays(today, -14);
  const sites = records(data, 'sites').filter((s) => s.status !== 'ended');
  const shifts = records(data, 'shifts').filter((s) => str(s, 'date') >= from && str(s, 'date') < today);
  const overall = attendance(shifts, data);

  const bySite = sites.map((s) => {
    const list = siteInspections(data, s.id);
    const scores = list.map((i) => inspectionScore(i) ?? 0);
    const last = latestInspection(data, s.id);
    return { site: s, att: attendance(shifts.filter((x) => str(x, 'site') === s.id), data), target: slaTarget(s), avg: Math.round(avg(scores)), last: last ? inspectionScore(last) : null, lastDate: last ? str(last, 'date') : '', count: list.length, budget: budgetState(data, s, month) };
  });
  const meeting = bySite.filter((r) => r.last !== null && r.last >= r.target).length;

  const complaints = records(data, 'complaints');
  const byCategory = COMPLAINT_CATEGORIES.map((c) => {
    const list = complaints.filter((x) => str(x, 'category') === c.value);
    const days = list.map(daysToResolve).filter((d): d is number => d !== null);
    return { label: c.label, value: list.length, sub: days.length ? `${days.length} resolved · ${avg(days).toFixed(1)} days on average` : 'none resolved yet' };
  }).filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
  const resolvedDays = complaints.map(daysToResolve).filter((d): d is number => d !== null);

  // Revenue: issued and paid invoices, by the type of site (once-off jobs separately).
  const billed = records(data, 'invoices').filter((i) => ['issued', 'paid'].includes(i.status ?? ''));
  const revenue = [...SITE_TYPES.map((t) => ({ key: t.value, label: label(SITE_TYPES, t.value) })), { key: 'onceoff', label: 'Once-off jobs' }].map((t) => ({
    label: t.label,
    value: billed.filter((i) => (str(i, 'kind') === 'onceoff' ? 'onceoff' : str(findRecord(data, 'sites', str(i, 'site')), 'siteType')) === t.key).reduce((n, i) => n + invoiceFigures(i).net, 0),
  })).sort((a, b) => b.value - a.value);
  const revenueTotal = revenue.reduce((n, r) => n + r.value, 0);
  const totalBudget = bySite.reduce((n, r) => n + r.budget.budget, 0);
  const totalUsed = bySite.reduce((n, r) => n + r.budget.used, 0);

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Commercial`} title="Reports" subtitle="Built live from the demo records: attendance, inspection scores against SLA, complaints, consumables against budget and revenue by client type." />
      <div className="stat-grid">
        <Stat label="Attendance · last 14 days" value={`${overall.pct}%`} sub={`${overall.present} of ${overall.contracted} contracted cleaner-shifts`} tone={overall.pct >= 95 ? 'accent' : undefined} />
        <Stat label="Sites meeting SLA" value={`${meeting}/${bySite.filter((r) => r.last !== null).length}`} sub="on their latest inspection" tone={meeting < bySite.length ? 'red' : 'accent'} />
        <Stat label="Average time to resolve" value={resolvedDays.length ? `${avg(resolvedDays).toFixed(1)} d` : '—'} sub={`${resolvedDays.length} complaints and requests resolved`} />
        <Stat label={`Consumables · ${monthLabel(month)}`} value={randOf(totalUsed)} sub={`${totalBudget ? Math.round((totalUsed / totalBudget) * 100) : 0}% of ${randOf(totalBudget)} budgeted`} />
      </div>
      <Panel title="Sites: attendance, inspections and consumables" meta="Attendance over the last 14 days · inspection scores over the record · consumables this month">
        <div className="table-wrap">
          <table className="table" data-testid="report-sites">
            <thead><tr><th>Site</th><th className="num">Attendance</th><th className="num">Latest score</th><th className="num">Average</th><th className="num">SLA</th><th className="num">Consumables</th><th className="num">Budget</th><th>Flags</th></tr></thead>
            <tbody>
              {bySite.map((r) => (
                <tr key={r.site.id}>
                  <td><strong>{str(r.site, 'name')}</strong><small>{label(SITE_TYPES, str(r.site, 'siteType'))}{r.lastDate ? ` · inspected ${formatDate(r.lastDate)}` : ''}</small></td>
                  <td className="num">{r.att.shifts ? `${r.att.pct}%` : '—'}</td>
                  <td className="num">{r.last === null ? '—' : `${r.last}%`}</td>
                  <td className="num">{r.count ? `${r.avg}%` : '—'}</td>
                  <td className="num">{r.target}%</td>
                  <td className="num">{randOf(r.budget.used)}</td>
                  <td className="num">{r.budget.budget ? `${r.budget.pct}%` : '—'}</td>
                  <td>
                    <span className="flags">
                      {r.last !== null && r.last < r.target && <Tag tone="red">Below SLA</Tag>}
                      {r.att.shifts > 0 && r.att.pct < 95 && <Tag tone="amber">Attendance under 95%</Tag>}
                      {r.budget.over && <Tag tone="amber">Over budget</Tag>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="section-gap" />
      <div className="grid-2-even">
        <Panel title="Complaints & requests by category" meta={`${complaints.length} logged in the record · ${complaints.filter((c) => c.status === 'logged').length} waiting for acknowledgement`}>
          <Meters items={byCategory} />
        </Panel>
        <Panel title="Revenue by client type" meta={`Issued and paid invoices, excl. VAT · ${rand(revenueTotal)} in total`}>
          <Meters items={revenue} format={(n) => rand(n)} />
        </Panel>
      </div>
      <RoleBar />
    </>
  );
}
