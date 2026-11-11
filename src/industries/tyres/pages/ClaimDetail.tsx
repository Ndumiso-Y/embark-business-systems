import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail, RegisterPage } from '../../../core/components/records';
import { CLAIM_OPEN_DAYS, DAMAGE_TYPES, TREAD_LEGAL_MIN, label } from '../data';
import { claimAge, claimOpen, damageWarrantable, dotAgeYears, dotText, proRataCredit, stockLabel, todayStr } from '../helpers';
import { RecordLink, VehicleCard } from './shared';

/** Claims register, with a line for roles that can follow claims but not process them. */
export function ClaimsPage() {
  const { can } = useUser();
  return <RegisterPage intro={can('warranty') ? undefined : <div style={{ marginBottom: 16 }}><Notice tone="grey">You can follow claims here. Logging a claim, the casing inspection and the supplier decision are done by the stock controller or branch manager (needs “Warranty claims”).</Notice></div>} />;
}

export default function ClaimDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'claims', id);
  return (
    <RecordDetail aside={c ? <Aside id={c.id} /> : undefined}>
      {c && c.status === 'logged' && <Inspect key={c.id} id={c.id} />}
      {c && c.status === 'sent' && <Decision key={c.id} id={c.id} />}
      {c && <Assessment id={c.id} />}
    </RecordDetail>
  );
}

/** Casing inspection: the two findings "Record casing inspection" needs. */
function Inspect({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const c = findRecord(data, 'claims', id)!;
  const [tread, setTread] = useState(str(c, 'treadRemaining'));
  const [dmg, setDmg] = useState(str(c, 'damageType'));
  const [err, setErr] = useState('');
  if (!can('warranty')) return <Panel title="Casing inspection"><p className="muted-note">The stock controller inspects the casing and records the findings (needs “Warranty claims”).</p></Panel>;
  const submit = () => {
    const n = Number(tread);
    if (tread === '' || !Number.isFinite(n) || n < 0 || n > 20) { setErr('Enter the tread remaining in mm (0–20).'); return; }
    if (!dmg) { setErr('Choose the damage type found on the casing.'); return; }
    act.update('claims', c.id, { treadRemaining: n, damageType: dmg });
    const res = act.transition('claims', c.id, 'inspected');
    if (!res.ok) { setErr(res.reason); return; }
    act.toast(`${c.ref}: casing inspection recorded`);
  };
  return (
    <Panel title="Casing inspection" meta="Measure the tread left and say what the damage is — that decides whether the supplier can be claimed from">
      <div className="form-grid">
        <Field label="Tread remaining (mm)" error={err || undefined}>
          <input className="input num" type="number" min={0} max={20} step={0.1} aria-label="Tread remaining (mm)" data-testid="claim-tread" value={tread} onChange={(e) => { setTread(e.target.value); setErr(''); }} />
        </Field>
        <Field label="Damage type" hint="Road hazards, punctures and run-flat damage are not manufacturing defects.">
          <select className="select" aria-label="Damage type" data-testid="claim-damage" value={dmg} onChange={(e) => { setDmg(e.target.value); setErr(''); }}>
            <option value="">Select…</option>
            {DAMAGE_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}{d.warrantable ? '' : ' (not warrantable)'}</option>)}
          </select>
        </Field>
      </div>
      <button className="btn primary sm" type="button" style={{ marginTop: 12 }} data-testid="claim-inspect" onClick={submit}>Record casing inspection</button>
    </Panel>
  );
}

