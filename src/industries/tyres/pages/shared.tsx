import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord, IndustryData, Line, Values } from '../../../core/types';
import { findRecord, linesTotals, num, str } from '../../../core/engine';
import { useBase, useUser } from '../../../core/context';
import { formatRand } from '../../../core/lib/money';
import { Tag } from '../../../core/components/ui';
import { CONDITIONS, POSITIONS, SPARE, VEHICLE_CLASSES, label, type PosKey } from '../data';
import { TONE_COLOURS, dotText, fleetOfCustomer, kmText, rotationDue, torqueSpec, treadLabel, treadTone, type TreadTone } from '../helpers';

const val = (v: Values, k: string): number | null => {
  const x = v[k];
  if (x === undefined || x === null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

/** One tyre seen from above, coloured by tread depth. */
function Tyre({ tone, replace, selected }: { tone: TreadTone; replace?: boolean; selected?: boolean }) {
  const c = TONE_COLOURS[tone];
  const style: CSSProperties = {
    width: 40, height: 86, borderRadius: 11, flex: 'none',
    background: `repeating-linear-gradient(0deg, ${c} 0 7px, rgba(0,0,0,.14) 7px 9px)`,
    border: `3px solid ${selected ? 'var(--accent)' : '#3d433d'}`,
    boxShadow: selected ? '0 0 0 3px var(--accent-soft)' : 'none',
    outline: replace ? '2px dashed var(--accent)' : 'none', outlineOffset: 3,
  };
  return <span aria-hidden="true" style={style} />;
}

type WheelProps = {
  values: Values;
  spec?: { min: number; max: number };
  selected?: PosKey | null;
  onSelect?: (p: PosKey) => void;
  showSpare?: boolean;
  compact?: boolean;
};

/** Top-down vehicle with four wheel positions (and optional spare), tread colour coded. */
export function WheelDiagram({ values, spec, selected, onSelect, showSpare = true, compact }: WheelProps) {
  const card = (pos: { key: PosKey; label: string; name: string }, side: 'left' | 'right' | 'spare') => {
    const tread = val(values, `${pos.key}_tread`);
    const tone = treadTone(tread);
    const torque = val(values, `${pos.key}_torque`);
    const torqueOk = torque === null || !spec ? null : torque >= spec.min && torque <= spec.max;
    const replace = values[`${pos.key}_replace`] === true;
    const info = (
      <div style={{ minWidth: 0, textAlign: side === 'left' ? 'right' : 'left', fontSize: 11.5, lineHeight: 1.45, color: 'var(--muted)' }}>
        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 800 }}>{pos.label} <span style={{ color: TONE_COLOURS[tone] === TONE_COLOURS.none ? 'var(--muted-2)' : 'var(--ink)' }}>{tread === null ? '— mm' : `${tread.toFixed(1)} mm`}</span></div>
        {!compact && <div>{String(values[`${pos.key}_size`] ?? '') || 'size —'} · DOT {dotText(String(values[`${pos.key}_dot`] ?? ''))}</div>}
        {!compact && <div>{label(CONDITIONS, values[`${pos.key}_cond`])}{val(values, `${pos.key}_kpa`) !== null ? ` · ${val(values, `${pos.key}_kpa`)} kPa` : ''}</div>}
        {pos.key !== 'sp' && <div style={{ color: torqueOk === false ? '#a14d47' : undefined, fontWeight: torqueOk === false ? 700 : undefined }}>{torque === null ? 'torque —' : `${torque} Nm${torqueOk === false ? ' (out of spec)' : torqueOk ? ' ✓' : ''}`}</div>}
        <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: side === 'left' ? 'flex-end' : 'flex-start' }}>
          {tone === 'red' && <Tag tone="red">Below legal</Tag>}
          {tone === 'amber' && <Tag tone="amber">Worn</Tag>}
          {replace && <Tag tone="accent">Replace</Tag>}
        </div>
      </div>
    );
    const tyre = <Tyre tone={tone} replace={replace} selected={selected === pos.key} />;
    const content = side === 'left' ? <>{info}{tyre}</> : <>{tyre}{info}</>;
    const style: CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 10, justifyContent: side === 'left' ? 'flex-end' : 'flex-start',
      background: 'transparent', border: 0, padding: 4, borderRadius: 12, cursor: onSelect ? 'pointer' : 'default', textAlign: 'inherit', font: 'inherit', minWidth: 0,
    };
    const aria = `${pos.name}: ${tread === null ? 'tread not measured' : `${tread.toFixed(1)} mm, ${treadLabel(tone)}`}${replace ? ', quoted for replacement' : ''}`;
    return onSelect
      ? <button type="button" key={pos.key} style={style} onClick={() => onSelect(pos.key)} aria-label={aria} aria-pressed={selected === pos.key} data-testid={`wheel-${pos.key}`}>{content}</button>
      : <div key={pos.key} style={style} role="img" aria-label={aria} data-testid={`wheel-${pos.key}`}>{content}</div>;
  };
  const [lf, rf, lr, rr] = POSITIONS;
  const hasSpare = showSpare && (val(values, 'sp_tread') !== null || !!values.sp_size);
  return (
    <div data-testid="wheel-diagram">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 92px minmax(0,1fr)', gap: '18px 8px', alignItems: 'center' }}>
        {card(lf, 'left')}
        <div style={{ gridRow: '1 / span 2', gridColumn: 2, height: '100%', minHeight: compact ? 190 : 230, border: '2px solid var(--line-3, #c9ccc5)', borderRadius: '42px 42px 22px 22px', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--muted-2)' }}>
          <span>▲ FRONT</span>
          <span style={{ width: 54, height: 34, borderRadius: 8, border: '2px solid var(--line-3, #c9ccc5)' }} />
          <span style={{ width: 54, height: 46, borderRadius: 8, border: '2px solid var(--line-3, #c9ccc5)' }} />
          <span>REAR</span>
        </div>
        {card(rf, 'right')}
        {card(lr, 'left')}
        {card(rr, 'right')}
      </div>
      {hasSpare && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>{card(SPARE, 'spare')}</div>}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12, fontSize: 11, color: 'var(--muted)' }}>
        {(['red', 'amber', 'green'] as const).map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: TONE_COLOURS[t] }} />{treadLabel(t)}</span>
        ))}
      </div>
    </div>
  );
}

