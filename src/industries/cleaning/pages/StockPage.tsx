import { Link } from 'react-router-dom';
import { useBase, useData, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { Meters, Panel, Stat } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { budgetState, lowStock, randOf, todayStr } from '../helpers';

/** Stock register with the store's position and every site's consumables budget for the month. */
export default function StockPage() {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const month = todayStr().slice(0, 7);
  const stock = records(data, 'stock');
  const low = lowStock(data);
  const hazardous = stock.filter((s) => s.values.hazardous === true);
  const value = stock.reduce((n, s) => n + num(s, 'qty') * num(s, 'cost'), 0);
  const requested = records(data, 'issues').filter((i) => i.status === 'requested');
  const budgets = records(data, 'sites').filter((s) => s.status !== 'ended').map((s) => ({ site: s, b: budgetState(data, s, month) })).sort((a, b) => b.b.pct - a.b.pct);
  return (
    <RegisterPage>
      <div className="stat-grid">
        <Stat label="Stock value at cost" value={randOf(value)} sub={`${stock.length} items in the store`} />
        <Stat label="Below reorder level" value={low.length} tone={low.length ? 'red' : undefined} sub={`${low.filter((s) => num(s, 'qty') <= 0).length} out of stock`} />
        <Stat label="Hazardous chemicals" value={hazardous.length} sub={`${hazardous.filter((s) => s.values.sdsOnFile !== true).length} without an SDS on file`} tone={hazardous.some((s) => s.values.sdsOnFile !== true) ? 'red' : undefined} />
        <Stat label="Requests waiting" value={requested.length} tone={requested.length ? 'accent' : undefined} sub={hasModule('issues') ? <Link to={`${base}/issues`}>Open issues to sites</Link> : 'issues to sites'} />
      </div>
      <Panel title="Consumables against budget" meta="Issued to each site this month at cost, against its monthly budget">
        <Meters format={(n) => randOf(n)} items={budgets.slice(0, 8).map(({ site, b }) => ({ label: str(site, 'name'), value: b.used, max: b.budget || undefined, tone: b.over ? 'red' : b.pct > 85 ? 'amber' : 'green', sub: b.budget ? `${b.pct}% of budget${b.over ? ' — over budget' : ''}` : 'No budget set' }))} />
        <p className="muted-note" style={{ marginTop: 10 }}>The eight sites closest to (or over) budget. Safety data sheets are a yes/no flag in this demo — no documents are stored.</p>
      </Panel>
    </RegisterPage>
  );
}
