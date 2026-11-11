import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str, num } from '../../../core/engine';
import { formatRand } from '../../../core/lib/money';
import { daysBetween, formatDate, monthKeys, monthShort, relativeWhen } from '../../../core/lib/dates';
import { BarChart, Empty, PageHeader, Panel, Pipeline, Stat, StatusTag, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { APPOINTMENT_TYPES, PRACTITIONERS, label } from '../data';
import { byDateTime, claimTotal, dueRecalls, patientName, todayStr } from '../helpers';

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const appts = config.collections.find((c) => c.key === 'appointments')!;
  const ordersDef = config.collections.find((c) => c.key === 'orders')!;

  const todays = records(data, 'appointments').filter((a) => str(a, 'date') === today).sort(byDateTime);
  const waiting = todays.filter((a) => ['arrived', 'pretest', 'inexam', 'dispensing'].includes(a.status ?? ''));
  const orders = records(data, 'orders');
  const ready = orders.filter((o) => o.status === 'ready');
  const late = orders.filter((o) => ['ordered', 'received', 'remake'].includes(o.status ?? '') && str(o, 'promised') < today);
  const claims = records(data, 'claims');
  const outstanding = claims.filter((c) => ['submitted', 'partpaid'].includes(c.status ?? ''));
  const outstandingValue = outstanding.reduce((n, c) => n + claimTotal(c) - Math.round(num(c, 'schemePaid') * 100), 0);
  const rejected = claims.filter((c) => c.status === 'rejected');
  const recalls = dueRecalls(data, today);
  const overdueRecalls = recalls.filter((p) => str(p, 'recallDue') < today);
  const lowStock = records(data, 'stock').filter((s) => num(s, 'qty') <= num(s, 'reorderLevel'));
  const drafts = records(data, 'exams').filter((e) => e.status !== 'final');

  // Six months: exams vs optical orders (conversion)
  const months = monthKeys(today, 6);
  const exams = records(data, 'exams');
  const chart = months.map((m) => ({
    label: monthShort(m),
    value: exams.filter((e) => str(e, 'date').startsWith(m)).length,
    alt: orders.filter((o) => o.status !== 'cancelled' && o.createdAt.slice(0, 7) === m).length,
  }));

  const attention = [
    ...late.map((o) => ({ to: `orders/${o.id}`, title: `${o.ref} past promised date`, sub: `${patientName(data, o.values.patient)} · promised ${formatDate(str(o, 'promised'))}`, tone: 'red' as const, mod: 'orders' })),
    ...ready.filter((o) => str(o, 'readySince') && daysBetween(str(o, 'readySince'), today) >= 14).map((o) => ({ to: `orders/${o.id}`, title: `${o.ref} uncollected for ${daysBetween(str(o, 'readySince'), today)} days`, sub: patientName(data, o.values.patient), tone: 'amber' as const, mod: 'orders' })),
    ...rejected.map((c) => ({ to: `claims/${c.id}`, title: `Claim ${c.ref} rejected`, sub: `${patientName(data, c.values.patient)} · correct and resubmit or bill patient`, tone: 'red' as const, mod: 'claims' })),
    ...drafts.map((e) => ({ to: `exams/${e.id}`, title: `Exam ${e.ref} not finalised`, sub: `${patientName(data, e.values.patient)} · ${formatDate(str(e, 'date'))}`, tone: 'amber' as const, mod: 'exams' })),
    ...lowStock.slice(0, 4).map((s) => ({ to: `stock/${s.id}`, title: `${str(s, 'name')} — ${num(s, 'qty')} left`, sub: `Reorder level ${num(s, 'reorderLevel')}`, tone: num(s, 'qty') <= 0 ? 'red' as const : 'amber' as const, mod: 'stock' })),
  ].filter((a) => hasModule(a.mod));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.replace(/^Dr\s+/, '').split(' ')[0]}`} subtitle={`${formatDate(today)} · practice overview built from the live demo records.`}
        actions={hasModule('diary') ? <Link className="btn primary" to={`${base}/diary`}>Open today’s diary</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">Today in the practice</div>
          <h2>{todays.length} appointments · {waiting.length} patient{waiting.length === 1 ? '' : 's'} in the practice now</h2>
          <p>{todays.filter((a) => a.status === 'completed').length} seen, {todays.filter((a) => a.status === 'booked').length} still to arrive, {todays.filter((a) => a.status === 'noshow').length} did not attend. {ready.length} optical orders are waiting for collection.</p>
        </div>
        {hasModule('recalls') && <Link className="btn" to={`${base}/recalls`}>{overdueRecalls.length} recalls overdue →</Link>}
      </div>
      <div className="stat-grid">
        <Stat label="Appointments today" value={todays.length} sub={`${PRACTITIONERS.map((p) => `${p.short} ${todays.filter((a) => str(a, 'practitioner') === p.value).length}`).join(' · ')}`} />
        <Stat label="Exams this month" value={exams.filter((e) => e.status === 'final' && str(e, 'date').startsWith(today.slice(0, 7))).length} sub={`${drafts.length} in progress`} />
        <Stat label="Ready for collection" value={ready.length} tone="accent" sub={`${orders.filter((o) => ['ordered', 'received', 'remake'].includes(o.status ?? '')).length} at the lab / in QC`} />
        <Stat label="Claims awaiting payment" value={formatRand(outstandingValue, { compact: true })} tone={rejected.length ? 'red' : undefined} sub={`${outstanding.length} open · ${rejected.length} rejected`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Today’s patient flow" meta="Live from the diary" right={hasModule('diary') ? <Link className="btn sm" to={`${base}/diary`}>Diary</Link> : undefined}>
          {todays.length ? (
            <ul className="list" data-testid="today-list">
              {todays.map((a) => (
                <li key={a.id}>
                  <span className="time-chip">{str(a, 'time')}</span>
                  <div className="grow">
                    {hasModule('diary') ? <Link to={`${base}/diary/${a.id}`}><b>{patientName(data, a.values.patient)}</b></Link> : <b>{patientName(data, a.values.patient)}</b>}
                    <small>{label(APPOINTMENT_TYPES, str(a, 'type'))} · {label(PRACTITIONERS, str(a, 'practitioner'))}</small>
                  </div>
                  <StatusTag workflow={appts.workflow} status={a.status} />
                </li>
              ))}
            </ul>
          ) : <Empty title="No appointments today" />}
        </Panel>
        <div className="stack">
          <Panel title="Needs attention" meta="Rules: promised dates, uncollected jobs, rejected claims, unfinalised exams, stock levels">
            {attention.length ? (
              <ul className="list" data-testid="attention-list">
                {attention.slice(0, 8).map((a) => (
                  <li key={a.to}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
                ))}
              </ul>
            ) : <Empty title="Nothing needs attention" />}
          </Panel>
          {hasModule('orders') && (
            <Panel title="Optical jobs" meta="Orders by stage" right={<Link className="btn sm" to={`${base}/orders`}>Lab board</Link>}>
              <Pipeline stages={ordersDef.workflow!.states.filter((s) => !s.terminal).map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: orders.filter((o) => o.status === s.key).length }))} />
            </Panel>
          )}
        </div>
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Exams and eyewear orders" meta="Last six months · exams (accent) vs optical orders (dark)">
          <BarChart label="Exams and optical orders per month" data={chart} alt="Orders" />
        </Panel>
        <Panel title="Recent activity" meta="Actions taken in this browser">
          {data.activity.length ? (
            <ul className="list">
              {data.activity.slice(0, 7).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
            </ul>
          ) : <Empty title="No activity yet" body="Check a patient in, finalise an exam or move a lab job — actions appear here." />}
          {recalls.length > 0 && hasModule('recalls') && (
            <p className="muted-note" style={{ marginTop: 12 }}>
              Next recall: <Tag tone="amber">{patientName(data, recalls[0].id)}</Tag> due {formatDate(str(recalls[0], 'recallDue'))}
            </p>
          )}
        </Panel>
      </div>
      <div className="section-gap" />
      <RoleBar />
    </>
  );
}
