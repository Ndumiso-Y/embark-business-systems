// Fictional seed data for the shopping-centre demo. Every tenant, shop, person, contractor,
// reference number and amount is invented. Dates are relative to `today` so the demo always
// looks current, and a small PRNG keeps every reset identical. Nothing here depends on the
// day of the week, so record ids are the same on every day.
import { seeder, user } from '../../core/seed';
import { addDays } from '../../core/lib/dates';
import type { DemoRecord, IndustryData, Line, Values } from '../../core/types';
import { linesTotals, num, str } from '../../core/engine';
import { ELEC_TARIFF, VAT_RATE, WATER_TARIFF } from './data';
import { addMonths, buildInvoice, periodEnd, periodOf, periodStart, round2, turnoverRent } from './helpers';

/** Small deterministic PRNG (same generator as the optometry seed). */
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

const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]+/g, '').slice(0, 22);

type Opt = {
  /** Lease state for a let unit (default trading), or the unit's own state when not let. */
  st?: 'renewal' | 'notice' | 'vacant' | 'offer' | 'fitout';
  /** Turnover clause % and the rent-to-sales ratio (%) used to generate declared turnover. */
  tp?: number; ratio?: number;
  /** Months since the lease started (default: generated, never a whole number of years). */
  sm?: number;
  /** Months until the lease ends (default: a five- or ten-year term). */
  endIn?: number;
  water?: boolean;
  /** Asking rent and days vacant for units without a trading tenant. */
  ask?: number; vacantDays?: number;
  /** The anniversary falls this month and has not been applied yet. */
  escDue?: boolean;
  /** Unpaid months, newest = 1 (e.g. [3, 2, 1]), and part-paid months with the share paid. */
  unpaid?: number[]; part?: Record<number, number>;
  insExpired?: boolean;
};
type UnitRow = [shop: string, level: string, gla: number, category: string, tenant: string, rent: number, opt?: Opt];

const UNITS: UnitRow[] = [
  // Lower mall
  ['L01', 'lower', 5200, 'grocery', 'FreshHarbour Market', 118, { tp: 1.75, ratio: 1.66, sm: 82, water: true }],
  ['L02', 'lower', 180, 'services', 'ParcelPier Couriers', 345],
  ['L03', 'lower', 95, 'services', 'QuickStitch Alterations', 390, { endIn: 2 }],
  ['L04', 'lower', 420, 'health', 'Dockside Pharmacy & Wellness', 310, { water: true }],
  ['L05', 'lower', 880, 'fashion', 'Tidewater Sports', 205],
  ['L06', 'lower', 2400, 'home', 'Homestead & Hearth', 148, { sm: 67 }],
  ['L07', 'lower', 140, 'services', 'Harbour Travel Desk', 360, { st: 'notice', endIn: 3 }],
  ['L08', 'lower', 260, 'electronics', 'Signal Cove Mobile', 430, { unpaid: [1] }],
  ['L09', 'lower', 140, 'fashion', '', 0, { st: 'vacant', ask: 365, vacantDays: -1 }],
  ['L10', 'lower', 310, 'home', 'Kettle & Clay', 265, { unpaid: [2], part: { 3: 0.5 } }],
  ['L11', 'lower', 120, 'services', 'KeyCraft Locksmiths', 385],
  ['L12', 'lower', 240, 'home', '', 0, { st: 'offer', ask: 270, vacantDays: 95 }],
  ['L13', 'lower', 520, 'fashion', 'Maple Row Menswear', 255],
  ['L14', 'lower', 210, 'services', 'Tidy Paws Pet Supplies', 320, { sm: 48, escDue: true }],
  ['L15', 'lower', 330, 'fashion', 'Stride Footwear Studio', 330, { tp: 7, ratio: 11 }],
  ['L16', 'lower', 160, 'services', 'Harbourside Dry Cleaners', 350, { st: 'renewal', endIn: -1, water: true }],
  // Ground level
  ['G01', 'ground', 4200, 'department', 'Marlow & Finch', 98, { tp: 2.5, ratio: 2.9, sm: 82 }],
  ['G02', 'ground', 1450, 'department', 'Kite & Anchor Outfitters', 175, { tp: 5, ratio: 7.5, sm: 55 }],
  ['G03', 'ground', 1200, 'electronics', 'Volt Lane Electronics', 190, { sm: 31 }],
  ['G04', 'ground', 380, 'fashion', 'Indigo Reef', 345, { tp: 7, ratio: 6.1 }],
  ['G05', 'ground', 290, 'fashion', 'Saffron Thread', 360, { tp: 7, ratio: 12, sm: 24, escDue: true }],
  ['G06', 'ground', 410, 'fashion', 'Northwind Denim', 335, { tp: 6.5, ratio: 9.5, part: { 1: 0.6 } }],
  ['G07', 'ground', 260, 'fashion', 'Coral & Co', 370, { tp: 7, ratio: 10.5 }],
  ['G08', 'ground', 350, 'fashion', 'Velvet Compass', 340, { tp: 7, ratio: 13.5, unpaid: [2, 1] }],
  ['G09', 'ground', 300, 'fashion', '', 0, { st: 'fitout', ask: 350, vacantDays: 120 }],
  ['G10', 'ground', 310, 'fashion', 'Juniper Lane', 355, { tp: 7, ratio: 11.5 }],
  ['G11', 'ground', 275, 'fashion', 'Urban Tern', 365, { tp: 7, ratio: 9, st: 'renewal', endIn: 1 }],
  ['G12', 'ground', 240, 'fashion', 'Salt & Silk', 375, { tp: 7, ratio: 19.2 }],
  ['G13', 'ground', 180, 'health', 'Lumen Skin Bar', 440, { endIn: 5 }],
  ['G14', 'ground', 620, 'home', '', 0, { st: 'vacant', ask: 240, vacantDays: 160 }],
  ['G15', 'ground', 150, 'health', 'Clipper & Comb Barbers', 420, { water: true }],
  ['G16', 'ground', 210, 'health', 'Glow & Gather Salon', 410, { water: true, insExpired: true }],
  ['G17', 'ground', 190, 'health', 'Seabreeze Optical Studio', 430, { sm: 8 }],
  ['G18', 'ground', 130, 'electronics', '', 0, { st: 'offer', ask: 420, vacantDays: 60 }],
  ['G19', 'ground', 340, 'electronics', 'ByteHarbour Gaming', 380],
  ['G20', 'ground', 280, 'home', 'Linen Lighthouse', 285, { sm: 14 }],
  ['G21', 'ground', 220, 'services', 'Dog-Ear Books', 300],
  ['G22', 'ground', 260, 'services', 'Toy Tide', 315],
  // Upper level
  ['U01', 'upper', 3600, 'entertainment', 'PixelPier Cinemas', 92, { sm: 82, water: true }],
  ['U02', 'upper', 2600, 'department', 'Harbour Home & Living', 150, { sm: 43 }],
  ['U03', 'upper', 1400, 'entertainment', 'Jump Jetty Trampoline Park', 120],
  ['U04', 'upper', 1500, 'entertainment', 'Anchor Fitness Club', 110, { water: true }],
  ['U05', 'upper', 420, 'restaurant', 'The Copper Skillet', 300, { tp: 8, ratio: 17.4, water: true, unpaid: [3, 2, 1], part: { 4: 0.4 } }],
  ['U06', 'upper', 360, 'fashion', '', 0, { st: 'fitout', ask: 340, vacantDays: 140 }],
  ['U07', 'upper', 380, 'restaurant', 'Mama Zodwa’s Kitchen', 310, { tp: 8, ratio: 9.5, water: true }],
  ['U08', 'upper', 450, 'restaurant', 'Basil & Ember Pizzeria', 295, { tp: 8, ratio: 8.8, water: true }],
  ['U09', 'upper', 520, 'restaurant', 'Blue Mussel Seafood', 285, { tp: 8, ratio: 10.5, water: true }],
  ['U10', 'upper', 480, 'restaurant', 'Karoo Flame Grill', 290, { tp: 8, ratio: 7.6, water: true }],
  ['U11', 'upper', 310, 'fashion', '', 0, { st: 'vacant', ask: 330, vacantDays: 215 }],
  ['U12', 'upper', 170, 'health', 'Petal Nail Lounge', 415, { water: true, unpaid: [1] }],
  ['U13', 'upper', 240, 'services', 'Harbour Print & Copy', 325, { endIn: 4 }],
  ['U14', 'upper', 200, 'electronics', 'Lens & Shutter Camera House', 395, { sm: 3 }],
  // Food court
  ['F01', 'food', 85, 'food', 'Wok Harbour', 690, { tp: 9, ratio: 8.2, water: true, part: { 1: 0.6 } }],
  ['F02', 'food', 78, 'food', 'Bunny Chow Bros', 705, { tp: 9, ratio: 10, water: true, sm: 36, escDue: true }],
  ['F03', 'food', 90, 'food', 'Peri Dock Chicken', 680, { tp: 9, ratio: 7, water: true }],
  ['F04', 'food', 72, 'food', 'Sushi Skiff', 720, { tp: 9, ratio: 11, water: true, unpaid: [1] }],
  ['F05', 'food', 88, 'food', 'Burger Buoy', 695, { tp: 9, ratio: 9.6, water: true }],
  ['F06', 'food', 75, 'food', 'Shawarma Quay', 710, { tp: 9, ratio: 10.4, water: true, endIn: 6 }],
  ['F07', 'food', 60, 'food', 'Sweet Anchor Ice Cream', 760, { tp: 9, ratio: 12, water: true }],
  ['F08', 'food', 95, 'food', 'Second Tide Coffee', 670, { tp: 9, ratio: 8.6, water: true }],
  // Kiosks & pads
  ['K01', 'kiosk', 12, 'kiosk', 'PhoneSkin Kiosk', 1650],
  ['K02', 'kiosk', 10, 'kiosk', 'Sugar Drift Candy Cart', 1800],
  ['K03', 'kiosk', 14, 'kiosk', 'Shades Ahoy', 1550, { st: 'notice', endIn: 2 }],
  ['K04', 'kiosk', 12, 'kiosk', 'Juice Jetty', 1700, { water: true }],
  ['K05', 'kiosk', 12, 'kiosk', '', 0, { st: 'vacant', ask: 1600, vacantDays: 35 }],
  ['K06', 'kiosk', 15, 'kiosk', 'Popcorn Pier', 1500, { sm: 5 }],
];

