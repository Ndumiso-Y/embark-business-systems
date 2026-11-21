import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, formatDate, parseIso } from '../../../core/lib/dates';
import { Notice, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { LEAVE_TYPES, SITES } from '../data';
import {
  awayOn, covers, currentEmployees, employeeOfUser, fullName, holidayName, isBooked, isHr, isWorkingDay, jobLabel, leaveColour, leaveShort, teamKey, teamLabelOf, teamLimit,
  todayStr, weekStart,
} from '../helpers';
import { LeaveSwatch } from './shared';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Two weeks, team by team: a bar for every day someone is away; team rows turn red over the limit. */
export default function WhosAway() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const me = employeeOfUser(data, user);
  const [offset, setOffset] = useState(0);
  // A depot manager starts on their own depot; HR and head office start on all sites.
  const [siteChoice, setSite] = useState<string | null>(null);
  const site = siteChoice ?? (!isHr(user) && me && str(me, 'site') !== 'ho' ? str(me, 'site') : '');
  const [pending, setPending] = useState(true);
  const [allTeams, setAllTeams] = useState(false);

  const start = addDays(weekStart(today), offset * 7);
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
  const people = currentEmployees(data).filter((e) => !site || str(e, 'site') === site);
  const leave = records(data, 'leave').filter((l) => (isBooked(l) || (pending && l.status === 'requested')) && str(l, 'end') >= start && str(l, 'start') <= days[13]);
  const everyTeam = [...new Set(people.map(teamKey))].sort((a, b) => teamLabelOf(a).localeCompare(teamLabelOf(b)));
  const hasLeave = (key: string) => people.some((e) => teamKey(e) === key && leave.some((l) => str(l, 'employee') === e.id));
  const teams = allTeams ? everyTeam : everyTeam.filter(hasLeave);
  const peopleIn = (key: string) => people.filter((e) => teamKey(e) === key);
  const leaveOfEmp = (e: DemoRecord) => leave.filter((l) => str(l, 'employee') === e.id);
  const bookedAway = (key: string, day: string) => awayOn(data, day, (l) => peopleIn(key).some((p) => p.id === str(l, 'employee'))).length;

  // Summary: the busiest working day and the team-days over the limit in this window.
  const working = days.filter(isWorkingDay);
  const peak = working.map((d) => ({ d, n: awayOn(data, d, (l) => people.some((p) => p.id === str(l, 'employee'))).length })).sort((a, b) => b.n - a.n)[0];
  const over = everyTeam.flatMap((t) => working.filter((d) => bookedAway(t, d) > teamLimit(peopleIn(t).length)).map((d) => ({ t, d })));
  const requested = leave.filter((l) => l.status === 'requested').length;
  const cols = 'var(--hr-name-w) repeat(14, minmax(34px, 1fr))';

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Time off`} title="Who’s away" subtitle="Two weeks at a glance, team by team. A team row shows how many are away each day and turns red when more than a quarter of the team (rounded up) is out." />
      <div className="toolbar">
        <div className="btns">
          <button className="btn sm" onClick={() => setOffset(offset - 2)} aria-label="Previous two weeks">← Earlier</button>
          <button className="btn sm" onClick={() => setOffset(0)} disabled={offset === 0}>This week</button>
          <button className="btn sm" onClick={() => setOffset(offset + 2)} aria-label="Next two weeks">Later →</button>
        </div>
        <select className="select" aria-label="Site" value={site} onChange={(e) => setSite(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All sites</option>
          {SITES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} /> Show requests awaiting approval</label>
        <label className="check"><input type="checkbox" checked={allTeams} onChange={(e) => setAllTeams(e.target.checked)} /> Show teams with nobody away</label>
        <span className="toolbar-count">{formatDate(start)} – {formatDate(days[13])}</span>
      </div>
      <div className="stat-grid">
        <Stat label="Away today" value={awayOn(data, today, (l) => people.some((p) => p.id === str(l, 'employee'))).length} sub={`of ${people.length} people${site ? ' at this site' : ''}`} />
        <Stat label="Busiest working day" value={peak && peak.n ? peak.n : 0} sub={peak && peak.n ? `${DOW[parseIso(peak.d).getDay()]} ${formatDate(peak.d)}` : 'nobody booked'} />
        <Stat label="Team-days over the limit" value={over.length} tone={over.length ? 'red' : undefined} sub={over.length ? `${teamLabelOf(over[0].t)} on ${formatDate(over[0].d).slice(0, 6)}` : 'every team covered'} />
        <Stat label="Requests awaiting approval" value={requested} sub="shown hatched in the calendar" />
      </div>
      <Panel title="Calendar" meta="Weekends and public holidays are shaded. Bars link to the leave request.">
        <ul className="hr-legend" aria-label="Legend">
          {LEAVE_TYPES.filter((t, i, all) => all.findIndex((x) => x.colour === t.colour) === i).map((t) => <li key={t.value}><LeaveSwatch type={t.value} />{t.colour === 'parent' ? 'Maternity / parental' : t.short}</li>)}
          <li><LeaveSwatch type="annual" pending />Awaiting approval</li>
        </ul>
        <div className="hr-cal-wrap" data-testid="whos-away">
          <div className="hr-cal" style={{ gridTemplateColumns: cols }} role="grid" aria-label={`Who is away from ${formatDate(start)} to ${formatDate(days[13])}`}>
            <div className="hr-head hr-name">Team / person</div>
            {days.map((d) => (
              <div key={d} className={`hr-head ${d === today ? 'today' : ''}`} title={holidayName(d)}>
                <span>{DOW[parseIso(d).getDay()]}</span><span>{d.slice(8)}</span>
              </div>
            ))}
            {teams.map((t) => {
              const members = peopleIn(t);
              const limit = teamLimit(members.length);
              const away = members.filter((m) => leaveOfEmp(m).length);
              return (
                <Fragment key={t}>
                  <div className="hr-name hr-team" data-testid={`team-${t}`}>{teamLabelOf(t)}<small>{members.length} · max {limit}</small></div>
                  {days.map((d) => {
                    const n = isWorkingDay(d) ? bookedAway(t, d) : 0;
                    return <div key={d} className={`hr-team-cell ${!isWorkingDay(d) ? 'off' : ''} ${n > limit ? 'over' : n === limit && n > 0 ? 'full' : ''}`} aria-label={`${teamLabelOf(t)} ${formatDate(d)}: ${n} away`}>{n || ''}</div>;
                  })}
                  {away.map((m) => (
                    <Fragment key={m.id}>
                      <div className="hr-name" title={`${fullName(m)} · ${jobLabel(m)}`}>{fullName(m)}</div>
                      {days.map((d) => {
                        const l = leaveOfEmp(m).find((x) => covers(x, d));
                        const off = !isWorkingDay(d);
                        const label = l ? `${fullName(m)} · ${leaveShort(str(l, 'type'))}${l.status === 'requested' ? ' (awaiting approval)' : ''} · ${formatDate(d)}` : '';
                        return (
                          <div key={d} className={`hr-cell ${off ? 'off' : ''} ${d === today ? 'today' : ''}`}>
                            {l && !off && (hasModule('leave')
                              ? <Link to={`${base}/leave/${l.id}`} className={`hr-lv ${leaveColour(str(l, 'type'))}`} style={{ width: '100%' }} aria-label={label} title={label}><span className={`hr-bar ${l.status === 'requested' ? 'pending' : ''}`}>{leaveShort(str(l, 'type'))[0]}</span></Link>
                              : <span className={`hr-lv ${leaveColour(str(l, 'type'))}`} style={{ width: '100%' }} aria-label={label} title={label}><span className={`hr-bar ${l.status === 'requested' ? 'pending' : ''}`}>{leaveShort(str(l, 'type'))[0]}</span></span>)}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </Fragment>
              );
            })}
          </div>
        </div>
        {!teams.length && <div style={{ marginTop: 12 }}><Notice tone="grey">Nobody is away in these two weeks{site ? ' at this site' : ''}.</Notice></div>}
        {!allTeams && everyTeam.length > teams.length && <p className="muted-note" style={{ marginTop: 10 }}>{everyTeam.length - teams.length} team{everyTeam.length - teams.length === 1 ? '' : 's'} with nobody away {everyTeam.length - teams.length === 1 ? 'is' : 'are'} hidden.</p>}
        <p className="muted-note" style={{ marginTop: 10 }}>Team = the same department at the same site. On a phone the calendar scrolls sideways inside its box.</p>
      </Panel>
    </>
  );
}
