import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { findRecord, num, permissionHint, str } from '../../../core/engine';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { ILLUSTRATIVE_EARNINGS_THRESHOLD, S198A_MONTHS, STANDARD_WEEK_HOURS } from '../data';
import { isMonday, margin, mondayOf, rand, randOf, s198aCheck, timesheetHours, timesheetsFor, todayStr } from '../helpers';
import { CandidateCard, ClientTermsCard, RecLink } from './shared';

export default function AssignmentDetail() {
  const { id } = useParams();
  const data = useData();
  const a = findRecord(data, 'assignments', id);
  return (
    <RecordDetail aside={a ? <Aside id={a.id} /> : undefined}>
      {a && <Main id={a.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const base = useBase();
  const navigate = useNavigate();
  const { can } = useUser();
  const today = todayStr();
  const a = findRecord(data, 'assignments', id)!;
  const m = margin(a);
  const hours = num(a, 'hoursPerWeek') || STANDARD_WEEK_HOURS;
  const flag = s198aCheck(a, today);
  const tsDef = config.collections.find((c) => c.key === 'timesheets')!;
  const sheets = timesheetsFor(data, a.id).sort((x, y) => str(y, 'weekStart').localeCompare(str(x, 'weekStart')));
  const [week, setWeek] = useState(mondayOf(today));
  const [err, setErr] = useState('');
  const add = () => {
    if (!isMonday(week)) return setErr('Choose the Monday the week starts on.');
    const twin = sheets.find((t) => str(t, 'weekStart') === week);
    if (twin) return setErr(`${twin.ref} already covers that week.`);
    const t = act.create('timesheets', { assignment: a.id, weekStart: week, h0: 0, h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, invoice: '', notes: '' }, 'draft', 'Timesheet started');
    act.toast(`${t.ref} started — enter the hours day by day`);
    navigate(`${base}/timesheets/${t.id}`);
  };
  return (
    <>
      <Panel title="Rates & margin" meta="Per hour, excl. VAT">
        <div className="mini-stat-row">
          <div>Pay rate<b>{randOf(num(a, 'payRate'))}/h</b></div>
          <div>Charge rate<b>{randOf(num(a, 'chargeRate'))}/h</b></div>
          <div>Margin<b>{rand(m.perHour)}/h · {m.pct}%</b></div>
          <div>Weekly margin<b>{rand(m.perHour * hours)}</b></div>
          <div>Est. annual pay<b>{randOf(num(a, 'payRate') * hours * 52)}</b></div>
        </div>
      </Panel>
      {flag && (
        <Notice tone={flag.passed ? 'red' : 'amber'}>
          <b>Illustrative s198A flag.</b> {flag.passed ? `This assignment passed ${S198A_MONTHS} months on ${formatDate(flag.threeMonths)}` : `This assignment reaches ${S198A_MONTHS} months on ${formatDate(flag.threeMonths)} (${flag.daysLeft} days)`} and the contractor’s estimated earnings ({randOf(flag.annual)} a year) are below the demo figure of {randOf(ILLUSTRATIVE_EARNINGS_THRESHOLD)}. In a real system this would prompt a review with the client. The figure is illustrative, not the current legal threshold, and this is not legal advice.
        </Notice>
      )}
      <Panel title="Timesheets" meta="Weekly, Monday to Sunday · hours must fall inside the assignment dates">
        {sheets.length ? (
          <ul className="list" data-testid="assignment-timesheets">
            {sheets.map((t) => (
              <li key={t.id}>
                <span className="time-chip">{formatDate(str(t, 'weekStart')).slice(0, 6)}</span>
                <div className="grow">
                  <RecLink module="timesheets" id={t.id}><b>{t.ref}</b></RecLink>
                  <small>{timesheetHours(t)} h</small>
                </div>
                <StatusTag workflow={tsDef.workflow} status={t.status} />
              </li>
            ))}
          </ul>
        ) : <p className="muted-note">No timesheets yet.</p>}
        {['active', 'pending'].includes(a.status ?? '') && (can('timesheets.manage') ? (
          <form className="rc-inline-form" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); add(); }} noValidate>
            <Field label="Week starting (Monday)" error={err || undefined}><input className="input" type="date" aria-label="Week starting" value={week} onChange={(e) => setWeek(e.target.value)} /></Field>
            <button className="btn" type="submit" data-testid="add-timesheet">Start timesheet</button>
          </form>
        ) : <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'timesheets.manage')}</p>)}
      </Panel>
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const a = findRecord(data, 'assignments', id)!;
  return (
    <>
      <Panel title="Contractor"><CandidateCard data={data} id={a.values.candidate} today={today} /></Panel>
      <Panel title="Client"><ClientTermsCard data={data} id={a.values.client} today={today} /></Panel>
      <Panel title="Dates"><KeyValues items={[{ label: 'Start', value: formatDate(str(a, 'startDate')) }, { label: 'End', value: formatDate(str(a, 'endDate')) }]} /></Panel>
    </>
  );
}