/** Supplier decision: the credit percentage "Record supplier credit" needs. */
function Decision({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const c = findRecord(data, 'claims', id)!;
  const suggested = proRataCredit(c);
  const [pct, setPct] = useState(str(c, 'creditPct') || (suggested === null ? '' : String(suggested)));
  const [err, setErr] = useState('');
  if (!can('warranty')) return null;
  const submit = () => {
    const n = Number(pct);
    if (pct === '' || !Number.isFinite(n) || n < 1 || n > 100) { setErr('Enter the credit % the supplier approved (1–100).'); return; }
    act.update('claims', c.id, { creditPct: n });
    const res = act.transition('claims', c.id, 'approved');
    if (!res.ok) { setErr(res.reason); return; }
    act.toast(`${c.ref}: ${n}% supplier credit recorded`);
  };
  return (
    <Panel title="Supplier decision" meta="Typed in by hand — nothing is sent to or received from a supplier">
      <div className="toolbar" style={{ alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <Field label="Credit % approved" error={err || undefined} hint={suggested === null ? undefined : `Pro-rata suggestion: ${suggested}%`}>
          <input className="input num" type="number" min={1} max={100} step={1} aria-label="Credit % approved" data-testid="claim-credit" value={pct} onChange={(e) => { setPct(e.target.value); setErr(''); }} style={{ maxWidth: 160 }} />
        </Field>
      </div>
      <button className="btn primary sm" type="button" style={{ marginTop: 12 }} data-testid="claim-credit-submit" onClick={submit}>Record supplier credit</button>
      <p className="muted-note" style={{ marginTop: 8 }}>If the supplier refuses, use “Reject claim” in the workflow panel with their reason.</p>
    </Panel>
  );
}

function Assessment({ id }: { id: string }) {
  const data = useData();
  const c = findRecord(data, 'claims', id)!;
  const today = todayStr();
  const st = findRecord(data, 'stock', str(c, 'stock'));
  const credit = proRataCredit(c);
  const dmg = str(c, 'damageType');
  const sell = st ? Math.round(num(st, 'sell') * 100) : 0;
  return (
    <Panel title="Casing assessment" meta={`Demo pro-rata rule: usable tread above ${TREAD_LEGAL_MIN.toFixed(1)} mm as a share of the new tread depth`}>
      {claimOpen(c) && claimAge(c, today) > CLAIM_OPEN_DAYS && <div style={{ marginBottom: 12 }}><Notice tone="red">Open {claimAge(c, today)} days — chase the supplier (over {CLAIM_OPEN_DAYS} days).</Notice></div>}
      {dmg && !damageWarrantable(c) && claimOpen(c) && <div style={{ marginBottom: 12 }}><Notice tone="amber">{label(DAMAGE_TYPES, dmg)} is not a manufacturing defect. The claim cannot be sent to the supplier — reject it with a note explaining the finding.</Notice></div>}
      <KeyValues items={[
        { label: 'Tyre', value: st ? <RecordLink module="stock" record={st}>{stockLabel(st)}</RecordLink> : '' },
        { label: 'DOT on casing', value: `${dotText(str(c, 'dot'))}${dotAgeYears(str(c, 'dot'), today) !== null ? ` · ${dotAgeYears(str(c, 'dot'), today)} yrs old` : ''}` },
        { label: 'Fitted on', value: formatDate(str(c, 'purchasedOn')) },
        { label: 'Tread new → remaining', value: str(c, 'treadRemaining') !== '' ? `${num(c, 'originalTread') || 8} mm → ${num(c, 'treadRemaining')} mm` : 'Not measured yet' },
        { label: 'Damage', value: dmg ? <>{label(DAMAGE_TYPES, dmg)} {damageWarrantable(c) ? <Tag tone="green">Warrantable</Tag> : <Tag tone="red">Not warrantable</Tag>}</> : '' },
        { label: 'Suggested credit', value: credit === null ? '—' : `${credit}% ≈ ${formatRand(Math.round((sell * credit) / 100))} excl. VAT on today’s sell price` },
        { label: 'Supplier decision', value: c.status === 'approved' ? `${num(c, 'creditPct')}% credit · ${formatDate(str(c, 'decisionOn'))}` : c.status === 'rejected' ? `Rejected · ${formatDate(str(c, 'decisionOn'))}` : 'Pending' },
        { label: 'Complaint', value: str(c, 'complaint'), wide: true },
      ]} />
      <p className="muted-note" style={{ marginTop: 10 }}>Claims are not sent to any supplier or manufacturer — the decision is typed in for the demo.</p>
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const c = findRecord(data, 'claims', id)!;
  return <Panel title="Vehicle & customer"><VehicleCard data={data} vehicleId={c.values.vehicle} /></Panel>;
}
