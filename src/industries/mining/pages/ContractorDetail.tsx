import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { DueTag, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { contractorClearance, contractorExpiries, todayStr } from '../helpers';

export default function ContractorDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'contractors', id);
  return <RecordDetail aside={c ? <Clearance id={c.id} /> : undefined} />;
}

function Clearance({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const c = findRecord(data, 'contractors', id)!;
  const clearance = contractorClearance(c, today);
  const permits = records(data, 'permits').filter((p) => str(p, 'contractor') === id && !['closed', 'cancelled'].includes(p.status ?? ''));
  const renew = (key: string, what: string) => {
    act.update('contractors', id, { [key]: addDays(today, 365) }, `${what} recorded — valid to ${formatDate(addDays(today, 365))}`);
    act.toast(`${what} renewed for 12 months (demo)`);
  };
  return (
    <>
      <Panel title="Site clearance" right={<Tag tone={clearance.cleared ? 'green' : 'red'}>{clearance.cleared ? 'Cleared for site' : 'Not cleared for site'}</Tag>}>
        {!clearance.cleared && <Notice tone="red">{clearance.reasons.join('; ')}. Access should be refused until renewed.</Notice>}
        <ul className="list" data-testid="contractor-expiries">
          {contractorExpiries(c, today).map((e) => (
            <li key={e.key}>
              <div className="grow"><b>{e.label}</b><small>{e.date ? `Expires ${formatDate(e.date)}` : 'Not recorded'}</small></div>
              <DueTag state={e.state} label={e.state === 'overdue' ? `Expired ${daysBetween(e.date, today)} d ago` : e.state === 'due-soon' ? `${daysBetween(today, e.date)} days left` : undefined} />
            </li>
          ))}
        </ul>
        {can('contractors') && (
          <div className="btns" style={{ marginTop: 12 }}>
            <button className="btn sm" onClick={() => renew('inductionExpiry', 'Site induction')}>Record induction today</button>
            <button className="btn sm" onClick={() => renew('medicalExpiry', 'Medical fitness')}>Record medical today</button>
          </div>
        )}
        <p className="muted-note" style={{ marginTop: 10 }}>Clearance needs a current induction and medical fitness. A lapsed competency certificate restricts the trade work, not site access.</p>
      </Panel>
      {permits.length > 0 && (
        <Panel title="Open permits" meta="Permits naming this contractor">
          <ul className="list">{permits.map((p) => <li key={p.id}><div className="grow"><b>{p.ref}</b><small>{str(p, 'description')}</small></div></li>)}</ul>
        </Panel>
      )}
    </>
  );
}
