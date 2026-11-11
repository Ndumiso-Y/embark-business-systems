import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { ENV_POINTS, label, withUnit } from '../data';
import { envExceedance, envParam } from '../helpers';

export default function EnvDetail() {
  const { id } = useParams();
  const data = useData();
  const r = findRecord(data, 'envreadings', id);
  return <RecordDetail aside={r ? <Aside id={r.id} /> : undefined} />;
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const r = findRecord(data, 'envreadings', id)!;
  const p = envParam(r);
  const ex = envExceedance(r);
  const history = records(data, 'envreadings')
    .filter((x) => x.id !== id && str(x, 'point') === str(r, 'point') && str(x, 'parameter') === str(r, 'parameter'))
    .sort((a, b) => str(b, 'date').localeCompare(str(a, 'date')))
    .slice(0, 4);
  const review = () => {
    // The generic workflow buttons only collect a note for `requiresNote` steps, so
    // exceedance reviews post the note here; the guard in index.ts enforces it.
    const res = act.transition('envreadings', id, 'reviewed', note);
    if (!res.ok) { setErr(res.reason); return; }
    act.toast(`${r.ref}: exceedance reviewed`);
    setNote(''); setErr('');
  };
  return (
    <>
      <Panel title="Against demo threshold" right={<Tag tone={ex ? 'red' : 'green'}>{ex ? 'Outside threshold' : 'Within threshold'}</Tag>}>
        <KeyValues items={[
          { label: 'Reading', value: withUnit(num(r, 'value'), p?.unit) },
          { label: 'Demo threshold', value: p ? withUnit([p.min !== undefined ? `≥ ${p.min}` : '', p.max !== undefined ? `≤ ${p.max}` : ''].filter(Boolean).join(' and '), p.unit) : '—' },
        ]} />
        {ex && <div style={{ marginTop: 12 }}><Notice tone="red">{ex}.</Notice></div>}
        {ex && r.status === 'recorded' && can('environment') && (
          <div style={{ marginTop: 12 }}>
            <Field label="Review note (required for an exceedance)" error={err || undefined}>
              <textarea className="textarea" aria-label="Exceedance review note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cause found and follow-up actions…" />
            </Field>
            <button className="btn sm primary" style={{ marginTop: 10 }} onClick={review} data-testid="review-exceedance">Review with note</button>
          </div>
        )}
        <p className="muted-note" style={{ marginTop: 12 }}>Demo thresholds, not regulatory limits.</p>
      </Panel>
      {history.length > 0 && (
        <Panel title="Previous readings" meta={label(ENV_POINTS, str(r, 'point'))}>
          <ul className="list">
            {history.map((h) => (
              <li key={h.id}><span className={`dot ${envExceedance(h) ? 'red' : 'green'}`} /><div className="grow"><b>{withUnit(num(h, 'value'), p?.unit)}</b><small>{formatDate(str(h, 'date'))} · {h.ref}</small></div></li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
