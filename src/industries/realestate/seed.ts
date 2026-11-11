// Fictional seed data for Kestrel Property Group. Every person, suburb, street,
// firm, certificate number and amount is invented. Dates are relative to
// `today` so the demo always looks current. Deterministic: a seeded PRNG,
// never Math.random.
import { seeder, user } from '../../core/seed';
import type { DemoRecord } from '../../core/types';
import { formatRandWhole } from '../../core/lib/money';
import { SUBURBS, suburbLabel } from './data';

/** Small deterministic PRNG (same algorithm as the optometry seed). */
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

const ADMIN = { name: 'Charlene Fourie', role: 'Property manager / admin' };

// name, designation, FFC expiry offset (days), agent split %, linked demo user
const AGENTS: Array<[string, string, number, number, string]> = [
  ['Naledi Mokoena', 'principal', 210, 50, 'u_principal'],
  ['Pieter Swanepoel', 'full', 150, 50, 'u_sales'],
  ['Ayanda Zungu', 'full', -9, 50, 'u_sales2'],
  ['Megan Adams', 'full', 300, 50, 'u_rental'],
  ['Ravi Govender', 'intern', 20, 40, ''],
  ['Thabo Nkosi', 'full', 95, 50, ''],
];
const agentRole = (i: number) => (i === 0 ? 'Principal' : i === 3 ? 'Rental agent' : 'Sales agent');

type ListingSeed = {
  a: string; s: string; t: string; beds: number; baths: number; erf: number; floor: number; price: number; orig?: number; agent: number; st: string;
  listed?: number; mSigned?: number; mExp?: number; fica?: boolean; rate?: number; sold?: number; reg?: number; note?: string;
};

