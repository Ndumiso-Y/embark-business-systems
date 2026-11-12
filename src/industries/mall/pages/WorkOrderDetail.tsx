import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, permissionHint, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { PRIORITIES, RESPONSIBILITY, WO_SOURCES, label } from '../data';
import { activeLease, priorityDays, randOf, responseOverdue, shopLabel, todayStr, unitOf } from '../helpers';
import { MallStyles, RecLink, TenantCard } from './shared';

export default function WorkOrderDetail() {
  const { id } = useParams();
  const data = useData();
  const w = findRecord(data, 'workorders', id);
  return (
    <RecordDetail aside={w ? <Aside id={w.id} /> : undefined}>
      {w && <Main key={w.id} id={w.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const w = findRecord(data, 'workorders', id)!;
  const status = w.status ?? '';
  const resp = str(w, 'responsibility');
  const early = ['logged', 'assessed'].includes(status);
  const edit = can('maintenance');
  const [recharge, setRecharge] = useState(String(num(w, 'rechargeAmount') || ''));
  const [contractor, setContractor] = useState(str(w, 'contractor'));
  const decide = (who: 'landlord' | 'tenant') => {
    act.update('workorders', id, who === 'landlord' ? { responsibility: who, rechargeAmount: 0 } : { responsibility: who }, `Responsibility decided: ${who}`);
    act.toast(who === 'landlord' ? `${w.ref}: landlord’s responsibility — mark it assessed and assign a contractor` : `${w.ref}: tenant’s responsibility — close it with a note, or agree a recharge`, 'info');
  };
  return (
    <>
      <MallStyles />
      <Panel title="Assessment" meta="Who pays: the landlord (structure, common areas, base building services) or the tenant (inside the shop)" right={resp ? <Tag tone={resp === 'tenant' ? 'amber' : 'blue'}>{label(RESPONSIBILITY, resp)}’s responsibility</Tag> : <Tag tone="red">Not decided</Tag>}>
        {early && edit ? (
          <div className="btns" style={{ flexWrap: 'wrap' }}>
            <button className={`btn sm ${resp === 'landlord' ? 'primary' : ''}`} aria-pressed={resp === 'landlord'} onClick={() => decide('landlord')} data-testid="resp-landlord">Landlord</button>
            <button className={`btn sm ${resp === 'tenant' ? 'primary' : ''}`} aria-pressed={resp === 'tenant'} onClick={() => decide('tenant')} data-testid="resp-tenant">Tenant</button>
          </div>
        ) : early ? <p className="muted-note">{permissionHint(config, data, 'maintenance')}</p> : null}
        {resp === 'tenant' && (
          <div style={{ marginTop: 12 }}>
            {early && edit ? (
              <>
                <p className="muted-note" style={{ marginBottom: 8 }}>Two ways forward: <b>close it</b> with a note telling the tenant to attend to it (“Close — tenant to attend” above), or have the landlord’s contractor do it and <b>recharge</b> the cost — it is added to the tenant’s next invoice when the job is completed.</p>
                <div className="mall-inline">
                  <Field label="Recharge to the tenant (excl. VAT)"><input className="input num" type="number" min={0} step="50" aria-label="Recharge amount" value={recharge} onChange={(e) => setRecharge(e.target.value)} data-testid="recharge-amount" /></Field>
                  <button className="btn" data-testid="save-recharge" onClick={() => { if (!(Number(recharge) > 0)) return act.toast('Type the amount to recharge, or close the job with a note instead.', 'err'); act.update('workorders', id, { rechargeAmount: Number(recharge) }, `Recharge of ${randOf(Number(recharge))} agreed with the tenant`); act.toast(`${w.ref}: recharge of ${randOf(Number(recharge))} agreed`); }}>Agree recharge</button>
                </div>
              </>
            ) : num(w, 'rechargeAmount') > 0 ? (
              <Notice tone={str(w, 'rechargeInvoice') ? 'grey' : 'amber'}>
                Recharge of {randOf(num(w, 'rechargeAmount'))} excl. VAT — {str(w, 'rechargeInvoice') ? `billed on ${str(w, 'rechargeInvoice')}.` : ['completed', 'confirmed'].includes(status) ? 'it goes onto this tenant’s invoice at the next month-end run.' : 'it is billed once the work is completed.'}
              </Notice>
            ) : null}
          </div>
        )}
        {!resp && <p className="muted-note" style={{ marginTop: 10 }}>“Mark assessed” and “Assign contractor” are refused until this is decided.</p>}
      </Panel>
      {(status !== 'logged' && status !== 'closed') && (resp === 'landlord' || num(w, 'rechargeAmount') > 0 || !early) && (
        <Panel title="Contractor" meta="No message is sent to the contractor from this demo" right={str(w, 'contractor') ? <Tag tone="blue">{str(w, 'contractor')}</Tag> : <Tag tone="amber">Not named</Tag>}>
          {status === 'assessed' && edit ? (
            <div className="mall-inline">
              <Field label="Contractor (fictional)"><input className="input" aria-label="Contractor" placeholder="e.g. PipeWright Plumbing" value={contractor} onChange={(e) => setContractor(e.target.value)} data-testid="contractor" /></Field>
              <button className="btn" data-testid="save-contractor" onClick={() => { if (!contractor.trim()) return act.toast('Type the contractor’s name.', 'err'); act.update('workorders', id, { contractor: contractor.trim() }, `Contractor named: ${contractor.trim()}`); act.toast(`${w.ref}: contractor named — press “Assign contractor”`); }}>Save contractor</button>
            </div>
          ) : <p className="muted-note">{str(w, 'contractor') ? `${str(w, 'contractor')}${str(w, 'completedOn') ? ` · completed ${formatDate(str(w, 'completedOn'))}` : ''}` : 'Named once the job is assessed.'}</p>}
        </Panel>
      )}
      {status === 'completed' && <Notice tone="accent">The work is done. “Log tenant confirmation” closes the job once the tenant (or, for a common area, centre management) has confirmed it is right; “Reopen” sends it back with a note.</Notice>}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const w = findRecord(data, 'workorders', id)!;
  const unit = unitOf(data, str(w, 'unit'));
  const late = responseOverdue(w, today);
  const target = addDays(str(w, 'reportedOn') || today, priorityDays(str(w, 'priority')));
  return (
    <>
      <Panel title="Response" right={late ? <Tag tone="red">Overdue {late} d</Tag> : undefined}>
        <KeyValues items={[
          { label: 'Priority', value: label(PRIORITIES, str(w, 'priority')) },
          { label: 'Source', value: label(WO_SOURCES, str(w, 'source')) },
          { label: 'Reported', value: formatDate(str(w, 'reportedOn')) },
          { label: 'Contractor to be assigned by', value: formatDate(target) },
        ]} />
        <p className="muted-note" style={{ marginTop: 10 }}>The response clock counts days, not hours, from the day the job was logged.</p>
      </Panel>
      <Panel title={unit ? 'Shop & tenant' : 'Location'}>
        {unit ? (
          <>
            <p style={{ margin: '0 0 10px', fontSize: 13 }}><RecLink module="units" id={unit.id}><b>{shopLabel(unit)}</b></RecLink></p>
            <TenantCard data={data} lease={activeLease(data, unit.id)} />
          </>
        ) : <p className="muted-note">{str(w, 'area') || 'Common area'} — a common-area job is always the landlord’s.</p>}
      </Panel>
    </>
  );
}
