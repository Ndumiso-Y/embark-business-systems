import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { todayStr } from '../helpers';
import { holders } from '../helpers';

/** Incident detail: the generic record screen plus the investigation form the workflow rules ask for. */
export default function IncidentDetail() {
  const { id } = useParams();
  const data = useData();
  const i = findRecord(data, 'incidents', id);
  return <RecordDetail aside={i ? <Investigation key={i.id} id={i.id} /> : undefined} />;
}

function Investigation({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const i = findRecord(data, 'incidents', id)!;
  const may = can('safety.investigate');
  const [cause, setCause] = useState(() => str(i, 'rootCause'));
  const [actions, setActions] = useState(() => str(i, 'correctiveActions'));
  const [owner, setOwner] = useState(() => str(i, 'actionOwner'));
  const [due, setDue] = useState(() => str(i, 'actionDue') || addDays(today, 14));
  const [lost, setLost] = useState(() => str(i, 'lostDays'));
  const [err, setErr] = useState('');
  const done = i.values.actionsComplete === true;
  const overdue = !done && !!str(i, 'actionDue') && str(i, 'actionDue') < today;
  const lostDaysMissing = i.values.lti === true && !(num(i, 'lostDays') > 0);

  const save = () => {
    act.update('incidents', id, { rootCause: cause.trim(), correctiveActions: actions.trim(), actionOwner: owner.trim(), actionDue: due }, 'Investigation findings saved');
    act.toast(`${i.ref}: investigation saved`);
  };
  const complete = () => {
    act.update('incidents', id, { actionsComplete: true }, 'Corrective actions marked complete');
    act.toast(`${i.ref}: corrective actions complete — the incident can now be closed`);
  };
  const saveLost = () => {
    const n = Number(lost);
    if (!(n > 0) || n > 365) { setErr('Enter the number of lost days (1–365).'); return; }
    act.update('incidents', id, { lostDays: n }, `Lost days recorded: ${n}`);
    act.toast(`${i.ref}: lost days recorded`);
    setErr('');
  };

  if (i.status === 'reported') {
    return (
      <div data-testid="investigation-panel">
        <Panel title="Investigation" meta="Root cause → corrective actions → close-out">
          <Notice tone="grey">{may ? 'Press “Start investigation”, then record the root cause and corrective actions here.' : `Waiting for the investigation to start — done by ${holders(data, 'safety.investigate')}.`}</Notice>
        </Panel>
      </div>
    );
  }
  return (
    <div data-testid="investigation-panel">
    <Panel title="Investigation" meta="Root cause → corrective actions → close-out"
      right={i.status !== 'investigating' ? <Tag tone={done ? 'green' : overdue ? 'red' : 'amber'}>{done ? 'Actions complete' : overdue ? 'Actions overdue' : 'Actions open'}</Tag> : undefined}>
      {i.status === 'investigating' && may ? (
        <div className="stack" style={{ gap: 10 }} data-testid="investigation-form">
          <Field label="Root cause"><textarea className="textarea" aria-label="Root cause" value={cause} onChange={(e) => setCause(e.target.value)} placeholder="What allowed this to happen?" /></Field>
          <Field label="Corrective actions"><textarea className="textarea" aria-label="Corrective actions" value={actions} onChange={(e) => setActions(e.target.value)} placeholder="What will be changed, agreed with the section" /></Field>
          <Field label="Action owner"><input className="input" aria-label="Action owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who will see it through" /></Field>
          <Field label="Actions due"><input className="input" type="date" aria-label="Actions due" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <div><button className="btn sm primary" onClick={save} data-testid="save-investigation">Save findings</button></div>
          <p className="muted-note">Save, then use “Agree corrective actions” in the workflow panel. A root cause, the actions, an owner and a due date are all required.</p>
        </div>
      ) : (
        <KeyValues items={[
          { label: 'Root cause', value: str(i, 'rootCause'), wide: true },
          { label: 'Corrective actions', value: str(i, 'correctiveActions'), wide: true },
          { label: 'Action owner', value: str(i, 'actionOwner') },
          { label: 'Actions due', value: str(i, 'actionDue') ? formatDate(str(i, 'actionDue')) : '' },
        ]} />
      )}
      {i.status === 'investigating' && !may && <p className="muted-note" style={{ marginTop: 10 }}>The investigation is run by {holders(data, 'safety.investigate')}.</p>}
      {i.status === 'actions' && (
        <div className="stack" style={{ marginTop: 12, gap: 10 }}>
          {!done && (may
            ? <><Notice tone={overdue ? 'red' : 'amber'}>The incident can only be closed once the corrective actions are marked complete.</Notice><div><button className="btn sm primary" onClick={complete} data-testid="actions-complete">Mark corrective actions complete</button></div></>
            : <p className="muted-note">Actions are signed off and the incident closed by {holders(data, 'safety.investigate')}.</p>)}
          {lostDaysMissing && may && (
            <>
              <Field label="Lost days (lost-time injury)" error={err || undefined}><input className="input num" type="number" min={1} max={365} aria-label="Lost days" value={lost} onChange={(e) => setLost(e.target.value)} /></Field>
              <div><button className="btn sm" onClick={saveLost}>Record lost days</button></div>
            </>
          )}
          {done && !lostDaysMissing && may && <Notice tone="accent">Ready to close — use “Close incident” and add a close-out note.</Notice>}
        </div>
      )}
    </Panel>
    </div>
  );
}
