import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { LEAD_SOURCES, label } from '../data';
import { acceptProblems, bondDaysLeft, conditionsProblems, listingOf, randOf, todayStr, transferFor } from '../helpers';
import { Checklist, ListingCard, PersonCard, RecLink } from './shared';

export default function OfferDetail() {
  const { id } = useParams();
  const data = useData();
  const o = findRecord(data, 'offers', id);
  return (
    <RecordDetail aside={o ? <Aside id={o.id} /> : undefined}>
      {o && <Main id={o.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const o = findRecord(data, 'offers', id)!;
  const edit = can('offers.manage');
  const [counter, setCounter] = useState('');
  const [deadline, setDeadline] = useState(addDays(today, 30));
  const [err, setErr] = useState('');
  const mark = (patch: Record<string, boolean>, text: string, testid: string, btn: string) => (
    <button className="btn sm" data-testid={testid} onClick={() => { act.update('offers', id, patch, `${text} (simulated)`); act.toast(`${o.ref}: ${text.toLowerCase()}`); }}>{btn}</button>
  );
  const sendCounter = () => {
    const amount = Number(counter);
    if (!(amount > 0)) return setErr('Enter the amount the seller will accept.');
    if (amount === num(o, 'amount')) return setErr('That is the same as the offer — use “Seller accepts” instead.');
    act.update('offers', id, { counterAmount: Math.round(amount * 100) / 100 });
    const res = act.transition('offers', id, 'countered');
    if (!res.ok) { setErr(res.reason); return; }
    setErr(''); setCounter('');
    act.toast(`${o.ref}: seller countered at ${randOf(amount)}`);
  };
  const listing = listingOf(data, o);
  const ask = num(listing, 'askingPrice');
  const diff = ask > 0 ? Math.round(((num(o, 'amount') - ask) / ask) * 1000) / 10 : 0;
  const bondLeft = bondDaysLeft(o, today);
  const pending = ['submitted', 'countered'].includes(o.status ?? '');
  const accept = pending ? acceptProblems(o, data) : [];
  const bond = o.values.bondRequired === true;
  const live = o.status === 'accepted';
  return (
    <>
      <Panel title="Deal summary" meta="Amounts in rand; the offer is a fictional record, not a legal document">
        <div className="mini-stat-row">
          <div>Offer<b>{randOf(num(o, 'amount'))}</b></div>
          <div>Asking<b>{randOf(ask)}</b></div>
          <div>Difference<b>{diff > 0 ? '+' : ''}{diff}%</b></div>
          {num(o, 'counterAmount') > 0 && <div>Seller counter<b>{randOf(num(o, 'counterAmount'))}</b></div>}
          <div>Deposit<b>{num(o, 'deposit') ? randOf(num(o, 'deposit')) : '—'}</b></div>
          <div>Finance<b>{bond ? `Bond ${randOf(num(o, 'bondAmount'))}` : 'Cash'}</b></div>
        </div>
      </Panel>
      {pending && accept.length > 0 && <Notice tone="amber"><b>Cannot be accepted yet:</b><ul className="problem-list">{accept.map((p) => <li key={p}>{p}</li>)}</ul></Notice>}
      {pending && edit && bond && !str(o, 'bondDeadline') && (
        <Panel title="Bond approval deadline" meta="An offer subject to a bond needs a date by which the bond must be approved">
          <div className="btns">
            <input className="input sm" type="date" aria-label="Bond approval deadline" style={{ width: 160 }} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            <button className="btn sm" onClick={() => { if (deadline) { act.update('offers', id, { bondDeadline: deadline }, `Bond deadline set to ${formatDate(deadline)}`); act.toast(`${o.ref}: bond deadline set`); } }}>Set deadline</button>
          </div>
        </Panel>
      )}
      {o.status === 'submitted' && (
        <Panel title="Seller’s response" meta="Accept or decline with the Workflow buttons above — or record a counter-offer here">
          {edit ? (
            <form className="btns" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); sendCounter(); }} noValidate>
              <Field label="Seller will accept (R)" error={err || undefined}>
                <input className="input num" type="number" min={0} step={1000} aria-label="Seller counter-offer amount" style={{ width: 200 }} value={counter} onChange={(e) => setCounter(e.target.value)} placeholder={String(ask || '')} />
              </Field>
              <button className="btn" type="submit" data-testid="record-counter">Record counter-offer</button>
            </form>
          ) : <p className="muted-note">Your simulated role cannot progress offers.</p>}
          <p className="muted-note" style={{ marginTop: 10 }}>“Seller accepts” puts the listing under offer straight away and moves the buyer to “Offer made”. Nothing is sent to the buyer or seller.</p>
        </Panel>
      )}
      {o.status === 'countered' && <Notice tone="accent"><b>Seller countered at {randOf(num(o, 'counterAmount'))}.</b> If the buyer agrees, “Buyer accepts counter-offer” fixes the price at that amount and puts the listing under offer.</Notice>}
      {['accepted', 'unconditional'].includes(o.status ?? '') && (
        <Panel title="Suspensive conditions" meta="All must be met before “Conditions met” — then the listing is sold and a transfer opens"
          right={bondLeft !== null ? <Tag tone={bondLeft < 0 ? 'red' : bondLeft <= 5 ? 'amber' : 'dark'}>{bondLeft < 0 ? `Bond deadline passed ${-bondLeft} d ago` : `Bond due in ${bondLeft} d`}</Tag> : undefined}>
          <Checklist items={[
            ...(bond ? [{ label: 'Bond approved (simulated)', ok: o.values.bondApproved === true, detail: `${randOf(num(o, 'bondAmount'))} · deadline ${formatDate(str(o, 'bondDeadline'))} · no bank is connected`,
              action: live && edit && o.values.bondApproved !== true ? mark({ bondApproved: true }, 'Bond approval recorded', 'mark-bond', 'Record bond approval') : undefined }] : []),
            ...(num(o, 'deposit') > 0 ? [{ label: 'Deposit paid into the conveyancer’s trust (simulated)', ok: o.values.depositPaid === true, detail: randOf(num(o, 'deposit')),
              action: live && edit && o.values.depositPaid !== true ? mark({ depositPaid: true }, 'Deposit recorded as paid', 'mark-deposit', 'Record deposit paid') : undefined }] : []),
            ...(str(o, 'conditions').trim() ? [{ label: 'Other suspensive conditions', ok: o.values.conditionsFulfilled === true, detail: str(o, 'conditions'),
              action: live && edit && o.values.conditionsFulfilled !== true ? mark({ conditionsFulfilled: true }, 'Other conditions marked fulfilled', 'mark-conditions', 'Mark fulfilled') : undefined }] : []),
          ]} />
          {!bond && num(o, 'deposit') <= 0 && !str(o, 'conditions').trim() && <p className="muted-note">Cash offer with no suspensive conditions.</p>}
          {live && <p className="muted-note" style={{ marginTop: 10 }} data-testid="conditions-hint">{conditionsProblems(o).length ? 'Tick off each condition as it is met. If the bond is declined or the deadline passes, use “Lapse offer” — the listing goes back on the market.' : 'Every condition is met — press “Conditions met” in the Workflow panel above. The listing becomes “Sold” and a transfer opens.'}</p>}
        </Panel>
      )}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const o = findRecord(data, 'offers', id)!;
  const lead = findRecord(data, 'leads', str(o, 'lead'));
  const t = transferFor(data, str(o, 'listing'));
  const tDef = config.collections.find((c) => c.key === 'transfers')!;
  return (
    <>
      <Panel title="Property"><ListingCard data={data} id={o.values.listing} /></Panel>
      <Panel title="Buyer">
        {lead ? (
          <PersonCard name={str(lead, 'name')} lines={[str(lead, 'phone'), str(lead, 'email'), label(LEAD_SOURCES, str(lead, 'source'))]}
            tag={<RecLink module="leads" id={lead.id}>Open buyer {lead.ref}</RecLink>} />
        ) : <p className="muted-note">No buyer linked.</p>}
      </Panel>
      {t && str(t, 'offer') === o.id && (
        <Panel title="Transfer (simulated)" right={<StatusTag workflow={tDef.workflow} status={t.status} />}>
          <KeyValues items={[
            { label: 'Reference', value: <RecLink module="transfers" id={t.id}>{t.ref}</RecLink> },
            { label: 'Expected registration', value: formatDate(str(t, 'expectedRegistration')) },
          ]} />
        </Panel>
      )}
    </>
  );
}
