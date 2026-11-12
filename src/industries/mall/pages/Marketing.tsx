import { Link } from 'react-router-dom';
import { useBase, useData, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Meters, Panel, Stat, Tag } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { CAMPAIGN_KINDS, label } from '../data';
import { marketingFund, randBig, spaceLabel, todayStr } from '../helpers';

/** Campaign register with the marketing-fund position and a combined events calendar. */
export default function Marketing() {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const today = todayStr();
  const fund = marketingFund(data);
  const horizon = addDays(today, 60);
  const events = [
    ...records(data, 'campaigns').filter((c) => ['planned', 'approved', 'running'].includes(c.status ?? '') && (str(c, 'endDate') || str(c, 'startDate')) >= today && str(c, 'startDate') <= horizon)
      .map((c) => ({ key: c.id, date: str(c, 'startDate'), end: str(c, 'endDate'), title: str(c, 'title'), sub: label(CAMPAIGN_KINDS, str(c, 'kind')), to: `marketing/${c.id}`, tone: c.status === 'planned' ? 'dark' as const : 'accent' as const, tag: c.status === 'planned' ? 'Planned' : c.status === 'approved' ? 'Approved' : 'Running', mod: 'marketing' })),
    ...records(data, 'bookings').filter((b) => ['confirmed', 'live'].includes(b.status ?? '') && str(b, 'endDate') >= today && str(b, 'startDate') <= horizon)
      .map((b) => ({ key: b.id, date: str(b, 'startDate'), end: str(b, 'endDate'), title: str(b, 'exhibitor'), sub: spaceLabel(b), to: `bookings/${b.id}`, tone: 'blue' as const, tag: b.status === 'live' ? 'Live' : 'Confirmed', mod: 'bookings' })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <RegisterPage>
      <div className="stat-grid">
        <Stat label="Marketing levies billed" value={randBig(fund.levies)} tone="accent" sub="on issued invoices over the last six months, excl. VAT" />
        <Stat label="Spent" value={randBig(fund.spent)} sub="campaigns running or completed" />
        <Stat label="Approved, not yet spent" value={randBig(fund.approved)} sub={`${randBig(fund.planned)} more is planned`} />
        <Stat label="Fund balance" value={randBig(fund.balance)} tone={fund.balance < 0 ? 'red' : undefined} sub="levies less spent and approved" />
      </div>
      <div className="grid-2">
        <Panel title="Events calendar" meta="Campaigns and confirmed exhibitions over the next 60 days">
          {events.length ? (
            <ul className="list" data-testid="events-calendar">
              {events.map((e) => (
                <li key={e.key} style={{ flexWrap: 'wrap' }}>
                  <span className="time-chip">{formatDate(e.date < today ? today : e.date).slice(0, 6)}</span>
                  <div className="grow" style={{ minWidth: 150 }}>{hasModule(e.mod) ? <Link to={`${base}/${e.to}`}><b>{e.title}</b></Link> : <b>{e.title}</b>}<small>{e.sub}{e.end && e.end !== e.date ? ` · to ${formatDate(e.end)}` : ''}</small></div>
                  <Tag tone={e.tone}>{e.tag}</Tag>
                </li>
              ))}
            </ul>
          ) : <Empty title="Nothing in the next 60 days" />}
        </Panel>
        <Panel title="Marketing fund" meta="Tenants pay a levy per m² each month; campaigns are paid from it">
          <Meters format={(n) => randBig(n)} items={[
            { label: 'Spent', value: fund.spent, max: fund.levies || undefined },
            { label: 'Approved, not yet spent', value: fund.approved, max: fund.levies || undefined, tone: 'amber' },
            { label: 'Balance', value: Math.max(0, fund.balance), max: fund.levies || undefined, tone: 'green' },
          ]} />
          <p className="muted-note" style={{ marginTop: 10 }}>“Approve spend” on a campaign is refused if its cost is more than the balance. This is a running figure for the demo, not a fund account.</p>
        </Panel>
      </div>
    </RegisterPage>
  );
}
