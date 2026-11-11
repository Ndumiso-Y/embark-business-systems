import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, lines, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { MIN_MARGIN_PCT, QUOTE_APPROVAL_THRESHOLD } from '../data';
import { fullName, jobScheduleProblem, quoteApprovalReasons, quoteFigures, rand, staffName, todayStr } from '../helpers';
import { LinesTable } from './shared';

export default function QuoteDetail() {
  const { id } = useParams();
  const data = useData();
  const q = findRecord(data, 'quotes', id);
  return (
    <RecordDetail aside={q ? <Aside id={q.id} /> : undefined}>
      {q && ['accepted', 'scheduled'].includes(q.status ?? '') && <ScheduleJob key={q.id} id={q.id} />}
      {q && <Panel title="Quote lines" meta="Labour hours × rate, consumables and equipment, excluding VAT"><LinesTable lines={lines(q)} /></Panel>}
    </RecordDetail>
  );
}

/** Job date, team size and team leader — what "Schedule job" and "Job completed" check. */
function ScheduleJob({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const q = findRecord(data, 'quotes', id)!;
  const editable = can('quotes');
  const [draft, setDraft] = useState<Values | null>(null);
  const v: Values = { jobDate: str(q, 'jobDate'), teamSize: num(q, 'teamSize') || '', teamLeader: str(q, 'teamLeader'), ...(draft ?? {}) };
  const leaders = records(data, 'staff').filter((p) => p.status === 'active' && ['leader', 'relief'].includes(str(p, 'role'))).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const problem = q.status === 'accepted' ? jobScheduleProblem({ ...q, values: { ...q.values, ...v } }, today) : null;
  const waiting = q.status === 'scheduled' && str(q, 'jobDate') > today;
  const save = () => {
    if (!draft) return;
    act.update('quotes', id, 'teamSize' in draft ? { ...draft, teamSize: Number(draft.teamSize) || '' } : draft, 'Job date and team set');
    act.toast(`${q.ref} job details saved`);
    setDraft(null);
  };
  return (
    <Panel title="Schedule the job" meta={q.status === 'accepted' ? 'Set the date and the team, save, then press “Schedule job” above' : 'The job can be marked completed on or after its date'}
      right={q.status === 'scheduled' ? <Tag tone={waiting ? 'amber' : 'green'}>{waiting ? `Job on ${formatDate(str(q, 'jobDate'))}` : 'Job day reached'}</Tag> : undefined}>
      <div className="form-grid">
        <Field label="Job date"><input className="input" type="date" aria-label="Job date" min={today} disabled={!editable} value={String(v.jobDate ?? '')} onChange={(e) => setDraft({ ...(draft ?? {}), jobDate: e.target.value })} data-testid="job-date" /></Field>
        <Field label="Team size (cleaners)"><input className="input" type="number" min={1} max={40} aria-label="Team size" disabled={!editable} value={String(v.teamSize ?? '')} onChange={(e) => setDraft({ ...(draft ?? {}), teamSize: e.target.value })} data-testid="job-team-size" /></Field>
        <Field label="Team leader (optional)">
          <select className="select" aria-label="Team leader" disabled={!editable} value={String(v.teamLeader ?? '')} onChange={(e) => setDraft({ ...(draft ?? {}), teamLeader: e.target.value })}>
            <option value="">Not chosen yet</option>
            {leaders.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </select>
        </Field>
        {editable && <div style={{ alignSelf: 'end' }}><button className="btn primary" disabled={!draft} onClick={save} data-testid="save-job">{draft ? 'Save job details' : 'Saved'}</button></div>}
      </div>
      {problem && !draft && <p className="muted-note" style={{ marginTop: 10 }}>{problem.replace(/ \(“Schedule the job” panel on the quote\)/, '')}</p>}
      {waiting && <div style={{ marginTop: 12 }}><Notice tone="grey">“Job completed” is refused until {formatDate(str(q, 'jobDate'))}. To finish the walkthrough today, change the job date to today and save.</Notice></div>}
      {!editable && <p className="muted-note" style={{ marginTop: 10 }}>Scheduling needs “Quotes & jobs” (client liaison or operations manager).</p>}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const { can, hasModule } = useUser();
  const q = findRecord(data, 'quotes', id)!;
  const f = quoteFigures(q);
  const reasons = quoteApprovalReasons(q);
  const invoice = findRecord(data, 'invoices', str(q, 'invoice'));
  return (
    <>
      <Panel title="Value & margin" right={reasons.length ? <Tag tone="amber">Approval needed</Tag> : <Tag tone="green">Within limits</Tag>}>
        <KeyValues items={[
          { label: 'Quote value (excl. VAT)', value: <b>{rand(f.net)}</b> },
          { label: 'Total incl. VAT', value: rand(f.total) },
          { label: 'Estimated cost', value: f.cost ? rand(f.cost) : 'Not entered' },
          { label: 'Margin', value: f.cost ? `${rand(f.net - f.cost)} · ${f.marginPct}%` : '—' },
          { label: 'Approved by', value: str(q, 'approvedBy') || '—' },
          { label: 'Sent on', value: str(q, 'sentOn') ? formatDate(str(q, 'sentOn')) : '—' },
        ]} />
        {q.status === 'draft' && reasons.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Notice tone={can('quotes.approve') ? 'accent' : 'amber'}>
              Approval rule: {reasons.join(' and ')}. {can('quotes.approve') ? 'You hold “Approve quotes”, so sending it records your approval.' : 'Your simulated role cannot send it — switch to a user with “Approve quotes”.'}
            </Notice>
          </div>
        )}
        <p className="muted-note" style={{ marginTop: 10 }}>Demo rule: quotes above {rand(toCents(QUOTE_APPROVAL_THRESHOLD))} excl. VAT or below a {MIN_MARGIN_PCT}% margin need approval.</p>
      </Panel>
      <Panel title="Job">
        <KeyValues items={[
          { label: 'Job date', value: str(q, 'jobDate') ? formatDate(str(q, 'jobDate')) : 'Not scheduled' },
          { label: 'Team size', value: num(q, 'teamSize') || '—' },
          { label: 'Team leader', value: str(q, 'teamLeader') ? staffName(data, q.values.teamLeader) : '—' },
          { label: 'Invoice', value: invoice ? (hasModule('invoices') ? <Link to={`${base}/invoices/${invoice.id}`}>{invoice.ref}</Link> : invoice.ref) : '—' },
        ]} />
        {q.status === 'completed' && !invoice && (
          <div style={{ marginTop: 12 }}><Notice tone={can('invoicing') ? 'accent' : 'grey'}>{can('invoicing') ? 'The job is done — “Raise invoice” above drafts an invoice from these quote lines.' : 'The job is done. Raising the invoice needs “Invoicing” — switch to the accounts clerk in the top bar.'}</Notice></div>
        )}
      </Panel>
    </>
  );
}
