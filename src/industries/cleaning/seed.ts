// Fictional seed data for the contract cleaning demo. Every client, site, person, supplier,
// asset number and amount is invented. Dates are relative to `today` so the demo always
// looks current, and a small PRNG keeps every reset identical.
import { seeder, user } from '../../core/seed';
import { addDays, daysBetween, monthLabel, parseIso } from '../../core/lib/dates';
import type { DemoRecord, Values } from '../../core/types';
import { FREQUENCIES, INSPECTION_AREAS } from './data';

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

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

/* ---------------- Clients & sites ---------------- */
const CLIENTS: Array<[name: string, sector: string, contact: string, terms: number]> = [
  ['Umthombo Health Group', 'clinic', 'Sr Nomfundo Zwane', 30],
  ['Meridian Property Fund', 'office', 'Gareth Pillay', 30],
  ['Karoo Mutual Assurance', 'office', 'Elmarie Botha', 30],
  ['Protea Ridge School Governing Body', 'school', 'Themba Hadebe', 30],
  ['Highveld College', 'school', 'Dr Annette Roux', 45],
  ['Lakeside Medical Suites', 'clinic', 'Farhana Moosa', 14],
  ['Baobab Square Shopping Centre', 'retail', 'Lebo Mashaba', 30],
  ['Acacia Junction Mall', 'retail', 'Riaan Coetzee', 30],
  ['Sedibeng Logistics', 'office', 'Portia Mnisi', 30],
  ['Blue Crane Attorneys', 'office', 'Sarah Naidoo', 30],
  ['Thornhill Convenience Centre', 'retail', 'Johan Kruger', 30],
  ['Jacaranda Dental Studio', 'clinic', 'Dr Priya Govender', 7],
];

type SiteRow = { name: string; client: number; type: 'office' | 'school' | 'clinic' | 'retail'; suburb: string; m2: number; cleaners: number; days: string; start: string; end: string; fee: number; startAgo: number; endIn: number; sla: number; use: number; sup: number; vacancy?: number; notice?: boolean };
/** `use` is this month's consumables spend as a share of the site budget (budget is derived from it). */
const SITES: SiteRow[] = [
  { name: 'Umthombo Day Clinic', client: 0, type: 'clinic', suburb: 'Midrand', m2: 1850, cleaners: 3, days: 'monsat', start: '06:00', end: '14:00', fee: 46500, startAgo: 610, endIn: 480, sla: 90, use: 0.72, sup: 0 },
  { name: 'Meridian Office Park — Block A', client: 1, type: 'office', suburb: 'Sandton', m2: 6200, cleaners: 4, days: 'weekdays', start: '06:00', end: '14:00', fee: 58000, startAgo: 890, endIn: 205, sla: 85, use: 0.64, sup: 0 },
  { name: 'Meridian Office Park — Block B', client: 1, type: 'office', suburb: 'Sandton', m2: 4100, cleaners: 3, days: 'weekdays', start: '15:00', end: '19:00', fee: 31000, startAgo: 890, endIn: 205, sla: 85, use: 0.51, sup: 0 },
  { name: 'Karoo Mutual Head Office', client: 2, type: 'office', suburb: 'Rosebank', m2: 7800, cleaners: 4, days: 'weekdays', start: '05:30', end: '13:30', fee: 61500, startAgo: 420, endIn: 310, sla: 88, use: 0.83, sup: 0 },
  { name: 'Protea Ridge Primary School', client: 3, type: 'school', suburb: 'Randburg', m2: 9400, cleaners: 4, days: 'weekdays', start: '06:30', end: '14:30', fee: 52000, startAgo: 760, endIn: 335, sla: 80, use: 1.06, sup: 3 },
  { name: 'Protea Ridge Pre-Primary', client: 3, type: 'school', suburb: 'Randburg', m2: 1600, cleaners: 2, days: 'weekdays', start: '06:30', end: '14:30', fee: 24500, startAgo: 395, endIn: 335, sla: 80, use: 0.58, sup: 3 },
  { name: 'Highveld College — Main Campus', client: 4, type: 'school', suburb: 'Centurion', m2: 14500, cleaners: 5, days: 'weekdays', start: '06:00', end: '14:00', fee: 69000, startAgo: 1120, endIn: 250, sla: 82, use: 0.77, sup: 2 },
  { name: 'Highveld College — Sports Centre', client: 4, type: 'school', suburb: 'Centurion', m2: 3200, cleaners: 2, days: 'monsat', start: '13:00', end: '19:00', fee: 26000, startAgo: 540, endIn: 250, sla: 82, use: 0.46, sup: 2 },
  { name: 'Lakeside Medical Suites — North Wing', client: 5, type: 'clinic', suburb: 'Fourways', m2: 2900, cleaners: 3, days: 'monsat', start: '06:00', end: '14:00', fee: 48000, startAgo: 330, endIn: 400, sla: 90, use: 0.88, sup: 3 },
  { name: 'Lakeside Dialysis Unit', client: 5, type: 'clinic', suburb: 'Fourways', m2: 1100, cleaners: 2, days: 'monsat', start: '05:00', end: '13:00', fee: 33500, startAgo: 330, endIn: 400, sla: 92, use: 0.69, sup: 3 },
  { name: 'Baobab Square Shopping Centre', client: 6, type: 'retail', suburb: 'Roodepoort', m2: 18000, cleaners: 5, days: 'daily', start: '07:00', end: '15:00', fee: 74000, startAgo: 980, endIn: 150, sla: 85, use: 1.12, sup: 3 },
  { name: 'Acacia Junction Mall', client: 7, type: 'retail', suburb: 'Kempton Park', m2: 15500, cleaners: 5, days: 'daily', start: '07:00', end: '15:00', fee: 71500, startAgo: 250, endIn: 480, sla: 85, use: 0.81, sup: 1, vacancy: 1 },
  { name: 'Sedibeng Logistics Offices', client: 8, type: 'office', suburb: 'Germiston', m2: 2400, cleaners: 2, days: 'weekdays', start: '07:00', end: '15:00', fee: 25500, startAgo: 692, endIn: 38, sla: 80, use: 0.4, sup: 1 },
  { name: 'Blue Crane Attorneys', client: 9, type: 'office', suburb: 'Brooklyn', m2: 1900, cleaners: 2, days: 'weekdays', start: '17:00', end: '21:00', fee: 21000, startAgo: 709, endIn: 21, sla: 88, use: 0.55, sup: 2, notice: true },
  { name: 'Thornhill Convenience Centre', client: 10, type: 'retail', suburb: 'Benoni', m2: 5600, cleaners: 3, days: 'daily', start: '06:00', end: '14:00', fee: 41000, startAgo: 480, endIn: 250, sla: 82, use: 0.74, sup: 1 },
  { name: 'Jacaranda Dental Studio', client: 11, type: 'clinic', suburb: 'Hatfield', m2: 420, cleaners: 1, days: 'monsat', start: '17:30', end: '20:30', fee: 12800, startAgo: 205, endIn: 160, sla: 90, use: 0.62, sup: 2 },
];
const S = { umthombo: 0, meridianA: 1, highveld: 6, dialysis: 9, baobab: 10, acacia: 11, sedibeng: 12, blueCrane: 13, thornhill: 14 };

