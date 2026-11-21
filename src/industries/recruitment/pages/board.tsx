// The signature screen: a pipeline board per job order. Candidates appear as
// initials avatars in stage columns with counts; longlisted CVs show why they
// cannot be sent yet, next to the control that fixes it.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { permissionHint, str } from '../../../core/engine';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { formatDate } from '../../../core/lib/dates';
import { isoDay } from '../../../core/store';
import { Field, Flags } from '../../../core/components/ui';
import { WorkflowActions } from '../../../core/components/records';
import { DISCIPLINES, label } from '../data';
import {
  SUB_STAGES, candidateOf, consentProblem, consentState, consultantForUser, consultantName, daysSince, fullName, ownershipConflict, ownershipMessage, sendCvProblems,
  submissionsFor, todayStr,
} from '../helpers';
import { Avatar, ConsentButton } from './shared';

export function JobBoard({ jobId }: { jobId: string }) {
  const config = useIndustry();
  const data = useData();
  const def = config.collections.find((c) => c.key === 'submissions')!;
  const subs = submissionsFor(data, jobId);
  const closed = subs.filter((s) => ['rejected', 'withdrawn'].includes(s.status ?? ''));
  return (
    <>
      <ol className="rc-strip" data-testid="stage-strip" aria-label="Candidates per stage">
        {SUB_STAGES.map((key) => {
          const st = def.workflow!.states.find((s) => s.key === key)!;
          const items = subs.filter((s) => s.status === key);
          return (
            <li key={key} className={items.length ? 'has' : ''} data-testid={`stage-${key}`}>
              <b>{items.length}</b>
              <span><i className={`dot ${st.tone}`} />{st.label}</span>
              {items.length > 0 && <div className="rc-stack" aria-hidden="true">{items.slice(0, 5).map((s) => <Avatar key={s.id} name={fullName(candidateOf(data, str(s, 'candidate')))} tone={st.tone} />)}</div>}
            </li>
          );
        })}
      </ol>
      <div className="board rc-board" data-testid="job-board">
        {SUB_STAGES.map((key) => {
          const st = def.workflow!.states.find((s) => s.key === key)!;
          const items = subs.filter((s) => s.status === key);
          if (!items.length) return null;
          return (
            <section key={key} className="board-col" aria-label={`${st.label} column`}>
              <header><span className={`dot ${st.tone}`} />{st.label}<b>{items.length}</b></header>
              {items.map((s) => <BoardCard key={s.id} sub={s} tone={st.tone} />)}
            </section>
          );
        })}
        {!subs.some((s) => SUB_STAGES.includes(s.status ?? '')) && <div className="board-empty">Nobody on this job yet — add candidates to the longlist below.</div>}
      </div>
      {closed.length > 0 && (
        <details className="rc-closed">
          <summary>Rejected or withdrawn ({closed.length})</summary>
          <ul className="list">
            {closed.map((s) => (
              <li key={s.id}>
                <Avatar name={fullName(candidateOf(data, str(s, 'candidate')))} tone={s.status === 'rejected' ? 'red' : 'dark'} />
                <div className="grow">
                  <Link to={`/${config.id}/pipeline/${s.id}`}><b>{fullName(candidateOf(data, str(s, 'candidate')))}</b></Link>
                  <small>{s.ref} · {s.status === 'rejected' ? 'Rejected' : 'Withdrawn'}{str(s, 'submittedOn') ? ` · sent ${formatDate(str(s, 'submittedOn'))} by ${consultantName(data, str(s, 'submittedBy'))}` : ''}</small>
                  {s.history.length > 1 && s.history[s.history.length - 1].note && <small>“{s.history[s.history.length - 1].note}”</small>}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function BoardCard({ sub, tone }: { sub: DemoRecord; tone: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { user, can } = useUser();
  const today = todayStr();
  const def = config.collections.find((c) => c.key === 'submissions')!;
  const cand = candidateOf(data, str(sub, 'candidate'));
  const name = fullName(cand);
  const last = sub.history[sub.history.length - 1]?.at ?? sub.updatedAt;
  const inStage = daysSince(isoDay(last), today);
  const longlist = sub.status === 'longlist';
  const problems = longlist ? sendCvProblems(sub, data, today) : [];
  const consentBlock = longlist && !!consentProblem(cand, today);
  const own = longlist ? ownershipConflict(data, sub, today) : null;
  const send = () => {
    const res = act.transition('submissions', sub.id, 'submitted');
    if (!res.ok) return act.toast(res.reason, 'err');
    act.toast(`${name}: CV recorded as sent to the client (simulated — nothing is emailed)`);
  };
  return (
    <article className="board-card rc-card" data-testid={`card-${sub.id}`}>
      <div className="rc-card-head">
        <Avatar name={name} tone={tone} />
        <div>
          <Link to={`${base}/pipeline/${sub.id}`}><strong>{name}</strong></Link>
          <small>{str(cand, 'headline')}</small>
        </div>
      </div>
      <small>{str(sub, 'submittedOn') ? `Sent ${formatDate(str(sub, 'submittedOn'))} by ${consultantName(data, str(sub, 'submittedBy'))}` : `Longlisted by ${consultantName(data, str(sub, 'longlistedBy'))}`} · {inStage} d at this stage</small>
      <Flags flags={(def.flags?.(sub, data, today, user) ?? []).filter((f) => !['Ownership rule', 'Consent needed'].includes(f.label))} />
      {longlist && problems.length > 0 && (
        <ul className="rc-reasons" data-testid={`reasons-${sub.id}`}>
          {problems.map((p) => <li key={p}>{own && p === ownershipMessage(data, sub, own) ? <><b>Ownership rule.</b> {p}</> : p}</li>)}
        </ul>
      )}
      {longlist ? (
        <div className="btns">
          {consentBlock && consentState(cand, today) !== 'current' && <ConsentButton candidateId={cand!.id} />}
          {can('submit')
            ? <button type="button" className={`btn xs ${problems.length ? '' : 'primary'}`} onClick={send} data-testid={`send-cv-${sub.id}`}>Send CV</button>
            : <small className="wf-who" style={{ display: 'block' }}>Sending CVs: {permissionHint(config, data, 'submit')}</small>}
        </div>
      ) : (
        <WorkflowActions def={def} record={sub} compact hide={['rejected', 'withdrawn']} />
      )}
    </article>
  );
}

/** Add a candidate to the job's longlist — and, for consultants, send the CV in the same step. */
export function LonglistForm({ job }: { job: DemoRecord }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { user, can } = useUser();
  const today = todayStr();
  const [q, setQ] = useState('');
  const [pickId, setPickId] = useState('');
  const [err, setErr] = useState('');
  const onJob = useMemo(() => new Set(submissionsFor(data, job.id).map((s) => str(s, 'candidate'))), [data, job.id]);
  const all = (data.collections.candidates ?? [])
    .filter((c) => !onJob.has(c.id) && ['new', 'screened', 'active'].includes(c.status ?? ''))
    .sort((a, b) => Number(str(b, 'discipline') === str(job, 'discipline')) - Number(str(a, 'discipline') === str(job, 'discipline')) || fullName(a).localeCompare(fullName(b)));
  const needle = q.trim().toLowerCase();
  const opts = needle ? all.filter((c) => `${fullName(c)} ${str(c, 'headline')} ${str(c, 'skills')}`.toLowerCase().includes(needle)) : all;
  if (!can('longlist')) return null;
  const add = (andSend: boolean) => {
    const c = all.find((x) => x.id === pickId);
    if (!c) return setErr('Choose a candidate first.');
    const me = consultantForUser(data, user.id);
    const s = act.create('submissions', {
      candidate: c.id, job: job.id, longlistedBy: me?.id ?? '', submittedBy: '', submittedOn: '', offerPackage: '', offerStart: '', offerMadeOn: '', acceptedOn: '', notes: '',
    }, 'longlist', `Longlisted for ${str(job, 'title')}`);
    setPickId(''); setQ(''); setErr('');
    if (!andSend) return act.toast(`${fullName(c)} added to the longlist`);
    const res = act.transition('submissions', s.id, 'submitted');
    if (!res.ok) { act.toast(`${fullName(c)} added to the longlist, but the CV was not sent: ${res.reason}`, 'err'); return; }
    act.toast(`${fullName(c)}: CV recorded as sent (simulated)`);
  };
  return (
    <form className="rc-inline-form" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); add(false); }} noValidate data-testid="longlist-form">
      <Field label="Find a candidate" hint={`${label(DISCIPLINES, str(job, 'discipline'))} candidates are listed first`}>
        <input className="input" aria-label="Find a candidate" placeholder="Name, role or skill" value={q} onChange={(e) => setQ(e.target.value)} />
      </Field>
      <Field label="Candidate" error={err || undefined}>
        <select className="select" aria-label="Candidate to add" value={pickId} onChange={(e) => setPickId(e.target.value)}>
          <option value="">{opts.length} available — choose…</option>
          {opts.map((c) => <option key={c.id} value={c.id}>{fullName(c)} · {str(c, 'headline')}{consentState(c, today) === 'current' || consentState(c, today) === 'expiring' ? '' : ' · consent needed'}</option>)}
        </select>
      </Field>
      <div className="btns">
        <button className="btn" type="submit" data-testid="add-longlist">Add to longlist</button>
        {can('submit') && <button className="btn primary" type="button" onClick={() => add(true)} data-testid="add-and-send">Add &amp; send CV</button>}
      </div>
      {!can('submit') && <p className="muted-note" style={{ flexBasis: '100%' }}>You can longlist candidates; a consultant sends the CV. {permissionHint(config, data, 'submit')}</p>}
    </form>
  );
}
