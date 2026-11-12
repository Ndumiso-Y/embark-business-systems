// Rules, lookups and sums for the school demo. Pure functions over the demo data so they can be
// unit tested and shared by the workflow guards and the pages. Marks and promotion rules here are
// demo rules, not CAPS policy.
import type { DemoRecord, DemoUser, EffectContext, Flag, IndustryData } from '../../core/types';
import { can, findRecord, num, str } from '../../core/engine';
import { daysBetween, formatDate, monthLabel, parseIso } from '../../core/lib/dates';
import { formatRand } from '../../core/lib/money';
import {
  ABSENCE_REASONS, CHRONIC_DAYS, DAYS, DOCUMENTS, DUE_DAY, LEAVE_REASONS, PASS_MARK, PERIODS, PERIOD_TIMES, SACE_WARN_DAYS, SIBLING_DISCOUNT_PCT, SLOTS,
  gradeIndex, gradeLabel, label, subjectLabel, subjectsForGrade,
} from './data';

/* ---------------- "Today" indirection (tests pin the date) ---------------- */
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------------- Small utilities ---------------- */
export const rand = (cents: number) => formatRand(cents);
export const toCents = (r: unknown) => Math.round((Number(r) || 0) * 100);
export const fullName = (r: DemoRecord | undefined) => (r ? `${str(r, 'firstName')} ${str(r, 'lastName')}`.trim() : '—');
/** Numeric part of a reference: LR-0012 → 12. Compact lists (marks, registers, cover) key people by it. */
export const refNum = (r: DemoRecord | undefined) => (r ? Number(r.ref.split('-').pop()) || 0 : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listNames = (list: DemoRecord[], max = 3) => `${list.slice(0, max).map(fullName).join(', ')}${list.length > max ? ` and ${list.length - max} more` : ''}`;

const EMPTY: DemoRecord[] = [];
const col = (data: IndustryData, key: string): DemoRecord[] => data.collections[key] ?? EMPTY;
const memoStore = new WeakMap<object, Map<string, unknown>>();
/** Cache a derived index against the (immutable) array or record it was built from. */
function memo<T>(key: object, name: string, build: () => T): T {
  let m = memoStore.get(key);
  if (!m) { m = new Map(); memoStore.set(key, m); }
  if (!m.has(name)) m.set(name, build());
  return m.get(name) as T;
}
const byNum = (data: IndustryData, key: string) => memo(col(data, key), 'byNum', () => new Map(col(data, key).map((r) => [refNum(r), r])));
export const learnerByNum = (data: IndustryData, n: number) => byNum(data, 'learners').get(n);
export const staffByNum = (data: IndustryData, n: number) => byNum(data, 'staff').get(n);

/* ---------------- School days and terms ---------------- */
export const isWeekend = (iso: string) => { const d = parseIso(iso).getDay(); return d === 0 || d === 6; };
/** Demo rule: weekdays are school days, and so is today — the demo never opens on an empty school. */
export const isSchoolDay = (iso: string, today = todayStr()) => iso === today || !isWeekend(iso);
/** Timetable column (0 = Monday) for a date. A weekend "today" follows Monday's timetable. */
export const timetableDay = (iso: string) => { const d = parseIso(iso).getDay(); return d === 0 || d === 6 ? 0 : d - 1; };

export function termOf(iso: string): string {
  return `${iso.slice(0, 4)}-T${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
}
export function prevTerm(term: string): string {
  const [y, t] = [Number(term.slice(0, 4)), Number(term.slice(6))];
  return t > 1 ? `${y}-T${t - 1}` : `${y - 1}-T4`;
}
export const termLabel = (term: string) => (/^\d{4}-T[1-4]$/.test(term) ? `Term ${term.slice(6)} · ${term.slice(0, 4)}` : term || '—');
/** First and last calendar day of a term (demo: terms follow the quarters). */
export function termRange(term: string): { start: string; end: string } {
  const [y, t] = [Number(term.slice(0, 4)), Number(term.slice(6))];
  const last = new Date(y, t * 3, 0).getDate();
  const mm = (m: number) => String(m).padStart(2, '0');
  return { start: `${y}-${mm(t * 3 - 2)}-01`, end: `${y}-${mm(t * 3)}-${mm(last)}` };
}

/* ---------------- Classes and learners ---------------- */
export const className = (data: IndustryData, id: unknown) => str(findRecord(data, 'classes', String(id ?? '')), 'name') || '—';
export const classOf = (data: IndustryData, learner: DemoRecord | undefined) => findRecord(data, 'classes', str(learner, 'class'));
export const gradeOfLearner = (data: IndustryData, learner: DemoRecord | undefined) => str(classOf(data, learner), 'grade');
export const isEnrolled = (l: DemoRecord) => l.status !== 'left';
const byName = (a: DemoRecord, b: DemoRecord) => str(a, 'lastName').localeCompare(str(b, 'lastName')) || str(a, 'firstName').localeCompare(str(b, 'firstName'));
const rollIndex = (data: IndustryData) => memo(col(data, 'learners'), 'roll', () => {
  const m = new Map<string, DemoRecord[]>();
  for (const l of col(data, 'learners')) if (isEnrolled(l)) (m.get(str(l, 'class')) ?? m.set(str(l, 'class'), []).get(str(l, 'class'))!).push(l);
  for (const list of m.values()) list.sort(byName);
  return m;
});
/** Enrolled learners in a class, by surname. */
export const classLearners = (data: IndustryData, classId: string): DemoRecord[] => rollIndex(data).get(classId) ?? EMPTY;
export const sortedClasses = (data: IndustryData) => [...col(data, 'classes')].sort((a, b) => gradeIndex(str(a, 'grade')) - gradeIndex(str(b, 'grade')) || str(a, 'name').localeCompare(str(b, 'name')));
export const enrolledLearners = (data: IndustryData) => col(data, 'learners').filter(isEnrolled);
export const familyOf = (data: IndustryData, learner: DemoRecord | undefined) => findRecord(data, 'families', str(learner, 'family'));
export const familyLearners = (data: IndustryData, familyId: string) => col(data, 'learners').filter((l) => isEnrolled(l) && str(l, 'family') === familyId);
export const familyName = (data: IndustryData, id: unknown) => { const f = findRecord(data, 'families', String(id ?? '')); return f ? `${str(f, 'surname')} family` : '—'; };

/** Places in a class: enrolled learners plus places held by offers that have not been accepted yet. */
export function classRoom(data: IndustryData, cls: DemoRecord, exceptApplication?: string) {
  const enrolled = classLearners(data, cls.id).length;
  const held = col(data, 'applications').filter((a) => a.status === 'offered' && str(a, 'placedClass') === cls.id && a.id !== exceptApplication).length;
  const capacity = num(cls, 'capacity');
  return { enrolled, held, capacity, free: Math.max(0, capacity - enrolled - held) };
}
export function gradeRoom(data: IndustryData, grade: string, exceptApplication?: string) {
  const rooms = col(data, 'classes').filter((c) => str(c, 'grade') === grade).map((c) => ({ cls: c, ...classRoom(data, c, exceptApplication) }));
  return { rooms, enrolled: rooms.reduce((n, r) => n + r.enrolled, 0), held: rooms.reduce((n, r) => n + r.held, 0), capacity: rooms.reduce((n, r) => n + r.capacity, 0), free: rooms.reduce((n, r) => n + r.free, 0) };
}
/** The class in a grade with the most free places, or undefined when the grade is full. */
export function placeForGrade(data: IndustryData, grade: string, exceptApplication?: string): DemoRecord | undefined {
  return gradeRoom(data, grade, exceptApplication).rooms.filter((r) => r.free > 0).sort((a, b) => b.free - a.free)[0]?.cls;
}

export function learnerFlags(l: DemoRecord, data: IndustryData, _today: string, user?: DemoUser): Flag[] {
  const out: Flag[] = [];
  if (str(l, 'allergies').trim()) out.push(can(user, 'medical.view') ? { tone: 'red', label: `Allergy: ${str(l, 'allergies')}` } : { tone: 'dark', label: 'Medical alert — restricted' });
  if (isEnrolled(l)) {
    const run = consecutiveAbsences(data, l);
    if (run >= CHRONIC_DAYS) out.push({ tone: 'red', label: `Absent ${run} school days in a row` });
  }
  if (l.values.aftercare === true) out.push({ tone: 'blue', label: 'Aftercare' });
  return out;
}

/* ---------------- Staff ---------------- */
export const isTeaching = (s: DemoRecord | undefined) => ['teacher', 'deputy'].includes(str(s, 'role'));
export const staffOfUser = (data: IndustryData, user: DemoUser | undefined) => (user ? col(data, 'staff').find((s) => str(s, 'login') === user.id) : undefined);
export const classTaughtBy = (data: IndustryData, staffId: string) => col(data, 'classes').find((c) => str(c, 'teacher') === staffId);
/** The class a signed-in class teacher takes the register for. */
export const ownClass = (data: IndustryData, user: DemoUser | undefined) => { const s = staffOfUser(data, user); return s ? classTaughtBy(data, s.id) : undefined; };
export const leaveOn = (data: IndustryData, staffId: string, date: string) => col(data, 'leave').find((l) => str(l, 'staff') === staffId && str(l, 'date') === date);

export function staffFlags(s: DemoRecord, data: IndustryData, today: string): Flag[] {
  const out: Flag[] = [];
  const expiry = str(s, 'saceExpiry');
  if (isTeaching(s) || str(s, 'role') === 'principal') {
    if (!str(s, 'saceNo').trim()) out.push({ tone: 'red', label: 'No SACE number on file' });
    else if (expiry && expiry < today) out.push({ tone: 'red', label: `SACE registration expired ${formatDate(expiry)}` });
    else if (expiry && daysBetween(today, expiry) <= SACE_WARN_DAYS) out.push({ tone: 'amber', label: `SACE registration expires in ${daysBetween(today, expiry)} days` });
  }
  if (s.values.policeClearance !== true) out.push({ tone: 'red', label: 'No police clearance on file' });
  if (leaveOn(data, s.id, today)) out.push({ tone: 'amber', label: 'Absent today' });
  return out;
}

/* ---------------- Admissions ---------------- */
export const applicantName = (a: DemoRecord | undefined) => fullName(a);
export const missingDocs = (a: DemoRecord) => DOCUMENTS.filter((d) => a.values[d.key] !== true).map((d) => d.label);
export function documentsProblem(a: DemoRecord): string | null {
  const missing = missingDocs(a);
  return missing.length ? `Still outstanding: ${missing.join(', ').toLowerCase()}. Tick ${missing.length === 1 ? 'it' : 'each one'} under “Documents” on the application’s page when it arrives.` : null;
}
export function assessmentProblem(a: DemoRecord): string | null {
  if (!str(a, 'assessmentDate')) return 'Record the assessment or interview first: date and outcome under “Assessment / interview” on the application’s page.';
  if (!str(a, 'outcome')) return 'Choose the assessment outcome under “Assessment / interview” on the application’s page.';
  return null;
}
export function offerProblem(a: DemoRecord, data: IndustryData): string | null {
  const docs = documentsProblem(a);
  if (docs) return docs;
  if (str(a, 'outcome') === 'notready') return 'The assessment outcome is “Not ready for the grade”. Change the grade applied for or the outcome under “Assessment / interview”, or decline the application.';
  const grade = str(a, 'grade');
  const room = gradeRoom(data, grade, a.id);
  if (!room.rooms.length) return `There is no ${gradeLabel(grade)} class to place the learner in.`;
  if (room.free <= 0) return `${gradeLabel(grade)} is full: ${room.enrolled} enrolled${room.held ? ` and ${plural(room.held, 'place')} held by offers` : ''} out of ${room.capacity} places. Add the application to the waiting list — it can be offered a place when one opens.`;
  return null;
}
export const planForGrade = (data: IndustryData, grade: string) => col(data, 'feePlans').find((p) => gradeIndex(str(p, 'fromGrade')) <= gradeIndex(grade) && gradeIndex(grade) <= gradeIndex(str(p, 'toGrade')));
export const depositRequired = (a: DemoRecord, data: IndustryData) => num(planForGrade(data, str(a, 'grade')), 'deposit');
export function acceptProblem(a: DemoRecord, data: IndustryData): string | null {
  const need = depositRequired(a, data);
  if (num(a, 'depositAmount') < need) return `Record the enrolment deposit of ${rand(toCents(need))} first (“Enrolment deposit” on the application’s page)${num(a, 'depositAmount') > 0 ? ` — only ${rand(toCents(num(a, 'depositAmount')))} is recorded` : ''}.`;
  if (!str(a, 'depositMethod')) return 'Choose how the deposit was paid under “Enrolment deposit” on the application’s page.';
  const cls = findRecord(data, 'classes', str(a, 'placedClass')) ?? placeForGrade(data, str(a, 'grade'), a.id);
  if (!cls) return `${gradeLabel(str(a, 'grade'))} has no free place any more.`;
  return null;
}
/** 1-based position on the waiting list for the grade (oldest first), or 0 when not waitlisted. */
export function waitlistPosition(a: DemoRecord, data: IndustryData): number {
  if (a.status !== 'waitlisted') return 0;
  const queue = col(data, 'applications').filter((x) => x.status === 'waitlisted' && str(x, 'grade') === str(a, 'grade'))
    .sort((x, y) => str(x, 'waitlistedOn').localeCompare(str(y, 'waitlistedOn')) || refNum(x) - refNum(y));
  return queue.findIndex((x) => x.id === a.id) + 1;
}
const yymmdd = (iso: string) => iso.slice(2).replace(/-/g, '');
/** Accepting an offer: create the family (unless a sibling), the learner in the held class, and the fee account. */
export function enrolApplication({ record: a, data, api, today }: EffectContext) {
  const cls = findRecord(data, 'classes', str(a, 'placedClass')) ?? placeForGrade(data, str(a, 'grade'), a.id);
  if (!cls) return;
  let familyId = str(a, 'family');
  if (!familyId) {
    familyId = api.create('families', { surname: str(a, 'lastName'), guardian1: str(a, 'guardian'), relation1: 'Parent', phone1: str(a, 'guardianPhone'), email1: str(a, 'guardianEmail') }, undefined, `Family record opened from application ${a.ref}`).id;
  }
  const learner = api.create('learners', {
    firstName: str(a, 'firstName'), lastName: str(a, 'lastName'), class: cls.id, family: familyId, dob: str(a, 'dob'), gender: str(a, 'gender'), enrolled: today, transport: 'own', aftercare: false,
  }, 'enrolled', `Enrolled from application ${a.ref} — placed in ${str(cls, 'name')}`);
  const deposit = ledgerEntry(today, toCents(num(a, 'depositAmount')), str(a, 'depositMethod'), 'Enrolment deposit');
  const existing = accountOf(data, familyId);
  let accountRef: string;
  if (existing) {
    api.update('accounts', existing.id, { ledger: [str(existing, 'ledger'), deposit].filter(Boolean).join(',') }, `Enrolment deposit for ${fullName(learner)} credited`);
    accountRef = existing.ref;
  } else {
    accountRef = api.create('accounts', { family: familyId, months: '12', ledger: deposit }, undefined, `Fee account opened for ${fullName(learner)} — enrolment deposit credited`).ref;
  }
  api.update('applications', a.id, { learner: learner.id, placedClass: cls.id });
  api.toast(`${fullName(learner)} enrolled in ${str(cls, 'name')} (${learner.ref}) — fee account ${accountRef} ${existing ? 'updated with the sibling' : 'opened'}`);
}

/* ---------------- Daily attendance ---------------- */
export type Mark = { code: 'P' | 'A' | 'L'; reason: string };
/** Register marks are stored compactly: "12P,13A:sick,14L" (learner number, code, optional reason). */
export function parseMarks(text: unknown): Map<number, Mark> {
  const out = new Map<number, Mark>();
  for (const token of String(text ?? '').split(',')) {
    const m = /^(\d+)([PAL])(?::(.*))?$/.exec(token.trim());
    if (m) out.set(Number(m[1]), { code: m[2] as Mark['code'], reason: m[3] ?? '' });
  }
  return out;
}
export const formatMarks = (marks: Map<number, Mark>) => [...marks.entries()].sort((a, b) => a[0] - b[0]).map(([n, m]) => `${n}${m.code}${m.code === 'A' && m.reason ? `:${m.reason}` : ''}`).join(',');
export const marksOf = (reg: DemoRecord | undefined): Map<number, Mark> => (reg ? memo(reg, 'marks', () => parseMarks(reg.values.marks)) : new Map());
export const registerFor = (data: IndustryData, classId: string, date: string) => col(data, 'registers').find((r) => str(r, 'class') === classId && str(r, 'date') === date);

export function registerState(reg: DemoRecord | undefined, data: IndustryData, classId = str(reg, 'class')) {
  const roll = classLearners(data, classId);
  const marks = marksOf(reg);
  const of = (code: string) => roll.filter((l) => marks.get(refNum(l))?.code === code);
  const absent = of('A');
  return {
    roll, marks, present: of('P'), absent, late: of('L'),
    unmarked: roll.filter((l) => !marks.has(refNum(l))),
    needReason: absent.filter((l) => !marks.get(refNum(l))?.reason),
  };
}
export function registerProblem(reg: DemoRecord, data: IndustryData, today = todayStr()): string | null {
  if (str(reg, 'date') > today) return 'A register cannot be submitted for a future date.';
  const st = registerState(reg, data);
  if (!st.roll.length) return 'This class has no learners to mark.';
  if (st.unmarked.length) return `${plural(st.unmarked.length, 'learner is', 'learners are')} not marked yet: ${listNames(st.unmarked)}. Mark each one present, absent or late, or press “Mark all present”.`;
  if (st.needReason.length) return `Choose a reason for each absence — or “Unexplained” — next to the name: ${listNames(st.needReason)}.`;
  return null;
}

export type DayMark = Mark & { date: string };
/** Every learner's marks from submitted registers, oldest first. */
const attendanceIndex = (data: IndustryData) => memo(col(data, 'registers'), 'attendance', () => {
  const m = new Map<number, DayMark[]>();
  for (const reg of [...col(data, 'registers')].filter((r) => r.status === 'submitted').sort((a, b) => str(a, 'date').localeCompare(str(b, 'date')))) {
    for (const [n, mark] of marksOf(reg)) (m.get(n) ?? m.set(n, []).get(n)!).push({ ...mark, date: str(reg, 'date') });
  }
  return m;
});
export const learnerAttendance = (data: IndustryData, learner: DemoRecord): DayMark[] => attendanceIndex(data).get(refNum(learner)) ?? [];
/** Attendance % = days present or late ÷ days on a submitted register. */
export function attendancePct(present: number, days: number): number { return days ? Math.round((present / days) * 100) : 0; }
export function attendanceStats(data: IndustryData, learner: DemoRecord, from = '', to = '9999') {
  const days = learnerAttendance(data, learner).filter((d) => d.date >= from && d.date <= to);
  const absent = days.filter((d) => d.code === 'A').length;
  const late = days.filter((d) => d.code === 'L').length;
  return { days: days.length, absent, late, present: days.length - absent, pct: attendancePct(days.length - absent, days.length) };
}
/** School days absent in a row, counting back from the latest submitted register. */
export function consecutiveAbsences(data: IndustryData, learner: DemoRecord): number {
  const days = learnerAttendance(data, learner);
  let n = 0;
  for (let i = days.length - 1; i >= 0 && days[i].code === 'A'; i--) n++;
  return n;
}
export const chronicAbsentees = (data: IndustryData) => enrolledLearners(data).map((l) => ({ learner: l, run: consecutiveAbsences(data, l) })).filter((x) => x.run >= CHRONIC_DAYS).sort((a, b) => b.run - a.run);
/** Classes whose register for the day is not submitted yet. */
export const registersOutstanding = (data: IndustryData, date: string) => sortedClasses(data).filter((c) => classLearners(data, c.id).length > 0 && registerFor(data, c.id, date)?.status !== 'submitted');
export function dayAttendance(data: IndustryData, date: string, classIds?: string[]) {
  let roll = 0, present = 0, absent = 0, late = 0, registers = 0;
  for (const reg of col(data, 'registers')) {
    if (reg.status !== 'submitted' || str(reg, 'date') !== date || (classIds && !classIds.includes(str(reg, 'class')))) continue;
    registers++;
    for (const m of marksOf(reg).values()) { roll++; if (m.code === 'A') absent++; else present++; if (m.code === 'L') late++; }
  }
  return { registers, roll, present, absent, late, pct: attendancePct(present, roll) };
}
/** Dates that have at least one submitted register, oldest first. */
export const registerDates = (data: IndustryData) => memo(col(data, 'registers'), 'dates', () => [...new Set(col(data, 'registers').filter((r) => r.status === 'submitted').map((r) => str(r, 'date')))].sort());
export function absenceMessage(businessName: string, learner: DemoRecord, date: string, mark: Mark | undefined, data: IndustryData): string {
  const family = familyOf(data, learner);
  const who = str(family, 'guardian1').split(' ')[0] || 'Parent';
  const reason = mark?.reason && mark.reason !== 'unexplained' ? ` The reason recorded is “${label(ABSENCE_REASONS, mark.reason).toLowerCase()}”.` : ' No reason has been given yet — please let the school office know.';
  return `Dear ${who}, ${str(learner, 'firstName')} was marked absent from ${className(data, str(learner, 'class'))} on ${formatDate(date)}.${reason} — ${businessName}`;
}

/* ---------------- Timetable and substitute cover ---------------- */
export type Lesson = { subject: string; teacher: number };
/** A class timetable is 30 slots (5 days × 6 periods) stored as "ENG@7,MAT@8,…" (subject @ staff number). */
export function parseSlots(text: unknown): Array<Lesson | null> {
  const parts = String(text ?? '').split(',');
  return Array.from({ length: SLOTS }, (_, i) => {
    const m = /^([A-Z]+)@(\d+)$/.exec((parts[i] ?? '').trim());
    return m ? { subject: m[1], teacher: Number(m[2]) } : null;
  });
}
export const formatSlots = (slots: Array<Lesson | null>) => slots.map((s) => (s ? `${s.subject}@${s.teacher}` : '-')).join(',');
export const slotsOf = (tt: DemoRecord | undefined) => (tt ? memo(tt, 'slots', () => parseSlots(tt.values.slots)) : parseSlots(''));
export const timetableOf = (data: IndustryData, classId: string) => col(data, 'timetables').find((t) => str(t, 'class') === classId);
export const slotDay = (slot: number) => Math.floor(slot / PERIODS);
export const slotPeriod = (slot: number) => (slot % PERIODS) + 1;
export const slotLabel = (slot: number) => `${DAYS[slotDay(slot)]} period ${slotPeriod(slot)}`;
export const slotTime = (slot: number) => PERIOD_TIMES[slot % PERIODS];
export type Teaching = { slot: number; classId: string; subject: string };
const teachingIndex = (data: IndustryData) => memo(col(data, 'timetables'), 'teaching', () => {
  const m = new Map<number, Teaching[]>();
  for (const tt of col(data, 'timetables')) {
    slotsOf(tt).forEach((s, slot) => { if (s) (m.get(s.teacher) ?? m.set(s.teacher, []).get(s.teacher)!).push({ slot, classId: str(tt, 'class'), subject: s.subject }); });
  }
  return m;
});
/** Every lesson a teacher gives in the week. */
export const teacherLessons = (data: IndustryData, staff: DemoRecord | undefined): Teaching[] => teachingIndex(data).get(refNum(staff)) ?? [];
/** Why a teacher cannot be put in a class's slot: they are already teaching another class then. */
export function slotProblem(data: IndustryData, classId: string, slot: number, teacher: DemoRecord | undefined): string | null {
  if (!teacher) return 'Choose a teacher for the lesson.';
  const clash = teacherLessons(data, teacher).find((t) => t.slot === slot && t.classId !== classId);
  return clash ? `${fullName(teacher)} already teaches ${subjectLabel(clash.subject)} to ${className(data, clash.classId)} on ${slotLabel(slot)} — a teacher cannot be in two classes in the same period. Choose another teacher or another period.` : null;
}
/** Every double-booking in the school timetable (should be none). */
export function timetableClashes(data: IndustryData): Array<{ teacher: DemoRecord; slot: number; classes: string[] }> {
  const out: Array<{ teacher: DemoRecord; slot: number; classes: string[] }> = [];
  for (const [n, lessons] of teachingIndex(data)) {
    const bySlot = new Map<number, string[]>();
    for (const l of lessons) (bySlot.get(l.slot) ?? bySlot.set(l.slot, []).get(l.slot)!).push(l.classId);
    for (const [slot, classes] of bySlot) if (classes.length > 1 && staffByNum(data, n)) out.push({ teacher: staffByNum(data, n)!, slot, classes });
  }
  return out;
}

/** The absent teacher's lessons on the day of the absence: each one needs a substitute. */
export function coverNeeded(leave: DemoRecord, data: IndustryData): Teaching[] {
  const day = timetableDay(str(leave, 'date'));
  return teacherLessons(data, findRecord(data, 'staff', str(leave, 'staff'))).filter((t) => slotDay(t.slot) === day).sort((a, b) => a.slot - b.slot);
}
/** Cover is stored as "slot=staff number" pairs. */
export function parseCover(text: unknown): Map<number, number> {
  const out = new Map<number, number>();
  for (const token of String(text ?? '').split(',')) { const m = /^(\d+)=(\d+)$/.exec(token.trim()); if (m) out.set(Number(m[1]), Number(m[2])); }
  return out;
}
export const formatCover = (cover: Map<number, number>) => [...cover.entries()].sort((a, b) => a[0] - b[0]).map(([s, n]) => `${s}=${n}`).join(',');
export const coverOf = (leave: DemoRecord) => memo(leave, 'cover', () => parseCover(leave.values.cover));
/** Why this staff member cannot cover the period (null = eligible). Reads as "<name> …". */
export function coverCandidateProblem(leave: DemoRecord, slot: number, cand: DemoRecord, data: IndustryData): string | null {
  const date = str(leave, 'date');
  const period = slotPeriod(slot);
  if (cand.id === str(leave, 'staff')) return 'is the absent teacher';
  if (!isTeaching(cand)) return 'is not teaching staff';
  const away = leaveOn(data, cand.id, date);
  if (away) return `is absent that day (${label(LEAVE_REASONS, str(away, 'reason')).toLowerCase()})`;
  const lesson = teacherLessons(data, cand).find((t) => t.slot === slot);
  if (lesson) return `is teaching ${subjectLabel(lesson.subject)} to ${className(data, lesson.classId)} in period ${period}`;
  for (const other of col(data, 'leave')) {
    if (other.id === leave.id || str(other, 'date') !== date || coverOf(other).get(slot) !== refNum(cand)) continue;
    const their = coverNeeded(other, data).find((t) => t.slot === slot);
    return `is already covering ${their ? className(data, their.classId) : 'another class'} in period ${period}`;
  }
  return null;
}
/** Teaching staff with the reason each one can or cannot cover the period; eligible first. */
export function coverCandidates(leave: DemoRecord, slot: number, data: IndustryData) {
  return col(data, 'staff').filter((s) => isTeaching(s) && s.id !== str(leave, 'staff'))
    .map((s) => ({ staff: s, problem: coverCandidateProblem(leave, slot, s, data), lessons: teacherLessons(data, s).filter((t) => slotDay(t.slot) === slotDay(slot)).length }))
    .sort((a, b) => Number(!!a.problem) - Number(!!b.problem) || a.lessons - b.lessons || byName(a.staff, b.staff));
}
export function coverProblem(leave: DemoRecord, data: IndustryData): string | null {
  const cover = coverOf(leave);
  for (const t of coverNeeded(leave, data)) {
    const sub = staffByNum(data, cover.get(t.slot) ?? -1);
    const what = `period ${slotPeriod(t.slot)} (${className(data, t.classId)} · ${subjectLabel(t.subject)})`;
    if (!sub) return `No substitute yet for ${what}. Choose one under “Periods needing cover” on the record’s page.`;
    const problem = coverCandidateProblem(leave, t.slot, sub, data);
    if (problem) return `${fullName(sub)} ${problem} — a teacher cannot be in two classes in the same period. Choose someone else for ${what}.`;
  }
  return null;
}
export const coverGaps = (leave: DemoRecord, data: IndustryData) => coverNeeded(leave, data).filter((t) => !coverOf(leave).has(t.slot));

/* ---------------- Assessments and marks ---------------- */
export type Score = number | 'A';
/** Task marks are stored as "12:34,13:A" (learner number : mark, A = absent). */
export function parseScores(text: unknown): Map<number, Score> {
  const out = new Map<number, Score>();
  for (const token of String(text ?? '').split(',')) {
    const m = /^(\d+):(A|-?\d+(?:\.\d+)?)$/.exec(token.trim());
    if (m) out.set(Number(m[1]), m[2] === 'A' ? 'A' : Number(m[2]));
  }
  return out;
}
export const formatScores = (scores: Map<number, Score>) => [...scores.entries()].sort((a, b) => a[0] - b[0]).map(([n, s]) => `${n}:${s}`).join(',');
export const scoresOf = (task: DemoRecord) => memo(task, 'scores', () => parseScores(task.values.marks));
export const taskTitle = (t: DemoRecord | undefined) => (t ? `${subjectLabel(str(t, 'subject'))} — ${str(t, 'title')}` : '—');

export function taskState(task: DemoRecord, data: IndustryData) {
  const roll = classLearners(data, str(task, 'class'));
  const scores = scoresOf(task);
  const total = num(task, 'total');
  const marked = roll.map((l) => scores.get(refNum(l))).filter((s): s is number => typeof s === 'number');
  const valid = marked.filter((s) => s >= 0 && s <= total);
  const pcts = total > 0 ? valid.map((s) => (s / total) * 100) : [];
  return {
    roll, scores, total,
    unmarked: roll.filter((l) => !scores.has(refNum(l))),
    over: roll.filter((l) => { const s = scores.get(refNum(l)); return typeof s === 'number' && (s > total || s < 0); }),
    absent: roll.filter((l) => scores.get(refNum(l)) === 'A').length,
    average: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
    passRate: pcts.length ? Math.round((pcts.filter((p) => p >= PASS_MARK).length / pcts.length) * 100) : null,
    highest: pcts.length ? Math.round(Math.max(...pcts)) : null,
    lowest: pcts.length ? Math.round(Math.min(...pcts)) : null,
  };
}
/** What stops a task's marks from being submitted for moderation. */
export function captureProblem(task: DemoRecord, data: IndustryData): string | null {
  const st = taskState(task, data);
  if (!(st.total > 0)) return 'Set the total marks for the task first (Edit → Total marks).';
  if (!st.roll.length) return 'This class has no learners to mark.';
  if (st.over.length) { const l = st.over[0]; return `${fullName(l)}: ${st.scores.get(refNum(l))} is not a mark out of ${st.total}. Marks cannot exceed the total — correct it in the mark grid.`; }
  if (st.unmarked.length) return `${plural(st.unmarked.length, 'learner has', 'learners have')} no mark: ${listNames(st.unmarked)}. Enter a mark or tick “Absent” in the mark grid.`;
  return null;
}
export function moderationProblem(task: DemoRecord, user: DemoUser): string | null {
  return str(task, 'capturedBy') === user.name ? `Marks must be moderated by someone other than the person who captured them (${user.name}). Switch to another teacher or the deputy in the top bar.` : null;
}
/** Tasks for the same class, subject and term (including this one). */
export const siblingTasks = (task: DemoRecord, data: IndustryData) => col(data, 'assessments')
  .filter((t) => str(t, 'class') === str(task, 'class') && str(t, 'subject') === str(task, 'subject') && str(t, 'term') === str(task, 'term'))
  .sort((a, b) => str(a, 'date').localeCompare(str(b, 'date')) || refNum(a) - refNum(b));
export const weightSum = (tasks: DemoRecord[]) => Math.round(tasks.reduce((n, t) => n + num(t, 'weight'), 0) * 100) / 100;
/** A subject's weightings for the term must add up to 100% before its last task is published. */
export function weightingProblem(task: DemoRecord, data: IndustryData): string | null {
  if (!(num(task, 'weight') > 0)) return 'Give the task a weighting above 0% under “Weighting” on the record’s page.';
  const tasks = siblingTasks(task, data).map((t) => (t.id === task.id ? task : t));
  const last = tasks.every((t) => t.id === task.id || t.status === 'published');
  const sum = weightSum(tasks);
  if (last && sum !== 100) {
    return `The ${termLabel(str(task, 'term'))} weightings for ${subjectLabel(str(task, 'subject'))} in ${className(data, str(task, 'class'))} add up to ${sum}%, not 100%. This is the last task to publish — set its weighting to ${Math.max(0, 100 - (sum - num(task, 'weight')))}% under “Weighting” on the record’s page.`;
  }
  return null;
}
/**
 * Term % for a subject: each published task's percentage weighted by its weighting.
 * A task the learner missed is left out and the others are re-weighted. Null = no published mark.
 */
export function termPercent(data: IndustryData, learner: DemoRecord, subject: string, term: string): number | null {
  let weights = 0, acc = 0;
  const n = refNum(learner);
  for (const t of col(data, 'assessments')) {
    if (t.status !== 'published' || str(t, 'class') !== str(learner, 'class') || str(t, 'subject') !== subject || str(t, 'term') !== term) continue;
    const s = scoresOf(t).get(n);
    const total = num(t, 'total');
    if (typeof s !== 'number' || !(total > 0)) continue;
    weights += num(t, 'weight');
    acc += num(t, 'weight') * (s / total);
  }
  return weights > 0 ? Math.round((acc / weights) * 100) : null;
}
export const learnerSubjects = (data: IndustryData, learner: DemoRecord) => subjectsForGrade(gradeOfLearner(data, learner));
export function subjectAverage(data: IndustryData, classId: string, subject: string, term: string): number | null {
  const live = classLearners(data, classId).map((l) => termPercent(data, l, subject, term)).filter((p): p is number => p !== null);
  if (live.length) return Math.round(live.reduce((a, b) => a + b, 0) / live.length);
  // No published tasks (an earlier term): use the figures frozen on that term's signed report cards.
  const ids = new Set(classLearners(data, classId).map((l) => l.id));
  const frozen = col(data, 'reports').filter((r) => str(r, 'term') === term && ids.has(str(r, 'learner'))).map((r) => parseResults(r.values.results).find((x) => x.subject === subject)?.pct).filter((p): p is number => typeof p === 'number');
  return frozen.length ? Math.round(frozen.reduce((a, b) => a + b, 0) / frozen.length) : null;
}

/* ---------------- Report cards ---------------- */
export type Result = { subject: string; pct: number | null };
/** Signed report cards freeze their figures as "ENG:67,MAT:55". */
export function parseResults(text: unknown): Result[] {
  return String(text ?? '').split(',').map((t) => /^([A-Z]+):(\d+|-)$/.exec(t.trim())).filter((m): m is RegExpExecArray => !!m).map((m) => ({ subject: m[1], pct: m[2] === '-' ? null : Number(m[2]) }));
}
export const formatResults = (list: Result[]) => list.map((r) => `${r.subject}:${r.pct ?? '-'}`).join(',');
export const reportLearner = (data: IndustryData, report: DemoRecord) => findRecord(data, 'learners', str(report, 'learner'));
export const reportFor = (data: IndustryData, learnerId: string, term: string) => col(data, 'reports').find((r) => str(r, 'learner') === learnerId && str(r, 'term') === term);
export const isFrozen = (report: DemoRecord) => ['signed', 'released'].includes(report.status ?? '');
/** Subject percentages on a report: frozen once signed, live from published marks before that. */
export function reportResults(report: DemoRecord, data: IndustryData): Result[] {
  const learner = reportLearner(data, report);
  if (isFrozen(report) && str(report, 'results')) return parseResults(report.values.results);
  if (!learner) return [];
  return learnerSubjects(data, learner).map((subject) => ({ subject, pct: termPercent(data, learner, subject, str(report, 'term')) }));
}
export function reportAttendance(report: DemoRecord, data: IndustryData): { present: number; days: number; pct: number } {
  const m = /^(\d+)\/(\d+)$/.exec(str(report, 'att'));
  if (isFrozen(report) && m) return { present: Number(m[1]), days: Number(m[2]), pct: attendancePct(Number(m[1]), Number(m[2])) };
  const learner = reportLearner(data, report);
  const range = termRange(str(report, 'term'));
  const st = learner ? attendanceStats(data, learner, range.start, range.end) : { present: 0, days: 0, pct: 0 };
  return { present: st.present, days: st.days, pct: st.pct };
}
export const reportAverage = (results: Result[]) => { const p = results.map((r) => r.pct).filter((x): x is number => x !== null); return p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : null; };
/** Everything that still stops a report card from being signed. `task` links to the assessment to publish. */
export function signBlockers(report: DemoRecord, data: IndustryData): Array<{ text: string; task?: DemoRecord }> {
  const learner = reportLearner(data, report);
  if (!learner) return [{ text: 'The learner record no longer exists.' }];
  const out: Array<{ text: string; task?: DemoRecord }> = [];
  const term = str(report, 'term');
  for (const subject of learnerSubjects(data, learner)) {
    const tasks = col(data, 'assessments').filter((t) => str(t, 'class') === str(learner, 'class') && str(t, 'subject') === subject && str(t, 'term') === term);
    if (!tasks.length) out.push({ text: `${subjectLabel(subject)}: no assessment tasks for ${termLabel(term)}` });
    for (const t of tasks) if (t.status !== 'published') out.push({ text: `${taskTitle(t)} is not published yet`, task: t });
  }
  if (!str(report, 'comment').trim()) out.push({ text: 'No teacher comment yet' });
  return out;
}
export function commentProblem(report: DemoRecord): string | null {
  return str(report, 'comment').trim().length >= 10 ? null : 'Write the class teacher’s comment first (“Teacher comment” on the record’s page) — at least a sentence.';
}
export function signProblem(report: DemoRecord, data: IndustryData): string | null {
  const blockers = signBlockers(report, data);
  if (!blockers.length) return null;
  const marks = blockers.filter((b) => b.text !== 'No teacher comment yet');
  if (marks.length) return `Cannot sign yet — ${plural(marks.length, 'subject mark is', 'subject marks are')} not final: ${marks.slice(0, 2).map((b) => b.text).join('; ')}${marks.length > 2 ? ` and ${marks.length - 2} more` : ''}. See “Before sign-off” on the record’s page for links to each task.`;
  return 'Cannot sign yet — there is no teacher comment. Add one under “Teacher comment” on the record’s page.';
}
export function releaseMessage(businessName: string, report: DemoRecord, data: IndustryData): string {
  const learner = reportLearner(data, report);
  const who = str(familyOf(data, learner), 'guardian1').split(' ')[0] || 'Parent';
  return `Dear ${who}, ${str(learner, 'firstName')}’s ${termLabel(str(report, 'term')).replace(' · ', ' ')} report card is ready. Please collect the printed copy from the class teacher or ask the school office for a copy. — ${businessName}`;
}

/* ---------------- Fees and accounts ---------------- */
/** Sibling discount (demo rule): the child with the highest fee pays in full, every other child gets 10% off. Cents in, cents out, same order. */
export function siblingDiscount(feesCents: number[]): number[] {
  const full = feesCents.indexOf(Math.max(...feesCents));
  return feesCents.map((f, i) => (i === full ? f : Math.round(f * (1 - SIBLING_DISCOUNT_PCT / 100))));
}
export function familyFees(data: IndustryData, familyId: string, months: number) {
  const children = familyLearners(data, familyId).sort((a, b) => refNum(a) - refNum(b));
  const annual = children.map((l) => toCents(num(planForGrade(data, gradeOfLearner(data, l)), 'annualFee')));
  const net = children.length ? siblingDiscount(annual) : [];
  const rows = children.map((l, i) => ({ learner: l, plan: planForGrade(data, gradeOfLearner(data, l)), annual: annual[i], discount: annual[i] - net[i], monthly: months > 0 ? Math.round(net[i] / months) : 0 }));
  return { rows, monthly: rows.reduce((n, r) => n + r.monthly, 0), annual: net.reduce((n, x) => n + x, 0) };
}
export const accountOf = (data: IndustryData, familyId: string) => col(data, 'accounts').find((a) => str(a, 'family') === familyId);
export const accountMonths = (account: DemoRecord) => (str(account, 'months') === '10' ? 10 : 12);
/** A 10-month plan is billed February to November; a 12-month plan every month. */
export const billsIn = (months: number, month: string) => months === 12 || !['12', '01'].includes(month.slice(5, 7));
export const instalmentFor = (data: IndustryData, account: DemoRecord, month: string) => (billsIn(accountMonths(account), month) ? familyFees(data, str(account, 'family'), accountMonths(account)).monthly : 0);

/** A billing run stores one line per account: "12=4800" (account number = rand). Amounts are handled in cents. */
export function parseLines(text: unknown): Map<number, number> {
  const out = new Map<number, number>();
  for (const token of String(text ?? '').split(',')) { const m = /^(\d+)=(\d+(?:\.\d+)?)$/.exec(token.trim()); if (m) out.set(Number(m[1]), toCents(m[2])); }
  return out;
}
export const formatLines = (lines: Map<number, number>) => [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}=${c / 100}`).join(',');
export const linesOf = (run: DemoRecord) => memo(run, 'lines', () => parseLines(run.values.lines));
export const runFor = (data: IndustryData, month: string) => col(data, 'billingRuns').find((r) => str(r, 'month') === month);
export const runTotal = (run: DemoRecord | undefined) => (run ? [...linesOf(run).values()].reduce((n, c) => n + c, 0) : 0);
/** Accounts that would get an invoice for the month, with the amount (cents). */
export function accountsToBill(data: IndustryData, month: string): Array<{ account: DemoRecord; cents: number }> {
  return col(data, 'accounts').map((account) => ({ account, cents: instalmentFor(data, account, month) })).filter((x) => x.cents > 0);
}
export function billingProblem(data: IndustryData, month: string): string | null {
  if (runFor(data, month)) return `Invoices for ${monthLabel(month)} have already been raised.`;
  if (!accountsToBill(data, month).length) return `No account is billed in ${monthLabel(month)}.`;
  return null;
}

export type Entry = { date: string; kind: 'invoice' | 'payment'; label: string; cents: number; due?: string };
/** Payments in the account ledger: "260203:4800[:e[:note]]" (YYMMDD : rand : method initial, EFT when left off). */
export function parseLedger(text: unknown): Entry[] {
  const methods: Record<string, string> = { e: 'EFT', c: 'Card', k: 'Cash' };
  return String(text ?? '').split(',').map((t) => /^(\d{2})(\d{2})(\d{2}):(\d+(?:\.\d+)?)(?::([a-z])(?::(.*))?)?$/.exec(t.trim())).filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ date: `20${m[1]}-${m[2]}-${m[3]}`, kind: 'payment' as const, label: `${m[6] ? `${m[6]} — ` : 'Payment — '}${methods[m[5] ?? 'e'] ?? 'EFT'}`, cents: toCents(m[4]) }));
}
const methodInitial = (method: string) => (method === 'cash' ? 'k' : method === 'card' ? 'c' : 'e');
/** EFT is the default method and is left off: "260203:4800". */
export const ledgerEntry = (date: string, cents: number, method: string, note = '') => `${yymmdd(date)}:${cents / 100}${note || method !== 'eft' ? `:${methodInitial(method)}` : ''}${note ? `:${note.replace(/[,:]/g, ' ')}` : ''}`;
const invoiceIndex = (data: IndustryData) => memo(col(data, 'billingRuns'), 'invoices', () => {
  const m = new Map<number, Entry[]>();
  for (const run of col(data, 'billingRuns')) {
    const month = str(run, 'month');
    for (const [n, cents] of linesOf(run)) (m.get(n) ?? m.set(n, []).get(n)!).push({ date: `${month}-01`, due: `${month}-${String(DUE_DAY).padStart(2, '0')}`, kind: 'invoice', label: `School fees — ${monthLabel(month)}`, cents });
  }
  return m;
});
const receiptIndex = (data: IndustryData) => memo(col(data, 'payments'), 'receipts', () => {
  const m = new Map<string, Entry[]>();
  for (const p of col(data, 'payments')) {
    if (p.status !== 'allocated') continue;
    (m.get(str(p, 'account')) ?? m.set(str(p, 'account'), []).get(str(p, 'account'))!).push({ date: str(p, 'date'), kind: 'payment', label: `Payment — ${label([{ value: 'eft', label: 'EFT' }, { value: 'card', label: 'Card' }, { value: 'cash', label: 'Cash' }], str(p, 'method'))} (${p.ref})`, cents: toCents(num(p, 'amount')) });
  }
  return m;
});
/** Statement lines for a family account: invoices and payments, oldest first. */
export function accountEntries(account: DemoRecord, data: IndustryData): Entry[] {
  const ledger = memo(account, 'ledger', () => parseLedger(account.values.ledger));
  return [...(invoiceIndex(data).get(refNum(account)) ?? []), ...ledger, ...(receiptIndex(data).get(account.id) ?? [])]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'invoice' ? -1 : 1));
}
/** Balance owing in cents (negative = in credit). */
export function accountBalance(account: DemoRecord, data: IndustryData): number {
  return accountEntries(account, data).reduce((n, e) => n + (e.kind === 'invoice' ? e.cents : -e.cents), 0);
}
export type Ageing = { current: number; d30: number; d60: number; d90: number; total: number };
/** Arrears ageing: payments settle the oldest invoices first; what is left is aged from the invoice date. */
export function ageing(account: DemoRecord, data: IndustryData, today: string): Ageing {
  const entries = accountEntries(account, data);
  let paid = entries.filter((e) => e.kind === 'payment').reduce((n, e) => n + e.cents, 0);
  const out: Ageing = { current: 0, d30: 0, d60: 0, d90: 0, total: 0 };
  for (const inv of entries.filter((e) => e.kind === 'invoice')) {
    const settled = Math.min(paid, inv.cents);
    paid -= settled;
    const open = inv.cents - settled;
    if (open <= 0) continue;
    const age = daysBetween(inv.date, today);
    if (age >= 90) out.d90 += open; else if (age >= 60) out.d60 += open; else if (age >= 30) out.d30 += open; else out.current += open;
    out.total += open;
  }
  return out;
}
export const arrearsOf = (a: Ageing) => a.d30 + a.d60 + a.d90;
export function ageingFlag(a: Ageing): Flag | null {
  if (a.d90 > 0) return { tone: 'red', label: 'Arrears 90+ days' };
  if (a.d60 > 0) return { tone: 'red', label: 'Arrears 60 days' };
  if (a.d30 > 0) return { tone: 'amber', label: 'Arrears 30 days' };
  return null;
}
/** A payment must be above zero and no more than the balance owing. */
export function paymentProblem(account: DemoRecord | undefined, amount: number, data: IndustryData): string | null {
  if (!account) return 'Choose the family account the payment belongs to under “Allocate to” on the record’s page.';
  if (!(amount > 0)) return 'Enter the amount received.';
  const balance = accountBalance(account, data);
  if (balance <= 0) return `Nothing is owing on the ${familyName(data, str(account, 'family'))} account${balance < 0 ? ` (it is ${rand(-balance)} in credit)` : ''}.`;
  if (toCents(amount) > balance) return `${rand(toCents(amount))} is more than the ${rand(balance)} owing on the ${familyName(data, str(account, 'family'))} account. A payment cannot exceed the balance — check the amount, or that this is the right account.`;
  return null;
}
export const activeArrangement = (data: IndustryData, accountId: string) => col(data, 'arrangements').find((a) => str(a, 'account') === accountId && !['completed', 'defaulted'].includes(a.status ?? ''));
export function arrangementProblem(arr: DemoRecord): string | null {
  const [arrears, instalment, months] = [toCents(num(arr, 'arrears')), toCents(num(arr, 'instalment')), num(arr, 'months')];
  if (!(instalment > 0)) return 'Enter the extra monthly instalment under “Terms” on the record’s page.';
  if (!(months >= 1 && months <= 12)) return 'An arrangement runs for 1 to 12 months — set the months under “Terms” on the record’s page.';
  if (instalment * months < arrears) return `${rand(instalment)} × ${months} months = ${rand(instalment * months)}, which does not clear the arrears of ${rand(arrears)}. Raise the instalment or the months under “Terms” on the record’s page.`;
  return null;
}
/** Money received in a calendar month (ledger payments and allocated receipts), in cents. */
export function collectedIn(data: IndustryData, month: string): number {
  let n = 0;
  for (const a of col(data, 'accounts')) for (const e of memo(a, 'ledger', () => parseLedger(a.values.ledger))) if (e.date.startsWith(month)) n += e.cents;
  for (const p of col(data, 'payments')) if (p.status === 'allocated' && str(p, 'date').startsWith(month)) n += toCents(num(p, 'amount'));
  return n;
}
export function schoolAgeing(data: IndustryData, today: string) {
  const rows = col(data, 'accounts').map((account) => ({ account, age: ageing(account, data, today), balance: accountBalance(account, data) }));
  const sum = (k: keyof Ageing) => rows.reduce((n, r) => n + r.age[k], 0);
  return { rows, current: sum('current'), d30: sum('d30'), d60: sum('d60'), d90: sum('d90'), total: sum('total'), arrears: sum('d30') + sum('d60') + sum('d90'), inArrears: rows.filter((r) => arrearsOf(r.age) > 0) };
}

