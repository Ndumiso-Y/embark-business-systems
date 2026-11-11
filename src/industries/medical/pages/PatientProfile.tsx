import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { DueTag, Empty, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { CHRONIC_CONDITIONS, CONTROL, MEDICINES, TESTS, VISIT_TYPES, label } from '../data';
import { clashes, reviewState, todayStr } from '../helpers';

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

type Item = { id: string; ref: string; k: string; mod: string; date: string; title: string; sub: string; status?: string; created: string; abnormal?: boolean };

function Timeline({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule, can } = useUser();
  const [filter, setFilter] = useState('all');
  const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow;
  const mine = (k: string) => records(data, k).filter((r) => str(r, 'patient') === id);
  const clinical = can('clinical.view');
  const items: Item[] = [
    ...mine('visits').map((r) => ({ id: r.id, ref: r.ref, k: 'visits', mod: 'waiting', date: str(r, 'date'), title: label(VISIT_TYPES, str(r, 'type')), sub: `${str(r, 'time')}${str(r, 'reason') ? ` · ${str(r, 'reason')}` : ''}`, status: r.status, created: r.createdAt })),
    ...(clinical ? mine('consults').map((r) => ({ id: r.id, ref: r.ref, k: 'consults', mod: 'consults', date: str(r, 'date'), title: 'Consultation', sub: [str(r, 'icd10'), str(r, 'assessment')].filter(Boolean).join(' · '), status: r.status, created: r.createdAt })) : []),
    ...mine('scripts').map((r) => ({ id: r.id, ref: r.ref, k: 'scripts', mod: 'scripts', date: str(r, 'date'), title: `Script · ${label(MEDICINES, str(r, 'medicine'))}`, sub: `${str(r, 'strength')} · ${str(r, 'repeats') || 0} repeat(s)`, status: r.status, created: r.createdAt })),
    ...mine('results').map((r) => ({ id: r.id, ref: r.ref, k: 'results', mod: 'results', date: str(r, 'requestedOn'), title: `Result · ${label(TESTS, str(r, 'test'))}`, sub: clinical ? str(r, 'summary') : '', status: r.status, created: r.createdAt, abnormal: !!r.values.abnormal })),
    ...mine('claims').map((r) => ({ id: r.id, ref: r.ref, k: 'claims', mod: 'claims', date: str(r, 'date'), title: 'Account / claim', sub: '', status: r.status, created: r.createdAt })),
  ].filter((i) => filter === 'all' || i.k === filter).sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created));
  const filters = [['all', 'All'], ['visits', 'Visits'], ...(clinical ? [['consults', 'Consults']] : []), ['scripts', 'Scripts'], ['results', 'Results'], ['claims', 'Accounts']];
  return (
    <Panel title="Patient timeline" meta="Visits, consultations, scripts, results and accounts"
      right={<select className="select sm" aria-label="Filter timeline" value={filter} onChange={(e) => setFilter(e.target.value)}>{filters.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}>
      {items.length ? (
        <ul className="list" data-testid="patient-timeline">
          {items.map((i) => (
            <li key={i.k + i.id}>
              <span className="time-chip">{formatDate(i.date)}</span>
              <div className="grow">
                {hasModule(i.mod) ? <Link to={`${base}/${i.mod}/${i.id}`}><b>{i.title}</b></Link> : <b>{i.title}</b>}
                <small>{i.ref}{i.sub ? ` · ${i.sub}` : ''}</small>
              </div>
              {i.abnormal && <Tag tone="red">Abnormal</Tag>}
              <StatusTag workflow={wf(i.k)} status={i.status} />
            </li>
          ))}
        </ul>
      ) : <Empty title="Nothing recorded yet" body="Book a first visit from the panel on the right." />}
      {!clinical && <p className="muted-note" style={{ marginTop: 10 }}>Consultation notes and result summaries are hidden for your simulated role.</p>}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const [booking, setBooking] = useState(false);
  const today = todayStr();
  const p = findRecord(data, 'patients', id)!;
  const chronic = records(data, 'chronic').filter((c) => str(c, 'patient') === id && c.status !== 'discharged');
  const scripts = records(data, 'scripts').filter((r) => str(r, 'patient') === id && r.status === 'issued');
  const upcoming = records(data, 'visits').filter((a) => str(a, 'patient') === id && a.status === 'booked' && str(a, 'date') >= today).sort((a, b) => (str(a, 'date') + str(a, 'time')).localeCompare(str(b, 'date') + str(b, 'time')))[0];
  return (
    <>
      <Panel title="Clinical alerts">
        {can('clinical.view') ? (
          <>
            <p className="muted-note"><b>Allergies:</b> {str(p, 'allergies') || 'not recorded'}</p>
            <p className="muted-note" style={{ marginTop: 6 }}><b>Chronic conditions:</b> {str(p, 'chronicConditions') || '—'}</p>
            <p className="muted-note" style={{ marginTop: 6 }}><b>Current medication:</b> {str(p, 'currentMeds') || '—'}</p>
          </>
        ) : <Notice tone="grey">Allergies and chronic conditions are hidden for your simulated role.</Notice>}
      </Panel>
      <Panel title="Chronic care" meta={chronic.length ? `${chronic.length} condition(s) on the register` : undefined}>
        {chronic.length ? (
          <ul className="list">
            {chronic.map((c) => {
              const s = reviewState(c, today);
              return (
                <li key={c.id}>
                  <div className="grow">
                    {hasModule('chronic') ? <Link to={`${base}/chronic/${c.id}`}><b>{label(CHRONIC_CONDITIONS, str(c, 'condition'))}</b></Link> : <b>{label(CHRONIC_CONDITIONS, str(c, 'condition'))}</b>}
                    <small>{label(CONTROL, str(c, 'control'))} · next review {formatDate(str(c, 'nextReview'))}</small>
                  </div>
                  {c.status !== 'active' ? <Tag tone="amber">Lapsed</Tag> : <DueTag state={s} />}
                </li>
              );
            })}
          </ul>
        ) : <p className="muted-note">Not on the chronic register.</p>}
      </Panel>
      <Panel title="Next visit">
        {upcoming ? <p className="muted-note">{formatDate(str(upcoming, 'date'))} at {str(upcoming, 'time')} · {label(VISIT_TYPES, str(upcoming, 'type'))}</p> : <p className="muted-note">No upcoming visit booked.</p>}
        {scripts.length > 0 && <p className="muted-note" style={{ marginTop: 8 }}>{scripts.length} issued script(s) not yet dispensed.</p>}
        {can('bookings') && <button className="btn sm primary" style={{ marginTop: 12 }} onClick={() => setBooking(true)} data-testid="book-patient">Book visit</button>}
      </Panel>
      {booking && (
        <RecordFormModal def={act.def('visits')} open title="Book visit" initial={{ patient: id, type: chronic.length ? 'chronic' : 'acute', date: addDays(today, 1), time: '09:00', clinician: str(p, 'usualDoctor') || 'tm' }}
          onClose={() => setBooking(false)}
          onSave={(v) => {
            if (clashes(records(data, 'visits'), v)) { act.toast('That clinician already has a visit at that time.', 'err'); return; }
            act.create('visits', v, 'booked', 'Visit booked'); act.toast('Visit booked'); setBooking(false);
          }} />
      )}
    </>
  );
}
