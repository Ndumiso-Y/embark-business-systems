import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Flags, KeyValues, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail, WorkflowActions } from '../../../core/components/records';
import { RecordFormModal, money } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { INSPECTION_INTERVAL_DAYS, OB_TYPES, SHIFT_SHORT, checkpointList, label } from '../data';
import {
  contractOfSite, coverage, currentSlot, daysSinceInspection, inspectionScore, lastInspection, officerName, rec, responseStats, shiftsIn, workingOfficerId,
} from '../helpers';
import { pctTone, useClock } from './format';

export default function SiteDetail() {
  const { id } = useParams();
  const data = useData();
  const s = rec(data, 'sites', id);
  return (
    <RecordDetail aside={s ? <Aside site={s} /> : undefined}>
      {s && <Body site={s} />}
    </RecordDetail>
  );
}

function Body({ site: s }: { site: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const { today } = useClock();
  const [adding, setAdding] = useState(false);
  const cur = currentSlot(today);
  const rosterDef = act.def('roster');
  const incidentDef = act.def('incidents');
  const posts = records(data, 'posts').filter((p) => str(p, 'site') === s.id);
  const day = coverage(data, today, 'day', s.id);
  const night = coverage(data, today, 'night', s.id);
  const total = day.posts + night.posts;
  const covered = day.covered + night.covered;
  const p = total ? Math.round((covered / total) * 100) : 0;
  const shiftFor = (post: DemoRecord) => shiftsIn(data, today, str(post, 'shift') === 'night' ? 'night' : 'day').find((r) => str(r, 'post') === post.id);
  const open = records(data, 'incidents').filter((i) => str(i, 'site') === s.id && i.status !== 'closed').sort(incidentDef.sort);
  const ob = records(data, 'ob').filter((e) => str(e, 'site') === s.id).sort(act.def('ob').sort).slice(0, 5);
  return (
    <>
      <Panel title="Today’s coverage" meta={`${formatDate(today)} · day and night posts · ${SHIFT_SHORT[cur.kind].toLowerCase()} shift on duty`} right={<Tag tone={pctTone(p)}>{covered}/{total} posts · {p}%</Tag>}>
        {posts.length ? (
          <div className="table-wrap">
            <table className="table" data-testid="site-coverage">
              <thead><tr><th>Post</th><th>Requires</th><th>Officer today</th><th className="num">Monthly rate</th><th>Status</th></tr></thead>
              <tbody>
                {posts.map((post) => {
                  const r = shiftFor(post);
                  return (
                    <tr key={post.id}>
                      <td><strong>{str(post, 'name')}</strong><small>{SHIFT_SHORT[str(post, 'shift')] ?? 'Day'} shift</small></td>
                      <td>Grade {str(post, 'grade')}{post.values.armed === true ? ' · armed' : ''}</td>
                      <td>{r ? (hasModule('roster') ? <Link to={`${base}/roster/${r.id}`}>{workingOfficerId(r) ? officerName(data, workingOfficerId(r)) : r.status === 'absent' ? 'Absent — no relief' : 'Unfilled'}</Link> : officerName(data, workingOfficerId(r))) : 'Not rostered'}</td>
                      <td className="num">{money(num(post, 'monthlyRate'))}</td>
                      <td>{r ? <StatusTag workflow={rosterDef.workflow} status={r.status} /> : <Tag tone="dark">—</Tag>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No posts on this site yet" />}
        {can('contracts') && <div className="btns" style={{ marginTop: 12 }}><button className="btn sm" onClick={() => setAdding(true)}><IcoPlus /> Add post</button></div>}
      </Panel>
      <Panel title="Open incidents" meta={`${open.length} not yet closed`}>
        {open.length ? (
          <ul className="list" data-testid="site-incidents">
            {open.map((i) => (
              <li key={i.id}>
                <div className="grow">
                  {hasModule('incidents') ? <Link to={`${base}/incidents/${i.id}`}><b>{str(i, 'title')}</b></Link> : <b>{str(i, 'title')}</b>}
                  <small>{i.ref} · {formatDate(str(i, 'date'))} {str(i, 'time')}</small>
                  <Flags flags={incidentDef.flags?.(i, data, today) ?? []} />
                </div>
                <StatusTag workflow={incidentDef.workflow} status={i.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No open incidents" />}
      </Panel>
      <Panel title="Latest occurrence book entries" meta="Most recent five" right={hasModule('ob') ? <Link className="btn sm" to={`${base}/ob`}>Occurrence book</Link> : undefined}>
        {ob.length ? (
          <ul className="list">
            {ob.map((e) => (
              <li key={e.id}>
                <span className="time-chip">{formatDate(str(e, 'date')).slice(0, 6)} {str(e, 'time')}</span>
                <div className="grow">{hasModule('ob') ? <Link to={`${base}/ob/${e.id}`}><b>{e.ref} · {label(OB_TYPES, str(e, 'type'))}</b></Link> : <b>{e.ref} · {label(OB_TYPES, str(e, 'type'))}</b>}<small>{str(e, 'entry')}</small></div>
              </li>
            ))}
          </ul>
        ) : <Empty title="No entries yet" />}
      </Panel>
      {adding && (
        <RecordFormModal def={act.def('posts')} open title={`Add a post — ${str(s, 'name')}`} initial={{ site: s.id, shift: 'day', grade: 'D', armed: false }} onClose={() => setAdding(false)}
          onSave={(v) => { const r = act.create('posts', { ...v, site: s.id }); act.toast(`Post ${r.ref} added — roster it from the duty roster`); setAdding(false); }} />
      )}
    </>
  );
}

function Aside({ site: s }: { site: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { hasModule } = useUser();
  const { today } = useClock();
  const contract = contractOfSite(data, s.id);
  const last = lastInspection(data, s.id);
  const days = daysSinceInspection(data, s.id, today);
  const actionDef = act.def('actions');
  const actions = records(data, 'actions').filter((a) => str(a, 'site') === s.id && a.status === 'open');
  const stats = responseStats(data, addDays(today, -60), today, s.id);
  return (
    <>
      <Panel title="Last inspection" meta={`Target: every ${INSPECTION_INTERVAL_DAYS} days`} right={<Tag tone={days === null || days > INSPECTION_INTERVAL_DAYS ? 'red' : 'green'}>{days === null ? 'Never inspected' : days === 0 ? 'Today' : `${days} days ago`}</Tag>}>
        {last ? (
          <KeyValues items={[
            { label: 'Date', value: hasModule('inspections') ? <Link to={`${base}/inspections/${last.id}`}>{formatDate(str(last, 'date'))}</Link> : formatDate(str(last, 'date')) },
            { label: 'Score', value: `${inspectionScore(last).score}/${inspectionScore(last).max}` },
            { label: 'Inspector', value: str(last, 'inspector') },
            { label: 'Findings', value: str(last, 'findings') || 'None', wide: true },
          ]} />
        ) : <Empty title="No inspection on record" />}
        {actions.length > 0 && (
          <ul className="list" style={{ marginTop: 8 }} data-testid="site-actions">
            {actions.map((a) => (
              <li key={a.id}>
                <div className="grow"><b>{str(a, 'description')}</b><small>{a.ref} · due {formatDate(str(a, 'due'))}</small><Flags flags={actionDef.flags?.(a, data, today) ?? []} /></div>
                <WorkflowActions def={actionDef} record={a} compact />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Client & response" meta="From the client contract">
        <KeyValues items={[
          { label: 'Client', value: contract && hasModule('contracts') ? <Link to={`${base}/contracts/${contract.id}`}>{str(contract, 'client')}</Link> : str(contract, 'client'), wide: true },
          { label: 'Armed response SLA', value: `${num(contract, 'slaMinutes')} min` },
          { label: 'Call-outs (60 days)', value: stats.count ? `${stats.count} · avg ${stats.avg} min` : 'None' },
          { label: 'Patrol checkpoints', value: checkpointList(num(s, 'checkpoints')).join(', ') || 'None', wide: true },
        ]} />
      </Panel>
    </>
  );
}
