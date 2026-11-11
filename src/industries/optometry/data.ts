// Fictional reference lists for the optometry demo. Scheme names, labs,
// brands and tariff codes are invented; ICD-10 codes are shown as samples.

export const PRACTITIONERS = [
  { value: 'lk', label: 'Dr Lerato Khumalo', short: 'Dr Khumalo', role: 'Optometrist' },
  { value: 'sd', label: 'Sipho Dlamini', short: 'S. Dlamini', role: 'Optometrist' },
  { value: 'mv', label: 'Megan van Wyk', short: 'M. van Wyk', role: 'Dispensing' },
];
export const OPTOMETRISTS = PRACTITIONERS.filter((p) => p.role === 'Optometrist');

export const SCHEMES = [
  { value: 'meridian', label: 'Meridian Health Plan (fictional)' },
  { value: 'baobab', label: 'Baobab Medical Scheme (fictional)' },
  { value: 'protea', label: 'Protea Care (fictional)' },
  { value: 'private', label: 'Private / cash patient' },
];

export const APPOINTMENT_TYPES = [
  { value: 'exam', label: 'Comprehensive eye exam', minutes: 45, clinical: true },
  { value: 'child', label: 'Child vision assessment', minutes: 45, clinical: true },
  { value: 'diabetic', label: 'Diabetic eye screening', minutes: 30, clinical: true },
  { value: 'clfit', label: 'Contact lens fitting', minutes: 45, clinical: true },
  { value: 'claftercare', label: 'Contact lens aftercare', minutes: 30, clinical: true },
  { value: 'driver', label: "Driver's vision screening", minutes: 15, clinical: true },
  { value: 'collection', label: 'Spectacle collection & fitting', minutes: 15, clinical: false },
  { value: 'adjust', label: 'Frame adjustment / repair', minutes: 15, clinical: false },
];

export const ICD10 = [
  { value: 'H52.1', label: 'H52.1 · Myopia' },
  { value: 'H52.0', label: 'H52.0 · Hypermetropia' },
  { value: 'H52.2', label: 'H52.2 · Astigmatism' },
  { value: 'H52.4', label: 'H52.4 · Presbyopia' },
  { value: 'H40.0', label: 'H40.0 · Glaucoma suspect' },
  { value: 'H25.9', label: 'H25.9 · Age-related cataract, unspecified' },
  { value: 'H04.1', label: 'H04.1 · Dry eye (other lacrimal disorder)' },
  { value: 'Z01.0', label: 'Z01.0 · Examination of eyes and vision' },
];

export const RECALL_TYPES = [
  { value: 'annual', label: 'Routine eye exam' },
  { value: 'cl', label: 'Contact lens aftercare' },
  { value: 'diabetic', label: 'Diabetic eye review' },
  { value: 'child', label: 'Child myopia review' },
  { value: 'iop', label: 'Pressure (IOP) re-check' },
];

export const LENS_OPTIONS = [
  { value: 'sv-std', label: 'Single vision 1.50 + anti-reflective', price: 1150 },
  { value: 'sv-blue', label: 'Single vision 1.60 + blue-light filter', price: 1680 },
  { value: 'sv-thin', label: 'Single vision 1.67 high index', price: 2350 },
  { value: 'bf', label: 'Bifocal 1.50 + anti-reflective', price: 1900 },
  { value: 'mf-std', label: 'Multifocal 1.60 standard design', price: 3600 },
  { value: 'mf-prem', label: 'Multifocal 1.67 premium design', price: 5400 },
  { value: 'cl-month', label: 'Monthly contact lenses (6-month supply)', price: 1440 },
  { value: 'cl-daily', label: 'Daily contact lenses (90-day supply)', price: 2250 },
];

export const LABS = [
  { value: 'clearpoint', label: 'Clearpoint Optical Lab (fictional)' },
  { value: 'lensworks', label: 'Lensworks Surfacing (fictional)' },
  { value: 'in-house', label: 'In-house edging' },
];

/** Invented tariff codes — NOT real scheme or professional-body codes. */
export const TARIFFS = [
  { code: 'DEMO-EX1', description: 'Comprehensive eye examination', price: 680 },
  { code: 'DEMO-CL1', description: 'Contact lens fitting', price: 590 },
  { code: 'DEMO-CL2', description: 'Contact lens aftercare', price: 320 },
  { code: 'DEMO-SC1', description: 'Diabetic eye screening', price: 420 },
  { code: 'DEMO-FR1', description: 'Frame', price: 1450 },
  { code: 'DEMO-LN1', description: 'Lenses (pair)', price: 1680 },
];

export const label = (list: Array<{ value: string; label: string }>, v: unknown) => list.find((x) => x.value === v)?.label ?? String(v ?? '—');
