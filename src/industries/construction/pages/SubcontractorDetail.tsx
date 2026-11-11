import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { DueTag, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { projectName, subcontractorCompliance, subcontractorExpiries, todayStr } from '../helpers';

export default function SubcontractorDetail() {
  const { id } = useParams();
  const data = useData();
  const s = findRecord(data, 'subcontractors', id);
  return <RecordDetail aside={s ? <Compliance id={s.id} /> : undefined} />;
}

function Compliance({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const s = findRecord(data, 'subcontractors', id)!;
  const c = subcontractorCompliance(s, today);
  const renew = (key: string, what: string) => {
    act.update('subcontractors', id, { [key]: addDays(today, 365) }, `${what} recorded — valid to ${formatDate(addDays(today, 365))} (demo, not verified)`);
    act.toast(`${what} recorded for 12 months (demo)`);
  };
  const variations = records(data, 'variations').filter((v) => str(v, 'subcontractor') === id && !['approved', 'rejected'].includes(v.status ?? ''));
  const tasks = records(data, 'tasks').filter((t) => str(t, 'subcontractor') === id && t.status !== 'complete');
  const snags = records(data, 'snags').filter((x) => str(x, 'responsible') === id && x.status !== 'verified');
  return (
    <>
      <Panel title="Compliance" right={<Tag tone={c.ok ? 'green' : 'red'}>{c.ok ? 'Compliant' : 'Not compliant'}</Tag>}>
        {!c.ok && <Notice tone="red">{c.reasons.join('; ')}. This subcontractor cannot be assigned to a variation until resolved.</Notice>}
        <ul className="list" data-testid="sub-expiries">
          {subcontractorExpiries(s, today).map((e) => (
            <li key={e.key}>
              <div className="grow"><b>{e.label}</b><small>{e.date ? `Expires ${formatDate(e.date)}` : 'Not recorded'}</small></div>
              <DueTag state={e.state} label={e.state === 'overdue' ? `Expired ${daysBetween(e.date, today)} d ago` : e.state === 'due-soon' ? `${daysBetween(today, e.date)} days left` : 'Valid'} />
            </li>
          ))}
          <li>
            <div className="grow"><b>Safety file</b><small>Reviewed by the safety officer</small></div>
            <Tag tone={s.values.safetyFileApproved === true ? 'green' : 'amber'}>{s.values.safetyFileApproved === true ? 'Approved' : 'Not approved'}</Tag>
          </li>
        </ul>
        {can('subcontractors') && (
          <div className="btns" style={{ marginTop: 12 }}>
            <button className="btn sm" onClick={() => renew('coidaExpiry', 'COIDA letter of good standing')}>Record new COIDA letter</button>
            <button className="btn sm" onClick={() => renew('taxExpiry', 'Tax compliance status')}>Record tax compliance</button>
            {s.values.safetyFileApproved !== true && <button className="btn sm" onClick={() => { act.update('subcontractors', id, { safetyFileApproved: true }, 'Safety file approved'); act.toast('Safety file approved (demo)'); }}>Approve safety file</button>}
          </div>
        )}
        <p className="muted-note" style={{ marginTop: 10 }}>Demo only: nothing is verified with CIDB, the Compensation Fund or SARS.</p>
      </Panel>
      <Panel title="Current work" meta="Open variations, programme tasks and snags naming this subcontractor">
        {variations.length + tasks.length + snags.length ? (
          <ul className="list">
            {variations.map((v) => (
              <li key={v.id}><div className="grow">{hasModule('variations') ? <Link to={`${base}/variations/${v.id}`}><b>{v.ref} {str(v, 'description')}</b></Link> : <b>{v.ref}</b>}<small>Variation · {projectName(data, v.values.project)}</small></div><StatusTag workflow={act.def('variations').workflow} status={v.status} /></li>
            ))}
            {tasks.map((t) => (
              <li key={t.id}><div className="grow">{hasModule('programme') ? <Link to={`${base}/programme/${t.id}`}><b>{str(t, 'name')}</b></Link> : <b>{str(t, 'name')}</b>}<small>Programme task · {projectName(data, t.values.project)}</small></div></li>
            ))}
            {snags.map((x) => (
              <li key={x.id}><div className="grow">{hasModule('snags') ? <Link to={`${base}/snags/${x.id}`}><b>{str(x, 'description')}</b></Link> : <b>{str(x, 'description')}</b>}<small>Snag · {projectName(data, x.values.project)}</small></div></li>
            ))}
          </ul>
        ) : <p className="muted-note">No open work recorded.</p>}
      </Panel>
    </>
  );
}
