import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { CASE_CATEGORIES, FINDINGS, HEARING_NOTICE_DAYS, SANCTIONS, WARNING_MONTHS, label } from '../data';
import { activeWarnings, emp, fullName, hearingProblem, jobLabel, noticeWorkingDays, siteShort, strongestWarning, todayStr, warningExpiry } from '../helpers';
import { EmpLink, WhoCan } from './shared';
import { useFeedback } from './feedback';

/** A disciplinary case or grievance: investigator, hearing and outcome each have their own form. */
export default function CaseDetail() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const fb = useFeedback();
  const r = findRecord(data, 'cases', id);
  const [inv, setInv] = useState<string | null>(null);
  const [hearing, setHearing] = useState<{ date: string; notice: string } | null>(null);
  const [outcome, setOutcome] = useState<{ chair: string; finding: string; sanction: string; notes: string } | null>(null);
  if (!r) return <RecordDetail />;

  const today = todayStr();
  const e = emp(data, str(r, 'employee'));
  const disciplinary = str(r, 'kind') === 'disciplinary';
  const edit = can('cases');
  const invText = inv ?? str(r, 'investigator');
  const hf = hearing ?? { date: str(r, 'hearingDate'), notice: str(r, 'noticeGiven') || today };
  const of = outcome ?? { chair: str(r, 'chairperson'), finding: str(r, 'finding'), sanction: str(r, 'sanction'), notes: str(r, 'outcomeNotes') };
  const noticeDays = noticeWorkingDays(hf.notice, hf.date);
  const warnings = e ? activeWarnings(data, e.id, today) : [];
  const findings = FINDINGS.filter((f) => (disciplinary ? ['guilty', 'notguilty'] : ['upheld', 'partly', 'notupheld']).includes(f.value));
  const showOutcomeForm = (disciplinary ? r.status === 'hearing' : r.status === 'investigating') && edit;
  const decided = ['outcome', 'appeal', 'closed'].includes(r.status ?? '');

  const saveInvestigator = () => {
    if (!invText.trim()) { fb.fail('Name the investigator.'); return; }
    act.update('cases', r.id, { investigator: invText.trim() }, `Investigator: ${invText.trim()}`);
    setInv(null);
    fb.ok(r.status === 'reported' ? 'Saved. Press “Start investigation” above.' : 'Investigator updated.');
  };
  const saveHearing = () => {
    if (!hf.date || !hf.notice) { fb.fail('Enter the hearing date and the date notice is given.'); return; }
    act.update('cases', r.id, { hearingDate: hf.date, noticeGiven: hf.notice }, `Hearing set for ${formatDate(hf.date)} (notice ${formatDate(hf.notice)})`);
    setHearing(null);
    const problem = hearingProblem({ ...r, values: { ...r.values, hearingDate: hf.date, noticeGiven: hf.notice } });
    if (problem) fb.fail(problem); else fb.ok(r.status === 'investigating' ? 'Saved. Press “Schedule hearing” above.' : 'Hearing updated.');
  };
  const saveOutcome = () => {
    act.update('cases', r.id, { chairperson: of.chair.trim(), finding: of.finding, sanction: of.finding === 'guilty' ? of.sanction : '', outcomeNotes: of.notes.trim() }, 'Outcome details saved');
    setOutcome(null);
    fb.ok('Saved. Press “Record outcome” above.');
  };

  const notice = `NOTICE OF DISCIPLINARY HEARING\n\nTo: ${fullName(e)} (${e?.ref ?? ''}), ${jobLabel(e)}\n\nYou are required to attend a disciplinary hearing on ${hf.date ? formatDate(hf.date) : '[date]'} about: ${label(CASE_CATEGORIES, str(r, 'category')).toLowerCase()} — ${str(r, 'description')}\n\nYou may bring a fellow employee or shop steward to represent you, call witnesses and use an interpreter.\n\n${config.businessName} HR`;

  return (
    <RecordDetail backLabel="Discipline & grievances"
      aside={
        <Panel title="Employee">
          <KeyValues items={[
            { label: 'Employee', value: <EmpLink e={e} /> },
            { label: 'Job', value: `${jobLabel(e)} · ${siteShort(str(e, 'site'))}` },
            { label: 'Warnings on file', value: warnings.length ? `${warnings.length} · strongest: ${label(SANCTIONS, strongestWarning(warnings))}` : 'None valid' },
            { label: 'Reported by', value: `${str(r, 'reportedBy')} · ${formatDate(str(r, 'reportedOn'))}` },
          ]} />
          <p className="muted-note" style={{ marginTop: 10 }}>A demonstration of the process, not legal advice. Rules shown are demo rules.</p>
        </Panel>
      }>
      {['reported', 'investigating'].includes(r.status ?? '') && (
        <Panel title="Investigation" right={str(r, 'investigator') ? <Tag tone="dark">{str(r, 'investigator')}</Tag> : <Tag tone="amber">No investigator</Tag>}>
          <div className="form-grid">
            <Field label="Investigator"><input className="input" aria-label="Investigator" disabled={!edit} value={invText} onChange={(ev) => setInv(ev.target.value)} placeholder="e.g. Kagiso Molefe" /></Field>
          </div>
          {edit && <button className="btn sm" style={{ marginTop: 10 }} disabled={inv === null} onClick={saveInvestigator} data-testid="save-investigator">Save</button>}
          <WhoCan permission="cases" what="Cases are run by HR." />
          {!disciplinary && r.status === 'investigating' && <p className="muted-note" style={{ marginTop: 8 }}>Grievances are heard in a grievance meeting — record the outcome below.</p>}
        </Panel>
      )}
      {disciplinary && ['investigating', 'hearing'].includes(r.status ?? '') && (
        <Panel title="Hearing" meta={`At least ${HEARING_NOTICE_DAYS} full working days between the notice and the hearing (demo rule in the style of the LRA Code of Good Practice)`}
          right={hf.date && hf.notice ? <Tag tone={noticeDays >= HEARING_NOTICE_DAYS ? 'green' : 'red'}>{noticeDays} working day{noticeDays === 1 ? '' : 's'}’ notice</Tag> : undefined}>
          <div className="form-grid" data-testid="hearing-form">
            <Field label="Notice given on"><input className="input" type="date" aria-label="Notice given on" disabled={!edit} value={hf.notice} onChange={(ev) => setHearing({ ...hf, notice: ev.target.value })} /></Field>
            <Field label="Hearing date"><input className="input" type="date" aria-label="Hearing date" disabled={!edit} value={hf.date} onChange={(ev) => setHearing({ ...hf, date: ev.target.value })} /></Field>
          </div>
          {edit && <button className="btn sm" style={{ marginTop: 10 }} disabled={!hearing} onClick={saveHearing} data-testid="save-hearing">Save hearing dates</button>}
          <h3 style={{ margin: '16px 0 6px', fontSize: 13 }}>Notice of hearing</h3>
          <div className="hr-preview">{notice}</div>
          <p className="muted-note" style={{ marginTop: 6 }}>Preview only — not sent. Hand it over in person and record the date above.</p>
        </Panel>
      )}
      {(showOutcomeForm || decided) && (
        <Panel title="Outcome" meta={disciplinary ? 'Chairperson (not the investigator), finding and sanction' : 'Who chaired the grievance meeting and the finding'}
          right={str(r, 'finding') ? <Tag tone={['guilty', 'notupheld'].includes(str(r, 'finding')) ? 'red' : 'green'}>{label(FINDINGS, str(r, 'finding'))}</Tag> : undefined}>
          <div className="form-grid" data-testid="outcome-form">
            <Field label={disciplinary ? 'Chairperson' : 'Chaired by'}><input className="input" aria-label="Chairperson" disabled={!showOutcomeForm} value={of.chair} onChange={(ev) => setOutcome({ ...of, chair: ev.target.value })} placeholder="e.g. Lwazi Ntshona" /></Field>
            <Field label="Finding"><select className="select" aria-label="Finding" disabled={!showOutcomeForm} value={of.finding} onChange={(ev) => setOutcome({ ...of, finding: ev.target.value })}>
              <option value="">Choose…</option>{findings.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select></Field>
            {disciplinary && of.finding === 'guilty' && (
              <Field label="Sanction" hint={of.sanction && WARNING_MONTHS[of.sanction] ? `Placed on file until ${formatDate(warningExpiry(of.sanction, today))} (${WARNING_MONTHS[of.sanction]} months, company policy)` : of.sanction === 'dismissal' ? 'Moves the employee to “On notice” to start the exit.' : undefined}>
                <select className="select" aria-label="Sanction" disabled={!showOutcomeForm} value={of.sanction} onChange={(ev) => setOutcome({ ...of, sanction: ev.target.value })}>
                  <option value="">Choose…</option>{SANCTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            )}
            <Field label="Outcome notes" className="span-2"><textarea className="textarea" aria-label="Outcome notes" disabled={!showOutcomeForm} value={of.notes} onChange={(ev) => setOutcome({ ...of, notes: ev.target.value })} /></Field>
          </div>
          {showOutcomeForm && <button className="btn sm" style={{ marginTop: 10 }} disabled={!outcome} onClick={saveOutcome} data-testid="save-outcome">Save outcome details</button>}
          {disciplinary && r.status === 'hearing' && str(r, 'hearingDate') > today && <div style={{ marginTop: 10 }}><Notice tone="grey">The hearing is on {formatDate(str(r, 'hearingDate'))}; the outcome can be recorded after it is held.</Notice></div>}
          {str(r, 'appealNotes') && <p className="muted-note" style={{ marginTop: 10 }}>Appeal: {str(r, 'appealNotes')}</p>}
        </Panel>
      )}
      {fb.view}
    </RecordDetail>
  );
}
