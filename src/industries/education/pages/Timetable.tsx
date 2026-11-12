import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { Empty, Field, Flags, Modal, Notice, PageHeader, Panel, Segmented, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { SUBJECTS, UNASSESSED, subjectLabel } from '../data';
import {
  className, coverGaps, coverNeeded, formatSlots, fullName, isTeaching, ownClass, refNum, slotLabel, slotProblem, slotsOf, sortedClasses, staffByNum, staffOfUser, teacherLessons,
  timetableClashes, timetableDay, timetableOf, todayStr,
} from '../helpers';
import { ModuleLink, WeekGrid, WhoCan } from './shared';

const cellStyle = { display: 'flex', flexDirection: 'column', gap: 2, width: '100%', minHeight: 46, textAlign: 'left', borderRadius: 9, border: '1px solid var(--line)', background: '#fff', padding: '6px 8px' } as const;

/** The week by class or by teacher. Changing a lesson is refused when the teacher is already in another class. */
export default function Timetable() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, user, hasModule } = useUser();
  const today = todayStr();
  const classes = sortedClasses(data);
  const teachers = records(data, 'staff').filter(isTeaching).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const me = staffOfUser(data, user);
  const [view, setView] = useState<'class' | 'teacher'>('class');
  const [classId, setClassId] = useState(() => ownClass(data, user)?.id ?? classes[0]?.id ?? '');
  const [teacherId, setTeacherId] = useState(() => (me && isTeaching(me) ? me.id : teachers[0]?.id ?? ''));
  const [edit, setEdit] = useState<{ slot: number; subject: string; teacher: string } | null>(null);
  const [error, setError] = useState('');

  const tt = timetableOf(data, classId);
  const slots = slotsOf(tt);
  const teacher = findRecord(data, 'staff', teacherId);
  const lessons = teacherLessons(data, teacher);
  const clashes = timetableClashes(data);
  const leaveDef = act.def('leave');
  const absences = records(data, 'leave').filter((l) => str(l, 'date') >= today).sort((a, b) => str(a, 'date').localeCompare(str(b, 'date')));
  const editable = can('timetable');

  const saveLesson = () => {
    if (!edit || !tt) return;
    const t = findRecord(data, 'staff', edit.teacher);
    const problem = !edit.subject ? 'Choose a subject for the lesson.' : slotProblem(data, classId, edit.slot, t);
    if (problem) { setError(problem); act.toast(problem, 'err'); return; }
    const next = [...slots];
    next[edit.slot] = { subject: edit.subject, teacher: refNum(t) };
    act.update('timetables', tt.id, { slots: formatSlots(next) }, `${slotLabel(edit.slot)}: ${subjectLabel(edit.subject)} with ${fullName(t)}`);
    act.toast(`${className(data, classId)} · ${slotLabel(edit.slot)} saved`);
    setEdit(null); setError('');
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Teaching`} title="Timetable" subtitle="Six periods a day, Monday to Friday. A lesson is a subject and a teacher; a teacher cannot be in two classes in the same period." />
      <div className="toolbar">
        <Segmented label="View" value={view} onChange={setView} options={[{ value: 'class', label: 'By class' }, { value: 'teacher', label: 'By teacher' }]} />
        {view === 'class' ? (
          <select className="select" aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{str(c, 'name')}</option>)}
          </select>
        ) : (
          <select className="select" aria-label="Teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            {teachers.map((t) => <option key={t.id} value={t.id}>{fullName(t)} · {str(t, 'subjects')}</option>)}
          </select>
        )}
        <Tag tone={clashes.length ? 'red' : 'green'}>{clashes.length ? `${clashes.length} double-booking${clashes.length === 1 ? '' : 's'}` : 'No teacher is double-booked'}</Tag>
      </div>
      <div className="doc-grid">
        <div className="stack">
          {view === 'class' ? (
            <Panel title={`${className(data, classId)} — week`} meta={editable ? 'Click a lesson to change its subject or teacher' : 'Read only for your simulated role'}>
              {tt ? (
                <WeekGrid label={`${className(data, classId)} timetable`} today={timetableDay(today)} cell={(slot) => {
                  const s = slots[slot];
                  const body = s ? <><b style={{ fontSize: 12 }}>{subjectLabel(s.subject)}</b><small style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{fullName(staffByNum(data, s.teacher))}</small></> : <small style={{ color: 'var(--muted-3)' }}>Free</small>;
                  return editable
                    ? <button type="button" style={cellStyle} data-testid={`slot-${slot}`} aria-label={`${slotLabel(slot)}: ${s ? `${subjectLabel(s.subject)} with ${fullName(staffByNum(data, s.teacher))}` : 'free'} — change`} onClick={() => { setEdit({ slot, subject: s?.subject ?? '', teacher: staffByNum(data, s?.teacher ?? -1)?.id ?? '' }); setError(''); }}>{body}</button>
                    : <div style={cellStyle} data-testid={`slot-${slot}`}>{body}</div>;
                }} />
              ) : <Empty title="No timetable for this class yet" body="A new class starts with an empty week." action={editable && classId ? <button className="btn primary" data-testid="start-timetable" onClick={() => { act.create('timetables', { class: classId, slots: '' }, undefined, `Timetable started for ${className(data, classId)}`); act.toast('Empty timetable created — click a period to add a lesson'); }}>Start an empty timetable</button> : undefined} />}
              <WhoCan permission="timetable" what="Changing the timetable:" />
              <p className="muted-note" style={{ marginTop: 10 }}>Physical Education and Library & reading are lessons without marks; the class’s usual teacher is free in those periods and can be asked to cover.</p>
            </Panel>
          ) : (
            <Panel title={`${fullName(teacher)} — week`} meta={`${lessons.length} lessons a week · ${30 - lessons.length} free periods`} right={teacher ? <Flags flags={act.def('staff').flags?.(teacher, data, today, user) ?? []} /> : undefined}>
              <WeekGrid label={`${fullName(teacher)} timetable`} today={timetableDay(today)} cell={(slot) => {
                const l = lessons.find((x) => x.slot === slot);
                return <div style={{ ...cellStyle, background: l ? '#fff' : 'transparent', borderStyle: l ? 'solid' : 'dashed' }}>{l ? <><b style={{ fontSize: 12 }}>{className(data, l.classId)}</b><small style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{subjectLabel(l.subject)}</small></> : <small style={{ color: 'var(--muted-3)' }}>Free</small>}</div>;
              }} />
            </Panel>
          )}
        </div>
        <div className="stack">
          <Panel title="Absent teachers & cover" meta="Today and the days ahead" right={hasModule('cover') ? <Link className="btn sm" to={`${base}/cover`}>All absences</Link> : undefined}>
            {absences.length ? (
              <ul className="list" data-testid="cover-today">
                {absences.map((l) => {
                  const need = coverNeeded(l, data).length;
                  const gaps = coverGaps(l, data).length;
                  return (
                    <li key={l.id} style={{ padding: '9px 0' }}>
                      <div className="grow"><b><ModuleLink module="cover" id={l.id}>{leaveDef.title(l, data)}</ModuleLink></b><small>{need ? `${need - gaps} of ${need} periods covered` : 'No lessons that day'}{str(l, 'date') === today ? ' · today' : ''}</small></div>
                      <Tag tone={gaps && l.status === 'open' ? 'red' : 'green'}>{gaps && l.status === 'open' ? `${gaps} to cover` : 'Covered'}</Tag>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty title="No teacher is absent" body="Record an absence under Staff absence & cover to arrange substitutes." />}
          </Panel>
          <RoleBar compact />
        </div>
      </div>
      <Modal open={!!edit} title={edit ? `${className(data, classId)} · ${slotLabel(edit.slot)}` : ''} sub="Change the lesson. The teacher is checked against every other class in the same period." onClose={() => setEdit(null)}
        footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" onClick={saveLesson} data-testid="save-lesson">Save lesson</button></>}>
        {edit && (
          <div className="form-grid">
            <Field label="Subject">
              <select className="select" aria-label="Lesson subject" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })}>
                <option value="">Select…</option>
                {SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}{UNASSESSED.includes(s.value) ? ' (no marks)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Teacher">
              <select className="select" aria-label="Lesson teacher" value={edit.teacher} onChange={(e) => { setEdit({ ...edit, teacher: e.target.value }); setError(''); }}>
                <option value="">Select…</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{fullName(t)}{slotProblem(data, classId, edit.slot, t) ? ' — teaching another class' : ''}</option>)}
              </select>
            </Field>
            {error && <div className="span-2" data-testid="lesson-error"><Notice tone="red">{error}</Notice></div>}
          </div>
        )}
      </Modal>
    </>
  );
}
