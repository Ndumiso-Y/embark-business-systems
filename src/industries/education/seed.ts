// Fictional seed data for the school demo. Every learner, parent, teacher, number and amount is
// invented. Dates are relative to `today` so the demo always looks current, and a small PRNG keeps
// every reset identical. Nothing here depends on the weekday: guided records keep the same ids.
import { seeder, user } from '../../core/seed';
import { addDays, monthKeys } from '../../core/lib/dates';
import type { DemoRecord, IndustryData, Values } from '../../core/types';
import { GRADES, PERIODS, SLOTS, gradeIndex, subjectsForGrade } from './data';
import {
  ageing, arrearsOf, attendanceStats, coverNeeded, familyFees, formatCover, formatLines, formatMarks, formatResults, formatScores, formatSlots, billsIn, isWeekend, ledgerEntry, prevTerm, refNum, termOf, termPercent, termRange,
  type Lesson, type Mark, type Score,
} from './helpers';

/** Small deterministic PRNG (same generator as the optometry seed). */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

/* ---------------- Staff (index + 1 = staff number) ---------------- */
type StaffRow = [first: string, last: string, role: string, subjects: string, login?: string];
const STAFF: StaffRow[] = [
  ['Nomvula', 'Mokoena', 'principal', 'School leadership', 'u_principal'],
  ['Pieter', 'van der Merwe', 'deputy', 'Academic head · Grade 12 register class', 'u_deputy'],
  ['Lindiwe', 'Sithole', 'teacher', 'Foundation phase'],
  ['Annelise', 'Fourie', 'teacher', 'Foundation phase'],
  ['Busisiwe', 'Zulu', 'teacher', 'Foundation phase'],
  ['Fatima', 'Ismail', 'teacher', 'Foundation phase'],
  ['Karen', 'Pretorius', 'teacher', 'Foundation phase'],
  ['Zanele', 'Khumalo', 'teacher', 'English (Grades 4–7)', 'u_teacher'],
  ['Thabo', 'Molefe', 'teacher', 'Mathematics (Grades 4–7)'],
  ['Priya', 'Govender', 'teacher', 'Natural Sciences & Technology'],
  ['Johan', 'Venter', 'teacher', 'Social Sciences'],
  ['Megan', 'Abrahams', 'teacher', 'English (Grades 8–12)'],
  ['Rajesh', 'Naidoo', 'teacher', 'Mathematics (Grades 8–12)', 'u_subject'],
  ['Sipho', 'Ndlovu', 'teacher', 'Sciences (Grades 8–12)'],
  ['Chantal', 'Jacobs', 'teacher', 'Geography'],
  ['Mandla', 'Radebe', 'teacher', 'Life Orientation'],
  ['Kagiso', 'Mabena', 'teacher', 'Physical Education · sport'],
  ['Yolanda', 'Petersen', 'teacher', 'Library & reading'],
  ['Refilwe', 'Tau', 'teacher', 'Learning support'],
  ['Elmarie', 'Botha', 'admin', 'School secretary · admissions', 'u_secretary'],
  ['Sibusiso', 'Dube', 'admin', 'Bursar', 'u_bursar'],
  ['Thandiwe', 'Mahlangu', 'admin', 'Parent liaison', 'u_liaison'],
];
const S = { deputy: 1, eng4: 7, mat4: 8, nst: 9, ssc: 10, eng8: 11, mat8: 12, sci: 13, geo: 14, lor: 15, pe: 16, lib: 17, support: 18 };
const staffName = (i: number) => `${STAFF[i][0]} ${STAFF[i][1]}`;

/* ---------------- Classes: one per grade (two in Grade 1), reduced class sizes ---------------- */
type ClassRow = [name: string, grade: string, teacher: number, size: number, room: string];
const CLASSES: ClassRow[] = [
  ['Grade R', 'R', 2, 10, 'Foundation block 1'], ['Grade 1A', '1', 3, 11, 'Foundation block 2'], ['Grade 1B', '1', 4, 10, 'Foundation block 3'],
  ['Grade 2', '2', 5, 11, 'Foundation block 4'], ['Grade 3', '3', 6, 10, 'Foundation block 5'],
  ['Grade 4', '4', S.eng4, 12, 'Room 11'], ['Grade 5', '5', S.mat4, 11, 'Room 12'], ['Grade 6', '6', S.nst, 10, 'Science room'], ['Grade 7', '7', S.ssc, 11, 'Room 14'],
  ['Grade 8', '8', S.eng8, 12, 'Room 21'], ['Grade 9', '9', S.sci, 11, 'Laboratory'], ['Grade 10', '10', S.geo, 10, 'Room 23'], ['Grade 11', '11', S.lor, 11, 'Room 24'], ['Grade 12', '12', S.deputy, 10, 'Room 25'],
];
const C = { g1b: 2, g2: 3, g3: 4, g4: 5, g5: 6, g6: 7, g7: 8, g8: 9, g9: 10, g10: 11, g11: 12, g12: 13 };
export const CLASS_CAPACITY = 12;
const INTERMEDIATE: Array<[subject: string, staff: number]> = [['ENG', S.eng4], ['MAT', S.mat4], ['NST', S.nst], ['SSC', S.ssc]];
const HIGH: Array<[subject: string, staff: number]> = [['ENG', S.eng8], ['MAT', S.mat8], ['SCI', S.sci], ['GEO', S.geo], ['LOR', S.lor]];
const FOUNDATION_PATTERN = ['ENG', 'MAT', 'LSK', 'MAT', 'ENG', 'LSK'];

/** Clash-free by construction: each pool rotates through its classes; PE and library free the class's teacher. */
function lessonFor(classIdx: number, slot: number): Lesson {
  if (slot === classIdx || slot === classIdx + 15) return { subject: 'PE', teacher: S.pe + 1 };
  if (slot === (classIdx + 22) % SLOTS) return { subject: 'LIB', teacher: S.lib + 1 };
  const day = Math.floor(slot / PERIODS);
  if (classIdx <= 4) return { subject: FOUNDATION_PATTERN[(slot + day) % 6], teacher: CLASSES[classIdx][2] + 1 };
  if (classIdx <= 8) { const [subject, staff] = INTERMEDIATE[(slot + day + (classIdx - 5)) % 4]; return { subject, teacher: staff + 1 }; }
  const [subject, staff] = HIGH[(slot + 2 * day + (classIdx - 9)) % 5];
  return { subject, teacher: staff + 1 };
}
/** Who teaches a subject to a class (index into STAFF). */
function subjectTeacher(classIdx: number, subject: string): number {
  if (classIdx <= 4) return CLASSES[classIdx][2];
  return (classIdx <= 8 ? INTERMEDIATE : HIGH).find(([s]) => s === subject)![1];
}