const LISTINGS: ListingSeed[] = [
  // Valuation
  { a: '7 Hornbill Close', s: 'marula', t: 'house', beds: 4, baths: 3, erf: 980, floor: 260, price: 3450000, agent: 1, st: 'valuation' },
  { a: 'Unit 12 Silverleaf Mews', s: 'silverleaf', t: 'apartment', beds: 2, baths: 2, erf: 0, floor: 88, price: 1395000, agent: 4, st: 'valuation' },
  // Mandate signed — each one shows a different go-live rule
  { a: '22 Wild Olive Avenue', s: 'fernwood', t: 'house', beds: 3, baths: 2, erf: 720, floor: 190, price: 2490000, agent: 2, st: 'mandate', mSigned: -4, mExp: 86, fica: true, note: 'Listing agent’s FFC has expired — cannot go live until renewed or reassigned.' },
  { a: '5 Quartz Ridge Road', s: 'quartz', t: 'house', beds: 5, baths: 4, erf: 1450, floor: 380, price: 4950000, agent: 0, st: 'mandate', mSigned: -3, mExp: 87, fica: false, note: 'Seller still to provide proof of address for FICA.' },
  { a: '31 Kingfisher Drive', s: 'kingfisher', t: 'townhouse', beds: 3, baths: 2, erf: 320, floor: 160, price: 2195000, agent: 5, st: 'mandate', mSigned: -95, mExp: -3, fica: true, note: 'Seller asked to hold off marketing; mandate has since lapsed.' },
  { a: '9 Bramble Lane', s: 'bramble', t: 'house', beds: 3, baths: 2, erf: 650, floor: 170, price: 2150000, agent: 1, st: 'mandate', mSigned: -2, mExp: 88, fica: true },
  // Listed
  { a: '18 Weaver Crescent', s: 'marula', t: 'house', beds: 4, baths: 3, erf: 1020, floor: 270, price: 3295000, orig: 3450000, agent: 1, st: 'listed', listed: -104, mExp: 10 },
  { a: '3 Fig Tree Court', s: 'wildfig', t: 'townhouse', beds: 2, baths: 2, erf: 240, floor: 110, price: 1650000, agent: 4, st: 'listed', listed: -21, mExp: 70 },
  { a: 'Unit 7 The Sandpiper', s: 'kingfisher', t: 'apartment', beds: 2, baths: 1, erf: 0, floor: 74, price: 1180000, agent: 5, st: 'listed', listed: -45, mExp: 45 },
  { a: '41 Stonechat Road', s: 'stonechat', t: 'house', beds: 3, baths: 2, erf: 700, floor: 185, price: 2395000, agent: 0, st: 'listed', listed: -12, mExp: 80 },
  { a: '12 Marula Way', s: 'marula', t: 'house', beds: 3, baths: 2, erf: 690, floor: 175, price: 2850000, agent: 1, st: 'listed', listed: -60, mExp: 5 },
  { a: '27 Fernwood Drive', s: 'fernwood', t: 'house', beds: 4, baths: 2, erf: 900, floor: 230, price: 2950000, orig: 3200000, agent: 2, st: 'listed', listed: -130, mExp: 35, note: 'Listed before the agent’s FFC lapsed — reassign or renew.' },
  { a: '8 Silverleaf Close', s: 'silverleaf', t: 'townhouse', beds: 3, baths: 2, erf: 300, floor: 150, price: 1895000, agent: 4, st: 'listed', listed: -8, mExp: 85 },
  { a: '56 Quartz Hill Road', s: 'quartz', t: 'house', beds: 4, baths: 3, erf: 1200, floor: 310, price: 3750000, agent: 0, st: 'listed', listed: -33, mExp: 60, rate: 6.5 },
  { a: 'Unit 3 Bramble Court', s: 'bramble', t: 'apartment', beds: 1, baths: 1, erf: 0, floor: 52, price: 895000, orig: 949000, agent: 5, st: 'listed', listed: -95, mExp: 25 },
  // Under offer
  { a: '14 Hornbill Close', s: 'marula', t: 'house', beds: 3, baths: 2, erf: 750, floor: 200, price: 2750000, agent: 1, st: 'underoffer', listed: -40, mExp: 50 },
  { a: '2 Kingfisher Mews', s: 'kingfisher', t: 'townhouse', beds: 3, baths: 2, erf: 280, floor: 145, price: 1980000, agent: 5, st: 'underoffer', listed: -25, mExp: 65 },
  { a: '33 Wildfig Avenue', s: 'wildfig', t: 'house', beds: 4, baths: 3, erf: 1100, floor: 290, price: 3150000, agent: 0, st: 'underoffer', listed: -55, mExp: 35 },
  // Sold — pending transfer
  { a: '6 Stonechat Close', s: 'stonechat', t: 'house', beds: 3, baths: 2, erf: 680, floor: 180, price: 2280000, agent: 1, st: 'sold', listed: -50, sold: -10 },
  { a: 'Unit 21 Silverleaf Mews', s: 'silverleaf', t: 'apartment', beds: 2, baths: 2, erf: 0, floor: 90, price: 1320000, agent: 4, st: 'sold', listed: -70, sold: -25 },
  { a: '19 Fernwood Drive', s: 'fernwood', t: 'house', beds: 4, baths: 3, erf: 950, floor: 255, price: 3395000, agent: 0, st: 'sold', listed: -75, sold: -40, rate: 7 },
  { a: '44 Marula Way', s: 'marula', t: 'house', beds: 3, baths: 2, erf: 700, floor: 190, price: 2640000, agent: 5, st: 'sold', listed: -98, sold: -52 },
  { a: '7 Quartz Lane', s: 'quartz', t: 'townhouse', beds: 2, baths: 2, erf: 260, floor: 120, price: 1575000, agent: 2, st: 'sold', listed: -110, sold: -60 },
  { a: '11 Bramble Lane', s: 'bramble', t: 'house', beds: 3, baths: 1, erf: 600, floor: 150, price: 1890000, agent: 1, st: 'sold', listed: -80, sold: -35 },
  { a: '25 Kingfisher Drive', s: 'kingfisher', t: 'house', beds: 4, baths: 3, erf: 1000, floor: 280, price: 3850000, agent: 0, st: 'sold', listed: -45, sold: -18, rate: 6.5 },
  { a: '9 Wildfig Court', s: 'wildfig', t: 'townhouse', beds: 3, baths: 2, erf: 300, floor: 155, price: 2095000, agent: 5, st: 'sold', listed: -120, sold: -70 },
  // Registered
  { a: '15 Stonechat Road', s: 'stonechat', t: 'house', beds: 3, baths: 2, erf: 710, floor: 190, price: 2350000, agent: 1, st: 'registered', listed: -150, sold: -100, reg: -6 },
  { a: 'Unit 9 The Sandpiper', s: 'kingfisher', t: 'apartment', beds: 2, baths: 2, erf: 0, floor: 82, price: 1250000, agent: 4, st: 'registered', listed: -160, sold: -110, reg: -22 },
  { a: '30 Quartz Hill Road', s: 'quartz', t: 'house', beds: 4, baths: 3, erf: 1250, floor: 320, price: 3950000, agent: 0, st: 'registered', listed: -170, sold: -130, reg: -48, rate: 6.5 },
  { a: '4 Marula Close', s: 'marula', t: 'townhouse', beds: 3, baths: 2, erf: 310, floor: 160, price: 2195000, agent: 5, st: 'registered', listed: -200, sold: -150, reg: -85 },
  // Withdrawn / expired
  { a: '16 Fernwood Lane', s: 'fernwood', t: 'house', beds: 3, baths: 2, erf: 640, floor: 170, price: 2290000, agent: 1, st: 'withdrawn', listed: -70, mExp: 50, note: 'Seller decided to rent the property out instead.' },
  { a: '20 Silverleaf Drive', s: 'silverleaf', t: 'townhouse', beds: 3, baths: 2, erf: 290, floor: 140, price: 1750000, agent: 4, st: 'expired', listed: -130, mExp: -12, note: 'Mandate lapsed; seller will reconsider the price in the new year.' },
];

const SELLERS = ['Hendrik & Elna Marais', 'Priya Naidoo', 'Johan Pretorius', 'Lerato Dlamini', 'Ingrid Cloete', 'Sibusiso Ngcobo', 'Fiona McKenzie', 'Kobus Venter',
  'Nomvula Khoza', 'Adriaan Botha', 'Yasmin Patel', 'Mandla Shabalala', 'Ruth Abrahams', 'Gerhard Steyn', 'Zanele Mthethwa', 'Craig Jacobs'];

const FIRST = ['Sizwe', 'Anika', 'Tumelo', 'Chloé', 'Bongani', 'Nadia', 'Kyle', 'Refilwe', 'Imraan', 'Elsabé', 'Lwazi', 'Megan', 'Tshepo', 'Aisha', 'Ruan', 'Palesesa',
  'Dineo', 'Werner', 'Keabetswe', 'Farah', 'Jabu', 'Liezl', 'Neo', 'Shaun', 'Thandeka', 'Ashwin', 'Mpho', 'Carla', 'Vusi', 'Hannah'];
