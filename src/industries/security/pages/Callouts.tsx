import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays } from '../../../core/lib/dates';
import { Empty, PageHeader, Panel, Segmented, Stat, StatusTag, Tag } from '../../../core/components/ui';
import { RecordBoard, RecordTable, WorkflowActions } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { DEFAULT_SLA_MIN, SIGNALS, label } from '../data';
import { ACTIVE_CALLOUT, availableVehicles, equipmentLabel, rec, responseStats, siteName, slaState } from '../helpers';
import { useClock } from './format';

export default function Callouts() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { can } = useUser();
  const { today, time } = useClock();
  const def = act.def('callouts');
  const [view, setView] = useState<'table' | 'board'>('table');
  const [creating, setCreating] = useState(false);
  const all = [...records(data, 'callouts')].sort(def.sort);
  const active = all.filter((c) => ACTIVE_CALLOUT.includes(c.status ?? ''));
  const stats = responseStats(data, addDays(today, -30), today);
  const vehicles = records(data, 'equipment').filter((e) => str(e, 'category') === 'vehicle' && e.values.response === true);
  const free = availableVehicles(data, '', today);

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Control room`} title="Armed response call-outs" subtitle="Alarm signal received → vehicle dispatched → on scene → stood down. Response time runs from the signal to arrival and is compared with the contract SLA. Signals are typed in — no alarm panel is connected."
        actions={can('callouts.dispatch') ? <button className="btn primary" onClick={() => setCreating(true)} data-testid="new-record"><IcoPlus /> Log alarm signal</button> : undefined} />
      <div className="stat-grid">
        <Stat label="Active call-outs" value={active.length} tone={active.some((c) => c.status === 'received') ? 'red' : undefined} sub={`${active.filter((c) => c.status === 'received').length} awaiting dispatch`} />
        <Stat label="Avg response (30 days)" value={stats.count ? `${stats.avg} min` : '—'} tone={stats.avg > DEFAULT_SLA_MIN ? 'red' : 'accent'} sub={`${stats.count} completed call-outs`} />
        <Stat label="Within SLA" value={`${stats.pct}%`} tone={stats.breaches ? 'red' : 'accent'} sub={`${stats.breaches} over the SLA · demo target ${DEFAULT_SLA_MIN} min`} />
        <Stat label="Vehicles available" value={`${free.length}/${vehicles.length}`} tone={free.length ? undefined : 'red'} sub="not committed, in repair or unlicensed" />
      </div>
      <div className="section-gap" />
      <Panel title="Active now" meta="Signal time and the time the vehicle is due on scene under the contract SLA">
        {active.length ? (
          <ul className="list" data-testid="active-callouts">
            {active.map((c) => {
              const s = slaState(data, c);
              return (
                <li key={c.id}>
                  <span className="time-chip">{str(c, 'receivedAt')}</span>
                  <div className="grow">
                    <Link to={`${base}/callouts/${c.id}`}><b>{siteName(data, c.values.site)} — {label(SIGNALS, str(c, 'signal'))}</b></Link>
                    <small>{c.ref} · received {str(c, 'receivedAt')}{str(c, 'zone') ? ` · ${str(c, 'zone')}` : ''}{str(c, 'vehicle') ? ` · ${equipmentLabel(rec(data, 'equipment', c.values.vehicle))}` : ''}</small>
                  </div>
                  <Tag tone={s.state === 'breached' ? 'red' : s.state === 'met' ? 'green' : 'amber'}>{s.state === 'met' ? `On scene in ${s.minutes} min` : s.state === 'breached' ? `${s.minutes} min — over ${s.sla}-min SLA` : `Due on scene by ${s.dueBy}`}</Tag>
                  <StatusTag workflow={def.workflow} status={c.status} />
                  <WorkflowActions def={def} record={c} compact />
                </li>
              );
            })}
          </ul>
        ) : <Empty title="No active call-outs" body="Log an alarm signal to start one." />}
      </Panel>
      <Panel title="All call-outs" right={<Segmented label="View" value={view} onChange={setView} options={[{ value: 'table', label: 'Table' }, { value: 'board', label: 'Board' }]} />}>
        {view === 'board' ? <RecordBoard def={def} rows={all} moduleKey="callouts" /> : <RecordTable def={def} rows={all} moduleKey="callouts" />}
      </Panel>
      {creating && (
        <RecordFormModal def={def} open title="Log alarm signal" initial={{ date: today, receivedAt: time, signal: 'intruder' }} onClose={() => setCreating(false)}
          onSave={(v) => {
            const r = act.create('callouts', v, 'received', 'Alarm signal received');
            act.toast(`${r.ref} logged — dispatch a vehicle`);
            setCreating(false);
            navigate(`${base}/callouts/${r.id}`);
          }} />
      )}
    </>
  );
}
