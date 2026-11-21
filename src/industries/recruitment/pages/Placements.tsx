import { useMemo, useState } from 'react';
import { useData, useIndustry, useUser } from '../../../core/context';
import { addDays, daysBetween } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { IcoSearch } from '../../../core/components/Icons';
import { PageHeader, Panel, Stat } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { num, records, searchText, str } from '../../../core/engine';
import { monthRange, rand, todayStr } from '../helpers';

/** Placement register. Placements are created by an accepted offer, never typed in. */
export default function Placements() {
  const config = useIndustry();
  const data = useData();
  const { can } = useUser();
  const today = todayStr();
  const [q, setQ] = useState('');
  const def = config.collections.find((c) => c.key === 'placements')!;
  const all = records(data, 'placements');
  const { from, to } = monthRange(today);
  const month = all.filter((p) => str(p, 'acceptedOn') >= from && str(p, 'acceptedOn') <= to);
  const inGuarantee = all.filter((p) => p.status === 'started');
  const ending = inGuarantee.filter((p) => daysBetween(today, str(p, 'guaranteeEnd')) <= 14);
  const fellOff = all.filter((p) => p.status === 'felloff' && str(p, 'fellOffOn') >= addDays(today, -365));
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...all].sort(def.sort).filter((r) => !needle || searchText(def, r, data).includes(needle));
  }, [all, def, data, q]);
  return (
    <>
      <PageHeader kicker={`${config.businessName} / Clients & placements`} title="Placements" subtitle={config.modules.find((m) => m.key === 'placements')!.description} />
      <div className="stat-grid">
        <Stat label="Placed this month" value={month.length} tone="accent" sub={can('fees.view') ? `${rand(month.reduce((n, p) => n + toCents(num(p, 'fee')), 0))} in fees (excl. VAT)` : 'offers accepted this month'} />
        <Stat label="Waiting to start" value={all.filter((p) => p.status === 'accepted').length} sub="offer accepted, not started yet" />
        <Stat label="In guarantee" value={inGuarantee.length} sub={`${ending.length} ending within 14 days`} />
        <Stat label="Fell off · 12 months" value={fellOff.length} tone={fellOff.length ? 'red' : undefined} sub={`of ${all.filter((p) => str(p, 'acceptedOn') >= addDays(today, -365)).length} placements`} />
      </div>
      <Panel title="All placements" meta="Created automatically when a candidate accepts an offer · starting raises the fee invoice">
        <div className="toolbar">
          <label className="search-box"><IcoSearch /><input aria-label="Search placements" placeholder="Search placements" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <span className="toolbar-count">{rows.length} shown</span>
        </div>
        <RecordTable def={def} rows={rows} moduleKey="placements" />
      </Panel>
    </>
  );
}
