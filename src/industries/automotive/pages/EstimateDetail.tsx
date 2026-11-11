import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, lines, linesTotals, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { Modal, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { IcoSend } from '../../../core/components/Icons';
import { CONTACT_METHODS, LABOUR_RATE, label } from '../data';
import { vehicleCustomer } from '../helpers';
import { LinesTable, VehicleCard } from './shared';

export default function EstimateDetail() {
  const { id } = useParams();
  const data = useData();
  const e = findRecord(data, 'estimates', id);
  return (
    <RecordDetail aside={e ? <Aside id={e.id} /> : undefined}>
      {e && <Body id={e.id} />}
    </RecordDetail>
  );
}

function Body({ id }: { id: string }) {
  const data = useData();
  const e = findRecord(data, 'estimates', id)!;
  return (
    <Panel title="Parts & labour" meta={`Labour at ${formatRand(LABOUR_RATE * 100)}/h excl. VAT · lines with code LAB are labour hours`}>
      {e.status === 'sent' && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone="amber">Awaiting the customer. To approve, record <b>how</b> they approved (phone, WhatsApp, in person or email) and who approved — the note is kept on the estimate and the job card.</Notice>
        </div>
      )}
      {e.status === 'approved' && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone="accent">Approved {formatDate(str(e, 'approvedOn'))}: “{str(e, 'approvalNote') || 'no note'}”. Stocked parts were allocated to the job card.</Notice>
        </div>
      )}
      <LinesTable lines={lines(e)} />
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { hasModule, can } = useUser();
  const [preview, setPreview] = useState(false);
  const e = findRecord(data, 'estimates', id)!;
  const job = findRecord(data, 'jobs', str(e, 'job'));
  const c = vehicleCustomer(data, e.values.vehicle);
  const v = findRecord(data, 'vehicles', str(e, 'vehicle'));
  const first = str(c, 'contactPerson').split(' ')[0] || str(c, 'name').split(' ')[0];
  const msg = `Hi ${first}, this is ${config.businessName} about ${str(v, 'reg')} (${str(v, 'make')} ${str(v, 'model')}). Estimate ${e.ref}: ${lines(e).map((l) => l.description).slice(0, 3).join('; ')}${lines(e).length > 3 ? '…' : ''}. Total ${formatRand(linesTotals(lines(e)).total)} incl. VAT. Please reply YES to approve or call us with any questions.`;
  return (
    <>
      <Panel title="Vehicle & customer"><VehicleCard data={data} vehicleId={e.values.vehicle} /></Panel>
      <Panel title="Job card">
        {job ? <p className="muted-note">{hasModule('jobs') ? <Link to={`${base}/jobs/${job.id}`}><b>{job.ref}</b></Link> : <b>{job.ref}</b>} · {str(job, 'complaint')}</p> : <p className="muted-note">Not linked to a job card.</p>}
        {['draft', 'sent'].includes(e.status ?? '') && can('estimates') && (
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setPreview(true)}><IcoSend /> Preview message to customer</button>
        )}
      </Panel>
      <Modal open={preview} title="Estimate message preview" sub={`To ${str(c, 'name')} via ${label(CONTACT_METHODS, str(c, 'preferredContact'))}`} onClose={() => setPreview(false)}
        footer={<><button className="btn" onClick={() => setPreview(false)}>Close</button><button className="btn primary" onClick={() => { act.update('estimates', e.id, {}, 'Estimate message logged (not sent)'); act.toast('Logged in history — no message was sent'); setPreview(false); }}>Log as sent (demo)</button></>}>
        <div className="sms-preview">{msg}</div>
        <Notice tone="grey">The demo never sends WhatsApp, SMS or email. A reply is recorded by hand with “Record customer approval”.</Notice>
      </Modal>
    </>
  );
}
