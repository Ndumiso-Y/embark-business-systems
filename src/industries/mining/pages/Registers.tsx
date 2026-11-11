// Generic registers with a one-line explanation for roles that can look but not act.
import { useData, useUser } from '../../../core/context';
import { Notice } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { holders } from '../helpers';

function ReadOnlyNote({ permission, what }: { permission: string; what: string }) {
  const data = useData();
  const { can } = useUser();
  if (can(permission)) return null;
  return <div style={{ marginBottom: 14 }}><Notice tone="grey">You can follow {what} here. {holders(data, permission)} can change them — switch user in the top bar to try it.</Notice></div>;
}

export function WorkOrdersPage() {
  return <RegisterPage intro={<ReadOnlyNote permission="maintenance" what="work orders" />} />;
}

export function EquipmentPage() {
  return <RegisterPage intro={<ReadOnlyNote permission="maintenance" what="the fleet and its service status" />} />;
}

export function ContractorsPage() {
  return <RegisterPage intro={<ReadOnlyNote permission="contractors" what="contractor clearance" />} />;
}

export function EnvironmentPage() {
  return <RegisterPage intro={<ReadOnlyNote permission="environment" what="monitoring readings" />} />;
}
