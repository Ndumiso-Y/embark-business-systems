import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { useStore } from '../../../core/store';
import { findRecord, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Notice, PageHeader, Panel, Stat, Tag } from '../../../core/components/ui';
import { History } from '../../../core/components/records';
import RoleBar from '../../../core/components/RoleBar';
import { IcoBack } from '../../../core/components/Icons';
import { ABSENCE_REASONS, ATTENDANCE_CODES, CHRONIC_DAYS, label } from '../data';
import {
  absenceMessage, chronicAbsentees, className, consecutiveAbsences, dayAttendance, familyOf, formatMarks, fullName, isSchoolDay, marksOf, ownClass, refNum, registerFor,
  registerState, registersOutstanding, sortedClasses, todayStr, type Mark,
} from '../helpers';
import { useFeedback } from './feedback';
import { ModuleLink, WhoCan } from './shared';

const TONE = { P: 'green', A: 'red', L: 'amber' } as const;

/** One class register for one day: a tap per learner, a reason per absence, then submit (which locks it). */
export function RegisterSheet({ classId, date }: { classId: string; date: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const fb = useFeedback();
  const today = todayStr();
  const [previewFor, setPreviewFor] = useState('');
  const reg = registerFor(data, classId, date);
  const st = registerState(reg, data, classId);
  const locked = reg?.status === 'submitted';
  const future = date > today;
  const closed = !isSchoolDay(date, today);
  const editable = can('attendance') && !locked && !future && !closed;
  const isToday = date === today;
  const name = className(data, classId);

  /** Reads the register straight from the store so two quick taps never overwrite each other. */
  const change = (fn: (marks: Map<number, Mark>) => void) => {
    const live = registerFor(useStore.getState().data[config.id]!, classId, date);
    const marks = new Map(marksOf(live));
    fn(marks);
    if (live) act.update('registers', live.id, { marks: formatMarks(marks) });
    else act.create('registers', { class: classId, date, marks: formatMarks(marks), takenBy: '' }, 'draft', `Register opened for ${name}`);
    fb.clear();
  };
  const setMark = (l: DemoRecord, code: Mark['code']) => change((m) => { const cur = m.get(refNum(l)); m.set(refNum(l), { code, reason: code === 'A' && cur?.code === 'A' ? cur.reason : '' }); });
  const setReason = (l: DemoRecord, reason: string) => change((m) => m.set(refNum(l), { code: 'A', reason }));
  const allPresent = () => change((m) => st.unmarked.forEach((l) => m.set(refNum(l), { code: 'P', reason: '' })));
  const submit = () => {
    const live = registerFor(useStore.getState().data[config.id]!, classId, date);
    if (!live) { fb.fail('No learner is marked yet. Mark each one present, absent or late — or press “Mark all present” first.'); return; }
    const res = act.transition('registers', live.id, 'submitted');
    if (!res.ok) { fb.fail(res.reason); return; }
    act.toast(`${name} register submitted — ${st.present.length + st.late.length} present, ${st.absent.length} absent`);
    fb.clear();
  };

  const previewLearner = st.absent.find((l) => l.id === previewFor) ?? st.absent[0];
  const family = familyOf(data, previewLearner);

  return (
    <>
      <Panel title={`${name} register`} meta={`${formatDate(date)}${isToday ? ' (today)' : ''} · ${st.roll.length} learners on the class list`}
        right={locked ? <Tag tone="green">Submitted · locked</Tag> : <Tag tone={st.unmarked.length ? 'amber' : 'accent'}>{st.roll.length - st.unmarked.length}/{st.roll.length} marked</Tag>}>
        {future && <div style={{ marginBottom: 12 }}><Notice tone="grey">This date is still to come. A register can only be taken on the day or afterwards.</Notice></div>}
        {closed && !future && <div style={{ marginBottom: 12 }}><Notice tone="grey">No school on this day (weekend) — there is no register to take.</Notice></div>}
        {locked && <div style={{ marginBottom: 12 }}><Notice tone="accent">Submitted by {str(reg, 'takenBy') || 'the class teacher'} and locked: {st.present.length} present, {st.late.length} late, {st.absent.length} absent. A submitted register cannot be changed in this demo.</Notice></div>}
        {st.roll.length ? (
          <ul className="list" data-testid="register-list">
            {st.roll.map((l) => {
              const mark = st.marks.get(refNum(l));
              const run = isToday ? consecutiveAbsences(data, l) : 0;
              const becomes = !locked && mark?.code === 'A' ? run + 1 : run;
              return (
                <li key={l.id} style={{ flexWrap: 'wrap', rowGap: 8 }} data-testid={`row-${l.ref}`}>
                  <div className="grow" style={{ minWidth: 150 }}>
                    <b><ModuleLink module="learners" id={l.id}>{fullName(l)}</ModuleLink></b>
                    <small>{l.ref}{!locked && run > 0 ? ` · absent the last ${run} school day${run === 1 ? '' : 's'}` : ''}</small>
                    {becomes >= CHRONIC_DAYS && <Tag tone="red">Absent {becomes} school days in a row</Tag>}
                  </div>
                  {editable ? (
                    <>
                      {mark?.code === 'A' && (
                        <select className="select sm" style={{ width: 'auto', minWidth: 130 }} aria-label={`Reason for ${fullName(l)}`} value={mark.reason} onChange={(e) => setReason(l, e.target.value)}>
                          <option value="">Reason…</option>
                          {ABSENCE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      )}
                      <div className="segmented" role="group" aria-label={`Attendance for ${fullName(l)}`}>
                        {ATTENDANCE_CODES.map((c) => <button key={c.value} type="button" style={{ height: 38, padding: '0 14px' }} aria-pressed={mark?.code === c.value} onClick={() => setMark(l, c.value as Mark['code'])}>{c.label}</button>)}
                      </div>
                    </>
                  ) : mark ? <Tag tone={TONE[mark.code]}>{label(ATTENDANCE_CODES, mark.code)}{mark.code === 'A' && mark.reason ? ` · ${label(ABSENCE_REASONS, mark.reason)}` : ''}</Tag> : <Tag tone="dark">Not marked</Tag>}
                </li>
              );
            })}
          </ul>
        ) : <Empty title="No learners in this class" body="Learners are placed in a class when an application is accepted." />}
        {editable && (
          <div className="btns" style={{ marginTop: 14 }}>
            <button className="btn" onClick={allPresent} disabled={!st.unmarked.length} data-testid="mark-all-present">Mark all present{st.unmarked.length && st.unmarked.length < st.roll.length ? ` (the ${st.unmarked.length} left)` : ''}</button>
            <button className="btn primary" onClick={submit} data-testid="submit-register">Submit register</button>
          </div>
        )}
        {fb.view}
        {!locked && !future && !closed && <WhoCan permission="attendance" what="Taking the register:" />}
      </Panel>
      {st.absent.length > 0 && previewLearner && (
        <Panel title="Absence message to the parent" meta="Preview only — no message is sent from this demo">
          {st.absent.length > 1 && (
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <select className="select" aria-label="Absent learner" value={previewLearner.id} onChange={(e) => setPreviewFor(e.target.value)}>
                {st.absent.map((l) => <option key={l.id} value={l.id}>{fullName(l)}</option>)}
              </select>
            </div>
          )}
          <div className="sms-preview" data-testid="absence-preview">{absenceMessage(config.businessName, previewLearner, date, st.marks.get(refNum(previewLearner)), data)}</div>
          <p className="muted-note">To: {str(family, 'guardian1') || 'first guardian'} · {str(family, 'phone1') || 'no number on file'} (fictional). A live system would send this by SMS when the register is submitted; here it is only shown.</p>
        </Panel>
      )}
    </>
  );
}

/** Pick a class and a day, take the register, see which registers are still outstanding. */
export default function Attendance() {
  const config = useIndustry();
  const data = useData();
  const { user } = useUser();
  const today = todayStr();
  const [params, setParams] = useSearchParams();
  const classes = sortedClasses(data);
  const outstanding = registersOutstanding(data, today);
  const fallback = ownClass(data, user) ?? outstanding[0] ?? classes[0];
  const wanted = params.get('class') ?? '';
  const classId = findRecord(data, 'classes', wanted) ? wanted : fallback?.id ?? '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : today;
  const go = (patch: { class?: string; date?: string }) => setParams({ class: classId, date, ...patch }, { replace: true });
  const day = dayAttendance(data, today);
  const chronic = chronicAbsentees(data);
  const mine = ownClass(data, user);

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Teaching`} title="Daily attendance" subtitle="One register per class per school day. Mark each learner present, absent or late in one tap, give every absence a reason, then submit — a submitted register is locked." />
      <div className="stat-grid">
        <Stat label="Present today" value={day.roll ? `${day.pct}%` : '—'} tone={day.pct >= 95 ? 'accent' : undefined} sub={`${day.present} of ${day.roll} learners on ${day.registers} submitted registers`} />
        <Stat label="Registers outstanding today" value={outstanding.length} tone={outstanding.length ? 'red' : undefined} sub={outstanding.slice(0, 3).map((c) => str(c, 'name')).join(' · ') || 'every class has submitted'} />
        <Stat label="Absent today" value={day.absent} sub={`${day.late} late`} />
        <Stat label={`Absent ${CHRONIC_DAYS}+ days in a row`} value={chronic.length} tone={chronic.length ? 'red' : undefined} sub={chronic.slice(0, 2).map((c) => fullName(c.learner)).join(' · ') || 'no learner flagged'} />
      </div>
      <div className="toolbar">
        <select className="select" aria-label="Class" value={classId} onChange={(e) => go({ class: e.target.value })}>
          {classes.map((c) => <option key={c.id} value={c.id}>{str(c, 'name')}{mine?.id === c.id ? ' (your class)' : ''}</option>)}
        </select>
        <input className="input" style={{ width: 'auto', height: 38 }} type="date" aria-label="Register date" value={date} onChange={(e) => go({ date: e.target.value || today })} />
        {date !== today && <button className="btn sm" onClick={() => go({ date: today })}>Back to today</button>}
      </div>
      <div className="doc-grid">
        <div className="stack">{classId ? <RegisterSheet key={`${classId}-${date}`} classId={classId} date={date} /> : <Panel><Empty title="No classes yet" /></Panel>}</div>
        <div className="stack">
          <Panel title={date === today ? 'Today’s registers' : `Registers for ${formatDate(date)}`} meta="Choose a class to open its register">
            <ul className="list" data-testid="register-status">
              {classes.map((c) => {
                const reg = registerFor(data, c.id, date);
                const st = registerState(reg, data, c.id);
                return (
                  <li key={c.id} style={{ padding: '9px 0' }}>
                    <div className="grow">
                      <button className="link-btn" onClick={() => go({ class: c.id })} aria-current={c.id === classId ? 'true' : undefined}>{str(c, 'name')}</button>
                      <small>{reg?.status === 'submitted' ? `${st.present.length + st.late.length} present · ${st.absent.length} absent` : fullName(findRecord(data, 'staff', str(c, 'teacher')))}</small>
                    </div>
                    {reg?.status === 'submitted' ? <Tag tone="green">Submitted</Tag> : reg ? <Tag tone="amber">In progress</Tag> : <Tag tone={date === today ? 'red' : 'dark'}>Not started</Tag>}
                  </li>
                );
              })}
            </ul>
          </Panel>
          <RoleBar compact />
        </div>
      </div>
    </>
  );
}

/** A stored register opened from the register list or a link. */
export function AttendanceDetail() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { id } = useParams();
  const reg = findRecord(data, 'registers', id);
  if (!reg) return <><PageHeader kicker={config.businessName} title="Register not found" subtitle="It may have been deleted, or the demo data was reset." /><Link className="btn" to={`${base}/attendance`}><IcoBack /> Back to daily attendance</Link></>;
  return (
    <>
      <Link className="back-link" to={`${base}/attendance?class=${str(reg, 'class')}&date=${str(reg, 'date')}`}><IcoBack /> Daily attendance</Link>
      <PageHeader kicker={`Register · ${reg.ref}`} title={`${className(data, str(reg, 'class'))} — ${formatDate(str(reg, 'date'))}`} subtitle={str(reg, 'takenBy') ? `Taken by ${str(reg, 'takenBy')}` : 'Daily class register'} />
      <div className="doc-grid">
        <div className="stack"><RegisterSheet classId={str(reg, 'class')} date={str(reg, 'date')} /></div>
        <div className="stack">
          <Panel title="History" meta="Who did what, when (simulated users)">{reg.history.length ? <History record={reg} /> : <p className="muted-note">Seeded sample register — no history entries.</p>}</Panel>
          <RoleBar compact />
        </div>
      </div>
    </>
  );
}
