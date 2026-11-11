import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord, Values } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Flags, Notice, PageHeader, Panel, Segmented, Stat } from '../../../core/components/ui';
import { RecordTable, WorkflowActions } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoArrow, IcoBack, IcoPlus } from '../../../core/components/Icons';
import { CLINICIANS, VISIT_TYPES, label } from '../data';
import { byDateTime, clashes, minutesWaiting, patientName, todayStr, vitalAlerts, WAITING_STATES } from '../helpers';
import { AllergyTag, TriageModal } from './shared';

const COLUMNS = ['booked', 'arrived', 'triaged', 'withdoctor', 'billing', 'done'];

export default function WaitingRoom() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const def = act.def('visits');
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState<'queue' | 'list' | 'upcoming'>('queue');
  const [booking, setBooking] = useState<Values | null>(null);
  const [triage, setTriage] = useState<DemoRecord | null>(null);
  const all = records(data, 'visits');
  const day = all.filter((a) => str(a, 'date') === date).sort(byDateTime);
  const isToday = date === todayStr();
  const inPractice = day.filter((a) => WAITING_STATES.includes(a.status ?? ''));
  const dna = day.filter((a) => a.status === 'dna').length;
  const upcoming = all.filter((a) => a.status === 'booked' && str(a, 'date') > todayStr()).sort(byDateTime);

  const save = (v: Values) => {
    if (clashes(all, v)) { act.toast(`${label(CLINICIANS, v.clinician)} already has a visit at ${v.time} on ${formatDate(String(v.date))}.`, 'err'); return; }
    act.create('visits', v, 'booked', 'Visit booked');
    act.toast(`Booked ${patientName(data, v.patient)} at ${v.time}`);
    setBooking(null);
    setDate(String(v.date));
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Front desk`} title="Waiting room & visits" subtitle="Today’s queue by stage. Patients are triaged (vitals captured) before the doctor calls them in."
        actions={can('bookings') ? <button className="btn primary" data-testid="new-visit" onClick={() => setBooking({ date, time: '10:30', clinician: 'rc', type: 'acute' })}><IcoPlus /> New visit</button> : undefined} />
      <div className="toolbar diary-nav">
        <button className="btn sm" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><IcoBack /></button>
        <input className="input sm" type="date" aria-label="Queue date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 160 }} />
        <button className="btn sm" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><IcoArrow /></button>
        {!isToday && <button className="btn sm" onClick={() => setDate(todayStr())}>Today</button>}
        <b className="diary-date">{formatDate(date)}{isToday ? ' · today' : ''}</b>
        <div style={{ marginLeft: 'auto' }}>
          <Segmented label="Waiting room view" value={view} onChange={setView} options={[{ value: 'queue', label: 'Queue board' }, { value: 'list', label: 'Day list' }, { value: 'upcoming', label: 'Upcoming' }]} />
        </div>
      </div>
      <div className="stat-grid compact">
        <Stat label="Visits" value={day.length} sub={`${day.filter((a) => a.status === 'booked').length} still to arrive`} />
        <Stat label="In the practice" value={inPractice.length} tone="accent" sub={`${day.filter((a) => a.status === 'arrived').length} waiting for triage`} />
        <Stat label="Seen & checked out" value={day.filter((a) => a.status === 'done').length} />
        <Stat label="Did not attend" value={dna} tone={dna ? 'red' : undefined} sub={day.length ? `${Math.round((dna / day.length) * 100)}% of the day` : undefined} />
      </div>
      <div className="section-gap" />
      {view === 'queue' && (
        <Panel title="Queue by stage" meta={isToday ? 'Capture vitals to triage; the doctor calls triaged patients in' : 'Check-in is only possible on the day of the visit'}>
          {!isToday && <div style={{ marginBottom: 12 }}><Notice tone="grey">You are looking at {formatDate(date)}. The queue is most useful for today.</Notice></div>}
          <div className="board" data-testid="queue-board">
            {COLUMNS.map((k) => {
              const st = def.workflow!.states.find((s) => s.key === k)!;
              const items = day.filter((a) => a.status === k);
              return (
                <section key={k} className="board-col" aria-label={`${st.label} column`}>
                  <header><span className={`dot ${st.tone}`} />{st.label}<b>{items.length}</b></header>
                  {items.map((a) => <QueueCard key={a.id} visit={a} today={isToday} onTriage={() => setTriage(a)} />)}
                  {!items.length && <div className="board-empty">Nobody here</div>}
                </section>
              );
            })}
          </div>
          {day.some((a) => ['dna', 'cancelled'].includes(a.status ?? '')) && (
            <p className="muted-note" style={{ marginTop: 12 }}>Not attended / cancelled: {day.filter((a) => ['dna', 'cancelled'].includes(a.status ?? '')).map((a) => `${patientName(data, a.values.patient)} (${str(a, 'time')})`).join(', ')}</p>
          )}
        </Panel>
      )}
      {view === 'list' && <Panel><RecordTable def={def} rows={day} moduleKey="waiting" /></Panel>}
      {view === 'upcoming' && <Panel title="Upcoming bookings" meta="All future booked visits"><RecordTable def={def} rows={upcoming} moduleKey="waiting" /></Panel>}
      {booking && <RecordFormModal def={def} initial={booking} open title="New visit" onClose={() => setBooking(null)} onSave={save} />}
      {triage && <TriageModal visit={records(data, 'visits').find((r) => r.id === triage.id) ?? triage} data={data} onClose={() => setTriage(null)} />}
    </>
  );
}

function QueueCard({ visit, today, onTriage }: { visit: DemoRecord; today: boolean; onTriage: () => void }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can } = useUser();
  const def = act.def('visits');
  // Users who can triage get the vitals form button, which also marks the visit triaged —
  // so the generic "Record triage" step (blocked until vitals exist) is not shown twice.
  const canTriage = can('triage');
  const cardDef = useMemo(() => (canTriage ? { ...def, workflow: { ...def.workflow!, transitions: def.workflow!.transitions.filter((t) => t.to !== 'triaged') } } : def), [def, canTriage]);
  const wait = today ? minutesWaiting(visit, todayStr()) : null;
  const alerts = can('clinical.view') ? vitalAlerts(visit.values) : [];
  return (
    <article className="board-card" data-testid="queue-card">
      <Link to={`${base}/waiting/${visit.id}`}><strong>{patientName(data, visit.values.patient)}</strong></Link>
      <small>{str(visit, 'time')} · {label(VISIT_TYPES, str(visit, 'type'))} · {CLINICIANS.find((c) => c.value === str(visit, 'clinician'))?.short ?? ''}</small>
      {str(visit, 'arrivedAt') && visit.status !== 'done' && <small>Arrived {str(visit, 'arrivedAt')}{wait !== null ? ` · ${wait} min` : ''}</small>}
      <Flags flags={alerts} />
      <AllergyTag data={data} patientId={visit.values.patient} />
      <div className="btns" style={{ flexWrap: 'wrap' }}>
        {canTriage && ['arrived', 'triaged', 'withdoctor'].includes(visit.status ?? '') && (
          <button type="button" className={`btn xs ${visit.status === 'arrived' ? 'primary' : ''}`} onClick={onTriage} data-testid="open-triage">{visit.status === 'arrived' ? 'Triage (vitals)' : 'Update vitals'}</button>
        )}
        <WorkflowActions def={cardDef} record={visit} compact />
      </div>
    </article>
  );
}
