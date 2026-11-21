// Fixed lists and demo rules for the Human resources demo (Bluegum Distribution).
// Every rule below is a DEMO rule. Leave, overtime and disciplinary rules are modelled on
// the Basic Conditions of Employment Act (BCEA) and the Labour Relations Act (LRA) Code of
// Good Practice for illustration only — they are not legal advice and not a compliance engine.

export type Option = { value: string; label: string };
export const label = (list: ReadonlyArray<Option>, value: string) => list.find((o) => o.value === value)?.label ?? value;

/* ---------------- Company structure ---------------- */
export const SITES = [
  { value: 'ho', label: 'Head office · Johannesburg', short: 'Head office' },
  { value: 'jhb', label: 'Johannesburg depot', short: 'Johannesburg' },
  { value: 'dbn', label: 'Durban depot', short: 'Durban' },
  { value: 'gqb', label: 'Gqeberha depot', short: 'Gqeberha' },
] as const satisfies ReadonlyArray<Option & { short: string }>;

export const DEPARTMENTS = [
  { value: 'mgmt', label: 'Management' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'fleet', label: 'Drivers & fleet' },
  { value: 'sales', label: 'Sales' },
  { value: 'finance', label: 'Finance' },
  { value: 'admin', label: 'HR & admin' },
] as const satisfies ReadonlyArray<Option>;

export type Job = Option & { dept: string; salary: number; ppe?: boolean; driver?: boolean; forklift?: boolean };
/** Jobs with their department, a typical monthly salary (fictional) and what the job needs on day one. */
export const JOBS: Job[] = [
  { value: 'md', label: 'Managing director', dept: 'mgmt', salary: 145000 },
  { value: 'depotmgr', label: 'Depot manager', dept: 'mgmt', salary: 62000 },
  { value: 'hrmgr', label: 'HR manager', dept: 'admin', salary: 68000 },
  { value: 'hrofficer', label: 'HR officer', dept: 'admin', salary: 32000 },
  { value: 'payroll', label: 'Payroll administrator', dept: 'admin', salary: 30500 },
  { value: 'adminclerk', label: 'Admin clerk', dept: 'admin', salary: 16500 },
  { value: 'finmgr', label: 'Financial manager', dept: 'finance', salary: 72000 },
  { value: 'accclerk', label: 'Accounts clerk', dept: 'finance', salary: 21000 },
  { value: 'salesmgr', label: 'Sales manager', dept: 'sales', salary: 65000 },
  { value: 'kam', label: 'Key account manager', dept: 'sales', salary: 42000 },
  { value: 'salesrep', label: 'Sales representative', dept: 'sales', salary: 24000 },
  { value: 'whsup', label: 'Warehouse supervisor', dept: 'warehouse', salary: 26000, ppe: true },
  { value: 'picker', label: 'Picker / packer', dept: 'warehouse', salary: 9800, ppe: true },
  { value: 'forklift', label: 'Forklift operator', dept: 'warehouse', salary: 12500, ppe: true, forklift: true },
  { value: 'fleetctl', label: 'Fleet controller', dept: 'fleet', salary: 22000 },
  { value: 'driver', label: 'Delivery driver (Code 14)', dept: 'fleet', salary: 15800, ppe: true, driver: true },
  { value: 'driverasst', label: 'Driver’s assistant', dept: 'fleet', salary: 8900, ppe: true },
];
export const jobOf = (value: string) => JOBS.find((j) => j.value === value);

export const EMPLOYMENT_TYPES: Option[] = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'fixed', label: 'Fixed-term contract' },
];

export const PROBATION_OUTCOMES: Option[] = [
  { value: 'confirmed', label: 'Confirmed — meets the standard' },
  { value: 'extended', label: 'Extended — more time needed' },
  { value: 'notconfirmed', label: 'Not confirmed' },
];

export const EXIT_REASONS: Option[] = [
  { value: 'resignation', label: 'Resignation' },
  { value: 'dismissal', label: 'Dismissal (after a disciplinary hearing)' },
  { value: 'contract', label: 'Fixed-term contract ended' },
  { value: 'probation', label: 'Not confirmed after probation' },
  { value: 'retrenchment', label: 'Operational requirements (retrenchment)' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'mutual', label: 'Mutual separation' },
];

/* ---------------- Onboarding ---------------- */
export type OnboardingItem = { key: string; label: string; short: string; when?: 'ppe' | 'driver' };
export const ONBOARDING_ITEMS: OnboardingItem[] = [
  { key: 'contract', label: 'Employment contract signed', short: 'Contract signed' },
  { key: 'idcopy', label: 'ID copy on file', short: 'ID copy' },
  { key: 'taxno', label: 'Tax number captured', short: 'Tax number' },
  { key: 'banking', label: 'Banking details captured', short: 'Banking details' },
  { key: 'emergency', label: 'Emergency contact recorded', short: 'Emergency contact' },
  { key: 'induction', label: 'Site safety induction done', short: 'Safety induction' },
  { key: 'ppe', label: 'PPE issued (safety boots, hi-vis vest, gloves)', short: 'PPE issued', when: 'ppe' },
  { key: 'licence', label: 'Driver’s licence (Code 14) and PrDP checked', short: 'Licence and PrDP checked', when: 'driver' },
];

