import { useState } from 'react';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { num, permissionHint, records, str } from '../../../core/engine';
import { addDays, formatDate, parseIso } from '../../../core/lib/dates';
import { BarChart, Empty, Field, PageHeader, Panel, Stat, Tag } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { footfallCompare, logFor, randRound, thousands, todayStr } from '../helpers';
import { MallStyles, ModButton } from './shared';

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The daily centre log: footfall, parking income, trading-hours exceptions and generator runs — typed in. */
export default function Operations() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const def = act.def('opslog');
  const logs = [...records(data, 'opslog')].sort(def.sort);
  const todayLog = logFor(data, today);
  const cmp = footfallCompare(data, today);
  const sumOver = (from: number, to: number, key: string) => logs.filter((l) => str(l, 'date') >= addDays(today, from) && str(l, 'date') <= addDays(today, to)).reduce((n, l) => n + num(l, key), 0);
  const week = sumOver(-7, -1, 'footfall');
  const before = sumOver(-14, -8, 'footfall');
  const chart = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => ({ label: `${DOW[parseIso(d).getDay()]} ${d.slice(8)}`, value: num(logFor(data, d), 'footfall') }));
  const lastWeekSame = num(logFor(data, addDays(today, -7)), 'footfall');

  return (
    <>
      <MallStyles />
      <PageHeader kicker={`${config.businessName} / Operations`} title="Centre operations log" subtitle="One entry a day: footfall from the door counters, parking income, trading-hours exceptions and generator runs. Every figure is typed in — there is no counter or parking-system link."
        actions={<ModButton module="incidents">Incidents</ModButton>} />
      <div className="stat-grid">
        <Stat label={cmp ? `Footfall · ${cmp.isToday ? 'today' : formatDate(cmp.date)}` : 'Footfall'} value={cmp ? thousands(cmp.footfall) : '—'} tone="accent"
          change={cmp && cmp.changePct !== null ? <Tag tone={cmp.changePct >= 0 ? 'green' : 'red'}>{cmp.changePct >= 0 ? '+' : ''}{cmp.changePct}%</Tag> : undefined}
          sub={cmp ? `vs ${thousands(cmp.lastWeek)} the ${WEEKDAY[parseIso(cmp.date).getDay()]} before${cmp.isToday ? '' : ' · today not captured yet'}` : 'no log entries yet'} />
        <Stat label="Footfall · last 7 days" value={thousands(week)} sub={before ? `${week >= before ? '+' : ''}${Math.round(((week - before) / before) * 100)}% on the 7 days before` : ''} />
        <Stat label="Parking income · last 7 days" value={randRound(sumOver(-7, -1, 'parkingIncome'))} sub="typed from the parking cash-up" />
        <Stat label="Generator run · last 30 days" value={`${sumOver(-30, 0, 'generatorHours')} h`} sub={`${logs.filter((l) => str(l, 'hoursException') && str(l, 'date') >= addDays(today, -30)).length} days with a trading-hours exception`} />
      </div>
      <div className="grid-2-even">
        <Panel title={`Today’s log — ${formatDate(today)}`} meta={todayLog ? `${todayLog.ref} · change a figure and save again` : 'Not captured yet — the count is usually typed in at close of trade'} right={todayLog ? <Tag tone="green">Captured</Tag> : <Tag tone="amber">To capture</Tag>}>
          <TodayForm key={todayLog?.id ?? 'new'} hint={lastWeekSame ? `Last ${WEEKDAY[parseIso(today).getDay()]}: ${thousands(lastWeekSame)}` : undefined} />
          {!can('ops.log') && <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'ops.log')}</p>}
        </Panel>
        <Panel title="Footfall — last 14 days" meta="Typed daily counts; a gap means the day is not captured">
          <div className="mall-dense"><BarChart label="Footfall per day for the last 14 days" data={chart} format={(n) => thousands(n)} /></div>
        </Panel>
      </div>
      <Panel title="Daily log" meta={`${logs.length} entries · newest first`}>
        {logs.length ? <RecordTable def={def} rows={logs} moduleKey="ops" /> : <Empty title="No log entries yet" />}
      </Panel>
    </>
  );
}

function TodayForm({ hint }: { hint?: string }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const log = logFor(data, today);
  const edit = can('ops.log');
  const [v, setV] = useState({ footfall: log ? String(num(log, 'footfall') || '') : '', parkingIncome: log ? String(num(log, 'parkingIncome') || '') : '', hoursException: str(log, 'hoursException'), generatorHours: log ? String(num(log, 'generatorHours') || '') : '' });
  const set = (k: keyof typeof v, value: string) => setV((s) => ({ ...s, [k]: value }));
  const save = () => {
    if (!(Number(v.footfall) > 0)) return act.toast('Type today’s footfall count from the door counters.', 'err');
    const values = { footfall: Number(v.footfall), parkingIncome: Number(v.parkingIncome) || 0, hoursException: v.hoursException.trim(), generatorHours: Number(v.generatorHours) || 0 };
    if (log) act.update('opslog', log.id, values, 'Daily log updated');
    else act.create('opslog', { date: today, ...values }, undefined, 'Daily log captured');
    act.toast(`Daily log for ${formatDate(today)} saved — ${thousands(values.footfall)} visitors`);
  };
  return (
    <div className="form-grid">
      <Field label="Footfall (door counters)" hint={hint}><input className="input num" type="number" min={0} aria-label="Footfall" disabled={!edit} value={v.footfall} onChange={(e) => set('footfall', e.target.value)} data-testid="log-footfall" /></Field>
      <Field label="Parking income (R)"><input className="input num" type="number" min={0} step="10" aria-label="Parking income" disabled={!edit} value={v.parkingIncome} onChange={(e) => set('parkingIncome', e.target.value)} data-testid="log-parking" /></Field>
      <Field label="Trading-hours exception"><input className="input" aria-label="Trading-hours exception" placeholder="e.g. Late-night trade to 21:00" disabled={!edit} value={v.hoursException} onChange={(e) => set('hoursException', e.target.value)} /></Field>
      <Field label="Generator run (hours)"><input className="input num" type="number" min={0} step="0.5" aria-label="Generator run hours" disabled={!edit} value={v.generatorHours} onChange={(e) => set('generatorHours', e.target.value)} /></Field>
      {edit && <div><button className="btn primary" onClick={save} data-testid="save-log">{log ? 'Save changes' : 'Save today’s log'}</button></div>}
    </div>
  );
}
