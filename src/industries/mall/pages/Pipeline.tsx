import { Link } from 'react-router-dom';
import { useBase, useData, useIndustry } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Meters, Panel, Stat, StatusTag, Tag } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { CATEGORIES, LEVELS, label } from '../data';
import { activeLease, monthsVacant, occupancy, plural, randOf, randRound, shopLabel, tenantMix, thousands, todayStr } from '../helpers';
import { RecLink } from './shared';

/** Prospects board with the vacancy list and tenant mix above it. */
export default function Pipeline() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const today = todayStr();
  const unitDef = config.collections.find((c) => c.key === 'units')!;
  const units = records(data, 'units');
  const open = units.filter((u) => u.status === 'vacant' || u.status === 'offer').sort((a, b) => monthsVacant(b, today) - monthsVacant(a, today));
  const prospects = records(data, 'prospects').filter((p) => ['enquiry', 'viewing', 'proposal'].includes(p.status ?? ''));
  const applications = records(data, 'leases').filter((l) => l.status === 'application');
  const lost = open.filter((u) => u.status === 'vacant').reduce((n, u) => n + num(u, 'askingRent') * num(u, 'gla'), 0);
  const mix = tenantMix(data);
  const occ = occupancy(units);
  const half = Math.ceil(mix.length / 2);
  const top = Math.max(1, ...mix.map((m) => m.pct));
  return (
    <RegisterPage>
      <div className="stat-grid">
        <Stat label="Vacant GLA" value={`${thousands(units.filter((u) => u.status === 'vacant').reduce((n, u) => n + num(u, 'gla'), 0))} m²`} tone="red" sub={`${plural(occ.vacantUnits, 'unit')} with no tenant · ${occ.offerUnits} under offer`} />
        <Stat label="Rent not earned each month" value={randRound(lost)} sub="vacant units at their asking rent" />
        <Stat label="Open prospects" value={prospects.length} tone="accent" sub={`${prospects.filter((p) => p.status === 'proposal').length} with a proposal out`} />
        <Stat label="Lease applications" value={applications.length} sub="waiting for heads of terms" />
      </div>
      <Panel title="Vacancy list" meta="Longest vacant first · asking rent excl. VAT">
          {open.length ? (
            <div className="table-wrap">
              <table className="table" data-testid="vacancy-list">
                <thead><tr><th>Unit</th><th className="num">GLA</th><th className="num">Months vacant</th><th className="num">Asking / m²</th><th className="num">Monthly</th><th>Interest</th><th>Status</th></tr></thead>
                <tbody>
                  {open.map((u) => {
                    const held = activeLease(data, u.id);
                    const interested = prospects.filter((p) => str(p, 'unit') === u.id).length;
                    const apps = applications.filter((l) => str(l, 'unit') === u.id);
                    return (
                      <tr key={u.id}>
                        <td><Link to={`${base}/units/${u.id}`}><strong>{shopLabel(u)}</strong></Link><small>{label(LEVELS, str(u, 'level'))} · {label(CATEGORIES, str(u, 'category'))}</small></td>
                        <td className="num">{thousands(num(u, 'gla'))} m²</td>
                        <td className="num">{monthsVacant(u, today)}<small>since {formatDate(str(u, 'vacantSince'))}</small></td>
                        <td className="num">{randOf(num(u, 'askingRent'))}</td>
                        <td className="num">{randRound(num(u, 'askingRent') * num(u, 'gla'))}</td>
                        <td>{held ? <RecLink module="leases" id={held.id}>{str(held, 'tenant')}</RecLink> : apps.length ? <RecLink module="leases" id={apps[0].id}>{str(apps[0], 'tenant')} (application)</RecLink> : interested ? plural(interested, 'prospect') : <Tag tone="red">None</Tag>}</td>
                        <td><StatusTag workflow={unitDef.workflow} status={u.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty title="No vacancies" body="Every unit is let or fitting out." />}
      </Panel>
      <div className="section-gap" />
      <Panel title="Tenant mix" meta="Share of let GLA by category — what a new letting would add to or dilute">
        <div className="grid-2-even" style={{ marginBottom: 0 }}>
          <Meters items={mix.slice(0, half).map((m) => ({ label: m.label, value: m.pct, max: top, sub: `${thousands(m.gla)} m² · ${plural(m.units, 'unit')}` }))} format={(n) => `${n}%`} />
          <Meters items={mix.slice(half).map((m) => ({ label: m.label, value: m.pct, max: top, sub: `${thousands(m.gla)} m² · ${plural(m.units, 'unit')}` }))} format={(n) => `${n}%`} />
        </div>
      </Panel>
      <div className="section-gap" />
    </RegisterPage>
  );
}
