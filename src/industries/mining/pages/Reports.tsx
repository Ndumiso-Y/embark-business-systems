import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { BarChart, DueTag, Empty, Meters, Notice, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { DELAY_REASONS, INCIDENT_CATEGORIES } from '../data';
import { contractorExpiries, contractorName, permitExpired, todayStr } from '../helpers';
import { shortDate, tonnes } from './format';

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const today = todayStr();
  const shifts = records(data, 'shifts');

  // Production trend: 12 weeks ending today.
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const end = addDays(today, -7 * (11 - i));
    const start = addDays(end, -6);
    const list = shifts.filter((s) => str(s, 'date') >= start && str(s, 'date') <= end);
    return { label: shortDate(start), value: list.reduce((n, s) => n + num(s, 'tonnesHoisted'), 0), alt: list.reduce((n, s) => n + num(s, 'targetTonnes'), 0) };
  });
  const from = addDays(today, -83);
  const period = shifts.filter((s) => str(s, 'date') >= from);
  const periodT = period.reduce((n, s) => n + num(s, 'tonnesHoisted'), 0);
  const periodTarget = period.reduce((n, s) => n + num(s, 'targetTonnes'), 0);
  const delayTotal = period.reduce((n, s) => n + num(s, 'delayMinutes'), 0);

  const delays = [
    ...DELAY_REASONS.map((d) => ({ label: d.label, value: period.filter((s) => str(s, 'delayReason') === d.value).reduce((n, s) => n + num(s, 'delayMinutes'), 0), tone: 'accent' as const })),
    { label: 'No reason recorded', value: period.filter((s) => !str(s, 'delayReason')).reduce((n, s) => n + num(s, 'delayMinutes'), 0), tone: 'amber' as const },
  ].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);

  const incidents = records(data, 'incidents');
  const byCategory = INCIDENT_CATEGORIES.map((c) => {
    const list = incidents.filter((i) => str(i, 'category') === c.value);
    const nm = list.filter((i) => str(i, 'type') === 'nearmiss').length;
    return { label: c.label, value: list.length, sub: `${nm} near miss · ${list.length - nm} injury / damage`, tone: list.some((i) => i.values.lti === true) ? 'red' as const : 'accent' as const };
  }).filter((c) => c.value).sort((a, b) => b.value - a.value);
  const nearMisses = incidents.filter((i) => str(i, 'type') === 'nearmiss').length;
  const injuries = incidents.filter((i) => str(i, 'type') === 'injury').length;

  const wos = records(data, 'workorders').filter((w) => w.status !== 'cancelled');
  const planned = wos.filter((w) => str(w, 'type') === 'planned');
  const breakdown = wos.filter((w) => str(w, 'type') === 'breakdown');
  const plannedShare = wos.length ? Math.round((planned.length / wos.length) * 100) : 0;
  const downtime = (list: typeof wos) => list.reduce((n, w) => n + num(w, 'downtimeHours'), 0);

  type Expiry = { key: string; who: string; to: string; what: string; date: string; state: 'overdue' | 'due-soon' };
  const expiries: Expiry[] = records(data, 'contractors').flatMap((c) => contractorExpiries(c, today)
    .filter((e) => e.state === 'overdue' || e.state === 'due-soon')
    .map((e) => ({ key: c.id + e.key, who: `${contractorName(c)} · ${str(c, 'company')}`, to: `contractors/${c.id}`, what: e.label, date: e.date, state: e.state as 'overdue' | 'due-soon' })));
  const permitExpiries = records(data, 'permits').filter((p) => p.status === 'active' && permitExpired(p, today))
    .map((p) => ({ key: p.id, who: str(p, 'holder'), to: `permits/${p.id}`, what: `Permit ${p.ref} (active)`, date: str(p, 'validTo'), state: 'overdue' as const }));
  const allExpiries = [...permitExpiries, ...expiries].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Operations`} title="Operations reports" subtitle="Twelve-week view computed from the demo records. Figures are fictional and change as you use the demo." />
      <div className="stat-grid">
        <Stat label="Tonnes (12 weeks)" value={tonnes(periodT)} tone="accent" sub={`${periodTarget ? Math.round((periodT / periodTarget) * 100) : 0}% of ${tonnes(periodTarget)} planned`} />
        <Stat label="Average delay per shift" value={`${period.length ? Math.round(delayTotal / period.length) : 0} min`} sub={`${delayTotal.toLocaleString('en-ZA')} minutes over ${period.length} shifts`} />
        <Stat label="Near misses : injuries" value={`${nearMisses} : ${injuries}`} sub={`${incidents.filter((i) => i.values.lti === true).length} lost-time injury in the period`} />
        <Stat label="Planned maintenance share" value={`${plannedShare}%`} tone={plannedShare < 50 ? 'red' : undefined} sub={`${planned.length} planned · ${breakdown.length} breakdown work orders`} />
      </div>
      <div className="section-gap" />
      <Panel title="Production trend" meta="Weekly tonnes hoisted (accent) vs planned (dark), week starting">
        <BarChart label="Weekly tonnes hoisted vs plan" data={weeks} alt="Plan" format={(n) => tonnes(n)} />
      </Panel>
      <div className="section-gap" />
      <div className="grid-3">
        <Panel title="Delay reasons" meta="Minutes lost, 12 weeks">
          {delays.length ? <Meters format={(n) => `${n.toLocaleString('en-ZA')} min`} items={delays} /> : <Empty title="No delays recorded" />}
        </Panel>
        <Panel title="Incidents by category" meta="All recorded incidents and near misses">
          {byCategory.length ? <Meters items={byCategory} /> : <Empty title="No incidents recorded" />}
        </Panel>
        <Panel title="Planned vs breakdown maintenance" meta="Work orders (excluding cancelled)">
          <Meters items={[
            { label: 'Planned services', value: planned.length, max: wos.length || 1, tone: 'green', sub: `${downtime(planned)} h downtime` },
            { label: 'Breakdowns', value: breakdown.length, max: wos.length || 1, tone: 'red', sub: `${downtime(breakdown)} h downtime` },
          ]} />
          <p className="muted-note" style={{ marginTop: 12 }}>Ratio {planned.length}:{breakdown.length}. A higher planned share usually means fewer unplanned stoppages.</p>
        </Panel>
      </div>
      <Panel title="Compliance expiries" meta="Contractor induction, medical and competency dates expired or expiring within 30 days, and permits active past expiry">
        {allExpiries.length ? (
          <div className="table-wrap">
            <table className="table" data-testid="expiry-table">
              <thead><tr><th>Who</th><th>Item</th><th>Date</th><th>State</th></tr></thead>
              <tbody>
                {allExpiries.map((e) => (
                  <tr key={e.key}>
                    <td>{hasModule(e.to.split('/')[0]) ? <Link to={`${base}/${e.to}`}><strong>{e.who}</strong></Link> : <strong>{e.who}</strong>}</td>
                    <td>{e.what}</td>
                    <td>{formatDate(e.date)}</td>
                    <td><DueTag state={e.state} label={e.state === 'overdue' ? `Expired ${daysBetween(e.date, today)} d ago` : `${daysBetween(today, e.date)} days left`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="Nothing expired or expiring" />}
      </Panel>
      <div className="section-gap" />
      <Notice tone="grey">Reports are illustrative and use invented data. They are not reconciled to survey, plant or statutory reporting, and environmental figures use demo thresholds, not regulatory limits.</Notice>
    </>
  );
}
