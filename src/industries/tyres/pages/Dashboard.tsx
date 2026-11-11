import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { lines, linesTotals, num, records, str } from '../../../core/engine';
import { addDays, formatDate, relativeWhen } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { BarChart, Empty, PageHeader, Panel, Pipeline, Stat, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { BAYS, TECHNICIANS, label } from '../data';
import {
  IN_BAY, approvalProblem, belowLegal, calibrationState, claimAge, claimOverdue, invoiceBalance, invoiceOverdue, isOldDot, jobFleet, jobInvoice, jobMinutes, minText,
  replacePositions, servicesText, stockLabel, todayStr, toolHoursOut, toolNotReturned, torqueWrench, vehicleLabel,
} from '../helpers';

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const jobsDef = config.collections.find((c) => c.key === 'jobs')!;

  const jobs = records(data, 'jobs');
  const todays = jobs.filter((j) => str(j, 'workDate') === today);
  const inBay = jobs.filter((j) => IN_BAY.includes(j.status ?? ''));
  const durations = todays.map(jobMinutes).filter((m): m is number => m !== null);
  const avgToday = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const quoted = jobs.filter((j) => j.status === 'quoted');
  const poPending = quoted.filter((j) => { const f = jobFleet(data, j); return f?.values.poRequired && !str(j, 'fleetPo'); });
  const tools = records(data, 'tools');
  const out = tools.filter((t) => t.status === 'checkedout');
  const calIssues = tools.filter((t) => ['expired', 'due'].includes(calibrationState(t, today))).sort((a, b) => str(a, 'calibrationDue').localeCompare(str(b, 'calibrationDue')));
  const stock = records(data, 'stock');
  const lowStock = stock.filter((s) => num(s, 'qty') <= num(s, 'reorderLevel'));
  const oldStock = stock.filter((s) => num(s, 'qty') > 0 && isOldDot(str(s, 'dot'), today));
  const invoices = records(data, 'invoices').filter((i) => i.status !== 'void');
  const net = (list: typeof invoices) => list.reduce((n, i) => n + linesTotals(lines(i)).total, 0);
  const revToday = net(invoices.filter((i) => str(i, 'issuedOn') === today));
  const revMonth = net(invoices.filter((i) => str(i, 'issuedOn').startsWith(today.slice(0, 7))));

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const chart = days.map((d) => ({ label: d.slice(8), value: jobs.filter((j) => str(j, 'workDate') === d && !['cancelled'].includes(j.status ?? '')).length }));

  const attention = [
    ...jobs.filter((j) => j.status === 'inspected' && belowLegal(j).some((p) => !replacePositions(j).some((r) => r.key === p.key)) && !str(j, 'refusalNote')).map((j) => ({ to: `jobs/${j.id}`, title: `${j.ref}: ${belowLegal(j).map((p) => p.label).join(', ')} below legal tread`, sub: `${vehicleLabel(data, j.values.vehicle)} · quote a replacement or record refusal`, tone: 'red' as const, mod: 'jobs' })),
    ...jobs.filter((j) => j.status === 'torque').map((j) => ({ j, p: torqueWrench(j, data, today).problem })).filter((x) => x.p).map(({ j, p }) => ({ to: `jobs/${j.id}`, title: `${j.ref}: torque check blocked`, sub: p!, tone: 'red' as const, mod: 'jobs' })),
    ...poPending.map((j) => ({ to: `jobs/${j.id}`, title: `${j.ref}: fleet PO missing`, sub: `${vehicleLabel(data, j.values.vehicle)} · ${str(jobFleet(data, j), 'name')}`, tone: 'amber' as const, mod: 'jobs' })),
    ...out.filter((t) => toolNotReturned(t)).map((t) => ({ to: `tools/${t.id}`, title: `${str(t, 'assetNo')} not returned (${Math.round(toolHoursOut(t))} h)`, sub: `Held by ${label(TECHNICIANS, str(t, 'holder'))} since ${formatDate(str(t, 'checkedOutOn'))} ${str(t, 'checkedOutAt')}`, tone: 'red' as const, mod: 'tools' })),
    ...tools.filter((t) => calibrationState(t, today) === 'expired').map((t) => ({ to: `tools/${t.id}`, title: `${str(t, 'assetNo')} calibration expired`, sub: `Due ${formatDate(str(t, 'calibrationDue'))} · cannot be issued`, tone: 'red' as const, mod: 'tools' })),
    ...tools.filter((t) => t.status === 'missing').map((t) => ({ to: `tools/${t.id}`, title: `${str(t, 'assetNo')} missing`, sub: 'Reported at the last tool count', tone: 'red' as const, mod: 'tools' })),
    ...jobs.filter((j) => j.status === 'ready').map((j) => ({ j, inv: jobInvoice(data, j.id) })).filter((x) => x.inv?.status === 'issued').map(({ j, inv }) => ({ to: `invoices/${inv!.id}`, title: `${j.ref} ready — invoice ${inv!.ref} ${jobFleet(data, j) ? 'not on account yet' : 'unpaid'}`, sub: `${vehicleLabel(data, j.values.vehicle)} · ${formatRand(invoiceBalance(inv!))}`, tone: 'amber' as const, mod: 'invoices' })),
    ...invoices.filter((i) => invoiceOverdue(i, today)).map((i) => ({ to: `invoices/${i.id}`, title: `Fleet invoice ${i.ref} overdue`, sub: `${formatRand(invoiceBalance(i))} · due ${formatDate(str(i, 'dueOn'))}`, tone: 'red' as const, mod: 'invoices' })),
    ...records(data, 'claims').filter((c) => claimOverdue(c, today)).map((c) => ({ to: `claims/${c.id}`, title: `Warranty claim ${c.ref} open ${claimAge(c, today)} days`, sub: 'Chase the supplier (over 21 days)', tone: 'amber' as const, mod: 'claims' })),
  ].filter((a) => hasModule(a.mod));

  const holders = TECHNICIANS.map((t) => ({ t, tools: out.filter((x) => str(x, 'holder') === t.value) })).filter((x) => x.tools.length);

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={`${formatDate(today)} · fitment centre overview built from the live demo records.`}
        actions={hasModule('jobs') ? <Link className="btn primary" to={`${base}/jobs`}>Open bay queue</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">Bays right now</div>
          <h2>{inBay.length} vehicles in {BAYS.length} bays · {todays.length} jobs today · average {minText(avgToday)} arrival to ready</h2>
          <p>{quoted.length} quote(s) waiting for approval, {jobs.filter((j) => j.status === 'ready').length} ready for collection. Every wheel is inspected and torqued with a calibrated wrench before a vehicle leaves.</p>
        </div>
        {hasModule('tools') && <Link className="btn" to={`${base}/tools`}>Tool board →</Link>}
      </div>
      <div className="stat-grid">
        <Stat label="Vehicles in bays" value={inBay.length} sub={`${jobs.filter((j) => ['arrived', 'inspected', 'quoted', 'approved'].includes(j.status ?? '')).length} more waiting on site`} />
        <Stat label="Average time in bay today" value={minText(avgToday)} tone={avgToday !== null && avgToday > 60 ? 'red' : 'accent'} sub={`${durations.length} job(s) finished today · target 60 min`} />
        <Stat label="Waiting for approval" value={quoted.length} tone={poPending.length ? 'red' : undefined} sub={`${poPending.length} fleet PO(s) pending`} />
        <Stat label="Revenue today" value={formatRand(revToday, { compact: true })} sub={`${formatRand(revMonth, { compact: true })} this month incl. VAT`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <div className="stack">
          <Panel title="Vehicles by stage" meta="Live from the bay queue" right={hasModule('jobs') ? <Link className="btn sm" to={`${base}/jobs`}>Bay queue</Link> : undefined}>
            <Pipeline stages={jobsDef.workflow!.states.filter((s) => !s.terminal).map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: jobs.filter((j) => j.status === s.key).length }))} />
          </Panel>
          <Panel title="Waiting for approval" meta="Quotes sent — what each one still needs">
            {quoted.length ? (
              <ul className="list" data-testid="approval-list">
                {quoted.map((j) => {
                  const p = approvalProblem(j, data);
                  return (
                    <li key={j.id}>
                      <div className="grow">
                        {hasModule('jobs') ? <Link to={`${base}/jobs/${j.id}`}><b>{vehicleLabel(data, j.values.vehicle)}</b></Link> : <b>{vehicleLabel(data, j.values.vehicle)}</b>}
                        <small>{j.ref} · {servicesText(j)} · {formatRand(linesTotals(lines(j)).total)}{p ? ` · ${p}` : ''}</small>
                      </div>
                      <Tag tone={p ? (jobFleet(data, j) ? 'red' : 'amber') : 'green'}>{p ? (jobFleet(data, j) ? 'Fleet' : 'Customer') : 'Ready to approve'}</Tag>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty title="No quotes waiting" />}
          </Panel>
          <Panel title="Jobs per day" meta="Last 14 days, including today">
            <BarChart label="Jobs per day over the last 14 days" data={chart} />
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Needs attention" meta="Tread, torque, POs, tools, invoices, claims">
            {attention.length ? (
              <ul className="list" data-testid="attention-list">
                {attention.slice(0, 10).map((a) => (
                  <li key={a.to + a.title}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
                ))}
              </ul>
            ) : <Empty title="Nothing needs attention" />}
          </Panel>
          <Panel title="Tools checked out" meta={`${out.length} tool(s) out now`} right={hasModule('tools') ? <Link className="btn sm" to={`${base}/tools`}>Tool board</Link> : undefined}>
            {holders.length ? (
              <ul className="list" data-testid="tools-out">
                {holders.map(({ t, tools: ts }) => (
                  <li key={t.value}>
                    <div className="grow"><b>{t.label}</b><small>{ts.map((x) => `${str(x, 'assetNo')}${toolNotReturned(x) ? ' (not returned)' : ''}`).join(' · ')}</small></div>
                    {ts.some((x) => toolNotReturned(x)) ? <Tag tone="red">Overnight</Tag> : <Tag tone="accent">{ts.length}</Tag>}
                  </li>
                ))}
              </ul>
            ) : <Empty title="No tools checked out" />}
            {calIssues.length > 0 && (
              <ul className="list" style={{ marginTop: 10 }}>
                {calIssues.map((t) => (
                  <li key={t.id}><span className={`dot ${calibrationState(t, today) === 'expired' ? 'red' : 'amber'}`} /><div className="grow"><b>{str(t, 'assetNo')}</b><small>Calibration {calibrationState(t, today) === 'expired' ? 'expired' : 'due'} {formatDate(str(t, 'calibrationDue'))}</small></div></li>
                ))}
              </ul>
            )}
          </Panel>
          {hasModule('stock') && (
            <Panel title="Low & old stock" meta={`${lowStock.length} low · ${oldStock.length} older than 5 years (demo rule)`} right={<Link className="btn sm" to={`${base}/stock`}>Stock</Link>}>
              {lowStock.length + oldStock.length ? (
                <ul className="list">
                  {[...lowStock.slice(0, 4), ...oldStock.slice(0, 3)].map((s, i) => (
                    <li key={s.id + i}><div className="grow"><Link to={`${base}/stock/${s.id}`}><b>{stockLabel(s)}</b></Link><small>{s.ref} · bin {str(s, 'bin')}</small></div>
                      {i < Math.min(4, lowStock.length) ? <Tag tone={num(s, 'qty') <= 0 ? 'red' : 'amber'}>{num(s, 'qty')} left</Tag> : <Tag tone="dark">Old DOT</Tag>}</li>
                  ))}
                </ul>
              ) : <Empty title="Stock levels healthy" />}
            </Panel>
          )}
        </div>
      </div>
      <div className="grid-2">
        <Panel title="Recent activity" meta="Actions taken in this browser">
          {data.activity.length ? (
            <ul className="list">
              {data.activity.slice(0, 7).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
            </ul>
          ) : <Empty title="No activity yet" body="Record an inspection, check out a torque wrench or pass a torque check — actions appear here." />}
        </Panel>
        <Panel title="Revenue" meta="Invoiced incl. VAT (demo)">
          <div className="mini-stat-row">
            <div><b>{formatRand(revToday)}</b>Today</div>
            <div><b>{formatRand(revMonth)}</b>This month</div>
            <div><b>{formatRand(invoices.filter((i) => i.status === 'onaccount').reduce((n, i) => n + invoiceBalance(i), 0))}</b>On fleet accounts</div>
          </div>
        </Panel>
      </div>
      <RoleBar />
    </>
  );
}
