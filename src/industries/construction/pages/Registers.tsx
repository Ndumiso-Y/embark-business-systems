// Generic registers with a one-line explanation for roles that can look but not act.
import type { ReactNode } from 'react';
import { useData, useUser } from '../../../core/context';
import { Notice } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { holders } from '../helpers';

function Intro({ permission, what, children }: { permission: string; what: string; children?: ReactNode }) {
  const data = useData();
  const { can } = useUser();
  if (can(permission)) return children ? <div style={{ marginBottom: 14 }}>{children}</div> : null;
  return <div style={{ marginBottom: 14 }}><Notice tone="grey">You can follow {what} here. {holders(data, permission)} can change them — switch user in the top bar to try it.</Notice></div>;
}

export function VariationsPage() {
  return <RegisterPage intro={<Intro permission="variations.record" what="variations" />} />;
}

export function ValuationsPage() {
  return (
    <RegisterPage intro={(
      <Intro permission="valuations" what="payment valuations">
        <Notice tone="grey">Tip: start the next valuation from its project page (“New valuation” under Payment valuations). The valuation number, work done to date and approved variations are then filled in for you.</Notice>
      </Intro>
    )} />
  );
}

export function ProcurementPage() {
  return <RegisterPage intro={<Intro permission="procurement.request" what="requisitions and purchase orders" />} />;
}

export function PlantPage() {
  return <RegisterPage intro={<Intro permission="plant" what="owned and hired plant" />} />;
}

export function SnagsPage() {
  return <RegisterPage intro={<Intro permission="snags" what="snag lists" />} />;
}

export function SubcontractorsPage() {
  return <RegisterPage intro={<Intro permission="subcontractors" what="subcontractor compliance" />} />;
}

export function SafetyPage() {
  return <RegisterPage intro={<Intro permission="safety.report" what="the safety register" />} />;
}
