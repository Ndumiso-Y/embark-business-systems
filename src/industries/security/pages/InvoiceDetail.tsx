import { Link, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { lines, linesTotals, num, str } from '../../../core/engine';
import { formatRand } from '../../../core/lib/money';
import { formatDate, monthLabel } from '../../../core/lib/dates';
import { Empty, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { VAT_RATE } from '../data';
import { calloutExtras, invoiceOverdue, invoiceTotals, kindOf, rec, shiftTitle, unfilledShifts } from '../helpers';
import { SHIFT_SHORT } from '../data';
import { DAYS_BACK } from '../seed';
import { useClock } from './format';

export default function InvoiceDetail() {
  const { id } = useParams();
  const data = useData();
  const r = rec(data, 'invoices', id);
  return (
    <RecordDetail aside={r ? <Aside invoice={r} /> : undefined}>
      {r && <BuildUp invoice={r} />}
    </RecordDetail>
  );
}

function BuildUp({ invoice: r }: { invoice: DemoRecord }) {
  const config = useIndustry();
  const data = useData();
  const list = lines(r);
  const per = linesTotals(list, 0).lines;
  const t = invoiceTotals(r);
  const contract = rec(data, 'contracts', r.values.contract);
  return (
    <Panel title="Invoice build-up" meta={`${config.businessName} · tax invoice (demonstration) to ${str(contract, 'client')}`} right={<Tag tone="accent">{formatRand(t.total)} incl. VAT</Tag>}>
      {list.length ? (
        <div className="table-wrap">
          <table className="table items-table" data-testid="invoice-lines">
            <thead><tr><th>Post / extra</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {list.map((l, i) => (
                <tr key={l.id}><td>{l.description}</td><td className="num">{l.qty}</td><td className="num">{formatRand(Math.round(l.unitPrice * 100))}</td><td className="num">{formatRand(per[i]?.excl ?? 0)}</td></tr>
              ))}
              <tr><td colSpan={3}><strong>Guarding and extras</strong></td><td className="num"><strong>{formatRand(t.gross)}</strong></td></tr>
              <tr><td colSpan={3}>Less: penalties — {num(r, 'unfilledShifts')} unfilled shift{num(r, 'unfilledShifts') === 1 ? '' : 's'} × {formatRand(Math.round(num(r, 'penaltyPerShift') * 100))} (demo rule)</td><td className="num">{t.penalty ? `-${formatRand(t.penalty)}` : formatRand(0)}</td></tr>
              <tr><td colSpan={3}>Net excl. VAT</td><td className="num">{formatRand(t.net)}</td></tr>
              <tr><td colSpan={3}>VAT {VAT_RATE}%</td><td className="num">{formatRand(t.vat)}</td></tr>
              <tr><td colSpan={3}><strong>Total due</strong></td><td className="num"><strong>{formatRand(t.total)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      ) : <Empty title="No lines yet" body="Edit the invoice to add the contracted posts." />}
      <Notice tone="grey">Demonstration only: not a valid tax invoice, and issuing it sends nothing to the client.</Notice>
    </Panel>
  );
}

function Aside({ invoice: r }: { invoice: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const { today } = useClock();
  const contract = rec(data, 'contracts', r.values.contract);
  const period = str(r, 'period');
  const live = contract ? unfilledShifts(data, contract.id, period, today) : [];
  const extras = contract ? calloutExtras(data, contract, period) : null;
  // What was billed is fixed on the invoice when it is built; the live records may since have aged out of the demo.
  const billed = lines(r).filter((l) => l.id.endsWith('-CO')).reduce((n, l) => n + l.qty, 0);
  return (
    <>
      <Panel title="Terms" right={invoiceOverdue(r, today) ? <Tag tone="red">Overdue</Tag> : undefined}>
        <KeyValues items={[
          { label: 'Client', value: contract && hasModule('contracts') ? <Link to={`${base}/contracts/${contract.id}`}>{str(contract, 'client')}</Link> : str(contract, 'client'), wide: true },
          { label: 'Month', value: /^\d{4}-\d{2}$/.test(period) ? monthLabel(period) : period },
          { label: 'Issued', value: formatDate(str(r, 'issueDate')) },
          { label: 'Due', value: formatDate(str(r, 'dueDate')) },
          { label: 'Paid', value: formatDate(str(r, 'paidOn')) },
        ]} />
      </Panel>
      <Panel title="Roster evidence" meta="Unfilled shifts for this contract and month still held in the demo roster">
        {live.length ? (
          <ul className="list" data-testid="invoice-unfilled">
            {live.map((s) => (
              <li key={s.id}><span className="dot red" /><div className="grow">{hasModule('roster') ? <Link to={`${base}/roster/${s.id}`}><b>{shiftTitle(data, s)}</b></Link> : <b>{shiftTitle(data, s)}</b>}<small>{formatDate(str(s, 'date'))} · {SHIFT_SHORT[kindOf(data, s)]} shift · {s.status === 'absent' ? 'absent, no relief' : 'no officer posted'}</small></div></li>
            ))}
          </ul>
        ) : <Empty title="No unfilled shifts on the roster" body={`The demo roster only holds the last ${DAYS_BACK} days; older penalties are stored on the invoice.`} />}
        {extras && (
          <p className="muted-note" style={{ marginTop: 10 }}>
            {billed} billable call-out{billed === 1 ? '' : 's'} on this invoice at {formatRand(Math.round(extras.fee * 100))} each — the first {extras.included} a month are included in the contract.
            {' '}{extras.count} call-out record{extras.count === 1 ? '' : 's'} for the month {extras.count === 1 ? 'is' : 'are'} still held in the demo (it keeps about six weeks).
          </p>
        )}
      </Panel>
    </>
  );
}
