import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { lines, num, records, str } from '../../../core/engine';
import { formatDate, monthShort, parseIso, relativeWhen } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { BarChart, Empty, Meters, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { IcoAlert, IcoArrow, IcoBox, IcoCalendar, IcoCar, IcoCheck, IcoChevron, IcoClock, IcoLock, IcoReceipt, IcoWrench } from '../../../core/components/Icons';
import RoleBar from '../../../core/components/RoleBar';
import { FlowRing, Kpi, MoreButton } from '../../../core/components/overview';
import { escapeCloses, WEEKDAYS } from '../../../core/lib/overview';
import { BAYS, DAY_HOURS, JOB_TYPES, TECHNICIANS, label } from '../data';
import {
  IN_WORKSHOP, ageDays, ageLabel, customerName, jobEstimate, hoursBy, invoiceBalance, invoiceOverdue, lastMonths, plannedOn, serviceDue, splitTotals, todayStr, utilisation, vehicleCustomer, vehicleLabel,
} from '../helpers';
import { byStart, capacity, openJobCards, pctOf, stageRing, workshopStages } from '../dashboardModel';
import '../automotive.css';

type Tone = 'red' | 'amber' | 'blue';

/**
 * Automotive workshop dashboard. Approved concept and design record:
 * docs/design/09_automotive_dashboard_addendum_2026-11.md. Every figure comes from the demo
 * records (definitions in ../dashboardModel.ts); nothing here is typed in.
 */
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
  const todays = plannedOn(data, today).sort(byStart);
  const bookedToday = todays.filter((j) => j.status === 'booked');
  const lateJobs = jobs.filter((j) => !['ready', 'collected', 'cancelled'].includes(j.status ?? '') && str(j, 'promisedDate') && str(j, 'promisedDate') < today);
  const invoices = records(data, 'invoices');
  const unpaid = invoices.filter((i) => ['issued', 'partpaid'].includes(i.status ?? ''));
  const unpaidValue = unpaid.reduce((n, i) => n + invoiceBalance(i), 0);
  const overdue = unpaid.filter((i) => invoiceOverdue(i, today));
  const lowStock = records(data, 'parts').filter((p) => num(p, 'qty') <= num(p, 'reorderLevel'));
  const serviceOverdue = records(data, 'vehicles').filter((v) => serviceDue(v, today).state === 'overdue');
  const bayHours = hoursBy(data, today, 'bay');
  const cap = capacity(bayHours, BAYS.length, DAY_HOURS);
  const flow = workshopStages(jobs);
  const privateReady = ready.filter((j) => str(vehicleCustomer(data, j.values.vehicle), 'kind') !== 'account').length;

  const months = lastMonths(today, 4);
  const chart = months.map((m) => {
    const s = invoices.filter((i) => i.status !== 'void' && str(i, 'issuedOn').startsWith(m)).map((i) => splitTotals(lines(i)));
    return { label: monthShort(m), value: s.reduce((n, x) => n + x.labour, 0) / 100, alt: s.reduce((n, x) => n + x.parts, 0) / 100 };
  });

  // Unchanged rules from the previous dashboard.
  const attention = [
    ...awaiting.filter((a) => a.age >= 2).map((a) => ({ to: `jobs/${a.j.id}`, title: `${a.j.ref} waiting ${ageLabel(a.age)} for approval`, sub: `${vehicleLabel(data, a.j.values.vehicle)} · chase ${str(vehicleCustomer(data, a.j.values.vehicle), 'name')}`, tone: 'amber' as Tone, mod: 'jobs', icon: IcoClock })),
    ...lateJobs.map((j) => ({ to: `jobs/${j.id}`, title: `${j.ref} past promised date`, sub: `${vehicleLabel(data, j.values.vehicle)} · promised ${formatDate(str(j, 'promisedDate'))}`, tone: 'red' as Tone, mod: 'jobs', icon: IcoAlert })),
    ...jobs.filter((j) => j.status === 'qc').map((j) => ({ to: `jobs/${j.id}`, title: `${j.ref} waiting for quality check`, sub: vehicleLabel(data, j.values.vehicle), tone: 'blue' as Tone, mod: 'jobs', icon: IcoCheck })),
    ...overdue.map((i) => ({ to: `invoices/${i.id}`, title: `Invoice ${i.ref} overdue — ${formatRand(invoiceBalance(i))}`, sub: `${customerName(data, i.values.customer)} · issued ${formatDate(str(i, 'issuedOn'))}`, tone: 'red' as Tone, mod: 'invoices', icon: IcoReceipt })),
    ...lowStock.slice(0, 4).map((p) => ({ to: `parts/${p.id}`, title: `${str(p, 'description')} — ${num(p, 'qty')} left`, sub: `${str(p, 'partNo')} · reorder at ${num(p, 'reorderLevel')}`, tone: num(p, 'qty') <= 0 ? 'red' as Tone : 'amber' as Tone, mod: 'parts', icon: IcoBox })),
  ].filter((a) => hasModule(a.mod));

  const [dayOpen, setDayOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const bookingRows = dayOpen ? todays : todays.slice(0, 5);
  const openCards = openJobCards(jobs, IN_WORKSHOP);
  const cardRows = jobsOpen ? openCards : openCards.slice(0, 5);
  const attentionRows = attentionOpen ? attention : attention.slice(0, 3);
  const weekday = WEEKDAYS[parseIso(today).getDay()];
  const jobLink = (id: string) => (hasModule('jobs') ? `${base}/jobs/${id}` : undefined);
  const tech = (v: string) => TECHNICIANS.find((t) => t.value === v)?.short ?? 'No technician';
  const jumpToAttention = () => {
    const el = document.getElementById('au-attention');
    el?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  };

  return (
    <div className="od au">
      <header className="od-head">
        <div>
          <h1 className="od-title">{`Good day, ${user.name.split(' ')[0]}`}</h1>
          <p className="od-sub">Here’s a quick view of the {config.businessName} workshop today.</p>
        </div>
        <div className="od-head-actions">
          <span className="od-date"><IcoCalendar />{weekday}, {formatDate(today)}</span>
          {attention.length > 0 && (
            <button type="button" className="od-alert-chip" onClick={jumpToAttention} data-testid="attention-jump">
              <IcoAlert />{attention.length} need{attention.length === 1 ? 's' : ''} attention
            </button>
          )}
          {hasModule('jobs') && <Link className="btn primary" to={`${base}/jobs`}>Open workshop board</Link>}
        </div>
      </header>

      <section className="od-kpis" aria-label="Today at a glance">
        <Kpi featured icon={IcoCalendar} label="Today’s bookings" value={todays.length} testid="kpi-bookings"
          sub={`${bookedToday.length} still to arrive · ${cap.booked} h of ${cap.available} h booked`} to={hasModule('planner') ? `${base}/planner` : undefined} />
        <Kpi icon={IcoWrench} label="In the workshop" value={inWorkshop.length} testid="kpi-workshop"
          sub={`${jobs.filter((j) => j.status === 'inprogress').length} being worked on · ${jobs.filter((j) => j.status === 'qc').length} in QC`} to={hasModule('jobs') ? `${base}/jobs` : undefined} />
        <Kpi icon={IcoClock} label="Awaiting approval" value={awaiting.length} tone={awaiting.some((a) => a.age >= 2) ? 'red' : undefined} testid="kpi-approval"
          sub={awaiting.length ? `Oldest ${ageLabel(awaiting[0].age)} · customer must approve` : 'None waiting'} to={hasModule('jobs') ? `${base}/jobs` : undefined} />
        <Kpi icon={IcoCheck} label="Ready for collection" value={ready.length} tone="accent" testid="kpi-ready"
          sub={`${privateReady} private — pay before release`} to={hasModule('jobs') ? `${base}/jobs` : undefined} />
        {hasModule('invoices') ? (
          <Kpi icon={IcoReceipt} label="Unpaid invoices" value={formatRand(unpaidValue, { compact: true })} tone={overdue.length ? 'red' : undefined} testid="kpi-unpaid"
            sub={`${unpaid.length} open · ${overdue.length} overdue`} to={`${base}/invoices`} />
        ) : hasModule('parts') ? (
          <Kpi icon={IcoBox} label="Parts low" value={lowStock.length} tone={lowStock.some((p) => num(p, 'qty') <= 0) ? 'red' : undefined} testid="kpi-parts"
            sub="At or below reorder level" to={`${base}/parts`} />
        ) : null}
      </section>

      <div className="od-row od-row-main">
        <section className="od-panel au-flow" aria-labelledby="au-flow-title">
          <div className="au-flow-top">
            <div className="od-flow-info">
              <h2 id="au-flow-title" className="od-h2">Today’s workshop flow</h2>
              <p className="od-meta">Vehicles on site, live from the workshop board</p>
              {flow.onSite > 0 ? (
                <div className="od-flow-body">
                  <FlowRing value={String(flow.onSite)} caption="on site" segments={stageRing(flow.stages)} label={flow.stages.filter((s) => s.count).map((s) => `${s.count} ${jobsDef.workflow!.states.find((x) => x.key === s.key)?.label.toLowerCase()}`).join(', ')} />
                  <dl className="od-legend au-legend">
                    {flow.stages.map((s) => (
                      <div key={s.key}>
                        <dt><i className={`tone-${s.tone}`} />{jobsDef.workflow!.states.find((x) => x.key === s.key)?.label}</dt>
                        <dd>{s.count}<span>{pctOf(s.share)}%</span></dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : <Empty title="No vehicles on site" />}
            </div>
            <VehicleArt image={config.image} focus={config.imageFocus} />
          </div>
          <ol className="au-track" aria-label="Workshop stages">
            {flow.stages.map((s) => (
              <li key={s.key} className={`${s.count ? 'has' : ''}${s.key === 'approval' ? ' is-gate' : ''}`}>
                <span className={`au-step tone-${s.tone}`} aria-hidden="true">{s.key === 'approval' ? <IcoLock /> : s.count}</span>
                <b>{s.short}</b>
                <small>{s.count} vehicle{s.count === 1 ? '' : 's'}</small>
              </li>
            ))}
          </ol>
          <p className="au-gate"><IcoLock />Work starts only after the customer approves the estimate; every vehicle passes a quality check before it is released.</p>
        </section>

        <section className="od-panel od-diary" aria-labelledby="au-bookings-title" onKeyDown={(e) => escapeCloses(e, dayOpen, setDayOpen)}>
          <div className="od-panel-head">
            <span className="od-medal"><IcoCalendar /></span>
            <div className="od-grow">
              <h2 id="au-bookings-title" className="od-h2">Today’s bookings</h2>
              <p className="od-meta">{todays.length} job cards planned in the bays</p>
            </div>
            {(hasModule('planner') || hasModule('jobs')) && <Link className="od-link" to={`${base}/${hasModule('planner') ? 'planner' : 'jobs'}`}>View all <IcoArrow /></Link>}
          </div>
          {todays.length ? (
            <>
              <ul className="od-list" data-testid="bookings-list" id="au-bookings-list">
                {bookingRows.map((j) => {
                  const to = jobLink(j.id);
                  const v = findReg(vehicleLabel(data, j.values.vehicle));
                  return (
                    <li key={j.id}>
                      <span className="od-time">{str(j, 'startTime') || '—'}</span>
                      <span className="od-bar" aria-hidden="true" />
                      <div className="od-grow">
                        {to ? <Link to={to}><b>{v}</b></Link> : <b>{v}</b>}
                        <small>{label(JOB_TYPES, str(j, 'jobType'))} · {tech(str(j, 'technician'))}</small>
                      </div>
                      <StatusTag workflow={jobsDef.workflow} status={j.status} />
                    </li>
                  );
                })}
              </ul>
              {todays.length > 5 && (
                <MoreButton open={dayOpen} onToggle={() => setDayOpen((v) => !v)} controls="au-bookings-list" testid="bookings-toggle" more={`Show all ${todays.length} bookings`} less="Show the first five" />
              )}
            </>
          ) : <Empty title="Nothing planned today" />}
        </section>
      </div>

      <div className="od-row od-row-three">
        <section className="od-panel au-cards" aria-labelledby="au-cards-title" onKeyDown={(e) => escapeCloses(e, jobsOpen, setJobsOpen)}>
          <div className="od-panel-head">
            <span className="od-medal"><IcoCar /></span>
            <div className="od-grow">
              <h2 id="au-cards-title" className="od-h2">Open job cards</h2>
              <p className="od-meta">On site, longest first</p>
            </div>
            {hasModule('jobs') && <Link className="od-link" to={`${base}/jobs`}>Board <IcoArrow /></Link>}
          </div>
          {openCards.length ? (
            <>
              <table className="au-table" data-testid="open-cards" id="au-cards-table">
                <colgroup><col className="c-ref" /><col /><col className="au-col-work" /><col className="c-status" /></colgroup>
                <thead><tr><th scope="col">Job card</th><th scope="col">Vehicle</th><th scope="col" className="au-col-work">Work</th><th scope="col">Status</th></tr></thead>
                <tbody>
                  {cardRows.map((j) => {
                    const to = jobLink(j.id);
                    const v = vehicleLabel(data, j.values.vehicle).split(' · ')[0];
                    return (
                      <tr key={j.id}>
                        <td>{to ? <Link to={to}>{j.ref}</Link> : j.ref}</td>
                        <td title={vehicleLabel(data, j.values.vehicle)}>{v}</td>
                        <td className="au-col-work">{label(JOB_TYPES, str(j, 'jobType'))}</td>
                        <td><StatusTag workflow={jobsDef.workflow} status={j.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {openCards.length > 5 && (
                <MoreButton open={jobsOpen} onToggle={() => setJobsOpen((v) => !v)} controls="au-cards-table" testid="cards-toggle" more={`Show all ${openCards.length}`} less="Show the first five" />
              )}
            </>
          ) : <Empty title="No vehicles on site" />}
        </section>

        <section className="od-panel" aria-labelledby="au-bays-title">
          <div className="od-panel-head">
            <span className="od-medal"><IcoWrench /></span>
            <div className="od-grow">
              <h2 id="au-bays-title" className="od-h2">Bay capacity</h2>
              <p className="od-meta">Today · hours booked vs {DAY_HOURS} h per bay</p>
            </div>
            {hasModule('planner') && <Link className="od-link" to={`${base}/planner`}>Planner <IcoArrow /></Link>}
          </div>
          <div className="au-capacity" data-testid="capacity">
            <div className="au-capacity-head"><b>{cap.booked} h</b><span>of {cap.available} h across {BAYS.length} bays · {cap.pct}%</span></div>
            <div className="au-capacity-bar" role="img" aria-label={`${cap.booked} of ${cap.available} hours booked today, ${cap.pct}%`}><i style={{ width: `${Math.min(100, cap.pct)}%` }} /></div>
          </div>
          <Meters format={(n) => `${n} h`} items={BAYS.map((b) => {
            const h = bayHours[b.value] ?? 0;
            return { label: b.label, value: h, max: DAY_HOURS, tone: h > DAY_HOURS ? 'red' : h >= DAY_HOURS * 0.6 ? 'green' : 'amber', sub: `${utilisation(h)}% · ${todays.filter((j) => str(j, 'bay') === b.value).length} job cards` };
          })} />
        </section>

        <section className="od-panel" id="au-attention" tabIndex={-1} aria-labelledby="au-attention-title" onKeyDown={(e) => escapeCloses(e, attentionOpen, setAttentionOpen)}>
          <div className="od-panel-head">
            <span className="od-medal is-alert"><IcoAlert /></span>
            <div className="od-grow">
              <h2 id="au-attention-title" className="od-h2">Needs attention</h2>
              <p className="od-meta">{attention.length ? `${attention.length} item${attention.length === 1 ? '' : 's'} from the workshop rules` : 'Approvals, promised dates, QC, invoices and stock'}</p>
            </div>
          </div>
          {attention.length ? (
            <>
              <ul className="od-list is-links" data-testid="attention-list" id="au-attention-list">
                {attentionRows.map((a) => (
                  <li key={a.to + a.title}>
                    <span className={`od-medal is-small is-${a.tone}`}><a.icon /></span>
                    <div className="od-grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div>
                    <IcoChevron className="ico od-chev" />
                  </li>
                ))}
              </ul>
              {attention.length > 3 && (
                <MoreButton open={attentionOpen} onToggle={() => setAttentionOpen((v) => !v)} controls="au-attention-list" testid="attention-toggle" more={`Show all ${attention.length}`} less="Show the first three" />
              )}
            </>
          ) : <Empty title="Nothing needs attention" />}
        </section>
      </div>

      <div className="od-row au-row-two">
        <section className="od-panel" aria-labelledby="au-awaiting-title">
          <div className="od-panel-head">
            <span className="od-medal"><IcoLock /></span>
            <div className="od-grow">
              <h2 id="au-awaiting-title" className="od-h2">Awaiting customer approval</h2>
              <p className="od-meta">Estimates sent, no reply yet — work cannot start</p>
            </div>
          </div>
          {awaiting.length ? (
            <ul className="od-list" data-testid="awaiting-list">
              {awaiting.map(({ j, est, age }) => (
                <li key={j.id}>
                  <div className="od-grow">
                    {jobLink(j.id) ? <Link to={jobLink(j.id)!}><b>{vehicleLabel(data, j.values.vehicle)}</b></Link> : <b>{vehicleLabel(data, j.values.vehicle)}</b>}
                    <small>{j.ref} · {str(vehicleCustomer(data, j.values.vehicle), 'name')}{est ? ` · ${est.ref}` : ''}</small>
                  </div>
                  <Tag tone={age >= 2 ? 'red' : age >= 1 ? 'amber' : 'blue'}>{age <= 0 ? 'Sent today' : `Waiting ${ageLabel(age)}`}</Tag>
                </li>
              ))}
            </ul>
          ) : <Empty title="No estimates waiting" />}
        </section>
        <section className="od-panel" aria-labelledby="au-ready-title">
          <div className="od-panel-head">
            <span className="od-medal"><IcoCheck /></span>
            <div className="od-grow">
              <h2 id="au-ready-title" className="od-h2">Ready for collection</h2>
              <p className="od-meta">Private customers pay before release</p>
            </div>
          </div>
          {ready.length ? (
            <ul className="od-list" data-testid="ready-list">
              {ready.map((j) => {
                const c = vehicleCustomer(data, j.values.vehicle);
                return (
                  <li key={j.id}>
                    <div className="od-grow">
                      {jobLink(j.id) ? <Link to={jobLink(j.id)!}><b>{vehicleLabel(data, j.values.vehicle)}</b></Link> : <b>{vehicleLabel(data, j.values.vehicle)}</b>}
                      <small>{j.ref} · {str(c, 'name')} · {str(c, 'phone')}</small>
                    </div>
                    <Tag tone={str(c, 'kind') === 'account' ? 'dark' : 'accent'}>{str(c, 'kind') === 'account' ? 'Account' : 'Pay on collection'}</Tag>
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="Nothing waiting for collection" />}
        </section>
      </div>

      <section className="od-more" onKeyDown={(e) => escapeCloses(e, moreOpen, setMoreOpen)}>
        <MoreButton open={moreOpen} onToggle={() => setMoreOpen((v) => !v)} controls="au-more-body" testid="more-toggle" more="Show revenue, stock and recent activity" less="Hide revenue, stock and recent activity" />
        {moreOpen && (
          <div id="au-more-body" className="od-more-body au-more">
            <Panel title="Revenue" meta="Invoiced per month, excl. VAT · labour (accent) vs parts (dark)">
              <BarChart label="Labour and parts revenue per month" data={chart} alt="Parts" format={(n) => formatRand(Math.round(n * 100), { compact: true })} />
              {hasModule('reminders') && <p className="muted-note" style={{ marginTop: 10 }}><Link to={`${base}/reminders`}>{serviceOverdue.length} vehicles are overdue for a service</Link> — log reminders from the service reminders list.</p>}
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
            <Panel title="Recent activity" meta="Actions taken in this browser">
              {data.activity.length ? (
                <ul className="list">
                  {data.activity.slice(0, 7).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
                </ul>
              ) : <Empty title="No activity yet" body="Check a vehicle in, approve an estimate or pass a quality check — actions appear here." />}
            </Panel>
          </div>
        )}
      </section>

      <RoleBar />
    </div>
  );
}

/** "CA 123-456 · Toyota Corolla" → "CA 123-456 · Corolla" keeps the table narrow; the full label is in the title. */
function findReg(full: string) {
  const [reg, rest] = full.split(' · ');
  if (!rest) return full;
  const model = rest.split(' ').slice(1).join(' ') || rest;
  return `${reg} · ${model}`;
}

/**
 * Right side of the flow panel. Shows the licensed cover photo when one is configured
 * (`image` on the industry config, asset manifest GREEN); until then a generic vehicle drawn
 * in SVG in the workshop's colour — no make, badge or number plate.
 */
function VehicleArt({ image, focus }: { image?: string; focus?: string }) {
  if (image) return <div className="od-art has-photo" aria-hidden="true"><img src={image} alt="" loading="lazy" style={{ objectPosition: focus ?? '50% 50%' }} /></div>;
  return (
    <div className="od-art au-art" aria-hidden="true">
      <svg viewBox="0 0 440 260" preserveAspectRatio="xMidYMid meet" focusable="false">
        <defs>
          <linearGradient id="au-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" className="au-stop-tint" /><stop offset="1" className="au-stop-line" /></linearGradient>
          <linearGradient id="au-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="au-stop-glass-a" /><stop offset="1" className="au-stop-glass-b" /></linearGradient>
          <radialGradient id="au-floor" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#0b1626" stopOpacity=".28" /><stop offset="1" stopColor="#0b1626" stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse cx="222" cy="214" rx="196" ry="16" fill="url(#au-floor)" />
        <path className="au-car-body" fill="url(#au-body)" d="M40 186 L38 152 Q40 138 58 133 L112 124 L152 90 Q164 80 182 80 L282 80 Q300 80 312 92 L352 126 L392 134 Q410 139 412 156 L414 186 Q414 194 406 194 L366 194 A38 38 0 0 0 290 194 L160 194 A38 38 0 0 0 84 194 L48 194 Q40 194 40 186 Z" />
        <path className="au-car-glass" fill="url(#au-glass)" d="M132 126 L162 96 Q170 88 182 88 L232 88 L232 126 Z" />
        <path className="au-car-glass" fill="url(#au-glass)" d="M240 88 L282 88 Q294 88 302 96 L334 126 L240 126 Z" />
        <path className="au-car-line" d="M236 126 L236 184 M58 152 L404 152" />
        <rect className="au-car-lamp" x="392" y="140" width="16" height="7" rx="3.5" />
        <rect className="au-car-tail" x="40" y="142" width="10" height="7" rx="3.5" />
        <g className="au-wheel" transform="translate(122 194)"><circle r="31" /><circle className="au-rim" r="17" /><circle className="au-hub" r="5" /></g>
        <g className="au-wheel" transform="translate(328 194)"><circle r="31" /><circle className="au-rim" r="17" /><circle className="au-hub" r="5" /></g>
      </svg>
    </div>
  );
}
