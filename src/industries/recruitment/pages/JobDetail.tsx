import { useParams } from 'react-router-dom';
import { findRecord, num, records, str } from '../../../core/engine';
import { useData, useIndustry, useUser } from '../../../core/context';
import { formatDate } from '../../../core/lib/dates';
import { KeyValues, Notice, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { JOB_TYPES, PRIORITIES, STAGE_PROBABILITY, label } from '../data';
import { clientOf, consultantName, daysOpen, estFee, feePctOf, furthestStage, rand, randOf, sentFor, submissionsFor, termsProblem, todayStr } from '../helpers';
import { JobBoard, LonglistForm } from './board';
import { Checklist, ClientTermsCard, RecLink, TermsForm } from './shared';

export default function JobDetail() {
  const { id } = useParams();
  const data = useData();
  const j = findRecord(data, 'jobs', id);
  return (
    <RecordDetail aside={j ? <Aside id={j.id} /> : undefined}>
      {j && <Main id={j.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const { can } = useUser();
  const today = todayStr();
  const j = findRecord(data, 'jobs', id)!;
  const client = clientOf(data, str(j, 'client'));
  const terms = termsProblem(client, today);
  const subDef = config.collections.find((c) => c.key === 'submissions')!;
  const stage = furthestStage(data, j.id);
  const live = submissionsFor(data, j.id).filter((s) => !['rejected', 'withdrawn'].includes(s.status ?? ''));
  const seeFees = can('fees.view');
  const free = !!str(j, 'replacementFor');
  const showTerms = ['draft', 'onhold'].includes(j.status ?? '') || (terms && j.status !== 'filled' && j.status !== 'lost');
  return (
    <>
      <Panel title="Job order" meta={`${label(JOB_TYPES, str(j, 'type'))} · ${label(PRIORITIES, str(j, 'priority')).toLowerCase()} priority · owner ${consultantName(data, str(j, 'owner'))}`}>
        <div className="mini-stat-row">
          <div>Package (CTC)<b>{randOf(num(j, 'package'))}</b></div>
          {seeFees && <div>Fee<b>{free ? 'Free replacement' : `${feePctOf(j, data)}% · ${rand(estFee(j, data))}`}</b></div>}
          <div>Days open<b>{str(j, 'openedOn') ? daysOpen(j, today) : '—'}</b></div>
          <div>CVs sent<b>{sentFor(data, j.id).length}</b></div>
          <div>In play<b>{live.length}</b></div>
          <div>Furthest stage<b>{stage ? subDef.workflow!.states.find((s) => s.key === stage)?.label : '—'}</b></div>
          {seeFees && stage && <div>Weighted<b>{rand(Math.round(estFee(j, data) * (STAGE_PROBABILITY[stage] ?? 0)))}</b></div>}
        </div>
        {str(j, 'notes') && <p className="muted-note" style={{ marginTop: 10 }}>{str(j, 'notes')}</p>}
      </Panel>
      {showTerms && client && (
        <Panel title="Client terms of business" meta="A job order can only be opened for a client with signed, current terms">
          <Checklist testid="terms-check" items={[{
            label: `${str(client, 'name')} — terms of business`, ok: !terms,
            detail: terms ?? `Signed ${formatDate(str(client, 'termsSignedOn'))}, valid until ${formatDate(str(client, 'termsExpiry'))}.`,
          }]} />
          {terms && <div style={{ marginTop: 12 }}><TermsForm clientId={client.id} /></div>}
          {!terms && j.status === 'draft' && <p className="muted-note" style={{ marginTop: 10 }}>Terms are current — press “Open job order” in the Workflow panel above.</p>}
        </Panel>
      )}
      <Panel title="Pipeline board" meta="Every candidate on this job by stage. CVs only go to the client with current POPIA consent and outside another consultant’s six-month ownership.">
        {j.status === 'draft' && <div style={{ marginBottom: 12 }}><Notice tone="grey">The job is not open yet. You can longlist candidates now; CVs can be sent once the job is opened.</Notice></div>}
        <JobBoard jobId={j.id} />
        {['draft', 'open', 'sourcing', 'shortlist', 'interviewing', 'offer'].includes(j.status ?? '') && <LonglistForm job={j} />}
      </Panel>
    </>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const j = findRecord(data, 'jobs', id)!;
  const pDef = config.collections.find((c) => c.key === 'placements')!;
  const placements = records(data, 'placements').filter((p) => str(p, 'job') === j.id);
  const original = findRecord(data, 'placements', str(j, 'replacementFor'));
  return (
    <>
      <Panel title="Client"><ClientTermsCard data={data} id={j.values.client} today={today} /></Panel>
      {(placements.length > 0 || original) && (
        <Panel title="Placements">
          {original && <KeyValues items={[{ label: 'Free replacement for', value: <RecLink module="placements" id={original.id}>{original.ref}</RecLink> }]} />}
          <ul className="list">
            {placements.map((p) => (
              <li key={p.id}>
                <div className="grow"><RecLink module="placements" id={p.id}><b>{p.ref}</b></RecLink><small>Starts {formatDate(str(p, 'startDate'))}</small></div>
                <StatusTag workflow={pDef.workflow} status={p.status} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
