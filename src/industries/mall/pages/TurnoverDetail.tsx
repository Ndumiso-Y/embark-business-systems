import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, permissionHint, str } from '../../../core/engine';
import { formatDate, monthShort } from '../../../core/lib/dates';
import { BarChart, Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RENT_TO_SALES_RISK } from '../data';
import {
  atRisk, breakpoint, declarationDue, declarationOverdue, glaOf, hasFigure, leaseDeclarations, leaseOf, monthlyBaseRent, periodLabel, randOf, randRound, rentToSales, thousands, todayStr,
  tradingDensity, turnoverRent,
} from '../helpers';
import { MallStyles, TenantCard } from './shared';

export default function TurnoverDetail() {
  const { id } = useParams();
  const data = useData();
  const d = findRecord(data, 'turnover', id);
  return (
    // “Record declaration” is done with the amount in the panel below.
    <RecordDetail hideTransitions={['declared']} aside={d ? <Aside id={d.id} /> : undefined}>
      {d && <Main key={`${d.id}-${d.status}`} id={d.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const d = findRecord(data, 'turnover', id)!;
  const lease = leaseOf(data, d.values.lease);
  const gla = glaOf(data, lease);
  const base = monthlyBaseRent(data, lease);
  const pct = num(lease, 'turnoverPct');
  const [amount, setAmount] = useState(num(d, 'amount') ? String(num(d, 'amount')) : '');
  const capture = d.status === 'awaited' || d.status === 'queried';
  const figure = capture ? Number(amount) || 0 : num(d, 'amount');
  const ratio = rentToSales(base, figure);
  const tr = turnoverRent(figure, pct, base);
  const record = () => {
    if (!(Number(amount) > 0)) return act.toast('Type the turnover the tenant declared (excl. VAT).', 'err');
    act.update('turnover', id, { amount: Number(amount) });
    const res = act.transition('turnover', id, 'declared');
    if (!res.ok) return act.toast(res.reason, 'err');
    act.toast(`${d.ref}: ${randRound(Number(amount))} declared for ${periodLabel(str(d, 'period'))} — now waiting to be verified`);
  };
  return (
    <>
      <MallStyles />
      <Panel title="Declared turnover" meta={`${periodLabel(str(d, 'period'))} · typed in from the tenant’s declaration — there is no till or point-of-sale link`}
        right={declarationOverdue(d, today) ? <Tag tone="red">Overdue since {formatDate(declarationDue(str(d, 'period')))}</Tag> : undefined}>
        {capture ? (
          can('billing') ? (
            <div className="mall-inline">
              <Field label="Turnover for the month (excl. VAT)"><input className="input num" type="number" min={0} step="100" aria-label="Declared turnover" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="declared-amount" /></Field>
              <button className="btn primary" onClick={record} data-testid="record-declaration">Record declaration</button>
            </div>
          ) : <p className="muted-note">{permissionHint(config, data, 'billing')}</p>
        ) : (
          <div className="mini-stat-row">
            <div>Declared<b>{randOf(num(d, 'amount'))}</b></div>
            <div>Declared on<b>{formatDate(str(d, 'declaredOn'))}</b></div>
            {str(d, 'verifiedBy') && <div>Verified by<b>{str(d, 'verifiedBy')}</b></div>}
          </div>
        )}
        {d.status === 'awaited' && <p className="muted-note" style={{ marginTop: 10 }}>Due by {formatDate(declarationDue(str(d, 'period')))} (the 7th of the following month). Until it is declared and verified, no turnover rent is billed for the month.</p>}
        {d.status === 'declared' && <p className="muted-note" style={{ marginTop: 10 }}>“Verify” locks the figure and puts any turnover rent on the next invoice. “Query with tenant” sends it back with a note (nothing is sent from this demo).</p>}
      </Panel>
      {figure > 0 && lease && (
        <Panel title="What this figure means" meta="Demo formulas" right={atRisk(ratio) ? <Tag tone="red">At risk</Tag> : tr > 0 ? <Tag tone="accent">Above breakpoint</Tag> : <Tag tone="dark">Below breakpoint</Tag>}>
          <KeyValues items={[
            { label: 'Trading density', value: `${randRound(tradingDensity(figure, gla))} per m² (${randRound(figure)} ÷ ${thousands(gla)} m²)` },
            { label: 'Rent-to-sales', value: ratio === null ? '—' : `${ratio}% (base rent ${randOf(base)} ÷ turnover)` },
            { label: `Turnover × ${pct}%`, value: randOf((figure * pct) / 100) },
            { label: 'Less monthly base rent', value: `−${randOf(base)}` },
            { label: 'Turnover rent for the month', value: <b data-testid="turnover-rent">{randOf(tr)}</b> },
            { label: 'Breakpoint', value: `${randRound(breakpoint(base, pct))} turnover a month` },
          ]} />
          {atRisk(ratio) && <div style={{ marginTop: 12 }}><Notice tone="red">Rent is more than {RENT_TO_SALES_RISK}% of sales. Tenants at this level often fall into arrears — worth a conversation before the next escalation.</Notice></div>}
        </Panel>
      )}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const d = findRecord(data, 'turnover', id)!;
  const lease = leaseOf(data, d.values.lease);
  const history = lease ? leaseDeclarations(data, lease.id).filter(hasFigure).slice(-6) : [];
  return (
    <>
      <Panel title="Tenant"><TenantCard data={data} lease={lease} /></Panel>
      {history.length > 1 && (
        <Panel title="Last six months" meta="Declared turnover">
          <BarChart label="Declared turnover by month" format={(n) => randRound(n)} data={history.map((h) => ({ label: monthShort(str(h, 'period')), value: num(h, 'amount') }))} />
        </Panel>
      )}
    </>
  );
}
