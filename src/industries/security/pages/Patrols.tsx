import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Field, Notice, PageHeader, Panel, Stat, Tag } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { PATROL_GRACE_MIN, SHIFT_SHORT, checkpointList } from '../data';
import { currentSlot, minutesBetween, officerName, patrolCompleteProblem, patrolLateBy, patrolMissed, shiftsIn, siteName, siteOfShift, workingOfficerId, duration } from '../helpers';
import { useClock } from './format';

export default function Patrols() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const { today, time } = useClock();
  const def = act.def('patrols');
  const cur = currentSlot(today, time);
  const sites = records(data, 'sites');
  const all = [...records(data, 'patrols')].sort(def.sort);
  const running = all.filter((p) => p.status === 'started');
  const since = addDays(today, -3);
  const recent = all.filter((p) => p.status === 'completed' && str(p, 'date') >= since);
  const missed = recent.reduce((n, p) => n + patrolMissed(p), 0);
  const scanned = recent.reduce((n, p) => n + num(p, 'scanned'), 0);
  const total = recent.reduce((n, p) => n + num(p, 'checkpoints'), 0);
  const late = recent.filter((p) => patrolLateBy(p) > 0).length;
  const [site, setSite] = useState('');
  const [officer, setOfficer] = useState('');
  const [due, setDue] = useState('');
  const onDuty = shiftsIn(data, cur.date, cur.kind).filter((r) => r.status === 'onduty' && (!site || siteOfShift(data, r)?.id === site));

  const start = () => {
    const s = sites.find((x) => x.id === site);
    if (!s) { act.toast('Choose the site for the patrol round.', 'err'); return; }
    if (!(num(s, 'checkpoints') > 0)) { act.toast(`${str(s, 'name')} has no patrol checkpoints set up.`, 'err'); return; }
    const who = officer || (onDuty[0] ? workingOfficerId(onDuty[0]) : '');
    const r = act.create('patrols', { site, date: today, shift: currentSlot(today, time).kind, dueAt: due || time, startedAt: time, officer: who, checkpoints: num(s, 'checkpoints') }, 'started', 'Patrol round started');
    act.toast(`${r.ref} started at ${str(s, 'name')} — scan the checkpoints below`);
    setDue('');
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Sites & guarding`} title="Patrols & checkpoints" subtitle="Start a round, tick off each checkpoint as it is scanned and complete the round. Scans are simulated — no guard-tour hardware is connected. Missed checkpoints and late rounds are flagged." />
      <div className="stat-grid">
        <Stat label="Rounds in progress" value={running.length} tone={running.length ? 'accent' : undefined} sub={`${SHIFT_SHORT[cur.kind]} shift`} />
        <Stat label="Rounds (last 3 days)" value={recent.length} sub={`${scanned} of ${total} checkpoints scanned`} />
        <Stat label="Checkpoints missed" value={missed} tone={missed ? 'red' : undefined} sub={`${recent.filter((p) => patrolMissed(p) > 0).length} rounds with a missed point`} />
        <Stat label="Late rounds" value={late} tone={late ? 'red' : undefined} sub={`started more than ${PATROL_GRACE_MIN} min after the due time`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Rounds in progress" meta="Tick the checkpoints the officer has scanned, then complete the round">
          {running.length ? running.map((p) => <Round key={p.id} patrol={p} />) : <Empty title="No round in progress" body="Start a round with the form on the right." />}
        </Panel>
        <Panel title="Start a round" meta={`Dated ${formatDate(today)} · started now (${time})`}>
          {can('patrols') ? (
            <>
              <div className="form-grid">
                <Field label="Site">
                  <select className="select" aria-label="Patrol site" value={site} onChange={(e) => { setSite(e.target.value); setOfficer(''); }}>
                    <option value="">Select site…</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{str(s, 'name')} · {num(s, 'checkpoints')} checkpoints</option>)}
                  </select>
                </Field>
                <Field label="Patrolling officer" hint="Officers on duty at the site.">
                  <select className="select" aria-label="Patrolling officer" value={officer} onChange={(e) => setOfficer(e.target.value)}>
                    <option value="">{onDuty.length ? 'First officer on duty' : 'Nobody on duty here'}</option>
                    {onDuty.map((r) => <option key={r.id} value={workingOfficerId(r)}>{officerName(data, workingOfficerId(r))}</option>)}
                  </select>
                </Field>
                <Field label="Round was due at" hint="Leave empty if it starts on time.">
                  <input className="input" type="time" aria-label="Round due time" value={due} onChange={(e) => setDue(e.target.value)} />
                </Field>
              </div>
              <div className="btns" style={{ marginTop: 12 }}><button className="btn primary" onClick={start} data-testid="start-round">Start round</button></div>
            </>
          ) : <Notice tone="grey">Your simulated role cannot start patrol rounds.</Notice>}
        </Panel>
      </div>
      <Panel title="Patrol rounds" meta="All logged rounds, newest first">
        <RecordTable def={def} rows={all} moduleKey="patrols" />
      </Panel>
    </>
  );
}

function Round({ patrol: p }: { patrol: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can } = useUser();
  const { today, time } = useClock();
  const points = checkpointList(num(p, 'checkpoints'));
  const [done, setDone] = useState<boolean[]>(() => points.map(() => false));
  const [reason, setReason] = useState('');
  const missed = points.filter((_, i) => !done[i]);
  const late = patrolLateBy(p);
  const complete = () => {
    const values = { scanned: points.length - missed.length, missedPoints: missed.length ? `${missed.join(', ')}${reason.trim() ? ` — ${reason.trim()}` : ''}` : '' };
    const problem = missed.length && !reason.trim() ? `${missed.length} checkpoint(s) not scanned — say why before completing the round.` : patrolCompleteProblem({ ...p, values: { ...p.values, ...values } });
    if (problem) { act.toast(problem, 'err'); return; }
    act.update('patrols', p.id, { ...values, completedAt: time });
    const res = act.transition('patrols', p.id, 'completed');
    act.toast(res.ok ? `${p.ref} completed — ${values.scanned}/${points.length} checkpoints scanned` : res.reason, res.ok ? (missed.length ? 'info' : 'ok') : 'err');
  };
  return (
    <div className="rx-card" style={{ padding: 14, marginBottom: 12 }} data-testid="round-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <Link to={`${base}/patrols/${p.id}`}><b>{siteName(data, p.values.site)}</b></Link>
          <div className="muted-note">{p.ref} · started {str(p, 'startedAt')} ({duration(Math.max(0, minutesBetween(str(p, 'date'), str(p, 'startedAt') || time, today, time)))} ago) · {officerName(data, p.values.officer)}</div>
        </div>
        <span className="flags">
          {late > 0 && <Tag tone="amber">Started {late} min late</Tag>}
          <Tag tone={missed.length ? 'dark' : 'green'}>{points.length - missed.length}/{points.length} scanned</Tag>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {points.map((name, i) => (
          <label key={name} className="check">
            <input type="checkbox" checked={done[i]} disabled={!can('patrols')} onChange={(e) => setDone(done.map((d, k) => (k === i ? e.target.checked : d)))} /> {name}
          </label>
        ))}
      </div>
      {can('patrols') && (
        <div style={{ marginTop: 12 }}>
          <div className="btns" style={{ marginBottom: 10 }}>
            <button className="btn sm" onClick={() => setDone(points.map(() => true))}>Scan all</button>
            <button className="btn sm primary" onClick={complete} data-testid="complete-round">Complete round</button>
          </div>
          {missed.length > 0 && (
            <Field label={`Why ${missed.length === 1 ? 'was 1 checkpoint' : `were ${missed.length} checkpoints`} missed?`}>
              <input className="input" aria-label="Reason checkpoints were missed" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. gate locked, area flooded" />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}
