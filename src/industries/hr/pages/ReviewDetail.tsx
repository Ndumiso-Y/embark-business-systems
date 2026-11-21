import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RATINGS, label } from '../data';
import { emp, finalRating, jobLabel, managerReviewerProblem, siteShort, todayStr } from '../helpers';
import { EmpLink, WhoCan } from './shared';
import { useFeedback } from './feedback';

type Pair = { rating: string; text: string };

/** A performance review: each stage has its own small form next to the step that needs it. */
export default function ReviewDetail() {
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { user, can } = useUser();
  const fb = useFeedback();
  const r = findRecord(data, 'reviews', id);
  const [self, setSelf] = useState<Pair | null>(null);
  const [mgr, setMgr] = useState<Pair | null>(null);
  const [mod, setMod] = useState<Pair | null>(null);
  const [pip, setPip] = useState<{ actions: string; review: string } | null>(null);
  if (!r) return <RecordDetail />;

  const today = todayStr();
  const e = emp(data, str(r, 'employee'));
  const manager = emp(data, str(e, 'manager'));
  const reviewerProblem = managerReviewerProblem(data, user, r);
  const sf = self ?? { rating: str(r, 'selfRating'), text: str(r, 'selfComments') };
  const mf = mgr ?? { rating: str(r, 'managerRating'), text: str(r, 'managerComments') };
  const of = mod ?? { rating: str(r, 'moderatedRating'), text: str(r, 'moderationNote') };
  const pf = pip ?? { actions: str(r, 'pipActions'), review: str(r, 'pipReview') || addDays(today, 30) };
  const fr = finalRating(r);
  const showPip = (fr > 0 && fr <= 2) || (Number(mf.rating) > 0 && Number(mf.rating) <= 2) || !!str(r, 'pipActions');
  const signed = r.status === 'signed';

  const save = (values: Record<string, string>, action: string, after: string, reset: () => void) => {
    act.update('reviews', r.id, values, action);
    reset();
    fb.ok(after);
  };
  const ratingSelect = (aria: string, value: string, onChange: (v: string) => void, disabled: boolean) => (
    <select className="select" aria-label={aria} value={value} disabled={disabled} onChange={(ev) => onChange(ev.target.value)}>
      <option value="">Choose…</option>{RATINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <RecordDetail backLabel="Performance reviews"
      aside={
        <Panel title="Employee">
          <KeyValues items={[
            { label: 'Employee', value: <EmpLink e={e} /> },
            { label: 'Job', value: `${jobLabel(e)} · ${siteShort(str(e, 'site'))}` },
            { label: 'Manager', value: <EmpLink e={manager} /> },
            { label: 'Due', value: formatDate(str(r, 'dueDate')) },
            { label: 'Final rating', value: fr ? label(RATINGS, String(fr)) : 'Not yet' },
          ]} />
          <p className="muted-note" style={{ marginTop: 10 }}>Rules in this demo: a rating of 1 or 5 is moderated by the managing director before sign-off; a rating of 2 or below needs an improvement plan with a review date.</p>
        </Panel>
      }>
      <Panel title="Self-assessment" right={str(r, 'selfRating') ? <Tag tone="dark">{label(RATINGS, str(r, 'selfRating'))}</Tag> : <Tag tone="amber">Not submitted</Tag>}>
        <div className="form-grid">
          <Field label="Employee’s own rating">{ratingSelect('Self rating', sf.rating, (v) => setSelf({ ...sf, rating: v }), r.status !== 'self' || !can('reviews'))}</Field>
          <div />
          <Field label="Employee’s comments" className="span-2"><textarea className="textarea" aria-label="Self-assessment comments" disabled={r.status !== 'self' || !can('reviews')} value={sf.text} onChange={(ev) => setSelf({ ...sf, text: ev.target.value })} /></Field>
        </div>
        {r.status === 'self' && can('reviews') && <button className="btn sm" style={{ marginTop: 10 }} disabled={!self} onClick={() => save({ selfRating: sf.rating, selfComments: sf.text.trim() }, 'Self-assessment captured', 'Saved. Press “Submit self-assessment” above.', () => setSelf(null))} data-testid="save-self">Save self-assessment</button>}
        {r.status === 'self' && <p className="muted-note" style={{ marginTop: 8 }}>Captured from the employee’s form by their manager or HR (no self-service form in this demo).</p>}
      </Panel>
      {r.status !== 'self' && (
        <Panel title="Manager review" right={str(r, 'managerRating') ? <Tag tone={['1', '2'].includes(str(r, 'managerRating')) ? 'red' : str(r, 'managerRating') === '5' ? 'green' : 'dark'}>{label(RATINGS, str(r, 'managerRating'))}</Tag> : <Tag tone="amber">Not rated</Tag>}>
          <div className="form-grid" data-testid="manager-form">
            <Field label="Manager’s rating">{ratingSelect('Manager rating', mf.rating, (v) => setMgr({ ...mf, rating: v }), r.status !== 'manager' || !can('reviews') || !!reviewerProblem)}</Field>
            <div />
            <Field label="Manager’s comments" className="span-2"><textarea className="textarea" aria-label="Manager comments" disabled={r.status !== 'manager' || !can('reviews') || !!reviewerProblem} value={mf.text} onChange={(ev) => setMgr({ ...mf, text: ev.target.value })} /></Field>
          </div>
          {r.status === 'manager' && can('reviews') && !reviewerProblem && <button className="btn sm" style={{ marginTop: 10 }} disabled={!mgr} onClick={() => save({ managerRating: mf.rating, managerComments: mf.text.trim() }, `Manager rating recorded: ${label(RATINGS, mf.rating)}`,
            ['1', '5'].includes(mf.rating) ? 'Saved. A rating of 1 or 5 goes to moderation — press “Send to moderation”.' : Number(mf.rating) <= 2 ? 'Saved. Add the improvement plan below, then “Sign off”.' : 'Saved. Press “Sign off” above.', () => setMgr(null))} data-testid="save-manager">Save manager review</button>}
          {r.status === 'manager' && reviewerProblem && <p className="muted-note" style={{ marginTop: 8 }}>{reviewerProblem}</p>}
          <WhoCan permission="reviews" what="Manager reviews are completed by the employee’s manager or HR." />
        </Panel>
      )}
      {(r.status === 'moderation' || str(r, 'moderatedRating')) && (
        <Panel title="Moderation" meta="Ratings of 1 and 5 are checked against the rest of the company before sign-off" right={str(r, 'moderatedRating') ? <Tag tone="dark">{label(RATINGS, str(r, 'moderatedRating'))}</Tag> : <Tag tone="amber">Awaiting moderation</Tag>}>
          <div className="form-grid" data-testid="moderation-form">
            <Field label="Moderated rating">{ratingSelect('Moderated rating', of.rating, (v) => setMod({ ...of, rating: v }), r.status !== 'moderation' || !can('reviews.moderate'))}</Field>
            <div />
            <Field label="Moderation note" className="span-2"><textarea className="textarea" aria-label="Moderation note" disabled={r.status !== 'moderation' || !can('reviews.moderate')} value={of.text} onChange={(ev) => setMod({ ...of, text: ev.target.value })} /></Field>
          </div>
          {r.status === 'moderation' && can('reviews.moderate') && <button className="btn sm" style={{ marginTop: 10 }} disabled={!mod} onClick={() => save({ moderatedRating: of.rating, moderationNote: of.text.trim() }, `Moderated rating recorded: ${label(RATINGS, of.rating)}`, Number(of.rating) <= 2 ? 'Saved. Add the improvement plan below, then sign off.' : 'Saved. Press “Sign off after moderation”.', () => setMod(null))} data-testid="save-moderation">Save moderation</button>}
          <WhoCan permission="reviews.moderate" what="Moderation is done by the managing director." />
        </Panel>
      )}
      {showPip && (
        <Panel title="Improvement plan" meta="Required for a final rating of 2 or below" right={str(r, 'pipActions') ? <Tag tone="green">In place</Tag> : <Tag tone="red">Required</Tag>}>
          {fr > 0 && fr <= 2 && !str(r, 'pipActions') && <div style={{ marginBottom: 10 }}><Notice tone="amber">A rating of {fr} cannot be signed off without an improvement plan and a review date.</Notice></div>}
          <div className="form-grid" data-testid="pip-form">
            <Field label="Actions and support" className="span-2"><textarea className="textarea" aria-label="Improvement plan actions" disabled={signed || !can('reviews')} value={pf.actions} onChange={(ev) => setPip({ ...pf, actions: ev.target.value })} placeholder="e.g. Daily accuracy check with the supervisor for four weeks; refresher on the scanner." /></Field>
            <Field label="Review date"><input className="input" type="date" aria-label="Improvement plan review date" disabled={signed || !can('reviews')} value={pf.review} onChange={(ev) => setPip({ ...pf, review: ev.target.value })} /></Field>
          </div>
          {!signed && can('reviews') && <button className="btn sm" style={{ marginTop: 10 }} disabled={!pip && !!str(r, 'pipActions')} onClick={() => {
            if (!pf.actions.trim()) { fb.fail('Write the actions in the improvement plan.'); return; }
            if (!pf.review || pf.review <= today) { fb.fail('The review date must be in the future.'); return; }
            save({ pipActions: pf.actions.trim(), pipReview: pf.review }, `Improvement plan recorded — review ${formatDate(pf.review)}`, 'Improvement plan saved. You can now sign off.', () => setPip(null));
          }} data-testid="save-pip">Save improvement plan</button>}
        </Panel>
      )}
      {fb.view}
    </RecordDetail>
  );
}