/* ---------------- Name pools ---------------- */
const GIRLS = ['Amahle', 'Lerato', 'Zinhle', 'Aisha', 'Mia', 'Naledi', 'Chloe', 'Thandeka', 'Emma', 'Palesa', 'Zara', 'Nokuthula', 'Leah', 'Karabo', 'Anika', 'Sinazo', 'Hannah', 'Boitumelo', 'Jade', 'Ayanda', 'Layla', 'Minenhle', 'Kayla', 'Reabetswe', 'Sana', 'Lisakhanya', 'Erin', 'Dineo', 'Tasneem', 'Olwethu'];
const BOYS = ['Lwazi', 'Liam', 'Thabiso', 'Ethan', 'Sizwe', 'Mohammed', 'Kabelo', 'Joshua', 'Bandile', 'Aiden', 'Tshepo', 'Daniel', 'Siyabonga', 'Luke', 'Katlego', 'Yusuf', 'Melusi', 'Ruan', 'Lethabo', 'Caleb', 'Sandile', 'Arjun', 'Junior', 'Tiaan', 'Mpho', 'Noah', 'Andile', 'Imran', 'Neo', 'Jayden'];
const SURNAMES = ['Dlamini', 'Nkosi', 'Botha', 'Pillay', 'Mthembu', 'van Wyk', 'Khoza', 'Smith', 'Mabaso', 'Patel', 'Cele', 'Coetzee', 'Moloi', 'Williams', 'Ngcobo', 'Singh', 'Mokoena', 'du Plessis', 'Zwane', 'Adams', 'Shabalala', 'Kruger', 'Masilela', 'Moodley', 'Hlongwane', 'Steyn', 'Tshabalala', 'Daniels', 'Mahlaba', 'Reddy', 'Buthelezi', 'Nel', 'Sibiya', 'Hendricks', 'Maseko', 'Chetty', 'Gumede', 'Swanepoel', 'Mnisi', 'Khan', 'Ntuli', 'Erasmus', 'Letsoalo', 'Jansen', 'Mazibuko', 'Maharaj', 'Phiri', 'Visser', 'Motaung', 'Davids'];
const PARENTS_F = ['Nomsa', 'Sarah', 'Zodwa', 'Farzana', 'Lize', 'Thembi', 'Michelle', 'Nokwanda', 'Shanthi', 'Portia', 'Carla', 'Dudu', 'Yasmin', 'Ntombi', 'Anita'];
const PARENTS_M = ['Themba', 'David', 'Bongani', 'Ashraf', 'Hennie', 'Sifiso', 'Mark', 'Vusi', 'Kumar', 'Lucky', 'Francois', 'Jabu', 'Riaz', 'Xolani', 'Sunil'];
const SUBURBS = ['Ridgeview', 'Acacia Park', 'Protea Glen', 'Bushwillow Estate', 'Weaver’s Nest', 'Kiepersol', 'Sunbird Heights', 'Aloe Village'];
const ALLERGIES = ['Peanuts', 'Bee stings', 'Penicillin', 'Dairy', 'Eggs'];
const MEDICAL = ['Asthma — inhaler kept in the school bag', 'Type 1 diabetes — tests before break', 'Epilepsy — on daily medication', 'Wears a hearing aid (left ear)', 'ADHD — medication given at home'];
const COMMENTS = [
  'A pleasing term. Keep reading daily.', 'Works hard and takes part well.', 'Capable of more — homework on time, please.', 'A steady, reliable effort.',
  'Excellent progress. A pleasure to teach.', 'Must ask for help sooner when stuck.', 'Good results. Practise Maths daily.', 'A kind classmate, growing in confidence.',
];
const TASK_B: Record<string, [title: string, kind: string]> = {
  ENG: ['Reading & comprehension task', 'assignment'], MAT: ['Investigation', 'assignment'], LSK: ['Creative arts project', 'project'], NST: ['Practical task', 'project'],
  SSC: ['Map work project', 'project'], SCI: ['Practical investigation', 'project'], GEO: ['Research project', 'project'],
};

