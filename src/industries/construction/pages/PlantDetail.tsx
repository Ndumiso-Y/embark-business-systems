import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { addDays, daysBetween, dueState, formatDate } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { DueTag, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { PLANT_STATES, label } from '../data';
import { isHired, onHire, plantAlerts, plantCostThisMonth, plantHireDays, plantRunningCost, projectName, rand, todayStr } from '../helpers';

export default function PlantDetail() {
  const { id } = useParams();
  const data = useData();
  const p = findRecord(data, 'plant', id);
  return <RecordDetail aside={p ? <Aside id={p.id} /> : undefined} />;
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const p = findRecord(data, 'plant', id)!;
  const hired = isHired(p);
  const live = onHire(p, today);
  const alerts = plantAlerts(p, today);
  const set = (values: Record<string, string>, action: string) => { act.update('plant', id, values, action); act.toast(`${str(p, 'fleetNo')}: ${action}`); };
  const project = str(p, 'project');
  return (
    <>
      <Panel title={hired ? 'Hire' : 'Owned plant'} right={<Tag tone={str(p, 'state') === 'working' ? 'green' : str(p, 'state') === 'offhired' || str(p, 'state') === 'yard' ? 'dark' : 'amber'}>{label(PLANT_STATES, str(p, 'state'))}</Tag>}>
        <KeyValues items={[
          { label: 'Location', value: project ? (hasModule('projects') ? <Link to={`${base}/projects/${project}`}>{projectName(data, project)}</Link> : projectName(data, project)) : 'Yard' },
          ...(hired ? [
            { label: 'Hire company', value: str(p, 'hireCompany') },
            { label: 'Daily rate', value: rand(toCents(num(p, 'dailyRate'))) },
            { label: 'On hire from', value: formatDate(str(p, 'hireStart')) },
            { label: 'Days on hire', value: plantHireDays(p, str(p, 'hireStart'), today) },
            { label: 'Running hire cost', value: <b>{rand(toCents(plantRunningCost(p, today)))}</b> },
            { label: 'This month', value: rand(toCents(plantCostThisMonth(p, today))) },
            { label: 'Planned off-hire', value: str(p, 'offHireDue') ? <>{formatDate(str(p, 'offHireDue'))} {live && <DueTag state={dueState(str(p, 'offHireDue'), today, 7)} label={str(p, 'offHireDue') < today ? `${daysBetween(str(p, 'offHireDue'), today)} d overdue` : undefined} />}</> : '—' },
            { label: 'Off-hired on', value: formatDate(str(p, 'offHiredOn')) },
          ] : []),
          { label: 'Next service', value: str(p, 'nextServiceDue') ? formatDate(str(p, 'nextServiceDue')) : '—' },
        ]} />
        {alerts.length > 0 && <div style={{ marginTop: 12 }}><Notice tone={alerts.some((a) => a.tone === 'red') ? 'red' : 'amber'}>{alerts.map((a) => a.label).join(' · ')}.{live && str(p, 'state') === 'idle' ? ' Idle hired plant still costs the daily rate — off-hire it or move it to another site.' : ''}</Notice></div>}
        {can('plant') && (
          <div className="btns" style={{ marginTop: 12 }}>
            {str(p, 'state') !== 'working' && str(p, 'state') !== 'offhired' && <button className="btn sm" onClick={() => set({ state: 'working' }, 'Marked working')}>Mark working</button>}
            {str(p, 'state') === 'working' && <button className="btn sm" onClick={() => set({ state: 'idle' }, 'Marked standing idle')}>Mark idle</button>}
            {live && <button className="btn sm primary" onClick={() => set({ state: 'offhired', offHiredOn: today }, `Off-hired ${formatDate(today)} — hire company to collect`)} data-testid="off-hire">Off-hire today</button>}
            {str(p, 'state') !== 'offhired' && <button className="btn sm" onClick={() => set({ nextServiceDue: addDays(today, 90) }, `Service recorded — next due ${formatDate(addDays(today, 90))}`)}>Record service</button>}
          </div>
        )}
        <p className="muted-note" style={{ marginTop: 10 }}>Hire cost = daily rate × calendar days on hire (demo rule; no weekend or breakdown credits).</p>
      </Panel>
    </>
  );
}
