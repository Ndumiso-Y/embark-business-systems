import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { Empty, Flags, Notice, PageHeader, Panel, Segmented, Stat, Tag } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { DIARY_TYPES, earner, label } from '../data';
import { byDeadline, deadlineWindow, todayStr, diaryWhen, type DeadlineWindow } from '../helpers';
import { MatterLink } from './shared';
import { PRESCRIPTION_RULE, PostponeModal } from './Postpone';

const SECTIONS: Array<{ key: DeadlineWindow; title: string; meta: string }> = [
  { key: 'overdue', title: 'Overdue', meta: 'Past the date and not marked done' },
  { key: 'week', title: 'Next 7 days', meta: 'Prescription dates first' },
  { key: 'month', title: '8 to 30 days', meta: 'Prescription dates first' },
  { key: 'later', title: 'Later', meta: 'More than 30 days ahead' },
];

export default function Diary() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const def = act.def('diary');
  const today = todayStr();
  const [view, setView] = useState<'deadlines' | 'all'>('deadlines');
  const [type, setType] = useState('');
  const [creating, setCreating] = useState(false);
  const all = records(data, 'diary').filter((d) => !type || str(d, 'type') === type);
  const upcoming = all.filter((d) => d.status === 'upcoming').sort(byDeadline);
  const prescriptions = upcoming.filter((d) => str(d, 'type') === 'prescription' && daysBetween(today, str(d, 'date')) <= 30);
  const count = (w: DeadlineWindow) => upcoming.filter((d) => deadlineWindow(d, today) === w).length;

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Practice`} title="Court diary & deadlines" subtitle="Court dates, filing deadlines, prescription dates and client meetings. Overdue and seven-day warnings are computed from the entries."
        actions={can('diary') ? <button className="btn primary" onClick={() => setCreating(true)} data-testid="new-diary"><IcoPlus /> New diary entry</button> : undefined} />
      {prescriptions.length > 0 && (
        <Notice tone="red">
          <b>Prescription dates within 30 days:</b>
          <ul className="problem-list">
            {prescriptions.map((d) => <li key={d.id}><b>{formatDate(str(d, 'date'))}</b> ({daysBetween(today, str(d, 'date'))} days) — {str(d, 'title')}</li>)}
          </ul>
          A claim that prescribes is lost. The demo only highlights the date; it does not calculate prescription periods.
        </Notice>
      )}
      <div className="section-gap" />
      <div className="stat-grid">
        <Stat label="Overdue" value={count('overdue')} tone={count('overdue') ? 'red' : undefined} />
        <Stat label="Next 7 days" value={count('week')} />
        <Stat label="Prescription dates ≤ 30 days" value={prescriptions.length} tone={prescriptions.length ? 'red' : undefined} />
        <Stat label="Court dates ahead" value={upcoming.filter((d) => str(d, 'type') === 'court').length} />
      </div>
      <div className="section-gap" />
      <div className="toolbar">
        <Segmented label="Diary view" value={view} onChange={setView} options={[{ value: 'deadlines', label: 'Deadlines' }, { value: 'all', label: 'All entries' }]} />
        <select className="select" style={{ width: 'auto' }} aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {DIARY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      {view === 'deadlines' ? (
        <div className="stack">
          {SECTIONS.map((s) => {
            const items = upcoming.filter((d) => deadlineWindow(d, today) === s.key);
            if (!items.length && s.key !== 'week') return null;
            return (
              <Panel key={s.key} title={`${s.title} (${items.length})`} meta={s.meta}>
                {items.length ? <ul className="list" data-testid={`diary-${s.key}`}>{items.map((d) => <DiaryRow key={d.id} d={d} />)}</ul> : <Empty title="Nothing in the next 7 days" />}
              </Panel>
            );
          })}
        </div>
      ) : (
        <Panel><RecordTable def={def} rows={[...all].sort((a, b) => str(b, 'date').localeCompare(str(a, 'date')))} moduleKey="diary" /></Panel>
      )}
      {creating && (
        <RecordFormModal def={def} open initial={def.createDefaults?.(today, data)} onClose={() => setCreating(false)}
          onSave={(v) => { const r = act.create('diary', v, 'upcoming'); act.toast(`Diary entry ${r.ref} added`); setCreating(false); }} />
      )}
    </>
  );
}

function DiaryRow({ d }: { d: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can } = useUser();
  const def = act.def('diary');
  const today = todayStr();
  const [postponing, setPostponing] = useState(false);
  const presc = str(d, 'type') === 'prescription';
  const done = () => { const res = act.transition('diary', d.id, 'done'); act.toast(res.ok ? `${d.ref} marked done` : res.reason, res.ok ? 'ok' : 'err'); };
  return (
    <li style={{ flexWrap: 'wrap', ...(presc ? { borderLeft: '4px solid var(--danger)', paddingLeft: 10 } : {}) }}>
      <span className="time-chip">{diaryWhen(d)}</span>
      <div className="grow" style={{ minWidth: 180 }}>
        <Link to={`${base}/diary/${d.id}`}><b>{str(d, 'title')}</b></Link>
        <small><MatterLink data={data} id={d.values.matter} /> · {str(d, 'venue')} · {earner(str(d, 'feeEarner'))?.short}</small>
        <span>{presc ? <Tag tone="red">Prescription date</Tag> : <Tag tone="dark" outline>{label(DIARY_TYPES, str(d, 'type'))}</Tag>} <Flags flags={def.flags?.(d, data, today) ?? []} /></span>
      </div>
      {can('diary') && (
        <div className="btns wf-actions">
          <button type="button" className="btn xs primary" onClick={done}>Mark done</button>
          {presc
            ? <span className="tag dark outline" title={PRESCRIPTION_RULE} data-testid="no-postpone">Cannot be postponed</span>
            : <button type="button" className="btn xs" onClick={() => setPostponing(true)} data-testid="postpone">Postpone</button>}
        </div>
      )}
      {postponing && <PostponeModal entry={d} onClose={() => setPostponing(false)} />}
    </li>
  );
}
