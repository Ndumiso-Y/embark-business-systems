import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { DueTag, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { CHRONIC_CONDITIONS, TESTS, label } from '../data';
import { reviewState, todayStr } from '../helpers';
import { ReviewModal } from './ChronicCare';
import { PatientCard } from './shared';

export default function ChronicDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'chronic', id);
  return <RecordDetail backLabel="Chronic care register" aside={c ? <Aside id={c.id} /> : undefined} />;
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const [reviewing, setReviewing] = useState(false);
  const c = findRecord(data, 'chronic', id)!;
  const s = reviewState(c, todayStr());
  const results = records(data, 'results').filter((r) => str(r, 'patient') === str(c, 'patient')).sort((a, b) => str(b, 'requestedOn').localeCompare(str(a, 'requestedOn'))).slice(0, 5);
  return (
    <>
      <Panel title="Review" right={c.status === 'active' ? <DueTag state={s} /> : <Tag tone="amber">Not active</Tag>}>
        <p className="muted-note"><b>{label(CHRONIC_CONDITIONS, str(c, 'condition'))}</b> · last review {formatDate(str(c, 'lastReview'))} · next due {formatDate(str(c, 'nextReview'))}.</p>
        {can('chronic') && c.status === 'active' && <button className="btn sm primary" style={{ marginTop: 12 }} onClick={() => setReviewing(true)} data-testid="record-review">Record review</button>}
      </Panel>
      <Panel title="Patient"><PatientCard data={data} patientId={c.values.patient} /></Panel>
      <Panel title="Recent results">
        {results.length ? (
          <ul className="list">
            {results.map((r) => (
              <li key={r.id}>
                <div className="grow">
                  {hasModule('results') ? <Link to={`${base}/results/${r.id}`}><b>{label(TESTS, str(r, 'test'))}</b></Link> : <b>{label(TESTS, str(r, 'test'))}</b>}
                  <small>{formatDate(str(r, 'requestedOn'))}{r.values.abnormal ? ' · abnormal' : ''}</small>
                </div>
                <StatusTag workflow={act.def('results').workflow} status={r.status} />
              </li>
            ))}
          </ul>
        ) : <p className="muted-note">No results on file.</p>}
      </Panel>
      {reviewing && <ReviewModal entry={c} onClose={() => setReviewing(false)} />}
    </>
  );
}
