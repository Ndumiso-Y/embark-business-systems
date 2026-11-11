import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, Flags, KeyValues, Notice, PageHeader, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { History, WorkflowActions } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import RoleBar from '../../../core/components/RoleBar';
import { IcoBack, IcoEdit } from '../../../core/components/Icons';
import { STAFF_ROLES, label } from '../data';
import {
  assignmentProblem, checklistState, csv, fullName, inductedAt, isRosterable, rosterProblems, shiftAbsent, shiftCleaners, siteOf, staffByRef, staffing, toCsv, todayStr,
} from '../helpers';
import { cleanerState, isRelief, useShiftActions } from './attendance';
import { StaffingTag } from './shared';

/** One site shift: roster, attendance, relief cover and the daily checklist. */
export default function ShiftDetail() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { id } = useParams();
  const { can, hasModule } = useUser();
  const shiftActions = useShiftActions();
  const def = act.def('shifts');
  const shift = findRecord(data, 'shifts', id);
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState('');
  const [message, setMessage] = useState<{ tone: 'red' | 'accent'; text: string } | null>(null);
  const [absent, setAbsent] = useState<DemoRecord | null>(null);
  const [absentNote, setAbsentNote] = useState('');
  const [missed, setMissed] = useState<string | null>(null);
  if (!shift) return <><PageHeader kicker={config.businessName} title="Shift not found" subtitle="It may have been deleted, or the demo data was reset." /><Link className="btn" to={`${base}/schedule`}><IcoBack /> Back to the schedule</Link></>;

  const today = todayStr();
  const site = siteOf(data, shift);
  const st = staffing(shift, data);
  const started = !['draft', 'scheduled'].includes(shift.status ?? '');
  const isToday = str(shift, 'date') === today;
  const live = isToday && shift.status !== 'completed' && shift.status !== 'draft';
  const rosterOpen = ['draft', 'scheduled'].includes(shift.status ?? '') && can('schedule.manage');
  const onShift = shiftCleaners(shift);
  const candidates = records(data, 'staff').filter((p) => isRosterable(p) && !onShift.includes(p.ref)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  // Relief cleaners with the reason each one can or cannot cover this shift; eligible first.
  const reliefStaff = candidates.filter((p) => str(p, 'role') === 'relief');
  const reliefOptions = reliefStaff.map((p) => ({ p, problem: assignmentProblem(p, shift, data) })).sort((a, b) => Number(!!a.problem) - Number(!!b.problem));
  // Absences and relief cover are handled next to the names below, so the generic step buttons are left out here.
  const stepsDef = { ...def, workflow: { ...def.workflow!, transitions: def.workflow!.transitions.filter((t) => t.to !== 'short' && t.to !== 'relief') } };
  const canCover = can('schedule.manage');
  // The picker lists cleaners inducted at this site first; when covering an absence the relief cleaners are already listed above.
  const others = candidates.filter((p) => shift.status !== 'short' || !reliefStaff.includes(p));
  const homeTeam = candidates.filter((p) => str(p, 'homeSite') === site?.id && !assignmentProblem(p, shift, data));
  const check = checklistState(shift, data);
  const canTick = started && shift.status !== 'completed' && can('attendance');
  const problems = shift.status === 'draft' ? rosterProblems(shift, data) : [];
  const fail = (text: string) => { setMessage({ tone: 'red', text }); act.toast(text, 'err'); };

  const addCleaner = () => {
    const p = findRecord(data, 'staff', pick);
    if (!p) return;
    const problem = assignmentProblem(p, shift, data);
    if (problem) { fail(problem); return; }
    act.update('shifts', shift.id, { cleaners: toCsv([...onShift, p.ref]) }, `Rostered: ${fullName(p)}`);
    setMessage({ tone: 'accent', text: `${fullName(p)} added to the roster.` });
    setPick('');
  };
  const addHomeTeam = () => {
    const add = homeTeam.slice(0, st.unfilled);
    act.update('shifts', shift.id, { cleaners: toCsv([...onShift, ...add.map((p) => p.ref)]) }, `Rostered the site team: ${add.map(fullName).join(', ')}`);
    setMessage({ tone: 'accent', text: `${add.length} cleaner${add.length === 1 ? '' : 's'} based at this site added to the roster. Confirm the roster in the workflow above.` });
  };
  const remove = (p: DemoRecord) => {
    act.update('shifts', shift.id, { cleaners: toCsv(onShift.filter((r) => r !== p.ref)), absentees: toCsv(shiftAbsent(shift).filter((r) => r !== p.ref)) }, `Removed from roster: ${fullName(p)}`);
    setMessage(null);
  };
  const tryRelief = (p: DemoRecord) => {
    const problem = shiftActions.assignRelief(shift, p);
    if (problem) fail(problem);
    else setMessage({ tone: 'accent', text: `${fullName(p)} is covering this shift. Clock them in when they arrive.` });
  };
  const tick = (i: number, on: boolean) => {
    const next = new Set(check.ticked);
    if (on) next.add(i); else next.delete(i);
    act.update('shifts', shift.id, { checklist: [...next].sort((a, b) => a - b).join(',') });
  };
  const logAbsent = () => {
    if (!absent) return;
    const problem = shiftActions.markAbsent(shift, absent, absentNote);
    if (problem) { fail(problem); return; }
    setAbsent(null); setAbsentNote(''); setMessage(null);
  };

  return (
    <>
      <Link className="back-link" to={`${base}/schedule`}><IcoBack /> Daily schedule & attendance</Link>
      <PageHeader kicker={`Shift · ${shift.ref}`} title={def.title(shift, data)} subtitle={`${formatDate(str(shift, 'date'))}${isToday ? ' (today)' : ''} · ${str(shift, 'start')}–${str(shift, 'end')}`}
        actions={rosterOpen ? <button className="btn" onClick={() => setEditing(true)} data-testid="edit-record"><IcoEdit /> Edit day & times</button> : undefined} />
      <div className="doc-grid">
        <div className="stack">
          <Panel title="Workflow" meta="Steps enforce the demo’s rostering and attendance rules" right={<StatusTag workflow={def.workflow} status={shift.status} />}>
            <ol className="stepper">
              {def.workflow!.states.filter((s) => !['short', 'relief'].includes(s.key) || s.key === shift.status || shiftAbsent(shift).length > 0).map((s) => {
                const idx = def.workflow!.states.findIndex((x) => x.key === s.key);
                const cur = def.workflow!.states.findIndex((x) => x.key === shift.status);
                return <li key={s.key} className={s.key === shift.status ? 'current' : idx < cur ? 'done' : ''}><span>{s.label}</span></li>;
              })}
            </ol>
            <WorkflowActions def={stepsDef} record={shift} />
            {problems.length > 1 && <ul className="problem-list muted-note">{problems.slice(1).map((p) => <li key={p}>{p}</li>)}</ul>}
            {shift.status === 'short' && (
              <div style={{ marginTop: 12 }} data-testid="relief-pointer">
                <Notice tone="amber">{st.absent} cleaner{st.absent === 1 ? ' is' : 's are'} absent — relief cover is needed. {canCover ? 'Choose a relief cleaner under “Relief cover” below — the list shows who is eligible and why the others are not.' : 'Arranging relief cover needs “Manage roster” (area supervisor or operations manager).'}</Notice>
              </div>
            )}
            {live && shift.status === 'scheduled' && <p className="muted-note" style={{ marginTop: 10 }}>Clocking the first cleaner in starts the shift.</p>}
          </Panel>

          <Panel title="Roster & attendance" meta={`${st.contracted} cleaner${st.contracted === 1 ? '' : 's'} contracted per shift at this site`} right={<StaffingTag st={st} started={started} />}>
            <ul className="list" data-testid="roster-table">
              {onShift.map((ref) => {
                const p = staffByRef(data, ref);
                const cs = cleanerState(shift, ref);
                const waiting = !!p && cs.key === 'waiting' && live && can('attendance');
                return (
                  <li key={ref} style={{ flexWrap: 'wrap' }} data-testid={`roster-${ref}`}>
                    <div className="grow" style={{ minWidth: 150 }}>
                      <b>{p && hasModule('staff') ? <Link to={`${base}/staff/${p.id}`}>{fullName(p)}</Link> : fullName(p)}</b>
                      <small>{ref} · {label(STAFF_ROLES, str(p, 'role'))}{isRelief(shift, ref) ? ' · relief cover on this shift' : ''}</small>
                    </div>
                    {!waiting && <Tag tone={cs.tone}>{cs.label}</Tag>}
                    {(waiting || (p && rosterOpen)) && (
                      <span className="btns" style={{ gap: 6 }}>
                        {waiting && p && <button className="btn xs primary" onClick={() => { const e = shiftActions.clockIn(shift, p); if (e) fail(e); else setMessage(null); }} aria-label={`Clock in ${fullName(p)}`}>Clock in</button>}
                        {waiting && p && <button className="btn xs" onClick={() => { setAbsent(p); setAbsentNote(''); }} aria-label={`Mark ${fullName(p)} absent`}>Absent</button>}
                        {p && rosterOpen && <button className="btn xs" onClick={() => remove(p)} aria-label={`Remove ${fullName(p)} from the roster`}>Remove</button>}
                      </span>
                    )}
                  </li>
                );
              })}
              {Array.from({ length: st.unfilled }, (_, i) => <li key={`u${i}`}><div className="grow"><b style={{ color: 'var(--muted-2)' }}>Unfilled place</b></div><Tag tone="red">No cleaner</Tag></li>)}
            </ul>
            {absent && (
              <div style={{ marginTop: 12 }}>
                <Field label={`Why is ${fullName(absent)} absent? (required)`}><textarea className="textarea" aria-label="Absence note" value={absentNote} onChange={(e) => setAbsentNote(e.target.value)} placeholder="e.g. Phoned in sick at 05:40; client informed" /></Field>
                <div className="btns" style={{ marginTop: 8 }}><button className="btn sm danger" onClick={logAbsent} data-testid="confirm-absence">Log absence</button><button className="btn sm" onClick={() => setAbsent(null)}>Cancel</button></div>
              </div>
            )}
            {message && <div style={{ marginTop: 12 }}><Notice tone={message.tone}>{message.text}</Notice></div>}

            {shift.status === 'short' && canCover && (
              <div style={{ marginTop: 16 }} data-testid="relief-picker">
                <h3 style={{ margin: '0 0 2px', fontSize: 13 }}>Relief cover</h3>
                <div className="panel-meta" style={{ marginBottom: 6 }}>Every relief cleaner is checked for a site induction, {str(site, 'siteType') === 'clinic' ? 'in-date infection-control training (healthcare site), ' : ''}leave and overlapping shifts. {reliefOptions.filter((o) => !o.problem).length} of {reliefOptions.length} can cover this shift.</div>
                <ul className="list">
                  {reliefOptions.map(({ p, problem }) => (
                    <li key={p.id} style={{ padding: '9px 0', flexWrap: 'wrap' }} data-testid={`relief-${p.ref}`}>
                      <div className="grow" style={{ minWidth: 180 }}>
                        <b>{fullName(p)}</b>
                        <small>{p.ref} · relief cleaner · inducted at {csv(str(p, 'inductions')).length} sites</small>
                        {problem && <small style={{ color: 'var(--danger)' }}>{problem}</small>}
                      </div>
                      {problem
                        ? <Tag tone="red">Not eligible</Tag>
                        : <><Tag tone="green">Eligible</Tag><button className="btn xs primary" onClick={() => tryRelief(p)} aria-label={`Assign ${fullName(p)} as relief`}>Assign</button></>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(rosterOpen || (shift.status === 'short' && canCover)) && (
              <div className="toolbar" style={{ marginTop: 14, marginBottom: 0 }}>
                <select className="select" aria-label="Choose a cleaner" value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">{shift.status === 'short' ? 'Or try any other cleaner (same checks)…' : 'Add a cleaner to the roster…'}</option>
                  <optgroup label="Inducted at this site">
                    {others.filter((p) => inductedAt(p, site)).map((p) => <option key={p.id} value={p.id}>{fullName(p)} · {label(STAFF_ROLES, str(p, 'role'))}</option>)}
                  </optgroup>
                  <optgroup label="No induction at this site (will be refused)">
                    {others.filter((p) => !inductedAt(p, site)).map((p) => <option key={p.id} value={p.id}>{fullName(p)} · {label(STAFF_ROLES, str(p, 'role'))}</option>)}
                  </optgroup>
                </select>
                <button className="btn sm" disabled={!pick} onClick={() => { const p = findRecord(data, 'staff', pick); if (!p) return; if (shift.status === 'short') tryRelief(p); else addCleaner(); }}>{shift.status === 'short' ? 'Assign as relief' : 'Add to roster'}</button>
                {rosterOpen && homeTeam.length > 0 && st.unfilled > 0 && <button className="btn sm primary" onClick={addHomeTeam} data-testid="add-site-team">Add the site’s own team ({Math.min(homeTeam.length, st.unfilled)})</button>}
              </div>
            )}
          </Panel>

          <Panel title="Daily checklist" meta="The site’s daily scope. Every task must be ticked to complete the shift, or a note must say what was missed."
            right={<Tag tone={check.missing.length ? 'amber' : 'green'}>{check.tasks.length - check.missing.length}/{check.tasks.length} done</Tag>}>
            {check.tasks.length ? check.tasks.map((t, i) => (
              <label className="check" key={t} style={{ display: 'flex', padding: '6px 0' }}>
                <input type="checkbox" checked={check.ticked.has(i + 1)} disabled={!canTick} onChange={(e) => tick(i + 1, e.target.checked)} /> {t}
              </label>
            )) : <p className="muted-note">No daily tasks are listed in this site’s scope.</p>}
            <div style={{ marginTop: 12 }}>
              <Field label="Tasks missed and why" hint="Needed only when the checklist is not complete.">
                <textarea className="textarea" aria-label="Tasks missed and why" disabled={!canTick} value={missed ?? str(shift, 'missedNote')} onChange={(e) => setMissed(e.target.value)} />
              </Field>
              {canTick && <button className="btn sm" style={{ marginTop: 8 }} disabled={missed === null || missed === str(shift, 'missedNote')} onClick={() => { act.update('shifts', shift.id, { missedNote: missed ?? '' }, 'Missed-task note saved'); setMissed(null); }}>Save note</button>}
            </div>
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Staffing" right={<Flags flags={def.flags?.(shift, data, today) ?? []} />}>
            <KeyValues items={[
              { label: 'Site', value: site && hasModule('sites') ? <Link to={`${base}/sites/${site.id}`}>{str(site, 'name')}</Link> : str(site, 'name') },
              { label: 'Contracted', value: st.contracted },
              { label: 'Rostered', value: `${st.rostered}${st.unfilled ? ` · ${st.unfilled} unfilled` : ''}` },
              { label: started ? 'Present' : 'Clocked in', value: `${st.present} (${st.pct}%)` },
              { label: 'Absent', value: st.absent },
              { label: 'Late clock-ins', value: st.late.length ? st.late.map((r) => fullName(staffByRef(data, r))).join(', ') : 'None' },
            ]} />
            <p className="muted-note" style={{ marginTop: 10 }}>Clock-in times are typed or stamped in this browser — there is no clocking hardware or GPS behind this demo.</p>
          </Panel>
          <Panel title="History" meta="Who did what, when (simulated users)"><History record={shift} /></Panel>
          <RoleBar compact />
        </div>
      </div>
      {editing && (
        <RecordFormModal def={{ ...def, fields: def.fields.filter((f) => ['site', 'date', 'start', 'end'].includes(f.key)) }} record={shift} open onClose={() => setEditing(false)}
          onSave={(v) => { act.update('shifts', shift.id, v, 'Day and times edited'); act.toast(`${shift.ref} saved`); setEditing(false); }} />
      )}
    </>
  );
}
