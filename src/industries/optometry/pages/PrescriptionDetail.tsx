import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPrint } from '../../../core/components/Icons';
import { LENS_OPTIONS, OPTOMETRISTS, label } from '../data';
import { patientName, todayStr } from '../helpers';
import { PatientCard, RxCard } from './shared';

export default function PrescriptionDetail() {
  const { id } = useParams();
  const data = useData();
  const rx = findRecord(data, 'prescriptions', id);
  return (
    <RecordDetail aside={rx ? <Panel title="Patient"><PatientCard data={data} patientId={rx.values.patient} /></Panel> : undefined}>
      {rx && <RxPanel id={rx.id} />}
    </RecordDetail>
  );
}

function RxPanel({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const base = useBase();
  const navigate = useNavigate();
  const { can, hasModule } = useUser();
  const [ordering, setOrdering] = useState(false);
  const rx = findRecord(data, 'prescriptions', id)!;
  const expired = str(rx, 'expiry') < todayStr();
  const orders = records(data, 'orders').filter((o) => str(o, 'prescription') === rx.id && o.status !== 'cancelled');
  return (
    <Panel title="Prescription" meta={`Valid until ${formatDate(str(rx, 'expiry'))}`}
      right={<>
        <button className="btn sm" onClick={() => window.print()}><IcoPrint /> Print</button>
        {can('dispense') && hasModule('orders') && rx.status === 'issued' && <button className="btn sm primary" onClick={() => setOrdering(true)} data-testid="order-from-rx">Start optical order</button>}
      </>}>
      <div className="print-sheet">
        <div className="print-only print-head"><b>{config.businessName}</b> · DEMONSTRATION — NOT A VALID PRESCRIPTION · fictional practice and patient</div>
        <p className="muted-note" style={{ marginBottom: 10 }}>{patientName(data, rx.values.patient)} · issued {formatDate(str(rx, 'date'))} by {label(OPTOMETRISTS, str(rx, 'practitioner'))}</p>
        <RxCard values={rx.values} caption={expired ? 'Expired — re-examination needed before ordering' : undefined} />
      </div>
      {rx.status === 'issued' && !expired && (orders.length > 0
        ? <p className="muted-note" style={{ marginTop: 10 }} data-testid="rx-orders">Optical order{orders.length === 1 ? '' : 's'} from this prescription: {orders.map((o, i) => <span key={o.id}>{i > 0 && ', '}{hasModule('orders') ? <Link to={`${base}/orders/${o.id}`}>{o.ref}</Link> : o.ref}</span>)}.</p>
        : !(can('dispense') && hasModule('orders')) && <p className="muted-note" style={{ marginTop: 10 }} data-testid="rx-next">Next step: dispensing starts the optical order from this prescription. Switch to the optical dispenser in the top bar and “Start optical order” appears here.</p>)}
      {ordering && (
        <RecordFormModal def={act.def('orders')} open title="New optical order" onClose={() => setOrdering(false)}
          initial={{ patient: rx.values.patient, prescription: rx.id, kind: rx.values.rxType === 'cl' ? 'cl' : 'spectacles', pd: rx.values.pd, lens: rx.values.rxType === 'multifocal' ? 'mf-std' : 'sv-std', lab: 'clearpoint', promised: addDays(todayStr(), 7), funding: 'scheme', deposit: 0,
            lines: [{ id: 'l1', description: LENS_OPTIONS[rx.values.rxType === 'multifocal' ? 4 : 0].label, qty: 1, unitPrice: Math.round(LENS_OPTIONS[rx.values.rxType === 'multifocal' ? 4 : 0].price / 1.15) }] }}
          onSave={(v) => { const r = act.create('orders', v, 'quote', `Quoted from ${rx.ref}`); act.toast(`Order ${r.ref} created`); navigate(`${base}/orders/${r.id}`); }} />
      )}
    </Panel>
  );
}