const SCOPE: Record<SiteRow['type'], { daily: string[]; weekly: string[]; monthly: string[] }> = {
  office: {
    daily: ['Reception & entrance — vacuum, dust, clean glass doors', 'Ablutions — clean, sanitise and restock', 'Kitchens — wipe surfaces, run dishwasher', 'Open-plan floors — vacuum and spot mop', 'Bins — empty and reline', 'Boardrooms — reset and wipe tables'],
    weekly: ['Internal glass partitions — clean', 'Skirtings & window sills — damp-wipe', 'Fridges & microwaves — clean inside'],
    monthly: ['Air vents & light fittings — dust', 'Chairs — vacuum upholstery'],
  },
  school: {
    daily: ['Classrooms — sweep and mop', 'Ablutions — clean, sanitise and restock (twice daily)', 'Admin block & staff room — dust and vacuum', 'Corridors & stairs — sweep and mop', 'Bins — empty and reline', 'Hall & tuck shop — mop floors'],
    weekly: ['Desks & lockers — damp-wipe', 'Walls & doors — spot clean marks', 'Drinking fountains — descale'],
    monthly: ['Classroom windows — clean inside', 'Hall floor — machine scrub'],
  },
  clinic: {
    daily: ['Consulting rooms — damp-wipe and disinfect touch points', 'Ablutions — clean, disinfect and restock', 'Waiting area & reception — disinfect seating and counters', 'Floors — mop with hospital-grade disinfectant', 'Healthcare waste — remove red bags to the holding area', 'General bins — empty and reline'],
    weekly: ['Curtain rails & high ledges — damp-dust', 'Sluice room — deep clean', 'Staff kitchen — clean fridge'],
    monthly: ['Walls — wash to shoulder height', 'Vents — vacuum covers'],
  },
  retail: {
    daily: ['Mall walkways — machine scrub and dust-mop', 'Public ablutions — clean and restock hourly', 'Food court — clear tables and mop spills', 'Entrances & glass doors — clean', 'Bins & ash trays — empty and reline', 'Lifts & pay stations — wipe touch points'],
    weekly: ['Escalators & balustrades — clean and polish', 'Service corridors — sweep and mop', 'Refuse yard — hose down'],
    monthly: ['Signage & bulkheads — dust', 'Parking stairwells — scrub'],
  },
};

/* ---------------- People ---------------- */
const SUPERVISORS: Array<[first: string, last: string, area: string]> = [
  ['Thandeka', 'Mokoena', 'North'], ['Sibusiso', 'Ndlovu', 'East'], ['Marlene', 'Jacobs', 'Pretoria'], ['Kabelo', 'Molefe', 'West'],
];
const CLEANER_NAMES = [
  'Nokuthula', 'Zodwa', 'Busisiwe', 'Lindiwe', 'Themba', 'Ntombi', 'Precious', 'Sizwe', 'Dimakatso', 'Mpho', 'Refilwe', 'Tshepo', 'Nomvula', 'Bongani', 'Zanele', 'Lucky', 'Palesa',
  'Sipho', 'Thabo', 'Gugu', 'Ayanda', 'Nthabiseng', 'Kagiso', 'Lerato', 'Mandla', 'Fikile', 'Jabu', 'Khanyi', 'Lungile', 'Mbali', 'Neo', 'Ofentse', 'Phindile', 'Queen',
  'Rethabile', 'Sanele', 'Tebogo', 'Unathi', 'Vusi', 'Wandile', 'Xolani', 'Yolanda', 'Zinhle', 'Andile', 'Boitumelo', 'Cynthia', 'Dumisani', 'Esther', 'Faith',
];
const RELIEF_NAMES = ['Gift', 'Hlengiwe', 'Innocent', 'Joyce', 'Katlego', 'Lwazi', 'Mduduzi'];
const SURNAMES = [
  'Khumalo', 'Dube', 'Mahlangu', 'Nkosi', 'Zulu', 'Mthembu', 'Sithole', 'Radebe', 'Tshabalala', 'Maseko', 'Ngcobo', 'Baloyi', 'Mabaso', 'Cele', 'Moloi',
  'Shabalala', 'Mokgosi', 'Hlongwane', 'Phiri', 'Adams', 'Williams', 'Mkhize', 'Gumede', 'Vilakazi', 'Motaung', 'Sibiya', 'Mabena', 'Nhlapo', 'Fourie', 'Daniels',
];

/* ---------------- Stock ---------------- */
type StockRow = [name: string, category: string, unit: string, supplier: string, cost: number, qty: number, reorder: number, hazardous?: boolean, sds?: boolean];
const STOCK: StockRow[] = [
  ['Toilet paper 2-ply', 'paper', 'case of 48', 'Papyrus Hygiene Supplies', 289, 18, 30],
  ['Jumbo toilet roll', 'paper', 'case of 12', 'Papyrus Hygiene Supplies', 345, 26, 12],
  ['Folded paper hand towel', 'paper', 'case of 2 400', 'Papyrus Hygiene Supplies', 410, 31, 15],
  ['Centre-feed wiper roll', 'paper', 'pack of 6', 'Papyrus Hygiene Supplies', 265, 9, 10],
  ['Facial tissues', 'paper', 'case of 36', 'Papyrus Hygiene Supplies', 310, 14, 6],
  ['Hand soap', 'hygiene', '5 L', 'Clearwater Chemicals', 95, 42, 20],
  ['Foam soap cartridge', 'hygiene', 'box of 6', 'Clearwater Chemicals', 420, 11, 8],
  ['Hand sanitiser (alcohol)', 'hygiene', '5 L', 'Clearwater Chemicals', 185, 16, 10, true, true],
  ['Air freshener refill', 'hygiene', 'box of 12', 'Fresh Step Washroom Services', 360, 7, 6],
  ['Urinal screens', 'hygiene', 'pack of 10', 'Fresh Step Washroom Services', 150, 12, 6],
  ['Sanitary bin liners', 'hygiene', 'pack of 100', 'Fresh Step Washroom Services', 120, 0, 8],
  ['Refuse bags — black 750 × 950', 'refuse', 'pack of 200', 'Rand Packaging', 245, 38, 20],
  ['Refuse bags — clear', 'refuse', 'pack of 200', 'Rand Packaging', 260, 22, 12],
  ['Healthcare waste bags — red', 'refuse', 'pack of 100', 'Rand Packaging', 310, 15, 10],
  ['Small bin liners', 'refuse', 'pack of 500', 'Rand Packaging', 190, 27, 12],
  ['Neutral floor cleaner', 'chemical', '5 L', 'Clearwater Chemicals', 110, 34, 15],
  ['Heavy-duty degreaser', 'chemical', '5 L', 'Clearwater Chemicals', 165, 12, 8, true, true],
  ['Hospital-grade disinfectant', 'chemical', '5 L', 'Clearwater Chemicals', 210, 24, 12, true, true],
  ['Bleach', 'chemical', '5 L', 'Clearwater Chemicals', 78, 30, 12, true, true],
  ['Toilet bowl cleaner (acid)', 'chemical', '5 L', 'Clearwater Chemicals', 135, 8, 10, true, true],
  ['Glass cleaner', 'chemical', '5 L', 'Clearwater Chemicals', 98, 19, 8],
  ['Floor stripper', 'chemical', '5 L', 'Summit Floorcare', 240, 10, 4, true, false],
  ['Floor sealer & polish', 'chemical', '5 L', 'Summit Floorcare', 380, 13, 6],
  ['Carpet shampoo', 'chemical', '5 L', 'Summit Floorcare', 175, 9, 4],
  ['Descaler', 'chemical', '5 L', 'Clearwater Chemicals', 190, 6, 4, true, true],
  ['Furniture polish', 'chemical', 'box of 12 aerosols', 'Clearwater Chemicals', 420, 5, 3, true, true],
  ['Microfibre cloths', 'sundries', 'pack of 10', 'Rand Packaging', 140, 44, 15],
  ['Mop heads', 'sundries', 'pack of 5', 'Rand Packaging', 185, 17, 8],
  ['Scourers & sponges', 'sundries', 'pack of 20', 'Rand Packaging', 95, 21, 8],
  ['Nitrile gloves', 'ppe', 'box of 100', 'Guardwell Safety', 115, 36, 15],
  ['Dust masks', 'ppe', 'box of 50', 'Guardwell Safety', 160, 4, 6],
];
/** Items a site of each type draws every month: [stock index, quantity per contracted cleaner]. */
const MONTHLY_DRAW: Record<SiteRow['type'], Array<[item: number, perCleaner: number]>> = {
  office: [[0, 1.5], [5, 1], [11, 1], [15, 0.75]],
  school: [[0, 2], [2, 1], [11, 1.5], [15, 1]],
  clinic: [[2, 1.5], [17, 1.5], [13, 1], [29, 1]],
  retail: [[1, 2], [2, 1.5], [11, 2], [15, 1]],
};

