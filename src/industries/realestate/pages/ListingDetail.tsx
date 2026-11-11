import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { Empty, Field, Flags, KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoCalendar, IcoPlus } from '../../../core/components/Icons';
import { INTEREST, MANDATE_TYPES, label } from '../data';
import {
  ON_MARKET, agentOf, bookingProblem, byDateTime, commissionOn, commissionRate, daysOnMarket, ffcState, leadName, mandateDaysLeft, matchingBuyers, offersFor,
  priceReduced, rand, randOf, reductionPct, todayStr, transferFor,
} from '../helpers';
import { AgentCard, Checklist, OfferCapture, PersonCard, RecLink } from './shared';

export default function ListingDetail() {
  const { id } = useParams();
  const data = useData();
  const l = findRecord(data, 'listings', id);
  return (
    <RecordDetail aside={l ? <Aside id={l.id} /> : undefined}>
      {l && <Main id={l.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const l = findRecord(data, 'listings', id)!;
  const [offering, setOffering] = useState(false);
  const [booking, setBooking] = useState<Values | null>(null);
  const offerDef = config.collections.find((c) => c.key === 'offers')!;
  const viewDef = config.collections.find((c) => c.key === 'viewings')!;
  const offers = offersFor(data, id).sort((a, b) => b.ref.localeCompare(a.ref));
  const viewings = records(data, 'viewings').filter((v) => str(v, 'listing') === id).sort(byDateTime).reverse();
  const buyers = matchingBuyers(data, l);
  const onMarket = ON_MARKET.includes(l.status ?? '');
  const dom = daysOnMarket(l, today);
  const agent = agentOf(data, l.values.agent);
  const left = mandateDaysLeft(l, today);
  const done = viewings.filter((v) => v.status === 'completed');
  const hot = done.filter((v) => str(v, 'interest') === 'hot').length;
  const price = num(l, 'soldPrice') || num(l, 'askingPrice');

  const canEdit = can('listings.manage');
  const ffc = ffcState(agent, today);
  const mandateCurrent = !!str(l, 'mandateExpiry') && str(l, 'mandateExpiry') > today;
  const checks = [
    { label: 'Mandate signed', ok: !!str(l, 'mandateSigned') && str(l, 'mandateSigned') <= today, detail: str(l, 'mandateSigned') ? `${label(MANDATE_TYPES, str(l, 'mandateType'))} signed ${formatDate(str(l, 'mandateSigned'))}` : 'No signature date recorded — use Edit to add it' },
    { label: 'Mandate current', ok: mandateCurrent,
      detail: str(l, 'mandateExpiry') ? `${mandateCurrent ? 'Expires' : 'Expired'} ${formatDate(str(l, 'mandateExpiry'))}${mandateCurrent ? '' : ' — agree a new expiry date with the seller'}` : 'No expiry date recorded',
      action: !mandateCurrent && canEdit ? <RenewMandate id={id} /> : undefined },
    { label: 'Seller FICA verified (simulated)', ok: l.values.sellerFica === true, detail: l.values.sellerFica === true ? 'Documents marked as on file' : 'Outstanding — tick it off once the seller’s ID and proof of address are on file',
      action: l.values.sellerFica !== true && canEdit
        ? <button className="btn sm" data-testid="mark-fica" onClick={() => { act.update('listings', id, { sellerFica: true }, 'Seller FICA verified (simulated)'); act.toast(`${l.ref}: seller FICA marked as verified (simulated)`); }}>Mark FICA verified</button>
        : undefined },
    { label: 'Listing agent’s Fidelity Fund Certificate', ok: ['valid', 'expiring'].includes(ffc),
      detail: agent ? `${str(agent, 'name')} · ${ffc === 'expired' ? 'expired' : 'valid to'} ${formatDate(str(agent, 'ffcExpiry'))} (fictional)${ffc === 'expired' ? ' — reassign the listing, or renew the certificate on the agent’s record' : ''}` : 'No agent assigned',
      action: ['expired', 'missing'].includes(ffc) && canEdit ? <ReassignAgent id={id} /> : undefined },
    { label: 'Asking price set', ok: num(l, 'askingPrice') > 0, detail: num(l, 'askingPrice') > 0 ? randOf(num(l, 'askingPrice')) : 'Not set — use Edit to add it' },
  ];
  const blockers = checks.filter((c) => !c.ok).length;

  const saveViewing = (v: Values) => {
    const p = bookingProblem(data, v, today);
    if (p) { act.toast(p, 'err'); return; }
    const r = act.create('viewings', v, 'booked', 'Viewing booked');
    const lead = findRecord(data, 'leads', String(v.lead ?? ''));
    if (lead && ['new', 'contacted'].includes(lead.status ?? '')) act.transition('leads', lead.id, 'viewing');
    act.toast(`Viewing ${r.ref} booked for ${formatDate(String(v.date))} at ${String(v.time)}`);
    setBooking(null);
  };

  return (
    <>
      {l.status === 'valuation' && (
        <Panel title="Record the mandate" meta="The seller signs a mandate before the property can be marketed">
          {canEdit ? <MandateForm id={id} /> : <p className="muted-note">Your simulated role cannot record mandates (needs “Manage listings”).</p>}
        </Panel>
      )}
      {l.status === 'mandate' && (
        <Panel title="Go-live checks" meta="All five must pass before “Go live” is allowed (demo rules — not PPRA compliance)"
          right={<Tag tone={blockers ? 'red' : 'green'}>{blockers ? `${blockers} to fix` : 'Ready to go live'}</Tag>}>
          <Checklist items={checks} />
          {!blockers && <p className="muted-note" style={{ marginTop: 10 }} data-testid="golive-ready">{can('mandates.approve') ? 'Every check passes — press “Go live” in the Workflow panel above.' : 'Every check passes. “Go live” is approved by the principal or the office admin (Approve go-live permission) — switch user in the top bar to try it.'}</p>}
        </Panel>
      )}
      {l.status === 'expired' && (
        <Panel title="Mandate lapsed" meta="Agree a new expiry date with the seller to bring the listing back">
          {canEdit ? <RenewMandate id={id} /> : <p className="muted-note">Your simulated role cannot renew mandates.</p>}
        </Panel>
      )}
      {onMarket && ffcState(agent, today) === 'expired' && <Notice tone="red"><b>The listing agent’s FFC has expired.</b> Reassign the listing or renew the certificate on the agent’s record before marketing continues.{canEdit && <div style={{ marginTop: 8 }}><ReassignAgent id={id} /></div>}</Notice>}

      <Panel title="Market position" meta={str(l, 'listedOn') ? `Listed ${formatDate(str(l, 'listedOn'))}` : 'Not yet listed'}>
        <div className="mini-stat-row">
          <div>Asking price<b>{randOf(num(l, 'askingPrice'))}</b></div>
          {priceReduced(l) && <div>Original price<b>{randOf(num(l, 'originalPrice'))} (−{reductionPct(l)}%)</b></div>}
          {num(l, 'soldPrice') > 0 && <div>Selling price<b>{randOf(num(l, 'soldPrice'))}</b></div>}
          <div>Days on market<b>{dom ?? '—'}</b></div>
          <div>Viewings<b>{done.length} done · {hot} hot</b></div>
          <div>Offers<b>{offers.length}</b></div>
          <div>Mandate<b>{left === null ? '—' : left < 0 ? `expired ${-left} d ago` : `${left} days left`}</b></div>
          {can('commission.view') && <div>Commission ({commissionRate(l)}% excl. VAT)<b>{rand(commissionOn(l, price))}</b></div>}
        </div>
      </Panel>

      <Panel title="Offers to purchase" meta={`${offers.length} on this property`}
        right={can('offers.manage') && onMarket ? <button className="btn sm primary" onClick={() => setOffering(true)} data-testid="capture-offer"><IcoPlus /> Capture offer</button> : undefined}>
        {offers.length ? (
          <ul className="list">
            {offers.map((o) => (
              <li key={o.id}>
                <div className="grow">
                  <RecLink module="offers" id={o.id}><b>{randOf(num(o, 'amount'))} · {leadName(data, o.values.lead)}</b></RecLink>
                  <small>{o.ref} · {o.values.bondRequired === true ? `bond ${randOf(num(o, 'bondAmount'))} by ${formatDate(str(o, 'bondDeadline'))}` : 'cash'}{num(o, 'deposit') ? ` · deposit ${randOf(num(o, 'deposit'))}` : ''}</small>
                </div>
                <Flags flags={offerDef.flags?.(o, data, today) ?? []} />
                <StatusTag workflow={offerDef.workflow} status={o.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No offers yet" body={onMarket ? 'Capture the first offer to purchase.' : 'Offers can be captured once the property is listed.'} />}
      </Panel>

      <Panel title="Viewings & feedback" meta={`${viewings.length} booked or held`}
        right={can('leads') && onMarket ? <button className="btn sm" onClick={() => setBooking({ listing: id, kind: 'private', date: today, time: '10:00', agent: ffcState(agent, today) === 'expired' ? '' : str(l, 'agent') })}><IcoCalendar /> Book viewing</button> : undefined}>
        {viewings.length ? (
          <ul className="list">
            {viewings.slice(0, 8).map((v) => (
              <li key={v.id}>
                <span className="time-chip">{formatDate(str(v, 'date')).slice(0, 6)} {str(v, 'time')}</span>
                <div className="grow">
                  <RecLink module="viewings" id={v.id}><b>{str(v, 'lead') ? leadName(data, v.values.lead) : 'Show day'}</b></RecLink>
                  <small>{str(v, 'feedback') || (v.status === 'booked' ? 'Feedback after the viewing' : '—')}</small>
                </div>
                {str(v, 'interest') && <Tag tone={str(v, 'interest') === 'hot' ? 'green' : str(v, 'interest') === 'warm' ? 'amber' : 'dark'}>{label(INTEREST, str(v, 'interest')).split(' — ')[0]}</Tag>}
                <StatusTag workflow={viewDef.workflow} status={v.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No viewings yet" />}
      </Panel>

      {onMarket && (
        <Panel title="Matching buyers" meta="Active buyers whose budget (±10%), suburbs and bedrooms fit this property">
          {buyers.length ? (
            <ul className="list" data-testid="matching-buyers">
              {buyers.slice(0, 8).map(({ lead, match }) => (
                <li key={lead.id}>
                  <div className="grow">
                    <RecLink module="leads" id={lead.id}><b>{str(lead, 'name')}</b></RecLink>
                    <small>Budget {randOf(num(lead, 'budget'))} · {match.reasons.join(' · ')}</small>
                  </div>
                  {lead.values.preApproved === true && <Tag tone="green">Pre-approved</Tag>}
                  {can('leads') && <button className="btn xs" onClick={() => setBooking({ listing: id, lead: lead.id, kind: 'private', date: today, time: '10:00', agent: ffcState(agent, today) === 'expired' ? '' : str(l, 'agent') })}>Book viewing</button>}
                </li>
              ))}
            </ul>
          ) : <Empty title="No matching buyers" body="No active buyer has a budget within ±10% of the asking price in this suburb." />}
        </Panel>
      )}

      {offering && <OfferCapture title={`Capture offer · ${l.ref}`} initial={{ listing: id }} onClose={() => setOffering(false)} />}
      {booking && <RecordFormModal def={viewDef} open title={`Book viewing · ${l.ref}`} initial={booking} onClose={() => setBooking(null)} onSave={saveViewing} />}
    </>
  );
}

/** Valuation → mandate in one step: the three mandate fields and the workflow move together. */
function MandateForm({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const today = todayStr();
  const l = findRecord(data, 'listings', id)!;
  const [type, setType] = useState(str(l, 'mandateType') || 'sole');
  const [signed, setSigned] = useState(str(l, 'mandateSigned') || today);
  const [expiry, setExpiry] = useState(str(l, 'mandateExpiry') || addDays(today, 90));
  const [err, setErr] = useState('');
  const submit = () => {
    if (!signed || !expiry) return setErr('Enter the date the mandate was signed and the date it expires.');
    if (signed > today) return setErr('The mandate cannot be signed in the future.');
    if (expiry <= signed) return setErr('The mandate must expire after the date it was signed.');
    act.update('listings', id, { mandateType: type, mandateSigned: signed, mandateExpiry: expiry });
    const res = act.transition('listings', id, 'mandate');
    if (!res.ok) { setErr(res.reason); return; }
    setErr('');
    act.toast(`${l.ref}: mandate recorded — now complete the go-live checks`);
  };
  return (
    <form className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      <Field label="Mandate type">
        <select className="select" aria-label="Mandate type" value={type} onChange={(e) => setType(e.target.value)}>
          {MANDATE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Signed on"><input className="input" type="date" aria-label="Mandate signed on" value={signed} onChange={(e) => setSigned(e.target.value)} /></Field>
      <Field label="Expires on" hint="Sole mandates usually run for about three months." error={err || undefined}><input className="input" type="date" aria-label="Mandate expires on" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
      <div className="btns" style={{ alignSelf: 'end' }}><button className="btn primary" type="submit" data-testid="record-mandate">Record mandate signed</button></div>
    </form>
  );
}

/** New mandate expiry date. On a lapsed listing this also moves it back to “Mandate signed”. */
function RenewMandate({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const today = todayStr();
  const l = findRecord(data, 'listings', id)!;
  const [expiry, setExpiry] = useState(addDays(today, 90));
  const renew = () => {
    if (!expiry || expiry <= today) { act.toast('The new expiry date must be in the future.', 'err'); return; }
    const patch = str(l, 'mandateSigned') ? { mandateExpiry: expiry } : { mandateExpiry: expiry, mandateSigned: today };
    act.update('listings', id, patch, `Mandate renewed to ${formatDate(expiry)}`);
    if (l.status === 'expired') {
      const res = act.transition('listings', id, 'mandate');
      if (!res.ok) { act.toast(res.reason, 'err'); return; }
    }
    act.toast(`${l.ref}: mandate now runs to ${formatDate(expiry)}`);
  };
  return (
    <span className="btns" style={{ flexWrap: 'wrap' }}>
      <input className="input sm" type="date" aria-label="New mandate expiry date" style={{ width: 150 }} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      <button type="button" className="btn sm" onClick={renew} data-testid="renew-mandate">Renew mandate</button>
    </span>
  );
}

/** Hand the listing to an agent whose (fictional) FFC is valid. */
function ReassignAgent({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { hasModule } = useUser();
  const today = todayStr();
  const l = findRecord(data, 'listings', id)!;
  const valid = records(data, 'agents').filter((a) => ['valid', 'expiring'].includes(ffcState(a, today)));
  const [to, setTo] = useState('');
  const reassign = () => {
    const a = valid.find((x) => x.id === to);
    if (!a) { act.toast('Choose the agent who takes over the listing.', 'err'); return; }
    act.update('listings', id, { agent: a.id }, `Listing reassigned to ${str(a, 'name')}`);
    act.toast(`${l.ref} reassigned to ${str(a, 'name')}`);
  };
  return (
    <span className="btns" style={{ flexWrap: 'wrap' }}>
      <select className="select sm" aria-label="Reassign listing to" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)}>
        <option value="">Reassign to…</option>
        {valid.map((a) => <option key={a.id} value={a.id}>{str(a, 'name')}</option>)}
      </select>
      <button type="button" className="btn sm" onClick={reassign} data-testid="reassign-agent">Reassign</button>
      {hasModule('agents') && str(l, 'agent') && <Link className="btn sm ghost" to={`${base}/agents/${str(l, 'agent')}`}>Agent record</Link>}
    </span>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const { can } = useUser();
  const today = todayStr();
  const l = findRecord(data, 'listings', id)!;
  const t = transferFor(data, id);
  const tDef = config.collections.find((c) => c.key === 'transfers')!;
  const left = mandateDaysLeft(l, today);
  const renewable = can('listings.manage') && ['listed', 'underoffer'].includes(l.status ?? '') && left !== null && left <= 14;
  return (
    <>
      <Panel title="Listing agent"><AgentCard data={data} id={l.values.agent} today={today} /></Panel>
      <Panel title="Seller (fictional)">
        <PersonCard name={str(l, 'sellerName')} lines={[str(l, 'sellerPhone'), str(l, 'sellerEmail')]}
          tag={l.values.sellerFica === true ? <Tag tone="green">FICA on file (simulated)</Tag> : <Tag tone="red">FICA outstanding</Tag>} />
      </Panel>
      <Panel title="Mandate">
        <KeyValues items={[
          { label: 'Type', value: label(MANDATE_TYPES, str(l, 'mandateType')) },
          { label: 'Signed', value: formatDate(str(l, 'mandateSigned')) },
          { label: 'Expires', value: str(l, 'mandateExpiry') ? <>{formatDate(str(l, 'mandateExpiry'))} {left !== null && left <= 14 && <Tag tone={left < 0 ? 'red' : 'amber'}>{left < 0 ? 'expired' : `${left} d`}</Tag>}</> : '—' },
          { label: 'Agent valuation', value: num(l, 'valuation') ? randOf(num(l, 'valuation')) : '—' },
        ]} />
        {renewable && <div style={{ marginTop: 12 }}><p className="muted-note" style={{ marginBottom: 8 }}>The mandate is about to run out — agree a new date with the seller:</p><RenewMandate id={id} /></div>}
      </Panel>
      {t && (
        <Panel title="Transfer (simulated)" right={<StatusTag workflow={tDef.workflow} status={t.status} />}>
          <KeyValues items={[
            { label: 'Reference', value: <RecLink module="transfers" id={t.id}>{t.ref}</RecLink> },
            { label: 'Expected registration', value: formatDate(str(t, 'expectedRegistration')) },
            { label: 'Days to go', value: t.status === 'registered' ? 'Registered' : String(daysBetween(today, str(t, 'expectedRegistration'))) },
          ]} />
        </Panel>
      )}
    </>
  );
}
