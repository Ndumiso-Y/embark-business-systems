// Small display components shared by the construction pages.
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { num, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate, monthShort } from '../../../core/lib/dates';
import { completionDue, taskSlip } from '../helpers';

/** One row of a pass/fail checklist. */
export function Check({ ok, label, detail }: { ok: boolean | null; label: string; detail?: ReactNode }) {
  return (
    <li>
      <span className={`dot ${ok === null ? 'dark' : ok ? 'green' : 'red'}`} />
      <div className="grow"><b>{label}</b>{detail && <small>{detail}</small>}</div>
      <span className={`tag ${ok === null ? 'dark' : ok ? 'green' : 'red'}`}>{ok === null ? 'n/a' : ok ? 'OK' : 'Blocked'}</span>
    </li>
  );
}

const TONE: Record<string, string> = { red: '#c27c77', amber: '#c39550', green: '#6f9b7d', accent: 'var(--accent)' };

/**
 * Gantt-style bar chart for one project's programme. Each row shows the planned
 * bar (tint) with % complete filled in, the actual start → finish line beneath,
 * milestones as diamonds and a red "today" line. Drawn with plain divs scaled to dates.
 */
export function Gantt({ project, tasks, today, linkBase }: { project: DemoRecord; tasks: DemoRecord[]; today: string; linkBase?: string }) {
  const dates = [
    str(project, 'startDate'), str(project, 'plannedCompletion'), completionDue(project), today,
    ...tasks.flatMap((t) => [str(t, 'plannedStart'), str(t, 'plannedFinish'), str(t, 'actualStart'), str(t, 'actualFinish')]),
  ].filter(Boolean).sort();
  if (!dates.length) return null;
  const min = dates[0];
  const max = addDays(dates[dates.length - 1], 1);
  const span = Math.max(1, daysBetween(min, max));
  const pos = (d: string) => Math.min(100, Math.max(0, (daysBetween(min, d) / span) * 100));
  const months: string[] = [];
  for (let m = `${min.slice(0, 7)}-01`; m <= max; m = addDays(`${m.slice(0, 7)}-28`, 5).slice(0, 7) + '-01') if (m >= min) months.push(m);
  const every = Math.max(1, Math.ceil(months.length / 8));
  const row: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(120px, 32%) minmax(0, 1fr)', gap: 12, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line-2)' };
  const track: CSSProperties = { position: 'relative', height: 24, background: 'var(--bg-subtle)', borderRadius: 6 };
  const todayLine = <span aria-hidden style={{ position: 'absolute', left: `${pos(today)}%`, top: -3, bottom: -3, width: 2, background: TONE.red, opacity: 0.8 }} />;
  return (
    <figure role="img" aria-label={`Programme bar chart for ${str(project, 'name')}`} style={{ margin: 0 }} data-testid="gantt">
      <div style={{ ...row, borderBottom: '1px solid var(--line)', paddingTop: 0 }}>
        <small style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', color: 'var(--muted-2)' }}>Task</small>
        <div style={{ position: 'relative', height: 16 }}>
          {months.map((m, i) => i % every === 0 && (
            <span key={m} style={{ position: 'absolute', left: `${pos(m)}%`, fontSize: 10, color: 'var(--muted-2)', borderLeft: '1px solid var(--line)', paddingLeft: 3, whiteSpace: 'nowrap' }}>
              {monthShort(m)}{m.slice(5, 7) === '01' || i === 0 ? ` ${m.slice(2, 4)}` : ''}
            </span>
          ))}
        </div>
      </div>
      {tasks.map((t) => {
        const slip = taskSlip(t, today);
        const tone = slip.state === 'overdue' ? 'red' : slip.state === 'behind' ? 'amber' : slip.state === 'complete' || slip.state === 'late' ? 'green' : 'accent';
        const s = str(t, 'plannedStart');
        const f = str(t, 'plannedFinish');
        const pct = t.status === 'complete' ? 100 : num(t, 'pctComplete');
        const as = str(t, 'actualStart');
        const af = str(t, 'actualFinish') || (as ? today : '');
        const name = linkBase ? <Link to={`${linkBase}/${t.id}`}><b>{str(t, 'name')}</b></Link> : <b>{str(t, 'name')}</b>;
        const tip = `${str(t, 'name')}: planned ${formatDate(s)} → ${formatDate(f)}${as ? `; actual ${formatDate(as)} → ${str(t, 'actualFinish') ? formatDate(str(t, 'actualFinish')) : 'in progress'}` : ''}; ${pct}% complete`;
        return (
          <div key={t.id} style={row}>
            <div style={{ minWidth: 0, fontSize: 12 }}>
              {name}
              <small style={{ display: 'block', color: 'var(--muted-2)', fontSize: 11 }}>
                {t.values.milestone === true ? `Milestone · ${formatDate(f)}` : `${pct}% · ${formatDate(s)} → ${formatDate(f)}`}
                {slip.state === 'overdue' ? ` · overdue ${slip.days} d` : slip.state === 'behind' ? ` · ${slip.gap} pts behind` : slip.state === 'late' ? ` · ${slip.days} d late` : ''}
              </small>
            </div>
            <div style={track} title={tip}>
              {t.values.milestone === true ? (
                <span aria-hidden style={{ position: 'absolute', left: `calc(${pos(f)}% - 6px)`, top: 6, width: 12, height: 12, transform: 'rotate(45deg)', background: pct >= 100 ? TONE.green : slip.state === 'overdue' ? TONE.red : 'var(--accent)', borderRadius: 2 }} />
              ) : (
                <>
                  <span aria-hidden style={{ position: 'absolute', left: `${pos(s)}%`, width: `${Math.max(0.8, pos(addDays(f, 1)) - pos(s))}%`, top: 3, height: 12, background: 'var(--accent-tint)', border: '1px solid var(--accent-line)', borderRadius: 4, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.min(100, pct)}%`, background: TONE[tone] }} />
                  </span>
                  {as && <span aria-hidden style={{ position: 'absolute', left: `${pos(as)}%`, width: `${Math.max(0.5, pos(addDays(af, 1)) - pos(as))}%`, top: 18, height: 3, background: 'var(--ink-3)', borderRadius: 2 }} />}
                </>
              )}
              {todayLine}
            </div>
          </div>
        );
      })}
      <figcaption className="muted-note" style={{ marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span><i style={{ display: 'inline-block', width: 14, height: 8, background: 'var(--accent-tint)', border: '1px solid var(--accent-line)', marginRight: 4 }} />Planned</span>
        <span><i style={{ display: 'inline-block', width: 14, height: 8, background: 'var(--accent)', marginRight: 4 }} />% complete</span>
        <span><i style={{ display: 'inline-block', width: 14, height: 3, background: 'var(--ink-3)', marginRight: 4, verticalAlign: 'middle' }} />Actual</span>
        <span><i style={{ display: 'inline-block', width: 2, height: 10, background: TONE.red, marginRight: 4 }} />Today</span>
        <span>Red = overdue · amber = slipping · green = complete</span>
      </figcaption>
    </figure>
  );
}
