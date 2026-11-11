import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate, monthKeys, monthShort, relativeWhen } from '../../../core/lib/dates';
import { BarChart, Empty, Meters, PageHeader, Panel, Pipeline, Stat } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import type { Tone } from '../../../core/types';
import {
  ACTIVE_PROJECT_STATES, LIVE_PROJECT_STATES, certifiedToDate, completionDue, daysSinceLastLti, deliveryLate, diarySummary, onHire, openCriticalSnags,
  overdueMilestones, plantAlerts, plantCostThisMonth, programmeProgress, projectName, randShort, revisedContractSum, subcontractorCompliance,
  subcontractorExpiries, todayStr,
} from '../helpers';

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const month = today.slice(0, 7);
  const projectsDef = config.collections.find((c) => c.key === 'projects')!;

  const projects = records(data, 'projects');
  const live = projects.filter((p) => LIVE_PROJECT_STATES.includes(p.status ?? ''));
  const tracked = projects.filter((p) => [...ACTIVE_PROJECT_STATES, 'onhold'].includes(p.status ?? ''));
  const revised = live.reduce((n, p) => n + revisedContractSum(data, p), 0);
  const certified = live.reduce((n, p) => n + certifiedToDate(data, p.id), 0);

  const valuations = records(data, 'valuations');
  const awaitingCert = valuations.filter((v) => v.status === 'submitted');
  const variations = records(data, 'variations');
  const pendingVo = variations.filter((v) => v.status === 'submitted');
  const unpriced = variations.filter((v) => v.status === 'instructed');
  const plant = records(data, 'plant');
  const hireMonth = plant.reduce((n, p) => n + plantCostThisMonth(p, today), 0);
  const onHireNow = plant.filter((p) => onHire(p, today));
  const idleHired = onHireNow.filter((p) => str(p, 'state') === 'idle');
  const subs = records(data, 'subcontractors');
  const nonCompliant = subs.filter((s) => !subcontractorCompliance(s, today).ok);
  const expiringSoon = subs.filter((s) => subcontractorExpiries(s, today).some((e) => e.state === 'due-soon'));
  const milestones = overdueMilestones(data, today);
  const diaryMonth = diarySummary(data, undefined, `${month}-01`, today);
  const safety = records(data, 'safety');
  const openSafety = safety.filter((s) => s.status === 'open');
  const dsl = daysSinceLastLti(data, today);
  const critical = openCriticalSnags(data);
  const lateDeliveries = records(data, 'requisitions').filter((r) => deliveryLate(r, today));
  const unsignedDelay = records(data, 'diary').filter((d) => d.status === 'draft' && num(d, 'delayHours') > 0 && !str(d, 'delayCause'));

  const months = monthKeys(today, 6);
  const chart = months.map((m) => ({
    label: monthShort(m),
    value: valuations.filter((v) => ['certified', 'paid'].includes(v.status ?? '') && str(v, 'certifiedOn').startsWith(m)).reduce((n, v) => n + num(v, 'certifiedAmount'), 0),
  }));

  type Item = { to: string; title: string; sub: string; tone: Tone; mod: string };
  const attention: Item[] = [
    ...tracked.filter((p) => p.status === 'onsite' && completionDue(p) && completionDue(p) < today).map((p) => ({ to: `projects/${p.id}`, title: `${str(p, 'name')} past completion date`, sub: `Due ${formatDate(completionDue(p))} incl. EOT`, tone: 'red' as const, mod: 'projects' })),
    ...critical.map((s) => ({ to: `snags/${s.id}`, title: `${s.ref} open critical snag`, sub: `${str(s, 'description')} · ${projectName(data, s.values.project)}`, tone: 'red' as const, mod: 'snags' })),
    ...milestones.map((t) => ({ to: `programme/${t.id}`, title: `${str(t, 'name').replace('Milestone: ', '')} — milestone overdue`, sub: `${projectName(data, t.values.project)} · planned ${formatDate(str(t, 'plannedFinish'))}`, tone: 'red' as const, mod: 'programme' })),
    ...nonCompliant.map((s) => ({ to: `subcontractors/${s.id}`, title: `${str(s, 'company')} not compliant`, sub: subcontractorCompliance(s, today).reasons.join('; '), tone: 'red' as const, mod: 'subcontractors' })),
    ...lateDeliveries.map((r) => ({ to: `procurement/${r.id}`, title: `${r.ref} delivery late`, sub: `${str(r, 'description')} · expected ${formatDate(str(r, 'expectedDelivery'))}`, tone: 'red' as const, mod: 'procurement' })),
    ...plant.flatMap((p) => plantAlerts(p, today).filter((a) => a.tone === 'red' || a.label.startsWith('Hired plant idle')).map((a) => ({ to: `plant/${p.id}`, title: `${str(p, 'fleetNo')}: ${a.label}`, sub: `${str(p, 'description')} · ${projectName(data, p.values.project)}`, tone: a.tone, mod: 'plant' }))),
    ...awaitingCert.map((v) => ({ to: `valuations/${v.id}`, title: `${v.ref} awaiting certificate`, sub: `${projectName(data, v.values.project)} · ${randShort(num(v, 'submittedAmount'))} submitted ${formatDate(str(v, 'submittedOn'))}`, tone: 'amber' as const, mod: 'valuations' })),
    ...unpriced.map((v) => ({ to: `variations/${v.id}`, title: `${v.ref} instructed, not priced`, sub: `${str(v, 'description')} · ${projectName(data, v.values.project)}`, tone: 'amber' as const, mod: 'variations' })),
    ...unsignedDelay.map((d) => ({ to: `diary/${d.id}`, title: `${d.ref} delay without a cause`, sub: `${projectName(data, d.values.project)} · ${formatDate(str(d, 'date'))} · ${num(d, 'delayHours')} h`, tone: 'amber' as const, mod: 'diary' })),
    ...openSafety.filter((s) => str(s, 'severity') === 'high').map((s) => ({ to: `safety/${s.id}`, title: `${s.ref} high-severity safety item open`, sub: str(s, 'title'), tone: 'red' as const, mod: 'safety' })),
  ].filter((a) => hasModule(a.mod));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Projects`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={`${formatDate(today)} · contract overview built from the live demo records.`}
        actions={hasModule('projects') ? <Link className="btn primary" to={`${base}/projects`}>Open projects</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">Order book</div>
          <h2>{randShort(revised)} revised contract value · {randShort(certified)} certified to date</h2>
          <p>
            {tracked.filter((p) => p.status === 'onsite').length} projects on site, {live.filter((p) => p.status === 'onhold').length} on hold, {live.filter((p) => p.status === 'practical').length} at practical completion.{' '}
            {milestones.length} milestone{milestones.length === 1 ? '' : 's'} overdue, {critical.length} open critical snag{critical.length === 1 ? '' : 's'}, {nonCompliant.length} subcontractor{nonCompliant.length === 1 ? '' : 's'} not compliant.
          </p>
        </div>
        {hasModule('programme') && <Link className="btn" to={`${base}/programme`}>Programme →</Link>}
      </div>
      <div className="stat-grid">
        <Stat label="Revised contract value" value={randShort(revised)} tone="accent" sub={`${live.length} live projects incl. approved variations`} />
        <Stat label="Certified to date" value={randShort(certified)} sub={`${revised ? Math.round((certified / revised) * 100) : 0}% of revised value (excl. VAT)`} />
        <Stat label="Valuations awaiting certificate" value={awaitingCert.length} tone={awaitingCert.length ? 'red' : undefined} sub={`${randShort(awaitingCert.reduce((n, v) => n + num(v, 'submittedAmount'), 0))} submitted, excl. VAT`} />
        <Stat label="Variations pending approval" value={randShort(pendingVo.reduce((n, v) => n + num(v, 'value'), 0))} sub={`${pendingVo.length} submitted · ${unpriced.length} not yet priced`} />
      </div>
      <div className="section-gap" />
      <div className="stat-grid">
        <Stat label="Plant hire this month" value={randShort(hireMonth)} sub={`${onHireNow.length} hired items on hire · ${idleHired.length} standing idle`} tone={idleHired.length ? 'red' : undefined} />
        <Stat label="Subcontractor compliance" value={nonCompliant.length} tone={nonCompliant.length ? 'red' : undefined} sub={`not compliant · ${expiringSoon.length} with documents expiring ≤ 30 days`} />
        <Stat label="Overdue milestones" value={milestones.length} tone={milestones.length ? 'red' : undefined} sub={`${records(data, 'tasks').filter((t) => t.values.milestone === true && t.status !== 'complete').length} open milestones`} />
        <Stat label="Rain days this month" value={diaryMonth.rainDays} sub={`site-days from the diary · ${diaryMonth.employerDelayDays} employer-delay days`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Active projects" meta="% of programme complete (bar) against % of contract time elapsed">
          {tracked.length ? (
            <Meters format={(n) => `${n}%`} items={tracked.map((p) => {
              const pr = programmeProgress(data, p, today);
              const gap = pr.elapsed - pr.pct;
              return {
                label: `${str(p, 'name')}${p.status === 'onhold' ? ' (on hold)' : p.status === 'practical' ? ' (practical completion)' : ''}`,
                value: pr.pct, max: 100, tone: gap > 10 ? 'red' as const : gap > 3 ? 'amber' as const : 'green' as const,
                sub: `${pr.pct}% complete · ${pr.elapsed}% of time elapsed · completion ${formatDate(completionDue(p))}`,
              };
            })} />
          ) : <Empty title="No active projects" />}
        </Panel>
        <Panel title="Certified per month" meta="Amounts certified (excl. VAT) by certificate month, last 6 months">
          <BarChart label="Certified value per month, last six months" data={chart} format={(n) => randShort(n)} />
        </Panel>
      </div>
      <div className="grid-2">
        <Panel title="Needs attention" meta="Rules: completion dates, critical snags, milestones, compliance, deliveries, plant, certificates, diary delays">
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
          <Panel title="Projects by stage" right={hasModule('projects') ? <Link className="btn sm" to={`${base}/projects`}>All projects</Link> : undefined}>
            <Pipeline stages={projectsDef.workflow!.states.filter((s) => s.key !== 'lost').map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: projects.filter((p) => p.status === s.key).length }))} />
          </Panel>
          <Panel title="Health & safety" meta="From the safety register" right={hasModule('safety') ? <Link className="btn sm" to={`${base}/safety`}>Register</Link> : undefined}>
            <div className="mini-stat-row">
              <span><b>{dsl ?? '—'}</b> days since last lost-time injury</span>
              <span><b>{openSafety.length}</b> open items</span>
              <span><b>{safety.filter((s) => str(s, 'type') === 'toolbox' && daysBetween(str(s, 'date'), today) <= 30).length}</b> toolbox talks in 30 days</span>
              <span><b>{safety.filter((s) => str(s, 'type') === 'nearmiss' && daysBetween(str(s, 'date'), today) <= 30).length}</b> near misses in 30 days</span>
            </div>
          </Panel>
          <Panel title="Recent activity" meta="Actions taken in this browser">
            {data.activity.length ? (
              <ul className="list">
                {data.activity.slice(0, 6).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
              </ul>
            ) : <Empty title="No activity yet" body="Sign a diary entry, submit a variation or record a certificate — actions appear here." />}
          </Panel>
        </div>
      </div>
      <RoleBar />
    </>
  );
}
