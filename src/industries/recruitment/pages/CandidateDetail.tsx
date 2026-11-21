import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { findRecord, num, records, str } from '../../../core/engine';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { NOTICE_PERIODS, SOURCES, label } from '../data';
import {
  JOB_LIVE, availableFrom, consentState, consultantForUser, consultantName, duplicatesOf, fullName, jobTitle, randOf, screenProblems, todayStr,
} from '../helpers';
import { Checklist, ConsentButton, ConsentTag, RecLink } from './shared';
import { OtherInterviews } from './interview';

export default function CandidateDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'candidates', id);
  return (
    <RecordDetail aside={c ? <Aside id={c.id} /> : undefined}>
      {c && <Main id={c.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const data = useData();
  const { can } = useUser();
  const today = todayStr();
  const c = findRecord(data, 'candidates', id)!;
  const dups = duplicatesOf(data, c);
  const state = consentState(c, today);
  return (
    <>
      {dups.length > 0 && (
        <Notice tone="amber">
          <b>Possible duplicate.</b> {dups.map((d) => <span key={d.id}><RecLink module="candidates" id={d.id}>{fullName(d)} ({d.ref})</RecLink> has the same {str(d, 'email').toLowerCase() === str(c, 'email').toLowerCase() ? 'email address' : 'mobile number'}. </span>)}
          Check before contacting the candidate or sending a CV; archive one record with the note “duplicate”.
        </Notice>
      )}
      <Panel title="POPIA consent (illustrative)" meta="Consent to process the candidate’s details and to share the CV with clients — a demo rule, not a compliance tool"
        right={<ConsentTag c={c} today={today} />}>
        <KeyValues items={[
          { label: 'Given on', value: formatDate(str(c, 'consentGiven')) },
          { label: 'Valid until', value: formatDate(str(c, 'consentExpiry')) },
          { label: 'May share CV with clients', value: str(c, 'consentGiven') ? (c.values.consentShare === true ? 'Yes' : 'No — process only') : '—' },
        ]} />
        <div className="btns" style={{ marginTop: 12, alignItems: 'center' }}>
          <ConsentButton candidateId={c.id} small={false} />
          <span className="muted-note">{state === 'current' ? 'Consent is current — CVs may be sent.' : state === 'expiring' ? 'Consent lapses soon — ask the candidate to renew it.' : 'CVs cannot be sent until consent to share is recorded.'}</span>
        </div>
      </Panel>
      {['new', 'screened'].includes(c.status ?? '') && <Screening id={c.id} />}
      <Submissions id={c.id} />
      {can('interviews') && (
        <Panel title="Upcoming interviews"><OtherInterviews candidateId={c.id} /></Panel>
      )}
    </>
  );
}

function Screening({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const c = findRecord(data, 'candidates', id)!;
  const [exp, setExp] = useState(String(num(c, 'expectedPackage') || ''));
  const [cur, setCur] = useState(String(num(c, 'currentPackage') || ''));
  const [notice, setNotice] = useState(str(c, 'notice'));
  const [notes, setNotes] = useState(str(c, 'notes'));
  const problems = screenProblems(c, today);
  const save = () => {
    act.update('candidates', c.id, { expectedPackage: Number(exp) || '', currentPackage: Number(cur) || '', notice, notes }, 'Screening call captured');
    act.toast(`${fullName(c)}: screening saved`);
  };
  return (
    <Panel title="Screening" meta="“Mark screened” needs consent, the expected package and the notice period">
      <Checklist items={[
        { label: 'POPIA consent recorded', ok: !['none', 'expired'].includes(consentState(c, today)), action: ['none', 'expired'].includes(consentState(c, today)) ? <ConsentButton candidateId={c.id} /> : undefined },
        { label: 'Expected package captured', ok: num(c, 'expectedPackage') > 0 },
        { label: 'Notice period captured', ok: !!str(c, 'notice') },
      ]} />
      {can('candidates.manage') ? (
        <form className="rc-inline-form" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); save(); }} noValidate data-testid="screening-form">
          <Field label="Current package (CTC)"><input className="input num" type="number" min={0} step={5000} aria-label="Current package" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
          <Field label="Expected package (CTC)"><input className="input num" type="number" min={0} step={5000} aria-label="Expected package" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
          <Field label="Notice period">
            <select className="select" aria-label="Notice period" value={notice} onChange={(e) => setNotice(e.target.value)}>
              <option value="">Select…</option>{NOTICE_PERIODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Screening notes" className="span-2"><input className="input" aria-label="Screening notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <button className="btn" type="submit" data-testid="save-screening">Save screening</button>
        </form>
      ) : <p className="muted-note">{config.permissions.find((p) => p.key === 'candidates.manage')?.description}: not held by your simulated role.</p>}
      {!problems.length && c.status === 'new' && <p className="muted-note" style={{ marginTop: 10 }}>Ready — press “Mark screened” above.</p>}
    </Panel>
  );
}

function Submissions({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { user, can } = useUser();
  const c = findRecord(data, 'candidates', id)!;
  const def = config.collections.find((x) => x.key === 'submissions')!;
  const mine = records(data, 'submissions').filter((s) => str(s, 'candidate') === c.id).sort((a, b) => b.ref.localeCompare(a.ref));
  const jobs = records(data, 'jobs').filter((j) => JOB_LIVE.includes(j.status ?? '') && !mine.some((s) => str(s, 'job') === j.id));
  const [jobId, setJobId] = useState('');
  const add = () => {
    if (!jobId) return act.toast('Choose a job order first.', 'err');
    const s = act.create('submissions', {
      candidate: c.id, job: jobId, longlistedBy: consultantForUser(data, user.id)?.id ?? '', submittedBy: '', submittedOn: '', offerPackage: '', offerStart: '', offerMadeOn: '', acceptedOn: '', notes: '',
    }, 'longlist', 'Longlisted from the candidate record');
    act.toast(`${fullName(c)} longlisted (${s.ref}) — send the CV from the job’s pipeline board`);
    setJobId('');
  };
  return (
    <Panel title="Submissions" meta="Every job this candidate has been longlisted or submitted for">
      {mine.length ? (
        <ul className="list" data-testid="candidate-submissions">
          {mine.map((s) => (
            <li key={s.id}>
              <div className="grow">
                <RecLink module="pipeline" id={s.id}><b>{jobTitle(data, str(s, 'job'))}</b></RecLink>
                <small>{s.ref}{str(s, 'submittedOn') ? ` · sent ${formatDate(str(s, 'submittedOn'))} by ${consultantName(data, str(s, 'submittedBy'))}` : ' · not sent'}</small>
              </div>
              <StatusTag workflow={def.workflow} status={s.status} />
            </li>
          ))}
        </ul>
      ) : <p className="muted-note">Not submitted for any job yet.</p>}
      {can('longlist') && ['new', 'screened', 'active'].includes(c.status ?? '') && (
        <div className="rc-inline-form" style={{ marginTop: 12 }}>
          <Field label="Add to a live job order">
            <select className="select" aria-label="Add to job order" value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">Choose a job…</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{jobTitle(data, j.id)}</option>)}
            </select>
          </Field>
          <button className="btn" type="button" onClick={add} data-testid="candidate-longlist">Add to longlist</button>
        </div>
      )}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const c = findRecord(data, 'candidates', id)!;
  return (
    <Panel title="Profile">
      <KeyValues items={[
        { label: 'Current role', value: str(c, 'headline') },
        { label: 'Current package', value: num(c, 'currentPackage') ? randOf(num(c, 'currentPackage')) : '—' },
        { label: 'Expected package', value: num(c, 'expectedPackage') ? randOf(num(c, 'expectedPackage')) : '—' },
        { label: 'Notice', value: label(NOTICE_PERIODS, str(c, 'notice')) },
        { label: 'Available from', value: str(c, 'notice') ? formatDate(availableFrom(c, today)) : '—' },
        { label: 'Source', value: label(SOURCES, str(c, 'source')) },
        { label: 'Owner', value: consultantName(data, str(c, 'owner')) },
        { label: 'Key skills', value: str(c, 'skills'), wide: true },
      ]} />
    </Panel>
  );
}
