import { Link } from 'react-router-dom';
import { useBase, useUser } from '../../../core/context';
import { Notice } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';

/** Matters register. Roles that do intake but do not manage matters open a new matter from the client's record. */
export default function Matters() {
  const base = useBase();
  const { can, hasModule } = useUser();
  const intakeOnly = can('intake') && !can('matters.manage');
  return (
    <RegisterPage intro={intakeOnly && hasModule('clients')
      ? <Notice tone="grey">To open a new matter, go to the client’s record and press “Open new matter” — it starts at intake and goes for a conflict check. <Link to={`${base}/clients`}>Clients →</Link></Notice>
      : undefined} />
  );
}