export function buildEducationSeed(today: string) {
  const rnd = prng(20261112);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const { collections, rec, day } = seeder(today);
  const year = Number(today.slice(0, 4));
  const term = termOf(today);
  const lastTerm = prevTerm(term);
  /**
   * Bulk sample records (learners, registers, accounts …) carry date-only timestamps and at most one
   * short history line, which keeps the stored demo well under the browser's storage budget.
   */
  const bulk = (collection: string, prefix: string, values: Values, o: { status?: string; ago: number; action?: string; on?: string }) => {
    const r = rec(collection, prefix, values, { status: o.status, createdDaysAgo: o.ago, history: [] });
    r.createdAt = r.updatedAt = day(-o.ago);
    if (o.action) r.history = [{ at: `${o.on ?? day(-o.ago)}T09:00`, by: 'Seed data', role: 'System', action: o.action }];
    return r;
  };
  /** Helpers read the seed through the same shape as the live data. */
  const data = { collections } as unknown as IndustryData;
  const on = (daysAgo: number, by: string, role: string, action: string, note?: string) => ({ daysAgo, by, role, action, note });

  const users = [
    user('u_principal', 'Dr Nomvula Mokoena', 'Principal', 'principal', [], [], true),
    user('u_deputy', 'Pieter van der Merwe', 'Deputy principal · academic head', 'deputy',
      ['dashboard', 'admissions', 'learners', 'classes', 'attendance', 'timetable', 'cover', 'assessments', 'reportcards', 'discipline', 'staff', 'notices', 'calendar', 'reports'],
      ['admissions', 'learners.edit', 'medical.view', 'attendance', 'timetable', 'staff.manage', 'marks.capture', 'marks.moderate', 'marks.publish', 'reports.comment', 'discipline', 'discipline.serious', 'comms', 'comms.approve']),
    user('u_teacher', 'Zanele Khumalo', 'Class teacher · Grade 4', 'classteacher',
      ['dashboard', 'learners', 'classes', 'attendance', 'timetable', 'assessments', 'reportcards', 'discipline', 'notices', 'calendar'],
      ['attendance', 'medical.view', 'marks.capture', 'marks.moderate', 'reports.comment', 'discipline', 'comms']),
    user('u_subject', 'Rajesh Naidoo', 'Subject teacher · Mathematics', 'subjectteacher',
      ['dashboard', 'learners', 'classes', 'timetable', 'assessments', 'discipline', 'calendar'],
      ['marks.capture', 'marks.moderate', 'discipline']),
    user('u_secretary', 'Elmarie Botha', 'School secretary · admissions', 'secretary',
      ['dashboard', 'admissions', 'learners', 'classes', 'attendance', 'cover', 'staff', 'notices', 'calendar'],
      ['admissions', 'learners.edit', 'medical.view', 'attendance', 'staff.manage', 'comms']),
    user('u_bursar', 'Sibusiso Dube', 'Bursar', 'bursar', ['dashboard', 'learners', 'fees', 'payments', 'reports'], ['fees', 'fees.approve']),
    user('u_liaison', 'Thandiwe Mahlangu', 'Parent liaison', 'liaison', ['dashboard', 'learners', 'attendance', 'discipline', 'notices', 'calendar'], ['discipline', 'comms']),
  ];

  /* ---------- Staff ---------- */
  const staff = STAFF.map(([firstName, lastName, role, subjects, login], i) => {
    const teaching = role !== 'admin';
    // One registration already expired, one about to; one new appointment still waiting for a police clearance.
    const saceExpiry = !teaching ? '' : i === S.pe ? day(-24) : i === S.geo ? day(31) : day(200 + ((i * 97) % 900));
    const v: Values = {
      firstName, lastName, role, subjects, phone: `0${72 + (i % 12)} 555 ${String(1200 + i * 331).slice(0, 4)}`, email: `${slug(`${firstName} ${lastName}`)}@example.com`,
      policeClearance: i !== S.lib,
    };
    if (teaching) { v.saceNo = `DEMO-SACE-${10240 + i * 173}`; v.saceExpiry = saceExpiry; }
    if (login) v.login = login;
    return rec('staff', 'EMP', v, { createdDaysAgo: 400 + i * 30, history: [on(400 + i * 30, 'Seed data', 'System', 'Appointed (fictional record)')] });
  });

  /* ---------- Fee plans ---------- */
  ([['Foundation phase (Grade R–3)', 'R', '3', 46800, 2500], ['Intermediate phase (Grade 4–7)', '4', '7', 54000, 2500], ['Senior phase (Grade 8–9)', '8', '9', 63600, 3000], ['FET phase (Grade 10–12)', '10', '12', 72000, 3000]] as const)
    .forEach(([name, fromGrade, toGrade, annualFee, deposit]) => bulk('feePlans', 'FP', { name, fromGrade, toGrade, annualFee, deposit }, { ago: 320 }));

  /* ---------- Classes and timetables ---------- */
  const classes = CLASSES.map(([name, grade, teacher, , room]) => bulk('classes', 'CL', { name, grade, teacher: staff[teacher].id, capacity: CLASS_CAPACITY, room }, { ago: 320, action: 'Class set up (fictional record)' }));
  classes.forEach((c, i) => bulk('timetables', 'TT', { class: c.id, slots: formatSlots(Array.from({ length: SLOTS }, (_, slot) => lessonFor(i, slot))) }, { ago: 300 }));

  /* ---------- Families and learners ---------- */
  const sizes = [...Array(10).fill(3), ...Array(35).fill(2), ...Array(50).fill(1)] as number[];
  for (let i = sizes.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [sizes[i], sizes[j]] = [sizes[j], sizes[i]]; }
  const remaining = CLASSES.map((c) => c[3]);
  const learners: DemoRecord[] = [];
  const families = sizes.map((size, f) => {
    const surname = SURNAMES[(f * 7) % SURNAMES.length];
    const motherFirst = f % 5 !== 3;
    const g1 = `${motherFirst ? PARENTS_F[f % 15] : PARENTS_M[(f * 3) % 15]} ${surname}`;
    const v: Values = { surname, guardian1: g1, relation1: f % 11 === 6 ? 'Grandmother' : motherFirst ? 'Mother' : 'Father', phone1: `0${71 + (f % 13)} 555 ${String(2000 + f * 83).slice(0, 4)}`, email1: `${slug(g1)}${f}@example.com`, suburb: SUBURBS[(f * 5) % SUBURBS.length] };
    if (f % 9 < 5) { v.guardian2 = `${motherFirst ? PARENTS_M[(f * 7) % 15] : PARENTS_F[(f * 2) % 15]} ${surname}`; v.phone2 = `0${60 + (f % 9)} 555 ${String(6100 + f * 37).slice(0, 4)}`; }
    const family = bulk('families', 'FM', v, { ago: 300 });
    const usedGrades: string[] = [];
    for (let child = 0; child < size; child++) {
      const open = CLASSES.map((c, i) => ({ i, grade: c[1], left: remaining[i] })).filter((c) => c.left > 0);
      const distinct = open.filter((c) => !usedGrades.includes(c.grade));
      const pool = (distinct.length ? distinct : open).sort((a, b) => b.left - a.left || a.i - b.i).slice(0, 4);
      const chosen = pool[Math.floor(rnd() * pool.length)];
      remaining[chosen.i]--;
      usedGrades.push(chosen.grade);
      const girl = rnd() < 0.5;
      const gi = gradeIndex(chosen.grade);
      const enrolledYear = year - Math.floor(rnd() * Math.min(gi + 1, 6));
      const enrolled = `${enrolledYear}-01-${14 + (learners.length % 4)}`;
      const lv: Values = {
        firstName: pick(girl ? GIRLS : BOYS), lastName: surname, class: classes[chosen.i].id, family: family.id,
        dob: `${year - 6 - gi}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`,
        gender: girl ? 'F' : 'M', enrolled: enrolled > today ? `${enrolledYear - 1}-01-15` : enrolled,
        transport: ['own', 'own', 'own', 'bus', 'bus', 'lift', 'walk'][Math.floor(rnd() * 7)],
      };
      if (rnd() < 0.3 && gi <= 5) lv.aftercare = true;
      const [a, m] = [rnd(), rnd()];
      if (a < 0.08) lv.allergies = ALLERGIES[Math.floor(a * 62.5) % ALLERGIES.length];
      if (m < 0.06) lv.medical = MEDICAL[Math.floor(m * 83) % MEDICAL.length];
      learners.push(bulk('learners', 'LR', lv, { status: 'enrolled', ago: 290, action: 'Enrolled', on: String(lv.enrolled) }));
    }
    return family;
  });
  const roll = (classIdx: number) => learners.filter((l) => l.values.class === classes[classIdx].id)
    .sort((a, b) => String(a.values.lastName).localeCompare(String(b.values.lastName)) || String(a.values.firstName).localeCompare(String(b.values.firstName)));
  // A known allergy in the guided class, so the restricted medical flag has something to show.
  roll(C.g4)[1].values.allergies = 'Bee stings';

  /* ---------- Daily attendance: today first (fixed ids), then the last ten school days ---------- */
  const schoolDays: string[] = [];
  for (let d = addDays(today, -1); schoolDays.length < 10; d = addDays(d, -1)) if (!isWeekend(d)) schoolDays.unshift(d);
  const REASONS = ['sick', 'sick', 'sick', 'sick', 'family', 'appointment', 'unexplained'];
  // Learners with a run of absences: Grade 8 (flagged already), Grade 6 (flagged), Grade 4 (two days — the guided register makes it three).
  const chronic8 = refNum(roll(C.g8)[2]);
  const chronic6 = refNum(roll(C.g6)[4]);
  const twoDays4 = refNum(roll(C.g4)[5]);
  const dayMarks = (classIdx: number, dayIdx: number): Map<number, Mark> => {
    const marks = new Map<number, Mark>();
    for (const l of roll(classIdx)) {
      const [r, why] = [rnd(), rnd()];
      const n = refNum(l);
      const recent = dayIdx >= 7;
      if ((n === chronic8 || n === chronic6) && recent) marks.set(n, { code: 'A', reason: dayIdx === 7 ? 'sick' : 'unexplained' });
      else if (n === twoDays4 && dayIdx >= 8) marks.set(n, { code: 'A', reason: 'unexplained' });
      else if (n === chronic8 || n === chronic6 || n === twoDays4) marks.set(n, { code: 'P', reason: '' });
      else marks.set(n, r < 0.04 ? { code: 'A', reason: REASONS[Math.floor(why * REASONS.length)] } : r < 0.065 ? { code: 'L', reason: '' } : { code: 'P', reason: '' });
    }
    return marks;
  };
  const SUBMITTED_TODAY = [0, 1, 2, 3, 4, C.g5, C.g7, C.g8];
  SUBMITTED_TODAY.forEach((ci) => {
    const marks = dayMarks(ci, 10);
    if (ci === C.g8) marks.set(chronic8, { code: 'A', reason: 'unexplained' });
    bulk('registers', 'RG', { class: classes[ci].id, date: today, marks: formatMarks(marks), takenBy: staffName(CLASSES[ci][2]) }, { status: 'submitted', ago: 0 });
  });
  // Two registers in progress: Grade 6 half marked, Grade 11 complete but for one absence without a reason.
  const partial6 = dayMarks(C.g6, 10);
  roll(C.g6).slice(6).forEach((l) => partial6.delete(refNum(l)));
  partial6.set(chronic6, { code: 'A', reason: '' });
  bulk('registers', 'RG', { class: classes[C.g6].id, date: today, marks: formatMarks(partial6), takenBy: staffName(S.nst) }, { status: 'draft', ago: 0 });
  const draft11 = dayMarks(C.g11, 10);
  draft11.set(refNum(roll(C.g11)[3]), { code: 'A', reason: '' });
  bulk('registers', 'RG', { class: classes[C.g11].id, date: today, marks: formatMarks(draft11), takenBy: staffName(S.lor) }, { status: 'draft', ago: 0 });
  schoolDays.forEach((date, dayIdx) => {
    CLASSES.forEach((_, ci) => bulk('registers', 'RG', { class: classes[ci].id, date, marks: formatMarks(dayMarks(ci, dayIdx)) }, { status: 'submitted', ago: 10 - dayIdx }));
  });

  /* ---------- Staff absence and substitute cover ---------- */
  const leave = (staffIdx: number, date: string, reason: string, note: string, status: string, cover = '', daysAgo = 0) =>
    rec('leave', 'AB', { staff: staff[staffIdx].id, date, reason, note, cover }, { status, createdDaysAgo: daysAgo, history: [on(daysAgo, 'Elmarie Botha', 'School secretary / admissions', 'Absence recorded (fictional record)', note)] });
  leave(S.sci, today, 'sick', 'Phoned in before school: flu, booked off for the day.', 'open'); // leave_1 — guided
  leave(S.support, today, 'training', 'District workshop on reading support. No timetabled lessons to cover.', 'covered');
  const earlier = leave(5, schoolDays[7], 'family', 'Family responsibility leave, arranged the week before.', 'covered', '', 4);
  earlier.values.cover = formatCover(new Map(coverNeeded(earlier, data).map((t, i) => [t.slot, (i % 2 ? S.support : S.deputy) + 1])));
  let upcoming = addDays(today, 2);
  while (isWeekend(upcoming)) upcoming = addDays(upcoming, 1);
  leave(S.geo, upcoming, 'training', 'Moderation meeting at the district office.', 'open');

  /* ---------- Assessments for the current term ---------- */
  const ability = new Map(learners.map((l) => [refNum(l), 44 + rnd() * 46]));
  const scoreFor = (n: number, total: number, bias = 0): Score => {
    const [miss, noise] = [rnd(), rnd()];
    if (miss < 0.025) return 'A';
    return Math.round((Math.max(8, Math.min(100, ability.get(n)! + bias + (noise - 0.5) * 26)) / 100) * total);
  };
  type TaskSpec = { ci: number; subject: string; b: boolean };
  const EXCEPTIONS: Array<TaskSpec & { status: string; weight?: number; moderator?: number; marks?: 'none' | 'half' | 'missing2' }> = [
    { ci: C.g4, subject: 'ENG', b: false, status: 'draft', marks: 'missing2' }, // assessments_1 — guided
    { ci: C.g4, subject: 'MAT', b: false, status: 'moderated', weight: 40, moderator: S.eng4 }, // assessments_2 — weightings add up to 90%
    { ci: C.g5, subject: 'NST', b: false, status: 'captured' },
    { ci: C.g6, subject: 'SSC', b: true, status: 'captured' },
    { ci: C.g8, subject: 'GEO', b: false, status: 'captured' },
    { ci: 1, subject: 'LSK', b: true, status: 'captured' },
    { ci: C.g9, subject: 'SCI', b: true, status: 'draft', marks: 'none' },
    { ci: C.g10, subject: 'MAT', b: false, status: 'draft', marks: 'half' },
    { ci: C.g11, subject: 'ENG', b: false, status: 'moderated', moderator: S.mat8 },
  ];
  const sameTask = (a: TaskSpec, b: TaskSpec) => a.ci === b.ci && a.subject === b.subject && a.b === b.b;
  const addTask = (spec: TaskSpec) => {
    const ex = EXCEPTIONS.find((e) => sameTask(e, spec));
    const status = ex?.status ?? 'published';
    const teacher = subjectTeacher(spec.ci, spec.subject);
    const single = spec.subject === 'LOR';
    const [title, kind] = single ? ['Portfolio task', 'project'] : spec.b ? TASK_B[spec.subject] : ['Term test', 'test'];
    const total = single ? 60 : spec.b ? 40 : 50;
    const list = roll(spec.ci);
    const scores = new Map<number, Score>();
    list.forEach((l, i) => {
      const s = scoreFor(refNum(l), total, spec.subject === 'MAT' ? -4 : spec.subject === 'LOR' || spec.subject === 'LSK' ? 6 : 0);
      if (ex?.marks === 'none' || (ex?.marks === 'half' && i % 2) || (ex?.marks === 'missing2' && (i === 3 || i === 9))) return;
      scores.set(refNum(l), s);
    });
    const ago = (spec.b ? 34 : 15) + (spec.ci % 5);
    const moderator = ex?.moderator ?? (teacher === S.deputy ? S.mat8 : S.deputy);
    const v: Values = { class: classes[spec.ci].id, subject: spec.subject, term, title, kind, total, weight: ex?.weight ?? (single ? 100 : 50), date: day(-ago), marks: formatScores(scores) };
    const history = [on(ago + 6, staffName(teacher), 'Teacher', 'Task set (fictional record)')];
    if (status !== 'draft') { v.capturedBy = staffName(teacher); history.push(on(ago - 2, staffName(teacher), 'Teacher', 'Submit marks for moderation')); }
    if (status === 'moderated' || status === 'published') { v.moderatedBy = staffName(moderator); history.push(on(ago - 4, staffName(moderator), 'Moderator', 'Moderate marks')); }
    // Published tasks keep no seeded history: who captured and moderated them is on the record itself.
    if (status === 'published') return bulk('assessments', 'AS', v, { status, ago: ago + 6 });
    return rec('assessments', 'AS', v, { status, createdDaysAgo: ago + 6, history });
  };
  const allTasks: TaskSpec[] = CLASSES.flatMap((c, ci) => subjectsForGrade(c[1]).flatMap((subject) => (subject === 'LOR' ? [{ ci, subject, b: false }] : [{ ci, subject, b: true }, { ci, subject, b: false }])));
  const guidedTasks = EXCEPTIONS.slice(0, 2);
  guidedTasks.forEach(addTask);
  allTasks.filter((t) => !guidedTasks.some((g) => sameTask(g, t))).forEach(addTask);

  /* ---------- Report cards: this term in progress, last term released ---------- */
  const principal = users[0].name;
  const report = (l: DemoRecord, status: string, comment: string) => {
    const frozen = status === 'signed' || status === 'released';
    const v: Values = { learner: l.id, term, comment };
    if (frozen) {
      v.results = formatResults(subjectsForGrade(String(classes.find((c) => c.id === l.values.class)!.values.grade)).map((subject) => ({ subject, pct: termPercent(data, l, subject, term) })));
      const st = attendanceStats(data, l, termRange(term).start, termRange(term).end);
      v.att = `${st.present}/${st.days}`; v.signedBy = principal; v.signedOn = day(-2);
      if (status === 'released') v.releasedOn = day(-1);
    }
    const r = bulk('reports', 'RC', v, { status, ago: 6, action: 'Report card generated (fictional record)' });
    const teacher = { by: staffName(CLASSES[classes.findIndex((c) => c.id === l.values.class)][2]), role: 'Class teacher' };
    if (status !== 'draft') r.history.push({ at: `${day(-4)}T14:10`, ...teacher, action: 'Submit comment' });
    if (frozen) r.history.push({ at: `${day(-2)}T10:30`, by: principal, role: 'Principal', action: 'Principal sign-off' });
    if (status === 'released') r.history.push({ at: `${day(-1)}T08:15`, by: principal, role: 'Principal', action: 'Release to parents (simulated)', note: 'Release logged — no message was sent' });
    return r;
  };
  report(roll(C.g7)[0], 'commented', 'A strong term across every subject. Keep up the daily reading and the careful working in Mathematics.'); // reports_1 — ready to sign
  report(roll(C.g4)[0], 'commented', 'A hard-working, cheerful member of the class. Times tables need a little practice at home each evening.'); // reports_2 — blocked by unpublished marks
  roll(C.g7).slice(1).forEach((l, i) => report(l, 'commented', COMMENTS[i % COMMENTS.length]));
  roll(C.g4).slice(1).forEach((l, i) => report(l, i < 3 ? 'commented' : 'draft', i < 3 ? COMMENTS[(i + 3) % COMMENTS.length] : ''));
  roll(C.g12).forEach((l, i) => report(l, i < 6 ? 'signed' : 'released', COMMENTS[(i + 5) % COMMENTS.length]));
  learners.forEach((l, i) => {
    const grade = String(classes.find((c) => c.id === l.values.class)!.values.grade);
    const results = subjectsForGrade(grade).map((subject) => ({ subject, pct: Math.round(Math.max(20, Math.min(98, ability.get(refNum(l))! + (rnd() - 0.5) * 18 + (subject === 'MAT' ? -4 : 0)))) }));
    const days = 49 + (i % 3);
    bulk('reports', 'RC', { learner: l.id, term: lastTerm, comment: COMMENTS[(i * 3) % COMMENTS.length], results: formatResults(results), att: `${days - Math.floor(rnd() * 5)}/${days}`, releasedOn: day(-50) }, { status: 'released', ago: 60 });
  });

  /* ---------- Fees: nine months of invoices, payments and arrears ---------- */
  const months = monthKeys(today, 10).slice(0, 9);
  /** Months of fees left unpaid for the families that have fallen behind (they are all on the 12-month plan). */
  const behind = (f: number) => (f % 9 === 4 ? 1 + (Math.floor(f / 9) % 4) : 0);
  const accounts = families.map((family, f) => { const r = rnd(); return bulk('accounts', 'FA', { family: family.id, months: !behind(f) && r < 0.3 ? '10' : '12', ledger: '' }, { ago: 290, action: 'Account opened' }); });
  const clamp = (iso: string) => (iso > today ? '' : iso);
  const monthly = accounts.map((a) => familyFees(data, String(a.values.family), a.values.months === '10' ? 10 : 12).monthly);
  months.forEach((month, mi) => {
    const lines = new Map<number, number>();
    accounts.forEach((a, f) => {
      const [dayRoll, methodRoll] = [rnd(), rnd()];
      if (!billsIn(a.values.months === '10' ? 10 : 12, month) || !monthly[f]) return;
      lines.set(refNum(a), monthly[f]);
      const unpaidFrom = months.length - behind(f);
      const method = methodRoll < 0.78 ? 'eft' : methodRoll < 0.93 ? 'card' : 'cash';
      let paidOn = '';
      let cents = monthly[f];
      if (mi >= unpaidFrom) { if (mi === unpaidFrom && behind(f) > 1) { paidOn = `${month}-${String(8 + Math.floor(dayRoll * 15)).padStart(2, '0')}`; cents = Math.round(monthly[f] * 0.4 / 100) * 100; } }
      else if (f % 7 === 2) paidOn = clamp(`${mi + 1 < months.length ? months[mi + 1] : today.slice(0, 7)}-${String(2 + Math.floor(dayRoll * 17)).padStart(2, '0')}`);
      else paidOn = `${month}-${String(1 + Math.floor(dayRoll * 6)).padStart(2, '0')}`;
      if (paidOn) a.values.ledger = [a.values.ledger, ledgerEntry(paidOn, cents, method)].filter(Boolean).join(',');
    });
    rec('billingRuns', 'BR', { month, date: `${month}-01`, lines: formatLines(lines) }, { createdDaysAgo: Math.max(1, (months.length - mi) * 30), history: [on(Math.max(1, (months.length - mi) * 30), 'Sibusiso Dube', 'Bursar', `Invoices raised for ${lines.size} accounts (fictional record)`)] });
  });
  const lateAccount = (k: number, nth = 0) => accounts[accounts.map((_, f) => f).filter((f) => behind(f) === k)[nth]];
  const surnameOf = (a: DemoRecord) => String(families[accounts.indexOf(a)].values.surname);
  const centsOf = (a: DemoRecord) => monthly[accounts.indexOf(a)];
  const bank = [on(1, 'Sibusiso Dube', 'Bursar', 'Captured from the bank statement (fictional record)')];
  // Three bank deposits waiting to be allocated: one straightforward, one for more than is owing, one with no account yet.
  const [one, over, two] = [lateAccount(1), lateAccount(1, 1), lateAccount(2)];
  rec('payments', 'PY', { account: one.id, date: day(-1), amount: centsOf(one) / 100, method: 'eft', reference: `${surnameOf(one).toUpperCase()} SCHOOL FEES` }, { status: 'received', createdDaysAgo: 1, history: bank });
  rec('payments', 'PY', { account: over.id, date: day(-1), amount: centsOf(over) / 100 + 500, method: 'eft', reference: `${surnameOf(over).toUpperCase()} FEES + CAMP` }, { status: 'received', createdDaysAgo: 1, history: bank });
  rec('payments', 'PY', { account: '', date: day(0), amount: 3000, method: 'eft', reference: `${surnameOf(two).toUpperCase()} ARREARS` }, { status: 'received', createdDaysAgo: 0, history: [on(0, 'Sibusiso Dube', 'Bursar', 'Captured from the bank statement (fictional record)')] });
  // Payment arrangements: one waiting for the bursar, one running, one that fell over.
  const [three, four] = [lateAccount(3), lateAccount(4)];
  const owing = (a: DemoRecord) => Math.max(arrearsOf(ageing(a, data, today)), centsOf(a)) / 100;
  rec('arrangements', 'PA', { account: three.id, arrears: owing(three), instalment: Math.ceil(owing(three) / 6 / 50) * 50, months: 6, startDate: day(5), note: 'Father retrenched in the winter; working again from this month. Asked to spread the arrears over six months.' },
    { status: 'proposed', createdDaysAgo: 2, history: [on(2, 'Sibusiso Dube', 'Bursar', 'Arrangement proposed after a meeting with the parent (fictional record)')] });
  rec('arrangements', 'PA', { account: four.id, arrears: owing(four), instalment: Math.ceil(owing(four) / 10 / 50) * 50, months: 10, startDate: day(-20), note: 'Arrears to be cleared over ten months on top of the monthly fee.' },
    { status: 'active', createdDaysAgo: 30, history: [on(30, 'Sibusiso Dube', 'Bursar', 'Arrangement proposed (fictional record)'), on(27, 'Sibusiso Dube', 'Bursar', 'Approve arrangement'), on(20, 'Sibusiso Dube', 'Bursar', 'Parent accepted — start')] });
  rec('arrangements', 'PA', { account: two.id, arrears: owing(two), instalment: 1500, months: 6, startDate: day(-95), note: 'Agreed in the second term.' },
    { status: 'defaulted', createdDaysAgo: 110, history: [on(110, 'Sibusiso Dube', 'Bursar', 'Arrangement proposed (fictional record)'), on(104, 'Sibusiso Dube', 'Bursar', 'Approve arrangement'), on(95, 'Sibusiso Dube', 'Bursar', 'Parent accepted — start'), on(33, 'Sibusiso Dube', 'Bursar', 'Mark as defaulted', 'Two instalments missed; no reply to calls.')] });

  /* ---------- Admissions ---------- */
  type App = { first: string; last: string; grade: string; girl: boolean; status: string; docs: [boolean, boolean, boolean]; ago: number; assessed?: number; outcome?: string; note?: string; offer?: number; wait?: number; deposit?: number; family?: number; learner?: DemoRecord; reason?: string; prev?: string };
  const recent = [roll(0)[0], roll(0)[1], roll(C.g1b)[0]];
  const APPS: App[] = [
    { first: 'Lulama', last: 'Mkhize', grade: '2', girl: true, status: 'applied', docs: [true, true, false], ago: 6, prev: 'Little Acorns Primary' }, // applications_1 — guided
    { first: 'Owethu', last: 'Bhengu', grade: '4', girl: false, status: 'assessed', docs: [true, true, true], ago: 20, assessed: 9, outcome: 'ready', note: 'Reads fluently; number work at grade level.', prev: 'Riverside Primary' }, // applications_2 — grade is full
    { first: 'Amara', last: 'Okafor', grade: 'R', girl: true, status: 'applied', docs: [false, false, false], ago: 2 },
    { first: 'Divan', last: 'Lombard', grade: '8', girl: false, status: 'applied', docs: [true, false, false], ago: 4, prev: 'Kiepersol Primary' },
    { first: 'Nandi', last: 'Mavuso', grade: '1', girl: true, status: 'documents', docs: [true, true, true], ago: 11, prev: 'Sunbird Pre-Primary' },
    { first: 'Keanu', last: 'Fortuin', grade: '5', girl: false, status: 'documents', docs: [true, true, true], ago: 13, prev: 'Aloe Village Primary' },
    { first: 'Thato', last: String(families[3].values.surname), grade: 'R', girl: false, status: 'assessed', docs: [true, true, true], ago: 18, assessed: 7, outcome: 'ready', note: 'Younger brother of a learner already in the school. Settled quickly in the play session.', family: 3 },
    { first: 'Sipho', last: 'Mdluli', grade: '10', girl: false, status: 'assessed', docs: [true, true, true], ago: 22, assessed: 10, outcome: 'support', note: 'Strong in languages; Mathematics below grade level — extra lessons recommended.', prev: 'Highveld College' },
    { first: 'Imaan', last: 'Ebrahim', grade: '3', girl: true, status: 'offered', docs: [true, true, true], ago: 27, assessed: 16, outcome: 'ready', note: 'Confident reader.', offer: 5, prev: 'Protea Glen Primary' },
    { first: 'Zoe', last: 'Marais', grade: '9', girl: true, status: 'offered', docs: [true, true, true], ago: 30, assessed: 19, outcome: 'ready', note: 'Good previous reports; keen on debating.', offer: 8, deposit: 3000, prev: 'Bushwillow Academy' },
    { first: 'Lethu', last: 'Sokhela', grade: '4', girl: false, status: 'waitlisted', docs: [true, true, true], ago: 44, assessed: 35, outcome: 'ready', note: 'At grade level.', wait: 33, prev: 'Riverside Primary' },
    { first: 'Tyra', last: 'Jantjies', grade: '4', girl: true, status: 'waitlisted', docs: [true, true, true], ago: 38, assessed: 28, outcome: 'ready', note: 'At grade level.', wait: 25, prev: 'Weaver’s Nest Primary' },
    { first: 'Musa', last: 'Zungu', grade: '8', girl: false, status: 'waitlisted', docs: [true, true, true], ago: 41, assessed: 30, outcome: 'ready', note: 'Sound primary school results.', wait: 27, prev: 'Kiepersol Primary' },
    ...recent.map((l, i): App => ({ first: String(l.values.firstName), last: String(l.values.lastName), grade: i < 2 ? 'R' : '1', girl: l.values.gender === 'F', status: 'enrolled', docs: [true, true, true], ago: 70 + i * 6, assessed: 58 + i * 6, outcome: 'ready', note: 'Ready for the grade.', offer: 50 + i * 6, deposit: 2500, learner: l })),
    { first: 'Ryan', last: 'Oosthuizen', grade: '6', girl: false, status: 'declined', docs: [true, true, true], ago: 52, assessed: 40, outcome: 'ready', note: 'At grade level.', offer: 36, reason: 'Family accepted a place at a school closer to home.', prev: 'Acacia Park Primary' },
    { first: 'Khanyi', last: 'Mbatha', grade: '11', girl: true, status: 'declined', docs: [true, false, false], ago: 47, reason: 'Application withdrawn by the parent — the family is relocating.', prev: 'Highveld College' },
  ];
  const secretary = 'Elmarie Botha';
  const role = 'School secretary / admissions';
  APPS.forEach((a, i) => {
    const fam = a.family !== undefined ? families[a.family] : a.learner ? families.find((f) => f.id === a.learner!.values.family)! : undefined;
    const parent = fam ? String(fam.values.guardian1) : `${a.girl ? PARENTS_F[(i * 4) % 15] : PARENTS_M[(i * 4 + 1) % 15]} ${a.last}`;
    const gi = gradeIndex(a.grade);
    const v: Values = {
      firstName: a.first, lastName: a.last, dob: a.learner ? String(a.learner.values.dob) : `${year - 6 - gi}-${String(1 + ((i * 5) % 12)).padStart(2, '0')}-${String(3 + i).padStart(2, '0')}`, gender: a.girl ? 'F' : 'M', grade: a.grade,
      guardian: parent, guardianPhone: fam ? String(fam.values.phone1) : `0${82 + (i % 3)} 555 ${String(3100 + i * 219).slice(0, 4)}`, guardianEmail: fam ? String(fam.values.email1) : `${slug(parent)}@example.com`,
      family: a.family !== undefined || a.learner ? fam!.id : '', previousSchool: a.prev ?? '', docBirth: a.docs[0], docReport: a.docs[1], docImmunisation: a.docs[2],
      assessmentDate: a.assessed ? day(-a.assessed) : '', outcome: a.outcome ?? '', assessmentNote: a.note ?? '',
      depositAmount: a.deposit ?? 0, depositMethod: a.deposit ? 'eft' : '',
    };
    const history = [on(a.ago, secretary, role, 'Application received (fictional record)')];
    if (['documents', 'assessed', 'offered', 'waitlisted', 'enrolled'].includes(a.status) || a.offer) history.push(on(a.ago - 4, secretary, role, 'Documents received'));
    if (a.assessed) history.push(on(a.assessed, staffName(S.deputy), 'Deputy / academic head', 'Record assessment', a.note));
    if (a.wait) { v.waitlistedOn = day(-a.wait); history.push(on(a.wait, secretary, role, 'Add to waiting list', `${GRADES[gi].label} is full.`)); }
    if (a.offer) {
      v.offerDate = day(-a.offer);
      history.push(on(a.offer, secretary, role, 'Make offer'));
      if (a.status !== 'declined') v.placedClass = (a.learner ? classes.find((c) => c.id === a.learner!.values.class)! : classes[CLASSES.findIndex((c) => c[1] === a.grade)]).id;
    }
    if (a.learner) { v.learner = a.learner.id; a.learner.values.enrolled = day(-(a.offer! - 8)); a.learner.history[0].at = `${day(-(a.offer! - 8))}T09:00`; history.push(on(a.offer! - 8, secretary, role, 'Accept offer & enrol')); }
    if (a.reason) history.push(on(Math.max(1, (a.offer ?? a.ago) - 9), secretary, role, a.offer ? 'Offer declined' : 'Withdraw application', a.reason));
    rec('applications', 'AP', v, { status: a.status, createdDaysAgo: a.ago, history });
  });

  /* ---------- Discipline and merits ---------- */
  type Disc = { ci: number; li: number; ago: number; kind: 'merit' | 'incident'; category: string; severity?: string; points: number; text: string; status: string; parent?: string; outcome?: string; detention?: number; by: number };
  const DISC: Disc[] = [
    { ci: C.g9, li: 4, ago: 1, kind: 'incident', category: 'bullying', severity: 'serious', points: 5, text: 'Repeatedly taunting a younger learner at the tuck shop; reported by two prefects.', status: 'contacted', parent: 'Phoned the mother the same afternoon; she will attend a meeting with the deputy.', by: S.lor },
    { ci: C.g7, li: 6, ago: 0, kind: 'incident', category: 'phone', severity: 'minor', points: 1, text: 'Cellphone used during the Mathematics lesson. Phone kept at the office until home time.', status: 'logged', by: S.mat4 },
    { ci: C.g10, li: 2, ago: 2, kind: 'incident', category: 'fighting', severity: 'serious', points: 5, text: 'Pushing and shoving on the sports field after the match; no injuries.', status: 'logged', by: S.pe },
    { ci: C.g8, li: 5, ago: 3, kind: 'incident', category: 'homework', severity: 'minor', points: 1, text: 'Third missed English homework this term.', status: 'contacted', parent: 'Note in the homework diary, signed and returned.', detention: 2, by: S.eng8 },
    { ci: C.g6, li: 1, ago: 4, kind: 'incident', category: 'disruption', severity: 'minor', points: 2, text: 'Calling out and leaving the desk repeatedly during a test.', status: 'contacted', parent: 'Spoke to the father at the gate.', detention: 2, by: S.nst },
    { ci: C.g11, li: 7, ago: 6, kind: 'incident', category: 'late', severity: 'minor', points: 1, text: 'Late for first period four times in two weeks.', status: 'resolved', parent: 'SMS preview logged; mother replied that the lift club has been changed.', outcome: 'Lift club changed; on time since.', by: S.lor },
    { ci: C.g9, li: 8, ago: 9, kind: 'incident', category: 'property', severity: 'serious', points: 5, text: 'Laboratory tap broken while fooling around after the practical.', status: 'resolved', parent: 'Meeting with both parents and the deputy.', outcome: 'Parents paid for the repair; written apology to the laboratory assistant.', by: S.sci },
    { ci: C.g5, li: 3, ago: 8, kind: 'incident', category: 'uniform', severity: 'minor', points: 1, text: 'No school shoes for the third day.', status: 'resolved', parent: 'Phoned the guardian.', outcome: 'Shoes replaced through the uniform bank.', by: S.mat4 },
    { ci: C.g12, li: 2, ago: 5, kind: 'incident', category: 'homework', severity: 'minor', points: 1, text: 'Geography research project handed in a week late.', status: 'contacted', parent: 'Email preview logged for the parents.', detention: 9, by: S.geo },
    { ci: C.g8, li: 9, ago: 12, kind: 'incident', category: 'disruption', severity: 'minor', points: 2, text: 'Throwing paper during assembly.', status: 'resolved', parent: 'Note sent home.', outcome: 'Apologised to the grade head; break-time litter duty done.', by: S.eng8 },
    { ci: C.g7, li: 2, ago: 15, kind: 'incident', category: 'late', severity: 'minor', points: 1, text: 'Late back from second break twice in one week.', status: 'resolved', parent: 'Spoke to the mother at collection.', outcome: 'Verbal warning.', by: S.ssc },
    { ci: C.g4, li: 2, ago: 1, kind: 'merit', category: 'kindness', points: 2, text: 'Helped a new classmate find her way around all week without being asked.', status: 'logged', by: S.eng4 },
    { ci: C.g6, li: 5, ago: 2, kind: 'merit', category: 'academic', points: 3, text: 'Full marks in the Natural Sciences practical task.', status: 'resolved', by: S.nst },
    { ci: C.g9, li: 1, ago: 3, kind: 'merit', category: 'sport', points: 2, text: 'Selected for the district athletics team.', status: 'resolved', by: S.pe },
    { ci: C.g12, li: 6, ago: 4, kind: 'merit', category: 'leadership', points: 3, text: 'Organised the matric tutoring roster for the Grade 8s.', status: 'resolved', by: S.deputy },
    { ci: 3, li: 4, ago: 5, kind: 'merit', category: 'academic', points: 2, text: 'Reader of the week: finished the whole level-6 box.', status: 'resolved', by: 5 },
    { ci: C.g5, li: 7, ago: 6, kind: 'merit', category: 'kindness', points: 2, text: 'Handed in a wallet found on the field.', status: 'resolved', by: S.mat4 },
    { ci: C.g10, li: 5, ago: 7, kind: 'merit', category: 'academic', points: 3, text: 'Top mark in the grade for the Mathematics term test.', status: 'resolved', by: S.mat8 },
    { ci: C.g8, li: 0, ago: 8, kind: 'merit', category: 'sport', points: 2, text: 'Captained the under-14 netball side to the regional final.', status: 'resolved', by: S.pe },
    { ci: C.g11, li: 3, ago: 10, kind: 'merit', category: 'leadership', points: 2, text: 'Ran the recycling drive for the whole high school.', status: 'resolved', by: S.lor },
    { ci: 1, li: 6, ago: 11, kind: 'merit', category: 'kindness', points: 1, text: 'Shared lunch with a friend who had none, three days running.', status: 'resolved', by: 3 },
    { ci: C.g7, li: 9, ago: 13, kind: 'merit', category: 'academic', points: 2, text: 'Most improved in Social Sciences this term.', status: 'resolved', by: S.ssc },
  ];
  DISC.forEach((d) => {
    const l = roll(d.ci)[d.li % roll(d.ci).length];
    const v: Values = { learner: l.id, date: day(-d.ago), kind: d.kind, category: d.category, severity: d.kind === 'merit' ? '' : d.severity ?? 'minor', points: d.points, description: d.text, detention: d.detention !== undefined, detentionDate: d.detention !== undefined ? day(d.detention) : '', parentNote: d.parent ?? '', resolution: d.outcome ?? '' };
    const history = [on(d.ago, staffName(d.by), 'Teacher', `${d.kind === 'merit' ? 'Merit' : 'Incident'} logged (fictional record)`)];
    if (d.parent) history.push(on(Math.max(0, d.ago - 1), staffName(d.by), 'Teacher', 'Parent contacted', d.parent));
    if (d.status === 'resolved') history.push(on(Math.max(0, d.ago - 2), d.severity === 'serious' ? staffName(S.deputy) : staffName(d.by), d.severity === 'serious' ? 'Deputy / academic head' : 'Teacher', d.kind === 'merit' ? 'Merit awarded' : 'Resolve', d.outcome));
    rec('discipline', 'DC', v, { status: d.status, createdDaysAgo: d.ago, history });
  });

  /* ---------- Notices and calendar ---------- */
  type NoticeRow = { title: string; body: string; audience: string; grade?: string; ci?: number; channel: string; status: string; ago: number };
  const NOTICES: NoticeRow[] = [
    { title: 'Grade 7 excursion to the science centre', body: 'The Grade 7 excursion leaves at 07:30 sharp next week. Learners wear full school uniform and bring a packed lunch and a water bottle. Consent forms must be back by Friday.', audience: 'grade', grade: '7', channel: 'both', status: 'draft', ago: 1 },
    { title: 'Parents’ evening — bookings open', body: 'Parents’ evening takes place next week from 17:00 to 19:30. Please book a ten-minute slot with your child’s class teacher through the school office.', audience: 'school', channel: 'email', status: 'approved', ago: 2 },
    { title: 'Grade 4 swimming starts on Monday', body: 'Swimming lessons start on Monday. Please send a costume, towel and swimming cap in a named bag on Mondays and Wednesdays.', audience: 'class', ci: C.g4, channel: 'sms', status: 'draft', ago: 0 },
    { title: 'Term test timetable', body: 'The term test timetable for Grades 8 to 12 is available from class teachers. Tests start in two weeks; learners who are absent need a doctor’s note.', audience: 'school', channel: 'email', status: 'sent', ago: 9 },
    { title: 'Sports day — volunteers needed', body: 'Our inter-house sports day is coming up. We need parent volunteers for the tuck shop and timekeeping. Please reply to the school office if you can help.', audience: 'school', channel: 'both', status: 'sent', ago: 14 },
    { title: 'Grade R concert rehearsal', body: 'Grade R learners rehearse in the hall on Thursday. Please collect your child from the hall entrance at 13:00, not from the classroom.', audience: 'grade', grade: 'R', channel: 'sms', status: 'sent', ago: 5 },
    { title: 'School photographs', body: 'Class and individual photographs are taken next Tuesday. Full summer uniform, please. Order forms come home with your child.', audience: 'school', channel: 'sms', status: 'sent', ago: 21 },
  ];
  NOTICES.forEach((n) => {
    const v: Values = { title: n.title, body: n.body, audience: n.audience, grade: n.grade ?? '', class: n.ci !== undefined ? classes[n.ci].id : '', channel: n.channel };
    const history = [on(n.ago + 1, secretary, role, 'Notice drafted (fictional record)')];
    if (n.status !== 'draft') history.push(on(n.ago, staffName(S.deputy), 'Deputy / academic head', 'Approve notice'));
    if (n.status === 'sent') {
      v.sentOn = day(-n.ago);
      v.recipients = n.audience === 'school' ? families.length : new Set(learners.filter((l) => String(classes.find((c) => c.id === l.values.class)!.values.grade) === n.grade).map((l) => l.values.family)).size;
      history.push(on(n.ago, secretary, role, 'Log as sent (simulated)', 'Preview logged — no message left this browser.'));
    }
    rec('notices', 'NT', v, { status: n.status, createdDaysAgo: n.ago + 1, history });
  });
  ([
    ['Staff development afternoon — school closes at 12:00', 1, 0, 'meeting'], ['Governing body meeting', 3, 0, 'meeting'], ['Parents’ evening', 6, 0, 'meeting'], ['Grade 7 excursion to the science centre', 8, 0, 'event'],
    ['Inter-house sports day', 12, 0, 'sport'], ['Term tests (Grades 8–12)', 15, 9, 'exam'], ['Grade R concert', 20, 0, 'event'], ['Report cards released to parents', 30, 0, 'term'],
    ['Last day of term (demo date)', 33, 0, 'term'], ['School holiday (demo dates)', 34, 16, 'holiday'], ['School photographs', -4, 0, 'event'], ['Under-14 netball regional final', -8, 0, 'sport'],
  ] as const).forEach(([title, offset, extra, kind]) => bulk('events', 'EV', { title, date: day(offset), endDate: extra ? day(offset + extra) : '', kind }, { ago: 40 }));

  return { users, collections, currentUserId: 'u_principal' };
}
