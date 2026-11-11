import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { DELAY_CAUSES, EMPLOYER_RISK_CAUSES, WEATHER, label } from '../data';
import { diaryLabour, diarySignProblem, holders, isRainDay } from '../helpers';

/** Diary entry detail: the generic record screen plus the few fields the signing rule asks for. */
export default function DiaryDetail() {
  const { id } = useParams();
  const data = useData();
  const d = findRecord(data, 'diary', id);
  return <RecordDetail aside={d ? <Delay key={d.id} id={d.id} /> : undefined} />;
}

function Delay({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const d = findRecord(data, 'diary', id)!;
  const rain = isRainDay(d);
  const [work, setWork] = useState(() => str(d, 'workDone'));
  const [hours, setHours] = useState(() => str(d, 'delayHours') || '0');
  const [cause, setCause] = useState(() => str(d, 'delayCause') || (rain ? 'rain' : ''));
  const [notes, setNotes] = useState(() => str(d, 'delayNotes'));
  const [err, setErr] = useState('');
  const savedCause = str(d, 'delayCause');
  const delayed = rain || num(d, 'delayHours') > 0;
  const risk = !delayed ? 'No delay recorded' : !savedCause ? 'Cause not recorded' : rain || savedCause === 'rain' ? 'Rain day — counts towards the indicative extension of time'
    : EMPLOYER_RISK_CAUSES.includes(savedCause) ? 'Employer-risk delay — counts towards the indicative extension of time' : 'Contractor-risk delay — no extension of time';
  const problem = diarySignProblem(d);

  const save = () => {
    const h = Number(hours || 0);
    if (!Number.isFinite(h) || h < 0 || h > 24) { setErr('Delay hours must be between 0 and 24.'); return; }
    act.update('diary', id, { workDone: work.trim(), delayHours: h, delayCause: cause, delayNotes: notes.trim() }, 'Diary entry updated');
    act.toast(`${d.ref}: entry saved`);
    setErr('');
  };

  return (
    <div data-testid="diary-panel">
      <Panel title="Weather & delay" meta={`${diaryLabour(d)} people on site`} right={<Tag tone={rain ? 'blue' : delayed ? 'amber' : 'green'}>{rain ? 'Rain day' : delayed ? `${num(d, 'delayHours')} h delay` : 'No delay'}</Tag>}>
        <KeyValues items={[
          { label: 'Weather', value: label(WEATHER, str(d, 'weather')) },
          { label: 'Delay cause', value: savedCause ? label(DELAY_CAUSES, savedCause) : delayed ? <b style={{ color: 'var(--red, #b0544e)' }}>Missing</b> : '' },
          { label: 'Counts as', value: risk, wide: true },
        ]} />
        {d.status === 'draft' && can('diary') && (
          <div className="stack" style={{ marginTop: 14, gap: 10 }} data-testid="diary-form">
            <Field label="Work done"><textarea className="textarea" aria-label="Work done" value={work} onChange={(e) => setWork(e.target.value)} placeholder="What was done on site today" /></Field>
            <Field label="Delay (hours)" error={err || undefined}><input className="input num" type="number" min={0} max={24} aria-label="Delay hours" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
            <Field label="Delay cause" hint="Required before signing when a delay or rain day is recorded.">
              <select className="select" aria-label="Delay cause" value={cause} onChange={(e) => setCause(e.target.value)}>
                <option value="">Select…</option>
                {DELAY_CAUSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Delay details"><textarea className="textarea" aria-label="Delay details" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div><button className="btn sm primary" onClick={save} data-testid="save-diary">Save entry</button></div>
            <p className="muted-note">{problem ? 'Save, then use “Sign diary” in the workflow panel.' : 'Ready to sign — use “Sign diary” in the workflow panel.'}</p>
          </div>
        )}
        {d.status === 'draft' && !can('diary') && <p className="muted-note" style={{ marginTop: 12 }}>Diary entries are captured and signed by {holders(data, 'diary.sign')}.</p>}
        {d.status === 'signed' && <div style={{ marginTop: 12 }}><Notice tone="grey">Signed{str(d, 'signedBy') ? ` by ${str(d, 'signedBy')}` : ''}. Use “Reopen entry” (with a reason) to change it.</Notice></div>}
        <p className="muted-note" style={{ marginTop: 10 }}>
          Rain days and employer-risk delays add up in the extension-of-time summary on the {hasModule('projects') ? <Link to={`${base}/projects/${str(d, 'project')}`}>project page</Link> : 'project page'} — indicative only, not a claim.
        </p>
      </Panel>
    </div>
  );
}
