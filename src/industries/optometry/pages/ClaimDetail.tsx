import { useParams } from 'react-router-dom';
import { useData } from '../../../core/context';
import { findRecord, lines, linesTotals, num, str } from '../../../core/engine';
import { formatRand } from '../../../core/lib/money';
import { Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { claimProblems } from '../helpers';
import { PatientCard } from './shared';

export default function ClaimDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'claims', id);
  return (
    <RecordDetail aside={c ? <Panel title="Patient"><PatientCard data={data} patientId={c.values.patient} /></Panel> : undefined}>
      {c && <ClaimLines id={c.id} />}
    </RecordDetail>
  );
}

function ClaimLines({ id }: { id: string }) {
  const data = useData();
  const c = findRecord(data, 'claims', id)!;
  const t = linesTotals(lines(c));
  const scheme = Math.round(num(c, 'schemePaid') * 100);
  const patient = Math.round(num(c, 'patientPaid') * 100);
  const problems = c.status === 'draft' ? claimProblems(c, data) : [];
  return (
    <Panel title="Account" meta="Tariff codes are invented for the demo · VAT 15% demo default">
      {problems.length > 0 && <div style={{ marginBottom: 12 }}><Notice tone="amber"><b>Cannot submit yet</b><ul className="problem-list">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Notice></div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Code</th><th>Description</th><th className="num">Qty</th><th className="num">Excl. VAT</th></tr></thead>
          <tbody>{lines(c).map((l, i) => <tr key={l.id}><td>{l.code || '—'}</td><td>{l.description}</td><td className="num">{l.qty}</td><td className="num">{formatRand(t.lines[i].excl)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="totals" style={{ marginTop: 12 }}>
        <div className="row"><span>Claim total (incl. VAT)</span><b>{formatRand(t.total)}</b></div>
        <div className="row"><span>Scheme paid</span><b>−{formatRand(scheme)}</b></div>
        <div className="row"><span>Patient paid</span><b>−{formatRand(patient)}</b></div>
        <div className="grand"><span>Balance</span><b data-testid="claim-balance">{formatRand(t.total - scheme - patient)}</b></div>
      </div>
      {str(c, 'icd10') && <p className="muted-note" style={{ marginTop: 10 }}>Diagnosis: {str(c, 'icd10')} (sample code)</p>}
    </Panel>
  );
}
