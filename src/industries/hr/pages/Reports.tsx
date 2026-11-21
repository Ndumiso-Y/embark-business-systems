import { useData, useIndustry } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, monthKeys, monthLabel, monthShort } from '../../../core/lib/dates';
import { BarChart, Meters, PageHeader, Panel, Pipeline, Stat } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { DEPARTMENTS, EXIT_REASONS, SITES, WORKING_DAYS_PER_MONTH, label } from '../data';
import {
  addMonths, bradford, currentEmployees, daysWithin, deptOf, fmtDays, headcountOn, isBooked, jobLabel, leaveLiability, monthEnd, monthStart, randWhole, siteShort, todayStr,
  turnover, workingDays,
} from '../helpers';
import { EmpLink } from './shared';

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const people = currentEmployees(data);
  const caseDef = config.collections.find((c) => c.key === 'cases')!;

  const headcount12 = headcountOn(data, addMonths(today, -12));
  // Headcount matrix.
  const depts = DEPARTMENTS.filter((d) => people.some((e) => deptOf(e) === d.value));
  const cell = (dept: string, site: string) => people.filter((e) => deptOf(e) === dept && str(e, 'site') === site).length;

  // Turnover.
  const t = turnover(data, today);
  const months12 = monthKeys(today, 12);
  const leaversByMonth = months12.map((m) => ({ label: monthShort(m), value: t.leavers.filter((e) => str(e, 'lastDay').slice(0, 7) === m).length }));

  // Absenteeism: sick days per month (last six months) and the Bradford factor.
  const months6 = monthKeys(today, 6);
  const sick = records(data, 'leave').filter((l) => str(l, 'type') === 'sick' && isBooked(l));
  const sickByMonth = months6.map((m) => ({ label: monthShort(m), value: sick.reduce((n, l) => n + daysWithin(l, monthStart(m), monthEnd(m) < today ? monthEnd(m) : today), 0) }));
  const yearFrom = addDays(today, -364);
  const sickYear = sick.reduce((n, l) => n + daysWithin(l, yearFrom, today), 0);
  const possible = people.length * workingDays(yearFrom, today);
  const rate = possible ? Math.round((sickYear / possible) * 1000) / 10 : 0;
  const brad = people.map((e) => ({ e, ...bradford(data, e.id, today) })).filter((b) => b.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);

  // Leave liability.
  const liab = leaveLiability(data, today);
  const liabByDept = depts.map((d) => ({ label: d.label, value: Math.round(liab.rows.filter((r) => deptOf(r.e) === d.value).reduce((n, r) => n + r.value, 0)), sub: `${fmtDays(liab.rows.filter((r) => deptOf(r.e) === d.value).reduce((n, r) => n + r.days, 0))} days owed` }));

  // Overtime by department, last three pay periods.
  const periods = monthKeys(today, 3);
  const ot = records(data, 'inputs').filter((i) => str(i, 'kind') === 'overtime' && periods.includes(str(i, 'period')));
  const otByDept = depts.map((d) => ({ label: d.label, value: ot.filter((i) => deptOf(records(data, 'employees').find((e) => e.id === str(i, 'employee'))) === d.value).reduce((n, i) => n + num(i, 'hours'), 0) })).filter((x) => x.value > 0);

  // Cases.
  const cases = records(data, 'cases');
  const stages = caseDef.workflow!.states.map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: cases.filter((c) => c.status === s.key).length }));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Insight`} title="Reports" subtitle="Computed live from the employee, leave, payroll-input and case records in this browser." />
      <div className="stat-grid">
        <Stat label="Headcount" value={people.length} sub={SITES.map((s) => `${s.short} ${people.filter((e) => str(e, 'site') === s.value).length}`).join(' · ')} />
        <Stat label="Turnover · last 12 months" value={`${t.pct}%`} tone={t.pct > 15 ? 'red' : 'accent'} sub={`${t.leavers.length} leavers ÷ average headcount ${fmtDays(t.avg)}`} />
        <Stat label="Sick days · last 12 months" value={sickYear} sub={`${rate}% of working days · ${people.length ? fmtDays(Math.round((sickYear / people.length) * 10) / 10) : 0} per person`} />
        <Stat label="Annual leave liability" value={randWhole(liab.value)} sub={`${fmtDays(Math.round(liab.days * 10) / 10)} days owed × daily rate`} />
      </div>
      <Panel title="Headcount by department and site" meta="People on the books today (probation, active and on notice)">
        <div className="table-wrap">
          <table className="table" data-testid="report-headcount">
            <thead><tr><th>Department</th>{SITES.map((s) => <th key={s.value} className="num">{s.short}</th>)}<th className="num">Total</th></tr></thead>
            <tbody>
              {depts.map((d) => (
                <tr key={d.value}><td><strong>{d.label}</strong></td>{SITES.map((s) => <td key={s.value} className="num">{cell(d.value, s.value) || '·'}</td>)}<td className="num"><strong>{people.filter((e) => deptOf(e) === d.value).length}</strong></td></tr>
              ))}
              <tr><td><strong>Total</strong></td>{SITES.map((s) => <td key={s.value} className="num"><strong>{people.filter((e) => str(e, 'site') === s.value).length}</strong></td>)}<td className="num"><strong>{people.length}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="section-gap" />
      <div className="grid-2-even">
        <Panel title="Leavers per month" meta={`Last 12 months · ${t.leavers.length} leavers`}>
          <BarChart label="Leavers per month" data={leaversByMonth} />
          <ul className="list" style={{ marginTop: 10 }}>
            {t.leavers.map((e) => <li key={e.id}><div className="grow"><b><EmpLink e={e} /></b><small>{jobLabel(e)} · {siteShort(str(e, 'site'))} · {label(EXIT_REASONS, str(e, 'exitReason'))} · {monthLabel(str(e, 'lastDay').slice(0, 7))}</small></div></li>)}
          </ul>
        </Panel>
        <Panel title="Sick days per month" meta="Working days of approved or taken sick leave, last six months">
          <BarChart label="Sick days per month" data={sickByMonth} />
          <h3 style={{ margin: '14px 0 4px', fontSize: 13 }}>Bradford factor (spells² × days, last 52 weeks)</h3>
          <ul className="list" data-testid="bradford">
            {brad.map((b) => <li key={b.e.id}><div className="grow"><b><EmpLink e={b.e} /></b><small>{b.spells} spell{b.spells === 1 ? '' : 's'} · {b.days} day{b.days === 1 ? '' : 's'}</small></div><span className={`tag ${b.score >= 100 ? 'red' : b.score >= 50 ? 'amber' : 'dark'}`}>{b.score}</span></li>)}
          </ul>
          <p className="muted-note" style={{ marginTop: 8 }}>A prompt for a conversation, not a sanction. Short, frequent absences score higher than one long one.</p>
        </Panel>
      </div>
      <div className="grid-2-even">
        <Panel title="Annual leave liability by department" meta={`Each person’s unused annual leave × (monthly salary ÷ ${WORKING_DAYS_PER_MONTH}) · ${randWhole(liab.value)} in total`}>
          <Meters items={liabByDept} format={(n) => randWhole(n)} />
        </Panel>
        <Panel title="Overtime by department" meta={`Hours captured in the payroll inputs for ${periods.map(monthShort).join(', ')}`}>
          {otByDept.length ? <Meters items={otByDept} format={(n) => `${fmtDays(n)} h`} /> : <p className="muted-note">No overtime captured.</p>}
        </Panel>
      </div>
      <Panel title="Discipline & grievances" meta={`${cases.filter((c) => c.status !== 'closed').length} open · ${cases.length} on record`}>
        <Pipeline stages={stages} />
      </Panel>
      <p className="muted-note" style={{ margin: '12px 0' }}>Turnover divides the leavers of the last twelve months by the average of the headcount then ({headcount12}) and today ({people.length}). The leave liability is an estimate for discussion, not an accounting provision. Every figure comes from the fictional records in this browser.</p>
      <RoleBar />
    </>
  );
}
