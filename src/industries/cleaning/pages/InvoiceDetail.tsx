import { Link, useParams } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, lines, num, str } from '../../../core/engine';
import { daysBetween, formatDate, monthLabel } from '../../../core/lib/dates';
import { KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { invoiceFigures, invoiceOverdue, rand, siteName, todayStr } from '../helpers';
import { LinesTable } from './shared';

export default function InvoiceDetail() {
  const { id } = useParams();
  const data = useData();
  const config = useIndustry();
  const inv = findRecord(data, 'invoices', id);
  return (
    <RecordDetail aside={inv ? <Aside id={inv.id} /> : undefined}>
      {inv && (
        <Panel title="Invoice" meta={`From ${config.businessName} · demonstration document, not a tax invoice`}>
          <LinesTable lines={lines(inv)} credit={num(inv, 'credit')} creditLabel={str(inv, 'creditNote')} />
        </Panel>
      )}
    </RecordDetail>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const today = todayStr();
  const inv = findRecord(data, 'invoices', id)!;
  const f = invoiceFigures(inv);
  const quote = findRecord(data, 'quotes', str(inv, 'quote'));
  const overdue = invoiceOverdue(inv, today);
  return (
    <Panel title="Summary" right={overdue ? <Tag tone="red">Overdue {daysBetween(str(inv, 'dueDate'), today)} d</Tag> : undefined}>
      <KeyValues items={[
        { label: 'Bill to', value: str(inv, 'billTo') },
        { label: 'Period', value: str(inv, 'period') ? monthLabel(str(inv, 'period')) : '—' },
        { label: 'Site', value: str(inv, 'site') ? (hasModule('sites') ? <Link to={`${base}/sites/${str(inv, 'site')}`}>{siteName(data, inv.values.site)}</Link> : siteName(data, inv.values.site)) : '—' },
        { label: 'Once-off job', value: quote ? (hasModule('quotes') ? <Link to={`${base}/quotes/${quote.id}`}>{quote.ref}</Link> : quote.ref) : '—' },
        { label: 'Lines', value: rand(f.gross) },
        { label: 'Staffing credit', value: f.credit ? `−${rand(f.credit)}` : 'None' },
        { label: 'VAT', value: rand(f.vat) },
        { label: 'Total due', value: <b>{rand(f.total)}</b> },
        { label: 'Due', value: formatDate(str(inv, 'dueDate')) },
        { label: 'Paid on', value: str(inv, 'paidOn') ? formatDate(str(inv, 'paidOn')) : '—' },
      ]} />
      {f.credit > 0 && <div style={{ marginTop: 12 }}><Notice tone="grey">Credit basis: {str(inv, 'creditNote') || 'shifts not staffed'}. The credit comes off before VAT (demo rule).</Notice></div>}
    </Panel>
  );
}
