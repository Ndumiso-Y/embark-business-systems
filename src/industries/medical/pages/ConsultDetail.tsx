import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Field, Flags, Notice, PageHeader, Panel, StatusTag } from '../../../core/components/ui';
import { History, WorkflowActions } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import RoleBar from '../../../core/components/RoleBar';
import { IcoBack, IcoPlus, IcoPrint } from '../../../core/components/Icons';
import { CLINICIANS, ICD10, MEDICINES, TESTS, label } from '../data';
import { consultProblems, patientName, resultFlags, scriptProblems, todayStr } from '../helpers';
import { PatientCard, VitalsCard } from './shared';

/** SOAP consultation: editable while draft or addendum, read-only once signed. */
export default function ConsultDetail() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { id } = useParams();
  const { can, hasModule } = useUser();
  const def = act.def('consults');
  const consult = findRecord(data, 'consults', id);
  const [draft, setDraft] = useState<Values | null>(null);
  const [adding, setAdding] = useState<'script' | 'result' | null>(null);
  if (!consult) return <><PageHeader kicker={config.businessName} title="Consultation not found" /><Link className="btn" to={`${base}/consults`}>Back</Link></>;

  const header = <PageHeader kicker={`Consultation · ${consult.ref}`} title={patientName(data, consult.values.patient)} subtitle={`${formatDate(str(consult, 'date'))} · ${label(CLINICIANS, str(consult, 'doctor'))}`} />;
  if (!can('clinical.view')) {
    return (
      <>
        <Link className="back-link" to={`${base}/consults`}><IcoBack /> Consultations</Link>
        {header}
        <Notice tone="amber">Consultation notes are hidden for your simulated role. In the demo, only users with “View clinical” see SOAP notes.</Notice>
        <div style={{ height: 14 }} /><RoleBar />
      </>
    );
  }

  const editable = consult.status !== 'signed' && can('clinical.record');
  const v = draft ?? consult.values;
  const set = (k: string, val: Values[string]) => setDraft({ ...(draft ?? consult.values), [k]: val });
  const problems = consultProblems({ ...consult, values: v });
  const visit = findRecord(data, 'visits', str(consult, 'visit'));
  const scripts = records(data, 'scripts').filter((s) => str(s, 'consult') === consult.id);
  const results = records(data, 'results').filter((r) => str(r, 'consult') === consult.id);
  const claim = records(data, 'claims').find((c) => str(c, 'consult') === consult.id);
  const save = () => { if (draft) { act.update('consults', consult.id, draft, 'Notes saved'); act.toast(`${consult.ref} saved`); setDraft(null); } };
  const area = (k: string, lbl: string, hint?: string) => (
    <Field label={lbl} hint={hint}><textarea className="textarea" aria-label={lbl} disabled={!editable} value={String(v[k] ?? '')} onChange={(e) => set(k, e.target.value)} /></Field>
  );
  const days = Number(v.sickNoteDays) || 0;

  return (
    <>
      <Link className="back-link" to={`${base}/consults`}><IcoBack /> Consultations</Link>
      <PageHeader kicker={`Consultation · ${consult.ref}`} title={patientName(data, consult.values.patient)} subtitle={`${formatDate(str(consult, 'date'))} · ${label(CLINICIANS, str(consult, 'doctor'))}${visit ? ` · visit ${visit.ref}` : ''}`}
        actions={editable ? <button className="btn" disabled={!draft} onClick={save} data-testid="save-consult">{draft ? 'Save changes' : 'Saved'}</button> : undefined} />
      <div className="doc-grid">
        <div className="stack">
          <Panel title="SOAP note" meta={consult.status === 'signed' ? 'Signed notes are locked — open an addendum to change them' : 'Subjective · Objective · Assessment · Plan'}>
            <div className="form-grid">
              <div className="span-2">{area('subjective', 'S — Subjective', 'History and symptoms in the patient’s words')}</div>
              <div className="span-2">{area('objective', 'O — Objective', 'Examination findings; triage vitals are shown on the right')}</div>
              <div className="span-2">{area('assessment', 'A — Assessment')}</div>
              <div className="span-2">{area('plan', 'P — Plan')}</div>
            </div>
          </Panel>
          <Panel title="Coding & certificates">
            <div className="form-grid">
              <Field label="ICD-10 (sample code)" hint="Public ICD-10 codes shown as samples for the demo">
                <select className="select" aria-label="ICD-10 code" disabled={!editable} value={String(v.icd10 ?? '')} onChange={(e) => set('icd10', e.target.value)}>
                  <option value="">Select…</option>{ICD10.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Sick note (days)" hint="0 = no sick note">
                <input className="input num" type="number" min={0} max={30} aria-label="Sick note days" disabled={!editable} value={v.sickNoteDays === null || v.sickNoteDays === undefined ? '' : String(v.sickNoteDays)} onChange={(e) => set('sickNoteDays', e.target.value === '' ? 0 : Math.max(0, Math.min(30, Number(e.target.value))))} />
              </Field>
              <Field label="Follow-up by">
                <input className="input" type="date" aria-label="Follow-up date" disabled={!editable} value={String(v.followUp ?? '')} onChange={(e) => set('followUp', e.target.value)} />
              </Field>
            </div>
          </Panel>
          {days > 0 && (
            <Panel title="Sick note preview" right={<button className="btn sm" onClick={() => window.print()}><IcoPrint /> Print</button>}>
              <div className="print-sheet">
                <div className="print-only print-head"><b>{config.businessName}</b> · DEMONSTRATION — NOT A VALID MEDICAL CERTIFICATE</div>
                <div className="sms-preview" data-testid="sick-note">
                  This is to certify that {patientName(data, consult.values.patient)} was seen on {formatDate(str(consult, 'date'))} and is unfit for work from {formatDate(str(consult, 'date'))} to {formatDate(addDays(str(consult, 'date'), days - 1))} ({days} day{days === 1 ? '' : 's'}).
                  <br /><small>{label(CLINICIANS, str(consult, 'doctor'))} · {config.businessName} (fictional) · demonstration only, not a valid certificate.</small>
                </div>
              </div>
            </Panel>
          )}
          <div className="grid-2-even">
            <Panel title="Scripts" right={can('prescribe') && consult.status !== 'addendum' ? <button className="btn sm" onClick={() => setAdding('script')} data-testid="add-script"><IcoPlus /> Add script</button> : undefined}>
              {scripts.length ? (
                <ul className="list">
                  {scripts.map((s) => (
                    <li key={s.id}>
                      <div className="grow">
                        {hasModule('scripts') ? <Link to={`${base}/scripts/${s.id}`}><b>{label(MEDICINES, str(s, 'medicine'))} {str(s, 'strength')}</b></Link> : <b>{label(MEDICINES, str(s, 'medicine'))}</b>}
                        <small>{s.ref} · {str(s, 'dose')} · {str(s, 'durationDays')} days · {str(s, 'repeats') || 0} repeat(s)</small>
                        {s.status === 'draft' && scriptProblems(s, data)[0]?.startsWith('Recorded allergy') && <small style={{ color: 'var(--danger)' }}>Allergy match — cannot be issued</small>}
                      </div>
                      <StatusTag workflow={act.def('scripts').workflow} status={s.status} />
                    </li>
                  ))}
                </ul>
              ) : <p className="muted-note">No scripts for this consultation.</p>}
            </Panel>
            <Panel title="Tests requested" right={can('clinical.record') ? <button className="btn sm" onClick={() => setAdding('result')} data-testid="request-test"><IcoPlus /> Request test</button> : undefined}>
              {results.length ? (
                <ul className="list">
                  {results.map((r) => (
                    <li key={r.id}>
                      <div className="grow">
                        {hasModule('results') ? <Link to={`${base}/results/${r.id}`}><b>{label(TESTS, str(r, 'test'))}</b></Link> : <b>{label(TESTS, str(r, 'test'))}</b>}
                        <small>{r.ref} · requested {formatDate(str(r, 'requestedOn'))}</small>
                        <Flags flags={resultFlags(r, todayStr())} />
                      </div>
                      <StatusTag workflow={act.def('results').workflow} status={r.status} />
                    </li>
                  ))}
                </ul>
              ) : <p className="muted-note">No tests requested.</p>}
            </Panel>
          </div>
        </div>
        <div className="stack">
          <Panel title="Status" right={<StatusTag workflow={def.workflow} status={consult.status} />}>
            {consult.status !== 'signed' && problems.length > 0 && (
              <Notice tone="amber"><b>Before signing</b><ul className="problem-list" data-testid="consult-problems">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Notice>
            )}
            {draft && <Notice tone="grey">Save your changes before signing.</Notice>}
            <div style={{ marginTop: 12 }}>{!draft && <WorkflowActions def={def} record={consult} />}</div>
            <p className="muted-note" style={{ marginTop: 10 }}>Signing locks the note and creates a draft claim with a demo tariff line. Checks are demo data-entry rules, not clinical guidance.</p>
            {claim && hasModule('claims') && <Link className="btn sm" style={{ marginTop: 10 }} to={`${base}/claims/${claim.id}`}>Open claim {claim.ref}</Link>}
          </Panel>
          {visit && <Panel title="Triage vitals" meta={`${visit.ref}${str(visit, 'triagedAt') ? ` · triaged ${str(visit, 'triagedAt')}` : ''}`}><VitalsCard values={visit.values} /></Panel>}
          <Panel title="Patient"><PatientCard data={data} patientId={consult.values.patient} /></Panel>
          <Panel title="History"><History record={consult} /></Panel>
          <RoleBar compact />
        </div>
      </div>
      {adding === 'script' && (
        <RecordFormModal def={act.def('scripts')} open title="New script (draft)" onClose={() => setAdding(null)}
          initial={{ patient: consult.values.patient, consult: consult.id, date: todayStr(), prescriber: str(consult, 'doctor'), dose: '1 tablet', frequency: 'bd', durationDays: 5, repeats: 0 }}
          onSave={(vals) => {
            const med = MEDICINES.find((m) => m.value === vals.medicine);
            const r = act.create('scripts', { ...vals, strength: vals.strength || med?.strength || '' }, 'draft', `Script drafted from ${consult.ref}`);
            const blocked = scriptProblems(r, data)[0];
            act.toast(blocked?.startsWith('Recorded allergy') ? `${r.ref} drafted — allergy match, it cannot be issued` : `Script ${r.ref} drafted`, blocked?.startsWith('Recorded allergy') ? 'err' : 'ok');
            setAdding(null);
          }} />
      )}
      {adding === 'result' && (
        <RecordFormModal def={act.def('results')} open title="Request test" onClose={() => setAdding(null)}
          initial={{ patient: consult.values.patient, consult: consult.id, requestedOn: todayStr(), requestedBy: str(consult, 'doctor'), lab: 'highveld' }}
          onSave={(vals) => { const r = act.create('results', { ...vals, abnormal: false }, 'requested', `Test requested from ${consult.ref}`); act.toast(`Test ${r.ref} requested (no lab order is sent)`); setAdding(null); }} />
      )}
    </>
  );
}
