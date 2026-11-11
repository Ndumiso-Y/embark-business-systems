import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { DELAY_REASONS, label } from '../data';
import { pctTone, tonnes } from './format';
import { holders } from '../helpers';

/** Shift log detail: the generic record screen plus a focused "shift figures" panel, so the
 *  values the submit and verify rules ask for can be captured without the full edit form. */
export default function ShiftDetail() {
  const { id } = useParams();
  const data = useData();
  const s = findRecord(data, 'shifts', id);
  return <RecordDetail aside={s ? <Figures key={s.id} id={s.id} /> : undefined} />;
}

function Figures({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { user, can } = useUser();
  const s = findRecord(data, 'shifts', id)!;
  const [t, setT] = useState(() => str(s, 'tonnesHoisted'));
  const [delay, setDelay] = useState(() => str(s, 'delayMinutes') || '0');
  const [reason, setReason] = useState(() => str(s, 'delayReason'));
  const [err, setErr] = useState('');

  const target = num(s, 'targetTonnes');
  const pct = target ? Math.round((num(s, 'tonnesHoisted') / target) * 100) : 0;
  const reasonMissing = num(s, 'delayMinutes') > 30 && !str(s, 'delayReason');
  const submitter = [...s.history].reverse().find((h) => h.action === 'Submit shift')?.by;
  const canLog = can('production.log');
  const canVerify = can('production.verify');

  const save = () => {
    const tn = Number(t);
    const dn = Number(delay || 0);
    if (t === '' || !Number.isFinite(tn) || tn < 0 || tn > 2000) { setErr('Enter the tonnes hoisted (0–2 000).'); return; }
    if (!Number.isFinite(dn) || dn < 0 || dn > 480) { setErr('Delay minutes must be between 0 and 480.'); return; }
    act.update('shifts', id, { tonnesHoisted: tn, delayMinutes: dn, delayReason: reason }, 'Shift figures updated');
    act.toast(`${s.ref}: figures saved`);
    setErr('');
  };
  const saveReason = () => {
    if (!reason) { setErr('Select the main delay reason.'); return; }
    act.update('shifts', id, { delayReason: reason }, `Delay reason recorded: ${label(DELAY_REASONS, reason)}`);
    act.toast(`${s.ref}: delay reason recorded`);
    setErr('');
  };
  const reasonSelect = (
    <Field label="Main delay reason" hint="Needed before verification when delays exceed 30 minutes.">
      <select className="select" aria-label="Main delay reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="">Select…</option>
        {DELAY_REASONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>
    </Field>
  );

  return (
    <div data-testid="shift-panel">
    <Panel title="Shift figures" meta="Tonnes against the (fictional) mine plan" right={<Tag tone={s.status === 'open' ? 'dark' : pctTone(pct)}>{pct}% of plan</Tag>}>
      <KeyValues items={[
        { label: 'Hoisted', value: str(s, 'tonnesHoisted') === '' ? 'Not captured' : tonnes(num(s, 'tonnesHoisted')) },
        { label: 'Plan', value: tonnes(target) },
        { label: 'Delays', value: `${num(s, 'delayMinutes')} min${str(s, 'delayReason') ? ` · ${label(DELAY_REASONS, str(s, 'delayReason'))}` : ''}` },
      ]} />

      {s.status === 'open' && canLog && (
        <div className="stack" style={{ marginTop: 14, gap: 10 }} data-testid="shift-figures">
          <Field label="Tonnes hoisted" error={err || undefined}>
            <input className="input num" type="number" min={0} max={2000} aria-label="Tonnes hoisted" value={t} onChange={(e) => setT(e.target.value)} />
          </Field>
          <Field label="Delay minutes">
            <input className="input num" type="number" min={0} max={480} aria-label="Delay minutes" value={delay} onChange={(e) => setDelay(e.target.value)} />
          </Field>
          {reasonSelect}
          {Number(delay) > 30 && !reason && <Notice tone="amber">More than 30 delay minutes: without a reason this log can be submitted but not verified.</Notice>}
          <div><button className="btn sm primary" onClick={save} data-testid="save-figures">Save figures</button></div>
          <p className="muted-note">Save the figures, then use “Submit shift” in the workflow panel.</p>
        </div>
      )}
      {s.status === 'open' && !canLog && <p className="muted-note" style={{ marginTop: 12 }}>Figures are captured by {holders(data, 'production.log')}.</p>}

      {s.status === 'submitted' && reasonMissing && (
        <div className="stack" style={{ marginTop: 14, gap: 10 }}>
          <Notice tone="red">{num(s, 'delayMinutes')} delay minutes with no reason — verification is blocked until a reason is recorded.</Notice>
          {canLog ? (
            <>
              {reasonSelect}
              {err && <span className="field-error" role="alert">{err}</span>}
              <div><button className="btn sm primary" onClick={saveReason} data-testid="save-delay-reason">Record delay reason</button></div>
            </>
          ) : <p className="muted-note">Use “Return for correction” so the supervisor can add the reason.</p>}
        </div>
      )}
      {s.status === 'submitted' && (
        <div style={{ marginTop: 12 }}>
          {!canVerify
            ? <Notice tone="grey">Awaiting verification by {holders(data, 'production.verify')}. Switch user in the top bar to try it.</Notice>
            : submitter === user.name
              ? <Notice tone="amber">You submitted this log, so you cannot verify it. It can be verified by {holders(data, 'production.verify', user.id)}.</Notice>
              : !reasonMissing && <Notice tone="accent">Ready to verify — submitted by {submitter ?? 'the supervisor'}.</Notice>}
        </div>
      )}
    </Panel>
    </div>
  );
}
