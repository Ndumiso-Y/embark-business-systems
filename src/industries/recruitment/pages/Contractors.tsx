import { num, records } from '../../../core/engine';
import { useData } from '../../../core/context';
import { Notice, Stat } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { ILLUSTRATIVE_EARNINGS_THRESHOLD, S198A_MONTHS, S198A_WARNING_DAYS, STANDARD_WEEK_HOURS } from '../data';
import { margin, rand, randOf, s198aCheck, todayStr } from '../helpers';

/** Contractor assignments with margin and the illustrative s198A flag above the register. */
export default function Contractors() {
  const data = useData();
  const today = todayStr();
  const all = records(data, 'assignments');
  const active = all.filter((a) => a.status === 'active');
  const weekly = active.reduce((n, a) => n + margin(a).perHour * (num(a, 'hoursPerWeek') || STANDARD_WEEK_HOURS), 0);
  const flagged = active.filter((a) => s198aCheck(a, today));
  const awaiting = records(data, 'timesheets').filter((t) => t.status === 'submitted').length;
  return (
    <RegisterPage intro={
      <>
        <div className="stat-grid">
          <Stat label="Active contractors" value={active.length} tone="accent" sub={`${all.filter((a) => a.status === 'pending').length} confirmed, not started`} />
          <Stat label="Weekly margin" value={rand(weekly)} sub="charge − pay × contracted hours" />
          <Stat label="s198A demo flags" value={flagged.length} tone={flagged.length ? 'red' : undefined} sub={`below ${randOf(ILLUSTRATIVE_EARNINGS_THRESHOLD)}/yr, near ${S198A_MONTHS} months`} />
          <Stat label="Timesheets awaiting approval" value={awaiting} sub="submitted, client approval not logged" />
        </div>
        <Notice tone="grey">
          <b>Illustrative flag modelled on LRA section 198A.</b> Assignments are flagged from {S198A_WARNING_DAYS} days before they reach {S198A_MONTHS} months when the contractor’s estimated annual earnings (pay rate × contracted hours × 52) are below {randOf(ILLUSTRATIVE_EARNINGS_THRESHOLD)}. That figure is a demo constant, not the current legal threshold, and the flag is not legal advice.
        </Notice>
        <div className="section-gap" />
      </>
    } />
  );
}
