import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { DueTag, Empty, Field, Meters, Modal, Panel, Stat } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { CHRONIC_CONDITIONS, CONTROL, label } from '../data';
import { overdueChronic, patientName, reviewState, todayStr } from '../helpers';

/** Record a chronic review: sets last/next review and control status. */
export function ReviewModal({ entry, onClose }: { entry: DemoRecord; onClose: () => void }) {
  const act = useActions();
  const data = useData();
  const cond = CHRONIC_CONDITIONS.find((c) => c.value === str(entry, 'condition'));
  const [date, setDate] = useState(todayStr());
  const [months, setMonths] = useState(String(cond?.reviewMonths ?? 6));
  const [control, setControl] = useState(str(entry, 'control') || 'unknown');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const save = () => {
    if (date > todayStr()) { setErr('A review cannot be recorded in the future.'); return; }
    if (!note.trim()) { setErr('Add a short review note.'); return; }
    const next = addDays(date, Math.round(Number(months) * 30.4));
    const plan = `${str(entry, 'carePlan')}\n${formatDate(date)}: ${note.trim()}`.trim();
    act.update('chronic', entry.id, { lastReview: date, nextReview: next, control, carePlan: plan }, 'Chronic review recorded', note.trim());
    act.toast(`Review recorded — next due ${formatDate(next)}`);
    onClose();
  };
  return (
    <Modal open title={`Chronic review · ${label(CHRONIC_CONDITIONS, str(entry, 'condition'))}`} sub={`${patientName(data, entry.values.patient)} · ${entry.ref}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} data-testid="save-review">Record review</button></>}>
      <div className="form-grid">
        <Field label="Review date"><input className="input" type="date" aria-label="Review date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Next review in">
          <select className="select" aria-label="Next review in" value={months} onChange={(e) => setMonths(e.target.value)}>
            {['1', '3', '6', '12'].map((m) => <option key={m} value={m}>{m} month{m === '1' ? '' : 's'}</option>)}
          </select>
        </Field>
        <Field label="Control status">
          <select className="select" aria-label="Control status" value={control} onChange={(e) => setControl(e.target.value)}>{CONTROL.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        </Field>
        <div className="span-2"><Field label="Review note" error={err || undefined}><textarea className="textarea" aria-label="Review note" value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
      </div>
      <p className="muted-note" style={{ marginTop: 10 }}>Review intervals are demo defaults per condition, not clinical guidelines.</p>
    </Modal>
  );
}

export default function ChronicCare() {
  const data = useData();
  const base = useBase();
  const { can } = useUser();
  const today = todayStr();
  const [reviewing, setReviewing] = useState<DemoRecord | null>(null);
  const active = records(data, 'chronic').filter((c) => c.status === 'active');
  const overdue = overdueChronic(data, today);
  const soon = active.filter((c) => reviewState(c, today) === 'due-soon').sort((a, b) => str(a, 'nextReview').localeCompare(str(b, 'nextReview')));
  const due = [...overdue, ...soon];
  return (
    <>
      <RegisterPage intro={
        <>
          <div className="stat-grid">
            <Stat label="Active on register" value={active.length} sub={`${new Set(active.map((c) => str(c, 'patient'))).size} patients`} />
            <Stat label="Reviews overdue" value={overdue.length} tone={overdue.length ? 'red' : undefined} />
            <Stat label="Due within 30 days" value={soon.length} tone="accent" />
            <Stat label="Poorly controlled" value={active.filter((c) => str(c, 'control') === 'poor').length} />
          </div>
          <div className="section-gap" />
          <div className="grid-2">
            <Panel title="Reviews due" meta="Overdue first, then due within 30 days">
              {due.length ? (
                <ul className="list" data-testid="chronic-due">
                  {due.map((c) => {
                    const s = reviewState(c, today);
                    return (
                      <li key={c.id}>
                        <div className="grow">
                          <Link to={`${base}/chronic/${c.id}`}><b>{patientName(data, c.values.patient)} · {label(CHRONIC_CONDITIONS, str(c, 'condition'))}</b></Link>
                          <small>Last review {formatDate(str(c, 'lastReview'))} · {label(CONTROL, str(c, 'control'))}</small>
                        </div>
                        <DueTag state={s} label={s === 'overdue' ? `${daysBetween(str(c, 'nextReview'), today)} days overdue` : `Due ${formatDate(str(c, 'nextReview'))}`} />
                        {can('chronic') && <button className="btn xs primary" onClick={() => setReviewing(c)}>Record review</button>}
                      </li>
                    );
                  })}
                </ul>
              ) : <Empty title="No reviews due" />}
            </Panel>
            <Panel title="Register by condition">
              <Meters items={CHRONIC_CONDITIONS.map((c) => {
                const rows = active.filter((x) => str(x, 'condition') === c.value);
                return { label: c.label, value: rows.length, sub: `${rows.filter((x) => reviewState(x, today) === 'overdue').length} overdue · ${rows.filter((x) => str(x, 'control') === 'good').length} well controlled` };
              })} />
            </Panel>
          </div>
        </>
      } />
      {reviewing && <ReviewModal entry={reviewing} onClose={() => setReviewing(null)} />}
    </>
  );
}
