import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { KeyValues, Notice, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { CONVEYANCERS, label } from '../data';
import { TRANSFER_OPEN, commissionOn, commissionRate, commissionSplit, leadName, listingOf, rand, randOf, todayStr } from '../helpers';
import { Checklist, ListingCard, RecLink } from './shared';

export default function TransferDetail() {
  const { id } = useParams();
  const data = useData();
  const t = findRecord(data, 'transfers', id);
  return (
    <RecordDetail aside={t ? <Aside id={t.id} /> : undefined}>
      {t && <Main id={t.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const t = findRecord(data, 'transfers', id)!;
  const offer = findRecord(data, 'offers', str(t, 'offer'));
  const open = TRANSFER_OPEN.includes(t.status ?? '');
  const edit = open && can('offers.manage');
  const bond = offer?.values.bondRequired === true;
  const bondOk = !bond || offer?.values.bondApproved === true;
  const tick = (key: 'transferDuty' | 'ratesClearance', text: string) => (
    <button className="btn sm" data-testid={`tick-${key}`} onClick={() => { act.update('transfers', id, { [key]: true }, `${text} recorded (simulated)`); act.toast(`${t.ref}: ${text.toLowerCase()} recorded`); }}>Record as received</button>
  );
  return (
    <>
      <Panel title="Conveyancing checklist" meta="Everything is recorded by hand — no conveyancer, bank or deeds office is connected">
        <Checklist items={[
          { label: bond ? 'Buyer’s bond approved (simulated)' : 'Cash purchase confirmed', ok: bondOk,
            detail: bond ? <>Bond {randOf(num(offer, 'bondAmount'))} on offer <RecLink module="offers" id={offer?.id}>{offer?.ref}</RecLink></> : 'No bond condition on the offer' },
          { label: 'Transferring conveyancer appointed', ok: !!str(t, 'conveyancer'),
            detail: str(t, 'conveyancer') ? label(CONVEYANCERS, str(t, 'conveyancer')) : 'Needed before transfer documents can be signed',
            action: edit ? (
              <select className="select sm" aria-label="Transferring conveyancer" style={{ width: 'auto', maxWidth: 240 }} value={str(t, 'conveyancer')} data-testid="pick-conveyancer"
                onChange={(e) => { act.update('transfers', id, { conveyancer: e.target.value }, e.target.value ? `Conveyancer appointed: ${label(CONVEYANCERS, e.target.value)}` : 'Conveyancer removed'); }}>
                <option value="">Select conveyancer…</option>
                {CONVEYANCERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : undefined },
          { label: 'Transfer duty receipt (simulated)', ok: t.values.transferDuty === true, detail: 'Needed before lodgement',
            action: edit && t.values.transferDuty !== true ? tick('transferDuty', 'Transfer duty receipt') : undefined },
          { label: 'Rates clearance certificate (simulated)', ok: t.values.ratesClearance === true, detail: 'Needed before lodgement',
            action: edit && t.values.ratesClearance !== true ? tick('ratesClearance', 'Rates clearance certificate') : undefined },
        ]} />
        {open && <p className="muted-note" style={{ marginTop: 10 }}>Then use the Workflow buttons above: bond → documents signed → lodged → registered. Registration creates the commission record and marks the listing registered.</p>}
        {!can('offers.manage') && open && <p className="muted-note" style={{ marginTop: 6 }}>Your simulated role can follow the transfer but not progress it (needs “Offers & transfers”).</p>}
      </Panel>
      {str(t, 'notes') && <Notice tone="grey"><b>Note:</b> {str(t, 'notes')}</Notice>}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const { can } = useUser();
  const today = todayStr();
  const t = findRecord(data, 'transfers', id)!;
  const listing = listingOf(data, t);
  const offer = findRecord(data, 'offers', str(t, 'offer'));
  const com = records(data, 'commissions').find((c) => str(c, 'transfer') === id);
  const comDef = config.collections.find((c) => c.key === 'commissions')!;
  const exp = str(t, 'expectedRegistration');
  return (
    <>
      <Panel title="Property"><ListingCard data={data} id={t.values.listing} /></Panel>
      <Panel title="Sale">
        <KeyValues items={[
          { label: 'Buyer', value: leadName(data, offer?.values.lead) },
          { label: 'Purchase price', value: randOf(num(t, 'purchasePrice')) },
          { label: 'Offer', value: offer ? <RecLink module="offers" id={offer.id}>{offer.ref}</RecLink> : '—' },
          { label: 'Expected registration', value: exp ? `${formatDate(exp)}${TRANSFER_OPEN.includes(t.status ?? '') ? ` · ${daysBetween(today, exp) < 0 ? `${-daysBetween(today, exp)} days overdue` : `${daysBetween(today, exp)} days`}` : ''}` : '—' },
        ]} />
      </Panel>
      {can('commission.view') && (
        <Panel title="Commission" right={com ? <StatusTag workflow={comDef.workflow} status={com.status} /> : undefined}>
          {com ? (
            <KeyValues items={[
              { label: 'Record', value: <RecLink module="commission" id={com.id}>{com.ref}</RecLink> },
              { label: 'Commission excl. VAT', value: rand(commissionSplit(com).gross) },
              { label: `Agent share (${commissionSplit(com).agentPct}%)`, value: rand(commissionSplit(com).agent) },
            ]} />
          ) : <p className="muted-note" style={{ margin: 0 }}>{rand(commissionOn(listing, num(t, 'purchasePrice')))} ({commissionRate(listing)}% excl. VAT) becomes payable when this transfer is registered.</p>}
        </Panel>
      )}
    </>
  );
}
