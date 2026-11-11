import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData, useIndustry } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { addDays, formatDate, monthLabel } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { Empty, Meters, Notice, Panel, Segmented, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { fleetBalance, invoiceBalance, invoiceOverdue, invoiceTotal, servicesText, todayStr, vehicleLabel } from '../helpers';
import { RecordLink } from './shared';

export default function FleetDetail() {
  const { id } = useParams();
  const data = useData();
  const f = findRecord(data, 'fleets', id);
  return (
    <RecordDetail aside={f ? <Aside id={f.id} /> : undefined}>
      {f && <Statement id={f.id} />}
    </RecordDetail>
  );
}

const customerIds = (data: ReturnType<typeof useData>, fleetId: string) => new Set(records(data, 'customers').filter((c) => str(c, 'fleet') === fleetId).map((c) => c.id));

function Statement({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const f = findRecord(data, 'fleets', id)!;
  const ids = customerIds(data, f.id);
  const months = [0, 1, 2].map((i) => addDays(`${today.slice(0, 7)}-15`, -30.4 * i).slice(0, 7));
  const [month, setMonth] = useState(months[0]);
  const wf = config.collections.find((c) => c.key === 'invoices')!.workflow;
  const invoices = records(data, 'invoices').filter((i) => ids.has(str(i, 'customer')) && i.status !== 'void');
  const inMonth = invoices.filter((i) => str(i, 'issuedOn').startsWith(month)).sort((a, b) => str(a, 'issuedOn').localeCompare(str(b, 'issuedOn')));
  const invoiced = inMonth.reduce((n, i) => n + invoiceTotal(i), 0);
  const received = invoices.filter((i) => str(i, 'lastPaymentOn').startsWith(month)).reduce((n, i) => n + Math.round(num(i, 'paid') * 100), 0);
  const open = invoices.filter((i) => i.status === 'onaccount');
  const overdue = open.filter((i) => invoiceOverdue(i, today));
  return (
    <Panel title="Monthly statement" meta="Invoices on the account by month (preview — statements are not sent)"
      right={<Segmented label="Statement month" value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />}>
      {overdue.length > 0 && <div style={{ marginBottom: 12 }}><Notice tone="red">{overdue.length} invoice(s) past 30-day terms: {formatRand(overdue.reduce((n, i) => n + invoiceBalance(i), 0))} overdue.</Notice></div>}
      <div className="mini-stat-row" style={{ marginBottom: 12 }}>
        <div><b>{formatRand(invoiced)}</b>Invoiced in {monthLabel(month)}</div>
        <div><b>{formatRand(received)}</b>Remittances received</div>
        <div><b>{formatRand(fleetBalance(data, f.id))}</b>Owing on account now</div>
        <div><b>{inMonth.length}</b>Jobs invoiced</div>
      </div>
      {inMonth.length ? (
        <div className="table-wrap">
          <table className="table" data-testid="fleet-statement">
            <thead><tr><th>Date</th><th>Invoice</th><th>Vehicle · work</th><th>PO</th><th className="num">Amount</th><th className="num">Balance</th><th>Status</th></tr></thead>
            <tbody>
              {inMonth.map((i) => {
                const job = findRecord(data, 'jobs', str(i, 'job'));
                return (
                  <tr key={i.id}>
                    <td>{formatDate(str(i, 'issuedOn'))}</td>
                    <td><RecordLink module="invoices" record={i} /></td>
                    <td>{vehicleLabel(data, i.values.vehicle)}<small>{job ? servicesText(job) : ''}</small></td>
                    <td>{str(i, 'fleetPo') || '—'}</td>
                    <td className="num">{formatRand(invoiceTotal(i))}</td>
                    <td className="num">{formatRand(i.status === 'paid' ? 0 : invoiceBalance(i))}</td>
                    <td><StatusTag workflow={wf} status={i.status} />{invoiceOverdue(i, today) && <Tag tone="red">Overdue</Tag>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title={`No invoices in ${monthLabel(month)}`} />}
      <div className="btns" style={{ marginTop: 12 }}><button className="btn sm" type="button" onClick={() => window.print()}>Print statement (preview)</button></div>
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const f = findRecord(data, 'fleets', id)!;
  const ids = customerIds(data, f.id);
  const limit = Math.round(num(f, 'creditLimit') * 100);
  const bal = fleetBalance(data, f.id);
  const vehicles = records(data, 'vehicles').filter((v) => ids.has(str(v, 'customer')));
  const pending = records(data, 'jobs').filter((j) => vehicles.some((v) => v.id === str(j, 'vehicle')) && ['arrived', 'inspected', 'quoted'].includes(j.status ?? ''));
  return (
    <>
      <Panel title="Credit" meta={str(f, 'terms')}>
        <Meters format={(n) => formatRand(n * 100, { compact: true })} items={[{ label: 'Account balance', value: bal / 100, max: limit / 100, tone: bal > limit ? 'red' : bal > limit * 0.85 ? 'amber' : 'green', sub: `${limit ? Math.round((bal / limit) * 100) : 0}% of the credit limit used` }]} />
        <p className="muted-note" style={{ marginTop: 8 }}>{f.values.poRequired ? 'A purchase order number is required before any job is approved.' : 'No PO needed — fleet manager approves by phone or email.'}</p>
      </Panel>
      {pending.length > 0 && (
        <Panel title="Jobs waiting for approval">
          <ul className="list">
            {pending.map((j) => <li key={j.id}><div className="grow"><RecordLink module="jobs" record={j}><b>{vehicleLabel(data, j.values.vehicle)}</b></RecordLink><small>{j.ref} · {servicesText(j)} · PO {str(j, 'fleetPo') || 'missing'}</small></div></li>)}
          </ul>
        </Panel>
      )}
      <Panel title="Fleet vehicles" meta={`${vehicles.length} vehicle(s)`}>
        <ul className="list">
          {vehicles.map((v) => <li key={v.id}><div className="grow"><RecordLink module="vehicles" record={v}><b>{str(v, 'reg')}</b></RecordLink><small>{str(v, 'make')} {str(v, 'model')} · {str(v, 'tyreSize')}</small></div></li>)}
        </ul>
      </Panel>
    </>
  );
}
