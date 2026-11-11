import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Field, Flags, KeyValues, Meters, Panel, Segmented, Tag } from '../../../core/components/ui';
import { RecordDetail, WorkflowActions } from '../../../core/components/records';
import { CHECK_ITEMS, INSPECTION_INTERVAL_DAYS, SCORES, label } from '../data';
import { daysSinceInspection, inspectionScore, rec, siteName } from '../helpers';
import { useClock } from './format';

export default function InspectionDetail() {
  const { id } = useParams();
  const data = useData();
  const r = rec(data, 'inspections', id);
  return (
    <RecordDetail aside={r ? <Aside inspection={r} /> : undefined}>
      {r && <Checklist inspection={r} />}
    </RecordDetail>
  );
}

function Checklist({ inspection: r }: { inspection: DemoRecord }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const { today } = useClock();
  const actionDef = act.def('actions');
  const s = inspectionScore(r);
  const editable = r.status === 'draft' && can('inspections');
  const [findings, setFindings] = useState(str(r, 'findings'));
  const actions = records(data, 'actions').filter((a) => str(a, 'inspection') === r.id);
  return (
    <>
      <Panel title="Checklist" meta="2 = satisfactory · 1 = needs attention · 0 = unsatisfactory" right={<Tag tone={!s.complete ? 'dark' : s.pct >= 90 ? 'green' : s.pct >= 70 ? 'amber' : 'red'}>{s.complete ? `${s.score}/${s.max} · ${s.pct}%` : 'Not fully scored'}</Tag>}>
        <ul className="list" data-testid="inspection-checklist">
          {CHECK_ITEMS.map((c) => {
            const v = String(r.values[c.key] ?? '');
            return (
              <li key={c.key}>
                <span className={`dot ${v === '2' ? 'green' : v === '1' ? 'amber' : v === '0' ? 'red' : 'dark'}`} />
                <div className="grow"><b>{c.label}</b><small>{c.hint}</small></div>
                {editable
                  ? <Segmented label={c.label} value={v} onChange={(x) => act.update('inspections', r.id, { [c.key]: x })} options={SCORES.map((o) => ({ value: o.value, label: o.label }))} />
                  : <Tag tone={v === '2' ? 'green' : v === '1' ? 'amber' : v === '0' ? 'red' : 'dark'}>{v ? label(SCORES, v) : 'Not scored'}</Tag>}
              </li>
            );
          })}
        </ul>
        <div style={{ marginTop: 12 }}>
          <Meters items={[{ label: 'Inspection score', value: s.score, max: s.max, tone: s.pct >= 90 ? 'green' : s.pct >= 70 ? 'amber' : 'red' }]} />
        </div>
        {editable && (
          <div style={{ marginTop: 14 }}>
            <Field label="Findings" hint={s.failed.length ? `${s.failed.length} item(s) below satisfactory — each raises a corrective action on submission.` : 'Optional when everything is satisfactory.'}>
              <textarea className="textarea" aria-label="Findings" value={findings} onChange={(e) => setFindings(e.target.value)} />
            </Field>
            <div className="btns" style={{ marginTop: 10 }}>
              <button className="btn sm" onClick={() => { act.update('inspections', r.id, { findings }, 'Findings updated'); act.toast(`${r.ref} findings saved`); }}>Save findings</button>
            </div>
          </div>
        )}
      </Panel>
      <Panel title="Corrective actions" meta="Raised from this inspection when it is submitted">
        {actions.length ? (
          <ul className="list" data-testid="inspection-actions">
            {actions.map((a) => (
              <li key={a.id}>
                <div className="grow">
                  <b>{str(a, 'description')}</b>
                  <small>{a.ref} · {str(a, 'owner')} · due {formatDate(str(a, 'due'))}</small>
                  <Flags flags={actionDef.flags?.(a, data, today) ?? []} />
                </div>
                {a.status === 'open' ? <WorkflowActions def={actionDef} record={a} compact /> : <Tag tone="green">Done</Tag>}
              </li>
            ))}
          </ul>
        ) : <Empty title={r.status === 'draft' ? 'None yet' : 'No corrective actions'} body={r.status === 'draft' ? 'Items scored below satisfactory become corrective actions when the inspection is submitted.' : 'Every item was satisfactory.'} />}
      </Panel>
    </>
  );
}

function Aside({ inspection: r }: { inspection: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const { today } = useClock();
  const site = str(r, 'site');
  const days = daysSinceInspection(data, site, today);
  const previous = records(data, 'inspections').filter((i) => i.id !== r.id && i.status === 'submitted' && str(i, 'site') === site).sort((a, b) => str(b, 'date').localeCompare(str(a, 'date')));
  return (
    <Panel title="Site inspection record" meta={`Target: every ${INSPECTION_INTERVAL_DAYS} days`} right={<Tag tone={days === null || days > INSPECTION_INTERVAL_DAYS ? 'red' : 'green'}>{days === null ? 'Never inspected' : `${days} d since last`}</Tag>}>
      <KeyValues items={[
        { label: 'Site', value: hasModule('sites') ? <Link to={`${base}/sites/${site}`}>{siteName(data, site)}</Link> : siteName(data, site), wide: true },
      ]} />
      {previous.length ? (
        <ul className="list">
          {previous.slice(0, 4).map((i) => (
            <li key={i.id}><div className="grow"><Link to={`${base}/inspections/${i.id}`}><b>{formatDate(str(i, 'date'))}</b></Link><small>{i.ref} · {str(i, 'inspector')}</small></div><Tag tone={inspectionScore(i).pct >= 90 ? 'green' : 'amber'}>{inspectionScore(i).score}/{inspectionScore(i).max}</Tag></li>
          ))}
        </ul>
      ) : <Empty title="No earlier inspections" />}
    </Panel>
  );
}
