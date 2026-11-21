// Small display components shared by the HR pages.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { permissionHint } from '../../../core/engine';
import { Stat } from '../../../core/components/ui';
import { fmtDays, fullName, leaveColour, leaveShort, type Balance } from '../helpers';
import './hr.css';

/** One row of a pass/fail checklist. */
export function Check({ ok, label, detail }: { ok: boolean | null; label: ReactNode; detail?: ReactNode }) {
  return (
    <li>
      <span className={`dot ${ok === null ? 'dark' : ok ? 'green' : 'red'}`} />
      <div className="grow"><b>{label}</b>{detail && <small>{detail}</small>}</div>
      <span className={`tag ${ok === null ? 'dark' : ok ? 'green' : 'red'}`}>{ok === null ? 'n/a' : ok ? 'OK' : 'Blocked'}</span>
    </li>
  );
}

/** "Needs the “…” permission — switch to …" for a control the signed-in user cannot use. */
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

/** An employee's name, linked to the profile when the user has the Employees module. */
export function EmpLink({ e }: { e: DemoRecord | undefined }) {
  if (!e) return <>—</>;
  return <ModuleLink module="employees" id={e.id}>{fullName(e)}</ModuleLink>;
}

export function LeaveSwatch({ type, pending }: { type: string; pending?: boolean }) {
  return <span className={`hr-lv ${leaveColour(type)}`}><span className={`hr-swatch ${pending ? 'pending' : ''}`} aria-hidden="true" /></span>;
}
export function LeaveTypeLabel({ type }: { type: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><LeaveSwatch type={type} />{leaveShort(type)}</span>;
}

/** Leave balances as stat cards (annual, sick, family, study). */
export function BalanceCards({ list }: { list: Balance[] }) {
  return (
    <div className="stat-grid" data-testid="balances">
      {list.map((b) => (
        <Stat key={b.type} label={b.label} value={b.eligible ? `${fmtDays(b.available)} days` : 'Not yet'} tone={b.available < 0 ? 'red' : b.type === 'annual' ? 'accent' : undefined}
          sub={b.eligible ? `${fmtDays(b.used)} used of ${fmtDays(b.entitlement)} · ${b.basis}` : b.basis} />
      ))}
    </div>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  return <div className="hr-progress" aria-label={`${done} of ${total} done`}><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>;
}
