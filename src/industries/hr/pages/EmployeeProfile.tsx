import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Field, Flags, KeyValues, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { EMPLOYMENT_TYPES, EXIT_REASONS, ONBOARDING_ITEMS, PROBATION_OUTCOMES, SANCTIONS, label } from '../data';
import {
  activeWarnings, addMonths, balances, certFlags, certLabel, deptLabel, deptOf, emp, employeeCerts, exitProblem, fmtDays, isCurrent, jobLabel, leaveDays, leaveOf,
  noticeProblem, onboardingDone, probationEndOf, probationProblem, requiredOnboarding, serviceLabel, siteLabel, startProblem, toCsv, todayStr,
} from '../helpers';
import { BalanceCards, EmpLink, LeaveTypeLabel, ModuleLink, Progress, WhoCan } from './shared';
import { useFeedback } from './feedback';

/** One employee: the job, the step-specific panel next to the workflow, leave balances, certificates and warnings. */
export default function EmployeeProfile() {
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const fb = useFeedback();
  const r = findRecord(data, 'employees', id);
  const [probation, setProbation] = useState<{ outcome: string; date: string; end: string; notes: string } | null>(null);
  const [leaving, setLeaving] = useState<{ reason: string; lastDay: string; notes: string } | null>(null);
  if (!r) return <RecordDetail />;

  const today = todayStr();
  const manage = can('employees.manage');
  const mgr = emp(data, str(r, 'manager'));
  const required = requiredOnboarding(r);
  const done = onboardingDone(r);
  const notNeeded = ONBOARDING_ITEMS.filter((i) => !required.includes(i));
  const certs = employeeCerts(data, r.id).sort((a, b) => str(b, 'expires').localeCompare(str(a, 'expires')));
  const warnings = records(data, 'warnings').filter((w) => str(w, 'employee') === r.id).sort((a, b) => str(b, 'issued').localeCompare(str(a, 'issued')));
  const active = new Set(activeWarnings(data, r.id, today).map((w) => w.id));
  const leave = leaveOf(data, r.id).sort((a, b) => str(b, 'start').localeCompare(str(a, 'start')));
  const leaveDef = act.def('leave');
  const reviews = records(data, 'reviews').filter((x) => str(x, 'employee') === r.id);
  const cases = records(data, 'cases').filter((x) => str(x, 'employee') === r.id);

  const toggle = (key: string, on: boolean) => {
    const next = new Set(done);
    if (on) next.add(key); else next.delete(key);
    const item = ONBOARDING_ITEMS.find((i) => i.key === key)!;
    act.update('employees', r.id, { onboarding: toCsv([...next]) }, `${on ? 'Ticked' : 'Unticked'}: ${item.label}`);
    fb.clear();
  };
  const pf = probation ?? { outcome: str(r, 'probationOutcome'), date: str(r, 'probationReviewDate') || today, end: probationEndOf(r), notes: str(r, 'probationNotes') };
  const saveProbation = () => {
    if (!pf.outcome) { fb.fail('Choose the review outcome.'); return; }
    if (!pf.date) { fb.fail('Enter the date of the review meeting.'); return; }
    if (pf.outcome === 'extended' && pf.end <= probationEndOf(r)) { fb.fail(`An extension needs a new end date after ${formatDate(probationEndOf(r))}.`); return; }
    act.update('employees', r.id, { probationOutcome: pf.outcome, probationReviewDate: pf.date, probationNotes: pf.notes.trim(), probationEnd: pf.outcome === 'extended' ? pf.end : probationEndOf(r) },
      `Probation review recorded: ${label(PROBATION_OUTCOMES, pf.outcome).split(' — ')[0]}`, pf.notes.trim() || undefined);
    setProbation(null);
    fb.ok(pf.outcome === 'confirmed' ? 'Review saved. Press “Confirm appointment” above.' : pf.outcome === 'extended' ? `Probation extended to ${formatDate(pf.end)}.` : 'Review saved. Use “Leaving” below with the reason “Not confirmed after probation”, then “Record notice”.');
  };
  const lf = leaving ?? { reason: str(r, 'exitReason'), lastDay: str(r, 'lastDay'), notes: str(r, 'exitNotes') };
  const saveLeaving = () => {
    if (!lf.reason) { fb.fail('Choose the reason for leaving.'); return; }
    if (!lf.lastDay) { fb.fail('Enter the last working day.'); return; }
    act.update('employees', r.id, { exitReason: lf.reason, lastDay: lf.lastDay, exitNotes: lf.notes.trim() }, `Leaving details saved: ${label(EXIT_REASONS, lf.reason)}, last day ${formatDate(lf.lastDay)}`);
    setLeaving(null);
    fb.ok(r.status === 'notice' ? 'Saved.' : 'Saved. Press “Record notice” above to start the exit.');
  };
  const tickExit = (key: 'exitEquipment' | 'exitAccess', on: boolean) =>
    act.update('employees', r.id, { [key]: on }, `${on ? 'Ticked' : 'Unticked'}: ${key === 'exitEquipment' ? 'equipment returned' : 'access removed'}`);

  return (
    <RecordDetail backLabel="Employees"
      aside={<>
        <Panel title="Job">
          <KeyValues items={[
            { label: 'Job', value: jobLabel(r) },
            { label: 'Department', value: deptLabel(deptOf(r)) },
            { label: 'Site', value: siteLabel(str(r, 'site')) },
            { label: 'Reports to', value: <EmpLink e={mgr} /> },
            { label: 'Started', value: str(r, 'startDate') ? `${formatDate(str(r, 'startDate'))}${str(r, 'startDate') <= today ? ` · ${serviceLabel(r, today)}` : ''}` : '' },
            { label: 'Employment', value: label(EMPLOYMENT_TYPES, str(r, 'employmentType')) + (str(r, 'fixedTermEnd') ? ` to ${formatDate(str(r, 'fixedTermEnd'))}` : '') },
            { label: 'Probation', value: str(r, 'probationOutcome') === 'confirmed' ? `Confirmed ${formatDate(str(r, 'probationReviewDate'))}` : `Ends ${formatDate(probationEndOf(r))}` },
          ]} />
        </Panel>
        <Panel title="Certificates" meta="Expired or expiring within 60 days are flagged">
          {certs.length ? (
            <ul className="list" data-testid="employee-certs">
              {certs.map((c) => <li key={c.id}><div className="grow"><b><ModuleLink module="certificates" id={c.id}>{certLabel(str(c, 'type'))}</ModuleLink></b><small>{str(c, 'number')} · expires {formatDate(str(c, 'expires'))}</small></div><Flags flags={certFlags(c, data, today)} /></li>)}
            </ul>
          ) : <p className="muted-note">No certificates on file.</p>}
        </Panel>
        <Panel title="Warnings on file" meta="Valid for 3, 6 or 12 months (company policy in this demo)">
          {warnings.length ? (
            <ul className="list" data-testid="employee-warnings">
              {warnings.map((w) => <li key={w.id}><div className="grow"><b>{label(SANCTIONS, str(w, 'level'))}</b><small>{str(w, 'reason')} · issued {formatDate(str(w, 'issued'))} · {active.has(w.id) ? 'valid until' : 'expired'} {formatDate(str(w, 'expires'))}</small></div><Tag tone={active.has(w.id) ? 'amber' : 'dark'}>{active.has(w.id) ? 'Valid' : 'Expired'}</Tag></li>)}
            </ul>
          ) : <p className="muted-note">No warnings on file.</p>}
          {(reviews.length > 0 || cases.length > 0) && (
            <ul className="list" style={{ marginTop: 6 }}>
              {reviews.map((x) => <li key={x.id}><div className="grow"><b><ModuleLink module="reviews" id={x.id}>{str(x, 'cycle')}</ModuleLink></b><small>Performance review</small></div><StatusTag workflow={act.def('reviews').workflow} status={x.status} /></li>)}
              {cases.map((x) => <li key={x.id}><div className="grow"><b><ModuleLink module="cases" id={x.id}>{x.ref}</ModuleLink></b><small>{act.def('cases').title(x, data)}</small></div><StatusTag workflow={act.def('cases').workflow} status={x.status} /></li>)}
            </ul>
          )}
        </Panel>
      </>}>
      {r.status === 'onboarding' && (
        <Panel title="Onboarding checklist" meta={`What a ${jobLabel(r).toLowerCase()} needs before day one`} right={<Tag tone={required.every((i) => done.has(i.key)) ? 'green' : 'amber'}>{required.filter((i) => done.has(i.key)).length}/{required.length} done</Tag>}>
          <Progress done={required.filter((i) => done.has(i.key)).length} total={required.length} />
          <div style={{ marginTop: 10 }} data-testid="onboarding-checklist">
            {required.map((i) => (
              <label className="check" key={i.key} style={{ display: 'flex', padding: '7px 0' }}>
                <input type="checkbox" checked={done.has(i.key)} disabled={!manage} onChange={(e) => toggle(i.key, e.target.checked)} /> {i.label}
              </label>
            ))}
          </div>
          {notNeeded.length > 0 && <p className="muted-note" style={{ marginTop: 8 }}>Not needed for this job: {notNeeded.map((i) => i.short.toLowerCase()).join('; ')}.</p>}
          <p className="muted-note" style={{ marginTop: 8 }}>Only the fact that an item was captured is recorded — no ID, tax or bank numbers are stored in this demo.</p>
          {(() => { const p = startProblem(r, today); return p ? null : <p className="muted-note" style={{ marginTop: 6 }}>Everything is in place — press “Start employment” above.</p>; })()}
          <WhoCan permission="employees.manage" what="Ticking the checklist is done by HR." />
          {fb.view}
        </Panel>
      )}
      {r.status === 'probation' && (
        <Panel title="Probation review" meta={`Probation ends ${formatDate(probationEndOf(r))} — three months from the start (company policy in this demo)`}
          right={<Tag tone={probationProblem(r) ? 'amber' : 'green'}>{str(r, 'probationOutcome') ? label(PROBATION_OUTCOMES, str(r, 'probationOutcome')).split(' — ')[0] : 'Not reviewed'}</Tag>}>
          <div className="form-grid" data-testid="probation-form">
            <Field label="Outcome"><select className="select" aria-label="Probation outcome" disabled={!manage} value={pf.outcome} onChange={(e) => setProbation({ ...pf, outcome: e.target.value, end: e.target.value === 'extended' && pf.end <= probationEndOf(r) ? addMonths(probationEndOf(r), 1) : pf.end })}>
              <option value="">Choose…</option>
              {PROBATION_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select></Field>
            <Field label="Review meeting date"><input className="input" type="date" aria-label="Review meeting date" disabled={!manage} value={pf.date} onChange={(e) => setProbation({ ...pf, date: e.target.value })} /></Field>
            {pf.outcome === 'extended' && <Field label="New probation end date"><input className="input" type="date" aria-label="New probation end date" disabled={!manage} value={pf.end} onChange={(e) => setProbation({ ...pf, end: e.target.value })} /></Field>}
            <Field label="Notes" className="span-2"><textarea className="textarea" aria-label="Probation notes" disabled={!manage} value={pf.notes} onChange={(e) => setProbation({ ...pf, notes: e.target.value })} /></Field>
          </div>
          {manage && <button className="btn sm primary" style={{ marginTop: 10 }} onClick={saveProbation} data-testid="save-probation">Save review</button>}
          <WhoCan permission="employees.manage" what="Probation reviews are recorded by HR." />
          {fb.view}
        </Panel>
      )}
      {isCurrent(r) && (
        <Panel title="Leaving" meta={r.status === 'notice' ? 'Complete the exit checklist; the exit can be completed on or after the last working day' : 'Resignation, dismissal, end of contract — record it here, then “Record notice” above'}
          right={r.status === 'notice' ? <Tag tone={exitProblem(r, today) ? 'amber' : 'green'}>{exitProblem(r, today) ? 'Exit in progress' : 'Ready to exit'}</Tag> : undefined}>
          {r.status !== 'notice' && !leaving && !str(r, 'exitReason') ? (
            manage ? <button className="btn sm" onClick={() => setLeaving(lf)} data-testid="start-leaving">Record a resignation or other exit…</button> : <p className="muted-note">No notice recorded.</p>
          ) : (
            <>
              <div className="form-grid" data-testid="leaving-form">
                <Field label="Reason for leaving"><select className="select" aria-label="Reason for leaving" disabled={!manage} value={lf.reason} onChange={(e) => setLeaving({ ...lf, reason: e.target.value })}>
                  <option value="">Choose…</option>
                  {EXIT_REASONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></Field>
                <Field label="Last working day"><input className="input" type="date" aria-label="Last working day" disabled={!manage} value={lf.lastDay} onChange={(e) => setLeaving({ ...lf, lastDay: e.target.value })} /></Field>
                <Field label="Notes" className="span-2"><textarea className="textarea" aria-label="Exit notes" disabled={!manage} value={lf.notes} onChange={(e) => setLeaving({ ...lf, notes: e.target.value })} /></Field>
              </div>
              {manage && <button className="btn sm primary" style={{ marginTop: 10 }} onClick={saveLeaving} data-testid="save-leaving" disabled={!leaving}>Save</button>}
              {r.status === 'notice' && (
                <ul className="list" style={{ marginTop: 12 }} data-testid="exit-checklist">
                  {([['exitEquipment', 'Equipment returned (keys, scanner, PPE, fuel card)'], ['exitAccess', 'Access removed (systems, gate card, depot alarm code)']] as const).map(([key, text]) => (
                    <li key={key}><label className="check grow"><input type="checkbox" checked={!!r.values[key]} disabled={!manage} onChange={(e) => tickExit(key, e.target.checked)} /> {text}</label></li>
                  ))}
                </ul>
              )}
              {r.status !== 'notice' && noticeProblem(r, today) === null && <p className="muted-note" style={{ marginTop: 8 }}>Ready — press “Record notice” above.</p>}
            </>
          )}
          {r.status !== 'probation' && fb.view}
        </Panel>
      )}
      {r.status !== 'onboarding' && (
        <Panel title="Leave" meta="Balances are computed from the leave records (demo rules modelled on the BCEA)">
          {isCurrent(r) && <BalanceCards list={balances(data, r, today)} />}
          {leave.length ? (
            <ul className="list" data-testid="employee-leave">
              {leave.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <div className="grow"><b><ModuleLink module="leave" id={l.id}><LeaveTypeLabel type={str(l, 'type')} /></ModuleLink></b><small>{formatDate(str(l, 'start'))}{str(l, 'end') !== str(l, 'start') ? ` – ${formatDate(str(l, 'end'))}` : ''} · {fmtDays(leaveDays(l))} working day{leaveDays(l) === 1 ? '' : 's'}</small></div>
                  <StatusTag workflow={leaveDef.workflow} status={l.status} />
                </li>
              ))}
            </ul>
          ) : <Empty title="No leave recorded" />}
          {leave.length > 6 && <p className="muted-note" style={{ marginTop: 8 }}>{leave.length - 6} older records in Leave requests.</p>}
        </Panel>
      )}
    </RecordDetail>
  );
}

