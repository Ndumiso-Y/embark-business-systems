import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { addDays, formatDate, parseIso } from '../../../core/lib/dates';
import { Empty, Notice, PageHeader, Panel, Segmented, Stat } from '../../../core/components/ui';
import { RecordTable, WorkflowActions } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { diaryEntryFor, diaryLabour, diarySummary, holders, isRainDay, projectName, todayStr } from '../helpers';

const WEATHER_SHORT: Record<string, string> = { fine: 'Fine', overcast: 'Overcast', windy: 'Windy', showers: 'Showers', rain: 'RAIN DAY' };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SiteDiary() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { can } = useUser();
  const today = todayStr();
  const def = act.def('diary');
  const [scope, setScope] = useState<'week' | 'month' | 'all'>('week');
  const [creating, setCreating] = useState(false);

  const entries = records(data, 'diary');
  const siteProjects = records(data, 'projects').filter((p) => p.status === 'onsite' || entries.some((d) => str(d, 'project') === p.id && str(d, 'date') >= addDays(today, -13)));
  const month = diarySummary(data, undefined, `${today.slice(0, 7)}-01`, today);
  const drafts = entries.filter((d) => d.status === 'draft').sort(def.sort);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const cell = (date: string, projectId: string) => entries.find((d) => str(d, 'date') === date && str(d, 'project') === projectId);
  const rows = useMemo(() => {
    const from = scope === 'week' ? addDays(today, -6) : scope === 'month' ? `${today.slice(0, 7)}-01` : '';
    return entries.filter((d) => str(d, 'date') >= from).sort(def.sort);
  }, [entries, scope, today, def]);

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Site`} title="Site diary" subtitle="One entry per site per working day: weather, labour by trade, plant, work done, delays and visitors. The site agent signs each entry."
        actions={can('diary') ? <button className="btn primary" onClick={() => setCreating(true)} data-testid="new-record"><IcoPlus /> New diary entry</button> : undefined} />
      <div className="stat-grid">
        <Stat label="Entries this month" value={month.entries} sub={`${month.signed} signed`} />
        <Stat label="Rain days this month" value={month.rainDays} tone={month.rainDays ? 'accent' : undefined} sub="site-days with work stopped by rain" />
        <Stat label="Delay hours this month" value={month.delayHours} sub={`${month.employerDelayDays} employer-risk days · ${month.otherDelayDays} contractor-risk days`} />
        <Stat label="Awaiting signature" value={drafts.length} tone={drafts.length ? 'red' : undefined} sub="draft entries" />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Last 14 days by site" meta="Weather · people on site. Click a cell to open the entry.">
          <div className="table-wrap">
            <table className="table" data-testid="diary-grid">
              <thead><tr><th>Date</th>{siteProjects.map((p) => <th key={p.id}>{str(p, 'name').split(' — ')[0]}</th>)}</tr></thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d}>
                    <td><strong>{formatDate(d)}</strong><small>{DOW[parseIso(d).getDay()]}{d === today ? ' · today' : ''}</small></td>
                    {siteProjects.map((p) => {
                      const r = cell(d, p.id);
                      if (!r) return <td key={p.id}><small>{parseIso(d).getDay() === 0 ? 'Sunday' : '—'}</small></td>;
                      const missingCause = (num(r, 'delayHours') > 0 || isRainDay(r)) && !str(r, 'delayCause');
                      return (
                        <td key={p.id}>
                          <Link to={`${base}/diary/${r.id}`}>{WEATHER_SHORT[str(r, 'weather')] ?? str(r, 'weather')}</Link>
                          <small><span className={`dot ${missingCause ? 'red' : r.status === 'draft' ? 'amber' : isRainDay(r) ? 'blue' : 'green'}`} />{diaryLabour(r)} people{num(r, 'delayHours') ? ` · ${num(r, 'delayHours')} h delay` : ''}</small>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="stack">
          <Panel title="Extension-of-time summary" meta="Indicative: rain days + employer-risk delays recorded in the diary">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Project</th><th className="num">Rain</th><th className="num">Employer</th><th className="num">Indicative</th><th className="num">Granted</th></tr></thead>
                <tbody>
                  {siteProjects.map((p) => {
                    const s = diarySummary(data, p.id);
                    return (
                      <tr key={p.id}>
                        <td><Link to={`${base}/projects/${p.id}`}>{str(p, 'name').split(' — ')[0]}</Link></td>
                        <td className="num">{s.rainDays}</td>
                        <td className="num">{s.employerDelayDays}</td>
                        <td className="num"><b>{s.indicativeEot} d</b></td>
                        <td className="num">{num(p, 'eotDaysGranted')} d</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted-note" style={{ marginTop: 8 }}>Not a claim or entitlement — contractual rain allowances and notice periods are not modelled.</p>
          </Panel>
          <Panel title="Awaiting signature" meta="A delay or rain day needs a cause before the entry can be signed">
            {drafts.length ? (
              <ul className="list" data-testid="diary-drafts">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <div className="grow">
                      <Link to={`${base}/diary/${d.id}`}><b>{projectName(data, d.values.project)}</b></Link>
                      <small>{formatDate(str(d, 'date'))} · {diaryLabour(d)} people{num(d, 'delayHours') ? ` · ${num(d, 'delayHours')} h delay${str(d, 'delayCause') ? '' : ' — cause missing'}` : ''}</small>
                    </div>
                    <WorkflowActions def={def} record={d} compact />
                  </li>
                ))}
              </ul>
            ) : <Empty title="Everything is signed" />}
            {drafts.length > 0 && !can('diary.sign') && <div style={{ marginTop: 10 }}><Notice tone="grey">Entries are signed by {holders(data, 'diary.sign')}.</Notice></div>}
          </Panel>
        </div>
      </div>
      <Panel title="Diary entries" right={<Segmented label="Period" value={scope} onChange={setScope} options={[{ value: 'week', label: '7 days' }, { value: 'month', label: 'This month' }, { value: 'all', label: 'All' }]} />}>
        <RecordTable def={def} rows={rows} moduleKey="diary" />
      </Panel>
      {creating && (
        <RecordFormModal def={def} open title="New site diary entry"
          initial={{ date: today, weather: 'fine', project: (siteProjects.find((p) => p.status === 'onsite' && !cell(today, p.id)) ?? siteProjects[0])?.id ?? '', labourGeneral: 0, labourArtisans: 0, labourSteel: 0, labourSubcontract: 0, delayHours: 0 }}
          onClose={() => setCreating(false)}
          onSave={(v) => {
            const dup = diaryEntryFor(data, String(v.project), String(v.date));
            if (dup) { act.toast(`${dup.ref} is already the entry for that site on ${formatDate(String(v.date))} — one entry per site per day.`, 'err'); return; }
            const r = act.create('diary', v, 'draft', 'Diary entry captured');
            act.toast(`Diary entry ${r.ref} saved as draft`);
            setCreating(false);
            navigate(`${base}/diary/${r.id}`);
          }} />
      )}
    </>
  );
}
