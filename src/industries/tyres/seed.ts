// Fictional seed data for TreadRight Tyre & Fitment. Every person, plate,
// asset number, brand, price and reading is invented. Dates are relative to
// `today` so the demo always looks current.
import { seeder, user } from '../../core/seed';
import { parseIso } from '../../core/lib/dates';
import type { DemoRecord, IndustryData, Values } from '../../core/types';
import { POSITIONS, QC_ITEMS, STOCK, SUPPLIERS, TECHNICIANS, VEHICLE_CLASSES } from './data';
import { dotFromDate, quoteLines, sameSize } from './helpers';

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

// name, credit limit (R), PO required, contact person, prefix for PO numbers
const FLEETS: Array<[string, number, boolean, string, string]> = [
  ['Bluegum Logistics (fictional)', 60000, true, 'Pieter Swanepoel', 'BGL'],
  ['Sunveld Security Patrols (fictional)', 40000, true, 'Thandi Nkosi', 'SVS'],
  ['Kliprivier Courier Co. (fictional)', 25000, false, 'Gavin Daniels', 'KCC'],
  ['Protea Home Care (fictional)', 20000, true, 'Ruth Mahlangu', 'PHC'],
  ['Acacia Farm Supplies (fictional)', 30000, false, 'Hennie Joubert', 'AFS'],
  ['Ubuntu Shuttle Services (fictional)', 50000, true, 'Bongani Zulu', 'USS'],
];

// name, area
const RETAIL: Array<[string, string]> = [
  ['Nomvula Sithole', 'Alberton'], ['Johan Pretorius', 'Boksburg'], ['Ayesha Patel', 'Lenasia'], ['Thabo Molefe', 'Germiston'],
  ['Carla Ferreira', 'Edenvale'], ['Mandla Ndlovu', 'Kempton Park'], ['Lindiwe Zungu', 'Benoni'], ['Ricardo Gouveia', 'Bedfordview'],
  ['Palesa Mokoena', 'Alberton'], ['Shaun Adams', 'Brackenhurst'], ['Precious Radebe', 'Germiston'], ['Wikus Nel', 'Boksburg'],
  ['Fatima Cassim', 'Lenasia'], ['Dumisani Khoza', 'Thokoza'], ['Elize van Wyk', 'Meyersdal'], ['Kagiso Tau', 'Kempton Park'],
  ['Melissa Naidoo', 'Edenvale'], ['Sizwe Mabaso', 'Katlehong'], ['Ilse Kruger', 'Bedfordview'],
];

// customer index (0–18 retail, 19–24 fleet), make, model, year, class, tyre size, current km, km since rotation, km per month
const VEHICLES: Array<[number, string, string, number, string, string, number, number, number]> = [
  [0, 'Toyota', 'Corolla 1.6', 2018, 'passenger', '205/55R16', 98400, 6200, 1300],
  [1, 'Volkswagen', 'Polo Vivo 1.4', 2019, 'passenger', '185/60R15', 76300, 11800, 1200],
  [2, 'Suzuki', 'Swift 1.2', 2021, 'passenger', '175/65R14', 38100, 4100, 900],
  [3, 'Ford', 'Ranger 2.2', 2017, 'bakkie', '265/65R17', 184200, 9500, 2200],
  [4, 'Hyundai', 'i20 1.4', 2019, 'passenger', '185/65R15', 66900, 3000, 1000],
  [5, 'Toyota', 'Fortuner 2.8', 2020, 'suv', '265/60R18', 121000, 12500, 2100],
  [6, 'Renault', 'Kwid 1.0', 2020, 'passenger', '165/70R14', 41200, 2500, 800],
  [7, 'Kia', 'Sportage 2.0', 2019, 'suv', '225/65R17', 88700, 10400, 1400],
  [8, 'Mazda', 'CX-3 2.0', 2019, 'suv', '215/60R16', 79300, 5200, 1200],
  [9, 'Honda', 'Jazz 1.5', 2018, 'passenger', '185/55R15', 70400, 7300, 1000],
  [10, 'Volkswagen', 'Golf 1.4 TSI', 2017, 'passenger', '205/55R16', 112800, 8800, 1500],
  [11, 'Toyota', 'Hilux 2.8 GD-6', 2019, 'bakkie', '265/65R17', 158900, 4700, 2600],
  [12, 'Nissan', 'Almera 1.5', 2018, 'passenger', '185/65R15', 93600, 10900, 1300],
  [13, 'BMW', '320i', 2016, 'passenger', '225/45R17', 141700, 3600, 1100],
  [14, 'Isuzu', 'D-Max 250', 2018, 'bakkie', '245/70R16', 167400, 8100, 2300],
  [15, 'Toyota', 'Starlet 1.4', 2022, 'passenger', '175/65R14', 29800, 1900, 1000],
  [16, 'Mercedes-Benz', 'C200', 2016, 'passenger', '225/45R17', 131200, 6400, 1100],
  [17, 'Chery', 'Tiggo 4 Pro', 2023, 'suv', '215/55R17', 24600, 4300, 1200],
  [18, 'Datsun', 'Go 1.2', 2019, 'passenger', '155/80R13', 61800, 9900, 900],
  [19, 'Toyota', 'Quantum 2.5 D-4D', 2019, 'lcv', '195/70R15C', 268400, 7600, 4200],
  [19, 'Toyota', 'Hilux 2.4 GD', 2018, 'bakkie', '245/70R16', 198700, 10600, 3100],
  [19, 'Nissan', 'NV350 2.5', 2020, 'lcv', '195/70R15C', 176300, 3900, 3800],
  [20, 'Volkswagen', 'Polo Vivo 1.6', 2021, 'passenger', '185/60R15', 132500, 8700, 3500],
  [20, 'Toyota', 'Corolla Quest 1.8', 2020, 'passenger', '195/65R15', 154200, 11200, 3600],
  [21, 'Ford', 'Ranger 2.2', 2020, 'bakkie', '265/65R17', 141800, 6800, 3000],
  [21, 'Hyundai', 'H100 2.6', 2019, 'lcv', '195/70R15C', 187600, 9100, 3300],
  [22, 'Toyota', 'Avanza 1.5', 2020, 'passenger', '185/65R15', 118400, 5600, 2600],
  [23, 'Isuzu', 'D-Max 250', 2019, 'bakkie', '245/70R16', 149300, 12100, 2800],
  [24, 'Toyota', 'Quantum 2.7 GL', 2018, 'lcv', '215/70R15C', 301200, 4400, 4600],
  [24, 'Toyota', 'Quantum 2.7 GL', 2021, 'lcv', '215/70R15C', 196800, 10300, 4400],
];

