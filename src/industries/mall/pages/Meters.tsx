import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, permissionHint, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Notice, PageHeader, Panel, Stat, Tag } from '../../../core/components/ui';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { ELEC_TARIFF, USAGE_REVIEW_PCT, WATER_TARIFF } from '../data';
import {
  consumption, meteredUnits, needsReview, periodLabel, periodOf, plural, prevPeriod, previousReading, randOf, randRound, readingFor, readingProblem, shopLabel, thousands, todayStr, tradingLease,
  usageChange,
} from '../helpers';
import { MallStyles } from './shared';

/** One shop's reading for a month: previous reading, inputs and the "cannot run backwards" rule. */
export function ReadingCapture({ unitId, period }: { unitId: string; period: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const unit = records(data, 'units').find((u) => u.id === unitId)!;
  const shop = str(unit, 'shop');
  const hasWater = unit.values.waterMeter === true;
  const prev = previousReading(data, unitId, period);
  const lastUsed = consumption(data, prev);
  const existing = readingFor(data, unitId, period);
  const [elec, setElec] = useState(existing && num(existing, 'elec') ? String(num(existing, 'elec')) : '');
  const [water, setWater] = useState(existing && num(existing, 'water') ? String(num(existing, 'water')) : '');
  const [err, setErr] = useState('');
  const capture = () => {
    const values = { elec: elec === '' ? '' : Number(elec), water: water === '' ? '' : Number(water) };
    const problem = readingProblem(values, prev, hasWater);
    if (problem) { setErr(problem); act.toast(problem, 'err'); return; }
    setErr('');
    const stored = hasWater ? { elec: Number(elec), water: Number(water), date: today } : { elec: Number(elec), date: today };
    let recId = existing?.id;
    if (recId) act.update('readings', recId, stored);
    else recId = act.create('readings', { unit: unitId, period, ...stored }, 'due', `Reading for ${periodLabel(period)} typed in`).id;
    const res = act.transition('readings', recId, 'captured');
    if (!res.ok) { setErr(res.reason); act.toast(res.reason, 'err'); return; }
    act.toast(`${shopLabel(unit)}: reading captured${prev ? ` — ${thousands(Number(elec) - num(prev, 'elec'))} kWh used` : ' as the opening reading'}`);
  };
  return (
    <li style={{ flexWrap: 'wrap', alignItems: 'flex-end' }} data-testid={`reading-row-${shop}`} data-prev-elec={prev ? num(prev, 'elec') : ''} data-prev-water={prev ? num(prev, 'water') : ''} data-last-used={lastUsed ? lastUsed.elec : ''}>
      <div className="grow" style={{ minWidth: 190 }}>
        <b>{shopLabel(unit)} · {str(tradingLease(data, unitId), 'tenant') || 'No tenant trading'}</b>
        <small>
          {prev ? <>Previous ({periodLabel(str(prev, 'period'))}): {thousands(num(prev, 'elec'))} kWh{hasWater ? ` · ${thousands(num(prev, 'water'))} kL` : ''}{lastUsed ? ` · used ${thousands(lastUsed.elec)} kWh that month` : ''}</> : 'No earlier reading — this will be the opening reading'}
        </small>
        {err && <small className="field-error" role="alert" style={{ color: 'var(--danger)' }}>{err}</small>}
      </div>
      {can('meters') ? (
        <span className="mall-inline">
          <input className="input sm num" type="number" min={0} style={{ width: 120 }} placeholder="kWh" aria-label={`Electricity reading for ${shopLabel(unit)}`} value={elec} onChange={(e) => { setElec(e.target.value); setErr(''); }} data-testid={`elec-${shop}`} />
          {hasWater && <input className="input sm num" type="number" min={0} style={{ width: 100 }} placeholder="kL" aria-label={`Water reading for ${shopLabel(unit)}`} value={water} onChange={(e) => { setWater(e.target.value); setErr(''); }} data-testid={`water-${shop}`} />}
          <button className="btn sm primary" onClick={capture} data-testid={`capture-${shop}`}>Capture</button>
        </span>
      ) : <small className="muted-note">{permissionHint(config, data, 'meters')}</small>}
    </li>
  );
}

/** Monthly sub-meter readings: what is still to capture, and what was captured with its usage. */
export default function Meters() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const base = useBase();
  const navigate = useNavigate();
  const { can, user } = useUser();
  const today = todayStr();
  const period = prevPeriod(periodOf(today));
  const def = act.def('readings');
  const [creating, setCreating] = useState(false);
  const units = meteredUnits(data);
  const rows = units.map((u) => ({ unit: u, reading: readingFor(data, u.id, period) }));
  const waiting = rows.filter((r) => r.reading?.status !== 'captured');
  const captured = rows.filter((r) => r.reading?.status === 'captured');
  const flagged = captured.filter((r) => needsReview(data, r.reading!));
  const recovery = captured.reduce((n, r) => { const c = consumption(data, r.reading); return n + (c ? c.elec * ELEC_TARIFF + (r.unit.values.waterMeter === true ? c.water * WATER_TARIFF : 0) : 0); }, 0);
  const review = (id: string, ref: string) => { act.update('readings', id, { reviewedBy: user.name }, 'Unusual usage reviewed and accepted'); act.toast(`${ref}: usage reviewed`); };
  return (
    <>
      <MallStyles />
      <PageHeader kicker={`${config.businessName} / Operations`} title="Utilities metering" subtitle={`Electricity and water sub-meters are read by hand at month-end. Consumption × the demo tariff goes onto each tenant’s next invoice. Reading month: ${periodLabel(period)}.`}
        actions={can('meters') ? <button className="btn" onClick={() => setCreating(true)} data-testid="new-record"><IcoPlus /> New reading</button> : undefined} />
      <div className="stat-grid">
        <Stat label={`Captured · ${periodLabel(period)}`} value={`${captured.length}/${units.length}`} tone="accent" sub="shops with a tenant trading" />
        <Stat label="Still to capture" value={waiting.length} tone={waiting.length ? 'red' : undefined} sub="their invoices draft without a utilities line" />
        <Stat label="Flagged for review" value={flagged.length} tone={flagged.length ? 'red' : undefined} sub={`usage more than ${USAGE_REVIEW_PCT}% up or down on last month`} />
        <Stat label="Utilities to recover" value={randRound(recovery)} sub={`${randOf(ELEC_TARIFF)}/kWh · ${randOf(WATER_TARIFF)}/kL (demo tariffs, excl. VAT)`} />
      </div>
      <Panel title={`Still to capture — ${periodLabel(period)}`} meta="Type the figure on the meter. A reading below the previous one is refused: a meter cannot run backwards.">
        {waiting.length ? (
          <ul className="list" data-testid="readings-waiting">
            {waiting.map(({ unit }) => <ReadingCapture key={unit.id} unitId={unit.id} period={period} />)}
          </ul>
        ) : <Empty title="All readings are in" body={`Every trading shop has a ${periodLabel(period)} reading.`} />}
        {!can('meters') && waiting.length > 0 && <div style={{ marginTop: 10 }}><Notice tone="grey">{permissionHint(config, data, 'meters')}</Notice></div>}
      </Panel>
      <div className="section-gap" />
      <Panel title={`Captured — ${periodLabel(period)}`} meta={`${plural(captured.length, 'reading')} · usage is this reading less the one before`}>
        {captured.length ? (
          <div className="table-wrap">
            <table className="table" data-testid="readings-captured">
              <thead><tr><th>Shop</th><th className="num">Electricity</th><th className="num">Used</th><th>vs last month</th><th className="num">Water used</th><th className="num">To recover</th><th>Read on</th></tr></thead>
              <tbody>
                {[...flagged, ...captured.filter((r) => !flagged.includes(r))].map(({ unit, reading }) => {
                  const r = reading!;
                  const c = consumption(data, r);
                  const change = usageChange(data, r);
                  const flag = needsReview(data, r);
                  return (
                    <tr key={r.id} data-testid={`captured-${str(unit, 'shop')}`}>
                      <td><Link to={`${base}/meters/${r.id}`}><strong>{shopLabel(unit)}</strong></Link><small>{str(tradingLease(data, unit.id), 'tenant')} · {r.ref}</small></td>
                      <td className="num">{thousands(num(r, 'elec'))} kWh</td>
                      <td className="num">{c ? `${thousands(c.elec)} kWh` : 'opening'}</td>
                      <td>
                        {change === null ? '—' : <Tag tone={flag ? 'amber' : Math.abs(change) > USAGE_REVIEW_PCT ? 'dark' : 'green'}>{change > 0 ? '+' : ''}{change}%{flag ? ' — review' : ''}</Tag>}
                        {flag && can('meters') && <button className="btn xs" style={{ marginLeft: 6 }} onClick={() => review(r.id, r.ref)} data-testid={`review-${str(unit, 'shop')}`}>Mark reviewed</button>}
                        {!flag && str(r, 'reviewedBy') && <small>reviewed by {str(r, 'reviewedBy')}</small>}
                      </td>
                      <td className="num">{unit.values.waterMeter === true ? (c ? `${thousands(c.water)} kL` : 'opening') : '—'}</td>
                      <td className="num">{c ? randOf(c.elec * ELEC_TARIFF + (unit.values.waterMeter === true ? c.water * WATER_TARIFF : 0)) : '—'}</td>
                      <td>{formatDate(str(r, 'date'))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="Nothing captured yet" />}
      </Panel>
      {creating && (
        <RecordFormModal def={def} open initial={def.createDefaults?.(today, data)} onClose={() => setCreating(false)} onSave={(v) => {
          const dup = readingFor(data, String(v.unit), String(v.period));
          if (dup) { act.toast(`${dup.ref} already holds that shop’s reading for ${periodLabel(String(v.period))} — opening it instead`, 'info'); setCreating(false); navigate(`${base}/meters/${dup.id}`); return; }
          const r = act.create('readings', v, 'due');
          act.toast(`${r.ref} opened — type the reading`);
          setCreating(false);
          navigate(`${base}/meters/${r.id}`);
        }} />
      )}
    </>
  );
}
