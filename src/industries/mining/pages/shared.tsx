// Small display components shared by the mining pages.
import type { ReactNode } from 'react';

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
