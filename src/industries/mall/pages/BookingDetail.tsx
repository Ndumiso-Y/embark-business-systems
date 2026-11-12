import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, permissionHint, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { BOOKING_TYPES, SPACES, label } from '../data';
import { bookingClash, bookingFigures, plural, rand, randOf, spaceLabel } from '../helpers';
import { MallStyles, RecLink } from './shared';

export default function BookingDetail() {
  const { id } = useParams();
  const data = useData();
  const b = findRecord(data, 'bookings', id);
  return (
    <RecordDetail aside={b ? <Aside id={b.id} /> : undefined}>
      {b && <Main key={b.id} id={b.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const b = findRecord(data, 'bookings', id)!;
  const status = b.status ?? '';
  const edit = can('marketing') && ['enquiry', 'quoted'].includes(status);
  const f = bookingFigures(b);
  const clash = ['enquiry', 'quoted'].includes(status) ? bookingClash(data, b) : undefined;
  const [space, setSpace] = useState(str(b, 'space'));
  const [from, setFrom] = useState(str(b, 'startDate'));
  const [to, setTo] = useState(str(b, 'endDate'));
  const [rate, setRate] = useState(String(num(b, 'dailyRate')));
  const [deposit, setDeposit] = useState(String(num(b, 'depositAmount')));
  const changed = space !== str(b, 'space') || from !== str(b, 'startDate') || to !== str(b, 'endDate');
  return (
    <>
      <MallStyles />
      {clash && (
        <Notice tone="red">
          <span data-testid="clash-notice"><b>Double-booking:</b> {spaceLabel(b)} is already booked by <RecLink module="bookings" id={clash.id}>{str(clash, 'exhibitor')}</RecLink> ({clash.ref}) from {formatDate(str(clash, 'startDate'))} to {formatDate(str(clash, 'endDate'))}. “Confirm booking” will be refused — change the dates or the space below.</span>
        </Notice>
      )}
      <Panel title="Dates & space" meta="A space is held only once the booking is confirmed" right={<Tag tone={clash ? 'red' : 'green'}>{clash ? 'Clash' : f.days ? plural(f.days, 'day') : 'No dates'}</Tag>}>
        <div className="form-grid">
          <div className="span-2"><Field label="Space">
            <select className="select" aria-label="Space" disabled={!edit} value={space} onChange={(e) => setSpace(e.target.value)} data-testid="booking-space">{SPACES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          </Field></div>
          <Field label="From"><input className="input" type="date" aria-label="Booking from" disabled={!edit} value={from} onChange={(e) => setFrom(e.target.value)} data-testid="booking-from" /></Field>
          <Field label="To"><input className="input" type="date" aria-label="Booking to" disabled={!edit} value={to} onChange={(e) => setTo(e.target.value)} data-testid="booking-to" /></Field>
          {edit && <div><button className="btn" disabled={!changed} data-testid="save-booking-dates" onClick={() => { if (!from || !to || to < from) return act.toast('The booking must end on or after the day it starts.', 'err'); act.update('bookings', id, { space, startDate: from, endDate: to }, `Moved to ${label(SPACES, space)}, ${formatDate(from)} – ${formatDate(to)}`); act.toast(`${b.ref}: dates and space saved`); }}>Save dates & space</button></div>}
        </div>
        {!can('marketing') && <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'marketing')}</p>}
      </Panel>
      <Panel title="Quote & deposit" meta="Days × daily rate, VAT at 15% · the quote is a preview, nothing is sent" right={b.values.depositPaid === true ? <Tag tone="green">Deposit received</Tag> : f.deposit ? <Tag tone="amber">Deposit outstanding</Tag> : <Tag tone="dark">No deposit set</Tag>}>
        <div className="mini-stat-row">
          <div>{plural(f.days, 'day')} × {randOf(num(b, 'dailyRate'))}<b>{rand(f.net)}</b></div>
          <div>VAT<b>{rand(f.vat)}</b></div>
          <div>Total<b>{rand(f.total)}</b></div>
          <div>Deposit<b>{rand(f.deposit)}</b></div>
        </div>
        {edit && (
          <div className="mall-inline" style={{ marginTop: 12 }}>
            <Field label="Daily rate (excl. VAT)"><input className="input num" type="number" min={0} step="50" aria-label="Daily rate" value={rate} onChange={(e) => setRate(e.target.value)} data-testid="daily-rate" /></Field>
            <Field label="Deposit"><input className="input num" type="number" min={0} step="100" aria-label="Deposit amount" value={deposit} onChange={(e) => setDeposit(e.target.value)} data-testid="deposit" /></Field>
            <button className="btn" disabled={Number(rate) === num(b, 'dailyRate') && Number(deposit) === num(b, 'depositAmount')} data-testid="save-quote" onClick={() => { act.update('bookings', id, { dailyRate: Number(rate) || 0, depositAmount: Number(deposit) || 0 }, 'Quote figures updated'); act.toast(`${b.ref}: quote figures saved`); }}>Save figures</button>
          </div>
        )}
        {status === 'quoted' && b.values.depositPaid !== true && can('marketing') && (
          <div className="btns" style={{ marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn sm primary" data-testid="deposit-received" onClick={() => { act.update('bookings', id, { depositPaid: true }, `Deposit of ${rand(f.deposit)} recorded as received (typed in)`); act.toast(`${b.ref}: deposit recorded — the booking can be confirmed`); }}>Record deposit received</button>
            <span className="muted-note">“Confirm booking” is refused until the deposit is in{f.deposit ? '' : ' (a charity booking can carry a zero deposit — record it anyway)'}.</span>
          </div>
        )}
      </Panel>
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const b = findRecord(data, 'bookings', id)!;
  return (
    <Panel title="Exhibitor (fictional)">
      <KeyValues items={[
        { label: 'Type', value: label(BOOKING_TYPES, str(b, 'type')) },
        { label: 'Contact', value: str(b, 'contact') },
        { label: 'Phone', value: str(b, 'phone') },
        { label: 'Email', value: str(b, 'email'), wide: true },
      ]} />
    </Panel>
  );
}
