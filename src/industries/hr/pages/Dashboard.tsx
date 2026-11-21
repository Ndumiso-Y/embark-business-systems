import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate, monthLabel, parseIso, relativeWhen } from '../../../core/lib/dates';
import { BarChart, Empty, KeyValues, PageHeader, Panel, Pipeline, Stat, StatusTag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { SITES } from '../data';
import {
  approverProblem, awayOn, balances, certState, currentEmployees, driversWithoutPrdp, emp, employeeOfUser, fixedTermDaysLeft, fmtDays, fullName,
  isCurrent, jobLabel, leaveColour, leaveOf, leaveShort, medicalCertProblem, onboardingMissing, openCases, packFor, packIssues, periodOf, probationDaysLeft,
  probationEndOf, serviceLabel, siteShort, teamClash, todayStr, weekStart,
} from '../helpers';
import { BalanceCards, LeaveTypeLabel } from './shared';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Dashboard() {
  const { hasModule } = useUser();
  return hasModule('employees') ? <HrDashboard /> : <MyDashboard />;
}

/** Self-service landing page for an employee: their own balances and requests only. */
function MyDashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const me = employeeOfUser(data, user);
  const def = config.collections.find((c) => c.key === 'leave')!;
  if (!me) {
    return (
      <>
        <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={formatDate(today)} />
        <div className="dash-hero"><div><div className="hero-kicker">Self-service</div><h2>No employee record is linked to this user</h2><p>Self-service shows the employee with the same name as the signed-in user.</p></div></div>
        <div className="stat-grid"><Stat label="Leave balances" value="—" sub="no employee record" /></div>
        <RoleBar />
      </>
    );
  }
  const mine = leaveOf(data, me.id).sort((a, b) => str(b, 'start').localeCompare(str(a, 'start')));
  const annual = balances(data, me, today)[0];
  const waiting = mine.filter((l) => l.status === 'requested');
  const next = mine.filter((l) => ['approved', 'requested'].includes(l.status ?? '') && str(l, 'end') >= today).sort((a, b) => str(a, 'start').localeCompare(str(b, 'start')))[0];
  const mgr = emp(data, str(me, 'manager'));
  return (
    <>
      <PageHeader kicker={`${config.businessName} / Self-service`} title={`Good day, ${str(me, 'firstName')}`} subtitle={`${formatDate(today)} · your own leave and details. Other people’s records are not visible to you.`} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">Your annual leave</div>
          <h2>{fmtDays(annual.available)} days available · {waiting.length} request{waiting.length === 1 ? '' : 's'} waiting</h2>
          <p>{next ? `Next: ${leaveShort(str(next, 'type')).toLowerCase()} leave from ${formatDate(str(next, 'start'))} (${next.status === 'requested' ? 'awaiting approval' : 'approved'}).` : 'No leave booked.'} Requests go to {mgr ? fullName(mgr) : 'your manager'} or HR.</p>
        </div>
        {hasModule('myleave') && <Link className="btn" to={`${base}/myleave`}>Request leave →</Link>}
      </div>
      <BalanceCards list={balances(data, me, today)} />
      <div className="grid-2">
        <Panel title="My recent leave" right={hasModule('myleave') ? <Link className="btn sm" to={`${base}/myleave`}>My leave</Link> : undefined}>
          {mine.length ? (
            <ul className="list" data-testid="my-recent">
              {mine.slice(0, 6).map((l) => <li key={l.id}><div className="grow"><b><LeaveTypeLabel type={str(l, 'type')} /></b><small>{formatDate(str(l, 'start'))}{str(l, 'end') !== str(l, 'start') ? ` – ${formatDate(str(l, 'end'))}` : ''}</small></div><StatusTag workflow={def.workflow} status={l.status} /></li>)}
            </ul>
          ) : <Empty title="No leave yet" />}
        </Panel>
        <Panel title="My details">
          <KeyValues items={[
            { label: 'Job', value: jobLabel(me) },
            { label: 'Site', value: siteShort(str(me, 'site')) },
            { label: 'Manager', value: mgr ? fullName(mgr) : '—' },
            { label: 'Service', value: serviceLabel(me, today) },
          ]} />
          <p className="muted-note" style={{ marginTop: 10 }}>To change your details, speak to HR. Payslips and tax certificates are not part of this demo.</p>
        </Panel>
      </div>
      <RoleBar />
    </>
  );
}

function HrDashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const people = currentEmployees(data);
  const awayToday = awayOn(data, today, (l) => people.some((p) => p.id === str(l, 'employee')));
  const requested = records(data, 'leave').filter((l) => l.status === 'requested');
  const forMe = requested.filter((l) => !approverProblem(data, user, l));
  const probation = people.filter((e) => { const d = probationDaysLeft(e, today); return d !== null && d <= 30; });
  const certs = records(data, 'certificates').filter((c) => isCurrent(emp(data, str(c, 'employee'))));
  const expired = certs.filter((c) => certState(c, data, today) === 'expired');
  const expiring = certs.filter((c) => certState(c, data, today) === 'expiring');
  const noPrdp = driversWithoutPrdp(data, today);
  const cases = openCases(data);
  const period = periodOf(today);
  const pack = packFor(data, period);
  const issues = packIssues(data, period);
  const packDef = config.collections.find((c) => c.key === 'payruns')!;
  const packState = packDef.workflow!.states.find((s) => s.key === pack?.status);
  const hires = records(data, 'employees').filter((e) => e.status === 'onboarding');
  // On a weekend the strip shows the coming week.
  const weekend = [0, 6].includes(parseIso(today).getDay());
  const week = Array.from({ length: 5 }, (_, i) => addDays(weekStart(weekend ? addDays(today, 2) : today), i));

  const attention = [
    ...noPrdp.map((e) => ({ to: `employees/${e.id}`, title: `${fullName(e)} has no valid PrDP`, sub: `${jobLabel(e)} · ${siteShort(str(e, 'site'))} — must not drive a goods vehicle until renewed`, tone: 'red' as const, mod: 'employees' })),
    ...requested.filter((l) => medicalCertProblem(l)).map((l) => ({ to: `leave/${l.id}`, title: `Medical certificate needed — ${fullName(emp(data, str(l, 'employee')))}`, sub: `${l.ref} · sick leave of more than two days`, tone: 'red' as const, mod: 'leave' })),
    ...requested.filter((l) => teamClash(data, l)).map((l) => ({ to: `leave/${l.id}`, title: `Team cover clash — ${fullName(emp(data, str(l, 'employee')))}`, sub: `${l.ref} would put the team over its limit on ${formatDate(teamClash(data, l)!.day)}`, tone: 'amber' as const, mod: 'leave' })),
    ...people.filter((e) => (probationDaysLeft(e, today) ?? 1) < 0).map((e) => ({ to: `employees/${e.id}`, title: `Probation review overdue — ${fullName(e)}`, sub: `Probation ended ${formatDate(probationEndOf(e))}`, tone: 'red' as const, mod: 'employees' })),
    ...probation.filter((e) => (probationDaysLeft(e, today) ?? -1) >= 0).map((e) => ({ to: `employees/${e.id}`, title: `Probation ends in ${probationDaysLeft(e, today)} days — ${fullName(e)}`, sub: `${jobLabel(e)} · record the review outcome`, tone: 'amber' as const, mod: 'employees' })),
    ...people.filter((e) => { const d = fixedTermDaysLeft(e, today); return d !== null && d <= 30; }).map((e) => ({ to: `employees/${e.id}`, title: `Fixed-term contract ends ${formatDate(str(e, 'fixedTermEnd'))} — ${fullName(e)}`, sub: 'Renew, make permanent or record the exit', tone: 'amber' as const, mod: 'employees' })),
    ...people.filter((e) => e.status === 'notice' && str(e, 'lastDay') <= today).map((e) => ({ to: `employees/${e.id}`, title: `Exit to complete — ${fullName(e)}`, sub: `Last working day was ${formatDate(str(e, 'lastDay'))}`, tone: 'amber' as const, mod: 'employees' })),
    ...hires.filter((e) => onboardingMissing(e).length && daysBetween(today, str(e, 'startDate')) <= 3).map((e) => ({ to: `onboarding/${e.id}`, title: `${fullName(e)} starts ${str(e, 'startDate') <= today ? 'today' : formatDate(str(e, 'startDate'))} — ${onboardingMissing(e).length} items open`, sub: onboardingMissing(e).map((i) => i.short).join(' · '), tone: 'amber' as const, mod: 'onboarding' })),
    ...cases.filter((c) => c.status === 'hearing').map((c) => ({ to: `cases/${c.id}`, title: str(c, 'hearingDate') < today ? `Hearing held — record the outcome (${fullName(emp(data, str(c, 'employee')))})` : `Hearing on ${formatDate(str(c, 'hearingDate'))} — ${fullName(emp(data, str(c, 'employee')))}`, sub: c.ref, tone: 'amber' as const, mod: 'cases' })),
    ...(issues.length && pack && !['approved', 'sent'].includes(pack.status ?? '') ? [{ to: `payroll/${pack.id}`, title: `${monthLabel(period)} payroll inputs: ${issues.length} unresolved`, sub: issues[0].text, tone: 'red' as const, mod: 'payroll' }] : []),
    ...records(data, 'requisitions').filter((r) => r.status === 'draft' && !r.values.budgeted).map((r) => ({ to: `hiring/${r.id}`, title: `${str(r, 'title')} needs MD approval`, sub: 'Not in the headcount budget', tone: 'amber' as const, mod: 'hiring' })),
    ...records(data, 'reviews').filter((r) => r.status === 'moderation').map((r) => ({ to: `reviews/${r.id}`, title: `Rating to moderate — ${fullName(emp(data, str(r, 'employee')))}`, sub: `Manager rating ${str(r, 'managerRating')}`, tone: 'amber' as const, mod: 'reviews' })),
    ...(expired.length - noPrdp.length > 0 ? [{ to: 'certificates', title: `${expired.length} certificate${expired.length === 1 ? '' : 's'} expired`, sub: expired.map((c) => fullName(emp(data, str(c, 'employee')))).slice(0, 3).join(', '), tone: 'red' as const, mod: 'certificates' }] : []),
  ].filter((a) => hasModule(a.mod));

  const bySite = SITES.map((s) => ({ label: s.short, value: people.filter((e) => str(e, 'site') === s.value).length }));
  const appDef = config.collections.find((c) => c.key === 'applicants')!;
  const apps = records(data, 'applicants');
  const stages = appDef.workflow!.states.filter((s) => !s.terminal).map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: apps.filter((a) => a.status === s.key).length }));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={`${formatDate(today)} · people overview built from the live demo records.`}
        actions={hasModule('calendar') ? <Link className="btn primary" to={`${base}/calendar`}>Who’s away</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">On the books today</div>
          <h2>{people.length} people · {awayToday.length} away today · {requested.length} leave request{requested.length === 1 ? '' : 's'} waiting</h2>
          <p>{SITES.map((s) => `${s.short} ${people.filter((e) => str(e, 'site') === s.value).length}`).join(' · ')}. {hires.length} new hire{hires.length === 1 ? '' : 's'} in onboarding, {cases.length} open case{cases.length === 1 ? '' : 's'}.</p>
        </div>
        {hasModule('leave') ? <Link className="btn" to={`${base}/leave`}>{forMe.length} request{forMe.length === 1 ? '' : 's'} you can decide →</Link>
          : hasModule('payroll') && pack ? <Link className="btn" to={`${base}/payroll/${pack.id}`}>{monthLabel(period)} inputs →</Link> : null}
      </div>
      <div className="stat-grid">
        <Stat label="Headcount" value={people.length} sub={`${people.filter((e) => e.status === 'probation').length} on probation · ${people.filter((e) => e.status === 'notice').length} on notice`} />
        <Stat label="On leave today" value={awayToday.length} sub={awayToday.slice(0, 3).map((l) => str(emp(data, str(l, 'employee')), 'firstName')).join(', ') || 'everyone in'} />
        <Stat label="Leave awaiting approval" value={requested.length} tone={requested.length ? 'red' : undefined} sub={`${forMe.length} you can decide`} />
        <Stat label="Probations ending ≤ 30 days" value={probation.length} tone={probation.some((e) => (probationDaysLeft(e, today) ?? 0) < 0) ? 'red' : undefined} sub={`${probation.filter((e) => (probationDaysLeft(e, today) ?? 0) < 0).length} review overdue`} />
      </div>
      <div className="stat-grid">
        <Stat label="Certificates expired / expiring" value={`${expired.length} / ${expiring.length}`} tone={expired.length ? 'red' : undefined} sub={`${noPrdp.length} driver${noPrdp.length === 1 ? '' : 's'} without a valid PrDP`} />
        <Stat label="Open disciplinary cases" value={cases.filter((c) => str(c, 'kind') === 'disciplinary').length} sub={`${cases.filter((c) => str(c, 'kind') === 'grievance').length} grievance${cases.filter((c) => str(c, 'kind') === 'grievance').length === 1 ? '' : 's'} open`} />
        <Stat label={`Payroll inputs · ${monthLabel(period)}`} value={packState?.label ?? 'Not started'} tone={issues.length && pack?.status !== 'sent' ? 'red' : 'accent'} sub={pack && ['approved', 'sent'].includes(pack.status ?? '') ? 'locked' : `${issues.length} unresolved`} />
        <Stat label="New hires in onboarding" value={hires.length} sub={`${hires.reduce((n, e) => n + onboardingMissing(e).length, 0)} checklist items open`} />
      </div>
      <Panel title={weekend ? 'Who’s away next week' : 'Who’s away this week'} meta="Approved and taken leave, Monday to Friday" right={hasModule('calendar') ? <Link className="btn sm" to={`${base}/calendar`}>Calendar</Link> : undefined}>
        <div className="hr-week" data-testid="away-week">
          {week.map((d) => {
            const away = awayOn(data, d, (l) => people.some((p) => p.id === str(l, 'employee')));
            return (
              <section key={d} className={`hr-day ${d === today ? 'today' : ''}`} aria-label={`${DOW[parseIso(d).getDay()]} ${formatDate(d)}`}>
                <header>{DOW[parseIso(d).getDay()]} {d.slice(8)}<small>{away.length} away</small></header>
                {away.length ? (
                  <ul>
                    {away.slice(0, 6).map((l) => <li key={l.id} title={leaveShort(str(l, 'type'))}><span className={`hr-lv ${leaveColour(str(l, 'type'))}`}><span className="hr-swatch" /></span><span>{fullName(emp(data, str(l, 'employee')))}</span></li>)}
                    {away.length > 6 && <li><span className="hr-none">+{away.length - 6} more</span></li>}
                  </ul>
                ) : <span className="hr-none">Nobody away</span>}
              </section>
            );
          })}
        </div>
      </Panel>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Needs attention" meta="Rules: certificates, leave checks, probation, contracts, onboarding, hearings, payroll inputs">
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
          <Panel title="Headcount by site" meta="People on the books today">
            <BarChart label="Headcount by site" data={bySite} />
          </Panel>
          {hasModule('applicants') ? (
            <Panel title="Hiring pipeline" meta={`${records(data, 'requisitions').filter((r) => r.status === 'open').length} open requisitions`}>
              <Pipeline stages={stages} />
            </Panel>
          ) : (
            <Panel title="Recent activity" meta="Actions taken in this browser">
              {data.activity.length ? <ul className="list">{data.activity.slice(0, 5).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}</ul>
                : <Empty title="No activity yet" body="Approve leave or check the payroll pack — actions appear here." />}
            </Panel>
          )}
        </div>
      </div>
      <p className="muted-note" style={{ margin: '0 0 12px' }}>{expiring.length + expired.length ? `Certificates: ${[...expired, ...expiring].slice(0, 4).map((c) => `${fullName(emp(data, str(c, 'employee')))} (${formatDate(str(c, 'expires'))})`).join(', ')}.` : ''} Every number on this page is computed from the records; nothing is fixed.</p>
      <RoleBar />
    </>
  );
}
