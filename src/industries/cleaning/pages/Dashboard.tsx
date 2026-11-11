import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate, parseIso, relativeWhen } from '../../../core/lib/dates';
import { BarChart, Empty, PageHeader, Panel, Stat, StatusTag, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import {
  attendance, breachedComplaints, budgetState, contractEnding, dayStaffing, inspectionFailed, invoiceOverdue, latestInspection, lowStock, monthScores,
  openComplaints, overduePeriodic, periodScores, periodicLabel, siteName, sitesOverBudget, staffFlags, staffing, staffingPct, todayStr, inspectionScore, slaTarget,
} from '../helpers';
import { StaffingTag } from './shared';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const month = today.slice(0, 7);
  const shiftDef = config.collections.find((c) => c.key === 'shifts')!;

  const todayS = dayStaffing(data, today);
  const started = todayS.shifts.filter((s) => !['draft', 'scheduled'].includes(s.status ?? ''));
  const onSite = started.reduce((n, s) => n + staffing(s, data).present, 0);
  const dueOnSite = started.reduce((n, s) => n + staffing(s, data).contracted, 0);
  const toStart = todayS.shifts.length - started.length;

  // This month's inspections; early in the month there are too few, so fall back to the last 30 days.
  const thisMonth = monthScores(data, month);
  const useMonth = thisMonth.count >= 3;
  const scores = useMonth ? thisMonth : periodScores(data, addDays(today, -30), today);
  const open = openComplaints(data);
  const breached = breachedComplaints(data);
  const overdue = overduePeriodic(data, today);
  const low = lowStock(data);
  const over = sitesOverBudget(data, month);
  const sites = records(data, 'sites').filter((s) => s.status !== 'ended');
  const belowSla = sites.filter((s) => { const last = latestInspection(data, s.id); return !!last && inspectionFailed(last, data); });
  const reinspections = records(data, 'inspections').filter((i) => i.status === 'draft' && str(i, 'kind') === 'reinspection' && daysBetween(today, str(i, 'date')) <= 3);
  const overdueInvoices = records(data, 'invoices').filter((i) => invoiceOverdue(i, today));
  const requests = records(data, 'issues').filter((i) => i.status === 'requested').length;
  const trainingExpired = records(data, 'staff').filter((s) => staffFlags(s, today).some((f) => f.tone === 'red'));

  // Attendance % for the last seven days that had completed shifts.
  const chart = Array.from({ length: 14 }, (_, i) => addDays(today, i - 14))
    .map((d) => ({ d, a: attendance(records(data, 'shifts').filter((s) => str(s, 'date') === d), data) }))
    .filter((x) => x.a.shifts > 0).slice(-7)
    .map((x) => ({ label: `${DOW[parseIso(x.d).getDay()]} ${x.d.slice(8)}`, value: x.a.pct }));

  const attention = [
    ...todayS.short.map((s) => { const st = staffing(s, data); return { to: `schedule/${s.id}`, title: `${siteName(data, s.values.site)} is short-staffed`, sub: s.status === 'short' ? `${st.absent} absent — relief cleaner needed` : `${st.rostered} of ${st.contracted} contracted cleaners rostered`, tone: 'red' as const, mod: 'schedule' }; }),
    ...breached.map((c) => ({ to: `complaints/${c.id}`, title: `${c.ref} past its response target`, sub: `${siteName(data, c.values.site)} · logged ${formatDate(str(c, 'date'))} ${str(c, 'time')}`, tone: 'red' as const, mod: 'complaints' })),
    ...reinspections.map((i) => ({ to: `inspections/${i.id}`, title: `Re-inspection ${str(i, 'date') < today ? 'overdue' : 'due'} at ${siteName(data, i.values.site)}`, sub: `${i.ref} · ${formatDate(str(i, 'date'))}`, tone: str(i, 'date') < today ? 'red' as const : 'amber' as const, mod: 'inspections' })),
    ...belowSla.map((s) => { const last = latestInspection(data, s.id)!; return { to: `sites/${s.id}`, title: `${str(s, 'name')} is below SLA`, sub: `Last inspection ${inspectionScore(last)}% against a target of ${slaTarget(s)}%`, tone: 'red' as const, mod: 'sites' }; }),
    ...overdue.slice(0, 3).map((p) => ({ to: `periodic/${p.id}`, title: `${periodicLabel(p)} overdue`, sub: `${siteName(data, p.values.site)} · due ${formatDate(str(p, 'nextDue'))}`, tone: 'amber' as const, mod: 'periodic' })),
    ...over.map((s) => { const b = budgetState(data, s, month); return { to: `sites/${s.id}`, title: `${str(s, 'name')} over consumables budget`, sub: `${b.pct}% of this month’s budget issued`, tone: 'amber' as const, mod: 'sites' }; }),
    ...low.slice(0, 3).map((s) => ({ to: `stock/${s.id}`, title: `${str(s, 'name')} — ${num(s, 'qty')} in store`, sub: `Reorder level ${num(s, 'reorderLevel')}`, tone: num(s, 'qty') <= 0 ? 'red' as const : 'amber' as const, mod: 'stock' })),
    ...sites.filter((s) => contractEnding(s, today) !== null).map((s) => ({ to: `sites/${s.id}`, title: `${str(s, 'name')} contract ends in ${contractEnding(s, today)} days`, sub: s.status === 'notice' ? 'On notice' : 'Renewal not yet agreed', tone: 'amber' as const, mod: 'sites' })),
    ...(overdueInvoices.length ? [{ to: 'invoices', title: `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? '' : 's'} overdue`, sub: 'Issued and past the due date', tone: 'red' as const, mod: 'invoices' }] : []),
    ...(trainingExpired.length ? [{ to: 'staff', title: `${trainingExpired.length} staff with expired training`, sub: 'Infection control, chemical handling or working at heights', tone: 'amber' as const, mod: 'staff' }] : []),
  ].filter((a) => hasModule(a.mod));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={`${formatDate(today)} · operations overview built from the live demo records.`}
        actions={hasModule('schedule') ? <Link className="btn primary" to={`${base}/schedule`}>Open today’s board</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">On site today</div>
          <h2>{onSite} of {dueOnSite} contracted cleaners on site · {staffingPct(onSite, dueOnSite)}% staffed</h2>
          <p>{started.length} shifts running across {sites.length} sites, {toStart} still to start. {todayS.late} late clock-in{todayS.late === 1 ? '' : 's'} and {todayS.unfilled} unfilled place{todayS.unfilled === 1 ? '' : 's'} so far.</p>
        </div>
        {hasModule('complaints') ? <Link className="btn" to={`${base}/complaints`}>{open.length} open complaints →</Link>
          : hasModule('issues') ? <Link className="btn" to={`${base}/issues`}>{requests} stock request{requests === 1 ? '' : 's'} waiting →</Link>
          : hasModule('invoices') ? <Link className="btn" to={`${base}/invoices`}>{overdueInvoices.length} invoice{overdueInvoices.length === 1 ? '' : 's'} overdue →</Link> : null}
      </div>
      <div className="stat-grid">
        <Stat label="Staffing now" value={`${staffingPct(onSite, dueOnSite)}%`} sub={`${onSite}/${dueOnSite} cleaners on shifts that have started`} />
        <Stat label="Sites short-staffed today" value={todayS.short.length} tone={todayS.short.length ? 'red' : undefined} sub={`${todayS.unfilled} unfilled · ${todayS.late} late`} />
        <Stat label={`Inspection score · ${useMonth ? 'this month' : 'last 30 days'}`} value={scores.count ? `${scores.avg}%` : '—'} tone={scores.count && scores.avg < scores.target ? 'red' : 'accent'} sub={`SLA average ${scores.target}% · ${scores.failed} of ${scores.count} below target`} />
        <Stat label="Open complaints" value={open.length} tone={breached.length ? 'red' : undefined} sub={`${breached.length} past the response target`} />
      </div>
      <div className="stat-grid">
        <Stat label="Periodic tasks overdue" value={overdue.length} tone={overdue.length ? 'red' : undefined} sub="deep cleans past their due date" />
        <Stat label="Stock below reorder level" value={low.length} sub={`${low.filter((s) => num(s, 'qty') <= 0).length} out of stock`} />
        <Stat label="Sites over consumables budget" value={over.length} tone={over.length ? 'red' : undefined} sub="issued this month against budget" />
        <Stat label="Sites below SLA" value={belowSla.length} tone={belowSla.length ? 'red' : undefined} sub="on their latest inspection" />
      </div>
      <div className="grid-2">
        <Panel title="Today by site" meta="Cleaners present against the contracted number" right={hasModule('schedule') ? <Link className="btn sm" to={`${base}/schedule`}>Attendance board</Link> : undefined}>
          {todayS.shifts.length ? (
            <ul className="list" data-testid="today-list">
              {todayS.shifts.map((s) => {
                const st = staffing(s, data);
                const hasStarted = !['draft', 'scheduled'].includes(s.status ?? '');
                return (
                  <li key={s.id}>
                    <span className="time-chip">{str(s, 'start')}</span>
                    <div className="grow">
                      {hasModule('schedule') ? <Link to={`${base}/schedule/${s.id}`}><b>{siteName(data, s.values.site)}</b></Link> : <b>{siteName(data, s.values.site)}</b>}
                      <small>{st.late.length ? `${st.late.length} late · ` : ''}{st.absent ? `${st.absent} absent · ` : ''}{st.unfilled ? `${st.unfilled} unfilled · ` : ''}until {str(s, 'end')}</small>
                    </div>
                    <StaffingTag st={st} started={hasStarted} />
                    <StatusTag workflow={shiftDef.workflow} status={s.status} />
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="No shifts today" />}
        </Panel>
        <div className="stack">
          <Panel title="Needs attention" meta="Rules: staffing, response targets, SLA, due dates, budgets, stock levels">
            {attention.length ? (
              <ul className="list" data-testid="attention-list">
                {attention.slice(0, 10).map((a) => (
                  <li key={a.to + a.title}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
                ))}
              </ul>
            ) : <Empty title="Nothing needs attention" />}
            {attention.length > 10 && <p className="muted-note" style={{ marginTop: 8 }}>{attention.length - 10} more — see the module registers.</p>}
          </Panel>
        </div>
      </div>
      <div className="grid-2">
        <Panel title="Attendance per day" meta="Cleaners present ÷ cleaners contracted, completed shifts, last seven service days">
          {chart.length ? <BarChart label="Attendance percentage per day" data={chart} format={(n) => `${n}%`} /> : <Empty title="No completed shifts yet" />}
        </Panel>
        <Panel title="Recent activity" meta="Actions taken in this browser">
          {data.activity.length ? (
            <ul className="list">
              {data.activity.slice(0, 7).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
            </ul>
          ) : <Empty title="No activity yet" body="Clock a cleaner in, submit an inspection or issue stock — actions appear here." />}
          {reinspections.length > 0 && hasModule('inspections') && (
            <p className="muted-note" style={{ marginTop: 12 }}>Next re-inspection: <Tag tone="amber">{siteName(data, reinspections[0].values.site)}</Tag> {formatDate(str(reinspections[0], 'date'))}</p>
          )}
        </Panel>
      </div>
      <RoleBar />
    </>
  );
}
