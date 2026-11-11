import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { Field, KeyValues, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { CONTRACTORS, OWNER_APPROVAL_LIMIT, label } from '../data';
import { randOf } from '../helpers';
import { Checklist, PersonCard, RecLink } from './shared';

export default function MaintenanceDetail() {
  const { id } = useParams();
  const data = useData();
  const m = findRecord(data, 'maintenance', id);
  return (
    <RecordDetail aside={m ? <Aside id={m.id} /> : undefined}>
      {m && <Main id={m.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const m = findRecord(data, 'maintenance', id)!;
  const lease = findRecord(data, 'leases', str(m, 'lease'));
  const [contractor, setContractor] = useState(str(m, 'contractor'));
  const [quote, setQuote] = useState(num(m, 'quote') ? String(num(m, 'quote')) : '');
  const [err, setErr] = useState('');
  const edit = can('maintenance');
  const quoted = num(m, 'quote') > 0 && !!str(m, 'contractor');
  const needsOwner = num(m, 'quote') > OWNER_APPROVAL_LIMIT;
  const ownerOk = m.values.ownerApproved === true;
  const early = ['logged', 'quoted'].includes(m.status ?? '');

  const saveQuote = () => {
    const amount = Number(quote);
    if (!contractor) return setErr('Choose the contractor who quoted.');
    if (!(amount > 0)) return setErr('Enter the quoted amount.');
    // A changed quote needs the owner's approval again.
    const changed = amount !== num(m, 'quote');
    act.update('maintenance', id, { contractor, quote: Math.round(amount * 100) / 100, ...(changed ? { ownerApproved: false } : {}) }, `Quote recorded: ${randOf(amount)} from ${label(CONTRACTORS, contractor)}`);
    setErr('');
    if (m.status === 'logged') {
      const res = act.transition('maintenance', id, 'quoted');
      if (!res.ok) { act.toast(res.reason, 'err'); return; }
    }
    act.toast(amount > OWNER_APPROVAL_LIMIT ? `${m.ref}: quote saved — above ${randOf(OWNER_APPROVAL_LIMIT)}, so the owner must approve it` : `${m.ref}: quote saved — it can be approved`);
  };

  return (
    <>
      {early && (
        <Panel title="Quote & approval" meta={`Quotes above ${randOf(OWNER_APPROVAL_LIMIT)} need the owner’s written approval (demo limit)`}>
          {edit ? (
            <form className="form-grid" onSubmit={(e) => { e.preventDefault(); saveQuote(); }} noValidate>
              <Field label="Contractor (fictional)">
                <select className="select" aria-label="Contractor" value={contractor} onChange={(e) => setContractor(e.target.value)}>
                  <option value="">Select contractor…</option>
                  {CONTRACTORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Quote (R, incl. VAT)" error={err || undefined}>
                <input className="input num" type="number" min={0} step={0.01} aria-label="Quote amount" value={quote} onChange={(e) => setQuote(e.target.value)} />
              </Field>
              <div className="btns span-2"><button className="btn primary sm" type="submit" data-testid="save-quote">{m.status === 'logged' ? 'Save quote received' : 'Update quote'}</button></div>
            </form>
          ) : <p className="muted-note">Your simulated role cannot record quotes.</p>}
          {quoted && (
            <div style={{ marginTop: 14 }}>
              <Checklist items={[
                { label: 'Quote on file', ok: true, detail: `${randOf(num(m, 'quote'))} · ${label(CONTRACTORS, str(m, 'contractor'))}` },
                { label: 'Owner’s written approval (simulated)', ok: !needsOwner || ownerOk,
                  detail: !needsOwner ? `Not needed — the quote is within the ${randOf(OWNER_APPROVAL_LIMIT)} limit` : ownerOk ? `Approved by ${str(lease, 'landlord') || 'the owner'}` : `${randOf(num(m, 'quote'))} is above the limit — ${str(lease, 'landlord') || 'the owner'} must agree before the quote is approved. No message is sent from this demo.`,
                  action: needsOwner && !ownerOk && edit
                    ? <button className="btn sm" data-testid="owner-approve" onClick={() => { act.update('maintenance', id, { ownerApproved: true }, 'Owner’s written approval recorded (simulated)'); act.toast(`${m.ref}: owner’s approval recorded — the quote can now be approved`); }}>Record owner’s approval</button>
                    : undefined },
              ]} />
              {m.status === 'quoted' && <p className="muted-note" style={{ marginTop: 10 }}>{!needsOwner || ownerOk ? 'Ready — press “Approve quote” in the Workflow panel above.' : '“Approve quote” stays blocked until the owner’s approval is recorded.'}</p>}
            </div>
          )}
        </Panel>
      )}
      {!early && (
        <Panel title="Quote" right={needsOwner ? <Tag tone={ownerOk ? 'green' : 'amber'}>{ownerOk ? 'Owner approved' : 'Owner approval missing'}</Tag> : <Tag tone="dark">Within agent’s limit</Tag>}>
          <KeyValues items={[
            { label: 'Contractor', value: str(m, 'contractor') ? label(CONTRACTORS, str(m, 'contractor')) : '—' },
            { label: 'Quote (incl. VAT)', value: num(m, 'quote') ? randOf(num(m, 'quote')) : '—' },
          ]} />
        </Panel>
      )}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const m = findRecord(data, 'maintenance', id)!;
  const lease = findRecord(data, 'leases', str(m, 'lease'));
  if (!lease) return null;
  return (
    <>
      <Panel title="Rental property">
        <KeyValues items={[
          { label: 'Address', value: <RecLink module="leases" id={lease.id}>{str(lease, 'address')}</RecLink>, wide: true },
          { label: 'Lease', value: lease.ref },
          { label: 'Owner', value: str(lease, 'landlord') },
        ]} />
      </Panel>
      <Panel title="Tenant (fictional)"><PersonCard name={str(lease, 'tenant')} lines={[str(lease, 'tenantPhone'), str(lease, 'tenantEmail')]} /></Panel>
    </>
  );
}
