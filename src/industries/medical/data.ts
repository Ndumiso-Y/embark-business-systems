// Fictional reference lists for the general-practice demo. Scheme names, labs,
// tariff codes and people are invented. ICD-10 codes are public classification
// codes shown as samples only. Medicine list is generic names for data-entry
// demonstration — not a formulary and not clinical guidance.

export type Option = { value: string; label: string };

export const CLINICIANS = [
  { value: 'tm', label: 'Dr Thandeka Mabaso', short: 'Dr Mabaso', role: 'GP partner', doctor: true },
  { value: 'rc', label: 'Dr Ruan Coetzee', short: 'Dr Coetzee', role: 'GP', doctor: true },
  { value: 'am', label: 'Dr Aisha Moosa (locum)', short: 'Dr Moosa', role: 'Locum GP', doctor: true },
  { value: 'nd', label: 'Sr Nokuthula Dube', short: 'Sr Dube', role: 'Practice nurse', doctor: false },
];
export const DOCTORS = CLINICIANS.filter((c) => c.doctor);

export const SCHEMES = [
  { value: 'aurora', label: 'Aurora Health Medical Scheme (fictional)' },
  { value: 'karoo', label: 'Karoo Mutual Health (fictional)' },
  { value: 'fynbos', label: 'Fynbos Medical Fund (fictional)' },
  { value: 'private', label: 'Private / cash patient' },
];

/** Visit types. `doctor: false` visits can be completed by the nurse without a consultation. */
export const VISIT_TYPES = [
  { value: 'acute', label: 'Acute consultation', minutes: 15, doctor: true, tariff: 'DEMO-GP1' },
  { value: 'followup', label: 'Follow-up consultation', minutes: 15, doctor: true, tariff: 'DEMO-GP3' },
  { value: 'chronic', label: 'Chronic care review', minutes: 30, doctor: true, tariff: 'DEMO-GP2' },
  { value: 'wellness', label: 'Wellness check / medical', minutes: 30, doctor: true, tariff: 'DEMO-GP2' },
  { value: 'procedure', label: 'Minor procedure', minutes: 30, doctor: true, tariff: 'DEMO-PR1' },
  { value: 'immunisation', label: 'Immunisation (nurse)', minutes: 10, doctor: false, tariff: 'DEMO-NS1' },
  { value: 'dressing', label: 'Wound dressing (nurse)', minutes: 15, doctor: false, tariff: 'DEMO-NS2' },
  { value: 'bpcheck', label: 'BP / glucose check (nurse)', minutes: 10, doctor: false, tariff: 'DEMO-NS3' },
];

/** Public ICD-10 codes, shown as samples only. */
export const ICD10 = [
  { value: 'J06.9', label: 'J06.9 · Acute upper respiratory infection, unspecified' },
  { value: 'J02.9', label: 'J02.9 · Acute pharyngitis, unspecified' },
  { value: 'J20.9', label: 'J20.9 · Acute bronchitis, unspecified' },
  { value: 'I10', label: 'I10 · Essential (primary) hypertension' },
  { value: 'E11.9', label: 'E11.9 · Type 2 diabetes mellitus without complications' },
  { value: 'E78.5', label: 'E78.5 · Hyperlipidaemia, unspecified' },
  { value: 'E03.9', label: 'E03.9 · Hypothyroidism, unspecified' },
  { value: 'J45.9', label: 'J45.9 · Asthma, unspecified' },
  { value: 'M54.5', label: 'M54.5 · Low back pain' },
  { value: 'N39.0', label: 'N39.0 · Urinary tract infection, site not specified' },
  { value: 'L03.9', label: 'L03.9 · Cellulitis, unspecified' },
  { value: 'R51', label: 'R51 · Headache' },
  { value: 'Z00.0', label: 'Z00.0 · General medical examination' },
  { value: 'Z25.1', label: 'Z25.1 · Need for immunisation against influenza' },
  { value: 'Z48.0', label: 'Z48.0 · Attention to dressings and sutures' },
];

