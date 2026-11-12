import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, permissionHint, str } from '../../../core/engine';
import { Field, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { claimRefProblem, needsClaimRef } from '../helpers';
import { MallStyles } from './shared';

export default function IncidentDetail() {
  const { id } = useParams();
  const data = useData();
  const i = findRecord(data, 'incidents', id);
  return <RecordDetail>{i && <Main key={`${i.id}-${i.status}`} id={i.id} />}</RecordDetail>;
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can, user } = useUser();
  const i = findRecord(data, 'incidents', id)!;
  const status = i.status ?? '';
  const edit = can('incidents') && status !== 'closed';
  const [responder, setResponder] = useState(str(i, 'responder') || (status === 'reported' ? user.name : ''));
  const [action, setAction] = useState(str(i, 'action'));
  const [findings, setFindings] = useState(str(i, 'findings'));
  const [ref, setRef] = useState(str(i, 'insuranceRef'));
  const claim = needsClaimRef(i);
  return (
    <>
      <MallStyles />
      <Panel title="Response" meta="Who attended and what was done — “Log response” is refused until both are recorded" right={str(i, 'responder') ? <Tag tone="green">Recorded</Tag> : <Tag tone="red">Not recorded</Tag>}>
        {status === 'reported' && edit ? (
          <>
            <div className="form-grid">
              <Field label="Who responded"><input className="input" aria-label="Who responded" value={responder} onChange={(e) => setResponder(e.target.value)} data-testid="responder" /></Field>
              <div className="span-2"><Field label="What was done"><textarea className="textarea" aria-label="What was done" value={action} onChange={(e) => setAction(e.target.value)} placeholder="First aid, area made safe, who was called…" data-testid="action-taken" /></Field></div>
            </div>
            <div style={{ marginTop: 10 }}><button className="btn" data-testid="save-response" onClick={() => { if (!responder.trim() || !action.trim()) return act.toast('Record who responded and what was done.', 'err'); act.update('incidents', id, { responder: responder.trim(), action: action.trim() }, 'Response recorded'); act.toast(`${i.ref}: response saved — press “Log response”`); }}>Save response</button></div>
          </>
        ) : str(i, 'responder') ? <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}><b>{str(i, 'responder')}:</b> {str(i, 'action')}</p> : <p className="muted-note">{can('incidents') ? 'No response recorded.' : permissionHint(config, data, 'incidents')}</p>}
      </Panel>
      {status !== 'reported' && (
        <Panel title="Investigation" meta="Cause and what changes — “Investigation complete” is refused without findings" right={str(i, 'findings') ? <Tag tone="green">Written up</Tag> : <Tag tone="red">No findings yet</Tag>}>
          {status === 'responded' && edit ? (
            <>
              <Field label="Findings"><textarea className="textarea" aria-label="Findings" value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="What caused it, and what will be done so it does not happen again" data-testid="findings" /></Field>
              <div style={{ marginTop: 10 }}><button className="btn" data-testid="save-findings" onClick={() => { if (!findings.trim()) return act.toast('Write up the findings first.', 'err'); act.update('incidents', id, { findings: findings.trim() }, 'Findings recorded'); act.toast(`${i.ref}: findings saved`); }}>Save findings</button></div>
            </>
          ) : <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{str(i, 'findings') || 'No findings recorded.'}</p>}
        </Panel>
      )}
      {claim && (
        <Panel title="Insurance" meta="An injury or damage must carry an insurance reference before the incident is closed" right={str(i, 'insuranceRef') && !claimRefProblem(str(i, 'insuranceRef')) ? <Tag tone="green">{str(i, 'insuranceRef')}</Tag> : <Tag tone="red">No reference</Tag>}>
          {edit ? (
            <div className="mall-inline">
              <Field label="Insurance reference (fictional)"><input className="input" aria-label="Insurance reference" placeholder="DEMO-CLM-0000" value={ref} onChange={(e) => setRef(e.target.value)} data-testid="insurance-ref" /></Field>
              <button className="btn" data-testid="save-insurance-ref" onClick={() => { const p = claimRefProblem(ref); if (p) return act.toast(p, 'err'); act.update('incidents', id, { insuranceRef: ref.trim() }, `Insurance reference ${ref.trim()} recorded`); act.toast(`${i.ref}: insurance reference saved`); }}>Save reference</button>
            </div>
          ) : <p className="muted-note">{str(i, 'insuranceRef') || 'None recorded.'}</p>}
          <p className="muted-note" style={{ marginTop: 10 }}>References are typed in and must start with DEMO-CLM- so they cannot be mistaken for a real claim. Nothing is lodged with an insurer.</p>
        </Panel>
      )}
      {!claim && status === 'investigated' && <Notice tone="grey">No injury or damage was recorded, so no insurance reference is needed to close this incident.</Notice>}
    </>
  );
}
