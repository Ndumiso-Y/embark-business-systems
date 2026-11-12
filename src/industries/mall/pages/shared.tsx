// Small display components shared by the shopping-centre pages.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord, IndustryData, Line } from '../../../core/types';
import { linesTotals, str } from '../../../core/engine';
import { useBase, useUser } from '../../../core/context';
import { Tag } from '../../../core/components/ui';
import { VAT_RATE } from '../data';
import { leaseUnit, rand, shopLabel } from '../helpers';

/** Link to a record (or a module) when the simulated user has the module; plain text otherwise. */
export function RecLink({ module, id, children }: { module: string; id?: string; children: ReactNode }) {
  const base = useBase();
  const { hasModule } = useUser();
  return hasModule(module) ? <Link to={`${base}/${module}${id ? `/${id}` : ''}`}>{children}</Link> : <>{children}</>;
}

/** A small button into another module — rendered only when the simulated user can open that module. */
export function ModButton({ module, id, children, testid }: { module: string; id?: string; children: ReactNode; testid?: string }) {
  const base = useBase();
  const { hasModule } = useUser();
  return hasModule(module) ? <Link className="btn sm" to={`${base}/${module}${id ? `/${id}` : ''}`} data-testid={testid}>{children}</Link> : null;
}

/** Checklist of the things a blocked step is waiting for, each with its own control. */
export function Checklist({ items }: { items: Array<{ label: string; ok: boolean; detail?: ReactNode; action?: ReactNode }> }) {
  return (
    <ul className="list">
      {items.map((i) => (
        <li key={i.label} style={{ flexWrap: 'wrap' }}>
          <span className={`dot ${i.ok ? 'green' : 'red'}`} />
          <div className="grow" style={{ minWidth: 160 }}><b>{i.label}</b>{i.detail && <small>{i.detail}</small>}</div>
          {i.action}
          <Tag tone={i.ok ? 'green' : 'red'}>{i.ok ? 'OK' : 'Outstanding'}</Tag>
        </li>
      ))}
    </ul>
  );
}

const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export function TenantCard({ data, lease, tag }: { data: IndustryData; lease: DemoRecord | undefined; tag?: ReactNode }) {
  if (!lease) return <p className="muted-note">No tenant.</p>;
  return (
    <div className="patient-card">
      <span className="avatar">{initials(str(lease, 'tenant')) || '?'}</span>
      <div className="grow">
        <RecLink module="leases" id={lease.id}><b>{str(lease, 'tenant')}</b></RecLink>
        <small>{shopLabel(leaseUnit(data, lease))} · {lease.ref}{str(lease, 'entity') ? ` · ${str(lease, 'entity')}` : ''}</small>
        {(str(lease, 'contact') || str(lease, 'phone')) && <small>{[str(lease, 'contact'), str(lease, 'phone'), str(lease, 'email')].filter(Boolean).join(' · ')}</small>}
        {tag && <div style={{ marginTop: 6 }}>{tag}</div>}
      </div>
    </div>
  );
}

const qty = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US').replace(/,/g, ' ') : String(n));

/** Read-only priced lines with VAT totals, and what has been paid. */
export function LinesTable({ lines, paid = 0 }: { lines: Line[]; paid?: number }) {
  const t = linesTotals(lines, VAT_RATE);
  return (
    <div className="table-wrap">
      <table className="table items-table" data-testid="invoice-lines">
        <thead><tr><th>Charge</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} data-line={l.id}><td>{l.description}</td><td className="num">{qty(l.qty)}</td><td className="num">{rand(Math.round(l.unitPrice * 100))}</td><td className="num">{rand(t.lines[i]?.excl ?? 0)}</td></tr>
          ))}
          <tr><td colSpan={3} className="num">Excl. VAT</td><td className="num">{rand(t.net)}</td></tr>
          <tr><td colSpan={3} className="num">VAT {VAT_RATE}%</td><td className="num">{rand(t.vat)}</td></tr>
          <tr><td colSpan={3} className="num"><strong>Total</strong></td><td className="num"><strong>{rand(t.total)}</strong></td></tr>
          {paid > 0 && <tr><td colSpan={3} className="num">Paid so far</td><td className="num">−{rand(paid)}</td></tr>}
          {paid > 0 && <tr><td colSpan={3} className="num"><strong>Balance</strong></td><td className="num"><strong>{rand(Math.max(0, t.total - paid))}</strong></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** Scoped styles for the stacking plan and small mall-only layouts (kept here because shared CSS is not ours to edit). */
export function MallStyles() {
  return (
    <style>{`
      .mall-level { margin-bottom: 14px; }
      .mall-level h3 { font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted-2); margin: 0 0 6px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
      .mall-level h3 small { letter-spacing: 0; text-transform: none; font-weight: 600; }
      .mall-plan { display: flex; flex-wrap: wrap; gap: 4px; }
      .mall-unit { flex: 1 1 74px; min-width: 74px; max-width: 100%; border: 1px solid rgba(0,0,0,.12); border-radius: 8px; padding: 6px 8px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 1px; color: #23291f; font: inherit; min-height: 54px; }
      .mall-unit b { font-size: 12px; }
      .mall-unit span { font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      .mall-unit small { font-size: 10px; opacity: .75; }
      .mall-unit:hover, .mall-unit:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
      .mall-unit.selected { outline: 3px solid var(--accent); outline-offset: 1px; }
      .mall-unit.vacant { border-style: dashed; border-color: #b4605a; }
      .mall-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 11px; color: var(--muted); margin: 4px 0 14px; }
      .mall-legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 5px; vertical-align: -2px; border: 1px solid rgba(0,0,0,.12); }
      .mall-inline { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
      .mall-inline .field { flex: 1 1 140px; min-width: 0; margin: 0; }
      .mall-inline .btn { flex: none; }
      .mall-dense .bars, .mall-dense .bar-labels { gap: 5px; }
      .mall-dense .bar-labels span { min-width: 0; overflow: hidden; }
      .mall-cal { display: grid; gap: 6px; }
      .mall-cal-row { display: grid; grid-template-columns: minmax(96px, 150px) minmax(0, 1fr); gap: 10px; align-items: center; font-size: 12px; }
      .mall-cal-track { position: relative; height: 46px; background: var(--bg-subtle); border-radius: 6px; overflow: hidden; }
      .mall-cal-bar { position: absolute; top: 3px; height: 19px; border-radius: 4px; font-size: 10px; line-height: 19px; padding: 0 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #23291f; }
      .mall-cal-today { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--accent); }
      @media (max-width: 600px) { .mall-unit { flex-basis: 64px; min-width: 64px; } .mall-cal-row { grid-template-columns: minmax(0, 1fr); gap: 2px; } }
    `}</style>
  );
}
