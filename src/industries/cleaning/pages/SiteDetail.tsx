import { Link, useParams } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { Empty, KeyValues, Meters, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { COMPLAINT_CATEGORIES, label } from '../data';
import {
  OPEN_COMPLAINT_STATES, attendance, budgetState, chemTrainedAt, clientName, contractEnding, forSite, inspectionScore, latestInspection, periodicDue,
  periodicLabel, randOf, slaTarget, staffName, staffing, taskList, todayStr, unstaffedCredit, weekShifts,
} from '../helpers';
import { ScoreTrend, StaffingTag } from './shared';

export default function SiteDetail() {
  const { id } = useParams();
  const data = useData();
  const site = findRecord(data, 'sites', id);
  return (
    <RecordDetail aside={site ? <Aside id={site.id} /> : undefined}>
      {site && <Main id={site.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const today = todayStr();
  const site = findRecord(data, 'sites', id)!;
  const shiftDef = config.collections.find((c) => c.key === 'shifts')!;
  const week = weekShifts(data, id, today);
  const att = attendance(week, data);
  const periodic = forSite(data, 'periodic', id).sort((a, b) => str(a, 'nextDue').localeCompare(str(b, 'nextDue')));
  const periodicDef = config.collections.find((c) => c.key === 'periodic')!;
  return (
    <>
      <Panel title="This week’s attendance" meta={`Last seven days · ${att.shifts ? `${att.pct}% of contracted cleaner-shifts worked` : 'no completed shifts yet'}`}
        right={hasModule('schedule') ? <Link className="btn sm" to={`${base}/schedule`}>Attendance board</Link> : undefined}>
        {week.length ? (
          <div className="table-wrap">
            <table className="table" data-testid="site-week">
              <thead><tr><th>Day</th><th>Shift</th><th>Staffing</th><th className="num">Late</th><th>Status</th></tr></thead>
              <tbody>
                {week.map((s) => {
                  const st = staffing(s, data);
                  return (
                    <tr key={s.id}>
                      <td><strong>{hasModule('schedule') ? <Link to={`${base}/schedule/${s.id}`}>{formatDate(str(s, 'date'))}</Link> : formatDate(str(s, 'date'))}</strong><small>{s.ref}{str(s, 'date') === today ? ' · today' : ''}</small></td>
                      <td>{str(s, 'start')}–{str(s, 'end')}</td>
                      <td><StaffingTag st={st} started={!['draft', 'scheduled'].includes(s.status ?? '')} />{st.absent > 0 && <small>{st.absent} absent</small>}</td>
                      <td className="num">{st.late.length}</td>
                      <td><StatusTag workflow={shiftDef.workflow} status={s.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No shifts in the last seven days" />}
      </Panel>
      <Panel title="Scope of work" meta="Areas and tasks by frequency. The daily list is the shift checklist.">
        <div className="grid-3" style={{ marginBottom: 0 }}>
          {([['dailyTasks', 'Daily'], ['weeklyTasks', 'Weekly'], ['monthlyTasks', 'Monthly']] as const).map(([key, title]) => (
            <div key={key}>
              <div className="panel-meta" style={{ marginBottom: 6 }}><b>{title}</b> · {taskList(site, key).length} tasks</div>
              <ul className="problem-list muted-note" style={{ lineHeight: 1.7 }}>{taskList(site, key).map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Periodic tasks" meta="Deep cleans on a cycle for this site" right={hasModule('periodic') ? <Link className="btn sm" to={`${base}/periodic`}>All periodic tasks</Link> : undefined}>
        {periodic.length ? (
          <ul className="list">
            {periodic.map((p) => {
              const due = periodicDue(p, today);
              return (
                <li key={p.id}>
                  <div className="grow">{hasModule('periodic') ? <Link to={`${base}/periodic/${p.id}`}><b>{periodicLabel(p)}</b></Link> : <b>{periodicLabel(p)}</b>}<small>Next due {formatDate(str(p, 'nextDue'))}{str(p, 'lastDone') ? ` · last done ${formatDate(str(p, 'lastDone'))}` : ''}</small></div>
                  {due === 'overdue' && <Tag tone="red">Overdue {daysBetween(str(p, 'nextDue'), today)} d</Tag>}
                  <StatusTag workflow={periodicDef.workflow} status={p.status} />
                </li>
              );
            })}
          </ul>
        ) : <Empty title="No periodic tasks for this site" />}
      </Panel>
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const today = todayStr();
  const month = today.slice(0, 7);
  const site = findRecord(data, 'sites', id)!;
  const last = latestInspection(data, id);
  const score = last ? inspectionScore(last) : null;
  const target = slaTarget(site);
  const complaints = forSite(data, 'complaints', id).filter((c) => OPEN_COMPLAINT_STATES.includes(c.status ?? ''));
  const budget = budgetState(data, site, month);
  const credit = unstaffedCredit(data, site, month);
  const ending = contractEnding(site, today);
  const trained = chemTrainedAt(data, site, today);
  return (
    <>
      <Panel title="Contract" right={score !== null ? <Tag tone={score < target ? 'red' : 'green'}>{score}% vs SLA {target}%</Tag> : undefined}>
        <KeyValues items={[
          { label: 'Client', value: clientName(data, site.values.client) },
          { label: 'Monthly fee', value: `${randOf(num(site, 'monthlyFee'))} excl. VAT` },
          { label: 'Contract', value: `${formatDate(str(site, 'contractStart'))} → ${formatDate(str(site, 'contractEnd'))}` },
          { label: 'Area supervisor', value: str(site, 'supervisor') ? staffName(data, site.values.supervisor) : '—' },
          { label: 'Credit this month', value: credit.cleanerShifts ? `${randOf(credit.amount)} (${credit.cleanerShifts} cleaner-shift${credit.cleanerShifts === 1 ? '' : 's'} not staffed)` : 'None' },
          { label: 'Chemical-trained cleaners', value: trained.length || 'None in date' },
        ]} />
        {ending !== null && <div style={{ marginTop: 12 }}><Notice tone="amber">{ending < 0 ? 'The contract end date has passed.' : `The contract ends in ${ending} days.`} {site.status === 'notice' ? 'The client has given notice.' : 'Agree the renewal and update the end date.'}</Notice></div>}
      </Panel>
      <Panel title="Inspection score trend" meta="Submitted inspections against the SLA target" right={hasModule('inspections') ? <Link className="btn sm" to={`${base}/inspections`}>Inspections</Link> : undefined}>
        <ScoreTrend data={data} site={site} />
      </Panel>
      <Panel title="Consumables this month" meta="Issued at cost against the monthly budget">
        <Meters format={(n) => randOf(n)} items={[{ label: 'Issued to site', value: budget.used, max: budget.budget || undefined, tone: budget.over ? 'red' : budget.pct > 85 ? 'amber' : 'green', sub: budget.budget ? `${budget.pct}% of budget${budget.over ? ' — over budget' : ''}` : 'No budget set' }]} />
      </Panel>
      <Panel title="Open complaints & requests" right={<Tag tone={complaints.length ? 'amber' : 'green'}>{complaints.length}</Tag>}>
        {complaints.length ? (
          <ul className="list">
            {complaints.map((c) => (
              <li key={c.id}><div className="grow">{hasModule('complaints') ? <Link to={`${base}/complaints/${c.id}`}><b>{label(COMPLAINT_CATEGORIES, str(c, 'category'))}</b></Link> : <b>{label(COMPLAINT_CATEGORIES, str(c, 'category'))}</b>}<small>{c.ref} · {formatDate(str(c, 'date'))} · {str(c, 'reportedBy')}</small></div></li>
            ))}
          </ul>
        ) : <Empty title="Nothing open" />}
      </Panel>
    </>
  );
}
