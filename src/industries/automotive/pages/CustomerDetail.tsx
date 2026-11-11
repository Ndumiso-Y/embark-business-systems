import { Link, useParams } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { DueTag, Empty, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { CUSTOMER_KINDS, label } from '../data';
import { invoiceBalance, invoiceOverdue, invoiceTotal, serviceDue, todayStr } from '../helpers';
import { km } from './format';

export default function CustomerDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'customers', id);
  return (
    <RecordDetail aside={c ? <Account id={c.id} /> : undefined}>
      {c && <Vehicles id={c.id} />}
    </RecordDetail>
  );
}

function Vehicles({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const today = todayStr();
  const vehicles = records(data, 'vehicles').filter((v) => str(v, 'customer') === id);
  const invoices = records(data, 'invoices').filter((i) => str(i, 'customer') === id).sort((a, b) => str(b, 'issuedOn').localeCompare(str(a, 'issuedOn')));
  const invWf = config.collections.find((c) => c.key === 'invoices')!.workflow;
  return (
    <>
      <Panel title="Vehicles" meta="Owned or operated by this customer">
        {vehicles.length ? (
          <ul className="list" data-testid="customer-vehicles">
            {vehicles.map((v) => {
              const due = serviceDue(v, today);
              return (
                <li key={v.id}>
                  <div className="grow">
                    {hasModule('vehicles') ? <Link to={`${base}/vehicles/${v.id}`}><b>{str(v, 'reg')}</b></Link> : <b>{str(v, 'reg')}</b>}
                    <small>{str(v, 'year')} {str(v, 'make')} {str(v, 'model')} · ~{km(due.estKm)}</small>
                  </div>
                  <DueTag state={due.state} label={due.state === 'ok' ? `Service ${formatDate(str(v, 'nextServiceDate'))}` : undefined} />
                </li>
              );
            })}
          </ul>
        ) : <Empty title="No vehicles" />}
      </Panel>
      <Panel title="Invoices">
        {invoices.length ? (
          <ul className="list">
            {invoices.slice(0, 12).map((i) => (
              <li key={i.id}>
                <span className="time-chip">{formatDate(str(i, 'issuedOn'))}</span>
                <div className="grow">
                  {hasModule('invoices') ? <Link to={`${base}/invoices/${i.id}`}><b>{i.ref}</b></Link> : <b>{i.ref}</b>}
                  <small>{formatRand(invoiceTotal(i))} · balance {formatRand(invoiceBalance(i))}</small>
                </div>
                {invoiceOverdue(i, today) && <Tag tone="red">Overdue</Tag>}
                <StatusTag workflow={invWf} status={i.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No invoices yet" />}
      </Panel>
    </>
  );
}

function Account({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const c = findRecord(data, 'customers', id)!;
  const open = records(data, 'invoices').filter((i) => str(i, 'customer') === id && ['issued', 'partpaid'].includes(i.status ?? ''));
  const owing = open.reduce((n, i) => n + invoiceBalance(i), 0);
  const overdue = open.filter((i) => invoiceOverdue(i, today)).reduce((n, i) => n + invoiceBalance(i), 0);
  return (
    <Panel title="Account" right={<Tag tone={str(c, 'kind') === 'account' ? 'dark' : 'accent'}>{label(CUSTOMER_KINDS, str(c, 'kind'))}</Tag>}>
      <div className="totals">
        <div className="row"><span>Open invoices</span><b>{open.length}</b></div>
        <div className="row"><span>Overdue (30+ days)</span><b>{formatRand(overdue)}</b></div>
        <div className="grand"><span>Outstanding</span><b>{formatRand(owing)}</b></div>
      </div>
      <p className="muted-note" style={{ marginTop: 10 }}>{str(c, 'kind') === 'account' ? 'Fleet accounts may collect vehicles before paying (30-day terms).' : 'Private customers settle before the vehicle is released.'}</p>
    </Panel>
  );
}
