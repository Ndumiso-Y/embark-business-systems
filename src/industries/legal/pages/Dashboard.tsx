import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { daysBetween, formatDate, relativeWhen } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { Empty, Flags, Meters, PageHeader, Panel, Pipeline, Stat, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { DAILY_TARGET_HOURS, DIARY_TYPES, FEE_EARNERS, label } from '../data';
import {
  OPEN_MATTER_STATES, clientName, closeProblems, conflictStatus, ficaState, formatCents, invoiceOutstanding, invoiceTotal, matterMoney, matterName,
  todayStr, trustApprovalProblems, trustBalanceOf, upcomingDeadlines, weekStart, wipCents, workingDays,
  diaryWhen,
} from '../helpers';

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const mattersDef = config.collections.find((c) => c.key === 'matters')!;
  const diaryDef = config.collections.find((c) => c.key === 'diary')!;

  const matters = records(data, 'matters');
  const open = matters.filter((m) => OPEN_MATTER_STATES.includes(m.status ?? ''));
  const next7 = upcomingDeadlines(data, today, 7);
  // Same window as the court diary: today to seven days ahead. Overdue items are counted separately.
  const dueWeek = next7.filter((d) => str(d, 'date') >= today);
  const prescriptionSoon = upcomingDeadlines(data, today, 30).filter((d) => str(d, 'type') === 'prescription');
  const awaitingConflict = matters.filter((m) => m.status === 'conflict' && conflictStatus(data, m.id) !== 'cleared');
  const wip = wipCents(data);
  const trust = records(data, 'trust');
  const trustMatters = [...new Set(trust.map((t) => str(t, 'matter')))];
  const trustHeld = trustMatters.reduce((n, id) => n + trustBalanceOf(trust, id), 0);
  const trustPending = trust.filter((t) => t.status === 'captured');
  const invoices = records(data, 'invoices');
  const recent = invoices.filter((i) => daysBetween(str(i, 'date'), today) <= 90);
  const billed = recent.reduce((n, i) => n + invoiceTotal(i), 0);
  const collected = recent.reduce((n, i) => n + Math.min(invoiceTotal(i), toCents(num(i, 'paid'))), 0);
  const overdueInv = invoices.filter((i) => ['issued', 'partpaid'].includes(i.status ?? '') && str(i, 'dueDate') < today);

  // Hours this week per fee earner vs the demo target to date.
  const monday = weekStart(today);
  const daysSoFar = Math.max(1, workingDays(monday, today));
  const weekTime = records(data, 'time').filter((t) => str(t, 'date') >= monday && str(t, 'date') <= today);
  const hours = FEE_EARNERS.map((f) => {
    const mine = weekTime.filter((t) => str(t, 'feeEarner') === f.value);
    const b = Math.round(mine.filter((t) => t.values.billable === true).reduce((n, t) => n + num(t, 'hours'), 0) * 10) / 10;
    const all = Math.round(mine.reduce((n, t) => n + num(t, 'hours'), 0) * 10) / 10;
    return { label: f.label, value: b, max: daysSoFar * DAILY_TARGET_HOURS, tone: (b >= daysSoFar * DAILY_TARGET_HOURS * 0.8 ? 'green' : 'accent') as 'green' | 'accent', sub: `${all} h recorded · ${b} billable` };
  });

  const overdueDiary = records(data, 'diary').filter((d) => d.status === 'upcoming' && str(d, 'date') < today);
  const attention = [
    ...prescriptionSoon.map((d) => ({ key: d.id, to: `diary/${d.id}`, mod: 'diary', tone: 'red' as const, title: `Prescription in ${daysBetween(today, str(d, 'date'))} days — ${matterName(data, d.values.matter)}`, sub: `${formatDate(str(d, 'date'))} · ${str(d, 'title')}` })),
    ...overdueDiary.filter((d) => str(d, 'type') !== 'prescription').map((d) => ({ key: d.id, to: `diary/${d.id}`, mod: 'diary', tone: 'red' as const, title: `Overdue: ${str(d, 'title')}`, sub: `${formatDate(str(d, 'date'))} · ${matterName(data, d.values.matter)}` })),
    ...awaitingConflict.map((m) => ({ key: m.id, to: `matters/${m.id}`, mod: 'matters', tone: 'amber' as const, title: `Conflict clearance needed — ${m.ref}`, sub: str(m, 'name') })),
    ...trustPending.map((t) => {
      const blocked = trustApprovalProblems(t, data);
      return { key: t.id, to: `trust/${t.id}`, mod: 'trust', tone: blocked.length ? 'red' as const : 'amber' as const, title: `Trust ${t.ref} awaiting approval${blocked.length ? ' — exceeds balance' : ''}`, sub: `${formatCents(toCents(num(t, 'amount')))} · ${str(t, 'payee')}` };
    }),
    ...overdueInv.slice(0, 4).map((i) => ({ key: i.id, to: `invoices/${i.id}`, mod: 'invoices', tone: 'amber' as const, title: `Fee note ${i.ref} overdue ${daysBetween(str(i, 'dueDate'), today)} days`, sub: `${clientName(data, matters.find((m) => m.id === str(i, 'matter'))?.values.client)} · ${formatCents(invoiceOutstanding(i))} outstanding` })),
    ...matters.filter((m) => m.status === 'closing').map((m) => ({ m, p: closeProblems(m, data) })).filter((x) => x.p.length).map(({ m, p }) => ({ key: m.id + 'c', to: `matters/${m.id}`, mod: 'matters', tone: 'amber' as const, title: `${m.ref} cannot close yet`, sub: p[0] })),
    ...open.filter((m) => ['active', 'engagement'].includes(m.status ?? '') && ficaState(records(data, 'clients').find((c) => c.id === str(m, 'client')), today) !== 'ok')
      .map((m) => ({ key: m.id + 'f', to: `matters/${m.id}`, mod: 'matters', tone: 'amber' as const, title: `FICA needs attention — ${clientName(data, m.values.client)}`, sub: `${m.ref} · ${str(m, 'name')}` })),
    ...open.filter((m) => m.status === 'active' && num(m, 'estimate') > 0 && matterMoney(data, m.id).recorded > toCents(num(m, 'estimate')))
      .map((m) => ({ key: m.id + 'e', to: `matters/${m.id}`, mod: 'matters', tone: 'amber' as const, title: `Over fee estimate — ${m.ref}`, sub: `${formatCents(matterMoney(data, m.id).recorded)} recorded vs ${formatCents(toCents(num(m, 'estimate')))} estimate` })),
  ].filter((a) => hasModule(a.mod));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={`${formatDate(today)} · practice overview built from the live demo records.`}
        actions={hasModule('diary') ? <Link className="btn primary" to={`${base}/diary`}>Court diary</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">This week at the practice</div>
          <h2>{dueWeek.length} deadline{dueWeek.length === 1 ? '' : 's'} in the next 7 days · {open.length} open matters</h2>
          <p>{prescriptionSoon.length} prescription date{prescriptionSoon.length === 1 ? '' : 's'} within 30 days, {overdueDiary.length} overdue diary item{overdueDiary.length === 1 ? '' : 's'}, {awaitingConflict.length} matter{awaitingConflict.length === 1 ? '' : 's'} waiting for conflict clearance. Trust figures are simulated.</p>
        </div>
        {hasModule('conflicts') && <Link className="btn" to={`${base}/conflicts`}>{awaitingConflict.length} awaiting conflict clearance →</Link>}
      </div>
      <div className="stat-grid">
        <Stat label="Unbilled WIP" value={formatCents(wip)} sub="Billable time not yet billed, excl. VAT" />
        <Stat label="Trust held (simulated)" value={formatCents(trustHeld)} tone="accent" sub={`${trustMatters.filter((id) => trustBalanceOf(trust, id) > 0).length} matters · ${trustPending.length} awaiting approval`} />
        <Stat label="Fees billed vs collected" value={formatCents(collected)} sub={`of ${formatCents(billed)} billed in 90 days (incl. VAT)`} />
        <Stat label="Deadlines next 7 days" value={dueWeek.length} tone={prescriptionSoon.some((d) => daysBetween(today, str(d, 'date')) <= 7) || overdueDiary.length ? 'red' : undefined} sub={`${dueWeek.filter((d) => str(d, 'type') === 'court').length} court · ${dueWeek.filter((d) => str(d, 'type') === 'prescription').length} prescription${overdueDiary.length ? ` · plus ${overdueDiary.length} overdue` : ''}`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Deadlines — overdue and next 7 days" meta={`Prescription dates first, then by date · ${overdueDiary.length} overdue + ${dueWeek.length} due`} right={hasModule('diary') ? <Link className="btn sm" to={`${base}/diary`}>Diary</Link> : undefined}>
          {next7.length ? (
            <ul className="list" data-testid="deadline-list">
              {next7.map((d) => (
                <li key={d.id} style={str(d, 'type') === 'prescription' ? { borderLeft: '4px solid var(--danger)', paddingLeft: 10 } : undefined}>
                  <span className="time-chip">{diaryWhen(d)}</span>
                  <div className="grow">
                    {hasModule('diary') ? <Link to={`${base}/diary/${d.id}`}><b>{str(d, 'title')}</b></Link> : <b>{str(d, 'title')}</b>}
                    <small>{label(DIARY_TYPES, str(d, 'type'))} · {matterName(data, d.values.matter)}</small>
                  </div>
                  <Flags flags={diaryDef.flags?.(d, data, today) ?? []} />
                </li>
              ))}
            </ul>
          ) : <Empty title="No deadlines in the next 7 days" />}
        </Panel>
        <div className="stack">
          <Panel title="Needs attention" meta="Prescription, overdue diary, conflicts, trust approvals, overdue fees, closure, FICA, estimates">
            {attention.length ? (
              <ul className="list" data-testid="attention-list">
                {attention.slice(0, 9).map((a) => (
                  <li key={a.key}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
                ))}
              </ul>
            ) : <Empty title="Nothing needs attention" />}
          </Panel>
          {hasModule('matters') && (
            <Panel title="Matters by stage" right={<Link className="btn sm" to={`${base}/matters`}>Matters</Link>}>
              <Pipeline stages={mattersDef.workflow!.states.filter((s) => !s.terminal).map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: matters.filter((m) => m.status === s.key).length }))} />
            </Panel>
          )}
        </div>
      </div>
      <div className="grid-2">
        <Panel title="Awaiting conflict clearance" meta="Engagement is blocked until a partner clears the check">
          {awaitingConflict.length ? (
            <ul className="list">
              {awaitingConflict.map((m) => {
                const s = conflictStatus(data, m.id);
                return (
                  <li key={m.id}>
                    <div className="grow">
                      {hasModule('matters') ? <Link to={`${base}/matters/${m.id}`}><b>{str(m, 'name')}</b></Link> : <b>{str(m, 'name')}</b>}
                      <small>{m.ref} · {clientName(data, m.values.client)}{str(m, 'opposingParty') ? ` v ${str(m, 'opposingParty')}` : ''}</small>
                    </div>
                    <Tag tone={s === 'pending' ? 'amber' : 'dark'}>{s === 'pending' ? 'Check recorded' : 'No check yet'}</Tag>
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="No matters awaiting clearance" />}
        </Panel>
        <Panel title="Hours this week" meta={`Billable hours per fee earner vs ${DAILY_TARGET_HOURS} h/day demo target (${daysSoFar} working day${daysSoFar === 1 ? '' : 's'} so far)`}>
          <Meters format={(n) => `${n} h`} items={hours} />
        </Panel>
      </div>
      <Panel title="Recent activity" meta="Actions taken in this browser">
        {data.activity.length ? (
          <ul className="list">
            {data.activity.slice(0, 7).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
          </ul>
        ) : <Empty title="No activity yet" body="Clear a conflict, bill a matter’s time or approve a trust payment — actions appear here." />}
      </Panel>
      <div className="section-gap" />
      <RoleBar />
    </>
  );
}
