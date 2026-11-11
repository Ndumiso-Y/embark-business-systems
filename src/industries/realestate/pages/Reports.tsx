import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, formatDate, monthShort } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { BarChart, Empty, Meters, Notice, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { DEFAULT_AGENT_SPLIT } from '../data';
import { commissionOn, commissionSplit, daysOnMarket, listingOf, rand, randOf, todayStr } from '../helpers';

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const listingDef = config.collections.find((c) => c.key === 'listings')!;
  const comDef = config.collections.find((c) => c.key === 'commissions')!;
  const listings = records(data, 'listings');
  const agents = records(data, 'agents');
  const commissions = records(data, 'commissions');
  const transfers = records(data, 'transfers');
  const seeMoney = can('commission.view');

  // Pipeline value by listing stage (asking price; selling price once sold).
  const stageValue = (k: string) => listings.filter((l) => l.status === k).reduce((n, l) => n + toCents(num(l, k === 'sold' ? 'soldPrice' : 'askingPrice') || num(l, 'askingPrice')), 0);
  const stages = listingDef.workflow!.states.filter((s) => !s.terminal);
  const pipeline = stages.map((s) => ({ label: `${s.label} (${listings.filter((l) => l.status === s.key).length})`, value: stageValue(s.key), tone: s.tone }));
  const onMarketValue = stageValue('listed') + stageValue('underoffer');

  // Commission: registered (from commission records) and expected (sold, pending transfer).
  const sold = listings.filter((l) => l.status === 'sold');
  const expected = sold.reduce((n, l) => n + commissionOn(l, num(l, 'soldPrice') || num(l, 'askingPrice')), 0);
  const earned = commissions.reduce((n, c) => n + commissionSplit(c).gross, 0);
  const payable = commissions.filter((c) => c.status === 'payable').reduce((n, c) => n + commissionSplit(c).gross, 0);
  const perAgent = agents.map((a) => {
    const mine = commissions.filter((c) => str(c, 'agent') === a.id);
    const split = mine.reduce((acc, c) => { const s = commissionSplit(c); return { gross: acc.gross + s.gross, agent: acc.agent + s.agent, company: acc.company + s.company }; }, { gross: 0, agent: 0, company: 0 });
    const pending = sold.filter((l) => str(l, 'agent') === a.id).reduce((n, l) => n + commissionOn(l, num(l, 'soldPrice') || num(l, 'askingPrice')), 0);
    return { a, ...split, pending, deals: mine.length };
  });

  // Days on market.
  const live = listings.filter((l) => ['listed', 'underoffer'].includes(l.status ?? ''));
  const soldDom = listings.filter((l) => ['sold', 'registered'].includes(l.status ?? '')).map((l) => daysOnMarket(l, today) ?? 0);
  const avgSoldDom = soldDom.length ? Math.round(soldDom.reduce((n, d) => n + d, 0) / soldDom.length) : 0;
  const domItems = live.map((l) => ({ label: `${str(l, 'address')} · ${l.ref}`, value: daysOnMarket(l, today) ?? 0, tone: ((daysOnMarket(l, today) ?? 0) > 90 ? 'amber' : 'accent') as 'amber' | 'accent' }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  // Viewing → offer conversion (buyers who viewed, and who then made an offer).
  const viewings = records(data, 'viewings').filter((v) => v.status === 'completed' && str(v, 'lead'));
  const offers = records(data, 'offers');
  const viewed = new Set(viewings.map((v) => str(v, 'lead')));
  const offered = new Set(offers.map((o) => str(o, 'lead')).filter((id) => viewed.has(id)));
  const perAgentConv = agents.map((a) => {
    const vs = viewings.filter((v) => str(v, 'agent') === a.id);
    const leads = new Set(vs.map((v) => str(v, 'lead')));
    const conv = [...leads].filter((id) => offers.some((o) => str(o, 'lead') === id && str(o, 'listing') && vs.some((v) => str(v, 'lead') === id && str(v, 'listing') === str(o, 'listing')))).length;
    return { label: str(a, 'name'), value: pct(conv, leads.size), max: 100, sub: `${conv} of ${leads.size} buyers who viewed made an offer`, tone: 'accent' as const, n: leads.size };
  }).filter((x) => x.n > 0);

  // Rental arrears.
  const arrears = records(data, 'leases').filter((l) => ['signed', 'active', 'notice'].includes(l.status ?? '') && num(l, 'arrears') > 0).sort((a, b) => num(b, 'arrears') - num(a, 'arrears'));
  const arrearsTotal = arrears.reduce((n, l) => n + toCents(num(l, 'arrears')), 0);
  const rentRoll = records(data, 'leases').filter((l) => ['active', 'notice'].includes(l.status ?? '')).reduce((n, l) => n + toCents(num(l, 'rent')), 0);

  // Commission registered per month (last 6 months).
  const month = today.slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => addDays(`${month}-15`, -30.4 * (5 - i)).slice(0, 7));
  const chart = months.map((m) => ({
    label: monthShort(m),
    value: Math.round(commissions.filter((c) => str(c, 'registeredOn').startsWith(m)).reduce((n, c) => n + commissionSplit(c).gross, 0) / 100),
    alt: Math.round(transfers.filter((t) => t.status !== 'registered' && t.status !== 'cancelled' && str(t, 'expectedRegistration').startsWith(m))
      .reduce((n, t) => n + commissionOn(listingOf(data, t), num(t, 'purchasePrice')), 0) / 100),
  }));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Agency`} title="Commission & reports" subtitle="Computed from the demo records. Commission is payable on registration; the agent / company split is a demo setting." />
      <div className="stat-grid">
        <Stat label="On the market" value={rand(onMarketValue)} tone="accent" sub={`${live.length} listed or under offer · asking`} />
        <Stat label="Commission pending transfer" value={seeMoney ? rand(expected) : '—'} sub={`${sold.length} sold, awaiting registration (excl. VAT)`} />
        <Stat label="Commission registered" value={seeMoney ? rand(earned) : '—'} sub={`${seeMoney ? rand(payable) : '—'} still payable`} />
        <Stat label="Viewing → offer" value={`${pct(offered.size, viewed.size)}%`} sub={`${offered.size} of ${viewed.size} buyers who viewed made an offer`} />
      </div>
      <div className="section-gap" />
      {!seeMoney && <Notice tone="grey">Commission amounts are hidden for your simulated role (needs commission.view).</Notice>}
      <div className="grid-2">
        <Panel title="Pipeline value by stage" meta="Asking price per stage; selling price once sold">
          <Meters format={(n) => rand(n)} items={pipeline} />
        </Panel>
        <Panel title="Commission by agent" meta={`Excl. VAT · demo split ${DEFAULT_AGENT_SPLIT}/${100 - DEFAULT_AGENT_SPLIT} agent/company (interns 40/60)`}>
          {seeMoney ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Agent</th><th className="num">Deals</th><th className="num">Registered</th><th className="num">Agent share</th><th className="num">Company share</th><th className="num">Pending</th></tr></thead>
                <tbody>
                  {perAgent.map((r) => (
                    <tr key={r.a.id}>
                      <td><strong>{str(r.a, 'name')}</strong><small>{num(r.a, 'agentSplit') || DEFAULT_AGENT_SPLIT}% agent share</small></td>
                      <td className="num">{r.deals}</td>
                      <td className="num">{rand(r.gross)}</td>
                      <td className="num">{rand(r.agent)}</td>
                      <td className="num">{rand(r.company)}</td>
                      <td className="num">{rand(r.pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty title="Hidden for your role" />}
        </Panel>
      </div>
      <div className="grid-2">
        <Panel title="Days on market" meta={`Live listings, longest first · sold properties averaged ${avgSoldDom} days`}>
          {domItems.length ? <Meters format={(n) => `${n} d`} items={domItems} /> : <Empty title="Nothing on the market" />}
        </Panel>
        <Panel title="Viewing → offer conversion by host agent" meta="Buyers who viewed a property and then made an offer on it">
          {perAgentConv.length ? <Meters format={(n) => `${n}%`} items={perAgentConv} /> : <Empty title="No completed viewings yet" />}
        </Panel>
      </div>
      <div className="grid-2">
        <Panel title="Commission per month" meta="Registered (accent) and expected from transfers due that month (dark), whole rand excl. VAT">
          <BarChart label="Commission registered and expected per month" data={chart} alt="Expected" format={(n) => rand(n * 100)} />
        </Panel>
        <Panel title="Rental arrears" meta={`${rand(arrearsTotal)} outstanding · rent roll ${rand(rentRoll)}/month`}>
          {arrears.length ? (
            <ul className="list">
              {arrears.map((l) => (
                <li key={l.id}>
                  <div className="grow">
                    {hasModule('leases') ? <Link to={`${base}/leases/${l.id}`}><b>{str(l, 'tenant')}</b></Link> : <b>{str(l, 'tenant')}</b>}
                    <small>{str(l, 'address')} · rent {randOf(num(l, 'rent'))}/month · {Math.round((num(l, 'arrears') / Math.max(1, num(l, 'rent'))) * 10) / 10} months</small>
                  </div>
                  <b>{randOf(num(l, 'arrears'))}</b>
                </li>
              ))}
            </ul>
          ) : <Empty title="No tenants in arrears" />}
        </Panel>
      </div>
      <Panel title="Commission register" meta="Created automatically when a transfer is registered · payouts are simulated">
        {seeMoney ? <RecordTable def={comDef} rows={[...commissions].sort(comDef.sort)} moduleKey="commission" /> : <Empty title="Hidden for your role" />}
      </Panel>
      <div className="section-gap" />
      <Notice tone="grey">Reports are illustrative. Figures are fictional and exclude VAT unless stated; no accounting, trust or payroll system is connected. Latest registration: {formatDate(commissions.map((c) => str(c, 'registeredOn')).sort().pop() ?? '')}.</Notice>
    </>
  );
}