/* ---------------- Periodic tasks ---------------- */
const PERIODIC: Record<SiteRow['type'], Array<[task: string, frequency: string, extra: number, atHeight: boolean]>> = {
  office: [['carpet', 'quarterly', 3200, false], ['windows', 'monthly', 1850, true], ['highdust', 'quarterly', 0, true]],
  school: [['stripseal', 'quarterly', 4500, false], ['windows', 'monthly', 0, false], ['ablutions', 'monthly', 0, false]],
  clinic: [['ablutions', 'weekly', 0, false], ['stripseal', 'quarterly', 3800, false], ['highdust', 'monthly', 0, false]],
  retail: [['pressure', 'monthly', 2400, false], ['windows', 'weekly', 0, true], ['stripseal', 'quarterly', 5200, false]],
};
const PERIODIC_PLAN: Array<[status: string, dueIn: number, doneAgo?: number]> = [
  ['planned', -12], ['planned', 3], ['signedoff', 0, 4], ['planned', 9], ['inprogress', -2], ['planned', 20], ['done', 0, 1],
  ['planned', -5], ['planned', 45], ['signedoff', 0, 9], ['planned', 6], ['planned', 33], ['inprogress', 1], ['planned', 60],
];

/* ---------------- Inspections: points out of 30 per site, oldest first ---------------- */
const INSPECTION_POINTS: number[][] = [
  [28, 27, 28], [26, 27, 26], [25, 26, 27], [27, 28, 27], [24, 25, 26], [26, 27], [26, 25, 23], [25, 26],
  [28, 29, 28], [29, 28, 29], [24, 25, 26], [26, 24, 22], [25, 24], [27, 25], [23, 24, 25], [28, 27],
];

/* ---------------- Complaints ---------------- */
type ComplaintRow = [site: number, kind: string, category: string, priority: string, daysAgo: number, time: string, status: string, by: string, text: string, ackHours?: number, resolution?: string, resolvedAfter?: number];
const COMPLAINTS: ComplaintRow[] = [
  [S.baobab, 'complaint', 'consumables', 'urgent', 1, '15:10', 'logged', 'Lebo Mashaba', 'Public ablutions on the upper level ran out of toilet paper and hand towel during afternoon trade.'],
  [S.highveld, 'complaint', 'quality', 'high', 1, '16:30', 'logged', 'Dr Annette Roux', 'Science block corridor floors left streaky and sticky after the afternoon mop.'],
  [S.meridianA, 'request', 'extra', 'normal', 0, '07:45', 'logged', 'Gareth Pillay', 'Please arrange an extra clean of the 3rd-floor boardroom before Friday’s board meeting.'],
  [S.umthombo, 'complaint', 'missed', 'high', 2, '08:20', 'acknowledged', 'Sr Nomfundo Zwane', 'Consulting room 4 was not cleaned before the first patient.', 1.5],
  [S.acacia, 'complaint', 'quality', 'normal', 3, '11:05', 'acknowledged', 'Riaan Coetzee', 'Food court tables are being wiped but the floor under the tables is not swept.', 30],
  [3, 'request', 'extra', 'low', 4, '09:40', 'acknowledged', 'Elmarie Botha', 'Can the staff fridges on levels 2 and 3 be cleaned out at month end?', 20],
  [S.thornhill, 'complaint', 'conduct', 'high', 5, '13:15', 'inprogress', 'Johan Kruger', 'A tenant reported a cleaner using a phone in the service corridor for a long period.', 2],
  [4, 'complaint', 'missed', 'normal', 6, '10:00', 'inprogress', 'Themba Hadebe', 'Grade 3 classrooms were not mopped on Tuesday.', 5],
  [8, 'complaint', 'quality', 'high', 3, '07:10', 'inprogress', 'Farhana Moosa', 'Dust on the high ledges in the North Wing waiting area.', 3],
  [S.blueCrane, 'complaint', 'damage', 'normal', 8, '18:30', 'inprogress', 'Sarah Naidoo', 'A framed certificate in the partners’ corridor was knocked off the wall and the glass cracked.', 14],
  [1, 'complaint', 'consumables', 'normal', 5, '08:50', 'resolved', 'Gareth Pillay', 'Hand soap dispensers on the ground floor were empty on Monday morning.', 2, 'Dispensers refilled the same morning. Added a Friday afternoon restock check to the daily checklist.', 1],
  [S.dialysis, 'request', 'extra', 'high', 4, '06:30', 'resolved', 'Farhana Moosa', 'Additional terminal clean of bay 2 after a spill.', 0.5, 'Terminal clean done with hospital-grade disinfectant by the team leader; unit manager walked the bay afterwards.', 0],
  [S.baobab, 'complaint', 'missed', 'normal', 7, '12:20', 'resolved', 'Lebo Mashaba', 'Parking level P2 stairwell was not swept for several days.', 6, 'Stairwell scrubbed and added to the morning route sheet. Supervisor to spot-check weekly.', 2],
  [6, 'complaint', 'quality', 'normal', 16, '09:15', 'confirmed', 'Dr Annette Roux', 'Hall floor dull after the weekend function.', 3, 'Hall machine-scrubbed and buffed on Monday before assembly.', 2],
  [0, 'complaint', 'consumables', 'high', 19, '07:55', 'confirmed', 'Sr Nomfundo Zwane', 'Red healthcare waste bags ran out in the treatment room.', 1, 'Emergency issue of two packs from the store; site minimum raised.', 0],
  [S.acacia, 'complaint', 'missed', 'normal', 22, '14:40', 'confirmed', 'Riaan Coetzee', 'Entrance 3 glass doors not cleaned in the morning.', 28, 'Entrance glass moved to the first task of the shift; relief cleaner briefed.', 3],
  [S.sedibeng, 'request', 'extra', 'low', 25, '10:30', 'confirmed', 'Portia Mnisi', 'Once-off clean of the dispatch office after shelving was installed.', 12, 'Done on Saturday morning by the site team; charged as an extra.', 5],
  [15, 'complaint', 'quality', 'normal', 28, '08:05', 'confirmed', 'Dr Priya Govender', 'Streaks on the surgery glass partition.', 4, 'Partition re-cleaned with a microfibre and squeegee; cleaner shown the method.', 1],
  [10, 'complaint', 'conduct', 'high', 33, '11:45', 'confirmed', 'Lebo Mashaba', 'Cleaner arguing with a tenant’s staff member about a wet floor sign.', 2, 'Supervisor met both parties; cleaner counselled and wet-floor procedure re-briefed to the team.', 4],
  [5, 'complaint', 'missed', 'low', 38, '13:00', 'confirmed', 'Themba Hadebe', 'Sandpit area bins overflowing after break.', 9, 'Extra bin round added after second break.', 2],
];

