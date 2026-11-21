import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { formatDate, monthLabel } from '../../../core/lib/dates';
import { Empty, Field, KeyValues, Notice, PageHeader, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { History, WorkflowActions } from '../../../core/components/records';
import RoleBar from '../../../core/components/RoleBar';
import { IcoBack, IcoDownload } from '../../../core/components/Icons';
import { OT_WEEKLY_LIMIT } from '../data';
import {
  currentEmployees, emp, empName, fmtDays, fullName, inputsFor, LOCKED_PACK, monthEnd, monthStart, onboardingDone, overtimeApproverProblem, overtimeWeeks, packCsv, packIssues,
  packRows, randOf, readSnapshot, toCsv, todayStr, weekStart, type PackIssue,
} from '../helpers';
import { ModuleLink, WhoCan } from './shared';
import { useFeedback } from './feedback';

/** One month's payroll input pack: what must be fixed before approval, the inputs, and the CSV for the bureau. */
export default function PayrunDetail() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { id } = useParams();
  const { user, can } = useUser();
  const fb = useFeedback();
  const def = act.def('payruns');
  const r = findRecord(data, 'payruns', id);
  const [form, setForm] = useState({ kind: 'overtime', employee: '', weekOf: '', hours: '', amount: '', description: '' });
  if (!r) return <><PageHeader kicker={config.businessName} title="Pack not found" subtitle="It may have been deleted, or the demo data was reset." /><Link className="btn" to={`${base}/payroll`}><IcoBack /> Back to payroll inputs</Link></>;

  const today = todayStr();
  const period = str(r, 'period');
  const locked = LOCKED_PACK.includes(r.status ?? '');
  const issues = locked ? [] : packIssues(data, period);
  const rows = (locked ? readSnapshot(r) : null) ?? packRows(data, period);
  const weeks = overtimeWeeks(data, period);
  const editable = !locked && can('payroll.prepare');
  const otherInputs = inputsFor(data, period).filter((i) => str(i, 'kind') !== 'overtime');
  const count = (item: string) => rows.filter((x) => x.item === item).length;
  const wf = def.workflow!;
  const cur = wf.states.findIndex((s) => s.key === r.status);

  const approveOvertime = (lines: DemoRecord[], empId: string) => {
    const problem = overtimeApproverProblem(data, user, empId);
    if (problem) { fb.fail(problem); return; }
    for (const l of lines) act.update('inputs', l.id, { approvedBy: user.name }, `Overtime above ${OT_WEEKLY_LIMIT} h approved by ${user.name}`);
    fb.ok(`Overtime for ${empName(data, empId)} approved — recorded on ${lines.length} line${lines.length === 1 ? '' : 's'}.`);
  };
  const markCaptured = (issue: PackIssue) => {
    const e = emp(data, issue.id);
    if (!e) return;
    if (!can('employees.manage')) { fb.fail('Ticking onboarding items needs the “Manage employees” permission (HR).'); return; }
    act.update('employees', e.id, { onboarding: toCsv([...onboardingDone(e), issue.fix!]) }, `Ticked: ${issue.fix === 'banking' ? 'Banking details captured' : 'Tax number captured'} (from the payroll pack)`);
    fb.ok(`${fullName(e)}: ${issue.fix === 'banking' ? 'banking details' : 'tax number'} marked as captured.`);
  };
  const addInput = () => {
    if (!form.employee) { fb.fail('Choose the employee.'); return; }
    if (form.kind === 'overtime') {
      if (!form.weekOf) { fb.fail('Choose the week (any day in it).'); return; }
      if (!(Number(form.hours) > 0)) { fb.fail('Enter the overtime hours.'); return; }
    } else if (!(Number(form.amount) > 0)) { fb.fail('Enter the amount.'); return; }
    if (form.kind !== 'overtime' && !form.description.trim()) { fb.fail('Describe the allowance or deduction.'); return; }
    const week = form.kind === 'overtime' ? weekStart(form.weekOf) : '';
    act.create('inputs', { period, employee: form.employee, kind: form.kind, weekOf: week, hours: form.kind === 'overtime' ? Number(form.hours) : '', amount: form.kind === 'overtime' ? '' : Number(form.amount), description: form.description.trim(), approvedBy: '' },
      undefined, `Added to the ${monthLabel(period)} pack`);
    const total = weeks.find((w) => w.employee === form.employee && w.weekOf === week)?.hours ?? 0;
    const after = total + Number(form.hours || 0);
    fb.ok(form.kind === 'overtime' && after > OT_WEEKLY_LIMIT ? `Added. ${empName(data, form.employee)} now has ${fmtDays(after)} h in that week — above ${OT_WEEKLY_LIMIT} h, so a manager approval is needed before the pack can be approved.` : 'Input added.');
    setForm({ ...form, hours: '', amount: '', description: '' });
  };
  const removeInput = (i: DemoRecord) => { act.remove('inputs', i.id); fb.ok('Input removed.'); };
  const download = () => {
    const blob = new Blob([packCsv(rows, period, config.businessName)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payroll-inputs-${period}${locked ? '' : '-draft'}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    act.toast(`CSV for ${monthLabel(period)} downloaded (${rows.length} lines)`);
  };

  return (
    <>
      <Link className="back-link" to={`${base}/payroll`}><IcoBack /> Payroll inputs</Link>
      <PageHeader kicker={`Payroll input pack · ${r.ref}`} title={def.title(r, data)} subtitle={`${formatDate(monthStart(period))} – ${formatDate(monthEnd(period))} · input cut-off ${formatDate(str(r, 'cutoff'))}`}
        actions={<button className="btn" onClick={download} data-testid="download-csv"><IcoDownload /> Download CSV{locked ? '' : ' (draft)'}</button>} />
      <div className="doc-grid">
        <div className="stack">
          <Panel title="Workflow" meta="Draft → checked by payroll → approved by a second person (locked) → sent to the payroll bureau (simulated)" right={<StatusTag workflow={wf} status={r.status} />}>
            <ol className="stepper">
              {wf.states.map((s, i) => <li key={s.key} className={s.key === r.status ? 'current' : i < cur ? 'done' : ''}><span>{s.label}</span></li>)}
            </ol>
            <WorkflowActions def={def} record={r} />
            <div style={{ marginTop: 12 }}><Notice tone="grey">Inputs only. This demo does not calculate salaries, PAYE, UIF or any tax — the payroll bureau does that from this pack.</Notice></div>
          </Panel>
          {!locked && (
            <Panel title="Must be resolved before approval" meta="Checked again when “Approve inputs” is pressed" right={<Tag tone={issues.length ? 'red' : 'green'}>{issues.length ? `${issues.length} open` : 'All clear'}</Tag>}>
              {issues.length ? (
                <ul className="list" data-testid="pack-issues">
                  {issues.map((i) => (
                    <li key={i.key} style={{ flexWrap: 'wrap' }}>
                      <span className="dot red" />
                      <div className="grow" style={{ minWidth: 200 }}><b>{i.text}</b>
                        {i.fix === 'overtime' && <small>{i.week!.lines.map((l) => `${fmtDays(num(l, 'hours'))} h · ${str(l, 'description')}`).join(' + ')}</small>}
                      </div>
                      {i.fix === 'overtime' && <button className="btn xs primary" onClick={() => approveOvertime(i.week!.lines, i.id)} data-testid="approve-overtime">Record manager approval</button>}
                      {(i.fix === 'banking' || i.fix === 'taxno') && <button className="btn xs primary" onClick={() => markCaptured(i)}>Mark {i.fix === 'banking' ? 'banking details' : 'tax number'} captured</button>}
                      {!i.fix && <ModuleLink module={i.module} id={i.id}><span className="btn xs">Open the request →</span></ModuleLink>}
                    </li>
                  ))}
                </ul>
              ) : <p className="muted-note">Nothing outstanding. A second person (not the checker) can approve and lock the pack.</p>}
              {fb.view}
            </Panel>
          )}
          <Panel title={locked ? 'Approved pack (locked)' : 'Inputs this month'} meta={locked ? `Approved by ${str(r, 'approvedBy')} — the lines below are frozen as approved` : 'Starters and leavers come from employee records; unpaid days from approved unpaid leave'}>
            <div className="mini-stat-row" style={{ marginBottom: 12 }}>
              <div><b>{count('Starter')}</b>starters</div><div><b>{count('Leaver')}</b>leavers</div>
              <div><b>{fmtDays(rows.filter((x) => x.item === 'Overtime hours').reduce((n, x) => n + Number(x.quantity), 0))} h</b>overtime</div>
              <div><b>{fmtDays(rows.filter((x) => x.item === 'Unpaid leave days').reduce((n, x) => n + Number(x.quantity), 0))}</b>unpaid days</div>
              <div><b>{count('Allowance') + count('Deduction')}</b>allowances & deductions</div>
            </div>
            {rows.length ? (
              <div className="table-wrap">
                <table className="table" data-testid="pack-table">
                  <thead><tr><th>Employee</th><th>Input</th><th className="num">Qty</th><th className="num">Amount</th><th>Note</th></tr></thead>
                  <tbody>
                    {rows.map((x, i) => (
                      <tr key={i}>
                        <td><strong>{x.name}</strong><small>{x.ref} · {x.department} · {x.site}</small></td>
                        <td>{x.item}{x.item === 'Overtime hours' && Number(x.quantity) > OT_WEEKLY_LIMIT ? <> <Tag tone={x.note.includes('approved by —') ? 'red' : 'amber'}>over {OT_WEEKLY_LIMIT} h</Tag></> : null}</td>
                        <td className="num">{x.quantity}</td>
                        <td className="num">{x.amount ? randOf(x.amount) : ''}</td>
                        <td><small>{x.note}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty title="No inputs yet" />}
          </Panel>
          {!locked && (
            <Panel title="Add an input" meta="Overtime per week; allowances and deductions as rand amounts">
              {editable ? (
                <>
                  <div className="form-grid" data-testid="input-form">
                    <Field label="Input"><select className="select" aria-label="Input kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                      <option value="overtime">Overtime hours</option><option value="allowance">Allowance</option><option value="deduction">Deduction</option>
                    </select></Field>
                    <Field label="Employee"><select className="select" aria-label="Employee" value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}>
                      <option value="">Choose…</option>
                      {currentEmployees(data).sort((a, b) => fullName(a).localeCompare(fullName(b))).map((e) => <option key={e.id} value={e.id}>{fullName(e)} · {e.ref}</option>)}
                    </select></Field>
                    {form.kind === 'overtime' ? (
                      <>
                        <Field label="Week (any day)"><input className="input" type="date" aria-label="Week" min={weekStart(monthStart(period))} max={monthEnd(period)} value={form.weekOf} onChange={(e) => setForm({ ...form, weekOf: e.target.value })} /></Field>
                        <Field label="Hours"><input className="input num" type="number" min={0} step={0.5} aria-label="Hours" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></Field>
                      </>
                    ) : <Field label="Amount (R)"><input className="input num" type="number" min={0} step={0.01} aria-label="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>}
                    <Field label="Description" className="span-2"><input className="input" aria-label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
                  </div>
                  <button className="btn sm primary" style={{ marginTop: 10 }} onClick={addInput} data-testid="add-input">Add to pack</button>
                </>
              ) : <WhoCan permission="payroll.prepare" what="Inputs are captured by payroll." />}
              {(weeks.length > 0 || otherInputs.length > 0) && editable && (
                <details style={{ marginTop: 14 }} data-testid="captured-inputs">
                <summary className="link-btn" style={{ cursor: 'pointer' }}>Captured inputs ({weeks.reduce((n, w) => n + w.lines.length, 0) + otherInputs.length}) — remove a line</summary>
                <ul className="list" style={{ marginTop: 6 }}>
                  {[...weeks.flatMap((w) => w.lines), ...otherInputs].map((i) => (
                    <li key={i.id}>
                      <div className="grow"><b>{act.def('inputs').title(i, data)}</b><small>{act.def('inputs').subtitle!(i, data)}{num(i, 'amount') ? ` · ${randOf(num(i, 'amount'))}` : ''}{str(i, 'approvedBy') ? ` · approved by ${str(i, 'approvedBy')}` : ''}</small></div>
                      <button className="btn xs ghost" onClick={() => removeInput(i)} aria-label={`Remove ${i.ref}`}>Remove</button>
                    </li>
                  ))}
                </ul>
                </details>
              )}
            </Panel>
          )}
        </div>
        <div className="stack">
          <Panel title="Pack">
            <KeyValues items={[
              { label: 'Pay period', value: monthLabel(period) },
              { label: 'Cut-off', value: formatDate(str(r, 'cutoff')) },
              { label: 'Checked by', value: str(r, 'checkedBy') },
              { label: 'Approved by', value: str(r, 'approvedBy') },
              { label: 'Sent on', value: str(r, 'sentOn') ? `${formatDate(str(r, 'sentOn'))} (simulated)` : '' },
              { label: 'Notes', value: str(r, 'notes'), wide: true },
            ]} />
            {locked && <p className="muted-note" style={{ marginTop: 10 }}>Locked: changes to leave or inputs made after approval do not alter this pack.</p>}
            {today < monthStart(period) && <p className="muted-note" style={{ marginTop: 10 }}>This pay period has not started yet.</p>}
          </Panel>
          <Panel title="History" meta="Who did what, when (simulated users)"><History record={r} /></Panel>
          <RoleBar compact />
        </div>
      </div>
    </>
  );
}
