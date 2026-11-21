import { records, str } from '../../../core/engine';
import { useActions, useData, useUser } from '../../../core/context';
import { Notice, Panel, Stat } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { WEEKLY_HOURS_CAP } from '../data';
import { overCap, plural, rand, timesheetValue, todayStr } from '../helpers';

/** Timesheet register with a bulk “invoice every approved timesheet” run. */
export default function Timesheets() {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const all = records(data, 'timesheets');
  const submitted = all.filter((t) => t.status === 'submitted');
  const approved = all.filter((t) => t.status === 'approved');
  const drafts = all.filter((t) => t.status === 'draft');
  const over = all.filter((t) => t.status !== 'invoiced' && overCap(t));
  const approvedValue = approved.reduce((n, t) => n + timesheetValue(t, data).charge, 0);
  const invoiceAll = () => {
    let n = 0;
    for (const t of approved) { const res = act.transition('timesheets', t.id, 'invoiced'); if (res.ok) n++; else act.toast(`${t.ref}: ${res.reason}`, 'err'); }
    if (n) act.toast(`${plural(n, 'draft invoice')} raised from approved timesheets`);
  };
  return (
    <RegisterPage intro={
      <>
        <div className="stat-grid">
          <Stat label="Awaiting client approval" value={submitted.length} tone={submitted.length ? 'accent' : undefined} sub="submitted — log who at the client approved" />
          <Stat label="Approved, not invoiced" value={approved.length} sub={rand(approvedValue)} />
          <Stat label="Drafts" value={drafts.length} sub={`${drafts.filter((t) => str(t, 'weekStart') < today && t.status === 'draft').length} for weeks already started`} />
          <Stat label={`Above ${WEEKLY_HOURS_CAP} h`} value={over.length} tone={over.length ? 'red' : undefined} sub="weekly cap (demo setting)" />
        </div>
        <Panel title="Invoice approved timesheets" meta="Only client-approved weeks can be invoiced — one draft invoice per timesheet, hours × charge rate"
          right={can('timesheets.invoice') ? <button className="btn primary" disabled={!approved.length} onClick={invoiceAll} data-testid="invoice-approved">Invoice approved ({approved.length})</button> : undefined}>
          <Notice tone="grey">Client approval is simulated: the administrator logs who approved and how. Weeks above {WEEKLY_HOURS_CAP} hours are flagged for a second look before approval.</Notice>
        </Panel>
        <div className="section-gap" />
      </>
    } />
  );
}
