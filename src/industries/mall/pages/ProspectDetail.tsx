import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, permissionHint, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { CATEGORIES, LEVELS, label } from '../data';
import { activeLease, leaseOf, monthsVacant, plural, randOf, randRound, shopLabel, thousands, todayStr, unitOf } from '../helpers';
import { MallStyles, ModButton, RecLink } from './shared';

export default function ProspectDetail() {
  const { id } = useParams();
  const data = useData();
  const p = findRecord(data, 'prospects', id);
  return (
    <RecordDetail aside={p ? <Aside id={p.id} /> : undefined}>
      {p && <UnitOfInterest key={p.id} id={p.id} />}
    </RecordDetail>
  );
}

/** The unit the prospect wants — what “Viewing held”, “Send proposal” and “Take lease application” check. */
function UnitOfInterest({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const p = findRecord(data, 'prospects', id)!;
  const unit = unitOf(data, str(p, 'unit'));
  const open = ['enquiry', 'viewing', 'proposal'].includes(p.status ?? '');
  const vacant = records(data, 'units').filter((u) => u.status === 'vacant').sort((a, b) => str(a, 'shop').localeCompare(str(b, 'shop'), undefined, { numeric: true }));
  const [pick, setPick] = useState(str(p, 'unit'));
  const held = unit ? activeLease(data, unit.id) : undefined;
  const lease = leaseOf(data, p.values.lease);
  const leaseDef = config.collections.find((c) => c.key === 'leases')!;
  return (
    <>
      <MallStyles />
      {lease && (
        <Notice tone="accent">
          <b>Application taken:</b> this prospect is now lease {lease.ref} (<StatusTag workflow={leaseDef.workflow} status={lease.status} />). The credit check, heads of terms, deposit and fit-out continue on the lease.
          <div style={{ marginTop: 8 }}><ModButton module="leases" id={lease.id} testid="open-lease">Open lease {lease.ref}</ModButton></div>
        </Notice>
      )}
      <Panel title="Unit of interest" meta="Only vacant units can be offered" right={unit ? <Tag tone={held ? 'red' : 'green'}>{held ? 'No longer available' : 'Available'}</Tag> : <Tag tone="amber">None chosen</Tag>}>
        {unit ? (
          <div className="mini-stat-row" style={{ marginBottom: 12 }}>
            <div>Unit<b><RecLink module="units" id={unit.id}>{shopLabel(unit)}</RecLink></b></div>
            <div>Level<b>{label(LEVELS, str(unit, 'level'))}</b></div>
            <div>GLA<b>{thousands(num(unit, 'gla'))} m²</b></div>
            <div>Asking rent<b>{randOf(num(unit, 'askingRent'))}/m²</b></div>
            <div>Monthly at asking<b>{randRound(num(unit, 'askingRent') * num(unit, 'gla'))}</b></div>
            <div>Vacant<b>{plural(monthsVacant(unit, today), 'month')}</b></div>
          </div>
        ) : <p className="muted-note" style={{ marginBottom: 12 }}>No unit chosen yet{num(p, 'glaWanted') ? ` — they want about ${num(p, 'glaWanted')} m²` : ''}. Pick one below before the viewing.</p>}
        {held && <div style={{ marginBottom: 12 }}><Notice tone="red">{shopLabel(unit)} is held by {str(held, 'tenant')} ({held.ref}). Choose another vacant unit below.</Notice></div>}
        {open && can('leases.manage') && (
          <div className="mall-inline">
            <div className="field">
              <label htmlFor="unit-pick">Vacant units</label>
              <select id="unit-pick" className="select" aria-label="Choose a vacant unit" value={pick} onChange={(e) => setPick(e.target.value)} data-testid="unit-pick">
                <option value="">Select a unit…</option>
                {vacant.map((u) => <option key={u.id} value={u.id}>{shopLabel(u)} · {num(u, 'gla')} m² · {label(CATEGORIES, str(u, 'category'))} · {randOf(num(u, 'askingRent'))}/m²</option>)}
              </select>
            </div>
            <button className="btn" disabled={!pick || pick === str(p, 'unit')} data-testid="save-unit" onClick={() => { act.update('prospects', id, { unit: pick }, `Unit of interest set to ${shopLabel(unitOf(data, pick))}`); act.toast(`${p.ref}: now looking at ${shopLabel(unitOf(data, pick))}`); }}>Set unit</button>
          </div>
        )}
        {open && !can('leases.manage') && <p className="muted-note">{permissionHint(config, data, 'leases.manage')}</p>}
        {p.status === 'proposal' && !held && unit && <p className="muted-note" style={{ marginTop: 12 }}>The proposal is out (a preview only — nothing is sent). “Take lease application” above opens a lease for {shopLabel(unit)} at the asking rent, ready for the credit check.</p>}
      </Panel>
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const p = findRecord(data, 'prospects', id)!;
  return (
    <Panel title="Prospect (fictional)">
      <KeyValues items={[
        { label: 'Contact', value: str(p, 'contact') },
        { label: 'Phone', value: str(p, 'phone') },
        { label: 'Email', value: str(p, 'email'), wide: true },
        { label: 'Space wanted', value: num(p, 'glaWanted') ? `${num(p, 'glaWanted')} m²` : '' },
        { label: 'First contact', value: formatDate(p.createdAt.slice(0, 10)) },
      ]} />
    </Panel>
  );
}
