// Fictional seed data for Northgate Optometry. Every person, number and code
// is invented. Dates are relative to `today` so the demo always looks current.
import { seeder, user } from '../../core/seed';
import type { DemoRecord, Line, Values } from '../../core/types';
import { LENS_OPTIONS, TARIFFS } from './data';

/** Small deterministic PRNG so seeds are identical on every reset. */
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

const PEOPLE: Array<[string, string, number, string]> = [
  // first, last, age, scheme
  ['Nomvula', 'Sithole', 52, 'meridian'], ['Pieter', 'Joubert', 67, 'baobab'], ['Zanele', 'Mahlangu', 34, 'protea'], ['Rajesh', 'Naidoo', 45, 'meridian'],
  ['Chloe', 'Adams', 9, 'meridian'], ['Bongani', 'Zulu', 28, 'private'], ['Fatima', 'Ebrahim', 58, 'baobab'], ['Kagiso', 'Molefe', 41, 'protea'],
  ['Annelie', 'Pretorius', 73, 'baobab'], ['Thabo', 'Nkosi', 19, 'private'], ['Grace', 'Okafor', 36, 'meridian'], ['Willem', 'Steyn', 61, 'meridian'],
  ['Lindiwe', 'Ndlovu', 47, 'protea'], ['Mohammed', 'Cassim', 55, 'baobab'], ['Siyabonga', 'Mthembu', 12, 'protea'], ['Kerry', 'Fourie', 39, 'private'],
  ['Palesa', 'Mokoena', 26, 'meridian'], ['Daniel', 'Smit', 49, 'baobab'], ['Nandi', 'Khoza', 63, 'meridian'], ['Riaan', 'Venter', 44, 'protea'],
  ['Ayanda', 'Cele', 31, 'private'], ['Precious', 'Mabena', 69, 'baobab'], ['Johannes', 'Malan', 57, 'meridian'], ['Tumi', 'Radebe', 23, 'protea'],
  ['Sarah', 'Hendricks', 42, 'baobab'], ['Lebo', 'Masilela', 15, 'meridian'],
];

const SPH = [-4.5, -3.25, -2.5, -1.75, -1.25, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.25];
const CYL = [0, 0, 0, -0.25, -0.5, -0.75, -1.0, -1.5];
const AXES = [5, 10, 15, 30, 45, 80, 90, 95, 120, 150, 165, 175, 180];

