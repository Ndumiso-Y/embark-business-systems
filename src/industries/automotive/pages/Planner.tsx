import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Field, Meters, Modal, Notice, PageHeader, Panel, Segmented, Stat, StatusTag } from '../../../core/components/ui';
import { IcoArrow, IcoBack } from '../../../core/components/Icons';
import { BAYS, DAY_HOURS, TECHNICIANS, label } from '../data';
import { hoursBy, planClash, plannedOn, timeToHours, todayStr, utilisation, vehicleLabel } from '../helpers';

/** Hourly workshop slots, 07:30 to 15:30 (closing 16:30). */
export const SLOTS = Array.from({ length: 9 }, (_, i) => `${String(7 + i).padStart(2, '0')}:30`);
const slotStart = (t: string) => timeToHours(t);

type Axis = 'bay' | 'technician';

export default function Planner() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const [date, setDate] = useState(todayStr());
  const [axis, setAxis] = useState<Axis>('bay');
  const [assigning, setAssigning] = useState<DemoRecord | null>(null);
  const jobs = plannedOn(data, date).sort((a, b) => str(a, 'startTime').localeCompare(str(b, 'startTime')));
  const cols = axis === 'bay' ? BAYS : TECHNICIANS;
  const scheduled = jobs.filter((j) => str(j, 'startTime') && str(j, axis));
  const unscheduled = jobs.filter((j) => !str(j, 'startTime') || !str(j, 'bay') || !str(j, 'technician'));
  const techHours = hoursBy(data, date, 'technician');
  const bayHours = hoursBy(data, date, 'bay');
  const totalHours = jobs.reduce((n, j) => n + num(j, 'hoursBooked'), 0);
  const capacity = TECHNICIANS.length * DAY_HOURS;
  const isToday = date === todayStr();
  const wf = config.collections.find((c) => c.key === 'jobs')!.workflow!;

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Workshop`} title="Bay & technician planner" subtitle="Job cards planned into the workshop, by bay or by technician. Utilisation is hours booked against an 8-hour day." />
      <div className="toolbar diary-nav">
        <button className="btn sm" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><IcoBack /></button>
        <input className="input sm" type="date" aria-label="Planner date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 160 }} />
        <button className="btn sm" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><IcoArrow /></button>
        {!isToday && <button className="btn sm" onClick={() => setDate(todayStr())}>Today</button>}
        <b className="diary-date">{formatDate(date)}{isToday ? ' · today' : ''}</b>
        <div style={{ marginLeft: 'auto' }}>
          <Segmented label="Planner columns" value={axis} onChange={setAxis} options={[{ value: 'bay', label: 'By bay' }, { value: 'technician', label: 'By technician' }]} />
        </div>
      </div>
      <div className="stat-grid compact">
        <Stat label="Job cards planned" value={jobs.length} />
        <Stat label="Hours booked" value={`${totalHours} h`} sub={`of ${capacity} h technician capacity`} />
        <Stat label="Workshop utilisation" value={`${utilisation(totalHours / TECHNICIANS.length)}%`} tone="accent" />
        <Stat label="Not yet scheduled" value={unscheduled.length} tone={unscheduled.length ? 'red' : undefined} sub="Missing bay, technician or start time" />
      </div>
      <div className="section-gap" />
      <Panel pad>
        <div className="planner" style={{ '--cols': cols.length } as CSSProperties} data-testid="planner">
          <div />
          {cols.map((c) => {
            const h = (axis === 'bay' ? bayHours : techHours)[c.value] ?? 0;
            return <div key={c.value} className="planner-head">{c.label}<small>{h} h booked · {utilisation(h)}%</small></div>;
          })}
          {SLOTS.map((t) => (
            <Row key={t} t={t} cols={cols} axis={axis} jobs={scheduled} wfStates={wf.states} />
          ))}
        </div>
        <p className="muted-note" style={{ marginTop: 12 }}>Each card starts in its planned hour; shaded cells show the job continuing. Colours follow the job card stage.</p>
      </Panel>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Technician utilisation" meta={`Hours booked vs ${DAY_HOURS} h day`}>
          <Meters format={(n) => `${n} h`} items={TECHNICIANS.map((tch) => {
            const h = techHours[tch.value] ?? 0;
            return { label: tch.label, value: h, max: DAY_HOURS, tone: h > DAY_HOURS ? 'red' : h >= DAY_HOURS * 0.6 ? 'green' : 'amber', sub: `${utilisation(h)}% · ${tch.grade}` };
          })} />
        </Panel>
        <Panel title="Needs scheduling" meta="Planned for this day without a bay, technician or start time">
          {unscheduled.length ? (
            <ul className="list" data-testid="unscheduled">
              {unscheduled.map((j) => (
                <li key={j.id}>
                  <div className="grow">
                    <JobLink job={j} />
                    <small>{j.ref} · {label(BAYS, str(j, 'bay'))} · {label(TECHNICIANS, str(j, 'technician'))} · {str(j, 'startTime') || 'no start time'}</small>
                  </div>
                  <StatusTag workflow={wf} status={j.status} />
                  {can('jobs.manage') && <button className="btn xs" onClick={() => setAssigning(j)}>Schedule</button>}
                </li>
              ))}
            </ul>
          ) : <Empty title="Everything is scheduled" />}
        </Panel>
      </div>
      {!can('jobs.manage') && <Notice tone="grey">Scheduling needs the “Manage job cards” permission (service advisor or foreman).</Notice>}
      {assigning && <Assign job={assigning} onClose={() => setAssigning(null)} onSave={(vals) => {
        const clash = planClash(data, { id: assigning.id, workDate: date, ...vals });
        if (clash) { act.toast(clash, 'err'); return false; }
        act.update('jobs', assigning.id, vals, `Scheduled: ${label(BAYS, vals.bay)}, ${label(TECHNICIANS, vals.technician)} from ${vals.startTime}`);
        act.toast(`${assigning.ref} scheduled`);
        setAssigning(null);
        return true;
      }} />}
    </>
  );
}

function JobLink({ job }: { job: DemoRecord }) {
  const data = useData();
  const base = useBase();
  return <Link to={`${base}/jobs/${job.id}`}><b>{vehicleLabel(data, job.values.vehicle)}</b></Link>;
}

function Row({ t, cols, axis, jobs, wfStates }: { t: string; cols: Array<{ value: string; label: string }>; axis: Axis; jobs: DemoRecord[]; wfStates: Array<{ key: string; label: string; tone: string }> }) {
  const data = useData();
  const base = useBase();
  const s = slotStart(t);
  return (
    <>
      <div className="planner-time">{t}</div>
      {cols.map((c) => {
        const here = jobs.filter((j) => str(j, axis) === c.value);
        const starting = here.filter((j) => { const js = timeToHours(str(j, 'startTime')); return (js >= s && js < s + 1) || (t === SLOTS[0] && js < s); });
        const continuing = here.filter((j) => { const js = timeToHours(str(j, 'startTime')); return js < s && js + num(j, 'hoursBooked') > s && !starting.includes(j); });
        if (!starting.length && !continuing.length) return <div key={c.value} className="planner-slot" />;
        return (
          <div key={c.value} className="planner-slot filled">
            {starting.map((j) => {
              const st = wfStates.find((x) => x.key === j.status);
              return (
                <Link key={j.id} to={`${base}/jobs/${j.id}`} className={`appt tone-${st?.tone ?? 'dark'}`} data-testid="planner-job">
                  <b>{vehicleLabel(data, j.values.vehicle)}</b>
                  <small>{str(j, 'startTime')} · {num(j, 'hoursBooked')} h · {axis === 'bay' ? label(TECHNICIANS, str(j, 'technician')) : label(BAYS, str(j, 'bay'))}</small>
                  <small>{j.ref} · {st?.label}</small>
                </Link>
              );
            })}
            {!starting.length && continuing.map((j) => (
              <Link key={j.id} to={`${base}/jobs/${j.id}`} className="appt tone-dark" style={{ opacity: 0.55 }}>
                <small>↳ {j.ref} continues</small>
              </Link>
            ))}
          </div>
        );
      })}
    </>
  );
}

function Assign({ job, onClose, onSave }: { job: DemoRecord; onClose: () => void; onSave: (v: { bay: string; technician: string; startTime: string; hoursBooked: number }) => boolean }) {
  const [bay, setBay] = useState(str(job, 'bay') || 'b1');
  const [tech, setTech] = useState(str(job, 'technician') || 'sn');
  const [start, setStart] = useState(str(job, 'startTime') || '08:30');
  const [hours, setHours] = useState(num(job, 'hoursBooked') || 1);
  return (
    <Modal open title={`Schedule ${job.ref}`} sub="Checks for bay and technician clashes" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" data-testid="save-schedule" onClick={() => onSave({ bay, technician: tech, startTime: start, hoursBooked: hours })}>Save</button></>}>
      <div className="form-grid">
        <Field label="Bay"><select className="select" aria-label="Bay" value={bay} onChange={(e) => setBay(e.target.value)}>{BAYS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></Field>
        <Field label="Technician"><select className="select" aria-label="Technician" value={tech} onChange={(e) => setTech(e.target.value)}>{TECHNICIANS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></Field>
        <Field label="Start"><select className="select" aria-label="Start time" value={start} onChange={(e) => setStart(e.target.value)}>{[...SLOTS, ...SLOTS.map((x) => x.replace(':30', ':00')).slice(1)].sort().map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
        <Field label="Hours"><input className="input num" type="number" min={0.25} max={9} step={0.25} aria-label="Hours" value={hours} onChange={(e) => setHours(Number(e.target.value))} /></Field>
      </div>
    </Modal>
  );
}
