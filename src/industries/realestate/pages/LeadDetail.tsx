import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, KeyValues, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { BUDGET_BAND, INTEREST, LEAD_PROPERTY_TYPES, LEAD_SOURCES, PROPERTY_TYPES, label, suburbLabel } from '../data';
import { LEAD_OPEN, ON_MARKET, agentOf, bookingProblem, byDateTime, ffcState, listingName, matchListing, matchingListings, randOf, todayStr } from '../helpers';
import { IcoPlus } from '../../../core/components/Icons';
import { OfferCapture, PersonCard, RecLink } from './shared';

export default function LeadDetail() {
  const { id } = useParams();
  const data = useData();
  const lead = findRecord(data, 'leads', id);
  return (
    <RecordDetail aside={lead ? <Aside id={lead.id} /> : undefined}>
      {lead && <Main id={lead.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const base = useBase();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const lead = findRecord(data, 'leads', id)!;
  const [booking, setBooking] = useState<Values | null>(null);
  const [offering, setOffering] = useState<string | null>(null);
  const viewDef = config.collections.find((c) => c.key === 'viewings')!;
  const offerDef = config.collections.find((c) => c.key === 'offers')!;
  const matches = matchingListings(data, lead);
  const near = records(data, 'listings').filter((l) => l.status === 'listed')
    .map((l) => ({ listing: l, match: matchListing(lead, l) }))
    .filter((x) => !x.match.ok && x.match.misses.length === 1)
    .slice(0, 4);
  const viewings = records(data, 'viewings').filter((v) => str(v, 'lead') === id).sort(byDateTime).reverse();
  const offers = records(data, 'offers').filter((o) => str(o, 'lead') === id);
  const open = LEAD_OPEN.includes(lead.status ?? '');
  // Default the offer to the property the buyer viewed most recently (still on the market), else the best match.
  const viewedLive = viewings.map((v) => findRecord(data, 'listings', str(v, 'listing'))).find((l) => l && ON_MARKET.includes(l.status ?? ''));
  const offerListing = viewedLive?.id ?? matches[0]?.listing.id ?? '';

  const book = (listingId: string) => {
    const l = findRecord(data, 'listings', listingId);
    const agent = agentOf(data, l?.values.agent);
    setBooking({ listing: listingId, lead: id, kind: 'private', date: today, time: '10:00', agent: agent && ffcState(agent, today) !== 'expired' ? agent.id : '' });
  };
  const save = (v: Values) => {
    const p = bookingProblem(data, v, today);
    if (p) { act.toast(p, 'err'); return; }
    const r = act.create('viewings', v, 'booked', 'Viewing booked from buyer matching');
    if (['new', 'contacted'].includes(lead.status ?? '')) act.transition('leads', id, 'viewing');
    act.toast(`Viewing ${r.ref} booked for ${formatDate(String(v.date))} at ${String(v.time)}`);
    setBooking(null);
  };

  return (
    <>
      <Panel title="Matching listings" meta={`Listed properties within ${randOf(num(lead, 'budget') * (1 - BUDGET_BAND))} – ${randOf(num(lead, 'budget') * (1 + BUDGET_BAND))}, in a preferred suburb, with ${num(lead, 'minBeds')}+ bedrooms`}>
        {matches.length ? (
          <ul className="list" data-testid="matching-listings">
            {matches.map(({ listing: l, match }) => (
              <li key={l.id}>
                <div className="grow">
                  <RecLink module="listings" id={l.id}><b>{str(l, 'address')}, {suburbLabel(str(l, 'suburb'))}</b></RecLink>
                  <small>{l.ref} · {num(l, 'beds')} bed {label(PROPERTY_TYPES, str(l, 'type')).toLowerCase()} · {randOf(num(l, 'askingPrice'))}</small>
                  <div className="flags" style={{ marginTop: 4 }}>{match.reasons.map((r) => <Tag key={r} tone="accent">{r}</Tag>)}</div>
                </div>
                {can('leads') && open && <button className="btn xs" onClick={() => book(l.id)} data-testid="book-from-match">Book viewing</button>}
              </li>
            ))}
          </ul>
        ) : <Empty title="No listings match yet" body="Nothing on the market fits this buyer’s budget, suburbs and bedrooms. New listings are matched automatically." />}
        {near.length > 0 && (
          <>
            <p className="muted-note" style={{ marginTop: 12 }}>Near misses (one criterion off):</p>
            <ul className="list">
              {near.map(({ listing: l, match }) => (
                <li key={l.id}>
                  <div className="grow">
                    <RecLink module="listings" id={l.id}><b>{str(l, 'address')}</b></RecLink>
                    <small>{randOf(num(l, 'askingPrice'))} · {match.misses[0]}</small>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Viewings" meta={`${viewings.length} for this buyer`}>
        {viewings.length ? (
          <ul className="list">
            {viewings.map((v) => (
              <li key={v.id}>
                <span className="time-chip">{formatDate(str(v, 'date')).slice(0, 6)} {str(v, 'time')}</span>
                <div className="grow">
                  <RecLink module="viewings" id={v.id}><b>{listingName(data, v.values.listing)}</b></RecLink>
                  <small>{str(v, 'feedback') || '—'}</small>
                </div>
                {str(v, 'interest') && <Tag tone={str(v, 'interest') === 'hot' ? 'green' : str(v, 'interest') === 'warm' ? 'amber' : 'dark'}>{label(INTEREST, str(v, 'interest')).split(' — ')[0]}</Tag>}
                <StatusTag workflow={viewDef.workflow} status={v.status} />
                {v.status === 'booked' && str(v, 'date') <= today && can('leads') && hasModule('viewings') && <Link className="btn xs" to={`${base}/viewings/${v.id}`} data-testid="record-feedback">Record feedback</Link>}
              </li>
            ))}
          </ul>
        ) : <Empty title="No viewings yet" body="Book one from a matching listing above." />}
      </Panel>

      <Panel title="Offers to purchase" meta={open ? 'Capture the buyer’s offer here once they are ready' : undefined}
        right={can('offers.manage') && open ? <button className="btn sm primary" onClick={() => setOffering(offerListing)} data-testid="capture-offer"><IcoPlus /> Capture offer</button> : undefined}>
        {offers.length ? (
          <ul className="list">
            {offers.map((o) => (
              <li key={o.id}>
                <div className="grow">
                  <RecLink module="offers" id={o.id}><b>{listingName(data, o.values.listing)}</b></RecLink>
                  <small>{o.ref} · {randOf(num(o, 'amount'))}</small>
                </div>
                <StatusTag workflow={offerDef.workflow} status={o.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No offers yet" />}
      </Panel>
      {booking && <RecordFormModal def={viewDef} open title={`Book viewing · ${str(lead, 'name')}`} initial={booking} onClose={() => setBooking(null)} onSave={save} />}
      {offering !== null && <OfferCapture title={`Capture offer · ${str(lead, 'name')}`} initial={{ lead: id, listing: offering }} onClose={() => setOffering(null)} />}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const lead = findRecord(data, 'leads', id)!;
  const matches = matchingListings(data, lead);
  const first = str(lead, 'name').split(' ')[0];
  return (
    <>
      <Panel title="Buyer (fictional)">
        <PersonCard name={str(lead, 'name')} lines={[str(lead, 'phone'), str(lead, 'email'), label(LEAD_SOURCES, str(lead, 'source'))]}
          tag={lead.values.preApproved === true ? <Tag tone="green">Bond pre-approved (simulated)</Tag> : <Tag tone="dark">No pre-approval</Tag>} />
      </Panel>
      <Panel title="Looking for">
        <KeyValues items={[
          { label: 'Budget', value: randOf(num(lead, 'budget')) },
          { label: 'Bedrooms', value: `${num(lead, 'minBeds')}+` },
          { label: 'Suburbs', value: str(lead, 'suburbs') || 'Any', wide: true },
          { label: 'Type', value: label(LEAD_PROPERTY_TYPES, str(lead, 'propertyType') || 'any') },
          { label: 'Agent', value: str(agentOf(data, lead.values.agent), 'name') || '—' },
        ]} />
      </Panel>
      {matches.length > 0 && (
        <Panel title="Message preview" meta="Preview only — no SMS, email or WhatsApp is sent">
          <div className="sms-preview">
            Hi {first}, it’s {config.businessName}. {matches.length === 1 ? 'A property' : `${matches.length} properties`} on the market match{matches.length === 1 ? 'es' : ''} what you’re looking for:{' '}
            {matches.slice(0, 2).map((m) => `${str(m.listing, 'address')} (${randOf(num(m.listing, 'askingPrice'))})`).join('; ')}. Reply to book a viewing.
          </div>
        </Panel>
      )}
    </>
  );
}
