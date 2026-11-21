import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Notice, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RATINGS, label } from '../data';
import { empName, fullName } from '../helpers';
import { ModuleLink, WhoCan } from './shared';

/** A requisition with its approval rule spelled out and the applicants for it. */
export default function RequisitionDetail() {
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const r = findRecord(data, 'requisitions', id);
  if (!r) return <RecordDetail />;
  const apps = records(data, 'applicants').filter((a) => str(a, 'requisition') === r.id);
  const appDef = act.def('applicants');
  const needsMd = r.status === 'draft' && !r.values.budgeted;
  return (
    <RecordDetail backLabel="Requisitions">
      {r.status === 'draft' && (
        <Panel title="Approval" meta="Who may open this position">
          <Notice tone={needsMd ? 'amber' : 'accent'}>
            {needsMd ? 'This position is not in the approved headcount budget, so only the managing director can approve it. HR can prepare it but not open it.'
              : 'Budgeted position: HR can approve and open it for applications.'} Hiring manager: {empName(data, str(r, 'hiringManager'))}.
          </Notice>
          {needsMd && !can('hiring.unbudgeted') && <WhoCan permission="hiring.unbudgeted" what="Approving an unbudgeted post:" />}
        </Panel>
      )}
      <Panel title="Applicants" meta={`${apps.length} for this position`}>
        {apps.length ? (
          <ul className="list" data-testid="req-applicants">
            {apps.map((a) => (
              <li key={a.id}>
                <div className="grow"><b><ModuleLink module="applicants" id={a.id}>{fullName(a)}</ModuleLink></b>
                  <small>{a.ref} · applied {formatDate(str(a, 'appliedOn'))}{str(a, 'interviewScore') ? ` · interview ${label(RATINGS, str(a, 'interviewScore'))}` : ''}</small></div>
                <StatusTag workflow={appDef.workflow} status={a.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No applicants yet" body={r.status === 'open' ? 'Add applicants under Applicants → New applicant.' : 'Applicants can be added once the position is open.'} />}
      </Panel>
    </RecordDetail>
  );
}
