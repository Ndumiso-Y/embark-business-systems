// Small display components shared by the school pages.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { permissionHint } from '../../../core/engine';
import { DAYS, PERIODS, PERIOD_TIMES } from '../data';

/** One row of a pass/fail checklist. */
export function Check({ ok, label, detail }: { ok: boolean | null; label: ReactNode; detail?: ReactNode }) {
  return (
    <li>
      <span className={`dot ${ok === null ? 'dark' : ok ? 'green' : 'red'}`} />
      <div className="grow"><b>{label}</b>{detail && <small>{detail}</small>}</div>
      <span className={`tag ${ok === null ? 'dark' : ok ? 'green' : 'red'}`}>{ok === null ? 'n/a' : ok ? 'OK' : 'To do'}</span>
    </li>
  );
}

/** "Needs the “Fees” permission — switch to …" for a control the signed-in user cannot use. */
export function WhoCan({ permission, what }: { permission: string; what: string }) {
  const config = useIndustry();
  const data = useData();
  const { can } = useUser();
  if (can(permission)) return null;
  return <p className="muted-note" style={{ marginTop: 10 }} data-testid="who-can">{what} {permissionHint(config, data, permission)}</p>;
}

/** Link to a record in another module, or plain text when the signed-in user does not have that module. */
export function ModuleLink({ module, id, children }: { module: string; id?: string; children: ReactNode }) {
  const base = useBase();
  const { hasModule } = useUser();
  return hasModule(module) ? <Link to={`${base}/${module}${id ? `/${id}` : ''}`}>{children}</Link> : <>{children}</>;
}

/** Six periods down, five days across. `today` highlights that day's column. */
export function WeekGrid({ cell, label, today }: { cell: (slot: number) => ReactNode; label: string; today?: number }) {
  return (
    <div className="table-wrap">
      <table className="table" aria-label={label} style={{ minWidth: 560 }}>
        <thead><tr><th>Period</th>{DAYS.map((d, i) => <th key={d} style={i === today ? { color: 'var(--accent-text)' } : undefined}>{d}{i === today ? ' · today' : ''}</th>)}</tr></thead>
        <tbody>
          {PERIOD_TIMES.map((time, p) => (
            <tr key={time}>
              <td style={{ width: 70 }}><strong>{p + 1}</strong><small>{time}</small></td>
              {DAYS.map((d, i) => <td key={d} style={{ padding: 5, background: i === today ? 'var(--accent-tint)' : undefined }}>{cell(i * PERIODS + p)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
