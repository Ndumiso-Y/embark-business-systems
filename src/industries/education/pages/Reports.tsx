import { useData, useIndustry } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { monthKeys, monthLabel, monthShort, parseIso } from '../../../core/lib/dates';
import { BarChart, Meters, PageHeader, Panel, Pipeline, Stat } from '../../../core/components/ui';
import RoleBar from '../../../core/components/RoleBar';
import { ASSESSED_SUBJECTS, GRADES, PASS_MARK, subjectsForGrade } from '../data';
import {
  attendancePct, classLearners, collectedIn, dayAttendance, enrolledLearners, gradeRoom, marksOf, pct, rand, registerDates, runFor, runTotal, schoolAgeing, sortedClasses, termLabel, termOf,
  termPercent, todayStr,
} from '../helpers';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const mean = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const term = termOf(today);
  const classes = sortedClasses(data);
  const dates = registerDates(data).slice(-10);
  const since = dates[0] ?? today;

  // Enrolment and attendance by grade.
  const grades = GRADES.map((g) => {
    const room = gradeRoom(data, g.value);
    const ids = room.rooms.map((r) => r.cls.id);
    let roll = 0, present = 0;
    for (const reg of records(data, 'registers')) {
      if (reg.status !== 'submitted' || !ids.includes(str(reg, 'class')) || str(reg, 'date') < since) continue;
      for (const m of marksOf(reg).values()) { roll++; if (m.code !== 'A') present++; }
    }
    return { ...g, room, att: roll ? attendancePct(present, roll) : null };
  }).filter((g) => g.room.rooms.length);
  const enrolled = enrolledLearners(data).length;
  const capacity = grades.reduce((n, g) => n + g.room.capacity, 0);
  const trend = dates.map((d) => ({ label: `${DOW[parseIso(d).getDay()]} ${d.slice(8)}`, value: dayAttendance(data, d).pct }));
  const overall = mean(trend.map((t) => t.value));

  // Results by subject from published marks this term.
  const subjects = ASSESSED_SUBJECTS.map((s) => {
    const pcts = classes.filter((c) => subjectsForGrade(str(c, 'grade')).includes(s.value)).flatMap((c) => classLearners(data, c.id).map((l) => termPercent(data, l, s.value, term))).filter((p): p is number => p !== null);
    return { ...s, count: pcts.length, avg: mean(pcts), pass: pcts.length ? Math.round((pcts.filter((p) => p >= PASS_MARK).length / pcts.length) * 100) : null };
  }).filter((s) => s.count > 0);
  const allPcts = subjects.filter((s) => s.pass !== null);

  // Fees: billed against collected per month, and arrears.
  const months = monthKeys(today, 6);
  const money = months.map((m) => ({ label: monthShort(m), value: Math.round(runTotal(runFor(data, m)) / 100), alt: Math.round(collectedIn(data, m) / 100) }));
  const billed6 = months.reduce((n, m) => n + runTotal(runFor(data, m)), 0);
  const collected6 = months.reduce((n, m) => n + collectedIn(data, m), 0);
  const age = schoolAgeing(data, today);

  const apps = records(data, 'applications');
  const stages = config.collections.find((c) => c.key === 'applications')!.workflow!.states.map((s) => ({ key: s.key, label: s.label, tone: s.tone, count: apps.filter((a) => a.status === s.key).length }));

  return (
    <>
      <PageHeader kicker={`${config.businessName} / School office`} title="Reports" subtitle="Built live from the demo records: enrolment against capacity, attendance by grade, results by subject, fees billed and collected, and the admissions pipeline." />
      <div className="stat-grid">
        <Stat label="Enrolment" value={`${enrolled}/${capacity}`} sub={`${Math.round((enrolled / Math.max(1, capacity)) * 100)}% of places filled`} tone="accent" />
        <Stat label={`Attendance · last ${dates.length} school days`} value={pct(overall)} sub="present or late ÷ learners on submitted registers" />
        <Stat label={`Pass rate · ${termLabel(term)}`} value={pct(mean(allPcts.map((s) => s.pass!)))} sub={`learners at ${PASS_MARK}% or above, averaged over the subjects · published marks`} />
        <Stat label="Collected · last 6 months" value={billed6 ? `${Math.round((collected6 / billed6) * 100)}%` : '—'} sub={`${rand(collected6)} of ${rand(billed6)} billed`} tone={age.arrears ? 'red' : 'accent'} />
      </div>
      <div className="grid-2-even">
        <Panel title="Enrolment by grade" meta="Enrolled learners against places (the demo holds one small class per grade)">
          <Meters items={grades.map((g) => ({ label: g.label, value: g.room.enrolled, max: g.room.capacity, tone: g.room.free <= 0 ? 'red' as const : 'green' as const, sub: g.room.free <= 0 ? `Full${g.room.held ? ` — ${g.room.held} held by offers` : ''}` : `${g.room.free} free${g.room.held ? ` · ${g.room.held} held by offers` : ''}` }))} />
        </Panel>
        <div className="stack">
          <Panel title="Attendance trend" meta="Whole school, per school day">
            <BarChart label="Attendance percentage per school day" data={trend} format={(n) => `${n}%`} />
          </Panel>
          <Panel title="Attendance by grade" meta={`Last ${dates.length} school days`}>
            <div className="table-wrap">
              <table className="table" data-testid="report-attendance">
                <thead><tr><th>Grade</th><th className="num">Learners</th><th className="num">Attendance</th></tr></thead>
                <tbody>{grades.map((g) => <tr key={g.value}><td><strong>{g.label}</strong></td><td className="num">{g.room.enrolled}</td><td className="num" style={g.att !== null && g.att < 92 ? { color: 'var(--danger)' } : undefined}>{pct(g.att)}</td></tr>)}</tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
      <div className="grid-2-even">
        <Panel title="Results by subject" meta={`${termLabel(term)} · term percentages from published marks`}>
          <div className="table-wrap">
            <table className="table" data-testid="report-subjects">
              <thead><tr><th>Subject</th><th className="num">Learners</th><th className="num">Average</th><th className="num">Pass rate</th></tr></thead>
              <tbody>{subjects.map((s) => <tr key={s.value}><td><strong>{s.label}</strong></td><td className="num">{s.count}</td><td className="num">{pct(s.avg)}</td><td className="num">{pct(s.pass)}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Fees billed and collected" meta={`Rand per month — billed (accent) and collected (dark) · ${monthLabel(months[0])} to ${monthLabel(months[5])}`}>
          <BarChart label="Fees billed and collected per month" data={money} alt="collected" format={(n) => rand(n * 100)} />
          <div className="mini-stat-row" style={{ marginTop: 14 }}>
            <span><b>{rand(age.d30)}</b>30 days</span><span><b>{rand(age.d60)}</b>60 days</span><span><b>{rand(age.d90)}</b>90+ days</span><span><b>{age.inArrears.length}</b>families in arrears</span>
          </div>
        </Panel>
      </div>
      <Panel title="Admissions pipeline" meta={`${apps.length} applications on record`}>
        <Pipeline stages={stages} />
      </Panel>
      <div className="section-gap" />
      <RoleBar />
    </>
  );
}
