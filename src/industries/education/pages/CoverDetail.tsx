import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { useStore } from '../../../core/store';
import { findRecord, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { DAY_NAMES, LEAVE_REASONS, label, subjectLabel } from '../data';
import {
  className, coverCandidateProblem, coverCandidates, coverGaps, coverNeeded, coverOf, formatCover, fullName, isWeekend, refNum, slotPeriod, slotTime, staffByNum, timetableDay,
  type Teaching,
} from '../helpers';
import { useFeedback } from './feedback';
import { ModuleLink, WhoCan } from './shared';

/** A teacher's day off: every lesson they would have taught needs a substitute who is free in that period. */
export default function CoverDetail() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const fb = useFeedback();
  const leave = findRecord(data, 'leave', id);
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  if (!leave) return <RecordDetail />;

  const teacher = findRecord(data, 'staff', str(leave, 'staff'));
  const needed = coverNeeded(leave, data);
  const cover = coverOf(leave);
  const gaps = coverGaps(leave, data);
  const editable = leave.status === 'open' && can('timetable');
  const expanded = editable ? (openSlot !== null && gaps.some((g) => g.slot === openSlot) ? openSlot : gaps[0]?.slot ?? null) : null;
  const date = str(leave, 'date');
  const what = (t: Teaching) => `period ${slotPeriod(t.slot)} (${className(data, t.classId)} · ${subjectLabel(t.subject)})`;

  /** Save the new cover; once every period has a substitute the absence is marked as covered. */
  const save = (next: Map<number, number>, action: string) => {
    act.update('leave', leave.id, { cover: formatCover(next) }, action);
    const live = findRecord(useStore.getState().data[config.id]!, 'leave', leave.id)!;
    if (live.status === 'open' && !coverGaps(live, useStore.getState().data[config.id]!).length) {
      const res = act.transition('leave', leave.id, 'covered');
      if (res.ok) { fb.ok(`Every period is covered for ${formatDate(date)}. The substitutes’ own timetables are unchanged — this is a one-day arrangement.`); act.toast(`${leave.ref}: all ${needed.length} periods covered`); return; }
      fb.fail(res.reason);
    }
  };
  const assign = (t: Teaching, sub: DemoRecord) => {
    const problem = coverCandidateProblem(leave, t.slot, sub, data);
    if (problem) { fb.fail(`${fullName(sub)} ${problem}.`); return; }
    fb.ok(`${fullName(sub)} will cover ${what(t)}.`);
    setOpenSlot(null);
    save(new Map(cover).set(t.slot, refNum(sub)), `${fullName(sub)} to cover ${what(t)}`);
  };
  const remove = (t: Teaching) => {
    const next = new Map(cover);
    next.delete(t.slot);
    act.update('leave', leave.id, { cover: formatCover(next) }, `Substitute removed from ${what(t)}`);
    fb.clear();
  };
  /** Fill every open period with the eligible teacher who has the lightest day, spreading the load. */
  const fillRest = () => {
    const next = new Map(cover);
    const extra = new Map<string, number>();
    const stuck: Teaching[] = [];
    for (const t of gaps) {
      const best = coverCandidates(leave, t.slot, data).filter((c) => !c.problem).sort((a, b) => (a.lessons + (extra.get(a.staff.id) ?? 0)) - (b.lessons + (extra.get(b.staff.id) ?? 0)))[0];
      if (!best) { stuck.push(t); continue; }
      next.set(t.slot, refNum(best.staff));
      extra.set(best.staff.id, (extra.get(best.staff.id) ?? 0) + 1);
    }
    if (stuck.length) fb.fail(`Nobody is free for ${stuck.map(what).join(', ')} — combine classes or ask the deputy to supervise.`);
    else fb.clear();
    if (next.size !== cover.size) save(next, `Remaining ${gaps.length - stuck.length} period${gaps.length - stuck.length === 1 ? '' : 's'} filled with free teachers`);
  };

  return (
    <RecordDetail
      aside={
        <Panel title="Absence" right={<Tag tone={gaps.length ? 'red' : 'green'}>{needed.length - gaps.length}/{needed.length} covered</Tag>}>
          <KeyValues items={[
            { label: 'Teacher', value: teacher ? <ModuleLink module="staff" id={teacher.id}>{fullName(teacher)}</ModuleLink> : '—' },
            { label: 'Day absent', value: formatDate(date) },
            { label: 'Reason', value: label(LEAVE_REASONS, str(leave, 'reason')) },
            { label: 'Timetable used', value: `${DAY_NAMES[timetableDay(date)]}${isWeekend(date) ? ' (weekend — the demo follows Monday)' : ''}` },
            { label: 'Note', value: str(leave, 'note'), wide: true },
          ]} />
        </Panel>
      }>
      <Panel title="Periods needing cover" meta={`${fullName(teacher)}’s lessons on ${formatDate(date)} — each needs a teacher who is free in that period`}
        right={editable && gaps.length > 0 ? <button className="btn sm" onClick={fillRest} data-testid="auto-cover">Fill the {gaps.length === needed.length ? '' : 'remaining '}{gaps.length} period{gaps.length === 1 ? '' : 's'} with free teachers</button> : undefined}>
        {needed.length ? (
          <ul className="list" data-testid="cover-periods">
            {needed.map((t) => {
              const sub = staffByNum(data, cover.get(t.slot) ?? -1);
              const candidates = expanded === t.slot ? coverCandidates(leave, t.slot, data) : [];
              return (
                <li key={t.slot} style={{ flexWrap: 'wrap', rowGap: 8 }} data-testid={`period-${slotPeriod(t.slot)}`}>
                  <span className="time-chip" style={{ minWidth: 92 }}>Period {slotPeriod(t.slot)} · {slotTime(t.slot)}</span>
                  <div className="grow" style={{ minWidth: 140 }}>
                    <b><ModuleLink module="classes" id={t.classId}>{className(data, t.classId)}</ModuleLink> · {subjectLabel(t.subject)}</b>
                    <small>{sub ? `Covered by ${fullName(sub)}` : 'No substitute yet'}</small>
                  </div>
                  {sub ? <Tag tone="green">Covered</Tag> : <Tag tone="red">Needs cover</Tag>}
                  {editable && sub && <button className="btn xs" onClick={() => remove(t)} aria-label={`Remove the substitute from period ${slotPeriod(t.slot)}`}>Remove</button>}
                  {editable && !sub && expanded !== t.slot && <button className="btn xs" onClick={() => setOpenSlot(t.slot)} aria-label={`Choose cover for period ${slotPeriod(t.slot)}`}>Choose cover</button>}
                  {expanded === t.slot && (
                    <div style={{ flexBasis: '100%' }} data-testid="cover-picker">
                      <div className="panel-meta" style={{ marginBottom: 4 }}>{candidates.filter((c) => !c.problem).length} of {candidates.length} teaching staff are free in period {slotPeriod(t.slot)}. The others are listed with the reason.</div>
                      <ul className="list" style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: '2px 12px' }}>
                        {candidates.map(({ staff: s, problem, lessons }) => (
                          <li key={s.id} style={{ padding: '8px 0', flexWrap: 'wrap' }} data-testid={`candidate-${s.ref}`}>
                            <div className="grow" style={{ minWidth: 170 }}>
                              <b>{fullName(s)}</b>
                              <small>{str(s, 'subjects')} · {lessons} lesson{lessons === 1 ? '' : 's'} of their own that day</small>
                              {problem && <small style={{ color: 'var(--danger)' }}>{fullName(s).split(' ')[0]} {problem}</small>}
                            </div>
                            {problem ? <Tag tone="red">Not eligible</Tag> : <><Tag tone="green">Eligible</Tag><button className="btn xs primary" onClick={() => assign(t, s)} aria-label={`Assign ${fullName(s)} to period ${slotPeriod(t.slot)}`}>Assign</button></>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <Notice tone="grey">{fullName(teacher)} has no timetabled lessons on this day, so there is nothing to cover.{leave.status === 'open' ? ' Press “Confirm cover” above to close the absence.' : ''}</Notice>}
        {fb.view}
        {leave.status === 'covered' && needed.length > 0 && <p className="muted-note" style={{ marginTop: 10 }}>Cover is confirmed. Use “Reopen cover” above to change a substitute.</p>}
        {leave.status === 'open' && <WhoCan permission="timetable" what="Assigning substitutes:" />}
      </Panel>
    </RecordDetail>
  );
}
