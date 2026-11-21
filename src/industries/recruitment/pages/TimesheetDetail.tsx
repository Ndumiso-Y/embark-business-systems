import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { findRecord, num, permissionHint, str } from '../../../core/engine';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { formatDate } from '../../../core/lib/dates';
import { KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { DAY_NAMES, WEEKLY_HOURS_CAP } from '../data';
import { HOUR_KEYS, assignmentOf, inAssignment, rand, randOf, submitTimesheetProblems, timesheetDays, timesheetHours, timesheetValue, todayStr } from '../helpers';
import { CandidateCard, RecLink } from './shared';

export default function TimesheetDetail() {
  const { id } = useParams();
  const data = useData();
  const t = findRecord(data, 'timesheets', id);
  return (
    <RecordDetail aside={t ? <Aside id={t.id} /> : undefined}>
      {t && <Hours key={t.updatedAt} id={t.id} />}
    </RecordDetail>
  );
}

/** Day-by-day hours. Days outside the assignment are marked; the submit rule refuses hours on them. */
function Hours({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const t = findRecord(data, 'timesheets', id)!;
  const a = assignmentOf(data, str(t, 'assignment'));
  const [hrs, setHrs] = useState<string[]>(() => HOUR_KEYS.map((k) => String(num(t, k))));
  const editable = t.status === 'draft' && can('timesheets.manage');
  const days = timesheetDays(t);
  const total = hrs.reduce((n, h) => n + (Number(h) || 0), 0);
  const v = timesheetValue(t, data);
  const problems = t.status === 'draft' ? submitTimesheetProblems(t, data, today) : [];
  const save = () => {
    const patch: Record<string, number> = {};
    HOUR_KEYS.forEach((k, i) => { patch[k] = Math.max(0, Math.min(24, Math.round((Number(hrs[i]) || 0) * 4) / 4)); });
    act.update('timesheets', t.id, patch, `Hours saved: ${Object.values(patch).reduce((n, h) => n + h, 0)} h`);
    act.toast(`${t.ref}: hours saved`);
  };
  return (
    <>
      <Panel title="Hours" meta={`Week of ${formatDate(str(t, 'weekStart'))} · assignment ${formatDate(str(a, 'startDate'))} – ${formatDate(str(a, 'endDate'))}`}
        right={<Tag tone={total > WEEKLY_HOURS_CAP ? 'red' : 'dark'}>{total} h{total > WEEKLY_HOURS_CAP ? ` · above ${WEEKLY_HOURS_CAP} h cap` : ''}</Tag>}>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate data-testid="hours-form">
          <div className="rc-hours">
            {days.map((d, i) => {
              const out = !inAssignment(a, d.date);
              return (
                <label key={d.key} className={out ? 'rc-out' : ''}>
                  {DAY_NAMES[i]}
                  <small>{formatDate(d.date).slice(0, 6)}{out ? ' · outside' : ''}</small>
                  <input className="input num" type="number" min={0} max={24} step={0.5} aria-label={`${DAY_NAMES[i]} hours`} disabled={!editable} value={hrs[i]}
                    onChange={(e) => setHrs((s) => s.map((x, j) => (j === i ? e.target.value : x)))} />
                </label>
              );
            })}
          </div>
          {editable && <div className="btns" style={{ marginTop: 12 }}><button className="btn" type="submit" data-testid="save-hours">Save hours</button><span className="muted-note">Save, then press “Submit timesheet” above.</span></div>}
          {t.status === 'draft' && !can('timesheets.manage') && <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'timesheets.manage')}</p>}
        </form>
        {problems.length > 0 && timesheetHours(t) > 0 && <div style={{ marginTop: 12 }}><Notice tone="amber"><b>Cannot be submitted yet:</b><ul className="problem-list">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Notice></div>}
      </Panel>
      <Panel title="Value" meta="Excl. VAT · invoiced at the charge rate once the client has approved">
        <div className="mini-stat-row">
          <div>Hours<b>{v.hours}</b></div>
          <div>Charge ({randOf(num(a, 'chargeRate'))}/h)<b>{rand(v.charge)}</b></div>
          <div>Pay ({randOf(num(a, 'payRate'))}/h)<b>{rand(v.pay)}</b></div>
          <div>Margin<b>{rand(v.charge - v.pay)}</b></div>
        </div>
        {t.status === 'submitted' && <p className="muted-note" style={{ marginTop: 10 }}>“Invoice timesheet” stays blocked until the client’s approval is logged with “Log client approval (simulated)”.</p>}
      </Panel>
    </>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const t = findRecord(data, 'timesheets', id)!;
  const a = assignmentOf(data, str(t, 'assignment'));
  const inv = findRecord(data, 'invoices', str(t, 'invoice'));
  const invDef = config.collections.find((c) => c.key === 'invoices')!;
  return (
    <>
      <Panel title="Contractor"><CandidateCard data={data} id={a?.values.candidate} today={today} /></Panel>
      <Panel title="Assignment">
        <KeyValues items={[
          { label: 'Role', value: a ? <RecLink module="contractors" id={a.id}>{str(a, 'role')} · {a.ref}</RecLink> : '—' },
          { label: 'Client', value: str(findRecord(data, 'clients', str(a, 'client')), 'name') },
          { label: 'Invoice', value: inv ? <><RecLink module="invoices" id={inv.id}>{inv.ref}</RecLink> <StatusTag workflow={invDef.workflow} status={inv.status} /></> : '—' },
        ]} />
      </Panel>
    </>
  );
}
