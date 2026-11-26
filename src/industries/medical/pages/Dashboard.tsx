import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { daysBetween, formatDate, monthKeys, monthShort, parseIso, relativeWhen } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { BarChart, Empty, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { IcoAlert, IcoArrow, IcoCalendar, IcoChevron, IcoClock, IcoFlask, IcoHeart, IcoReceipt, IcoStethoscope, IcoUsers } from '../../../core/components/Icons';
import RoleBar from '../../../core/components/RoleBar';
import { FlowRing, Kpi, MoreButton } from '../../../core/components/overview';
import { escapeCloses, initialsOf, WEEKDAYS } from '../../../core/lib/overview';
import { CHRONIC_CONDITIONS, CLINICIANS, TESTS, VISIT_TYPES, label } from '../data';
import { byDateTime, minutesWaiting, needsDoctor, nowTime, outstandingCents, overdueChronic, patientName, scriptAllergyBlock, shownTime, todayStr, unreviewedAbnormal, vitalAlerts } from '../helpers';
import { cliniciansNow, flowRing, nowAndNext, visitFlow, visitsByHour, waitingLongest, IN_PRACTICE } from '../dashboardModel';
import '../medical.css';

type Tone = 'red' | 'amber' | 'blue';

/**
 * Medical practice dashboard. Approved concept and design record:
 * docs/design/08_medical_dashboard_addendum_2026-11.md. Every figure comes from the demo
 * records (definitions in ../dashboardModel.ts); nothing here is typed in.
 */
export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule, can } = useUser();
  const today = todayStr();
  const visitDef = config.collections.find((c) => c.key === 'visits')!;
  const resultDef = config.collections.find((c) => c.key === 'results')!;

  const todays = records(data, 'visits').filter((v) => str(v, 'date') === today).sort(byDateTime);
  const flow = visitFlow(todays);
  const inPractice = todays.filter((v) => (IN_PRACTICE as readonly string[]).includes(v.status ?? ''));
  const waiting = waitingLongest(todays);
  const longestWait = waiting.map((v) => minutesWaiting(v, today)).find((m) => m !== null) ?? null;
  const abnormal = unreviewedAbnormal(data);
  const results = records(data, 'results');
  const received = results.filter((r) => r.status === 'received');
  const awaitingLab = results.filter((r) => r.status === 'requested');
  const lateResults = awaitingLab.filter((r) => daysBetween(str(r, 'requestedOn'), today) > 7);
  const overdue = overdueChronic(data, today);
  const claims = records(data, 'claims');
  const open = claims.filter((c) => ['submitted', 'partpaid', 'patient'].includes(c.status ?? ''));
  const drafts = claims.filter((c) => c.status === 'draft');
  const rejected = claims.filter((c) => c.status === 'rejected');
  const outstandingValue = open.reduce((n, c) => n + outstandingCents(c), 0);
  const unsigned = records(data, 'consults').filter((c) => c.status !== 'signed');
  const blockedScripts = records(data, 'scripts').filter((s) => s.status === 'draft' && scriptAllergyBlock(s, data));
  const consults = records(data, 'consults');

  const months = monthKeys(today, 6);
  const chart = months.map((m) => ({
    label: monthShort(m),
    value: consults.filter((c) => c.status === 'signed' && str(c, 'date').startsWith(m)).length,
    alt: records(data, 'visits').filter((v) => v.status === 'done' && str(v, 'date').startsWith(m) && !needsDoctor(v)).length,
  }));

  // Unchanged rules from the previous dashboard; safety-relevant, so always reachable.
  const attention: Array<{ to: string; title: string; sub: string; tone: Tone; mod: string }> = [
    ...(can('clinical.view') ? inPractice.filter((v) => vitalAlerts(v.values).length).map((v) => ({ to: `waiting/${v.id}`, title: `${patientName(data, v.values.patient)} — for doctor review (demo rule)`, sub: vitalAlerts(v.values).map((a) => a.label.replace(' — for doctor review (demo rule)', '')).join(' · '), tone: 'amber' as Tone, mod: 'waiting' })) : []),
    ...abnormal.map((r) => ({ to: `results/${r.id}`, title: `Abnormal ${label(TESTS, str(r, 'test'))} not reviewed`, sub: `${patientName(data, r.values.patient)} · received ${formatDate(str(r, 'receivedOn'))}`, tone: 'red' as Tone, mod: 'results' })),
    ...blockedScripts.map((s) => ({ to: `scripts/${s.id}`, title: `Script ${s.ref} blocked by recorded allergy`, sub: patientName(data, s.values.patient), tone: 'red' as Tone, mod: 'scripts' })),
    ...lateResults.map((r) => ({ to: `results/${r.id}`, title: `${label(TESTS, str(r, 'test'))} awaiting result ${daysBetween(str(r, 'requestedOn'), today)} days`, sub: patientName(data, r.values.patient), tone: 'amber' as Tone, mod: 'results' })),
    ...unsigned.map((c) => ({ to: `consults/${c.id}`, title: `Consultation ${c.ref} not signed`, sub: `${patientName(data, c.values.patient)} · ${formatDate(str(c, 'date'))}`, tone: 'amber' as Tone, mod: 'consults' })),
    ...overdue.slice(0, 4).map((c) => ({ to: `chronic/${c.id}`, title: `${label(CHRONIC_CONDITIONS, str(c, 'condition'))} review ${daysBetween(str(c, 'nextReview'), today)} days overdue`, sub: patientName(data, c.values.patient), tone: 'red' as Tone, mod: 'chronic' })),
    ...rejected.map((c) => ({ to: `claims/${c.id}`, title: `Claim ${c.ref} rejected`, sub: `${patientName(data, c.values.patient)} · correct and resubmit or bill patient`, tone: 'red' as Tone, mod: 'claims' })),
  ].filter((a) => hasModule(a.mod));

  const [dayOpen, setDayOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const preview = nowAndNext(todays, 5);
  const scheduleRows = dayOpen ? todays : preview;
  const attentionRows = attentionOpen ? attention : attention.slice(0, 4);
  const clinicians = cliniciansNow(todays, CLINICIANS);
  const weekday = WEEKDAYS[parseIso(today).getDay()];
  const visitLink = (id: string) => (hasModule('waiting') ? `${base}/waiting/${id}` : undefined);
  const jumpToAttention = () => {
    const el = document.getElementById('md-attention');
    el?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  };

  return (
    <div className="od md">
      <header className="od-head">
        <div>
          <h1 className="od-title">{`Good day, ${user.name.replace(/^(Dr|Sr)\s+/, '').split(' ')[0]}`}</h1>
          <p className="od-sub">A clear view of {config.businessName} and today’s patient care.</p>
        </div>
        <div className="od-head-actions">
          <span className="od-date"><IcoCalendar />{weekday}, {formatDate(today)}</span>
          {attention.length > 0 && (
            <button type="button" className="md-alert-chip" onClick={jumpToAttention} data-testid="attention-jump">
              <IcoAlert />{attention.length} need{attention.length === 1 ? 's' : ''} attention
            </button>
          )}
          {hasModule('waiting') && <Link className="btn primary" to={`${base}/waiting`}>Open waiting room</Link>}
        </div>
      </header>

      <section className="od-kpis" aria-label="Today at a glance">
        <Kpi featured icon={IcoCalendar} label="Visits today" value={todays.length} testid="kpi-visits"
          sub={`${flow.booked} still to arrive · ${flow.done} done`} to={hasModule('waiting') ? `${base}/waiting` : undefined} />
        <Kpi icon={IcoUsers} label="In the waiting room" value={waiting.length} testid="kpi-waiting"
          sub={waiting.length ? `${todays.filter((v) => v.status === 'arrived').length} need triage${longestWait !== null ? ` · longest ${longestWait} min` : ''}` : `${inPractice.length} in the practice`}
          to={hasModule('waiting') ? `${base}/waiting` : undefined} />
        {hasModule('results') && (
          <Kpi icon={IcoFlask} label="Abnormal results to review" value={abnormal.length} tone={abnormal.length ? 'red' : undefined} testid="kpi-results"
            sub={`${received.length} received · ${lateResults.length} awaiting > 7 days`} to={`${base}/results`} />
        )}
        {hasModule('chronic') && (
          <Kpi icon={IcoHeart} label="Chronic reviews overdue" value={overdue.length} tone={overdue.length ? 'red' : undefined} testid="kpi-chronic"
            sub={`${records(data, 'chronic').filter((c) => c.status === 'active').length} active on the register`} to={`${base}/chronic`} />
        )}
        {hasModule('claims') && (
          <Kpi icon={IcoReceipt} label="Claims outstanding" value={formatRand(outstandingValue, { compact: true })} tone="accent" testid="kpi-claims"
            sub={`${open.length} open · ${drafts.length} drafts · ${rejected.length} rejected`} to={`${base}/claims`} />
        )}
      </section>

      <div className="od-row od-row-main">
        <section className="od-panel md-overview" aria-labelledby="md-overview-title">
          <div className="md-overview-top">
            <div className="od-flow-info">
              <h2 id="md-overview-title" className="od-h2">Practice overview</h2>
              <p className="od-meta">Today’s patient flow · live from the waiting room</p>
              {flow.expected > 0 ? (
                <div className="od-flow-body">
                  <FlowRing pct={flow.donePct} segments={flowRing(flow)} caption="done" label={`${flow.done} of ${flow.expected} visits done`} />
                  <dl className="od-legend">
                    <div><dt><i className="tone-muted" />Still to arrive</dt><dd>{flow.booked}</dd></div>
                    <div><dt><i className="tone-a40" />Waiting to be seen</dt><dd>{flow.waiting}</dd></div>
                    <div><dt><i className="tone-a65" />With a doctor</dt><dd>{flow.withDoctor}</dd></div>
                    <div><dt><i className="tone-a85" />At billing</dt><dd>{flow.billing}</dd></div>
                    <div><dt><i className="tone-accent" />Done</dt><dd>{flow.done}</dd></div>
                    <div><dt><i className="tone-warn" />Did not attend</dt><dd>{flow.dna}</dd></div>
                    {flow.cancelled > 0 && <div><dt><i className="tone-none" />Cancelled (not counted)</dt><dd>{flow.cancelled}</dd></div>}
                  </dl>
                </div>
              ) : <Empty title="No visits booked today" />}
            </div>
            <ClinicArt image={config.image} focus={config.imageFocus} />
          </div>
          {flow.expected > 0 && (
            <>
              <p className="od-flow-note md-flow-note"><b>{flow.done} of {flow.expected}</b> visits done (checked out). {flow.waiting + flow.withDoctor + flow.billing} patients are in the practice now.</p>
              <HourChart todays={todays} />
            </>
          )}
        </section>

        <section className="od-panel od-diary" aria-labelledby="md-schedule-title" onKeyDown={(e) => escapeCloses(e, dayOpen, setDayOpen)}>
          <div className="od-panel-head">
            <span className="od-medal"><IcoCalendar /></span>
            <div className="od-grow">
              <h2 id="md-schedule-title" className="od-h2">Today’s schedule</h2>
              <p className="od-meta">{dayOpen ? `All ${todays.length} visits` : 'Now and next'}</p>
            </div>
            {hasModule('waiting') && <Link className="od-link" to={`${base}/waiting`}>Waiting room <IcoArrow /></Link>}
          </div>
          {todays.length ? (
            <>
              <ul className="od-list" data-testid="schedule-list" id="md-schedule-list">
                {scheduleRows.map((v) => {
                  const to = visitLink(v.id);
                  const name = patientName(data, v.values.patient);
                  return (
                    <li key={v.id}>
                      <span className="od-time">{str(v, 'time')}</span>
                      <span className="od-bar" aria-hidden="true" />
                      <div className="od-grow">
                        {to ? <Link to={to}><b>{name}</b></Link> : <b>{name}</b>}
                        <small>{label(VISIT_TYPES, str(v, 'type'))} · {CLINICIANS.find((c) => c.value === str(v, 'clinician'))?.short ?? '—'}</small>
                      </div>
                      <StatusTag workflow={visitDef.workflow} status={v.status} />
                    </li>
                  );
                })}
              </ul>
              {todays.length > preview.length && (
                <MoreButton open={dayOpen} onToggle={() => setDayOpen((v) => !v)} controls="md-schedule-list" testid="schedule-toggle"
                  more={`Show all ${todays.length} visits`} less="Show the practice now and next only" />
              )}
            </>
          ) : <Empty title="No visits booked today" />}
        </section>
      </div>

      <div className="od-row od-row-three">
        <section className="od-panel" aria-labelledby="md-waiting-title">
          <div className="od-panel-head">
            <span className="od-medal"><IcoClock /></span>
            <div className="od-grow">
              <h2 id="md-waiting-title" className="od-h2">Waiting longest</h2>
              <p className="od-meta">Arrived or triaged, earliest arrival first</p>
            </div>
          </div>
          {waiting.length ? (
            <ul className="od-list" data-testid="waiting-longest">
              {waiting.map((v) => {
                const mins = minutesWaiting(v, today);
                const name = patientName(data, v.values.patient);
                const to = visitLink(v.id);
                return (
                  <li key={v.id}>
                    <span className="od-avatar" aria-hidden="true">{initialsOf(name)}</span>
                    <div className="od-grow">
                      {to ? <Link to={to}><b>{name}</b></Link> : <b>{name}</b>}
                      <small>{shownTime(str(v, 'arrivedAt')) ? `Arrived ${shownTime(str(v, 'arrivedAt'))} · ` : ''}booked {str(v, 'time')}{mins !== null ? ` · waiting ${mins} min` : ''}</small>
                    </div>
                    <Tag tone={v.status === 'arrived' ? 'blue' : 'accent'}>{v.status === 'arrived' ? 'Needs triage' : 'Triaged'}</Tag>
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="Nobody waiting" />}
        </section>

        <section className="od-panel" aria-labelledby="md-clinicians-title">
          <div className="od-panel-head">
            <span className="od-medal"><IcoStethoscope /></span>
            <div className="od-grow">
              <h2 id="md-clinicians-title" className="od-h2">Clinicians now</h2>
              <p className="od-meta">From today’s visits</p>
            </div>
          </div>
          <ul className="od-list md-clinicians" data-testid="clinicians-now">
            {clinicians.map((c) => (
              <li key={c.value}>
                <span className="od-avatar" aria-hidden="true">{initialsOf(c.label.replace(/^(Dr|Sr)\s+/, ''))}</span>
                <div className="od-grow">
                  <b title={c.label}>{c.short}</b>
                  <small>{c.role} · {c.seen} seen · {c.booked} to come</small>
                  {c.current && (
                    <small className="md-with">With {visitLink(c.current.id) ? <Link to={visitLink(c.current.id)!}>{patientName(data, c.current.values.patient)}</Link> : patientName(data, c.current.values.patient)}</small>
                  )}
                </div>
                <Tag tone={c.current ? 'amber' : 'green'}>{c.current ? 'Busy' : 'Free'}</Tag>
              </li>
            ))}
          </ul>
        </section>

        {hasModule('results') && (
          <section className="od-panel" aria-labelledby="md-results-title">
            <div className="od-panel-head">
              <span className="od-medal"><IcoFlask /></span>
              <div className="od-grow">
                <h2 id="md-results-title" className="od-h2">Results inbox</h2>
                <p className="od-meta">Pathology and imaging results</p>
              </div>
              <Link className="od-link" to={`${base}/results`}>View all <IcoArrow /></Link>
            </div>
            <div className="md-results" data-testid="results-summary">
              <Link className="md-results-big" to={`${base}/results`}><b>{received.length}</b><span>received and waiting for a doctor’s review</span></Link>
              <div className="md-results-rows">
                <Link className={`md-results-row ${abnormal.length ? 'is-red' : ''}`} to={`${base}/results`}><IcoAlert /><b>{abnormal.length}</b><span>abnormal</span></Link>
                <Link className="md-results-row" to={`${base}/results`}><IcoFlask /><b>{received.length - abnormal.length}</b><span>normal</span></Link>
                <Link className={`md-results-row ${lateResults.length ? 'is-amber' : ''}`} to={`${base}/results`}><IcoClock /><b>{awaitingLab.length}</b><span>at the lab{lateResults.length ? ` (${lateResults.length} late)` : ''}</span></Link>
              </div>
            </div>
            <p className="md-results-foot">States: {resultDef.workflow!.states.filter((s) => !s.terminal || s.key === 'informed').map((s) => s.label).join(' → ')}</p>
          </section>
        )}
      </div>

      <section className="od-panel md-attention" id="md-attention" tabIndex={-1} aria-labelledby="md-attention-title" onKeyDown={(e) => escapeCloses(e, attentionOpen, setAttentionOpen)}>
        <div className="od-panel-head">
          <span className="od-medal is-alert"><IcoAlert /></span>
          <div className="od-grow">
            <h2 id="md-attention-title" className="od-h2">Needs attention</h2>
            <p className="od-meta">{attention.length ? `${attention.length} item${attention.length === 1 ? '' : 's'} · vitals highlights (demo), abnormal and late results, unsigned notes, allergy blocks, overdue chronic reviews, rejected claims` : 'Vitals, results, notes, scripts, chronic reviews and claims'}</p>
          </div>
        </div>
        {attention.length ? (
          <>
            <ul className="od-list is-links md-attention-list" data-testid="attention-list" id="md-attention-list">
              {attentionRows.map((a) => (
                <li key={a.to + a.title}>
                  <span className={`od-medal is-small is-${a.tone}`}><IcoAlert /></span>
                  <div className="od-grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div>
                  <IcoChevron className="ico od-chev" />
                </li>
              ))}
            </ul>
            {attention.length > 4 && (
              <MoreButton open={attentionOpen} onToggle={() => setAttentionOpen((v) => !v)} controls="md-attention-list" testid="attention-toggle"
                more={`Show all ${attention.length}`} less="Show the first four" />
            )}
          </>
        ) : <Empty title="Nothing needs attention" />}
      </section>

      <section className="od-more" onKeyDown={(e) => escapeCloses(e, moreOpen, setMoreOpen)}>
        <MoreButton open={moreOpen} onToggle={() => setMoreOpen((v) => !v)} controls="md-more-body" testid="more-toggle" more="Show trends and recent activity" less="Hide trends and recent activity" />
        {moreOpen && (
          <div id="md-more-body" className="grid-2 od-more-body">
            <Panel title="Consultations per month" meta="Last six months · signed doctor consultations (accent) vs nurse-only visits (dark)">
              <BarChart label="Consultations and nurse visits per month" data={chart} alt="Nurse visits" />
            </Panel>
            <Panel title="Recent activity" meta="Actions taken in this browser">
              {data.activity.length ? (
                <ul className="list">
                  {data.activity.slice(0, 7).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
                </ul>
              ) : <Empty title="No activity yet" body="Check a patient in, capture vitals or sign a consultation — actions appear here." />}
            </Panel>
          </div>
        )}
      </section>

      <RoleBar />
    </div>
  );
}

/** Today's visits by booked hour; hours already past are drawn in full colour. */
function HourChart({ todays }: { todays: ReturnType<typeof records> }) {
  const hours = visitsByHour(todays);
  const max = Math.max(1, ...hours.map((h) => h.count));
  const nowHour = Number(nowTime().slice(0, 2));
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <figure className="md-hours" role="img" aria-label={`Visits by booked hour today: ${hours.filter((h) => h.count).map((h) => `${pad(h.hour)}:00 ${h.count}`).join(', ')}`}>
      <figcaption>Visits by booked hour (today)</figcaption>
      <div className="md-hours-bars" aria-hidden="true">
        {hours.map((h) => (
          <div key={h.hour} className={`md-hour${h.hour < nowHour ? ' is-past' : h.hour === nowHour ? ' is-now' : ''}`}>
            <span className="md-hour-count">{h.count || ''}</span>
            <span className="md-hour-bar" style={{ height: `${(h.count / max) * 100}%` }} />
            <span className="md-hour-label">{pad(h.hour)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/**
 * Right side of the overview panel. Shows the licensed cover photo when one is configured
 * (`image` on the industry config, asset manifest GREEN); until then an abstract pulse
 * line drawn in SVG in the practice's own colour. No people are depicted.
 */
function ClinicArt({ image, focus }: { image?: string; focus?: string }) {
  if (image) return <div className="od-art has-photo" aria-hidden="true"><img src={image} alt="" loading="lazy" style={{ objectPosition: focus ?? '50% 50%' }} /></div>;
  return (
    <div className="od-art md-art" aria-hidden="true">
      <svg viewBox="0 0 320 300" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <radialGradient id="md-orb" cx="35%" cy="28%" r="85%"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset="1" className="md-stop-accent" stopOpacity=".28" /></radialGradient>
          <filter id="md-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18" /></filter>
        </defs>
        <ellipse className="md-art-glow" cx="180" cy="150" rx="130" ry="110" filter="url(#md-blur)" />
        <circle className="md-art-ring" cx="186" cy="150" r="104" />
        <circle className="md-art-orb" cx="186" cy="150" r="88" fill="url(#md-orb)" />
        <circle className="md-art-orb" cx="70" cy="236" r="40" fill="url(#md-orb)" />
        <circle className="md-art-orb" cx="268" cy="54" r="26" fill="url(#md-orb)" />
        <path className="md-art-cross" d="M174 104h24v34h34v24h-34v34h-24v-34h-34v-24h34z" />
        <path className="md-art-pulse" d="M8 196h96l14-30 18 62 18-96 16 76 12-12h138" />
      </svg>
    </div>
  );
}
