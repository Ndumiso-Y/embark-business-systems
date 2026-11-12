import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, permissionHint, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Field, KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { APPROVAL_GLA, BILLED_LEASE, CREDIT_CHECK, DEPOSIT_TYPES, RENT_TO_SALES_RISK, label } from '../data';
import {
  breakpoint, cooProblem, doubleLetProblem, escalatedRate, escalationState, fitoutOf, glaOf, hotProblems, insuranceOnFile, invoiceTotals, latestFigure, leaseArrears, leaseInvoices, leaseUnit,
  monthlyBaseRent, monthlyCharges, needsApproval, nextEscalation, overdueDays, periodLabel, rand, randOf, randRound, rentToSales, shopLabel, thousands, todayStr, tradingDensity, tradingProblems,
} from '../helpers';
import { Checklist, MallStyles, ModButton, RecLink, TenantCard } from './shared';

export default function LeaseDetail() {
  const { id } = useParams();
  const data = useData();
  const l = findRecord(data, 'leases', id);
  return (
    <RecordDetail aside={l ? <Aside id={l.id} /> : undefined}>
      {l && <Main key={l.id} id={l.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const l = findRecord(data, 'leases', id)!;
  const unit = leaseUnit(data, l);
  const gla = glaOf(data, l);
  const charges = monthlyCharges(l, gla);
  const base = monthlyBaseRent(data, l);
  const pct = num(l, 'turnoverPct');
  const manage = can('leases.manage');
  const status = l.status ?? '';
  const esc = escalationState(l, today);
  const next = nextEscalation(l);
  const newRate = escalatedRate(num(l, 'baseRent'), num(l, 'escalationPct'));
  const fit = fitoutOf(data, id);
  const fitDef = config.collections.find((c) => c.key === 'fitouts')!;
  const arrears = leaseArrears(data, id, today);

  const applyEscalation = () => {
    act.update('leases', id, { baseRent: newRate, lastEscalated: next }, `Escalation of ${num(l, 'escalationPct')}% applied for ${formatDate(next)}: ${randOf(num(l, 'baseRent'))} → ${randOf(newRate)} per m²`);
    act.toast(`${l.ref}: base rent raised ${num(l, 'escalationPct')}% to ${randOf(newRate)} per m² — the next invoice uses the new rate`);
  };
  const setCredit = (outcome: 'approved' | 'declined') => {
    act.update('leases', id, { creditCheck: outcome }, `Credit check recorded: ${outcome} (simulated — no bureau contacted)`);
    act.toast(outcome === 'approved' ? `${l.ref}: credit check approved` : `${l.ref}: credit check declined — decline the application`, outcome === 'approved' ? 'ok' : 'info');
  };

  return (
    <>
      <MallStyles />
      <Panel title="Rent & charges" meta={`${shopLabel(unit)} · ${thousands(gla)} m² GLA · amounts exclude VAT`} right={esc ? <Tag tone={esc === 'overdue' ? 'red' : 'blue'}>Escalation {esc === 'overdue' ? 'overdue' : 'due this month'}</Tag> : undefined}>
        <div className="mini-stat-row">
          <div>Base rent<b>{randOf(num(l, 'baseRent'))}/m²</b></div>
          <div>Monthly base rent<b>{rand(charges.base)}</b></div>
          <div>Operating costs<b>{rand(charges.ops)}</b></div>
          <div>Marketing levy<b>{rand(charges.levy)}</b></div>
          <div>Monthly total<b>{rand(charges.total)}</b></div>
        </div>
        <p className="muted-note" style={{ marginTop: 12 }}>
          {pct > 0
            ? <>Turnover rent: {pct}% of the month’s verified turnover, less the base rent, when that is positive. It starts above a turnover of {randRound(breakpoint(base, pct))} a month (the natural breakpoint — a demo formula).</>
            : 'No turnover clause on this lease.'}
        </p>
        {BILLED_LEASE.includes(status) && num(l, 'escalationPct') > 0 && (
          <div className="btns" style={{ marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }} data-testid="escalation">
            <span className="muted-note">Annual escalation {num(l, 'escalationPct')}% on the anniversary of the lease start. Next: {formatDate(next)} — {randOf(num(l, 'baseRent'))} → <b>{randOf(newRate)}</b> per m².</span>
            {esc && manage && <button className="btn sm primary" onClick={applyEscalation} data-testid="apply-escalation">Apply escalation</button>}
            {esc && !manage && <small className="muted-note">{permissionHint(config, data, 'leases.manage')}</small>}
          </div>
        )}
      </Panel>

      {(status === 'application' || status === 'hot') && <Terms id={id} />}

      {status === 'application' && (
        <Panel title="Before heads of terms" meta="Checked by “Agree heads of terms” — everything can be fixed on this screen">
          <Checklist items={[
            { label: 'The unit is free', ok: !!unit && !doubleLetProblem(data, l), detail: unit ? (doubleLetProblem(data, l) ?? `${shopLabel(unit)} has no other active lease`) : 'No unit chosen yet' },
            { label: 'Credit check approved (simulated)', ok: str(l, 'creditCheck') === 'approved', detail: `${label(CREDIT_CHECK, str(l, 'creditCheck') || 'pending')} · no credit bureau is contacted`,
              action: manage ? (
                <span className="btns">
                  {str(l, 'creditCheck') !== 'approved' && <button className="btn sm" data-testid="credit-approved" onClick={() => setCredit('approved')}>Record: approved</button>}
                  {str(l, 'creditCheck') !== 'declined' && <button className="btn sm" data-testid="credit-declined" onClick={() => setCredit('declined')}>Record: declined</button>}
                </span>
              ) : undefined },
            ...(needsApproval(data, l) ? [{ label: `Leasing manager’s approval (over ${APPROVAL_GLA} m²)`, ok: !!str(l, 'approvedBy'), detail: str(l, 'approvedBy') ? `Approved by ${str(l, 'approvedBy')}` : `${thousands(gla)} m² is above the ${APPROVAL_GLA} m² limit (demo rule)`,
              action: !str(l, 'approvedBy') && can('leases.approve')
                ? <button className="btn sm primary" data-testid="approve-letting" onClick={() => { const who = data.users.find((u) => u.id === data.currentUserId)?.name ?? 'Leasing manager'; act.update('leases', id, { approvedBy: who }, `Letting of ${thousands(gla)} m² approved`); act.toast(`${l.ref}: letting approved by ${who}`); }}>Approve letting</button>
                : undefined }] : []),
            { label: 'Rent and lease dates captured', ok: !hotProblems(data, l).some((p) => /Commercial terms/.test(p)), detail: `${randOf(num(l, 'baseRent'))}/m² · ${formatDate(str(l, 'startDate'))} – ${formatDate(str(l, 'endDate'))}` },
          ]} />
          {needsApproval(data, l) && !str(l, 'approvedBy') && !can('leases.approve') && <p className="muted-note" style={{ marginTop: 10 }} data-testid="approval-hint">{permissionHint(config, data, 'leases.approve')} The approval button appears here for them.</p>}
          {!manage && <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'leases.manage')}</p>}
        </Panel>
      )}

      {status === 'hot' && <Security id={id} />}

      {status === 'signed' && (
        <Notice tone="accent">The lease is signed. “Hand over for fit-out” opens a fit-out project for the tenant’s contractor and turns {shopLabel(unit)} to “fit-out” on the stacking plan.</Notice>
      )}

      {status === 'fitout' && <BeforeTrading id={id} />}

      {status === 'renewal' && <Renewal id={id} />}

      {BILLED_LEASE.includes(status) && arrears.overdue > 0 && (
        <Notice tone="red">
          <b>In arrears:</b> {rand(arrears.overdue)} overdue, the oldest invoice by {arrears.oldest} days. Follow-up steps are logged under <RecLink module="arrears">Arrears & credit control</RecLink>; payments are recorded on the invoices. Interest on arrears is not calculated in this demo.
        </Notice>
      )}

      {fit && status !== 'fitout' && (
        <Panel title="Fit-out" right={<StatusTag workflow={fitDef.workflow} status={fit.status} />}>
          <p className="muted-note"><RecLink module="fitouts" id={fit.id}>{fit.ref}</RecLink>{str(fit, 'contractor') ? ` · ${str(fit, 'contractor')}` : ''}{str(fit, 'signedOffOn') ? ` · signed off ${formatDate(str(fit, 'signedOffOn'))}` : ''}</p>
        </Panel>
      )}
    </>
  );

}

/** Fit-out sign-off, certificate of occupancy and tenant insurance — what “Start trading” checks. */
function BeforeTrading({ id: leaseId }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const l = findRecord(data, 'leases', leaseId)!;
  const manage = can('leases.manage');
  const fit = fitoutOf(data, leaseId);
  const fitDef = config.collections.find((c) => c.key === 'fitouts')!;
  const [coo, setCoo] = useState(str(l, 'cooNumber'));
  const [ins, setIns] = useState(str(l, 'insuranceExpiry'));
  const problems = tradingProblems(data, l, today);
  return (
    <Panel title="Before the shop can trade" meta="Checked by “Start trading” — a shop never opens without all three" right={<Tag tone={problems.length ? 'red' : 'green'}>{problems.length ? `${problems.length} outstanding` : 'Ready to trade'}</Tag>}>
      <Checklist items={[
        { label: 'Fit-out signed off', ok: fit?.status === 'signedoff', detail: fit ? <>{fit.ref} · {fitDef.workflow?.states.find((s) => s.key === fit.status)?.label}{str(fit, 'signedOffOn') ? ` on ${formatDate(str(fit, 'signedOffOn'))}` : ' — sign-off is done on the fit-out project by the operations manager'}</> : 'No fit-out project yet',
          action: fit ? <ModButton module="fitouts" id={fit.id} testid="open-fitout">Open {fit.ref}</ModButton> : undefined },
        { label: 'Certificate of occupancy number', ok: !cooProblem(str(l, 'cooNumber')), detail: str(l, 'cooNumber') || 'Not recorded — fictional numbers start with DEMO-COO-',
          action: manage ? (
            <span className="mall-inline">
              <input className="input sm" style={{ width: 150 }} aria-label="Certificate of occupancy number" placeholder="DEMO-COO-0412" value={coo} onChange={(e) => setCoo(e.target.value)} data-testid="coo-number" />
              <button className="btn sm" data-testid="save-coo" onClick={() => { const p = cooProblem(coo); if (p) return act.toast(p, 'err'); act.update('leases', leaseId, { cooNumber: coo.trim() }, `Certificate of occupancy ${coo.trim()} recorded`); act.toast(`${l.ref}: certificate of occupancy recorded`); }}>Save</button>
            </span>
          ) : undefined },
        { label: 'Tenant insurance on file', ok: insuranceOnFile(l, today), detail: str(l, 'insuranceExpiry') ? `Cover valid until ${formatDate(str(l, 'insuranceExpiry'))}${insuranceOnFile(l, today) ? '' : ' — expired'}` : 'No cover recorded — type the expiry date from the tenant’s certificate',
          action: manage ? (
            <span className="mall-inline">
              <input className="input sm" type="date" style={{ width: 150 }} aria-label="Tenant insurance valid until" value={ins} min={today} onChange={(e) => setIns(e.target.value)} data-testid="insurance-expiry" />
              <button className="btn sm" data-testid="save-insurance" onClick={() => { if (!ins || ins < today) return act.toast('Type an expiry date that is today or later — expired cover does not count.', 'err'); act.update('leases', leaseId, { insuranceExpiry: ins }, `Tenant insurance on file, valid until ${formatDate(ins)}`); act.toast(`${l.ref}: tenant insurance recorded`); }}>Save</button>
            </span>
          ) : undefined },
      ]} />
      {!manage && <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'leases.manage')}</p>}
    </Panel>
  );
}

