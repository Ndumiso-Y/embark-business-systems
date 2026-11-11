// Fictional seed data for Torque Lane Auto Services. Every person, plate, VIN,
// part number and amount is invented. Dates are relative to `today` so the
// demo always looks current.
import { seeder, user } from '../../core/seed';
import { linesTotals } from '../../core/engine';
import { parseIso } from '../../core/lib/dates';
import type { DemoRecord, Line, Values } from '../../core/types';
import { JOB_TEMPLATES, LABOUR_RATE, PARTS, type JobTemplate } from './data';
import { nextService } from './helpers';

/** Small deterministic PRNG (same algorithm as the optometry seed) so resets are identical. */
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

// name, kind, area, preferred contact
const CUSTOMERS: Array<[string, 'private' | 'account', string, string]> = [
  ['Nomsa Dube', 'private', 'Randburg', 'whatsapp'], ['Hendrik van der Merwe', 'private', 'Northcliff', 'phone'], ['Priya Govender', 'private', 'Fourways', 'whatsapp'],
  ['Lungile Shabalala', 'private', 'Sandton', 'sms'], ['Marco Ferreira', 'private', 'Bryanston', 'phone'], ['Karabo Seleka', 'private', 'Midrand', 'whatsapp'],
  ['Jessica Abrahams', 'private', 'Linden', 'email'], ['Tshepo Maluleke', 'private', 'Randburg', 'whatsapp'], ['Elaine Botha', 'private', 'Parkhurst', 'phone'],
  ['Yusuf Moosa', 'private', 'Fordsburg', 'whatsapp'], ['Busisiwe Ngcobo', 'private', 'Sunninghill', 'sms'], ['Charl du Toit', 'private', 'Honeydew', 'email'],
  ['Refilwe Mashaba', 'private', 'Ferndale', 'whatsapp'], ['Andile Gumede', 'private', 'Rivonia', 'whatsapp'], ['Megan Lategan', 'private', 'Greenside', 'email'],
  ['Vusi Mahlaba', 'private', 'Diepsloot', 'phone'],
  ['Kestrel Couriers (fictional)', 'account', 'Strijdom Park', 'email'], ['Greenleaf Garden Services (fictional)', 'account', 'Kya Sand', 'email'],
  ['Summit Plumbing Co. (fictional)', 'account', 'Robertville', 'phone'], ['Bright Start School Transport (fictional)', 'account', 'Cresta', 'whatsapp'],
];

// customer idx, make, model, year, colour, km per month, odometer today, diesel, last service days ago
const VEHICLES: Array<[number, string, string, number, string, number, number, boolean, number]> = [
  [0, 'Toyota', 'Corolla 1.6', 2017, 'Silver', 1300, 118400, false, 400], [1, 'Toyota', 'Hilux 2.8 GD-6', 2019, 'White', 2600, 164200, true, 210],
  [2, 'Volkswagen', 'Polo Vivo 1.4', 2018, 'Red', 1100, 87300, false, 345], [3, 'Suzuki', 'Swift 1.2', 2021, 'Blue', 900, 41200, false, 150],
  [4, 'Ford', 'Ranger 2.2 TDCi', 2016, 'Grey', 2100, 212800, true, 380], [5, 'Hyundai', 'i20 1.4', 2019, 'White', 1000, 68900, false, 260],
  [6, 'Renault', 'Kwid 1.0', 2020, 'Orange', 800, 39500, false, 190], [7, 'Nissan', 'NP200 1.6', 2015, 'White', 1700, 189300, false, 345],
  [8, 'Mercedes-Benz', 'C200', 2016, 'Black', 1200, 132600, false, 420], [9, 'Kia', 'Picanto 1.2', 2022, 'Yellow', 700, 22600, false, 120],
  [10, 'Toyota', 'Fortuner 2.8 GD-6', 2020, 'Bronze', 2200, 118300, true, 300], [11, 'BMW', '320i', 2015, 'Blue', 1100, 154200, false, 370],
  [12, 'Volkswagen', 'Golf 1.4 TSI', 2017, 'Grey', 1400, 109800, false, 230], [13, 'Honda', 'Jazz 1.5', 2018, 'Silver', 900, 76400, false, 350],
  [14, 'Mazda', 'CX-3 2.0', 2019, 'Red', 1200, 83700, false, 160], [15, 'Isuzu', 'D-Max 250', 2018, 'White', 2400, 176900, true, 250],
  [16, 'Toyota', 'Quantum 2.5 D-4D', 2019, 'White', 4200, 268400, true, 180], [16, 'Nissan', 'NP200 1.6', 2020, 'White', 3500, 141000, false, 200],
  [17, 'Toyota', 'Hilux 2.4 GD', 2018, 'White', 3100, 198700, true, 240], [17, 'Isuzu', 'D-Max 250', 2021, 'White', 2900, 104300, true, 140],
  [18, 'Ford', 'Ranger 2.2 TDCi', 2020, 'Blue', 3300, 152600, true, 220], [18, 'Volkswagen', 'Caddy 1.6', 2017, 'White', 2600, 221900, false, 260],
  [19, 'Toyota', 'Quantum 2.5 D-4D', 2017, 'Silver', 3800, 301200, true, 310], [0, 'Suzuki', 'Celerio 1.0', 2016, 'White', 600, 71200, false, 390],
];

