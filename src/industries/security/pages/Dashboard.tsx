import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate, relativeWhen } from '../../../core/lib/dates';
import { BarChart, Empty, Meters, Notice, PageHeader, Panel, Stat, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import type { Tone } from '../../../core/types';
import { DEFAULT_SLA_MIN, INSPECTION_INTERVAL_DAYS, SEVERITIES, SHIFT_SHORT, SIGNALS, label } from '../data';
import {
  ACTIVE_CALLOUT, coverageNow, dailyCoverage, daysSinceInspection, equipmentLabel, fullName, inspectionOverdue, invoiceOverdue, lateBookOn,
  notReturned, officerExpiries, officerName, permitExpired, postLabel, responseStats, sapsProblem, shiftTitle, siteName, slaState,
} from '../helpers';
import { pctTone, shortDate, useClock } from './format';

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const { today } = useClock();

  const cover = coverageNow(data, today);
  const roster = records(data, 'roster');
  const late = roster.filter((r) => lateBookOn(data, r, today) && daysBetween(str(r, 'date'), today) <= 1);
  const incidents = records(data, 'incidents');
  const open = incidents.filter((i) => i.status !== 'closed');
  const sev = (s: string) => open.filter((i) => str(i, 'severity') === s).length;
  const callouts = records(data, 'callouts');
  const active = callouts.filter((c) => ACTIVE_CALLOUT.includes(c.status ?? ''));
  const awaiting = active.filter((c) => c.status === 'received');
  const stats = responseStats(data, addDays(today, -30), today);
  const officers = records(data, 'officers');
  const expiring = officers.flatMap((o) => officerExpiries(o, today).filter((e) => (e.key === 'psiraExpiry' || e.key === 'competencyExpiry') && (e.state === 'overdue' || e.state === 'due-soon')).map((e) => ({ o, e })));
  const expired = expiring.filter((x) => x.e.state === 'overdue');
  const sites = records(data, 'sites');
  const overdueSites = sites.filter((s) => inspectionOverdue(data, s.id, today));
  const equipment = records(data, 'equipment');
  const outstanding = equipment.filter((e) => notReturned(data, e, today));
  const permits = equipment.filter((e) => e.status !== 'lost' && permitExpired(e, today));
  const actionsOverdue = records(data, 'actions').filter((a) => a.status === 'open' && str(a, 'due') < today);
  const invoicesOverdue = records(data, 'invoices').filter((i) => invoiceOverdue(i, today));

  const chart = Array.from({ length: 14 }, (_, i) => addDays(today, i - 14)).map((d) => ({ label: shortDate(d), value: dailyCoverage(data, d).pct }));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = addDays(today, -7 * (7 - i));
    const start = addDays(end, -6);
    return { label: shortDate(start), value: incidents.filter((x) => str(x, 'date') >= start && str(x, 'date') <= end).length };
  });

  type Item = { to: string; title: string; sub: string; tone: Tone; mod: string };
  const attention: Item[] = [
    ...awaiting.map((c) => ({ to: `callouts/${c.id}`, title: `${c.ref} awaiting dispatch`, sub: `${siteName(data, c.values.site)} · ${label(SIGNALS, str(c, 'signal'))} received ${str(c, 'receivedAt')} · due on scene by ${slaState(data, c).dueBy}`, tone: 'red' as const, mod: 'callouts' })),
    ...active.filter((c) => slaState(data, c).state === 'breached').map((c) => ({ to: `callouts/${c.id}`, title: `${c.ref} arrived outside the response SLA`, sub: `${siteName(data, c.values.site)} · ${slaState(data, c).minutes} min against ${slaState(data, c).sla}`, tone: 'red' as const, mod: 'callouts' })),
    ...cover.unfilled.slice(0, 4).map((u) => ({ to: u.shift ? `roster/${u.shift.id}` : 'roster', title: `Unfilled now: ${postLabel(data, u.post)}`, sub: `${u.reason} · ${SHIFT_SHORT[cover.slot.kind]} shift`, tone: 'red' as const, mod: 'roster' })),
    ...late.map((r) => ({ to: `roster/${r.id}`, title: `${officerName(data, r.values.reliefOfficer || r.values.officer)} has not booked on`, sub: shiftTitle(data, r), tone: 'amber' as const, mod: 'roster' })),
    ...open.filter((i) => sapsProblem(i)).map((i) => ({ to: `incidents/${i.id}`, title: `${i.ref} serious incident without a SAPS case number`, sub: `${str(i, 'title')} · ${siteName(data, i.values.site)}`, tone: 'red' as const, mod: 'incidents' })),
    ...open.filter((i) => i.status === 'reported').map((i) => ({ to: `incidents/${i.id}`, title: `${i.ref} reported — no response logged`, sub: `${str(i, 'title')} · ${siteName(data, i.values.site)}`, tone: 'amber' as const, mod: 'incidents' })),
    ...outstanding.map((e) => ({ to: `equipment/${e.id}`, title: `${str(e, 'assetNo')} not returned after shift end`, sub: `${equipmentLabel(e)} · issued to ${officerName(data, e.values.issuedTo)}`, tone: 'red' as const, mod: 'equipment' })),
    ...permits.map((e) => ({ to: `equipment/${e.id}`, title: `${str(e, 'assetNo')} licence expired`, sub: `${equipmentLabel(e)} · expired ${formatDate(str(e, 'permitExpiry'))}`, tone: 'red' as const, mod: 'equipment' })),
    ...expired.map(({ o, e }) => ({ to: `officers/${o.id}`, title: `${fullName(o)} — ${e.label} expired`, sub: `Expired ${formatDate(e.date)} · Grade ${str(o, 'grade')}`, tone: 'red' as const, mod: 'officers' })),
    ...overdueSites.map((s) => ({ to: `sites/${s.id}`, title: `${str(s, 'name')} overdue for inspection`, sub: `Last inspected ${daysSinceInspection(data, s.id, today) ?? '—'} days ago (target every ${INSPECTION_INTERVAL_DAYS} days)`, tone: 'amber' as const, mod: 'sites' })),
    ...actionsOverdue.map((a) => ({ to: `sites/${str(a, 'site')}`, title: `${a.ref} corrective action overdue`, sub: `${siteName(data, a.values.site)} · due ${formatDate(str(a, 'due'))}`, tone: 'amber' as const, mod: 'sites' })),
    ...invoicesOverdue.map((i) => ({ to: `invoices/${i.id}`, title: `${i.ref} overdue for payment`, sub: `Due ${formatDate(str(i, 'dueDate'))}`, tone: 'amber' as const, mod: 'invoices' })),
  ].filter((a) => hasModule(a.mod));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Control room`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={`${formatDate(today)} · control room overview built from the live demo records.`}
        actions={hasModule('roster') ? <Link className="btn primary" to={`${base}/roster`}>Open duty roster</Link> : undefined} />
      {cover.covered === 0 && cover.posts > 0 && (
        <Notice tone="amber">The demo roster only runs three days ahead of the day it was seeded, so nobody is rostered for the shift running now. Open <Link to={`${base}/settings`}>Settings &amp; reset</Link> to re-seed the demo around today.</Notice>
      )}
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">{SHIFT_SHORT[cover.slot.kind]} shift · {formatDate(cover.slot.date)}</div>
          <h2>{cover.covered}/{cover.posts} posts covered now · {cover.onDuty} officer{cover.onDuty === 1 ? '' : 's'} booked on</h2>
          <p>
            {cover.unfilled.length ? `${cover.unfilled.length} post${cover.unfilled.length === 1 ? ' is' : 's are'} unfilled.` : 'Every contracted post is filled.'} {active.length} armed response call-out{active.length === 1 ? '' : 's'} active,
            {' '}{open.length} incident{open.length === 1 ? '' : 's'} open, {outstanding.length} equipment item{outstanding.length === 1 ? '' : 's'} not returned from an earlier shift.
          </p>
        </div>
        {hasModule('callouts') && <Link className="btn" to={`${base}/callouts`}>{active.length} active call-out{active.length === 1 ? '' : 's'} →</Link>}
      </div>
      <div className="stat-grid">
        <Stat label="Posts covered now" value={`${cover.covered}/${cover.posts}`} tone={cover.unfilled.length ? 'red' : 'accent'} sub={`${cover.pct}% coverage · ${cover.unfilled.length} unfilled`} />
        <Stat label="Officers on duty" value={cover.onDuty} sub={`${late.length} posted but not booked on`} />
        <Stat label="Open incidents" value={open.length} tone={sev('high') ? 'red' : undefined} sub={SEVERITIES.map((s) => `${sev(s.value)} ${s.value}`).join(' · ')} />
        <Stat label="Active call-outs" value={active.length} tone={awaiting.length ? 'red' : undefined}
          sub={active.length ? `${awaiting.length} awaiting dispatch · ${active.filter((c) => c.status === 'dispatched').length} en route · ${active.filter((c) => c.status === 'onscene').length} on scene` : 'no vehicle committed'} />
      </div>
      <div className="section-gap" />
      <div className="stat-grid">
        <Stat label="Avg response (30 days)" value={stats.count ? `${stats.avg} min` : '—'} tone={stats.avg > DEFAULT_SLA_MIN ? 'red' : 'accent'} sub={`${stats.pct}% of ${stats.count} call-outs within SLA (${DEFAULT_SLA_MIN} min unless contracted otherwise)`} />
        <Stat label="Compliance expiring" value={expiring.length} tone={expired.length ? 'red' : undefined} sub={`${expired.length} expired · PSIRA and firearm competency, next 30 days`} />
        <Stat label="Sites overdue for inspection" value={overdueSites.length} tone={overdueSites.length ? 'red' : undefined} sub={`of ${sites.length} sites · target every ${INSPECTION_INTERVAL_DAYS} days`} />
        <Stat label="Equipment not returned" value={outstanding.length} tone={outstanding.length ? 'red' : undefined} sub={`${equipment.filter((e) => e.status === 'issued').length} items issued right now`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Coverage — last 14 days" meta="% of contracted day and night posts with an officer who reported for duty">
          <BarChart label="Daily post coverage percentage, last 14 days" data={chart} format={(n) => `${n}%`} />
        </Panel>
        <Panel title="Unfilled posts now" meta={`${SHIFT_SHORT[cover.slot.kind]} shift — posts without an officer`} right={<Tag tone={pctTone(cover.pct)}>{cover.pct}%</Tag>}>
          {cover.unfilled.length ? (
            <ul className="list" data-testid="unfilled-list">
              {cover.unfilled.slice(0, 8).map((u) => (
                <li key={u.post.id}>
                  <span className="dot red" />
                  <div className="grow">
                    {u.shift && hasModule('roster') ? <Link to={`${base}/roster/${u.shift.id}`}><b>{postLabel(data, u.post)}</b></Link> : <b>{postLabel(data, u.post)}</b>}
                    <small>{u.reason} · Grade {str(u.post, 'grade')}{u.post.values.armed === true ? ' · armed' : ''}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty title="All posts covered" />}
          {cover.unfilled.length > 8 && <p className="muted-note" style={{ marginTop: 10 }}>+ {cover.unfilled.length - 8} more unfilled posts</p>}
        </Panel>
      </div>
      <div className="grid-2">
        <Panel title="Needs attention" meta="Rules: SLA, unfilled posts, book-on, SAPS numbers, equipment returns, licences, registrations, inspections">
          {attention.length ? (
            <ul className="list" data-testid="attention-list">
              {attention.slice(0, 12).map((a) => (
                <li key={a.to + a.title}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
              ))}
            </ul>
          ) : <Empty title="Nothing needs attention" />}
          {attention.length > 12 && <p className="muted-note" style={{ marginTop: 10 }}>+ {attention.length - 12} more items</p>}
        </Panel>
        <div className="stack">
          <Panel title="Active call-outs" meta="Signal time, progress and the time the vehicle is due on scene" right={hasModule('callouts') ? <Link className="btn sm" to={`${base}/callouts`}>Armed response</Link> : undefined}>
            {active.length ? (
              <ul className="list" data-testid="active-callouts">
                {active.map((c) => {
                  const s = slaState(data, c);
                  return (
                    <li key={c.id}>
                      <span className="time-chip">{str(c, 'receivedAt')}</span>
                      <div className="grow">
                        {hasModule('callouts') ? <Link to={`${base}/callouts/${c.id}`}><b>{siteName(data, c.values.site)}</b></Link> : <b>{siteName(data, c.values.site)}</b>}
                        <small>{label(SIGNALS, str(c, 'signal'))} · {c.status === 'onscene' ? `dispatched ${str(c, 'dispatchedAt')}, on scene ${str(c, 'onSceneAt')}` : `due on scene by ${s.dueBy} (${s.sla}-min SLA)`}</small>
                      </div>
                      <Tag tone={s.state === 'breached' ? 'red' : c.status === 'onscene' ? 'blue' : 'amber'}>{c.status === 'onscene' ? `On scene in ${s.minutes} min` : c.status === 'dispatched' ? 'En route' : 'Awaiting dispatch'}</Tag>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty title="No active call-outs" />}
          </Panel>
          <Panel title="Incidents per week" meta="Last 8 weeks, week starting">
            <Meters items={weeks.map((w) => ({ label: w.label, value: w.value, tone: w.value >= 4 ? 'red' as const : 'accent' as const }))} />
          </Panel>
          <Panel title="Recent activity" meta="Actions taken in this browser">
            {data.activity.length ? (
              <ul className="list">
                {data.activity.slice(0, 6).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
              </ul>
            ) : <Empty title="No activity yet" body="Post an officer, dispatch a vehicle or sign an occurrence book entry — actions appear here." />}
          </Panel>
        </div>
      </div>
      <RoleBar />
    </>
  );
}
