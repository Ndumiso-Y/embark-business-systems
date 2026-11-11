import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate, relativeWhen } from '../../../core/lib/dates';
import { BarChart, Empty, Meters, PageHeader, Panel, Pipeline, Stat } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import type { Tone } from '../../../core/types';
import {
  contractorClearance, contractorName, daysSinceLastLti, envExceedance, equipmentLabel, hoursToService, lastLti, permitExpired,
  productionOn, productionToDate, sectionsToDate, serviceState, todayStr,
} from '../helpers';
import { pctTone, shortDate, tonnes } from './format';

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const permitsDef = config.collections.find((c) => c.key === 'permits')!;

  const todayProd = productionOn(data, today);
  const yesterday = productionOn(data, addDays(today, -1));
  const mtd = productionToDate(data, today);
  const sections = sectionsToDate(data, today);
  const dsl = daysSinceLastLti(data, today);
  const lti = lastLti(data);

  const permits = records(data, 'permits');
  const active = permits.filter((p) => p.status === 'active');
  const activeExpired = active.filter((p) => permitExpired(p, today));
  const incidents = records(data, 'incidents');
  const openIncidents = incidents.filter((i) => i.status !== 'closed');
  const actionsOverdue = incidents.filter((i) => i.status === 'actions' && !i.values.actionsComplete && str(i, 'actionDue') && str(i, 'actionDue') < today);
  const equipment = records(data, 'equipment');
  const serviceOverdue = equipment.filter((e) => serviceState(e) === 'overdue');
  const down = equipment.filter((e) => str(e, 'availability') === 'down');
  const wos = records(data, 'workorders');
  const woLate = wos.filter((w) => ['raised', 'planned'].includes(w.status ?? '') && str(w, 'plannedDate') && str(w, 'plannedDate') < today);
  const contractors = records(data, 'contractors');
  const notCleared = contractors.filter((c) => !contractorClearance(c, today).cleared);
  const shifts = records(data, 'shifts');
  const awaiting = shifts.filter((s) => s.status === 'submitted');
  const envOpen = records(data, 'envreadings').filter((r) => r.status === 'recorded' && envExceedance(r));

  const chart = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => {
    const p = productionOn(data, d);
    return { label: shortDate(d), value: p.tonnes, alt: p.target };
  });

  type Item = { to: string; title: string; sub: string; tone: Tone; mod: string };
  const attention: Item[] = [
    ...activeExpired.map((p) => ({ to: `permits/${p.id}`, title: `${p.ref} still active past expiry`, sub: `${str(p, 'description')} · expired ${formatDate(str(p, 'validTo'))} ${str(p, 'expiresAt')}`, tone: 'red' as const, mod: 'permits' })),
    ...actionsOverdue.map((i) => ({ to: `incidents/${i.id}`, title: `${i.ref} corrective actions overdue`, sub: `${str(i, 'title')} · due ${formatDate(str(i, 'actionDue'))}`, tone: 'red' as const, mod: 'incidents' })),
    ...incidents.filter((i) => i.status === 'reported').map((i) => ({ to: `incidents/${i.id}`, title: `${i.ref} awaiting investigation`, sub: str(i, 'title'), tone: 'amber' as const, mod: 'incidents' })),
    ...serviceOverdue.map((e) => ({ to: `equipment/${e.id}`, title: `${str(e, 'fleetNo')} service overdue by ${Math.abs(hoursToService(e))} h`, sub: equipmentLabel(e), tone: 'red' as const, mod: 'equipment' })),
    ...down.map((e) => ({ to: `equipment/${e.id}`, title: `${str(e, 'fleetNo')} down for repair`, sub: equipmentLabel(e), tone: 'amber' as const, mod: 'equipment' })),
    ...notCleared.map((c) => ({ to: `contractors/${c.id}`, title: `${contractorName(c)} not cleared for site`, sub: `${str(c, 'company')} · ${contractorClearance(c, today).reasons.join('; ')}`, tone: 'red' as const, mod: 'contractors' })),
    ...envOpen.map((r) => ({ to: `environment/${r.id}`, title: `${r.ref} exceedance awaiting review`, sub: envExceedance(r) ?? '', tone: 'amber' as const, mod: 'environment' })),
    ...awaiting.map((s) => ({ to: `production/${s.id}`, title: `${s.ref} awaiting verification`, sub: `${formatDate(str(s, 'date'))} · ${str(s, 'crew')}`, tone: 'blue' as const, mod: 'production' })),
  ].filter((a) => hasModule(a.mod));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Kgotso Shaft`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={`${formatDate(today)} · mine overview built from the live demo records.`}
        actions={hasModule('production') ? <Link className="btn primary" to={`${base}/production`}>Open shift log</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">Kgotso Shaft today</div>
          <h2>{tonnes(mtd.tonnes)} hoisted month to date · {mtd.pct}% of plan</h2>
          <p>
            {dsl === null ? 'No lost-time injury on record.' : `${dsl} days since the last lost-time injury.`} {active.length} permit{active.length === 1 ? '' : 's'} active
            {activeExpired.length ? ` (${activeExpired.length} past expiry)` : ''}, {down.length} machine{down.length === 1 ? '' : 's'} down, {notCleared.length} contractor{notCleared.length === 1 ? '' : 's'} not cleared for site.
          </p>
        </div>
        {hasModule('incidents') && <Link className="btn" to={`${base}/incidents`}>{openIncidents.length} open incidents →</Link>}
      </div>
      <div className="stat-grid">
        <Stat label="Tonnes today" value={tonnes(todayProd.tonnes)} sub={`target ${tonnes(todayProd.target)} · yesterday ${tonnes(yesterday.tonnes)} (${yesterday.pct}%)`} />
        <Stat label="Month to date vs plan" value={`${mtd.pct}%`} tone={mtd.pct < 90 ? 'red' : 'accent'} sub={`${tonnes(mtd.tonnes)} of ${tonnes(mtd.target)}`} />
        <Stat label="Days since last LTI" value={dsl ?? '—'} tone={dsl !== null && dsl < 30 ? 'red' : 'accent'} sub={lti ? `${lti.ref} · ${formatDate(str(lti, 'date'))}` : 'No LTI recorded'} />
        <Stat label="Active permits" value={active.length} tone={activeExpired.length ? 'red' : undefined} sub={`${activeExpired.length} past expiry · ${permits.filter((p) => p.status === 'approved').length} approved, not yet active`} />
      </div>
      <div className="section-gap" />
      <div className="stat-grid">
        <Stat label="Open incidents" value={openIncidents.length} tone={actionsOverdue.length ? 'red' : undefined} sub={`${actionsOverdue.length} with overdue actions · ${incidents.filter((i) => str(i, 'type') === 'nearmiss' && daysBetween(str(i, 'date'), today) <= 30).length} near misses in 30 days`} />
        <Stat label="Overdue maintenance" value={serviceOverdue.length + woLate.length} tone={serviceOverdue.length ? 'red' : undefined} sub={`${serviceOverdue.length} services overdue · ${woLate.length} work orders past planned date`} />
        <Stat label="Contractors not cleared" value={notCleared.length} tone={notCleared.length ? 'red' : undefined} sub={`of ${contractors.length} on the register`} />
        <Stat label="Shifts awaiting verification" value={awaiting.length} sub={`${shifts.filter((s) => s.status === 'open').length} shift log(s) still open`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Production — last 14 days" meta="Tonnes hoisted (accent) vs planned tonnes (dark), all sections">
          <BarChart label="Daily tonnes hoisted vs plan, last 14 days" data={chart} alt="Plan" format={(n) => tonnes(n)} />
        </Panel>
        <Panel title="Month to date by section" meta="Tonnes hoisted against plan">
          <Meters format={(n) => tonnes(n)} items={sections.map((s) => ({ label: `${s.label} · ${s.pct}%`, value: s.tonnes, max: s.target, tone: pctTone(s.pct) }))} />
        </Panel>
      </div>
      <div className="grid-2">
        <Panel title="Needs attention" meta="Rules: permit expiry, overdue actions, service hours, contractor clearance, exceedances, verification">
          {attention.length ? (
            <ul className="list" data-testid="attention-list">
              {attention.slice(0, 10).map((a) => (
                <li key={a.to + a.title}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
              ))}
            </ul>
          ) : <Empty title="Nothing needs attention" />}
          {attention.length > 10 && <p className="muted-note" style={{ marginTop: 10 }}>+ {attention.length - 10} more items</p>}
        </Panel>
        <div className="stack">
          {hasModule('permits') && (
            <Panel title="Permits to work" meta="Permits by stage" right={<Link className="btn sm" to={`${base}/permits`}>Permit board</Link>}>
              <Pipeline stages={permitsDef.workflow!.states.filter((s) => !s.terminal).map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: permits.filter((p) => p.status === s.key).length }))} />
            </Panel>
          )}
          <Panel title="Recent activity" meta="Actions taken in this browser">
            {data.activity.length ? (
              <ul className="list">
                {data.activity.slice(0, 6).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
              </ul>
            ) : <Empty title="No activity yet" body="Submit a shift, activate a permit or complete a work order — actions appear here." />}
          </Panel>
        </div>
      </div>
      <RoleBar />
    </>
  );
}
