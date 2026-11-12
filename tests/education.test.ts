import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config, {
  accountBalance, accountEntries, accountOf, accountsToBill, ageing, arrearsOf, attendancePct, attendanceStats, billingProblem, billsIn, chronicAbsentees, classLearners, classRoom, collectedIn,
  consecutiveAbsences, coverCandidateProblem, coverCandidates, coverGaps, coverNeeded, familyFees, formatCover, formatLines, formatMarks, formatScores, gradeRoom, isSchoolDay, learnerPoints,
  ledgerEntry, parseLedger, parseLines, parseMarks, parseScores, parseSlots, paymentProblem, prevTerm, refNum, registerFor, registerState, registersOutstanding, reportResults, runTotal,
  schoolAgeing, setTodayForTests, siblingDiscount, signBlockers, siblingTasks, slotProblem, slotsOf, sortedClasses, subjectAverage, teacherLessons, termOf, termPercent, termRange, timetableClashes,
  timetableDay, timetableOf, waitlistPosition, weightSum, CLASS_CAPACITY,
} from '../src/industries/education';
import { applyTransition, findRecord, hasModule, num, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import { addDays, todayIso } from '../src/core/lib/dates';
import { useStore } from '../src/core/store';
import type { DemoRecord, IndustryData, Values } from '../src/core/types';

const TODAY = '2026-11-12'; // a Thursday
const TERM = '2026-T4';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;
const get = (collection: string, id: string) => findRecord(data, collection, id)!;
const withValues = (r: DemoRecord, v: Values, status = r.status): DemoRecord => ({ ...r, status, values: { ...r.values, ...v } });
/** A copy of the data with one collection's records patched. */
const patched = (collection: string, fn: (r: DemoRecord) => DemoRecord, base = data): IndustryData => ({ ...base, collections: { ...base.collections, [collection]: records(base, collection).map(fn) } });
const swap = (collection: string, next: DemoRecord, base = data) => patched(collection, (r) => (r.id === next.id ? next : r), base);
const move = (collection: string, r: DemoRecord, to: string, userId: string, note?: string, d = data) => applyTransition(wf(collection), r, to, user(userId), d, note, 'Tester');
const reason = (res: ReturnType<typeof move>) => (res.ok ? '' : res.reason);
const cls = (name: string) => records(data, 'classes').find((c) => str(c, 'name') === name)!;
const staffNamed = (first: string) => records(data, 'staff').find((s) => str(s, 'firstName') === first)!;
const task = (className: string, subject: string, title: string) => records(data, 'assessments').find((t) => str(t, 'class') === cls(className).id && str(t, 'subject') === subject && str(t, 'title') === title)!;
const bytes = (x: unknown) => new TextEncoder().encode(JSON.stringify(x)).length;

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('education configuration', () => {
  it('is internally consistent, including the guide', () => {
    expect(validateConfig(config)).toEqual([]);
    expect(config.guide).toHaveLength(6);
    for (const g of config.guide!) expect(hasModule(user(g.as!), g.to.split('/')[0])).toBe(true);
    expect(config.boundaries.join(' ')).toMatch(/POPIA/);
    expect(config.boundaries.join(' ')).toMatch(/SA-SAMS/);
    expect(config.boundaries.join(' ')).toMatch(/not CAPS/);
    expect(config.boundaries.join(' ')).toMatch(/No messages are sent/);
    expect(config.boundaries.join(' ')).toMatch(/No payment processing/);
  });

  it('seeds a realistic, deterministic school', () => {
    const again = buildIndustryData(config, TODAY);
    for (const k of config.collections.map((c) => c.key)) {
      expect(JSON.stringify(records(again, k).map((r) => [r.id, r.status, r.values]))).toBe(JSON.stringify(records(data, k).map((r) => [r.id, r.status, r.values])));
    }
    expect(records(data, 'classes')).toHaveLength(14);
    expect(records(data, 'learners')).toHaveLength(150);
    expect(records(data, 'families')).toHaveLength(95);
    expect(records(data, 'accounts')).toHaveLength(95);
    expect(records(data, 'staff')).toHaveLength(22);
    expect(records(data, 'applications')).toHaveLength(18);
    expect(records(data, 'timetables')).toHaveLength(14);
    expect(records(data, 'billingRuns')).toHaveLength(9);
    expect(records(data, 'discipline').length).toBeGreaterThanOrEqual(20);
    // Every learner is in a class and a family; no class is over capacity; siblings share a fee account.
    for (const l of records(data, 'learners')) { expect(findRecord(data, 'classes', str(l, 'class'))).toBeTruthy(); expect(accountOf(data, str(l, 'family'))).toBeTruthy(); }
    for (const c of records(data, 'classes')) expect(classLearners(data, c.id).length).toBeLessThanOrEqual(CLASS_CAPACITY);
    // Two weeks of submitted registers for every class, and today partly outstanding.
    const regs = records(data, 'registers');
    expect(regs.filter((r) => str(r, 'date') < TODAY)).toHaveLength(140);
    expect(regs.filter((r) => str(r, 'date') < TODAY).every((r) => r.status === 'submitted' && isSchoolDay(str(r, 'date'), TODAY))).toBe(true);
    expect(regs.filter((r) => str(r, 'date') === TODAY).map((r) => r.status).sort()).toEqual([...Array(2).fill('draft'), ...Array(8).fill('submitted')]);
    expect(registersOutstanding(data, TODAY).map((c) => str(c, 'name'))).toEqual(['Grade 4', 'Grade 6', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']);
    // This term's tasks in every state; last term's report cards released for everyone; this term's in progress.
    expect(new Set(records(data, 'assessments').map((t) => t.status))).toEqual(new Set(['draft', 'captured', 'moderated', 'published']));
    expect(records(data, 'assessments').every((t) => str(t, 'term') === TERM)).toBe(true);
    const reports = records(data, 'reports');
    expect(reports.filter((r) => str(r, 'term') === '2026-T3' && r.status === 'released')).toHaveLength(150);
    expect(new Set(reports.filter((r) => str(r, 'term') === TERM).map((r) => r.status))).toEqual(new Set(['draft', 'commented', 'signed', 'released']));
    expect(new Set(records(data, 'applications').map((a) => a.status))).toEqual(new Set(['applied', 'documents', 'assessed', 'waitlisted', 'offered', 'enrolled', 'declined']));
    expect(timetableClashes(data)).toEqual([]);
  });

  it('keeps guided records and today’s picture the same on every day of the week, and always has school today', () => {
    for (let i = 0; i < 7; i++) {
      const day = addDays('2026-11-14', i); // starts on a Saturday
      setTodayForTests(day);
      const d = buildIndustryData(config, day);
      expect(findRecord(d, 'applications', 'applications_1')!.status).toBe('applied');
      expect(findRecord(d, 'leave', 'leave_1')).toMatchObject({ status: 'open', values: { date: day } });
      expect(findRecord(d, 'assessments', 'assessments_1')!.status).toBe('draft');
      expect(findRecord(d, 'reports', 'reports_1')!.status).toBe('commented');
      expect(records(d, 'registers').filter((r) => str(r, 'date') === day)).toHaveLength(10);
      expect(registerFor(d, records(d, 'classes').find((c) => str(c, 'name') === 'Grade 4')!.id, day)).toBeUndefined();
      expect(coverNeeded(findRecord(d, 'leave', 'leave_1')!, d).length).toBeGreaterThanOrEqual(4);
      expect(registersOutstanding(d, day)).toHaveLength(6);
      expect(chronicAbsentees(d)).toHaveLength(2);
    }
    setTodayForTests(TODAY);
  });

  it('keeps the stored demo under 350 KB', () => {
    expect(bytes(data)).toBeLessThan(350_000);
  });

  it('uses only fictional details and never hard-codes the business name in records', () => {
    for (const s of records(data, 'staff')) {
      expect(str(s, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
      expect(str(s, 'email')).toMatch(/@example\.com$/);
      if (str(s, 'saceNo')) expect(str(s, 'saceNo')).toMatch(/^DEMO-SACE-\d+$/);
    }
    for (const f of records(data, 'families')) { expect(str(f, 'phone1')).toMatch(/^0\d{2} 555 \d{4}$/); expect(str(f, 'email1')).toMatch(/@example\.com$/); }
    for (const a of records(data, 'applications')) { expect(str(a, 'guardianPhone')).toMatch(/^0\d{2} 555 \d{4}$/); expect(str(a, 'guardianEmail')).toMatch(/@example\.com$/); }
    expect(JSON.stringify(data.collections)).not.toContain('Marula Ridge Academy');
  });

  it('gives each role its own modules', () => {
    expect(hasModule(user('u_teacher'), 'attendance')).toBe(true);
    expect(hasModule(user('u_teacher'), 'fees')).toBe(false);
    expect(hasModule(user('u_subject'), 'attendance')).toBe(false);
    expect(hasModule(user('u_bursar'), 'fees')).toBe(true);
    expect(hasModule(user('u_bursar'), 'assessments')).toBe(false);
    expect(hasModule(user('u_secretary'), 'admissions')).toBe(true);
    expect(user('u_liaison').permissions).not.toContain('medical.view');
    expect(user('u_principal').isSuperAdmin).toBe(true);
  });
});

describe('admissions rules', () => {
  it('will not mark documents received while one is outstanding', () => {
    const app = get('applications', 'applications_1');
    expect(reason(move('applications', app, 'documents', 'u_secretary'))).toMatch(/Still outstanding: immunisation card/);
    expect(move('applications', withValues(app, { docImmunisation: true }), 'documents', 'u_secretary')).toMatchObject({ ok: true });
    expect(reason(move('applications', app, 'documents', 'u_teacher'))).toMatch(/permission/);
  });

  it('needs an assessment date and outcome before an application is assessed', () => {
    const app = records(data, 'applications').find((a) => a.status === 'documents')!;
    expect(reason(move('applications', app, 'assessed', 'u_secretary'))).toMatch(/Record the assessment or interview first/);
    expect(move('applications', withValues(app, { assessmentDate: TODAY, outcome: 'ready' }), 'assessed', 'u_secretary')).toMatchObject({ ok: true });
  });

  it('blocks an offer without complete documents', () => {
    const app = records(data, 'applications').find((a) => a.status === 'assessed' && str(a, 'grade') === 'R')!;
    expect(move('applications', app, 'offered', 'u_secretary')).toMatchObject({ ok: true });
    expect(reason(move('applications', withValues(app, { docReport: false }), 'offered', 'u_secretary'))).toMatch(/Still outstanding: previous school report/);
  });

  it('blocks an offer when the grade has no free place, and offers the waiting list instead', () => {
    const full = get('applications', 'applications_2');
    expect(str(full, 'grade')).toBe('4');
    expect(gradeRoom(data, '4')).toMatchObject({ enrolled: 12, capacity: 12, free: 0 });
    expect(reason(move('applications', full, 'offered', 'u_secretary'))).toMatch(/Grade 4 is full: 12 enrolled out of 12 places.*waiting list/);
    expect(move('applications', full, 'waitlisted', 'u_secretary')).toMatchObject({ ok: true });
    // A grade with room cannot be waitlisted, and an offer that is out holds its place.
    const room = records(data, 'applications').find((a) => a.status === 'assessed' && str(a, 'grade') === '10')!;
    expect(reason(move('applications', room, 'waitlisted', 'u_secretary'))).toMatch(/still has a free place/);
    expect(classRoom(data, cls('Grade 9'))).toMatchObject({ enrolled: 11, held: 1, free: 0 });
    // When a learner leaves, the first family on the waiting list can be offered the place.
    const first = records(data, 'applications').find((a) => a.status === 'waitlisted' && str(a, 'grade') === '4' && waitlistPosition(a, data) === 1)!;
    expect(reason(move('applications', first, 'offered', 'u_secretary'))).toMatch(/Grade 4 is full/);
    const leaver = classLearners(data, cls('Grade 4').id)[0];
    expect(move('applications', first, 'offered', 'u_secretary', undefined, swap('learners', { ...leaver, status: 'left' }))).toMatchObject({ ok: true });
  });

  it('orders the waiting list by the date each application joined it', () => {
    const queue = records(data, 'applications').filter((a) => a.status === 'waitlisted' && str(a, 'grade') === '4').sort((a, b) => waitlistPosition(a, data) - waitlistPosition(b, data));
    expect(queue.map((a) => str(a, 'firstName'))).toEqual(['Lethu', 'Tyra']);
    expect(waitlistPosition(get('applications', 'applications_1'), data)).toBe(0);
  });

  it('needs the full enrolment deposit before an offer is accepted', () => {
    const offered = records(data, 'applications').filter((a) => a.status === 'offered');
    const unpaid = offered.find((a) => num(a, 'depositAmount') === 0)!;
    expect(reason(move('applications', unpaid, 'enrolled', 'u_secretary'))).toMatch(/Record the enrolment deposit of R2,500\.00 first/);
    expect(reason(move('applications', withValues(unpaid, { depositAmount: 1000, depositMethod: 'eft' }), 'enrolled', 'u_secretary'))).toMatch(/only R1,000\.00 is recorded/);
    expect(move('applications', withValues(unpaid, { depositAmount: 2500, depositMethod: 'card' }), 'enrolled', 'u_secretary')).toMatchObject({ ok: true });
    expect(move('applications', offered.find((a) => num(a, 'depositAmount') > 0)!, 'enrolled', 'u_secretary')).toMatchObject({ ok: true });
  });
});

describe('attendance rules', () => {
  const draft = (className: string) => registerFor(data, cls(className).id, TODAY)!;

  it('will not submit a register with unmarked learners', () => {
    const reg = draft('Grade 6');
    expect(registerState(reg, data).unmarked).toHaveLength(4);
    expect(reason(move('registers', reg, 'submitted', 'u_teacher'))).toMatch(/4 learners are not marked yet/);
  });

  it('needs a reason for every absence, and “unexplained” counts', () => {
    const reg = draft('Grade 11');
    expect(registerState(reg, data)).toMatchObject({ unmarked: [] });
    expect(reason(move('registers', reg, 'submitted', 'u_teacher'))).toMatch(/Choose a reason for each absence/);
    const marks = parseMarks(reg.values.marks);
    for (const [n, m] of marks) if (m.code === 'A' && !m.reason) marks.set(n, { code: 'A', reason: 'unexplained' });
    expect(move('registers', withValues(reg, { marks: formatMarks(marks) }), 'submitted', 'u_teacher')).toMatchObject({ ok: true });
    expect(reason(move('registers', withValues(reg, { marks: formatMarks(marks) }), 'submitted', 'u_bursar'))).toMatch(/permission/);
  });

  it('will not submit a register for a future date, and locks a submitted one', () => {
    const all = new Map(classLearners(data, cls('Grade 4').id).map((l) => [refNum(l), { code: 'P' as const, reason: '' }]));
    const future = withValues(draft('Grade 6'), { class: cls('Grade 4').id, date: addDays(TODAY, 1), marks: formatMarks(all) });
    expect(reason(move('registers', future, 'submitted', 'u_teacher'))).toMatch(/future date/);
    expect(move('registers', withValues(future, { date: TODAY }), 'submitted', 'u_teacher')).toMatchObject({ ok: true });
    const submitted = records(data, 'registers').find((r) => r.status === 'submitted')!;
    expect(wf('registers').states.find((s) => s.key === 'submitted')!.terminal).toBe(true);
    expect(reason(move('registers', submitted, 'draft', 'u_principal'))).toMatch(/Cannot move/);
  });

  it('computes attendance and flags three school days absent in a row', () => {
    expect(attendancePct(9, 10)).toBe(90);
    expect(attendancePct(0, 0)).toBe(0);
    const flagged = chronicAbsentees(data);
    expect(flagged.map((c) => c.run)).toEqual([4, 3]);
    const stats = attendanceStats(data, flagged[0].learner);
    expect(stats).toMatchObject({ days: 11, absent: 4, present: 7, pct: 64 });
    // The Grade 4 learner the guide points at has been away two days: one more makes three.
    const two = classLearners(data, cls('Grade 4').id).filter((l) => consecutiveAbsences(data, l) === 2);
    expect(two).toHaveLength(1);
    const marks = new Map(classLearners(data, cls('Grade 4').id).map((l) => [refNum(l), l.id === two[0].id ? { code: 'A' as const, reason: 'sick' } : { code: 'P' as const, reason: '' }]));
    const reg: DemoRecord = { ...draft('Grade 6'), id: 'registers_new', status: 'submitted', values: { class: cls('Grade 4').id, date: TODAY, marks: formatMarks(marks) } };
    const after = { ...data, collections: { ...data.collections, registers: [...records(data, 'registers'), reg] } };
    expect(consecutiveAbsences(after, two[0])).toBe(3);
    expect(chronicAbsentees(after)).toHaveLength(3);
  });

  it('round-trips the compact register format', () => {
    const marks = parseMarks('12P,13A:sick,14L,15A');
    expect(marks.get(13)).toEqual({ code: 'A', reason: 'sick' });
    expect(marks.get(15)).toEqual({ code: 'A', reason: '' });
    expect(formatMarks(marks)).toBe('12P,13A:sick,14L,15A');
  });
});

describe('timetable and substitute cover', () => {
  const leave = () => get('leave', 'leave_1');

  it('refuses to put a teacher in two classes in the same period', () => {
    const g4 = cls('Grade 4');
    const slot = slotsOf(timetableOf(data, g4.id)).findIndex((s) => s?.subject === 'ENG');
    const zanele = staffNamed('Zanele');
    expect(slotProblem(data, g4.id, slot, zanele)).toBeNull(); // her own lesson
    expect(slotProblem(data, cls('Grade 5').id, slot, zanele)).toMatch(/Zanele Khumalo already teaches English to Grade 4 on .* a teacher cannot be in two classes in the same period/);
    expect(slotProblem(data, cls('Grade 5').id, slot, staffNamed('Refilwe'))).toBeNull();
    expect(slotProblem(data, g4.id, slot, undefined)).toMatch(/Choose a teacher/);
    // A double-booking that slipped in (for example through an import) is found.
    const tt = timetableOf(data, cls('Grade 5').id)!;
    const slots = [...parseSlots(tt.values.slots)];
    slots[slot] = { subject: 'MAT', teacher: refNum(zanele) };
    const clash = timetableClashes(swap('timetables', withValues(tt, { slots: slots.map((s) => (s ? `${s.subject}@${s.teacher}` : '-')).join(',') })));
    expect(clash).toHaveLength(1);
    expect(clash[0]).toMatchObject({ slot, teacher: { id: zanele.id } });
  });

  it('lists the absent teacher’s lessons for the day as periods needing cover', () => {
    const need = coverNeeded(leave(), data);
    expect(timetableDay(TODAY)).toBe(3);
    expect(need).toHaveLength(6);
    expect(need.every((t) => t.subject === 'SCI' && Math.floor(t.slot / 6) === 3)).toBe(true);
    expect(coverGaps(leave(), data)).toHaveLength(6);
    expect(reason(move('leave', leave(), 'covered', 'u_deputy'))).toMatch(/No substitute yet for period 1/);
    expect(reason(move('leave', leave(), 'covered', 'u_secretary'))).toMatch(/permission/);
  });

  it('explains why each teacher can or cannot cover a period', () => {
    const slot = coverNeeded(leave(), data)[0].slot;
    const why = (first: string) => coverCandidateProblem(leave(), slot, staffNamed(first), data);
    expect(why('Pieter')).toBeNull();
    expect(why('Sipho')).toBe('is the absent teacher');
    expect(why('Elmarie')).toBe('is not teaching staff');
    expect(why('Refilwe')).toMatch(/is absent that day \(training/);
    expect(why('Rajesh')).toMatch(/is teaching Mathematics to Grade \d+ in period 1/);
    const list = coverCandidates(leave(), slot, data);
    expect(list.filter((c) => !c.problem).length).toBeGreaterThanOrEqual(2);
    expect(list.findIndex((c) => c.problem)).toBe(list.filter((c) => !c.problem).length); // eligible first
  });

  it('will not confirm cover that double-books a substitute', () => {
    const need = coverNeeded(leave(), data);
    const busy = staffNamed('Rajesh');
    const clash = withValues(leave(), { cover: formatCover(new Map(need.map((t) => [t.slot, refNum(busy)]))) });
    expect(reason(move('leave', clash, 'covered', 'u_deputy'))).toMatch(/Rajesh Naidoo is teaching .* a teacher cannot be in two classes in the same period/);
    const free = withValues(leave(), { cover: formatCover(new Map(need.map((t) => [t.slot, refNum(staffNamed('Pieter'))]))) });
    expect(move('leave', free, 'covered', 'u_deputy')).toMatchObject({ ok: true });
    // The same substitute cannot cover two absent teachers in the same period.
    const other: DemoRecord = { ...leave(), id: 'leave_x', ref: 'AB-0099', values: { ...leave().values, staff: staffNamed('Megan').id, cover: '' } };
    const both = { ...swap('leave', free), collections: { ...swap('leave', free).collections, leave: [...records(swap('leave', free), 'leave'), other] } };
    const shared = coverNeeded(other, both).find((t) => need.some((n) => n.slot === t.slot))!;
    expect(coverCandidateProblem(other, shared.slot, staffNamed('Pieter'), both)).toMatch(/is already covering Grade \d+ in period/);
  });

  it('gives every class a full week and every teacher at most one class per period', () => {
    for (const c of sortedClasses(data)) expect(slotsOf(timetableOf(data, c.id)).every((s) => !!s)).toBe(true);
    for (const s of records(data, 'staff')) expect(new Set(teacherLessons(data, s).map((t) => t.slot)).size).toBe(teacherLessons(data, s).length);
  });
});

describe('assessment and marks rules', () => {
  const guided = () => get('assessments', 'assessments_1');

  it('will not submit marks while a learner has neither a mark nor “absent”', () => {
    expect(str(guided(), 'title')).toBe('Term test');
    expect(reason(move('assessments', guided(), 'captured', 'u_teacher'))).toMatch(/2 learners have no mark/);
    const scores = parseScores(guided().values.marks);
    const missing = classLearners(data, str(guided(), 'class')).filter((l) => !scores.has(refNum(l)));
    scores.set(refNum(missing[0]), 31).set(refNum(missing[1]), 'A');
    expect(move('assessments', withValues(guided(), { marks: formatScores(scores) }), 'captured', 'u_teacher')).toMatchObject({ ok: true });
    expect(reason(move('assessments', withValues(guided(), { marks: formatScores(scores) }), 'captured', 'u_bursar'))).toMatch(/permission/);
  });

  it('will not accept a mark above the total', () => {
    const scores = parseScores(guided().values.marks);
    for (const l of classLearners(data, str(guided(), 'class'))) if (!scores.has(refNum(l))) scores.set(refNum(l), 55);
    expect(reason(move('assessments', withValues(guided(), { marks: formatScores(scores) }), 'captured', 'u_teacher'))).toMatch(/55 is not a mark out of 50\. Marks cannot exceed the total/);
  });

  it('needs a second person to moderate', () => {
    const captured = withValues(task('Grade 5', 'NST', 'Term test'), {}, 'captured');
    expect(str(captured, 'capturedBy')).toBe('Priya Govender');
    expect(move('assessments', captured, 'moderated', 'u_teacher')).toMatchObject({ ok: true });
    const own = withValues(captured, { capturedBy: user('u_teacher').name });
    expect(reason(move('assessments', own, 'moderated', 'u_teacher'))).toMatch(/moderated by someone other than the person who captured them \(Zanele Khumalo\)/);
    expect(move('assessments', own, 'moderated', 'u_deputy')).toMatchObject({ ok: true });
    expect(reason(move('assessments', own, 'published', 'u_deputy'))).toMatch(/Cannot move/); // not before moderation
  });

  it('needs a subject’s weightings to add up to 100% before its last task is published', () => {
    const maths = get('assessments', 'assessments_2');
    expect(maths.status).toBe('moderated');
    expect(weightSum(siblingTasks(maths, data))).toBe(90);
    expect(reason(move('assessments', maths, 'published', 'u_deputy'))).toMatch(/add up to 90%, not 100%.*set its weighting to 50%/);
    expect(reason(move('assessments', maths, 'published', 'u_teacher'))).toMatch(/permission/);
    expect(move('assessments', withValues(maths, { weight: 50 }), 'published', 'u_deputy')).toMatchObject({ ok: true });
    // Not the last task of the subject: the weightings can still be settled later.
    const other = siblingTasks(maths, data).find((t) => t.id !== maths.id)!;
    expect(move('assessments', maths, 'published', 'u_deputy', undefined, swap('assessments', withValues(other, {}, 'moderated')))).toMatchObject({ ok: true });
  });

  it('computes the term percentage from published tasks, weighted, leaving out a missed task', () => {
    const g7 = cls('Grade 7');
    const [a, b] = classLearners(data, g7.id);
    const mk = (id: string, total: number, weight: number, marks: string, status = 'published'): DemoRecord => ({ ...get('assessments', 'assessments_1'), id, status, values: { class: g7.id, subject: 'ENG', term: '2030-T1', title: id, total, weight, marks } });
    const d: IndustryData = { ...data, collections: { ...data.collections, assessments: [mk('t1', 50, 40, `${refNum(a)}:30,${refNum(b)}:A`), mk('t2', 100, 60, `${refNum(a)}:60,${refNum(b)}:45`), mk('t3', 20, 50, `${refNum(a)}:20,${refNum(b)}:20`, 'moderated')] } };
    expect(termPercent(d, a, 'ENG', '2030-T1')).toBe(60); // 0.4 × 60% + 0.6 × 60%
    expect(termPercent(d, b, 'ENG', '2030-T1')).toBe(45); // the missed task is left out and the other re-weighted
    expect(termPercent(d, a, 'MAT', '2030-T1')).toBeNull();
    expect(subjectAverage(d, g7.id, 'ENG', '2030-T1')).toBe(53);
    expect(formatScores(parseScores('12:34,13:A,14:27.5'))).toBe('12:34,13:A,14:27.5');
  });
});

describe('report card rules', () => {
  it('cannot be signed until every subject has published marks and the teacher has commented', () => {
    const ready = get('reports', 'reports_1');
    const blocked = get('reports', 'reports_2');
    expect(signBlockers(ready, data)).toEqual([]);
    expect(move('reports', ready, 'signed', 'u_principal')).toMatchObject({ ok: true });
    expect(reason(move('reports', ready, 'signed', 'u_deputy'))).toMatch(/permission/);
    expect(signBlockers(blocked, data).map((b) => b.text)).toEqual(['English — Term test is not published yet', 'Mathematics — Term test is not published yet']);
    expect(reason(move('reports', blocked, 'signed', 'u_principal'))).toMatch(/Cannot sign yet — 2 subject marks are not final: English — Term test/);
    // Once both tasks are published the same report can be signed.
    const published = patched('assessments', (t) => (str(t, 'class') === cls('Grade 4').id ? { ...t, status: 'published' } : t));
    expect(move('reports', blocked, 'signed', 'u_principal', undefined, published)).toMatchObject({ ok: true });
    expect(reason(move('reports', withValues(ready, { comment: '' }), 'signed', 'u_principal'))).toMatch(/there is no teacher comment/);
  });

  it('needs a comment to be submitted and cannot be released unsigned', () => {
    const draft = records(data, 'reports').find((r) => r.status === 'draft')!;
    expect(reason(move('reports', draft, 'commented', 'u_teacher'))).toMatch(/Write the class teacher’s comment first/);
    expect(move('reports', withValues(draft, { comment: 'A pleasing term with steady progress.' }), 'commented', 'u_teacher')).toMatchObject({ ok: true });
    expect(reason(move('reports', draft, 'released', 'u_principal'))).toMatch(/Cannot move from "Draft" to "Released to parents"/);
    expect(reason(move('reports', get('reports', 'reports_1'), 'released', 'u_principal'))).toMatch(/Cannot move from "Teacher commented"/);
    const signed = records(data, 'reports').find((r) => r.status === 'signed')!;
    expect(move('reports', signed, 'released', 'u_principal')).toMatchObject({ ok: true });
  });

  it('shows live figures until sign-off and frozen figures afterwards', () => {
    const live = get('reports', 'reports_1');
    expect(reportResults(live, data).map((r) => r.subject)).toEqual(['ENG', 'MAT', 'NST', 'SSC']);
    expect(reportResults(live, data).every((r) => r.pct !== null)).toBe(true);
    expect(reportResults(get('reports', 'reports_2'), data).filter((r) => r.pct === null)).toHaveLength(0); // one published task per subject still gives a figure
    const old = records(data, 'reports').find((r) => str(r, 'term') === '2026-T3')!;
    const emptied = { ...data, collections: { ...data.collections, assessments: [] } };
    expect(reportResults(old, emptied)).toEqual(reportResults(old, data));
    expect(reportResults(old, data)[0].pct).toBeGreaterThan(0);
  });
});

describe('fee rules', () => {
  const late = () => schoolAgeing(data, TODAY);

  it('applies the sibling discount to every child but the one with the highest fee', () => {
    expect(siblingDiscount([5400000])).toEqual([5400000]);
    expect(siblingDiscount([4680000, 7200000, 5400000])).toEqual([4212000, 7200000, 4860000]);
    const three = records(data, 'families').find((f) => records(data, 'learners').filter((l) => str(l, 'family') === f.id).length === 3)!;
    const fees = familyFees(data, three.id, 12);
    expect(fees.rows).toHaveLength(3);
    expect(fees.rows.filter((r) => r.discount === 0)).toHaveLength(1);
    for (const r of fees.rows.filter((x) => x.discount > 0)) expect(r.discount).toBe(Math.round(r.annual * 0.1));
    expect(fees.monthly).toBe(fees.rows.reduce((n, r) => n + r.monthly, 0));
    expect(familyFees(data, three.id, 10).monthly).toBeGreaterThan(fees.monthly);
  });

  it('bills ten-month plans February to November only', () => {
    expect(billsIn(12, '2026-01')).toBe(true);
    expect(billsIn(10, '2026-01')).toBe(false);
    expect(billsIn(10, '2026-12')).toBe(false);
    expect(billsIn(10, '2026-06')).toBe(true);
    expect(billingProblem(data, '2026-10')).toMatch(/already been raised/);
    expect(billingProblem(data, '2026-11')).toBeNull();
    expect(accountsToBill(data, '2026-11')).toHaveLength(95);
    expect(accountsToBill(data, '2026-12').length).toBeLessThan(95);
    expect(runTotal(records(data, 'billingRuns').find((r) => str(r, 'month') === '2026-10'))).toBe(accountsToBill(data, '2026-10').reduce((n, x) => n + x.cents, 0));
  });

  it('ages arrears from the oldest unpaid invoice', () => {
    const account: DemoRecord = { ...records(data, 'accounts')[0], id: 'acc_x', ref: 'FA-0999', values: { family: 'none', months: '12', ledger: [ledgerEntry('2026-07-03', 400000, 'eft'), ledgerEntry('2026-08-20', 150000, 'cash')].join(',') } };
    const run = (month: string): DemoRecord => ({ ...records(data, 'billingRuns')[0], id: `run_${month}`, values: { month, date: `${month}-01`, lines: formatLines(new Map([[999, 400000]])) } });
    const d: IndustryData = { ...data, collections: { ...data.collections, accounts: [account], billingRuns: ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map(run), payments: [] } };
    expect(accountEntries(account, d).map((e) => e.kind)).toEqual(['invoice', 'payment', 'invoice', 'payment', 'invoice', 'invoice', 'invoice']);
    expect(accountBalance(account, d)).toBe(5 * 400000 - 550000);
    // July is settled, August is R1,500 short of R4,000 (90+ days), September 60, October 30, November current.
    expect(ageing(account, d, TODAY)).toEqual({ current: 400000, d30: 400000, d60: 400000, d90: 250000, total: 1450000 });
    expect(arrearsOf(ageing(account, d, TODAY))).toBe(1050000);
    expect(parseLedger('260203:4800,260305:4666.67:c:Enrolment deposit').map((e) => [e.date, e.cents, e.label])).toEqual([['2026-02-03', 480000, 'Payment — EFT'], ['2026-03-05', 466667, 'Enrolment deposit — Card']]);
    expect([...parseLines('12=4800,13=4666.67')]).toEqual([[12, 480000], [13, 466667]]);
  });

  it('seeds realistic arrears and this month’s collections', () => {
    const a = late();
    expect(a.inArrears.length).toBeGreaterThanOrEqual(11);
    expect(a.d30).toBeGreaterThan(0);
    expect(a.d60).toBeGreaterThan(0);
    expect(a.d90).toBeGreaterThan(0);
    expect(a.rows.filter((r) => r.balance === 0).length).toBeGreaterThan(60);
    expect(collectedIn(data, '2026-11')).toBeGreaterThan(0);
    expect(collectedIn(data, '2026-10')).toBeLessThan(runTotal(records(data, 'billingRuns').find((r) => str(r, 'month') === '2026-10')));
  });

  it('refuses a payment above the balance owing', () => {
    const [ok, over, loose] = ['payments_1', 'payments_2', 'payments_3'].map((id) => get('payments', id));
    expect(move('payments', ok, 'allocated', 'u_bursar')).toMatchObject({ ok: true });
    expect(reason(move('payments', over, 'allocated', 'u_bursar'))).toMatch(/is more than the R[\d,]+\.00 owing on the .* family account\. A payment cannot exceed the balance/);
    const account = get('accounts', str(over, 'account'));
    expect(move('payments', withValues(over, { amount: accountBalance(account, data) / 100 }), 'allocated', 'u_bursar')).toMatchObject({ ok: true });
    expect(reason(move('payments', loose, 'allocated', 'u_bursar'))).toMatch(/Choose the family account/);
    expect(reason(move('payments', ok, 'allocated', 'u_secretary'))).toMatch(/permission/);
    expect(paymentProblem(account, 0, data)).toMatch(/Enter the amount received/);
    const paidUp = late().rows.find((r) => r.balance === 0)!.account;
    expect(paymentProblem(paidUp, 100, data)).toMatch(/Nothing is owing/);
    // An allocated payment reduces the balance.
    const allocated = swap('payments', { ...ok, status: 'allocated' });
    expect(accountBalance(get('accounts', str(ok, 'account')), allocated)).toBe(accountBalance(get('accounts', str(ok, 'account')), data) - Math.round(num(ok, 'amount') * 100));
  });

  it('only approves an arrangement that clears the arrears, and only by the bursar', () => {
    const proposed = records(data, 'arrangements').find((a) => a.status === 'proposed')!;
    expect(move('arrangements', proposed, 'approved', 'u_bursar')).toMatchObject({ ok: true });
    expect(reason(move('arrangements', withValues(proposed, { instalment: 100, months: 3 }), 'approved', 'u_bursar'))).toMatch(/R100\.00 × 3 months = R300\.00, which does not clear the arrears/);
    expect(reason(move('arrangements', proposed, 'approved', 'u_secretary'))).toMatch(/permission/);
    const active = records(data, 'arrangements').find((a) => a.status === 'active')!;
    expect(reason(move('arrangements', active, 'completed', 'u_bursar'))).toMatch(/still has R[\d,.]+ in arrears/);
    expect(reason(move('arrangements', active, 'defaulted', 'u_bursar'))).toMatch(/note is required/);
  });
});

describe('discipline, staff and notices', () => {
  it('needs parent contact before an incident is resolved, and the deputy for a serious one', () => {
    const serious = records(data, 'discipline').find((r) => str(r, 'severity') === 'serious' && r.status === 'contacted')!;
    expect(reason(move('discipline', serious, 'resolved', 'u_teacher'))).toMatch(/serious incident is resolved by the deputy or the principal — switch to Dr Nomvula Mokoena \(Principal\) or Pieter van der Merwe/);
    expect(reason(move('discipline', serious, 'resolved', 'u_deputy'))).toMatch(/Record the outcome first/);
    expect(move('discipline', withValues(serious, { resolution: 'Meeting held; written apology.' }), 'resolved', 'u_deputy')).toMatchObject({ ok: true });
    const logged = records(data, 'discipline').find((r) => str(r, 'kind') === 'incident' && str(r, 'severity') === 'minor' && r.status === 'logged')!;
    expect(reason(move('discipline', logged, 'contacted', 'u_teacher'))).toMatch(/Record how and when the parent was contacted/);
    expect(reason(move('discipline', withValues(logged, { resolution: 'Warning.' }), 'resolved', 'u_teacher'))).toMatch(/Contact the parent before resolving/);
    const merit = records(data, 'discipline').find((r) => str(r, 'kind') === 'merit' && r.status === 'logged')!;
    expect(move('discipline', merit, 'resolved', 'u_teacher')).toMatchObject({ ok: true });
    const points = learnerPoints(data, str(serious, 'learner'));
    expect(points.demerits).toBeGreaterThanOrEqual(5);
    expect(points.net).toBe(points.merits - points.demerits);
  });

  it('flags SACE expiry and a missing police clearance', () => {
    const flags = (first: string) => config.collections.find((c) => c.key === 'staff')!.flags!(staffNamed(first), data, TODAY).map((f) => f.label);
    expect(flags('Kagiso').join(' ')).toMatch(/SACE registration expired/);
    expect(flags('Chantal').join(' ')).toMatch(/SACE registration expires in 31 days/);
    expect(flags('Yolanda')).toContain('No police clearance on file');
    expect(flags('Sipho')).toContain('Absent today');
    expect(flags('Zanele')).toEqual([]);
  });

  it('approves a notice before it is logged as sent, and never sends anything', () => {
    const draft = records(data, 'notices').find((n) => n.status === 'draft')!;
    expect(reason(move('notices', draft, 'approved', 'u_secretary'))).toMatch(/permission/);
    expect(move('notices', draft, 'approved', 'u_deputy')).toMatchObject({ ok: true });
    expect(reason(move('notices', withValues(draft, { body: 'Short' }), 'approved', 'u_deputy'))).toMatch(/Write the message first/);
    expect(reason(move('notices', draft, 'sent', 'u_secretary'))).toMatch(/Cannot move/);
    expect(wf('notices').transitions.find((t) => t.to === 'sent')!.label).toMatch(/simulated/);
  });

  it('knows the terms and school days', () => {
    expect(termOf('2026-11-12')).toBe('2026-T4');
    expect(prevTerm('2026-T4')).toBe('2026-T3');
    expect(prevTerm('2026-T1')).toBe('2025-T4');
    expect(termRange('2026-T1')).toEqual({ start: '2026-01-01', end: '2026-03-31' });
    expect(isSchoolDay('2026-11-14', TODAY)).toBe(false); // a Saturday
    expect(isSchoolDay('2026-11-14', '2026-11-14')).toBe(true); // …unless it is today
    expect(timetableDay('2026-11-14')).toBe(0);
  });
});

describe('guide steps on a fresh seed, through the store', () => {
  const store = () => useStore.getState();
  const live = () => store().data.education!;
  const rec = (collection: string, id: string) => findRecord(live(), collection, id)!;
  const failure = (res: ReturnType<ReturnType<typeof store>['transition']>) => (res.ok ? '' : res.reason);
  const named = (first: string) => records(live(), 'staff').find((s) => str(s, 'firstName') === first)!;
  const today = todayIso();

  beforeAll(() => {
    setTodayForTests(null);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store().reset(config);
  });
  afterAll(() => { vi.useRealTimers(); setTodayForTests(TODAY); });

  it('1 · takes and submits the Grade 4 register', () => {
    store().signInAs('education', 'u_teacher');
    const g4 = records(live(), 'classes').find((c) => str(c, 'name') === 'Grade 4')!;
    const roll = classLearners(live(), g4.id);
    const marks = new Map(roll.map((l, i) => [refNum(l), i === 5 ? { code: 'A' as const, reason: '' } : { code: 'P' as const, reason: '' }]));
    const reg = store().createRecord(config, 'registers', { class: g4.id, date: today, marks: formatMarks(marks) }, 'draft');
    expect(failure(store().transition(config, 'registers', reg.id, 'submitted'))).toMatch(/Choose a reason for each absence/);
    marks.set(refNum(roll[5]), { code: 'A', reason: 'sick' });
    store().updateRecord(config, 'registers', reg.id, { marks: formatMarks(marks) });
    expect(store().transition(config, 'registers', reg.id, 'submitted')).toMatchObject({ ok: true });
    expect(rec('registers', reg.id)).toMatchObject({ status: 'submitted', values: { takenBy: 'Zanele Khumalo' } });
    expect(registersOutstanding(live(), today)).toHaveLength(5);
  });

  it('2 · takes an application to an enrolled learner with a class place and a fee account', () => {
    store().signInAs('education', 'u_secretary');
    const id = 'applications_1';
    const before = { learners: records(live(), 'learners').length, families: records(live(), 'families').length, accounts: records(live(), 'accounts').length };
    expect(failure(store().transition(config, 'applications', id, 'documents'))).toMatch(/immunisation card/);
    store().updateRecord(config, 'applications', id, { docImmunisation: true }, 'Immunisation card received');
    expect(store().transition(config, 'applications', id, 'documents')).toMatchObject({ ok: true });
    store().updateRecord(config, 'applications', id, { assessmentDate: today, outcome: 'ready', assessmentNote: 'Ready for Grade 2.' });
    expect(store().transition(config, 'applications', id, 'assessed')).toMatchObject({ ok: true });
    expect(store().transition(config, 'applications', id, 'offered')).toMatchObject({ ok: true });
    const g2 = records(live(), 'classes').find((c) => str(c, 'name') === 'Grade 2')!;
    expect(rec('applications', id).values).toMatchObject({ placedClass: g2.id, offerDate: today });
    expect(classRoom(live(), g2)).toMatchObject({ enrolled: 11, held: 1, free: 0 });
    expect(failure(store().transition(config, 'applications', id, 'enrolled'))).toMatch(/Record the enrolment deposit of R2,500\.00/);
    store().updateRecord(config, 'applications', id, { depositAmount: 2500, depositMethod: 'card' });
    expect(store().transition(config, 'applications', id, 'enrolled')).toMatchObject({ ok: true });
    expect(records(live(), 'learners')).toHaveLength(before.learners + 1);
    expect(records(live(), 'families')).toHaveLength(before.families + 1);
    expect(records(live(), 'accounts')).toHaveLength(before.accounts + 1);
    const learner = rec('learners', str(rec('applications', id), 'learner'));
    expect(learner).toMatchObject({ status: 'enrolled', values: { firstName: 'Lulama', lastName: 'Mkhize', class: g2.id, enrolled: today } });
    expect(classRoom(live(), g2)).toMatchObject({ enrolled: 12, held: 0, free: 0 });
    const account = accountOf(live(), str(learner, 'family'))!;
    expect(accountBalance(account, live())).toBe(-250000); // the deposit is a credit until the first invoice
    expect(accountEntries(account, live())[0].label).toBe('Enrolment deposit — Card');
    expect(familyFees(live(), str(learner, 'family'), 12).monthly).toBe(390000);
  });

  it('2b · enrols a sibling onto the family’s existing account', () => {
    const sibling = records(live(), 'applications').find((a) => a.status === 'assessed' && str(a, 'family'))!;
    const families = records(live(), 'families').length;
    const account = accountOf(live(), str(sibling, 'family'))!;
    const before = familyFees(live(), str(sibling, 'family'), 12);
    expect(store().transition(config, 'applications', sibling.id, 'offered')).toMatchObject({ ok: true });
    store().updateRecord(config, 'applications', sibling.id, { depositAmount: 2500, depositMethod: 'eft' });
    expect(store().transition(config, 'applications', sibling.id, 'enrolled')).toMatchObject({ ok: true });
    expect(records(live(), 'families')).toHaveLength(families);
    expect(accountOf(live(), str(sibling, 'family'))!.id).toBe(account.id);
    const after = familyFees(live(), str(sibling, 'family'), 12);
    expect(after.rows).toHaveLength(before.rows.length + 1);
    expect(after.rows.filter((r) => r.discount > 0)).toHaveLength(before.rows.length);
  });

  it('3 · covers the absent teacher period by period', () => {
    store().signInAs('education', 'u_deputy');
    const leave = () => rec('leave', 'leave_1');
    const need = coverNeeded(leave(), live());
    expect(failure(store().transition(config, 'leave', 'leave_1', 'covered'))).toMatch(/No substitute yet/);
    const cover = new Map<number, number>();
    for (const t of need) cover.set(t.slot, refNum(coverCandidates(leave(), t.slot, live()).find((c) => !c.problem)!.staff));
    store().updateRecord(config, 'leave', 'leave_1', { cover: formatCover(cover) });
    expect(coverGaps(leave(), live())).toEqual([]);
    expect(store().transition(config, 'leave', 'leave_1', 'covered')).toMatchObject({ ok: true });
    expect(coverCandidateProblem(leave(), need[0].slot, named('Sipho'), live())).toBe('is the absent teacher');
  });

  it('4 · captures, moderates (second person) and publishes marks', () => {
    store().signInAs('education', 'u_teacher');
    const id = 'assessments_1';
    expect(failure(store().transition(config, 'assessments', id, 'captured'))).toMatch(/2 learners have no mark/);
    const scores = parseScores(rec('assessments', id).values.marks);
    for (const l of classLearners(live(), str(rec('assessments', id), 'class'))) if (!scores.has(refNum(l))) scores.set(refNum(l), 33);
    store().updateRecord(config, 'assessments', id, { marks: formatScores(scores) });
    expect(store().transition(config, 'assessments', id, 'captured')).toMatchObject({ ok: true });
    expect(str(rec('assessments', id), 'capturedBy')).toBe('Zanele Khumalo');
    expect(failure(store().transition(config, 'assessments', id, 'moderated'))).toMatch(/someone other than the person who captured them/);
    store().signInAs('education', 'u_deputy');
    expect(store().transition(config, 'assessments', id, 'moderated')).toMatchObject({ ok: true });
    expect(str(rec('assessments', id), 'moderatedBy')).toBe('Pieter van der Merwe');
    expect(store().transition(config, 'assessments', id, 'published')).toMatchObject({ ok: true });
  });

  it('5 · signs and releases a report card, freezing its figures', () => {
    store().signInAs('education', 'u_principal');
    const before = reportResults(rec('reports', 'reports_1'), live());
    expect(store().transition(config, 'reports', 'reports_1', 'signed')).toMatchObject({ ok: true });
    const signed = rec('reports', 'reports_1');
    expect(signed.values).toMatchObject({ signedBy: 'Dr Nomvula Mokoena', signedOn: today });
    expect(str(signed, 'results')).toMatch(/^ENG:\d+,MAT:\d+,NST:\d+,SSC:\d+$/);
    expect(reportResults(signed, { ...live(), collections: { ...live().collections, assessments: [] } })).toEqual(before);
    expect(store().transition(config, 'reports', 'reports_1', 'released')).toMatchObject({ ok: true });
    expect(str(rec('reports', 'reports_1'), 'releasedOn')).toBe(today);
    // The Grade 4 report still waits for the Mathematics test (90% weightings) even though English is now published.
    expect(failure(store().transition(config, 'reports', 'reports_2', 'signed'))).toMatch(/1 subject mark is not final: Mathematics — Term test/);
  });

  it('6 · raises the month’s invoices once and records a payment up to the balance', () => {
    store().signInAs('education', 'u_bursar');
    const month = today.slice(0, 7);
    expect(billingProblem(live(), month)).toBeNull();
    const toBill = accountsToBill(live(), month);
    const owingBefore = schoolAgeing(live(), today).rows.reduce((n, r) => n + r.balance, 0);
    store().createRecord(config, 'billingRuns', { month, date: today, lines: formatLines(new Map(toBill.map((x) => [refNum(x.account), x.cents]))) });
    expect(billingProblem(live(), month)).toMatch(/already been raised/);
    expect(schoolAgeing(live(), today).rows.reduce((n, r) => n + r.balance, 0)).toBe(owingBefore + toBill.reduce((n, x) => n + x.cents, 0));
    const worst = [...schoolAgeing(live(), today).inArrears].sort((a, b) => b.age.d90 - a.age.d90)[0];
    expect(paymentProblem(worst.account, worst.balance / 100 + 1, live())).toMatch(/A payment cannot exceed the balance/);
    expect(paymentProblem(worst.account, 2000, live())).toBeNull();
    store().createRecord(config, 'payments', { account: worst.account.id, date: today, amount: 2000, method: 'eft', reference: 'TEST' }, 'allocated');
    expect(accountBalance(rec('accounts', worst.account.id), live())).toBe(worst.balance - 200000);
  });
});
