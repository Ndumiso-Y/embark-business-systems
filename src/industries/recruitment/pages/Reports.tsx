import { useState } from 'react';
import { Link } from 'react-router-dom';
import { num, records, str } from '../../../core/engine';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { addDays, monthKeys, monthShort } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { BarChart, Empty, Meters, Notice, PageHeader, Panel, Segmented, Stat } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { STAGE_PROBABILITY, STANDARD_WEEK_HOURS } from '../data';
import { JOB_LIVE, addMonths, clientName, feesBilled, funnel, margin, monthRange, pct, quarterRange, rand, teamTarget, timeToFill, todayStr, weightedPipeline } from '../helpers';

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { can } = useUser();
  const today = todayStr();
  const [period, setPeriod] = useState<'month' | 'quarter'>('month');
  const seeFees = can('fees.view');
  const consDef = config.collections.find((c) => c.key === 'consultants')!;
  const subDef = config.collections.find((c) => c.key === 'submissions')!;
  const consultants = records(data, 'consultants');
  const q = quarterRange(today);
  const m = monthRange(today);
  const range = period === 'month' ? m : q;
  const months = period === 'month' ? 1 : 3;
  const periodLabel = period === 'month' ? 'this month' : q.label;
  const team = feesBilled(data, range.from, range.to);
  const target = teamTarget(data) * months;
  const placements = records(data, 'placements').filter((p) => str(p, 'acceptedOn') >= range.from && str(p, 'acceptedOn') <= range.to);
  const ttf = timeToFill(data);
  const wp = weightedPipeline(data);
  const sixMonthsAgo = addMonths(today, -6);
  const f = funnel(data, sixMonthsAgo);

  const rows = consultants.map((c) => {
    const fees = feesBilled(data, range.from, range.to, c.id);
    const tgt = toCents(num(c, 'monthlyTarget')) * months;
    return {
      c, fees, tgt, pct: pct(fees, tgt),
      placed: placements.filter((p) => str(p, 'consultant') === c.id).length,
      sent: records(data, 'submissions').filter((s) => str(s, 'submittedBy') === c.id && str(s, 'submittedOn') >= range.from && str(s, 'submittedOn') <= range.to).length,
      live: records(data, 'jobs').filter((j) => str(j, 'owner') === c.id && JOB_LIVE.includes(j.status ?? '')).length,
    };
  });
  const chart = monthKeys(today, 6).map((k) => {
    const from = `${k}-01`;
    const to = addDays(addMonths(from, 1), -1);
    return { label: monthShort(k), value: Math.round(feesBilled(data, from, to) / 100), alt: Math.round(teamTarget(data) / 100) };
  });
  const contractMargin = records(data, 'assignments').filter((a) => a.status === 'active').reduce((n, a) => n + margin(a).perHour * (num(a, 'hoursPerWeek') || STANDARD_WEEK_HOURS), 0);
  const stageLabel = (k: string | null) => (k ? subDef.workflow!.states.find((s) => s.key === k)?.label ?? k : 'No CVs sent');

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Finance`} title="Consultants & reports" subtitle="Computed from the demo records. Fees are placement-fee invoices less credit notes, excl. VAT, credited to the consultant who sent the CV."
        actions={<Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: 'month', label: 'This month' }, { value: 'quarter', label: q.label }]} />} />
      {!seeFees && <Notice tone="grey">Fee figures are hidden for your simulated role (needs “See fees”).</Notice>}
      <div className="stat-grid">
        <Stat label={`Fees billed · ${periodLabel}`} value={seeFees ? rand(team) : '—'} tone={seeFees && team < target ? undefined : 'accent'} sub={seeFees ? `${pct(team, target)}% of the ${rand(target)} team target` : 'hidden'} />
        <Stat label={`Placements · ${periodLabel}`} value={placements.length} sub="offers accepted" />
        <Stat label="Average time to fill" value={`${ttf.avg} days`} sub={`opened → filled, over ${ttf.count} filled jobs`} />
        <Stat label="Weighted pipeline" value={seeFees ? rand(wp.total) : '—'} sub={seeFees ? `of ${rand(wp.unweighted)} in estimated fees on live jobs` : 'hidden'} />
      </div>
      <div className="grid-2">
        <Panel title={`Fees billed vs target · ${periodLabel}`} meta={period === 'month' ? 'Monthly targets' : 'Quarterly target = 3 × monthly'}>
          {seeFees ? (
            <Meters format={(n) => rand(n)} items={rows.filter((r) => r.tgt > 0).map((r) => ({ label: str(r.c, 'name'), value: r.fees, max: r.tgt, tone: r.pct >= 100 ? 'green' : r.pct >= 60 ? 'accent' : 'amber', sub: `${r.pct}% · ${r.placed} placed · ${r.sent} CVs sent` }))} />
          ) : <Empty title="Hidden for your role" />}
        </Panel>
        <Panel title="Funnel · last six months" meta="CVs sent → interviewed → offered → placed, with conversion from the step before">
          <Meters items={[
            { label: 'CVs sent', value: f.submitted, tone: 'accent', sub: 'submissions sent to clients' },
            { label: 'Interviewed', value: f.interviewed, tone: 'accent', sub: `${pct(f.interviewed, f.submitted)}% of CVs sent` },
            { label: 'Offered', value: f.offered, tone: 'amber', sub: `${pct(f.offered, f.interviewed)}% of interviewed` },
            { label: 'Placed', value: f.placed, tone: 'green', sub: `${pct(f.placed, f.offered)}% of offers · ${pct(f.placed, f.submitted)}% of CVs sent` },
          ]} />
        </Panel>
      </div>
      <div className="grid-2">
        <Panel title="Fees per month" meta="Billed (accent) against the team’s monthly target (dark), whole rand excl. VAT">
          {seeFees ? <BarChart label="Fees billed and team target per month" data={chart} alt="Team target" format={(n) => rand(n * 100)} /> : <Empty title="Hidden for your role" />}
        </Panel>
        <Panel title="Weighted pipeline by job" meta={`Estimated fee × the probability of the furthest candidate’s stage (${Object.entries(STAGE_PROBABILITY).filter(([, v]) => v > 0 && v < 1).map(([k, v]) => `${stageLabel(k)} ${Math.round(v * 100)}%`).join(', ')})`}>
          {seeFees ? (
            <ul className="list" data-testid="weighted-pipeline">
              {[...wp.rows].sort((a, b) => b.weighted - a.weighted).slice(0, 8).map((r) => (
                <li key={r.job.id}>
                  <div className="grow"><Link to={`${base}/jobs/${r.job.id}`}><b>{str(r.job, 'title')}</b></Link><small>{clientName(data, str(r.job, 'client'))} · {stageLabel(r.stage)} · fee {rand(r.fee)}</small></div>
                  <b>{rand(r.weighted)}</b>
                </li>
              ))}
            </ul>
          ) : <Empty title="Hidden for your role" />}
        </Panel>
      </div>
      <Panel title="Consultant league" meta={`${periodLabel} · contractor desk margin ${seeFees ? rand(contractMargin) : '—'} a week (not counted towards fee targets)`}>
        <div className="table-wrap">
          <table className="table" data-testid="league">
            <thead><tr><th>Consultant</th><th className="num">Fees</th><th className="num">Target</th><th className="num">%</th><th className="num">Placed</th><th className="num">CVs sent</th><th className="num">Live jobs</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.c.id}>
                  <td><strong>{str(r.c, 'name')}</strong><small>{consDef.subtitle?.(r.c, data)}</small></td>
                  <td className="num">{seeFees ? rand(r.fees) : '—'}</td>
                  <td className="num">{r.tgt ? (seeFees ? rand(r.tgt) : '—') : 'No target'}</td>
                  <td className="num">{r.tgt ? `${r.pct}%` : '—'}</td>
                  <td className="num">{r.placed}</td>
                  <td className="num">{r.sent}</td>
                  <td className="num">{r.live}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Consultants & targets" meta="Open a consultant to change their monthly target (Director)">
        <RecordTable def={consDef} rows={[...consultants].sort(consDef.sort)} moduleKey="reports" />
      </Panel>
      <div className="section-gap" />
      <Notice tone="grey">Reports are illustrative and computed in the browser from fictional records. Stage probabilities and targets are demo settings; nothing is posted to accounting or payroll.</Notice>
    </>
  );
}
