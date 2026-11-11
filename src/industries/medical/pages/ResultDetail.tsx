import { useParams } from 'react-router-dom';
import { useData, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { LABS, TESTS, label } from '../data';
import { PatientCard } from './shared';

export default function ResultDetail() {
  const { id } = useParams();
  const data = useData();
  const r = findRecord(data, 'results', id);
  return (
    <RecordDetail backLabel="Results inbox" aside={r ? <Panel title="Patient"><PatientCard data={data} patientId={r.values.patient} /></Panel> : undefined}>
      {r && <ResultPanel id={r.id} />}
    </RecordDetail>
  );
}

function ResultPanel({ id }: { id: string }) {
  const data = useData();
  const { can } = useUser();
  const r = findRecord(data, 'results', id)!;
  const span = (a: string, b: string) => (str(r, a) && str(r, b) ? `${daysBetween(str(r, a), str(r, b))} day(s)` : '—');
  return (
    <Panel title={label(TESTS, str(r, 'test'))} meta={label(LABS, str(r, 'lab'))} right={r.values.abnormal ? <Tag tone="red">Flagged abnormal</Tag> : str(r, 'receivedOn') ? <Tag tone="green">Within range</Tag> : undefined}>
      {can('clinical.view') ? (
        str(r, 'summary') ? <div className="sms-preview" data-testid="result-summary">{str(r, 'summary')}</div> : <p className="muted-note" style={{ marginBottom: 12 }}>No result captured yet. There is no lab feed in the demo — enter the summary with Edit.</p>
      ) : <div style={{ marginBottom: 12 }}><Notice tone="grey">Result values are hidden for your simulated role. You can still record that the patient was informed.</Notice></div>}
      <KeyValues items={[
        { label: 'Requested', value: formatDate(str(r, 'requestedOn')) },
        { label: 'Lab turnaround', value: span('requestedOn', 'receivedOn') },
        { label: 'Received → reviewed', value: span('receivedOn', 'reviewedOn') },
        { label: 'Patient informed', value: formatDate(str(r, 'informedOn')) },
      ]} />
      {r.status === 'received' && !can('results.review') && <p className="muted-note" style={{ marginTop: 10 }}>Only doctors (Review results permission) can mark a result as reviewed.</p>}
    </Panel>
  );
}