/** Base rent, percentages and dates for a lease that is not signed yet. */
function Terms({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const l = findRecord(data, 'leases', id)!;
  const editable = can('leases.manage');
  const [draft, setDraft] = useState<Values | null>(null);
  const v: Values = { unit: str(l, 'unit'), baseRent: l.values.baseRent, escalationPct: l.values.escalationPct, turnoverPct: l.values.turnoverPct, startDate: str(l, 'startDate'), endDate: str(l, 'endDate'), ...(draft ?? {}) };
  // Until heads of terms the application can be moved to another vacant unit (for example when its first choice is taken).
  const choices = records(data, 'units').filter((u) => u.id === str(l, 'unit') || u.status === 'vacant').sort((a, b) => str(a, 'shop').localeCompare(str(b, 'shop'), undefined, { numeric: true }));
  const set = (k: string, value: string) => setDraft({ ...(draft ?? {}), [k]: value });
  const numInput = (k: string, lbl: string, step: string) => (
    <Field label={lbl}><input className="input num" type="number" min={0} step={step} aria-label={lbl} disabled={!editable} value={String(v[k] ?? '')} onChange={(e) => set(k, e.target.value)} data-testid={`terms-${k}`} /></Field>
  );
  const save = () => {
    if (!draft) return;
    const out: Values = { ...draft };
    for (const k of ['baseRent', 'escalationPct', 'turnoverPct']) if (k in out) out[k] = Number(out[k]) || 0;
    if (String(v.endDate) <= String(v.startDate)) return act.toast('The lease must end after it starts.', 'err');
    act.update('leases', id, out, 'Commercial terms updated');
    act.toast(`${l.ref}: commercial terms saved`);
    setDraft(null);
  };
  return (
    <Panel title="Commercial terms" meta={`For ${shopLabel(leaseUnit(data, l))} · can be changed until the lease is signed`}>
      <div className="form-grid">
        {l.status === 'application' && (
          <div className="span-2"><Field label="Unit">
            <select className="select" aria-label="Unit for this application" disabled={!editable} value={String(v.unit ?? '')} onChange={(e) => set('unit', e.target.value)} data-testid="terms-unit">
              {choices.map((u) => <option key={u.id} value={u.id}>{shopLabel(u)} · {num(u, 'gla')} m² · asking {randOf(num(u, 'askingRent'))}/m²{u.status !== 'vacant' ? ' · no longer vacant' : ''}</option>)}
            </select>
          </Field></div>
        )}
        {numInput('baseRent', 'Base rent per m² per month', '0.01')}
        {numInput('escalationPct', 'Annual escalation %', '0.5')}
        {numInput('turnoverPct', 'Turnover rent % (0 = none)', '0.25')}
        <Field label="Lease start"><input className="input" type="date" aria-label="Lease start" disabled={!editable} value={String(v.startDate ?? '')} onChange={(e) => set('startDate', e.target.value)} /></Field>
        <Field label="Lease end"><input className="input" type="date" aria-label="Lease end" disabled={!editable} value={String(v.endDate ?? '')} onChange={(e) => set('endDate', e.target.value)} /></Field>
        {editable && <div style={{ alignSelf: 'end' }}><button className="btn" disabled={!draft} onClick={save} data-testid="save-terms">Save terms</button></div>}
      </div>
    </Panel>
  );
}

/** Deposit or bank guarantee and FICA — what “Lease signed” checks. */
function Security({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const l = findRecord(data, 'leases', id)!;
  const manage = can('leases.manage');
  const suggested = Math.round((monthlyBaseRent(data, l) * 2) / 500) * 500;
  const [type, setType] = useState(str(l, 'depositType') || 'cash');
  const [amount, setAmount] = useState(String(num(l, 'depositAmount') || suggested));
  const received = l.values.depositReceived === true && num(l, 'depositAmount') > 0;
  const record = () => {
    if (!(Number(amount) > 0)) return act.toast('Type the amount of the deposit or guarantee.', 'err');
    const ref = `DEMO-${type === 'guarantee' ? 'BG' : 'DEP'}-${l.ref.slice(-4)}`;
    act.update('leases', id, { depositType: type, depositAmount: Number(amount), depositRef: ref, depositReceived: true }, `${label(DEPOSIT_TYPES, type)} of ${randOf(Number(amount))} recorded as received (${ref}, simulated)`);
    act.toast(`${l.ref}: ${label(DEPOSIT_TYPES, type).toLowerCase()} recorded`);
  };
  return (
    <Panel title="Before the lease can be signed" meta="Checked by “Lease signed” · deposits, guarantees and FICA checks are simulated ticks">
      <Checklist items={[
        { label: 'Deposit or bank guarantee received', ok: received, detail: received ? `${label(DEPOSIT_TYPES, str(l, 'depositType'))} of ${randOf(num(l, 'depositAmount'))} · ${str(l, 'depositRef')}` : `Usually two months’ base rent (${randOf(suggested)}) — a figure only, no bank is involved`,
          action: manage && !received ? (
            <span className="mall-inline">
              <select className="select sm" style={{ width: 150 }} aria-label="Security type" value={type} onChange={(e) => setType(e.target.value)} data-testid="deposit-type">{DEPOSIT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              <input className="input sm num" type="number" min={0} step="500" style={{ width: 120 }} aria-label="Deposit or guarantee amount" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="deposit-amount" />
              <button className="btn sm" onClick={record} data-testid="record-deposit">Record as received</button>
            </span>
          ) : undefined },
        { label: 'Tenant FICA documents verified (simulated)', ok: l.values.fica === true, detail: 'Identity, company registration and proof of address seen — a tick only, not FICA compliance',
          action: manage && l.values.fica !== true ? <button className="btn sm" data-testid="fica-verified" onClick={() => { act.update('leases', id, { fica: true }, 'FICA documents marked as verified (simulated)'); act.toast(`${l.ref}: FICA marked as verified`); }}>Mark as verified</button> : undefined },
      ]} />
      {!manage && <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'leases.manage')}</p>}
    </Panel>
  );
}

/** New end date and rent — what “Renew lease” checks. */
function Renewal({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const l = findRecord(data, 'leases', id)!;
  const manage = can('leases.manage');
  const [end, setEnd] = useState(str(l, 'renewEnd'));
  const [rent, setRent] = useState(String(num(l, 'renewRent') || num(l, 'baseRent')));
  const save = () => {
    if (!end || end <= str(l, 'endDate')) return act.toast(`The new end date must be after ${formatDate(str(l, 'endDate'))}.`, 'err');
    act.update('leases', id, { renewEnd: end, renewRent: Number(rent) || num(l, 'baseRent') }, `Renewal terms proposed: to ${formatDate(end)} at ${randOf(Number(rent) || num(l, 'baseRent'))} per m²`);
    act.toast(`${l.ref}: renewal terms saved — press “Renew lease” when the tenant accepts`);
  };
  return (
    <Panel title="Renewal terms" meta={`Current lease ends ${formatDate(str(l, 'endDate'))} · “Renew lease” applies these terms`} right={str(l, 'renewEnd') ? <Tag tone="blue">Proposed to {formatDate(str(l, 'renewEnd'))}</Tag> : <Tag tone="amber">No terms yet</Tag>}>
      <div className="mall-inline">
        <Field label="New end date"><input className="input" type="date" aria-label="New end date" disabled={!manage} value={end} onChange={(e) => setEnd(e.target.value)} data-testid="renew-end" /></Field>
        <Field label="New base rent per m²"><input className="input num" type="number" min={0} step="0.01" aria-label="New base rent per m²" disabled={!manage} value={rent} onChange={(e) => setRent(e.target.value)} data-testid="renew-rent" /></Field>
        {manage && <button className="btn" onClick={save} data-testid="save-renewal">Save renewal terms</button>}
      </div>
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const l = findRecord(data, 'leases', id)!;
  const unit = leaseUnit(data, l);
  const invDef = config.collections.find((c) => c.key === 'invoices')!;
  const invoices = [...leaseInvoices(data, id)].sort(invDef.sort).slice(0, 5);
  const latest = latestFigure(data, id);
  const base = monthlyBaseRent(data, l);
  const ratio = latest ? rentToSales(base, num(latest, 'amount')) : null;
  const prospect = records(data, 'prospects').find((p) => str(p, 'lease') === id);
  return (
    <>
      <Panel title="Tenant (fictional)"><TenantCard data={data} lease={l} /></Panel>
      <Panel title="Lease term & security">
        <KeyValues items={[
          { label: 'Unit', value: unit ? <RecLink module="units" id={unit.id}>{shopLabel(unit)}</RecLink> : '—' },
          { label: 'GLA', value: `${thousands(glaOf(data, l))} m²` },
          { label: 'Starts', value: formatDate(str(l, 'startDate')) },
          { label: 'Ends', value: formatDate(str(l, 'endDate')) },
          { label: 'Credit check', value: label(CREDIT_CHECK, str(l, 'creditCheck') || 'pending') },
          { label: 'FICA (simulated)', value: l.values.fica === true ? 'Verified' : 'Not verified' },
          { label: 'Security', value: l.values.depositReceived === true ? `${label(DEPOSIT_TYPES, str(l, 'depositType'))} ${randOf(num(l, 'depositAmount'))}` : 'Not received', wide: true },
          { label: 'Certificate of occupancy', value: str(l, 'cooNumber') },
          { label: 'Tenant insurance', value: str(l, 'insuranceExpiry') ? `Until ${formatDate(str(l, 'insuranceExpiry'))}` : '' },
          ...(str(l, 'approvedBy') ? [{ label: 'Letting approved by', value: str(l, 'approvedBy') }] : []),
          ...(prospect ? [{ label: 'From prospect', value: <RecLink module="pipeline" id={prospect.id}>{prospect.ref}</RecLink> }] : []),
        ]} />
      </Panel>
      {num(l, 'turnoverPct') > 0 && latest && (
        <Panel title="Sales" right={ratio !== null && ratio > RENT_TO_SALES_RISK ? <Tag tone="red">At risk</Tag> : undefined}>
          <KeyValues items={[
            { label: `Turnover ${periodLabel(str(latest, 'period'))}`, value: randRound(num(latest, 'amount')) },
            { label: 'Trading density', value: `${randRound(tradingDensity(num(latest, 'amount'), glaOf(data, l)))}/m²` },
            { label: 'Rent-to-sales', value: ratio === null ? '—' : `${ratio}%` },
          ]} />
          <p className="muted-note" style={{ marginTop: 10 }}>Rent above {RENT_TO_SALES_RISK}% of sales is flagged “at risk” (demo level).</p>
        </Panel>
      )}
      <Panel title="Recent invoices" right={<ModButton module="billing">Monthly billing</ModButton>}>
        {invoices.length ? (
          <ul className="list">
            {invoices.map((i) => (
              <li key={i.id}>
                <div className="grow"><RecLink module="billing" id={i.id}><b>{periodLabel(str(i, 'period'))} · {rand(invoiceTotals(i).total)}</b></RecLink><small>{i.ref}{overdueDays(i, today) ? ` · ${overdueDays(i, today)} days overdue` : ''}</small></div>
                <StatusTag workflow={invDef.workflow} status={i.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="Not billed yet" body="Invoices start once the shop is trading." />}
      </Panel>
    </>
  );
}
