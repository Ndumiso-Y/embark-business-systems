import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { Field, KeyValues, Meters, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { OUTCOMES, SIGNALS, label } from '../data';
import {
  calloutSla, contractOfSite, duration, elapsedMinutes, equipmentLabel, minutesFromTo, onSceneProblem, rec, responseMinutes, siteName, slaState,
  standDownProblem, vehicleProblem,
} from '../helpers';
import { useClock } from './format';

export default function CalloutDetail() {
  const { id } = useParams();
  const data = useData();
  const r = rec(data, 'callouts', id);
  return (
    <RecordDetail backLabel="Armed response" aside={r ? <Aside callout={r} /> : undefined}>
      {r && <Response callout={r} />}
    </RecordDetail>
  );
}

function Response({ callout: c }: { callout: DemoRecord }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const { today, time } = useClock();
  const [vehicle, setVehicle] = useState('');
  const [at, setAt] = useState('');
  const [outcome, setOutcome] = useState(str(c, 'outcome'));
  const [notes, setNotes] = useState(str(c, 'notes'));
  const s = slaState(data, c, today, time);
  const vehicles = records(data, 'equipment').filter((e) => str(e, 'category') === 'vehicle' && e.values.response === true);
  const t = at || time;
  const step = (to: string, values: Record<string, string>, problem: string | null, done: string) => {
    if (problem) { act.toast(problem, 'err'); return; }
    act.update('callouts', c.id, values);
    const res = act.transition('callouts', c.id, to);
    if (!res.ok) { act.toast(res.reason, 'err'); return; }
    setAt('');
    act.toast(done);
  };
  const received = str(c, 'receivedAt');
  const mark = (lbl: string, value: string, sub?: string) => (
    <li><span className="time-chip">{value || '—'}</span><div className="grow"><b>{lbl}</b>{sub && <small>{sub}</small>}</div></li>
  );
  const resp = responseMinutes(c);
  return (
    <>
      <Panel title="Response timeline" meta={`SLA: on scene within ${s.sla} minutes of the signal (demo rule from the client contract)`}
        right={<Tag tone={s.state === 'breached' ? 'red' : s.state === 'met' ? 'green' : s.state === 'running' ? 'amber' : 'dark'}>{s.state === 'met' ? `${s.minutes} min — within SLA` : s.state === 'breached' ? (resp !== null ? `${s.minutes} min — over SLA` : `SLA breached — ${duration(s.minutes)}`) : s.state === 'running' ? `${s.minutes} of ${s.sla} min` : 'No response time'}</Tag>}>
        <ul className="list" data-testid="callout-timeline">
          {mark('Signal received', received, `${label(SIGNALS, str(c, 'signal'))}${str(c, 'zone') ? ` · ${str(c, 'zone')}` : ''}`)}
          {mark('Vehicle dispatched', str(c, 'dispatchedAt'), str(c, 'dispatchedAt') ? `${minutesFromTo(received, str(c, 'dispatchedAt'))} min after the signal · ${equipmentLabel(rec(data, 'equipment', c.values.vehicle))}` : undefined)}
          {mark('On scene', str(c, 'onSceneAt'), resp !== null ? `Response time ${duration(resp)}` : undefined)}
          {mark('Stood down', str(c, 'stoodDownAt'), str(c, 'outcome') ? label(OUTCOMES, str(c, 'outcome')) : undefined)}
        </ul>
        {(s.state === 'running' || s.state === 'breached' || s.state === 'met') && (
          <Meters format={(n) => `${n} min`} items={[{ label: resp !== null ? 'Response time vs SLA' : 'Elapsed vs SLA', value: Math.min(s.minutes, s.sla * 3), max: s.sla, tone: s.state === 'breached' ? 'red' : s.state === 'met' ? 'green' : 'amber' }]} />
        )}
      </Panel>
      {can('callouts.dispatch') && c.status === 'received' && (
        <Panel title="Dispatch a vehicle" meta="Vehicles in repair, unlicensed or already committed are refused">
          <div className="form-grid">
            <Field label="Response vehicle">
              <select className="select" aria-label="Response vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                <option value="">Select vehicle…</option>
                {vehicles.map((v) => {
                  const p = vehicleProblem(data, v.id, c.id, today);
                  return <option key={v.id} value={v.id}>{str(v, 'assetNo')} · {str(v, 'description').split(' (')[0]}{p ? ' — not available' : ' — available'}</option>;
                })}
              </select>
            </Field>
            <Field label="Dispatch time" hint="Defaults to now.">
              <input className="input" type="time" aria-label="Dispatch time" value={t} onChange={(e) => setAt(e.target.value)} />
            </Field>
          </div>
          {vehicle && vehicleProblem(data, vehicle, c.id, today) && <Notice tone="amber">{vehicleProblem(data, vehicle, c.id, today)}</Notice>}
          <div className="btns" style={{ marginTop: 12 }}>
            <button className="btn primary" data-testid="dispatch" onClick={() => step('dispatched', { vehicle, dispatchedAt: t },
              vehicleProblem(data, vehicle, c.id, today) ?? (minutesFromTo(received, t) < 0 ? `Dispatch time ${t} is before the signal was received (${received}).` : null), `${c.ref}: vehicle dispatched at ${t}`)}>Dispatch</button>
          </div>
        </Panel>
      )}
      {can('callouts.dispatch') && c.status === 'dispatched' && (
        <Panel title="Arrival on scene" meta={`${duration(elapsedMinutes(c, today, time))} since the signal`}>
          <div className="form-grid">
            <Field label="On-scene time" hint="Defaults to now. Must not be before the dispatch time.">
              <input className="input" type="time" aria-label="On-scene time" value={t} onChange={(e) => setAt(e.target.value)} />
            </Field>
          </div>
          <div className="btns" style={{ marginTop: 12 }}>
            <button className="btn primary" data-testid="on-scene" onClick={() => step('onscene', { onSceneAt: t }, onSceneProblem({ ...c, values: { ...c.values, onSceneAt: t } }, time), `${c.ref}: on scene at ${t}`)}>Mark on scene</button>
          </div>
        </Panel>
      )}
      {can('callouts.dispatch') && c.status === 'onscene' && (
        <Panel title="Stand down" meta="Record what the response officer found">
          <div className="form-grid">
            <Field label="Outcome">
              <select className="select" aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="">Select outcome…</option>
                {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Stand-down time" hint="Defaults to now.">
              <input className="input" type="time" aria-label="Stand-down time" value={t} onChange={(e) => setAt(e.target.value)} />
            </Field>
            <div className="span-2">
              <Field label="Response report"><textarea className="textarea" aria-label="Response report" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Premises checked, keyholder met, findings" /></Field>
            </div>
          </div>
          <div className="btns" style={{ marginTop: 12 }}>
            <button className="btn primary" data-testid="stand-down" onClick={() => step('stooddown', { outcome, notes, stoodDownAt: t }, standDownProblem({ ...c, values: { ...c.values, outcome, stoodDownAt: t } }, time), `${c.ref}: vehicle stood down`)}>Stand down</button>
          </div>
        </Panel>
      )}
    </>
  );
}

function Aside({ callout: c }: { callout: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { can, hasModule } = useUser();
  const { today, time } = useClock();
  const site = rec(data, 'sites', c.values.site);
  const contract = contractOfSite(data, c.values.site);
  const raise = () => {
    const r = act.create('incidents', {
      site: str(c, 'site'), date: str(c, 'date') || today, time: str(c, 'receivedAt') || time, type: 'breakin', severity: 'medium',
      title: `${label(SIGNALS, str(c, 'signal'))} call-out ${c.ref}`, description: `Raised from armed response call-out ${c.ref}. ${str(c, 'notes')}`.trim(), reportedBy: 'Armed response officer',
    }, 'reported', `Incident raised from ${c.ref}`);
    act.toast(`Incident ${r.ref} raised from ${c.ref}`);
    navigate(`${base}/incidents/${r.id}`);
  };
  return (
    <Panel title="Site & contract" meta={`SLA ${calloutSla(data, c)} minutes`}>
      <KeyValues items={[
        { label: 'Site', value: hasModule('sites') && site ? <Link to={`${base}/sites/${site.id}`}>{str(site, 'name')}</Link> : siteName(data, c.values.site) },
        { label: 'Area', value: str(site, 'area') },
        { label: 'Client', value: str(contract, 'client') },
        { label: 'Keyholder (fictional)', value: str(site, 'keyholder'), wide: true },
      ]} />
      {can('incidents.manage') && c.status !== 'cancelled' && (
        <div className="btns" style={{ marginTop: 12 }}><button className="btn sm" onClick={raise}>Raise an incident from this call-out</button></div>
      )}
      <p className="muted-note" style={{ marginTop: 12 }}>No vehicle tracking or alarm panel is connected — times are typed in by the control room.</p>
    </Panel>
  );
}
