import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Notice, PageHeader, Panel, Segmented, Stat, Tag } from '../../../core/components/ui';
import { RecordTable, WorkflowActions } from '../../../core/components/records';
import { IcoArrow, IcoBack } from '../../../core/components/Icons';
import { SHIFT_KINDS, SHIFT_SHORT } from '../data';
import { coverage, currentSlot, officerName, postLabel, shiftsIn, slotPhase, workingOfficerId } from '../helpers';
import { DAYS_AHEAD, DAYS_BACK } from '../seed';
import { pctTone, useClock } from './format';

export default function Roster() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { can } = useUser();
  const { today, time } = useClock();
  const cur = currentSlot(today, time);
  const [date, setDate] = useState(cur.date);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const def = act.def('roster');
  const wf = def.workflow!;
  const sites = records(data, 'sites');
  const posts = records(data, 'posts');
  const byKind = { day: shiftsIn(data, date, 'day'), night: shiftsIn(data, date, 'night') };
  const cover = { day: coverage(data, date, 'day'), night: coverage(data, date, 'night') };
  const unfilled = [...cover.day.unfilled.map((u) => ({ ...u, kind: 'day' })), ...cover.night.unfilled.map((u) => ({ ...u, kind: 'night' }))];
  const all = [...byKind.day, ...byKind.night];
  const absent = all.filter((r) => r.status === 'absent' || !!str(r, 'reliefOfficer')).length;
  const shiftFor = (post: DemoRecord) => byKind[str(post, 'shift') === 'night' ? 'night' : 'day'].find((r) => str(r, 'post') === post.id);
  const phaseOf = (kind: string) => slotPhase(date, kind, today, time);
  const phaseLabel = (kind: string) => ({ past: 'completed', current: 'running now', future: 'upcoming' }[phaseOf(kind)]);

  const addShift = (post: DemoRecord) => {
    const r = act.create('roster', { date, post: post.id, officer: '' }, 'open', 'Shift added to the roster');
    navigate(`${base}/roster/${r.id}`);
  };

  const chip = (post: DemoRecord) => {
    const r = shiftFor(post);
    const req = `Grade ${str(post, 'grade')}${post.values.armed === true ? ' · armed' : ''}`;
    if (!r) {
      return (
        <div key={post.id} className="appt tone-dark" style={{ borderStyle: 'dashed' }}>
          <b>{str(post, 'name')}</b>
          <small>Not rostered · {req}</small>
          {can('roster.manage') && <button type="button" className="link-btn" onClick={() => addShift(post)}>Add to roster</button>}
        </div>
      );
    }
    const st = wf.states.find((s) => s.key === r.status);
    const who = workingOfficerId(r);
    return (
      <Link key={post.id} to={`${base}/roster/${r.id}`} className={`appt tone-${st?.tone ?? 'dark'}`} data-testid="roster-chip" style={{ textDecoration: 'none', opacity: 1 }}>
        <b>{str(post, 'name')}</b>
        <small>{who ? officerName(data, who) : r.status === 'absent' ? `${officerName(data, r.values.officer)} — absent` : 'No officer posted'}{str(r, 'reliefOfficer') && who ? ' (relief)' : ''}</small>
        <small>{st?.label} · {req}</small>
      </Link>
    );
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Control room`} title="Duty roster" subtitle="Day (06:00–18:00) and night (18:00–06:00) shifts per site and post. Posting an officer checks PSIRA registration, grade, armed-post competency, site induction, overlapping shifts and a demo rest rule." />
      <div className="toolbar diary-nav">
        <button className="btn sm" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><IcoBack /></button>
        <input className="input sm" type="date" aria-label="Roster date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 160 }} />
        <button className="btn sm" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><IcoArrow /></button>
        {date !== cur.date && <button className="btn sm" onClick={() => setDate(cur.date)}>Current shift</button>}
        <b className="diary-date">{formatDate(date)}{date === today ? ' · today' : date === addDays(today, 1) ? ' · tomorrow' : ''}</b>
        <div style={{ marginLeft: 'auto' }}>
          <Segmented label="Roster view" value={view} onChange={setView} options={[{ value: 'grid', label: 'Grid by site' }, { value: 'list', label: 'List with actions' }]} />
        </div>
      </div>
      <div className="stat-grid compact">
        <Stat label={`Day shift · ${phaseLabel('day')}`} value={`${cover.day.pct}%`} tone={cover.day.unfilled.length ? 'red' : 'accent'} sub={`${cover.day.covered}/${cover.day.posts} posts covered · ${cover.day.onDuty} on duty`} />
        <Stat label={`Night shift · ${phaseLabel('night')}`} value={`${cover.night.pct}%`} tone={cover.night.unfilled.length ? 'red' : 'accent'} sub={`${cover.night.covered}/${cover.night.posts} posts covered · ${cover.night.onDuty} on duty`} />
        <Stat label="Unfilled posts" value={unfilled.length} tone={unfilled.length ? 'red' : undefined} sub="no officer, or absent without relief" />
        <Stat label="Absences" value={absent} sub={`${all.filter((r) => !!str(r, 'reliefOfficer') && r.status !== 'absent').length} covered by a relief officer`} />
      </div>
      <div className="section-gap" />
      {!all.length && <Notice tone="grey">No shifts are rostered for {formatDate(date)}. The demo roster covers {DAYS_BACK} days back and {DAYS_AHEAD} days ahead — use “Add to roster” on a post to plan further out.</Notice>}
      {unfilled.length > 0 && (
        <Panel title="Unfilled posts" meta="Open the shift to pick an officer — ineligible officers are refused with the reason">
          <ul className="list" data-testid="roster-unfilled">
            {unfilled.map((u) => (
              <li key={u.post.id}>
                <span className="dot red" />
                <div className="grow">
                  <b>{postLabel(data, u.post)}</b>
                  <small>{SHIFT_SHORT[u.kind]} shift · {u.reason} · Grade {str(u.post, 'grade')}{u.post.values.armed === true ? ' · armed post' : ''}</small>
                </div>
                {u.shift ? <Link className="btn sm primary" to={`${base}/roster/${u.shift.id}`}>{u.shift.status === 'absent' ? 'Assign relief' : 'Fill post'}</Link>
                  : can('roster.manage') ? <button className="btn sm" onClick={() => addShift(u.post)}>Add to roster</button> : null}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {view === 'grid' ? (
        <Panel title="Roster grid by site" meta="Each card is one post for the shift: officer, status and the post’s requirements. Click a card to open the shift.">
          <div className="table-wrap">
            <table className="table" data-testid="roster-grid">
              <thead><tr><th style={{ width: '22%' }}>Site</th>{SHIFT_KINDS.map((k) => <th key={k.value}>{k.label}<small> · {cover[k.value as 'day' | 'night'].pct}% covered</small></th>)}</tr></thead>
              <tbody>
                {sites.map((s) => {
                  const mine = posts.filter((p) => str(p, 'site') === s.id);
                  const d = coverage(data, date, 'day', s.id);
                  const n = coverage(data, date, 'night', s.id);
                  const p = d.posts + n.posts ? Math.round(((d.covered + n.covered) / (d.posts + n.posts)) * 100) : 0;
                  return (
                    <tr key={s.id}>
                      <td style={{ verticalAlign: 'top' }}>
                        <Link to={`${base}/sites/${s.id}`}><strong>{str(s, 'name')}</strong></Link>
                        <small>{str(s, 'code')} · {mine.length} post{mine.length === 1 ? '' : 's'}</small>
                        <div style={{ marginTop: 6 }}><Tag tone={pctTone(p)}>{d.covered + n.covered}/{d.posts + n.posts} · {p}%</Tag></div>
                      </td>
                      {(['day', 'night'] as const).map((k) => (
                        <td key={k} style={{ verticalAlign: 'top' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                            {mine.filter((x) => (str(x, 'shift') === 'night' ? 'night' : 'day') === k).map(chip)}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <Panel title={`Shifts on ${formatDate(date)}`} meta="Book on, book off, mark absent — each step applies the roster rules">
          {all.length ? <RecordTable def={def} rows={[...all].sort((a, b) => (a.status === 'onduty' ? 0 : 1) - (b.status === 'onduty' ? 0 : 1))} moduleKey="roster" extra={{ head: 'Next step', cell: (r) => <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><WorkflowActions def={def} record={r} compact /></div> }} />
            : <Empty title="No shifts on this date" />}
        </Panel>
      )}
    </>
  );
}
