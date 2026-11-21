import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { CERT_TYPES } from '../data';
import { attended, attendees, certFlags, certLabel, currentEmployees, employeeCerts, fullName, jobLabel, siteShort, toCsv, todayStr } from '../helpers';
import { EmpLink, WhoCan } from './shared';
import { useFeedback } from './feedback';

/** A course: who is booked, who attended, and the certificates completing it will issue. */
export default function CourseDetail() {
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const fb = useFeedback();
  const [pick, setPick] = useState('');
  const r = findRecord(data, 'courses', id);
  if (!r) return <RecordDetail />;
  const today = todayStr();
  const booked = attendees(r);
  const present = new Set(attended(r));
  const planned = r.status === 'planned';
  const edit = planned && can('training');
  const held = str(r, 'date') <= today;
  const type = str(r, 'certType');
  const months = CERT_TYPES.find((c) => c.value === type)?.months;
  const candidates = currentEmployees(data).filter((e) => !booked.includes(e.id)).sort((a, b) => fullName(a).localeCompare(fullName(b)));

  const book = () => {
    const e = findRecord(data, 'employees', pick);
    if (!e) return;
    act.update('courses', r.id, { attendees: toCsv([...booked, e.id]) }, `Booked: ${fullName(e)}`);
    setPick('');
    fb.ok(`${fullName(e)} booked.`);
  };
  const unbook = (empId: string) => act.update('courses', r.id, { attendees: toCsv(booked.filter((x) => x !== empId)), attended: toCsv([...present].filter((x) => x !== empId)) }, `Removed from the course: ${fullName(findRecord(data, 'employees', empId))}`);
  const mark = (empId: string, on: boolean) => {
    if (!held) { fb.fail(`Attendance can be marked on or after ${formatDate(str(r, 'date'))}.`); return; }
    const next = new Set(present);
    if (on) next.add(empId); else next.delete(empId);
    act.update('courses', r.id, { attended: toCsv([...next]) }, `${on ? 'Attended' : 'Not attended'}: ${fullName(findRecord(data, 'employees', empId))}`);
    fb.clear();
  };

  return (
    <RecordDetail backLabel="Training">
      <Panel title="Attendance" meta={type ? `Completing the course issues a ${certLabel(type).toLowerCase()} valid ${months} months to everyone who attended` : 'This course issues no certificate'}
        right={<Tag tone={present.size ? 'green' : 'dark'}>{present.size}/{booked.length} attended</Tag>}>
        {booked.length ? (
          <ul className="list" data-testid="attendance">
            {booked.map((empId) => {
              const e = findRecord(data, 'employees', empId);
              const current = e && type ? employeeCerts(data, e.id).filter((c) => str(c, 'type') === type).sort((a, b) => str(b, 'expires').localeCompare(str(a, 'expires')))[0] : undefined;
              return (
                <li key={empId} style={{ flexWrap: 'wrap' }}>
                  <div className="grow" style={{ minWidth: 160 }}>
                    <b><EmpLink e={e} /></b>
                    <small>{jobLabel(e)} · {siteShort(str(e, 'site'))}{current ? ` · current certificate expires ${formatDate(str(current, 'expires'))}` : type ? ' · no certificate yet' : ''}</small>
                  </div>
                  {current && certFlags(current, data, today).map((f) => <Tag key={f.label} tone={f.tone}>{f.label}</Tag>)}
                  {planned ? (
                    <label className="check"><input type="checkbox" checked={present.has(empId)} disabled={!edit} onChange={(ev) => mark(empId, ev.target.checked)} aria-label={`${fullName(e)} attended`} /> Attended</label>
                  ) : <Tag tone={present.has(empId) ? 'green' : 'dark'}>{present.has(empId) ? 'Attended' : 'Absent'}</Tag>}
                  {edit && !present.has(empId) && <button className="btn xs ghost" onClick={() => unbook(empId)} aria-label={`Remove ${fullName(e)}`}>Remove</button>}
                </li>
              );
            })}
          </ul>
        ) : <Empty title="Nobody booked yet" />}
        {edit && (
          <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
            <select className="select" aria-label="Book an employee" value={pick} onChange={(ev) => setPick(ev.target.value)}>
              <option value="">Book an employee…</option>
              {candidates.map((e) => <option key={e.id} value={e.id}>{fullName(e)} · {jobLabel(e)} · {siteShort(str(e, 'site'))}</option>)}
            </select>
            <button className="btn sm" disabled={!pick} onClick={book}>Book</button>
          </div>
        )}
        {planned && !held && <p className="muted-note" style={{ marginTop: 10 }}>Attendance can be marked from {formatDate(str(r, 'date'))}.</p>}
        <WhoCan permission="training" what="Bookings and attendance are kept by HR." />
        {fb.view}
      </Panel>
    </RecordDetail>
  );
}
