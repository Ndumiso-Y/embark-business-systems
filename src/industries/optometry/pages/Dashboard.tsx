import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str, num } from '../../../core/engine';
import { formatRand } from '../../../core/lib/money';
import { daysBetween, formatDate, monthKeys, monthShort, parseIso, relativeWhen } from '../../../core/lib/dates';
import { BarChart, Empty, Panel, Pipeline, StatusTag, Tag } from '../../../core/components/ui';
import { IcoAlert, IcoArrow, IcoCalendar, IcoCheck, IcoChevron, IcoEye, IcoFlask, IcoUsers } from '../../../core/components/Icons';
import RoleBar from '../../../core/components/RoleBar';
import { FlowRing, Kpi, MoreButton, type OverviewIcon as Icon } from '../../../core/components/overview';
import { escapeCloses, initialsOf, WEEKDAYS } from '../../../core/lib/overview';
import { APPOINTMENT_TYPES, PRACTITIONERS, label } from '../data';
import { byDateTime, claimTotal, dueRecalls, patientName, todayStr } from '../helpers';
import { flowSegments, flowSummary, nowAndNext, recentPatients } from '../dashboardModel';
import '../optometry.css';


/**
 * Optometry dashboard. Approved concept and design record:
 * docs/design/06_optometry_dashboard_addendum_2026-11.md. Every figure comes from the
 * demo records (definitions in ../dashboardModel.ts); nothing here is typed in.
 */
