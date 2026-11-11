import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBase, useData, useIndustry } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { formatRand } from '../../../core/lib/money';
import { Empty, Flags, Panel, Stat, Tag } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { IcoSearch } from '../../../core/components/Icons';
import { BRANDS, label } from '../data';
import { ALT_TOLERANCE_PCT, dotAgeYears, isOldDot, parseTyreSize, stockForSize, todayStr, type SizeMatch } from '../helpers';

/** Tyre stock: size search with same-rim alternatives, then the full register. */
export default function StockPage() {
  return <RegisterPage intro={<SizeSearch />} />;
}

function SizeSearch() {
  const data = useData();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('size') ?? '205/55R16');
  const today = todayStr();
  const stock = records(data, 'stock');
  const parsed = parseTyreSize(q);
  const matches = parsed ? stockForSize(data, q) : [];
  const exact = matches.filter((m) => m.exact);
  const alts = matches.filter((m) => !m.exact);
  const units = stock.reduce((n, s) => n + num(s, 'qty'), 0);
  const value = stock.reduce((n, s) => n + Math.round(num(s, 'cost') * num(s, 'qty') * 100), 0);
  const low = stock.filter((s) => num(s, 'qty') <= num(s, 'reorderLevel'));
  const old = stock.filter((s) => isOldDot(str(s, 'dot'), today) && num(s, 'qty') > 0);
  const suggestions = Array.from(new Set(records(data, 'vehicles').map((v) => str(v, 'tyreSize')))).sort().slice(0, 10);

  return (
    <>
      <div className="stat-grid compact">
        <Stat label="Tyres on hand" value={units} sub={`${stock.length} stock lines`} />
        <Stat label="Stock value at cost" value={formatRand(value, { compact: true })} />
        <Stat label="Low stock lines" value={low.length} tone={low.length ? 'red' : undefined} sub="At or below reorder level" />
        <Stat label="Old stock (> 5 yrs DOT)" value={old.length} sub={`${old.reduce((n, s) => n + num(s, 'qty'), 0)} tyres to clear (demo rule)`} />
      </div>
      <div className="section-gap" />
      <Panel title="Size search" meta={`Exact size first, then other sizes on the same rim. Within ±${ALT_TOLERANCE_PCT}% overall diameter is marked as a possible alternative (demo rule — confirm load and speed rating).`}>
        <div className="toolbar" style={{ flexWrap: 'wrap' }}>
          <label className="search-box">
            <IcoSearch />
            <input aria-label="Tyre size" placeholder="e.g. 205/55R16" value={q} onChange={(e) => setQ(e.target.value)} data-testid="size-search" />
          </label>
          {parsed ? <Tag tone="accent">{parsed.width} mm · {parsed.profile}% profile · R{parsed.rim}{parsed.commercial ? ' C' : ''}</Tag> : <Tag tone="amber">Enter a size like 205/55R16</Tag>}
          <span className="toolbar-count">Fleet & customer sizes:</span>
          {suggestions.map((s) => <button key={s} type="button" className="btn xs" onClick={() => setQ(s)}>{s}</button>)}
        </div>
        {parsed && (
          <div className="grid-2-even" style={{ marginTop: 14, marginBottom: 0 }}>
            <div>
              <h3 className="panel-title" style={{ fontSize: 14, marginBottom: 8 }}>{parsed.key} in stock</h3>
              {exact.length ? <MatchTable rows={exact} today={today} /> : <Empty title={`No ${parsed.key} in stock`} body="See same-rim alternatives, or order from a supplier (not connected)." />}
            </div>
            <div>
              <h3 className="panel-title" style={{ fontSize: 14, marginBottom: 8 }}>Same rim (R{parsed.rim}) alternatives</h3>
              {alts.length ? <MatchTable rows={alts.slice(0, 8)} today={today} alt /> : <Empty title="No other sizes on this rim" />}
            </div>
          </div>
        )}
      </Panel>
      <div className="section-gap" />
    </>
  );
}

function MatchTable({ rows, today, alt }: { rows: SizeMatch[]; today: string; alt?: boolean }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const def = config.collections.find((c) => c.key === 'stock')!;
  return (
    <div className="table-wrap">
      <table className="table" data-testid={alt ? 'size-alternatives' : 'size-exact'}>
        <thead><tr><th>Tyre</th>{alt && <th className="num">Diameter</th>}<th className="num">DOT age</th><th className="num">Qty</th><th className="num">Sell</th></tr></thead>
        <tbody>
          {rows.map(({ stock: s, diff, fits }) => (
            <tr key={s.id}>
              <td>
                <Link to={`${base}/stock/${s.id}`}><strong>{label(BRANDS, str(s, 'brand'))} {str(s, 'pattern')}</strong></Link>
                <small>{str(s, 'size')} {str(s, 'loadIndex')}{str(s, 'speedRating')} · bin {str(s, 'bin')}</small>
                <Flags flags={def.flags?.(s, data, today) ?? []} />
              </td>
              {alt && <td className="num">{diff > 0 ? '+' : ''}{diff}% {fits ? <Tag tone="green">Possible</Tag> : <Tag tone="dark">Too far</Tag>}</td>}
              <td className="num">{dotAgeYears(str(s, 'dot'), today) ?? '—'} yrs</td>
              <td className="num">{num(s, 'qty')}</td>
              <td className="num">{formatRand(Math.round(num(s, 'sell') * 100))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
