import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { findRecord, num, records, str } from '../../../core/engine';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { KeyValues, Notice, Panel, Stat, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { REMEDIES, label } from '../data';
import { JOB_LIVE, consultantName, invoiceOverdue, invoiceTotals, rand, randOf, randc, termsCurrent, termsProblem, todayStr } from '../helpers';
import { Avatar, RecLink, TermsForm } from './shared';

export default function ClientDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'clients', id);
  return (
    <RecordDetail aside={c ? <Aside id={c.id} /> : undefined} hideTransitions={['signed']}>
      {c && <Main id={c.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const base = useBase();
  const navigate = useNavigate();
  const { can } = useUser();
  const today = todayStr();
  const c = findRecord(data, 'clients', id)!;
  const [creating, setCreating] = useState(false);
  const problem = termsProblem(c, today);
  const expiringIn = str(c, 'termsExpiry') ? daysBetween(today, str(c, 'termsExpiry')) : null;
  const jobDef = config.collections.find((x) => x.key === 'jobs')!;
  const jobs = records(data, 'jobs').filter((j) => str(j, 'client') === c.id).sort((a, b) => b.ref.localeCompare(a.ref));
  return (
    <>
      <Panel title="Terms of business" meta="Draft → sent (simulated) → signed → expired. Job orders only open on signed, current terms." right={<StatusTag workflow={config.collections.find((x) => x.key === 'clients')!.workflow} status={c.status} />}>
        <KeyValues items={[
          { label: 'Permanent fee', value: `${num(c, 'feePct')}% of annual package` },
          { label: 'Payment terms', value: `${num(c, 'paymentDays')} days` },
          { label: 'Guarantee', value: `${num(c, 'guaranteeMonths')} months` },
          { label: 'If a placement leaves inside it', value: label(REMEDIES, str(c, 'remedy')) },
          { label: 'Sent (simulated)', value: formatDate(str(c, 'termsSentOn')) },
          { label: 'Signed', value: formatDate(str(c, 'termsSignedOn')) },
          { label: 'Valid until', value: formatDate(str(c, 'termsExpiry')) },
        ]} />
        {c.status === 'sent' && <div style={{ marginTop: 14 }}><p className="muted-note" style={{ marginBottom: 8 }}>When the signed copy comes back, record it here:</p><TermsForm clientId={c.id} /></div>}
        {(c.status === 'expired' || (c.status === 'signed' && expiringIn !== null && expiringIn <= 30)) && (
          <div style={{ marginTop: 14 }}>
            <Notice tone={problem ? 'red' : 'amber'}>{problem ?? `The terms expire in ${expiringIn} days. Record the renewed terms before they lapse, or new job orders cannot be opened.`}</Notice>
            <div style={{ marginTop: 10 }}><TermsForm clientId={c.id} /></div>
          </div>
        )}
        {c.status === 'draft' && <p className="muted-note" style={{ marginTop: 12 }}>Press “Send terms (simulated)” above to record that the terms went to {str(c, 'contactName')} — nothing is emailed. Or record a signed copy straight away:</p>}
        {c.status === 'draft' && <div style={{ marginTop: 8 }}><TermsForm clientId={c.id} /></div>}
      </Panel>
      <Panel title="Job orders" meta={`${jobs.filter((j) => JOB_LIVE.includes(j.status ?? '')).length} live`}
        right={can('jobs.manage') ? <button className="btn sm primary" disabled={!termsCurrent(c, today)} title={problem ?? undefined} onClick={() => setCreating(true)} data-testid="client-new-job">New job order</button> : undefined}>
        {problem && can('jobs.manage') && <p className="muted-note" style={{ marginBottom: 10 }} data-testid="client-job-blocked">{problem}</p>}
        {jobs.length ? (
          <ul className="list">
            {jobs.map((j) => (
              <li key={j.id}>
                <div className="grow"><RecLink module="jobs" id={j.id}><b>{str(j, 'title')}</b></RecLink><small>{j.ref} · {randOf(num(j, 'package'))} · {consultantName(data, str(j, 'owner'))}</small></div>
                <StatusTag workflow={jobDef.workflow} status={j.status} />
              </li>
            ))}
          </ul>
        ) : <p className="muted-note">No job orders yet.</p>}
      </Panel>
      {creating && (
        <RecordFormModal def={jobDef} open title={`New job order — ${str(c, 'name')}`} initial={{ ...jobDef.createDefaults?.(today, data), client: c.id }} onClose={() => setCreating(false)}
          onSave={(v) => {
            const j = act.create('jobs', v, 'draft', 'Job order taken');
            const res = act.transition('jobs', j.id, 'open');
            act.toast(res.ok ? `${j.ref} opened on ${str(c, 'name')}’s terms` : `${j.ref} saved as a draft: ${res.reason}`, res.ok ? 'ok' : 'err');
            setCreating(false);
            navigate(`${base}/jobs/${j.id}`);
          }} />
      )}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const { can } = useUser();
  const today = todayStr();
  const c = findRecord(data, 'clients', id)!;
  const placements = records(data, 'placements').filter((p) => str(p, 'client') === c.id);
  const invoices = records(data, 'invoices').filter((i) => str(i, 'client') === c.id && i.status !== 'void');
  const outstanding = invoices.filter((i) => i.status === 'issued').reduce((n, i) => { const t = invoiceTotals(i); return n + t.sign * t.total; }, 0);
  const overdue = invoices.filter((i) => invoiceOverdue(i, today));
  return (
    <>
      <Panel title="Hiring contact">
        <div className="patient-card">
          <Avatar name={str(c, 'contactName')} />
          <div className="grow"><b>{str(c, 'contactName')}</b><small>{str(c, 'contactRole')}</small><small>{str(c, 'email')} · {str(c, 'phone')}</small><small>Account owner: {consultantName(data, str(c, 'owner'))}</small></div>
        </div>
      </Panel>
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Stat label="Placements" value={placements.length} sub={`${placements.filter((p) => p.status === 'felloff').length} fell off`} />
        <Stat label="Outstanding" value={can('fees.view') || can('invoices.manage') ? rand(outstanding) : '—'} tone={overdue.length ? 'red' : undefined} sub={`${overdue.length} overdue`} />
      </div>
      {overdue.length > 0 && can('invoices.manage') && <Notice tone="red">{overdue.map((i) => `${i.ref} ${randc(invoiceTotals(i).total)}`).join(', ')} overdue.</Notice>}
    </>
  );
}
