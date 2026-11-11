import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { COMPLAINT_KINDS, PRIORITIES, STAFF_ROLES, label } from '../data';
import { complaintClock, daysToResolve, formatStamp, fullName, siteName, siteOf, staffName } from '../helpers';

export default function ComplaintDetail() {
  const { id } = useParams();
  const data = useData();
  const r = findRecord(data, 'complaints', id);
  return (
    <RecordDetail aside={r ? <Aside id={r.id} /> : undefined}>
      {r && <AssignResolve key={r.id} id={r.id} />}
    </RecordDetail>
  );
}

/** The two things the workflow asks for: who is dealing with it, and what was done. */
function AssignResolve({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const r = findRecord(data, 'complaints', id)!;
  const site = siteOf(data, r);
  const open = ['logged', 'acknowledged', 'inprogress'].includes(r.status ?? '') && can('complaints');
  const canResolve = ['acknowledged', 'inprogress'].includes(r.status ?? '') && can('complaints');
  // Area supervisors, plus the team leaders based at this site; the site's own supervisor is suggested.
  const people = records(data, 'staff')
    .filter((p) => p.status === 'active' && (str(p, 'role') === 'supervisor' || (str(p, 'role') === 'leader' && str(p, 'homeSite') === site?.id)))
    .sort((a, b) => Number(b.id === str(site, 'supervisor')) - Number(a.id === str(site, 'supervisor')) || fullName(a).localeCompare(fullName(b)));
  const assigned = str(r, 'assignedTo');
  const [pick, setPick] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const chosen = pick ?? (assigned || str(site, 'supervisor'));
  const assign = () => {
    if (!chosen) return;
    act.update('complaints', id, { assignedTo: chosen }, `Assigned to ${staffName(data, chosen)}`);
    act.toast(`${r.ref} assigned to ${staffName(data, chosen)}`);
    setPick(null);
  };
  return (
    <Panel title="Assign & resolve" meta="Who is dealing with it and what was done — both are needed before the record can be closed"
      right={assigned ? <Tag tone="accent">{staffName(data, assigned)}</Tag> : <Tag tone="amber">Not assigned</Tag>}>
      <div className="form-grid">
        <Field label="Assigned to" hint={open ? 'Area supervisors and the team leaders based at this site.' : undefined}>
          <select className="select" aria-label="Assign to" disabled={!open} value={chosen} onChange={(e) => setPick(e.target.value)} data-testid="assign-to">
            <option value="">Select who will deal with it…</option>
            {assigned && !people.some((p) => p.id === assigned) && <option value={assigned}>{staffName(data, assigned)}</option>}
            {people.map((p) => <option key={p.id} value={p.id}>{fullName(p)} · {label(STAFF_ROLES, str(p, 'role'))}{p.id === str(site, 'supervisor') ? ' for this site' : ''}</option>)}
          </select>
        </Field>
        {open && <div style={{ alignSelf: 'end' }}><button className="btn primary" disabled={!chosen || chosen === assigned} onClick={assign} data-testid="save-assign">{assigned && chosen === assigned ? 'Assigned' : assigned ? 'Reassign' : 'Assign'}</button></div>}
        <div className="span-2">
          <Field label="Resolution — what was done" hint={r.status === 'logged' ? 'Acknowledge the record first; the resolution is recorded once someone is dealing with it.' : canResolve ? 'Save this, then press “Mark resolved” in the workflow above.' : undefined}>
            <textarea className="textarea" aria-label="Resolution" disabled={!canResolve} value={text ?? str(r, 'resolution')} onChange={(e) => setText(e.target.value)} placeholder={canResolve ? 'e.g. Area re-cleaned the same afternoon; added to the daily checklist' : ''} />
          </Field>
          {canResolve && <button className="btn sm primary" style={{ marginTop: 8 }} disabled={text === null || text === str(r, 'resolution')} onClick={() => { act.update('complaints', id, { resolution: (text ?? '').trim() }, 'Resolution recorded'); act.toast(`${r.ref} resolution saved`); setText(null); }} data-testid="save-resolution">Save resolution</button>}
        </div>
      </div>
      {!can('complaints') && <p className="muted-note" style={{ marginTop: 10 }}>Your simulated role can read this record. Assigning and resolving need “Complaints”.</p>}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const r = findRecord(data, 'complaints', id)!;
  const clock = complaintClock(r);
  const days = daysToResolve(r);
  const kind = label(COMPLAINT_KINDS, str(r, 'kind')).toLowerCase();
  return (
    <>
      <Panel title="Response clock" right={<Tag tone={clock.breached ? 'red' : clock.late ? 'amber' : 'green'}>{clock.breached ? 'Target breached' : clock.late ? 'Acknowledged late' : r.status === 'logged' ? 'Within target' : 'Target met'}</Tag>}>
        <KeyValues items={[
          { label: 'Priority', value: label(PRIORITIES, str(r, 'priority')) },
          { label: 'Response target', value: `${clock.target} hours` },
          { label: r.status === 'logged' ? 'Waiting' : 'Acknowledged after', value: `${clock.waited} hours` },
          { label: 'Acknowledged at', value: str(r, 'ackAt') ? formatStamp(str(r, 'ackAt')) : '—' },
          { label: 'Time to resolve', value: days === null ? '—' : days === 0 ? 'Same day' : `${days} day${days === 1 ? '' : 's'}` },
        ]} />
        {clock.breached && <div style={{ marginTop: 12 }}><Notice tone="red">Nobody has acknowledged this {kind} within the {clock.target}-hour target. Acknowledge it and tell the client what happens next.</Notice></div>}
        <p className="muted-note" style={{ marginTop: 10 }}>The clock runs from the time logged to the acknowledgement. Targets are demo values per priority, not a contractual SLA.</p>
      </Panel>
      <Panel title="Acknowledgement to the client" meta="Preview only — no message is sent">
        <div className="sms-preview" data-testid="ack-preview">
          Dear {str(r, 'reportedBy')}, thank you for letting us know. {config.businessName} has logged your {kind} for {siteName(data, r.values.site)} as {r.ref}. Your area supervisor will contact you within {clock.target} hours.
        </div>
      </Panel>
    </>
  );
}
