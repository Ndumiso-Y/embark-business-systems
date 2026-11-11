import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord, IndustryData, Value, Values } from '../../../core/types';
import { findRecord, str } from '../../../core/engine';
import { useActions, useBase, useUser } from '../../../core/context';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Modal, Notice, Tag } from '../../../core/components/ui';
import { SCHEMES, label } from '../data';
import { ageOn, todayStr, vitalAlerts, vitalsProblems } from '../helpers';

const NO_ALLERGY = /^\s*(nka|nkda|none|no known)/i;

/** Compact patient summary. Allergies and chronic conditions only for clinical roles. */
export function PatientCard({ data, patientId }: { data: IndustryData; patientId: unknown }) {
  const base = useBase();
  const { can, hasModule } = useUser();
  const p = findRecord(data, 'patients', String(patientId ?? ''));
  if (!p) return null;
  const allergies = str(p, 'allergies');
  return (
    <div className="patient-card">
      <span className="avatar">{str(p, 'firstName')[0]}{str(p, 'lastName')[0]}</span>
      <div className="grow">
        {hasModule('patients') ? <Link to={`${base}/patients/${p.id}`}><b>{str(p, 'firstName')} {str(p, 'lastName')}</b></Link> : <b>{str(p, 'firstName')} {str(p, 'lastName')}</b>}
        <small>{p.ref} · {ageOn(str(p, 'dob'), todayStr())} yrs · born {formatDate(str(p, 'dob'))}</small>
        <small>{label(SCHEMES, str(p, 'scheme'))}{str(p, 'memberNo') ? ` · ${str(p, 'memberNo')}` : ''}</small>
        <small>{str(p, 'phone')} · {str(p, 'email')}</small>
        {can('clinical.view') && (
          <>
            <small className={allergies && !NO_ALLERGY.test(allergies) ? 'med' : ''} data-testid="patient-allergies">Allergies: {allergies || 'not recorded'}</small>
            <small>Chronic: {str(p, 'chronicConditions') || '—'}</small>
          </>
        )}
      </div>
    </div>
  );
}

export function AllergyTag({ data, patientId }: { data: IndustryData; patientId: unknown }) {
  const { can } = useUser();
  const a = str(findRecord(data, 'patients', String(patientId ?? '')), 'allergies');
  if (!can('clinical.view') || !a || NO_ALLERGY.test(a)) return null;
  return <Tag tone="red">Allergy: {a}</Tag>;
}

const fmt = (v: Value, unit = '') => (v === undefined || v === null || v === '' ? '—' : `${v}${unit}`);

/** Read-only vitals with demo attention highlights. */
export function VitalsCard({ values }: { values: Values }) {
  const alerts = vitalAlerts(values);
  return (
    <>
      <KeyValues items={[
        { label: 'Blood pressure', value: values.bpSys ? `${values.bpSys}/${values.bpDia} mmHg` : '—' },
        { label: 'Pulse', value: fmt(values.pulse, ' bpm') },
        { label: 'Temperature', value: values.temp ? `${Number(values.temp).toFixed(1)} °C` : '—' },
        { label: 'SpO2', value: fmt(values.spo2, '%') },
        { label: 'Weight', value: fmt(values.weight, ' kg') },
        { label: 'Glucose', value: fmt(values.glucose, ' mmol/L') },
      ]} />
      {alerts.length > 0 && <div className="flags" style={{ marginTop: 12 }} data-testid="vital-alerts">{alerts.map((a) => <Tag key={a.label} tone={a.tone}>{a.label}</Tag>)}</div>}
      {values.triageNote ? <p className="muted-note" style={{ marginTop: 10 }}>{String(values.triageNote)}</p> : null}
    </>
  );
}

const VITAL_INPUTS: Array<[string, string, number]> = [
  ['bpSys', 'BP systolic (mmHg)', 1], ['bpDia', 'BP diastolic (mmHg)', 1], ['pulse', 'Pulse (bpm)', 1], ['temp', 'Temperature (°C)', 0.1],
  ['spo2', 'SpO2 (%)', 1], ['weight', 'Weight (kg)', 0.1], ['glucose', 'Glucose (mmol/L, optional)', 0.1],
];

/** Triage form: capture vitals and (optionally) move the visit to "Triaged". */
export function TriageModal({ visit, data, onClose }: { visit: DemoRecord; data: IndustryData; onClose: () => void }) {
  const act = useActions();
  const p = findRecord(data, 'patients', str(visit, 'patient'));
  const child = ageOn(str(p, 'dob'), todayStr()) < 12;
  const [v, setV] = useState<Values>(() => Object.fromEntries([...VITAL_INPUTS.map(([k]) => k), 'triageNote'].map((k) => [k, visit.values[k] ?? ''])));
  const [errors, setErrors] = useState<string[]>([]);
  const advance = visit.status === 'arrived';
  const save = () => {
    const problems = vitalsProblems(v, child);
    setErrors(problems);
    if (problems.length) return;
    act.update('visits', visit.id, v, 'Vitals captured');
    if (advance) {
      const res = act.transition('visits', visit.id, 'triaged');
      if (!res.ok) { setErrors([res.reason]); return; }
      act.toast(`${visit.ref}: triaged`);
    } else act.toast(`${visit.ref}: vitals updated`);
    onClose();
  };
  const alerts = vitalAlerts(v);
  return (
    <Modal open wide title={`Triage · ${str(p, 'firstName')} ${str(p, 'lastName')}`} sub={`${visit.ref} · ${str(visit, 'reason') || 'No reason recorded'}${child ? ' · child: BP optional' : ''}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} data-testid="save-triage">{advance ? 'Save vitals & mark triaged' : 'Save vitals'}</button></>}>
      <div className="form-grid" data-testid="triage-form">
        {VITAL_INPUTS.map(([k, l, step]) => (
          <Field key={k} label={l}>
            <input className="input num" type="number" step={step} aria-label={l} value={v[k] === null || v[k] === undefined ? '' : String(v[k])}
              onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value === '' ? '' : Number(e.target.value) }))} />
          </Field>
        ))}
        <div className="span-2">
          <Field label="Triage note"><textarea className="textarea" aria-label="Triage note" value={String(v.triageNote ?? '')} onChange={(e) => setV((s) => ({ ...s, triageNote: e.target.value }))} /></Field>
        </div>
      </div>
      {alerts.length > 0 && <div className="flags" style={{ margin: '12px 0' }}>{alerts.map((a) => <Tag key={a.label} tone={a.tone}>{a.label}</Tag>)}</div>}
      {errors.length > 0 && <Notice tone="red"><ul className="problem-list">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Notice>}
      <p className="muted-note" style={{ marginTop: 10 }}>Highlights (BP ≥ 140/90, temperature ≥ 38.0 °C, SpO2 &lt; 94%) are demo display rules that mark a patient “for doctor review”. They are not clinical thresholds or advice.</p>
    </Modal>
  );
}
