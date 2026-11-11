import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Field, Meters, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { WO_TYPES, label } from '../data';
import { hoursToService, serviceState, todayStr } from '../helpers';

export default function EquipmentDetail() {
  const { id } = useParams();
  const data = useData();
  const e = findRecord(data, 'equipment', id);
  return (
    <RecordDetail aside={e ? <Aside id={e.id} /> : undefined}>
      {e && <Service id={e.id} />}
    </RecordDetail>
  );
}

function Service({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { hasModule } = useUser();
  const e = findRecord(data, 'equipment', id)!;
  const woDef = act.def('workorders');
  const wos = records(data, 'workorders').filter((w) => str(w, 'equipment') === id).sort(woDef.sort);
  const since = num(e, 'engineHours') - num(e, 'lastServiceHours');
  const interval = num(e, 'serviceInterval') || 1;
  const state = serviceState(e);
  const left = hoursToService(e);
  return (
    <>
      <Panel title="Service status" meta={`Interval ${interval} h · last service ${formatDate(str(e, 'lastServiceDate'))}`}
        right={<Tag tone={state === 'overdue' ? 'red' : state === 'due-soon' ? 'amber' : 'green'}>{state === 'overdue' ? `Overdue by ${Math.abs(left)} h` : state === 'due-soon' ? `Due in ${left} h` : `${left} h to service`}</Tag>}>
        <Meters format={(n) => `${n} h`} items={[{ label: 'Hours since last service', value: since, max: interval, tone: state === 'overdue' ? 'red' : state === 'due-soon' ? 'amber' : 'green', sub: `Meter ${num(e, 'engineHours')} h · next service at ${num(e, 'nextServiceHours')} h` }]} />
      </Panel>
      <Panel title="Work orders" meta={`${wos.length} on record for this machine`}>
        {wos.length ? (
          <ul className="list">
            {wos.map((w) => (
              <li key={w.id}>
                <div className="grow">
                  {hasModule('workorders') ? <Link to={`${base}/workorders/${w.id}`}><b>{str(w, 'title')}</b></Link> : <b>{str(w, 'title')}</b>}
                  <small>{w.ref} · {label(WO_TYPES, str(w, 'type'))} · raised {formatDate(str(w, 'raisedOn'))}{str(w, 'completedOn') ? ` · completed ${formatDate(str(w, 'completedOn'))}` : ''}</small>
                </div>
                <StatusTag workflow={woDef.workflow} status={w.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No work orders yet" />}
      </Panel>
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can, hasModule } = useUser();
  const base = useBase();
  const navigate = useNavigate();
  const e = findRecord(data, 'equipment', id)!;
  const [reading, setReading] = useState('');
  const [err, setErr] = useState('');
  const [raising, setRaising] = useState(false);
  if (!can('maintenance')) return null;
  const save = () => {
    const n = Number(reading);
    if (!reading || !Number.isFinite(n)) { setErr('Enter the hour-meter reading.'); return; }
    if (n < num(e, 'engineHours')) { setErr(`Reading cannot be below the current ${num(e, 'engineHours')} h.`); return; }
    act.update('equipment', e.id, { engineHours: n }, `Hour meter reading ${n} h recorded`);
    act.toast(`${str(e, 'fleetNo')} hour meter updated`);
    setReading(''); setErr('');
  };
  return (
    <>
      <Panel title="Hour meter" meta="Typed in by hand — no telemetry in this demo">
        <Field label="New reading (h)" error={err || undefined}>
          <input className="input num" type="number" aria-label="New hour-meter reading" value={reading} onChange={(ev) => setReading(ev.target.value)} />
        </Field>
        <div className="btns" style={{ marginTop: 10 }}>
          <button className="btn sm primary" onClick={save}>Record reading</button>
          <button className="btn sm" onClick={() => setRaising(true)}><IcoPlus /> Raise work order</button>
        </div>
      </Panel>
      {raising && (
        <RecordFormModal def={act.def('workorders')} open title={`Raise work order — ${str(e, 'fleetNo')}`}
          initial={{ equipment: e.id, type: serviceState(e) === 'ok' ? 'breakdown' : 'planned', priority: 'routine', raisedOn: todayStr(), title: serviceState(e) === 'ok' ? '' : `${num(e, 'serviceInterval')} h service` }}
          onClose={() => setRaising(false)}
          onSave={(v) => {
            const r = act.create('workorders', v, 'raised', 'Work order raised from equipment register');
            act.toast(`Work order ${r.ref} raised — plan and assign it next`);
            setRaising(false);
            if (hasModule('workorders')) navigate(`${base}/workorders/${r.id}`);
          }} />
      )}
    </>
  );
}
