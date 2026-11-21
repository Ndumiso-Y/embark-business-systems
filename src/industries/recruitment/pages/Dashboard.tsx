import { Link } from 'react-router-dom';
import { num, records, str } from '../../../core/engine';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { addDays, daysBetween, formatDate, monthKeys, monthShort, relativeWhen } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { BarChart, Empty, Meters, PageHeader, Panel, Pipeline, Stat, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { FORMATS, ROUNDS, label } from '../data';
import {
  JOB_LIVE, SUB_LIVE, addMonths, candidateName, clientName, consentState, deskOf, estFee, feesBilled, interviewsFor, invoiceOverdue, invoiceTotals, jobFlags, jobOf, jobTitle,
  monthRange, mondayOf, overCap, pct, plural, quarterRange, rand, randc, s198aCheck, sendCvProblems, submissionOf, teamTarget, termsCurrent, todayStr, weightedPipeline,
} from '../helpers';

type Tone = 'red' | 'amber' | 'accent';

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule, can } = useUser();
  const today = todayStr();
  const seeFees = can('fees.view');
  const subDef = config.collections.find((c) => c.key === 'submissions')!;

  const jobs = records(data, 'jobs');
  const live = jobs.filter((j) => JOB_LIVE.includes(j.status ?? ''));
  const stale = live.filter((j) => jobFlags(j, data, today).some((f) => f.label.includes('no CVs sent')));
  const subs = records(data, 'submissions');
  const offers = subs.filter((s) => s.status === 'offer');
  const offerFees = offers.reduce((n, s) => n + Math.round((estFee(jobOf(data, str(s, 'job')), data) * num(s, 'offerPackage')) / Math.max(1, num(jobOf(data, str(s, 'job')), 'package'))), 0);
  const weekFrom = mondayOf(today);
  // The working week: Monday of this week to six days ahead, so a weekend visit still shows the week coming up.
  const weekTo = addDays(today, 6) > addDays(weekFrom, 6) ? addDays(today, 6) : addDays(weekFrom, 6);
  const interviews = records(data, 'interviews');
  const thisWeek = interviews.filter((i) => i.status !== 'cancelled' && str(i, 'date') >= weekFrom && str(i, 'date') <= weekTo)
    .sort((a, b) => (str(a, 'date') + str(a, 'time')).localeCompare(str(b, 'date') + str(b, 'time')));
  const todayCount = thisWeek.filter((i) => str(i, 'date') === today && i.status === 'scheduled').length;
  const month = monthRange(today);
  const placedThisMonth = records(data, 'placements').filter((p) => str(p, 'acceptedOn') >= month.from && str(p, 'acceptedOn') <= month.to);
  const fees = feesBilled(data, month.from, month.to);
  const target = teamTarget(data);
  const wp = weightedPipeline(data);
  const timesheets = records(data, 'timesheets');
  const awaiting = timesheets.filter((t) => t.status === 'submitted');
  const candidates = records(data, 'candidates').filter((c) => !['archived'].includes(c.status ?? ''));
  const expiring = candidates.filter((c) => consentState(c, today) === 'expiring');
  const expired = candidates.filter((c) => ['active', 'screened'].includes(c.status ?? '') && consentState(c, today) === 'expired');
  const overdue = records(data, 'invoices').filter((i) => invoiceOverdue(i, today));
  const overdueValue = overdue.reduce((n, i) => n + invoiceTotals(i).total, 0);
  const desk = deskOf(data, user);
  const myTarget = toCents(num(desk, 'monthlyTarget'));
  const q = quarterRange(today);

  const attention: Array<{ key: string; to: string; mod: string; tone: Tone; title: string; sub: string }> = [
    ...stale.map((j) => ({ key: j.id, to: `jobs/${j.id}`, mod: 'jobs', tone: 'red' as Tone, title: `${str(j, 'title')} — open ${daysBetween(str(j, 'openedOn'), today)} days, no CVs sent`, sub: `${clientName(data, str(j, 'client'))} · ${j.ref}` })),
    ...records(data, 'clients').filter((c) => live.some((j) => str(j, 'client') === c.id) && !termsCurrent(c, today)).map((c) => ({ key: c.id, to: `clients/${c.id}`, mod: 'clients', tone: 'red' as Tone,
      title: `${str(c, 'name')}: terms of business not current`, sub: `Live job orders but terms ${c.status === 'expired' ? 'expired' : 'unsigned'} · renew before more CVs go` })),
    ...records(data, 'clients').filter((c) => c.status === 'signed' && termsCurrent(c, today) && daysBetween(today, str(c, 'termsExpiry')) <= 30).map((c) => ({ key: `${c.id}e`, to: `clients/${c.id}`, mod: 'clients', tone: 'amber' as Tone,
      title: `${str(c, 'name')}: terms expire ${formatDate(str(c, 'termsExpiry'))}`, sub: 'Record the renewed terms or new jobs cannot be opened' })),
    ...interviews.filter((i) => i.status === 'scheduled' && str(i, 'date') < today).map((i) => {
      const s = submissionOf(data, str(i, 'submission'));
      return { key: i.id, to: `interviews/${i.id}`, mod: 'interviews', tone: 'amber' as Tone, title: `Interview feedback outstanding — ${candidateName(data, str(s, 'candidate'))}`, sub: `${formatDate(str(i, 'date'))} · ${jobTitle(data, str(s, 'job'))}` };
    }),
    ...offers.map((s) => ({ key: s.id, to: `pipeline/${s.id}`, mod: 'pipeline', tone: 'accent' as Tone, title: `Offer out — ${candidateName(data, str(s, 'candidate'))}`,
      sub: `${jobTitle(data, str(s, 'job'))} · made ${formatDate(str(s, 'offerMadeOn'))} · start ${formatDate(str(s, 'offerStart'))}` })),
    ...subs.filter((s) => s.status === 'longlist' && JOB_LIVE.includes(jobOf(data, str(s, 'job'))?.status ?? '') && sendCvProblems(s, data, today).length).map((s) => ({ key: `${s.id}l`, to: `pipeline/${s.id}`, mod: 'pipeline', tone: 'amber' as Tone,
      title: `CV blocked — ${candidateName(data, str(s, 'candidate'))}`, sub: sendCvProblems(s, data, today)[0].split('. ')[0] })),
    ...records(data, 'placements').filter((p) => p.status === 'accepted' && str(p, 'startDate') <= today).map((p) => ({ key: p.id, to: `placements/${p.id}`, mod: 'placements', tone: 'amber' as Tone,
      title: `Confirm start — ${candidateName(data, str(p, 'candidate'))}`, sub: `Due to start ${formatDate(str(p, 'startDate'))} · the fee invoice is raised on start` })),
    ...records(data, 'placements').filter((p) => p.status === 'started' && str(p, 'guaranteeEnd') < today).map((p) => ({ key: `${p.id}g`, to: `placements/${p.id}`, mod: 'placements', tone: 'accent' as Tone,
      title: `Guarantee ended — ${candidateName(data, str(p, 'candidate'))}`, sub: `Ended ${formatDate(str(p, 'guaranteeEnd'))} · mark the guarantee passed` })),
    ...awaiting.map((t) => ({ key: t.id, to: `timesheets/${t.id}`, mod: 'timesheets', tone: (overCap(t) ? 'red' : 'amber') as Tone,
      title: `Timesheet awaiting approval — ${config.collections.find((c) => c.key === 'timesheets')!.title(t, data)}`, sub: `${t.ref}${overCap(t) ? ' · above the weekly hours cap' : ''}` })),
    ...records(data, 'assignments').filter((a) => s198aCheck(a, today)).map((a) => {
      const s = s198aCheck(a, today)!;
      return { key: a.id, to: `contractors/${a.id}`, mod: 'contractors', tone: (s.passed ? 'red' : 'amber') as Tone, title: `s198A demo flag — ${candidateName(data, str(a, 'candidate'))}`,
        sub: `${s.passed ? 'Passed' : 'Reaches'} 3 months ${formatDate(s.threeMonths)} · below the illustrative earnings figure` };
    }),
    ...expired.slice(0, 4).map((c) => ({ key: c.id, to: `candidates/${c.id}`, mod: 'candidates', tone: 'amber' as Tone, title: `Consent expired — ${candidateName(data, c.id)}`, sub: `${c.ref} · active candidate · record renewed consent before sending CVs` })),
    ...overdue.map((i) => ({ key: i.id, to: `invoices/${i.id}`, mod: 'invoices', tone: 'red' as Tone, title: `Invoice overdue — ${clientName(data, str(i, 'client'))}`,
      sub: `${i.ref} · ${randc(invoiceTotals(i).total)} · due ${formatDate(str(i, 'dueDate'))}` })),
  ].filter((a) => hasModule(a.mod));

  const chart = monthKeys(today, 6).map((k) => {
    const from = `${k}-01`;
    const to = addDays(addMonths(from, 1), -1);
    return seeFees
      ? { label: monthShort(k), value: Math.round(feesBilled(data, from, to) / 100), alt: Math.round(target / 100) }
      : { label: monthShort(k), value: subs.filter((s) => str(s, 'submittedOn') >= from && str(s, 'submittedOn') <= to).length, alt: records(data, 'placements').filter((p) => str(p, 'acceptedOn') >= from && str(p, 'acceptedOn') <= to).length };
  });

  const hero = seeFees
    ? { kicker: 'Fees this month', h: `${rand(fees)} billed · ${pct(fees, target)}% of the ${rand(target)} target`, p: `${plural(placedThisMonth.length, 'placement')} this month, ${plural(offers.length, 'offer')} out and ${rand(wp.total)} in the weighted pipeline across ${plural(live.length, 'live job')}.` }
    : hasModule('timesheets')
      ? { kicker: 'Contractor desk', h: `${plural(awaiting.length, 'timesheet')} awaiting client approval`, p: `${plural(records(data, 'assignments').filter((a) => a.status === 'active').length, 'contractor')} on assignment, ${plural(timesheets.filter((t) => t.status === 'approved').length, 'approved week')} to invoice and ${plural(records(data, 'assignments').filter((a) => s198aCheck(a, today)).length, 'illustrative s198A flag')}.` }
      : { kicker: 'The desk today', h: `${plural(subs.filter((s) => SUB_LIVE.includes(s.status ?? '')).length, 'candidate')} in play · ${plural(todayCount, 'interview')} today`, p: `${plural(subs.filter((s) => s.status === 'longlist').length, 'CV')} longlisted and waiting to be sent, ${plural(stale.length, 'job')} with no CVs after two weeks and ${plural(expiring.length, 'consent')} lapsing within 30 days.` };
  const heroLink = hasModule('pipeline') ? { to: 'pipeline', label: 'Open the pipeline board →' } : hasModule('timesheets') ? { to: 'timesheets', label: 'Timesheets to approve →' } : hasModule('invoices') ? { to: 'invoices', label: `${plural(overdue.length, 'invoice')} overdue →` } : null;

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={`${formatDate(today)} · recruitment overview built from the live demo records.`}
        actions={hasModule('interviews') ? <Link className="btn primary" to={`${base}/interviews`}>This week’s interviews</Link> : hasModule('invoices') ? <Link className="btn primary" to={`${base}/invoices`}>Invoices</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">{hero.kicker}</div>
          <h2>{hero.h}</h2>
          <p>{hero.p}</p>
        </div>
        {heroLink && <Link className="btn" to={`${base}/${heroLink.to}`}>{heroLink.label}</Link>}
      </div>
      <div className="stat-grid">
        <Stat label="Open jobs" value={live.length} tone="accent" sub={`${stale.length} with no CVs after 14 days · ${jobs.filter((j) => j.status === 'onhold').length} on hold`} />
        <Stat label="Interviews this week" value={thisWeek.length} sub={`${todayCount} today · ${interviews.filter((i) => i.status === 'scheduled' && str(i, 'date') < today).length} awaiting feedback`} />
        <Stat label="Offers out" value={offers.length} sub={seeFees ? `${rand(offerFees)} in fees if accepted` : 'awaiting the candidate’s answer'} />
        <Stat label="Placements this month" value={placedThisMonth.length} sub={seeFees ? `fees ${rand(fees)} of ${rand(target)} target (${pct(fees, target)}%)` : 'offers accepted'} />
      </div>
      <div className="stat-grid">
        <Stat label="Weighted pipeline" value={seeFees ? rand(wp.total) : '—'} sub={seeFees ? `estimated fees × stage probability, ${plural(live.length, 'live job')}` : 'fee figures hidden for your role'} />
        <Stat label="Timesheets awaiting approval" value={awaiting.length} tone={awaiting.some(overCap) ? 'red' : undefined} sub={`${awaiting.filter(overCap).length} above the weekly cap`} />
        <Stat label="Consents expiring" value={expiring.length} tone={expired.length ? 'red' : undefined} sub={`within 30 days · ${expired.length} active candidates already expired`} />
        <Stat label="Invoices overdue" value={overdue.length} tone={overdue.length ? 'red' : undefined} sub={can('fees.view') || can('invoices.manage') ? `${randc(overdueValue)} incl. VAT` : 'past their due date'} />
      </div>
      <div className="grid-2">
        <Panel title="Interviews this week" meta={`${formatDate(weekFrom)} – ${formatDate(weekTo)}`} right={hasModule('interviews') ? <Link className="btn sm" to={`${base}/interviews`}>Diary</Link> : undefined}>
          {thisWeek.length ? (
            <ul className="list" data-testid="week-interviews">
              {thisWeek.map((i) => {
                const s = submissionOf(data, str(i, 'submission'));
                return (
                  <li key={i.id}>
                    <span className="time-chip">{str(i, 'date') === today ? 'Today' : formatDate(str(i, 'date')).slice(0, 6)} {str(i, 'time')}</span>
                    <div className="grow">
                      {hasModule('interviews') ? <Link to={`${base}/interviews/${i.id}`}><b>{candidateName(data, str(s, 'candidate'))}</b></Link> : <b>{candidateName(data, str(s, 'candidate'))}</b>}
                      <small>{jobTitle(data, str(s, 'job'))} · {label(ROUNDS, str(i, 'round')).toLowerCase()} · {label(FORMATS, str(i, 'format')).toLowerCase()}</small>
                    </div>
                    <Tag tone={i.status === 'completed' ? 'green' : i.status === 'scheduled' && str(i, 'date') < today ? 'red' : 'blue'}>{i.status === 'completed' ? 'Done' : i.status === 'noshow' ? 'No-show' : str(i, 'date') < today ? 'Feedback due' : 'Booked'}</Tag>
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="No interviews this week" />}
        </Panel>
        <div className="stack">
          <Panel title="Needs attention" meta={`${plural(attention.length, 'item')} for your role · stale jobs, terms, feedback, offers, blocked CVs, starts, timesheets, consent, invoices`}>
            {attention.length ? (
              <ul className="list" data-testid="attention-list">
                {attention.slice(0, 10).map((a) => (
                  <li key={a.key}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
                ))}
                {attention.length > 10 && <li><span className="muted-note">+ {attention.length - 10} more — open the module registers to see them all.</span></li>}
              </ul>
            ) : <Empty title="Nothing needs attention" />}
          </Panel>
          {desk && myTarget > 0 && seeFees && (
            <Panel title="Your desk" meta={`${str(desk, 'name')} · fees credited to you`}>
              <Meters format={(n) => rand(n)} items={[
                { label: 'This month', value: feesBilled(data, month.from, month.to, desk.id), max: myTarget, tone: 'accent' },
                { label: q.label, value: feesBilled(data, q.from, q.to, desk.id), max: myTarget * 3, tone: 'accent' },
              ]} />
            </Panel>
          )}
        </div>
      </div>
      <div className="grid-2">
        <Panel title="Candidates by stage" meta="Every live job order" right={hasModule('pipeline') ? <Link className="btn sm" to={`${base}/pipeline`}>Pipeline</Link> : undefined}>
          <Pipeline stages={subDef.workflow!.states.filter((s) => !s.terminal).map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: subs.filter((x) => x.status === s.key).length }))} />
          <p className="muted-note" style={{ marginTop: 10 }}>{plural(subs.filter((s) => str(s, 'submittedOn') >= addDays(today, -30)).length, 'CV')} sent in the last 30 days · {plural(subs.filter((s) => interviewsFor(data, s.id).some((i) => str(i, 'date') >= addDays(today, -30))).length, 'candidate')} interviewed.</p>
        </Panel>
        <Panel title={seeFees ? 'Fees billed vs target' : 'CVs sent and placements'} meta={seeFees ? 'Last six months · billed (accent) against the team’s monthly target (dark), excl. VAT' : 'Last six months · CVs sent (accent) and offers accepted (dark)'}>
          <BarChart label={seeFees ? 'Fees billed and target per month' : 'CVs sent and placements per month'} data={chart} alt={seeFees ? 'Target' : 'Placements'} format={seeFees ? (n) => rand(n * 100) : undefined} />
        </Panel>
      </div>
      <Panel title="Recent activity" meta="Actions taken in this browser">
        {data.activity.length ? (
          <ul className="list">
            {data.activity.slice(0, 7).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
          </ul>
        ) : <Empty title="No activity yet" body="Open a job order, send a CV or accept an offer — actions appear here." />}
      </Panel>
      <div className="section-gap" />
      <RoleBar />
    </>
  );
}
