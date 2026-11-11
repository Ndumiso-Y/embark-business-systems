import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Flags, Notice, Panel, Stat } from '../../../core/components/ui';
import { RegisterPage, WorkflowActions } from '../../../core/components/records';
import { TECHNICIANS, TOOL_LOCATIONS, TOOL_TYPES, label } from '../data';
import { calibrationState, todayStr, toolHoursOut, toolNotReturned } from '../helpers';

/** Tools & equipment: who holds what right now, then the full register. */
export default function ToolBoard() {
  return <RegisterPage intro={<Board />} />;
}

function Board() {
  const { can } = useUser();
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
    { key: 'store', title: 'Available', sub: 'In bays and the tool store — issue from here', items: tools.filter((t) => t.status === 'available' && TOOL_TYPES.find((x) => x.value === str(t, 'toolType'))?.value !== 'changer').sort((a, b) => Number(str(b, 'toolType') === 'torque') - Number(str(a, 'toolType') === 'torque')) },
    ...TECHNICIANS.map((t) => ({ key: t.value, title: t.label, sub: t.skill, items: out.filter((x) => str(x, 'holder') === t.value) })),
    { key: 'away', title: 'Away / unavailable', sub: 'Calibration, repair, missing', items: away },
  ];
  return (
    <>
      {!can('tools.issue') && <div style={{ marginBottom: 16 }}><Notice tone="grey">You can see who holds which tool. Checking tools out and in is done by the technicians and the stock controller (needs “Issue tools”).</Notice></div>}
      <div className="stat-grid compact">
        <Stat label="Checked out now" value={out.length} sub={`${new Set(out.map((t) => str(t, 'holder'))).size} technicians holding tools`} />
        <Stat label="Calibration expired" value={expired.length} tone={expired.length ? 'red' : undefined} sub={expired.map((t) => str(t, 'assetNo')).join(', ') || 'All calibrated tools in date'} />
        <Stat label="Calibration due ≤ 14 days" value={due.length} sub={due.map((t) => str(t, 'assetNo')).join(', ') || 'None due'} />
        <Stat label="Not returned overnight" value={notBack.length} tone={notBack.length ? 'red' : undefined} sub={notBack.map((t) => `${str(t, 'assetNo')} · ${label(TECHNICIANS, str(t, 'holder'))}`).join(', ') || 'All tools back on time'} />
      </div>
      <div className="section-gap" />
      <Panel title="Tool board" meta="Who holds what right now. Use “Check out to…” on an available tool to issue it; a tool whose calibration has expired is refused. Tyre changers stay in their bays and are listed in the register below.">
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
  const act = useActions();
  const { can } = useUser();
  const asset = str(tool, 'assetNo');
  const checkOut = (holder: string) => {
    if (!holder) return;
    const prev = str(tool, 'holder');
    act.update('tools', tool.id, { holder });
    const res = act.transition('tools', tool.id, 'checkedout');
    if (!res.ok) { act.update('tools', tool.id, { holder: prev }); act.toast(res.reason, 'err'); return; }
    act.toast(`${asset} checked out to ${label(TECHNICIANS, holder)}`);
  };
  return (
    <article className="board-card">
      <Link to={`${base}/tools/${tool.id}`}><strong>{str(tool, 'assetNo')}</strong></Link>
      <small>{label(TOOL_TYPES, str(tool, 'toolType'))}{showWhere ? ` · ${label(TOOL_LOCATIONS, str(tool, 'location'))}` : ` · out ${h < 1 ? '< 1' : Math.round(h)} h (since ${str(tool, 'checkedOutAt')}${str(tool, 'checkedOutOn') !== today ? ` on ${formatDate(str(tool, 'checkedOutOn'))}` : ''})`}</small>
      <Flags flags={def.flags?.(tool, data, today) ?? []} />
      {tool.status === 'available' ? (
        can('tools.issue') ? (
          <select className="select sm" aria-label={`Check out ${asset} to`} data-testid={`checkout-${asset}`} value="" onChange={(e) => checkOut(e.target.value)} style={{ marginTop: 8 }}>
            <option value="">Check out to…</option>
            {TECHNICIANS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        ) : null
      ) : <WorkflowActions def={def} record={tool} compact />}
    </article>
  );
}
