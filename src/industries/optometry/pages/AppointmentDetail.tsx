import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { isClinical } from '../helpers';
import { PatientCard } from './shared';

export default function AppointmentDetail() {
  return <RecordDetail backLabel="Diary" aside={<Aside />} />;
}

function Aside() {
  const { id } = useParams();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { can, hasModule } = useUser();
  const appt = findRecord(data, 'appointments', id);
  if (!appt) return null;
  const exam = records(data, 'exams').find((e) => str(e, 'appointment') === appt.id);
  const canStart = isClinical(appt) && can('clinical.record') && ['arrived', 'pretest', 'inexam'].includes(appt.status ?? '') && !exam;
  const startExam = () => {
    const optom = ['lk', 'sd'].includes(str(appt, 'practitioner')) ? str(appt, 'practitioner') : 'lk';
    const r = act.create('exams', { patient: appt.values.patient, date: str(appt, 'date'), optometrist: optom, appointment: appt.id, reason: str(appt, 'notes'), recallMonths: '24', recallType: 'annual', referral: 'none' }, 'draft', `Exam started from ${appt.ref}`);
    act.toast(`Exam ${r.ref} started`);
    navigate(`${base}/exams/${r.id}`);
  };
  return (
    <Panel title="Patient">
      <PatientCard data={data} patientId={appt.values.patient} />
      <div className="btns" style={{ marginTop: 14, flexWrap: 'wrap' }}>
        {canStart && <button className="btn primary" onClick={startExam} data-testid="start-exam">Start eye exam</button>}
        {exam && hasModule('exams') && <Link className="btn" to={`${base}/exams/${exam.id}`}>Open exam {exam.ref}</Link>}
        {hasModule('patients') && <Link className="btn" to={`${base}/patients/${str(appt, 'patient')}`}>Patient profile</Link>}
      </div>
      {isClinical(appt) && !can('clinical.record') && <p className="muted-note" style={{ marginTop: 10 }}>Exams are recorded by optometrists. Switch to an optometrist in the top bar to start one.</p>}
    </Panel>
  );
}
