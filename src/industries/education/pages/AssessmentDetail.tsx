import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { useStore } from '../../../core/store';
import { findRecord, num, str } from '../../../core/engine';
import { KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { PASS_MARK, subjectLabel } from '../data';
import { className, formatScores, fullName, pct, refNum, scoresOf, siblingTasks, taskState, termLabel, weightSum, type Score } from '../helpers';
import { useFeedback } from './feedback';
import { ModuleLink, WhoCan } from './shared';

/** One assessment task: the mark grid (one row per learner) and the task's weighting within the term. */
export default function AssessmentDetail() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const fb = useFeedback();
  const task = findRecord(data, 'assessments', id);
  const [typing, setTyping] = useState<Record<number, string>>({});
  const [weight, setWeight] = useState<string | null>(null);
  if (!task) return <RecordDetail />;

  const def = act.def('assessments');
  const st = taskState(task, data);
  const editable = task.status === 'draft' && can('marks.capture');
  const siblings = siblingTasks(task, data);
  const sum = weightSum(siblings);
  const mayWeight = task.status !== 'published' && (can('marks.capture') || can('marks.publish'));
  const weightText = weight ?? String(num(task, 'weight'));

  /** Marks are saved as they are typed, read from the store so quick edits never overwrite each other. */
  const change = (l: DemoRecord, value: Score | undefined) => {
    const live = findRecord(useStore.getState().data[config.id]!, 'assessments', task.id) ?? task;
    const scores = new Map(scoresOf(live));
    if (value === undefined) scores.delete(refNum(l)); else scores.set(refNum(l), value);
    act.update('assessments', task.id, { marks: formatScores(scores) });
  };
  const type = (l: DemoRecord, text: string) => {
    setTyping((t) => ({ ...t, [refNum(l)]: text }));
    const n = Number(text);
    change(l, text.trim() === '' || !Number.isFinite(n) ? undefined : n);
  };
  const saveWeight = () => {
    const n = Number(weightText);
    if (!(n > 0 && n <= 100)) { fb.fail('A weighting is a percentage between 1 and 100.'); return; }
    act.update('assessments', task.id, { weight: n }, `Weighting set to ${n}%`);
    setWeight(null);
    const total = sum - num(task, 'weight') + n;
    if (total === 100) fb.ok(`Weighting saved — ${subjectLabel(str(task, 'subject'))} now adds up to 100% for the term.`);
    else fb.ok(`Weighting saved. ${subjectLabel(str(task, 'subject'))} adds up to ${total}% for the term — it must be 100% before the last task is published.`);
  };

  return (
    <RecordDetail
      aside={
        <Panel title="Results so far" meta={`${st.roll.length - st.unmarked.length} of ${st.roll.length} learners marked`}>
          <KeyValues items={[
            { label: 'Class average', value: pct(st.average) },
            { label: `Pass rate (${PASS_MARK}%+)`, value: pct(st.passRate) },
            { label: 'Highest', value: pct(st.highest) },
            { label: 'Lowest', value: pct(st.lowest) },
            { label: 'Absent', value: st.absent },
            { label: 'Captured by', value: str(task, 'capturedBy') || 'Not submitted yet' },
            { label: 'Moderated by', value: str(task, 'moderatedBy') || '—' },
          ]} />
          <p className="muted-note" style={{ marginTop: 10 }}>Demo rules: moderation is by a second person; the pass mark and weightings are not CAPS policy.</p>
        </Panel>
      }>
      <Panel title="Mark grid" meta={`Out of ${st.total} · one row per learner in ${className(data, str(task, 'class'))}`}
        right={st.unmarked.length ? <Tag tone="amber">{st.unmarked.length} not marked</Tag> : st.over.length ? <Tag tone="red">Mark above the total</Tag> : <Tag tone="green">All marked</Tag>}>
        <div className="table-wrap">
          <table className="table" data-testid="mark-grid">
            <thead><tr><th>Learner</th><th className="num">Mark / {st.total}</th><th>Absent</th><th className="num">%</th></tr></thead>
            <tbody>
              {st.roll.map((l) => {
                const n = refNum(l);
                const s = st.scores.get(n);
                const bad = typeof s === 'number' && (s > st.total || s < 0);
                const name = fullName(l);
                return (
                  <tr key={l.id} data-testid={`mark-${l.ref}`}>
                    <td><strong><ModuleLink module="learners" id={l.id}>{name}</ModuleLink></strong><small>{l.ref}</small></td>
                    <td className="num" style={{ width: 150 }}>
                      {editable ? (
                        <>
                          <input className="input sm num" style={{ width: 90 }} type="number" min={0} max={st.total} step="0.5" aria-label={`Mark for ${name}`} aria-invalid={bad ? true : undefined} disabled={s === 'A'}
                            value={s === 'A' ? '' : typing[n] ?? (typeof s === 'number' ? String(s) : '')} onChange={(e) => type(l, e.target.value)} />
                          {bad && <small className="field-error" style={{ display: 'block' }} role="alert">Not a mark out of {st.total}</small>}
                        </>
                      ) : s === 'A' ? '—' : typeof s === 'number' ? <span style={bad ? { color: 'var(--danger)' } : undefined}>{s}</span> : <Tag tone="amber">No mark</Tag>}
                    </td>
                    <td>
                      {editable
                        ? <label className="check"><input type="checkbox" aria-label={`${name} was absent`} checked={s === 'A'} onChange={(e) => { setTyping((t) => ({ ...t, [n]: '' })); change(l, e.target.checked ? 'A' : undefined); }} /> Absent</label>
                        : s === 'A' ? <Tag tone="dark">Absent</Tag> : null}
                    </td>
                    <td className="num">{typeof s === 'number' && st.total > 0 && !bad ? `${Math.round((s / st.total) * 100)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editable && <p className="muted-note" style={{ marginTop: 10 }}>Marks save as you type. When every learner has a mark or is ticked absent, press “Submit marks for moderation” above.</p>}
        {task.status === 'draft' && <WhoCan permission="marks.capture" what="Capturing marks:" />}
        {task.status === 'captured' && <div style={{ marginTop: 12 }}><Notice tone="grey">Captured by {str(task, 'capturedBy')} and waiting for moderation by a second person. The marks are locked; “Return for correction” reopens them.</Notice></div>}
      </Panel>

      <Panel title="Weighting" meta={`How much each ${subjectLabel(str(task, 'subject'))} task counts towards the ${termLabel(str(task, 'term'))} percentage in ${className(data, str(task, 'class'))}`}
        right={<Tag tone={sum === 100 ? 'green' : 'amber'}>{sum === 100 ? 'Adds up to 100%' : `Adds up to ${sum}% — must be 100%`}</Tag>}>
        <ul className="list" data-testid="weightings">
          {siblings.map((t) => (
            <li key={t.id} style={{ padding: '9px 0' }}>
              <div className="grow"><b>{t.id === task.id ? `${str(t, 'title')} (this task)` : <ModuleLink module="assessments" id={t.id}>{str(t, 'title')}</ModuleLink>}</b><small>{t.ref} · out of {num(t, 'total')}</small></div>
              <StatusTag workflow={def.workflow} status={t.status} />
              <Tag tone="dark">{num(t, 'weight')}%</Tag>
            </li>
          ))}
        </ul>
        {mayWeight && (
          <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
            <label className="field-label" htmlFor="task-weight">This task counts</label>
            <input id="task-weight" className="input num" style={{ width: 90, height: 38 }} type="number" min={1} max={100} aria-label="Weighting (%)" value={weightText} onChange={(e) => setWeight(e.target.value)} />
            <span className="muted-note">%</span>
            <button className="btn sm" onClick={saveWeight} disabled={weight === null || Number(weight) === num(task, 'weight')} data-testid="save-weight">Save weighting</button>
          </div>
        )}
        {fb.view}
      </Panel>
    </RecordDetail>
  );
}
