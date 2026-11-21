import { useData } from '../../../core/context';
import { records } from '../../../core/engine';
import { Notice, Stat } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { awayOn, medicalCertProblem, teamClash, todayStr } from '../helpers';
import { ModuleLink } from './shared';

/** The leave register with the numbers an approver cares about above it. */
export default function LeaveRegister() {
  const data = useData();
  const today = todayStr();
  const leave = records(data, 'leave');
  const waiting = leave.filter((l) => l.status === 'requested');
  const certs = leave.filter((l) => ['requested', 'approved'].includes(l.status ?? '') && medicalCertProblem(l));
  const clashes = waiting.filter((l) => teamClash(data, l));
  return (
    <RegisterPage intro={
      <>
        <div className="stat-grid">
          <Stat label="Awaiting approval" value={waiting.length} tone={waiting.length ? 'red' : undefined} sub="requests waiting for HR or the manager" />
          <Stat label="Away today" value={awayOn(data, today).length} sub="approved or taken leave covering today" />
          <Stat label="Medical certificate needed" value={certs.length} tone={certs.length ? 'red' : undefined} sub="sick leave of more than two days" />
          <Stat label="Team cover clashes" value={clashes.length} tone={clashes.length ? 'red' : undefined} sub="would put a team over its limit" />
        </div>
        <div style={{ marginBottom: 18 }}>
          <Notice tone="grey">Employees request their own leave on <ModuleLink module="myleave">My leave</ModuleLink>; HR can record leave for anyone with “New leave request”. Every request is checked against the balance, the medical-certificate rule and team cover before it can be approved. See the <ModuleLink module="calendar">Who’s away calendar</ModuleLink> for the picture by team.</Notice>
        </div>
      </>
    } />
  );
}