const LAST = ['Mahlangu', 'van Wyk', 'Molefe', 'Daniels', 'Sithole', 'Essop', 'Fourie', 'Mokoena', 'Pillay', 'du Toit', 'Ntuli', 'Hendricks', 'Radebe', 'Moodley', 'Kruger', 'Zwane',
  'Bezuidenhout', 'Maseko', 'Govender', 'Smit', 'Ndlovu', 'Coetzee', 'Khumalo', 'Petersen'];

const phone = (n: number, prefix = '08') => `${prefix}${(n % 3) + 2} 555 ${String(1000 + ((n * 137) % 9000)).padStart(4, '0')}`;
const emailOf = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@example.com`;
const round = (n: number, to: number) => Math.round(n / to) * to;

export function buildRealEstateSeed(today: string) {
  const { collections, rec, day } = seeder(today);
  const rnd = prng(606);
  const H = (daysAgo: number, by: string, role: string, action: string, note?: string) => ({ daysAgo: Math.max(0, daysAgo), by, role, action, note });

  /* ---------- Agents (fictional FFC register) ---------- */
  const agents: DemoRecord[] = AGENTS.map(([name, designation, ffc, split, userId], i) => rec('agents', 'AG', {
    name, designation, phone: phone(i + 3), email: emailOf(name), ffcNumber: `DEMO-FFC-${2100 + i * 37}`, ffcExpiry: day(ffc), agentSplit: split, userId,
  }, { createdDaysAgo: 400, history: [H(400, ADMIN.name, ADMIN.role, 'Agent added (fictional record)'), H(Math.max(1, 365 - ffc), ADMIN.name, ADMIN.role, 'FFC renewal date recorded')] }));
  const A = (i: number) => agents[i];
  const AN = (i: number) => AGENTS[i][0];

  /* ---------- Listings & mandates ---------- */
  const listings: DemoRecord[] = LISTINGS.map((l, i) => {
    const listed = l.listed;
    const mSigned = l.mSigned ?? (listed !== undefined ? listed - 3 : undefined);
    const mExp = l.mExp ?? (mSigned !== undefined ? mSigned + 180 : undefined);
    const created = -((mSigned ?? -4) - 7);
    const by = AN(l.agent);
    const role = agentRole(l.agent);
    const hist = [H(created, by, role, 'Valuation recorded')];
    if (mSigned !== undefined) hist.push(H(-mSigned, by, role, 'Mandate signed'));
    if (listed !== undefined) hist.push(H(-listed, ADMIN.name, ADMIN.role, 'Go live'));
    if (l.orig && listed !== undefined) hist.push(H(Math.round(-listed / 2), by, role, 'Details edited', `Price reduced from ${formatRandWhole(l.orig * 100)} on the seller’s instruction.`));
    if (['underoffer', 'sold', 'registered'].includes(l.st)) hist.push(H(l.sold !== undefined ? -l.sold + 14 : 6, by, role, 'Mark under offer'));
    if (['sold', 'registered'].includes(l.st)) hist.push(H(-(l.sold ?? 0), by, role, 'Sold — conditions met'));
    if (l.st === 'registered') hist.push(H(-(l.reg ?? 0), ADMIN.name, ADMIN.role, 'Registered at deeds office'));
    if (l.st === 'withdrawn') hist.push(H(9, by, role, 'Withdraw', l.note));
    if (l.st === 'expired') hist.push(H(-(mExp ?? 0), by, role, 'Mandate expired', l.note));
    const seller = SELLERS[i % SELLERS.length];
    return rec('listings', 'LST', {
      address: l.a, suburb: l.s, type: l.t, beds: l.beds, baths: l.baths, erf: l.erf || '', floor: l.floor,
      valuation: round(l.price * (l.st === 'valuation' ? 1 : 1.02), 5000), askingPrice: l.price, originalPrice: listed !== undefined ? (l.orig ?? l.price) : '',
      agent: A(l.agent).id, mandateType: i % 4 === 3 ? 'open' : 'sole',
      mandateSigned: mSigned !== undefined ? day(mSigned) : '', mandateExpiry: mExp !== undefined ? day(mExp) : '', listedOn: listed !== undefined ? day(listed) : '',
      sellerName: seller, sellerPhone: phone(i + 11), sellerEmail: emailOf(seller.split(' & ')[0]),
      sellerFica: l.fica ?? (l.st !== 'valuation'), commissionRate: l.rate ?? 7.5,
      soldPrice: '', soldOn: l.sold !== undefined ? day(l.sold) : '', registeredOn: l.reg !== undefined ? day(l.reg) : '',
      notes: l.note && !['withdrawn', 'expired'].includes(l.st) ? l.note : '',
    }, { status: l.st, createdDaysAgo: created, history: hist });
  });
  const L = (i: number) => listings[i];

  /* ---------- Buyers & leads ---------- */
  let nameSeq = 0;
  const nextName = () => {
    const n = nameSeq++;
    return `${FIRST[n % FIRST.length]} ${LAST[(n * 7 + 3) % LAST.length]}`;
  };
  const SOURCES = ['website', 'portal', 'board', 'showday', 'referral', 'social', 'portal', 'website'];
  const lead = (values: Record<string, string | number | boolean>, status: string, createdDaysAgo: number, note?: string) => {
    const name = nextName();
    const by = AN(Number(values.agentIdx ?? 1));
    const role = agentRole(Number(values.agentIdx ?? 1));
    const hist = [H(createdDaysAgo, by, role, 'Enquiry captured')];
    const order = ['new', 'contacted', 'viewing', 'offer', 'bought'];
    const reached = status === 'lost' ? 2 : order.indexOf(status);
    const labels = ['', 'Mark contacted', 'Viewing booked', 'Offer made', 'Bought'];
    for (let k = 1; k <= reached; k++) hist.push(H(Math.round(createdDaysAgo * (1 - k / 5)), by, role, labels[k]));
    if (status === 'lost') hist.push(H(Math.round(createdDaysAgo / 4), by, role, 'Mark lost', note));
    const { agentIdx, ...rest } = values;
    return rec('leads', 'BYR', {
      name, phone: phone(nameSeq + 40, nameSeq % 2 ? '07' : '06'), email: emailOf(name), source: SOURCES[nameSeq % SOURCES.length],
      propertyType: 'any', preApproved: false, notes: note ?? '', ...rest, agent: A(Number(agentIdx ?? 1)).id,
    }, { status, createdDaysAgo, history: hist });
  };

  /* ---------- Offers (with their buyers) ---------- */
  type OfferSeed = { li: number; st: string; amount: number; ago: number; deposit?: number; depPaid?: boolean; bond?: number; deadline?: number; bondOk?: boolean;
    conditions?: string; valid?: number; counter?: number; note?: string };
  const OFFERS: OfferSeed[] = [
    { li: 15, st: 'accepted', amount: 2700000, ago: 8, deposit: 100000, depPaid: true, bond: 2600000, deadline: 3, bondOk: false },
    { li: 16, st: 'accepted', amount: 1950000, ago: 4, deposit: 195000, depPaid: false },
    { li: 17, st: 'accepted', amount: 3100000, ago: 14, deposit: 150000, depPaid: true, bond: 2500000, deadline: 12, bondOk: true },
    ...[18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29].map((li, k): OfferSeed => {
      const l = LISTINGS[li];
      const amount = round(l.price * (0.95 + (k % 4) * 0.015), 5000);
      const cash = k % 5 === 1;
      return { li, st: 'unconditional', amount, ago: -(l.sold ?? 0) + 21, deposit: round(amount * 0.05, 5000), depPaid: true,
        bond: cash ? undefined : round(amount * 0.85, 5000), deadline: cash ? undefined : (l.sold ?? 0) - 2, bondOk: !cash };
    }),
    { li: 6, st: 'submitted', amount: 3050000, ago: 1, deposit: 150000, bond: 2900000, deadline: 30, valid: 2 },
    { li: 13, st: 'countered', amount: 3500000, ago: 3, deposit: 200000, bond: 3200000, deadline: 35, valid: 3, counter: 3650000 },
    { li: 9, st: 'submitted', amount: 2050000, ago: 0, bond: 1900000, deadline: 30, valid: 1, conditions: 'Subject to the sale of the purchaser’s flat at Unit 5, 12 Example Street (fictional) within 45 days.' },
    { li: 11, st: 'declined', amount: 2600000, ago: 20, bond: 2400000, deadline: 10, note: 'Seller declined — too far below asking.' },
    { li: 8, st: 'lapsed', amount: 1150000, ago: 30, deposit: 50000, depPaid: true, bond: 1100000, deadline: -6, bondOk: false, note: 'Bond declined by the bank (simulated) before the deadline.' },
  ];
  const offerLeads: DemoRecord[] = [];
  const offers: DemoRecord[] = OFFERS.map((o, k) => {
    const l = LISTINGS[o.li];
    const buyerStatus = o.st === 'unconditional' ? 'bought' : o.st === 'declined' ? 'viewing' : o.st === 'lapsed' ? 'lost' : 'offer';
    const buyer = lead({ budget: round(o.amount * 1.05, 10000), suburbs: suburbLabel(l.s), minBeds: l.beds, preApproved: !!o.bond && k % 3 === 0, agentIdx: l.agent === 2 ? 0 : l.agent },
      buyerStatus, o.ago + 25, o.st === 'lapsed' ? 'Bond declined (simulated); buyer will re-apply in six months.' : undefined);
    offerLeads.push(buyer);
    const by = AN(l.agent === 2 ? 0 : l.agent);
    const role = agentRole(l.agent === 2 ? 0 : l.agent);
    const hist = [H(o.ago, by, role, 'Offer captured')];
    if (o.st === 'countered') hist.push(H(o.ago - 1, by, role, 'Seller counters', 'Seller will accept R3,650,000.'));
    if (['accepted', 'unconditional', 'lapsed'].includes(o.st)) hist.push(H(o.ago - 1, by, role, 'Seller accepts'));
    if (o.st === 'unconditional') hist.push(H(-(l.sold ?? 0), by, role, 'Conditions met'));
    if (o.st === 'declined') hist.push(H(o.ago - 2, by, role, 'Decline', o.note));
    if (o.st === 'lapsed') hist.push(H(o.ago - 25, by, role, 'Lapse offer', o.note));
    return rec('offers', 'OTP', {
      listing: L(o.li).id, lead: buyer.id, amount: o.amount, deposit: o.deposit ?? 0, depositPaid: o.depPaid ?? false,
      bondRequired: !!o.bond, bondAmount: o.bond ?? '', bondDeadline: o.deadline !== undefined ? day(o.deadline) : '', bondApproved: o.bondOk ?? false,
      conditions: o.conditions ?? '', conditionsFulfilled: o.st === 'unconditional', validUntil: day(o.valid ?? -o.ago + 3), counterAmount: o.counter ?? '', notes: o.note ?? '',
    }, { status: o.st, createdDaysAgo: o.ago, history: hist });
  });
  // Selling prices on sold / registered listings come from the binding offer.
  offers.filter((o) => o.status === 'unconditional').forEach((o) => {
    const l = listings.find((x) => x.id === o.values.listing)!;
    l.values.soldPrice = o.values.amount;
  });

  /* ---------- More buyers (matched against listed properties) ---------- */
  const LISTED = [6, 7, 8, 9, 10, 11, 12, 13, 14];
  const PATTERN = ['new', 'contacted', 'viewing', 'new', 'contacted', 'viewing', 'contacted', 'lost', 'new', 'viewing', 'contacted', 'new', 'viewing', 'lost', 'contacted', 'new', 'viewing', 'contacted', 'lost', 'new'];
  const LOST = ['Bought privately through another agency.', 'Decided to keep renting for another year.', 'Relocating to another province.'];
  const freshLeads = PATTERN.map((status, k) => {
    const target = LISTINGS[LISTED[k % LISTED.length]];
    const offBudget = k % 7 === 6;
    const budget = offBudget ? round(target.price * 1.6, 50000) : round(target.price * (0.94 + rnd() * 0.12), 10000);
    const extra = SUBURBS[Math.floor(rnd() * SUBURBS.length)].label;
    const suburbs = rnd() < 0.5 && extra !== suburbLabel(target.s) ? `${suburbLabel(target.s)}, ${extra}` : suburbLabel(target.s);
    const minBeds = Math.max(1, target.beds - (rnd() < 0.3 ? 1 : 0));
    const ago = status === 'new' ? 1 + (k % 4) : status === 'contacted' ? 6 + (k % 9) : status === 'viewing' ? 12 + (k % 10) : 40 + k;
    return lead({ budget, suburbs, minBeds, preApproved: rnd() < 0.35, agentIdx: [1, 4, 5, 0][k % 4] }, status, ago, status === 'lost' ? LOST[k % LOST.length] : undefined);
  });

  /* ---------- Viewings & show days ---------- */
  const host = (li: number) => (LISTINGS[li].agent === 2 ? 0 : LISTINGS[li].agent);
  const FEEDBACK: Record<string, string[]> = {
    hot: ['Loved the garden and the open-plan kitchen. Wants to discuss an offer tonight.', 'Second viewing with family — ready to put in an offer subject to bond.', 'Very keen; asked for the rates and levies figures to prepare an offer.'],
    warm: ['Liked the layout but finds the second bedroom small. Will compare with two others.', 'Happy with the area; concerned about the busy road. May come back.', 'Good fit on price; spouse still needs to see it.'],
    cold: ['Too much work needed on the bathrooms.', 'Not enough parking for two cars.', 'Prefers a north-facing garden.'],
  };
  const viewing = (li: number, leadId: string, date: number, time: string, status: string, interest = '', kind = 'private', note?: string) => {
    const ago = Math.max(1, -date + 3);
    const hist = [H(ago, AN(host(li)), agentRole(host(li)), 'Viewing booked')];
    if (status === 'completed') hist.push(H(-date, AN(host(li)), agentRole(host(li)), 'Complete with feedback'));
    if (status === 'noshow') hist.push(H(-date, AN(host(li)), agentRole(host(li)), 'No-show'));
    if (status === 'cancelled') hist.push(H(Math.max(0, -date + 1), AN(host(li)), agentRole(host(li)), 'Cancel viewing', note));
    const fb = interest ? FEEDBACK[interest][(li + Math.abs(date)) % 3] : '';
    return rec('viewings', 'VW', { listing: L(li).id, lead: leadId, kind, date: day(date), time, agent: A(host(li)).id, interest, feedback: fb }, { status, createdDaysAgo: ago, history: hist });
  };
  // Every offer was preceded by a viewing.
  OFFERS.forEach((o, k) => viewing(o.li, offerLeads[k].id, -(o.ago + 3 + (k % 5)), ['10:00', '11:30', '14:00', '15:30', '09:30'][k % 5], 'completed', 'hot'));
  // Buyers at the viewing stage: an earlier viewing elsewhere, and one booked now.
  const viewingLeads = freshLeads.filter((x) => x.status === 'viewing');
  const TODAY_SLOTS = ['09:30', '10:30', '11:00', '12:30', '14:00'];
  viewingLeads.forEach((b, k) => {
    const target = LISTED[(freshLeads.indexOf(b)) % LISTED.length];
    const other = LISTED[(freshLeads.indexOf(b) + 3) % LISTED.length];
    viewing(other, b.id, -(6 + k * 2), '16:00', 'completed', k % 2 ? 'cold' : 'warm');
    viewing(target, b.id, 0, TODAY_SLOTS[k % TODAY_SLOTS.length], 'booked');
  });
  viewing(12, '', 0, '15:30', 'booked', '', 'showday');
  viewing(7, viewingLeads[1].id, 0, '08:30', 'completed', 'warm');
  // Lost buyers had cold viewings; some contacted buyers did not arrive.
  freshLeads.filter((x) => x.status === 'lost').forEach((b, k) => viewing(LISTED[(k * 2) % LISTED.length], b.id, -(25 + k * 4), '11:00', 'completed', 'cold'));
  const contacted = freshLeads.filter((x) => x.status === 'contacted');
  viewing(10, contacted[0].id, -4, '17:00', 'noshow');
  viewing(14, contacted[1].id, -9, '12:00', 'noshow');
  viewing(6, viewingLeads[2].id, -2, '10:00', 'booked'); // feedback outstanding
  viewing(13, viewingLeads[3].id, 2, '09:00', 'booked');
  viewing(8, viewingLeads[4].id, 1, '13:00', 'booked');
  viewing(9, viewingLeads[0].id, 4, '10:30', 'booked');
  viewing(13, '', 3, '14:00', 'booked', '', 'showday');
  viewing(11, contacted[2].id, -1, '15:00', 'cancelled', '', 'private', 'Buyer’s car broke down; will rebook.');

  /* ---------- Transfers (conveyancing tracker, simulated) ---------- */
  type TransferSeed = { li: number; st: string; conv: string; expected: number; duty?: boolean; rates?: boolean; lodged?: number };
  const TRANSFERS: TransferSeed[] = [
    { li: 18, st: 'otp', conv: 'ndaba', expected: 78 },
    { li: 19, st: 'bond', conv: 'harbour', expected: 55 },
    { li: 20, st: 'docs', conv: 'coetzee', expected: 30, duty: true, rates: false },
    { li: 21, st: 'lodged', conv: 'ndaba', expected: 4, duty: true, rates: true, lodged: -8 },
    { li: 22, st: 'lodged', conv: 'coetzee', expected: 9, duty: true, rates: true, lodged: -5 },
    { li: 23, st: 'docs', conv: 'harbour', expected: 25, duty: true, rates: true },
    { li: 24, st: 'otp', conv: '', expected: 75 },
    { li: 25, st: 'lodged', conv: 'harbour', expected: -2, duty: true, rates: true, lodged: -16 },
    { li: 26, st: 'registered', conv: 'ndaba', expected: -8, duty: true, rates: true, lodged: -16 },
    { li: 27, st: 'registered', conv: 'coetzee', expected: -20, duty: true, rates: true, lodged: -32 },
    { li: 28, st: 'registered', conv: 'harbour', expected: -50, duty: true, rates: true, lodged: -60 },
    { li: 29, st: 'registered', conv: 'ndaba', expected: -85, duty: true, rates: true, lodged: -97 },
  ];
  const ORDER = ['otp', 'bond', 'docs', 'lodged', 'registered'];
  const STEP = ['', 'Bond approved / cash confirmed', 'Transfer documents signed', 'Lodged (simulated)', 'Registered (simulated)'];
  const transfers = TRANSFERS.map((t) => {
    const l = LISTINGS[t.li];
    const offer = offers.find((o) => o.values.listing === L(t.li).id && o.status === 'unconditional')!;
    const otp = (l.sold ?? 0) - 14;
    const reached = ORDER.indexOf(t.st);
    const end = t.st === 'registered' ? -(l.reg ?? 0) : 1;
    const hist = [H(-(l.sold ?? 0), AN(host(t.li)), agentRole(host(t.li)), `Transfer opened from ${offer.ref}`)];
    for (let k = 1; k <= reached; k++) {
      const at = k === 3 && t.lodged !== undefined ? -t.lodged : k === 4 ? end : Math.round(-(l.sold ?? 0) - ((-(l.sold ?? 0) - end) * k) / 4);
      hist.push(H(at, ADMIN.name, ADMIN.role, STEP[k]));
    }
    return rec('transfers', 'TRF', {
      listing: L(t.li).id, offer: offer.id, conveyancer: t.conv, purchasePrice: offer.values.amount as number, otpSignedOn: day(otp),
      expectedRegistration: day(t.st === 'registered' ? (l.reg ?? 0) - 2 : t.expected), transferDuty: t.duty ?? false, ratesClearance: t.rates ?? false,
      lodgedOn: t.lodged !== undefined ? day(t.lodged) : '', registeredOn: t.st === 'registered' ? day(l.reg ?? 0) : '',
      notes: t.li === 20 ? 'Rates clearance figures requested from the (fictional) municipality.' : t.li === 25 ? 'Deeds office query on the power of attorney (simulated) — re-lodgement expected.' : '',
    }, { status: t.st, createdDaysAgo: -(l.sold ?? 0), history: hist });
  });

  /* ---------- Commission (payable on registration) ---------- */
  transfers.filter((t) => t.status === 'registered').forEach((t, k) => {
    const li = TRANSFERS[transfers.indexOf(t)].li;
    const l = LISTINGS[li];
    const paid = k >= 2;
    rec('commissions', 'COM', {
      listing: L(li).id, transfer: t.id, agent: A(l.agent).id, salePrice: t.values.purchasePrice as number, rate: l.rate ?? 7.5, agentSplit: AGENTS[l.agent][3],
      registeredOn: day(l.reg ?? 0), paidOn: paid ? day((l.reg ?? 0) + 5) : '', notes: '',
    }, { status: paid ? 'paid' : 'payable', createdDaysAgo: -(l.reg ?? 0),
      history: [H(-(l.reg ?? 0), ADMIN.name, ADMIN.role, `Commission payable on registration of ${t.ref}`), ...(paid ? [H(-(l.reg ?? 0) - 5, 'Yusuf Ebrahim', 'Bookkeeper', 'Mark paid (simulated)')] : [])] });
  });

  /* ---------- Rentals & leases ---------- */
  type LeaseSeed = [string, string, string, number, string, string, number, number, string, number, number, number, string, string?];
  // address, suburb, type, beds, landlord, tenant, rent, escalation, vetting, start offset, months, arrears, status, note
  const LEASES: LeaseSeed[] = [
    ['Unit 4 Weaver Court', 'marula', 'apartment', 2, 'Hennie Marais', 'Kagiso Mahlangu', 9500, 8, 'pending', 30, 12, 0, 'application'],
    ['17 Stonechat Lane', 'stonechat', 'house', 3, 'Olivia Pillay', 'Danielle Smit', 14500, 8, 'pending', 45, 12, 0, 'application'],
    ['5 Fig Tree Court', 'wildfig', 'townhouse', 2, 'Gareth Lombard', 'Musa Zwane', 11200, 7.5, 'approved', 20, 12, 0, 'vetting'],
    ['Unit 15 The Sandpiper', 'kingfisher', 'apartment', 1, 'Rachel Goldberg', 'Thato Molefe', 7800, 8, 'pending', 25, 12, 0, 'vetting'],
    ['28 Quartz Lane', 'quartz', 'house', 3, 'Andile Cele', 'Jessica Kruger', 15800, 8, 'approved', 14, 12, 0, 'approved'],
    ['Unit 2 Bramble Court', 'bramble', 'apartment', 2, 'Fiona McKenzie', 'Sipho Radebe', 8900, 7, 'approved', 10, 12, 0, 'approved'],
    ['10 Silverleaf Drive', 'silverleaf', 'townhouse', 3, 'Kobus Venter', 'Amina Essop', 13500, 8, 'approved', 5, 12, 0, 'signed'],
    ['3 Hornbill Close', 'marula', 'house', 4, 'Nomvula Khoza', 'Brandon du Toit', 18500, 8, 'approved', -320, 12, 0, 'active'],
    ['21 Kingfisher Drive', 'kingfisher', 'house', 3, 'Adriaan Botha', 'Lindiwe Sithole', 16200, 8, 'approved', -200, 12, 12400, 'active'],
    ['Unit 6 Silverleaf Mews', 'silverleaf', 'apartment', 2, 'Yasmin Patel', 'Ryan Hendricks', 9900, 7.5, 'approved', -400, 24, 0, 'active'],
    ['9 Stonechat Road', 'stonechat', 'house', 3, 'Mandla Shabalala', 'Karabo Ntuli', 14900, 8, 'approved', -340, 12, 0, 'active'],
    ['14 Wildfig Avenue', 'wildfig', 'house', 3, 'Ruth Abrahams', 'Pieter Coetzee', 15500, 8, 'approved', -150, 12, 7600, 'active'],
    ['Unit 11 Bramble Court', 'bramble', 'apartment', 1, 'Gerhard Steyn', 'Naledi Maseko', 7200, 7, 'approved', -90, 12, 0, 'active'],
    ['2 Quartz Hill Road', 'quartz', 'house', 4, 'Zanele Mthethwa', 'Ashwin Moodley', 21500, 8, 'approved', -500, 24, 0, 'active'],
    ['35 Fernwood Drive', 'fernwood', 'house', 3, 'Craig Jacobs', 'Lerato Khumalo', 15750, 8, 'approved', -60, 12, 3150, 'active'],
    ['Unit 8 Weaver Court', 'marula', 'apartment', 2, 'Priya Naidoo', 'Johan Smit', 9600, 8, 'approved', -250, 12, 0, 'active'],
    ['12 Kingfisher Mews', 'kingfisher', 'townhouse', 2, 'Ingrid Cloete', 'Farah Petersen', 11800, 7.5, 'approved', -30, 12, 0, 'active'],
    ['6 Fernwood Lane', 'fernwood', 'house', 3, 'Sibusiso Ngcobo', 'Hannah Bezuidenhout', 14200, 8, 'approved', -330, 12, 0, 'notice', 'Tenant bought a property; leaving at the end of the lease.'],
    ['Unit 19 Silverleaf Mews', 'silverleaf', 'apartment', 2, 'Lerato Dlamini', 'Vusi Mahlangu', 9300, 8, 'approved', -700, 24, 4200, 'notice', 'Tenant relocating for work.'],
    ['40 Stonechat Road', 'stonechat', 'house', 3, 'Johan Pretorius', 'Carla Fourie', 13800, 8, 'approved', -420, 12, 0, 'ended'],
    ['Unit 1 Hornbill Mews', 'marula', 'apartment', 1, 'Hennie Marais', 'Shaun Daniels', 6900, 8, 'declined', 20, 12, 0, 'declined', 'Affordability below the demo threshold (simulated credit check).'],
  ];
  const LEASE_ORDER = ['application', 'vetting', 'approved', 'signed', 'active', 'notice', 'ended'];
  const LEASE_STEP = ['', 'Start vetting (simulated)', 'Approve tenant', 'Lease signed', 'Tenant moved in', 'Notice given', 'End lease'];
  const leases = LEASES.map(([address, suburb, type, beds, landlord, tenant, rentAmt, esc, vetting, start, months, arrears, status, note], k) => {
    const agentIdx = k % 4 === 3 ? 0 : 3;
    const startDay = start;
    const endDay = start + Math.round((months * 365) / 12) - 1;
    const created = Math.max(3, -start + 25);
    const reached = status === 'declined' ? 1 : LEASE_ORDER.indexOf(status);
    const hist = [H(created, AN(agentIdx), agentRole(agentIdx), 'Rental application captured')];
    for (let s = 1; s <= reached; s++) {
      const at = s === 4 ? -startDay : s === 5 ? (status === 'notice' ? 10 + (k % 3) * 5 : -endDay + 30) : s === 6 ? Math.max(0, -endDay) : Math.max(0, created - s * 4);
      hist.push(H(at, AN(agentIdx), agentRole(agentIdx), LEASE_STEP[s], s === 5 ? note : undefined));
    }
    if (status === 'declined') hist.push(H(created - 4, AN(agentIdx), agentRole(agentIdx), 'Decline application', note));
    return rec('leases', 'LSE', {
      address, suburb, propertyType: type, beds, landlord, tenant, tenantPhone: phone(k + 70, '07'), tenantEmail: emailOf(tenant),
      rent: rentAmt, escalation: esc, deposit: rentAmt * (k % 3 === 0 ? 2 : 1.5), depositReceived: ['signed', 'active', 'notice', 'ended'].includes(status) || k === 5,
      vetting, vettingNotes: vetting === 'approved' ? 'Simulated check: income 3.4× rent, two positive landlord references.' : vetting === 'declined' ? 'Simulated check: income below 3× rent; one adverse listing.' : '',
      startDate: day(startDay), endDate: day(endDay), arrears, agent: A(agentIdx).id, management: k % 3 === 2 ? 'letting' : 'full',
      noticeDate: status === 'notice' ? day(-(10 + (k % 3) * 5)) : '', notes: status === 'notice' || status === 'declined' ? '' : (note ?? ''),
    }, { status, createdDaysAgo: created, history: hist });
  });

  /* ---------- Maintenance ---------- */
  type JobSeed = [number, string, string, string, number, number, string, boolean, string, string?];
  // lease index, problem, category, priority, reported (days ago), quote, contractor, owner approved, status, note
  const JOBS: JobSeed[] = [
    [8, 'Geyser leaking into the ceiling', 'plumbing', 'urgent', 1, 0, '', false, 'logged'],
    [13, 'Gate motor not closing fully', 'security', 'normal', 3, 0, '', false, 'logged'],
    [7, 'Replace burst 150 L geyser', 'plumbing', 'urgent', 2, 9850, 'flowfix', false, 'quoted'],
    [9, 'Kitchen plug point tripping the DB', 'electrical', 'normal', 5, 1450, 'brightspark', false, 'quoted'],
    [11, 'Treat and repaint damp bedroom wall', 'roof', 'low', 20, 4200, 'topcoat', true, 'quoted'],
    [15, 'Oven element replacement', 'appliance', 'normal', 6, 1800, 'handyhands', false, 'approved'],
    [12, 'Blocked shower drain', 'plumbing', 'normal', 4, 950, 'flowfix', false, 'assigned'],
    [16, 'Alarm keypad unresponsive', 'security', 'urgent', 2, 2200, 'gatekeeper', false, 'assigned'],
    [10, 'Fix leaking roof flashing', 'roof', 'normal', 34, 6800, 'topcoat', true, 'completed', 'Flashing resealed; ceiling board replaced.'],
    [14, 'Replace broken window pane', 'general', 'normal', 18, 780, 'handyhands', false, 'completed', 'Pane replaced and putty sealed.'],
    [17, 'Re-grout bathroom tiles', 'general', 'low', 12, 1650, 'handyhands', false, 'cancelled', 'Tenant moving out; owner will attend to it once the unit is vacant.'],
  ];
  const JOB_ORDER = ['logged', 'quoted', 'approved', 'assigned', 'completed'];
  const JOB_STEP = ['', 'Quote received', 'Approve quote', 'Assign contractor', 'Mark completed'];
  JOBS.forEach(([li, title, category, priority, ago, quote, contractor, owner, status, note]) => {
    const reached = status === 'cancelled' ? 1 : JOB_ORDER.indexOf(status);
    const hist = [H(ago, ADMIN.name, ADMIN.role, 'Maintenance request logged')];
    for (let s = 1; s <= reached; s++) hist.push(H(Math.max(0, ago - s * 2), ADMIN.name, ADMIN.role, JOB_STEP[s], s === 4 ? note : undefined));
    if (status === 'cancelled') hist.push(H(Math.max(0, ago - 4), ADMIN.name, ADMIN.role, 'Cancel job', note));
    rec('maintenance', 'MNT', {
      lease: leases[li].id, title, category, priority, reportedOn: day(-ago), contractor, quote: quote || '', ownerApproved: owner, notes: '',
    }, { status, createdDaysAgo: ago, history: hist });
  });

  /* ---------- Demo users ---------- */
  const SALES_MODULES = ['dashboard', 'listings', 'leads', 'viewings', 'offers', 'transfers'];
  const users = [
    user('u_principal', 'Naledi Mokoena', 'Principal property practitioner', 'principal', [], [], true),
    user('u_sales', 'Pieter Swanepoel', 'Sales agent', 'sales', SALES_MODULES, ['listings.manage', 'leads', 'offers.manage']),
    user('u_sales2', 'Ayanda Zungu', 'Sales agent', 'sales', SALES_MODULES, ['listings.manage', 'leads', 'offers.manage']),
    user('u_rental', 'Megan Adams', 'Rental agent', 'rental', ['dashboard', 'leases', 'maintenance'], ['rentals.manage', 'tenants.vet', 'maintenance']),
    user('u_admin', ADMIN.name, 'Property manager / office admin', 'admin', ['dashboard', 'listings', 'leads', 'viewings', 'offers', 'transfers', 'leases', 'maintenance', 'agents'],
      ['listings.manage', 'mandates.approve', 'leads', 'offers.manage', 'rentals.manage', 'tenants.vet', 'maintenance', 'agents.manage']),
    user('u_book', 'Yusuf Ebrahim', 'Bookkeeper', 'bookkeeper', ['dashboard', 'transfers', 'leases', 'agents', 'commission'], ['commission.view', 'commission.pay']),
  ];

  return { users, collections, currentUserId: 'u_principal' };
}
