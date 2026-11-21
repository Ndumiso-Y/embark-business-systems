import { useState } from 'react';
import type { DemoRecord } from '../../../core/types';
import { permissionHint, records, str } from '../../../core/engine';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { formatDate } from '../../../core/lib/dates';
import { Field } from '../../../core/components/ui';
import { FORMATS, ROUNDS } from '../data';
import { candidateName, clashMessage, interviewClash, jobTitle, submissionOf, todayStr, workday } from '../helpers';
import { RecLink } from './shared';

const BOOKABLE = ['submitted', 'reviewing', 'interview', 'final'];

/** The candidate's other scheduled interviews — shown beside the booking form so a clash is visible before it is refused. */
export function OtherInterviews({ candidateId, excludeId }: { candidateId: string; excludeId?: string }) {
  const data = useData();
  const today = todayStr();
  const list = records(data, 'interviews')
    .filter((i) => i.id !== excludeId && i.status === 'scheduled' && str(i, 'date') >= today && str(submissionOf(data, str(i, 'submission')), 'candidate') === candidateId)
    .sort((a, b) => (str(a, 'date') + str(a, 'time')).localeCompare(str(b, 'date') + str(b, 'time')));
  if (!list.length) return <p className="muted-note" data-testid="other-interviews">No other interviews booked for {candidateName(data, candidateId)}.</p>;
  return (
    <ul className="list" data-testid="other-interviews">
      {list.map((i) => (
        <li key={i.id}>
          <span className="time-chip">{formatDate(str(i, 'date')).slice(0, 6)} {str(i, 'time')}</span>
          <div className="grow"><RecLink module="interviews" id={i.id}><b>{i.ref}</b></RecLink><small>{jobTitle(data, str(submissionOf(data, str(i, 'submission')), 'job'))} · {str(i, 'duration') || 60} min</small></div>
        </li>
      ))}
    </ul>
  );
}

/** Book a client interview. Refuses a slot that overlaps another of the candidate's interviews. */
export function BookInterview({ sub, onDone }: { sub?: DemoRecord; onDone?: (id: string) => void }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const [subId, setSubId] = useState(sub?.id ?? '');
  const current = submissionOf(data, subId);
  const [date, setDate] = useState(workday(today, 1));
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('60');
  const [format, setFormat] = useState('video');
  const [round, setRound] = useState(sub?.status === 'final' ? 'final' : sub?.status === 'interview' ? 'second' : 'first');
  const [interviewer, setInterviewer] = useState('');
  const [err, setErr] = useState('');
  if (!can('interviews')) return <p className="muted-note">{permissionHint(config, data, 'interviews')}</p>;
  const options = records(data, 'submissions').filter((s) => BOOKABLE.includes(s.status ?? '')).sort((a, b) => candidateName(data, str(a, 'candidate')).localeCompare(candidateName(data, str(b, 'candidate'))));
  const save = () => {
    if (!current) return setErr('Choose the candidate and job.');
    if (!BOOKABLE.includes(current.status ?? '')) return setErr('Interviews can only be booked once the CV has been sent and before an offer.');
    if (!date || date < today) return setErr('Choose today or a later date.');
    if (!/^\d{2}:\d{2}$/.test(time)) return setErr('Enter a start time.');
    if (!interviewer.trim()) return setErr('Enter the client’s interviewer.');
    const clash = interviewClash(data, { candidate: str(current, 'candidate'), date, time, duration: Number(duration) || 60 });
    if (clash) { const m = clashMessage(data, clash); setErr(m); act.toast(m, 'err'); return; }
    const iv = act.create('interviews', {
      submission: current.id, date, time, duration: Number(duration) || 60, format, round, interviewer: interviewer.trim(),
      location: format === 'inperson' ? 'Client offices (fictional address)' : 'Video link (fictional)', rating: '', outcome: '', feedback: '', reminderLogged: '',
    }, 'scheduled', `Interview booked for ${formatDate(date)} at ${time}`);
    let moved = '';
    if (['submitted', 'reviewing'].includes(current.status ?? '')) {
      const res = act.transition('submissions', current.id, 'interview');
      if (res.ok) moved = ' — the candidate moves to Interview';
    }
    act.toast(`Interview ${iv.ref} booked for ${formatDate(date)} at ${time}${moved}. Reminders are previews only.`);
    setErr(''); setInterviewer('');
    onDone?.(iv.id);
  };
  return (
    <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate data-testid="book-interview">
      {!sub && (
        <div className="span-2">
          <Field label="Candidate and job">
            <select className="select" aria-label="Candidate and job" value={subId} onChange={(e) => setSubId(e.target.value)}>
              <option value="">Choose a submission…</option>
              {options.map((s) => <option key={s.id} value={s.id}>{candidateName(data, str(s, 'candidate'))} · {jobTitle(data, str(s, 'job'))}</option>)}
            </select>
          </Field>
        </div>
      )}
      <Field label="Date"><input className="input" type="date" aria-label="Interview date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Start time"><input className="input" type="time" aria-label="Interview time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      <Field label="Duration (minutes)"><input className="input num" type="number" min={15} step={15} aria-label="Duration (minutes)" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
      <Field label="Format">
        <select className="select" aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value)}>{FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
      </Field>
      <Field label="Round">
        <select className="select" aria-label="Round" value={round} onChange={(e) => setRound(e.target.value)}>{ROUNDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
      </Field>
      <Field label="Client interviewer (fictional)"><input className="input" aria-label="Client interviewer" value={interviewer} onChange={(e) => setInterviewer(e.target.value)} placeholder="e.g. Karabo Seleka" /></Field>
      {err && <div className="span-2 field-error" role="alert" data-testid="book-error">{err}</div>}
      <div className="span-2 btns"><button className="btn primary" type="submit" data-testid="save-interview">Book interview</button></div>
      {current && <div className="span-2"><small className="muted-note">Other interviews for {candidateName(data, str(current, 'candidate'))}:</small><OtherInterviews candidateId={str(current, 'candidate')} /></div>}
    </form>
  );
}
