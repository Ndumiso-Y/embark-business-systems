// Fictional seed data for Acacia Family Practice. Every person, number, scheme,
// lab and tariff code is invented; ICD-10 codes are public samples. Dates are
// relative to `today` so the demo always looks current. Deterministic: the
// same `today` always yields the same records.
import { seeder, user } from '../../core/seed';
import type { DemoRecord, Line, Values } from '../../core/types';
import { prng } from '../optometry/seed';
import { CHRONIC_CONDITIONS, MEDICINES, VISIT_TYPES, tariff } from './data';
import { allergyConflict } from './helpers';

type Person = [first: string, last: string, age: number, sex: 'F' | 'M', scheme: string, conditions: string[], allergies: string];

export const PEOPLE: Person[] = [
  ['Busisiwe', 'Ntuli', 58, 'F', 'aurora', ['htn', 't2dm'], 'Penicillin (rash)'],
  ['Gerhard', 'Labuschagne', 66, 'M', 'karoo', ['htn'], 'No known allergies'],
  ['Refilwe', 'Mokwena', 31, 'F', 'aurora', ['asthma'], 'Sulphonamides (rash)'],
  ['Yusuf', 'Davids', 49, 'M', 'fynbos', ['t2dm'], 'No known allergies'],
  ['Kamogelo', 'Seabi', 8, 'M', 'karoo', ['asthma'], 'No known allergies'],
  ['Charmaine', 'Jacobs', 44, 'F', 'private', ['hypothyroid'], 'Aspirin and NSAIDs (wheeze)'],
  ['Themba', 'Mkhize', 62, 'M', 'fynbos', ['htn', 't2dm'], 'No known allergies'],
  ['Nadia', 'Pillay', 27, 'F', 'aurora', [], 'Penicillin (anaphylaxis)'],
  ['Hendrik', 'du Toit', 71, 'M', 'karoo', ['htn', 'lipids'], 'Codeine (nausea)'],
  ['Ntombi', 'Zwane', 36, 'F', 'private', [], 'No known allergies'],
  ['Sibusiso', 'Majola', 22, 'M', 'aurora', [], 'No known allergies'],
  ['Leonie', 'Kruger', 53, 'F', 'fynbos', ['hypothyroid'], 'No known allergies'],
  ['Kabelo', 'Phiri', 40, 'M', 'karoo', ['asthma'], 'No known allergies'],
  ['Amina', 'Hassan', 34, 'F', 'aurora', [], 'Penicillin (hives)'],
  ['Jacobus', 'Nel', 58, 'M', 'private', ['t2dm'], 'No known allergies'],
  ['Zodwa', 'Shabalala', 67, 'F', 'fynbos', ['htn'], 'ACE inhibitors (cough)'],
  ['Tshepo', 'Motaung', 16, 'M', 'aurora', [], 'No known allergies'],
  ['Elize', 'Roux', 45, 'F', 'karoo', [], 'No known allergies'],
  ['Vusi', 'Hlongwane', 55, 'M', 'fynbos', ['htn', 't2dm'], 'No known allergies'],
  ['Candice', 'September', 29, 'F', 'private', ['asthma'], 'No known allergies'],
  ['Lwazi', 'Gumede', 3, 'M', 'aurora', [], 'No known allergies'],
  ['Marietjie', 'Swart', 74, 'F', 'karoo', ['htn', 'hypothyroid'], 'Sulfa drugs (rash)'],
  ['Imran', 'Essop', 38, 'M', 'fynbos', ['lipids'], 'No known allergies'],
  ['Dineo', 'Letsoalo', 50, 'F', 'aurora', ['t2dm'], 'Penicillin'],
];

const CHRONIC_MED: Record<string, [string, string, string, string]> = {
  // condition: medicine, dose, frequency, current-meds text
  htn: ['amlodipine', '1 tablet', 'od', 'Amlodipine 5 mg daily'],
  t2dm: ['metformin', '1 tablet', 'bd', 'Metformin 500 mg twice daily'],
  asthma: ['budesonide', '2 puffs', 'bd', 'Budesonide/formoterol inhaler twice daily; salbutamol when needed'],
  hypothyroid: ['levothyroxine', '1 tablet', 'od', 'Levothyroxine 50 mcg daily'],
  lipids: ['atorvastatin', '1 tablet', 'nocte', 'Atorvastatin 20 mg at night'],
};

