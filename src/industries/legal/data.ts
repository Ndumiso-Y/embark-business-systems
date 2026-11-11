// Fictional reference lists for the law-firm demo (Mahlaba & Rossouw Attorneys).
// Every person, rate, court reference and party is invented.

export type Option = { value: string; label: string };

export const FEE_EARNERS = [
  { value: 'nm', label: 'Nandi Mahlaba', short: 'N. Mahlaba', role: 'Managing partner', rate: 3200, userId: 'u_mp' },
  { value: 'id', label: 'Imran Desai', short: 'I. Desai', role: 'Associate attorney', rate: 2100, userId: 'u_assoc' },
  { value: 'zm', label: 'Zinhle Mthembu', short: 'Z. Mthembu', role: 'Candidate attorney', rate: 950, userId: 'u_cand' },
  { value: 'cj', label: 'Carmen Jacobs', short: 'C. Jacobs', role: 'Paralegal', rate: 650, userId: 'u_sec' },
];
export const FEE_EARNER_OPTIONS: Option[] = FEE_EARNERS.map((f) => ({ value: f.value, label: `${f.label} · ${f.role}` }));

/** Demo target for billable-hours utilisation. */
export const DAILY_TARGET_HOURS = 6;

export const MATTER_TYPES: Option[] = [
  { value: 'litigation', label: 'Civil litigation' },
  { value: 'conveyancing', label: 'Conveyancing' },
  { value: 'family', label: 'Family law' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'labour', label: 'Labour' },
  { value: 'estates', label: 'Deceased estates' },
];

export const FEE_BASIS: Option[] = [
  { value: 'hourly', label: 'Hourly (time-based)' },
  { value: 'fixed', label: 'Fixed fee (agreed estimate)' },
  { value: 'contingency', label: 'Contingency — noted only (demo, no fee calculation)' },
];

export const CLIENT_KINDS: Option[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'company', label: 'Company / CC / trust' },
];

export const FICA_STATUS: Option[] = [
  { value: 'verified', label: 'Documents on file (simulated)' },
  { value: 'pending', label: 'Documents requested' },
  { value: 'outstanding', label: 'Not started' },
];

export const CONFLICT_OUTCOMES: Option[] = [
  { value: 'clear', label: 'Clear — no hits of concern' },
  { value: 'potential', label: 'Potential conflict — note required' },
  { value: 'conflict', label: 'Conflict — cannot act' },
];

export const TRUST_TYPES: Option[] = [
  { value: 'deposit', label: 'Deposit into trust' },
  { value: 'payment', label: 'Payment from trust (third party)' },
  { value: 'transfer', label: 'Transfer to business account (fees)' },
];

export const DIARY_TYPES: Option[] = [
  { value: 'court', label: 'Court date' },
  { value: 'filing', label: 'Filing deadline' },
  { value: 'prescription', label: 'Prescription date' },
  { value: 'meeting', label: 'Client meeting' },
];

export const DOC_TYPES: Option[] = [
  { value: 'pleading', label: 'Pleading / notice' },
  { value: 'affidavit', label: 'Affidavit' },
  { value: 'agreement', label: 'Agreement / contract' },
  { value: 'letter', label: 'Letter of demand / correspondence' },
  { value: 'will', label: 'Will / estate document' },
  { value: 'deed', label: 'Transfer deed / conveyancing' },
  { value: 'opinion', label: 'Legal opinion memo' },
];
/** Document types that are lodged at court (and may be marked filed). */
export const COURT_DOC_TYPES = ['pleading', 'affidavit'];

export const label = (list: Option[], v: unknown) => list.find((x) => x.value === v)?.label ?? String(v ?? '—');
export const earner = (v: unknown) => FEE_EARNERS.find((f) => f.value === v);
export const earnerName = (v: unknown) => earner(v)?.label ?? '—';
export const earnerForUser = (userId: string) => FEE_EARNERS.find((f) => f.userId === userId);
