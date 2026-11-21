// Fixed lists and demo settings for the recruitment agency demo. Every company,
// person and figure is fictional; every threshold here is a demo setting.

export type Opt = { value: string; label: string };
export const label = (list: Opt[], value: string) => list.find((o) => o.value === value)?.label ?? (value || '—');

/* ---------------- Demo settings ---------------- */
export const VAT_RATE = 15;
/** Ownership rule: once a candidate's CV has gone to a client, nobody else may send it there for this many months. */
export const OWNERSHIP_MONTHS = 6;
/** Contractor timesheets above this many hours in a week are flagged (demo setting). */
export const WEEKLY_HOURS_CAP = 45;
/** Contractor assignments are flagged when they approach this many months … */
export const S198A_MONTHS = 3;
/** … starting this many days before the date. */
export const S198A_WARNING_DAYS = 21;
/**
 * ILLUSTRATIVE ONLY. An annual earnings figure used to demonstrate a flag modelled on
 * section 198A of the Labour Relations Act. It is a demo constant and is NOT the current
 * legal earnings threshold — a real system would take the figure from current regulations.
 */
export const ILLUSTRATIVE_EARNINGS_THRESHOLD = 250_000;
/** Hours per week used to estimate a contractor's annual earnings for the illustrative flag. */
export const STANDARD_WEEK_HOURS = 40;
/** POPIA consent is flagged this many days before it lapses. */
export const CONSENT_WARNING_DAYS = 30;
/** Default length of a candidate's consent when it is recorded. */
export const CONSENT_MONTHS = 12;
/** A job order open this long with no CV sent is flagged. */
export const STALE_JOB_DAYS = 14;

/** Probability used to weight the pipeline: a job counts at its furthest candidate's stage. */
export const STAGE_PROBABILITY: Record<string, number> = {
  longlist: 0, submitted: 0.1, reviewing: 0.15, interview: 0.25, final: 0.4, offer: 0.7, accepted: 1,
};

/* ---------------- Option lists ---------------- */
export const DISCIPLINES: Opt[] = [
  { value: 'finance', label: 'Finance & accounting' },
  { value: 'it', label: 'IT & software' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'sales', label: 'Sales' },
];

export const SECTORS: Opt[] = [
  { value: 'logistics', label: 'Logistics & freight' },
  { value: 'financial', label: 'Financial services' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'energy', label: 'Renewable energy' },
  { value: 'software', label: 'Software' },
  { value: 'food', label: 'Food & agri-processing' },
  { value: 'retail', label: 'Retail' },
  { value: 'mining', label: 'Mining services' },
  { value: 'telecoms', label: 'Telecoms' },
  { value: 'insurance', label: 'Insurance' },
];

export const LOCATIONS: Opt[] = [
  { value: 'jhb', label: 'Johannesburg' },
  { value: 'cpt', label: 'Cape Town' },
  { value: 'dbn', label: 'Durban' },
  { value: 'pta', label: 'Pretoria' },
  { value: 'gqb', label: 'Gqeberha' },
  { value: 'stb', label: 'Stellenbosch' },
  { value: 'remote', label: 'Remote (South Africa)' },
];

export const NOTICE_PERIODS: Opt[] = [
  { value: 'immediate', label: 'Immediately available' },
  { value: '1w', label: '1 week' },
  { value: '2w', label: '2 weeks' },
  { value: '1m', label: '1 calendar month' },
  { value: '2m', label: '2 months' },
  { value: '3m', label: '3 months' },
];
export const NOTICE_DAYS: Record<string, number> = { immediate: 0, '1w': 7, '2w': 14, '1m': 30, '2m': 60, '3m': 90 };

export const SOURCES: Opt[] = [
  { value: 'database', label: 'Agency database' },
  { value: 'referral', label: 'Referral' },
  { value: 'jobboard', label: 'Job-board advert (posted by hand)' },
  { value: 'linkedin', label: 'LinkedIn search (manual)' },
  { value: 'website', label: 'Website application' },
  { value: 'headhunt', label: 'Headhunted' },
];

export const JOB_TYPES: Opt[] = [
  { value: 'exclusive', label: 'Exclusive' },
  { value: 'contingent', label: 'Contingent' },
];

export const PRIORITIES: Opt[] = [
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

export const REMEDIES: Opt[] = [
  { value: 'replacement', label: 'Free replacement' },
  { value: 'refund', label: 'Pro-rata refund (credit note)' },
];

export const FORMATS: Opt[] = [
  { value: 'inperson', label: 'In person' },
  { value: 'video', label: 'Video call' },
  { value: 'phone', label: 'Phone' },
  { value: 'assessment', label: 'Assessment / test' },
];

export const ROUNDS: Opt[] = [
  { value: 'first', label: 'First interview' },
  { value: 'second', label: 'Second interview' },
  { value: 'final', label: 'Final interview' },
];

export const RATINGS: Opt[] = [
  { value: '5', label: '5 — outstanding' },
  { value: '4', label: '4 — strong' },
  { value: '3', label: '3 — suitable' },
  { value: '2', label: '2 — doubts' },
  { value: '1', label: '1 — not suitable' },
];

export const OUTCOMES: Opt[] = [
  { value: 'progress', label: 'Progress to next round' },
  { value: 'hold', label: 'On hold' },
  { value: 'reject', label: 'Do not progress' },
];

export const INVOICE_KINDS: Opt[] = [
  { value: 'fee', label: 'Placement fee' },
  { value: 'contract', label: 'Contractor hours' },
  { value: 'credit', label: 'Credit note' },
];

export const CONSULTANT_ROLES: Opt[] = [
  { value: 'director', label: 'Director' },
  { value: 'senior', label: 'Senior consultant' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'resourcer', label: 'Resourcer' },
];

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
