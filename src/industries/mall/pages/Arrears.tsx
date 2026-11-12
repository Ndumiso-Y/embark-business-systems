import { Link, useNavigate } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { permissionHint, records, str } from '../../../core/engine';
import { Empty, Notice, PageHeader, Panel, Stat, StatusTag, Tag } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { AGE_BUCKETS, ageing, arrearsList, leaseUnit, plural, rand, randBig, shopLabel, todayStr } from '../helpers';
import { RecLink } from './shared';

/** Arrears ageing per tenant, with the credit-control case for each. */
export default function Arrears() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const base = useBase();
  const navigate = useNavigate();
  const { can } = useUser();
  const today = todayStr();
  const def = act.def('cases');
  const list = arrearsList(data, today);
  const total = ageing(records(data, 'invoices'), today);
  const cases = [...records(data, 'cases')].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = (leaseId: string) => {
    const c = act.create('cases', { lease: leaseId, openedOn: today }, 'open');
    act.toast(`Case ${c.ref} opened — start with the reminder`);
    navigate(`${base}/arrears/${c.id}`);
  };
  return (
    <>
      <PageHeader kicker={`${config.businessName} / Finance`} title="Arrears & credit control" subtitle="Who owes what and for how long, and the steps taken with each tenant: reminder, letter of demand, payment arrangement, hand-over. Nothing is sent from this demo and interest is not calculated." />
      <div className="stat-grid">
        <Stat label="Total overdue" value={randBig(total.overdue)} tone={total.overdue ? 'red' : undefined} sub={`${plural(list.length, 'tenant')} past the due date`} />
        <Stat label="1–30 days" value={randBig(total.d30)} sub="first reminder stage" />
        <Stat label="31–90 days" value={randBig(total.d60 + total.d90)} sub={`${randBig(total.d60)} at 31–60 · ${randBig(total.d90)} at 61–90`} />
        <Stat label="Over 90 days" value={randBig(total.d90plus)} tone={total.d90plus ? 'red' : undefined} sub="demand, arrangement or hand-over" />
      </div>
      <Panel title="Arrears ageing by tenant" meta="Unpaid balances on issued invoices, by days past the due date · worst first">
        {list.length ? (
          <div className="table-wrap">
            <table className="table" data-testid="arrears-table">
              <thead><tr><th>Tenant</th><th className="num">Overdue</th>{AGE_BUCKETS.map((b) => <th key={b.key} className="num">{b.label}</th>)}<th className="num">Oldest</th><th>Credit control</th></tr></thead>
              <tbody>
                {list.map(({ lease, age, caseRec }) => (
                  <tr key={lease.id} data-testid={`arrears-${lease.id}`}>
                    <td><RecLink module="leases" id={lease.id}><strong>{str(lease, 'tenant')}</strong></RecLink><small>{shopLabel(leaseUnit(data, lease))} · {lease.ref}{lease.status === 'vacated' ? ' · vacated' : ''}</small></td>
                    <td className="num"><b>{rand(age.overdue)}</b></td>
                    {AGE_BUCKETS.map((b) => <td key={b.key} className="num">{age[b.key] ? rand(age[b.key]) : '—'}</td>)}
                    <td className="num">{age.oldest} d</td>
                    <td>
                      {caseRec ? <Link to={`${base}/arrears/${caseRec.id}`}><StatusTag workflow={def.workflow} status={caseRec.status} /> <small>{caseRec.ref}</small></Link>
                        : can('credit.control') ? <button className="btn sm" onClick={() => open(lease.id)} data-testid={`open-case-${lease.id}`}>Open case</button> : <Tag tone="amber">No case yet</Tag>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="Nobody is in arrears" body="Every issued invoice is paid or not yet due." />}
        {!can('credit.control') && <div style={{ marginTop: 12 }}><Notice tone="grey">{permissionHint(config, data, 'credit.control')}</Notice></div>}
      </Panel>
      <div className="section-gap" />
      <Panel title="Credit-control cases" meta="Open and closed cases · newest first">
        {cases.length ? <RecordTable def={def} rows={cases} moduleKey="arrears" /> : <Empty title="No cases yet" />}
      </Panel>
    </>
  );
}
