import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Flags, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { RecordTable, WorkflowActions } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { INSPECTION_INTERVAL_DAYS } from '../data';
import { daysSinceInspection, inspectionOverdue, inspectionScore, siteName } from '../helpers';
import { useClock } from './format';

export default function Inspections() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { user, can } = useUser();
  const { today, time } = useClock();
  const def = act.def('inspections');
  const actionDef = act.def('actions');
  const [creating, setCreating] = useState<Values | null>(null);
  const all = [...records(data, 'inspections')].sort(def.sort);
  const sites = records(data, 'sites');
  const overdue = sites.filter((s) => inspectionOverdue(data, s.id, today)).sort((a, b) => (daysSinceInspection(data, b.id, today) ?? 999) - (daysSinceInspection(data, a.id, today) ?? 999));
  const month = all.filter((i) => i.status === 'submitted' && str(i, 'date') >= addDays(today, -30));
  const avg = month.length ? Math.round(month.reduce((n, i) => n + inspectionScore(i).pct, 0) / month.length) : 0;
  const actions = records(data, 'actions').filter((a) => a.status === 'open').sort(actionDef.sort);
  const begin = (site?: string) => setCreating({ site: site ?? '', date: today, time, inspector: user.name });

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Sites & guarding`} title="Site inspections" subtitle={`Supervisor visits scored on five checks. Anything below satisfactory raises a corrective action. Every site should be inspected at least every ${INSPECTION_INTERVAL_DAYS} days.`}
        actions={can('inspections') ? <button className="btn primary" onClick={() => begin()} data-testid="new-record"><IcoPlus /> New inspection</button> : undefined} />
      <div className="stat-grid">
        <Stat label="Inspections (30 days)" value={month.length} sub={`${all.filter((i) => i.status === 'draft').length} still in progress`} />
        <Stat label="Average score" value={`${avg}%`} tone={avg < 85 ? 'red' : 'accent'} sub="submitted inspections, last 30 days" />
        <Stat label="Sites overdue" value={overdue.length} tone={overdue.length ? 'red' : undefined} sub={`not inspected in ${INSPECTION_INTERVAL_DAYS} days`} />
        <Stat label="Open corrective actions" value={actions.length} tone={actions.some((a) => str(a, 'due') < today) ? 'red' : undefined} sub={`${actions.filter((a) => str(a, 'due') < today).length} past their due date`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Open corrective actions" meta="Raised automatically from inspection findings">
          {actions.length ? (
            <ul className="list" data-testid="actions-list">
              {actions.map((a) => (
                <li key={a.id}>
                  <div className="grow">
                    <b>{str(a, 'description')}</b>
                    <small>{a.ref} · {siteName(data, a.values.site)} · {str(a, 'owner')} · due {formatDate(str(a, 'due'))}</small>
                    <Flags flags={actionDef.flags?.(a, data, today) ?? []} />
                  </div>
                  <WorkflowActions def={actionDef} record={a} compact />
                </li>
              ))}
            </ul>
          ) : <Empty title="No open corrective actions" />}
        </Panel>
        <Panel title="Sites overdue for inspection" meta={`Last submitted inspection more than ${INSPECTION_INTERVAL_DAYS} days ago`}>
          {overdue.length ? (
            <ul className="list" data-testid="overdue-sites">
              {overdue.map((s) => (
                <li key={s.id}>
                  <span className="dot red" />
                  <div className="grow"><Link to={`${base}/sites/${s.id}`}><b>{str(s, 'name')}</b></Link><small>{daysSinceInspection(data, s.id, today) === null ? 'Never inspected' : `${daysSinceInspection(data, s.id, today)} days since the last inspection`}</small></div>
                  {can('inspections') && <button className="btn sm" onClick={() => begin(s.id)}>Inspect</button>}
                </li>
              ))}
            </ul>
          ) : <Empty title="Every site inspected in time" />}
        </Panel>
      </div>
      <Panel title="Inspections" meta="Newest first">
        <RecordTable def={def} rows={all} moduleKey="inspections" />
      </Panel>
      {creating && (
        <RecordFormModal def={def} open title="New site inspection" initial={creating} onClose={() => setCreating(null)}
          onSave={(v) => {
            const r = act.create('inspections', v, 'draft', 'Inspection started');
            act.toast(`${r.ref} started — score the checklist and submit`);
            setCreating(null);
            navigate(`${base}/inspections/${r.id}`);
          }} />
      )}
    </>
  );
}