/* ---------------- Discipline and merits ---------------- */
export const isMerit = (r: DemoRecord) => str(r, 'kind') === 'merit';
export function learnerPoints(data: IndustryData, learnerId: string) {
  const list = col(data, 'discipline').filter((r) => str(r, 'learner') === learnerId);
  const merits = list.filter(isMerit).reduce((n, r) => n + Math.abs(num(r, 'points')), 0);
  const demerits = list.filter((r) => !isMerit(r)).reduce((n, r) => n + Math.abs(num(r, 'points')), 0);
  return { merits, demerits, net: merits - demerits, records: list.sort((a, b) => str(b, 'date').localeCompare(str(a, 'date'))) };
}
/** Detentions still to be served: on or after today, on an incident that is not resolved. */
export const detentionList = (data: IndustryData, today: string) => col(data, 'discipline')
  .filter((r) => !isMerit(r) && r.values.detention === true && r.status !== 'resolved' && (!str(r, 'detentionDate') || str(r, 'detentionDate') >= today))
  .sort((a, b) => str(a, 'detentionDate').localeCompare(str(b, 'detentionDate')));
export function contactProblem(r: DemoRecord): string | null {
  return str(r, 'parentNote').trim() ? null : 'Record how and when the parent was contacted first (“Parent contact” on the record’s page).';
}
export function resolveProblem(r: DemoRecord, data: IndustryData, user: DemoUser): string | null {
  if (isMerit(r)) return null;
  if (str(r, 'severity') === 'serious' && !can(user, 'discipline.serious')) {
    const who = data.users.filter((u) => u.isSuperAdmin || u.permissions.includes('discipline.serious')).map((u) => `${u.name} (${u.title})`).slice(0, 2).join(' or ');
    return `A serious incident is resolved by the deputy or the principal — switch to ${who || 'the principal'} in the top bar.`;
  }
  if (r.status === 'logged') return 'Contact the parent before resolving an incident — record it under “Parent contact” on the record’s page.';
  if (!str(r, 'resolution').trim()) return 'Record the outcome first (“Outcome” on the record’s page).';
  if (r.values.detention === true && !str(r, 'detentionDate')) return 'Set the detention date under “Outcome” on the record’s page.';
  return null;
}

