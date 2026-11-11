import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Flags, KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { MANAGEMENT, OWNER_APPROVAL_LIMIT, PROPERTY_TYPES, VETTING, label } from '../data';
import { escalatedRent, leaseEndsIn, leaseSignProblems, nextEscalation, randOf, todayStr } from '../helpers';
import { AgentCard, Checklist, PersonCard, RecLink } from './shared';

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
  const base = useBase();
  const navigate = useNavigate();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const l = findRecord(data, 'leases', id)!;
  const [logging, setLogging] = useState(false);
  const jobDef = config.collections.find((c) => c.key === 'maintenance')!;
  const jobs = records(data, 'maintenance').filter((m) => str(m, 'lease') === id).sort((a, b) => str(b, 'reportedOn').localeCompare(str(a, 'reportedOn')));
  const esc = nextEscalation(l, today);
  const live = ['signed', 'active', 'notice'].includes(l.status ?? '');
  const signProblems = leaseSignProblems(l);
  const setVetting = (outcome: 'approved' | 'declined') => {
    act.update('leases', id, { vetting: outcome }, `Vetting outcome recorded: ${outcome === 'approved' ? 'passed' : 'failed'} (simulated check)`);
    act.toast(outcome === 'approved' ? `${l.ref}: vetting passed — the applicant can be approved` : `${l.ref}: vetting failed — decline the application`, outcome === 'approved' ? 'ok' : 'info');
  };
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
      {['application', 'vetting', 'approved'].includes(l.status ?? '') && (
        <Panel title="Before the lease can be signed" meta="Enforced by “Approve tenant” and “Lease signed” · credit checks are simulated">
          <Checklist items={[
            { label: 'Vetting outcome approved', ok: str(l, 'vetting') === 'approved',
              detail: l.status === 'application' ? 'Press “Start vetting (simulated)” above first' : `${label(VETTING, str(l, 'vetting'))} · no credit bureau is contacted`,
              action: l.status === 'vetting' && can('tenants.vet') ? (
                <span className="btns">
                  {str(l, 'vetting') !== 'approved' && <button className="btn sm" data-testid="vet-approved" onClick={() => setVetting('approved')}>Record: passed</button>}
                  {str(l, 'vetting') !== 'declined' && <button className="btn sm" data-testid="vet-declined" onClick={() => setVetting('declined')}>Record: failed</button>}
                </span>
              ) : undefined },
            { label: 'Deposit received into trust (simulated)', ok: l.values.depositReceived === true, detail: `${randOf(num(l, 'deposit'))} · a figure only, not a trust account`,
              action: l.values.depositReceived !== true && can('rentals.manage') && l.status !== 'application'
                ? <button className="btn sm" data-testid="deposit-received" onClick={() => { act.update('leases', id, { depositReceived: true }, `Deposit of ${randOf(num(l, 'deposit'))} recorded as received (simulated)`); act.toast(`${l.ref}: deposit recorded as received`); }}>Record deposit received</button>
                : undefined },
            { label: 'Rent and lease dates captured', ok: !signProblems.some((p) => /rent|date|end after/.test(p)), detail: `${formatDate(str(l, 'startDate'))} – ${formatDate(str(l, 'endDate'))}` },
          ]} />
          {l.status === 'vetting' && !can('tenants.vet') && <p className="muted-note" style={{ marginTop: 10 }}>Only a role holding “Vet tenants” can record the outcome and approve the applicant.</p>}
          {l.status === 'vetting' && str(l, 'vetting') === 'declined' && <p className="muted-note" style={{ marginTop: 10 }}>The check failed — use “Decline application” above (a note is required).</p>}
        </Panel>
      )}
      {l.status === 'signed' && (
        <Panel title="Move-in" meta="“Tenant moved in” is allowed from the lease start date">
          <div className="btns" style={{ flexWrap: 'wrap' }}>
            <span className="muted-note">Lease starts {formatDate(str(l, 'startDate'))}{str(l, 'startDate') > today ? ' — still to come.' : '.'}</span>
            {str(l, 'startDate') > today && can('rentals.manage') && (
              <button className="btn sm" data-testid="start-today" onClick={() => { act.update('leases', id, { startDate: today }, `Lease start brought forward to ${formatDate(today)}`); act.toast(`${l.ref}: lease now starts today — the tenant can move in`); }}>Tenant is moving in today</button>
            )}
          </div>
        </Panel>
      )}
      {num(l, 'arrears') > 0 && live && (
        <Notice tone="red">
          <b>Tenant in arrears:</b> {randOf(num(l, 'arrears'))} outstanding. The lease cannot be ended until arrears are settled or deducted from the deposit. No reminder is sent — messages are not part of this demo.
          {can('rentals.manage') && <div style={{ marginTop: 8 }}><button className="btn sm" data-testid="settle-arrears" onClick={() => { act.update('leases', id, { arrears: 0 }, `Arrears of ${randOf(num(l, 'arrears'))} recorded as settled`); act.toast(`${l.ref}: arrears recorded as settled`); }}>Record arrears settled</button></div>}
        </Notice>
      )}
      <Panel title="Maintenance" meta={`Quotes above R${OWNER_APPROVAL_LIMIT} need the owner’s written approval (demo limit)`}
        right={can('maintenance') && live ? <button className="btn sm" onClick={() => setLogging(true)} data-testid="log-maintenance"><IcoPlus /> Log request</button> : undefined}>
        {jobs.length ? (
          <ul className="list">
            {jobs.map((m) => (
              <li key={m.id}>
                <span className="time-chip">{formatDate(str(m, 'reportedOn')).slice(0, 6)}</span>
                <div className="grow"><RecLink module="maintenance" id={m.id}><b>{str(m, 'title')}</b></RecLink><small>{m.ref}{num(m, 'quote') ? ` · quote ${randOf(num(m, 'quote'))}` : ' · awaiting quote'}</small></div>
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
          onSave={(v) => {
            const m = act.create('maintenance', v, 'logged', 'Maintenance request logged');
            act.toast(`Request ${m.ref} logged — no message is sent to the contractor`);
            setLogging(false);
            if (hasModule('maintenance')) navigate(`${base}/maintenance/${m.id}`);
          }} />
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
