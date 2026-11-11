import { useParams } from 'react-router-dom';
import { useData } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { Meters, Panel, Tag } from '../../../core/components/ui';
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
  return (
    <>
      <Panel title="Issue checks" meta="What the store checks before stock leaves" right={open ? <Tag tone={problems.length ? 'red' : 'green'}>{problems.length ? 'Cannot issue yet' : 'Ready to issue'}</Tag> : undefined}>
        <ul className="list" data-testid="issue-checks">
          <Check ok={open ? !!item && num(r, 'qty') <= num(item, 'qty') : null} label="Enough in store" detail={item ? `${num(item, 'qty')} × ${str(item, 'unit')} in store · ${num(r, 'qty')} requested` : 'No item selected'} />
          <Check ok={hazardous ? item?.values.sdsOnFile === true : null} label="Safety data sheet on file" detail={hazardous ? 'Hazardous chemical — an SDS must be on file (illustrative flag)' : 'Not a hazardous chemical'} />
          <Check ok={hazardous ? trained.length > 0 : null} label="Chemical-handling training at the site" detail={hazardous ? (trained.length ? `In date: ${trained.map(fullName).join(', ')}` : 'No cleaner based at this site holds in-date training') : 'Not required for this item'} />
        </ul>
        {problems.length > 0 && <ul className="problem-list muted-note">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      </Panel>
      {site && budget && (
        <Panel title="Site consumables budget" meta={`${str(site, 'name')} · this month at cost`}>
          <Meters format={(n) => randOf(n)} items={[{ label: open ? 'Issued so far + this request' : 'Issued this month', value: after, max: budget.budget || undefined, tone: budget.budget && after > budget.budget ? 'red' : 'green', sub: budget.budget ? `${Math.round((after / budget.budget) * 100)}% of budget · this issue ${randOf(issueValue(r, data))}` : 'No budget set' }]} />
        </Panel>
      )}
    </>
  );
}
