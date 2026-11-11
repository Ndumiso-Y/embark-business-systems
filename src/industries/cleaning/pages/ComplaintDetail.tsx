import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { COMPLAINT_KINDS, PRIORITIES, label } from '../data';
import { complaintClock, daysToResolve, siteName } from '../helpers';

export default function ComplaintDetail() {
  const { id } = useParams();
  const data = useData();
  const r = findRecord(data, 'complaints', id);
  return <RecordDetail aside={r ? <Aside id={r.id} /> : undefined} />;
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const r = findRecord(data, 'complaints', id)!;
  const clock = complaintClock(r);
  const [text, setText] = useState<string | null>(null);
  const canResolve = ['acknowledged', 'inprogress'].includes(r.status ?? '') && can('complaints');
  const days = daysToResolve(r);
  const kind = label(COMPLAINT_KINDS, str(r, 'kind')).toLowerCase();
  return (
    <>
      <Panel title="Response clock" right={<Tag tone={clock.breached ? 'red' : clock.late ? 'amber' : 'green'}>{clock.breached ? 'Target breached' : clock.late ? 'Acknowledged late' : r.status === 'logged' ? 'Within target' : 'Target met'}</Tag>}>
        <KeyValues items={[
          { label: 'Priority', value: label(PRIORITIES, str(r, 'priority')) },
          { label: 'Response target', value: `${clock.target} hours` },
          { label: r.status === 'logged' ? 'Waiting' : 'Acknowledged after', value: `${clock.waited} hours` },
          { label: 'Time to resolve', value: days === null ? '—' : days === 0 ? 'Same day' : `${days} day${days === 1 ? '' : 's'}` },
        ]} />
        {clock.breached && <div style={{ marginTop: 12 }}><Notice tone="red">Nobody has acknowledged this {kind} within the {clock.target}-hour target. Acknowledge it and tell the client what happens next.</Notice></div>}
        <p className="muted-note" style={{ marginTop: 10 }}>Targets are demo values per priority, not a contractual SLA.</p>
      </Panel>
      <Panel title="Acknowledgement to the client" meta="Preview only — no message is sent">
        <div className="sms-preview" data-testid="ack-preview">
          Dear {str(r, 'reportedBy')}, thank you for letting us know. {config.businessName} has logged your {kind} for {siteName(data, r.values.site)} as {r.ref}. Your area supervisor will contact you within {clock.target} hours.
        </div>
      </Panel>
      {(canResolve || str(r, 'resolution')) && (
        <Panel title="Resolution" meta="What was done — required before the record can be marked resolved">
          <Field label="What was done">
            <textarea className="textarea" aria-label="Resolution" disabled={!canResolve} value={text ?? str(r, 'resolution')} onChange={(e) => setText(e.target.value)} />
          </Field>
          {canResolve && <button className="btn sm primary" style={{ marginTop: 8 }} disabled={text === null || text === str(r, 'resolution')} onClick={() => { act.update('complaints', id, { resolution: text ?? '' }, 'Resolution recorded'); act.toast(`${r.ref} resolution saved`); setText(null); }} data-testid="save-resolution">Save resolution</button>}
        </Panel>
      )}
    </>
  );
}
