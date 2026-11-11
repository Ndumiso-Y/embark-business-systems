import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { IcoPrint } from '../../../core/components/Icons';
import { DOCTORS, FREQUENCIES, MEDICINES, label } from '../data';
import { allergyConflict, patientName } from '../helpers';
import { PatientCard } from './shared';

export default function ScriptDetail() {
  const { id } = useParams();
  const data = useData();
  const rx = findRecord(data, 'scripts', id);
  return (
    <RecordDetail backLabel="Scripts" aside={rx ? <><AllergyCheck id={rx.id} /><Panel title="Patient"><PatientCard data={data} patientId={rx.values.patient} /></Panel></> : undefined}>
      {rx && <ScriptPanel id={rx.id} />}
    </RecordDetail>
  );
}

function AllergyCheck({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const [alt, setAlt] = useState('');
  const rx = findRecord(data, 'scripts', id)!;
  const p = findRecord(data, 'patients', str(rx, 'patient'));
  const hit = allergyConflict(str(p, 'allergies'), str(rx, 'medicine'));
  const open = rx.status === 'draft' || rx.status === 'issued';
  const safe = MEDICINES.filter((m) => !allergyConflict(str(p, 'allergies'), m.value));
  const swap = () => {
    const med = MEDICINES.find((m) => m.value === alt);
    if (!med) { act.toast('Choose a medicine first.', 'err'); return; }
    // The usual strength changes with the medicine, so replace it too.
    act.update('scripts', rx.id, { medicine: med.value, strength: med.strength }, `Medicine changed to ${med.label} (allergy match on ${hit?.medicine ?? 'previous medicine'})`);
    act.toast(`${rx.ref}: now ${med.label} ${med.strength} — check the dose, then sign & issue`);
    setAlt('');
  };
  return (
    <Panel title="Allergy check" meta="Demo text match against the recorded allergies">
      {hit ? (
        <>
          <Notice tone="red"><b>Recorded allergy: {can('clinical.view') ? str(p, 'allergies') : 'hidden for your role'}</b><br />{hit.medicine} is in the {hit.group} group. The script cannot be issued or dispensed until the medicine is changed or the allergy record is corrected.</Notice>
          {open && (can('prescribe') ? (
            <div style={{ marginTop: 12 }} data-testid="swap-medicine">
              <Field label="Change to a medicine with no recorded match" hint="Lists the demo medicines that do not match this patient’s allergy text. Not a clinical recommendation.">
                <select className="select" aria-label="Alternative medicine" value={alt} onChange={(e) => setAlt(e.target.value)}>
                  <option value="">Select…</option>
                  {safe.map((m) => <option key={m.value} value={m.value}>{m.label} ({m.group})</option>)}
                </select>
              </Field>
              <button className="btn sm primary" style={{ marginTop: 10 }} onClick={swap} data-testid="swap-medicine-save">Change medicine</button>
            </div>
          ) : <p className="muted-note" style={{ marginTop: 10 }}>A prescriber (Prescribe permission) must change the medicine. Switch to a doctor in the top bar.</p>)}
        </>
      ) : (
        <Notice tone="accent">No recorded allergy matches {label(MEDICINES, str(rx, 'medicine'))} ({MEDICINES.find((m) => m.value === str(rx, 'medicine'))?.group ?? 'unknown group'}). This is a simple text match for the demo, not clinical decision support.</Notice>
      )}
    </Panel>
  );
}

function ScriptPanel({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const rx = findRecord(data, 'scripts', id)!;
  const med = MEDICINES.find((m) => m.value === str(rx, 'medicine'));
  const days = Number(rx.values.durationDays) || 0;
  const consult = findRecord(data, 'consults', str(rx, 'consult'));
  const meta = rx.status === 'draft' ? `Draft dated ${formatDate(str(rx, 'date'))} — not issued yet` : rx.status === 'cancelled' ? `Cancelled · dated ${formatDate(str(rx, 'date'))}` : `Issued ${formatDate(str(rx, 'date'))}`;
  return (
    <Panel title="Prescription" meta={meta} right={<button className="btn sm" onClick={() => window.print()}><IcoPrint /> Print</button>}>
      <div className="print-sheet">
        <div className="print-only print-head"><b>{config.businessName}</b> · DEMONSTRATION — NOT A VALID PRESCRIPTION · fictional practice and patient</div>
        <p className="muted-note" style={{ marginBottom: 10 }}>{patientName(data, rx.values.patient)} · {label(DOCTORS, str(rx, 'prescriber'))}</p>
        <div className="sms-preview" data-testid="script-sheet">
          <b>{med?.label ?? str(rx, 'medicine')} {str(rx, 'strength') || med?.strength}</b><br />
          {str(rx, 'dose')} {label(FREQUENCIES, str(rx, 'frequency')).toLowerCase()} for {days} day{days === 1 ? '' : 's'} · {Number(rx.values.repeats) || 0} repeat(s)
          {str(rx, 'instructions') && <><br /><small>{str(rx, 'instructions')}</small></>}
        </div>
        <KeyValues items={[
          { label: 'Medicine group', value: med?.group ?? '—' },
          { label: 'Course ends', value: days ? formatDate(addDays(str(rx, 'date'), days - 1)) : '—' },
          { label: 'Repeats', value: `${Number(rx.values.repeats) || 0} of max 5` },
          { label: 'Prescriber', value: label(DOCTORS, str(rx, 'prescriber')) },
        ]} />
      </div>
      {consult && <p className="muted-note" style={{ marginTop: 10 }}>Written during consultation {hasModule('consults') ? <Link to={`${base}/consults/${consult.id}`} data-testid="back-to-consult">{consult.ref}</Link> : consult.ref}.</p>}
    </Panel>
  );
}
