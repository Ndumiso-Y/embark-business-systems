import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { O2_MAX, O2_MIN } from '../data';
import { contractorClearance, contractorName, gasTestProblem, permitExpired, todayStr } from '../helpers';
import { Check } from './shared';
import { holders } from '../helpers';

export default function PermitDetail() {
  const { id } = useParams();
  const data = useData();
  const p = findRecord(data, 'permits', id);
  return <RecordDetail aside={p ? <Checks key={p.id} id={p.id} /> : undefined} />;
}

function Checks({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { user, can, hasModule } = useUser();
  const today = todayStr();
  const p = findRecord(data, 'permits', id)!;
  const confined = str(p, 'type') === 'confined';
  const gas = confined ? gasTestProblem(p.values.gasO2) : null;
  const expired = permitExpired(p, today);
  const c = findRecord(data, 'contractors', str(p, 'contractor'));
  const clearance = c ? contractorClearance(c, today) : null;
  const isolated = p.values.isolationConfirmed === true;
  // Checks can still be completed before the permit goes (back) to active.
  const pending = ['requested', 'approved', 'suspended'].includes(p.status ?? '');
  const mayRecord = can('permits.request');

  const [points, setPoints] = useState(() => str(p, 'isolationPoints'));
  const [o2, setO2] = useState('');
  const [tester, setTester] = useState(() => str(p, 'gasTestedBy') || user.name);
  const [isoErr, setIsoErr] = useState('');
  const [gasErr, setGasErr] = useState('');

  const confirmIsolation = () => {
    if (!points.trim()) { setIsoErr('List the isolation points and lock numbers first.'); return; }
    act.update('permits', id, { isolationConfirmed: true, isolationPoints: points.trim() }, 'Isolation & lock-out confirmed');
    act.toast(`${p.ref}: isolation confirmed`);
    setIsoErr('');
  };
  const recordGas = () => {
    const n = Number(o2);
    if (o2 === '' || !Number.isFinite(n) || n < 0 || n > 30) { setGasErr('Enter the oxygen reading as a percentage (0–30).'); return; }
    if (!tester.trim()) { setGasErr('Record who did the gas test.'); return; }
    act.update('permits', id, { gasO2: n, gasTestedBy: tester.trim() }, `Gas test recorded: O₂ ${n} %`);
    const problem = gasTestProblem(n);
    act.toast(problem ?? `${p.ref}: gas test passed (O₂ ${n} %)`, problem ? 'err' : 'ok');
    setGasErr(''); setO2('');
  };

  return (
    <>
      <Panel title="Activation checks" meta="Evaluated live — the same rules block “Activate permit”">
        <ul className="list" data-testid="permit-checks">
          <Check ok={isolated} label="Isolation & lock-out confirmed" detail={str(p, 'isolationPoints') || 'No isolation points recorded'} />
          <Check ok={confined ? !gas : null} label={`Gas test — oxygen ${O2_MIN}–${O2_MAX} %`}
            detail={confined ? (gas ?? `O₂ ${num(p, 'gasO2')} % · tested by ${str(p, 'gasTestedBy') || '—'}`) : 'Only required for confined-space entry'} />
          <Check ok={!expired} label="Within validity" detail={`${formatDate(str(p, 'validFrom'))} → ${formatDate(str(p, 'validTo'))} ${str(p, 'expiresAt')}`} />
          <Check ok={clearance ? clearance.cleared : null} label="Contractor cleared for site"
            detail={c ? <>{hasModule('contractors') ? <Link to={`${base}/contractors/${c.id}`}>{contractorName(c)}</Link> : contractorName(c)}{clearance && !clearance.cleared ? ` — ${clearance.reasons.join('; ')}. Renew on the contractor’s record.` : ''}</> : 'Own employees — no contractor linked'} />
        </ul>
        {p.status === 'active' && expired && <div style={{ marginTop: 12 }}><Notice tone="red">This permit is still active after its expiry time. Close it, or suspend the work and raise a new permit.</Notice></div>}
        {pending && expired && <div style={{ marginTop: 12 }}><Notice tone="amber">The validity has passed. Use “Edit” to extend the dates, or cancel this permit and request a new one.</Notice></div>}
      </Panel>

      {pending && !isolated && (
        <Panel title="Confirm isolation" meta="Done at the workplace before the permit goes active">
          {mayRecord ? (
            <>
              <Field label="Isolation points / lock numbers" error={isoErr || undefined}>
                <textarea className="textarea" aria-label="Isolation points and lock numbers" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="e.g. Feeder 3 racked out, lock 12. Tested dead." />
              </Field>
              <button className="btn sm primary" style={{ marginTop: 10 }} onClick={confirmIsolation} data-testid="confirm-isolation">Confirm isolation &amp; lock-out</button>
            </>
          ) : <p className="muted-note">Isolation is confirmed by {holders(data, 'permits.request')}.</p>}
        </Panel>
      )}

      {pending && confined && (
        <Panel title="Pre-entry gas test" meta={`Oxygen must read ${O2_MIN}–${O2_MAX} % (demo band) — typed in, no gas monitor is connected`}>
          {mayRecord ? (
            <>
              <div className="form-grid">
                <Field label="Oxygen reading (%)" error={gasErr || undefined}>
                  <input className="input num" type="number" min={0} max={30} step={0.1} aria-label="Oxygen reading" value={o2} onChange={(e) => setO2(e.target.value)} placeholder={str(p, 'gasO2') ? `last: ${str(p, 'gasO2')}` : 'e.g. 20.9'} />
                </Field>
                <Field label="Tested by">
                  <input className="input" aria-label="Gas tested by" value={tester} onChange={(e) => setTester(e.target.value)} />
                </Field>
              </div>
              <button className="btn sm primary" style={{ marginTop: 10 }} onClick={recordGas} data-testid="record-gas-test">{str(p, 'gasO2') ? 'Record re-test' : 'Record gas test'}</button>
            </>
          ) : <p className="muted-note">Gas tests are recorded by {holders(data, 'permits.request')}.</p>}
        </Panel>
      )}

      <Notice tone="grey">Demonstration only. This is not a real permit to work and must never be used to authorise work. The oxygen band is a demo rule, not a regulatory limit.</Notice>
    </>
  );
}