const STAFF = {
  advisor: ['Naledi Mokoena', 'Service advisor'],
  foreman: ['Deon Pretorius', 'Workshop foreman'],
  clerk: ['Fatima Isaacs', 'Parts & admin clerk'],
} as const;

const APPROVAL_NOTES = [
  'Customer approved by phone (fictional call).',
  'Approved via WhatsApp — reply saved on file (fictional).',
  'Approved in person at the service counter.',
  'Fleet manager approved by email (fictional).',
];

/** Vehicles that have not visited in the last three months — they feed the service reminder list. */
const DORMANT = [0, 2, 4, 11, 13, 21, 23];
const REGULARS = VEHICLES.map((_, i) => i).filter((i) => !DORMANT.includes(i));

const TECH_NAME: Record<string, string> = { sn: 'Sibusiso Ndaba', ad: 'Ahmed Davids', kf: 'Kyle Februarie', tz: 'Thandeka Zwane' };

const round100 = (n: number) => Math.round(n / 100) * 100;

export function buildAutomotiveSeed(today: string) {
  const rnd = prng(20261112);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const { collections, rec, day, line } = seeder(today);
  const dow = (iso: string) => parseIso(iso).getDay();

  const users = [
    user('u_owner', 'Gareth Kruger', 'Workshop owner', 'owner', [], [], true),
    user('u_adv', STAFF.advisor[0], STAFF.advisor[1], 'advisor', ['dashboard', 'jobs', 'planner', 'estimates', 'vehicles', 'customers', 'reminders', 'invoices'], ['jobs.manage', 'estimates', 'customers']),
    user('u_fore', STAFF.foreman[0], STAFF.foreman[1], 'foreman', ['dashboard', 'jobs', 'planner', 'estimates', 'vehicles', 'customers', 'parts', 'reports'], ['jobs.manage', 'jobs.work', 'qc', 'estimates']),
    user('u_tech', 'Sibusiso Ndaba', 'Technician', 'technician', ['dashboard', 'jobs', 'planner', 'vehicles', 'parts'], ['jobs.work']),
    user('u_clerk', STAFF.clerk[0], STAFF.clerk[1], 'clerk', ['dashboard', 'parts', 'invoices', 'customers', 'vehicles', 'estimates', 'reminders', 'reports'], ['parts', 'invoicing', 'customers']),
  ];

  /* ---------- Parts ---------- */
  for (const [partNo, description, category, fits, cost, sell, qty, reorderLevel, bin] of PARTS) {
    rec('parts', 'PRT', { partNo, description, category, fits, supplier: category === 'tyres' ? 'Ridgeway Tyre Distributors (fictional)' : 'Highveld Motor Spares (fictional)', bin, cost, sell, qty, reorderLevel }, { createdDaysAgo: 220 });
  }
  const part = (no: string) => PARTS.find((p) => p[0] === no)!;

  /* ---------- Customers ---------- */
  const customers = CUSTOMERS.map(([name, kind, area, preferredContact], i) => {
    const first = name.split(' ')[0].toLowerCase();
    const last = name.split(' ').slice(-1)[0].toLowerCase().replace(/[^a-z]/g, '');
    const email = kind === 'account' ? `fleet.${first.replace(/[^a-z]/g, '')}@example.com` : `${first}.${last}@example.com`;
    return rec('customers', 'CUS', {
      name, kind, area, preferredContact, email,
      phone: `0${[82, 72, 83, 61, 79, 71][i % 6]} 555 ${String(2000 + i * 41).slice(-4)}`,
      contactPerson: kind === 'account' ? ['Lerato Phiri', 'Johan Smit', 'Ayanda Sibiya', 'Grace Mokoena'][i - 16] : '',
      consentReminders: i % 7 !== 5,
      notes: kind === 'account' ? 'Fleet account: 30-day terms. Vehicle may be released before payment.' : '',
    }, { createdDaysAgo: 700 - i * 23 });
  });

  /* ---------- Vehicles ---------- */
  const provinces = ['GP', 'GP', 'GP', 'MP', 'GP', 'NW'];
  const vehicles = VEHICLES.map(([ci, make, model, year, colour, kmPerMonth, cur, diesel, lastDays], i) => {
    const lastService = day(-lastDays);
    const odo = round100(cur - (kmPerMonth * lastDays) / 30.4);
    return rec('vehicles', 'VEH', {
      customer: customers[ci].id, reg: `DEMO ${String(104 + i * 37).slice(-3)} ${provinces[i % provinces.length]}`, make, model, year, colour,
      vin: `DEMO${String(year).slice(2)}${make.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}${String(400000000 + i * 7919).slice(-9)}`,
      fuel: diesel ? 'diesel' : 'petrol', kmPerMonth, odometer: odo, odometerOn: lastService,
      lastServiceDate: lastService, ...nextService(lastService, odo), lastReminder: '',
    }, { createdDaysAgo: 600 - i * 11 });
  });
  const curOdo = (vi: number, daysAgo: number) => round100(VEHICLES[vi][6] - (VEHICLES[vi][5] * daysAgo) / 30.4) + (vi * 7) % 90;
  const touchVehicle = (vi: number, date: string, odo: number, service: boolean) => {
    const v = vehicles[vi].values;
    if (date >= String(v.odometerOn)) { v.odometer = odo; v.odometerOn = date; }
    if (service && date >= String(v.lastServiceDate)) Object.assign(v, { lastServiceDate: date }, nextService(date, odo));
  };

  /* ---------- Shared builders ---------- */
  const buildLines = (t: JobTemplate, diesel: boolean): Line[] => [
    ...t.labour.map(([desc, h]) => line(desc, h, LABOUR_RATE, 'LAB')),
    ...(diesel && t.partsDiesel ? t.partsDiesel : t.parts).map(([no, q]) => line(part(no)[1], q, part(no)[5], no)),
  ];
  const hoursOf = (t: JobTemplate) => t.labour.reduce((n, [, h]) => n + h, 0);
  const totalRand = (ls: Line[]) => linesTotals(ls).total / 100;
  const techFor = (t: JobTemplate) => (t.type === 'tyres' ? 'tz' : t.type === 'diagnosis' ? 'ad' : pick(['sn', 'ad', 'kf', 'tz', 'sn', 'kf']));
  const bayFor = (t: JobTemplate) => (t.type === 'tyres' ? 'b4' : pick(['b1', 'b2', 'b3']));
  const adv = { by: STAFF.advisor[0], role: STAFF.advisor[1] };
  const fore = { by: STAFF.foreman[0], role: STAFF.foreman[1] };

  /* ---------- Three months of history ---------- */
  type Plan = { vi: number; t: JobTemplate; d: number; kind: 'normal' | 'declined' | 'comeback'; key?: string; of?: string };
  const T = (k: string) => JOB_TEMPLATES.find((x) => x.key === k)!;
  const weights: Array<[string, number]> = [['minor', 30], ['major', 14], ['brakes', 15], ['tyres', 10], ['battery', 7], ['aircon', 7], ['suspension', 8], ['clutch', 4], ['diag', 5]];
  const pickTemplate = () => {
    let x = rnd() * 100;
    for (const [k, w] of weights) { if ((x -= w) < 0) return T(k); }
    return T('minor');
  };
  const plan: Plan[] = [];
  for (let d = 92; d >= 3; d -= 1 + Math.floor(rnd() * 2)) {
    if (dow(day(-d)) === 0) continue;
    const n = rnd() < 0.3 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const t = pickTemplate();
      plan.push({ vi: pick(REGULARS), t, d, kind: t.type === 'repair' && rnd() < 0.12 ? 'declined' : 'normal' });
    }
  }
  // Two comebacks (rework) on recent jobs — feeds the comeback report.
  plan.push({ vi: 12, t: T('brakes'), d: 41, kind: 'normal', key: 'cb1' }, { vi: 12, t: T('brakes'), d: 33, kind: 'comeback', of: 'cb1' });
  plan.push({ vi: 7, t: T('suspension'), d: 64, kind: 'normal', key: 'cb2' }, { vi: 7, t: T('suspension'), d: 57, kind: 'comeback', of: 'cb2' });
  plan.sort((a, b) => b.d - a.d);

  const byKey = new Map<string, DemoRecord>();
  for (const p of plan) {
    const [ci, , , , , , , diesel] = VEHICLES[p.vi];
    const v = vehicles[p.vi];
    const account = CUSTOMERS[ci][1] === 'account';
    const date = day(-p.d);
    const odo = curOdo(p.vi, p.d);
    const hours = hoursOf(p.t);
    // Longer jobs and parts waits run into the next day (or two).
    const readyD = Math.max(1, p.d - (hours > 3 || rnd() < 0.3 ? 1 : 0) - (rnd() < 0.08 ? 1 : 0));
    const collectD = rnd() < 0.2 ? Math.max(1, readyD - 1) : readyD;
    const tech = techFor(p.t);
    const original = p.of ? byKey.get(p.of) : undefined;
    const comeback = p.kind === 'comeback';
    const declined = p.kind === 'declined';
    const jobValues: Values = {
      vehicle: v.id, jobType: comeback ? 'comeback' : p.t.type,
      complaint: comeback ? `${p.t.key === 'brakes' ? 'Brake squeal returned' : 'Knock returned'} after job ${original?.ref ?? ''}. Customer unhappy.` : p.t.complaint,
      workDate: date, startTime: pick(['07:30', '08:00', '09:00', '10:30', '12:00', '13:30']), hoursBooked: comeback ? 1 : hours,
      bay: comeback && original ? original.values.bay : bayFor(p.t), technician: comeback && original ? original.values.technician : tech,
      odometerIn: odo, checkedInOn: date, promisedDate: day(-readyD), promisedTime: '16:30', comebackOf: original?.id ?? '',
      workNotes: comeback ? 'Re-seated components, cleaned and re-torqued. Road tested — no recurrence.' : '',
    };
    if (declined) {
      const job = rec('jobs', 'JC', jobValues, { status: 'cancelled', createdDaysAgo: p.d + 3, history: [
        { daysAgo: p.d + 3, ...adv, action: 'Job card booked' }, { daysAgo: p.d, ...adv, action: 'Check in vehicle' }, { daysAgo: p.d, by: 'Ahmed Davids', role: 'Technician', action: 'Start diagnosis' },
        { daysAgo: p.d, ...adv, action: 'Send estimate to customer' },
        { daysAgo: p.d, ...adv, action: 'Cancel job card', note: 'Customer declined the estimate — will get a second quote. Vehicle collected unrepaired.' },
      ] });
      const est = rec('estimates', 'EST', { job: job.id, vehicle: v.id, lines: buildLines(p.t, diesel), validUntil: day(-p.d + 14), sentOn: date, approvedOn: '' }, { status: 'declined', createdDaysAgo: p.d, history: [
        { daysAgo: p.d, ...fore, action: 'Estimate prepared' }, { daysAgo: p.d, ...adv, action: 'Send to customer (simulated)' },
        { daysAgo: p.d, ...adv, action: 'Record customer decline', note: 'Customer declined by phone (fictional).' },
      ] });
      job.values.estimate = est.id;
      touchVehicle(p.vi, date, odo, false);
      continue;
    }
    const techName = TECH_NAME[String(jobValues.technician)] ?? 'Technician';
    const job = rec('jobs', 'JC', {
      ...jobValues, qcRoadTest: true, qcTorque: true, qcFluids: true, qcClean: true, readyOn: day(-readyD), collectedOn: day(-collectD),
    }, { status: 'collected', createdDaysAgo: p.d + 4, history: [
      { daysAgo: p.d + 4, ...adv, action: 'Job card booked' }, { daysAgo: p.d, ...adv, action: 'Check in vehicle' },
      { daysAgo: p.d, by: techName, role: 'Technician', action: 'Start work' }, { daysAgo: readyD, by: techName, role: 'Technician', action: 'Send to quality check' },
      { daysAgo: readyD, ...fore, action: 'Pass quality check' }, { daysAgo: collectD, ...adv, action: 'Hand over to customer' },
    ] });
    if (p.key) byKey.set(p.key, job);
    const ls = comeback ? [line('Rework under workmanship warranty — no charge', 1, 0, 'LAB')] : buildLines(p.t, diesel);
    const approvalNote = account ? APPROVAL_NOTES[3] : comeback ? 'No-charge rework explained to customer in person.' : pick(APPROVAL_NOTES.slice(0, 3));
    const est = rec('estimates', 'EST', { job: job.id, vehicle: v.id, lines: ls, validUntil: day(-p.d + 14), sentOn: date, approvedOn: date, approvalNote }, { status: 'approved', createdDaysAgo: p.d, history: [
      { daysAgo: p.d, ...fore, action: 'Estimate prepared' }, { daysAgo: p.d, ...adv, action: 'Send to customer (simulated)' },
      { daysAgo: p.d, ...adv, action: 'Record customer approval', note: approvalNote },
    ] });
    job.values.estimate = est.id;
    const total = totalRand(ls);
    let status = 'paid';
    let paid = total;
    let method = account ? 'account' : pick(['card', 'card', 'eft', 'cash']);
    let lastPaymentOn = account ? day(-readyD + 26) : day(-collectD);
    if (account && readyD <= 45) {
      const mode = readyD > 31 ? (rnd() < 0.5 ? 'issued' : 'partpaid') : 'issued';
      status = mode;
      paid = mode === 'partpaid' ? Math.round(total * 0.5) : 0;
      method = mode === 'partpaid' ? 'account' : '';
      lastPaymentOn = mode === 'partpaid' ? day(-readyD + 20) : '';
    }
    rec('invoices', 'INV', {
      job: job.id, customer: customers[ci].id, vehicle: v.id, issuedOn: day(-readyD), lines: ls.map((l) => line(l.description, l.qty, l.unitPrice, l.code)),
      paid, paymentMethod: method, lastPaymentOn, notes: comeback ? 'Workmanship warranty rework — no charge.' : '',
    }, { status, createdDaysAgo: readyD, history: [
      { daysAgo: readyD, ...fore, action: 'Invoice issued on quality check pass' },
      ...(status === 'paid' ? [{ daysAgo: account ? Math.max(0, readyD - 26) : collectD, by: STAFF.clerk[0], role: STAFF.clerk[1], action: `Payment received in full (${method})` }] : []),
      ...(status === 'partpaid' ? [{ daysAgo: Math.max(0, readyD - 20), by: STAFF.clerk[0], role: STAFF.clerk[1], action: 'Part payment received (account)' }] : []),
    ] });
    touchVehicle(p.vi, day(-collectD), odo, p.t.type.startsWith('service'));
  }

  /* ---------- Today's workshop ---------- */
  type Active = {
    vi: number; t: string; status: string; bay: string; tech: string; start: string; hours?: number; workDate?: number;
    est?: 'draft' | 'sent' | 'approved'; estSent?: number; note?: string; qc?: boolean[]; ready?: number; invoice?: boolean; promised: [number, string]; complaint?: string; daysBooked?: number;
  };
  const active: Active[] = [
    { vi: 6, t: 'tyres', status: 'ready', bay: 'b4', tech: 'tz', start: '07:30', est: 'approved', note: APPROVAL_NOTES[2], qc: [true, true, true, true], ready: 0, invoice: true, promised: [0, '12:00'] },
    { vi: 16, t: 'minor', status: 'ready', bay: 'b3', tech: 'kf', start: '13:00', workDate: -1, est: 'approved', note: APPROVAL_NOTES[3], qc: [true, true, true, true], ready: -1, invoice: true, promised: [-1, '16:30'] },
    { vi: 5, t: 'minor', status: 'qc', bay: 'b1', tech: 'sn', start: '09:30', est: 'approved', note: 'Approved in person at booking — fixed-price minor service.', qc: [true, true, false, false], promised: [0, '14:00'] },
    { vi: 1, t: 'major', status: 'inprogress', bay: 'b3', tech: 'kf', start: '07:30', est: 'approved', note: APPROVAL_NOTES[0], promised: [0, '15:00'] },
    { vi: 20, t: 'brakes', status: 'inprogress', bay: 'b4', tech: 'tz', start: '08:30', est: 'approved', note: APPROVAL_NOTES[3], promised: [0, '12:00'] },
    { vi: 2, t: 'clutch', status: 'approval', bay: 'b2', tech: 'ad', start: '07:30', hours: 1, est: 'sent', estSent: 0, promised: [1, '16:00'] },
    { vi: 12, t: 'aircon', status: 'approval', bay: '', tech: 'kf', start: '', workDate: -3, est: 'sent', estSent: -3, promised: [-1, '16:30'], complaint: 'Aircon blowing warm air; customer also asked for a quote on a cabin filter.' },
    { vi: 11, t: 'diag', status: 'diagnosing', bay: 'b1', tech: 'sn', start: '08:00', est: 'draft', promised: [0, '16:30'] },
    { vi: 8, t: 'brakes', status: 'checkedin', bay: 'b2', tech: 'ad', start: '10:30', promised: [0, '16:30'], complaint: 'Squealing from front left wheel under braking; steering wheel shudders at speed.' },
    { vi: 3, t: 'minor', status: 'booked', bay: 'b3', tech: 'kf', start: '13:00', est: 'approved', note: 'Approved in person at booking — fixed-price minor service.', promised: [0, '16:30'], daysBooked: 9 },
    { vi: 14, t: 'suspension', status: 'booked', bay: 'b1', tech: 'sn', start: '12:30', promised: [1, '10:00'], daysBooked: 4 },
    { vi: 13, t: 'tyres', status: 'booked', bay: 'b4', tech: 'tz', start: '14:00', promised: [0, '16:00'], daysBooked: 2 },
    // Week ahead (booked from reminders)
    { vi: 0, t: 'major', status: 'booked', bay: 'b3', tech: 'kf', start: '08:00', workDate: 1, promised: [1, '16:00'], daysBooked: 6 },
    { vi: 18, t: 'minor', status: 'booked', bay: 'b1', tech: 'sn', start: '07:30', workDate: 2, promised: [2, '12:00'], daysBooked: 3 },
  ];
  const STAGE_LOG: Record<string, string[]> = {
    checkedin: ['Check in vehicle'], diagnosing: ['Check in vehicle', 'Start diagnosis'], approval: ['Check in vehicle', 'Start diagnosis', 'Send estimate to customer'],
    inprogress: ['Check in vehicle', 'Start work'], qc: ['Check in vehicle', 'Start work', 'Send to quality check'], ready: ['Check in vehicle', 'Start work', 'Send to quality check', 'Pass quality check'],
  };
  for (const a of active) {
    const t = T(a.t);
    const [ci, , , , , , , diesel] = VEHICLES[a.vi];
    const v = vehicles[a.vi];
    const wd = a.workDate ?? 0;
    const checkedIn = a.status !== 'booked';
    const log = STAGE_LOG[a.status] ?? [];
    const job = rec('jobs', 'JC', {
      vehicle: v.id, jobType: t.type, complaint: a.complaint ?? t.complaint, workDate: day(wd), startTime: a.start, hoursBooked: a.hours ?? hoursOf(t),
      bay: a.bay, technician: a.tech, odometerIn: checkedIn ? curOdo(a.vi, -wd > 0 ? -wd : 0) : '', checkedInOn: checkedIn ? day(Math.min(0, wd)) : '',
      promisedDate: day(a.promised[0]), promisedTime: a.promised[1], comebackOf: '',
      qcRoadTest: a.qc?.[0] ?? false, qcTorque: a.qc?.[1] ?? false, qcFluids: a.qc?.[2] ?? false, qcClean: a.qc?.[3] ?? false,
      readyOn: a.ready !== undefined ? day(a.ready) : '', collectedOn: '',
      workNotes: a.status === 'qc' ? 'Service complete. Rear tyres at 3 mm — advised customer.' : a.status === 'diagnosing' ? 'Fault code read: misfire cylinder 3 (demo). Checking coil and plug.' : '',
    }, { status: a.status, createdDaysAgo: a.daysBooked ?? 5, history: [
      { daysAgo: a.daysBooked ?? 5, ...adv, action: 'Job card booked' },
      ...log.map((action) => ({ daysAgo: Math.max(0, -Math.min(0, wd)), ...(action.includes('quality') ? fore : action.includes('estimate') || action.includes('Check in') ? adv : { by: TECH_NAME[a.tech] ?? 'Technician', role: 'Technician' }), action })),
    ] });
    if (a.est) {
      const ls = buildLines(t, diesel);
      const sent = a.est === 'draft' ? '' : day(a.estSent ?? Math.min(0, wd));
      const est = rec('estimates', 'EST', {
        job: job.id, vehicle: v.id, lines: ls, validUntil: day(14), sentOn: sent, approvedOn: a.est === 'approved' ? sent : '', approvalNote: a.est === 'approved' ? a.note ?? '' : '',
      }, { status: a.est, createdDaysAgo: a.est === 'draft' ? 0 : Math.max(0, -(a.estSent ?? Math.min(0, wd))), history: [
        { daysAgo: 0, ...fore, action: 'Estimate prepared' },
        ...(a.est !== 'draft' ? [{ daysAgo: Math.max(0, -(a.estSent ?? 0)), ...adv, action: 'Send to customer (simulated)' }] : []),
        ...(a.est === 'approved' ? [{ daysAgo: Math.max(0, -(a.estSent ?? 0)), ...adv, action: 'Record customer approval', note: a.note }] : []),
      ] });
      job.values.estimate = est.id;
      if (a.invoice) {
        rec('invoices', 'INV', { job: job.id, customer: customers[ci].id, vehicle: v.id, issuedOn: day(a.ready ?? 0), lines: ls.map((l) => line(l.description, l.qty, l.unitPrice, l.code)), paid: 0, paymentMethod: '', lastPaymentOn: '', notes: '' },
          { status: 'issued', createdDaysAgo: -(a.ready ?? 0), history: [{ daysAgo: -(a.ready ?? 0), ...fore, action: 'Invoice issued on quality check pass' }] });
      }
    }
  }

  // Reminder contact history on a couple of overdue vehicles.
  vehicles[4].values.lastReminder = day(-9);
  vehicles[23].values.lastReminder = day(-20);

  return { users, collections, currentUserId: 'u_owner' };
}

