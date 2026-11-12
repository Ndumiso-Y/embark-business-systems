import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, formatDate, parseIso, relativeWhen } from '../../../core/lib/dates';
import { BarChart, Empty, Meters, PageHeader, Panel, Stat, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { PRIORITIES } from '../data';
import { MallStyles } from './shared';
import {
  ageing, arrearsList, declarationOverdue, escalationState, expectedRentRoll, footfallCompare, leaseExpiring, leaseDaysLeft, leaseUnit, logFor, monthBilling, needsReview, occupancy, periodLabel,
  periodOf, permitExpired, plural, prevPeriod, rand, randBig, renewalOverdue, responseOverdue, shopLabel, tenantSales, thousands, todayStr, unitOf, woOpen, incidentCloseProblem, leaseOf,
} from '../helpers';

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Where each role does most of its work. */
const PRIMARY: Record<string, { to: string; label: string }> = {
  centre: { to: 'units', label: 'Open the stacking plan' },
  leasing: { to: 'units', label: 'Open the stacking plan' },
  leasingadmin: { to: 'pipeline', label: 'Leasing pipeline' },
  operations: { to: 'workorders', label: 'Work orders' },
  coordinator: { to: 'permits', label: 'Work permits' },
  accounts: { to: 'billing', label: 'Monthly billing' },
  marketing: { to: 'bookings', label: 'Exhibition bookings' },
  security: { to: 'incidents', label: 'Incidents' },
};

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const period = periodOf(today);
  const last = prevPeriod(period);

  const units = records(data, 'units');
  const occ = occupancy(units);
  const leases = records(data, 'leases');
  const expiring = leases.filter((l) => leaseExpiring(l, today));
  const escalations = leases.filter((l) => escalationState(l, today));
  const thisMonth = monthBilling(data, period);
  const lastMonth = monthBilling(data, last);
  const roll = expectedRentRoll(data);
  const age = ageing(records(data, 'invoices'), today);
  const debtors = arrearsList(data, today);
  const declarations = records(data, 'turnover').filter((d) => d.status === 'awaited');
  const overdueDecl = declarations.filter((d) => declarationOverdue(d, today));
  const atRisk = tenantSales(data).filter((s) => s.atRisk);
  const cmp = footfallCompare(data, today);
  const jobs = records(data, 'workorders').filter(woOpen);
  const lateJobs = jobs.filter((w) => responseOverdue(w, today) > 0);
  const permits = records(data, 'permits');
  const active = permits.filter((p) => p.status === 'active');
  const expired = active.filter((p) => permitExpired(p, today));
  const requested = permits.filter((p) => p.status === 'requested');
  const flaggedReadings = records(data, 'readings').filter((r) => needsReview(data, r));
  const incidents = records(data, 'incidents').filter((i) => i.status !== 'closed');
  const clashIncidents = incidents.filter((i) => i.status === 'investigated' && incidentCloseProblem(i));
  const applications = leases.filter((l) => l.status === 'application');
  const billed = thisMonth.count > 0;
  const primary = PRIMARY[user.role] && hasModule(PRIMARY[user.role].to) ? PRIMARY[user.role] : undefined;

  const chart = Array.from({ length: 14 }, (_, i) => addDays(today, i - 14)).map((d) => ({ label: `${DOW[parseIso(d).getDay()]} ${d.slice(8)}`, value: num(logFor(data, d), 'footfall') }));

  const attention = [
    ...expired.map((p) => ({ to: `permits/${p.id}`, mod: 'permits', tone: 'red' as const, title: `${p.ref} expired but still active`, sub: `${str(p, 'contractor')} · ran out ${formatDate(str(p, 'validTo'))}` })),
    ...debtors.filter((d) => d.age.d90plus > 0).map((d) => ({ to: d.caseRec ? `arrears/${d.caseRec.id}` : 'arrears', mod: 'arrears', tone: 'red' as const, title: `${str(d.lease, 'tenant')} over 90 days in arrears`, sub: `${rand(d.age.overdue)} overdue · ${shopLabel(leaseUnit(data, d.lease))}` })),
    ...lateJobs.map((w) => ({ to: `workorders/${w.id}`, mod: 'workorders', tone: 'red' as const, title: `${w.ref} past its response target`, sub: `${str(w, 'title')} · ${unitOf(data, str(w, 'unit')) ? shopLabel(unitOf(data, str(w, 'unit'))) : str(w, 'area')}` })),
    ...leases.filter((l) => renewalOverdue(l, today)).map((l) => ({ to: `leases/${l.id}`, mod: 'leases', tone: 'red' as const, title: `${str(l, 'tenant')} — renewal overdue`, sub: (leaseDaysLeft(l, today) ?? 0) < 0 ? `Lease ended ${formatDate(str(l, 'endDate'))}; tenant is holding over` : `Lease ends ${formatDate(str(l, 'endDate'))} and no renewal is open` })),
    ...clashIncidents.map((i) => ({ to: `incidents/${i.id}`, mod: 'incidents', tone: 'red' as const, title: `${i.ref} needs an insurance reference`, sub: `${str(i, 'location')} · injury or damage recorded` })),
    ...atRisk.map((s) => ({ to: `leases/${s.lease.id}`, mod: 'leases', tone: 'amber' as const, title: `${str(s.lease, 'tenant')} — rent is ${s.ratio}% of sales`, sub: `At risk · ${periodLabel(s.period)} turnover ${rand(s.turnover * 100)}` })),
    ...escalations.map((l) => ({ to: `leases/${l.id}`, mod: 'leases', tone: escalationState(l, today) === 'overdue' ? 'red' as const : 'amber' as const, title: `${str(l, 'tenant')} — escalation ${escalationState(l, today) === 'overdue' ? 'overdue' : 'due this month'}`, sub: `${num(l, 'escalationPct')}% on the lease anniversary` })),
    ...overdueDecl.slice(0, 3).map((d) => ({ to: `turnover/${d.id}`, mod: 'turnover', tone: 'amber' as const, title: `${str(leaseOf(data, d.values.lease), 'tenant')} — turnover declaration overdue`, sub: `${periodLabel(str(d, 'period'))} was due by the 7th` })),
    ...flaggedReadings.map((r) => ({ to: `meters/${r.id}`, mod: 'meters', tone: 'amber' as const, title: `${shopLabel(unitOf(data, str(r, 'unit')))} — unusual meter usage`, sub: `${periodLabel(str(r, 'period'))} reading flagged for review` })),
    ...requested.map((p) => ({ to: `permits/${p.id}`, mod: 'permits', tone: 'amber' as const, title: `${p.ref} waiting for approval`, sub: `${str(p, 'contractor')} · from ${formatDate(str(p, 'validFrom'))}` })),
    ...applications.map((l) => ({ to: `leases/${l.id}`, mod: 'leases', tone: 'amber' as const, title: `Lease application from ${str(l, 'tenant')}`, sub: `${shopLabel(leaseUnit(data, l))} · waiting for heads of terms` })),
  ].filter((a) => hasModule(a.mod));

  return (
    <>
      <MallStyles />
      <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={`${formatDate(today)} · centre overview built from the live demo records.`}
        actions={primary ? <Link className="btn primary" to={`${base}/${primary.to}`} data-testid="primary-action">{primary.label}</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">Occupancy by GLA</div>
          <h2 data-testid="hero-occupancy">{occ.pct}% let — {thousands(occ.occupied)} of {thousands(occ.gla)} m²</h2>
          <p>{occ.letUnits} shops trading and {occ.fitoutUnits} fitting out. {plural(occ.vacantUnits, 'unit')} vacant and {occ.offerUnits} under offer, with {plural(applications.length, 'lease application')} waiting.</p>
        </div>
        {hasModule('units') ? <Link className="btn" to={`${base}/units`}>Stacking plan →</Link>
          : hasModule('workorders') ? <Link className="btn" to={`${base}/workorders`}>{jobs.length} open work orders →</Link>
          : hasModule('bookings') ? <Link className="btn" to={`${base}/bookings`}>Exhibition bookings →</Link>
          : hasModule('incidents') ? <Link className="btn" to={`${base}/incidents`}>{incidents.length} open incidents →</Link> : null}
      </div>
      <div className="stat-grid">
        <Stat label="Vacant units" value={occ.vacantUnits} tone={occ.vacantUnits ? 'red' : undefined} sub={`${thousands(units.filter((u) => u.status === 'vacant').reduce((n, u) => n + num(u, 'gla'), 0))} m² · ${occ.offerUnits} more under offer`} />
        <Stat label={`Billed · ${periodLabel(period)}`} value={billed ? randBig(thisMonth.billed) : 'Not drafted'} tone="accent"
          sub={billed ? `${randBig(thisMonth.collected)} collected (${thisMonth.pct}%)` : `about ${randBig(roll.total)} to draft · ${periodLabel(last)}: ${lastMonth.pct}% of ${randBig(lastMonth.billed)} collected`} />
        <Stat label="Arrears" value={randBig(age.overdue)} tone={age.overdue ? 'red' : undefined} sub={`${plural(debtors.length, 'tenant')} · ${randBig(age.d90plus)} over 90 days`} />
        <Stat label="Leases expiring in 6 months" value={expiring.length} tone={expiring.some((l) => renewalOverdue(l, today)) ? 'red' : undefined} sub={`${expiring.filter((l) => renewalOverdue(l, today)).length} with renewal overdue · ${escalations.length} escalations due`} />
      </div>
      <div className="stat-grid">
        <Stat label="Turnover declarations outstanding" value={declarations.length} tone={overdueDecl.length ? 'red' : undefined} sub={`${overdueDecl.length} overdue (due by the 7th)`} />
        <Stat label={cmp ? `Footfall · ${cmp.isToday ? 'today' : formatDate(cmp.date)}` : 'Footfall'} value={cmp ? thousands(cmp.footfall) : '—'}
          change={cmp && cmp.changePct !== null ? <Tag tone={cmp.changePct >= 0 ? 'green' : 'red'}>{cmp.changePct >= 0 ? '+' : ''}{cmp.changePct}%</Tag> : undefined}
          sub={cmp ? `vs ${thousands(cmp.lastWeek)} the ${WEEKDAY[parseIso(cmp.date).getDay()]} before${cmp.isToday ? '' : ' · today not captured yet'}` : 'no counts typed in yet'} />
        <Stat label="Open maintenance" value={jobs.length} tone={lateJobs.length ? 'red' : undefined} sub={`${jobs.filter((w) => str(w, 'priority') === 'emergency').length} emergency · ${jobs.filter((w) => str(w, 'priority') === 'urgent').length} urgent · ${lateJobs.length} past response target`} />
        <Stat label="Active work permits" value={active.length} tone={expired.length ? 'red' : undefined} sub={`${expired.length} expired but still active · ${requested.length} waiting for approval`} />
      </div>
      <div className="grid-2">
        <Panel title="Needs attention" meta="Rules: permits, arrears, response targets, renewals, escalations, declarations, meter usage">
          {attention.length ? (
            <ul className="list" data-testid="attention-list">
              {attention.slice(0, 10).map((a) => (
                <li key={a.to + a.title}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
              ))}
            </ul>
          ) : <Empty title="Nothing needs attention" />}
          {attention.length > 10 && <p className="muted-note" style={{ marginTop: 8 }}>{attention.length - 10} more — see the module registers.</p>}
        </Panel>
        <div className="stack">
          <Panel title="Open maintenance by priority" meta="Work orders not yet confirmed or closed" right={hasModule('workorders') ? <Link className="btn sm" to={`${base}/workorders`}>Work orders</Link> : undefined}>
            <Meters items={PRIORITIES.map((p) => { const list = jobs.filter((w) => str(w, 'priority') === p.value); const late = list.filter((w) => responseOverdue(w, today) > 0).length; return { label: p.label, value: list.length, max: Math.max(1, jobs.length), tone: late ? 'red' as const : p.value === 'emergency' && list.length ? 'amber' as const : undefined, sub: late ? `${late} past the response target` : 'all within target' }; })} />
          </Panel>
        </div>
      </div>
      <div className="grid-2">
        <Panel title="Footfall — last 14 days" meta="Daily counts typed into the centre operations log" right={hasModule('ops') ? <Link className="btn sm" to={`${base}/ops`}>Capture today</Link> : undefined}>
          <div className="mall-dense"><BarChart label="Footfall per day for the last 14 days" data={chart} format={(n) => thousands(n)} /></div>
        </Panel>
        <Panel title="Recent activity" meta="Actions taken in this browser">
          {data.activity.length ? (
            <ul className="list">
              {data.activity.slice(0, 7).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
            </ul>
          ) : <Empty title="No activity yet" body="Agree heads of terms, capture a meter reading or draft the month’s invoices — actions appear here." />}
        </Panel>
      </div>
      <RoleBar />
    </>
  );
}