const STAFF = {
  advisor: { by: 'Zanele Mthembu', role: 'Counter sales / service advisor' },
  stock: { by: 'Kevin Naidoo', role: 'Stock controller' },
  fleet: { by: 'Annelie Botha', role: 'Fleet accounts clerk' },
  manager: { by: 'Riaan Steyn', role: 'Branch manager' },
};
const tech = (k: string) => ({ by: TECHNICIANS.find((t) => t.value === k)!.label, role: k === 'lm' ? 'Alignment technician' : 'Fitment technician' });
const HOME_BAY: Record<string, string> = { sk: 'b1', jv: 'b2', np: 'b3', md: 'b4', lm: 'align' };

const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
type H = { daysAgo: number; by: string; role: string; action: string; note?: string };
const asData = (collections: Record<string, DemoRecord[]>) => ({ collections }) as unknown as IndustryData;

export function buildTyresSeed(today: string) {
  const rnd = prng(20261111);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const { collections, rec, day, line } = seeder(today);
  const dow = (iso: string) => parseIso(iso).getDay();

  const users = [
    user('u_mgr', STAFF.manager.by, 'Branch manager', 'manager', [], [], true),
    user('u_adv', STAFF.advisor.by, 'Counter sales / service advisor', 'advisor', ['dashboard', 'jobs', 'tools', 'stock', 'vehicles', 'customers', 'fleets', 'invoices', 'claims'], ['jobs.manage', 'invoicing', 'customers']),
    user('u_fit', 'Sipho Khumalo', 'Fitment technician', 'fitter', ['dashboard', 'jobs', 'tools', 'stock', 'vehicles'], ['fitment', 'tools.issue']),
    user('u_align', 'Lerato Molefe', 'Alignment technician (senior)', 'aligner', ['dashboard', 'jobs', 'tools', 'stock', 'vehicles'], ['alignment', 'fitment', 'qc', 'tools.issue']),
    user('u_stock', STAFF.stock.by, STAFF.stock.role, 'stock', ['dashboard', 'jobs', 'tools', 'stock', 'claims', 'reports'], ['stock', 'tools.issue', 'tools.calibrate', 'warranty']),
    user('u_fleet', STAFF.fleet.by, STAFF.fleet.role, 'fleetclerk', ['dashboard', 'jobs', 'fleets', 'customers', 'vehicles', 'invoices', 'reports'], ['fleet', 'invoicing', 'customers']),
  ];

  /* ---------- Tyre stock ---------- */
  const stock = STOCK.map(([size, loadIndex, speedRating, brand, pattern, ageDays, qty, cost, sell, reorderLevel, bin], i) =>
    rec('stock', 'STK', { size, loadIndex, speedRating, brand, pattern, dot: dotFromDate(day(-ageDays)), qty, cost, sell, reorderLevel, bin, supplier: SUPPLIERS[i % SUPPLIERS.length] }, { createdDaysAgo: Math.min(400, ageDays) }));
  const stockFor = (size: string) => stock.filter((s) => sameSize(String(s.values.size), size));

  /* ---------- Fleet accounts & customers ---------- */
  const fleets = FLEETS.map(([name, creditLimit, poRequired, contactPerson], i) => rec('fleets', 'FLT', {
    name, creditLimit, poRequired, contactPerson, terms: '30 days from invoice',
    phone: `011 555 ${String(3100 + i * 87).slice(-4)}`, email: `fleet.${name.split(' ')[0].toLowerCase()}@example.com`,
    notes: poRequired ? 'Purchase order number must be quoted on every job (demo rule).' : 'No PO needed — fleet manager approves by phone or email.',
  }, { createdDaysAgo: 900 - i * 40 }));

  const customers = [
    ...RETAIL.map(([name, area], i) => {
      const [first, ...rest] = name.split(' ');
      return rec('customers', 'CUS', {
        name, kind: 'retail', fleet: '', area, preferredContact: pick(['whatsapp', 'phone', 'email']),
        phone: `0${[82, 72, 83, 61, 79, 71][i % 6]} 555 ${String(2000 + i * 53).slice(-4)}`,
        email: `${first.toLowerCase()}.${rest.join('').toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
      }, { createdDaysAgo: 600 - i * 17 });
    }),
    ...fleets.map((f, i) => rec('customers', 'CUS', {
      name: String(f.values.name), kind: 'fleet', fleet: f.id, area: ['Germiston', 'Boksburg', 'Alberton', 'Edenvale', 'Benoni', 'Kempton Park'][i], preferredContact: 'email',
      phone: String(f.values.phone), email: String(f.values.email), contactPerson: String(f.values.contactPerson),
    }, { createdDaysAgo: 880 - i * 40 })),
  ];

  /* ---------- Vehicles ---------- */
  const provinces = ['GP', 'GP', 'GP', 'MP', 'GP', 'NW'];
  const vehicles = VEHICLES.map(([ci, make, model, year, cls, tyreSize, km, sinceRot, kmPerMonth], i) => {
    const c = VEHICLE_CLASSES.find((x) => x.value === cls)!;
    return rec('vehicles', 'VEH', {
      customer: customers[ci].id, reg: `DEMO ${String(211 + i * 29).slice(-3)} ${provinces[i % provinces.length]}`, make, model, year, vehicleClass: cls, tyreSize,
      torqueMin: c.torque[0], torqueMax: c.torque[1], pressureKpa: c.kpa, odometer: Math.round(km - kmPerMonth * 4), lastRotationKm: km - sinceRot, kmPerMonth,
    }, { createdDaysAgo: 500 - i * 9 });
  });
  const kmAt = (vi: number, daysAgo: number) => Math.round(VEHICLES[vi][6] - (VEHICLES[vi][8] * daysAgo) / 30);
  const isFleet = (vi: number) => VEHICLES[vi][0] >= RETAIL.length;
  const fleetIdx = (vi: number) => VEHICLES[vi][0] - RETAIL.length;

  /* ---------- Shared job builders ---------- */
  type Job = {
    vi: number; d: number; status: string; tech: string; bay?: string; qty?: number; stockIdx?: number; reps?: string[];
    svc?: Partial<Record<'balancing' | 'alignment' | 'puncture' | 'nitrogen' | 'rotation', boolean>>;
    arrived: number; ready?: number; treads?: Record<string, number>; torque?: boolean | Record<string, number>; full?: boolean; qc?: boolean | string[];
    po?: boolean; channel?: string; extra?: Values; history?: Array<{ daysAgo: number; by: string; role: string; action: string; note?: string }>;
  };

  const wheelValues = (j: Job, v: DemoRecord): Values => {
    const out: Values = {};
    const reps = j.reps ?? [];
    for (const p of POSITIONS) {
      const t = j.treads?.[p.key] ?? (reps.includes(p.key) ? r1(between(0.7, 2.4)) : r1(between(2.6, 7.2)));
      out[`${p.key}_tread`] = t;
      if (reps.includes(p.key)) out[`${p.key}_replace`] = true;
      if (j.full) {
        out[`${p.key}_size`] = String(v.values.tyreSize);
        out[`${p.key}_dot`] = dotFromDate(day(-(j.d + Math.floor(between(400, 1700)))));
        out[`${p.key}_cond`] = t < 1.6 ? 'worn' : reps.includes(p.key) && rnd() < 0.3 ? 'uneven' : 'good';
        out[`${p.key}_kpa`] = Math.round(Number(v.values.pressureKpa) - between(10, 40));
      }
    }
    if (j.svc?.puncture) out[`${pick(POSITIONS).key}_cond`] = 'puncture';
    const spec = [Number(v.values.torqueMin), Number(v.values.torqueMax)];
    if (j.torque === true) for (const p of POSITIONS) out[`${p.key}_torque`] = Math.round(between(spec[0], spec[1]));
    else if (j.torque) Object.assign(out, Object.fromEntries(Object.entries(j.torque).map(([k, n]) => [`${k}_torque`, n])));
    return out;
  };

  const jobs: Array<{ j: Job; r: DemoRecord }> = [];
  const makeJob = (j: Job) => {
    const v = vehicles[j.vi];
    const fleet = isFleet(j.vi) ? fleets[fleetIdx(j.vi)] : undefined;
    const qty = j.qty ?? 0;
    const st = qty > 0 && j.stockIdx !== undefined ? stock[j.stockIdx] : undefined;
    const values: Values = {
      vehicle: v.id, workDate: day(-j.d), arrivedAt: hm(j.arrived), technician: j.tech, bay: j.bay ?? HOME_BAY[j.tech] ?? '',
      tyresQty: qty, tyreStock: st?.id ?? '', odometer: ['arrived'].includes(j.status) ? '' : kmAt(j.vi, j.d),
      ...Object.fromEntries(Object.entries(j.svc ?? {}).filter(([, b]) => b)),
      fleetPo: fleet && fleet.values.poRequired && j.po !== false ? `PO-DEMO-${FLEETS[fleetIdx(j.vi)][4]}${String(41000 + Math.floor(rnd() * 900))}` : '',
      approvalChannel: j.channel ?? (['arrived', 'inspected', 'quoted'].includes(j.status) ? '' : fleet ? 'email' : pick(['counter', 'counter', 'phone', 'whatsapp'])),
      ...(j.ready ? { readyAt: hm(j.ready) } : {}),
      ...(j.status !== 'arrived' ? wheelValues(j, v) : {}),
      ...(j.qc === true ? Object.fromEntries(QC_ITEMS.map((q) => [q.key, true])) : Array.isArray(j.qc) ? Object.fromEntries(j.qc.map((k) => [k, true])) : {}),
      ...(j.extra ?? {}),
    };
    const r = rec('jobs', 'JOB', values, {
      status: j.status, createdDaysAgo: j.d,
      history: j.history ?? [{ daysAgo: j.d, ...STAFF.advisor, action: 'Vehicle booked in at the counter' }],
    });
    if (!['arrived', 'inspected'].includes(j.status)) r.values.lines = quoteLines(r, asData(collections));
    jobs.push({ j, r });
    return r;
  };

  const invoiceFor = (job: DemoRecord, j: Job, status: string, paidFully: boolean, method: string) => {
    const v = vehicles[j.vi];
    const issuedOn = day(-j.d);
    const ls = (job.values.lines as ReturnType<typeof quoteLines>).map((l) => line(l.description, l.qty, l.unitPrice, l.code));
    const total = ls.reduce((n, l) => n + l.qty * l.unitPrice, 0) * 1.15;
    const fleet = isFleet(j.vi);
    return rec('invoices', 'INV', {
      customer: String(v.values.customer), vehicle: v.id, job: job.id, issuedOn, dueOn: fleet ? day(-j.d + 30) : '', fleetPo: String(job.values.fleetPo ?? ''),
      lines: ls, paid: paidFully ? Math.round(total * 100) / 100 : 0, paymentMethod: paidFully ? method : '', lastPaymentOn: paidFully ? (fleet ? day(Math.min(0, -j.d + 26)) : issuedOn) : '', notes: '',
    }, { status, createdDaysAgo: j.d, history: [
      { daysAgo: j.d, ...STAFF.advisor, action: fleet ? 'Invoice issued on QC pass · put on fleet account (30 days)' : 'Invoice issued on QC pass' },
      ...(paidFully ? [{ daysAgo: fleet ? Math.max(0, j.d - 26) : j.d, ...(fleet ? STAFF.fleet : STAFF.advisor), action: 'Payment recorded (simulated)' }] : []),
    ] });
  };

  /* ---------- Three months of history ---------- */
  const regulars = VEHICLES.map((_, i) => i);
  const plans: Job[] = [];
  for (let d = 91; d >= 1; d--) {
    const w = dow(day(-d));
    if (w === 0) continue;
    const n = w === 6 ? 1 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 3);
    let clock = 7 * 60 + 35 + Math.floor(rnd() * 40);
    for (let k = 0; k < n; k++) {
      const vi = pick(regulars);
      const size = VEHICLES[vi][5];
      const options = stockFor(size);
      const x = rnd();
      let j: Job;
      const tch = pick(['sk', 'jv', 'np', 'md']);
      if (x < 0.42 && options.length) {
        const qty = rnd() < 0.55 ? 2 : 4;
        const reps = qty === 4 ? ['lf', 'rf', 'lr', 'rr'] : rnd() < 0.6 ? ['lf', 'rf'] : ['lr', 'rr'];
        const align = rnd() < 0.4;
        j = { vi, d, status: 'collected', tech: tch, qty, stockIdx: stock.indexOf(pick(options)), reps, svc: { balancing: true, alignment: align, nitrogen: rnd() < 0.2 }, arrived: clock, ready: clock + 18 + qty * 6 + (align ? 22 : 0) + Math.floor(rnd() * 14) };
      } else if (x < 0.62) {
        j = { vi, d, status: 'collected', tech: tch, svc: { puncture: true, balancing: rnd() < 0.3 }, arrived: clock, ready: clock + 16 + Math.floor(rnd() * 15) };
      } else if (x < 0.77) {
        j = { vi, d, status: 'collected', tech: 'lm', svc: { alignment: true }, arrived: clock, ready: clock + 28 + Math.floor(rnd() * 20) };
      } else if (x < 0.88) {
        j = { vi, d, status: 'collected', tech: tch, svc: { balancing: true, rotation: true }, arrived: clock, ready: clock + 25 + Math.floor(rnd() * 15) };
      } else if (x < 0.95 && options.length) {
        j = { vi, d, status: 'collected', tech: tch, qty: 1, stockIdx: stock.indexOf(pick(options)), reps: [pick(['lf', 'rf', 'lr', 'rr'])], svc: { balancing: true }, arrived: clock, ready: clock + 22 + Math.floor(rnd() * 12) };
      } else if (options.length) {
        j = { vi, d, status: 'declined', tech: tch, qty: 4, stockIdx: stock.indexOf(pick(options)), reps: ['lf', 'rf', 'lr', 'rr'], arrived: clock };
      } else {
        j = { vi, d, status: 'collected', tech: tch, svc: { puncture: true }, arrived: clock, ready: clock + 18 };
      }
      plans.push(j);
      clock += 35 + Math.floor(rnd() * 70);
    }
  }

  for (const j of plans) {
    j.torque = j.status === 'collected';
    j.qc = j.status === 'collected';
    const t = tech(j.tech);
    const ready = j.ready ? hm(j.ready) : '';
    j.history = j.status === 'declined'
      ? [{ daysAgo: j.d, ...STAFF.advisor, action: 'Record customer decline', note: pick(['Customer will compare prices and come back.', 'Customer declined — budget this month. Advised on tread depth.', 'Fleet manager declined by email — replacing at month end.']) }]
      : [{ daysAgo: j.d, ...t, action: `Torque check recorded · handed over (ready ${ready})` }];
    j.extra = { collectedAt: j.ready ? hm(j.ready + 5) : '', torqueToolAsset: j.status === 'collected' ? (j.tech === 'lm' ? 'TR-TW-04' : pick(['TR-TW-01', 'TR-TW-02', 'TR-TW-05'])) : '' };
    const job = makeJob(j);
    const v = vehicles[j.vi];
    if (j.status === 'collected') {
      v.values.odometer = Math.max(Number(v.values.odometer), Number(job.values.odometer));
      if (isFleet(j.vi)) {
        const overdue = j.d > 30 && rnd() < 0.08;
        invoiceFor(job, j, j.d > 30 && !overdue ? 'paid' : 'onaccount', j.d > 30 && !overdue, 'remittance');
      } else invoiceFor(job, j, 'paid', true, pick(['card', 'card', 'cash', 'eft']));
      delete job.values.lines; // the invoice carries the lines for historic jobs
    }
  }

  /* ---------- Today on the bay queue ---------- */
  const s = (size: string, brand: string) => stock.findIndex((x) => x.values.size === size && x.values.brand === brand);
  const T = (j: Omit<Job, 'd'>) => makeJob({ d: 0, full: true, ...j });
  const advH = (action: string, note?: string): H => ({ daysAgo: 0, ...STAFF.advisor, action, note });
  const tH = (k: string, action: string, note?: string): H => ({ daysAgo: 0, ...tech(k), action, note });
  const flow = (k: string, upTo: number, extra: H[] = []): H[] => [
    advH('Vehicle booked in at the counter'),
    ...(upTo >= 1 ? [tH(k, 'Record inspection')] : []),
    ...(upTo >= 2 ? [advH('Quote sent to customer')] : []),
    ...(upTo >= 3 ? [advH('Record customer approval')] : []),
    ...(upTo >= 4 ? [tH(k, 'Start fitting')] : []),
    ...extra,
  ];

  const today1 = T({ vi: 0, status: 'collected', tech: 'sk', qty: 4, stockIdx: s('205/55R16', 'highveld'), reps: ['lf', 'rf', 'lr', 'rr'], svc: { balancing: true, nitrogen: true }, arrived: 7 * 60 + 32, ready: 8 * 60 + 14, torque: true, qc: true, extra: { collectedAt: '08:20', torqueToolAsset: 'TR-TW-01' }, history: flow('sk', 4, [tH('sk', 'Start torque check'), { daysAgo: 0, ...tech('lm'), action: 'QC passed — ready' }, advH('Handed over to customer')]) });
  const today2 = T({ vi: 19, status: 'collected', tech: 'jv', svc: { puncture: true }, arrived: 7 * 60 + 41, ready: 8 * 60 + 2, torque: true, qc: true, extra: { collectedAt: '08:05', torqueToolAsset: 'TR-TW-02' }, history: flow('jv', 4, [advH('Handed over to customer')]) });
  const today3 = T({ vi: 13, status: 'ready', tech: 'md', bay: 'align', qty: 2, stockIdx: s('225/45R17', 'duneline'), reps: ['lr', 'rr'], svc: { balancing: true, alignment: true }, arrived: 8 * 60 + 5, ready: 9 * 60 + 2, torque: true, qc: true,
    extra: { fitBay: 'b4', torqueToolAsset: 'TR-TW-05', al_before_ftoe: 2.6, al_before_fcam: -1.9, al_before_rtoe: 1.4, al_before_rcam: -1.6, al_after_ftoe: 0.2, al_after_fcam: -0.8, al_after_rtoe: 0.1, al_after_rcam: -1.1 },
    history: flow('md', 4, [tH('md', 'Balancing complete'), { daysAgo: 0, ...tech('lm'), action: 'Alignment complete' }, { daysAgo: 0, ...tech('lm'), action: 'QC passed — ready' }]) });
  const today4 = T({ vi: 24, status: 'ready', tech: 'np', qty: 2, stockIdx: s('265/65R17', 'stormberg'), reps: ['lf', 'rf'], svc: { balancing: true }, arrived: 8 * 60 + 10, ready: 8 * 60 + 58, torque: true, qc: true, channel: 'email', extra: { torqueToolAsset: 'TR-TW-05' }, history: flow('np', 4, [{ daysAgo: 0, ...tech('lm'), action: 'QC passed — ready' }]) });
  T({ vi: 4, status: 'torque', tech: 'sk', qty: 2, stockIdx: s('185/65R15', 'veldtrek'), reps: ['lf', 'rf'], svc: { balancing: true }, arrived: 8 * 60 + 31, torque: { lf: 115, rf: 116, lr: 113, rr: 118 }, qc: ['qcRetorque', 'qcPressure'], history: flow('sk', 4, [tH('sk', 'Balancing complete'), tH('sk', 'Start torque check')]) });
  T({ vi: 11, status: 'torque', tech: 'md', qty: 4, stockIdx: s('265/65R17', 'veldtrek'), reps: ['lf', 'rf', 'lr', 'rr'], svc: { balancing: true }, arrived: 8 * 60 + 50, torque: { lf: 150, rf: 148 }, history: flow('md', 4, [tH('md', 'Balancing complete')]),
    treads: { lf: 1.8, rf: 2.0, lr: 0.9, rr: 1.1 } });
  T({ vi: 7, status: 'alignment', tech: 'lm', bay: 'align', svc: { alignment: true, rotation: true }, arrived: 9 * 60 + 2,
    extra: { al_before_ftoe: 2.4, al_before_fcam: -1.9, al_before_rtoe: 0.6, al_before_rcam: -1.2 }, history: flow('lm', 4) });
  T({ vi: 10, status: 'balancing', tech: 'jv', qty: 4, stockIdx: s('205/55R16', 'duneline'), reps: ['lf', 'rf', 'lr', 'rr'], svc: { balancing: true }, arrived: 9 * 60 + 5, history: flow('jv', 4) });
  T({ vi: 26, status: 'fitting', tech: 'np', qty: 2, stockIdx: s('185/65R15', 'veldtrek'), reps: ['lr', 'rr'], svc: { balancing: true, nitrogen: true }, arrived: 9 * 60 + 20, history: flow('np', 4) });
  T({ vi: 5, status: 'approved', tech: 'sk', bay: '', qty: 4, stockIdx: s('265/60R18', 'stormberg'), reps: ['lf', 'rf', 'lr', 'rr'], svc: { balancing: true, alignment: true }, arrived: 9 * 60 + 34, channel: 'counter', history: flow('sk', 3) });
  T({ vi: 20, status: 'quoted', tech: 'jv', bay: '', qty: 2, stockIdx: s('245/70R16', 'veldtrek'), reps: ['lr', 'rr'], svc: { balancing: true }, arrived: 9 * 60 + 40, po: false, history: flow('jv', 2) });
  T({ vi: 8, status: 'quoted', tech: 'np', bay: '', qty: 4, stockIdx: s('215/60R16', 'karoo'), reps: ['lf', 'rf', 'lr', 'rr'], svc: { balancing: true, alignment: true }, arrived: 9 * 60 + 48, history: flow('np', 2) });
  T({ vi: 1, status: 'inspected', tech: 'sk', bay: '', arrived: 9 * 60 + 55, treads: { lf: 0.8, rf: 2.6, lr: 3.9, rr: 4.1 }, history: flow('sk', 1),
    extra: { sp_tread: 5.5, sp_size: '185/60R15', sp_cond: 'good' } });
  T({ vi: 14, status: 'arrived', tech: '', bay: '', arrived: 10 * 60 + 5, history: [advH('Vehicle booked in at the counter')] });
  T({ vi: 16, status: 'declined', tech: 'md', bay: '', qty: 4, stockIdx: s('225/45R17', 'duneline'), reps: ['lf', 'rf', 'lr', 'rr'], arrived: 7 * 60 + 50,
    history: [...flow('md', 2), advH('Record customer decline', 'Customer declined in person — will replace next month. Advised LF/RF are close to the limit.')] });

  // Today's finished jobs get invoices: retail paid, fleet on account, two ready jobs still open.
  invoiceFor(today1, jobs.find((x) => x.r === today1)!.j, 'paid', true, 'card');
  invoiceFor(today2, jobs.find((x) => x.r === today2)!.j, 'onaccount', false, '');
  invoiceFor(today3, jobs.find((x) => x.r === today3)!.j, 'issued', false, '');
  invoiceFor(today4, jobs.find((x) => x.r === today4)!.j, 'issued', false, '');
  vehicles[0].values.odometer = Number(today1.values.odometer);
  vehicles[19].values.odometer = Number(today2.values.odometer);

  /* ---------- Tools & equipment ---------- */
  type ToolSeed = [string, string, string, string, number, number, number | null, number, string, string, Values?];
  // asset, type, description, location, rangeMin, rangeMax, calibration due (days from today, null = n/a), service due (days), condition, status, extra
  const TOOLS: ToolSeed[] = [
    ['TR-TW-01', 'torque', 'Click torque wrench ½" 40–200 Nm (Fulcrum, fictional)', 'b1', 40, 200, 118, 118, 'good', 'checkedout', { holder: 'sk', checkedOutOn: day(0), checkedOutAt: '07:30', checkouts: 61, hoursOut: 468 }],
    ['TR-TW-02', 'torque', 'Click torque wrench ½" 40–200 Nm (Fulcrum, fictional)', 'b2', 40, 200, 64, 64, 'good', 'checkedout', { holder: 'jv', checkedOutOn: day(-1), checkedOutAt: '15:40', checkouts: 58, hoursOut: 441 }],
    ['TR-TW-03', 'torque', 'Dial torque wrench ½" 40–200 Nm (Brakpan Tools, fictional)', 'store', 40, 200, -12, 40, 'fair', 'available', { checkouts: 33, hoursOut: 240, notes: 'Calibration lapsed — booked with the calibration lab (fictional).' }],
    ['TR-TW-04', 'torque', 'Click torque wrench ¾" 60–340 Nm (Fulcrum, fictional)', 'align', 60, 340, 9, 9, 'good', 'checkedout', { holder: 'lm', checkedOutOn: day(0), checkedOutAt: '07:45', checkouts: 47, hoursOut: 372 }],
    ['TR-TW-05', 'torque', 'Click torque wrench ¾" 60–340 Nm (Fulcrum, fictional)', 'store', 60, 340, 151, 151, 'good', 'available', { checkouts: 52, hoursOut: 398 }],
    ['TR-IW-01', 'impact', 'Air impact wrench ½" (Hammerhead, fictional)', 'b1', 0, 0, null, 70, 'good', 'checkedout', { holder: 'sk', checkedOutOn: day(0), checkedOutAt: '07:31', checkouts: 70, hoursOut: 512 }],
    ['TR-IW-02', 'impact', 'Air impact wrench ½" (Hammerhead, fictional)', 'b2', 0, 0, null, 35, 'good', 'checkedout', { holder: 'jv', checkedOutOn: day(0), checkedOutAt: '07:36', checkouts: 66, hoursOut: 489 }],
    ['TR-IW-03', 'impact', 'Cordless impact wrench 18 V (Hammerhead, fictional)', 'b3', 0, 0, null, 120, 'good', 'checkedout', { holder: 'np', checkedOutOn: day(0), checkedOutAt: '07:40', checkouts: 59, hoursOut: 430 }],
    ['TR-IW-04', 'impact', 'Air impact wrench ¾" (Hammerhead, fictional)', 'store', 0, 0, null, -2, 'poor', 'calibration', { checkouts: 41, hoursOut: 301, notes: 'Anvil worn — sent for repair (fictional workshop).' }],
    ['TR-TC-01', 'changer', 'Tyre changer, swing-arm (Rimtech 900, fictional)', 'b1', 0, 0, null, 88, 'good', 'available', { checkouts: 0, hoursOut: 0 }],
    ['TR-TC-02', 'changer', 'Tyre changer, swing-arm (Rimtech 900, fictional)', 'b2', 0, 0, null, 88, 'good', 'available', { checkouts: 0, hoursOut: 0 }],
    ['TR-TC-03', 'changer', 'Tyre changer, leverless (Rimtech 1200, fictional)', 'b3', 0, 0, null, 145, 'good', 'available', { checkouts: 0, hoursOut: 0 }],
    ['TR-TC-04', 'changer', 'Tyre changer, swing-arm (Rimtech 900, fictional)', 'b4', 0, 0, null, 12, 'poor', 'available', { checkouts: 0, hoursOut: 0, notes: 'Bead breaker slow — service booked.' }],
    ['TR-WB-01', 'balancer', 'Wheel balancer (Equilibra 50, fictional)', 'b1', 0, 0, 132, 132, 'good', 'available', { checkouts: 0, hoursOut: 0 }],
    ['TR-WB-02', 'balancer', 'Wheel balancer (Equilibra 50, fictional)', 'b3', 0, 0, 5, 5, 'good', 'available', { checkouts: 0, hoursOut: 0 }],
    ['TR-AM-01', 'aligner', '3D wheel aligner (TrueLine 3D, fictional)', 'align', 0, 0, 204, 204, 'good', 'available', { checkouts: 0, hoursOut: 0 }],
    ['TR-TJ-01', 'jack', 'Trolley jack 3 t (Liftwell, fictional)', 'b1', 0, 0, null, 190, 'good', 'available', { checkouts: 0, hoursOut: 0 }],
    ['TR-TJ-02', 'jack', 'Trolley jack 3 t (Liftwell, fictional)', 'b2', 0, 0, null, 190, 'good', 'available', { checkouts: 0, hoursOut: 0 }],
    ['TR-TJ-03', 'jack', 'Trolley jack 3 t (Liftwell, fictional)', 'store', 0, 0, null, 190, 'poor', 'outofservice', { checkouts: 0, hoursOut: 0, notes: 'Hydraulic leak — tagged out of service.' }],
    ['TR-TJ-04', 'jack', 'Trolley jack 2 t low-profile (Liftwell, fictional)', 'b4', 0, 0, null, 160, 'good', 'missing', { checkouts: 9, hoursOut: 61, notes: 'Not found at Friday tool count.' }],
    ['TR-NG-01', 'nitrogen', 'Nitrogen generator & inflation cage (PureFill, fictional)', 'b2', 0, 0, null, -3, 'fair', 'available', { checkouts: 0, hoursOut: 0 }],
    ['TR-TP-01', 'tpms', 'TPMS activation & programming tool (SensorPro, fictional)', 'store', 0, 0, 77, 77, 'good', 'available', { checkouts: 23, hoursOut: 31 }],
  ];
  for (const [assetNo, toolType, description, location, rangeMin, rangeMax, cal, svc, condition, status, extra] of TOOLS) {
    const holder = String(extra?.holder ?? '');
    rec('tools', 'TL', {
      assetNo, toolType, description, location, rangeMin: rangeMin || '', rangeMax: rangeMax || '',
      calibrationDue: cal === null ? '' : day(cal), lastCalibrated: cal === null ? '' : day(cal - (toolType === 'torque' ? 182 : 365)),
      serviceDue: day(svc), condition, holder, checkedOutOn: '', checkedOutAt: '', lastHolder: '', checkouts: 0, hoursOut: 0, notes: '', ...(extra ?? {}),
    }, { status, createdDaysAgo: 700, history: [
      { daysAgo: 700, ...STAFF.stock, action: 'Added to tool register' },
      ...(status === 'checkedout' ? [{ daysAgo: String(extra?.checkedOutOn) === day(-1) ? 1 : 0, ...tech(holder), action: `Checked out to ${TECHNICIANS.find((t) => t.value === holder)?.label}` }] : []),
      ...(status === 'outofservice' || status === 'missing' || status === 'calibration' ? [{ daysAgo: 2, ...STAFF.stock, action: status === 'missing' ? 'Reported missing' : status === 'calibration' ? 'Sent for calibration / repair' : 'Taken out of service', note: String(extra?.notes ?? '') }] : []),
    ] });
  }

  /* ---------- Warranty & tyre claims ---------- */
  // vehicle idx, stock idx (by size/brand), logged days ago, status, tread remaining, damage, credit %
  const CLAIMS: Array<[number, string, string, number, string, number | null, string, number | null]> = [
    [3, '265/65R17', 'stormberg', 4, 'logged', null, '', null],
    [17, '215/55R17', 'duneline', 27, 'logged', null, '', null],
    [10, '205/55R16', 'highveld', 9, 'inspected', 6.1, 'bulge', null],
    [22, '185/60R15', 'highveld', 12, 'inspected', 3.2, 'impact', null],
    [19, '195/70R15C', 'stormberg', 15, 'sent', 5.4, 'separation', null],
    [27, '245/70R16', 'stormberg', 33, 'sent', 4.8, 'irregular', null],
    [12, '185/65R15', 'karoo', 18, 'sent', 6.6, 'bead', null],
    [0, '205/55R16', 'duneline', 46, 'approved', 5.9, 'separation', 70],
    [28, '215/70R15C', 'stormberg', 58, 'approved', 4.0, 'bulge', 43],
    [7, '225/65R17', 'karoo', 40, 'rejected', 2.1, 'runflat', null],
  ];
  for (const [vi, size, brand, ago, status, rem, dmg, credit] of CLAIMS) {
    const st = stock[s(size, brand)];
    const v = vehicles[vi];
    const hist: H[] = [{ daysAgo: ago, ...STAFF.advisor, action: 'Claim logged at the counter' }];
    if (status !== 'logged') hist.push({ daysAgo: Math.max(0, ago - 2), ...STAFF.stock, action: 'Casing inspected' });
    if (['sent', 'approved', 'rejected'].includes(status) && status !== 'rejected') hist.push({ daysAgo: Math.max(0, ago - 4), ...STAFF.stock, action: 'Sent to supplier (simulated)' });
    if (status === 'approved') hist.push({ daysAgo: Math.max(0, ago - 20), ...STAFF.stock, action: 'Supplier approved credit' });
    if (status === 'rejected') hist.push({ daysAgo: Math.max(0, ago - 3), ...STAFF.stock, action: 'Reject claim', note: 'Casing shows run-flat damage (crushed sidewall) — not a manufacturing defect.' });
    rec('claims', 'WC', {
      customer: String(v.values.customer), vehicle: v.id, stock: st.id, dot: String(st.values.dot), purchasedOn: day(-(ago + 200 + vi * 7)),
      loggedOn: day(-ago), originalTread: 8, treadRemaining: rem ?? '', damageType: dmg, supplier: String(st.values.supplier),
      sentOn: ['sent', 'approved'].includes(status) ? day(-Math.max(0, ago - 4)) : '', creditPct: credit ?? '', decisionOn: ['approved', 'rejected'].includes(status) ? day(-Math.max(0, ago - 20)) : '',
      complaint: pick(['Bulge on outer sidewall, no impact marks according to customer.', 'Vibration at 100 km/h; tread lifting at the shoulder.', 'Uneven wear on new tyre within 8,000 km.', 'Slow leak at bead on new tyre.']),
    }, { status, createdDaysAgo: ago, history: hist });
  }

  return { users, collections, currentUserId: 'u_mgr' };
}
