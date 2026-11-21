import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RATINGS, jobOf, label } from '../data';
import { empName, jobLabel, randOf, requiredOnboarding, siteLabel, todayStr } from '../helpers';
import { ModuleLink, WhoCan } from './shared';
import { useFeedback } from './feedback';

/** An applicant: interview and offer captured next to the steps that need them, and the offer letter preview. */
export default function ApplicantDetail() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const fb = useFeedback();
  const r = findRecord(data, 'applicants', id);
  const [iv, setIv] = useState<{ date: string; score: string; notes: string } | null>(null);
  const [offer, setOffer] = useState<{ salary: string; start: string; accepted: boolean } | null>(null);
  if (!r) return <RecordDetail />;
  const today = todayStr();
  const req = findRecord(data, 'requisitions', str(r, 'requisition'));
  const edit = can('hiring') && !['hired', 'declined'].includes(r.status ?? '');
  const ivf = iv ?? { date: str(r, 'interviewDate') || today, score: str(r, 'interviewScore'), notes: str(r, 'interviewNotes') };
  const of = offer ?? { salary: num(r, 'offerSalary') ? String(num(r, 'offerSalary')) : '', start: str(r, 'startDate'), accepted: !!r.values.offerAccepted };
  const employee = findRecord(data, 'employees', str(r, 'employee'));
  const job = jobOf(str(req, 'job'));

  const saveInterview = () => {
    if (!ivf.date || !ivf.score) { fb.fail('Enter the interview date and score.'); return; }
    act.update('applicants', r.id, { interviewDate: ivf.date, interviewScore: ivf.score, interviewNotes: ivf.notes.trim() }, `Interview recorded: ${label(RATINGS, ivf.score)}`);
    setIv(null);
    fb.ok(r.status === 'shortlisted' ? 'Interview saved. Press “Record interview” above to move on.' : 'Interview saved.');
  };
  const saveOffer = () => {
    if (!(Number(of.salary) > 0) || !of.start) { fb.fail('Enter the offered monthly salary and the start date.'); return; }
    act.update('applicants', r.id, { offerSalary: Number(of.salary), startDate: of.start, offerAccepted: of.accepted }, of.accepted ? 'Offer details saved — accepted by the candidate' : 'Offer details saved');
    setOffer(null);
    fb.ok(r.status === 'interviewed' ? 'Offer saved. Press “Make offer” above.' : r.status === 'offer' && of.accepted ? 'Saved. Press “Mark as hired” above — the employee record is created in Onboarding.' : 'Offer saved.');
  };

  const letter = `Dear ${str(r, 'firstName')},\n\nWe are pleased to offer you the position of ${job?.label.toLowerCase() ?? 'the advertised post'} at ${siteLabel(str(req, 'site'))}, starting on ${of.start ? formatDate(of.start) : '[start date]'}, at a monthly salary of ${of.salary ? randOf(Number(of.salary)) : '[salary]'}. The first three months are a probation period.\n\nPlease bring your ID, tax number, banking details${job?.driver ? ', driver’s licence and PrDP' : ''} on your first day.\n\n${config.businessName} HR`;

  return (
    <RecordDetail backLabel="Applicants"
      aside={
        <Panel title="Position">
          <KeyValues items={[
            { label: 'Requisition', value: req ? <ModuleLink module="hiring" id={req.id}>{str(req, 'title')} · {req.ref}</ModuleLink> : '—' },
            { label: 'Hiring manager', value: empName(data, str(req, 'hiringManager')) },
            { label: 'Requisition status', value: req ? act.def('requisitions').workflow!.states.find((s) => s.key === req.status)?.label : '' },
            { label: 'Employee record', value: employee ? <ModuleLink module="onboarding" id={employee.id}>{employee.ref} · {employee.status === 'onboarding' ? 'in onboarding' : 'started'}</ModuleLink> : '' },
          ]} />
        </Panel>
      }>
      {['applied', 'shortlisted', 'interviewed', 'offer'].includes(r.status ?? '') && (
        <Panel title="Interview" right={str(r, 'interviewScore') ? <Tag tone={num(r, 'interviewScore') >= 3 ? 'green' : 'red'}>{label(RATINGS, str(r, 'interviewScore'))}</Tag> : <Tag tone="dark">Not interviewed</Tag>}>
          <div className="form-grid" data-testid="interview-form">
            <Field label="Interview date"><input className="input" type="date" aria-label="Interview date" disabled={!edit} value={ivf.date} onChange={(e) => setIv({ ...ivf, date: e.target.value })} /></Field>
            <Field label="Score"><select className="select" aria-label="Interview score" disabled={!edit} value={ivf.score} onChange={(e) => setIv({ ...ivf, score: e.target.value })}>
              <option value="">Choose…</option>{RATINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select></Field>
            <Field label="Notes" className="span-2"><textarea className="textarea" aria-label="Interview notes" disabled={!edit} value={ivf.notes} onChange={(e) => setIv({ ...ivf, notes: e.target.value })} /></Field>
          </div>
          {edit && <button className="btn sm" style={{ marginTop: 10 }} onClick={saveInterview} data-testid="save-interview">Save interview</button>}
          <WhoCan permission="hiring" what="Interviews are recorded by HR." />
          {r.status !== 'interviewed' && r.status !== 'offer' && fb.view}
        </Panel>
      )}
      {['interviewed', 'offer'].includes(r.status ?? '') && (
        <Panel title="Offer" right={r.values.offerAccepted ? <Tag tone="green">Accepted</Tag> : r.status === 'offer' ? <Tag tone="amber">Awaiting answer</Tag> : undefined}>
          <div className="form-grid" data-testid="offer-form">
            <Field label="Monthly salary (R)"><input className="input num" type="number" min={0} aria-label="Offered salary" disabled={!edit} value={of.salary} onChange={(e) => setOffer({ ...of, salary: e.target.value })} /></Field>
            <Field label="Start date"><input className="input" type="date" aria-label="Start date" disabled={!edit} value={of.start} onChange={(e) => setOffer({ ...of, start: e.target.value })} /></Field>
            {r.status === 'offer' && <label className="check span-2"><input type="checkbox" disabled={!edit} checked={of.accepted} onChange={(e) => setOffer({ ...of, accepted: e.target.checked })} /> Offer accepted by the candidate</label>}
          </div>
          {edit && <button className="btn sm" style={{ marginTop: 10 }} onClick={saveOffer} data-testid="save-offer">Save offer</button>}
          <h3 style={{ margin: '16px 0 6px', fontSize: 13 }}>Offer letter</h3>
          <div className="hr-preview" data-testid="offer-letter">{letter}</div>
          <p className="muted-note" style={{ marginTop: 6 }}>Preview only — not sent, and not signed. In a real system this would go out for e-signature.</p>
          {fb.view}
        </Panel>
      )}
      {r.status === 'hired' && employee && (
        <Panel title="Hired">
          <p className="muted-note">Employee {employee.ref} was created in Onboarding with the checklist for a {jobLabel(employee).toLowerCase()} — {requiredOnboarding(employee).length} required items. <ModuleLink module="onboarding" id={employee.id}>Open the checklist →</ModuleLink></p>
        </Panel>
      )}
    </RecordDetail>
  );
}
