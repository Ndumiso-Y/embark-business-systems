import { Link } from 'react-router-dom';
import { useBase, useData } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { Empty, Flags, Panel, Stat } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { TESTS, label } from '../data';
import { patientName, resultFlags, todayStr, unreviewedAbnormal } from '../helpers';

/** Results inbox: attention list on top of the generic results register. */
export default function ResultsInbox() {
  const data = useData();
  const base = useBase();
  const today = todayStr();
  const all = records(data, 'results');
  const abnormal = unreviewedAbnormal(data);
  const toReview = all.filter((r) => r.status === 'received');
  const overdue = all.filter((r) => r.status === 'requested' && daysBetween(str(r, 'requestedOn'), today) > 7);
  const toInform = all.filter((r) => r.status === 'reviewed');
  const attention = [...abnormal, ...overdue, ...toInform.filter((r) => r.values.abnormal)];
  return (
    <RegisterPage intro={
      <>
        <div className="stat-grid">
          <Stat label="Abnormal, not reviewed" value={abnormal.length} tone={abnormal.length ? 'red' : undefined} sub="Needs a doctor (results.review)" />
          <Stat label="Received, awaiting review" value={toReview.length} />
          <Stat label="Awaiting result > 7 days" value={overdue.length} sub="Chase the lab (simulated)" />
          <Stat label="Reviewed, patient not informed" value={toInform.length} tone="accent" />
        </div>
        <div className="section-gap" />
        <Panel title="Needs attention" meta="Abnormal results first, then overdue requests and patients still to inform">
          {attention.length ? (
            <ul className="list" data-testid="results-attention">
              {attention.map((r) => (
                <li key={r.id}>
                  <div className="grow">
                    <Link to={`${base}/results/${r.id}`}><b>{patientName(data, r.values.patient)} · {label(TESTS, str(r, 'test'))}</b></Link>
                    <small>{r.ref} · requested {formatDate(str(r, 'requestedOn'))}{str(r, 'receivedOn') ? ` · received ${formatDate(str(r, 'receivedOn'))}` : ''}</small>
                  </div>
                  <Flags flags={resultFlags(r, today)} />
                </li>
              ))}
            </ul>
          ) : <Empty title="Inbox clear" body="No abnormal or overdue results." />}
        </Panel>
        <div className="section-gap" />
      </>
    } />
  );
}
