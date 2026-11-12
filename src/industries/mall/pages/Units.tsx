import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { Empty, PageHeader, Panel, Segmented, Stat, StatusTag, Tag } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { CATEGORIES, CATEGORY_COLOURS, LEVELS, STATUS_COLOURS, UNIT_STATES, label } from '../data';
import { activeLease, leaseArrears, monthsVacant, occupancy, plural, rand, randOf, shopLabel, thousands, todayStr } from '../helpers';
import { MallStyles, RecLink } from './shared';

type Mode = 'status' | 'category';
type Filter = 'all' | 'vacant' | 'offer' | 'fitout' | 'let';

/** The stacking plan: every unit by level, coloured by status or category, sized roughly by GLA. */
export default function Units() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const base = useBase();
  const navigate = useNavigate();
  const { can } = useUser();
  const today = todayStr();
  const def = act.def('units');
  const units = useMemo(() => [...records(data, 'units')].sort(def.sort), [data, def]);
  const occ = occupancy(units);
  const [mode, setMode] = useState<Mode>('status');
  const [picked, setPicked] = useState<string>('');
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const sel = units.find((u) => u.id === picked);
  const fill = (u: DemoRecord) => (mode === 'status' ? STATUS_COLOURS[u.status ?? 'vacant'] : u.status === 'vacant' ? '#fff' : CATEGORY_COLOURS[str(u, 'category')] ?? '#eee');
  const rows = units.filter((u) => filter === 'all' || u.status === filter);

  return (
    <>
      <MallStyles />
      <PageHeader kicker={`${config.businessName} / Leasing`} title="Shops & stacking plan" subtitle="Every unit by level. A unit’s status is never typed in — it follows its lease: under offer at heads of terms, fit-out at hand-over, let when the shop starts trading."
        actions={can('leases.manage') ? <button className="btn primary" onClick={() => setCreating(true)} data-testid="new-record"><IcoPlus /> New unit</button> : undefined} />
      <div className="stat-grid">
        <Stat label="Occupancy by GLA" value={`${occ.pct}%`} tone="accent" sub={`${thousands(occ.occupied)} of ${thousands(occ.gla)} m² let or fitting out`} />
        <Stat label="Vacant units" value={occ.vacantUnits} tone={occ.vacantUnits ? 'red' : undefined} sub={`${thousands(units.filter((u) => u.status === 'vacant').reduce((n, u) => n + num(u, 'gla'), 0))} m² with no tenant`} />
        <Stat label="Under offer" value={occ.offerUnits} sub="heads of terms agreed or lease signed" />
        <Stat label="In fit-out" value={occ.fitoutUnits} sub={`${occ.letUnits} shops trading`} />
      </div>
      <Panel title="Stacking plan" meta="Click a shop for its tenant, lease and what is outstanding" right={<Segmented label="Colour by" value={mode} onChange={setMode} options={[{ value: 'status', label: 'By status' }, { value: 'category', label: 'By category' }]} />}>
        <div className="mall-legend" data-testid="plan-legend">
          {mode === 'status'
            ? Object.entries(UNIT_STATES).map(([k, l]) => <span key={k}><i style={{ background: STATUS_COLOURS[k] }} />{l} ({units.filter((u) => u.status === k).length})</span>)
            : <>{CATEGORIES.filter((c) => units.some((u) => str(u, 'category') === c.value)).map((c) => <span key={c.value}><i style={{ background: CATEGORY_COLOURS[c.value] }} />{c.label}</span>)}<span><i style={{ background: '#fff', borderStyle: 'dashed' }} />Vacant</span></>}
        </div>
        {sel ? <UnitSummary unit={sel} today={today} /> : <p className="muted-note" style={{ marginBottom: 12 }} data-testid="unit-summary">No shop selected. Vacant shops have a dashed border — click one to see who is interested in it.</p>}
        <div data-testid="stacking-plan">
          {LEVELS.map((lv) => {
            const list = units.filter((u) => str(u, 'level') === lv.value);
            if (!list.length) return null;
            const o = occupancy(list);
            return (
              <div className="mall-level" key={lv.value}>
                <h3>{lv.label}<small>{plural(list.length, 'unit')} · {thousands(o.gla)} m² · {o.pct}% occupied</small></h3>
                <div className="mall-plan">
                  {list.map((u) => {
                    const lease = activeLease(data, u.id);
                    const gla = num(u, 'gla');
                    return (
                      <button key={u.id} type="button" className={`mall-unit ${u.status === 'vacant' ? 'vacant' : ''} ${picked === u.id ? 'selected' : ''}`} data-testid={`plan-${str(u, 'shop')}`} data-status={u.status}
                        style={{ background: fill(u), flexGrow: Math.max(1, Math.round(Math.sqrt(gla) / 4)), flexBasis: Math.round(64 + Math.sqrt(gla) * 2) }}
                        aria-pressed={picked === u.id} aria-label={`${shopLabel(u)}, ${UNIT_STATES[u.status ?? 'vacant']}${lease ? `, ${str(lease, 'tenant')}` : ''}, ${gla} square metres`}
                        onClick={() => setPicked(u.id)} onDoubleClick={() => navigate(`${base}/units/${u.id}`)}>
                        <b>{str(u, 'shop')}</b>
                        <span>{lease ? str(lease, 'tenant') : 'Vacant'}</span>
                        <small>{thousands(gla)} m²{u.status !== 'let' && u.status !== 'vacant' ? ` · ${UNIT_STATES[u.status ?? '']}` : ''}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <div className="section-gap" />
      <Panel title="Unit register" meta={`${rows.length} of ${units.length} units`} right={
        <Segmented label="Filter units" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'vacant', label: 'Vacant' }, { value: 'offer', label: 'Under offer' }, { value: 'fitout', label: 'Fit-out' }, { value: 'let', label: 'Let' }]} />}>
        {rows.length ? <RecordTable def={def} rows={rows} moduleKey="units" extra={{ head: 'Arrears', cell: (u) => { const l = activeLease(data, u.id); const a = l ? leaseArrears(data, l.id, today).overdue : 0; return a > 0 ? <Tag tone="red">{rand(a)}</Tag> : '—'; } }} /> : <Empty title="No units in this state" />}
      </Panel>
      {creating && (
        <RecordFormModal def={def} open initial={def.createDefaults?.(today, data)} onClose={() => setCreating(false)} onSave={(v) => {
          const r = act.create('units', v, 'vacant');
          act.toast(`${shopLabel(r)} added as a vacant unit`);
          setCreating(false);
          navigate(`${base}/units/${r.id}`);
        }} />
      )}
    </>
  );
}

function UnitSummary({ unit, today }: { unit: DemoRecord; today: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const lease = activeLease(data, unit.id);
  const unitDef = config.collections.find((c) => c.key === 'units')!;
  const leaseDef = config.collections.find((c) => c.key === 'leases')!;
  const applications = records(data, 'leases').filter((l) => str(l, 'unit') === unit.id && l.status === 'application');
  const prospects = records(data, 'prospects').filter((p) => str(p, 'unit') === unit.id && ['enquiry', 'viewing', 'proposal'].includes(p.status ?? ''));
  const arrears = lease ? leaseArrears(data, lease.id, today).overdue : 0;
  return (
    <div className="notice accent" style={{ marginBottom: 14 }} data-testid="unit-summary">
      <div style={{ width: '100%' }}>
        <div className="btns" style={{ flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <b>{shopLabel(unit)}</b>
          <StatusTag workflow={unitDef.workflow} status={unit.status} />
          <span>{label(LEVELS, str(unit, 'level'))} · {thousands(num(unit, 'gla'))} m² · {label(CATEGORIES, str(unit, 'category'))}</span>
          <Link className="btn sm" to={`${base}/units/${unit.id}`} data-testid="open-unit">Open unit</Link>
        </div>
        {lease ? (
          <p style={{ margin: '8px 0 0' }}>
            <RecLink module="leases" id={lease.id}><b>{str(lease, 'tenant')}</b></RecLink> · {lease.ref} · <StatusTag workflow={leaseDef.workflow} status={lease.status} /> · base rent {randOf(num(lease, 'baseRent'))}/m²
            {arrears > 0 && <> · <Tag tone="red">Arrears {rand(arrears)}</Tag></>}
          </p>
        ) : (
          <p style={{ margin: '8px 0 0' }}>
            Vacant for {plural(monthsVacant(unit, today), 'month')} · asking {randOf(num(unit, 'askingRent'))}/m² ({randOf(num(unit, 'askingRent') * num(unit, 'gla'))} a month).
            {' '}{applications.length ? '' : prospects.length ? `${plural(prospects.length, 'prospect')} interested — see the leasing pipeline.` : 'No prospects yet.'}
          </p>
        )}
        {applications.map((l) => (
          <p key={l.id} style={{ margin: '8px 0 0' }}>
            Application from <b>{str(l, 'tenant')}</b> ({l.ref}) — <RecLink module="leases" id={l.id}><span data-testid="open-application">Open the lease application →</span></RecLink>
          </p>
        ))}
      </div>
    </div>
  );
}
