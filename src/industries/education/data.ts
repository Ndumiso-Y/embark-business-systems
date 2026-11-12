// Fixed lists and demo rules for the school demo. Nothing here is CAPS, SA-SAMS or education-department policy.

export type Option = { value: string; label: string };
export const label = (list: Option[], value: string) => list.find((o) => o.value === value)?.label ?? value;

/* ---------------- Grades, subjects, terms ---------------- */
export const GRADES: Option[] = [
  { value: 'R', label: 'Grade R' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Grade ${i + 1}` })),
];
export const gradeLabel = (g: string) => label(GRADES, g);
export const gradeIndex = (g: string) => GRADES.findIndex((x) => x.value === g);

export const SUBJECTS: Option[] = [
  { value: 'ENG', label: 'English' },
  { value: 'MAT', label: 'Mathematics' },
  { value: 'LSK', label: 'Life Skills' },
  { value: 'NST', label: 'Natural Sciences & Technology' },
  { value: 'SSC', label: 'Social Sciences' },
  { value: 'SCI', label: 'Sciences' },
  { value: 'GEO', label: 'Geography' },
  { value: 'LOR', label: 'Life Orientation' },
  { value: 'PE', label: 'Physical Education' },
  { value: 'LIB', label: 'Library & reading' },
];
export const subjectLabel = (s: string) => label(SUBJECTS, s);
/** Lessons on the timetable that carry no marks. */
export const UNASSESSED = ['PE', 'LIB'];
export const ASSESSED_SUBJECTS = SUBJECTS.filter((s) => !UNASSESSED.includes(s.value));

/** Subjects that carry marks per grade. The demo keeps three to five per class; a real school has more. */
export function subjectsForGrade(grade: string): string[] {
  const i = gradeIndex(grade);
  if (i <= 3) return ['ENG', 'MAT', 'LSK'];
  if (i <= 7) return ['ENG', 'MAT', 'NST', 'SSC'];
  return ['ENG', 'MAT', 'SCI', 'GEO', 'LOR'];
}

export const TERM_NUMBERS: Option[] = [1, 2, 3, 4].map((n) => ({ value: `T${n}`, label: `Term ${n}` }));
/** Demo scale for the report card. Not the national seven-point scale. */
export const PASS_MARK = 50;
export function level(pct: number | null): { label: string; tone: 'green' | 'accent' | 'amber' | 'red' | 'dark' } {
  if (pct === null) return { label: 'No mark', tone: 'dark' };
  if (pct >= 80) return { label: 'Outstanding', tone: 'green' };
  if (pct >= 65) return { label: 'Good', tone: 'accent' };
  if (pct >= PASS_MARK) return { label: 'Satisfactory', tone: 'accent' };
  if (pct >= 40) return { label: 'Needs support', tone: 'amber' };
  return { label: 'Not achieved', tone: 'red' };
}

/* ---------------- Timetable ---------------- */
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const PERIOD_TIMES = ['07:45', '08:35', '09:25', '10:35', '11:25', '12:45'];
export const PERIODS = PERIOD_TIMES.length;
export const SLOTS = DAYS.length * PERIODS;

/* ---------------- Attendance ---------------- */
export const ATTENDANCE_CODES: Option[] = [
  { value: 'P', label: 'Present' },
  { value: 'A', label: 'Absent' },
  { value: 'L', label: 'Late' },
];
export const ABSENCE_REASONS: Option[] = [
  { value: 'sick', label: 'Sick' },
  { value: 'family', label: 'Family matter' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'unexplained', label: 'Unexplained' },
];
/** A learner absent this many school days in a row is flagged. */
export const CHRONIC_DAYS = 3;

/* ---------------- Admissions ---------------- */
export const DOCUMENTS: Array<{ key: string; label: string }> = [
  { key: 'docBirth', label: 'Birth certificate' },
  { key: 'docReport', label: 'Previous school report' },
  { key: 'docImmunisation', label: 'Immunisation card' },
];
export const OUTCOMES: Option[] = [
  { value: 'ready', label: 'Ready for the grade' },
  { value: 'support', label: 'Ready, with learning support' },
  { value: 'notready', label: 'Not ready for the grade' },
];
export const GENDERS: Option[] = [{ value: 'F', label: 'Girl' }, { value: 'M', label: 'Boy' }];
export const TRANSPORT: Option[] = [
  { value: 'own', label: 'Own transport' },
  { value: 'bus', label: 'School bus' },
  { value: 'lift', label: 'Lift club' },
  { value: 'walk', label: 'Walks' },
];

/* ---------------- Assessments ---------------- */
export const TASK_KINDS: Option[] = [
  { value: 'test', label: 'Test' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'project', label: 'Project' },
  { value: 'exam', label: 'Examination' },
];

/* ---------------- Fees ---------------- */
export const PAY_METHODS: Option[] = [
  { value: 'eft', label: 'EFT' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
];
export const PLAN_MONTHS: Option[] = [{ value: '10', label: '10 months (Feb–Nov)' }, { value: '12', label: '12 months (Jan–Dec)' }];
/** Demo rule: every child after the first gets this much off the school fee. */
export const SIBLING_DISCOUNT_PCT = 10;
/** Invoices are dated the 1st and are due on this day of the month. */
export const DUE_DAY = 7;

/* ---------------- Discipline ---------------- */
export const RECORD_KINDS: Option[] = [{ value: 'incident', label: 'Incident (demerit)' }, { value: 'merit', label: 'Merit' }];
export const SEVERITIES: Option[] = [{ value: 'minor', label: 'Minor' }, { value: 'serious', label: 'Serious' }];
export const DISCIPLINE_CATEGORIES: Option[] = [
  { value: 'homework', label: 'Homework not done' },
  { value: 'uniform', label: 'Uniform' },
  { value: 'disruption', label: 'Disrupting a lesson' },
  { value: 'late', label: 'Late for class' },
  { value: 'phone', label: 'Cellphone in class' },
  { value: 'bullying', label: 'Bullying' },
  { value: 'fighting', label: 'Fighting' },
  { value: 'property', label: 'Damage to property' },
  { value: 'academic', label: 'Academic achievement' },
  { value: 'kindness', label: 'Kindness & citizenship' },
  { value: 'sport', label: 'Sport & culture' },
  { value: 'leadership', label: 'Leadership' },
];
export const MERIT_CATEGORIES = ['academic', 'kindness', 'sport', 'leadership'];
/** Demo points: merits add, incidents subtract. */
export const DEFAULT_POINTS = { merit: 2, minor: 1, serious: 5 };

/* ---------------- Staff ---------------- */
export const STAFF_ROLES: Option[] = [
  { value: 'principal', label: 'Principal' },
  { value: 'deputy', label: 'Deputy principal' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Administration' },
];
export const LEAVE_REASONS: Option[] = [
  { value: 'sick', label: 'Sick' },
  { value: 'family', label: 'Family responsibility' },
  { value: 'training', label: 'Training / workshop' },
  { value: 'other', label: 'Other' },
];
/** SACE registrations expiring within this many days are flagged. */
export const SACE_WARN_DAYS = 60;

/* ---------------- Notices & calendar ---------------- */
export const AUDIENCES: Option[] = [
  { value: 'school', label: 'Whole school' },
  { value: 'grade', label: 'One grade' },
  { value: 'class', label: 'One class' },
];
export const CHANNELS: Option[] = [{ value: 'sms', label: 'SMS' }, { value: 'email', label: 'Email' }, { value: 'both', label: 'SMS and email' }];
export const EVENT_KINDS: Option[] = [
  { value: 'term', label: 'Term date' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'exam', label: 'Tests & exams' },
  { value: 'sport', label: 'Sport & culture' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'event', label: 'School event' },
];
