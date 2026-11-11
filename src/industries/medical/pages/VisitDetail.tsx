import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { Notice, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { needsDoctor } from '../helpers';
import { PatientCard, TriageModal, VitalsCard } from './shared';

export default function VisitDetail() {
  return <RecordDetail backLabel="Waiting room" aside={<Aside />} />;
}

function Aside() {
  const { id } = useParams();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { can, hasModule } = useUser();
  const [triage, setTriage] = useState(false);
  const visit = findRecord(data, 'visits', id);
  if (!visit) return null;
  const consult = records(data, 'consults').find((c) => str(c, 'visit') === visit.id);
  const canStart = needsDoctor(visit) && can('clinical.record') && ['triaged', 'withdoctor'].includes(visit.status ?? '') && !consult;
  const startConsult = () => {
    const doctor = ['tm', 'rc', 'am'].includes(str(visit, 'clinician')) ? str(visit, 'clinician') : 'tm';
    const r = act.create('consults', { patient: visit.values.patient, visit: visit.id, date: str(visit, 'date'), doctor, subjective: str(visit, 'reason'), objective: '', assessment: '', plan: '', icd10: '', sickNoteDays: 0 }, 'draft', `Consultation started from ${visit.ref}`);
    act.toast(`Consultation ${r.ref} started`);
    navigate(`${base}/consults/${r.id}`);
  };
  const triaged = ['bpSys', 'pulse', 'temp', 'spo2', 'weight'].some((k) => visit.values[k] !== undefined && visit.values[k] !== null && visit.values[k] !== '');
  return (
    <>
      <Panel title="Patient"><PatientCard data={data} patientId={visit.values.patient} /></Panel>
      <Panel title="Triage vitals" right={can('triage') && ['arrived', 'triaged', 'withdoctor'].includes(visit.status ?? '') ? <button className="btn sm primary" onClick={() => setTriage(true)} data-testid="visit-triage">{visit.status === 'arrived' ? 'Capture vitals' : 'Update vitals'}</button> : undefined}>
        {can('clinical.view') ? (triaged ? <VitalsCard values={visit.values} /> : <p className="muted-note">No vitals captured yet. The visit cannot be marked as triaged until they are.</p>)
          : <Notice tone="grey">Vitals are hidden for your simulated role.</Notice>}
      </Panel>
      {needsDoctor(visit) && (
        <Panel title="Consultation" right={consult ? <StatusTag workflow={act.def('consults').workflow} status={consult.status} /> : undefined}>
          {consult ? (hasModule('consults') ? <Link className="btn sm" to={`${base}/consults/${consult.id}`}>Open {consult.ref}</Link> : <p className="muted-note">{consult.ref}</p>)
            : canStart ? <button className="btn primary sm" onClick={startConsult} data-testid="start-consult">Start consultation</button>
              : <p className="muted-note">A doctor starts the consultation once the patient is triaged.</p>}
        </Panel>
      )}
      {triage && <TriageModal visit={visit} data={data} onClose={() => setTriage(false)} />}
    </>
  );
}
