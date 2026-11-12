import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, Flags, KeyValues, Notice, PageHeader, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { History, WorkflowActions } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import RoleBar from '../../../core/components/RoleBar';
import { IcoBack, IcoEdit } from '../../../core/components/Icons';
import { DOCUMENTS, GENDERS, OUTCOMES, PAY_METHODS, gradeLabel, label } from '../data';
import { accountOf, applicantName, depositRequired, familyName, fullName, gradeRoom, missingDocs, rand, toCents, todayStr, waitlistPosition } from '../helpers';
import { useFeedback } from './feedback';
import { ModuleLink, WhoCan } from './shared';

/** One application: documents, assessment, place in the grade, offer, deposit and enrolment — each with its own control. */
export default function ApplicationDetail() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { id } = useParams();
  const { can, user } = useUser();
  const fb = useFeedback();
  const def = act.def('applications');
  const a = findRecord(data, 'applications', id);
  const [editing, setEditing] = useState(false);
  const [assess, setAssess] = useState<{ date: string; outcome: string; note: string } | null>(null);
  const [deposit, setDeposit] = useState<{ amount: string; method: string } | null>(null);
  if (!a) return <><PageHeader kicker={config.businessName} title="Application not found" subtitle="It may have been deleted, or the demo data was reset." /><Link className="btn" to={`${base}/admissions`}><IcoBack /> Back to admissions</Link></>;

  const today = todayStr();
  const status = a.status ?? 'applied';
  const closed = status === 'enrolled' || status === 'declined';
  const mayEdit = can('admissions') && !closed;
  const grade = str(a, 'grade');
  const room = gradeRoom(data, grade);
  /** Places open to this application (its own held place does not count against it). */
  const openPlaces = gradeRoom(data, grade, a.id).free;
  const missing = missingDocs(a);
  const need = depositRequired(a, data);
  const queue = records(data, 'applications').filter((x) => x.status === 'waitlisted' && str(x, 'grade') === grade).sort((x, y) => waitlistPosition(x, data) - waitlistPosition(y, data));
  const position = waitlistPosition(a, data);
  const learner = findRecord(data, 'learners', str(a, 'learner'));
  const placed = findRecord(data, 'classes', str(a, 'placedClass'));
  const account = learner ? accountOf(data, str(learner, 'family')) : undefined;
  const docsOpen = mayEdit && ['applied', 'documents', 'assessed', 'waitlisted'].includes(status);
  const assessOpen = mayEdit && ['documents', 'assessed', 'waitlisted'].includes(status);
  const af = assess ?? { date: str(a, 'assessmentDate') || (status === 'documents' ? today : ''), outcome: str(a, 'outcome'), note: str(a, 'assessmentNote') };
  const df = deposit ?? { amount: num(a, 'depositAmount') > 0 ? String(num(a, 'depositAmount')) : String(need), method: str(a, 'depositMethod') || 'eft' };

  const path = ['applied', 'documents', 'assessed', ...(status === 'waitlisted' || str(a, 'waitlistedOn') ? ['waitlisted'] : []), 'offered', status === 'declined' ? 'declined' : 'enrolled'];
  const at = path.indexOf(status);

  const saveAssessment = () => {
    if (!af.date) { fb.fail('Enter the date of the assessment or interview.'); return; }
    if (af.date > today) { fb.fail('The assessment date is still to come — record it once it has taken place.'); return; }
    if (!af.outcome) { fb.fail('Choose the outcome of the assessment.'); return; }
    act.update('applications', a.id, { assessmentDate: af.date, outcome: af.outcome, assessmentNote: af.note.trim() }, `Assessment recorded: ${label(OUTCOMES, af.outcome)}`, af.note.trim() || undefined);
    setAssess(null);
    if (status === 'documents') {
      const res = act.transition('applications', a.id, 'assessed');
      if (!res.ok) { fb.fail(res.reason); return; }
      fb.ok('Assessment recorded. The next step is the offer — or the waiting list if the grade is full.');
    } else fb.ok('Assessment updated.');
  };
  const saveDeposit = () => {
    const amount = Number(df.amount);
    if (!(amount > 0)) { fb.fail('Enter the deposit amount received.'); return; }
    act.update('applications', a.id, { depositAmount: amount, depositMethod: df.method }, `Enrolment deposit recorded: ${rand(toCents(amount))} by ${label(PAY_METHODS, df.method)}`);
    setDeposit(null);
    if (amount < need) fb.fail(`${rand(toCents(amount))} recorded, but the enrolment deposit for ${gradeLabel(grade)} is ${rand(toCents(need))} — the offer cannot be accepted until the full deposit is in.`);
    else fb.ok('Deposit recorded. Press “Accept offer & enrol” above to enrol the learner.');
  };

  return (
    <>
      <Link className="back-link" to={`${base}/admissions`}><IcoBack /> Admissions</Link>
      <PageHeader kicker={`Application · ${a.ref}`} title={applicantName(a)} subtitle={`${gradeLabel(grade)} · applied ${formatDate(a.createdAt.slice(0, 10))} · ${str(a, 'guardian')}`}
        actions={mayEdit ? <button className="btn" onClick={() => setEditing(true)} data-testid="edit-record"><IcoEdit /> Edit details</button> : closed && can('admissions') ? <span className="tag dark">Final · locked</span> : undefined} />
      <div className="doc-grid">
        <div className="stack">
          <Panel title="Workflow" meta="Each step checks the demo’s admission rules" right={<StatusTag workflow={def.workflow} status={status} />}>
            <ol className="stepper">
              {path.map((key, i) => <li key={key} className={i === at ? 'current' : i < at ? 'done' : ''}><span>{def.workflow!.states.find((s) => s.key === key)!.label}</span></li>)}
            </ol>
            <WorkflowActions def={def} record={a} hide={['assessed']} />
            {status === 'documents' && <p className="muted-note" style={{ marginTop: 10 }}>Next: record the assessment or interview in the panel below — saving it moves the application on.</p>}
            {status === 'enrolled' && learner && (
              <div style={{ marginTop: 12 }} data-testid="enrolled-links">
                <Notice tone="accent">
                  Enrolled as <ModuleLink module="learners" id={learner.id}><b>{fullName(learner)} ({learner.ref})</b></ModuleLink> in <ModuleLink module="classes" id={str(learner, 'class')}><b>{str(placed, 'name') || 'the class'}</b></ModuleLink>.
                  {account && <> Fee account <ModuleLink module="fees" id={account.id}><b>{account.ref}</b></ModuleLink> ({familyName(data, str(account, 'family'))}) carries the enrolment deposit and will be invoiced from the next monthly run.</>}
                </Notice>
              </div>
            )}
            {fb.view}
            <WhoCan permission="admissions" what="Moving an application on:" />
          </Panel>

          <Panel title="Documents" meta="All three must be in before an offer is made" right={<Tag tone={missing.length ? 'amber' : 'green'}>{DOCUMENTS.length - missing.length}/{DOCUMENTS.length} received</Tag>}>
            <div data-testid="documents">
              {DOCUMENTS.map((d) => (
                <label className="check" key={d.key} style={{ display: 'flex', padding: '7px 0' }}>
                  <input type="checkbox" checked={a.values[d.key] === true} disabled={!docsOpen}
                    onChange={(e) => { act.update('applications', a.id, { [d.key]: e.target.checked }, `${d.label} ${e.target.checked ? 'received' : 'marked as outstanding'}`); fb.clear(); }} /> {d.label}
                </label>
              ))}
            </div>
            <p className="muted-note" style={{ marginTop: 8 }}>A yes/no tick only — no documents are uploaded or stored in this demo.</p>
          </Panel>

          <Panel title="Assessment / interview" meta="A short readiness assessment or interview before an offer">
            {assessOpen ? (
              <>
                <div className="form-grid">
                  <Field label="Date held"><input className="input" type="date" aria-label="Assessment date" value={af.date} max={today} onChange={(e) => setAssess({ ...af, date: e.target.value })} /></Field>
                  <Field label="Outcome">
                    <select className="select" aria-label="Assessment outcome" value={af.outcome} onChange={(e) => setAssess({ ...af, outcome: e.target.value })}>
                      <option value="">Select…</option>
                      {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <div className="span-2"><Field label="Note"><textarea className="textarea" aria-label="Assessment note" value={af.note} onChange={(e) => setAssess({ ...af, note: e.target.value })} placeholder="e.g. Reads at grade level; settled quickly with the class" /></Field></div>
                </div>
                <div className="btns" style={{ marginTop: 12 }}>
                  <button className="btn primary sm" onClick={saveAssessment} data-testid="record-assessment">{status === 'documents' ? 'Record assessment' : 'Update assessment'}</button>
                </div>
              </>
            ) : str(a, 'assessmentDate') ? (
              <KeyValues items={[{ label: 'Date held', value: formatDate(str(a, 'assessmentDate')) }, { label: 'Outcome', value: label(OUTCOMES, str(a, 'outcome')) }, { label: 'Note', value: str(a, 'assessmentNote'), wide: true }]} />
            ) : <p className="muted-note">{status === 'applied' ? 'Opens once the documents are in.' : 'No assessment was recorded.'}</p>}
          </Panel>

          {(status === 'offered' || num(a, 'depositAmount') > 0) && (
            <Panel title="Enrolment deposit" meta={`${rand(toCents(need))} for ${gradeLabel(grade)} — credited to the family’s fee account on enrolment`}
              right={<Tag tone={num(a, 'depositAmount') >= need ? 'green' : 'amber'}>{num(a, 'depositAmount') >= need ? 'Deposit in' : 'Outstanding'}</Tag>}>
              {status === 'offered' && mayEdit ? (
                <div className="toolbar" style={{ marginBottom: 0, alignItems: 'flex-end' }}>
                  <Field label="Amount received (R)"><input className="input num" style={{ width: 150 }} type="number" min={0} step="0.01" aria-label="Deposit amount" value={df.amount} onChange={(e) => setDeposit({ ...df, amount: e.target.value })} /></Field>
                  <Field label="Paid by">
                    <select className="select" style={{ height: 44 }} aria-label="Deposit method" value={df.method} onChange={(e) => setDeposit({ ...df, method: e.target.value })}>
                      {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </Field>
                  <button className="btn primary" onClick={saveDeposit} data-testid="record-deposit">Record deposit</button>
                </div>
              ) : <KeyValues items={[{ label: 'Received', value: rand(toCents(num(a, 'depositAmount'))) }, { label: 'Paid by', value: label(PAY_METHODS, str(a, 'depositMethod')) }]} />}
              <p className="muted-note" style={{ marginTop: 10 }}>Typed in by the office — no card machine or bank is connected to this demo.</p>
            </Panel>
          )}

          <Panel title="Details" right={<Flags flags={def.flags?.(a, data, today, user) ?? []} />}>
            <KeyValues items={[
              { label: 'Child', value: applicantName(a) },
              { label: 'Date of birth', value: formatDate(str(a, 'dob')) },
              { label: 'Gender', value: label(GENDERS, str(a, 'gender')) },
              { label: 'Grade applied for', value: gradeLabel(grade) },
              { label: 'Parent / guardian', value: str(a, 'guardian') },
              { label: 'Phone (fictional)', value: str(a, 'guardianPhone') },
              { label: 'Email', value: str(a, 'guardianEmail') },
              { label: 'Previous school', value: str(a, 'previousSchool') },
              { label: 'Existing family', value: str(a, 'family') ? `${familyName(data, str(a, 'family'))} — a sibling is already enrolled` : 'New family — a family record and fee account are created on enrolment', wide: true },
            ]} />
          </Panel>
        </div>
        <div className="stack">
          <Panel title={`Places in ${gradeLabel(grade)}`} meta="Enrolled learners plus places held by offers" right={<Tag tone={room.free > 0 ? 'green' : 'red'}>{room.free > 0 ? `${room.free} free` : 'Full'}</Tag>}>
            <ul className="list" data-testid="places">
              {room.rooms.map((r) => (
                <li key={r.cls.id}>
                  <span className={`dot ${r.free > 0 ? 'green' : 'red'}`} />
                  <div className="grow"><b><ModuleLink module="classes" id={r.cls.id}>{str(r.cls, 'name')}</ModuleLink></b><small>{r.enrolled} enrolled{r.held ? ` + ${r.held} held by offers` : ''} of {r.capacity} places</small></div>
                  <Tag tone={r.free > 0 ? 'green' : 'red'}>{r.free > 0 ? `${r.free} free` : 'Full'}</Tag>
                </li>
              ))}
            </ul>
            {status === 'offered' && placed && <p className="muted-note" style={{ marginTop: 10 }}>This application holds a place in {str(placed, 'name')} until the offer is accepted or declined.</p>}
            {queue.length > 0 && (
              <div style={{ marginTop: 12 }} data-testid="waitlist">
                <div className="field-label">Waiting list for {gradeLabel(grade)}</div>
                <ul className="list">
                  {queue.map((q) => (
                    <li key={q.id} style={{ padding: '8px 0' }}>
                      <span className="tag dark">#{waitlistPosition(q, data)}</span>
                      <div className="grow"><b>{q.id === a.id ? `${applicantName(q)} (this application)` : <Link to={`${base}/admissions/${q.id}`}>{applicantName(q)}</Link>}</b><small>since {formatDate(str(q, 'waitlistedOn'))}</small></div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {position > 0 && <div style={{ marginTop: 10 }}><Notice tone={openPlaces > 0 ? 'accent' : 'amber'}>Position #{position} on the waiting list. {openPlaces > 0 ? 'A place has opened — “Make offer” will now go through.' : 'An offer becomes possible when a learner leaves or an offer is declined.'}</Notice></div>}
          </Panel>
          <Panel title="History" meta="Who did what, when (simulated users)"><History record={a} /></Panel>
          <RoleBar compact />
        </div>
      </div>
      {editing && (
        <RecordFormModal def={def} record={a} open onClose={() => setEditing(false)} onSave={(v) => { act.update('applications', a.id, v, 'Details edited'); act.toast(`${a.ref} saved`); setEditing(false); }} />
      )}
    </>
  );
}
