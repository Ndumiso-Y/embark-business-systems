import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { RecordTable, WorkflowActions } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { completionDue, overdueMilestones, programmeProgress, projectName, taskSlip, tasksFor, todayStr } from '../helpers';
import { Gantt } from './shared';

export default function Programme() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { can } = useUser();
  const today = todayStr();
  const def = act.def('tasks');
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);

  const withTasks = records(data, 'projects').filter((p) => tasksFor(data, p.id).length > 0)
    .sort((a, b) => ['onsite', 'practical', 'onhold', 'awarded'].indexOf(a.status ?? '') - ['onsite', 'practical', 'onhold', 'awarded'].indexOf(b.status ?? ''));
  const selectedId = params.get('project') && withTasks.some((p) => p.id === params.get('project')) ? params.get('project')! : withTasks[0]?.id;
  const project = withTasks.find((p) => p.id === selectedId);
  const prog = project ? programmeProgress(data, project, today) : null;
  const milestones = overdueMilestones(data, today);
  const slipping = records(data, 'tasks')
    .map((t) => ({ t, s: taskSlip(t, today) }))
    .filter(({ t, s }) => (s.state === 'overdue' || s.state === 'behind') && records(data, 'projects').find((p) => p.id === str(t, 'project'))?.status !== 'onhold')
    .sort((a, b) => b.s.days - a.s.days || b.s.gap - a.s.gap);

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Projects`} title="Programme & milestones" subtitle="Planned against actual dates and % complete for each project. Bars are scaled to the calendar; the red line is today."
        actions={can('programme') && project ? <button className="btn primary" onClick={() => setCreating(true)} data-testid="new-record"><IcoPlus /> Add task</button> : undefined} />
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <label className="muted-note" htmlFor="programme-project">Project</label>
        <select id="programme-project" className="select" style={{ width: 'auto', maxWidth: '100%' }} aria-label="Select project" value={selectedId ?? ''} onChange={(e) => setParams({ project: e.target.value })}>
          {withTasks.map((p) => <option key={p.id} value={p.id}>{str(p, 'name')} · {p.ref}</option>)}
        </select>
        {project && <Link className="btn sm" to={`${base}/projects/${project.id}`}>Project page</Link>}
      </div>
      {project && prog ? (
        <>
          <div className="stat-grid">
            <Stat label="Programme complete" value={`${prog.pct}%`} tone={prog.elapsed - prog.pct > 10 ? 'red' : 'accent'} sub="duration-weighted across tasks" />
            <Stat label="Contract time elapsed" value={`${prog.elapsed}%`} sub={`completion ${formatDate(completionDue(project))}${num(project, 'eotDaysGranted') ? ` incl. ${num(project, 'eotDaysGranted')} d EOT` : ''}`} />
            <Stat label="Overdue tasks" value={prog.overdue.length} tone={prog.overdue.length ? 'red' : undefined} sub={`${prog.behind.length} slipping (> 15 pts behind plan)`} />
            <Stat label="Overdue milestones (all projects)" value={milestones.length} tone={milestones.length ? 'red' : undefined} sub={milestones.map((m) => projectName(data, m.values.project)).join(' · ') || 'None'} />
          </div>
          <div className="section-gap" />
          <Panel title={str(project, 'name')} meta={`${prog.tasks.length} tasks · ${formatDate(str(project, 'startDate'))} → ${formatDate(completionDue(project))}${project.status === 'onhold' ? ' · ON HOLD' : ''}`}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 520 }}>
                <Gantt project={project} tasks={prog.tasks} today={today} linkBase={`${base}/programme`} />
              </div>
            </div>
          </Panel>
        </>
      ) : <Panel><Empty title="No programmes yet" body="Add tasks to a project to see its programme." /></Panel>}
      <div className="grid-2">
        <Panel title="Slipping and overdue (all live projects)" meta="Overdue = past planned finish and not complete · slipping = more than 15 points behind the time-based expectation">
          {slipping.length ? (
            <ul className="list" data-testid="slipping-list">
              {slipping.slice(0, 10).map(({ t, s }) => (
                <li key={t.id}>
                  <span className={`dot ${s.state === 'overdue' ? 'red' : 'amber'}`} />
                  <div className="grow">
                    <Link to={`${base}/programme/${t.id}`}><b>{str(t, 'name')}</b></Link>
                    <small>{projectName(data, t.values.project)} · {s.state === 'overdue' ? `overdue ${s.days} d (planned ${formatDate(str(t, 'plannedFinish'))})` : `${num(t, 'pctComplete')}% done, ${s.gap} pts behind`}</small>
                  </div>
                  <WorkflowActions def={def} record={t} compact />
                </li>
              ))}
            </ul>
          ) : <Empty title="Nothing slipping" />}
        </Panel>
        <Panel title="How progress is measured" meta="Demo rules">
          <ul className="boundary-list">
            <li>Programme % complete is weighted by each task’s planned duration; milestones carry no weight.</li>
            <li>Time elapsed runs from start on site to planned completion plus any extension of time granted.</li>
            <li>A task is slipping when its % complete trails the straight-line expectation by more than 15 points.</li>
            <li>Not a scheduling tool — no critical path, logic links or resource levelling.</li>
          </ul>
        </Panel>
      </div>
      {project && (
        <Panel title="Tasks" meta={str(project, 'name')}>
          <RecordTable def={def} rows={prog?.tasks ?? []} moduleKey="programme" />
        </Panel>
      )}
      {creating && project && (
        <RecordFormModal def={def} open title={`Add task — ${str(project, 'name')}`} initial={{ project: project.id, plannedStart: today, plannedFinish: today, pctComplete: 0, milestone: false }}
          onClose={() => setCreating(false)}
          onSave={(v) => { const r = act.create('tasks', v, 'planned', 'Task added to programme'); act.toast(`Task ${r.ref} added`); setCreating(false); navigate(`${base}/programme/${r.id}`); }} />
      )}
    </>
  );
}
