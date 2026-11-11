import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { Empty, Flags, KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoCalendar, IcoPlus } from '../../../core/components/Icons';
import { INTEREST, MANDATE_TYPES, label } from '../data';
import {
  ON_MARKET, agentOf, bookingProblem, byDateTime, commissionOn, commissionRate, daysOnMarket, ffcState, leadName, mandateDaysLeft, matchingBuyers, offersFor,
  priceReduced, rand, randOf, reductionPct, todayStr, transferFor,
} from '../helpers';
import { AgentCard, Checklist, PersonCard, RecLink } from './shared';

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

  const checks = [
    { label: 'Mandate signed', ok: !!str(l, 'mandateSigned') && str(l, 'mandateSigned') <= today, detail: str(l, 'mandateSigned') ? `${label(MANDATE_TYPES, str(l, 'mandateType'))} signed ${formatDate(str(l, 'mandateSigned'))}` : 'No signature date recorded' },
    { label: 'Mandate current', ok: !!str(l, 'mandateExpiry') && str(l, 'mandateExpiry') > today, detail: str(l, 'mandateExpiry') ? `Expires ${formatDate(str(l, 'mandateExpiry'))}` : 'No expiry date recorded' },
    { label: 'Seller FICA verified (simulated)', ok: l.values.sellerFica === true, detail: l.values.sellerFica === true ? 'Documents marked as on file' : 'Outstanding — Edit → Seller FICA verified' },
    { label: 'Listing agent’s Fidelity Fund Certificate', ok: ['valid', 'expiring'].includes(ffcState(agent, today)), detail: agent ? `${str(agent, 'name')} · valid to ${formatDate(str(agent, 'ffcExpiry'))} (fictional)` : 'No agent assigned' },
    { label: 'Asking price set', ok: num(l, 'askingPrice') > 0, detail: num(l, 'askingPrice') > 0 ? randOf(num(l, 'askingPrice')) : 'Not set' },
  ];

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
      {l.status === 'mandate' && (
        <Panel title="Go-live checks" meta="All five must pass before “Go live” is allowed (demo rules — not PPRA compliance)">
          <Checklist items={checks} />
        </Panel>
      )}
      {onMarket && ffcState(agent, today) === 'expired' && <Notice tone="red"><b>The listing agent’s FFC has expired.</b> Reassign the listing (Edit → Listing agent) or renew the certificate on the Agents page before marketing continues.</Notice>}

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

      {offering && (
        <RecordFormModal def={offerDef} open title={`Capture offer · ${l.ref}`} initial={{ listing: id, validUntil: today, bondRequired: true, deposit: 0 }}
          onClose={() => setOffering(false)}
          onSave={(v) => { const o = act.create('offers', v, 'submitted', 'Offer captured'); act.toast(`Offer ${o.ref} captured — submit it to the seller`); setOffering(false); }} />
      )}
      {booking && <RecordFormModal def={viewDef} open title={`Book viewing · ${l.ref}`} initial={booking} onClose={() => setBooking(null)} onSave={saveViewing} />}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const l = findRecord(data, 'listings', id)!;
  const t = transferFor(data, id);
  const tDef = config.collections.find((c) => c.key === 'transfers')!;
  const left = mandateDaysLeft(l, today);
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
