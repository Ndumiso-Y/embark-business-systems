import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { findRecord, num, permissionHint, str } from '../../../core/engine';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { Field, KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { REMEDIES, VAT_RATE, label } from '../data';
import { fallOffProblems, jobOf, rand, randOf, refundFor, todayStr } from '../helpers';
import { CandidateCard, ClientTermsCard, RecLink } from './shared';

export default function PlacementDetail() {
  const { id } = useParams();
  const data = useData();
  const p = findRecord(data, 'placements', id);
  return (
    <RecordDetail aside={p ? <Aside id={p.id} /> : undefined}>
      {p && <Main id={p.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const { can } = useUser();
  const today = todayStr();
  const p = findRecord(data, 'placements', id)!;
  const fee = toCents(num(p, 'fee'));
  const vat = Math.round((fee * VAT_RATE) / 100);
  const left = daysBetween(today, str(p, 'guaranteeEnd'));
  const invDef = config.collections.find((c) => c.key === 'invoices')!;
  const inv = findRecord(data, 'invoices', str(p, 'invoice'));
  const cn = findRecord(data, 'invoices', str(p, 'creditNote'));
  const repl = findRecord(data, 'jobs', str(p, 'replacementJob'));
  return (
    <>
      <Panel title="Fee & guarantee" meta={`${label(REMEDIES, str(p, 'remedy'))} if the candidate leaves inside the guarantee (client’s terms)`}>
        <div className="mini-stat-row">
          <div>Package (CTC)<b>{randOf(num(p, 'package'))}</b></div>
          {can('fees.view') && <div>Fee {num(p, 'feePct')}%<b>{rand(fee)}</b></div>}
          {can('fees.view') && <div>Incl. VAT<b>{rand(fee + vat)}</b></div>}
          <div>Starts<b>{formatDate(str(p, 'startDate'))}</b></div>
          <div>Guarantee ends<b>{formatDate(str(p, 'guaranteeEnd'))}</b></div>
          {p.status === 'started' && <div>Days left<b>{Math.max(0, left)}</b></div>}
        </div>
        {p.status === 'accepted' && <p className="muted-note" style={{ marginTop: 10 }}>“Candidate started” raises the fee invoice as a draft for Finance. If the candidate does not start, use “Fell off before start” — the job re-opens and no fee is due.</p>}
        {!can('fees.view') && <p className="muted-note" style={{ marginTop: 10 }}>Fee figures are hidden for your simulated role.</p>}
      </Panel>
      {p.status === 'started' && <FallOff id={p.id} />}
      {(inv || cn || repl) && (
        <Panel title="Raised from this placement">
          <ul className="list" data-testid="placement-links">
            {inv && <li><div className="grow"><RecLink module="invoices" id={inv.id}><b>Fee invoice {inv.ref}</b></RecLink><small>{formatDate(str(inv, 'date'))}</small></div><StatusTag workflow={invDef.workflow} status={inv.status} /></li>}
            {cn && <li><div className="grow"><RecLink module="invoices" id={cn.id}><b>Credit note {cn.ref}</b></RecLink><small>{formatDate(str(cn, 'date'))}</small></div><StatusTag workflow={invDef.workflow} status={cn.status} /></li>}
            {repl && <li><div className="grow"><RecLink module="jobs" id={repl.id}><b>Free replacement job {repl.ref}</b></RecLink><small>Opened {formatDate(str(repl, 'openedOn'))} · no fee</small></div><StatusTag workflow={config.collections.find((c) => c.key === 'jobs')!.workflow} status={repl.status} /></li>}
          </ul>
        </Panel>
      )}
    </>
  );
}

/** Record when the candidate left, see what the client's terms give, then press “Fell off in guarantee”. */
function FallOff({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const p = findRecord(data, 'placements', id)!;
  const [date, setDate] = useState(str(p, 'fellOffOn') || today);
  const recorded = str(p, 'fellOffOn');
  const problems = fallOffProblems(p, today);
  const r = refundFor(p, recorded || date);
  const refund = str(p, 'remedy') === 'refund';
  return (
    <Panel title="If the candidate leaves" meta="Record the leaving date first — then “Fell off in guarantee” applies the client’s terms"
      right={recorded ? <Tag tone="red">Left {formatDate(recorded)}</Tag> : undefined}>
      {can('placements.manage') ? (
        <form className="rc-inline-form" onSubmit={(e) => { e.preventDefault(); act.update('placements', p.id, { fellOffOn: date }, `Leaving date recorded: ${formatDate(date)}`); act.toast(`${p.ref}: leaving date recorded — now press “Fell off in guarantee”`); }} noValidate>
          <Field label="Left on"><input className="input" type="date" aria-label="Left on" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <button className="btn" type="submit" data-testid="record-leaving">Record leaving date</button>
        </form>
      ) : <p className="muted-note">{permissionHint(config, data, 'placements.manage')}</p>}
      <div style={{ marginTop: 12 }}>
        <Notice tone={refund ? 'amber' : 'accent'}>
          {refund
            ? <>Pro-rata refund: leaving on {formatDate(recorded || date)} is day {r.used} of a {r.total}-day guarantee, so {r.remaining} days ({r.pct}%) are unused{can('fees.view') ? <> — a credit note for <b>{rand(r.refund)}</b> excl. VAT will be raised</> : ''}.</>
            : <>Free replacement: a new job order for the same role opens at no fee, owned by the same consultant.</>}
        </Notice>
      </div>
      {recorded && problems.length > 0 && <p className="field-error" role="alert" style={{ marginTop: 8 }}>{problems[0]}</p>}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const p = findRecord(data, 'placements', id)!;
  const job = jobOf(data, str(p, 'job'));
  return (
    <>
      <Panel title="Candidate"><CandidateCard data={data} id={p.values.candidate} today={today} /></Panel>
      <Panel title="Job">
        <KeyValues items={[
          { label: 'Role', value: job ? <RecLink module="jobs" id={job.id}>{str(job, 'title')} · {job.ref}</RecLink> : '—' },
          { label: 'Submission', value: <RecLink module="pipeline" id={str(p, 'submission')}>{findRecord(data, 'submissions', str(p, 'submission'))?.ref ?? '—'}</RecLink> },
          { label: 'Offer accepted', value: formatDate(str(p, 'acceptedOn')) },
        ]} />
      </Panel>
      <Panel title="Client terms"><ClientTermsCard data={data} id={p.values.client} today={today} /></Panel>
    </>
  );
}
