import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { records, searchText, str } from '../../../core/engine';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { addDays } from '../../../core/lib/dates';
import { IcoSearch } from '../../../core/components/Icons';
import { Empty, PageHeader, Panel, Pipeline, Stat, StatusTag } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { JOB_LIVE, SUB_LIVE, clientName, plural, sentFor, submissionsFor, todayStr } from '../helpers';
import { JobBoard, LonglistForm } from './board';

/** Pipeline: pick a job and work its board; every submission is listed underneath. */
export default function PipelinePage() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const today = todayStr();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const subDef = config.collections.find((c) => c.key === 'submissions')!;
  const jobDef = config.collections.find((c) => c.key === 'jobs')!;
  const subs = records(data, 'submissions');
  const liveJobs = records(data, 'jobs').filter((j) => ['draft', ...JOB_LIVE].includes(j.status ?? ''))
    .sort((a, b) => submissionsFor(data, b.id).length - submissionsFor(data, a.id).length || a.ref.localeCompare(b.ref));
  const jobId = params.get('job') && liveJobs.some((j) => j.id === params.get('job')) ? params.get('job')! : liveJobs[0]?.id;
  const job = liveJobs.find((j) => j.id === jobId);
  const live = subs.filter((s) => SUB_LIVE.includes(s.status ?? ''));
  const sentThisWeek = subs.filter((s) => str(s, 'submittedOn') && str(s, 'submittedOn') > addDays(today, -7)).length;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...subs].sort(subDef.sort).filter((s) => !needle || searchText(subDef, s, data).includes(needle));
  }, [subs, subDef, data, q]);
  return (
    <>
      <PageHeader kicker={`${config.businessName} / Desk`} title="Pipeline" subtitle={config.modules.find((m) => m.key === 'pipeline')!.description} />
      <div className="stat-grid">
        <Stat label="Candidates in play" value={live.length} tone="accent" sub={`across ${plural(liveJobs.filter((j) => JOB_LIVE.includes(j.status ?? '')).length, 'live job')}`} />
        <Stat label="CVs sent · last 7 days" value={sentThisWeek} sub={`${subs.filter((s) => s.status === 'longlist').length} longlisted, not yet sent`} />
        <Stat label="At interview" value={subs.filter((s) => ['interview', 'final'].includes(s.status ?? '')).length} sub={`${subs.filter((s) => s.status === 'final').length} at final interview`} />
        <Stat label="Offers out" value={subs.filter((s) => s.status === 'offer').length} tone={subs.some((s) => s.status === 'offer') ? 'accent' : undefined} sub="awaiting the candidate’s answer" />
      </div>
      <Panel title="All live jobs by stage" meta="Candidates at each stage across every open job order">
        <Pipeline stages={subDef.workflow!.states.filter((s) => !s.terminal).map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: subs.filter((x) => x.status === s.key).length }))} />
      </Panel>
      <div className="section-gap" />
      <Panel title="Board" meta="Choose a job order to work its pipeline">
        {job ? (
          <>
            <div className="rc-jobpick">
              <select className="select" aria-label="Job order" value={job.id} onChange={(e) => setParams({ job: e.target.value }, { replace: true })} data-testid="board-job">
                {liveJobs.map((j) => <option key={j.id} value={j.id}>{str(j, 'title')} · {clientName(data, str(j, 'client'))} ({submissionsFor(data, j.id).filter((s) => !['rejected', 'withdrawn'].includes(s.status ?? '')).length})</option>)}
              </select>
              <StatusTag workflow={jobDef.workflow} status={job.status} />
              <small className="muted-note">{job.ref} · {plural(sentFor(data, job.id).length, 'CV')} sent</small>
              {hasModule('jobs') && <Link className="btn sm" to={`${base}/jobs/${job.id}`}>Open job order</Link>}
            </div>
            <JobBoard jobId={job.id} />
            <LonglistForm job={job} />
          </>
        ) : <Empty title="No live job orders" body="Open a job order to start a pipeline." />}
      </Panel>
      <div className="section-gap" />
      <Panel title="All submissions" meta="Every candidate × job, newest first — open one for interviews, offers and the ownership record">
        <div className="toolbar">
          <label className="search-box"><IcoSearch /><input aria-label="Search submissions" placeholder="Search submissions" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <span className="toolbar-count">{rows.length} shown</span>
        </div>
        <RecordTable def={subDef} rows={rows} moduleKey="pipeline" />
      </Panel>
    </>
  );
}

