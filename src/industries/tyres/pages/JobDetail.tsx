import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DemoRecord, Values } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, lines, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { Empty, Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { ALIGN_READINGS, ALIGN_SPEC, APPROVAL_CHANNELS, BAYS, BRANDS, CONDITIONS, POSITIONS, QC_ITEMS, SERVICES, SPARE, TECHNICIANS, TREAD_LEGAL_MIN, label, type PosKey } from '../data';
import {
  IN_BAY, alignmentProblem, approvalProblem, belowLegal, calibrationState, dotText, fittingProblem, invoiceBalance, jobFleet, jobInvoice, kmText, minText, minutesBetween, nowHm, qcMissing, quoteLines,
  replacePositions, stockForSize, stockLabel, techLabel, todayStr, torqueProblem, torqueSpec, torqueWrench, treadTone, vehicleOf, wk, REFUSAL_WORDS,
} from '../helpers';
import { LinesTable, RecordLink, VehicleCard, WheelDiagram } from './shared';

const INSPECT = ['arrived', 'inspected'];
const WORKING = ['fitting', 'balancing', 'alignment', 'torque'];
const WHEEL_FIELDS = ['tread', 'size', 'dot', 'cond', 'kpa', 'replace', 'torque'] as const;

export default function JobDetail() {
  const { id } = useParams();
  const data = useData();
  const j = findRecord(data, 'jobs', id);
  return (
    <RecordDetail aside={j ? <Aside id={j.id} /> : undefined}>
      {j && SETUP.includes(j.status ?? '') && <Setup key={`${j.id}_${str(j, 'odometer')}_${str(j, 'bay')}_${str(j, 'technician')}`} id={j.id} />}
      {j && <Wheels key={j.id} id={j.id} />}
      {j && <Quote id={j.id} />}
      {j && j.values.alignment === true && <Alignment key={`al_${j.id}`} id={j.id} />}
      {j && <TorqueQc id={j.id} />}
    </RecordDetail>
  );
}

const numIn = (v: string) => (v === '' ? '' : Number(v));
const SETUP = ['arrived', 'inspected', 'quoted', 'approved'];

/* ---------------- Arrival: odometer, bay and technician ---------------- */
/** The three things later steps are blocked on, in one small form instead of the full Edit dialog. */
function Setup({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const j = findRecord(data, 'jobs', id)!;
  const v = vehicleOf(data, j);
  const status = j.status ?? 'arrived';
  const [odo, setOdo] = useState(str(j, 'odometer'));
  const [bay, setBay] = useState(str(j, 'bay') === 'align' ? '' : str(j, 'bay'));
  const [tech, setTech] = useState(str(j, 'technician'));
  const [err, setErr] = useState('');
  const mayEdit = can('jobs.manage') || can('fitment');
  const odoEdit = INSPECT.includes(status);
  const dirty = odo !== str(j, 'odometer') || bay !== (str(j, 'bay') === 'align' ? '' : str(j, 'bay')) || tech !== str(j, 'technician');
  const last = num(v, 'odometer');
  const busy = (b: string) => records(data, 'jobs').find((x) => x.id !== j.id && str(x, 'bay') === b && IN_BAY.includes(x.status ?? ''));
  const fitBays = BAYS.filter((b) => b.value !== 'align');
  const occupants = fitBays.map((b) => busy(b.value));
  const allBusy = !IN_BAY.includes(status) && occupants.every(Boolean);
  const nearest = occupants.find((o) => o?.status === 'torque') ?? occupants.find(Boolean);
  const todo = [
    odoEdit && str(j, 'odometer') === '' ? 'the odometer reading (needed for the inspection)' : '',
    !str(j, 'technician') ? 'a technician' : '',
    !str(j, 'bay') ? 'a fitment bay' : '',
  ].filter(Boolean);
  const save = () => {
    if (odo !== '' && (!Number.isFinite(Number(odo)) || Number(odo) < 0)) { setErr('Enter the odometer reading in kilometres.'); return; }
    if (odo !== '' && Number(odo) < last) { setErr(`${kmText(Number(odo))} is below the last recorded ${kmText(last)} for ${str(v, 'reg')}. Re-check the reading.`); return; }
    act.update('jobs', j.id, { odometer: odo === '' ? '' : Number(odo), bay, technician: tech, ...(str(j, 'arrivedAt') ? {} : { arrivedAt: nowHm() }) },
      `Arrival details: ${odo === '' ? 'no odometer yet' : kmText(Number(odo))} · ${label(BAYS, bay)} · ${techLabel(tech)}`);
    act.toast('Arrival details saved');
    setErr('');
  };
  return (
    <Panel title="Arrival, bay & technician" meta="Odometer for the inspection; a free fitment bay and a technician before fitting starts">
      {mayEdit ? (
        <>
          {todo.length > 0 && <div style={{ marginBottom: 12 }}><Notice tone="amber">Still needed: {todo.join(', ')}.</Notice></div>}
          {allBusy && (
            <div style={{ marginBottom: 12 }}>
              <Notice tone="grey">
                <b>All four fitment bays are occupied right now.</b> A bay frees up when its job passes the torque check and QC{nearest ? <> — the nearest is <RecordLink module="jobs" record={nearest}>{nearest.ref}</RecordLink> in {label(BAYS, str(nearest, 'bay'))}{nearest.status === 'torque' ? ', already at the torque check' : ''}. Sign it off, then start fitting here.</> : '.'}
              </Notice>
            </div>
          )}
          <div className="form-grid">
            <Field label="Odometer (km)" error={err || undefined} hint={`Last recorded ${kmText(last)} — a lower reading is refused.`}>
              <input className="input num" type="number" min={0} step={1} aria-label="Odometer (km)" data-testid="job-odometer" disabled={!odoEdit} value={odo} placeholder="Reading in km" onChange={(e) => { setOdo(e.target.value); setErr(''); }} />
            </Field>
            <Field label="Technician">
              <select className="select" aria-label="Job technician" data-testid="job-technician" value={tech} onChange={(e) => setTech(e.target.value)}>
                <option value="">No technician yet</option>
                {TECHNICIANS.map((t) => <option key={t.value} value={t.value}>{t.label} · {t.skill}</option>)}
              </select>
            </Field>
            <Field label="Fitment bay" hint="The alignment bay is used automatically when alignment was sold.">
              <select className="select" aria-label="Fitment bay" data-testid="job-bay" value={bay} onChange={(e) => setBay(e.target.value)}>
                <option value="">No bay yet</option>
                {fitBays.map((b) => { const o = busy(b.value); return <option key={b.value} value={b.value}>{b.label}{o ? ` — occupied by ${o.ref}` : ' — free'}</option>; })}
              </select>
            </Field>
            <div style={{ alignSelf: 'center' }}><button className="btn primary sm" type="button" data-testid="save-setup" disabled={!dirty} onClick={save}>{dirty ? 'Save arrival details' : 'Saved'}</button></div>
          </div>
        </>
      ) : (
        <p className="muted-note">Odometer {str(j, 'odometer') ? kmText(num(j, 'odometer')) : 'not recorded'} · {label(BAYS, str(j, 'bay'))} · {techLabel(str(j, 'technician'))}. The counter or a fitment technician records these.</p>
      )}
    </Panel>
  );
}

/* ---------------- Signature screen: wheel positions ---------------- */
function Wheels({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const j = findRecord(data, 'jobs', id)!;
  const v = vehicleOf(data, j);
  const spec = torqueSpec(v);
  const status = j.status ?? 'arrived';
  const keys = [...POSITIONS, SPARE].flatMap((p) => WHEEL_FIELDS.map((f) => wk(p.key, f)));
  const pickVals = (r: DemoRecord) => Object.fromEntries(keys.map((k) => [k, r.values[k] ?? ''])) as Values;
  const [draft, setDraft] = useState<Values>(() => pickVals(j));
  const [sel, setSel] = useState<PosKey | null>(null);
  const inspectEdit = INSPECT.includes(status) && (can('fitment') || can('jobs.manage'));
  const torqueEdit = WORKING.includes(status) && (can('fitment') || can('qc'));
  const dirty = keys.some((k) => String(draft[k] ?? '') !== String(j.values[k] ?? ''));
  const set = (k: string, value: Values[string]) => setDraft((d) => ({ ...d, [k]: value }));
  const fillDefaults = () => {
    const d = { ...draft };
    for (const p of POSITIONS) {
      if (!d[wk(p.key, 'size')]) d[wk(p.key, 'size')] = str(v, 'tyreSize');
      if (d[wk(p.key, 'kpa')] === '') d[wk(p.key, 'kpa')] = num(v, 'pressureKpa') || '';
      if (!d[wk(p.key, 'cond')]) d[wk(p.key, 'cond')] = 'good';
    }
    setDraft(d);
  };
  const save = () => {
    const replaced = POSITIONS.filter((p) => draft[wk(p.key, 'replace')] === true).length;
    const patch: Values = { ...draft };
    if (inspectEdit && num(j, 'tyresQty') > 0 && replaced !== num(j, 'tyresQty')) patch.tyresQty = replaced;
    act.update('jobs', j.id, patch, inspectEdit ? 'Wheel inspection updated' : 'Torque values recorded');
    act.toast(inspectEdit ? 'Wheel inspection saved' : 'Torque values saved');
  };
  const completeInspection = () => {
    if (dirty) save();
    const res = act.transition('jobs', j.id, 'inspected');
    if (!res.ok) act.toast(res.reason, 'err'); else act.toast(`${j.ref}: inspection recorded — now quote the customer`);
  };
  const low = belowLegal({ ...j, values: { ...j.values, ...draft } });

  const row = (p: { key: PosKey; label: string; name: string }) => {
    const t = draft[wk(p.key, 'tread')];
    const tq = draft[wk(p.key, 'torque')];
    const tqOut = tq !== '' && tq !== undefined && (Number(tq) < spec.min || Number(tq) > spec.max);
    const tone = treadTone(t === '' || t === undefined ? null : Number(t));
    return (
      <tr key={p.key} style={sel === p.key ? { background: 'var(--accent-tint)' } : undefined} onClick={() => setSel(p.key)}>
        <td><b>{p.label}</b><small style={{ display: 'block', color: 'var(--muted-2)', fontSize: 11 }}>{p.name}</small></td>
        <td><input className="input sm num" type="number" step={0.1} min={0} max={20} aria-label={`${p.name} tread depth (mm)`} disabled={!inspectEdit} value={String(t ?? '')} onChange={(e) => set(wk(p.key, 'tread'), numIn(e.target.value))}
          style={{ borderColor: tone === 'red' ? '#c27c77' : tone === 'amber' ? '#c39550' : undefined }} /></td>
        <td><input className="input sm" aria-label={`${p.name} tyre size`} disabled={!inspectEdit} value={String(draft[wk(p.key, 'size')] ?? '')} placeholder={str(v, 'tyreSize')} onChange={(e) => set(wk(p.key, 'size'), e.target.value)} style={{ minWidth: 104 }} /></td>
        <td><input className="input sm" aria-label={`${p.name} DOT week/year`} disabled={!inspectEdit} value={String(draft[wk(p.key, 'dot')] ?? '')} placeholder="WWYY" maxLength={4} onChange={(e) => set(wk(p.key, 'dot'), e.target.value.replace(/\D/g, ''))} style={{ width: 70 }} /></td>
        <td>
          <select className="select sm" aria-label={`${p.name} condition`} disabled={!inspectEdit} value={String(draft[wk(p.key, 'cond')] ?? '')} onChange={(e) => set(wk(p.key, 'cond'), e.target.value)}>
            <option value="">—</option>{CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </td>
        <td><input className="input sm num" type="number" step={5} aria-label={`${p.name} pressure (kPa)`} disabled={!inspectEdit} value={String(draft[wk(p.key, 'kpa')] ?? '')} onChange={(e) => set(wk(p.key, 'kpa'), numIn(e.target.value))} style={{ width: 76 }} /></td>
        <td>{p.key !== 'sp' && <label className="check"><input type="checkbox" aria-label={`${p.name} quote replacement`} disabled={!inspectEdit} checked={draft[wk(p.key, 'replace')] === true} onChange={(e) => set(wk(p.key, 'replace'), e.target.checked)} /></label>}</td>
        <td>{p.key !== 'sp' && <input className="input sm num" type="number" step={1} aria-label={`${p.name} torque (Nm)`} disabled={!torqueEdit} value={String(tq ?? '')} onChange={(e) => set(wk(p.key, 'torque'), numIn(e.target.value))} style={{ width: 76, borderColor: tqOut ? '#c27c77' : undefined }} />}</td>
      </tr>
    );
  };

  return (
    <Panel title="Wheel positions" meta={`Every wheel inspected and torqued · ${str(v, 'tyreSize') || 'size —'} · torque spec ${spec.min}–${spec.max} Nm (demo)`}
      right={(inspectEdit || torqueEdit) ? (
        <>
          {inspectEdit && <button className="btn sm" type="button" onClick={fillDefaults}>Fill size & placard kPa</button>}
          <button className={`btn sm ${status === 'arrived' && can('fitment') ? '' : 'primary'}`} type="button" disabled={!dirty} onClick={save} data-testid="save-wheels">{dirty ? 'Save wheels' : 'Saved'}</button>
          {status === 'arrived' && can('fitment') && <button className="btn sm primary" type="button" onClick={completeInspection} data-testid="complete-inspection">Save & record inspection</button>}
        </>
      ) : undefined}>
      <div className="grid-2-even" style={{ marginBottom: 0, alignItems: 'start' }}>
        <WheelDiagram values={draft} spec={spec} selected={sel} onSelect={setSel} />
        <div className="stack" style={{ gap: 10 }}>
          {low.length > 0 && (
            <Notice tone="red"><b>{low.map((p) => p.label).join(', ')} below {TREAD_LEGAL_MIN.toFixed(1)} mm.</b> Demo rule: the tyre must be quoted for replacement, or the customer’s refusal recorded with a note before the quote goes out.</Notice>
          )}
          {status === 'arrived' && <Notice tone="amber">Type the tread depth for all four positions in the table below (spare optional), tick “Replace” on any tyre to quote, then “Save &amp; record inspection”. The odometer goes in the panel above.</Notice>}
          {status === 'inspected' && inspectEdit && <Notice tone="accent">Inspection recorded. Tick “Replace” on the wheels to quote and “Save wheels”, then build the quote under “Services &amp; quote”.</Notice>}
          {torqueEdit && <Notice tone="accent">Type the torque value for every wheel in the table below and press “Save wheels”. Values outside {spec.min}–{spec.max} Nm block QC.</Notice>}
          {!inspectEdit && !torqueEdit && <p className="muted-note">Inspection is recorded at arrival; torque values during the torque check. Switch to a fitment technician to edit.</p>}
          {sel && <SelectedWheel values={draft} pos={sel} />}
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="table items-table" data-testid="wheel-table">
          <thead><tr><th>Position</th><th className="num">Tread (mm)</th><th>Size</th><th>DOT</th><th>Condition</th><th className="num">kPa</th><th>Replace</th><th className="num">Torque (Nm)</th></tr></thead>
          <tbody>{[...POSITIONS, SPARE].map(row)}</tbody>
        </table>
      </div>
    </Panel>
  );
}

function SelectedWheel({ values, pos }: { values: Values; pos: PosKey }) {
  const p = [...POSITIONS, SPARE].find((x) => x.key === pos)!;
  const t = values[wk(pos, 'tread')];
  return (
    <div className="help-card" style={{ padding: 12 }}>
      <b>{p.name}</b>
      <KeyValues items={[
        { label: 'Tread', value: t === '' || t === undefined ? '' : `${Number(t).toFixed(1)} mm` },
        { label: 'DOT', value: dotText(String(values[wk(pos, 'dot')] ?? '')) },
        { label: 'Condition', value: label(CONDITIONS, values[wk(pos, 'cond')]) },
        { label: 'Pressure', value: values[wk(pos, 'kpa')] ? `${values[wk(pos, 'kpa')]} kPa` : '' },
      ]} />
    </div>
  );
}

/* ---------------- Services & quote ---------------- */
function Quote({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const base = useBase();
  const { can, hasModule } = useUser();
  const j = findRecord(data, 'jobs', id)!;
  const v = vehicleOf(data, j);
  const status = j.status ?? 'arrived';
  const editable = INSPECT.includes(status) && can('jobs.manage');
  const exact = stockForSize(data, str(v, 'tyreSize')).filter((m) => m.exact);
  const [pick, setPick] = useState(str(j, 'tyreStock') || exact[0]?.stock.id || '');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const reps = replacePositions(j);
  const unquoted = belowLegal(j).filter((p) => !reps.some((r) => r.key === p.key));
  const st = findRecord(data, 'stock', str(j, 'tyreStock'));
  const inv = jobInvoice(data, j.id);
  const quoted = lines(j);
  const shown = quoted.length ? quoted : inv ? lines(inv) : quoteLines(j, data);
  const fleet = jobFleet(data, j);

  const refuse = () => {
    if (!REFUSAL_WORDS.test(note)) { setErr('Say that the customer refused or declined the replacement, who and how (e.g. “Mr Nel declined in person — advised LF is illegal”).'); return; }
    const res = act.transition('jobs', j.id, 'quoted', note);
    if (!res.ok) { setErr(res.reason); return; }
    act.toast(`${j.ref}: quote sent with customer refusal recorded`);
    setErr(''); setNote('');
  };

  return (
    <Panel title="Services & quote" meta={quoted.length ? `Quoted${str(j, 'quotedAt') ? ` at ${str(j, 'quotedAt')}` : ''}` : 'Built from the services sold and live stock prices'}>
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 14, marginBottom: 12 }}>
        <label className="check">
          <input type="checkbox" disabled checked={num(j, 'tyresQty') > 0} /> Tyres: {num(j, 'tyresQty') || 0}
        </label>
        {SERVICES.map((s) => (
          <label className="check" key={s.key}>
            <input type="checkbox" aria-label={s.label} disabled={!editable} checked={j.values[s.key] === true}
              onChange={(e) => act.update('jobs', j.id, { [s.key]: e.target.checked }, `${s.label} ${e.target.checked ? 'added' : 'removed'}`)} /> {s.label}
          </label>
        ))}
      </div>
      {editable && (
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <select className="select sm" aria-label="Tyre to quote" value={pick} onChange={(e) => setPick(e.target.value)} style={{ width: 'auto', maxWidth: 380 }}>
            <option value="">Choose a {str(v, 'tyreSize') || ''} tyre…</option>
            {exact.map((m) => <option key={m.stock.id} value={m.stock.id}>{stockLabel(m.stock)} · {num(m.stock, 'qty')} in stock · {formatRand(Math.round(num(m.stock, 'sell') * 100))}</option>)}
          </select>
          <button className="btn sm" type="button" disabled={!pick || !reps.length} data-testid="quote-tyres"
            onClick={() => { act.update('jobs', j.id, { tyreStock: pick, tyresQty: reps.length }, `Quoted ${reps.length} × ${stockLabel(findRecord(data, 'stock', pick))} for ${reps.map((p) => p.label).join(', ')}`); act.toast('Tyres added to the quote'); }}>
            Quote for {reps.length} marked position{reps.length === 1 ? '' : 's'}
          </button>
          {hasModule('stock') && <Link className="btn sm ghost" to={`${base}/stock?size=${encodeURIComponent(str(v, 'tyreSize'))}`}>Size search →</Link>}
          {!exact.length && <span className="muted-note">No exact size in stock — see alternatives in size search.</span>}
        </div>
      )}
      {st && num(j, 'tyresQty') > 0 && (
        <p className="muted-note" style={{ marginBottom: 10 }}>
          Tyre: <RecordLink module="stock" record={st}>{stockLabel(st)}</RecordLink> · DOT {dotText(str(st, 'dot'))} · {num(st, 'qty')} in stock
          {status === 'approved' && (() => { const p = fittingProblem(j, data); return p ? <> · <Tag tone="red">{p.startsWith('Only') ? 'Short' : 'Blocked'}</Tag></> : <> · <Tag tone="green">Ready to fit</Tag></>; })()}
        </p>
      )}
      {shown.length ? <LinesTable lines={shown} /> : <Empty title="Nothing quoted yet" body="Tick the services sold and mark wheel positions for replacement." />}
      {!quoted.length && !inv && shown.length > 0 && <p className="muted-note" style={{ marginTop: 8 }}>Preview — the quote is fixed when it is sent.</p>}
      <div className="section-gap" />
      <KeyValues items={[
        { label: 'Approval', value: fleet ? `${str(fleet, 'name')} · PO ${str(j, 'fleetPo') || (fleet.values.poRequired ? 'required — not yet captured' : 'not required')}` : label(APPROVAL_CHANNELS, str(j, 'approvalChannel')) },
        { label: 'Customer refusal', value: str(j, 'refusalNote') },
      ]} />
      {status === 'inspected' && can('jobs.manage') && unquoted.length === 0 && (
        <p className="muted-note" style={{ marginTop: 12 }}><b>Next:</b> when the lines above are right, press “Send quote” in the Workflow panel at the top. The quote is then fixed and waits for approval.</p>
      )}
      {status === 'quoted' && can('jobs.manage') && <Approve key={`${j.id}_${str(j, 'fleetPo')}_${str(j, 'approvalChannel')}`} id={j.id} />}
      {status === 'inspected' && unquoted.length > 0 && can('jobs.manage') && (
        <div style={{ marginTop: 14 }}>
          <Notice tone="red"><b>Below-legal tyre not quoted:</b> {unquoted.map((p) => p.label).join(', ')}. Either mark it for replacement above, or send the quote with the customer’s refusal recorded.</Notice>
          <Field label="Customer refusal note" error={err || undefined} hint="Recorded on the job history and printed on the invoice copy (simulated).">
            <textarea className="textarea" aria-label="Customer refusal note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer declined LF replacement in person — advised it is below the legal minimum." />
          </Field>
          <button className="btn sm danger" type="button" style={{ marginTop: 8 }} onClick={refuse} data-testid="quote-with-refusal">Quote with customer refusal</button>
        </div>
      )}
    </Panel>
  );
}

/** Focused approval: how a retail customer approved, or the fleet purchase order number. */
function Approve({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const j = findRecord(data, 'jobs', id)!;
  const fleet = jobFleet(data, j);
  const needsPo = !!fleet?.values.poRequired;
  const [channel, setChannel] = useState(str(j, 'approvalChannel'));
  const [po, setPo] = useState(str(j, 'fleetPo'));
  const [err, setErr] = useState('');
  const submit = () => {
    const before = { approvalChannel: str(j, 'approvalChannel'), fleetPo: str(j, 'fleetPo') };
    const next = { approvalChannel: channel, fleetPo: po.trim() };
    const problem = approvalProblem({ ...j, values: { ...j.values, ...next } }, data);
    if (problem) { setErr(problem); return; }
    act.update('jobs', j.id, next);
    const res = act.transition('jobs', j.id, 'approved');
    if (!res.ok) { act.update('jobs', j.id, before); setErr(res.reason); return; }
    act.toast(`${j.ref}: approval recorded${needsPo ? ` — PO ${po.trim()}` : ` (${label(APPROVAL_CHANNELS, channel)})`}`);
  };
  return (
    <div style={{ marginTop: 14 }} data-testid="approve-quote">
      <Notice tone="amber">
        <b>Waiting for approval.</b> {fleet ? (needsPo ? `${str(fleet, 'name')} needs a purchase order number on every job — no PO, no work.` : `Record how ${str(fleet, 'name')}’s fleet manager approved.`) : 'Record how the customer approved before any tyre is fitted.'}
      </Notice>
      <div className="form-grid" style={{ marginTop: 10 }}>
        {needsPo && (
          <Field label="Fleet PO number" hint="Fictional, e.g. PO-DEMO-1042. Carried onto the invoice.">
            <input className="input" aria-label="Fleet PO number" data-testid="approve-po" value={po} placeholder="PO-DEMO-…" onChange={(e) => { setPo(e.target.value); setErr(''); }} />
          </Field>
        )}
        <Field label={needsPo ? 'Approval channel (optional)' : 'Approval channel'}>
          <select className="select" aria-label="Approval channel" data-testid="approve-channel" value={channel} onChange={(e) => { setChannel(e.target.value); setErr(''); }}>
            <option value="">Select how they approved…</option>
            {APPROVAL_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      {err && <p className="field-error" role="alert" style={{ marginTop: 8 }}>{err}</p>}
      <button className="btn primary sm" type="button" style={{ marginTop: 10 }} data-testid="approve-submit" onClick={submit}>Record approval</button>
    </div>
  );
}

/* ---------------- Alignment ---------------- */
function Alignment({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const j = findRecord(data, 'jobs', id)!;
  const keys = ALIGN_READINGS.flatMap((r) => [`al_before_${r.key}`, `al_after_${r.key}`]);
  const [draft, setDraft] = useState<Values>(() => Object.fromEntries(keys.map((k) => [k, j.values[k] ?? ''])));
  const editable = j.status === 'alignment' && can('alignment');
  const dirty = keys.some((k) => String(draft[k] ?? '') !== String(j.values[k] ?? ''));
  const problem = alignmentProblem({ ...j, values: { ...j.values, ...draft } });
  const out = (kind: 'toe' | 'camber', v: unknown) => v !== '' && v !== undefined && (Number(v) < ALIGN_SPEC[kind].min || Number(v) > ALIGN_SPEC[kind].max);
  return (
    <Panel title="Alignment readings" meta={`Before and after adjustment · tolerance toe ${ALIGN_SPEC.toe.min} to +${ALIGN_SPEC.toe.max} mm, camber ${ALIGN_SPEC.camber.min}° to +${ALIGN_SPEC.camber.max}° (demo)`}
      right={editable ? <button className="btn sm primary" type="button" disabled={!dirty} onClick={() => { act.update('jobs', j.id, draft, 'Alignment readings recorded'); act.toast('Alignment readings saved'); }}>{dirty ? 'Save readings' : 'Saved'}</button> : undefined}>
      <div className="table-wrap">
        <table className="table items-table" data-testid="alignment-table">
          <thead><tr><th>Reading</th><th className="num">Before</th><th className="num">After</th><th /></tr></thead>
          <tbody>
            {ALIGN_READINGS.map((r) => (
              <tr key={r.key}>
                <td><b>{r.label}</b> <small style={{ color: 'var(--muted-2)' }}>({ALIGN_SPEC[r.kind].unit})</small></td>
                {(['before', 'after'] as const).map((w) => (
                  <td key={w}><input className="input sm num" type="number" step={0.1} aria-label={`${r.label} ${w}`} disabled={!editable} value={String(draft[`al_${w}_${r.key}`] ?? '')}
                    onChange={(e) => setDraft((d) => ({ ...d, [`al_${w}_${r.key}`]: numIn(e.target.value) }))} style={{ width: 90, borderColor: w === 'after' && out(r.kind, draft[`al_after_${r.key}`]) ? '#c27c77' : undefined }} /></td>
                ))}
                <td>{out(r.kind, draft[`al_after_${r.key}`]) ? <Tag tone="red">Out of tolerance</Tag> : draft[`al_after_${r.key}`] !== '' ? <Tag tone="green">In tolerance</Tag> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {['alignment', 'balancing', 'fitting'].includes(j.status ?? '') && problem && <p className="muted-note" style={{ marginTop: 8 }}>{problem}</p>}
      <p className="muted-note" style={{ marginTop: 8 }}>Readings are typed in by hand — no alignment-machine integration in this demo.</p>
    </Panel>
  );
}

/* ---------------- Torque check & QC ---------------- */
function TorqueQc({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const base = useBase();
  const { can, hasModule } = useUser();
  const j = findRecord(data, 'jobs', id)!;
  const today = todayStr();
  const status = j.status ?? '';
  if (!WORKING.includes(status) && !['ready', 'collected', 'approved'].includes(status)) return null;
  const w = torqueWrench(j, data, today);
  const tp = torqueProblem(j, data, today);
  const qcEdit = status === 'torque' && can('qc');
  const missing = qcMissing(j);
  const done = ['ready', 'collected'].includes(status);
  const used = findRecord(data, 'tools', str(j, 'torqueTool'));
  return (
    <Panel title="Torque check & QC" meta="A calibrated torque wrench checked out to the technician, every wheel inside spec, then the QC sign-off">
      {done ? (
        <Notice tone="accent">Torqued with <b>{str(j, 'torqueToolAsset') || '—'}</b>{used ? <> (<RecordLink module="tools" record={used}>{used.ref}</RecordLink>)</> : null} by {techLabel(str(j, 'technician'))}. Wheels {POSITIONS.map((p) => `${p.label} ${str(j, wk(p.key, 'torque')) || '—'}`).join(' · ')} Nm.</Notice>
      ) : w.wrench ? (
        <Notice tone="accent">
          <b>{str(w.wrench, 'assetNo')}</b> checked out to {techLabel(str(j, 'technician'))} · range {num(w.wrench, 'rangeMin')}–{num(w.wrench, 'rangeMax')} Nm · calibration {calibrationState(w.wrench, today) === 'due' ? 'due' : 'valid'} until {formatDate(str(w.wrench, 'calibrationDue'))}.
        </Notice>
      ) : (
        <Notice tone="red"><b>Torque check blocked:</b> {w.problem} {hasModule('tools') && <Link to={`${base}/tools`}>Open the tool board →</Link>}</Notice>
      )}
      {status === 'torque' && tp && !tp.startsWith('No torque') && !tp.startsWith('Torque wrench') && <p className="muted-note" style={{ marginTop: 8 }}>{tp}</p>}
      {(status === 'torque' || done) && (
        <ul className="list" data-testid="qc-checklist" style={{ marginTop: 12 }}>
          {QC_ITEMS.map((i) => (
            <li key={i.key}>
              <label className="check">
                <input type="checkbox" checked={j.values[i.key] === true} disabled={!qcEdit}
                  onChange={(e) => act.update('jobs', j.id, { [i.key]: e.target.checked }, `QC: ${i.label} ${e.target.checked ? 'ticked' : 'unticked'}`)} />
                {i.label}
              </label>
            </li>
          ))}
        </ul>
      )}
      {status === 'torque' && missing.length > 0 && <p className="muted-note" style={{ marginTop: 8 }}>{missing.length} QC item(s) outstanding — only a user with the QC permission can tick them and pass the job.</p>}
    </Panel>
  );
}

/* ---------------- Aside ---------------- */
function Aside({ id }: { id: string }) {
  const data = useData();
  const { hasModule } = useUser();
  const j = findRecord(data, 'jobs', id)!;
  const inv = jobInvoice(data, j.id);
  const fleet = jobFleet(data, j);
  const st = findRecord(data, 'stock', str(j, 'tyreStock'));
  const total = minutesBetween(str(j, 'arrivedAt'), str(j, 'readyAt'));
  const steps: Array<[string, string]> = [['Arrived', 'arrivedAt'], ['Quoted', 'quotedAt'], ['Approved', 'approvedAt'], ['Fitting started', 'startedAt'], ['Ready', 'readyAt'], ['Collected', 'collectedAt']];
  return (
    <>
      <Panel title="Vehicle & customer"><VehicleCard data={data} vehicleId={j.values.vehicle} /></Panel>
      <Panel title="Time on site" meta={`${formatDate(str(j, 'workDate'))} · ${label(BAYS, str(j, 'bay'))} · ${techLabel(str(j, 'technician'))}`}>
        <ul className="list">
          {steps.filter(([, k]) => str(j, k)).map(([l, k]) => <li key={k}><span className="time-chip">{str(j, k)}</span><div className="grow">{l}</div></li>)}
        </ul>
        <p className="muted-note" style={{ marginTop: 8 }}>{total !== null ? <>Arrival to ready: <b>{minText(total)}</b>{total > 60 ? ' — over the one-hour target' : ''}</> : 'Target: ready within an hour of arrival.'}</p>
      </Panel>
      {fleet && (
        <Panel title="Fleet account">
          <p className="muted-note"><RecordLink module="fleets" record={fleet}>{str(fleet, 'name')}</RecordLink> · {fleet.values.poRequired ? 'PO required' : 'no PO needed'} · PO {str(j, 'fleetPo') || '—'}</p>
        </Panel>
      )}
      <Panel title="Invoice">
        {inv ? (
          <p className="muted-note"><RecordLink module="invoices" record={inv}><b>{inv.ref}</b></RecordLink> · issued {formatDate(str(inv, 'issuedOn'))} · balance {formatRand(invoiceBalance(inv))} · {inv.status === 'onaccount' ? 'on fleet account' : inv.status}
            {inv.status === 'issued' && j.status === 'ready' && !hasModule('invoices') && <><br />The counter takes payment (or puts a fleet invoice on account) before hand-over.</>}
            {inv.status === 'issued' && j.status === 'ready' && hasModule('invoices') && <><br /><RecordLink module="invoices" record={inv}><span className="btn sm" style={{ marginTop: 10 }} data-testid="open-invoice">{fleet ? `Put ${inv.ref} on the fleet account →` : `Record payment on ${inv.ref} →`}</span></RecordLink></>}</p>
        ) : <p className="muted-note">Raised automatically from the quote when the job passes QC.</p>}
      </Panel>
      {st && <p className="muted-note">Stock line {st.ref} · {label(BRANDS, str(st, 'brand'))} · {num(st, 'qty')} on hand.</p>}
    </>
  );
}
