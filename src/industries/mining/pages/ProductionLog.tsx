import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Meters, PageHeader, Panel, Segmented, Stat } from '../../../core/components/ui';
import { RecordFormModal } from '../../../core/components/fields';
import { RecordTable, WorkflowActions } from '../../../core/components/records';
import { IcoPlus } from '../../../core/components/Icons';
import { DELAY_REASONS, SECTIONS, SHIFT_TARGETS, label } from '../data';
import { productionOn, productionToDate, sectionsToDate, todayStr } from '../helpers';
import { pctTone, tonnes } from './format';

export default function ProductionLog() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { can } = useUser();
  const today = todayStr();
  const def = act.def('shifts');
  const [scope, setScope] = useState<'week' | 'month' | 'all'>('week');
  const [creating, setCreating] = useState(false);

  const shifts = records(data, 'shifts');
  const mtd = productionToDate(data, today);
  const todayProd = productionOn(data, today);
  const sections = sectionsToDate(data, today);
  const awaiting = shifts.filter((s) => s.status === 'submitted').sort(def.sort);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const cell = (date: string, section: string, shift: string) => shifts.find((s) => str(s, 'date') === date && str(s, 'section') === section && str(s, 'shift') === shift);

  const rows = useMemo(() => {
    const from = scope === 'week' ? addDays(today, -6) : scope === 'month' ? `${today.slice(0, 7)}-01` : '';
    return [...shifts].filter((s) => str(s, 'date') >= from).sort(def.sort);
  }, [shifts, scope, today, def]);

  const monthDelays = shifts.filter((s) => str(s, 'date').startsWith(today.slice(0, 7)));
  const topDelay = DELAY_REASONS.map((d) => ({ ...d, minutes: monthDelays.filter((s) => str(s, 'delayReason') === d.value).reduce((n, s) => n + num(s, 'delayMinutes'), 0) }))
    .sort((a, b) => b.minutes - a.minutes)[0];

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Operations`} title="Shift production log" subtitle="Tonnes hoisted per section and shift against the (fictional) mine plan. Supervisors submit their shift; a different person verifies it."
        actions={can('production.log') ? <button className="btn primary" onClick={() => setCreating(true)} data-testid="new-record"><IcoPlus /> Log a shift</button> : undefined} />
      <div className="stat-grid">
        <Stat label="Month to date" value={tonnes(mtd.tonnes)} tone="accent" sub={`${mtd.pct}% of ${tonnes(mtd.target)} planned · ${mtd.shifts} completed shifts (open shifts excluded)`} />
        <Stat label="Today so far" value={tonnes(todayProd.tonnes)} sub={`plan ${tonnes(todayProd.target)} · ${todayProd.shifts} shift log(s)`} />
        <Stat label="Delay minutes this month" value={mtd.delayMinutes.toLocaleString('en-ZA')} sub={topDelay?.minutes ? `Largest: ${topDelay.label} (${topDelay.minutes} min)` : 'No delays recorded'} />
        <Stat label="Awaiting verification" value={awaiting.length} tone={awaiting.length ? 'red' : undefined} sub="Submitted shift logs" />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Shift board — last 7 days" meta="Tonnes hoisted · % of plan per shift. Click a cell to open the log." pad>
          <div className="table-wrap">
            <table className="table" data-testid="shift-board">
              <thead>
                <tr><th>Date</th>{SECTIONS.map((s) => <th key={s.value} className="num" colSpan={2}>{s.label}<small>Day · Night</small></th>)}</tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d}>
                    <td><strong>{formatDate(d)}</strong>{d === today && <small>Today</small>}</td>
                    {SECTIONS.flatMap((s) => (['day', 'night'] as const).map((sh) => {
                      const r = cell(d, s.value, sh);
                      if (!r) return <td key={s.value + sh} className="num"><small>—</small></td>;
                      const pct = num(r, 'targetTonnes') ? Math.round((num(r, 'tonnesHoisted') / num(r, 'targetTonnes')) * 100) : 0;
                      return (
                        <td key={s.value + sh} className="num">
                          <Link to={`${base}/production/${r.id}`}>{num(r, 'tonnesHoisted')}</Link>
                          <small><span className={`dot ${r.status === 'open' ? 'dark' : pctTone(pct)}`} />{pct}%{r.status !== 'verified' ? ` · ${r.status}` : ''}</small>
                        </td>
                      );
                    }))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="stack">
          <Panel title="Month to date by section" meta="Hoisted vs plan">
            <Meters format={(n) => tonnes(n)} items={sections.map((s) => ({ label: `${s.label} · ${s.pct}%`, value: s.tonnes, max: s.target, tone: pctTone(s.pct), sub: `${s.delayMinutes} delay minutes` }))} />
          </Panel>
          <Panel title="Awaiting verification" meta="Delays over 30 minutes need a reason; you cannot verify your own shift">
            {awaiting.length ? (
              <ul className="list" data-testid="verify-list">
                {awaiting.map((s: DemoRecord) => (
                  <li key={s.id}>
                    <div className="grow">
                      <Link to={`${base}/production/${s.id}`}><b>{def.title(s, data)}</b></Link>
                      <small>{formatDate(str(s, 'date'))} · {num(s, 'tonnesHoisted')} / {num(s, 'targetTonnes')} t · delay {num(s, 'delayMinutes')} min{str(s, 'delayReason') ? ` (${label(DELAY_REASONS, str(s, 'delayReason'))})` : ''}</small>
                    </div>
                    <WorkflowActions def={def} record={s} compact />
                  </li>
                ))}
              </ul>
            ) : <Empty title="Nothing awaiting verification" />}
          </Panel>
        </div>
      </div>
      <Panel title="Shift logs" right={<Segmented label="Period" value={scope} onChange={setScope} options={[{ value: 'week', label: '7 days' }, { value: 'month', label: 'This month' }, { value: 'all', label: 'All (≈90 days)' }]} />}>
        <RecordTable def={def} rows={rows} moduleKey="production" />
      </Panel>
      {creating && (
        <RecordFormModal def={def} open title="Log a shift"
          initial={{ date: today, shift: 'day', section: 'l7e', targetTonnes: SHIFT_TARGETS.l7e.day, delayMinutes: 0 }}
          onClose={() => setCreating(false)}
          onSave={(v) => {
            const r = act.create('shifts', v, 'open', 'Shift log opened');
            act.toast(`Shift log ${r.ref} opened`);
            setCreating(false);
            navigate(`${base}/production/${r.id}`);
          }} />
      )}
    </>
  );
}
