import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { addDays, dueState, formatDate } from '../../../core/lib/dates';
import { DueTag, Empty, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { APPOINTMENT_TYPES, LENS_OPTIONS, RECALL_TYPES, label } from '../data';
import { clashes, todayStr } from '../helpers';
import { RxCard } from './shared';

export default function PatientProfile() {
  const { id } = useParams();
  const data = useData();
  const p = findRecord(data, 'patients', id);
  return (
    <RecordDetail aside={p ? <Aside id={p.id} /> : undefined}>
      {p && <Timeline id={p.id} />}
    </RecordDetail>
  );
}

function Timeline({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule, can } = useUser();
  const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow;
  const mine = (k: string) => records(data, k).filter((r) => str(r, 'patient') === id);
  const items = [
    ...mine('appointments').map((r) => ({ r, k: 'appointments', mod: 'diary', date: str(r, 'date'), title: label(APPOINTMENT_TYPES, str(r, 'type')), sub: str(r, 'time') })),
    ...(can('clinical.view') ? mine('exams').map((r) => ({ r, k: 'exams', mod: 'exams', date: str(r, 'date'), title: 'Eye examination', sub: str(r, 'diagnosis') })) : []),
    ...mine('prescriptions').map((r) => ({ r, k: 'prescriptions', mod: 'prescriptions', date: str(r, 'date'), title: 'Prescription issued', sub: `valid until ${formatDate(str(r, 'expiry'))}` })),
    ...mine('orders').map((r) => ({ r, k: 'orders', mod: 'orders', date: r.createdAt.slice(0, 10), title: 'Optical order', sub: label(LENS_OPTIONS, str(r, 'lens')) })),
    ...mine('claims').map((r) => ({ r, k: 'claims', mod: 'claims', date: str(r, 'date'), title: 'Account / claim', sub: '' })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.r.createdAt.localeCompare(a.r.createdAt));
  return (
    <Panel title="Visit history" meta="Appointments, exams, prescriptions, orders and accounts for this patient">
      {items.length ? (
        <ul className="list" data-testid="patient-timeline">
          {items.map(({ r, k, mod, date, title, sub }) => (
            <li key={k + r.id}>
              <span className="time-chip">{formatDate(date)}</span>
              <div className="grow">
                {hasModule(mod) ? <Link to={`${base}/${mod}/${r.id}`}><b>{title}</b></Link> : <b>{title}</b>}
                <small>{r.ref}{sub ? ` · ${sub}` : ''}</small>
              </div>
              <StatusTag workflow={wf(k)} status={r.status} />
            </li>
          ))}
        </ul>
      ) : <Empty title="No visits yet" body="Book a first appointment from the panel on the right." />}
      {!can('clinical.view') && <p className="muted-note" style={{ marginTop: 10 }}>Exam records are hidden for your simulated role.</p>}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const [booking, setBooking] = useState(false);
  const p = findRecord(data, 'patients', id)!;
  const rx = records(data, 'prescriptions').filter((r) => str(r, 'patient') === id && r.status === 'issued').sort((a, b) => str(b, 'date').localeCompare(str(a, 'date')))[0];
  const upcoming = records(data, 'appointments').filter((a) => str(a, 'patient') === id && a.status === 'booked' && str(a, 'date') >= todayStr()).sort((a, b) => str(a, 'date').localeCompare(str(b, 'date')))[0];
  return (
    <>
      <Panel title="Recall" right={<DueTag state={dueState(str(p, 'recallDue'), todayStr(), 30)} label={dueState(str(p, 'recallDue'), todayStr(), 30) === 'ok' ? 'Not yet due' : undefined} />}>
        {str(p, 'recallDue')
          ? <p className="muted-note"><b>{label(RECALL_TYPES, str(p, 'recallType'))}</b> due {formatDate(str(p, 'recallDue'))}. Last exam {formatDate(str(p, 'lastExam'))}.</p>
          : <p className="muted-note">No recall yet — the recall date is set automatically when this patient’s first eye exam is finalised.</p>}
        {!p.values.consentRecall && (
          <p className="muted-note" style={{ marginTop: 8 }} data-testid="consent-note">
            No consent for recall reminders is recorded, so this patient is never contacted from the recall list.{' '}
            {can('patients.edit') && <button className="btn xs" data-testid="record-consent" onClick={() => { act.update('patients', id, { consentRecall: true }, 'Recall reminder consent recorded'); act.toast('Consent recorded — reminders can now be logged'); }}>Record consent</button>}
          </p>
        )}
        {upcoming ? <p className="muted-note" style={{ marginTop: 8 }}>Next appointment: {formatDate(str(upcoming, 'date'))} at {str(upcoming, 'time')}.</p>
          : can('bookings') && <button className="btn sm primary" style={{ marginTop: 12 }} onClick={() => setBooking(true)} data-testid="book-patient">Book appointment</button>}
      </Panel>
      <Panel title="Current prescription">{rx ? <RxCard values={rx.values} caption={`${rx.ref} · valid until ${formatDate(str(rx, 'expiry'))}`} /> : <Empty title="No current prescription" />}</Panel>
      {booking && (
        <RecordFormModal def={act.def('appointments')} open title="Book appointment" initial={{ patient: id, type: 'exam', date: addDays(todayStr(), 1), time: '09:00', practitioner: 'lk' }}
          onClose={() => setBooking(false)}
          onSave={(v) => {
            if (clashes(records(data, 'appointments'), v)) { act.toast('That practitioner is already booked at that time.', 'err'); return; }
            act.create('appointments', v, 'booked', 'Appointment booked'); act.toast('Appointment booked'); setBooking(false);
          }} />
      )}
    </>
  );
}
