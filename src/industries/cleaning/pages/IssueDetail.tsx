import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Meters, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { budgetState, chemTrainedAt, fullName, issueProblems, issueValue, randOf, siteOf, todayStr } from '../helpers';
import { Check } from './shared';

export default function IssueDetail() {
  const { id } = useParams();
  const data = useData();
  const r = findRecord(data, 'issues', id);
  return <RecordDetail aside={r ? <Aside id={r.id} /> : undefined} />;
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const r = findRecord(data, 'issues', id)!;
  const item = findRecord(data, 'stock', str(r, 'item'));
  const site = siteOf(data, r);
  const open = r.status === 'requested';
  const hazardous = item?.values.hazardous === true;
  const trained = site ? chemTrainedAt(data, site, today) : [];
  const problems = open ? issueProblems(r, data, today) : [];
  const budget = site ? budgetState(data, site, str(r, 'date').slice(0, 7)) : null;
  const after = budget ? budget.used + (open ? issueValue(r, data) : 0) : 0;
  const inStore = num(item, 'qty');
  const short = open && !!item && num(r, 'qty') > inStore;
  const onOrder = item ? records(data, 'purchaseOrders').filter((po) => po.status === 'ordered' && str(po, 'item') === item.id) : [];
  const untrained = open && hazardous && trained.length === 0;
  return (
    <>
      <Panel title="Issue checks" meta="What the store checks before stock leaves" right={open ? <Tag tone={problems.length ? 'red' : 'green'}>{problems.length ? 'Cannot issue yet' : 'Ready to issue'}</Tag> : undefined}>
        <ul className="list" data-testid="issue-checks">
          <Check ok={open ? !!item && num(r, 'qty') <= num(item, 'qty') : null} label="Enough in store" detail={item ? `${num(item, 'qty')} × ${str(item, 'unit')} in store · ${num(r, 'qty')} requested` : 'No item selected'} />
          <Check ok={hazardous ? item?.values.sdsOnFile === true : null} label="Safety data sheet on file" detail={hazardous ? 'Hazardous chemical — an SDS must be on file (illustrative flag)' : 'Not a hazardous chemical'} />
          <Check ok={hazardous ? trained.length > 0 : null} label="Chemical-handling training at the site" detail={hazardous ? (trained.length ? `In date: ${trained.map(fullName).join(', ')}` : 'No cleaner based at this site holds in-date training') : 'Not required for this item'} />
        </ul>
        {problems.length > 0 && <ul className="problem-list muted-note">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        {short && (
          <div style={{ marginTop: 12 }} data-testid="issue-fix">
            <Notice tone="amber">
              Two ways to get this moving: issue what is in store now, or receive a delivery first.
              {onOrder.length > 0
                ? <> {onOrder.map((po) => `${po.ref} for ${num(po, 'qty')}${str(po, 'expected') ? ` (expected ${formatDate(str(po, 'expected'))})` : ''}`).join(', ')} {onOrder.length === 1 ? 'is' : 'are'} on order — {hasModule('purchasing') ? <Link to={`${base}/purchasing/${onOrder[0].id}`}>open it and press “Receive into store”</Link> : 'the stores clerk receives it under Purchase orders'}.</>
                : <> Nothing is on order for this item — {hasModule('purchasing') ? <Link to={`${base}/purchasing`}>raise a purchase order</Link> : 'the stores clerk raises a purchase order'}.</>}
            </Notice>
            {inStore > 0 && can('stores.request') && (
              <button className="btn sm" style={{ marginTop: 8 }} data-testid="reduce-qty"
                onClick={() => { act.update('issues', id, { qty: inStore }, `Quantity reduced from ${num(r, 'qty')} to the ${inStore} in store`); act.toast(`${r.ref} reduced to ${inStore} — ready to issue`); }}>
                Reduce the request to the {inStore} in store
              </button>
            )}
          </div>
        )}
        {untrained && <p className="muted-note" style={{ marginTop: 10 }}>To clear the training check, a cleaner based at this site needs an in-date “Chemical handling” date on their staff record (Staff → open the cleaner → Edit). Otherwise decline the request with a note.</p>}
      </Panel>
      {site && budget && (
        <Panel title="Site consumables budget" meta={`${str(site, 'name')} · this month at cost`}>
          <Meters format={(n) => randOf(n)} items={[{ label: open ? 'Issued so far + this request' : 'Issued this month', value: after, max: budget.budget || undefined, tone: budget.budget && after > budget.budget ? 'red' : 'green', sub: budget.budget ? `${Math.round((after / budget.budget) * 100)}% of budget · this issue ${randOf(issueValue(r, data))}` : 'No budget set' }]} />
        </Panel>
      )}
    </>
  );
}
