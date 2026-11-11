import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IcoAlert, IcoInfo, IcoX } from './Icons';
import { useStore } from '../store';
import type { Flag, Tone, WorkflowDef } from '../types';
import { stateOf } from '../engine';

/* ---------- Page header ---------- */
export function PageHeader({ kicker, title, subtitle, actions }: { kicker: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <>
      <div className="page-kicker">{kicker}</div>
      <div className="title-row">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="btns">{actions}</div>}
      </div>
    </>
  );
}

/* ---------- Stat card ---------- */
export function Stat({ label, value, sub, tone, change }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'accent' | 'red'; change?: ReactNode }) {
  return (
    <div className="stat">
      <div className="metric-label">{label}</div>
      <div className={`metric-main ${tone ?? ''}`}>{value}</div>
      {(sub || change) && (
        <div className="metric-sub">
          {change}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------- Tag ---------- */
export type TagTone = Tone;
export function Tag({ tone = 'dark', children, outline }: { tone?: TagTone; children: ReactNode; outline?: boolean }) {
  return <span className={`tag ${tone} ${outline ? 'outline' : ''}`}>{children}</span>;
}

/** Workflow status pill. */
export function StatusTag({ workflow, status }: { workflow?: WorkflowDef; status?: string }) {
  const st = stateOf(workflow, status);
  if (!st) return null;
  return <Tag tone={st.tone}>{st.label}</Tag>;
}

export function Flags({ flags }: { flags: Flag[] }) {
  if (!flags.length) return null;
  return <span className="flags">{flags.map((f) => <Tag key={f.label} tone={f.tone}>{f.label}</Tag>)}</span>;
}

/* ---------- Panel ---------- */
export function Panel({ title, meta, right, children, className = '', pad = true }: { title?: ReactNode; meta?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`panel ${pad ? 'panel-pad' : ''} ${className}`}>
      {(title || right) && (
        <div className="panel-head">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {meta && <div className="panel-meta">{meta}</div>}
          </div>
          {right && <div className="btns">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- Notice ---------- */
export function Notice({ tone = 'accent', children, icon = true }: { tone?: 'accent' | 'amber' | 'red' | 'dark' | 'grey'; children: ReactNode; icon?: boolean }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'red' ? 'alert' : 'note'}>
      {icon && (tone === 'red' || tone === 'amber' ? <IcoAlert /> : <IcoInfo />)}
      <div>{children}</div>
    </div>
  );
}

/* ---------- Field ---------- */
export function Field({ label, error, hint, children, className = '' }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label>{label}</label>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, title, sub, onClose, children, footer, wide }: { open: boolean; title: string; sub?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 id={titleId}>{title}</h3>
            {sub && <p className="modal-sub">{sub}</p>}
          </div>
          <button className="circle-button" aria-label="Close dialog" onClick={onClose}><IcoX /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Confirm dialog ---------- */
export function Confirm({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: { open: boolean; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} title={title} onClose={onCancel} footer={
      <>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} data-testid="confirm-button">{confirmLabel}</button>
      </>
    }>
      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{body}</div>
    </Modal>
  );
}

/* ---------- Toasts ---------- */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span style={{ flex: 1 }}>{t.text}</span>
          <button className="link-btn" style={{ color: '#c9ccc5' }} onClick={() => dismiss(t.id)} aria-label="Dismiss">✕</button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Empty state ---------- */
export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {body && <div>{body}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

/* ---------- Due state tag ---------- */
export function DueTag({ state, label }: { state: 'overdue' | 'due-soon' | 'ok' | 'none'; label?: string }) {
  if (state === 'none') return <Tag tone="dark">Not set</Tag>;
  if (state === 'overdue') return <Tag tone="red">{label ?? 'Overdue'}</Tag>;
  if (state === 'due-soon') return <Tag tone="amber">{label ?? 'Due soon'}</Tag>;
  return <Tag tone="green">{label ?? 'On track'}</Tag>;
}

/* ---------- Tabs (segmented) ---------- */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- Simple bar chart ---------- */
export function BarChart({ data, format = (n) => String(n), alt, label }: { data: Array<{ label: string; value: number; alt?: number }>; format?: (n: number) => string; alt?: string; label: string }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.alt ?? 0)));
  return (
    <figure className="chart" aria-label={label} role="img">
      <div className="bars">
        {[0.25, 0.5, 0.75].map((g) => <span key={g} className="gridline" style={{ bottom: `${g * 100}%` }} />)}
        {data.map((d) => (
          <div className="bar-pair" key={d.label}>
            <div className="bar" title={`${d.label}: ${format(d.value)}`}><div className="fill" style={{ height: `${(d.value / max) * 100}%` }} /></div>
            {d.alt !== undefined && <div className="bar alt" title={`${d.label} · ${alt}: ${format(d.alt)}`}><div className="fill" style={{ height: `${(d.alt / max) * 100}%` }} /></div>}
          </div>
        ))}
      </div>
      <div className="bar-labels">{data.map((d) => <span key={d.label}>{d.label}</span>)}</div>
    </figure>
  );
}

/* ---------- Horizontal meter list ---------- */
export function Meters({ items, format = (n) => String(n) }: { items: Array<{ label: string; value: number; max?: number; tone?: Tone; sub?: string }>; format?: (n: number) => string }) {
  const top = Math.max(1, ...items.map((i) => i.max ?? i.value));
  return (
    <ul className="meters">
      {items.map((i) => (
        <li key={i.label}>
          <div className="meter-head"><span>{i.label}</span><b>{format(i.value)}{i.max !== undefined ? <small> / {format(i.max)}</small> : null}</b></div>
          <div className="meter"><span className={`meter-fill ${i.tone ?? ''}`} style={{ width: `${Math.min(100, (i.value / (i.max ?? top)) * 100)}%` }} /></div>
          {i.sub && <small>{i.sub}</small>}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Stage pipeline (counts per workflow state) ---------- */
export function Pipeline({ stages }: { stages: Array<{ key: string; label: string; count: number; tone: Tone }> }) {
  return (
    <ol className="pipeline">
      {stages.map((s) => (
        <li key={s.key} className={s.count ? 'has' : ''}>
          <b>{s.count}</b>
          <span><i className={`dot ${s.tone}`} />{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Key/value grid ---------- */
export function KeyValues({ items }: { items: Array<{ label: string; value: ReactNode; wide?: boolean }> }) {
  return (
    <dl className="kv">
      {items.map((i) => (
        <div key={i.label} className={i.wide ? 'wide' : ''}><dt>{i.label}</dt><dd>{i.value === '' || i.value === undefined || i.value === null ? '—' : i.value}</dd></div>
      ))}
    </dl>
  );
}
