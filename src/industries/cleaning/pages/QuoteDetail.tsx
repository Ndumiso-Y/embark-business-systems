import { Link, useParams } from 'react-router-dom';
import { useBase, useData, useUser } from '../../../core/context';
import { findRecord, lines, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { MIN_MARGIN_PCT, QUOTE_APPROVAL_THRESHOLD } from '../data';
import { quoteApprovalReasons, quoteFigures, rand, staffName } from '../helpers';
import { LinesTable } from './shared';

export default function QuoteDetail() {
  const { id } = useParams();
  const data = useData();
  const q = findRecord(data, 'quotes', id);
  return (
    <RecordDetail aside={q ? <Aside id={q.id} /> : undefined}>
      {q && <Panel title="Quote lines" meta="Labour hours × rate, consumables and equipment, excluding VAT"><LinesTable lines={lines(q)} /></Panel>}
    </RecordDetail>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const { can, hasModule } = useUser();
  const q = findRecord(data, 'quotes', id)!;
  const f = quoteFigures(q);
  const reasons = quoteApprovalReasons(q);
  const invoice = findRecord(data, 'invoices', str(q, 'invoice'));
  return (
    <>
      <Panel title="Value & margin" right={reasons.length ? <Tag tone="amber">Approval needed</Tag> : <Tag tone="green">Within limits</Tag>}>
        <KeyValues items={[
          { label: 'Quote value (excl. VAT)', value: <b>{rand(f.net)}</b> },
          { label: 'Total incl. VAT', value: rand(f.total) },
          { label: 'Estimated cost', value: f.cost ? rand(f.cost) : 'Not entered' },
          { label: 'Margin', value: f.cost ? `${rand(f.net - f.cost)} · ${f.marginPct}%` : '—' },
          { label: 'Approved by', value: str(q, 'approvedBy') || '—' },
          { label: 'Sent on', value: str(q, 'sentOn') ? formatDate(str(q, 'sentOn')) : '—' },
        ]} />
        {q.status === 'draft' && reasons.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Notice tone={can('quotes.approve') ? 'accent' : 'amber'}>
              Approval rule: {reasons.join(' and ')}. {can('quotes.approve') ? 'You hold “Approve quotes”, so sending it records your approval.' : 'Your simulated role cannot send it — switch to a user with “Approve quotes”.'}
            </Notice>
          </div>
        )}
        <p className="muted-note" style={{ marginTop: 10 }}>Demo rule: quotes above {rand(toCents(QUOTE_APPROVAL_THRESHOLD))} excl. VAT or below a {MIN_MARGIN_PCT}% margin need approval.</p>
      </Panel>
      <Panel title="Job">
        <KeyValues items={[
          { label: 'Job date', value: str(q, 'jobDate') ? formatDate(str(q, 'jobDate')) : 'Not scheduled' },
          { label: 'Team size', value: num(q, 'teamSize') || '—' },
          { label: 'Team leader', value: str(q, 'teamLeader') ? staffName(data, q.values.teamLeader) : '—' },
          { label: 'Invoice', value: invoice ? (hasModule('invoices') ? <Link to={`${base}/invoices/${invoice.id}`}>{invoice.ref}</Link> : invoice.ref) : '—' },
        ]} />
        {q.status === 'accepted' && <p className="muted-note" style={{ marginTop: 10 }}>Set the job date and team size (Edit) before scheduling.</p>}
      </Panel>
    </>
  );
}
