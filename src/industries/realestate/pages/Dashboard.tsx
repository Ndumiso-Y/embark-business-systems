import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate, monthShort, relativeWhen } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { BarChart, Empty, Flags, PageHeader, Panel, Pipeline, Stat, Tag } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { OWNER_APPROVAL_LIMIT, label, VIEWING_KINDS } from '../data';
import {
  ON_MARKET, TRANSFER_OPEN, agentName, bondDaysLeft, byDateTime, commissionOn, ffcState, goLiveProblems, leadName, leaseEndsIn, listingName, listingOf,
  mandateDaysLeft, plural, rand, randOf, todayStr,
} from '../helpers';

type Tone = 'red' | 'amber' | 'accent';

export default function Dashboard() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { user, hasModule } = useUser();
  const today = todayStr();
  const month = today.slice(0, 7);
  const def = (k: string) => config.collections.find((c) => c.key === k)!;

  const listings = records(data, 'listings');
  const onMarket = listings.filter((l) => ON_MARKET.includes(l.status ?? ''));
  const offers = records(data, 'offers');
  const awaiting = offers.filter((o) => ['submitted', 'countered'].includes(o.status ?? ''));
  const transfers = records(data, 'transfers');
  const openTransfers = transfers.filter((t) => TRANSFER_OPEN.includes(t.status ?? ''));
  const thisMonth = openTransfers.filter((t) => str(t, 'expectedRegistration').slice(0, 7) === month).sort((a, b) => str(a, 'expectedRegistration').localeCompare(str(b, 'expectedRegistration')));
  const monthValue = thisMonth.reduce((n, t) => n + toCents(num(t, 'purchasePrice')), 0);
  const monthCommission = thisMonth.reduce((n, t) => n + commissionOn(listingOf(data, t), num(t, 'purchasePrice')), 0);
  const expiring = listings.filter((l) => ['mandate', 'listed', 'underoffer'].includes(l.status ?? '') && (mandateDaysLeft(l, today) ?? 99) <= 14)
    .sort((a, b) => str(a, 'mandateExpiry').localeCompare(str(b, 'mandateExpiry')));
  const leases = records(data, 'leases');
  const ending = leases.filter((l) => ['active', 'notice'].includes(l.status ?? '') && (leaseEndsIn(l, today) ?? 999) <= 60).sort((a, b) => str(a, 'endDate').localeCompare(str(b, 'endDate')));
  const arrears = leases.filter((l) => ['signed', 'active', 'notice'].includes(l.status ?? '') && num(l, 'arrears') > 0);
  const arrearsTotal = arrears.reduce((n, l) => n + toCents(num(l, 'arrears')), 0);
  const viewings = records(data, 'viewings');
  const todays = viewings.filter((v) => str(v, 'date') === today && v.status !== 'cancelled').sort(byDateTime);

  // Six months: mandates signed vs sales registered.
  const months = Array.from({ length: 6 }, (_, i) => addDays(`${month}-15`, -30.4 * (5 - i)).slice(0, 7));
  const chart = months.map((m) => ({
    label: monthShort(m),
    value: listings.filter((l) => str(l, 'mandateSigned').startsWith(m)).length,
    alt: listings.filter((l) => str(l, 'registeredOn').startsWith(m)).length,
  }));

  const attention: Array<{ key: string; to: string; mod: string; tone: Tone; title: string; sub: string }> = [
    ...records(data, 'agents').filter((a) => ['expired', 'expiring'].includes(ffcState(a, today))).map((a) => {
      const live = listings.filter((l) => str(l, 'agent') === a.id && ['mandate', 'listed', 'underoffer'].includes(l.status ?? '')).length;
      const expired = ffcState(a, today) === 'expired';
      return { key: a.id, to: `agents/${a.id}`, mod: 'agents', tone: (expired ? 'red' : 'amber') as Tone,
        title: `${str(a, 'name')}: FFC ${expired ? 'expired' : 'expires'} ${formatDate(str(a, 'ffcExpiry'))}`, sub: `${plural(live, 'active listing')} · renew the (fictional) certificate` };
    }),
    ...openTransfers.filter((t) => str(t, 'expectedRegistration') < today).map((t) => ({ key: t.id, to: `transfers/${t.id}`, mod: 'transfers', tone: 'red' as Tone,
      title: `Registration overdue — ${listingName(data, t.values.listing)}`, sub: `Expected ${formatDate(str(t, 'expectedRegistration'))} · ${t.ref}` })),
    ...offers.filter((o) => o.status === 'accepted' && (bondDaysLeft(o, today) ?? 99) <= 5).map((o) => {
      const left = bondDaysLeft(o, today) ?? 0;
      return { key: o.id, to: `offers/${o.id}`, mod: 'offers', tone: (left < 0 ? 'red' : 'amber') as Tone,
        title: left < 0 ? `Bond deadline passed — ${o.ref}` : `Bond deadline in ${left} day${left === 1 ? '' : 's'} — ${o.ref}`, sub: `${leadName(data, o.values.lead)} · ${listingName(data, o.values.listing)}` };
    }),
    ...awaiting.filter((o) => str(o, 'validUntil') && daysBetween(today, str(o, 'validUntil')) <= 1).map((o) => ({ key: o.id + 'v', to: `offers/${o.id}`, mod: 'offers', tone: 'amber' as Tone,
      title: `Seller response needed — ${o.ref} open until ${formatDate(str(o, 'validUntil'))}`, sub: `${randOf(num(o, 'amount'))} · ${listingName(data, o.values.listing)}` })),
    ...listings.filter((l) => l.status === 'mandate').map((l) => ({ l, p: goLiveProblems(l, data, today) })).filter((x) => x.p.length).map(({ l, p }) => ({
      key: l.id + 'g', to: `listings/${l.id}`, mod: 'listings', tone: 'amber' as Tone, title: `${l.ref} cannot go live yet`, sub: `${str(l, 'address')} · ${p[0]}` })),
    ...viewings.filter((v) => v.status === 'booked' && str(v, 'date') < today).map((v) => ({ key: v.id, to: `viewings/${v.id}`, mod: 'viewings', tone: 'amber' as Tone,
      title: `Viewing feedback outstanding — ${v.ref}`, sub: `${formatDate(str(v, 'date'))} · ${listingName(data, v.values.listing)} · ${agentName(data, v.values.agent)}` })),
    ...arrears.map((l) => ({ key: l.id, to: `leases/${l.id}`, mod: 'leases', tone: 'red' as Tone, title: `Rent arrears ${randOf(num(l, 'arrears'))} — ${str(l, 'tenant')}`, sub: `${str(l, 'address')} · ${l.ref}` })),
    ...records(data, 'maintenance').filter((m) => (m.status === 'quoted' && num(m, 'quote') > OWNER_APPROVAL_LIMIT && m.values.ownerApproved !== true) || (['logged', 'quoted', 'approved', 'assigned'].includes(m.status ?? '') && str(m, 'priority') === 'urgent'))
      .map((m) => ({ key: m.id, to: `maintenance/${m.id}`, mod: 'maintenance', tone: (str(m, 'priority') === 'urgent' ? 'red' : 'amber') as Tone,
        title: `${str(m, 'priority') === 'urgent' ? 'Urgent: ' : 'Owner approval needed: '}${str(m, 'title')}`, sub: `${m.ref} · ${num(m, 'quote') ? `quote ${randOf(num(m, 'quote'))}` : 'awaiting quote'}` })),
    ...records(data, 'leads').filter((l) => l.status === 'new' && daysBetween(l.createdAt.slice(0, 10), today) >= 2).slice(0, 3).map((l) => ({ key: l.id, to: `leads/${l.id}`, mod: 'leads', tone: 'amber' as Tone,
      title: `New buyer not contacted — ${str(l, 'name')}`, sub: `Budget ${randOf(num(l, 'budget'))} · ${str(l, 'suburbs') || 'any suburb'}` })),
  ].filter((a) => hasModule(a.mod));

  const listingDef = def('listings');
  return (
    <>
      <PageHeader kicker={`${config.businessName} / Dashboard`} title={`Good day, ${user.name.split(' ')[0]}`} subtitle={`${formatDate(today)} · agency overview built from the live demo records.`}
        actions={hasModule('viewings') ? <Link className="btn primary" to={`${base}/viewings`}>Today’s viewings</Link> : undefined} />
      <div className="dash-hero">
        <div>
          <div className="hero-kicker">Today at the agency</div>
          <h2>{plural(todays.length, 'viewing')} today · {plural(onMarket.length, 'property', 'properties')} on the market</h2>
          <p>{plural(awaiting.length, 'offer')} awaiting a seller’s response, {plural(thisMonth.length, 'transfer')} expected to register this month, {plural(expiring.length, 'mandate')} expiring within 14 days and {plural(arrears.length, 'lease')} in arrears.</p>
        </div>
        {hasModule('listings') && <Link className="btn" to={`${base}/listings`}>{listings.filter((l) => l.status === 'mandate').length} mandates waiting to go live →</Link>}
      </div>
      <div className="stat-grid">
        <Stat label="On the market" value={onMarket.length} tone="accent" sub={`${rand(onMarket.reduce((n, l) => n + toCents(num(l, 'askingPrice')), 0))} asking · ${onMarket.filter((l) => l.status === 'underoffer').length} under offer`} />
        <Stat label="Offers awaiting response" value={awaiting.length} tone={awaiting.some((o) => str(o, 'validUntil') <= addDays(today, 1)) ? 'red' : undefined} sub={`${rand(awaiting.reduce((n, o) => n + toCents(num(o, 'amount')), 0))} on the table`} />
        <Stat label="Registering this month" value={rand(monthValue)} sub={`${plural(thisMonth.length, 'transfer')} · ${rand(monthCommission)} commission excl. VAT`} />
        <Stat label="Rental arrears" value={rand(arrearsTotal)} tone={arrears.length ? 'red' : undefined} sub={`${plural(arrears.length, 'lease')} · ${plural(ending.length, 'lease')} ending within 60 days`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Viewings today" meta="Private viewings and show days, by time" right={hasModule('viewings') ? <Link className="btn sm" to={`${base}/viewings`}>Schedule</Link> : undefined}>
          {todays.length ? (
            <ul className="list" data-testid="viewings-today">
              {todays.map((v) => (
                <li key={v.id}>
                  <span className="time-chip">{str(v, 'time')}</span>
                  <div className="grow">
                    {hasModule('viewings') ? <Link to={`${base}/viewings/${v.id}`}><b>{listingName(data, v.values.listing)}</b></Link> : <b>{listingName(data, v.values.listing)}</b>}
                    <small>{str(v, 'lead') ? leadName(data, v.values.lead) : label(VIEWING_KINDS, str(v, 'kind'))} · {agentName(data, v.values.agent)}</small>
                  </div>
                  <Tag tone={v.status === 'completed' ? 'green' : v.status === 'noshow' ? 'red' : 'blue'}>{v.status === 'completed' ? 'Done' : v.status === 'noshow' ? 'No-show' : 'Booked'}</Tag>
                </li>
              ))}
            </ul>
          ) : <Empty title="No viewings today" />}
        </Panel>
        <div className="stack">
          <Panel title="Needs attention" meta="FFCs, overdue registrations, bond deadlines, offers, go-live blocks, feedback, arrears, maintenance">
            {attention.length ? (
              <ul className="list" data-testid="attention-list">
                {attention.slice(0, 10).map((a) => (
                  <li key={a.key}><span className={`dot ${a.tone}`} /><div className="grow"><Link to={`${base}/${a.to}`}><b>{a.title}</b></Link><small>{a.sub}</small></div></li>
                ))}
              </ul>
            ) : <Empty title="Nothing needs attention" />}
          </Panel>
          {hasModule('listings') && (
            <Panel title="Listings by stage" right={<Link className="btn sm" to={`${base}/listings`}>Listings</Link>}>
              <Pipeline stages={listingDef.workflow!.states.filter((s) => !s.terminal).map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: listings.filter((l) => l.status === s.key).length }))} />
            </Panel>
          )}
        </div>
      </div>
      <div className="grid-2">
        <Panel title="Expected to register this month" meta={`${rand(monthValue)} in sales · ${rand(monthCommission)} commission becomes payable on registration`}>
          {thisMonth.length ? (
            <ul className="list">
              {thisMonth.map((t) => (
                <li key={t.id}>
                  <span className="time-chip">{formatDate(str(t, 'expectedRegistration')).slice(0, 6)}</span>
                  <div className="grow">
                    {hasModule('transfers') ? <Link to={`${base}/transfers/${t.id}`}><b>{listingName(data, t.values.listing)}</b></Link> : <b>{listingName(data, t.values.listing)}</b>}
                    <small>{randOf(num(t, 'purchasePrice'))} · commission {rand(commissionOn(listingOf(data, t), num(t, 'purchasePrice')))} · {agentName(data, listingOf(data, t)?.values.agent)}</small>
                  </div>
                  <Tag tone={t.status === 'lodged' ? 'amber' : 'dark'}>{def('transfers').workflow!.states.find((s) => s.key === t.status)?.label}</Tag>
                </li>
              ))}
            </ul>
          ) : <Empty title="No registrations expected this month" />}
        </Panel>
        <Panel title="Mandates expiring" meta="Within 14 days — renew with the seller or the listing must come off the market">
          {expiring.length ? (
            <ul className="list">
              {expiring.map((l) => (
                <li key={l.id}>
                  <div className="grow">
                    {hasModule('listings') ? <Link to={`${base}/listings/${l.id}`}><b>{str(l, 'address')}</b></Link> : <b>{str(l, 'address')}</b>}
                    <small>{l.ref} · {agentName(data, l.values.agent)} · expires {formatDate(str(l, 'mandateExpiry'))}</small>
                  </div>
                  <Flags flags={(listingDef.flags?.(l, data, today) ?? []).filter((f) => f.label.startsWith('Mandate'))} />
                </li>
              ))}
            </ul>
          ) : <Empty title="No mandates expiring soon" />}
        </Panel>
      </div>
      <div className="grid-2">
        <Panel title="Leases ending & arrears" meta="Active leases ending within 60 days and tenants in arrears">
          {ending.length || arrears.length ? (
            <ul className="list">
              {[...arrears, ...ending.filter((l) => !arrears.includes(l))].map((l) => (
                <li key={l.id}>
                  <div className="grow">
                    {hasModule('leases') ? <Link to={`${base}/leases/${l.id}`}><b>{str(l, 'address')}</b></Link> : <b>{str(l, 'address')}</b>}
                    <small>{str(l, 'tenant')} · {randOf(num(l, 'rent'))}/month · ends {formatDate(str(l, 'endDate'))}</small>
                  </div>
                  <Flags flags={def('leases').flags?.(l, data, today) ?? []} />
                </li>
              ))}
            </ul>
          ) : <Empty title="No leases ending and no arrears" />}
        </Panel>
        <Panel title="Mandates signed vs sales registered" meta="Last six months · mandates (accent) and registrations (dark)">
          <BarChart label="Mandates signed and sales registered per month" data={chart} alt="Registered" />
        </Panel>
      </div>
      <Panel title="Recent activity" meta="Actions taken in this browser">
        {data.activity.length ? (
          <ul className="list">
            {data.activity.slice(0, 7).map((a) => <li key={a.id}><span className={`dot ${a.tone}`} /><div className="grow"><b>{a.title}</b><small>{a.detail} · {relativeWhen(a.at)}</small></div></li>)}
          </ul>
        ) : <Empty title="No activity yet" body="Put a listing live, accept an offer or register a transfer — actions appear here." />}
      </Panel>
      <div className="section-gap" />
      <RoleBar />
    </>
  );
}
