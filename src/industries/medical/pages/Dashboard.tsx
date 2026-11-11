import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { daysBetween, formatDate, monthKeys, monthShort, relativeWhen } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { BarChart, Empty, PageHeader, Panel, Pipeline, Stat, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { CHRONIC_CONDITIONS, TESTS, VISIT_TYPES, label } from '../data';
import { byDateTime, minutesWaiting, needsDoctor, outstandingCents, overdueChronic, patientName, scriptAllergyBlock, shownTime, todayStr, unreviewedAbnormal, vitalAlerts, WAITING_STATES } from '../helpers';

type Tone = 'red' | 'amber' | 'blue';

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule, can } = useUser();
  const today = todayStr();
  const visitDef = config.collections.find((c) => c.key === 'visits')!;

  const todays = records(data, 'visits').filter((v) => str(v, 'date') === today).sort(byDateTime);
  const inPractice = todays.filter((v) => WAITING_STATES.includes(v.status ?? ''));
  const waitingForDoctor = todays.filter((v) => ['arrived', 'triaged'].includes(v.status ?? '')).sort((a, b) => (str(a, 'arrivedAt') || '99').localeCompare(str(b, 'arrivedAt') || '99'));
  const abnormal = unreviewedAbnormal(data);
  const results = records(data, 'results');
  const lateResults = results.filter((r) => r.status === 'requested' && daysBetween(str(r, 'requestedOn'), today) > 7);
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

  const attention: Array<{ to: string; title: string; sub: string; tone: Tone; mod: string }> = [
    ...(can('clinical.view') ? inPractice.filter((v) => vitalAlerts(v.values).length).map((v) => ({ to: `waiting/${v.id}`, title: `${patientName(data, v.values.patient)} — for doctor review (demo rule)`, sub: vitalAlerts(v.values).map((a) => a.label.replace(' — for doctor review (demo rule)', '')).join(' · '), tone: 'amber' as Tone, mod: 'waiting' })) : []),
    ...abnormal.map((r) => ({ to: `results/${r.id}`, title: `Abnormal ${label(TESTS, str(r, 'test'))} not reviewed`, sub: `${patientName(data, r.values.patient)} · received ${formatDate(str(r, 'receivedOn'))}`, tone: 'red' as Tone, mod: 'results' })),
    ...blockedScripts.map((s) => ({ to: `scripts/${s.id}`, title: `Script ${s.ref} blocked by recorded allergy`, sub: patientName(data, s.values.patient), tone: 'red' as Tone, mod: 'scripts' })),
    ...lateResults.map((r) => ({ to: `results/${r.id}`, title: `${label(TESTS, str(r, 'test'))} awaiting result ${daysBetween(str(r, 'requestedOn'), today)} days`, sub: patientName(data, r.values.patient), tone: 'amber' as Tone, mod: 'results' })),
    ...unsigned.map((c) => ({ to: `consults/${c.id}`, title: `Consultation ${c.ref} not signed`, sub: `${patientName(data, c.values.patient)} · ${formatDate(str(c, 'date'))}`, tone: 'amber' as Tone, mod: 'consults' })),
    ...overdue.slice(0, 4).map((c) => ({ to: `chronic/${c.id}`, title: `${label(CHRONIC_CONDITIONS, str(c, 'condition'))} review ${daysBetween(str(c, 'nextReview'), today)} days overdue`, sub: patientName(data, c.values.patient), tone: 'red' as Tone, mod: 'chronic' })),
    ...rejected.map((c) => ({ to: `claims/${c.id}`, title: `Claim ${c.ref} rejected`, sub: `${patientName(data, c.values.patient)} · correct and resubmit or bill patient`, tone: 'red' as Tone, mod: 'claims' })),
  ].filter((a) => hasModule(a.mod));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.replace(/^(Dr|Sr)\s+/, '').split(' ')[0]}`} subtitle={`${formatDate(today)} · practice overview built from the live demo records.`}
        actions={hasModule('waiting') ? <Link className="btn primary" to={`${base}/waiting`}>Open waiting room</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">Today in the practice</div>
          <h2>{todays.length} visits · {inPractice.length} patient{inPractice.length === 1 ? '' : 's'} in the practice now</h2>
          <p>{todays.filter((v) => v.status === 'done').length} seen and checked out, {todays.filter((v) => v.status === 'arrived').length} waiting for triage, {todays.filter((v) => v.status === 'triaged').length} triaged and waiting for a doctor, {todays.filter((v) => v.status === 'booked').length} still to arrive, {todays.filter((v) => v.status === 'dna').length} did not attend.</p>
        </div>
        {hasModule('results') && <Link className="btn" to={`${base}/results`}>{abnormal.length} abnormal result{abnormal.length === 1 ? '' : 's'} to review →</Link>}
      </div>
      <div className="stat-grid">
        <Stat label="In the waiting room" value={waitingForDoctor.length} sub={`${inPractice.length} in the practice · ${todays.filter((v) => v.status === 'withdoctor').length} with a doctor`} />
        <Stat label="Abnormal results not reviewed" value={abnormal.length} tone={abnormal.length ? 'red' : undefined} sub={`${results.filter((r) => r.status === 'received').length} received · ${lateResults.length} awaiting > 7 days`} />
        <Stat label="Chronic reviews overdue" value={overdue.length} tone={overdue.length ? 'red' : undefined} sub={`${records(data, 'chronic').filter((c) => c.status === 'active').length} active on the register`} />
        <Stat label="Claims outstanding" value={formatRand(outstandingValue, { compact: true })} tone="accent" sub={`${open.length} open · ${drafts.length} drafts · ${rejected.length} rejected`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <div className="stack">
          <Panel title="Waiting room by stage" meta="Today’s visits" right={hasModule('waiting') ? <Link className="btn sm" to={`${base}/waiting`}>Queue board</Link> : undefined}>
            <Pipeline stages={visitDef.workflow!.states.filter((s) => !['cancelled'].includes(s.key)).map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: todays.filter((v) => v.status === s.key).length }))} />
          </Panel>
          <Panel title="Waiting longest" meta="Arrived or triaged, earliest arrival first">
            {waitingForDoctor.length ? (
              <ul className="list" data-testid="waiting-longest">
                {waitingForDoctor.map((v) => {
                  const mins = minutesWaiting(v, today);
                  return (
                    <li key={v.id}>
                      <span className="time-chip">{shownTime(str(v, 'arrivedAt')) || str(v, 'time')}</span>
                      <div className="grow">
                        {hasModule('waiting') ? <Link to={`${base}/waiting/${v.id}`}><b>{patientName(data, v.values.patient)}</b></Link> : <b>{patientName(data, v.values.patient)}</b>}
                        <small>{label(VISIT_TYPES, str(v, 'type'))} · booked {str(v, 'time')}{mins !== null ? ` · waiting ${mins} min` : ''}</small>
                      </div>
                      <Tag tone={v.status === 'arrived' ? 'blue' : 'accent'}>{v.status === 'arrived' ? 'Needs triage' : 'Triaged'}</Tag>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty title="Nobody waiting" />}
          </Panel>
        </div>
        <Panel title="Needs attention" meta="Rules: vitals highlights (demo), abnormal and late results, unsigned notes, allergy blocks, overdue chronic reviews, rejected claims">
          {attention.length ? (
            <ul className="list" data-testid="attention-list">
              {attention.slice(0, 10).map((a) => (
                <li key={a.to + a.title}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
              ))}
            </ul>
          ) : <Empty title="Nothing needs attention" />}
        </Panel>
      </div>
      <div className="grid-2">
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
      <RoleBar />
    </>
  );
}
