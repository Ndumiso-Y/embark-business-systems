import { Link, useParams } from 'react-router-dom';
import { useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { O2_MAX, O2_MIN } from '../data';
import { contractorClearance, contractorName, gasTestProblem, permitExpired, todayStr } from '../helpers';
import { Check } from './shared';

export default function PermitDetail() {
  const { id } = useParams();
  const data = useData();
  const p = findRecord(data, 'permits', id);
  return <RecordDetail aside={p ? <Checks id={p.id} /> : undefined} />;
}

function Checks({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const today = todayStr();
  const p = findRecord(data, 'permits', id)!;
  const confined = str(p, 'type') === 'confined';
  const gas = confined ? gasTestProblem(p.values.gasO2) : null;
  const expired = permitExpired(p, today);
  const c = findRecord(data, 'contractors', str(p, 'contractor'));
  const clearance = c ? contractorClearance(c, today) : null;
  return (
    <>
      <Panel title="Activation checks" meta="Evaluated live — the same rules block “Activate permit”">
        <ul className="list" data-testid="permit-checks">
          <Check ok={p.values.isolationConfirmed === true} label="Isolation & lock-out confirmed" detail={str(p, 'isolationPoints') || 'No isolation points recorded'} />
          <Check ok={confined ? !gas : null} label={`Gas test — oxygen ${O2_MIN}–${O2_MAX} %`}
            detail={confined ? (gas ?? `O₂ ${num(p, 'gasO2')} % · tested by ${str(p, 'gasTestedBy') || '—'}`) : 'Only required for confined-space entry'} />
          <Check ok={!expired} label="Within validity" detail={`${formatDate(str(p, 'validFrom'))} → ${formatDate(str(p, 'validTo'))} ${str(p, 'expiresAt')}`} />
          <Check ok={clearance ? clearance.cleared : null} label="Contractor cleared for site"
            detail={c ? <>{hasModule('contractors') ? <Link to={`${base}/contractors/${c.id}`}>{contractorName(c)}</Link> : contractorName(c)}{clearance && !clearance.cleared ? ` — ${clearance.reasons.join('; ')}` : ''}</> : 'Own employees — no contractor linked'} />
        </ul>
        {p.status === 'active' && expired && <div style={{ marginTop: 12 }}><Notice tone="red">This permit is still active after its expiry time. Close it, or suspend the work and raise a new permit.</Notice></div>}
      </Panel>
      <Notice tone="grey">Demonstration only. This is not a real permit to work and must never be used to authorise work. The oxygen band is a demo rule, not a regulatory limit.</Notice>
    </>
  );
}
