import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, lines, linesTotals, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { SUPPLIERS, label } from '../data';
import { holders, rand, todayStr } from '../helpers';

/** Requisition detail: the generic record screen plus the purchase-order and goods-received forms. */
export default function RequisitionDetail() {
  const { id } = useParams();
  const data = useData();
  const r = findRecord(data, 'requisitions', id);
  return <RecordDetail aside={r ? <Aside key={r.id} id={r.id} /> : undefined} />;
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const r = findRecord(data, 'requisitions', id)!;
  const t = linesTotals(lines(r));
  const [supplier, setSupplier] = useState(() => str(r, 'supplier'));
  const [expected, setExpected] = useState(() => str(r, 'expectedDelivery') || (str(r, 'requiredBy') > today ? str(r, 'requiredBy') : addDays(today, 3)));
  const [note, setNote] = useState(() => str(r, 'deliveryNote'));
  const [err, setErr] = useState('');
  const buyer = can('procurement');

  const issue = () => {
    if (!supplier) { setErr('Select the supplier.'); return; }
    if (!expected) { setErr('Set the expected delivery date.'); return; }
    act.update('requisitions', id, { supplier, expectedDelivery: expected });
    const res = act.transition('requisitions', id, 'ordered');
    if (!res.ok) { setErr(res.reason); return; }
    act.toast(`${r.ref}: purchase order issued to ${label(SUPPLIERS, supplier)} (demo — nothing is sent)`);
    setErr('');
  };
  const receive = (to: 'delivered' | 'partial') => {
    if (!note.trim()) { setErr('Enter the supplier’s delivery note number.'); return; }
    act.update('requisitions', id, { deliveryNote: note.trim() });
    const res = act.transition('requisitions', id, to);
    if (!res.ok) { setErr(res.reason); return; }
    act.toast(`${r.ref}: ${to === 'delivered' ? 'received in full' : 'part delivery received'} against ${note.trim()}`);
    setErr('');
  };

  return (
    <>
      <div data-testid="req-panel">
        <Panel title="Order" meta="Request → approval → purchase order → delivery">
          <KeyValues items={[
            { label: 'Value excl. VAT', value: rand(t.net) },
            { label: 'Incl. VAT', value: rand(t.total) },
            { label: 'PO number (demo)', value: str(r, 'poNumber') },
            { label: 'Expected delivery', value: str(r, 'expectedDelivery') ? formatDate(str(r, 'expectedDelivery')) : '' },
            { label: 'Delivery note', value: str(r, 'deliveryNote') },
            { label: 'Received on', value: str(r, 'receivedOn') ? formatDate(str(r, 'receivedOn')) : '' },
          ]} />
          {r.status === 'requested' && <div style={{ marginTop: 12 }}><Notice tone="grey">{can('projects.manage') ? 'Waiting for your approval — use “Approve requisition”.' : `Waiting for approval by ${holders(data, 'projects.manage')}.`}</Notice></div>}
          {r.status === 'delivered' && <div style={{ marginTop: 12 }}><Notice tone="accent">Delivered — the value now counts as material cost on the project.</Notice></div>}
        </Panel>
      </div>

      {r.status === 'approved' && (
        <Panel title="Issue the purchase order" meta="Supplier and expected delivery are required — the PO number is generated (demo)">
          {buyer ? (
            <div className="stack" style={{ gap: 10 }} data-testid="po-form">
              <Field label="Supplier" error={err || undefined}>
                <select className="select" aria-label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                  <option value="">Select…</option>
                  {SUPPLIERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Expected delivery"><input className="input" type="date" aria-label="Expected delivery" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
              <div><button className="btn sm primary" onClick={issue} data-testid="issue-po">Issue purchase order</button></div>
            </div>
          ) : <p className="muted-note">Purchase orders are issued by {holders(data, 'procurement')}.</p>}
        </Panel>
      )}

      {['ordered', 'partial'].includes(r.status ?? '') && (
        <Panel title="Receive the delivery" meta="Goods are only received against the supplier’s delivery note">
          {buyer ? (
            <div data-testid="receive-form">
              <Field label="Delivery note no." error={err || undefined}><input className="input" aria-label="Delivery note number" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. DN-48213" /></Field>
              <div className="btns" style={{ marginTop: 10 }}>
                <button className="btn sm primary" onClick={() => receive('delivered')} data-testid="receive-full">Receive in full</button>
                {r.status === 'ordered' && <button className="btn sm" onClick={() => receive('partial')}>Receive part delivery</button>}
              </div>
            </div>
          ) : <p className="muted-note">Deliveries are received by {holders(data, 'procurement')}.</p>}
        </Panel>
      )}
    </>
  );
}
