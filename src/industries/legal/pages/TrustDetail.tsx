import { Link, useParams } from 'react-router-dom';
import { useBase, useData } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { KeyValues, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { formatCents, pendingOutflowCents, trustApprovalProblems, trustBalance } from '../helpers';
import { MatterLink } from './shared';

export default function TrustDetail() {
  const { id } = useParams();
  const data = useData();
  const t = findRecord(data, 'trust', id);
  return <RecordDetail aside={t ? <Aside id={t.id} /> : undefined} backLabel="Trust ledger" />;
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const t = findRecord(data, 'trust', id)!;
  const matterId = str(t, 'matter');
  const bal = trustBalance(data, matterId);
  const problems = t.status === 'captured' ? trustApprovalProblems(t, data) : [];
  return (
    <>
      <Notice tone="red"><b>Simulated trust ledger.</b> Not Legal Practice Act / LPC compliant, no bank integration, no money moves.</Notice>
      <Panel title="Matter trust position" right={<Link className="btn sm" to={`${base}/trust?matter=${matterId}`}>Ledger</Link>}>
        <KeyValues items={[
          { label: 'Matter', value: <MatterLink data={data} id={matterId} /> },
          { label: 'Approved balance', value: formatCents(bal) },
          { label: 'Pending payments', value: formatCents(pendingOutflowCents(data, matterId)) },
        ]} />
        {problems.length > 0 && <div style={{ marginTop: 12 }}><Notice tone="amber"><b>Approval is blocked:</b><ul className="problem-list">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Notice></div>}
      </Panel>
    </>
  );
}