/* ---------------- Leave ---------------- */
export const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual leave', short: 'Annual', colour: 'annual' },
  { value: 'sick', label: 'Sick leave', short: 'Sick', colour: 'sick' },
  { value: 'family', label: 'Family responsibility', short: 'Family', colour: 'family' },
  { value: 'maternity', label: 'Maternity leave', short: 'Maternity', colour: 'parent' },
  { value: 'parental', label: 'Parental leave', short: 'Parental', colour: 'parent' },
  { value: 'study', label: 'Study leave', short: 'Study', colour: 'study' },
  { value: 'unpaid', label: 'Unpaid leave', short: 'Unpaid', colour: 'unpaid' },
] as const satisfies ReadonlyArray<Option & { short: string; colour: string }>;
export type LeaveType = (typeof LEAVE_TYPES)[number]['value'];

/** Annual leave: 15 working days a year, earned at 1.25 days per completed month (demo rule modelled on BCEA s20). */
export const ANNUAL_DAYS = 15;
export const ANNUAL_ACCRUAL = 1.25;
/** Sick leave: 30 days per 36-month cycle; in the first six months one day per 26 days worked (modelled on BCEA s22). */
export const SICK_DAYS = 30;
export const SICK_CYCLE_MONTHS = 36;
export const SICK_FIRST_MONTHS = 6;
export const SICK_DAYS_WORKED_PER_DAY = 26;
/** Sick leave longer than this many consecutive working days needs a medical certificate. */
export const SICK_CERT_AFTER = 2;
/** Family responsibility: 3 days a year, for employees with more than four months’ service (modelled on BCEA s27). */
export const FAMILY_DAYS = 3;
export const FAMILY_MIN_MONTHS = 4;
/** Company policy in this demo. */
export const STUDY_DAYS = 5;
export const PARENTAL_MAX_DAYS = 10;
export const MATERNITY_MAX_MONTHS = 4;
/** No more than this share of a team (rounded up) may be away on the same day without a cover note. */
export const TEAM_AWAY_SHARE = 0.25;
/** Working days per month used for a daily rate (salary ÷ 21.67). */
export const WORKING_DAYS_PER_MONTH = 21.67;

/* ---------------- Probation, contracts, certificates ---------------- */
export const PROBATION_MONTHS = 3;
export const PROBATION_WARN_DAYS = 30;
export const FIXED_TERM_WARN_DAYS = 30;
export const CERT_WARN_DAYS = 60;

export const CERT_TYPES = [
  { value: 'prdp', label: 'Professional driving permit (PrDP)', months: 24 },
  { value: 'forklift', label: 'Forklift operator certificate', months: 24 },
  { value: 'firstaid', label: 'First aid level 1', months: 36 },
  { value: 'firemarshal', label: 'Fire marshal', months: 24 },
] as const satisfies ReadonlyArray<Option & { months: number }>;

/* ---------------- Payroll inputs ---------------- */
/** Overtime above this many hours in one week needs a recorded manager approval (demo rule modelled on BCEA s10). */
export const OT_WEEKLY_LIMIT = 10;
export const INPUT_KINDS: Option[] = [
  { value: 'overtime', label: 'Overtime' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'deduction', label: 'Deduction' },
];

/* ---------------- Hiring ---------------- */
export const REQ_REASONS: Option[] = [
  { value: 'replacement', label: 'Replacement' },
  { value: 'growth', label: 'New position' },
];
export const APPLICANT_SOURCES: Option[] = [
  { value: 'referral', label: 'Staff referral' },
  { value: 'website', label: 'Company website' },
  { value: 'jobboard', label: 'Job board' },
  { value: 'walkin', label: 'Walk-in CV' },
];

/* ---------------- Performance ---------------- */
export const RATINGS: Option[] = [
  { value: '1', label: '1 · Unacceptable' },
  { value: '2', label: '2 · Below expectations' },
  { value: '3', label: '3 · Meets expectations' },
  { value: '4', label: '4 · Exceeds expectations' },
  { value: '5', label: '5 · Outstanding' },
];

/* ---------------- Discipline & grievances ---------------- */
export const CASE_KINDS: Option[] = [
  { value: 'disciplinary', label: 'Disciplinary' },
  { value: 'grievance', label: 'Grievance' },
];
export const CASE_CATEGORIES: Option[] = [
  { value: 'absenteeism', label: 'Absent without leave' },
  { value: 'latecoming', label: 'Late coming' },
  { value: 'safety', label: 'Safety rule breach' },
  { value: 'stock', label: 'Stock loss' },
  { value: 'vehicle', label: 'Vehicle damage / traffic fines' },
  { value: 'conduct', label: 'Abusive conduct' },
  { value: 'shifts', label: 'Grievance · shift allocation' },
  { value: 'workload', label: 'Grievance · workload' },
  { value: 'treatment', label: 'Grievance · treatment by a supervisor' },
];
export const FINDINGS: Option[] = [
  { value: 'guilty', label: 'Guilty' },
  { value: 'notguilty', label: 'Not guilty' },
  { value: 'upheld', label: 'Grievance upheld' },
  { value: 'partly', label: 'Grievance partly upheld' },
  { value: 'notupheld', label: 'Grievance not upheld' },
];
export const SANCTIONS: Option[] = [
  { value: 'counselling', label: 'Counselling (no warning)' },
  { value: 'verbal', label: 'Verbal warning' },
  { value: 'written', label: 'Written warning' },
  { value: 'final', label: 'Final written warning' },
  { value: 'dismissal', label: 'Dismissal' },
];
/** Months a warning stays valid on file (company policy in this demo). */
export const WARNING_MONTHS: Record<string, number> = { verbal: 3, written: 6, final: 12 };
/** Working days of notice before a disciplinary hearing (demo rule in the style of the LRA Code of Good Practice). */
export const HEARING_NOTICE_DAYS = 2;
