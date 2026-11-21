import { useParams } from 'react-router-dom';
import { findRecord, lines, linesTotals, str } from '../../../core/engine';
import { useData, useIndustry } from '../../../core/context';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { KeyValues, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { INVOICE_KINDS, VAT_RATE, label } from '../data';
import { clientName, consultantName, invoiceOverdue, invoiceTotals, randc, todayStr } from '../helpers';
import { RecLink } from './shared';

export default function InvoiceDetail() {
  const { id } = useParams();
  const data = useData();
  const inv = findRecord(data, 'invoices', id);
  return (
    <RecordDetail aside={inv ? <Aside id={inv.id} /> : undefined}>
      {inv && <Document id={inv.id} />}
    </RecordDetail>
  );
}

function Document({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const inv = findRecord(data, 'invoices', id)!;
  const t = invoiceTotals(inv);
  const lt = linesTotals(lines(inv), VAT_RATE);
  const credit = t.sign < 0;
  const sign = (c: number) => randc(t.sign * c);
  return (
    <Panel title={credit ? 'Credit note' : 'Invoice'} meta={`From ${config.businessName} to ${clientName(data, str(inv, 'client'))} · demonstration document, not a tax invoice`}>
      <div className="table-wrap">
        <table className="table items-table" data-testid="invoice-lines">
          <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Unit (excl.)</th><th className="num">Line</th></tr></thead>
          <tbody>
            {lines(inv).map((l, i) => (
              <tr key={l.id}><td style={{ whiteSpace: 'normal' }}>{l.description}</td><td className="num">{l.qty}</td><td className="num">{randc(Math.round(l.unitPrice * 100))}</td><td className="num">{sign(lt.lines[i]?.excl ?? 0)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <KeyValues items={[
        { label: 'Subtotal (excl. VAT)', value: sign(t.net) },
        { label: `VAT ${VAT_RATE}%`, value: sign(t.vat) },
        { label: credit ? 'Total credit' : 'Total due', value: <b data-testid="invoice-total">{sign(t.total)}</b> },
      ]} />
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const inv = findRecord(data, 'invoices', id)!;
  const overdue = invoiceOverdue(inv, today);
  const orig = findRecord(data, 'invoices', str(inv, 'creditFor'));
  const p = findRecord(data, 'placements', str(inv, 'placement'));
  const ts = findRecord(data, 'timesheets', str(inv, 'timesheet'));
  return (
    <Panel title="Summary" right={overdue ? <Tag tone="red">Overdue {daysBetween(str(inv, 'dueDate'), today)} d</Tag> : undefined}>
      <KeyValues items={[
        { label: 'Type', value: label(INVOICE_KINDS, str(inv, 'kind')) },
        { label: 'Client', value: <RecLink module="clients" id={str(inv, 'client')}>{clientName(data, str(inv, 'client'))}</RecLink> },
        { label: 'Date', value: formatDate(str(inv, 'date')) },
        { label: 'Due', value: formatDate(str(inv, 'dueDate')) },
        { label: 'Paid / settled', value: formatDate(str(inv, 'paidOn')) },
        { label: 'Consultant credited', value: consultantName(data, str(inv, 'consultant')) },
        ...(orig ? [{ label: 'Credits invoice', value: <RecLink module="invoices" id={orig.id}>{orig.ref}</RecLink> }] : []),
        ...(p ? [{ label: 'Placement', value: <RecLink module="placements" id={p.id}>{p.ref}</RecLink> }] : []),
        ...(ts ? [{ label: 'Timesheet', value: <RecLink module="timesheets" id={ts.id}>{ts.ref}</RecLink> }] : []),
      ]} />
    </Panel>
  );
}