export const CHRONIC_CONDITIONS = [
  { value: 'htn', label: 'Hypertension', icd10: 'I10', reviewMonths: 6 },
  { value: 't2dm', label: 'Type 2 diabetes', icd10: 'E11.9', reviewMonths: 3 },
  { value: 'asthma', label: 'Asthma', icd10: 'J45.9', reviewMonths: 6 },
  { value: 'hypothyroid', label: 'Hypothyroidism', icd10: 'E03.9', reviewMonths: 12 },
  { value: 'lipids', label: 'Dyslipidaemia', icd10: 'E78.5', reviewMonths: 12 },
];

export const CONTROL = [
  { value: 'good', label: 'Well controlled' },
  { value: 'partial', label: 'Partially controlled' },
  { value: 'poor', label: 'Poorly controlled' },
  { value: 'unknown', label: 'Not yet assessed' },
];

/**
 * Generic medicines with the allergy groups their name or class matches.
 * `match` terms are compared against the patient's recorded allergy text.
 */
export const MEDICINES = [
  { value: 'amoxicillin', label: 'Amoxicillin', group: 'penicillin', strength: '500 mg capsule', match: ['penicillin', 'amoxicillin', 'amoxil'] },
  { value: 'coamoxiclav', label: 'Amoxicillin / clavulanic acid', group: 'penicillin', strength: '875/125 mg tablet', match: ['penicillin', 'amoxicillin', 'clavulan'] },
  { value: 'flucloxacillin', label: 'Flucloxacillin', group: 'penicillin', strength: '500 mg capsule', match: ['penicillin', 'flucloxacillin'] },
  { value: 'cephalexin', label: 'Cephalexin', group: 'cephalosporin', strength: '500 mg capsule', match: ['cephalosporin', 'cephalexin', 'cefalexin'] },
  { value: 'azithromycin', label: 'Azithromycin', group: 'macrolide', strength: '500 mg tablet', match: ['macrolide', 'azithromycin'] },
  { value: 'doxycycline', label: 'Doxycycline', group: 'tetracycline', strength: '100 mg capsule', match: ['tetracycline', 'doxycycline'] },
  { value: 'cotrimoxazole', label: 'Sulfamethoxazole / trimethoprim', group: 'sulphonamide', strength: '800/160 mg tablet', match: ['sulphonamide', 'sulfonamide', 'sulfa', 'sulpha', 'co-trimoxazole', 'cotrimoxazole'] },
  { value: 'nitrofurantoin', label: 'Nitrofurantoin', group: 'nitrofuran', strength: '100 mg capsule', match: ['nitrofurantoin'] },
  { value: 'ibuprofen', label: 'Ibuprofen', group: 'NSAID', strength: '400 mg tablet', match: ['nsaid', 'ibuprofen', 'anti-inflammator'] },
  { value: 'diclofenac', label: 'Diclofenac', group: 'NSAID', strength: '50 mg tablet', match: ['nsaid', 'diclofenac', 'anti-inflammator'] },
  { value: 'paracetamol', label: 'Paracetamol', group: 'analgesic', strength: '500 mg tablet', match: ['paracetamol', 'acetaminophen'] },
  { value: 'tramadol', label: 'Tramadol', group: 'opioid', strength: '50 mg capsule', match: ['opioid', 'opiate', 'tramadol'] },
  { value: 'amlodipine', label: 'Amlodipine', group: 'calcium channel blocker', strength: '5 mg tablet', match: ['calcium channel blocker', 'amlodipine'] },
  { value: 'enalapril', label: 'Enalapril', group: 'ACE inhibitor', strength: '10 mg tablet', match: ['ace inhibitor', 'ace-inhibitor', 'enalapril'] },
  { value: 'hctz', label: 'Hydrochlorothiazide', group: 'thiazide diuretic', strength: '12.5 mg tablet', match: ['thiazide', 'hydrochlorothiazide'] },
  { value: 'metformin', label: 'Metformin', group: 'biguanide', strength: '500 mg tablet', match: ['metformin', 'biguanide'] },
  { value: 'atorvastatin', label: 'Atorvastatin', group: 'statin', strength: '20 mg tablet', match: ['statin', 'atorvastatin'] },
  { value: 'levothyroxine', label: 'Levothyroxine', group: 'thyroid hormone', strength: '50 mcg tablet', match: ['levothyroxine', 'thyroxine'] },
  { value: 'salbutamol', label: 'Salbutamol inhaler', group: 'bronchodilator', strength: '100 mcg/dose', match: ['salbutamol'] },
  { value: 'budesonide', label: 'Budesonide / formoterol inhaler', group: 'inhaled corticosteroid', strength: '160/4.5 mcg/dose', match: ['budesonide', 'formoterol'] },
  { value: 'prednisone', label: 'Prednisone', group: 'corticosteroid', strength: '5 mg tablet', match: ['prednisone', 'corticosteroid'] },
  { value: 'loratadine', label: 'Loratadine', group: 'antihistamine', strength: '10 mg tablet', match: ['loratadine', 'antihistamine'] },
];

