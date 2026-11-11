// Reference lists and demo rules for the private security configuration.
// Everything here is illustrative: grades, SLAs and thresholds are demo values,
// not PSIRA, Firearms Control Act or contractual requirements.
export type Opt = { value: string; label: string };
export const label = (opts: ReadonlyArray<Opt>, v: unknown) => opts.find((o) => o.value === v)?.label ?? (v ? String(v) : '—');

/* ---------------- Demo rules ---------------- */
/** Armed response target: signal received → vehicle on scene (minutes), unless the contract says otherwise. */
export const DEFAULT_SLA_MIN = 15;
/** Registration, competency, licence, medical and training dates are flagged this many days ahead. */
export const EXPIRY_WINDOW_DAYS = 30;
export const CONTRACT_WINDOW_DAYS = 60;
/** Every site should see a supervisor at least this often. */
export const INSPECTION_INTERVAL_DAYS = 14;
/** A patrol round that starts more than this many minutes after its due time is "late". */
export const PATROL_GRACE_MIN = 15;
export const VAT_RATE = 15;

/* ---------------- Shifts ---------------- */
export const SHIFT_KINDS: Opt[] = [
  { value: 'day', label: 'Day shift 06:00–18:00' },
  { value: 'night', label: 'Night shift 18:00–06:00' },
];
export const SHIFT_SHORT: Record<string, string> = { day: 'Day', night: 'Night' };
export const SHIFT_START: Record<string, string> = { day: '06:00', night: '18:00' };
export const SHIFT_END: Record<string, string> = { day: '18:00', night: '06:00' };

/* ---------------- Officers ---------------- */
/** PSIRA-style grades. A is the highest (site manager), E the entry grade. */
export const GRADES: Opt[] = ['A', 'B', 'C', 'D', 'E'].map((g) => ({ value: g, label: `Grade ${g}` }));
export const gradeRank = (g: unknown) => {
  const s = String(g ?? '');
  return s.length === 1 && 'EDCBA'.includes(s) ? 'EDCBA'.indexOf(s) + 1 : 0;
};
export const EMPLOYMENT: Opt[] = [
  { value: 'active', label: 'Active' },
  { value: 'leave', label: 'On leave' },
  { value: 'suspended', label: 'Suspended' },
];

/* ---------------- Sites ---------------- */
export const SITE_TYPES: Opt[] = [
  { value: 'retail', label: 'Retail centre' },
  { value: 'logistics', label: 'Warehouse / logistics' },
  { value: 'estate', label: 'Residential estate' },
  { value: 'industrial', label: 'Industrial plant' },
  { value: 'health', label: 'Hospital / clinic' },
  { value: 'office', label: 'Office park' },
  { value: 'education', label: 'School / campus' },
  { value: 'energy', label: 'Energy / utilities' },
  { value: 'residential', label: 'Sectional title complex' },
  { value: 'motor', label: 'Motor dealership' },
];
export const CHECKPOINT_NAMES = [
  'Main gate', 'Perimeter north', 'Perimeter south', 'Loading area', 'Generator room', 'Parking level', 'Plant room door', 'Roof access', 'Back fence', 'Guard house',
];
export const checkpointList = (n: number) => Array.from({ length: Math.max(0, Math.min(n, 10)) }, (_, i) => `CP${i + 1} ${CHECKPOINT_NAMES[i]}`);

/* ---------------- Occurrence book ---------------- */
export const OB_TYPES: Opt[] = [
  { value: 'routine', label: 'Routine check' },
  { value: 'visitor', label: 'Visitor' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'alarm', label: 'Alarm' },
  { value: 'patrol', label: 'Patrol' },
  { value: 'handover', label: 'Shift handover' },
  { value: 'followup', label: 'Follow-up entry' },
];

/* ---------------- Incidents ---------------- */
export const INCIDENT_TYPES: Opt[] = [
  { value: 'theft', label: 'Theft' },
  { value: 'breakin', label: 'Break-in' },
  { value: 'trespass', label: 'Trespass' },
  { value: 'assault', label: 'Assault' },
  { value: 'fire', label: 'Fire' },
  { value: 'access', label: 'Access breach' },
  { value: 'vehicle', label: 'Vehicle' },
];
export const SEVERITIES: Opt[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High (serious)' },
];

/* ---------------- Armed response ---------------- */
export const SIGNALS: Opt[] = [
  { value: 'intruder', label: 'Intruder alarm' },
  { value: 'panic', label: 'Panic button' },
  { value: 'fence', label: 'Electric fence' },
  { value: 'fire', label: 'Fire / smoke' },
  { value: 'duress', label: 'Duress code' },
  { value: 'tamper', label: 'Tamper / power fail' },
];
export const OUTCOMES: Opt[] = [
  { value: 'false', label: 'False alarm — premises secure' },
  { value: 'usererror', label: 'User error — keyholder on site' },
  { value: 'positive', label: 'Positive — suspects fled' },
  { value: 'arrest', label: 'Positive — suspect detained for SAPS' },
  { value: 'fault', label: 'Equipment fault reported to client' },
];

/* ---------------- Equipment ---------------- */
export const EQUIPMENT_CATEGORIES: Opt[] = [
  { value: 'firearm', label: 'Firearm' },
  { value: 'radio', label: 'Two-way radio' },
  { value: 'bodycam', label: 'Body camera' },
  { value: 'baton', label: 'Baton' },
  { value: 'panic', label: 'Panic button' },
  { value: 'vehicle', label: 'Vehicle' },
];
/** Categories that carry a licence / permit date. */
export const PERMIT_LABEL: Record<string, string> = { firearm: 'Firearm licence', vehicle: 'Licence disc' };

/* ---------------- Inspections ---------------- */
export const CHECK_ITEMS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'uniform', label: 'Uniform & appearance', hint: 'Full uniform, name badge, PSIRA card on person' },
  { key: 'postOrders', label: 'Post orders known', hint: 'Officer can explain the site instructions and emergency contacts' },
  { key: 'obUpToDate', label: 'Occurrence book up to date', hint: 'Entries current, numbered and signed' },
  { key: 'equipment', label: 'Equipment', hint: 'Radio, torch, panic button and issued items present and working' },
  { key: 'alertness', label: 'Alertness', hint: 'Officer awake, at post and challenging visitors' },
];
export const SCORES: Opt[] = [
  { value: '2', label: 'Satisfactory' },
  { value: '1', label: 'Needs attention' },
  { value: '0', label: 'Unsatisfactory' },
];
export const INSPECTORS = ['Sipho Mokoena', 'Anika van Rooyen', 'Lerato Phiri'];
