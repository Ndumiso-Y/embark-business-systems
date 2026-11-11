// Option lists and demo constants for the contract cleaning configuration.
// Everything here is fictional or a plainly-labelled demonstration rule.
export type Option = { value: string; label: string };
export const label = (list: Option[], value: unknown) => list.find((o) => o.value === value)?.label ?? String(value ?? '');

export const VAT_RATE = 15;

export const CLIENT_SECTORS: Option[] = [
  { value: 'office', label: 'Corporate offices' },
  { value: 'school', label: 'Education' },
  { value: 'clinic', label: 'Healthcare' },
  { value: 'retail', label: 'Retail property' },
];

export const SITE_TYPES: Option[] = [
  { value: 'office', label: 'Office' },
  { value: 'school', label: 'School' },
  { value: 'clinic', label: 'Clinic / healthcare' },
  { value: 'retail', label: 'Shopping centre' },
];

export const SERVICE_DAYS: Option[] = [
  { value: 'weekdays', label: 'Monday – Friday' },
  { value: 'monsat', label: 'Monday – Saturday' },
  { value: 'daily', label: 'Every day' },
];

export const STAFF_ROLES: Option[] = [
  { value: 'cleaner', label: 'Cleaner' },
  { value: 'leader', label: 'Team leader' },
  { value: 'relief', label: 'Relief cleaner' },
  { value: 'supervisor', label: 'Area supervisor' },
];

/** Training tracked per staff member (expiry date fields on the staff record). */
export const TRAININGS = [
  { key: 'icExpiry', label: 'Infection control', short: 'Infection control' },
  { key: 'chemExpiry', label: 'Chemical handling', short: 'Chemicals' },
  { key: 'heightsExpiry', label: 'Working at heights', short: 'Heights' },
] as const;

export const PERIODIC_TASKS: Option[] = [
  { value: 'carpet', label: 'Carpet extraction' },
  { value: 'windows', label: 'Window cleaning' },
  { value: 'stripseal', label: 'Floor strip & seal' },
  { value: 'highdust', label: 'High dusting' },
  { value: 'ablutions', label: 'Ablution deep clean' },
  { value: 'upholstery', label: 'Upholstery shampoo' },
  { value: 'pressure', label: 'Pressure wash walkways' },
];

export const FREQUENCIES: Array<Option & { days: number }> = [
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'monthly', label: 'Monthly', days: 30 },
  { value: 'quarterly', label: 'Quarterly', days: 91 },
];

/** Areas scored 1–5 on a supervisor inspection. */
export const INSPECTION_AREAS = [
  { key: 's_reception', label: 'Reception & entrance' },
  { key: 's_ablutions', label: 'Ablutions' },
  { key: 's_kitchens', label: 'Kitchens & canteens' },
  { key: 's_floors', label: 'Floors' },
  { key: 's_bins', label: 'Bins & waste' },
  { key: 's_glass', label: 'Glass & windows' },
] as const;

export const SCORE_WORDS = ['', 'Unacceptable', 'Poor', 'Acceptable', 'Good', 'Excellent'];

export const INSPECTION_KINDS: Option[] = [
  { value: 'routine', label: 'Routine inspection' },
  { value: 'reinspection', label: 'Re-inspection' },
  { value: 'client', label: 'Joint walk-through with client' },
];

export const COMPLAINT_KINDS: Option[] = [
  { value: 'complaint', label: 'Complaint' },
  { value: 'request', label: 'Request' },
];

export const COMPLAINT_CATEGORIES: Option[] = [
  { value: 'missed', label: 'Missed clean' },
  { value: 'quality', label: 'Quality of clean' },
  { value: 'consumables', label: 'Consumables run out' },
  { value: 'conduct', label: 'Staff conduct' },
  { value: 'damage', label: 'Damage / breakage' },
  { value: 'extra', label: 'Extra service request' },
];

/** Demo response targets: hours from logging to acknowledgement. */
export const PRIORITIES: Array<Option & { hours: number }> = [
  { value: 'urgent', label: 'Urgent', hours: 2 },
  { value: 'high', label: 'High', hours: 4 },
  { value: 'normal', label: 'Normal', hours: 24 },
  { value: 'low', label: 'Low', hours: 48 },
];

export const STOCK_CATEGORIES: Option[] = [
  { value: 'paper', label: 'Paper products' },
  { value: 'hygiene', label: 'Soap & hygiene' },
  { value: 'refuse', label: 'Refuse bags' },
  { value: 'chemical', label: 'Chemicals' },
  { value: 'sundries', label: 'Cloths, mops & sundries' },
  { value: 'ppe', label: 'PPE' },
];

export const EQUIPMENT_TYPES: Array<Option & { electrical: boolean }> = [
  { value: 'vacuum', label: 'Vacuum cleaner', electrical: true },
  { value: 'scrubber', label: 'Scrubber-drier', electrical: true },
  { value: 'polisher', label: 'Floor polisher', electrical: true },
  { value: 'extractor', label: 'Carpet extractor', electrical: true },
  { value: 'pressure', label: 'Pressure washer', electrical: true },
  { value: 'trolley', label: 'Janitor trolley', electrical: false },
];

export const CONDITIONS: Option[] = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

export const JOB_TYPES: Option[] = [
  { value: 'postconstruction', label: 'Post-construction clean' },
  { value: 'event', label: 'Event clean' },
  { value: 'deepclean', label: 'Once-off deep clean' },
  { value: 'moveout', label: 'Move-out clean' },
  { value: 'carpets', label: 'Carpet & upholstery' },
];

export const INVOICE_KINDS: Option[] = [
  { value: 'contract', label: 'Monthly contract' },
  { value: 'onceoff', label: 'Once-off job' },
];

/* ---------------- Demo rules (not legal, labour or tax rules) ---------------- */
/** Minutes after the shift start before a clock-in counts as late. */
export const LATE_GRACE_MIN = 10;
/** Quotes above this value (excl. VAT) need the "Approve quotes" permission to send. */
export const QUOTE_APPROVAL_THRESHOLD = 15000;
/** Quotes below this gross margin need the "Approve quotes" permission to send. */
export const MIN_MARGIN_PCT = 25;
/** Working days per month used to value one cleaner-shift for invoice credits. */
export const WORKING_DAYS_PER_MONTH = 22;
/** A failed inspection is re-inspected within this many days. */
export const REINSPECT_DAYS = 7;
/** Contracts ending within this window are flagged. */
export const CONTRACT_WARNING_DAYS = 60;
