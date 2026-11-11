import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Segmented, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { INSPECTION_AREAS, REINSPECT_DAYS, SCORE_WORDS } from '../data';
import { inspectionFailed, inspectionProblems, inspectionScore, lowAreas, siteOf, slaTarget } from '../helpers';
import { ScoreTrend } from './shared';

export default function InspectionDetail() {
  const { id } = useParams();
  const data = useData();
  const r = findRecord(data, 'inspections', id);
  return (
    <RecordDetail aside={r ? <Aside id={r.id} /> : undefined}>
      {r && <ScoreSheet id={r.id} />}
    </RecordDetail>
  );
}

/** Area scores (1–5) with the computed percentage and the corrective action the rules ask for. */
function ScoreSheet({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const r = findRecord(data, 'inspections', id)!;
  const editable = r.status === 'draft' && can('inspections');
  const [draft, setDraft] = useState<Values | null>(null);
  const v: Values = { ...r.values, ...(draft ?? {}) };
  const score = inspectionScore(r);
  const target = slaTarget(siteOf(data, r));
  const low = lowAreas(r);
  const problems = r.status === 'draft' ? inspectionProblems(r, data) : [];
  const save = () => { if (draft) { act.update('inspections', id, draft, 'Corrective action recorded'); act.toast(`${r.ref} saved`); setDraft(null); } };
  return (
    <Panel title="Area scores" meta="1 unacceptable · 2 poor · 3 acceptable · 4 good · 5 excellent"
      right={score === null ? <Tag tone="dark">Not scored</Tag> : <Tag tone={score < target ? 'red' : 'green'}>{score}% · SLA {target}%</Tag>}>
      <div className="table-wrap">
        <table className="table" data-testid="score-sheet">
          <thead><tr><th>Area</th><th>Score</th><th>Rating</th></tr></thead>
          <tbody>
            {INSPECTION_AREAS.map((a) => {
              const n = num(r, a.key);
              return (
                <tr key={a.key}>
                  <td><strong>{a.label}</strong></td>
                  <td>
                    {editable
                      ? <Segmented label={`${a.label} score`} value={String(n || '') as '' | '1' | '2' | '3' | '4' | '5'} options={(['1', '2', '3', '4', '5'] as const).map((x) => ({ value: x, label: x }))} onChange={(x) => act.update('inspections', id, { [a.key]: Number(x) })} />
                      : n ? <b>{n} / 5</b> : '—'}
                  </td>
                  <td>{n ? <Tag tone={n <= 2 ? 'red' : n === 3 ? 'amber' : 'green'}>{SCORE_WORDS[n]}</Tag> : <Tag tone="dark">To score</Tag>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(low.length > 0 || str(r, 'correctiveAction')) && (
        <div style={{ marginTop: 14 }}>
          {low.length > 0 && r.status === 'draft' && <Notice tone="amber">{low.map((a) => a.label).join(' and ')} scored 2 or below. A corrective action with a due date is required before this inspection can be submitted.</Notice>}
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="span-2">
              <Field label="Corrective action"><textarea className="textarea" aria-label="Corrective action" disabled={!editable} value={String(v.correctiveAction ?? '')} onChange={(e) => setDraft({ ...(draft ?? {}), correctiveAction: e.target.value })} placeholder="What will be done, and by whom" /></Field>
            </div>
            <Field label="Due date"><input className="input" type="date" aria-label="Corrective action due" disabled={!editable} value={String(v.correctiveDue ?? '')} onChange={(e) => setDraft({ ...(draft ?? {}), correctiveDue: e.target.value })} /></Field>
            {editable && <div style={{ alignSelf: 'end' }}><button className="btn primary" disabled={!draft} onClick={save} data-testid="save-corrective">{draft ? 'Save corrective action' : 'Saved'}</button></div>}
          </div>
          {r.status !== 'draft' && str(r, 'correctiveAction') && can('inspections') && (
            <label className="check" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={r.values.correctiveDone === true} onChange={(e) => act.update('inspections', id, { correctiveDone: e.target.checked }, e.target.checked ? 'Corrective action completed' : 'Corrective action reopened')} /> Corrective action completed
            </label>
          )}
        </div>
      )}
      {problems.length > 0 && <ul className="problem-list muted-note" style={{ marginTop: 12 }} data-testid="inspection-problems">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      {r.status === 'draft' && !problems.length && score !== null && score < target && (
        <div style={{ marginTop: 12 }}><Notice tone="red">At {score}% this inspection is below the {target}% SLA target. Submitting it will schedule a re-inspection within {REINSPECT_DAYS} days.</Notice></div>
      )}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const r = findRecord(data, 'inspections', id)!;
  const site = siteOf(data, r);
  const score = inspectionScore(r);
  const parent = findRecord(data, 'inspections', str(r, 'followUpOf'));
  const followUps = records(data, 'inspections').filter((i) => str(i, 'followUpOf') === r.id);
  return (
    <>
      <Panel title="Result" right={score === null ? undefined : <Tag tone={inspectionFailed(r, data) ? 'red' : 'green'}>{inspectionFailed(r, data) ? 'Below SLA' : 'Meets SLA'}</Tag>}>
        <KeyValues items={[
          { label: 'Score', value: score === null ? 'Not scored yet' : <b>{score}%</b> },
          { label: 'SLA target', value: `${slaTarget(site)}%` },
          { label: 'Follow-up to', value: parent ? <Link to={`${base}/inspections/${parent.id}`}>{parent.ref} · {inspectionScore(parent)}%</Link> : '—' },
          { label: 'Re-inspection', value: followUps.length ? followUps.map((f) => <Link key={f.id} to={`${base}/inspections/${f.id}`}>{f.ref} · {formatDate(str(f, 'date'))} </Link>) : '—' },
        ]} />
        <p className="muted-note" style={{ marginTop: 10 }}>Score = points awarded ÷ (areas × 5). Client sign-off is logged by staff — nothing is signed by the client in this demo.</p>
      </Panel>
      {site && <Panel title="Site trend" meta={str(site, 'name')}><ScoreTrend data={data} site={site} /></Panel>}
    </>
  );
}