/* ---------------- Notices ---------------- */
export function noticeAudience(notice: DemoRecord, data: IndustryData) {
  const audience = str(notice, 'audience') || 'school';
  const learners = enrolledLearners(data).filter((l) => (audience === 'grade' ? gradeOfLearner(data, l) === str(notice, 'grade') : audience === 'class' ? str(l, 'class') === str(notice, 'class') : true));
  const families = new Set(learners.map((l) => str(l, 'family')));
  const text = audience === 'grade' ? gradeLabel(str(notice, 'grade')) : audience === 'class' ? className(data, str(notice, 'class')) : 'Whole school';
  return { learners: learners.length, families: families.size, text };
}
export function noticeProblem(notice: DemoRecord): string | null {
  if (str(notice, 'body').trim().length < 20) return 'Write the message first (“Message” on the record’s page) — at least a sentence.';
  if (str(notice, 'audience') === 'grade' && !str(notice, 'grade')) return 'Choose which grade the notice goes to (“Message” panel on the record’s page).';
  if (str(notice, 'audience') === 'class' && !str(notice, 'class')) return 'Choose which class the notice goes to (“Message” panel on the record’s page).';
  return null;
}
export const noticeMessage = (businessName: string, notice: DemoRecord) => `${str(notice, 'title')}\n\n${str(notice, 'body')}\n\n— ${businessName}`;

/* ---------------- Period helpers for pages ---------------- */
export const periodLabel = (slot: number) => `Period ${slotPeriod(slot)} · ${slotTime(slot)}`;
export const DAY_COUNT = DAYS.length;
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n}%`);
