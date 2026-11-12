import { Link, useParams } from 'react-router-dom';
import { useBase, useData, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { Empty, Flags, Meters, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { ATTENDANCE_CODES, UNASSESSED, label, subjectLabel } from '../data';
import {
  attendanceStats, classLearners, classRoom, fullName, learnerFlags, marksOf, refNum, registerFor, slotsOf, staffByNum, timetableOf, todayStr,
} from '../helpers';
import { ModuleLink } from './shared';

const TONE = { P: 'green', A: 'red', L: 'amber' } as const;

/** A class: its list of learners, places taken, who teaches what, and today's register. */
export default function ClassDetail() {
  const data = useData();
  const base = useBase();
  const { id } = useParams();
  const { user, hasModule } = useUser();
  const cls = findRecord(data, 'classes', id);
  if (!cls) return <RecordDetail />;

  const today = todayStr();
  const learners = classLearners(data, cls.id);
  const room = classRoom(data, cls);
  const reg = registerFor(data, cls.id, today);
  const marks = marksOf(reg);
  const waiting = records(data, 'applications').filter((a) => a.status === 'waitlisted' && str(a, 'grade') === str(cls, 'grade')).length;
  const lessons = new Map<string, { subject: string; teacher: number; periods: number }>();
  for (const s of slotsOf(timetableOf(data, cls.id))) {
    if (!s) continue;
    const key = `${s.subject}@${s.teacher}`;
    lessons.set(key, { ...s, periods: (lessons.get(key)?.periods ?? 0) + 1 });
  }

  return (
    <RecordDetail
      aside={
        <>
          <Panel title="Places" meta="Enrolled learners and places held by offers against capacity">
            <Meters items={[{ label: 'Places taken', value: room.enrolled + room.held, max: room.capacity, tone: room.free > 0 ? 'green' : 'red', sub: `${room.enrolled} enrolled${room.held ? ` · ${room.held} held by offers` : ''} · ${room.free} free${waiting ? ` · ${waiting} on the waiting list` : ''}` }]} />
          </Panel>
          <Panel title="Today’s register" right={reg?.status === 'submitted' ? <Tag tone="green">Submitted</Tag> : reg ? <Tag tone="amber">In progress</Tag> : <Tag tone="red">Not started</Tag>}>
            <p className="muted-note">{reg?.status === 'submitted' ? `Taken by ${str(reg, 'takenBy') || 'the class teacher'}.` : 'The class teacher takes the register first thing in the morning.'}</p>
            {hasModule('attendance') && <div className="btns" style={{ marginTop: 10 }}><Link className="btn sm" to={`${base}/attendance?class=${cls.id}&date=${today}`}>{reg?.status === 'submitted' ? 'View the register' : 'Take the register'}</Link></div>}
          </Panel>
          <Panel title="Subjects & teachers" meta="From the class timetable — periods a week">
            <ul className="list">
              {[...lessons.values()].sort((a, b) => b.periods - a.periods).map((s) => (
                <li key={`${s.subject}${s.teacher}`} style={{ padding: '8px 0' }}>
                  <div className="grow"><b>{subjectLabel(s.subject)}</b><small>{fullName(staffByNum(data, s.teacher))}{UNASSESSED.includes(s.subject) ? ' · no marks' : ''}</small></div>
                  <Tag tone="dark">{s.periods} a week</Tag>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      }>
      <Panel title="Class list" meta={`${learners.length} learners · attendance over the registers held in the demo`}>
        {learners.length ? (
          <div className="table-wrap">
            <table className="table" data-testid="class-list">
              <thead><tr><th>Learner</th><th className="num">Attendance</th><th>Today</th></tr></thead>
              <tbody>
                {learners.map((l) => {
                  const st = attendanceStats(data, l);
                  const mark = marks.get(refNum(l));
                  return (
                    <tr key={l.id}>
                      <td><strong><ModuleLink module="learners" id={l.id}>{fullName(l)}</ModuleLink></strong><small>{l.ref}</small><Flags flags={learnerFlags(l, data, today, user)} /></td>
                      <td className="num">{st.days ? `${st.pct}%` : '—'}</td>
                      <td>{mark ? <Tag tone={TONE[mark.code]}>{label(ATTENDANCE_CODES, mark.code)}</Tag> : <Tag tone="dark">Not marked</Tag>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No learners in this class yet" body="Learners are placed here when an application is accepted." />}
      </Panel>
    </RecordDetail>
  );
}