/** Compact vehicle + owner summary with tyre size, torque spec and rotation. */
export function VehicleCard({ data, vehicleId }: { data: IndustryData; vehicleId: unknown }) {
  const base = useBase();
  const { hasModule } = useUser();
  const v = findRecord(data, 'vehicles', String(vehicleId ?? ''));
  if (!v) return null;
  const c = findRecord(data, 'customers', str(v, 'customer'));
  const fleet = fleetOfCustomer(data, c);
  const spec = torqueSpec(v);
  const rot = rotationDue(v);
  return (
    <div className="patient-card" data-testid="vehicle-card">
      <span className="avatar">{str(v, 'make').slice(0, 2).toUpperCase()}</span>
      <div className="grow">
        {hasModule('vehicles') ? <Link to={`${base}/vehicles/${v.id}`}><b>{str(v, 'reg')}</b></Link> : <b>{str(v, 'reg')}</b>}
        <small>{str(v, 'year')} {str(v, 'make')} {str(v, 'model')} · {label(VEHICLE_CLASSES, str(v, 'vehicleClass'))}</small>
        <small>Tyres <b style={{ fontSize: 11.5 }}>{str(v, 'tyreSize')}</b> · torque {spec.min}–{spec.max} Nm · {num(v, 'pressureKpa') || '—'} kPa</small>
        <small>Last odometer {kmText(num(v, 'odometer'))} · rotation {rot.due ? 'due now' : `in ${kmText(rot.left)}`}</small>
        {c && <small>{hasModule('customers') ? <Link to={`${base}/customers/${c.id}`}>{str(c, 'name')}</Link> : str(c, 'name')} · {str(c, 'phone')}</small>}
        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {fleet ? <Tag tone="dark">Fleet{fleet.values.poRequired ? ' · PO required' : ''}</Tag> : <Tag tone="accent">Retail</Tag>}
          {rot.due && <Tag tone="amber">Rotation due</Tag>}
        </div>
      </div>
    </div>
  );
}

/** Read-only priced lines with VAT totals and optional paid-to-date. */
export function LinesTable({ lines, paid }: { lines: Line[]; paid?: number }) {
  const t = linesTotals(lines);
  return (
    <>
      <div className="table-wrap">
        <table className="table" data-testid="lines-table">
          <thead><tr><th>Code</th><th>Description</th><th className="num">Qty</th><th className="num">Unit (excl.)</th><th className="num">Line (excl.)</th></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id}>
                <td>{l.code || '—'}</td>
                <td>{l.description}</td>
                <td className="num">{l.qty}</td>
                <td className="num">{formatRand(Math.round(l.unitPrice * 100))}</td>
                <td className="num">{formatRand(t.lines[i].excl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="totals" style={{ marginTop: 12 }}>
        <div className="row"><span>Subtotal (excl. VAT)</span><b>{formatRand(t.net)}</b></div>
        <div className="row"><span>VAT 15% (demo)</span><b>{formatRand(t.vat)}</b></div>
        {paid !== undefined && <div className="row"><span>Total incl. VAT</span><b>{formatRand(t.total)}</b></div>}
        {paid !== undefined && <div className="row"><span>Paid to date</span><b>−{formatRand(paid)}</b></div>}
        <div className="grand"><span>{paid !== undefined ? 'Balance' : 'Total incl. VAT'}</span><b data-testid="lines-grand">{formatRand(paid !== undefined ? t.total - paid : t.total)}</b></div>
      </div>
    </>
  );
}

/** Small "who has it" chip for a job's or tool's record link. */
export function RecordLink({ module, record, children }: { module: string; record: DemoRecord; children?: ReactNode }) {
  const base = useBase();
  const { hasModule } = useUser();
  return hasModule(module) ? <Link to={`${base}/${module}/${record.id}`}>{children ?? record.ref}</Link> : <>{children ?? record.ref}</>;
}
