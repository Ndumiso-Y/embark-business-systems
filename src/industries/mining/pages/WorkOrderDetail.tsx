import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { ARTISANS, AVAILABILITY, label } from '../data';
import { hoursToService, serviceState, todayStr } from '../helpers';
import { holders } from '../helpers';

/** Work order detail: the generic record screen plus the machine it is for and the two small
 *  forms the workflow asks for — planning (date + artisan) and completion (hour meter + work done). */
export default function WorkOrderDetail() {
  const { id } = useParams();
  const data = useData();
  const w = findRecord(data, 'workorders', id);
  return <RecordDetail aside={w ? <Aside key={w.id} id={w.id} /> : undefined} />;
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const w = findRecord(data, 'workorders', id)!;
  const eq = findRecord(data, 'equipment', str(w, 'equipment'));
  const may = can('maintenance');
  const planned = str(w, 'type') === 'planned';
  const [date, setDate] = useState(() => str(w, 'plannedDate') || today);
  const [artisan, setArtisan] = useState(() => str(w, 'assignedTo'));
  const [meter, setMeter] = useState(() => str(w, 'hoursAtService'));
  const [work, setWork] = useState(() => str(w, 'workDone'));
  const [down, setDown] = useState(() => str(w, 'downtimeHours'));
  const [err, setErr] = useState('');

  const plan = () => {
    if (!date) { setErr('Set a planned date.'); return; }
    if (!artisan) { setErr('Assign an artisan.'); return; }
    act.update('workorders', id, { plannedDate: date, assignedTo: artisan });
    const res = act.transition('workorders', id, 'planned');
    if (!res.ok) { setErr(res.reason); return; }
    act.toast(`${w.ref}: planned for ${formatDate(date)} — ${label(ARTISANS, artisan)}`);
    setErr('');
  };
  const complete = () => {
    const n = Number(meter);
    if (meter === '' || !Number.isFinite(n) || n < 0) { setErr('Enter the hour-meter reading at completion.'); return; }
    if (!work.trim()) { setErr('Describe the work done.'); return; }
    act.update('workorders', id, { hoursAtService: n, workDone: work.trim(), downtimeHours: down === '' ? null : Number(down) });
    const res = act.transition('workorders', id, 'completed');
    if (!res.ok) { setErr(res.reason); return; }
    act.toast(`${w.ref}: Complete work order`);
    setErr('');
  };

  const state = eq ? serviceState(eq) : 'ok';
  const left = eq ? hoursToService(eq) : 0;
  return (
    <>
      <Panel title="Machine" meta={eq ? label(AVAILABILITY, str(eq, 'availability')) : undefined}
        right={eq ? <Tag tone={state === 'overdue' ? 'red' : state === 'due-soon' ? 'amber' : 'green'}>{state === 'overdue' ? `Service overdue by ${Math.abs(left)} h` : state === 'due-soon' ? `Service due in ${left} h` : `${left} h to next service`}</Tag> : undefined}>
        {eq ? (
          <div data-testid="wo-machine">
            <KeyValues items={[
              { label: 'Fleet number', value: hasModule('equipment') ? <Link to={`${base}/equipment/${eq.id}`}>{str(eq, 'fleetNo')}</Link> : str(eq, 'fleetNo') },
              { label: 'Hour meter', value: `${num(eq, 'engineHours')} h` },
              { label: 'Last service at', value: `${num(eq, 'lastServiceHours')} h` },
              { label: 'Next service at', value: <b>{num(eq, 'nextServiceHours')} h</b> },
            ]} />
            {w.status === 'completed' && planned && <div style={{ marginTop: 12 }}><Notice tone="accent">This service reset the machine: last service {num(eq, 'lastServiceHours')} h, next service due at {num(eq, 'nextServiceHours')} h.</Notice></div>}
            {w.status !== 'completed' && w.status !== 'cancelled' && <p className="muted-note" style={{ marginTop: 10 }}>{planned ? 'Completing this planned service sets the next service to the completion reading plus the service interval.' : 'Completing a breakdown returns the machine to service; the service schedule is unchanged.'}</p>}
          </div>
        ) : <Notice tone="amber">No machine linked — use “Edit” to pick one from the equipment register.</Notice>}
      </Panel>

      {w.status === 'raised' && (
        <Panel title="Plan & assign" meta={planned ? 'A planned service needs a date and an artisan before work starts' : 'A breakdown can start as soon as an artisan is assigned'}>
          {may ? (
            <div className="stack" style={{ gap: 10 }} data-testid="plan-form">
              <Field label="Planned date" error={err || undefined}><input className="input" type="date" aria-label="Planned date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Artisan">
                <select className="select" aria-label="Artisan" value={artisan} onChange={(e) => setArtisan(e.target.value)}>
                  <option value="">Select…</option>
                  {ARTISANS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </Field>
              <div><button className="btn sm primary" onClick={plan} data-testid="plan-assign">Plan &amp; assign</button></div>
            </div>
          ) : <p className="muted-note">Work orders are planned and carried out by {holders(data, 'maintenance')}.</p>}
        </Panel>
      )}

      {w.status === 'inprogress' && (
        <Panel title="Complete the job" meta="The hour-meter reading and the work done are required">
          {may ? (
            <div className="stack" style={{ gap: 10 }} data-testid="complete-form">
              <Field label="Hour meter at completion (h)" error={err || undefined} hint={eq ? `Machine currently reads ${num(eq, 'engineHours')} h · last service at ${num(eq, 'lastServiceHours')} h` : undefined}>
                <input className="input num" type="number" min={0} aria-label="Hour meter at completion" value={meter} onChange={(e) => setMeter(e.target.value)} />
              </Field>
              <Field label="Work done"><textarea className="textarea" aria-label="Work done" value={work} onChange={(e) => setWork(e.target.value)} placeholder="What was done, parts replaced" /></Field>
              <Field label="Downtime (h)"><input className="input num" type="number" min={0} max={720} aria-label="Downtime hours" value={down} onChange={(e) => setDown(e.target.value)} /></Field>
              <div><button className="btn sm primary" onClick={complete} data-testid="complete-wo">Complete work order</button></div>
            </div>
          ) : <p className="muted-note">Work orders are planned and carried out by {holders(data, 'maintenance')}.</p>}
        </Panel>
      )}
      {w.status === 'planned' && !may && <Notice tone="grey">Work orders are planned and carried out by {holders(data, 'maintenance')}.</Notice>}
    </>
  );
}
