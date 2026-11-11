import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, Notice, PageHeader, Panel, StatusTag } from '../../../core/components/ui';
import { History, WorkflowActions } from '../../../core/components/records';
import RoleBar from '../../../core/components/RoleBar';
import { IcoBack } from '../../../core/components/Icons';
import { ICD10, OPTOMETRISTS, RECALL_TYPES, label } from '../data';
import { examProblems, patientName } from '../helpers';
import { eyeFrom, formatEye, validateEye, validVA } from '../rx';
import { IopTags, PatientCard, RxCard } from './shared';

/** Structured eye examination: editable while in progress, read-only once finalised. */
export default function ExamDetail() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const def = act.def('exams');
  const exam = findRecord(data, 'exams', id);
  const [draft, setDraft] = useState<Values | null>(null);
  if (!exam) return <><PageHeader kicker={config.businessName} title="Exam not found" /><Link className="btn" to={`${base}/exams`}>Back</Link></>;

  if (!can('clinical.view')) {
    return (
      <>
        <Link className="back-link" to={`${base}/exams`}><IcoBack /> Eye examinations</Link>
        <PageHeader kicker={`Eye examination · ${exam.ref}`} title={patientName(data, exam.values.patient)} subtitle={formatDate(str(exam, 'date'))} />
        <Notice tone="amber">Clinical findings are hidden for your simulated role. In the demo, only users with “View clinical” see exam details.</Notice>
        <div style={{ height: 14 }} /><RoleBar />
      </>
    );
  }

  const editable = exam.status !== 'final' && can('clinical.record');
  const v = draft ?? exam.values;
  const set = (k: string, val: Values[string]) => setDraft({ ...(draft ?? exam.values), [k]: val });
  const n = (k: string) => (v[k] === null || v[k] === undefined || v[k] === '' ? '' : Number(v[k]));
  const problems = examProblems({ ...exam, values: v });
  const rErr = validateEye(eyeFrom(v, 'r'));
  const lErr = validateEye(eyeFrom(v, 'l'));
  const rx = records(data, 'prescriptions').find((p) => str(p, 'exam') === exam.id);
  const save = () => { if (draft) { act.update('exams', exam.id, draft, 'Exam notes saved'); act.toast(`${exam.ref} saved`); setDraft(null); } };

  const num = (k: string, lbl: string, step = 0.25, err?: string) => (
    <td><input className="input sm num" type="number" step={step} aria-label={lbl} aria-invalid={err ? true : undefined} title={err} disabled={!editable} value={n(k)} onChange={(e) => set(k, e.target.value === '' ? null : Number(e.target.value))} /></td>
  );
  const txt = (k: string, lbl: string) => (
    <td><input className="input sm" aria-label={lbl} aria-invalid={!validVA(str({ ...exam, values: v }, k)) ? true : undefined} disabled={!editable} value={String(v[k] ?? '')} onChange={(e) => set(k, e.target.value)} placeholder="6/6" /></td>
  );
  const area = (k: string, lbl: string) => (
    <Field label={lbl}><textarea className="textarea" aria-label={lbl} disabled={!editable} value={String(v[k] ?? '')} onChange={(e) => set(k, e.target.value)} /></Field>
  );
  const sel = (k: string, lbl: string, opts: Array<{ value: string; label: string }>) => (
    <Field label={lbl}><select className="select" aria-label={lbl} disabled={!editable} value={String(v[k] ?? '')} onChange={(e) => set(k, e.target.value)}><option value="">Select…</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
  );

  return (
    <>
      <Link className="back-link" to={`${base}/exams`}><IcoBack /> Eye examinations</Link>
      <PageHeader kicker={`Eye examination · ${exam.ref}`} title={patientName(data, exam.values.patient)} subtitle={`${formatDate(str(exam, 'date'))} · ${label(OPTOMETRISTS, str(exam, 'optometrist'))}`}
        actions={editable ? <button className="btn" disabled={!draft} onClick={save} data-testid="save-exam">{draft ? 'Save changes' : 'Saved'}</button> : undefined} />
      <div className="doc-grid">
        <div className="stack">
          <Panel title="History & symptoms">
            <div className="form-grid">
              <div className="span-2">{area('reason', 'Reason for visit')}</div>
              <div className="span-2">{area('history', 'Ocular & general history')}</div>
            </div>
          </Panel>
          <Panel title="Visual acuity & subjective refraction" meta="Minus-cylinder notation · 0.25 D steps · axis 1–180">
            <div className="table-wrap">
              <table className="table items-table refraction" data-testid="refraction">
                <thead><tr><th>Eye</th><th>VA unaided</th><th className="num">Sphere</th><th className="num">Cyl</th><th className="num">Axis</th><th className="num">Add</th><th>VA corrected</th></tr></thead>
                <tbody>
                  <tr><td><strong>R</strong></td>{txt('r_vaUnaided', 'Right VA unaided')}{num('r_sph', 'Right sphere', 0.25, rErr.sph)}{num('r_cyl', 'Right cylinder', 0.25, rErr.cyl)}{num('r_axis', 'Right axis', 1, rErr.axis)}{num('r_add', 'Right add', 0.25, rErr.add)}{txt('r_va', 'Right VA corrected')}</tr>
                  <tr><td><strong>L</strong></td>{txt('l_vaUnaided', 'Left VA unaided')}{num('l_sph', 'Left sphere', 0.25, lErr.sph)}{num('l_cyl', 'Left cylinder', 0.25, lErr.cyl)}{num('l_axis', 'Left axis', 1, lErr.axis)}{num('l_add', 'Left add', 0.25, lErr.add)}{txt('l_va', 'Left VA corrected')}</tr>
                </tbody>
              </table>
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <Field label="PD (mm)"><input className="input num" type="number" step={0.5} aria-label="PD (mm)" disabled={!editable} value={n('pd')} onChange={(e) => set('pd', e.target.value === '' ? null : Number(e.target.value))} /></Field>
              <div className="rx-summary"><small>Right</small><b>{formatEye(eyeFrom(v, 'r'))}</b><small>Left</small><b>{formatEye(eyeFrom(v, 'l'))}</b></div>
            </div>
          </Panel>
          <Panel title="Eye health" right={<IopTags values={v} />}>
            <div className="form-grid">
              <Field label="R IOP (mmHg)"><input className="input num" type="number" aria-label="Right IOP" disabled={!editable} value={n('r_iop')} onChange={(e) => set('r_iop', e.target.value === '' ? null : Number(e.target.value))} /></Field>
              <Field label="L IOP (mmHg)"><input className="input num" type="number" aria-label="Left IOP" disabled={!editable} value={n('l_iop')} onChange={(e) => set('l_iop', e.target.value === '' ? null : Number(e.target.value))} /></Field>
              <div className="span-2">{area('anterior', 'Anterior eye')}</div>
              <div className="span-2">{area('posterior', 'Posterior eye / fundus')}</div>
            </div>
          </Panel>
          <Panel title="Assessment & plan">
            <div className="form-grid">
              {sel('diagnosis', 'Diagnosis (ICD-10 sample)', ICD10)}
              {sel('referral', 'Referral', [{ value: 'none', label: 'None' }, { value: 'ophth-routine', label: 'Ophthalmologist — routine' }, { value: 'ophth-urgent', label: 'Ophthalmologist — urgent' }, { value: 'gp', label: 'General practitioner' }])}
              {sel('recallMonths', 'Recall in', [{ value: '6', label: '6 months' }, { value: '12', label: '12 months' }, { value: '24', label: '24 months' }])}
              {sel('recallType', 'Recall reason', RECALL_TYPES)}
              <div className="span-2">{area('plan', 'Management plan')}</div>
            </div>
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Exam status" right={<StatusTag workflow={def.workflow} status={exam.status} />}>
            {exam.status !== 'final' && problems.length > 0 && (
              <Notice tone="amber"><b>Before finalising</b><ul className="problem-list" data-testid="exam-problems">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Notice>
            )}
            {draft && <Notice tone="grey">Save your changes before finalising.</Notice>}
            <div style={{ marginTop: 12 }}>{!draft && <WorkflowActions def={def} record={exam} />}</div>
            <p className="muted-note" style={{ marginTop: 10 }}>Finalising locks the record, issues a prescription and sets the patient’s recall date. Checks are demo data-entry rules, not clinical guidance.</p>
          </Panel>
          {rx && (
            <Panel title={`Prescription ${rx.ref}`} right={<Link className="btn sm" to={`${base}/prescriptions/${rx.id}`}>Open</Link>}>
              <RxCard values={rx.values} />
            </Panel>
          )}
          {!rx && exam.status === 'final' && <RxCard values={exam.values} showVA caption="No prescription issued" />}
          <Panel title="Patient"><PatientCard data={data} patientId={exam.values.patient} /></Panel>
          <Panel title="History"><History record={exam} /></Panel>
          <RoleBar compact />
        </div>
      </div>
    </>
  );
}
