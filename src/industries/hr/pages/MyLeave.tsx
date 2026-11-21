import { useState } from 'react';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Field, Notice, PageHeader, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { LEAVE_TYPES, SICK_CERT_AFTER } from '../data';
import {
  balances, cancelProblem, clashText, emp, employeeOfUser, fmtDays, fullName, jobLabel, leaveLabel, leaveOf, leaveRequestProblem, nextWorkingDay, siteShort, teamClash,
  todayStr, workingDays,
} from '../helpers';
import { BalanceCards, LeaveTypeLabel } from './shared';
import { useFeedback } from './feedback';

/** Employee self-service: own balances, own requests, and a request form that checks the rules before sending. */
export default function MyLeave() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { user } = useUser();
  const fb = useFeedback();
  const today = todayStr();
  const me = employeeOfUser(data, user);
  const first = nextWorkingDay(addDays(today, 7));
  const [form, setForm] = useState({ type: 'annual', start: first, end: first, reason: '', medicalCert: false });
  const [cancelling, setCancelling] = useState<{ id: string; note: string } | null>(null);
  const def = act.def('leave');

  if (!me) {
    return (
      <>
        <PageHeader kicker={`${config.businessName} / Time off`} title="My leave" />
        <Panel><Empty title="Your simulated user is not linked to an employee record" body="My leave shows the leave of the employee with the same name as the signed-in user. Users added under Users & permissions have no employee record." /></Panel>
      </>
    );
  }

  const mgr = emp(data, str(me, 'manager'));
  const mine = leaveOf(data, me.id).sort((a, b) => str(b, 'start').localeCompare(str(a, 'start')));
  const days = workingDays(form.start, form.end);
  const problem = leaveRequestProblem(data, { employee: me.id, ...form }, today);
  const balanceIssue = !!problem && /available|is available/.test(problem);
  const draft = { id: 'draft', ref: '', values: { employee: me.id, type: form.type, start: form.start, end: form.end }, history: [], createdAt: '', updatedAt: '', status: 'requested' };
  const clash = !problem && days ? teamClash(data, draft) : null;
  const set = (patch: Partial<typeof form>) => { setForm((f) => { const n = { ...f, ...patch }; if (patch.start && n.end < n.start) n.end = n.start; return n; }); fb.clear(); };

  const submit = () => {
    if (problem) { fb.fail(problem); return; }
    const r = act.create('leave', { employee: me.id, type: form.type, start: form.start, end: form.end, reason: form.reason.trim(), medicalCert: form.medicalCert, requestedOn: today, decidedBy: '', coverNote: '' },
      'requested', `Requested on My leave — notification to ${mgr ? fullName(mgr) : 'the manager'} previewed, not sent`);
    act.toast(`${r.ref} sent for approval to ${mgr ? fullName(mgr) : 'HR'} (notification previewed — not sent)`);
    fb.ok(`${leaveLabel(form.type)} requested: ${fmtDays(days)} working day${days === 1 ? '' : 's'}. ${mgr ? fullName(mgr) : 'Your manager'} or HR will decide.`);
    setForm({ type: 'annual', start: first, end: first, reason: '', medicalCert: false });
  };
  const asUnpaid = () => { set({ type: 'unpaid' }); };
  const cancel = () => {
    if (!cancelling) return;
    const res = act.transition('leave', cancelling.id, 'cancelled', cancelling.note);
    if (!res.ok) { fb.fail(res.reason); return; }
    setCancelling(null);
    fb.ok('Request cancelled.');
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Time off`} title="My leave" subtitle={`${fullName(me)} · ${jobLabel(me)} · ${siteShort(str(me, 'site'))}. Your balances are worked out from your leave records; requests go to ${mgr ? `${fullName(mgr)} (your manager)` : 'your manager'} or HR.`} />
      <BalanceCards list={balances(data, me, today)} />
      <div className="grid-2">
        <Panel title="Request leave" meta="Checked against your balance before it is sent">
          <div className="form-grid" data-testid="request-form">
            <Field label="Type of leave">
              <select className="select" aria-label="Type of leave" value={form.type} onChange={(e) => set({ type: e.target.value })}>
                {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <div />
            <Field label="First day"><input className="input" type="date" aria-label="First day" value={form.start} onChange={(e) => set({ start: e.target.value })} /></Field>
            <Field label="Last day"><input className="input" type="date" aria-label="Last day" value={form.end} onChange={(e) => set({ end: e.target.value })} /></Field>
            <Field label="Reason (optional)" className="span-2"><textarea className="textarea" aria-label="Reason" value={form.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
            {form.type === 'sick' && (
              <label className="check span-2"><input type="checkbox" checked={form.medicalCert} onChange={(e) => set({ medicalCert: e.target.checked })} /> I have a medical certificate (needed for more than {SICK_CERT_AFTER} days)</label>
            )}
          </div>
          <div style={{ marginTop: 12 }} data-testid="request-preview">
            {problem
              ? <Notice tone="red">{problem}</Notice>
              : <Notice tone="accent">{fmtDays(days)} working day{days === 1 ? '' : 's'} of {leaveLabel(form.type).toLowerCase()} ({formatDate(form.start)}{form.end !== form.start ? ` – ${formatDate(form.end)}` : ''}). Weekends and public holidays are not counted.</Notice>}
            {clash && <div style={{ marginTop: 8 }}><Notice tone="amber">Heads-up: {clashText(clash)} Your manager may ask how your work will be covered.</Notice></div>}
            {!problem && form.type === 'sick' && days > SICK_CERT_AFTER && !form.medicalCert && <div style={{ marginTop: 8 }}><Notice tone="amber">More than {SICK_CERT_AFTER} days of sick leave can only be approved once HR has your medical certificate.</Notice></div>}
          </div>
          <div className="btns" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={submit} data-testid="submit-leave">Request leave</button>
            {balanceIssue && form.type !== 'unpaid' && <button className="btn" onClick={asUnpaid} data-testid="as-unpaid">Request as unpaid leave instead</button>}
          </div>
          {fb.view}
        </Panel>
        <Panel title="My requests" meta={`${mine.filter((l) => l.status === 'requested').length} awaiting a decision`}>
          {mine.length ? (
            <ul className="list" data-testid="my-requests">
              {mine.slice(0, 12).map((l) => {
                const canCancel = ['requested', 'approved'].includes(l.status ?? '') && !cancelProblem(data, user, l, today);
                return (
                  <li key={l.id} style={{ flexWrap: 'wrap' }}>
                    <div className="grow" style={{ minWidth: 160 }}>
                      <b><LeaveTypeLabel type={str(l, 'type')} /></b>
                      <small>{l.ref} · {formatDate(str(l, 'start'))}{str(l, 'end') !== str(l, 'start') ? ` – ${formatDate(str(l, 'end'))}` : ''} · {fmtDays(workingDays(str(l, 'start'), str(l, 'end')))} day{workingDays(str(l, 'start'), str(l, 'end')) === 1 ? '' : 's'}{str(l, 'decidedBy') ? ` · ${l.status === 'declined' ? 'declined' : 'approved'} by ${str(l, 'decidedBy')}` : ''}</small>
                    </div>
                    <StatusTag workflow={def.workflow} status={l.status} />
                    {canCancel && <button className="btn xs" onClick={() => setCancelling({ id: l.id, note: '' })} aria-label={`Cancel ${l.ref}`}>Cancel</button>}
                    {cancelling?.id === l.id && (
                      <div style={{ flexBasis: '100%' }}>
                        <Field label="Why are you cancelling? (required)"><textarea className="textarea" aria-label="Cancellation reason" value={cancelling.note} onChange={(e) => setCancelling({ ...cancelling, note: e.target.value })} /></Field>
                        <div className="btns" style={{ marginTop: 6 }}><button className="btn sm danger" onClick={cancel} data-testid="confirm-cancel">Cancel request</button><button className="btn sm" onClick={() => setCancelling(null)}>Keep it</button></div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="No leave yet" body="Requests you make appear here with their status." />}
          <p className="muted-note" style={{ marginTop: 10 }}>You only see your own leave. Messages to your manager are previews — nothing is sent in this demo.</p>
          {mine.some((l) => l.status === 'requested') && <div style={{ marginTop: 8 }}><Tag tone="amber">Waiting for {mgr ? fullName(mgr) : 'your manager'}</Tag></div>}
        </Panel>
      </div>
    </>
  );
}
