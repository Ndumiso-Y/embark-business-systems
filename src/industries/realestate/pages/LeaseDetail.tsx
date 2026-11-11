import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Flags, KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { MANAGEMENT, OWNER_APPROVAL_LIMIT, PROPERTY_TYPES, VETTING, label } from '../data';
import { escalatedRent, leaseEndsIn, leaseSignProblems, nextEscalation, randOf, todayStr } from '../helpers';
import { AgentCard, Checklist, PersonCard } from './shared';

export default function LeaseDetail() {
  const { id } = useParams();
  const data = useData();
  const l = findRecord(data, 'leases', id);
  return (
    <RecordDetail aside={l ? <Aside id={l.id} /> : undefined}>
      {l && <Main id={l.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const l = findRecord(data, 'leases', id)!;
  const [logging, setLogging] = useState(false);
  const jobDef = config.collections.find((c) => c.key === 'maintenance')!;
  const jobs = records(data, 'maintenance').filter((m) => str(m, 'lease') === id).sort((a, b) => str(b, 'reportedOn').localeCompare(str(a, 'reportedOn')));
  const esc = nextEscalation(l, today);
  const live = ['signed', 'active', 'notice'].includes(l.status ?? '');
  const signProblems = leaseSignProblems(l);
  return (
    <>
      <Panel title="Rent & deposit" meta="Deposit held in trust is simulated — not a PPRA-compliant trust account">
        <div className="mini-stat-row">
          <div>Monthly rent<b>{randOf(num(l, 'rent'))}</b></div>
          <div>Escalation<b>{num(l, 'escalation')}% a year</b></div>
          {esc && <div>From {formatDate(esc)}<b>{randOf(escalatedRent(l))}</b></div>}
          <div>Deposit (simulated trust)<b>{randOf(num(l, 'deposit'))} {l.values.depositReceived === true ? '✓' : ''}</b></div>
          <div>Arrears<b style={num(l, 'arrears') > 0 ? { color: 'var(--danger)' } : undefined}>{randOf(num(l, 'arrears'))}</b></div>
        </div>
      </Panel>
      {['approved', 'vetting'].includes(l.status ?? '') && (
        <Panel title="Before the lease can be signed" meta="Enforced by “Lease signed” · credit checks are simulated">
          <Checklist items={[
            { label: 'Vetting outcome approved', ok: str(l, 'vetting') === 'approved', detail: label(VETTING, str(l, 'vetting')) },
            { label: 'Deposit received into trust (simulated)', ok: l.values.depositReceived === true, detail: randOf(num(l, 'deposit')) },
            { label: 'Rent and lease dates captured', ok: !signProblems.some((p) => /rent|date|end after/.test(p)), detail: `${formatDate(str(l, 'startDate'))} – ${formatDate(str(l, 'endDate'))}` },
          ]} />
        </Panel>
      )}
      {num(l, 'arrears') > 0 && live && <Notice tone="red"><b>Tenant in arrears:</b> {randOf(num(l, 'arrears'))} outstanding. The lease cannot be ended until arrears are settled or deducted from the deposit. No reminder is sent — messages are not part of this demo.</Notice>}
      <Panel title="Maintenance" meta={`Quotes above R${OWNER_APPROVAL_LIMIT} need the owner’s written approval (demo limit)`}
        right={can('maintenance') && live ? <button className="btn sm" onClick={() => setLogging(true)} data-testid="log-maintenance"><IcoPlus /> Log request</button> : undefined}>
        {jobs.length ? (
          <ul className="list">
            {jobs.map((m) => (
              <li key={m.id}>
                <span className="time-chip">{formatDate(str(m, 'reportedOn')).slice(0, 6)}</span>
                <div className="grow"><b>{str(m, 'title')}</b><small>{m.ref}{num(m, 'quote') ? ` · quote ${randOf(num(m, 'quote'))}` : ''}</small></div>
                <Flags flags={jobDef.flags?.(m, data, today) ?? []} />
                <StatusTag workflow={jobDef.workflow} status={m.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No maintenance requests" />}
      </Panel>
      {logging && (
        <RecordFormModal def={jobDef} open title={`Maintenance request · ${l.ref}`} initial={{ lease: id, reportedOn: today, priority: 'normal', category: 'general' }}
          onClose={() => setLogging(false)}
          onSave={(v) => { const m = act.create('maintenance', v, 'logged', 'Maintenance request logged'); act.toast(`Request ${m.ref} logged — no message is sent to the contractor`); setLogging(false); }} />
      )}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const l = findRecord(data, 'leases', id)!;
  const left = leaseEndsIn(l, today);
  return (
    <>
      <Panel title="Tenant (fictional)">
        <PersonCard name={str(l, 'tenant')} lines={[str(l, 'tenantPhone'), str(l, 'tenantEmail')]}
          tag={<Tag tone={str(l, 'vetting') === 'approved' ? 'green' : str(l, 'vetting') === 'declined' ? 'red' : 'amber'}>{label(VETTING, str(l, 'vetting'))}</Tag>} />
      </Panel>
      <Panel title="Lease term">
        <KeyValues items={[
          { label: 'Property', value: `${label(PROPERTY_TYPES, str(l, 'propertyType'))} · ${num(l, 'beds')} bed` },
          { label: 'Landlord', value: str(l, 'landlord') },
          { label: 'Mandate', value: label(MANAGEMENT, str(l, 'management')) },
          { label: 'Starts', value: formatDate(str(l, 'startDate')) },
          { label: 'Ends', value: <>{formatDate(str(l, 'endDate'))} {left !== null && left <= 60 && ['active', 'notice'].includes(l.status ?? '') && <Tag tone={left < 0 ? 'red' : 'amber'}>{left < 0 ? 'passed' : `${left} d`}</Tag>}</> },
          { label: 'Notice given', value: formatDate(str(l, 'noticeDate')) },
        ]} />
      </Panel>
      <Panel title="Rental agent"><AgentCard data={data} id={l.values.agent} today={today} /></Panel>
    </>
  );
}
