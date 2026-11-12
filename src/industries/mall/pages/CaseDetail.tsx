import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, permissionHint, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Field, KeyValues, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { DEMAND_AFTER_DAYS } from '../data';
import { AGE_BUCKETS, caseArrears, invoiceOpen, invoiceTotals, leaseInvoices, leaseOf, leaseUnit, overdueDays, periodLabel, rand, randOf, reminderText, shopLabel, todayStr } from '../helpers';
import { MallStyles, RecLink, TenantCard } from './shared';

export default function CaseDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'cases', id);
  return (
    <RecordDetail aside={c ? <Aside id={c.id} /> : undefined} backLabel="Arrears & credit control">
      {c && <Main key={c.id} id={c.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const c = findRecord(data, 'cases', id)!;
  const lease = leaseOf(data, c.values.lease);
  const a = caseArrears(data, c, today);
  const invDef = config.collections.find((x) => x.key === 'invoices')!;
  const open = leaseInvoices(data, str(c, 'lease')).filter(invoiceOpen).sort((x, y) => str(x, 'dueDate').localeCompare(str(y, 'dueDate')));
  const live = !['handedover', 'settled'].includes(c.status ?? '');
  const [instalment, setInstalment] = useState(String(num(c, 'instalment') || ''));
  const [first, setFirst] = useState(str(c, 'firstPayment'));
  const saveArrangement = () => {
    if (!(Number(instalment) > 0)) return act.toast('Type the monthly instalment.', 'err');
    if (!first || first < today) return act.toast('Choose a first-instalment date that is today or later.', 'err');
    act.update('cases', id, { instalment: Number(instalment), firstPayment: first }, `Arrangement terms: ${randOf(Number(instalment))} a month from ${formatDate(first)}`);
    act.toast(`${c.ref}: arrangement terms saved — press “Record payment arrangement” above`);
  };
  return (
    <>
      <MallStyles />
      <Panel title="Overdue invoices" meta="Payments are recorded on the invoice itself" right={<Tag tone={a.overdue ? 'red' : 'green'}>{a.overdue ? `${rand(a.overdue)} overdue` : 'Nothing overdue'}</Tag>}>
        {open.length ? (
          <ul className="list" data-testid="case-invoices">
            {open.map((i) => (
              <li key={i.id} style={{ flexWrap: 'wrap' }}>
                <div className="grow" style={{ minWidth: 150 }}><RecLink module="billing" id={i.id}><b>{periodLabel(str(i, 'period'))} · balance {rand(invoiceTotals(i).balance)}</b></RecLink><small>{i.ref} · due {formatDate(str(i, 'dueDate'))}{invoiceTotals(i).paid ? ` · ${rand(invoiceTotals(i).paid)} already paid` : ''}</small></div>
                {overdueDays(i, today) > 0 ? <Tag tone={overdueDays(i, today) > 90 ? 'red' : 'amber'}>{overdueDays(i, today)} days overdue</Tag> : <Tag tone="dark">Not yet due</Tag>}
                <StatusTag workflow={invDef.workflow} status={i.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No unpaid invoices" body="The account is paid up — mark the case settled." />}
      </Panel>
      {live && lease && a.overdue > 0 && (
        <Panel title="Reminder to the tenant" meta="Preview only — no email, SMS or letter is sent from this demo">
          <div className="sms-preview" data-testid="reminder-preview">{reminderText(config.businessName, str(lease, 'tenant'), shopLabel(leaseUnit(data, lease)), a)}</div>
          <p className="muted-note">
            {c.status === 'open' ? '“Log reminder” above records that this was sent by the credit controller outside the system.' : `Reminder logged ${formatDate(str(c, 'reminderOn'))}.`}
            {' '}A letter of demand can be logged once the oldest invoice is {DEMAND_AFTER_DAYS} days overdue{a.oldest >= DEMAND_AFTER_DAYS ? ` — it is ${a.oldest} days` : ` (it is ${a.oldest} days)`}.
          </p>
        </Panel>
      )}
      {['reminded', 'demand', 'arrangement'].includes(c.status ?? '') && (
        <Panel title="Payment arrangement" meta="“Record payment arrangement” is refused until both are set" right={c.status === 'arrangement' ? <Tag tone="blue">In place</Tag> : undefined}>
          {can('credit.control') ? (
            <div className="mall-inline">
              <Field label="Monthly instalment (on top of current rent)"><input className="input num" type="number" min={0} step="100" aria-label="Monthly instalment" value={instalment} onChange={(e) => setInstalment(e.target.value)} data-testid="instalment" /></Field>
              <Field label="First instalment on"><input className="input" type="date" min={today} aria-label="First instalment on" value={first} onChange={(e) => setFirst(e.target.value)} data-testid="first-payment" /></Field>
              <button className="btn" onClick={saveArrangement} data-testid="save-arrangement">Save terms</button>
              {!first && <button className="btn ghost sm" type="button" onClick={() => setFirst(addDays(today, 7))}>In a week</button>}
            </div>
          ) : <p className="muted-note">{permissionHint(config, data, 'credit.control')}</p>}
          {num(c, 'instalment') > 0 && a.overdue > 0 && <p className="muted-note" style={{ marginTop: 10 }}>At {randOf(num(c, 'instalment'))} a month the {rand(a.overdue)} overdue would be cleared in about {Math.ceil(a.overdue / 100 / num(c, 'instalment'))} months, if current rent is also paid on time.</p>}
        </Panel>
      )}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const c = findRecord(data, 'cases', id)!;
  const a = caseArrears(data, c, today);
  return (
    <>
      <Panel title="Tenant"><TenantCard data={data} lease={leaseOf(data, c.values.lease)} /></Panel>
      <Panel title="Ageing" right={a.d90plus ? <Tag tone="red">Over 90 days</Tag> : undefined}>
        <KeyValues items={[
          ...AGE_BUCKETS.map((b) => ({ label: b.label, value: rand(a[b.key]) })),
          { label: 'Not yet due', value: rand(a.current) },
          { label: 'Oldest invoice', value: a.oldest ? `${a.oldest} days overdue` : '—' },
        ]} />
        <p className="muted-note" style={{ marginTop: 10 }}>Interest on arrears is not calculated in this demo.</p>
      </Panel>
      <Panel title="Steps taken">
        <KeyValues items={[
          { label: 'Case opened', value: formatDate(str(c, 'openedOn')) },
          { label: 'Reminder logged', value: str(c, 'reminderOn') ? formatDate(str(c, 'reminderOn')) : '' },
          { label: 'Letter of demand', value: str(c, 'demandOn') ? formatDate(str(c, 'demandOn')) : '' },
          { label: 'Arrangement', value: c.status === 'arrangement' && num(c, 'instalment') ? `${randOf(num(c, 'instalment'))} a month from ${formatDate(str(c, 'firstPayment'))}` : '', wide: true },
        ]} />
      </Panel>
    </>
  );
}