/** SOAP templates per ICD-10 sample. [subjective, objective, assessment, plan, medicine, test]. */
const SOAP: Record<string, [string, string, string, string, string, string]> = {
  'J06.9': ['Runny nose, sore throat and dry cough for three days. No shortness of breath.', 'Throat mildly injected. Chest clear. Ears normal.', 'Viral upper respiratory infection (demo note).', 'Fluids, rest, symptomatic relief. Return if not improving in five days.', 'paracetamol', ''],
  'J02.9': ['Sore throat and painful swallowing for two days. Feverish at night.', 'Tonsils enlarged with exudate. Tender anterior neck nodes.', 'Acute pharyngitis (demo note).', 'Course as scripted, salt-water gargles. Review in 48 hours if no better.', 'amoxicillin', ''],
  'J20.9': ['Productive cough for a week after a cold. No chest pain.', 'Scattered wheeze, no crackles. Afebrile.', 'Acute bronchitis (demo note).', 'Symptomatic care. Return if breathless or fever develops.', 'paracetamol', ''],
  'M54.5': ['Lower back pain after lifting at home, four days. No leg symptoms.', 'Paraspinal tenderness, full power, straight-leg raise normal.', 'Mechanical low back pain (demo note).', 'Analgesia, keep active, heat. Review in two weeks if persisting.', 'ibuprofen', ''],
  'N39.0': ['Burning on urination and frequency for two days. No loin pain.', 'Afebrile. Suprapubic tenderness. Urine dipstick positive (demo).', 'Uncomplicated urinary tract infection (demo note).', 'Course as scripted, fluids. Urine sent for culture.', 'nitrofurantoin', 'urine'],
  'L03.9': ['Red, warm swelling on the lower leg after a scratch, three days.', 'Area of erythema 6 cm, no fluctuance. Margin marked.', 'Cellulitis (demo note).', 'Course as scripted. Review in 48 hours, earlier if spreading.', 'flucloxacillin', 'crp'],
  'R51': ['Tension-type headaches in the afternoons for two weeks, long screen hours.', 'Neurological screen normal. Neck muscles tight.', 'Tension-type headache (demo note).', 'Screen breaks, hydration, simple analgesia. Review if pattern changes.', 'paracetamol', ''],
  'Z00.0': ['Routine wellness check for employer. No complaints.', 'General examination unremarkable.', 'Well adult check (demo note).', 'Fasting bloods requested. Lifestyle advice given.', '', 'lipids'],
  'I10': ['Chronic review. Taking medication daily. No headaches or chest pain.', 'BP as triaged. Heart sounds normal. No oedema.', 'Hypertension — chronic review (demo note).', 'Continue medication, salt reduction, repeat script. Kidney function requested.', 'amlodipine', 'ue'],
  'E11.9': ['Chronic review. Diet mostly adhered to. No hypoglycaemia reported.', 'Feet checked, sensation intact. Weight as triaged.', 'Type 2 diabetes — chronic review (demo note).', 'Continue medication, HbA1c requested, dietitian advice repeated.', 'metformin', 'hba1c'],
  'J45.9': ['Asthma review. Night symptoms once a week, uses reliever twice a week.', 'Chest clear today. Inhaler technique checked.', 'Asthma — partially controlled (demo note).', 'Continue preventer, written action plan reviewed.', 'budesonide', ''],
  'E03.9': ['Thyroid review. Energy improved on current dose.', 'No goitre. Pulse regular.', 'Hypothyroidism — chronic review (demo note).', 'Continue dose, TSH requested.', 'levothyroxine', 'tsh'],
  'E78.5': ['Cholesterol review. Taking statin at night, no muscle aches.', 'Weight and BP as triaged.', 'Dyslipidaemia — chronic review (demo note).', 'Continue statin, lipid profile requested.', 'atorvastatin', 'lipids'],
};

const RESULT_TEXT: Record<string, [string, string]> = {
  fbc: ['Haemoglobin and white cell count within the lab reference range (demo values).', 'Haemoglobin 9.8 g/dL — below the lab reference range (demo value).'],
  ue: ['Creatinine and potassium within the lab reference range (demo values).', 'eGFR 52 — reduced compared with previous (demo value).'],
  hba1c: ['HbA1c 6.6 % (demo value).', 'HbA1c 9.1 % — above the practice’s demo target.'],
  lipids: ['Total cholesterol 4.6 mmol/L, LDL 2.4 mmol/L (demo values).', 'LDL 4.9 mmol/L — above the lab reference range (demo value).'],
  tsh: ['TSH 2.1 mIU/L — within the lab reference range (demo value).', 'TSH 8.4 mIU/L — above the lab reference range (demo value).'],
  lft: ['Liver enzymes within the lab reference range (demo values).', 'ALT 96 U/L — raised (demo value).'],
  crp: ['CRP 4 mg/L (demo value).', 'CRP 68 mg/L — raised (demo value).'],
  urine: ['No significant growth (demo result).', 'E. coli > 100 000 CFU/mL, sensitivities attached (demo result).'],
  psa: ['PSA 1.2 ng/mL (demo value).', 'PSA 6.8 ng/mL — above the lab reference range (demo value).'],
};

