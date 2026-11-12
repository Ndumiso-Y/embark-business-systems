import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { linesTotals, permissionHint, records, str } from '../../../core/engine';
import { Empty, Notice, PageHeader, Panel, Segmented, Stat } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { ELEC_TARIFF, VAT_RATE, WATER_TARIFF } from '../data';
import {
  ageing, buildInvoice, expectedRentRoll, invoiceOpen, invoiceTotals, leasesToInvoice, monthBilling, periodLabel, periodOf, plural, prevPeriod, rand, randBig, randOf, todayStr,
} from '../helpers';
import type { Line } from '../../../core/types';
import { RecLink } from './shared';

type Show = 'open' | 'month' | 'drafts' | 'all';

/** The rent roll: month-end drafting, issuing and the invoice register. */
export default function Billing() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const base = useBase();
  const navigate = useNavigate();
  const { can } = useUser();
  const today = todayStr();
  const period = periodOf(today);
  const last = prevPeriod(period);
  const def = act.def('invoices');
  const [show, setShow] = useState<Show>('open');
  const [creating, setCreating] = useState(false);
  const invoices = useMemo(() => [...records(data, 'invoices')].sort(def.sort), [data, def]);
  const drafts = invoices.filter((i) => i.status === 'draft');
  const pending = leasesToInvoice(data, period);
  const preview = useMemo(() => pending.map((l) => buildInvoice(data, l, period, today)), [pending, data, period, today]);
  const previewTotal = preview.reduce((n, d) => n + linesTotals(d.values.lines as Line[], VAT_RATE).total, 0);
  const noReading = preview.filter((d) => d.missingReading).length;
  const unverified = preview.filter((d) => d.unverifiedTurnover).length;
  const recharges = preview.reduce((n, d) => n + d.recharged.length, 0);
  const withTr = preview.filter((d) => (d.values.lines as Line[]).some((l) => l.id === 'tr')).length;
  const thisMonth = monthBilling(data, period);
  const lastMonth = monthBilling(data, last);
  const roll = expectedRentRoll(data);
  const age = ageing(invoices, today);
  const sum = (list: typeof invoices) => list.reduce((n, i) => n + invoiceTotals(i).total, 0);
  const rows = invoices.filter((i) => (show === 'open' ? i.status === 'draft' || invoiceOpen(i) : show === 'month' ? str(i, 'period') === period : show === 'drafts' ? i.status === 'draft' : true));

  const run = () => {
    let n = 0;
    for (const lease of pending) {
      const d = buildInvoice(data, lease, period, today);
      const inv = act.create('invoices', d.values, 'draft', `Drafted in the ${periodLabel(period)} month-end run`);
      for (const w of d.recharged) act.update('workorders', w.id, { rechargeInvoice: inv.ref }, `Recharged on ${inv.ref}`);
      n++;
    }
    setShow('drafts');
    act.toast(`${plural(n, 'draft invoice')} created for ${periodLabel(period)} — ${rand(previewTotal)} incl. VAT`);
  };
  const issueAll = () => {
    let done = 0;
    let refused = '';
    for (const inv of drafts) { const res = act.transition('invoices', inv.id, 'issued'); if (res.ok) done++; else refused = `${inv.ref}: ${res.reason}`; }
    if (done) act.toast(`${plural(done, 'invoice')} issued (simulated — nothing is sent or posted)`);
    if (refused) act.toast(refused, 'err');
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Finance`} title="Monthly billing" subtitle="The rent roll: one invoice per trading tenant per month — base rent, recoveries, metered utilities and turnover rent — then issue and collect. VAT at 15%."
        actions={can('billing') ? <button className="btn" onClick={() => setCreating(true)} data-testid="new-record"><IcoPlus /> New invoice</button> : undefined} />
      <div className="stat-grid">
        <Stat label={`Rent roll · ${periodLabel(period)}`} value={randBig(thisMonth.count ? thisMonth.billed + sum(drafts.filter((d) => str(d, 'period') === period)) : roll.total)} tone="accent"
          sub={thisMonth.count || drafts.length ? `${thisMonth.count} issued · ${drafts.length} in draft` : `expected from ${roll.leases} trading leases, before utilities — not drafted yet`} />
        <Stat label={`Collected · ${periodLabel(thisMonth.count ? period : last)}`} value={`${(thisMonth.count ? thisMonth : lastMonth).pct}%`} sub={`${randBig((thisMonth.count ? thisMonth : lastMonth).collected)} of ${randBig((thisMonth.count ? thisMonth : lastMonth).billed)} billed`} />
        <Stat label="Arrears" value={randBig(age.overdue)} tone={age.overdue ? 'red' : undefined} sub={`past the due date · ${rand(age.d90plus)} over 90 days`} />
        <Stat label="Drafts to issue" value={drafts.length} sub={drafts.length ? randBig(sum(drafts)) : 'none waiting'} />
      </div>
      <Panel title={`Month-end run — ${periodLabel(period)}`} meta="Drafts one invoice for every trading lease that has none for the month"
        right={can('billing') ? <button className="btn primary" disabled={!pending.length} onClick={run} data-testid="draft-invoices">Draft this month’s invoices ({pending.length})</button> : undefined}>
        {pending.length ? (
          <Notice tone="accent">
            <span data-testid="run-summary">{plural(pending.length, 'trading lease')} {pending.length === 1 ? 'has' : 'have'} no invoice for {periodLabel(period)} yet — about {rand(previewTotal)} incl. VAT. {withTr} will carry turnover rent for {periodLabel(last)}{recharges ? ` and ${plural(recharges, 'repair')} will be recharged` : ''}.</span>
          </Notice>
        ) : <Notice tone="grey"><span data-testid="run-summary">Every trading lease already has an invoice for {periodLabel(period)}.</span></Notice>}
        {pending.length > 0 && (noReading > 0 || unverified > 0) && (
          <div style={{ marginTop: 10 }}>
            <Notice tone="amber">
              <span data-testid="run-warnings">
                {noReading > 0 && <>{plural(noReading, 'shop')} {noReading === 1 ? 'has' : 'have'} no {periodLabel(last)} meter reading: the invoice still drafts, without the utilities line and with a note. Capture them first under <RecLink module="meters">Utilities metering</RecLink>. </>}
                {unverified > 0 && <>{plural(unverified, 'turnover declaration')} for {periodLabel(last)} {unverified === 1 ? 'is' : 'are'} not verified, so no turnover rent is billed for {unverified === 1 ? 'that tenant' : 'those tenants'} — see <RecLink module="turnover">Turnover declarations</RecLink>.</>}
              </span>
            </Notice>
          </div>
        )}
        {drafts.length > 0 && (
          <div className="btns" style={{ marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {can('billing') && <button className="btn sm" onClick={issueAll} data-testid="issue-drafts">Issue all {plural(drafts.length, 'draft')}</button>}
            <span className="muted-note">{plural(drafts.length, 'draft')} worth {rand(sum(drafts))} — open one below to see how it was built before it is issued.</span>
          </div>
        )}
        <ul className="muted-note" style={{ margin: '12px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>Base rent</b>, <b>operating costs</b> and <b>marketing levy</b>: GLA in m² × the lease rate for each.</li>
          <li><b>Utilities</b>: last month’s sub-meter consumption × the demo tariff ({randOf(ELEC_TARIFF)} per kWh, {randOf(WATER_TARIFF)} per kL).</li>
          <li><b>Turnover rent</b> for last month: max(0, verified turnover × the lease % − base rent). Below that breakpoint nothing is added.</li>
          <li><b>Recharges</b>: completed repairs that were the tenant’s responsibility. Interest on arrears is not calculated.</li>
        </ul>
        {!can('billing') && <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'billing')}</p>}
      </Panel>
      <div className="section-gap" />
      <Panel title="Invoices" meta={`${rows.length} shown of ${invoices.length} · newest month first`} right={
        <Segmented label="Show invoices" value={show} onChange={setShow} options={[{ value: 'open', label: 'Unpaid & drafts' }, { value: 'drafts', label: 'Drafts' }, { value: 'month', label: periodLabel(period) }, { value: 'all', label: 'All' }]} />}>
        {rows.length ? <RecordTable def={def} rows={rows} moduleKey="billing" extra={{ head: 'Balance', cell: (r) => (r.status === 'draft' ? '—' : <b>{rand(invoiceTotals(r).balance)}</b>) }} />
          : <Empty title={show === 'drafts' ? 'No drafts' : 'No invoices to show'} body={show === 'drafts' || show === 'month' ? 'Run the month-end draft above.' : undefined} />}
      </Panel>
      {creating && (
        <RecordFormModal def={def} open initial={def.createDefaults?.(today, data)} onClose={() => setCreating(false)} onSave={(v) => {
          const r = act.create('invoices', { ...v, paid: 0 }, 'draft');
          act.toast(`Invoice ${r.ref} created as a draft`);
          setCreating(false);
          navigate(`${base}/billing/${r.id}`);
        }} />
      )}
    </>
  );
}
