import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, lines, linesTotals, num, str } from '../../../core/engine';
import { formatDate, todayIso } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { KeyValues, Modal, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { IcoSend } from '../../../core/components/Icons';
import { LABS, LENS_OPTIONS, label } from '../data';
import { patientName } from '../helpers';
import { PatientCard, RxCard } from './shared';

export default function OrderDetail() {
  const { id } = useParams();
  const data = useData();
  const o = findRecord(data, 'orders', id);
  return (
    <RecordDetail aside={o ? <Aside id={o.id} /> : undefined}>
      {o && <Job id={o.id} />}
    </RecordDetail>
  );
}

function Job({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const o = findRecord(data, 'orders', id)!;
  const rx = findRecord(data, 'prescriptions', str(o, 'prescription'));
  const frame = findRecord(data, 'stock', str(o, 'frame'));
  const t = linesTotals(lines(o));
  const deposit = Math.round(num(o, 'deposit') * 100);
  return (
    <>
      <Panel title="Job sheet" meta="What the lab receives (simulated — nothing is transmitted)">
        <KeyValues items={[
          { label: 'Lens / product', value: label(LENS_OPTIONS, str(o, 'lens')) },
          { label: 'Lab', value: label(LABS, str(o, 'lab')) },
          { label: 'Frame', value: frame ? <Link to={`${base}/stock/${frame.id}`}>{str(frame, 'name')} · {str(frame, 'colour')}</Link> : 'Not applicable' },
          { label: 'PD / heights', value: `${str(o, 'pd') || '—'} mm · ${str(o, 'heights') || '—'}` },
          { label: 'Promised', value: formatDate(str(o, 'promised')) },
          { label: 'Funding', value: str(o, 'funding') === 'private' ? 'Private payment' : 'Medical aid claim' },
        ]} />
        {rx && <div style={{ marginTop: 14 }}><RxCard values={rx.values} caption={`From ${rx.ref}`} /></div>}
      </Panel>
      <Panel title="Pricing" meta="VAT 15% (demo default)">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Excl. VAT</th></tr></thead>
            <tbody>{lines(o).map((l, i) => <tr key={l.id}><td>{l.description}</td><td className="num">{l.qty}</td><td className="num">{formatRand(t.lines[i].excl)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="totals" style={{ marginTop: 12 }}>
          <div className="row"><span>Excl. VAT</span><b>{formatRand(t.net)}</b></div>
          <div className="row"><span>VAT</span><b>{formatRand(t.vat)}</b></div>
          <div className="row"><span>Deposit received</span><b>−{formatRand(deposit)}</b></div>
          <div className="grand"><span>Balance</span><b>{formatRand(t.total - deposit)}</b></div>
        </div>
      </Panel>
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const [preview, setPreview] = useState(false);
  const o = findRecord(data, 'orders', id)!;
  const p = findRecord(data, 'patients', str(o, 'patient'));
  const first = p ? str(p, 'firstName') : '';
  const msg = `Hi ${first}, your eyewear (order ${o.ref}) is ready for collection at Northgate Optometry. Reply or call us to arrange a time. — This is a demo message.`;
  const ready = o.status === 'ready';
  return (
    <>
      <Panel title="Patient"><PatientCard data={data} patientId={o.values.patient} /></Panel>
      {ready && (
        <Panel title="Collection">
          {!str(o, 'readySince') && can('dispense') && (
            <button className="btn sm" style={{ marginBottom: 10 }} onClick={() => act.update('orders', o.id, { readySince: todayIso() }, 'Ready date recorded')}>Record ready date</button>
          )}
          <button className="btn sm" onClick={() => setPreview(true)}><IcoSend /> Preview “ready” message</button>
        </Panel>
      )}
      <Modal open={preview} title="Message preview" sub={`To ${patientName(data, o.values.patient)} via ${str(p, 'preferredContact') || 'SMS'}`} onClose={() => setPreview(false)}
        footer={<><button className="btn" onClick={() => setPreview(false)}>Close</button><button className="btn primary" onClick={() => { act.update('orders', o.id, {}, 'Collection reminder logged (not sent)'); act.toast('Logged in history — no message was sent'); setPreview(false); }}>Log as sent (demo)</button></>}>
        <div className="sms-preview">{msg}</div>
        <Notice tone="grey">The demo never sends SMS or email. A production system would need a messaging provider and the patient’s recorded consent.</Notice>
      </Modal>
    </>
  );
}
