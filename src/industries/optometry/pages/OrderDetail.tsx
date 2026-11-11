import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, lines, linesTotals, num, records, str } from '../../../core/engine';
import { formatDate, todayIso } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { Field, KeyValues, Modal, Notice, Panel } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { IcoSend } from '../../../core/components/Icons';
import { LABS, LENS_OPTIONS, label } from '../data';
import { FRAME_CATEGORIES, orderProblems, patientName, todayStr } from '../helpers';
import { PatientCard, RxCard } from './shared';

export default function OrderDetail() {
  const { id } = useParams();
  const data = useData();
  const o = findRecord(data, 'orders', id);
  return (
    <RecordDetail aside={o ? <Aside id={o.id} /> : undefined}>
      {o && o.status === 'quote' && <BeforeLab id={o.id} />}
      {o && <Job id={o.id} />}
    </RecordDetail>
  );
}

/**
 * Everything that still blocks "Send to lab", each with the control that fixes it,
 * so nobody has to hunt through the full edit form.
 */
function BeforeLab({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const o = findRecord(data, 'orders', id)!;
  const problems = orderProblems(o, data);
  const [frame, setFrame] = useState('');
  const [pd, setPd] = useState('');
  const [deposit, setDeposit] = useState('');
  if (!problems.length) return null;
  const has = (k: string) => problems.some((p) => p.key === k);
  const frames = records(data, 'stock').filter((x) => FRAME_CATEGORIES.includes(str(x, 'category')) && num(x, 'qty') > 0).sort((a, b) => str(a, 'name').localeCompare(str(b, 'name')));
  const newerRx = records(data, 'prescriptions').filter((r) => str(r, 'patient') === str(o, 'patient') && r.status === 'issued' && str(r, 'expiry') >= todayStr() && r.id !== str(o, 'prescription'))
    .sort((a, b) => str(b, 'date').localeCompare(str(a, 'date')))[0];
  const chooseFrame = () => {
    const f = frames.find((x) => x.id === frame);
    if (!f) { act.toast('Choose a frame first.', 'err'); return; }
    // Price the frame on the job too, unless it is already listed.
    const priced = lines(o).some((l) => l.description === str(f, 'name'));
    const next = priced ? lines(o) : [{ id: `ln_${f.id}`, description: str(f, 'name'), qty: 1, unitPrice: Math.round(num(f, 'retail') / 1.15) }, ...lines(o)];
    act.update('orders', o.id, { frame: f.id, lines: next }, `Frame chosen: ${str(f, 'name')}`);
    act.toast(`${str(f, 'name')} added to ${o.ref}`);
    setFrame('');
  };
  const savePd = () => {
    const n = Number(pd);
    if (!(n >= 40 && n <= 80)) { act.toast('PD must be between 40 and 80 mm.', 'err'); return; }
    act.update('orders', o.id, { pd: n }, `PD recorded: ${n} mm`); act.toast(`PD saved on ${o.ref}`); setPd('');
  };
  const saveDeposit = () => {
    const n = Number(deposit);
    if (!(n > 0)) { act.toast('Enter the deposit amount received.', 'err'); return; }
    act.update('orders', o.id, { deposit: n }, `Deposit of ${formatRand(Math.round(n * 100))} received`); act.toast(`Deposit recorded on ${o.ref}`); setDeposit('');
  };
  return (
    <Panel title="Before this job can go to the lab" meta="Fix each point here, then press “Send to lab” above">
      <Notice tone="amber"><ul className="problem-list" data-testid="order-problems">{problems.map((p) => <li key={p.key}>{p.message}</li>)}</ul></Notice>
      {!can('dispense') ? <p className="muted-note" style={{ marginTop: 10 }}>Completing the order needs the Dispense permission (the optical dispenser in this demo).</p> : (
        <div className="form-grid" style={{ marginTop: 12 }}>
          {(has('frame') || has('stock')) && (
            <Field label="Frame (in stock)" hint="Only frames with stock on hand are listed. One is reserved when the job goes to the lab.">
              <div className="btns" style={{ flexWrap: 'nowrap' }}>
                <select className="select" aria-label="Choose frame" value={frame} onChange={(e) => setFrame(e.target.value)}>
                  <option value="">Select a frame…</option>
                  {frames.map((f) => <option key={f.id} value={f.id}>{str(f, 'name')} · {str(f, 'colour')} · {num(f, 'qty')} in stock</option>)}
                </select>
                <button className="btn sm primary" onClick={chooseFrame} data-testid="use-frame">Use frame</button>
              </div>
            </Field>
          )}
          {has('pd') && (
            <Field label="Pupillary distance (mm)">
              <div className="btns" style={{ flexWrap: 'nowrap' }}>
                <input className="input num" type="number" min={40} max={80} step={0.5} aria-label="Pupillary distance" value={pd} onChange={(e) => setPd(e.target.value)} />
                <button className="btn sm primary" onClick={savePd} data-testid="save-pd">Save PD</button>
              </div>
            </Field>
          )}
          {has('deposit') && (
            <Field label="Deposit received (R)" hint="Private orders need a deposit before the lab is asked to make them.">
              <div className="btns" style={{ flexWrap: 'nowrap' }}>
                <input className="input num" type="number" min={0} step={0.01} aria-label="Deposit received" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
                <button className="btn sm primary" onClick={saveDeposit} data-testid="save-deposit">Record deposit</button>
              </div>
            </Field>
          )}
          {(has('expired') || has('rx')) && (
            <div className="span-2">
              {newerRx
                ? <button className="btn sm primary" data-testid="use-current-rx" onClick={() => { act.update('orders', o.id, { prescription: newerRx.id, pd: num(o, 'pd') || newerRx.values.pd }, `Prescription changed to ${newerRx.ref}`); act.toast(`${o.ref} now uses ${newerRx.ref}`); }}>Use current prescription {newerRx.ref}</button>
                : <p className="muted-note">The patient needs a new eye exam first: finalising it issues a current prescription, and this quote can then be switched to it here.{' '}
                  {hasModule('patients') && <Link to={`${base}/patients/${str(o, 'patient')}`}>Open the patient to book the exam</Link>}</p>}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function Job({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
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
          { label: 'Frame', value: frame ? (hasModule('stock') ? <Link to={`${base}/stock/${frame.id}`}>{str(frame, 'name')} · {str(frame, 'colour')}</Link> : `${str(frame, 'name')} · ${str(frame, 'colour')}`) : str(o, 'kind') === 'cl' ? 'Not applicable (contact lenses)' : 'Not chosen yet' },
          { label: 'PD / heights', value: `${str(o, 'pd') ? `${str(o, 'pd')} mm` : 'PD not recorded'} · ${str(o, 'heights') || 'no fitting heights'}` },
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
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const [preview, setPreview] = useState(false);
  const o = findRecord(data, 'orders', id)!;
  const p = findRecord(data, 'patients', str(o, 'patient'));
  const first = p ? str(p, 'firstName') : '';
  const msg = `Hi ${first}, your eyewear (order ${o.ref}) is ready for collection at ${config.businessName}. Reply or call us to arrange a time. — This is a demo message.`;
  const ready = o.status === 'ready';
  const claim = records(data, 'claims').find((c) => str(c, 'order') === o.id);
  return (
    <>
      <Panel title="Patient"><PatientCard data={data} patientId={o.values.patient} /></Panel>
      {ready && (
        <Panel title="Collection">
          {!str(o, 'readySince') && can('dispense') && (
            <button className="btn sm" style={{ marginBottom: 10 }} onClick={() => act.update('orders', o.id, { readySince: todayIso() }, 'Ready date recorded')}>Record ready date</button>
          )}
          <button className="btn sm" onClick={() => setPreview(true)}><IcoSend /> Preview “ready” message</button>
          <p className="muted-note" style={{ marginTop: 10 }}>{str(o, 'readySince') ? `Ready since ${formatDate(str(o, 'readySince'))}. ` : ''}Uncollected jobs are flagged after 14 days. “Mark collected” closes the job{str(o, 'funding') === 'scheme' ? ' and adds the eyewear to the patient’s draft medical aid claim' : ''}.</p>
        </Panel>
      )}
      {claim && (
        <Panel title="Billing">
          <p className="muted-note">The eyewear is on {str(claim, 'scheme') === 'private' ? 'account' : 'medical aid claim'} {hasModule('claims') ? <Link to={`${base}/claims/${claim.id}`}>{claim.ref}</Link> : <b>{claim.ref}</b>}{hasModule('claims') ? '.' : ' — the practice manager submits it under Billing & claims.'}</p>
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