export function buildOptometrySeed(today: string) {
  const rnd = prng(20261111);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const { collections, rec, day, line } = seeder(today);
  const year = Number(today.slice(0, 4));

  const users = [
    user('u_owner', 'Dr Lerato Khumalo', 'Owner & optometrist', 'owner', [], [], true),
    user('u_opt', 'Sipho Dlamini', 'Optometrist', 'optometrist', ['dashboard', 'diary', 'patients', 'recalls', 'exams', 'prescriptions', 'orders'], ['clinical.view', 'clinical.record', 'bookings']),
    user('u_disp', 'Megan van Wyk', 'Optical dispenser', 'dispenser', ['dashboard', 'diary', 'patients', 'prescriptions', 'orders', 'stock'], ['dispense', 'stock', 'bookings']),
    user('u_fd', 'Ayesha Patel', 'Receptionist', 'frontdesk', ['dashboard', 'diary', 'patients', 'recalls', 'claims'], ['bookings', 'patients.edit']),
    user('u_mgr', 'Johan Botha', 'Practice manager', 'manager', ['dashboard', 'patients', 'recalls', 'claims', 'stock', 'reports', 'admin'], ['billing', 'stock', 'patients.edit']),
  ];

  /* ---------- Stock ---------- */
  const frames: DemoRecord[] = [];
  const stockRows: Array<[string, string, string, string, number, number, number, number]> = [
    ['Arden 210 rectangle', 'frame', 'Kloofview Eyewear', 'Matte black · 54□18', 620, 1450, 4, 2],
    ['Arden 214 round', 'frame', 'Kloofview Eyewear', 'Tortoise · 50□20', 640, 1490, 1, 2],
    ['Marlo titanium half-rim', 'frame', 'Southpoint Frames', 'Gunmetal · 55□17', 1180, 2650, 3, 1],
    ['Marlo kids flex', 'frame', 'Southpoint Frames', 'Blue · 44□16', 380, 890, 5, 2],
    ['Sable acetate cat-eye', 'frame', 'Kloofview Eyewear', 'Burgundy · 52□18', 760, 1790, 0, 1],
    ['Sable acetate square', 'frame', 'Kloofview Eyewear', 'Crystal grey · 53□19', 760, 1790, 2, 1],
    ['Veld rimless', 'frame', 'Harbour Optical Supply', 'Silver · 54□17', 990, 2290, 2, 1],
    ['Veld sport wrap', 'frame', 'Harbour Optical Supply', 'Black/green · 60□15', 840, 1950, 3, 1],
    ['Coastline aviator', 'sunglass', 'Harbour Optical Supply', 'Gold · polarised', 540, 1350, 6, 2],
    ['Coastline wayfarer', 'sunglass', 'Harbour Optical Supply', 'Black · polarised', 520, 1290, 2, 2],
    ['Monthly SiHy lenses (6 pack)', 'cl', 'Clearsight Contact Supply', 'Range −10.00 to +6.00', 210, 480, 18, 10],
    ['Daily lenses (30 pack)', 'cl', 'Clearsight Contact Supply', 'Range −8.00 to +4.00', 290, 625, 7, 12],
    ['Toric monthly lenses (6 pack)', 'cl', 'Clearsight Contact Supply', 'Cyl −0.75 to −2.25', 330, 720, 4, 4],
    ['Multipurpose solution 360 ml', 'solution', 'Clearsight Contact Supply', '', 62, 145, 22, 10],
    ['Peroxide system 300 ml', 'solution', 'Clearsight Contact Supply', '', 88, 199, 3, 6],
    ['Lubricating eye drops 10 ml', 'solution', 'Clearsight Contact Supply', '', 48, 119, 14, 8],
    ['Microfibre cloth', 'accessory', 'Northgate own label', '', 6, 35, 120, 40],
    ['Hard case', 'accessory', 'Northgate own label', '', 18, 75, 35, 20],
    ['Chain & cord', 'accessory', 'Northgate own label', '', 15, 65, 9, 10],
  ];
  for (const [name, category, supplier, colour, cost, retail, qty, reorderLevel] of stockRows) {
    const r = rec('stock', 'SKU', { name, category, supplier, colour, cost, retail, qty, reorderLevel }, { createdDaysAgo: 200 });
    if (category === 'frame') frames.push(r);
  }

  /* ---------- Patients ---------- */
  const patients = PEOPLE.map(([first, last, age, scheme], i) => {
    const dob = `${year - age}-${String(1 + (i * 5) % 12).padStart(2, '0')}-${String(3 + (i * 7) % 25).padStart(2, '0')}`;
    const recallOffsets = [-62, -21, -4, 6, 18, 33, 90, 150, 210, 260, 300, 340];
    const recallDue = day(recallOffsets[i % recallOffsets.length]);
    const v: Values = {
      firstName: first, lastName: last, dob,
      phone: `0${[72, 82, 83, 61, 79][i % 5]} 555 ${String(1000 + i * 37).slice(-4)}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      scheme, memberNo: scheme === 'private' ? '' : `${scheme.slice(0, 3).toUpperCase()}-${100200 + i * 113}`,
      preferredContact: ['sms', 'email', 'sms', 'phone'][i % 4],
      consentRecall: i % 9 !== 4,
      recallDue, recallType: age < 16 ? 'child' : i % 6 === 0 ? 'cl' : i % 7 === 3 ? 'diabetic' : 'annual',
      medicalNotes: [
        'Type 2 diabetes (diet + oral medication). No known allergies.', 'Hypertension, on daily medication. Family history of glaucoma (father).',
        'No significant medical history.', 'Mild seasonal allergies.', 'Asthma, uses inhaler as needed.', 'No significant medical history.',
      ][i % 6],
    };
    return rec('patients', 'PT', v, { createdDaysAgo: 400 - i * 7 });
  });

  /* ---------- Exams, prescriptions, appointments, orders, claims ---------- */
  const optoms = ['lk', 'sd'];
  type ExamSeed = { p: DemoRecord; daysAgo: number; status: 'final' | 'draft' };
  const examPlan: ExamSeed[] = [];
  // ~6 months of history: 2–3 exams a week.
  for (let d = 175; d >= 1; d -= 2 + Math.floor(rnd() * 3)) examPlan.push({ p: patients[Math.floor(rnd() * patients.length)], daysAgo: d, status: 'final' });

  const latestRx = new Map<string, DemoRecord>();
  const orderCandidates: Array<{ p: DemoRecord; rx: DemoRecord; daysAgo: number }> = [];
  for (const e of examPlan) {
    const age = PEOPLE[patients.indexOf(e.p)][2];
    const date = day(-e.daysAgo);
    const optom = pick(optoms);
    const ap = rec('appointments', 'AP', { patient: e.p.id, type: age < 16 ? 'child' : 'exam', date, time: pick(['08:30', '09:15', '10:00', '11:30', '13:30', '14:15', '15:00']), practitioner: optom, notes: '' },
      { status: 'completed', createdDaysAgo: e.daysAgo + 10 });
    const rs = pick(SPH), ls = Math.max(-6, Math.min(4, rs + pick([0, 0, 0.25, -0.25, 0.5])));
    const rc = pick(CYL), lc = pick(CYL);
    const add = age >= 45 ? Math.min(2.5, 0.75 + Math.floor((age - 45) / 5) * 0.25) : 0;
    const diagnosis = add ? 'H52.4' : rs < 0 ? 'H52.1' : rs > 0 ? 'H52.0' : rc ? 'H52.2' : 'Z01.0';
    const v: Values = {
      patient: e.p.id, date, optometrist: optom, appointment: ap.id,
      reason: pick(['Routine check, blurred distance vision when driving at night.', 'Headaches after screen work.', 'Difficulty reading small print.', 'Annual review, no new complaints.', 'School referral — difficulty seeing the board.']),
      history: 'General health as per patient record. No previous eye surgery.',
      r_vaUnaided: pick(['6/9', '6/12', '6/18', '6/7.5']), l_vaUnaided: pick(['6/9', '6/12', '6/7.5', '6/6']),
      r_sph: rs, r_cyl: rc, r_axis: rc ? pick(AXES) : null, r_add: add || null, r_va: '6/6',
      l_sph: ls, l_cyl: lc, l_axis: lc ? pick(AXES) : null, l_add: add || null, l_va: pick(['6/6', '6/6', '6/7.5']),
      pd: 58 + Math.floor(rnd() * 10), r_iop: 12 + Math.floor(rnd() * 8), l_iop: 12 + Math.floor(rnd() * 8),
      anterior: 'Lids and lashes clear. Cornea clear. Anterior chamber deep and quiet.',
      posterior: 'Discs pink, well defined. C/D 0.3 both eyes. Maculae healthy.',
      diagnosis, plan: add ? 'Multifocal spectacles advised. Discussed adaptation.' : 'Spectacles for full-time wear advised.',
      referral: 'none', recallMonths: '24', recallType: age < 16 ? 'child' : 'annual',
    };
    const ex = rec('exams', 'EX', v, { status: 'final', createdDaysAgo: e.daysAgo, history: [
      { daysAgo: e.daysAgo, by: optom === 'lk' ? 'Dr Lerato Khumalo' : 'Sipho Dlamini', role: 'Optometrist', action: 'Exam started' },
      { daysAgo: e.daysAgo, by: optom === 'lk' ? 'Dr Lerato Khumalo' : 'Sipho Dlamini', role: 'Optometrist', action: 'Finalise exam & issue Rx' },
    ] });
    const prev = latestRx.get(e.p.id);
    if (prev) prev.status = 'superseded';
    const rx = rec('prescriptions', 'RX', {
      patient: e.p.id, exam: ex.id, date, practitioner: optom, rxType: add ? 'multifocal' : 'distance',
      r_sph: v.r_sph, r_cyl: v.r_cyl, r_axis: v.r_axis, r_add: v.r_add, l_sph: v.l_sph, l_cyl: v.l_cyl, l_axis: v.l_axis, l_add: v.l_add, pd: v.pd,
      expiry: day(-e.daysAgo + 730), notes: '',
    }, { status: 'issued', createdDaysAgo: e.daysAgo });
    latestRx.set(e.p.id, rx);
    e.p.values.lastExam = date;
    if (rnd() < 0.62) orderCandidates.push({ p: e.p, rx, daysAgo: e.daysAgo });
    // Exam claim
    const scheme = String(e.p.values.scheme);
    const examLine = TARIFFS[0];
    const claimLines: Line[] = [line(examLine.description, 1, examLine.price, examLine.code)];
    const totalIncl = Math.round(examLine.price * 1.15 * 100) / 100;
    const cs = e.daysAgo > 40 ? 'paid' : e.daysAgo > 12 ? pick(['paid', 'paid', 'submitted', 'partpaid']) : pick(['submitted', 'draft']);
    if (scheme === 'private') {
      rec('claims', 'CLM', { patient: e.p.id, date, scheme, memberNo: '', icd10: diagnosis, schemePaid: 0, patientPaid: totalIncl, notes: 'Private patient — paid at reception (card).', lines: claimLines }, { status: 'settled', createdDaysAgo: e.daysAgo });
    } else {
      rec('claims', 'CLM', {
        patient: e.p.id, date, scheme, memberNo: e.p.values.memberNo, icd10: diagnosis,
        schemePaid: cs === 'paid' ? totalIncl : cs === 'partpaid' ? Math.round(totalIncl * 0.7) : 0, patientPaid: 0,
        submittedOn: cs === 'draft' ? '' : day(-e.daysAgo + 1), notes: cs === 'partpaid' ? 'Scheme paid at scheme rate; balance due from patient.' : '', lines: claimLines,
      }, { status: cs, createdDaysAgo: e.daysAgo });
    }
  }

  // One rejected claim and one patient with an expired prescription.
  const rejectedFor = patients[6];
  rec('claims', 'CLM', { patient: rejectedFor.id, date: day(-19), scheme: 'baobab', memberNo: rejectedFor.values.memberNo, icd10: 'H52.4', schemePaid: 0, patientPaid: 0, submittedOn: day(-18), notes: '', lines: [line(TARIFFS[1].description, 1, TARIFFS[1].price, TARIFFS[1].code)] },
    { status: 'rejected', createdDaysAgo: 19, history: [{ daysAgo: 19, by: 'Johan Botha', role: 'Practice manager', action: 'Claim created' }, { daysAgo: 18, by: 'Johan Botha', role: 'Practice manager', action: 'Submit to scheme (simulated)' }, { daysAgo: 9, by: 'Johan Botha', role: 'Practice manager', action: 'Record rejection', note: 'Scheme response (fictional): benefit for contact lens fitting already used this year.' }] });
  const expiredP = patients[8];
  const oldRx = rec('prescriptions', 'RX', { patient: expiredP.id, date: day(-790), practitioner: 'lk', rxType: 'multifocal', r_sph: 1.25, r_cyl: -0.5, r_axis: 90, r_add: 2.25, l_sph: 1.5, l_cyl: 0, l_axis: null, l_add: 2.25, pd: 61, expiry: day(-60), notes: 'Patient overdue for re-examination.' }, { status: 'issued', createdDaysAgo: 790 });
  expiredP.values.lastExam = day(-790);
  expiredP.values.recallDue = day(-60);

  /* ---------- Optical orders ---------- */
  const pricing = (lensKey: string, frame?: DemoRecord): Line[] => {
    const lens = LENS_OPTIONS.find((l) => l.value === lensKey)!;
    const out = [line(lens.label, 1, Math.round(lens.price / 1.15))];
    if (frame) out.unshift(line(String(frame.values.name), 1, Math.round(Number(frame.values.retail) / 1.15)));
    return out;
  };
  const stages: Array<{ status: string; promisedOffset: number; readySince?: number }> = [];
  orderCandidates.sort((a, b) => b.daysAgo - a.daysAgo);
  orderCandidates.forEach((o, i) => {
    const recent = o.daysAgo < 21;
    let status = 'collected';
    let promised = -o.daysAgo + 8;
    let readySince: string | undefined;
    if (recent) {
      const plan = [
        { s: 'ready', ready: -20 }, { s: 'ready', ready: -3 }, { s: 'received' }, { s: 'ordered', late: true }, { s: 'ordered' }, { s: 'remake' }, { s: 'ready', ready: -1 }, { s: 'quote' }, { s: 'ordered' },
      ][stages.length % 9];
      status = plan.s;
      promised = plan.late ? -2 : 4 + (stages.length % 4);
      if (plan.ready) readySince = day(plan.ready);
      stages.push({ status, promisedOffset: promised });
    } else if (i % 11 === 5) status = 'cancelled';
    const age = PEOPLE[patients.indexOf(o.p)][2];
    const multifocal = o.rx.values.rxType === 'multifocal';
    const cl = !multifocal && i % 6 === 2;
    const frame = cl ? undefined : age < 16 ? frames[3] : frames[i % frames.length];
    const lens = cl ? 'cl-month' : multifocal ? (i % 2 ? 'mf-std' : 'mf-prem') : pick(['sv-std', 'sv-blue', 'sv-thin']);
    const scheme = String(o.p.values.scheme);
    const hist = [
      { daysAgo: o.daysAgo, by: 'Megan van Wyk', role: 'Optical dispenser', action: 'Optical order created' },
      ...(status !== 'quote' && status !== 'cancelled' ? [{ daysAgo: Math.max(0, o.daysAgo - 1), by: 'Megan van Wyk', role: 'Optical dispenser', action: 'Send to lab' }] : []),
      ...(status === 'remake' ? [{ daysAgo: 1, by: 'Megan van Wyk', role: 'Optical dispenser', action: 'Fail quality check', note: 'Left lens axis 10° off ordered value — returned to lab.' }] : []),
      ...(status === 'cancelled' ? [{ daysAgo: Math.max(0, o.daysAgo - 2), by: 'Ayesha Patel', role: 'Front desk', action: 'Cancel quote', note: 'Patient decided to keep current spectacles.' }] : []),
    ];
    rec('orders', 'JOB', {
      patient: o.p.id, prescription: o.rx.id, kind: cl ? 'cl' : 'spectacles', frame: frame?.id ?? '', lens,
      lab: cl ? 'clearpoint' : pick(['clearpoint', 'lensworks', 'in-house']), pd: cl ? null : o.rx.values.pd, heights: multifocal ? 'R 19 / L 19' : '',
      promised: day(promised), funding: scheme === 'private' ? 'private' : 'scheme', deposit: scheme === 'private' ? 500 : 0, readySince,
      lines: pricing(lens, frame),
    }, { status, createdDaysAgo: o.daysAgo, history: hist });
  });
  // A quote against the expired prescription (sending it to the lab is blocked).
  rec('orders', 'JOB', { patient: expiredP.id, prescription: oldRx.id, kind: 'spectacles', frame: frames[2].id, lens: 'mf-std', lab: 'lensworks', pd: 61, heights: 'R 20 / L 20', promised: day(7), funding: 'scheme', deposit: 0, lines: pricing('mf-std', frames[2]) }, { status: 'quote', createdDaysAgo: 2 });

  /* ---------- Today's diary and the week ahead ---------- */
  const todayPlan: Array<[number, string, string, string, string]> = [
    // patient idx, time, practitioner, type, status
    [0, '08:00', 'lk', 'diabetic', 'completed'], [3, '08:30', 'sd', 'exam', 'completed'], [21, '09:00', 'lk', 'exam', 'completed'],
    [17, '09:15', 'mv', 'collection', 'completed'], [10, '09:45', 'sd', 'clfit', 'noshow'], [4, '10:00', 'lk', 'child', 'inexam'],
    [12, '10:30', 'sd', 'exam', 'pretest'], [19, '10:45', 'mv', 'adjust', 'arrived'], [7, '11:00', 'lk', 'exam', 'arrived'],
    [15, '11:30', 'sd', 'claftercare', 'booked'], [22, '12:00', 'lk', 'exam', 'booked'], [8, '13:30', 'lk', 'exam', 'booked'],
    [23, '14:00', 'sd', 'driver', 'booked'], [2, '14:30', 'mv', 'collection', 'booked'], [13, '15:00', 'sd', 'exam', 'booked'], [25, '15:30', 'lk', 'child', 'booked'],
  ];
  let draftAppt: DemoRecord | undefined;
  for (const [pi, time, prac, type, status] of todayPlan) {
    const r = rec('appointments', 'AP', { patient: patients[pi].id, type, date: today, time, practitioner: prac, notes: pi === 8 ? 'Prescription expired — full exam before new spectacles.' : '' }, { status, createdDaysAgo: 6 });
    if (status === 'inexam') draftAppt = r;
    if (status === 'completed' && type !== 'collection') {
      const pt = patients[pi];
      const age = PEOPLE[pi][2];
      const add = age >= 45 ? 2 : null;
      rec('exams', 'EX', {
        patient: pt.id, date: today, optometrist: prac, appointment: r.id, reason: type === 'diabetic' ? 'Annual diabetic eye screening.' : 'Routine examination.',
        history: 'As per patient record.', r_vaUnaided: '6/12', l_vaUnaided: '6/9', r_sph: -0.75, r_cyl: -0.25, r_axis: 175, r_add: add, r_va: '6/6', l_sph: -0.5, l_cyl: null, l_axis: null, l_add: add, l_va: '6/6',
        pd: 62, r_iop: 15, l_iop: 16, anterior: 'Clear.', posterior: type === 'diabetic' ? 'No diabetic retinopathy seen (demo finding).' : 'Healthy.',
        diagnosis: add ? 'H52.4' : 'H52.1', plan: 'Update spectacles.', referral: 'none', recallMonths: type === 'diabetic' ? '12' : '24', recallType: type === 'diabetic' ? 'diabetic' : 'annual',
      }, { status: 'final', createdDaysAgo: 0, history: [{ daysAgo: 0, by: prac === 'lk' ? 'Dr Lerato Khumalo' : 'Sipho Dlamini', role: 'Optometrist', action: 'Finalise exam & issue Rx' }] });
      pt.values.lastExam = today;
      const exNew = collections.exams[collections.exams.length - 1];
      const prevRx = latestRx.get(pt.id);
      if (prevRx) prevRx.status = 'superseded';
      rec('prescriptions', 'RX', {
        patient: pt.id, exam: exNew.id, date: today, practitioner: prac, rxType: add ? 'multifocal' : 'distance',
        r_sph: -0.75, r_cyl: -0.25, r_axis: 175, r_add: add, l_sph: -0.5, l_cyl: null, l_axis: null, l_add: add, pd: 62, expiry: day(730), notes: '',
      }, { status: 'issued', createdDaysAgo: 0 });
      const tariff = type === 'diabetic' ? TARIFFS[3] : TARIFFS[0];
      rec('claims', 'CLM', { patient: pt.id, date: today, scheme: pt.values.scheme, memberNo: pt.values.memberNo, icd10: add ? 'H52.4' : 'H52.1', schemePaid: 0, patientPaid: 0, submittedOn: '', notes: '', lines: [line(tariff.description, 1, tariff.price, tariff.code)] },
        { status: 'draft', createdDaysAgo: 0 });
    }
  }
  if (draftAppt) {
    rec('exams', 'EX', {
      patient: draftAppt.values.patient, date: today, optometrist: 'lk', appointment: draftAppt.id,
      reason: 'School reports difficulty reading the board. Squints at distance.', history: 'Born full term. No eye problems in early childhood. Mother myopic.',
      r_vaUnaided: '6/18', l_vaUnaided: '6/12', r_sph: -1.25, r_cyl: -0.5, r_axis: 180, r_add: null, r_va: '6/6', l_sph: -1.0, l_cyl: null, l_axis: null, l_add: null, l_va: '6/6',
      pd: 52, r_iop: null, l_iop: null, anterior: 'Clear and healthy.', posterior: '', diagnosis: '', plan: '', referral: 'none', recallMonths: '12', recallType: 'child',
    }, { status: 'draft', createdDaysAgo: 0, history: [{ daysAgo: 0, by: 'Dr Lerato Khumalo', role: 'Practice owner', action: 'Exam started' }] });
  }
  const ahead: Array<[number, number, string, string, string]> = [
    [1, 1, '08:30', 'lk', 'exam'], [5, 1, '09:30', 'sd', 'exam'], [9, 1, '11:00', 'lk', 'clfit'], [11, 1, '14:00', 'mv', 'collection'],
    [14, 2, '08:30', 'sd', 'child'], [16, 2, '10:00', 'lk', 'exam'], [18, 2, '13:30', 'lk', 'diabetic'], [20, 3, '09:00', 'sd', 'exam'],
    [24, 3, '11:30', 'lk', 'exam'], [1, 4, '10:00', 'sd', 'claftercare'], [6, 4, '14:30', 'lk', 'exam'],
  ];
  for (const [pi, d, time, prac, type] of ahead) rec('appointments', 'AP', { patient: patients[pi].id, type, date: day(d), time, practitioner: prac, notes: '' }, { status: 'booked', createdDaysAgo: 5 });
  rec('appointments', 'AP', { patient: patients[5].id, type: 'exam', date: day(-6), time: '09:00', practitioner: 'sd', notes: '' }, { status: 'noshow', createdDaysAgo: 14 });
  rec('appointments', 'AP', { patient: patients[16].id, type: 'clfit', date: day(-3), time: '15:00', practitioner: 'lk', notes: '' }, { status: 'cancelled', createdDaysAgo: 12, history: [{ daysAgo: 12, by: 'Ayesha Patel', role: 'Front desk', action: 'Appointment created' }, { daysAgo: 4, by: 'Ayesha Patel', role: 'Front desk', action: 'Cancel', note: 'Patient travelling; will rebook.' }] });

  // Recall contact history on a couple of overdue patients.
  patients[0].values.lastContacted = day(-12);
  patients[1].values.lastContacted = day(-30);

  return { users, collections, currentUserId: 'u_owner' };
}
