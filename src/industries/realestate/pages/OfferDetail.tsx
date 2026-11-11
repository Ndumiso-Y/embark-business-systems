import { useParams } from 'react-router-dom';
import { useData, useIndustry } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { LEAD_SOURCES, label } from '../data';
import { acceptProblems, bondDaysLeft, listingOf, randOf, todayStr, transferFor } from '../helpers';
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
  const today = todayStr();
  const o = findRecord(data, 'offers', id)!;
  const listing = listingOf(data, o);
  const ask = num(listing, 'askingPrice');
  const diff = ask > 0 ? Math.round(((num(o, 'amount') - ask) / ask) * 1000) / 10 : 0;
  const bondLeft = bondDaysLeft(o, today);
  const pending = ['submitted', 'countered'].includes(o.status ?? '');
  const accept = pending ? acceptProblems(o, data) : [];
  const bond = o.values.bondRequired === true;
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
      {['accepted', 'unconditional'].includes(o.status ?? '') && (
        <Panel title="Suspensive conditions" meta="All must be met before “Conditions met” — then the listing is sold and a transfer opens"
          right={bondLeft !== null ? <Tag tone={bondLeft < 0 ? 'red' : bondLeft <= 5 ? 'amber' : 'dark'}>{bondLeft < 0 ? `Bond deadline passed ${-bondLeft} d ago` : `Bond due in ${bondLeft} d`}</Tag> : undefined}>
          <Checklist items={[
            ...(bond ? [{ label: 'Bond approved (simulated)', ok: o.values.bondApproved === true, detail: `Deadline ${formatDate(str(o, 'bondDeadline'))} · Edit → Bond approved` }] : []),
            ...(num(o, 'deposit') > 0 ? [{ label: 'Deposit paid into the conveyancer’s trust (simulated)', ok: o.values.depositPaid === true, detail: randOf(num(o, 'deposit')) }] : []),
            ...(str(o, 'conditions').trim() ? [{ label: 'Other suspensive conditions', ok: o.values.conditionsFulfilled === true, detail: str(o, 'conditions') }] : []),
          ]} />
          {!bond && num(o, 'deposit') <= 0 && !str(o, 'conditions').trim() && <p className="muted-note">Cash offer with no suspensive conditions.</p>}
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