/* ---------------- Equipment ---------------- */
const EQUIPMENT: Array<[type: string, prefix: string, model: string, count: number]> = [
  ['vacuum', 'VAC', 'Numatix NV-200 tub vacuum', 12], ['scrubber', 'SCR', 'Tennox T3 walk-behind', 6], ['polisher', 'POL', 'Orbis 430 single-disc', 5],
  ['extractor', 'EXT', 'Aquajet CX-15 extractor', 3], ['pressure', 'PWR', 'Hydroblast 140 bar', 2], ['trolley', 'TRL', 'Janitor trolley, two-bucket', 7],
];

export function buildCleaningSeed(today: string) {
  const rnd = prng(20261111);
  const { collections, rec, day, line } = seeder(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const m1 = addDays(monthStart, -1).slice(0, 7);
  const m2 = addDays(`${m1}-01`, -1).slice(0, 7);
  /** A day this month: `n` days ago, but never before the 1st. */
  const thisMonth = (n: number) => (day(-n) < monthStart ? monthStart : day(-n));

  const users = [
    user('u_md', 'Nomsa Dlamini', 'Managing director', 'md', [], [], true),
    user('u_ops', 'Deon Fortuin', 'Operations manager', 'ops',
      ['dashboard', 'sites', 'schedule', 'periodic', 'inspections', 'complaints', 'stock', 'issues', 'equipment', 'quotes', 'clients', 'reports', 'staff'],
      ['sites.manage', 'schedule.manage', 'attendance', 'periodic', 'inspections', 'inspections.signoff', 'complaints', 'stores.request', 'equipment', 'quotes', 'quotes.approve', 'staff.manage', 'hr.view']),
    user('u_sup', 'Thandeka Mokoena', 'Area supervisor — North', 'supervisor',
      ['dashboard', 'sites', 'schedule', 'periodic', 'inspections', 'complaints', 'issues', 'equipment', 'staff'],
      ['schedule.manage', 'attendance', 'periodic', 'inspections', 'complaints', 'stores.request', 'equipment']),
    user('u_stores', 'Imraan Petersen', 'Stores & procurement clerk', 'stores',
      ['dashboard', 'stock', 'issues', 'purchasing', 'equipment', 'sites'],
      ['stores.request', 'stores.issue', 'stores.order', 'equipment']),
    user('u_acc', 'Lerato Sithebe', 'Accounts clerk', 'accounts', ['dashboard', 'invoices', 'quotes', 'clients', 'sites', 'reports'], ['invoicing']),
    user('u_liaison', 'Karen van Niekerk', 'Client liaison', 'liaison',
      ['dashboard', 'sites', 'periodic', 'inspections', 'complaints', 'quotes', 'clients'],
      ['complaints', 'quotes', 'inspections.signoff']),
  ];

  /* ---------- Clients & sites ---------- */
  const clients = CLIENTS.map(([name, sector, contact, termsDays], i) =>
    rec('clients', 'CL', { name, sector, contact, phone: `01${1 + (i % 2)} 555 ${String(2100 + i * 173).slice(0, 4)}`, email: `${slug(contact.replace(/^(Sr|Dr) /, ''))}@example.com`, termsDays, notes: '' }, { createdDaysAgo: 300 + i * 40 }));

  const sites = SITES.map((s) => rec('sites', 'ST', {
    name: s.name, client: clients[s.client].id, siteType: s.type, suburb: s.suburb, m2: s.m2, cleanersPerShift: s.cleaners, serviceDays: s.days, shiftStart: s.start, shiftEnd: s.end,
    monthlyFee: s.fee, contractStart: day(-s.startAgo), contractEnd: day(s.endIn), slaTarget: s.sla, consumablesBudget: 0, supervisor: '',
    dailyTasks: SCOPE[s.type].daily.join('\n'), weeklyTasks: SCOPE[s.type].weekly.join('\n'), monthlyTasks: SCOPE[s.type].monthly.join('\n'),
  }, s.notice
    ? { status: 'notice', createdDaysAgo: s.startAgo, history: [{ daysAgo: s.startAgo, by: 'Seed data', role: 'System', action: 'Contract started (fictional record)' }, { daysAgo: 9, by: 'Deon Fortuin', role: 'Operations manager', action: 'Record notice of termination', note: 'Client gave 30 days’ notice after two inspections below SLA; meeting booked to discuss a recovery plan.' }] }
    : { status: 'active', createdDaysAgo: s.startAgo }));

  /* ---------- Staff ---------- */
  let person = 0;
  const addStaff = (firstName: string, lastName: string, role: string, v: Values, status = 'active') => {
    const i = person++;
    return rec('staff', 'EMP', {
      firstName, lastName, role, phone: `0${60 + (i % 25)} 555 ${String(1000 + ((i * 371) % 9000))}`, employmentStart: day(-(120 + ((i * 97) % 2400))), homeSite: '', inductions: '',
      icExpiry: '', chemExpiry: '', heightsExpiry: '', uniformIssued: day(-(20 + ((i * 17) % 330))), ppeIssued: day(-(15 + ((i * 23) % 400))), hrNotes: '', ...v,
    }, { status, createdDaysAgo: 120 + ((i * 97) % 2400) });
  };
  const refsOf = (idx: number[]) => idx.map((i) => sites[i].ref).join(', ');

  const supervisors = SUPERVISORS.map(([first, last, area], i) => addStaff(first, last, 'supervisor', {
    inductions: refsOf(SITES.map((s, si) => (s.sup === i ? si : -1)).filter((si) => si >= 0)), icExpiry: day(120 + i * 40), chemExpiry: day(200 + i * 25),
    hrNotes: i === 1 ? `Acting area supervisor for ${area} since the restructure; salary review outstanding (fictional).` : '',
  }));
  SITES.forEach((s, si) => { sites[si].values.supervisor = supervisors[s.sup].id; });

  const team: DemoRecord[][] = [];
  let nameIdx = 0;
  SITES.forEach((s, si) => {
    team[si] = [];
    const sibling = SITES.findIndex((o, oi) => oi !== si && o.client === s.client);
    for (let j = 0; j < s.cleaners - (s.vacancy ?? 0); j++) {
      const g = nameIdx++;
      const leader = j === 0 && s.cleaners >= 2;
      let ic = s.type === 'clinic' ? day(60 + ((g * 37) % 240)) : g % 4 === 0 ? day(30 + ((g * 53) % 300)) : g % 9 === 4 ? day(-(10 + ((g * 7) % 60))) : '';
      if (si === 8 && j === 2) ic = day(12);
      let chem = leader || s.cleaners === 1 ? day(40 + ((g * 29) % 280)) : g % 3 === 0 ? day(25 + ((g * 31) % 300)) : g % 7 === 3 ? day(-(5 + (g % 40))) : '';
      if (si === S.sedibeng) chem = j === 0 ? day(-18) : '';
      let heights = leader && (s.type === 'retail' || s.m2 > 6000) ? day(70 + ((g * 41) % 250)) : '';
      if (si === S.meridianA && j === 0) heights = day(-9);
      team[si].push(addStaff(CLEANER_NAMES[g], SURNAMES[(g * 7 + 3) % SURNAMES.length], leader ? 'leader' : 'cleaner', {
        homeSite: sites[si].id, inductions: refsOf(leader && sibling >= 0 ? [si, sibling] : [si]), icExpiry: ic, chemExpiry: chem, heightsExpiry: heights,
        hrNotes: g % 11 === 5 ? 'Verbal warning for late-coming on record; improvement noted since (fictional).' : g % 13 === 2 ? 'Has asked for a transfer closer to home — review in the new year (fictional).' : '',
      }, si === S.highveld && j === 4 ? 'leave' : 'active'));
    }
  });
  const onLeave = team[S.highveld][4];
  const reliefSpec: Array<[sitesIdx: number[], v: Values]> = [
    [[0, 1, 8, 9, 15], { icExpiry: day(150), chemExpiry: day(200) }],
    [[0, 4, 6, 8], { icExpiry: day(90) }],
    [[1, 2, 3, 12, 13], { icExpiry: day(120), chemExpiry: day(75) }],
    [[0, 8, 9, 15], { icExpiry: day(-20) }],
    [[10, 11, 14], { chemExpiry: day(100), heightsExpiry: day(180) }],
    [[4, 5, 6, 7], { chemExpiry: day(60) }],
    [[1, 3, 10, 11, 12], { heightsExpiry: day(21) }],
  ];
  const relief = reliefSpec.map(([idx, v], i) => addStaff(RELIEF_NAMES[i], SURNAMES[(i * 11 + 5) % SURNAMES.length], 'relief', { inductions: refsOf(idx), ...v }));
  const [, rBusy, , rExpired, rMall] = relief;

  /* ---------- Shifts: today first so the guide's record ids never change ---------- */
  const runsOn = (days: string, iso: string) => { const dow = parseIso(iso).getDay(); return days === 'daily' || (days === 'monsat' ? dow !== 0 : dow >= 1 && dow <= 5); };
  /** Rostered cleaners for a site on a day offset; a relief cleaner covers the Highveld leave. */
  const rosterFor = (si: number, off: number) => {
    const list = team[si].filter((p) => !(p === onLeave && off >= -3)).map((p) => p.ref);
    if (si === S.highveld && off >= -3) list.push(rBusy.ref);
    return list;
  };
  const stamp = (refs: string[], start: string, offsets: Array<number | null>) =>
    refs.map((r, i) => (offsets[i] === null || offsets[i] === undefined ? '' : `${r}=${hhmm(mins(start) + (offsets[i] as number))}`)).filter(Boolean).join(',');
  const ticks = (n: number) => Array.from({ length: n }, (_, i) => i + 1).join(',');

  const TODAY_PLAN: Array<{ status: string; ins?: Array<number | null>; absent?: number; ticked?: number }> = [
    { status: 'short', ins: [-6, 3, null], absent: 2, ticked: 3 },
    { status: 'clockedin', ins: [-5, -2, 1, 24], ticked: 3 },
    { status: 'scheduled' },
    { status: 'clockedin', ins: [-8, -4, -1, 2], ticked: 6 },
    { status: 'clockedin', ins: [-3, 0, 4, null], ticked: 2 },
    { status: 'clockedin', ins: [-2, 6], ticked: 4 },
    { status: 'clockedin', ins: [-10, -6, -1, 3, -4], ticked: 3 },
    { status: 'scheduled' },
    { status: 'clockedin', ins: [-7, 18, -2], ticked: 4 },
    { status: 'clockedin', ins: [-12, -3], ticked: 5 },
    { status: 'clockedin', ins: [-9, -5, -2, 0, 7], ticked: 3 },
    { status: 'clockedin', ins: [-4, -1, 2, 5], ticked: 2 },
    { status: 'scheduled' },
    { status: 'scheduled' },
    { status: 'clockedin', ins: [-6, -3, 31], ticked: 4 },
    { status: 'scheduled' },
  ];
  // Demo rule: today always has a shift at every site, even on a weekend, so the board is never empty.
  SITES.forEach((s, si) => {
    const plan = TODAY_PLAN[si];
    const refs = rosterFor(si, 0);
    const absentee = plan.absent !== undefined ? team[si][plan.absent] : undefined;
    const history = [{ daysAgo: 3, by: 'Deon Fortuin', role: 'Operations manager', action: 'Confirm roster' }];
    if (plan.status !== 'scheduled') history.push({ daysAgo: 0, by: 'Thandeka Mokoena', role: 'Area supervisor', action: 'Start shift' });
    rec('shifts', 'SH', {
      site: sites[si].id, date: today, start: s.start, end: s.end, cleaners: refs.join(','), clockIns: stamp(refs, s.start, plan.ins ?? []),
      absentees: absentee ? absentee.ref : '', reliefs: si === S.highveld ? rBusy.ref : '', reliefPick: '', checklist: ticks(plan.ticked ?? 0), missedNote: '',
    }, {
      status: plan.status, createdDaysAgo: 7,
      history: absentee
        ? [...history, { daysAgo: 0, by: 'Thandeka Mokoena', role: 'Area supervisor', action: 'Log absence', note: `${absentee.values.firstName} ${absentee.values.lastName} phoned in sick at 05:40 — relief cleaner needed (fictional).` }]
        : history,
    });
  });

  // Two weeks of completed shifts.
  const reliefPool = [relief[0], relief[2], relief[5], relief[6]];
  for (let off = -14; off <= -1; off++) {
    const date = day(off);
    const used = new Set<string>();
    SITES.forEach((s, si) => {
      if (!runsOn(s.days, date)) return;
      const refs = rosterFor(si, off);
      const absent: string[] = [];
      const reliefs: string[] = si === S.highveld && off >= -3 ? [rBusy.ref] : [];
      const lateOrNot = () => (rnd() < 0.07 ? 12 + Math.floor(rnd() * 25) : -9 + Math.floor(rnd() * 14));
      const ins: string[] = [];
      for (const r of refs) {
        if (rnd() < 0.04) absent.push(r);
        else ins.push(`${r}=${hhmm(mins(s.start) + lateOrNot())}`);
      }
      // A relief cleaner covers the Acacia vacancy except every fourth day, which runs one short (credit due).
      if (si === S.acacia && off % 4 !== -2) { refs.push(rMall.ref); reliefs.push(rMall.ref); ins.push(`${rMall.ref}=${hhmm(mins(s.start) + lateOrNot())}`); }
      if (absent.length && rnd() < 0.6) {
        const cover = reliefPool.find((p) => !used.has(p.ref) && String(p.values.inductions).includes(sites[si].ref));
        if (cover) { used.add(cover.ref); refs.push(cover.ref); reliefs.push(cover.ref); ins.push(`${cover.ref}=${hhmm(mins(s.start) + 45 + Math.floor(rnd() * 40))}`); }
      }
      const missed = rnd() < 0.06;
      const v: Values = { site: sites[si].id, date, start: s.start, end: s.end, cleaners: refs.join(','), clockIns: ins.join(','), checklist: ticks(missed ? 5 : 6) };
      if (absent.length) v.absentees = absent.join(',');
      if (reliefs.length) v.reliefs = reliefs.join(',');
      if (missed) v.missedNote = `${SCOPE[s.type].daily[5].split(' — ')[0]} not done — area in use until after the shift; client informed.`;
      rec('shifts', 'SH', v, { status: 'completed', createdDaysAgo: 7 - off, history: [] });
    });
  }

  // The next three days: tomorrow is confirmed, later rosters are still to confirm.
  for (let off = 1; off <= 3; off++) {
    const date = day(off);
    SITES.forEach((s, si) => {
      if (!runsOn(s.days, date)) return;
      const refs = rosterFor(si, off);
      const problem = off === 1 && si === S.dialysis;
      if (problem) refs[1] = rExpired.ref;
      rec('shifts', 'SH', {
        site: sites[si].id, date, start: s.start, end: s.end, cleaners: refs.join(','), clockIns: '', absentees: '', reliefs: si === S.highveld ? rBusy.ref : problem ? rExpired.ref : '', reliefPick: '', checklist: '', missedNote: '',
      }, { status: problem || off === 3 || (off === 2 && si % 2 === 1) ? 'draft' : 'scheduled', createdDaysAgo: 7 - off, history: [{ daysAgo: 6, by: 'Deon Fortuin', role: 'Operations manager', action: 'Roster generated from the site contract' }] });
    });
  }

  /* ---------- Periodic tasks ---------- */
  let k = 0;
  SITES.forEach((s, si) => {
    PERIODIC[s.type].slice(0, s.cleaners <= 2 ? 2 : 3).forEach(([task, frequency, extra, atHeight]) => {
      const days = FREQUENCIES.find((f) => f.value === frequency)!.days;
      let [status, dueIn, doneAgo] = PERIODIC_PLAN[k % PERIODIC_PLAN.length];
      if (si === S.meridianA && task === 'windows') { status = 'planned'; dueIn = 2; doneAgo = undefined; }
      // A weekly or monthly task is never planned further out than one cycle.
      if (doneAgo === undefined && dueIn > days) dueIn = days - 1;
      const lastDone = doneAgo !== undefined ? thisMonth(doneAgo) : day(dueIn - days);
      const nextDue = doneAgo !== undefined ? addDays(lastDone, days) : day(dueIn);
      const unassigned = status === 'planned' && k % 6 === 5;
      const high = atHeight && (s.type !== 'office' || s.m2 > 5000);
      rec('periodic', 'PT', {
        site: sites[si].id, task, frequency, nextDue, lastDone, assignedTo: unassigned ? '' : team[si][0].id, atHeight: high, chargeExtra: extra,
        notes: task === 'stripseal' ? 'After hours only — floors need eight hours to cure.' : high ? 'Above ground level: ladders or reach poles, two-person team.' : '',
      }, { status, createdDaysAgo: 60 + k });
      k++;
    });
  });

  /* ---------- Inspections ---------- */
  // Its own generator: the shift history above draws a different number of values depending on
  // the weekday, and inspection scores must not change with the day the demo is opened.
  const rndScore = prng(20261112);
  const scoreValues = (points: number, fixed?: number[]): Values => {
    const s = fixed ?? Array.from({ length: 6 }, (_, i) => Math.floor(points / 6) + (i < points % 6 ? 1 : 0));
    if (!fixed) {
      for (let n = 0; n < 2; n++) {
        const a = Math.floor(rndScore() * 6);
        const b = Math.floor(rndScore() * 6);
        if (a !== b && s[a] < 5 && s[b] > 1) { s[a]++; s[b]--; }
      }
    }
    return Object.fromEntries(INSPECTION_AREAS.map((area, i) => [area.key, s[i]]));
  };
  const inspection = (si: number, off: number, kind: string, scores: Values, status: string, extra: Values = {}) => {
    const low = INSPECTION_AREAS.filter((a) => Number(scores[a.key]) <= 2 && Number(scores[a.key]) >= 1);
    return rec('inspections', 'QI', {
      site: sites[si].id, date: day(off), kind, inspector: supervisors[SITES[si].sup].id, ...scores, notes: '',
      correctiveAction: low.length && status !== 'draft' ? `${low.map((a) => a.label).join(' and ')}: re-brief the team on the method, supervisor spot check daily for a week.` : '',
      correctiveDue: low.length && status !== 'draft' ? day(off + 7) : '', correctiveDone: low.length > 0 && off < -20, followUpOf: '', ...extra,
    }, { status, createdDaysAgo: Math.max(0, -off) });
  };
  // inspections_1: the guide's draft re-inspection — an area scored 2 with no corrective action yet.
  const guideInspection = inspection(S.acacia, 0, 'reinspection', scoreValues(19, [4, 2, 3, 3, 3, 4]), 'draft', {
    notes: 'Upper-level public ablutions: dispensers empty and floor wet at 10:15. Food court floor not swept under tables.',
  });
  const latest: DemoRecord[] = [];
  INSPECTION_POINTS.forEach((list, si) => {
    const offsets = list.length === 3 ? [-80 + (si % 5), -47 + (si % 4), -16 + (si % 6)] : [-55 + (si % 5), -20 + (si % 6)];
    list.forEach((points, i) => {
      const last = i === list.length - 1;
      const fixed = si === S.highveld && last ? [4, 2, 4, 4, 4, 5] : si === S.acacia && last ? [4, 2, 4, 4, 4, 4] : undefined;
      const off = si === S.highveld && last ? -12 : si === S.acacia && last ? -7 : offsets[i];
      latest[si] = inspection(si, off, i === 1 && si % 4 === 0 ? 'client' : 'routine', scoreValues(points, fixed), last && si % 3 === 0 ? 'submitted' : 'signedoff');
    });
  });
  guideInspection.values.followUpOf = latest[S.acacia].id;
  inspection(S.highveld, -5, 'reinspection', {}, 'draft', { followUpOf: latest[S.highveld].id, notes: `Follow-up to ${latest[S.highveld].ref}: scored 77% against an SLA target of 82%.` });
  inspection(S.blueCrane, 3, 'reinspection', {}, 'draft', { followUpOf: latest[S.blueCrane].id, notes: `Follow-up to ${latest[S.blueCrane].ref}: scored 83% against an SLA target of 88%.` });

  /* ---------- Complaints & requests ---------- */
  COMPLAINTS.forEach(([si, kind, category, priority, daysAgo, time, status, by, text, ackHours, resolution, resolvedAfter]) => {
    const total = mins(time) + Math.round((ackHours ?? 0) * 60);
    rec('complaints', 'CR', {
      site: sites[si].id, kind, category, priority, date: day(-daysAgo), time, reportedBy: by, description: text,
      assignedTo: ['inprogress', 'resolved', 'confirmed'].includes(status) ? supervisors[SITES[si].sup].id : '',
      ackAt: ackHours === undefined ? '' : `${addDays(day(-daysAgo), Math.floor(total / 1440))} ${hhmm(total % 1440)}`,
      resolution: resolution ?? '', resolvedOn: resolvedAfter === undefined ? '' : day(-daysAgo + resolvedAfter),
    }, { status, createdDaysAgo: daysAgo, history: [{ daysAgo, by: 'Karen van Niekerk', role: 'Client liaison', action: `Logged from a call with ${by}` }] });
  });

  /* ---------- Stock, issues & purchase orders ---------- */
  const stock = STOCK.map(([name, category, unit, supplier, cost, qty, reorderLevel, hazardous, sds]) =>
    rec('stock', 'SKU', { name, category, unit, supplier, cost, qty, reorderLevel, hazardous: !!hazardous, sdsOnFile: hazardous ? !!sds : false }, { createdDaysAgo: 400 }));
  const byName = (n: string) => stock.find((x) => x.values.name === n)!;

  // The three open requests in the guide come first: hazardous to an untrained site, more than is in store, and one that goes through.
  const request = (si: number, item: DemoRecord, qty: number, by: DemoRecord, notes: string) =>
    rec('issues', 'ISS', { site: sites[si].id, item: item.id, qty, date: today, requestedBy: `${by.values.firstName} ${by.values.lastName}`, notes }, { status: 'requested', createdDaysAgo: 0, history: [{ daysAgo: 0, by: `${by.values.firstName} ${by.values.lastName}`, role: 'Team leader', action: 'Requested from site' }] });
  request(S.sedibeng, byName('Bleach'), 6, team[S.sedibeng][0], 'For the dispatch ablutions.');
  request(S.baobab, byName('Toilet paper 2-ply'), 40, team[S.baobab][0], 'Month-end trade — upper level ran out yesterday.');
  request(S.umthombo, byName('Hand soap'), 4, team[S.umthombo][0], 'Consulting room dispensers.');

  SITES.forEach((s, si) => {
    let used = 0;
    MONTHLY_DRAW[s.type].slice(0, s.cleaners <= 2 ? 3 : 4).forEach(([itemIdx, perCleaner], n) => {
      const qty = Math.max(1, Math.round(perCleaner * s.cleaners));
      used += qty * Number(stock[itemIdx].values.cost);
      rec('issues', 'ISS', { site: sites[si].id, item: stock[itemIdx].id, qty, date: thisMonth(2 + ((si + n * 3) % 9)), requestedBy: `${team[si][0].values.firstName} ${team[si][0].values.lastName}`, notes: '' },
        { status: n === 0 && si % 4 === 1 ? 'issued' : 'received', createdDaysAgo: 2 + ((si + n * 3) % 9) });
    });
    sites[si].values.consumablesBudget = Math.round(used / s.use / 100) * 100;
    if (si % 2 === 0) {
      const [itemIdx, perCleaner] = MONTHLY_DRAW[s.type][si % 3];
      rec('issues', 'ISS', { site: sites[si].id, item: stock[itemIdx].id, qty: Math.max(1, Math.round(perCleaner * s.cleaners)), date: `${m1}-${String(8 + si).padStart(2, '0')}`, requestedBy: `${team[si][0].values.firstName} ${team[si][0].values.lastName}`, notes: '' },
        { status: 'received', createdDaysAgo: daysBetween(`${m1}-${String(8 + si).padStart(2, '0')}`, today) });
    }
  });

  const po = (item: DemoRecord, qty: number, status: string, expectedIn: number | null, notes = '') =>
    rec('purchaseOrders', 'PO', { item: item.id, qty, supplier: String(item.values.supplier), unitCost: Number(item.values.cost), expected: expectedIn === null ? '' : day(expectedIn), notes }, { status, createdDaysAgo: 12 });
  po(byName('Toilet paper 2-ply'), 60, 'ordered', 1, 'Month-end top-up for the malls.');
  po(byName('Sanitary bin liners'), 20, 'ordered', -3, 'Supplier promised delivery last week — chase.');
  po(byName('Dust masks'), 10, 'toorder', null);
  po(byName('Toilet bowl cleaner (acid)'), 12, 'toorder', null);
  po(byName('Centre-feed wiper roll'), 15, 'toorder', null);
  po(byName('Hand soap'), 30, 'received', -9);
  po(byName('Refuse bags — black 750 × 950'), 40, 'received', -15);

  /* ---------- Equipment ---------- */
  const SERVICE = [-20, 10, 35, 60, 95, -5, 140, 200];
  const TEST = [45, -35, 120, 15, 200, 260, -3, 330];
  let e = 0;
  for (const [type, prefix, model, count] of EQUIPMENT) {
    for (let n = 1; n <= count; n++, e++) {
      const status = e % 12 === 8 ? 'repair' : e % 7 === 3 ? 'available' : 'onsite';
      const site = status === 'onsite' || e % 14 === 3 ? sites[(e * 5 + 1) % sites.length].id : '';
      // Only equipment still in the store may carry an overdue electrical test (it cannot be allocated).
      const testIn = type === 'trolley' ? null : status === 'available' ? TEST[e % TEST.length] : Math.abs(TEST[e % TEST.length]) + 10;
      rec('equipment', 'EQ', {
        assetNo: `${prefix}-${String(n).padStart(3, '0')}`, type, model, site, serviceDue: day(SERVICE[e % SERVICE.length]), electricalTestDue: testIn === null ? '' : day(testIn),
        condition: e % 9 === 4 ? 'poor' : e % 3 === 1 ? 'fair' : 'good', purchased: day(-(200 + ((e * 131) % 1500))),
        notes: status === 'repair' ? 'At the repair agent — motor brushes / cable (fictional).' : '',
      }, { status, createdDaysAgo: 200 + ((e * 131) % 1500) });
    }
  }

  /* ---------- Once-off jobs & quotes ---------- */
  type QuoteRow = { client: string; contact: string; jobType: string; address: string; description: string; lines: Array<[string, number, number]>; cost: number; status: string; sentAgo?: number; jobIn?: number; teamSize?: number; note?: string };
  const QUOTES: QuoteRow[] = [
    { client: 'Kestrel Developments', contact: 'Andre Marais', jobType: 'postconstruction', address: 'Unit 4, Kestrel Business Park, Midrand', description: 'Builder’s clean of a new 1 400 m² office fit-out before handover: dust removal, paint and adhesive spots, windows and frames, floors machine-scrubbed.',
      lines: [['Cleaning labour (hours)', 96, 145], ['Window & frame detail clean', 1, 2800], ['Consumables & chemicals', 1, 1650], ['Scrubber-drier (days)', 2, 450]], cost: 12300, status: 'draft' },
    { client: 'Willowbrook Wedding Venue', contact: 'Chantal du Toit', jobType: 'event', address: 'Plot 12, Muldersdrift', description: 'Clean-up after a 220-guest function: hall, kitchen, ablutions and marquee area.',
      lines: [['Cleaning labour (hours)', 32, 145], ['Consumables & refuse bags', 1, 1760]], cost: 5200, status: 'draft' },
    { client: 'Ferndale Body Corporate', contact: 'Sipho Masondo', jobType: 'deepclean', address: 'Ferndale Heights, Randburg', description: 'Deep clean of common areas: three stairwells, foyer and refuse rooms.',
      lines: [['Cleaning labour (hours)', 48, 145], ['Pressure washer (days)', 1, 650], ['Consumables & chemicals', 1, 1340]], cost: 5600, status: 'draft' },
    { client: 'Ubuntu Community Hall', contact: 'Zanele Mbatha', jobType: 'deepclean', address: 'Tembisa', description: 'Strip and seal of the hall floor and deep clean of ablutions.',
      lines: [['Floor strip & seal (m²)', 380, 28], ['Ablution deep clean', 1, 2400]], cost: 8100, status: 'sent', sentAgo: 3 },
    { client: 'Oakfield Estate Agents', contact: 'Michelle Barnard', jobType: 'moveout', address: '18 Oakfield Road, Bryanston', description: 'Move-out clean of a four-bedroom house, including ovens and carpets.',
      lines: [['Cleaning labour (hours)', 24, 145], ['Carpet extraction (rooms)', 5, 380], ['Consumables', 1, 620]], cost: 3700, status: 'sent', sentAgo: 20 },
    { client: 'Ironwood Engineering', contact: 'Pieter Swanepoel', jobType: 'postconstruction', address: 'Wadeville, Germiston', description: 'Post-renovation clean of the new canteen and change rooms.',
      lines: [['Cleaning labour (hours)', 60, 145], ['Consumables & chemicals', 1, 1900], ['Scrubber-drier (days)', 2, 450]], cost: 7400, status: 'accepted', sentAgo: 9 },
    { client: 'Harmony Church', contact: 'Pastor David Nel', jobType: 'carpets', address: 'Northcliff', description: 'Carpet extraction of the auditorium and upholstery shampoo of 300 chairs.',
      lines: [['Carpet extraction (m²)', 620, 14], ['Upholstery shampoo (chairs)', 300, 12]], cost: 7900, status: 'scheduled', sentAgo: 14, jobIn: 4, teamSize: 6 },
    { client: 'Savanna Print Works', contact: 'Rashid Ismail', jobType: 'deepclean', address: 'Selby, Johannesburg', description: 'Factory office deep clean ahead of an audit visit.',
      lines: [['Cleaning labour (hours)', 40, 145], ['High dusting (hours)', 8, 190], ['Consumables', 1, 980]], cost: 5100, status: 'completed', sentAgo: 18, jobIn: -2, teamSize: 5 },
    { client: 'Bluegum Montessori', contact: 'Lindiwe Mazibuko', jobType: 'deepclean', address: 'Linden', description: 'Holiday deep clean of classrooms and play equipment.',
      lines: [['Cleaning labour (hours)', 36, 145], ['Consumables & disinfectant', 1, 1150]], cost: 4200, status: 'invoiced', sentAgo: 30, jobIn: -12, teamSize: 4 },
    { client: 'Marula Film Studios', contact: 'Tyrone Abrahams', jobType: 'event', address: 'Lanseria', description: 'Daily clean of two sound stages during a five-day shoot.',
      lines: [['Cleaning labour (hours)', 120, 145], ['Consumables', 1, 2200]], cost: 13800, status: 'declined', sentAgo: 26, note: 'Client appointed their existing contractor at a lower day rate.' },
    { client: 'Stonebridge Car Dealership', contact: 'Nadia Khan', jobType: 'postconstruction', address: 'Boksburg', description: 'Showroom builder’s clean after re-tiling.',
      lines: [['Cleaning labour (hours)', 54, 145], ['Tile residue removal (m²)', 450, 9], ['Consumables', 1, 1200]], cost: 8300, status: 'invoiced', sentAgo: 48, jobIn: -33, teamSize: 6 },
  ];
  const quotes = QUOTES.map((q, i) => {
    const history: Array<{ daysAgo: number; by: string; role: string; action: string; note?: string }> = [{ daysAgo: (q.sentAgo ?? 0) + 2, by: 'Karen van Niekerk', role: 'Client liaison', action: 'Quote prepared (fictional record)' }];
    if (q.note) history.push({ daysAgo: 22, by: 'Karen van Niekerk', role: 'Client liaison', action: 'Client declined', note: q.note });
    return rec('quotes', 'QT', {
      clientName: q.client, contact: q.contact, phone: `01${1 + (i % 2)} 555 ${String(4100 + i * 211).slice(0, 4)}`, email: `${slug(q.contact.replace(/^Pastor /, ''))}@example.com`,
      jobType: q.jobType, address: q.address, description: q.description, costEstimate: q.cost, jobDate: q.jobIn === undefined ? '' : day(q.jobIn), teamSize: q.teamSize ?? '',
      teamLeader: q.teamSize ? relief[4 + (i % 2)].id : '', sentOn: q.sentAgo === undefined ? '' : day(-q.sentAgo), approvedBy: q.sentAgo !== undefined && q.cost > 11000 ? 'Deon Fortuin' : '', invoice: '',
      lines: q.lines.map(([d, qty, price]) => line(d, qty, price)),
    }, { status: q.status, createdDaysAgo: (q.sentAgo ?? 0) + 2, history });
  });

  /* ---------- Invoices: two closed months of contract billing plus once-off jobs ---------- */
  const clampToday = (iso: string) => (iso > today ? today : iso);
  [m2, m1].forEach((period, p) => {
    const date = p === 0 ? `${m1}-01` : monthStart;
    SITES.forEach((s, si) => {
      const terms = CLIENTS[s.client][3];
      const lines = [line(`Contract cleaning — ${s.name} — ${monthLabel(period)}`, 1, s.fee)];
      if (si % 5 === 1) lines.push(line('Window cleaning (periodic extra)', 1, 1850));
      if (si % 7 === 3 && p === 1) lines.push(line('Carpet extraction (periodic extra)', 1, 3200));
      const missed = si === S.acacia ? 4 - p : si === 4 && p === 1 ? 2 : si === S.thornhill && p === 0 ? 1 : 0;
      const rate = Math.round((s.fee / (s.cleaners * 22)) * 100) / 100;
      const unpaid = p === 0 ? si === S.blueCrane || si === S.thornhill : si % 4 !== 0;
      rec('invoices', 'INV', {
        kind: 'contract', billTo: CLIENTS[s.client][0], client: clients[s.client].id, site: sites[si].id, quote: '', period, date, dueDate: addDays(date, terms),
        credit: Math.round(missed * rate * 100) / 100, creditNote: missed ? `${missed} cleaner-shift${missed === 1 ? '' : 's'} not staffed × R${rate.toFixed(2)}` : '',
        paidOn: unpaid ? '' : clampToday(addDays(date, p === 0 ? 14 + ((si * 3) % 20) : 3 + (si % 6))), lines,
      }, { status: unpaid ? 'issued' : 'paid', createdDaysAgo: Math.max(0, daysBetween(date, today)) });
    });
  });
  const ONCE_OFF: Array<[quote: number, status: string, ago: number]> = [[8, 'issued', 10], [10, 'paid', 31]];
  ONCE_OFF.forEach(([qi, status, ago]) => {
    const q = quotes[qi];
    const inv = rec('invoices', 'INV', {
      kind: 'onceoff', billTo: String(q.values.clientName), client: '', site: '', quote: q.id, period: day(-ago).slice(0, 7), date: day(-ago), dueDate: day(-ago + 14),
      credit: 0, creditNote: '', paidOn: status === 'paid' ? day(-ago + 9) : '', lines: QUOTES[qi].lines.map(([d, qty, price]) => line(d, qty, price)),
    }, { status, createdDaysAgo: ago });
    q.values.invoice = inv.id;
  });

  return { users, collections, currentUserId: 'u_md' };
}
