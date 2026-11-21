import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { findRecord, num, permissionHint, str } from '../../../core/engine';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { OWNERSHIP_MONTHS, ROUNDS, label } from '../data';
import {
  JOB_LIVE, addMonths, availableFrom, candidateOf, consentProblem, consultantName, feePctOf, fullName, interviewsFor, jobOf, offerProblems, ownershipConflict,
  ownershipMessage, placementFeeCents, rand, randOf, todayStr,
} from '../helpers';
import { BookInterview } from './interview';
import { CandidateCard, Checklist, ClientTermsCard, ConsentButton, RecLink } from './shared';

export default function SubmissionDetail() {
  const { id } = useParams();
  const data = useData();
  const s = findRecord(data, 'submissions', id);
  return (
    <RecordDetail backLabel="Pipeline" aside={s ? <Aside id={s.id} /> : undefined}>
      {s && <Main id={s.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const { can } = useUser();
  const today = todayStr();
  const s = findRecord(data, 'submissions', id)!;
  const cand = candidateOf(data, str(s, 'candidate'));
  const job = jobOf(data, str(s, 'job'));
  const ivDef = config.collections.find((c) => c.key === 'interviews')!;
  const ivs = interviewsFor(data, s.id).sort((a, b) => (str(a, 'date') + str(a, 'time')).localeCompare(str(b, 'date') + str(b, 'time')));
  const own = ownershipConflict(data, s, today);
  const consent = consentProblem(cand, today);
  const bookable = ['submitted', 'reviewing', 'interview', 'final'].includes(s.status ?? '');
  return (
    <>
      {s.status === 'longlist' && (
        <Panel title="Before the CV goes to the client" meta="“Send CV (simulated)” in the Workflow panel checks each of these">
          <Checklist testid="send-checks" items={[
            { label: 'Job order open for submissions', ok: JOB_LIVE.includes(job?.status ?? ''), detail: job ? `${job.ref} · ${config.collections.find((c) => c.key === 'jobs')!.workflow!.states.find((x) => x.key === job.status)?.label}` : 'No job linked' },
            { label: 'POPIA consent to share the CV (illustrative)', ok: !consent, detail: consent ?? `Valid until ${formatDate(str(cand, 'consentExpiry'))}`, action: consent && cand ? <ConsentButton candidateId={cand.id} /> : undefined },
            { label: `Ownership rule (${OWNERSHIP_MONTHS} months per client)`, ok: !own, detail: own ? ownershipMessage(data, s, own) : 'Nobody has sent this candidate to this client in the last six months.' },
          ]} />
          {!can('submit') && <p className="muted-note" style={{ marginTop: 10 }}>Resourcers longlist candidates; a consultant sends the CV. {permissionHint(config, data, 'submit')}</p>}
        </Panel>
      )}
      {str(s, 'submittedOn') && (
        <Notice tone="grey">
          <b>Ownership:</b> CV sent to {str(findRecord(data, 'clients', str(job, 'client')), 'name')} by {consultantName(data, str(s, 'submittedBy'))} on {formatDate(str(s, 'submittedOn'))}. Nobody else may submit {fullName(cand)} to this client until {formatDate(addMonths(str(s, 'submittedOn'), OWNERSHIP_MONTHS))}.
        </Notice>
      )}
      {(ivs.length > 0 || bookable) && (
        <Panel title="Interviews" meta="Booked with a clash check per candidate · reminders are previews, never sent">
          {ivs.length > 0 && (
            <ul className="list" data-testid="sub-interviews">
              {ivs.map((i) => (
                <li key={i.id}>
                  <span className="time-chip">{formatDate(str(i, 'date')).slice(0, 6)} {str(i, 'time')}</span>
                  <div className="grow">
                    <RecLink module="interviews" id={i.id}><b>{label(ROUNDS, str(i, 'round'))}</b></RecLink>
                    <small>{i.ref} · {str(i, 'interviewer')}{str(i, 'rating') ? ` · rated ${str(i, 'rating')}/5` : ''}</small>
                    {str(i, 'feedback') && <small>“{str(i, 'feedback')}”</small>}
                  </div>
                  <StatusTag workflow={ivDef.workflow} status={i.status} />
                </li>
              ))}
            </ul>
          )}
          {bookable && (
            <div style={{ marginTop: ivs.length ? 14 : 0 }}>
              <h3 className="panel-title" style={{ fontSize: 14, marginBottom: 10 }}>Book interview</h3>
              <BookInterview sub={s} />
            </div>
          )}
        </Panel>
      )}
      {['reviewing', 'interview', 'final', 'offer'].includes(s.status ?? '') && <OfferPanel id={s.id} />}
    </>
  );
}

function OfferPanel({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const s = findRecord(data, 'submissions', id)!;
  const cand = candidateOf(data, str(s, 'candidate'));
  const job = jobOf(data, str(s, 'job'));
  const [pkg, setPkg] = useState(String(num(s, 'offerPackage') || num(cand, 'expectedPackage') || num(job, 'package') || ''));
  const [start, setStart] = useState(str(s, 'offerStart') || availableFrom(cand, today));
  const [err, setErr] = useState('');
  const problems = offerProblems(s);
  const editable = can('submit') && s.status !== 'offer';
  const save = () => {
    const n = Number(pkg);
    if (!(n > 0)) return setErr('Enter the offered annual package.');
    if (!start) return setErr('Enter the agreed start date.');
    if (start < today) return setErr('The start date cannot be in the past.');
    act.update('submissions', s.id, { offerPackage: Math.round(n), offerStart: start }, `Offer details: ${randOf(n)} CTC, start ${formatDate(start)}`);
    act.toast(`${s.ref}: offer details saved — now press “Make offer”`);
    setErr('');
  };
  const fee = placementFeeCents(num(s, 'offerPackage') || Number(pkg) || 0, feePctOf(job, data));
  return (
    <Panel title="Offer details" meta={s.status === 'offer' ? 'Offer out — record the candidate’s answer with “Offer accepted” or “Rejected” above' : '“Make offer” needs the package and start date'}
      right={problems.length && s.status !== 'offer' ? <Tag tone="amber">Not ready</Tag> : <Tag tone="green">Ready</Tag>}>
      {editable ? (
        <form className="rc-inline-form" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate data-testid="offer-form">
          <Field label="Annual package (CTC)" hint={`Candidate expects ${randOf(num(cand, 'expectedPackage'))}`}>
            <input className="input num" type="number" min={0} step={5000} aria-label="Offered package" value={pkg} onChange={(e) => setPkg(e.target.value)} />
          </Field>
          <Field label="Start date" hint={`Notice ends about ${formatDate(availableFrom(cand, today))}`}>
            <input className="input" type="date" aria-label="Start date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <button className="btn" type="submit" data-testid="save-offer">Save offer details</button>
          {err && <div className="field-error" role="alert" style={{ flexBasis: '100%' }}>{err}</div>}
        </form>
      ) : (
        <KeyValues items={[
          { label: 'Offered package', value: num(s, 'offerPackage') ? randOf(num(s, 'offerPackage')) : '—' },
          { label: 'Start date', value: formatDate(str(s, 'offerStart')) },
          { label: 'Offer made on', value: formatDate(str(s, 'offerMadeOn')) },
        ]} />
      )}
      {!can('submit') && <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'submit')}</p>}
      {can('fees.view') && (num(s, 'offerPackage') > 0 || Number(pkg) > 0) && (
        <p className="muted-note" style={{ marginTop: 10 }}>Fee on acceptance: {feePctOf(job, data)}% of {randOf(num(s, 'offerPackage') || Number(pkg))} = <b>{rand(fee)}</b> excl. VAT, invoiced when the candidate starts.</p>
      )}
      {num(s, 'offerPackage') > 0 && num(s, 'offerPackage') < num(cand, 'expectedPackage') && <p className="muted-note" style={{ marginTop: 6 }}>The offer is below the {randOf(num(cand, 'expectedPackage'))} the candidate asked for — expect a counter.</p>}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const s = findRecord(data, 'submissions', id)!;
  const job = jobOf(data, str(s, 'job'));
  const jobDef = config.collections.find((c) => c.key === 'jobs')!;
  return (
    <>
      <Panel title="Candidate"><CandidateCard data={data} id={s.values.candidate} today={today} /></Panel>
      <Panel title="Job order" right={<StatusTag workflow={jobDef.workflow} status={job?.status} />}>
        <KeyValues items={[
          { label: 'Role', value: job ? <RecLink module="jobs" id={job.id}>{str(job, 'title')} · {job.ref}</RecLink> : '—' },
          { label: 'Package', value: randOf(num(job, 'package')) },
          { label: 'Owner', value: consultantName(data, str(job, 'owner')) },
        ]} />
      </Panel>
      <Panel title="Client"><ClientTermsCard data={data} id={job?.values.client} today={today} /></Panel>
    </>
  );
}
