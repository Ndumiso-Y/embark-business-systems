import { useUser } from '../../../core/context';
import { Notice } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';

/** Lab board. Roles without the Dispense permission can follow jobs but not move them — say so. */
export default function Orders() {
  const { can, user } = useUser();
  return (
    <RegisterPage intro={!can('dispense') ? (
      <div style={{ marginBottom: 14 }} data-testid="orders-readonly">
        <Notice tone="grey">
          <b>You can follow jobs here, but not move them.</b> Sending to the lab, receiving and quality checks need the Dispense permission, which {user.name} does not hold in this demo.
          Switch to the optical dispenser in the top bar to work the board. New orders are started from a patient’s current prescription.
        </Notice>
      </div>
    ) : (
      <p className="muted-note" style={{ marginBottom: 14 }}>New orders are normally started from a patient’s current prescription (Prescriptions → “Start optical order”), so the lens values come straight from the exam.</p>
    )} />
  );
}
