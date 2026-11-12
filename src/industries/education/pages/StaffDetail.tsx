import { useNavigate, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { LEAVE_REASONS, label, subjectLabel } from '../data';
import { className, classTaughtBy, coverGaps, coverNeeded, fullName, isTeaching, leaveOn, staffFlags, teacherLessons, timetableDay, todayStr } from '../helpers';
import { Check, ModuleLink, WeekGrid, WhoCan } from './shared';

/** A staff member: compliance documents, the week's lessons and days absent. */
export default function StaffDetail() {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { id } = useParams();
  const { can } = useUser();
  const s = findRecord(data, 'staff', id);
  if (!s) return <RecordDetail />;

  const today = todayStr();
  const teaching = isTeaching(s);
  const lessons = teacherLessons(data, s);
  const cls = classTaughtBy(data, s.id);
  const absences = records(data, 'leave').filter((l) => str(l, 'staff') === s.id).sort((a, b) => str(b, 'date').localeCompare(str(a, 'date')));
  const leaveDef = act.def('leave');
  const flags = staffFlags(s, data, today);
  const sace = flags.find((f) => f.label.includes('SACE'));
  const awayToday = leaveOn(data, s.id, today);

  const recordAbsence = () => {
    const rec = act.create('leave', { staff: s.id, date: today, reason: 'sick', note: '', cover: '' }, 'open', `Absence recorded for ${fullName(s)}`);
    act.toast(`${fullName(s)} marked absent today — ${coverNeeded(rec, data).length} periods need a substitute`);
    navigate(`${base}/cover/${rec.id}`);
  };

  return (
    <RecordDetail
      aside={
        <>
          <Panel title="Compliance" meta="Yes/no and dates only — no documents are stored or verified">
            <ul className="list">
              {(teaching || str(s, 'role') === 'principal') && <Check ok={!sace || sace.tone !== 'red'} label="SACE registration" detail={sace ? sace.label : str(s, 'saceExpiry') ? `${str(s, 'saceNo')} · valid until ${formatDate(str(s, 'saceExpiry'))}` : str(s, 'saceNo')} />}
              <Check ok={s.values.policeClearance === true} label="Police clearance on file" detail={s.values.policeClearance === true ? 'Recorded as received' : 'Not on file yet'} />
            </ul>
            {can('staff.manage') && (
              <label className="check" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={s.values.policeClearance === true} onChange={(e) => act.update('staff', s.id, { policeClearance: e.target.checked }, e.target.checked ? 'Police clearance recorded as on file' : 'Police clearance marked as not on file')} /> Police clearance certificate received
              </label>
            )}
            <WhoCan permission="staff.manage" what="Updating compliance:" />
          </Panel>
          <Panel title="Days absent" right={awayToday ? <Tag tone="amber">Absent today</Tag> : undefined}>
            {absences.length ? (
              <ul className="list">
                {absences.map((l) => (
                  <li key={l.id} style={{ padding: '8px 0' }}>
                    <div className="grow"><b><ModuleLink module="cover" id={l.id}>{formatDate(str(l, 'date'))}</ModuleLink></b><small>{label(LEAVE_REASONS, str(l, 'reason'))} · {coverNeeded(l, data).length - coverGaps(l, data).length}/{coverNeeded(l, data).length} periods covered</small></div>
                    <StatusTag workflow={leaveDef.workflow} status={l.status} />
                  </li>
                ))}
              </ul>
            ) : <p className="muted-note">No absences recorded.</p>}
            {teaching && can('staff.manage') && !awayToday && <div className="btns" style={{ marginTop: 10 }}><button className="btn sm" onClick={recordAbsence} data-testid="record-absence">Record absence for today</button></div>}
            {teaching && !awayToday && <p className="muted-note" style={{ marginTop: 8 }}>Recording an absence lists today’s {lessons.filter((x) => Math.floor(x.slot / 6) === timetableDay(today)).length} lessons for substitute cover.</p>}
          </Panel>
        </>
      }>
      {teaching && (
        <Panel title="Week’s lessons" meta={`${lessons.length} lessons a week${cls ? ` · class teacher of ${str(cls, 'name')}` : ''}`}>
          {lessons.length ? (
            <WeekGrid label={`${fullName(s)} timetable`} today={timetableDay(today)} cell={(slot) => {
              const l = lessons.find((x) => x.slot === slot);
              return l ? <div style={{ fontSize: 12 }}><b>{className(data, l.classId)}</b><small style={{ display: 'block', color: 'var(--muted-2)', fontSize: 10.5 }}>{subjectLabel(l.subject)}</small></div> : <small style={{ color: 'var(--muted-3)' }}>Free</small>;
            }} />
          ) : <p className="muted-note">No timetabled lessons — free to cover for absent colleagues in any period.</p>}
        </Panel>
      )}
    </RecordDetail>
  );
}
