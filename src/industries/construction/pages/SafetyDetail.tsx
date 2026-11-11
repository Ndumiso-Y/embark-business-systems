import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { Field, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { holders, safetyCloseProblem } from '../helpers';

/** Safety record detail: the generic record screen plus the one field the close-out rule asks for. */
export default function SafetyDetail() {
  const { id } = useParams();
  const data = useData();
  const r = findRecord(data, 'safety', id);
  return <RecordDetail aside={r ? <CloseOut key={r.id} id={r.id} /> : undefined} />;
}

function CloseOut({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const r = findRecord(data, 'safety', id)!;
  const toolbox = str(r, 'type') === 'toolbox';
  const [action, setAction] = useState(() => str(r, 'correctiveAction'));
  const [attendees, setAttendees] = useState(() => str(r, 'attendees'));
  const [err, setErr] = useState('');
  const problem = safetyCloseProblem(r);

  const save = () => {
    if (toolbox) {
      const n = Number(attendees);
      if (!(n > 0) || n > 500) { setErr('Enter how many people attended (1–500).'); return; }
      act.update('safety', id, { attendees: n }, `Attendance recorded: ${n}`);
    } else {
      if (!action.trim()) { setErr('Describe the corrective action.'); return; }
      act.update('safety', id, { correctiveAction: action.trim() }, 'Corrective action recorded');
    }
    act.toast(`${r.ref}: saved — it can now be closed out`);
    setErr('');
  };

  if (r.status !== 'open') return null;
  return (
    <div data-testid="safety-panel">
      <Panel title="Before close-out" meta={toolbox ? 'A toolbox talk needs its attendance recorded' : 'Incidents and near misses need a corrective action'}>
        {!problem && <Notice tone="accent">{can('safety') ? 'Nothing outstanding — use “Close out” in the workflow panel.' : `Nothing outstanding. Closed out by ${holders(data, 'safety')}.`}</Notice>}
        {problem && (can('safety.report') ? (
          <>
            {toolbox ? (
              <Field label="Attendees" error={err || undefined}><input className="input num" type="number" min={1} max={500} aria-label="Attendees" value={attendees} onChange={(e) => setAttendees(e.target.value)} /></Field>
            ) : (
              <Field label="Corrective action" error={err || undefined}><textarea className="textarea" aria-label="Corrective action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="What was changed so it cannot happen again" /></Field>
            )}
            <button className="btn sm primary" style={{ marginTop: 10 }} onClick={save} data-testid="save-safety">{toolbox ? 'Record attendance' : 'Record corrective action'}</button>
            {!can('safety') && <p className="muted-note" style={{ marginTop: 10 }}>The record is then closed out by {holders(data, 'safety')}.</p>}
          </>
        ) : <Notice tone="amber">{problem} Recorded by {holders(data, 'safety.report')}.</Notice>)}
        {toolbox && !problem && num(r, 'attendees') > 0 && <p className="muted-note" style={{ marginTop: 10 }}>{num(r, 'attendees')} people attended.</p>}
      </Panel>
    </div>
  );
}
