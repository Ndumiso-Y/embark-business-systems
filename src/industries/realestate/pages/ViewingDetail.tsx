import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { IcoPlus } from '../../../core/components/Icons';
import { INTEREST, LEAD_SOURCES, label } from '../data';
import { ON_MARKET, listingOf, todayStr } from '../helpers';
import { AgentCard, ListingCard, OfferCapture, PersonCard, RecLink } from './shared';

export default function ViewingDetail() {
  const { id } = useParams();
  const data = useData();
  const v = findRecord(data, 'viewings', id);
  return (
    <RecordDetail aside={v ? <Aside id={v.id} /> : undefined} backLabel="Viewings & show days">
      {v && <Main id={v.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const v = findRecord(data, 'viewings', id)!;
  const listing = listingOf(data, v);
  const [interest, setInterest] = useState(str(v, 'interest'));
  const [feedback, setFeedback] = useState(str(v, 'feedback'));
  const [err, setErr] = useState('');
  const [offering, setOffering] = useState(false);
  const future = str(v, 'date') > today;
  const hasOffer = records(data, 'offers').some((o) => str(o, 'lead') === str(v, 'lead') && str(o, 'listing') === str(v, 'listing'));

  const complete = () => {
    if (!interest) return setErr('Choose how interested the buyer was.');
    if (!feedback.trim()) return setErr('Write a line of feedback for the seller.');
    act.update('viewings', id, { interest, feedback: feedback.trim() });
    const res = act.transition('viewings', id, 'completed');
    if (!res.ok) { setErr(res.reason); return; }
    setErr('');
    act.toast(`${v.ref} completed — feedback recorded`);
  };

  return (
    <>
      {v.status === 'booked' && (
        <Panel title="Feedback after the viewing" meta="A viewing can only be completed once the interest level and feedback are recorded">
          {!can('leads') ? <p className="muted-note">Your simulated role cannot record viewing feedback.</p> : future ? (
            <Notice tone="grey">This viewing is still to come. Feedback can be recorded on the day ({formatDate(str(v, 'date'))}).</Notice>
          ) : (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); complete(); }} noValidate>
              <Field label="Interest level">
                <select className="select" aria-label="Interest level" value={interest} onChange={(e) => setInterest(e.target.value)}>
                  <option value="">Select…</option>
                  {INTEREST.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Feedback" error={err || undefined} hint="Shown on the listing so the seller can see how viewings are going.">
                <textarea className="textarea" aria-label="Viewing feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="e.g. Loved the kitchen; worried about the road noise." />
              </Field>
              <div className="btns"><button className="btn primary" type="submit" data-testid="complete-viewing">Complete with feedback</button></div>
            </form>
          )}
        </Panel>
      )}
      {v.status === 'completed' && (
        <Panel title="Feedback" right={str(v, 'interest') ? <Tag tone={str(v, 'interest') === 'hot' ? 'green' : str(v, 'interest') === 'warm' ? 'amber' : 'dark'}>{label(INTEREST, str(v, 'interest'))}</Tag> : undefined}>
          <p style={{ margin: 0 }}>{str(v, 'feedback') || '—'}</p>
          {str(v, 'lead') && listing && ON_MARKET.includes(listing.status ?? '') && can('offers.manage') && !hasOffer && (
            <div className="btns" style={{ marginTop: 12 }}>
              <button className="btn sm primary" onClick={() => setOffering(true)} data-testid="capture-offer"><IcoPlus /> Capture this buyer’s offer</button>
            </div>
          )}
          {hasOffer && <p className="muted-note" style={{ marginTop: 10 }}>This buyer has made an offer on the property — see the buyer’s record.</p>}
        </Panel>
      )}
      {offering && listing && <OfferCapture title={`Capture offer · ${listing.ref}`} initial={{ listing: listing.id, lead: str(v, 'lead') }} onClose={() => setOffering(false)} />}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const v = findRecord(data, 'viewings', id)!;
  const lead = findRecord(data, 'leads', str(v, 'lead'));
  return (
    <>
      <Panel title="Property"><ListingCard data={data} id={v.values.listing} /></Panel>
      <Panel title="Buyer">
        {lead ? (
          <PersonCard name={str(lead, 'name')} lines={[str(lead, 'phone'), str(lead, 'email'), label(LEAD_SOURCES, str(lead, 'source'))]}
            tag={<RecLink module="leads" id={lead.id}>Open buyer {lead.ref}</RecLink>} />
        ) : <p className="muted-note">Show day — no single buyer linked.</p>}
      </Panel>
      <Panel title="Hosting agent"><AgentCard data={data} id={v.values.agent} today={today} /></Panel>
    </>
  );
}
