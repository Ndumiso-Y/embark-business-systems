import { useParams } from 'react-router-dom';
import { useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, KeyValues, Notice, Panel, Stat, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { ABSENCE_REASONS, CHRONIC_DAYS, DISCIPLINE_CATEGORIES, PLAN_MONTHS, label, level, subjectLabel } from '../data';
import {
  accountBalance, accountOf, ageing, ageingFlag, attendanceStats, classOf, consecutiveAbsences, familyLearners, familyOf, fullName, isMerit, learnerAttendance, learnerPoints,
  learnerSubjects, pct, rand, reportAverage, reportResults, subjectAverage, termLabel, termOf, termPercent, todayStr,
} from '../helpers';
import { ModuleLink } from './shared';

/** A learner's profile: guardians, attendance, latest marks, discipline, report cards and — for the bursar's office — the fee balance. */
export default function LearnerProfile() {
  const config = useIndustry();
  const data = useData();
  const { id } = useParams();
  const { can } = useUser();
  const l = findRecord(data, 'learners', id);
  if (!l) return <RecordDetail />;

  const today = todayStr();
  const term = termOf(today);
  const cls = classOf(data, l);
  const family = familyOf(data, l);
  const siblings = familyLearners(data, str(l, 'family')).filter((s) => s.id !== l.id);
  const att = attendanceStats(data, l);
  const run = consecutiveAbsences(data, l);
  const absences = learnerAttendance(data, l).filter((d) => d.code !== 'P').reverse();
  const results = learnerSubjects(data, l).map((subject) => ({ subject, pct: termPercent(data, l, subject, term), avg: cls ? subjectAverage(data, cls.id, subject, term) : null }));
  const average = reportAverage(results);
  const points = learnerPoints(data, l.id);
  const reports = records(data, 'reports').filter((r) => str(r, 'learner') === l.id).sort((a, b) => str(b, 'term').localeCompare(str(a, 'term')));
  const reportDef = config.collections.find((c) => c.key === 'reports')!;
  const discDef = config.collections.find((c) => c.key === 'discipline')!;
  const account = accountOf(data, str(l, 'family'));
  const seeFees = can('fees');
  const balance = account ? accountBalance(account, data) : 0;
  const arrears = account ? ageingFlag(ageing(account, data, today)) : null;

  const timeline = [
    ...(str(l, 'enrolled') ? [{ date: str(l, 'enrolled'), text: `Enrolled at ${config.businessName}`, tone: 'accent' }] : []),
    ...absences.slice(0, 6).map((d) => ({ date: d.date, text: d.code === 'L' ? 'Late for school' : `Absent — ${label(ABSENCE_REASONS, d.reason || 'unexplained').toLowerCase()}`, tone: d.code === 'L' ? 'amber' : 'red' })),
    ...points.records.map((r) => ({ date: str(r, 'date'), text: `${isMerit(r) ? 'Merit' : 'Incident'}: ${label(DISCIPLINE_CATEGORIES, str(r, 'category'))}`, tone: isMerit(r) ? 'green' : 'amber' })),
    ...reports.filter((r) => str(r, 'releasedOn')).map((r) => ({ date: str(r, 'releasedOn'), text: `${termLabel(str(r, 'term'))} report card released`, tone: 'blue' })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  return (
    <RecordDetail
      aside={
        <>
          <Panel title="Family & guardians" meta={family ? `${family.ref} · ${str(family, 'suburb')}` : undefined}>
            {family ? (
              <KeyValues items={[
                { label: `${str(family, 'relation1') || 'Guardian'}`, value: str(family, 'guardian1') },
                { label: 'Phone (fictional)', value: str(family, 'phone1') },
                { label: 'Email', value: str(family, 'email1'), wide: true },
                ...(str(family, 'guardian2') ? [{ label: 'Second guardian', value: str(family, 'guardian2') }, { label: 'Second phone (fictional)', value: str(family, 'phone2') }] : []),
                { label: 'Brothers and sisters at the school', value: siblings.length ? siblings.map((s, i) => <span key={s.id}>{i ? ', ' : ''}<ModuleLink module="learners" id={s.id}>{fullName(s)}</ModuleLink> ({str(classOf(data, s), 'name')})</span>) : 'None', wide: true },
              ]} />
            ) : <Empty title="No family record linked" />}
          </Panel>
          <Panel title="Medical" meta="Restricted to staff with “View medical notes”">
            {can('medical.view')
              ? <KeyValues items={[{ label: 'Allergies', value: str(l, 'allergies') || 'None recorded', wide: true }, { label: 'Medical notes', value: str(l, 'medical') || 'None recorded', wide: true }]} />
              : <Notice tone="grey">{str(l, 'allergies') || str(l, 'medical') ? 'There is a medical note on file. ' : ''}Allergies and medical notes are hidden for your simulated role.</Notice>}
          </Panel>
          {seeFees ? (
            <Panel title="Fee account" meta="Shown to the bursar’s office and the principal only" right={arrears ? <Tag tone={arrears.tone}>{arrears.label}</Tag> : <Tag tone="green">Up to date</Tag>}>
              {account ? (
                <>
                  <KeyValues items={[{ label: 'Balance owing', value: <b data-testid="fee-balance">{rand(balance)}</b> }, { label: 'Paid over', value: label(PLAN_MONTHS, str(account, 'months')) }]} />
                  <p className="muted-note" style={{ marginTop: 10 }}><ModuleLink module="fees" id={account.id}>Open the family’s statement ({account.ref})</ModuleLink></p>
                </>
              ) : <p className="muted-note">No fee account for this family yet.</p>}
            </Panel>
          ) : <Panel title="Fee account"><Notice tone="grey">Fee balances are only shown to the bursar’s office and the principal.</Notice></Panel>}
        </>
      }>
      <div className="stat-grid compact" style={{ marginBottom: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))' }}>
        <Stat label="Attendance" value={att.days ? `${att.pct}%` : '—'} tone={att.days && att.pct < 90 ? 'red' : 'accent'} sub={`${att.absent} absent · ${att.late} late in ${att.days} school days`} />
        <Stat label={`Average · ${termLabel(term)}`} value={pct(average)} sub={average === null ? 'no published marks yet' : level(average).label} />
        <Stat label="Merit points" value={`+${points.merits}`} sub={`${points.records.filter(isMerit).length} merits`} />
        <Stat label="Demerit points" value={points.demerits ? `−${points.demerits}` : '0'} tone={points.demerits >= 5 ? 'red' : undefined} sub={`${points.records.filter((r) => !isMerit(r)).length} incidents`} />
      </div>
      {run >= CHRONIC_DAYS && <Notice tone="red">Absent {run} school days in a row — the class teacher or parent liaison should contact the family.</Notice>}

      <Panel title={`Latest marks — ${termLabel(term)}`} meta="Term percentage per subject from published assessment tasks, weighted by each task’s weighting">
        <div className="table-wrap">
          <table className="table" data-testid="learner-marks">
            <thead><tr><th>Subject</th><th className="num">Term %</th><th className="num">Class average</th><th>Level (demo scale)</th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.subject}><td><strong>{subjectLabel(r.subject)}</strong></td><td className="num">{pct(r.pct)}</td><td className="num">{pct(r.avg)}</td><td><Tag tone={level(r.pct).tone}>{level(r.pct).label}</Tag></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Attendance" meta="From submitted class registers" right={<Tag tone={att.days && att.pct < 90 ? 'red' : 'green'}>{att.days ? `${att.pct}% present` : 'No registers yet'}</Tag>}>
        {absences.length ? (
          <ul className="list">
            {absences.slice(0, 6).map((d) => <li key={d.date} style={{ padding: '8px 0' }}><span className="time-chip">{formatDate(d.date)}</span><div className="grow" /><Tag tone={d.code === 'L' ? 'amber' : 'red'}>{d.code === 'L' ? 'Late' : `Absent · ${label(ABSENCE_REASONS, d.reason || 'unexplained')}`}</Tag></li>)}
          </ul>
        ) : <p className="muted-note">No absences or late arrivals on the registers held in the demo (the last two school weeks).</p>}
      </Panel>

      <Panel title="Discipline & merits" meta="Merits add points, incidents take them away" right={<Tag tone={points.net < 0 ? 'amber' : 'green'}>Net {points.net > 0 ? '+' : ''}{points.net}</Tag>}>
        {points.records.length ? (
          <ul className="list">
            {points.records.map((r) => (
              <li key={r.id} style={{ padding: '9px 0' }}>
                <span className={`dot ${isMerit(r) ? 'green' : 'amber'}`} />
                <div className="grow"><b><ModuleLink module="discipline" id={r.id}>{label(DISCIPLINE_CATEGORIES, str(r, 'category'))}</ModuleLink></b><small>{formatDate(str(r, 'date'))} · {str(r, 'description')}</small></div>
                <StatusTag workflow={discDef.workflow} status={r.status} />
              </li>
            ))}
          </ul>
        ) : <p className="muted-note">Nothing logged for this learner.</p>}
      </Panel>

      <Panel title="Report cards">
        {reports.length ? (
          <ul className="list">
            {reports.map((r) => (
              <li key={r.id} style={{ padding: '9px 0' }}>
                <div className="grow"><b><ModuleLink module="reportcards" id={r.id}>{termLabel(str(r, 'term'))}</ModuleLink></b><small>Average {pct(reportAverage(reportResults(r, data)))}</small></div>
                <StatusTag workflow={reportDef.workflow} status={r.status} />
              </li>
            ))}
          </ul>
        ) : <p className="muted-note">No report cards yet.</p>}
      </Panel>

      <Panel title="Timeline" meta="Enrolment, absences, discipline and reports — newest first">
        <ul className="timeline">
          {timeline.map((t, i) => <li key={i}><div><b>{t.text}</b><small>{formatDate(t.date)}</small></div></li>)}
        </ul>
      </Panel>
    </RecordDetail>
  );
}
