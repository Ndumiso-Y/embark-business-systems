import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { formatDate, monthLabel, parseIso, relativeWhen } from '../../../core/lib/dates';
import { BarChart, Empty, PageHeader, Panel, Pipeline, Stat, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import {
  chronicAbsentees, classLearners, className, collectedIn, coverGaps, dayAttendance, detentionList, enrolledLearners, familyName, fullName, isMerit, ownClass, rand, registerDates, registerFor,
  registersOutstanding, runFor, runTotal, schoolAgeing, signBlockers, sortedClasses, staffFlags, termLabel, termOf, todayStr,
} from '../helpers';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const month = today.slice(0, 7);
  const term = termOf(today);
  const classes = sortedClasses(data);
  const enrolled = enrolledLearners(data).length;
  const capacity = classes.reduce((n, c) => n + (Number(c.values.capacity) || 0), 0);
  const day = dayAttendance(data, today);
  const outstanding = registersOutstanding(data, today);
  const chronic = chronicAbsentees(data);
  const apps = records(data, 'applications');
  const appStates = config.collections.find((c) => c.key === 'applications')!.workflow!.states.filter((s) => !s.terminal);
  const tasks = records(data, 'assessments');
  const toModerate = tasks.filter((t) => t.status === 'captured');
  const toPublish = tasks.filter((t) => t.status === 'moderated');
  const reports = records(data, 'reports').filter((r) => str(r, 'term') === term);
  const toSign = reports.filter((r) => r.status === 'commented');
  const signable = toSign.filter((r) => !signBlockers(r, data).length);
  const run = runFor(data, month);
  const collected = collectedIn(data, month);
  const age = schoolAgeing(data, today);
  const cover = records(data, 'leave').filter((l) => l.status === 'open' && str(l, 'date') === today && coverGaps(l, data).length > 0);
  const incidents = records(data, 'discipline').filter((r) => !isMerit(r) && r.status !== 'resolved');
  const detentions = detentionList(data, today);
  const waiting = records(data, 'payments').filter((p) => p.status === 'received');
  const mine = ownClass(data, user);
  const myRegister = mine ? registerFor(data, mine.id, today) : undefined;
  const seeFees = hasModule('fees');
  const staffIssues = records(data, 'staff').filter((s) => staffFlags(s, data, today).some((f) => f.tone === 'red' && !f.label.startsWith('Absent')));

  const chart = registerDates(data).slice(-10).map((d) => ({ label: `${DOW[parseIso(d).getDay()]} ${d.slice(8)}`, value: dayAttendance(data, d).pct }));

  // The first thing each role would do in the morning.
  const action =
    user.role === 'bursar' && hasModule('fees') ? { to: 'fees', label: run ? 'Open fees & accounts' : `Raise ${monthLabel(month)} invoices` }
    : user.role === 'secretary' && hasModule('admissions') ? { to: 'admissions', label: 'Open admissions' }
    : mine && hasModule('attendance') ? { to: `attendance?class=${mine.id}`, label: myRegister?.status === 'submitted' ? `${str(mine, 'name')} register submitted` : `Take the ${str(mine, 'name')} register` }
    : user.role === 'subjectteacher' && hasModule('assessments') ? { to: 'assessments', label: 'Capture and moderate marks' }
    : user.role === 'liaison' && hasModule('attendance') ? { to: 'attendance', label: 'Follow up today’s absences' }
    : hasModule('reportcards') && signable.length ? { to: 'reportcards', label: `Sign ${signable.length} report cards` }
    : hasModule('attendance') ? { to: 'attendance', label: 'Open daily attendance' } : null;

  const attention = [
    ...cover.map((l) => ({ to: `cover/${l.id}`, title: `${fullName(records(data, 'staff').find((s) => s.id === str(l, 'staff')))} is absent — ${coverGaps(l, data).length} periods need cover`, sub: 'Assign a free teacher to each period', tone: 'red' as const, mod: 'cover' })),
    ...(outstanding.length ? [{ to: 'attendance', title: `${outstanding.length} class register${outstanding.length === 1 ? '' : 's'} not submitted today`, sub: outstanding.map((c) => str(c, 'name')).join(' · '), tone: 'red' as const, mod: 'attendance' }] : []),
    ...chronic.map((c) => ({ to: `learners/${c.learner.id}`, title: `${fullName(c.learner)} absent ${c.run} school days in a row`, sub: `${className(data, str(c.learner, 'class'))} · contact the family`, tone: 'red' as const, mod: 'learners' })),
    ...(toModerate.length ? [{ to: 'assessments', title: `${toModerate.length} assessment task${toModerate.length === 1 ? '' : 's'} awaiting moderation`, sub: 'Captured marks need a second person', tone: 'amber' as const, mod: 'assessments' }] : []),
    ...(toSign.length ? [{ to: 'reportcards', title: `${toSign.length} report cards awaiting sign-off`, sub: `${signable.length} ready · ${toSign.length - signable.length} held up by unpublished marks`, tone: 'amber' as const, mod: 'reportcards' }] : []),
    ...apps.filter((a) => a.status === 'offered').map((a) => ({ to: `admissions/${a.id}`, title: `Offer out to ${fullName(a)}`, sub: `Made ${formatDate(str(a, 'offerDate'))} · a place is held`, tone: 'amber' as const, mod: 'admissions' })),
    ...incidents.filter((r) => str(r, 'severity') === 'serious').map((r) => ({ to: `discipline/${r.id}`, title: `Serious incident: ${fullName(records(data, 'learners').find((l) => l.id === str(r, 'learner')))}`, sub: `Logged ${formatDate(str(r, 'date'))} · for the deputy or principal to resolve`, tone: 'red' as const, mod: 'discipline' })),
    ...(waiting.length ? [{ to: 'payments', title: `${waiting.length} payment${waiting.length === 1 ? '' : 's'} to allocate`, sub: 'Bank deposits not yet on a family account', tone: 'amber' as const, mod: 'payments' }] : []),
    ...[...age.inArrears].filter((r) => r.age.d90 > 0).slice(0, 3).map((r) => ({ to: `fees/${r.account.id}`, title: `${familyName(data, str(r.account, 'family'))}: ${rand(r.age.d90)} is 90+ days overdue`, sub: `Total owing ${rand(r.balance)}`, tone: 'red' as const, mod: 'fees' })),
    ...staffIssues.map((s) => ({ to: `staff/${s.id}`, title: `${fullName(s)}: ${staffFlags(s, data, today).filter((f) => f.tone === 'red')[0].label.toLowerCase()}`, sub: 'Staff compliance', tone: 'amber' as const, mod: 'staff' })),
  ].filter((a) => hasModule(a.mod));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.replace(/^Dr /, '').split(' ')[0]}`} subtitle={`${formatDate(today)} · ${termLabel(term)} · built from the live demo records.`}
        actions={action ? <Link className="btn primary" to={`${base}/${action.to}`} data-testid="primary-action">{action.label}</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">School today</div>
          <h2>{day.roll ? `${day.pct}% of learners present` : 'No registers submitted yet'} · {classes.length - outstanding.length} of {classes.length} registers in</h2>
          <p>{enrolled} learners enrolled in {classes.length} classes. {day.absent} absent and {day.late} late on the registers submitted so far; {chronic.length} learner{chronic.length === 1 ? ' has' : 's have'} been away three or more school days in a row.</p>
        </div>
        {hasModule('attendance') ? <Link className="btn" to={`${base}/attendance`}>{outstanding.length} register{outstanding.length === 1 ? '' : 's'} outstanding →</Link>
          : hasModule('fees') ? <Link className="btn" to={`${base}/fees`}>{age.inArrears.length} families in arrears →</Link>
          : hasModule('assessments') ? <Link className="btn" to={`${base}/assessments`}>{toModerate.length} tasks to moderate →</Link> : null}
      </div>
      <div className="stat-grid">
        <Stat label="Learners enrolled" value={`${enrolled}/${capacity}`} sub={`${capacity - enrolled} places free · ${classes.filter((c) => classLearners(data, c.id).length >= (Number(c.values.capacity) || 0)).length} classes full`} />
        <Stat label="Attendance today" value={day.roll ? `${day.pct}%` : '—'} tone={outstanding.length ? 'red' : 'accent'} sub={`${outstanding.length} register${outstanding.length === 1 ? '' : 's'} outstanding`} />
        <Stat label="Marks awaiting moderation" value={toModerate.length} tone={toModerate.length ? 'red' : undefined} sub={`${toPublish.length} moderated and waiting to be published`} />
        <Stat label="Report cards awaiting sign-off" value={toSign.length} sub={`${signable.length} ready · ${termLabel(term)}`} />
      </div>
      <div className="stat-grid">
        {seeFees ? (
          <>
            <Stat label={`Fees collected · ${monthLabel(month)}`} value={rand(collected)} tone="accent" sub={run ? `of ${rand(runTotal(run))} billed this month` : 'this month’s invoices not raised yet'} />
            <Stat label="Fees in arrears (30+ days)" value={rand(age.arrears)} tone={age.arrears ? 'red' : undefined} sub={`${age.inArrears.length} families · ${rand(age.d90)} at 90+ days`} />
          </>
        ) : (
          <>
            <Stat label="Open incidents" value={incidents.length} tone={incidents.length ? 'red' : undefined} sub={`${incidents.filter((r) => str(r, 'severity') === 'serious').length} serious`} />
            <Stat label="Detentions to serve" value={detentions.length} sub={detentions[0] ? `next on ${formatDate(str(detentions[0], 'detentionDate'))}` : 'none booked'} />
          </>
        )}
        <Stat label="Chronic absence alerts" value={chronic.length} tone={chronic.length ? 'red' : undefined} sub="absent 3+ school days in a row" />
        <Stat label="Applications in progress" value={apps.filter((a) => !['enrolled', 'declined'].includes(a.status ?? '')).length} sub={`${apps.filter((a) => a.status === 'waitlisted').length} on the waiting list`} />
      </div>
      <div className="grid-2">
        <div className="stack">
          <Panel title="Admissions pipeline" meta="Applications by stage" right={hasModule('admissions') ? <Link className="btn sm" to={`${base}/admissions`}>Open admissions</Link> : undefined}>
            <Pipeline stages={appStates.map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: apps.filter((a) => a.status === s.key).length }))} />
          </Panel>
          <Panel title="Attendance — last ten school days" meta="Learners present or late ÷ learners on submitted registers">
            {chart.length ? <BarChart label="Attendance percentage per school day" data={chart} format={(n) => `${n}%`} /> : <Empty title="No registers submitted yet" />}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Needs attention" meta="Cover, registers, absences, moderation, sign-off, offers, arrears">
            {attention.length ? (
              <ul className="list" data-testid="attention-list">
                {attention.slice(0, 9).map((a) => (
                  <li key={a.to + a.title}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
                ))}
              </ul>
            ) : <Empty title="Nothing needs attention" />}
            {attention.length > 9 && <p className="muted-note" style={{ marginTop: 8 }}>{attention.length - 9} more — see the module registers.</p>}
          </Panel>
          <Panel title="Recent activity" meta="Actions taken in this browser">
            {data.activity.length ? (
              <ul className="list">
                {data.activity.slice(0, 6).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
              </ul>
            ) : <Empty title="No activity yet" body="Take a register, capture marks or record a payment — actions appear here." />}
            {cover.length === 0 && outstanding.length === 0 && <p className="muted-note" style={{ marginTop: 10 }}><Tag tone="green">All registers in</Tag></p>}
          </Panel>
        </div>
      </div>
      <RoleBar />
    </>
  );
}
