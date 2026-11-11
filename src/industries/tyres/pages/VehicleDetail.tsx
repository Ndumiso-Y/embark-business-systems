import { useParams } from 'react-router-dom';
import { useData } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, Meters, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { useIndustry } from '../../../core/context';
import { BRANDS, POSITIONS, ROTATION_KM, label } from '../data';
import { kmText, rotationDue, servicesText, torqueSpec, treadOf, treadTone, wk } from '../helpers';
import { RecordLink, TONE_COLOURS, VehicleCard, WheelDiagram } from './shared';

export default function VehicleDetail() {
  const { id } = useParams();
  const data = useData();
  const v = findRecord(data, 'vehicles', id);
  return (
    <RecordDetail aside={v ? <Aside id={v.id} /> : undefined}>
      {v && <History id={v.id} />}
    </RecordDetail>
  );
}

function History({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const v = findRecord(data, 'vehicles', id)!;
  const wf = config.collections.find((c) => c.key === 'jobs')!.workflow;
  const jobs = records(data, 'jobs').filter((j) => str(j, 'vehicle') === v.id).sort((a, b) => (str(b, 'workDate') + str(b, 'arrivedAt')).localeCompare(str(a, 'workDate') + str(a, 'arrivedAt')));
  const latest = jobs.find((j) => POSITIONS.every((p) => treadOf(j, p.key) !== null));
  const cell = (j: (typeof jobs)[number], pos: (typeof POSITIONS)[number]['key']) => {
    const t = treadOf(j, pos);
    const replaced = j.values[wk(pos, 'replace')] === true && ['fitting', 'balancing', 'alignment', 'torque', 'ready', 'collected'].includes(j.status ?? '');
    const st = findRecord(data, 'stock', str(j, 'tyreStock'));
    return (
      <td key={pos}>
        {t === null ? '—' : <span style={{ fontWeight: 700, color: TONE_COLOURS[treadTone(t)] === TONE_COLOURS.green ? 'var(--ink-2)' : TONE_COLOURS[treadTone(t)] }}>{t.toFixed(1)} mm</span>}
        {replaced && <small style={{ display: 'block', color: 'var(--accent-text)', fontWeight: 700 }}>→ new {st ? label(BRANDS, str(st, 'brand')) : 'tyre'}</small>}
        {j.values[wk(pos, 'torque')] !== undefined && j.values[wk(pos, 'torque')] !== '' && <small style={{ display: 'block', color: 'var(--muted-2)' }}>{String(j.values[wk(pos, 'torque')])} Nm</small>}
      </td>
    );
  };
  return (
    <>
      <Panel title="Latest wheel inspection" meta={latest ? `${latest.ref} · ${formatDate(str(latest, 'workDate'))}` : 'No inspection recorded yet'}>
        {latest ? <WheelDiagram values={latest.values} spec={torqueSpec(v)} compact={false} /> : <Empty title="No wheel inspection yet" body="Tread depths appear here after the vehicle’s first fitment job." />}
      </Panel>
      <Panel title="Tyre history per position" meta="Tread at inspection, new tyres fitted and torque values, newest first">
        {jobs.length ? (
          <div className="table-wrap">
            <table className="table" data-testid="tyre-history">
              <thead><tr><th>Job</th>{POSITIONS.map((p) => <th key={p.key}>{p.label}</th>)}<th>Status</th></tr></thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td><RecordLink module="jobs" record={j}><b>{formatDate(str(j, 'workDate'))}</b></RecordLink><small>{j.ref} · {servicesText(j)}{str(j, 'odometer') ? ` · ${kmText(num(j, 'odometer'))}` : ''}</small></td>
                    {POSITIONS.map((p) => cell(j, p.key))}
                    <td><StatusTag workflow={wf} status={j.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No jobs for this vehicle yet" />}
      </Panel>
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const v = findRecord(data, 'vehicles', id)!;
  const rot = rotationDue(v);
  return (
    <>
      <Panel title="Vehicle & owner"><VehicleCard data={data} vehicleId={v.id} /></Panel>
      <Panel title="Rotation" meta={`Demo rule: every ${kmText(ROTATION_KM)}`} right={rot.due ? <Tag tone="amber">Due</Tag> : <Tag tone="green">OK</Tag>}>
        <Meters format={(n) => kmText(n)} items={[{ label: 'Since last rotation', value: Math.max(0, rot.since), max: ROTATION_KM, tone: rot.due ? 'red' : rot.since > ROTATION_KM * 0.8 ? 'amber' : 'green', sub: `Last rotated at ${kmText(num(v, 'lastRotationKm'))}` }]} />
      </Panel>
    </>
  );
}
