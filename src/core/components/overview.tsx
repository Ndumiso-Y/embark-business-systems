// Overview dashboard kit: the pieces shared by dashboards in the "navy shell" style
// (optometry, medical). Styles: src/styles/overview.css. An industry opts in with
// `shell: 'navy'` on its config and by building its dashboard from these parts.
// Non-component helpers (WEEKDAYS, initialsOf, escapeCloses) live in src/core/lib/overview.ts.
import { useId, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IcoChevron } from './Icons';
import '../../styles/overview.css';

export type OverviewIcon = ComponentType<{ className?: string }>;

/** "Show more / show less" toggle for progressive disclosure. */
export function MoreButton({ open, onToggle, controls, more, less, testid }: { open: boolean; onToggle: () => void; controls: string; more: string; less: string; testid: string }) {
  return (
    <button type="button" className="od-toggle" aria-expanded={open} aria-controls={controls} onClick={onToggle} data-testid={testid}>
      {open ? less : more}<IcoChevron />
    </button>
  );
}

/** One KPI card: icon medallion, label, one strong value, a caption. A link when `to` is given. */
export function Kpi({ icon: Icon, label, value, sub, to, featured, tone, testid }: { icon: OverviewIcon; label: string; value: ReactNode; sub: string; to?: string; featured?: boolean; tone?: 'accent' | 'red'; testid?: string }) {
  const body = (
    <>
      <span className="od-kpi-top"><span className="od-medal"><Icon /></span><span className="od-kpi-label">{label}</span></span>
      <b className={`od-kpi-value${tone ? ` is-${tone}` : ''}${String(value).length > 5 ? ' is-long' : ''}`}>{value}</b>
      <small className="od-kpi-sub">{sub}</small>
    </>
  );
  const cls = `od-kpi${featured ? ' is-featured' : ''}`;
  return to ? <Link className={cls} to={to} data-testid={testid}>{body}</Link> : <div className={cls} data-testid={testid}>{body}</div>;
}

export type RingSegment = { key: string; share: number; tone?: 'muted' | 'a40' | 'a65' | 'a85' | 'accent' | 'warn' };

/**
 * Progress ring: a day's work split by state. `pct` and `caption` describe the figure in the
 * middle; the caller documents how it is calculated. `label` is spelled out for screen readers.
 */
export function FlowRing({ pct, segments, label, caption = 'completed' }: { pct: number; segments: RingSegment[]; label: string; caption?: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const id = useId();
  let start = 0;
  return (
    <figure className="od-ring" role="img" aria-label={`${pct}% ${caption}: ${label}`}>
      <svg viewBox="0 0 132 132" aria-hidden="true" focusable="false">
        <circle className="od-ring-track" cx="66" cy="66" r={r} />
        {segments.map((s) => {
          const len = Math.max(0, s.share * c - (segments.length > 1 ? 3 : 0));
          const el = <circle key={`${id}-${s.key}`} className={`od-ring-seg is-${s.key.toLowerCase()}${s.tone ? ` tone-${s.tone}` : ''}`} cx="66" cy="66" r={r} strokeDasharray={`${len} ${c}`} strokeDashoffset={-start * c} />;
          start += s.share;
          return el;
        })}
      </svg>
      <figcaption><b>{pct}%</b><span>{caption}</span></figcaption>
    </figure>
  );
}
