import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate, monthShort } from '../../../core/lib/dates';
import { BarChart, Empty, Flags, KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { ELEC_TARIFF, WATER_TARIFF } from '../data';
import {
  AGE_BUCKETS, activeLease, consumption, hasFigure, leaseArrears, leaseDeclarations, leaseFlags, monthlyCharges, monthsVacant, periodLabel, plural, rand, randOf, randRound, rentToSales,
  monthlyBaseRent, thousands, todayStr, tradingDensity, usageChange, workOrderFlags,
} from '../helpers';
import { ModButton, RecLink, TenantCard } from './shared';

export default function UnitDetail() {
  const { id } = useParams();
  const data = useData();
  const u = findRecord(data, 'units', id);
  // The unit's status follows its lease, so none of the unit's own steps are offered here.
  return (
    <RecordDetail hideTransitions={['vacant', 'offer', 'fitout', 'let']} aside={u ? <Aside id={u.id} /> : undefined}>
      {u && <Main id={u.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const base = useBase();
  const navigate = useNavigate();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const unit = findRecord(data, 'units', id)!;
  const gla = num(unit, 'gla');
  const lease = activeLease(data, id);
  const leaseDef = config.collections.find((c) => c.key === 'leases')!;
  const woDef = config.collections.find((c) => c.key === 'workorders')!;
  const prospectDef = config.collections.find((c) => c.key === 'prospects')!;
  const [logging, setLogging] = useState(false);
  const jobs = records(data, 'workorders').filter((w) => str(w, 'unit') === id).sort(woDef.sort);
  const readings = records(data, 'readings').filter((r) => str(r, 'unit') === id).sort((a, b) => str(b, 'period').localeCompare(str(a, 'period'))).slice(0, 4);
  const declared = lease ? leaseDeclarations(data, lease.id).filter(hasFigure).slice(-6) : [];
  const applications = records(data, 'leases').filter((l) => str(l, 'unit') === id && l.status === 'application');
  const prospects = records(data, 'prospects').filter((p) => str(p, 'unit') === id && ['enquiry', 'viewing', 'proposal'].includes(p.status ?? ''));
  const charges = monthlyCharges(lease, gla);
  const base$ = lease ? monthlyBaseRent(data, lease) : 0;
  return (
    <>
      {lease ? (
        <Panel title="Lease" meta="The unit’s status follows this lease" right={<StatusTag workflow={leaseDef.workflow} status={lease.status} />}>
          <TenantCard data={data} lease={lease} tag={<Flags flags={leaseFlags(lease, data, today)} />} />
          <div className="mini-stat-row" style={{ marginTop: 14 }}>
            <div>Base rent<b>{randOf(num(lease, 'baseRent'))}/m²</b></div>
            <div>Monthly rent & recoveries<b>{rand(charges.total)}</b></div>
            <div>Escalation<b>{num(lease, 'escalationPct')}% a year</b></div>
            <div>Turnover rent<b>{num(lease, 'turnoverPct') ? `${num(lease, 'turnoverPct')}%` : 'None'}</b></div>
            <div>Lease ends<b>{formatDate(str(lease, 'endDate'))}</b></div>
          </div>
        </Panel>
      ) : (
        <Panel title="Vacancy" meta="What this empty shop is costing, and who is interested" right={<Tag tone="red">Vacant {plural(monthsVacant(unit, today), 'month')}</Tag>}>
          <div className="mini-stat-row">
            <div>Asking rent<b>{randOf(num(unit, 'askingRent'))}/m²</b></div>
            <div>Monthly at asking<b>{randOf(num(unit, 'askingRent') * gla)}</b></div>
            <div>Vacant since<b>{formatDate(str(unit, 'vacantSince'))}</b></div>
            <div>Rent not earned so far<b>{randRound(num(unit, 'askingRent') * gla * monthsVacant(unit, today))}</b></div>
          </div>
          {applications.length + prospects.length ? (
            <ul className="list" style={{ marginTop: 10 }} data-testid="unit-interest">
              {applications.map((l) => <li key={l.id}><span className="dot accent" /><div className="grow"><RecLink module="leases" id={l.id}><b>{str(l, 'tenant')}</b></RecLink><small>{l.ref} · lease application</small></div><Tag tone="accent">Application</Tag></li>)}
              {prospects.map((p) => <li key={p.id}><span className="dot blue" /><div className="grow"><RecLink module="pipeline" id={p.id}><b>{str(p, 'name')}</b></RecLink><small>{p.ref} · {str(p, 'contact')}</small></div><StatusTag workflow={prospectDef.workflow} status={p.status} /></li>)}
            </ul>
          ) : <div style={{ marginTop: 12 }}><Notice tone="grey">No prospects or applications for this unit yet. Add one under <RecLink module="pipeline">Leasing pipeline & vacancies</RecLink>.</Notice></div>}
        </Panel>
      )}
      {lease && num(lease, 'turnoverPct') > 0 && (
        <Panel title="Turnover trend" meta="Declared monthly turnover, typed in from the tenant’s declarations" right={<ModButton module="turnover">Declarations</ModButton>}>
          {declared.length ? (
            <>
              <BarChart label={`Declared turnover for ${str(lease, 'tenant')}`} format={(n) => randRound(n)} data={declared.map((d) => ({ label: monthShort(str(d, 'period')), value: num(d, 'amount') }))} />
              <p className="muted-note" style={{ marginTop: 8 }}>
                Latest: {randRound(num(declared[declared.length - 1], 'amount'))} in {periodLabel(str(declared[declared.length - 1], 'period'))} · trading density {randRound(tradingDensity(num(declared[declared.length - 1], 'amount'), gla))}/m² · rent is {rentToSales(base$, num(declared[declared.length - 1], 'amount'))}% of sales.
              </p>
            </>
          ) : <Empty title="No turnover declared yet" />}
        </Panel>
      )}
      <Panel title="Maintenance" meta="Tenant requests and landlord jobs in this unit"
        right={can('maintenance') ? <button className="btn sm" onClick={() => setLogging(true)} data-testid="log-maintenance"><IcoPlus /> Log request</button> : undefined}>
        {jobs.length ? (
          <ul className="list">
            {jobs.slice(0, 6).map((w) => (
              <li key={w.id} style={{ flexWrap: 'wrap' }}>
                <span className="time-chip">{formatDate(str(w, 'reportedOn')).slice(0, 6)}</span>
                <div className="grow" style={{ minWidth: 150 }}><RecLink module="workorders" id={w.id}><b>{str(w, 'title')}</b></RecLink><small>{w.ref}{str(w, 'contractor') ? ` · ${str(w, 'contractor')}` : ''}</small></div>
                <Flags flags={workOrderFlags(w, today)} />
                <StatusTag workflow={woDef.workflow} status={w.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No work orders for this unit" />}
      </Panel>
      <Panel title="Meter readings" meta={`Sub-meters read monthly · demo tariffs ${randOf(ELEC_TARIFF)}/kWh and ${randOf(WATER_TARIFF)}/kL`} right={<ModButton module="meters">Utilities metering</ModButton>}>
        {readings.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Month</th><th className="num">Electricity</th><th className="num">Used</th>{unit.values.waterMeter === true && <><th className="num">Water</th><th className="num">Used</th></>}<th>Change</th></tr></thead>
              <tbody>
                {readings.map((r) => {
                  const used = consumption(data, r);
                  const change = usageChange(data, r);
                  return (
                    <tr key={r.id}>
                      <td><RecLink module="meters" id={r.id}><strong>{periodLabel(str(r, 'period'))}</strong></RecLink></td>
                      <td className="num">{thousands(num(r, 'elec'))} kWh</td><td className="num">{used ? `${thousands(used.elec)} kWh` : '—'}</td>
                      {unit.values.waterMeter === true && <><td className="num">{thousands(num(r, 'water'))} kL</td><td className="num">{used ? `${thousands(used.water)} kL` : '—'}</td></>}
                      <td>{change === null ? '—' : <Tag tone={Math.abs(change) > 40 ? 'amber' : 'dark'}>{change > 0 ? '+' : ''}{change}%</Tag>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No readings yet" body="Readings start once a tenant is trading in the unit." />}
      </Panel>
      {logging && (
        <RecordFormModal def={woDef} open title={`Maintenance request · ${str(unit, 'shop')}`} initial={{ ...woDef.createDefaults?.(today, data), unit: id, reportedBy: lease ? `${str(lease, 'contact') || 'Store manager'} (tenant)` : '' }}
          onClose={() => setLogging(false)}
          onSave={(v) => {
            const w = act.create('workorders', v, 'logged', 'Maintenance request logged');
            act.toast(`Work order ${w.ref} logged`);
            setLogging(false);
            if (hasModule('workorders')) navigate(`${base}/workorders/${w.id}`);
          }} />
      )}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const lease = activeLease(data, id);
  const a = lease ? leaseArrears(data, lease.id, today) : null;
  return (
    <>
      <Panel title="Arrears" right={a && a.overdue > 0 ? <Tag tone="red">{rand(a.overdue)} overdue</Tag> : <Tag tone="green">None</Tag>}>
        {a && a.total > 0 ? (
          <>
            <KeyValues items={[{ label: 'Not yet due', value: rand(a.current) }, ...AGE_BUCKETS.map((b) => ({ label: b.label, value: rand(a[b.key]) }))]} />
            {a.overdue > 0 && <p className="muted-note" style={{ marginTop: 10 }}>Oldest invoice {a.oldest} days overdue. Follow-up is logged under <RecLink module="arrears">Arrears & credit control</RecLink>. Interest is not calculated in this demo.</p>}
          </>
        ) : <p className="muted-note">{lease ? 'This tenant’s account is paid up.' : 'No tenant in this unit.'}</p>}
      </Panel>
      <Panel title="How this unit changes status">
        <p className="muted-note">Nobody sets a unit to “let” by hand. It becomes <b>under offer</b> when heads of terms are agreed, <b>fit-out</b> when the signed lease is handed over, <b>let</b> when the shop starts trading and <b>vacant</b> when the tenant leaves — all from the lease.</p>
      </Panel>
    </>
  );
}