const NAMES: Record<string, [string, string]> = {
  tm: ['Dr Thandeka Mabaso', 'GP partner'], rc: ['Dr Ruan Coetzee', 'GP / locum doctor'], am: ['Dr Aisha Moosa', 'GP / locum doctor'], nd: ['Sr Nokuthula Dube', 'Practice nurse'],
  rec: ['Michelle Arendse', 'Reception'], bill: ['Sizwe Ngubane', 'Billing administrator'],
};
const by = (k: string) => ({ by: NAMES[k][0], role: NAMES[k][1] });

export function buildMedicalSeed(today: string) {
  const rnd = prng(20261112);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const { collections, rec, day, line } = seeder(today);
  const year = Number(today.slice(0, 4));

  const users = [
    user('u_partner', 'Dr Thandeka Mabaso', 'Senior partner', 'partner', [], [], true),
    user('u_gp', 'Dr Ruan Coetzee', 'General practitioner', 'gp', ['dashboard', 'waiting', 'patients', 'consults', 'scripts', 'results', 'chronic'], ['clinical.view', 'clinical.record', 'triage', 'results.review', 'prescribe', 'chronic']),
    user('u_locum', 'Dr Aisha Moosa', 'Locum GP', 'gp', ['dashboard', 'waiting', 'patients', 'consults', 'scripts', 'results', 'chronic'], ['clinical.view', 'clinical.record', 'results.review', 'prescribe']),
    user('u_nurse', 'Sr Nokuthula Dube', 'Practice nurse', 'nurse', ['dashboard', 'waiting', 'patients', 'scripts', 'results', 'chronic'], ['clinical.view', 'triage', 'bookings', 'chronic']),
    user('u_rec', 'Michelle Arendse', 'Receptionist', 'reception', ['dashboard', 'waiting', 'patients', 'results'], ['bookings', 'patients.edit']),
    user('u_bill', 'Sizwe Ngubane', 'Billing administrator', 'billing', ['dashboard', 'patients', 'claims', 'reports', 'admin'], ['billing', 'patients.edit']),
  ];

  /* ---------- Patients ---------- */
  const patients = PEOPLE.map(([first, last, age, sex, scheme, conditions, allergies], i) => {
    const dob = `${year - age}-${String(1 + (i * 5) % 12).padStart(2, '0')}-${String(2 + (i * 7) % 26).padStart(2, '0')}`;
    const v: Values = {
      firstName: first, lastName: last, dob, sex,
      phone: `0${[71, 82, 63, 76, 84][i % 5]} 555 ${String(2000 + i * 41).slice(-4)}`,
      email: `${first.toLowerCase()}.${last.toLowerCase().replace(/\s+/g, '')}@example.com`,
      scheme, memberNo: scheme === 'private' ? '' : `${scheme.slice(0, 2).toUpperCase()}${String(4410020 + i * 317)}`, dependant: scheme === 'private' ? '' : i % 3 === 0 ? '01' : '00',
      usualDoctor: ['tm', 'rc', 'tm', 'rc', 'am'][i % 5],
      allergies,
      chronicConditions: conditions.map((c) => CHRONIC_CONDITIONS.find((x) => x.value === c)!.label).join(', ') || 'None recorded',
      currentMeds: conditions.map((c) => CHRONIC_MED[c][3]).join('; ') || 'None',
      lastVisit: '',
    };
    return rec('patients', 'PT', v, { createdDaysAgo: 900 - i * 23 });
  });
  const ageOf = (p: DemoRecord) => PEOPLE[patients.indexOf(p)][2];
  const condsOf = (p: DemoRecord) => PEOPLE[patients.indexOf(p)][5];

  /* ---------- Chronic register ---------- */
  const reviewOffsets = [-48, -15, 9, 52, -4, 22, 95, 140, 66, -27, 31, 180];
  let ci = 0;
  const chronicByKey = new Map<string, DemoRecord>();
  patients.forEach((p, i) => {
    for (const c of condsOf(p)) {
      const cond = CHRONIC_CONDITIONS.find((x) => x.value === c)!;
      const next = reviewOffsets[ci % reviewOffsets.length];
      const last = next - Math.round(cond.reviewMonths * 30.4);
      const control = next < 0 ? pick(['partial', 'poor', 'unknown']) : pick(['good', 'good', 'partial']);
      const r = rec('chronic', 'CC', {
        patient: p.id, condition: c, diagnosedOn: day(-400 - ((i * 97) % 2400)), doctor: str(p.values.usualDoctor),
        lastReview: day(last), nextReview: day(next), control,
        targets: c === 'htn' ? 'BP below the practice’s demo target' : c === 't2dm' ? 'HbA1c within the practice’s demo target' : c === 'asthma' ? 'Reliever use under twice a week' : 'Stable on current dose',
        carePlan: `${cond.label}: ${CHRONIC_MED[c][3]}. Review every ${cond.reviewMonths} months. Lifestyle advice given (demo care plan).`,
      }, { status: ci % 17 === 9 ? 'lapsed' : 'active', createdDaysAgo: 400 });
      chronicByKey.set(`${p.id}:${c}`, r);
      ci += 1;
    }
  });

  /* ---------- Helpers ---------- */
  const vitals = (p: DemoRecord, override: Values = {}): Values => {
    const age = ageOf(p);
    const htn = condsOf(p).includes('htn');
    const child = age < 12;
    return {
      bpSys: child ? null : Math.round(112 + rnd() * 22 + (htn ? 10 : 0)),
      bpDia: child ? null : Math.round(70 + rnd() * 12 + (htn ? 4 : 0)),
      pulse: Math.round((child ? 90 : 64) + rnd() * 22),
      temp: round1(36.3 + rnd() * 0.6),
      spo2: 96 + Math.floor(rnd() * 4),
      weight: child ? Math.round(10 + age * 2.6) : Math.round(56 + rnd() * 38),
      glucose: condsOf(p).includes('t2dm') ? round1(5.6 + rnd() * 4) : null,
      ...override,
    };
  };
  const safeMed = (p: DemoRecord, med: string) => {
    const allergies = PEOPLE[patients.indexOf(p)][6];
    if (!allergyConflict(allergies, med)) return med;
    const alt = ['azithromycin', 'doxycycline', 'paracetamol'].find((m) => !allergyConflict(allergies, m));
    return alt ?? 'paracetamol';
  };
  const scriptValues = (p: DemoRecord, consult: DemoRecord | undefined, date: string, prescriber: string, med: string, chronic: boolean): Values => {
    const m = MEDICINES.find((x) => x.value === med)!;
    const cm = Object.values(CHRONIC_MED).find((x) => x[0] === med);
    return {
      patient: p.id, consult: consult?.id ?? '', date, prescriber, medicine: med, strength: m.strength,
      dose: cm ? cm[1] : med === 'salbutamol' || med === 'budesonide' ? '2 puffs' : '1 tablet',
      frequency: cm ? cm[2] : ['paracetamol', 'ibuprofen', 'salbutamol', 'loratadine'].includes(med) ? (med === 'loratadine' ? 'od' : 'prn') : ['amoxicillin', 'flucloxacillin', 'cephalexin'].includes(med) ? 'tds' : 'bd',
      durationDays: chronic ? 30 : med === 'azithromycin' ? 3 : 5, repeats: chronic ? 5 : 0, instructions: chronic ? 'Chronic medication — repeat monthly.' : 'Complete the course as directed.',
    };
  };
  const claimFor = (p: DemoRecord, consult: DemoRecord | undefined, visit: DemoRecord, date: string, clin: string, icd: string, daysAgo: number, lines: Line[]) => {
    const scheme = String(p.values.scheme);
    const total = Math.round(lines.reduce((n, l) => n + l.qty * l.unitPrice, 0) * 1.15 * 100) / 100;
    if (scheme === 'private') {
      const settled = daysAgo > 0;
      return rec('claims', 'CLM', { patient: p.id, consult: consult?.id ?? '', visit: visit.id, date, doctor: clin, scheme, memberNo: '', icd10: icd, schemePaid: 0, patientPaid: settled ? total : 0, submittedOn: '', notes: settled ? 'Private patient — paid at reception (card).' : '', lines },
        { status: settled ? 'settled' : 'draft', createdDaysAgo: daysAgo, history: [{ daysAgo, ...by('bill'), action: 'Account created' }, ...(settled ? [{ daysAgo, ...by('bill'), action: 'Bill patient privately' }, { daysAgo, ...by('bill'), action: 'Patient balance settled' }] : [])] });
    }
    const cs = daysAgo > 40 ? 'paid' : daysAgo > 12 ? pick(['paid', 'paid', 'submitted', 'partpaid']) : daysAgo > 0 ? pick(['submitted', 'submitted', 'draft']) : 'draft';
    return rec('claims', 'CLM', {
      patient: p.id, consult: consult?.id ?? '', visit: visit.id, date, doctor: clin, scheme, memberNo: p.values.memberNo, icd10: icd,
      schemePaid: cs === 'paid' ? total : cs === 'partpaid' ? Math.round(total * 0.75) : 0, patientPaid: 0,
      submittedOn: cs === 'draft' ? '' : day(-daysAgo + 1), notes: cs === 'partpaid' ? 'Scheme paid at scheme rate (fictional); balance due from patient.' : '', lines,
    }, { status: cs, createdDaysAgo: daysAgo, history: [{ daysAgo, ...by('bill'), action: 'Claim created from consultation' }, ...(cs !== 'draft' ? [{ daysAgo: Math.max(0, daysAgo - 1), ...by('bill'), action: 'Submit to scheme (simulated)' }] : [])] });
  };

  /* ---------- Six months of history ---------- */
  const doctors = ['tm', 'tm', 'rc', 'rc', 'am'];
  const acuteDx = ['J06.9', 'J06.9', 'J02.9', 'J20.9', 'M54.5', 'N39.0', 'L03.9', 'R51'];
  for (let d = 178; d >= 1; d -= 1 + Math.floor(rnd() * 3)) {
    const p = pick(patients);
    const conds = condsOf(p);
    const roll = rnd();
    const type = conds.length && roll < 0.42 ? 'chronic' : roll < 0.52 ? pick(['immunisation', 'dressing', 'bpcheck']) : roll < 0.58 ? 'wellness' : roll < 0.66 ? 'followup' : 'acute';
    const vt = VISIT_TYPES.find((t) => t.value === type)!;
    const clin = vt.doctor ? pick(doctors) : 'nd';
    const date = day(-d);
    const time = pick(['08:00', '08:30', '09:15', '10:00', '10:45', '11:30', '13:30', '14:15', '15:00', '15:45']);
    const outcome = rnd();
    const status = outcome < 0.065 ? 'dna' : outcome < 0.095 ? 'cancelled' : 'done';
    const reason = type === 'chronic' ? 'Chronic medication and review' : type === 'immunisation' ? 'Seasonal flu vaccine' : type === 'dressing' ? 'Dressing change' : type === 'bpcheck' ? 'BP check' : type === 'wellness' ? 'Employer wellness medical' : 'Feeling unwell';
    const visit = rec('visits', 'VS', {
      patient: p.id, date, time, clinician: clin, type, reason,
      ...(status === 'done' ? { arrivedAt: time, ...vitals(p), triagedAt: time } : {}),
    }, { status, createdDaysAgo: d + 7, history: status === 'cancelled'
      ? [{ daysAgo: d + 7, ...by('rec'), action: 'Visit booked' }, { daysAgo: d + 1, ...by('rec'), action: 'Cancel', note: 'Patient phoned to cancel — will rebook.' }]
      : status === 'dna' ? [{ daysAgo: d + 7, ...by('rec'), action: 'Visit booked' }, { daysAgo: d, ...by('rec'), action: 'Mark did not attend' }]
        : [{ daysAgo: d + 7, ...by('rec'), action: 'Visit booked' }, { daysAgo: d, ...by('rec'), action: 'Check in' }, { daysAgo: d, ...by('nd'), action: 'Record triage' }, { daysAgo: d, ...by('rec'), action: 'Check out' }] });
    if (status !== 'done') continue;
    p.values.lastVisit = date;

    if (!vt.doctor) {
      const icd = type === 'immunisation' ? 'Z25.1' : type === 'dressing' ? 'Z48.0' : 'I10';
      const t = tariff(vt.tariff);
      claimFor(p, undefined, visit, date, clin, icd, d, [line(t.description, 1, t.price, t.code)]);
      continue;
    }
    const cond = type === 'chronic' ? CHRONIC_CONDITIONS.find((c) => c.value === pick(conds))! : undefined;
    const icd = cond ? cond.icd10 : type === 'wellness' ? 'Z00.0' : pick(acuteDx);
    const [s, o, a, pl, med, test] = SOAP[icd];
    const consult = rec('consults', 'CN', {
      patient: p.id, visit: visit.id, date, doctor: clin, subjective: s, objective: o, assessment: a, plan: pl, icd10: icd,
      sickNoteDays: type === 'acute' && rnd() < 0.35 ? 1 + Math.floor(rnd() * 3) : 0, followUp: type === 'acute' && rnd() < 0.3 ? day(-d + 7) : '',
    }, { status: 'signed', createdDaysAgo: d, history: [{ daysAgo: d, ...by(clin), action: 'Consultation started' }, { daysAgo: d, ...by(clin), action: 'Sign consultation' }] });
    const t = tariff(vt.tariff);
    const claimLines = [line(t.description, 1, t.price, t.code)];
    if (cond?.value === 't2dm') { const g = tariff('DEMO-LB1'); claimLines.push(line(g.description, 1, g.price, g.code)); }
    claimFor(p, consult, visit, date, clin, icd, d, claimLines);
    if (med && rnd() < (cond ? 0.85 : 0.7)) {
      const m = safeMed(p, med);
      rec('scripts', 'RX', scriptValues(p, consult, date, clin, m, !!cond), { status: d > 2 ? 'dispensed' : 'issued', createdDaysAgo: d, history: [{ daysAgo: d, ...by(clin), action: 'Script drafted' }, { daysAgo: d, ...by(clin), action: 'Sign & issue' }, ...(d > 2 ? [{ daysAgo: d - 1, ...by('rec'), action: 'Mark dispensed', note: 'Collected at pharmacy (patient report).' }] : [])] });
    }
    if (test && d > 14 && rnd() < (cond ? 0.8 : 0.5)) {
      const abnormal = rnd() < 0.25;
      const lab = test === 'urine' ? 'bluegum' : pick(['highveld', 'highveld', 'bluegum']);
      const recv = Math.max(1, d - 1 - Math.floor(rnd() * 3));
      const rev = Math.max(1, recv - Math.floor(rnd() * 2));
      rec('results', 'LR', {
        patient: p.id, consult: consult.id, test, lab, requestedOn: date, requestedBy: clin, receivedOn: day(-recv), reviewedOn: day(-rev), informedOn: day(-Math.max(0, rev - 1)),
        abnormal, summary: RESULT_TEXT[test][abnormal ? 1 : 0], action: abnormal ? 'Discussed with patient; plan adjusted (demo note).' : 'Normal — no action needed.',
      }, { status: 'informed', createdDaysAgo: d, history: [{ daysAgo: d, ...by(clin), action: 'Test requested' }, { daysAgo: recv, by: 'Lab feed (simulated)', role: 'System', action: 'Record result received' }, { daysAgo: rev, ...by(clin), action: 'Mark reviewed' }, { daysAgo: Math.max(0, rev - 1), ...by('rec'), action: 'Patient informed', note: abnormal ? 'Phoned patient, follow-up booked.' : 'SMS preview logged — not sent.' }] });
    }
  }

  /* ---------- Results inbox: work still open ---------- */
  const result = (pi: number, test: string, lab: string, reqAgo: number, status: string, abnormal: boolean, clin: string, recvAgo?: number) => {
    const p = patients[pi];
    return rec('results', 'LR', {
      patient: p.id, consult: '', test, lab, requestedOn: day(-reqAgo), requestedBy: clin,
      receivedOn: recvAgo !== undefined ? day(-recvAgo) : '', reviewedOn: status === 'reviewed' ? day(-Math.max(0, (recvAgo ?? 1) - 1)) : '', informedOn: '',
      abnormal, summary: status === 'requested' ? '' : RESULT_TEXT[test][abnormal ? 1 : 0], action: '',
    }, { status, createdDaysAgo: reqAgo, history: [
      { daysAgo: reqAgo, ...by(clin), action: 'Test requested' },
      ...(recvAgo !== undefined ? [{ daysAgo: recvAgo, by: 'Lab feed (simulated)', role: 'System', action: 'Record result received' }] : []),
      ...(status === 'reviewed' ? [{ daysAgo: Math.max(0, (recvAgo ?? 1) - 1), ...by(clin), action: 'Mark reviewed' }] : []),
    ] });
  };
  result(6, 'hba1c', 'highveld', 5, 'received', true, 'tm', 1);
  result(7, 'urine', 'bluegum', 4, 'received', true, 'am', 0);
  result(11, 'tsh', 'highveld', 6, 'received', false, 'rc', 1);
  result(22, 'lipids', 'bluegum', 9, 'reviewed', true, 'am', 3);
  result(21, 'ue', 'highveld', 12, 'requested', false, 'tm');
  result(16, 'fbc', 'bluegum', 10, 'requested', false, 'rc');
  result(3, 'hba1c', 'highveld', 3, 'requested', false, 'rc');
  result(9, 'crp', 'highveld', 2, 'requested', false, 'am');

  /* ---------- One rejected claim and one cancelled script ---------- */
  const rj = patients[12];
  rec('claims', 'CLM', { patient: rj.id, consult: '', visit: '', date: day(-21), doctor: 'rc', scheme: 'karoo', memberNo: rj.values.memberNo, icd10: 'J45.9', schemePaid: 0, patientPaid: 0, submittedOn: day(-20), notes: '', lines: [line(tariff('DEMO-GP2').description, 1, tariff('DEMO-GP2').price, 'DEMO-GP2')] },
    { status: 'rejected', createdDaysAgo: 21, history: [{ daysAgo: 21, ...by('bill'), action: 'Claim created from consultation' }, { daysAgo: 20, ...by('bill'), action: 'Submit to scheme (simulated)' }, { daysAgo: 8, ...by('bill'), action: 'Record rejection', note: 'Scheme response (fictional): chronic benefit not registered for this condition — register or bill patient.' }] });
  rec('scripts', 'RX', scriptValues(patients[19], undefined, day(-16), 'am', 'prednisone', false), { status: 'cancelled', createdDaysAgo: 16, history: [{ daysAgo: 16, ...by('am'), action: 'Script drafted' }, { daysAgo: 16, ...by('am'), action: 'Sign & issue' }, { daysAgo: 15, ...by('am'), action: 'Cancel script', note: 'Patient already has a supply from a previous visit.' }] });

  /* ---------- Today's waiting room ---------- */
  type TodayRow = [pi: number, time: string, clin: string, type: string, status: string, reason: string, arrived?: string];
  const todayPlan: TodayRow[] = [
    [6, '07:45', 'tm', 'chronic', 'done', 'Diabetes and BP review', '07:40'],
    [2, '08:00', 'rc', 'acute', 'done', 'Wheezy since the weekend', '07:55'],
    [10, '08:15', 'nd', 'immunisation', 'done', 'Seasonal flu vaccine', '08:12'],
    [17, '08:30', 'am', 'acute', 'billing', 'Burning urine for two days', '08:26'],
    [11, '08:45', 'rc', 'followup', 'dna', 'Thyroid results follow-up'],
    [0, '09:00', 'tm', 'chronic', 'withdoctor', 'Chronic review and repeat script', '08:52'],
    [13, '09:15', 'am', 'acute', 'withdoctor', 'Sore throat, painful swallowing', '09:05'],
    [7, '09:30', 'rc', 'acute', 'triaged', 'Fever and body aches since yesterday', '09:20'],
    [15, '09:45', 'nd', 'bpcheck', 'triaged', 'Monthly BP check', '09:31'],
    [18, '10:00', 'rc', 'chronic', 'arrived', 'Chronic review', '09:41'],
    [3, '10:15', 'am', 'followup', 'arrived', 'Follow-up on sugar readings', '09:58'],
    [8, '10:45', 'tm', 'chronic', 'booked', 'BP and cholesterol review'],
    [20, '11:15', 'rc', 'acute', 'booked', 'Child with ear pain (mother phoned)'],
    [22, '14:00', 'am', 'wellness', 'booked', 'Employer wellness medical'],
  ];
  const vitalsOverride: Record<number, Values> = {
    7: { temp: 38.4, pulse: 104, bpSys: 118, bpDia: 74, spo2: 97 },
    15: { bpSys: 162, bpDia: 98, pulse: 78, temp: 36.6, spo2: 97 },
    0: { bpSys: 146, bpDia: 92, glucose: 9.8 },
    13: { temp: 37.9, spo2: 98, bpSys: 116, bpDia: 72 },
  };
  const todays = new Map<number, DemoRecord>();
  for (const [pi, time, clin, type, status, reason, arrived] of todayPlan) {
    const p = patients[pi];
    const triaged = ['triaged', 'withdoctor', 'billing', 'done'].includes(status);
    const hist = [
      { daysAgo: 6, ...by('rec'), action: 'Visit booked' },
      ...(arrived ? [{ daysAgo: 0, ...by('rec'), action: 'Check in' }] : []),
      ...(triaged ? [{ daysAgo: 0, ...by('nd'), action: 'Record triage' }] : []),
      ...(['withdoctor', 'billing', 'done'].includes(status) && clin !== 'nd' ? [{ daysAgo: 0, ...by(clin), action: 'Call in to doctor' }] : []),
      ...(status === 'billing' || status === 'done' ? [{ daysAgo: 0, ...by(clin), action: clin === 'nd' ? 'Nurse visit complete' : 'Send to billing' }] : []),
      ...(status === 'done' ? [{ daysAgo: 0, ...by('rec'), action: 'Check out' }] : []),
      ...(status === 'dna' ? [{ daysAgo: 0, ...by('rec'), action: 'Mark did not attend' }] : []),
    ];
    const v: Values = {
      patient: p.id, date: today, time, clinician: clin, type, reason,
      ...(arrived ? { arrivedAt: arrived } : {}),
      ...(triaged ? { ...vitals(p, vitalsOverride[pi]), triagedAt: addMinutes(arrived ?? time, 9), triageNote: pi === 15 ? 'BP repeated after 5 minutes, still raised. Flagged for doctor (demo rule).' : '' } : {}),
    };
    todays.set(pi, rec('visits', 'VS', v, { status, createdDaysAgo: 6, history: hist }));
    if (arrived) p.values.lastVisit = today;
  }

  // Signed consultations for today's completed/billing doctor visits.
  const todaysSigned: Array<[number, string, string, string]> = [[6, 'tm', 'E11.9', 'metformin'], [2, 'rc', 'J45.9', 'salbutamol'], [17, 'am', 'N39.0', 'nitrofurantoin']];
  for (const [pi, clin, icd, med] of todaysSigned) {
    const p = patients[pi];
    const visit = todays.get(pi)!;
    const [s, o, a, pl] = SOAP[icd];
    const c = rec('consults', 'CN', { patient: p.id, visit: visit.id, date: today, doctor: clin, subjective: s, objective: o, assessment: a, plan: pl, icd10: icd, sickNoteDays: pi === 17 ? 2 : 0, followUp: '' },
      { status: 'signed', createdDaysAgo: 0, history: [{ daysAgo: 0, ...by(clin), action: 'Consultation started' }, { daysAgo: 0, ...by(clin), action: 'Sign consultation' }] });
    const t = tariff(VISIT_TYPES.find((x) => x.value === str(visit.values.type))!.tariff);
    const ls = [line(t.description, 1, t.price, t.code)];
    if (icd === 'E11.9') { const g = tariff('DEMO-LB1'); ls.push(line(g.description, 1, g.price, g.code)); }
    claimFor(p, c, visit, today, clin, icd, 0, ls);
    rec('scripts', 'RX', scriptValues(p, c, today, clin, med, icd === 'E11.9'), { status: 'issued', createdDaysAgo: 0, history: [{ daysAgo: 0, ...by(clin), action: 'Script drafted' }, { daysAgo: 0, ...by(clin), action: 'Sign & issue' }] });
    if (icd === 'E11.9') {
      const cc = chronicByKey.get(`${p.id}:t2dm`);
      if (cc) Object.assign(cc.values, { lastReview: today, nextReview: day(91), control: 'partial' });
    }
  }
  // Nurse immunisation claim for today.
  claimFor(patients[10], undefined, todays.get(10)!, today, 'nd', 'Z25.1', 0, [line(tariff('DEMO-NS1').description, 1, tariff('DEMO-NS1').price, 'DEMO-NS1')]);

  // In the room now: a draft consultation (no ICD-10 yet) with a draft script that clashes with a recorded allergy.
  const amina = patients[13];
  const draft = rec('consults', 'CN', {
    patient: amina.id, visit: todays.get(13)!.id, date: today, doctor: 'am',
    subjective: 'Sore throat and painful swallowing for two days. Low-grade fever at night.', objective: 'Tonsils enlarged with exudate. Tender anterior neck nodes. Temp as triaged.',
    assessment: 'Acute pharyngitis (demo note).', plan: 'Antibiotic course, salt-water gargles, review in 48 hours if no better.', icd10: '', sickNoteDays: 2, followUp: '',
  }, { status: 'draft', createdDaysAgo: 0, history: [{ daysAgo: 0, ...by('am'), action: 'Consultation started' }] });
  rec('scripts', 'RX', scriptValues(amina, draft, today, 'am', 'amoxicillin', false), { status: 'draft', createdDaysAgo: 0, history: [{ daysAgo: 0, ...by('am'), action: 'Script drafted' }] });

  /* ---------- The days ahead ---------- */
  const ahead: Array<[number, number, string, string, string, string]> = [
    [1, 1, '08:30', 'tm', 'chronic', 'BP review'], [4, 1, '09:15', 'rc', 'chronic', 'Asthma review'], [9, 1, '11:00', 'am', 'acute', 'Rash on arms'],
    [21, 1, '14:00', 'nd', 'bpcheck', 'BP check'], [14, 2, '08:30', 'rc', 'chronic', 'Diabetes review'], [23, 2, '10:00', 'tm', 'chronic', 'Diabetes review'],
    [5, 2, '13:30', 'am', 'followup', 'Thyroid follow-up'], [12, 3, '09:00', 'rc', 'chronic', 'Asthma review'], [16, 3, '11:30', 'nd', 'immunisation', 'Catch-up vaccine'],
    [19, 4, '10:00', 'tm', 'acute', 'Chest tightness when running'],
  ];
  for (const [pi, d, time, clin, type, reason] of ahead) rec('visits', 'VS', { patient: patients[pi].id, date: day(d), time, clinician: clin, type, reason }, { status: 'booked', createdDaysAgo: 3, history: [{ daysAgo: 3, ...by('rec'), action: 'Visit booked' }] });

  return { users, collections, currentUserId: 'u_partner' };
}

function str(v: unknown) { return v === undefined || v === null ? '' : String(v); }
function addMinutes(t: string, mins: number) {
  const total = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