export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const appts = config.collections.find((c) => c.key === 'appointments')!;
  const ordersDef = config.collections.find((c) => c.key === 'orders')!;
  const moduleIcon = (key: string, fallback: Icon): Icon => config.modules.find((m) => m.key === key)?.icon ?? fallback;
  const stateLabel = (key: string) => appts.workflow?.states.find((s) => s.key === key)?.label ?? key;

  const todays = records(data, 'appointments').filter((a) => str(a, 'date') === today).sort(byDateTime);
  const flow = flowSummary(todays);
  const orders = records(data, 'orders');
  const ready = orders.filter((o) => o.status === 'ready');
  const atLab = orders.filter((o) => ['ordered', 'received', 'remake'].includes(o.status ?? ''));
  const late = atLab.filter((o) => str(o, 'promised') < today);
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

  const [dayOpen, setDayOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const preview = nowAndNext(todays, 4);
  const diaryRows = dayOpen ? todays : preview;
  const recent = recentPatients(todays, 3);
  const attentionRows = attentionOpen ? attention : attention.slice(0, 3);
  const inRoom = flow.stages.filter((s) => s.count > 0);
  const weekday = WEEKDAYS[parseIso(today).getDay()];

  return (
    <div className="od">
      <header className="od-head">
        <div>
          <h1 className="od-title">{`Good day, ${user.name.replace(/^Dr\s+/, '').split(' ')[0]}`}</h1>
          <p className="od-sub">Here’s a quick view of {config.businessName} today.</p>
        </div>
        <div className="od-head-actions">
          <span className="od-date"><IcoCalendar />{weekday}, {formatDate(today)}</span>
          {hasModule('diary') && <Link className="btn primary" to={`${base}/diary`}>Open today’s diary</Link>}
        </div>
      </header>

      <section className="od-kpis" aria-label="Today at a glance">
        <Kpi featured icon={moduleIcon('diary', IcoCalendar)} label="Appointments today" value={todays.length}
          sub={`${flow.booked} still to arrive · ${flow.completed} completed`} to={hasModule('diary') ? `${base}/diary` : undefined} />
        <Kpi icon={IcoEye} label="In the practice now" value={flow.inPractice}
          sub={inRoom.length ? inRoom.map((s) => `${s.count} ${stateLabel(s.key).toLowerCase()}`).join(' · ') : 'Nobody checked in'} to={hasModule('diary') ? `${base}/diary` : undefined} />
        <Kpi icon={moduleIcon('orders', IcoFlask)} label="Ready for collection" value={ready.length} tone="accent"
          sub={`${atLab.length} at the lab / in QC`} to={hasModule('orders') ? `${base}/orders` : undefined} />
        <Kpi icon={moduleIcon('claims', IcoCheck)} label="Claims awaiting payment" value={formatRand(outstandingValue, { compact: true })} tone={rejected.length ? 'red' : undefined}
          sub={`${outstanding.length} open · ${rejected.length} rejected`} to={hasModule('claims') ? `${base}/claims` : undefined} />
        {hasModule('recalls') && (
          <Kpi icon={moduleIcon('recalls', IcoUsers)} label="Recalls due" value={recalls.length}
            sub={`${overdueRecalls.length} recalls overdue`} to={`${base}/recalls`} />
        )}
      </section>

      <div className="od-row od-row-main">
        <section className="od-panel od-flow" aria-labelledby="od-flow-title">
          <div className="od-flow-info">
            <h2 id="od-flow-title" className="od-h2">Today’s patient flow</h2>
            <p className="od-meta">From arrival to collection · live from the diary</p>
            {flow.expected > 0 ? (
              <div className="od-flow-body">
                <FlowRing pct={flow.completedPct} segments={flowSegments(flow)} label={`${flow.completed} of ${flow.expected} visits completed`} />
                <dl className="od-legend">
                  <div><dt><i className="is-booked" />Still to arrive</dt><dd>{flow.booked}</dd></div>
                  <div><dt><i className="is-inpractice" />In the practice now</dt><dd>{flow.inPractice}</dd></div>
                  <div><dt><i className="is-completed" />Completed</dt><dd>{flow.completed}</dd></div>
                  <div><dt><i className="is-noshow" />Did not attend</dt><dd>{flow.noShow}</dd></div>
                  {flow.cancelled > 0 && <div><dt><i className="is-cancelled" />Cancelled (not counted)</dt><dd>{flow.cancelled}</dd></div>}
                </dl>
              </div>
            ) : <Empty title="No appointments today" />}
            {flow.expected > 0 && (
              <p className="od-flow-note">
                <b>{flow.completed} of {flow.expected}</b> visits completed.
                {inRoom.length > 0 && <> In the practice: {inRoom.map((s) => `${stateLabel(s.key)} ${s.count}`).join(' · ')}.</>}
              </p>
            )}
          </div>
          <OpticalArt image={config.image} focus={config.imageFocus} />
        </section>

        <section className="od-panel od-diary" aria-labelledby="od-diary-title" onKeyDown={(e) => escapeCloses(e, dayOpen, setDayOpen)}>
          <div className="od-panel-head">
            <span className="od-medal"><IcoCalendar /></span>
            <div className="od-grow">
              <h2 id="od-diary-title" className="od-h2">Today’s diary</h2>
              <p className="od-meta">{dayOpen ? `All ${todays.length} · ${PRACTITIONERS.map((p) => `${p.short} ${todays.filter((a) => str(a, 'practitioner') === p.value).length}`).join(' · ')}` : 'Now and next'}</p>
            </div>
            {hasModule('diary') && <Link className="od-link" to={`${base}/diary`}>View day <IcoArrow /></Link>}
          </div>
          {todays.length ? (
            <>
              <ul className="od-list" data-testid="today-list" id="od-today-list">
                {diaryRows.map((a) => (
                  <li key={a.id}>
                    <span className="od-time">{str(a, 'time')}</span>
                    <span className="od-bar" aria-hidden="true" />
                    <div className="od-grow">
                      {hasModule('diary') ? <Link to={`${base}/diary/${a.id}`}><b>{patientName(data, a.values.patient)}</b></Link> : <b>{patientName(data, a.values.patient)}</b>}
                      <small>{label(APPOINTMENT_TYPES, str(a, 'type'))} · {label(PRACTITIONERS, str(a, 'practitioner'))}</small>
                    </div>
                    <StatusTag workflow={appts.workflow} status={a.status} />
                  </li>
                ))}
              </ul>
              {todays.length > preview.length && (
                <MoreButton open={dayOpen} onToggle={() => setDayOpen((v) => !v)} controls="od-today-list" testid="today-toggle"
                  more={`Show all ${todays.length} appointments`} less="Show now and next only" />
              )}
            </>
          ) : <Empty title="No appointments today" />}
        </section>
      </div>

      <div className="od-row od-row-three">
        <section className="od-panel" aria-labelledby="od-recent-title">
          <div className="od-panel-head">
            <span className="od-medal"><IcoUsers /></span>
            <div className="od-grow">
              <h2 id="od-recent-title" className="od-h2">Recent patients</h2>
              <p className="od-meta">Seen today</p>
            </div>
            {hasModule('patients') && <Link className="od-link" to={`${base}/patients`}>View all <IcoArrow /></Link>}
          </div>
          {recent.length ? (
            <ul className="od-list" data-testid="recent-patients">
              {recent.map((a) => {
                const name = patientName(data, a.values.patient);
                return (
                  <li key={a.id}>
                    <span className="od-avatar" aria-hidden="true">{initialsOf(name)}</span>
                    <div className="od-grow">
                      {hasModule('patients') ? <Link to={`${base}/patients/${str(a, 'patient')}`}><b>{name}</b></Link> : <b>{name}</b>}
                      <small>{label(APPOINTMENT_TYPES, str(a, 'type'))} · {str(a, 'time')}</small>
                    </div>
                    <StatusTag workflow={appts.workflow} status={a.status} />
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="No patients seen yet today" />}
        </section>

        {hasModule('orders') && (
          <section className="od-panel" aria-labelledby="od-orders-title" onKeyDown={(e) => escapeCloses(e, stagesOpen, setStagesOpen)}>
            <div className="od-panel-head">
              <span className="od-medal">{(() => { const I = moduleIcon('orders', IcoFlask); return <I />; })()}</span>
              <div className="od-grow">
                <h2 id="od-orders-title" className="od-h2">Optical orders</h2>
                <p className="od-meta">{late.length ? `${late.length} past the promised date` : 'Orders by stage'}</p>
              </div>
              <Link className="od-link" to={`${base}/orders`}>Lab board <IcoArrow /></Link>
            </div>
            <div className="od-tiles">
              <Link className="od-tile is-ready" to={`${base}/orders`}><IcoCheck /><span>Ready to collect</span><b>{ready.length}</b></Link>
              <Link className="od-tile is-lab" to={`${base}/orders`}><IcoFlask /><span>At the lab / in QC</span><b>{atLab.length}</b></Link>
            </div>
            <MoreButton open={stagesOpen} onToggle={() => setStagesOpen((v) => !v)} controls="od-stages" testid="stages-toggle" more="Show every stage" less="Hide stages" />
            {stagesOpen && (
              <div id="od-stages" className="od-stages">
                <Pipeline stages={ordersDef.workflow!.states.filter((s) => !s.terminal).map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: orders.filter((o) => o.status === s.key).length }))} />
              </div>
            )}
          </section>
        )}

        <section className="od-panel" aria-labelledby="od-attention-title" onKeyDown={(e) => escapeCloses(e, attentionOpen, setAttentionOpen)}>
          <div className="od-panel-head">
            <span className="od-medal is-alert"><IcoAlert /></span>
            <div className="od-grow">
              <h2 id="od-attention-title" className="od-h2">Needs attention</h2>
              <p className="od-meta">{attention.length ? `${attention.length} item${attention.length === 1 ? '' : 's'} from the practice rules` : 'Promised dates, claims, exams and stock'}</p>
            </div>
          </div>
          {attention.length ? (
            <>
              <ul className="od-list is-links" data-testid="attention-list" id="od-attention-list">
                {attentionRows.map((a) => {
                  const I = moduleIcon(a.mod, IcoAlert);
                  return (
                    <li key={a.to}>
                      <span className={`od-medal is-small is-${a.tone}`}><I /></span>
                      <div className="od-grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div>
                      <IcoChevron className="ico od-chev" />
                    </li>
                  );
                })}
              </ul>
              {attention.length > 3 && (
                <MoreButton open={attentionOpen} onToggle={() => setAttentionOpen((v) => !v)} controls="od-attention-list" testid="attention-toggle"
                  more={`Show all ${attention.length}`} less="Show the first three" />
              )}
            </>
          ) : <Empty title="Nothing needs attention" />}
        </section>
      </div>

      <section className="od-more" onKeyDown={(e) => escapeCloses(e, moreOpen, setMoreOpen)}>
        <MoreButton open={moreOpen} onToggle={() => setMoreOpen((v) => !v)} controls="od-more-body" testid="more-toggle" more="Show trends and recent activity" less="Hide trends and recent activity" />
        {moreOpen && (
          <div id="od-more-body" className="grid-2 od-more-body">
            <Panel title="Exams and eyewear orders" meta="Last six months · exams (accent) vs optical orders (dark)"
              right={<Tag tone="accent">{exams.filter((e) => e.status === 'final' && str(e, 'date').startsWith(today.slice(0, 7))).length} exams this month · {drafts.length} in progress</Tag>}>
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
        )}
      </section>

      <RoleBar />
    </div>
  );
}

/**
 * Right side of the flow panel. Shows the licensed cover photo when one is configured
 * (`image` on the industry config, asset manifest GREEN); until then an abstract lens
 * dial drawn in SVG in the practice's own colour.
 */
function OpticalArt({ image, focus }: { image?: string; focus?: string }) {
  if (image) return <div className="od-art has-photo" aria-hidden="true"><img src={image} alt="" loading="lazy" style={{ objectPosition: focus ?? '50% 50%' }} /></div>;
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
  return (
    <div className="od-art" aria-hidden="true">
      <svg viewBox="0 0 320 300" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <radialGradient id="od-lens-a" cx="38%" cy="30%" r="80%"><stop offset="0" stopColor="#fff" stopOpacity=".98" /><stop offset=".55" stopColor="#fff" stopOpacity=".5" /><stop offset="1" className="od-stop-soft" stopOpacity=".55" /></radialGradient>
          <radialGradient id="od-lens-b" cx="35%" cy="28%" r="85%"><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" className="od-stop-accent" stopOpacity=".3" /></radialGradient>
          <filter id="od-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16" /></filter>
        </defs>
        <ellipse className="od-art-glow" cx="165" cy="155" rx="120" ry="105" filter="url(#od-blur)" />
        <circle className="od-art-rim" cx="78" cy="238" r="46" fill="url(#od-lens-b)" />
        <circle className="od-art-rim" cx="246" cy="56" r="32" fill="url(#od-lens-b)" />
        <g transform="translate(164 150) scale(.74)">
          <circle className="od-art-bezel" r="118" />
          <circle className="od-art-rim" r="106" fill="url(#od-lens-a)" />
          {ticks.map((deg) => <line key={deg} className={`od-art-tick${deg % 30 === 0 ? ' is-major' : ''}`} x1="0" y1={deg % 30 === 0 ? -86 : -92} x2="0" y2="-100" transform={`rotate(${deg})`} />)}
          <line className="od-art-axis" x1="-78" y1="0" x2="78" y2="0" transform="rotate(-22)" />
          <circle className="od-art-hub" r="7" />
          <path className="od-art-shine" d="M-72 -52a92 92 0 0 1 58 -38" />
        </g>
      </svg>
    </div>
  );
}
