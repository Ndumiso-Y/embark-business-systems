import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useBase, useData, useIndustry } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Flags, Panel, Stat } from '../../../core/components/ui';
import { RegisterPage, WorkflowActions } from '../../../core/components/records';
import { TECHNICIANS, TOOL_LOCATIONS, TOOL_TYPES, label } from '../data';
import { calibrationState, todayStr, toolHoursOut, toolNotReturned } from '../helpers';

/** Tools & equipment: who holds what right now, then the full register. */
export default function ToolBoard() {
  return <RegisterPage intro={<Board />} />;
}

function Board() {
  const data = useData();
  const today = todayStr();
  const tools = records(data, 'tools');
  const out = tools.filter((t) => t.status === 'checkedout');
  const calibrated = tools.filter((t) => calibrationState(t, today) !== 'na');
  const expired = calibrated.filter((t) => calibrationState(t, today) === 'expired');
  const due = calibrated.filter((t) => calibrationState(t, today) === 'due');
  const notBack = out.filter((t) => toolNotReturned(t));
  const away = tools.filter((t) => ['calibration', 'outofservice', 'missing'].includes(t.status ?? ''));
  const columns: Array<{ key: string; title: string; sub: string; items: DemoRecord[] }> = [
    ...TECHNICIANS.map((t) => ({ key: t.value, title: t.label, sub: t.skill, items: out.filter((x) => str(x, 'holder') === t.value) })),
    { key: 'store', title: 'Available', sub: 'In bays and the tool store', items: tools.filter((t) => t.status === 'available' && TOOL_TYPES.find((x) => x.value === str(t, 'toolType'))?.value !== 'changer') },
    { key: 'away', title: 'Away / unavailable', sub: 'Calibration, repair, missing', items: away },
  ];
  return (
    <>
      <div className="stat-grid compact">
        <Stat label="Checked out now" value={out.length} sub={`${new Set(out.map((t) => str(t, 'holder'))).size} technicians holding tools`} />
        <Stat label="Calibration expired" value={expired.length} tone={expired.length ? 'red' : undefined} sub={expired.map((t) => str(t, 'assetNo')).join(', ') || 'All calibrated tools in date'} />
        <Stat label="Calibration due ≤ 14 days" value={due.length} sub={due.map((t) => str(t, 'assetNo')).join(', ') || 'None due'} />
        <Stat label="Not returned (> 10 h)" value={notBack.length} tone={notBack.length ? 'red' : undefined} sub={notBack.map((t) => `${str(t, 'assetNo')} · ${label(TECHNICIANS, str(t, 'holder'))}`).join(', ') || 'All tools back on time'} />
      </div>
      <div className="section-gap" />
      <Panel title="Tool board" meta="Who holds what right now. Tyre changers stay in their bays and are listed in the register below.">
        <div className="board" data-testid="tool-board">
          {columns.map((c) => (
            <section key={c.key} className="board-col" aria-label={`${c.title} tools`}>
              <header><span className={`dot ${c.key === 'away' ? 'red' : c.key === 'store' ? 'green' : 'accent'}`} />{c.title}<b>{c.items.length}</b></header>
              <small style={{ display: 'block', margin: '-4px 0 8px', fontSize: 11, color: 'var(--muted-2)' }}>{c.sub}</small>
              {c.items.map((t) => <ToolCard key={t.id} tool={t} showWhere={c.key === 'store' || c.key === 'away'} />)}
              {!c.items.length && <div className="board-empty">{c.key === 'store' || c.key === 'away' ? 'Nothing here' : 'No tools checked out'}</div>}
            </section>
          ))}
        </div>
      </Panel>
      <div className="section-gap" />
    </>
  );
}

function ToolCard({ tool, showWhere }: { tool: DemoRecord; showWhere: boolean }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const today = todayStr();
  const def = config.collections.find((c) => c.key === 'tools')!;
  const h = toolHoursOut(tool);
  return (
    <article className="board-card">
      <Link to={`${base}/tools/${tool.id}`}><strong>{str(tool, 'assetNo')}</strong></Link>
      <small>{label(TOOL_TYPES, str(tool, 'toolType'))}{showWhere ? ` · ${label(TOOL_LOCATIONS, str(tool, 'location'))}` : ` · out ${h < 1 ? '< 1' : Math.round(h)} h (since ${str(tool, 'checkedOutAt')}${str(tool, 'checkedOutOn') !== today ? ` on ${formatDate(str(tool, 'checkedOutOn'))}` : ''})`}</small>
      <Flags flags={def.flags?.(tool, data, today) ?? []} />
      <WorkflowActions def={def} record={tool} compact />
    </article>
  );
}
