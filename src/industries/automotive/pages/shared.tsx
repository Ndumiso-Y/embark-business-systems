import { Link } from 'react-router-dom';
import type { IndustryData, Line } from '../../../core/types';
import { findRecord, linesTotals, num, str } from '../../../core/engine';
import { useBase, useUser } from '../../../core/context';
import { formatDate } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { DueTag } from '../../../core/components/ui';
import { CONTACT_METHODS, label } from '../data';
import { km } from './format';
import { isLabour, serviceDue, splitTotals, todayStr } from '../helpers';

/** Compact vehicle + owner summary with a link to the vehicle profile. */
export function VehicleCard({ data, vehicleId }: { data: IndustryData; vehicleId: unknown }) {
  const base = useBase();
  const { hasModule } = useUser();
  const v = findRecord(data, 'vehicles', String(vehicleId ?? ''));
  if (!v) return null;
  const c = findRecord(data, 'customers', str(v, 'customer'));
  const due = serviceDue(v, todayStr());
  return (
    <div className="patient-card" data-testid="vehicle-card">
      <span className="avatar">{str(v, 'make').slice(0, 2).toUpperCase()}</span>
      <div className="grow">
        {hasModule('vehicles') ? <Link to={`${base}/vehicles/${v.id}`}><b>{str(v, 'reg')}</b></Link> : <b>{str(v, 'reg')}</b>}
        <small>{str(v, 'year')} {str(v, 'make')} {str(v, 'model')} · {str(v, 'colour')} · {str(v, 'fuel')}</small>
        <small>VIN {str(v, 'vin') || '—'} · last odometer {km(num(v, 'odometer'))}</small>
        {c && <small>{hasModule('customers') ? <Link to={`${base}/customers/${c.id}`}>{str(c, 'name')}</Link> : str(c, 'name')} · {str(c, 'phone')} · prefers {label(CONTACT_METHODS, str(c, 'preferredContact'))}</small>}
        <div style={{ marginTop: 6 }}>
          <DueTag state={due.state} label={due.state === 'overdue' ? `Service overdue${due.by === 'km' ? ' (km)' : ''}` : due.state === 'due-soon' ? 'Service due soon' : due.state === 'ok' ? `Next service ${formatDate(str(v, 'nextServiceDate'))}` : undefined} />
        </div>
      </div>
    </div>
  );
}

/** Read-only parts & labour lines with a labour / parts split and VAT totals. */
export function LinesTable({ lines, paid }: { lines: Line[]; paid?: number }) {
  const t = linesTotals(lines);
  const s = splitTotals(lines);
  return (
    <>
      <div className="table-wrap">
        <table className="table" data-testid="lines-table">
          <thead><tr><th>Type</th><th>Code</th><th>Description</th><th className="num">Qty / hours</th><th className="num">Unit (excl.)</th><th className="num">Line (excl.)</th></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id}>
                <td>{isLabour(l) ? 'Labour' : 'Part'}</td>
                <td>{l.code || '—'}</td>
                <td>{l.description}</td>
                <td className="num">{isLabour(l) ? `${l.qty} h` : l.qty}</td>
                <td className="num">{formatRand(Math.round(l.unitPrice * 100))}{isLabour(l) ? '/h' : ''}</td>
                <td className="num">{formatRand(t.lines[i].excl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="totals" style={{ marginTop: 12 }}>
        <div className="row"><span>Labour ({s.hours} h)</span><b>{formatRand(s.labour)}</b></div>
        <div className="row"><span>Parts & sundries</span><b>{formatRand(s.parts)}</b></div>
        <div className="row"><span>VAT 15% (demo)</span><b>{formatRand(t.vat)}</b></div>
        {paid !== undefined && <div className="row"><span>Total incl. VAT</span><b>{formatRand(t.total)}</b></div>}
        {paid !== undefined && <div className="row"><span>Paid to date</span><b>−{formatRand(paid)}</b></div>}
        <div className="grand"><span>{paid !== undefined ? 'Balance' : 'Total incl. VAT'}</span><b data-testid="lines-grand">{formatRand(paid !== undefined ? t.total - paid : t.total)}</b></div>
      </div>
    </>
  );
}
