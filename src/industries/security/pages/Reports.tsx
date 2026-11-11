import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { BarChart, DueTag, Empty, Meters, Notice, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { CONTRACT_WINDOW_DAYS, DEFAULT_SLA_MIN, INCIDENT_TYPES, PERMIT_LABEL } from '../data';
import { absenteeism, calloutSla, dailyCoverage, fullName, officerExpiries, pct, responseMinutes, responseStats, siteName } from '../helpers';
import { DAYS_BACK } from '../seed';
import { shortDate, useClock } from './format';

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const { today } = useClock();
  const from = addDays(today, -DAYS_BACK);
  const to = addDays(today, -1);

  const days = Array.from({ length: DAYS_BACK }, (_, i) => addDays(from, i)).map((d) => ({ d, ...dailyCoverage(data, d) }));
  const posts = days.reduce((n, x) => n + x.posts, 0);
  const covered = days.reduce((n, x) => n + x.covered, 0);
  const abs = absenteeism(data, from, to);
  const sites = records(data, 'sites');
  const bySiteCoverage = sites.map((s) => {
    const list = days.map((x) => dailyCoverage(data, x.d, s.id));
    const p = list.reduce((n, x) => n + x.posts, 0);
    const c = list.reduce((n, x) => n + x.covered, 0);
    return { label: str(s, 'name'), value: pct(c, p), sub: `${p - c} unfilled shift${p - c === 1 ? '' : 's'} of ${p}`, tone: p - c === 0 ? 'green' as const : p - c <= 2 ? 'amber' as const : 'red' as const };
  }).sort((a, b) => a.value - b.value);

  const incidents = records(data, 'incidents').filter((i) => str(i, 'date') >= addDays(today, -60));
  const byType = INCIDENT_TYPES.map((t) => ({ label: t.label, value: incidents.filter((i) => str(i, 'type') === t.value).length, tone: incidents.some((i) => str(i, 'type') === t.value && str(i, 'severity') === 'high') ? 'red' as const : 'accent' as const }))
    .filter((x) => x.value).sort((a, b) => b.value - a.value);
  const bySite = sites.map((s) => ({ label: str(s, 'name'), value: incidents.filter((i) => str(i, 'site') === s.id).length, sub: `${incidents.filter((i) => str(i, 'site') === s.id && i.status !== 'closed').length} open` }))
    .filter((x) => x.value).sort((a, b) => b.value - a.value);

  const stats = responseStats(data, addDays(today, -30), today);
  const done = records(data, 'callouts').filter((c) => str(c, 'date') >= addDays(today, -30) && responseMinutes(c) !== null).sort((a, b) => str(a, 'date').localeCompare(str(b, 'date')) || str(a, 'receivedAt').localeCompare(str(b, 'receivedAt')));
  const slow = done.filter((c) => (responseMinutes(c) ?? 0) > calloutSla(data, c));

  type Row = { key: string; who: string; to: string; what: string; date: string; state: 'overdue' | 'due-soon' };
  const expiries: Row[] = [
    ...records(data, 'officers').flatMap((o) => officerExpiries(o, today).filter((e) => e.state === 'overdue' || e.state === 'due-soon')
      .map((e) => ({ key: o.id + e.key, who: `${fullName(o)} · Grade ${str(o, 'grade')}`, to: `officers/${o.id}`, what: e.label, date: e.date, state: e.state as 'overdue' | 'due-soon' }))),
    ...records(data, 'equipment').filter((e) => e.status !== 'lost' && str(e, 'permitExpiry') && daysBetween(today, str(e, 'permitExpiry')) <= 30)
      .map((e) => ({ key: e.id, who: `${str(e, 'assetNo')} · ${str(e, 'description').split(' (')[0]}`, to: `equipment/${e.id}`, what: PERMIT_LABEL[str(e, 'category')] ?? 'Permit', date: str(e, 'permitExpiry'), state: str(e, 'permitExpiry') < today ? 'overdue' as const : 'due-soon' as const })),
    ...records(data, 'contracts').filter((c) => daysBetween(today, str(c, 'endDate')) <= CONTRACT_WINDOW_DAYS)
      .map((c) => ({ key: c.id, who: str(c, 'client'), to: `contracts/${c.id}`, what: 'Client contract end', date: str(c, 'endDate'), state: str(c, 'endDate') < today ? 'overdue' as const : 'due-soon' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Commercial`} title="Reports" subtitle={`Computed from the demo records: roster figures cover the last ${DAYS_BACK} days, incidents 60 days, response times 30 days. Figures are fictional and change as you use the demo.`} />
      <div className="stat-grid">
        <Stat label={`Coverage (${DAYS_BACK} days)`} value={`${pct(covered, posts)}%`} tone={pct(covered, posts) < 98 ? 'red' : 'accent'} sub={`${posts - covered} unfilled of ${posts} contracted shifts`} />
        <Stat label="Absenteeism" value={`${abs.pct}%`} sub={`${abs.absent} absences · ${abs.relieved} covered by relief`} />
        <Stat label="Incidents (60 days)" value={incidents.length} tone={incidents.some((i) => str(i, 'severity') === 'high' && i.status !== 'closed') ? 'red' : undefined} sub={`${incidents.filter((i) => str(i, 'severity') === 'high').length} serious · ${incidents.filter((i) => i.status !== 'closed').length} open`} />
        <Stat label="Avg response (30 days)" value={stats.count ? `${stats.avg} min` : '—'} tone={stats.avg > DEFAULT_SLA_MIN ? 'red' : 'accent'} sub={`${stats.pct}% within SLA · ${stats.breaches} breach${stats.breaches === 1 ? '' : 'es'}`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Coverage % per day" meta="Contracted day and night posts with an officer who reported for duty">
          <BarChart label="Daily coverage percentage" data={days.map((x) => ({ label: shortDate(x.d), value: x.pct }))} format={(n) => `${n}%`} />
        </Panel>
        <Panel title="Coverage by site" meta="Lowest first">
          <Meters format={(n) => `${n}%`} items={bySiteCoverage.slice(0, 7).map((x) => ({ ...x, max: 100 }))} />
        </Panel>
      </div>
      <div className="grid-3">
        <Panel title="Incidents by type" meta="Last 60 days">
          {byType.length ? <Meters items={byType} /> : <Empty title="No incidents" />}
        </Panel>
        <Panel title="Incidents by site" meta="Last 60 days">
          {bySite.length ? <Meters items={bySite.slice(0, 8)} /> : <Empty title="No incidents" />}
        </Panel>
        <Panel title="Absences" meta={`Last ${DAYS_BACK} days — rostered officer did not report`}>
          {abs.list.length ? (
            <ul className="list">
              {abs.list.slice(-6).reverse().map((r) => (
                <li key={r.id}><span className={`dot ${r.status === 'absent' ? 'red' : 'amber'}`} /><div className="grow"><b>{fullName(records(data, 'officers').find((o) => o.id === r.values.officer))}</b><small>{formatDate(str(r, 'date'))} · {r.status === 'absent' ? 'post left unfilled' : 'covered by relief'}</small></div></li>
              ))}
            </ul>
          ) : <Empty title="No absences recorded" />}
        </Panel>
      </div>
      <div className="grid-2">
        <Panel title="Armed response times" meta="Minutes from signal to on scene, last 30 days, oldest first">
          {done.length ? <BarChart label="Response time per call-out in minutes" data={done.slice(-16).map((c) => ({ label: `#${Number(c.ref.split('-').pop())}`, value: responseMinutes(c) ?? 0, alt: calloutSla(data, c) }))} alt="SLA" format={(n) => `${n} min`} /> : <Empty title="No completed call-outs" />}
          <p className="muted-note" style={{ marginTop: 8 }}>Accent bar: response time. Dark bar: the contract SLA for that site. Labels are call-out numbers (CO-…).</p>
        </Panel>
        <Panel title="Responses over the SLA" meta={`${slow.length} in the last 30 days`}>
          {slow.length ? (
            <ul className="list" data-testid="sla-breaches">
              {slow.map((c) => (
                <li key={c.id}><span className="time-chip">{responseMinutes(c)} min</span><div className="grow">{hasModule('callouts') ? <Link to={`${base}/callouts/${c.id}`}><b>{siteName(data, c.values.site)}</b></Link> : <b>{siteName(data, c.values.site)}</b>}<small>{c.ref} · {formatDate(str(c, 'date'))} · SLA {calloutSla(data, c)} min</small></div></li>
              ))}
            </ul>
          ) : <Empty title="Every response within the SLA" />}
        </Panel>
      </div>
      <Panel title="Compliance expiries" meta="Officer registration, competency, training and medical dates; firearm and vehicle licences; client contracts — expired or expiring soon">
        {expiries.length ? (
          <div className="table-wrap">
            <table className="table" data-testid="expiry-table">
              <thead><tr><th>Who / what</th><th>Item</th><th>Date</th><th>State</th></tr></thead>
              <tbody>
                {expiries.map((e) => (
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
      <Notice tone="grey">Reports are illustrative and use invented data. They are not PSIRA, firearm-control or contractual compliance reports, and response times are typed in by hand — nothing is measured by a tracking system.</Notice>
    </>
  );
}
