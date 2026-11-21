import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { findRecord, num, permissionHint, str } from '../../../core/engine';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { FORMATS, OUTCOMES, RATINGS, ROUNDS, label } from '../data';
import { candidateOf, clashMessage, clientOf, completeInterviewProblems, fullName, interviewClash, jobOf, submissionOf, todayStr } from '../helpers';
import { CandidateCard, RecLink } from './shared';
import { OtherInterviews } from './interview';

export default function InterviewDetail() {
  const { id } = useParams();
  const data = useData();
  const iv = findRecord(data, 'interviews', id);
  return (
    <RecordDetail aside={iv ? <Aside id={iv.id} /> : undefined}>
      {iv && <Main id={iv.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const iv = findRecord(useData(), 'interviews', id)!;
  return (
    <>
      {iv.status === 'scheduled' && <Feedback id={id} />}
      {iv.status === 'scheduled' && <Reschedule id={id} />}
      {iv.status === 'scheduled' && <Reminder id={id} />}
      {iv.status !== 'scheduled' && str(iv, 'feedback') && (
        <Panel title="Client feedback" right={str(iv, 'rating') ? <Tag tone="accent">{label(RATINGS, str(iv, 'rating'))}</Tag> : undefined}>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{str(iv, 'feedback')}</p>
          <p className="muted-note" style={{ marginTop: 8 }}>Outcome: {label(OUTCOMES, str(iv, 'outcome'))}</p>
        </Panel>
      )}
    </>
  );
}

function Feedback({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const iv = findRecord(data, 'interviews', id)!;
  const [rating, setRating] = useState(str(iv, 'rating'));
  const [outcome, setOutcome] = useState(str(iv, 'outcome'));
  const [feedback, setFeedback] = useState(str(iv, 'feedback'));
  const problems = completeInterviewProblems(iv, today);
  if (!can('interviews')) return <Panel title="Interview feedback"><p className="muted-note">{permissionHint(config, data, 'interviews')}</p></Panel>;
  const save = () => {
    act.update('interviews', iv.id, { rating, outcome, feedback }, 'Interview feedback captured');
    act.toast(`${iv.ref}: feedback saved${str(iv, 'date') > today ? '' : ' — now press “Complete with feedback”'}`);
  };
  return (
    <Panel title="Interview feedback" meta="“Complete with feedback” needs the client’s rating, outcome and comments"
      right={<Tag tone={problems.length ? 'amber' : 'green'}>{problems.length ? 'Not ready' : 'Ready'}</Tag>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate data-testid="feedback-form">
        <Field label="Client rating">
          <select className="select" aria-label="Client rating" value={rating} onChange={(e) => setRating(e.target.value)}><option value="">Select…</option>{RATINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        </Field>
        <Field label="Outcome">
          <select className="select" aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="">Select…</option>{OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        </Field>
        <div className="span-2"><Field label="Client feedback"><textarea className="textarea" aria-label="Client feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What the interviewer said, strengths, concerns, next step" /></Field></div>
        <div className="span-2 btns"><button className="btn" type="submit" data-testid="save-feedback">Save feedback</button>
          {str(iv, 'date') > today && <span className="muted-note">The interview is on {formatDate(str(iv, 'date'))} — it can be completed on or after that day.</span>}</div>
      </form>
    </Panel>
  );
}

function Reschedule({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const iv = findRecord(data, 'interviews', id)!;
  const sub = submissionOf(data, str(iv, 'submission'));
  const [date, setDate] = useState(str(iv, 'date'));
  const [time, setTime] = useState(str(iv, 'time'));
  const [err, setErr] = useState('');
  if (!can('interviews')) return null;
  const save = () => {
    if (!date || date < today) return setErr('Choose today or a later date.');
    const clash = interviewClash(data, { candidate: str(sub, 'candidate'), date, time, duration: num(iv, 'duration'), excludeId: iv.id });
    if (clash) { const m = clashMessage(data, clash); setErr(m); act.toast(m, 'err'); return; }
    act.update('interviews', iv.id, { date, time }, `Moved to ${formatDate(date)} at ${time}`);
    act.toast(`${iv.ref} moved to ${formatDate(date)} at ${time}`);
    setErr('');
  };
  return (
    <Panel title="Reschedule" meta="The same clash check applies">
      <form className="rc-inline-form" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <Field label="Date"><input className="input" type="date" aria-label="New date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><input className="input" type="time" aria-label="New time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <button className="btn" type="submit" data-testid="reschedule">Move interview</button>
        {err && <div className="field-error" role="alert" style={{ flexBasis: '100%' }}>{err}</div>}
      </form>
    </Panel>
  );
}

/** Reminder previews: the messages a real system would send — logged as “not sent”. */
function Reminder({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const iv = findRecord(data, 'interviews', id)!;
  const sub = submissionOf(data, str(iv, 'submission'));
  const cand = candidateOf(data, str(sub, 'candidate'));
  const job = jobOf(data, str(sub, 'job'));
  const client = clientOf(data, str(job, 'client'));
  const when = `${formatDate(str(iv, 'date'))} at ${str(iv, 'time')}`;
  const toCandidate = `Hi ${str(cand, 'firstName')}, a reminder of your ${label(ROUNDS, str(iv, 'round')).toLowerCase()} for ${str(job, 'title')} at ${str(client, 'name')} on ${when} (${label(FORMATS, str(iv, 'format')).toLowerCase()}, about ${num(iv, 'duration') || 60} minutes) with ${str(iv, 'interviewer')}. ${str(iv, 'location')}. Good luck — ${config.businessName}.`;
  const toClient = `Dear ${str(iv, 'interviewer')}, confirming your interview with ${fullName(cand)} for ${str(job, 'title')} on ${when}. Their CV and our notes were sent earlier. Kind regards, ${config.businessName}.`;
  return (
    <Panel title="Reminders — preview only" meta="Nothing is sent: a real system would email or SMS these. Logging records that a reminder was due." right={str(iv, 'reminderLogged') ? <Tag tone="dark">Logged {formatDate(str(iv, 'reminderLogged'))} · not sent</Tag> : undefined}>
      <small className="muted-note">To the candidate ({str(cand, 'phone')})</small>
      <p className="rc-msg" data-testid="reminder-candidate">{toCandidate}</p>
      <small className="muted-note" style={{ display: 'block', marginTop: 10 }}>To the client interviewer</small>
      <p className="rc-msg">{toClient}</p>
      {can('interviews') && (
        <div className="btns" style={{ marginTop: 10 }}>
          <button className="btn sm" data-testid="log-reminder" onClick={() => { act.update('interviews', iv.id, { reminderLogged: todayStr() }, 'Reminder logged — not sent (preview only)'); act.toast('Reminder logged as not sent — this demo sends no messages', 'info'); }}>Log reminder (not sent)</button>
        </div>
      )}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const iv = findRecord(data, 'interviews', id)!;
  const sub = submissionOf(data, str(iv, 'submission'));
  const job = jobOf(data, str(sub, 'job'));
  const subDef = config.collections.find((c) => c.key === 'submissions')!;
  return (
    <>
      <Panel title="Candidate"><CandidateCard data={data} id={sub?.values.candidate} today={today} /></Panel>
      <Panel title="Submission" right={<StatusTag workflow={subDef.workflow} status={sub?.status} />}>
        <KeyValues items={[
          { label: 'Job', value: job ? <RecLink module="jobs" id={job.id}>{str(job, 'title')}</RecLink> : '—' },
          { label: 'Client', value: str(clientOf(data, str(job, 'client')), 'name') },
          { label: 'Submission', value: sub ? <RecLink module="pipeline" id={sub.id}>{sub.ref}</RecLink> : '—' },
        ]} />
      </Panel>
      <Panel title="Candidate’s other interviews"><OtherInterviews candidateId={str(sub, 'candidate')} excludeId={iv.id} /></Panel>
    </>
  );
}
