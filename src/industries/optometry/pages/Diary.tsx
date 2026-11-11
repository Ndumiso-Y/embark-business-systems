import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Notice, PageHeader, Panel, Segmented, Stat } from '../../../core/components/ui';
import { RecordBoard, RecordTable } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoBack, IcoArrow, IcoPlus } from '../../../core/components/Icons';
import { APPOINTMENT_TYPES, PRACTITIONERS, label } from '../data';
import { byDateTime, clashes, patientName, slotOf, SLOTS, todayStr } from '../helpers';

export default function Diary() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const def = act.def('appointments');
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState<'planner' | 'flow' | 'list'>('planner');
  const [booking, setBooking] = useState<Values | null>(null);
  const all = records(data, 'appointments');
  const day = all.filter((a) => str(a, 'date') === date).sort(byDateTime);
  const isToday = date === todayStr();

  const save = (v: Values) => {
    if (clashes(all, v)) { act.toast(`${label(PRACTITIONERS, v.practitioner)} is already booked at ${v.time} on ${formatDate(String(v.date))}.`, 'err'); return; }
    act.create('appointments', v, 'booked', 'Appointment booked');
    act.toast(`Booked ${patientName(data, v.patient)} at ${v.time}`);
    setBooking(null);
    setDate(String(v.date));
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Front desk`} title="Diary & patient flow" subtitle="Book appointments per practitioner, check patients in and move them through the practice."
        actions={can('bookings') ? <button className="btn primary" data-testid="new-booking" onClick={() => setBooking({ date, time: '09:00', practitioner: 'lk', type: 'exam' })}><IcoPlus /> New booking</button> : undefined} />
      <div className="toolbar diary-nav">
        <button className="btn sm" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><IcoBack /></button>
        <input className="input sm" type="date" aria-label="Diary date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 160 }} />
        <button className="btn sm" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><IcoArrow /></button>
        {!isToday && <button className="btn sm" onClick={() => setDate(todayStr())}>Today</button>}
        <b className="diary-date">{formatDate(date)}{isToday ? ' · today' : ''}</b>
        <div style={{ marginLeft: 'auto' }}>
          <Segmented label="Diary view" value={view} onChange={setView} options={[{ value: 'planner', label: 'Planner' }, { value: 'flow', label: 'Patient flow' }, { value: 'list', label: 'List' }]} />
        </div>
      </div>
      <div className="stat-grid compact">
        <Stat label="Booked" value={day.length} />
        <Stat label="In the practice" value={day.filter((a) => ['arrived', 'pretest', 'inexam', 'dispensing'].includes(a.status ?? '')).length} tone="accent" />
        <Stat label="Completed" value={day.filter((a) => a.status === 'completed').length} />
        <Stat label="Did not attend" value={day.filter((a) => a.status === 'noshow').length} tone={day.some((a) => a.status === 'noshow') ? 'red' : undefined} />
      </div>
      <div className="section-gap" />
      {view === 'planner' && (
        <Panel pad>
          <div className="planner" style={{ '--cols': PRACTITIONERS.length } as CSSProperties} data-testid="planner">
            <div />
            {PRACTITIONERS.map((p) => <div key={p.value} className="planner-head">{p.label}<small>{p.role}</small></div>)}
            {SLOTS.map((t) => (
              <Row key={t} t={t} day={day} date={date} canBook={can('bookings')} onBook={(prac) => setBooking({ date, time: t, practitioner: prac, type: prac === 'mv' ? 'collection' : 'exam' })} />
            ))}
          </div>
          <p className="muted-note" style={{ marginTop: 12 }}>Click an empty slot to book. Colours follow the appointment status. Lunch 12:30–13:30 is left open in the demo.</p>
        </Panel>
      )}
      {view === 'flow' && (
        <Panel title="Patient flow" meta={isToday ? 'Move patients through the practice with the buttons on each card' : 'Patient flow is most useful for today'}>
          {!isToday && <Notice tone="grey">Check-in is only allowed on the day of the appointment.</Notice>}
          <RecordBoard def={def} rows={day} moduleKey="diary" />
        </Panel>
      )}
      {view === 'list' && <Panel><RecordTable def={def} rows={day} moduleKey="diary" /></Panel>}
      {booking && (
        <RecordFormModal def={def} initial={booking} open title="New booking" onClose={() => setBooking(null)} onSave={save} />
      )}
    </>
  );
}

function Row({ t, day, date, canBook, onBook }: { t: string; day: ReturnType<typeof records>; date: string; canBook: boolean; onBook: (p: string) => void }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const wf = config.collections.find((c) => c.key === 'appointments')!.workflow!;
  return (
    <>
      <div className="planner-time">{t}</div>
      {PRACTITIONERS.map((p) => {
        const here = day.filter((a) => str(a, 'practitioner') === p.value && slotOf(str(a, 'time')) === t);
        if (!here.length) {
          const past = date < todayStr();
          return canBook && !past
            ? <button key={p.value} type="button" className="planner-slot free" aria-label={`Book ${p.label} at ${t}`} onClick={() => onBook(p.value)}><span>+ Book</span></button>
            : <div key={p.value} className="planner-slot" />;
        }
        return (
          <div key={p.value} className="planner-slot filled">
            {here.map((a) => {
              const st = wf.states.find((s) => s.key === a.status);
              return (
                <Link key={a.id} to={`${base}/diary/${a.id}`} className={`appt tone-${st?.tone ?? 'dark'}`} data-testid="appt">
                  <b>{patientName(data, a.values.patient)}</b>
                  <small>{str(a, 'time')} · {label(APPOINTMENT_TYPES, str(a, 'type'))}</small>
                  <small>{st?.label}</small>
                </Link>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