const FIRST = ['Thabo', 'Aisha', 'Johan', 'Nomsa', 'Priya', 'Sibusiso', 'Elmarie', 'Farid', 'Lerato', 'Gareth', 'Zinhle', 'Riaan', 'Naledi', 'Imran', 'Chantal', 'Mandla', 'Yusuf', 'Karabo', 'Anika', 'Dumisani'];
const LAST = ['Mahlangu', 'Pillay', 'Botha', 'Zulu', 'Naidoo', 'Mokoena', 'Fourie', 'Khan', 'Molefe', 'Adams', 'Ndlovu', 'Venter', 'Sithebe', 'Patel', 'Jacobs', 'Dube', 'Abrahams', 'Maseko', 'Steyn', 'Mthembu'];
const CODES = ['021', '031', '041', '011'];

/** kWh per m² per month, by category (illustrative). */
const KWH: Record<string, number> = { grocery: 34, department: 11, fashion: 13, health: 16, electronics: 15, home: 10, services: 14, restaurant: 40, food: 58, entertainment: 12, kiosk: 45 };

export function buildMallSeed(today: string): Pick<IndustryData, 'users' | 'collections' | 'currentUserId'> {
  const rnd = prng(20261112);
  const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const { collections, rec, day } = seeder(today);
  const P = periodOf(today);
  /** First day of the month `n` months from this one. */
  const mStart = (n: number) => periodStart(addMonths(P, n));
  const mEnd = (n: number) => periodEnd(addMonths(P, n));
  const notAfterToday = (iso: string) => (iso > today ? today : iso);
  const quiet = { history: [] as never[] };
  const dataLike = { collections } as unknown as IndustryData;

  const users = [
    user('u_cm', 'Zanele Mokoena', 'Centre manager', 'centre', [], [], true),
    user('u_lm', 'Pieter van der Walt', 'Leasing manager', 'leasing', ['dashboard', 'units', 'leases', 'pipeline', 'turnover', 'fitouts', 'reports'], ['leases.manage', 'leases.approve']),
    user('u_la', 'Ayanda Cele', 'Leasing administrator', 'leasingadmin', ['dashboard', 'units', 'leases', 'pipeline'], ['leases.manage']),
    user('u_ops', 'Rajesh Naidoo', 'Operations manager', 'operations', ['dashboard', 'units', 'meters', 'workorders', 'fitouts', 'permits', 'ops', 'incidents', 'reports'], ['meters', 'maintenance', 'fitout.manage', 'fitout.signoff', 'permits.issue', 'ops.log', 'incidents']),
    user('u_tc', 'Lindiwe Khoza', 'Tenant coordinator', 'coordinator', ['dashboard', 'units', 'leases', 'fitouts', 'permits', 'workorders'], ['fitout.manage', 'permits.issue', 'maintenance']),
    user('u_acc', 'Michelle Jacobs', 'Credit controller', 'accounts', ['dashboard', 'units', 'leases', 'billing', 'arrears', 'turnover', 'meters', 'reports'], ['billing', 'credit.control', 'turnover.verify']),
    user('u_mkt', 'Kagiso Molefe', 'Marketing manager', 'marketing', ['dashboard', 'bookings', 'marketing', 'ops', 'reports'], ['marketing']),
    user('u_sec', 'Bongani Sithole', 'Security & risk supervisor', 'security', ['dashboard', 'ops', 'incidents', 'permits', 'workorders'], ['incidents', 'ops.log']),
  ];

  /* ---------------- Units ---------------- */
  const unitId: Record<string, string> = {};
  const rowOf: Record<string, UnitRow> = {};
  for (const row of UNITS) {
    const [shop, level, gla, category, tenant, , o = {}] = row;
    const state = tenant ? 'let' : o.st ?? 'vacant';
    const vacantSince = tenant ? undefined : o.vacantDays === -1 ? mStart(-3) : day(-(o.vacantDays ?? 30));
    const v: Values = { shop, level, gla, category, askingRent: o.ask ?? row[5] };
    if (o.water) v.waterMeter = true;
    if (vacantSince) v.vacantSince = vacantSince;
    const u = rec('units', 'SH', v, { status: state, createdDaysAgo: 400, ...quiet });
    unitId[shop] = u.id;
    rowOf[shop] = row;
  }
  const unitRec = (shop: string) => collections.units.find((u) => u.id === unitId[shop])!;

  /* ---------------- Leases ---------------- */
  const person = () => `${pick(FIRST)} ${pick(LAST)}`;
  const phone = () => `${pick(CODES)} 555 ${String(int(100, 9899)).padStart(4, '0')}`;
  const contactOf = (tenant: string): Values => ({ contact: person(), phone: phone(), email: `${slug(tenant)}@example.com` });
  const HOURS = 'Centre trading hours';
  let coo = 300;
  const secured = (monthlyBase: number, anchor = false): Values => ({
    creditCheck: 'approved', depositType: anchor ? 'guarantee' : 'cash', depositAmount: Math.round((monthlyBase * 2) / 500) * 500, depositRef: `DEMO-${anchor ? 'BG' : 'DEP'}-${++coo}`, depositReceived: true, fica: true,
  });

  // Guided and pre-trading leases first, so their ids never change.
  const g14 = rowOf.G14;
  rec('leases', 'LS', { // leases_1 — guide step 1: a large vacant shop, nothing checked yet
    unit: unitId.G14, tenant: 'Paper Lantern Stationers', entity: 'Paper Lantern Trading (Pty) Ltd', contact: 'Refilwe Tau', phone: '021 555 0164', email: 'refilwe@paperlantern.example.com',
    category: 'home', baseRent: g14[6]!.ask!, escalationPct: 7, turnoverPct: 0, opsRate: 62, mktRate: 8, startDate: mStart(2), endDate: addDays(mStart(62), -1), creditCheck: 'pending', tradingHours: HOURS,
    notes: 'Stationery, art supplies and gifting. Wants the full 620 m² with a mezzanine store room.',
  }, { status: 'application', createdDaysAgo: 6, history: [{ daysAgo: 6, by: 'Ayanda Cele', role: 'Leasing administrator', action: 'Application taken from prospect PR-0001' }] });

  rec('leases', 'LS', { // leases_2 — guide step 2: fit-out signed off, no CoO or insurance yet
    unit: unitId.U06, tenant: 'Ember Athletica', entity: 'Ember Athletica Retail (Pty) Ltd', contact: 'Sizwe Radebe', phone: '021 555 0193', email: 'leasing@emberathletica.example.com',
    category: 'fashion', baseRent: 340, escalationPct: 7, turnoverPct: 6, opsRate: 64, mktRate: 9, startDate: mStart(0), endDate: addDays(mStart(60), -1), tradingHours: HOURS, signedOn: day(-58),
    ...secured(360 * 340),
  }, { status: 'fitout', createdDaysAgo: 80, history: [
    { daysAgo: 80, by: 'Ayanda Cele', role: 'Leasing administrator', action: 'Lease created' },
    { daysAgo: 66, by: 'Pieter van der Walt', role: 'Leasing manager', action: 'Agree heads of terms' },
    { daysAgo: 58, by: 'Pieter van der Walt', role: 'Leasing manager', action: 'Lease signed' },
    { daysAgo: 51, by: 'Pieter van der Walt', role: 'Leasing manager', action: 'Hand over for fit-out' },
  ] });

  rec('leases', 'LS', { // leases_3 — fit-out still under way
    unit: unitId.G09, tenant: 'Little Gulls Kidswear', entity: 'Little Gulls Clothing CC', ...contactOf('Little Gulls Kidswear'),
    category: 'fashion', baseRent: 350, escalationPct: 7, turnoverPct: 7, opsRate: 64, mktRate: 9, startDate: mStart(1), endDate: addDays(mStart(61), -1), tradingHours: HOURS, signedOn: day(-33),
    ...secured(300 * 350),
  }, { status: 'fitout', createdDaysAgo: 60 });

  rec('leases', 'LS', { // leases_4 — signed, waiting to be handed over
    unit: unitId.L12, tenant: 'Driftwood Décor', entity: 'Driftwood Décor (Pty) Ltd', ...contactOf('Driftwood Decor'),
    category: 'home', baseRent: 270, escalationPct: 7.5, turnoverPct: 0, opsRate: 60, mktRate: 8, startDate: mStart(2), endDate: addDays(mStart(38), -1), tradingHours: HOURS, signedOn: day(-4),
    ...secured(240 * 270),
  }, { status: 'signed', createdDaysAgo: 38 });

  rec('leases', 'LS', { // leases_5 — heads of terms agreed, deposit and FICA outstanding
    unit: unitId.G18, tenant: 'Fixit Phone Clinic', entity: 'Fixit Mobile Repairs (Pty) Ltd', ...contactOf('Fixit Phone Clinic'),
    category: 'electronics', baseRent: 420, escalationPct: 8, turnoverPct: 0, opsRate: 66, mktRate: 10, startDate: mStart(2), endDate: addDays(mStart(38), -1), tradingHours: HOURS, creditCheck: 'approved',
  }, { status: 'hot', createdDaysAgo: 21 });

  // Trading tenants, in unit order.
  const leaseByShop: Record<string, DemoRecord> = {};
  for (const [shop, , gla, category, tenant, rent, o = {}] of UNITS) {
    if (!tenant) continue;
    let sm = o.sm ?? int(13, 58);
    if (o.sm === undefined && sm % 12 === 0) sm += 1;
    const start = mStart(-sm);
    const anchor = gla >= 2000;
    const term = anchor ? 120 : 60;
    let endM = -sm + term;
    while (endM <= 7) endM += 36; // an earlier renewal: never expiring by accident
    const end = o.endIn !== undefined ? mEnd(o.endIn) : addDays(mStart(endM), -1);
    const years = Math.floor(sm / 12) - (o.escDue ? 1 : 0);
    const v: Values = {
      unit: unitId[shop], tenant, entity: `${tenant.replace(/’s\b/, '')} ${pick(['(Pty) Ltd', '(Pty) Ltd', 'CC', 'Trading (Pty) Ltd'])}`, ...contactOf(tenant),
      category, baseRent: rent, escalationPct: anchor ? 6 : pick([7, 7, 7.5, 8]), turnoverPct: o.tp ?? 0, opsRate: anchor ? 46 : category === 'kiosk' ? 85 : int(58, 68), mktRate: anchor ? 3.5 : category === 'kiosk' ? 15 : int(8, 11),
      startDate: start, endDate: end, tradingSince: start,
      tradingHours: category === 'restaurant' ? 'May trade until 22:00' : category === 'entertainment' ? 'May trade until 23:00' : category === 'grocery' ? 'May trade 07:00–21:00' : HOURS,
      ...secured(gla * rent, anchor), cooNumber: `DEMO-COO-${String(coo).padStart(4, '0')}`, insuranceExpiry: o.insExpired ? day(-20) : day(int(45, 320)),
    };
    // Anniversaries already applied; "due this month" tenants are one behind, Linen Lighthouse (14 months) was missed.
    if (years >= 1 && shop !== 'G20') v.lastEscalated = `${Number(start.slice(0, 4)) + years}${start.slice(4)}`;
    if (o.st === 'notice') v.noticeDate = day(-int(20, 40));
    leaseByShop[shop] = rec('leases', 'LS', v, { status: o.st === 'renewal' || o.st === 'notice' ? o.st : 'trading', createdDaysAgo: Math.min(sm * 30, 900) });
  }

  // Former tenants, a declined application and a second application.
  const former = (shop: string, tenant: string, category: string, rent: number, startM: number, vacatedOn: string) => rec('leases', 'LS', {
    unit: unitId[shop], tenant, ...contactOf(tenant), category, baseRent: rent, escalationPct: 7, turnoverPct: 0, opsRate: 60, mktRate: 8, startDate: mStart(startM), endDate: vacatedOn, vacatedOn, tradingSince: mStart(startM),
    ...secured(num(unitRec(shop), 'gla') * rent),
  }, { status: 'vacated', createdDaysAgo: 600, history: [{ daysAgo: 600, by: 'Seed data', role: 'System', action: 'Created (fictional record)' }, { daysAgo: 30, by: 'Pieter van der Walt', role: 'Leasing manager', action: 'Tenant vacated', note: 'Keys returned; unit handed back in fair condition.' }] });
  const sugarbird = former('L09', 'Sugarbird Bakery', 'food', 350, -40, mEnd(-4));
  former('U11', 'Old Quay Luggage', 'fashion', 320, -67, day(-215));
  former('G14', 'Blue Heron Furnishers', 'home', 215, -65, day(-160));
  const trinket = former('K05', 'Trinket Tide', 'kiosk', 1500, -26, day(-35));
  rec('leases', 'LS', { unit: unitId.K05, tenant: 'Neon Noodle Bar', ...contactOf('Neon Noodle Bar'), category: 'food', baseRent: 1600, escalationPct: 8, turnoverPct: 0, opsRate: 85, mktRate: 15, startDate: mStart(1), endDate: addDays(mStart(25), -1), creditCheck: 'declined' },
    { status: 'declined', createdDaysAgo: 20, history: [{ daysAgo: 20, by: 'Ayanda Cele', role: 'Leasing administrator', action: 'Lease created' }, { daysAgo: 16, by: 'Pieter van der Walt', role: 'Leasing manager', action: 'Decline / withdraw', note: 'Credit check declined and a cooking kiosk cannot be vented on pad K05.' }] });
  rec('leases', 'LS', { unit: unitId.U11, tenant: 'Thimble & Thread Haberdashery', ...contactOf('Thimble & Thread'), category: 'services', baseRent: 330, escalationPct: 7, turnoverPct: 0, opsRate: 62, mktRate: 8, startDate: mStart(2), endDate: addDays(mStart(38), -1), creditCheck: 'approved', tradingHours: HOURS },
    { status: 'application', createdDaysAgo: 3 });

  /* ---------------- Meter readings: three months, a few of last month's still to capture ---------------- */
  const MISSING = ['U07', 'G07', 'L11', 'F05'];
  const elecBase: Record<string, number> = {};
  for (const [shop, , gla, category, tenant, , o = {}] of UNITS) {
    if (!tenant) continue;
    const base = Math.round(gla * KWH[category] * between(0.85, 1.15));
    elecBase[shop] = base;
    let elec = int(18000, 240000);
    let water = int(300, 4200);
    for (let k = 3; k >= 1; k--) {
      if (str(leaseByShop[shop], 'startDate') > mStart(-k)) continue; // not trading yet
      const jump = shop === 'G19' && k === 1 ? 1.58 : shop === 'L02' && k === 1 ? 0.55 : between(0.94, 1.07);
      elec += Math.round(base * jump);
      water += o.water ? Math.round(gla * (category === 'food' ? 0.55 : category === 'restaurant' ? 0.32 : 0.09) * between(0.9, 1.1)) + 2 : 0;
      if (k === 1 && MISSING.includes(shop)) continue;
      const v: Values = { unit: unitId[shop], period: addMonths(P, -k), date: notAfterToday(mStart(-k + 1)), elec };
      if (o.water) v.water = water;
      rec('readings', 'MR', v, { status: 'captured', createdDaysAgo: k * 30, ...quiet });
    }
  }

  /* ---------------- Turnover declarations: six months for tenants with a turnover clause ---------------- */
  const UNVERIFIED = ['G04', 'F03', 'U08', 'G07', 'L15'];
  const AWAITED = ['U05', 'F02', 'G11', 'F07'];
  for (let k = 6; k >= 1; k--) {
    for (const [shop, , gla, , tenant, rent, o = {}] of UNITS) {
      const lease = leaseByShop[shop];
      if (!tenant || !o.tp || !o.ratio || str(lease, 'startDate') > mStart(-k)) continue;
      const season = 1 + 0.05 * Math.sin((Number(addMonths(P, -k).slice(5)) / 12) * Math.PI * 2);
      const amount = Math.round(((gla * rent) / (o.ratio / 100)) * season * between(0.95, 1.05) / 100) * 100;
      const period = addMonths(P, -k);
      const awaited = (k === 1 && AWAITED.includes(shop)) || (k === 2 && shop === 'F07');
      const queried = k === 2 && shop === 'G10';
      const declaredOn = notAfterToday(addDays(mStart(-k + 1), int(1, 5)));
      if (awaited) { rec('turnover', 'TD', { lease: lease.id, period }, { status: 'awaited', createdDaysAgo: k * 30, ...quiet }); continue; }
      const v: Values = { lease: lease.id, period, amount, declaredOn };
      const status = queried ? 'queried' : k === 1 && UNVERIFIED.includes(shop) ? 'declared' : 'verified';
      if (status === 'verified') v.verifiedBy = 'Michelle Jacobs';
      rec('turnover', 'TD', v, queried
        ? { status, createdDaysAgo: k * 30, history: [{ daysAgo: 22, by: 'Michelle Jacobs', role: 'Accounts / credit controller', action: 'Query with tenant', note: 'Declared figure is 30% below the till summary sent last quarter — asked for the audited month-end report.' }] }
        : { status, createdDaysAgo: k * 30, ...quiet });
    }
  }

  /* ---------------- Invoices: six months of rent roll, last month in full detail ---------------- */
  const addInvoice = (lease: DemoRecord, k: number, shop: string, o: Opt) => {
    const period = addMonths(P, -k);
    const date = mStart(-k);
    let values: Values;
    if (k === 1) {
      values = { ...buildInvoice(dataLike, lease, period, date).values };
      if (!values.notes) delete values.notes;
    } else {
      const gla = num(unitRec(shop), 'gla');
      const base = gla * num(lease, 'baseRent');
      const row = rowOf[shop];
      const utilities = (elecBase[shop] ?? 0) * ELEC_TARIFF * between(0.94, 1.06) + (row[6]?.water ? gla * 0.2 * WATER_TARIFF : 0);
      const declared = collections.turnover?.find((d) => str(d, 'lease') === lease.id && str(d, 'period') === addMonths(period, -1) && d.status === 'verified');
      const tr = declared ? turnoverRent(num(declared, 'amount'), num(lease, 'turnoverPct'), base) : 0;
      const levy = round2(gla * num(lease, 'mktRate'));
      const net = round2(base + gla * num(lease, 'opsRate') + levy + utilities + tr);
      const line: Line = { id: 's', description: 'Rent, recoveries & utilities', qty: 1, unitPrice: net };
      values = { lease: lease.id, period, date, dueDate: addDays(date, 7), lines: [line], levy };
    }
    const total = linesTotals(values.lines as Line[], VAT_RATE).total / 100;
    const share = o.part?.[k];
    const unpaid = o.unpaid?.includes(k);
    const status = unpaid ? 'issued' : share ? 'partpaid' : 'paid';
    if (!unpaid) { values.paid = share ? Math.round(total * share) : total; values.paidOn = notAfterToday(addDays(date, int(1, 8))); } else delete values.paid;
    rec('invoices', 'INV', values, { status, createdDaysAgo: k * 30, ...quiet });
  };
  for (let k = 6; k >= 1; k--) {
    for (const [shop, , , , tenant, , o = {}] of UNITS) {
      const lease = leaseByShop[shop];
      if (!tenant || str(lease, 'startDate') > mStart(-k)) continue;
      addInvoice(lease, k, shop, o);
    }
    // Former tenants: the bakery left owing its last month; the kiosk paid up to the month before it left.
    if (k >= 4) addInvoice(sugarbird, k, 'L09', k === 4 ? { unpaid: [4] } : {});
    if (k >= 2) addInvoice(trinket, k, 'K05', {});
  }

  /* ---------------- Credit-control cases ---------------- */
  const acc = { by: 'Michelle Jacobs', role: 'Accounts / credit controller' };
  rec('cases', 'CC', { lease: leaseByShop.U05.id, openedOn: day(-52), reminderOn: day(-45), notes: 'Owner says the new competitor downstairs has hurt lunch trade. Asked for time; nothing in writing yet.' },
    { status: 'reminded', createdDaysAgo: 52, history: [{ daysAgo: 52, ...acc, action: 'Credit-control case created' }, { daysAgo: 45, ...acc, action: 'Log reminder (nothing is sent)' }] }); // cases_1 — guide step 5
  rec('cases', 'CC', { lease: leaseByShop.G08.id, openedOn: day(-30), reminderOn: day(-26), demandOn: day(-9) },
    { status: 'demand', createdDaysAgo: 30, history: [{ daysAgo: 30, ...acc, action: 'Credit-control case created' }, { daysAgo: 26, ...acc, action: 'Log reminder (nothing is sent)' }, { daysAgo: 9, ...acc, action: 'Log letter of demand' }] });
  rec('cases', 'CC', { lease: leaseByShop.L10.id, openedOn: day(-64), reminderOn: day(-60), demandOn: day(-41), instalment: 6500, firstPayment: day(8), notes: 'Six instalments on top of current rent, agreed with the owner at the centre management office.' },
    { status: 'arrangement', createdDaysAgo: 64, history: [{ daysAgo: 64, ...acc, action: 'Credit-control case created' }, { daysAgo: 41, ...acc, action: 'Log letter of demand' }, { daysAgo: 12, ...acc, action: 'Record payment arrangement' }] });
  rec('cases', 'CC', { lease: sugarbird.id, openedOn: day(-110), reminderOn: day(-104), demandOn: day(-80) },
    { status: 'handedover', createdDaysAgo: 110, history: [{ daysAgo: 110, ...acc, action: 'Credit-control case created' }, { daysAgo: 62, ...acc, action: 'Hand over to attorneys', note: 'Handed to Fynbos & Partners (fictional) for the final month’s rent less the deposit; landlord approved.' }] });
  rec('cases', 'CC', { lease: leaseByShop.G13.id, openedOn: day(-75), reminderOn: day(-71) },
    { status: 'settled', createdDaysAgo: 75, history: [{ daysAgo: 75, ...acc, action: 'Credit-control case created' }, { daysAgo: 66, ...acc, action: 'Mark settled', note: 'Paid in full after the reminder.' }] });

  /* ---------------- Prospects ---------------- */
  const la = { by: 'Ayanda Cele', role: 'Leasing administrator' };
  type Pr = [name: string, category: string, shop: string, gla: number, source: string, status: string, ago: number, notes?: string];
  const PROSPECTS: Pr[] = [
    ['Paper Lantern Stationers', 'home', 'G14', 620, 'broker', 'converted', 34, 'Application taken — see the lease.'],
    ['Marula & Mint Skincare', 'health', 'L09', 140, 'website', 'proposal', 16, 'Second shop for an online skincare brand. Proposal at asking rent; they want a three-year term.'],
    ['Tread & Trail Outdoor', 'fashion', 'U11', 310, 'broker', 'proposal', 22],
    ['Copper Kettle Tea Bar', 'kiosk', 'K05', 12, 'walkin', 'viewing', 9],
    ['Bloom Theory Florist', 'services', 'L09', 120, 'walkin', 'viewing', 12, 'Also looked at L09; needs a water point.'],
    ['Pocket Planet Toys', 'services', 'U11', 280, 'canvass', 'viewing', 18],
    ['Rustic Loaf Bakery', 'food', '', 90, 'website', 'enquiry', 4, 'Wants a food-court unit — none vacant at present.'],
    ['Spark & Spanner Hobby Electronics', 'electronics', 'G14', 600, 'broker', 'enquiry', 7],
    ['Velocity Cycles', 'fashion', '', 400, 'canvass', 'enquiry', 2],
    ['Honeybush Health Foods', 'health', '', 160, 'existing', 'enquiry', 11],
    ['Atlas Luggage Co', 'fashion', 'U11', 300, 'broker', 'lost', 48],
    ['Fable & Fern Gifts', 'home', 'G14', 500, 'walkin', 'lost', 70],
  ];
  PROSPECTS.forEach(([name, category, shop, glaWanted, source, status, ago, notes], i) => {
    const v: Values = { name, ...contactOf(name), category, glaWanted, source };
    if (shop) v.unit = unitId[shop];
    if (notes) v.notes = notes;
    if (i === 0) v.lease = 'leases_1';
    rec('prospects', 'PR', v, { status, createdDaysAgo: ago, history: status === 'lost'
      ? [{ daysAgo: ago, ...la, action: 'Prospect created' }, { daysAgo: ago - 14, ...la, action: 'Mark lost', note: i === 10 ? 'Took space at a competing centre.' : 'Could not raise the deposit.' }]
      : [{ daysAgo: ago, ...la, action: 'Prospect created' }] });
  });

  /* ---------------- Fit-outs ---------------- */
  const tc = { by: 'Lindiwe Khoza', role: 'Tenant coordinator' };
  rec('fitouts', 'FO', { lease: 'leases_2', contractor: 'Shopfit Squared', startDate: day(-48), targetDate: day(3), scope: 'New shopfront, slat-wall system, fitting rooms, track lighting and illuminated signage.', insuranceExpiry: day(180), inducted: true, snags: 'Fitting-room door closer\nSignage timer', snagsCleared: true, signedOffOn: day(-2) },
    { status: 'signedoff', createdDaysAgo: 51, history: [{ daysAgo: 51, ...tc, action: 'Opened when LS-0002 was handed over' }, { daysAgo: 44, ...tc, action: 'Approve drawings' }, { daysAgo: 40, ...tc, action: 'Contractor inducted' }, { daysAgo: 6, ...tc, action: 'Works complete — start snagging' }, { daysAgo: 2, by: 'Rajesh Naidoo', role: 'Operations / facilities manager', action: 'Sign off fit-out' }] });
  rec('fitouts', 'FO', { lease: 'leases_3', contractor: 'Anchor Interiors', startDate: day(-20), targetDate: day(18), scope: 'Children’s wear fit-out: low-level fixtures, play corner, new ceiling bulkhead and shopfront.', insuranceExpiry: day(95), inducted: true },
    { status: 'works', createdDaysAgo: 30, history: [{ daysAgo: 30, ...tc, action: 'Fit-out created' }, { daysAgo: 24, ...tc, action: 'Approve drawings' }, { daysAgo: 21, ...tc, action: 'Contractor inducted' }, { daysAgo: 20, ...tc, action: 'Start works' }] });
  rec('fitouts', 'FO', { lease: leaseByShop.U14.id, contractor: 'Shopfit Squared', startDate: day(-140), targetDate: mStart(-3), scope: 'Display cabinets, secure store room and counter.', insuranceExpiry: day(180), inducted: true, snagsCleared: true, signedOffOn: addDays(mStart(-3), -3) }, { status: 'signedoff', createdDaysAgo: 150 });
  rec('fitouts', 'FO', { lease: leaseByShop.G02.id, contractor: 'Kelp & Timber Shopfitters', startDate: day(-26), targetDate: day(-3), scope: 'Refurbishment while trading: new fitting rooms and till point, after hours only.', insuranceExpiry: day(140), inducted: true, snags: 'Till-point skirting not fixed\nTwo ceiling tiles cracked near the fitting rooms\nEmergency light over the rear exit not working' },
    { status: 'snag', createdDaysAgo: 40, history: [{ daysAgo: 40, ...tc, action: 'Fit-out created' }, { daysAgo: 4, ...tc, action: 'Works complete — start snagging' }] });
  rec('fitouts', 'FO', { lease: leaseByShop.K06.id, contractor: 'Cart & Canopy Co', startDate: day(-165), targetDate: mStart(-5), scope: 'Kiosk shell, counter and electrical connection.', insuranceExpiry: day(40), inducted: true, snagsCleared: true, signedOffOn: addDays(mStart(-5), -2) }, { status: 'signedoff', createdDaysAgo: 170 });

  /* ---------------- Work orders ---------------- */
  type Wo = [title: string, shop: string, area: string, category: string, source: string, priority: string, ago: number, status: string, resp?: string, contractor?: string, recharge?: number, extra?: Values];
  const WOS: Wo[] = [
    ['Water coming through the ceiling at the back of the shop', 'G10', '', 'roof', 'tenant', 'emergency', 0, 'logged'],
    ['Escalator 3 (up) stopping on its own', '', 'Escalator 3, Ground to Upper', 'lifts', 'common', 'urgent', 4, 'logged'],
    ['Shopfront roller door sticking', 'L15', '', 'shopfront', 'tenant', 'routine', 2, 'logged'],
    ['Three downlights out in the east corridor', '', 'Ground level, east corridor', 'electrical', 'inspection', 'routine', 9, 'logged'],
    ['Blocked floor drain behind the counter', 'F04', '', 'plumbing', 'tenant', 'urgent', 3, 'assessed', 'tenant', '', 0, { description: 'Grease build-up from the tenant’s own equipment.' }],
    ['Air-conditioning not cooling the shop', 'G17', '', 'hvac', 'tenant', 'urgent', 2, 'assessed', 'landlord'],
    ['Cracked floor tile at the shop entrance', 'G21', '', 'general', 'tenant', 'routine', 6, 'assessed', 'tenant', 'Handy Harbour Maintenance', 1450],
    ['Leak at parking level P1, bay 114', '', 'Parking P1, bay 114', 'roof', 'common', 'urgent', 3, 'assigned', 'landlord', 'SkyHigh Roofing'],
    ['Fire extinguisher service overdue — food court', '', 'Food court, north wall', 'fire', 'inspection', 'routine', 8, 'assigned', 'landlord', 'FireGuard Systems'],
    ['Sign box not lighting up', 'U13', '', 'electrical', 'tenant', 'routine', 7, 'assigned', 'landlord', 'Voltline Electrical'],
    ['Public toilets (Upper) — two cisterns running', '', 'Upper level public toilets', 'plumbing', 'common', 'routine', 5, 'inprogress', 'landlord', 'PipeWright Plumbing'],
    ['Replace extraction fan motor', 'U09', '', 'hvac', 'tenant', 'urgent', 6, 'inprogress', 'tenant', 'CoolCurrent HVAC', 7800],
    ['Lift 2 door sensor fault', '', 'Lift 2, parking to Upper', 'lifts', 'common', 'urgent', 4, 'inprogress', 'landlord', 'LiftLogic Services'],
    ['Repaint the scuffed bulkhead above the shopfront', 'L13', '', 'general', 'tenant', 'routine', 12, 'inprogress', 'landlord', 'Handy Harbour Maintenance'],
    ['Replace the cracked shopfront glass panel', 'G05', '', 'shopfront', 'tenant', 'urgent', 11, 'completed', 'tenant', 'ClearView Shopfronts', 1850, { completedOn: day(-3), description: 'Panel cracked by the tenant’s delivery trolley. Landlord’s contractor replaced it; cost to be recharged.' }],
    ['Reseal the skylight over centre court', '', 'Centre court skylight', 'roof', 'inspection', 'routine', 15, 'completed', 'landlord', 'SkyHigh Roofing', 0, { completedOn: day(-2) }],
    ['Distribution-board trip switch replaced', 'F06', '', 'electrical', 'tenant', 'emergency', 5, 'completed', 'landlord', 'Voltline Electrical', 0, { completedOn: day(-4) }],
    ['Unblock the main sewer line, service yard', '', 'Service yard B', 'plumbing', 'common', 'emergency', 9, 'completed', 'landlord', 'PipeWright Plumbing', 0, { completedOn: day(-8) }],
    ['Service the entrance sliding doors', '', 'Entrance 2', 'shopfront', 'inspection', 'routine', 25, 'confirmed', 'landlord', 'ClearView Shopfronts', 0, { completedOn: day(-18) }],
    ['Air-conditioning thermostat replaced', 'G13', '', 'hvac', 'tenant', 'routine', 28, 'confirmed', 'landlord', 'CoolCurrent HVAC', 0, { completedOn: day(-21) }],
    ['Geyser element replaced in the shop kitchenette', 'G16', '', 'plumbing', 'tenant', 'routine', 44, 'confirmed', 'tenant', 'PipeWright Plumbing', 2200, { completedOn: day(-36), rechargeInvoice: 'the previous month’s invoice' }],
    ['Emergency lighting test failures fixed', '', 'Lower mall', 'electrical', 'inspection', 'urgent', 33, 'confirmed', 'landlord', 'Voltline Electrical', 0, { completedOn: day(-27) }],
    ['Roof gutter cleared above the cinema', 'U01', '', 'roof', 'tenant', 'routine', 38, 'confirmed', 'landlord', 'SkyHigh Roofing', 0, { completedOn: day(-30) }],
    ['Light fittings flickering inside the shop', 'G19', '', 'electrical', 'tenant', 'routine', 19, 'closed', 'tenant'],
    ['Shop counter tap dripping', 'K04', '', 'plumbing', 'tenant', 'routine', 23, 'closed', 'tenant'],
  ];
  const ops = { by: 'Rajesh Naidoo', role: 'Operations / facilities manager' };
  for (const [title, shop, area, category, source, priority, ago, status, resp, contractor, recharge, extra] of WOS) {
    const v: Values = { title, category, source, priority, reportedOn: day(-ago), reportedBy: shop ? `${str(leaseByShop[shop], 'contact') || 'Store manager'} (tenant)` : pick(['Security patrol', 'Cleaning supervisor', 'Centre management walk-about']), ...extra };
    if (shop) v.unit = unitId[shop];
    if (area) v.area = area;
    if (resp) v.responsibility = resp;
    if (contractor) v.contractor = contractor;
    if (recharge) v.rechargeAmount = recharge;
    rec('workorders', 'WO', v, { status, createdDaysAgo: ago, history: status === 'closed'
      ? [{ daysAgo: ago, ...tc, action: 'Work order created' }, { daysAgo: ago - 2, ...ops, action: 'Close — tenant to attend', note: 'Inside the tenant’s own installation: tenant to arrange an electrician or plumber and send the certificate.' }]
      : [{ daysAgo: ago, ...(shop ? tc : ops), action: 'Work order created' }] });
  }

  /* ---------------- Work permits ---------------- */
  type Pm = [type: string, shop: string, location: string, contractor: string, work: string, window: string, from: number, to: number, status: string, extra?: Values];
  const PERMITS: Pm[] = [
    ['hot', 'G09', 'Shopfront', 'ClearView Shopfronts', 'Weld and grind the new shopfront frame for the Little Gulls fit-out.', 'afterhours', 1, 2, 'requested', { insuranceExpiry: day(-12), inducted: true }], // permits_1 — guide step 6
    ['sprinkler', 'U06', 'Ceiling void', 'FireGuard Systems', 'Isolate zone 7 to move two sprinkler heads for the new bulkhead.', 'afterhours', 2, 2, 'requested', { insuranceExpiry: day(210), inducted: true }],
    ['heights', '', 'Centre court atrium', 'SkyHigh Rigging', 'Rig the festive banners from the atrium steelwork using a scissor lift.', 'afterhours', 1, 1, 'approved', { insuranceExpiry: day(150), inducted: true, approvedBy: 'Rajesh Naidoo' }],
    ['general', 'U08', 'Kitchen', 'CoolCurrent HVAC', 'Service the extraction canopy and replace filters.', 'day', -1, 1, 'active', { insuranceExpiry: day(120), inducted: true, approvedBy: 'Lindiwe Khoza' }],
    ['hot', 'F05', 'Back of house', 'PipeWright Plumbing', 'Braze a new gas-line section behind the grill.', 'afterhours', -3, -1, 'active', { insuranceExpiry: day(75), inducted: true, fireWatch: 'Themba Gumede (PipeWright)', approvedBy: 'Rajesh Naidoo' }],
    ['general', '', 'Service yard B', 'Handy Harbour Maintenance', 'Repaint the loading-bay bollards and line markings.', 'day', 0, 0, 'approved', { insuranceExpiry: day(260), inducted: true, approvedBy: 'Lindiwe Khoza' }],
    ['electrical', 'L06', 'Distribution board', 'Voltline Electrical', 'Isolate DB-L06 to add two circuits.', 'afterhours', -9, -9, 'closed', { insuranceExpiry: day(300), inducted: true, approvedBy: 'Rajesh Naidoo' }],
    ['heights', 'U01', 'Foyer ceiling', 'SkyHigh Rigging', 'Replace the foyer feature light.', 'afterhours', -20, -19, 'closed', { insuranceExpiry: day(150), inducted: true, approvedBy: 'Rajesh Naidoo' }],
    ['hot', 'K02', 'Kiosk frame', 'Cart & Canopy Co', 'Weld a bracket to the kiosk frame during trading hours.', 'day', -6, -6, 'rejected', { insuranceExpiry: day(40), inducted: false }],
  ];
  for (const [type, shop, location, contractor, work, window, from, to, status, extra] of PERMITS) {
    const v: Values = { type, location, contractor, work, window, validFrom: day(from), validTo: day(to), ...extra };
    if (shop) v.unit = unitId[shop];
    rec('permits', 'WP', v, { status, createdDaysAgo: Math.max(1, 2 - from), history: status === 'rejected'
      ? [{ daysAgo: 8, ...tc, action: 'Work permit created' }, { daysAgo: 7, ...ops, action: 'Reject permit', note: 'No hot work in the mall during trading hours, and the welder has not been inducted. Re-apply for an after-hours slot.' }]
      : [{ daysAgo: Math.max(1, 2 - from), ...tc, action: 'Work permit created' }] });
  }

  /* ---------------- Daily log: 30 days of footfall and parking income ---------------- */
  const DOW = [19600, 14800, 14200, 15100, 16000, 21500, 27800]; // Sunday first
  const EXCEPTIONS: Record<number, Values> = {
    6: { hoursException: 'Power outage 14:10–17:40 — centre traded on generator', generatorHours: 3.5 },
    11: { hoursException: 'Late-night trade to 21:00 (month-end)' },
    17: { hoursException: 'Load-shedding stage 2, 10:00–11:30', generatorHours: 1.5 },
    23: { hoursException: 'Public holiday hours 09:00–17:00' },
  };
  for (let k = 30; k >= 1; k--) {
    const date = day(-k);
    const d = new Date(`${date}T12:00:00`);
    const payday = d.getDate() >= 25 || d.getDate() <= 2 ? 1.12 : 1;
    const footfall = Math.round((DOW[d.getDay()] * payday * between(0.94, 1.06)) / 10) * 10;
    rec('opslog', 'DL', { date, footfall, parkingIncome: Math.round((footfall * 0.31 * 9) / 10) * 10, ...EXCEPTIONS[k] }, { createdDaysAgo: k, ...quiet });
  }

  /* ---------------- Incidents ---------------- */
  type Inc = [type: string, location: string, shop: string, ago: number, status: string, description: string, extra?: Values];
  const sec = { by: 'Bongani Sithole', role: 'Security & risk supervisor' };
  const INCIDENTS: Inc[] = [
    ['slip', 'Food court, in front of Peri Dock Chicken', 'F03', 0, 'reported', 'Customer slipped on a spilt drink and hurt her wrist. Cleaner was on the way with a wet-floor sign.', { injury: true, reportedBy: 'Food-court cleaner' }],
    ['theft', 'Salt & Silk, Ground level', 'G12', 1, 'reported', 'Two dresses taken from the front rail; suspect left through Entrance 2.', { reportedBy: 'Store manager' }],
    ['fire', 'Cinema foyer', 'U01', 3, 'responded', 'Smoke detector activated in the popcorn preparation area.', { reportedBy: 'Control room', responder: 'Bongani Sithole', action: 'Foyer cleared for six minutes; detector reset by FireGuard. No fire.' }],
    ['medical', 'Centre court', '', 5, 'responded', 'Elderly customer fainted near the information desk.', { reportedBy: 'Information desk', responder: 'First-aider on duty', action: 'First aid given; ambulance called by the family; customer left with paramedics.' }],
    ['slip', 'Entrance 2, wet tiles', '', 9, 'investigated', 'Customer slipped on wet tiles during rain and bruised his hip.', { injury: true, reportedBy: 'Security officer, Entrance 2', responder: 'Bongani Sithole', action: 'First aid; area coned off; extra matting laid.', findings: 'Entrance mat was saturated and had not been swapped during the storm. Wet-weather mat rotation added to the cleaning schedule.' }],
    ['damage', 'Parking P1, ramp bollard', '', 12, 'investigated', 'Delivery vehicle reversed into the ramp bollard and height bar.', { damage: true, reportedBy: 'Parking attendant', responder: 'Bongani Sithole', action: 'Ramp closed for 40 minutes; driver and company details taken.', findings: 'Driver ignored the height warning. Claim to be lodged against the courier’s insurer.', insuranceRef: 'DEMO-CLM-2291' }],
    ['power', 'Whole centre', '', 6, 'closed', 'Municipal supply failed at 14:10; generators carried common areas and anchors.', { reportedBy: 'Control room', responder: 'Rajesh Naidoo', action: 'Generators started automatically; lifts checked; tenants told by walk-about.', findings: 'Supply restored 17:40. Generator ran 3.5 hours; diesel topped up next morning.' }],
    ['theft', 'Volt Lane Electronics', 'G03', 14, 'closed', 'Display phone security cable cut.', { reportedBy: 'Store manager', responder: 'Security officer, Ground', action: 'Footage pulled; case number given to the tenant by the police.', findings: 'Tenant to fit alarmed cables. No landlord liability.' }],
    ['medical', 'Anchor Fitness Club', 'U04', 16, 'closed', 'Member collapsed on the treadmill.', { reportedBy: 'Club manager', responder: 'Club first-aider', action: 'Ambulance met at Entrance 4 and escorted by security.', findings: 'No centre involvement beyond access. Closed.' }],
    ['fire', 'Lower mall, service corridor', '', 19, 'closed', 'Break-glass unit activated.', { reportedBy: 'Control room', responder: 'Bongani Sithole', action: 'Corridor checked; no fire. Alarm silenced after four minutes.', findings: 'Accidental activation by a delivery trolley. Guard fitted over the unit.' }],
    ['damage', 'Shopfront, Linen Lighthouse', 'G20', 22, 'closed', 'Cleaning machine cracked the shopfront kick-plate.', { damage: true, reportedBy: 'Store manager', responder: 'Rajesh Naidoo', action: 'Area made safe; photos taken.', findings: 'Cleaning contractor accepted liability and replaced the panel.', insuranceRef: 'DEMO-CLM-2274' }],
    ['power', 'Whole centre', '', 17, 'closed', 'Scheduled load-shedding 10:00–11:30.', { reportedBy: 'Control room', responder: 'Rajesh Naidoo', action: 'Generators ran for 1.5 hours.', findings: 'No faults. Closed.' }],
  ];
  for (const [type, location, shop, ago, status, description, extra] of INCIDENTS) {
    const v: Values = { date: day(-ago), type, location, description, ...extra };
    if (shop) v.unit = unitId[shop];
    rec('incidents', 'IN', v, { status, createdDaysAgo: ago, history: [{ daysAgo: ago, ...sec, action: 'Incident created' }] });
  }

  /* ---------------- Exhibition bookings ---------------- */
  type Bk = [exhibitor: string, type: string, space: string, from: number, to: number, rate: number, deposit: number, status: string, paid: boolean];
  const BOOKINGS: Bk[] = [
    ['Brightfield Solar Roadshow', 'promotion', 'court-g', -3, 4, 2400, 5000, 'live', true],
    ['Aura Mist Fragrance Pop-up', 'popup', 'pad-a', -10, 18, 950, 4000, 'live', true],
    ['Evergreen Vehicle Display', 'exhibition', 'court-g', 10, 16, 3200, 8000, 'confirmed', true],
    ['Harbour Schools Art Exhibition', 'charity', 'court-l', 6, 12, 0, 0, 'confirmed', true],
    ['Zest Mobile Network Promo', 'promotion', 'court-g', 14, 18, 2600, 5000, 'quoted', false],
    ['Tasty Trails Food Truck Weekend', 'popup', 'forecourt', 20, 22, 1800, 2500, 'quoted', false],
    ['Storybook Kids Corner', 'popup', 'pad-b', 25, 40, 700, 3000, 'enquiry', false],
    ['Coastline Home Loans Expo', 'exhibition', 'court-l', 30, 33, 2800, 6000, 'enquiry', false],
    ['Winter Warmer Blanket Drive', 'charity', 'court-g', -30, -24, 0, 0, 'completed', true],
    ['Glide Scooters Demo', 'promotion', 'pad-b', -45, -32, 850, 3000, 'completed', true],
    ['Pedal Power Bike Show', 'exhibition', 'forecourt', 8, 9, 1800, 2500, 'cancelled', false],
  ];
  const mk = { by: 'Kagiso Molefe', role: 'Marketing manager' };
  for (const [exhibitor, type, space, from, to, dailyRate, depositAmount, status, paid] of BOOKINGS) {
    const v: Values = { exhibitor, ...contactOf(exhibitor), type, space, startDate: day(from), endDate: day(to), dailyRate, depositAmount };
    if (paid) v.depositPaid = true;
    rec('bookings', 'EX', v, { status, createdDaysAgo: Math.max(3, 30 - from), history: status === 'cancelled'
      ? [{ daysAgo: 20, ...mk, action: 'Booking created' }, { daysAgo: 5, ...mk, action: 'Cancel booking', note: 'Organiser moved the show to next quarter; no deposit had been paid.' }]
      : [{ daysAgo: Math.max(3, 30 - from), ...mk, action: 'Booking created' }] });
  }

  /* ---------------- Marketing campaigns ---------------- */
  type Cp = [title: string, kind: string, from: number, to: number, cost: number, status: string];
  const CAMPAIGNS: Cp[] = [
    ['Radio spots — mid-year sale', 'advertising', -118, -104, 64000, 'done'],
    ['Spring fashion week on centre court', 'event', -62, -56, 185000, 'done'],
    ['School-holiday kids’ zone', 'event', -40, -31, 96000, 'done'],
    ['Payday social-media push', 'digital', -6, 4, 42000, 'running'],
    ['Festive décor installation', 'decor', 12, 55, 380000, 'approved'],
    ['Carols by candlelight', 'event', 35, 35, 78000, 'planned'],
    ['Back-to-school campaign', 'advertising', 62, 80, 120000, 'planned'],
  ];
  for (const [title, kind, from, to, cost, status] of CAMPAIGNS) {
    rec('campaigns', 'MK', { title, kind, startDate: day(from), endDate: day(to), cost }, { status, createdDaysAgo: Math.max(5, 20 - from), history: [{ daysAgo: Math.max(5, 20 - from), ...mk, action: 'Campaign created' }] });
  }

  return { users, collections, currentUserId: 'u_cm' };
}
