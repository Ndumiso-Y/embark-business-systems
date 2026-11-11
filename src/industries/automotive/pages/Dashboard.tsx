import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { lines, num, records, str } from '../../../core/engine';
import { formatDate, monthShort, relativeWhen } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { BarChart, Empty, Meters, PageHeader, Panel, Pipeline, Stat, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { BAYS, DAY_HOURS } from '../data';
import {
  IN_WORKSHOP, ageDays, ageLabel, customerName, jobEstimate, hoursBy, invoiceBalance, invoiceOverdue, lastMonths, plannedOn, serviceDue, splitTotals, todayStr, utilisation, vehicleCustomer, vehicleLabel,
} from '../helpers';

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const jobsDef = config.collections.find((c) => c.key === 'jobs')!;

  const jobs = records(data, 'jobs');
  const inWorkshop = jobs.filter((j) => IN_WORKSHOP.includes(j.status ?? ''));
  const awaiting = jobs.filter((j) => j.status === 'approval').map((j) => {
    const est = jobEstimate(data, j);
    return { j, est, age: ageDays(str(est, 'sentOn'), today) };
  }).sort((a, b) => b.age - a.age);
  const ready = jobs.filter((j) => j.status === 'ready');
  const todays = plannedOn(data, today);
  const bookedToday = todays.filter((j) => j.status === 'booked');
  const lateJobs = jobs.filter((j) => !['ready', 'collected', 'cancelled'].includes(j.status ?? '') && str(j, 'promisedDate') && str(j, 'promisedDate') < today);
  const invoices = records(data, 'invoices');
  const unpaid = invoices.filter((i) => ['issued', 'partpaid'].includes(i.status ?? ''));
  const unpaidValue = unpaid.reduce((n, i) => n + invoiceBalance(i), 0);
  const overdue = unpaid.filter((i) => invoiceOverdue(i, today));
  const lowStock = records(data, 'parts').filter((p) => num(p, 'qty') <= num(p, 'reorderLevel'));
  const serviceOverdue = records(data, 'vehicles').filter((v) => serviceDue(v, today).state === 'overdue');
  const bayHours = hoursBy(data, today, 'bay');
  const totalHours = Object.values(bayHours).reduce((a, b) => a + b, 0);

  const months = lastMonths(today, 4);
  const chart = months.map((m) => {
    const s = invoices.filter((i) => i.status !== 'void' && str(i, 'issuedOn').startsWith(m)).map((i) => splitTotals(lines(i)));
    return { label: monthShort(m), value: s.reduce((n, x) => n + x.labour, 0) / 100, alt: s.reduce((n, x) => n + x.parts, 0) / 100 };
  });

  const attention = [
    ...awaiting.filter((a) => a.age >= 2).map((a) => ({ to: `jobs/${a.j.id}`, title: `${a.j.ref} waiting ${ageLabel(a.age)} for approval`, sub: `${vehicleLabel(data, a.j.values.vehicle)} · chase ${str(vehicleCustomer(data, a.j.values.vehicle), 'name')}`, tone: 'amber' as const, mod: 'jobs' })),
    ...lateJobs.map((j) => ({ to: `jobs/${j.id}`, title: `${j.ref} past promised date`, sub: `${vehicleLabel(data, j.values.vehicle)} · promised ${formatDate(str(j, 'promisedDate'))}`, tone: 'red' as const, mod: 'jobs' })),
    ...jobs.filter((j) => j.status === 'qc').map((j) => ({ to: `jobs/${j.id}`, title: `${j.ref} waiting for quality check`, sub: vehicleLabel(data, j.values.vehicle), tone: 'blue' as const, mod: 'jobs' })),
    ...overdue.map((i) => ({ to: `invoices/${i.id}`, title: `Invoice ${i.ref} overdue — ${formatRand(invoiceBalance(i))}`, sub: `${customerName(data, i.values.customer)} · issued ${formatDate(str(i, 'issuedOn'))}`, tone: 'red' as const, mod: 'invoices' })),
    ...lowStock.slice(0, 4).map((p) => ({ to: `parts/${p.id}`, title: `${str(p, 'description')} — ${num(p, 'qty')} left`, sub: `${str(p, 'partNo')} · reorder at ${num(p, 'reorderLevel')}`, tone: num(p, 'qty') <= 0 ? 'red' as const : 'amber' as const, mod: 'parts' })),
  ].filter((a) => hasModule(a.mod));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={`${formatDate(today)} · workshop overview built from the live demo records.`}
        actions={hasModule('jobs') ? <Link className="btn primary" to={`${base}/jobs`}>Open workshop board</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">Today in the workshop</div>
          <h2>{inWorkshop.length} vehicles on site · {totalHours} h booked across {BAYS.length} bays</h2>
          <p>{bookedToday.length} still to arrive, {awaiting.length} waiting on customer approval, {ready.length} ready for collection. Work only starts once a customer has approved the estimate.</p>
        </div>
        {hasModule('planner') && <Link className="btn" to={`${base}/planner`}>Bay planner →</Link>}
      </div>
      <div className="stat-grid">
        <Stat label="In the workshop" value={inWorkshop.length} sub={`${jobs.filter((j) => j.status === 'inprogress').length} being worked on · ${jobs.filter((j) => j.status === 'qc').length} in QC`} />
        <Stat label="Awaiting customer approval" value={awaiting.length} tone={awaiting.some((a) => a.age >= 2) ? 'red' : undefined} sub={awaiting.length ? `Oldest ${ageLabel(awaiting[0].age)}` : 'None waiting'} />
        <Stat label="Ready for collection" value={ready.length} tone="accent" sub={`${ready.filter((j) => { const c = vehicleCustomer(data, j.values.vehicle); return str(c, 'kind') !== 'account'; }).length} private — pay before release`} />
        <Stat label="Unpaid invoices" value={formatRand(unpaidValue, { compact: true })} tone={overdue.length ? 'red' : undefined} sub={`${unpaid.length} open · ${overdue.length} overdue`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <div className="stack">
          <Panel title="Jobs by stage" meta="Live from the workshop board" right={hasModule('jobs') ? <Link className="btn sm" to={`${base}/jobs`}>Board</Link> : undefined}>
            <Pipeline stages={jobsDef.workflow!.states.filter((s) => !s.terminal).map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: jobs.filter((j) => j.status === s.key).length }))} />
          </Panel>
          <Panel title="Awaiting customer approval" meta="Estimates sent, no reply yet">
            {awaiting.length ? (
              <ul className="list" data-testid="awaiting-list">
                {awaiting.map(({ j, est, age }) => (
                  <li key={j.id}>
                    <div className="grow">
                      {hasModule('jobs') ? <Link to={`${base}/jobs/${j.id}`}><b>{vehicleLabel(data, j.values.vehicle)}</b></Link> : <b>{vehicleLabel(data, j.values.vehicle)}</b>}
                      <small>{j.ref} · {str(vehicleCustomer(data, j.values.vehicle), 'name')}{est ? ` · ${est.ref}` : ''}</small>
                    </div>
                    <Tag tone={age >= 2 ? 'red' : age >= 1 ? 'amber' : 'blue'}>{age <= 0 ? 'Sent today' : `Waiting ${ageLabel(age)}`}</Tag>
                  </li>
                ))}
              </ul>
            ) : <Empty title="No estimates waiting" />}
          </Panel>
          <Panel title="Ready for collection">
            {ready.length ? (
              <ul className="list" data-testid="ready-list">
                {ready.map((j) => {
                  const c = vehicleCustomer(data, j.values.vehicle);
                  return (
                    <li key={j.id}>
                      <div className="grow">
                        {hasModule('jobs') ? <Link to={`${base}/jobs/${j.id}`}><b>{vehicleLabel(data, j.values.vehicle)}</b></Link> : <b>{vehicleLabel(data, j.values.vehicle)}</b>}
                        <small>{j.ref} · {str(c, 'name')} · {str(c, 'phone')}</small>
                      </div>
                      <Tag tone={str(c, 'kind') === 'account' ? 'dark' : 'accent'}>{str(c, 'kind') === 'account' ? 'Account' : 'Pay on collection'}</Tag>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty title="Nothing waiting for collection" />}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Needs attention" meta="Rules: approval age, promised dates, QC queue, overdue invoices, stock levels">
            {attention.length ? (
              <ul className="list" data-testid="attention-list">
                {attention.slice(0, 9).map((a) => (
                  <li key={a.to + a.title}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
                ))}
              </ul>
            ) : <Empty title="Nothing needs attention" />}
          </Panel>
          <Panel title="Bay utilisation today" meta={`Hours booked vs ${DAY_HOURS} h per bay`} right={hasModule('planner') ? <Link className="btn sm" to={`${base}/planner`}>Planner</Link> : undefined}>
            <Meters format={(n) => `${n} h`} items={BAYS.map((b) => {
              const h = bayHours[b.value] ?? 0;
              return { label: b.label, value: h, max: DAY_HOURS, tone: h > DAY_HOURS ? 'red' : h >= DAY_HOURS * 0.6 ? 'green' : 'amber', sub: `${utilisation(h)}% · ${todays.filter((j) => str(j, 'bay') === b.value).length} job cards` };
            })} />
          </Panel>
          {hasModule('parts') && (
            <Panel title="Low stock" meta={`${lowStock.length} part(s) at or below reorder level`} right={<Link className="btn sm" to={`${base}/parts`}>Parts</Link>}>
              {lowStock.length ? (
                <ul className="list">
                  {lowStock.slice(0, 5).map((p) => <li key={p.id}><div className="grow"><b>{str(p, 'description')}</b><small>{str(p, 'partNo')} · bin {str(p, 'bin')}</small></div><Tag tone={num(p, 'qty') <= 0 ? 'red' : 'amber'}>{num(p, 'qty')} left</Tag></li>)}
                </ul>
              ) : <Empty title="Stock levels healthy" />}
            </Panel>
          )}
        </div>
      </div>
      <div className="grid-2">
        <Panel title="Revenue" meta="Invoiced per month, excl. VAT · labour (accent) vs parts (dark)">
          <BarChart label="Labour and parts revenue per month" data={chart} alt="Parts" format={(n) => formatRand(Math.round(n * 100), { compact: true })} />
          {hasModule('reminders') && <p className="muted-note" style={{ marginTop: 10 }}><Link to={`${base}/reminders`}>{serviceOverdue.length} vehicles are overdue for a service</Link> — log reminders from the service reminders list.</p>}
        </Panel>
        <Panel title="Recent activity" meta="Actions taken in this browser">
          {data.activity.length ? (
            <ul className="list">
              {data.activity.slice(0, 7).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
            </ul>
          ) : <Empty title="No activity yet" body="Check a vehicle in, approve an estimate or pass a quality check — actions appear here." />}
        </Panel>
      </div>
      <RoleBar />
    </>
  );
}