export const FREQUENCIES = [
  { value: 'od', label: 'Once daily' },
  { value: 'bd', label: 'Twice daily' },
  { value: 'tds', label: 'Three times daily' },
  { value: 'qid', label: 'Four times daily' },
  { value: 'nocte', label: 'At night' },
  { value: 'prn', label: 'When needed' },
];

export const LABS = [
  { value: 'highveld', label: 'Highveld Pathology (fictional)' },
  { value: 'bluegum', label: 'Bluegum Diagnostics (fictional)' },
  { value: 'pointofcare', label: 'In-practice point-of-care test' },
];

export const TESTS = [
  { value: 'fbc', label: 'Full blood count' },
  { value: 'ue', label: 'Urea & electrolytes (kidney function)' },
  { value: 'hba1c', label: 'HbA1c' },
  { value: 'lipids', label: 'Lipid profile' },
  { value: 'tsh', label: 'TSH (thyroid)' },
  { value: 'lft', label: 'Liver function tests' },
  { value: 'crp', label: 'CRP' },
  { value: 'urine', label: 'Urine microscopy & culture' },
  { value: 'psa', label: 'PSA' },
];

/** Invented tariff codes — NOT real scheme, coding-body or professional tariffs. */
export const TARIFFS = [
  { code: 'DEMO-GP1', description: 'GP consultation (demo tariff)', price: 520 },
  { code: 'DEMO-GP2', description: 'Extended GP consultation (demo tariff)', price: 780 },
  { code: 'DEMO-GP3', description: 'Follow-up GP consultation (demo tariff)', price: 390 },
  { code: 'DEMO-PR1', description: 'Minor procedure (demo tariff)', price: 650 },
  { code: 'DEMO-NS1', description: 'Nurse immunisation administration (demo tariff)', price: 180 },
  { code: 'DEMO-NS2', description: 'Nurse wound dressing (demo tariff)', price: 240 },
  { code: 'DEMO-NS3', description: 'Nurse BP / glucose check (demo tariff)', price: 150 },
  { code: 'DEMO-LB1', description: 'Point-of-care glucose test (demo tariff)', price: 95 },
  { code: 'DEMO-EC1', description: 'Resting ECG (demo tariff)', price: 420 },
];

export const tariff = (code: string) => TARIFFS.find((t) => t.code === code) ?? TARIFFS[0];

export const label = (list: Option[], v: unknown) => list.find((x) => x.value === v)?.label ?? String(v ?? '—');

export const opt = (list: Option[]): Option[] => list.map(({ value, label: l }) => ({ value, label: l }));
