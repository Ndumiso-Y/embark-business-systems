// Fictional seed data for the security demo. Every client, site, officer, PSIRA number,
// serial number, case number and vehicle is invented. Dates are relative to `today` and
// the roster is relative to the shift running right now, so the demo always looks current.
import { seeder, user } from '../../core/seed';
import type { DemoRecord, IndustryData, Values } from '../../core/types';
import { addDays, daysBetween } from '../../core/lib/dates';
import { SHIFT_START } from './data';
import {
  buildInvoiceValues, currentSlot, fromMin, minutesAgo, minutesBetween, nextSlot, nowTime, prevSlot, previousPeriod, slotKey, slotPhase,
  staticPostingProblems, toMin, type ShiftKind, type Slot,
} from './helpers';

/** Small deterministic PRNG (same algorithm as optometry/seed.ts) so resets are identical. */
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

type H = { daysAgo: number; by: string; role: string; action: string; note?: string };
const DIRECTOR = 'Thandeka Mabuza';
const CTL = 'Bongani Khumalo';
const CTL_NIGHT = 'Refilwe Motaung';
const SUPERVISOR = 'Sipho Mokoena';
const HR = 'Priya Govender';
const ACCOUNTS = 'Hannes Botha';
const ARMOURY = 'Lucky Mahlaba';
const ROLE = { ctl: 'Control room operator', sup: 'Site supervisor / inspector', dir: 'Operations director', acc: 'Accounts clerk', arm: 'Armoury / equipment controller' };

export const DAYS_BACK = 14;
export const DAYS_AHEAD = 3;
/** Index (in post order) of the armed Grade C post left unfilled tomorrow for the walkthrough. */
const GUIDE_POST = 3;
/** Deterministic ids the walkthrough and the tests rely on. */
export const SEED = {
  guideShift: 'roster_1',
  guideIncident: 'incidents_1',
  reportedIncident: 'incidents_2',
  guideCallout: 'callouts_1',
  guideFirearm: 'equipment_1',
  expiredFirearm: 'equipment_2',
  guideInspection: 'inspections_1',
  lapsedRegular: 'officers_4',
  standby: 'officers_61',
  expiredPsira: 'officers_63',
  lowGrade: 'officers_64',
  noCompetency: 'officers_65',
  notInducted: 'officers_69',
  vehicleAvailable: 'VEH-01',
  vehicleBusy: 'VEH-02',
  vehicleRepair: 'VEH-04',
} as const;

const FIRST = [
  'Sibusiso', 'Thabo', 'Nomsa', 'Johan', 'Lindiwe', 'Mpho', 'Andile', 'Zodwa', 'Pieter', 'Kagiso', 'Nokuthula', 'Themba', 'Charmaine', 'Tshepo', 'Vusi', 'Ayanda', 'Gert', 'Palesa',
  'Mandla', 'Busisiwe', 'Riaan', 'Lebogang', 'Siphiwe', 'Dineo', 'Jabulani', 'Marlene', 'Sizwe', 'Khanyisile', 'Dumisani', 'Faith', 'Bheki', 'Ntombi', 'Wayne', 'Katlego', 'Xolani',
];
const LAST = [
  'Dlamini', 'Nkosi', 'Mahlangu', 'Botha', 'Ndlovu', 'Molefe', 'Zulu', 'Mokoena', 'Pretorius', 'Sithole', 'Khoza', 'Mthembu', 'Adams', 'Radebe', 'Ngcobo', 'Masilela', 'van Wyk', 'Tshabalala',
  'Cele', 'Mabena', 'Jacobs', 'Maseko', 'Shabalala', 'Nel', 'Mkhize', 'Baloyi', 'Hendricks', 'Zwane', 'Chauke', 'Modise', 'Pillay', 'Gumede', 'Lekota', 'Naidoo', 'Mofokeng', 'Buthelezi', 'Sibiya',
];

// client, contact, contract end (days from today), SLA minutes, included call-outs per month, call-out fee, penalty per unfilled shift
const CONTRACTS: Array<[string, string, number, number, number, number, number]> = [
  ['Kloofview Property Fund', 'Yusuf Parker', 210, 15, 6, 480, 950],
  ['Baobab Logistics', 'Elmarie Swart', 45, 15, 4, 480, 850],
  ['Protea Heights Homeowners Association', 'Devi Maharaj', 330, 15, 8, 420, 900],
  ['Umgeni Steel Works', 'Musa Hadebe', 120, 15, 3, 520, 850],
  ['Highveld Private Hospital', 'Dr Carol Meyer', 20, 10, 5, 520, 1100],
  ['Marula Property Holdings', 'Tebogo Sekgobela', 400, 10, 4, 560, 1200],
  ['Silverleaf Schools Trust', 'Helen Abrahams', 260, 15, 3, 420, 700],
  ['Rooiberg Renewables', 'Stefan Kruger', 150, 20, 2, 650, 900],
  ['Jacaranda Body Corporate', 'Nolwazi Dube', 75, 15, 3, 420, 700],
  ['Sandown Motor Group', 'Imran Essop', 500, 15, 3, 480, 850],
];

// name, code, contract index, area (fictional), type, checkpoints, induction required, days since last inspection
const SITES: Array<[string, string, number, string, string, number, boolean, number]> = [
  ['Kloofview Mall', 'KLF', 0, 'Kloofview', 'retail', 8, false, 3],
  ['Baobab Distribution Centre', 'BDC', 1, 'Rietvallei Ext 4', 'logistics', 7, false, 5],
  ['Baobab Cold Store', 'BCS', 1, 'Rietvallei Ext 6', 'logistics', 4, false, 9],
  ['Protea Heights Estate', 'PHE', 2, 'Protea Heights', 'estate', 10, false, 2],
  ['Umgeni Steel Plant', 'USP', 3, 'Umgeni Industrial', 'industrial', 8, true, 12],
  ['Highveld Private Hospital', 'HPH', 4, 'Highveld Ridge', 'health', 6, true, 16],
  ['Marula Office Park', 'MOP', 5, 'Marula Park', 'office', 6, false, 21],
  ['Marula Data Centre', 'MDC', 5, 'Marula Park', 'office', 5, true, 7],
  ['Silverleaf College', 'SLC', 6, 'Silverleaf', 'education', 5, false, 1],
  ['Silverleaf Primary School', 'SLP', 6, 'Silverleaf', 'education', 4, false, 18],
  ['Rooiberg Solar Farm', 'RSF', 7, 'Rooiberg district', 'energy', 9, false, 6],
  ['Jacaranda Court', 'JCC', 8, 'Jacaranda Hill', 'residential', 4, false, 11],
  ['Jacaranda Gardens', 'JCG', 8, 'Jacaranda Hill', 'residential', 4, false, 4],
  ['Sandown Motors Showroom', 'SMS', 9, 'Sandown Ridge', 'motor', 5, false, 8],
];

// site index, post, shift, required grade, armed
const POSTS: Array<[number, string, ShiftKind, string, boolean]> = [
  [0, 'Main entrance', 'day', 'C', false], [0, 'CCTV control room', 'day', 'B', false], [0, 'Parking patrol', 'day', 'D', false], [0, 'Cash office escort', 'day', 'C', true], [0, 'Loading dock', 'day', 'D', false],
  [0, 'CCTV control room', 'night', 'B', false], [0, 'Perimeter patrol', 'night', 'D', false], [0, 'Parking patrol', 'night', 'D', false],
  [1, 'Gatehouse', 'day', 'C', false], [1, 'Yard patrol', 'day', 'D', false], [1, 'Dispatch search', 'day', 'D', false], [1, 'Gatehouse', 'night', 'C', false], [1, 'Yard patrol', 'night', 'D', false],
  [2, 'Gatehouse', 'day', 'D', false], [2, 'Gatehouse', 'night', 'D', false],
  [3, 'Main gate', 'day', 'C', false], [3, 'Visitor gate', 'day', 'D', false], [3, 'Estate patrol', 'day', 'C', true], [3, 'Main gate', 'night', 'C', false], [3, 'Estate patrol', 'night', 'C', true], [3, 'Perimeter', 'night', 'D', false],
  [4, 'Main gate', 'day', 'C', false], [4, 'Weighbridge', 'day', 'D', false], [4, 'Main gate', 'night', 'C', false], [4, 'Scrap yard patrol', 'night', 'C', true],
  [5, 'Casualty entrance', 'day', 'C', false], [5, 'Reception', 'day', 'D', false], [5, 'Parking', 'day', 'E', false], [5, 'Casualty entrance', 'night', 'C', false], [5, 'Ward patrol', 'night', 'D', false],
  [6, 'Access control', 'day', 'D', false], [6, 'Reception', 'day', 'E', false], [6, 'Patrol', 'night', 'D', false],
  [7, 'Access control', 'day', 'B', false], [7, 'Access control', 'night', 'B', true],
  [8, 'Gate', 'day', 'D', false], [8, 'Patrol', 'night', 'D', false],
  [9, 'Gate', 'day', 'E', false], [9, 'Patrol', 'night', 'D', false],
  [10, 'Gatehouse', 'day', 'D', false], [10, 'Perimeter patrol', 'night', 'C', true], [10, 'Gatehouse', 'night', 'D', false],
  [11, 'Concierge', 'day', 'D', false], [11, 'Concierge', 'night', 'D', false],
  [12, 'Gate', 'day', 'E', false], [12, 'Gate', 'night', 'D', false],
  [13, 'Showroom floor', 'day', 'D', false], [13, 'Yard', 'night', 'C', true],
];
const BASE_RATE: Record<string, number> = { A: 29500, B: 24500, C: 19500, D: 16800, E: 14500 };

const OB_TEXT: Array<[string, string]> = [
  ['routine', 'All posts checked — nothing to report.'],
  ['routine', 'Radio check with the control room — loud and clear.'],
  ['visitor', 'Contractor (fictional: Delta Air-con, 2 persons) signed in for the plant room, escorted by client maintenance.'],
  ['delivery', 'Delivery vehicle (demo reg. DEMO 482 GP) checked against the delivery note and released to receiving.'],
  ['patrol', 'Patrol round completed, all checkpoints scanned. Two perimeter lights out on the north fence — reported to client maintenance.'],
  ['routine', 'Keys and access cards counted and correct against the key register.'],
  ['alarm', 'Zone 4 alarm activated — checked on foot, door not latched properly. Secured and reset with the keyholder.'],
  ['visitor', 'Client tenant requested after-hours access; identity checked against the access list and logged.'],
];

// site index, days ago, time, type, severity, title, status
const INCIDENTS: Array<[number, number, string, string, string, string, string]> = [
  [2, 9, '03:10', 'trespass', 'low', 'Two persons found sleeping behind the cold store', 'closed'],
  [3, 12, '21:45', 'vehicle', 'medium', 'Resident vehicle struck the visitor boom', 'closed'],
  [4, 15, '01:30', 'theft', 'high', 'Copper cable cut and removed from the scrap yard', 'closed'],
  [5, 18, '14:20', 'assault', 'medium', 'Visitor became aggressive at casualty reception', 'closed'],
  [0, 21, '11:05', 'theft', 'low', 'Shoplifting suspect detained at a tenant store', 'closed'],
  [6, 24, '19:40', 'fire', 'medium', 'Dustbin fire in the basement parking', 'closed'],
  [10, 27, '02:15', 'breakin', 'high', 'Perimeter fence cut near the inverter station', 'closed'],
  [13, 31, '23:50', 'theft', 'medium', 'Attempted theft of wheels from a display vehicle', 'closed'],
  [1, 36, '16:30', 'access', 'low', 'Driver refused the exit search at dispatch', 'closed'],
  [8, 41, '07:25', 'trespass', 'low', 'Unknown adult on school grounds before opening', 'closed'],
  [11, 47, '22:10', 'vehicle', 'low', 'Visitor vehicle damaged the complex gate motor', 'closed'],
  [3, 55, '04:00', 'breakin', 'high', 'Attempted house break-in — electric fence bridged', 'closed'],
];

function buildCollections(today: string) {
  const rnd = prng(20261109);
  const { collections, rec, day } = seeder(today);
  const time = nowTime();
  const cur = currentSlot(today, time);
  const lookup = { collections } as unknown as IndustryData;

  /* ---------- Contracts, sites, posts ---------- */
  const contracts = CONTRACTS.map(([client, contact, end, sla, included, fee, penalty], i) => rec('contracts', 'CT', {
    client, contactName: contact, phone: `011 555 ${String(1200 + i * 137).slice(-4)}`,
    email: `${contact.replace(/^Dr\s+/, '').toLowerCase().replace(/\s+/g, '.')}@example.com`,
    startDate: day(end - 730), endDate: day(end), slaMinutes: sla, includedCallouts: included, calloutFee: fee, penaltyPerShift: penalty,
    notes: end <= 60 ? 'Renewal proposal sent — awaiting the client’s procurement decision.' : '',
  }, { createdDaysAgo: 400 - i * 9 }));
  const sites = SITES.map(([name, code, ci, area, type, checkpoints, induction], i) => rec('sites', 'ST', {
    name, code, contract: contracts[ci].id, area, type, checkpoints, requiresInduction: induction,
    keyholder: `${FIRST[(i * 5 + 3) % FIRST.length]} ${LAST[(i * 11 + 6) % LAST.length]} · 08${i % 4} 555 ${String(3300 + i * 61).slice(-4)}`,
    postOrders: 'Demo post orders: challenge and log every visitor, keep the occurrence book current, report to the control room hourly.',
  }, { createdDaysAgo: 380 - i * 7 }));
  const posts = POSTS.map(([si, name, shift, grade, armed], i) => rec('posts', 'PST', {
    site: sites[si].id, name, shift, grade, armed, monthlyRate: BASE_RATE[grade] + (armed ? 6500 : 0) + (shift === 'night' ? 1200 : 0),
  }, { createdDaysAgo: 370 - i, history: [] }));
  const siteOf = (post: DemoRecord) => sites[POSTS[posts.indexOf(post)][0]];
  const allCodes = SITES.map((s) => s[1]).join(', ');

  /* ---------- Officers: 48 regulars (one per post), 12 relief, 2 standby, 8 others ---------- */
  const better = (g: string) => (g === 'A' ? 'A' : 'ABCDE'['ABCDE'.indexOf(g) - 1]);
  const officer = (i: number, grade: string, o: { psira: number; comp?: number | null; inductions: string; employment?: string; hrNotes?: string; refresher?: number; medical?: number }) => {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7) % LAST.length];
    const r1 = rnd();
    const r2 = rnd();
    return rec('officers', 'OF', {
      firstName: first, lastName: last, employeeNo: `EMP-${1001 + i}`, psiraNo: `DEMO-PSIRA-${1000000 + ((i * 7919 + 4321) % 8999999)}`, grade,
      psiraExpiry: day(o.psira), ...(o.comp === null || o.comp === undefined ? {} : { competencyExpiry: day(o.comp) }),
      refresherDue: day(o.refresher ?? Math.floor(r1 * 350) - 18), medicalDue: day(o.medical ?? Math.floor(r2 * 380) - 14),
      phone: `0${[72, 82, 83, 61, 79][i % 5]} 555 ${String(4100 + i * 53).slice(-4)}`,
      email: `${first.toLowerCase()}.${last.toLowerCase().replace(/\s+/g, '')}${i >= FIRST.length ? i : ''}@example.com`,
      employment: o.employment ?? 'active', inductions: o.inductions, ...(o.hrNotes ? { hrNotes: o.hrNotes } : {}),
    }, { createdDaysAgo: 600 - i * 6 });
  };
  const psiraSoon: Record<number, number> = { 5: 9, 14: 21, 22: 27, 31: 14, 40: 6 };
  const regulars = POSTS.map(([si, , , grade, armed], i) => {
    const upgrade = rnd() < 0.25;
    const validFor = 40 + Math.floor(rnd() * 460);
    const hasComp = rnd() < 0.15;
    const compFor = 120 + Math.floor(rnd() * 400);
    return officer(i, upgrade ? better(grade) : grade, {
      psira: i === GUIDE_POST ? -3 : psiraSoon[i] ?? validFor,
      comp: armed ? (i === 19 ? 18 : compFor) : hasComp ? compFor + 80 : null,
      inductions: SITES[si][1],
      hrNotes: i === GUIDE_POST ? 'PSIRA renewal submitted late. Removed from the roster until the new certificate is on file (fictional note).' : '',
    });
  });
  const relievers = ['B', 'B', 'B', 'B', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'C'].map((g, k) => officer(48 + k, g, { psira: 90 + k * 31, comp: k < 8 ? 150 + k * 40 : null, inductions: allCodes }));
  officer(60, 'B', { psira: 320, comp: 410, inductions: allCodes, refresher: 200, medical: 240, hrNotes: 'Standby reaction officer — available for short-notice relief.' });
  officer(61, 'B', { psira: 275, comp: 365, inductions: allCodes, refresher: 150, medical: 190, hrNotes: 'Standby reaction officer — available for short-notice relief.' });
  officer(62, 'D', { psira: -20, inductions: 'KLF, BDC', hrNotes: 'Registration lapsed — renewal fee outstanding (fictional note).' });
  officer(63, 'E', { psira: 300, inductions: 'KLF, MOP, SLP', refresher: 120, medical: 160 });
  officer(64, 'C', { psira: 240, inductions: 'KLF, PHE, BDC', refresher: 90, medical: 210 });
  officer(65, 'C', { psira: 180, comp: -10, inductions: 'PHE, RSF', hrNotes: 'Firearm competency renewal booked at the training centre (fictional note).' });
  officer(66, 'D', { psira: 200, inductions: 'USP', employment: 'suspended', hrNotes: 'Suspended pending a disciplinary hearing — found asleep on post (fictional note).' });
  officer(67, 'C', { psira: 150, inductions: 'HPH', employment: 'leave', hrNotes: 'Annual leave — back next week.' });
  officer(68, 'B', { psira: 260, comp: 300, inductions: '', refresher: 140, medical: 175, hrNotes: 'New appointment — site inductions still to be scheduled.' });
  officer(69, 'E', { psira: 340, inductions: 'JCG', refresher: 14, medical: 320, hrNotes: 'New recruit on probation.' });
  const name = (o: DemoRecord | undefined) => (o ? `${String(o.values.firstName)} ${String(o.values.lastName)}` : 'Site officer');

  /* ---------- Duty roster: 14 days back, today and 3 days ahead ---------- */
  const busy = new Set<string>();
  const key = (id: string, s: Slot) => `${id}|${slotKey(s.date, s.kind)}`;
  const free = (id: string, s: Slot) => !busy.has(key(id, s)) && !busy.has(key(id, prevSlot(s))) && !busy.has(key(id, nextSlot(s)));
  const slotRecs = new Map<string, DemoRecord[]>();
  const guidePost = posts[GUIDE_POST];
  rec('roster', 'RS', { date: day(1), post: guidePost.id, officer: '' }, {
    status: 'open', createdDaysAgo: 0,
    history: [{ daysAgo: 0, by: CTL, role: ROLE.ctl, action: 'Post left unfilled', note: 'Regular officer’s PSIRA registration has lapsed. A relief officer still has to be posted for tomorrow.' }],
  });
  for (let d = -DAYS_BACK; d <= DAYS_AHEAD; d++) {
    const date = day(d);
    for (const kind of ['day', 'night'] as const) {
      const slot: Slot = { date, kind };
      const phase = slotPhase(date, kind, today, time);
      const list = posts.filter((p) => p.values.shift === kind);
      const made: DemoRecord[] = [];
      list.forEach((post, pos) => {
        const pi = posts.indexOf(post);
        const roll = rnd();
        const roll2 = rnd();
        if (d === 1 && kind === 'day' && pi === GUIDE_POST) return;
        const site = siteOf(post);
        const ok = (o: DemoRecord) => staticPostingProblems(o, post, site, date).length === 0 && free(o.id, slot);
        const relief = () => {
          for (let k = 0; k < relievers.length; k++) {
            const o = relievers[(d + DAYS_BACK + pi + k) % relievers.length];
            if (ok(o)) return o;
          }
          return undefined;
        };
        const regular = regulars[pi];
        const dayOff = (d + DAYS_BACK + pi) % 6 === 0;
        let who = !dayOff && ok(regular) ? regular : relief();
        let status = phase === 'past' ? 'off' : phase === 'current' ? 'onduty' : 'posted';
        const values: Values = { date, post: post.id, officer: who?.id ?? '' };
        let history: H[] = [];
        if (!who) {
          status = 'open';
        } else if (phase === 'current' && pos === 2) {
          status = 'absent';
          history = [{ daysAgo: 0, by: kind === 'day' ? CTL : CTL_NIGHT, role: ROLE.ctl, action: 'Mark absent', note: 'Phoned in sick at the start of the shift. A relief officer still has to be arranged.' }];
          who = undefined;
        } else if (phase === 'current' && pos === 13) {
          status = 'open';
          values.officer = '';
          history = [{ daysAgo: 0, by: kind === 'day' ? CTL : CTL_NIGHT, role: ROLE.ctl, action: 'Post left unfilled', note: 'Rostered officer swapped out at short notice — nobody posted yet.' }];
          who = undefined;
        } else if (phase === 'current' && pos === 16) {
          status = 'posted';
          history = [{ daysAgo: 1, by: CTL, role: ROLE.ctl, action: 'Post officer' }];
        } else if (phase === 'past' && who === regular && roll < 0.035) {
          const cover = relief();
          if (cover && roll2 < 0.7) {
            values.reliefOfficer = cover.id;
            who = cover;
          } else {
            status = 'absent';
            who = undefined;
          }
        } else if (phase === 'current') {
          values.bookedOn = fromMin(toMin(SHIFT_START[kind]) - 3 - (pos % 9));
          history = [{ daysAgo: 0, by: kind === 'day' ? CTL : CTL_NIGHT, role: ROLE.ctl, action: 'Book on' }];
        }
        if (who) busy.add(key(who.id, slot));
        const r = rec('roster', 'RS', values, { status, createdDaysAgo: Math.max(0, -d), history });
        // 864 shifts dominate the stored size, so their timestamps are kept to day precision.
        r.createdAt = r.updatedAt = r.createdAt.slice(0, 10);
        made.push(r);
      });
      slotRecs.set(slotKey(date, kind), made);
    }
  }
  const inSlot = (s: Slot) => slotRecs.get(slotKey(s.date, s.kind)) ?? [];
  const workerAt = (s: Slot, siteIdx: number) => {
    const r = inSlot(s).find((x) => siteOf(posts.find((p) => p.id === x.values.post)!) === sites[siteIdx] && (x.status === 'onduty' || x.status === 'off'));
    const id = r ? String(r.values.reliefOfficer || r.values.officer) : '';
    return collections.officers.find((o) => o.id === id);
  };
  const past: Slot[] = [];
  for (let s = prevSlot(cur), i = 0; i < 6; i++, s = prevSlot(s)) past.push(s);
  /** Date and time a number of minutes into a shift. */
  const at = (s: Slot, mins: number) => {
    const m = toMin(SHIFT_START[s.kind]) + mins;
    return { date: addDays(s.date, Math.floor(m / 1440)), time: fromMin(m) };
  };
  const ago = (date: string) => Math.max(0, daysBetween(date, today));
  const intoShift = Math.max(1, minutesBetween(cur.date, SHIFT_START[cur.kind], today, time));

  /* ---------- Equipment & armoury (60 items) ---------- */
  const onDuty = inSlot(cur).filter((r) => r.status === 'onduty');
  const armedOnDuty = onDuty.filter((r) => posts.find((p) => p.id === r.values.post)!.values.armed === true);
  const unarmedOnDuty = onDuty.filter((r) => !armedOnDuty.includes(r));
  const lastShift = inSlot(past[0]).filter((r) => r.status === 'off');
  const issue = (shift: DemoRecord | undefined): Values => (shift
    ? { issuedTo: String(shift.values.reliefOfficer || shift.values.officer), issuedShift: shift.id, issuedOn: String(shift.values.date) }
    : {});
  const item = (assetNo: string, category: string, description: string, n: number, extra: Values, status: string, shift?: DemoRecord, history?: H[]) => rec('equipment', 'EQ', {
    assetNo, category, description, serial: `DEMO-SN-${category.slice(0, 2).toUpperCase()}${String(48211 + n * 397).slice(-5)}`, ...extra, ...(status === 'issued' ? issue(shift) : {}),
  }, { status: status === 'issued' && !shift ? 'instore' : status, createdDaysAgo: 300, history });
  const firearmPermit = [410, -12, 19, 380, 290, 505, 240, 330, 150, 460];
  for (let i = 0; i < 10; i++) {
    const shift = i >= 3 && i <= 7 ? armedOnDuty[i - 3] : undefined;
    item(`FA-${String(i + 1).padStart(3, '0')}`, 'firearm', i % 3 === 2 ? 'Pump-action shotgun (fictional “Warden 12”)' : 'Service pistol 9 mm (fictional “Kestrel P9”)', i, { permitExpiry: day(firearmPermit[i]) },
      i === 8 ? 'repair' : shift ? 'issued' : 'instore', shift,
      i === 8 ? [{ daysAgo: 4, by: ARMOURY, role: ROLE.arm, action: 'Send for repair', note: 'Slide not locking back — sent to the (fictional) gunsmith.' }] : undefined);
  }
  for (let i = 0; i < 18; i++) {
    const shift = i < 12 ? unarmedOnDuty[i] ?? onDuty[i] : i === 16 ? lastShift[2] : undefined;
    item(`RAD-${String(i + 1).padStart(2, '0')}`, 'radio', 'Handheld two-way radio (fictional “Talkline T5”)', 20 + i, {}, i === 17 ? 'lost' : shift ? 'issued' : 'instore', shift,
      i === 17 ? [{ daysAgo: 23, by: ARMOURY, role: ROLE.arm, action: 'Report lost', note: 'Not returned after a relief shift; written off after investigation.' }] : undefined);
  }
  for (let i = 0; i < 8; i++) {
    const shift = i < 4 ? onDuty[i * 3] : i === 7 ? lastShift[5] : undefined;
    item(`BC-${String(i + 1).padStart(2, '0')}`, 'bodycam', 'Body-worn camera (fictional “SightLine 2”)', 40 + i, {}, i === 5 ? 'repair' : shift ? 'issued' : 'instore', shift,
      i === 5 ? [{ daysAgo: 6, by: ARMOURY, role: ROLE.arm, action: 'Send for repair', note: 'Cracked lens cover.' }] : undefined);
  }
  for (let i = 0; i < 8; i++) item(`BTN-${String(i + 1).padStart(2, '0')}`, 'baton', 'Expandable baton', 50 + i, {}, i < 5 && onDuty[i * 4 + 1] ? 'issued' : 'instore', onDuty[i * 4 + 1]);
  for (let i = 0; i < 8; i++) item(`PAN-${String(i + 1).padStart(2, '0')}`, 'panic', 'Portable panic button', 60 + i, {}, i < 4 && onDuty[i * 5 + 2] ? 'issued' : 'instore', onDuty[i * 5 + 2]);
  const discs = [190, 240, 75, 130, -8, 310, 24, 205];
  const vehicles = discs.map((disc, i) => item(`VEH-${String(i + 1).padStart(2, '0')}`, 'vehicle', i < 6 ? `Response bakkie “Romeo ${i + 1}” (demo reg. DEMO ${610 + i * 7} GP)` : `Supervisor vehicle “Sierra ${i - 5}” (demo reg. DEMO ${700 + i * 3} GP)`, 70 + i,
    { permitExpiry: day(disc), response: i < 6 }, i === 3 ? 'repair' : 'instore', undefined,
    i === 3 ? [{ daysAgo: 2, by: ARMOURY, role: ROLE.arm, action: 'Send for repair', note: 'Clutch failure — at the (fictional) workshop until further notice.' }] : undefined));

  /* ---------- Occurrence book: last three days ---------- */
  const ob = (siteIdx: number, when: { date: string; time: string }, kind: ShiftKind, type: string, entry: string, by: string, status = 'signed') => rec('ob', 'OB', {
    site: sites[siteIdx].id, date: when.date, time: when.time, shift: kind, type, entry, by,
  }, { status, createdDaysAgo: ago(when.date), history: status === 'signed' ? [{ daysAgo: ago(when.date), by, role: 'Security officer', action: 'Sign entry' }] : [{ daysAgo: ago(when.date), by, role: 'Security officer', action: 'Entry written' }] });
  const mainSites = [0, 1, 3, 4, 5, 7];
  [...past].reverse().forEach((s, idx) => {
    const recent = idx >= past.length - 2;
    sites.forEach((_, si) => {
      const who = name(workerAt(s, si));
      if (mainSites.includes(si)) {
        const [t1, e1] = OB_TEXT[(idx * 3 + si) % OB_TEXT.length];
        ob(si, at(s, 35 + ((si * 17) % 50)), s.kind, t1, e1, who);
        if ((idx + si) % 3 === 0) {
          const [t2, e2] = OB_TEXT[(idx * 5 + si + 3) % OB_TEXT.length];
          ob(si, at(s, 330 + ((si * 23) % 120)), s.kind, t2, e2, who);
        }
      }
      if (idx === past.length - 1 || (recent && mainSites.includes(si))) ob(si, at(s, 715), s.kind, 'handover', `Shift handed over to the ${s.kind === 'day' ? 'night' : 'day'} shift. Keys, radio and occurrence book handed over, site in order.`, who);
    });
  });
  mainSites.forEach((si, k) => {
    const who = name(workerAt(cur, si));
    ob(si, at(cur, Math.min(5 + k, intoShift)), cur.kind, 'routine', `Shift commenced. Took over from the ${cur.kind === 'day' ? 'night' : 'day'} shift, equipment checked and in order.`, who);
    if (k < 3) ob(si, at(cur, Math.min(40 + k * 25, intoShift)), cur.kind, OB_TEXT[k + 2][0], OB_TEXT[k + 2][1], who, 'draft');
  });

  /* ---------- Incidents: 18 over the last 60 days ---------- */
  const inc = (siteIdx: number, d: number, t: string, type: string, severity: string, title: string, status: string, extra: Values = {}, history?: H[]) => rec('incidents', 'INC', {
    site: sites[siteIdx].id, date: day(-d), time: t, type, severity, title, reportedBy: name(regulars[POSTS.findIndex((p) => p[0] === siteIdx)]), ...extra,
  }, { status, createdDaysAgo: d, history: history ?? [{ daysAgo: d, by: CTL, role: ROLE.ctl, action: 'Incident reported' }] });
  inc(1, 2, '02:40', 'breakin', 'high', 'Break-in at the dispatch store — roller door forced', 'investigating', {
    description: 'Night shift yard patrol found the dispatch store roller door forced open at 02:40. Three pallets of small appliances are missing. Suspects left through a cut section of the east fence before the response vehicle arrived.',
    clientNotifiedAt: '02:55', sapsCase: '', noSapsReason: '', rootCause: '', outcome: '',
  }, [
    { daysAgo: 2, by: CTL_NIGHT, role: ROLE.ctl, action: 'Incident reported' },
    { daysAgo: 2, by: CTL_NIGHT, role: ROLE.ctl, action: 'Respond' },
    { daysAgo: 1, by: SUPERVISOR, role: ROLE.sup, action: 'Start investigation', note: 'Scene photographed, fence temporarily repaired. Client stock count in progress.' },
  ]);
  inc(0, 6, '15:35', 'theft', 'medium', 'Handbag snatched in the parking area', 'clientreport', {
    description: 'Shopper’s handbag taken from a trolley on parking level P1. Suspect ran towards the taxi rank. CCTV footage saved for the client.',
    clientNotifiedAt: '15:50', rootCause: 'Parking patrol was covering the loading dock during a delivery, leaving level P1 unpatrolled for 25 minutes.', outcome: '',
    clientReportSent: true, clientReportOn: day(-4),
  }, [
    { daysAgo: 6, by: CTL, role: ROLE.ctl, action: 'Incident reported' },
    { daysAgo: 6, by: CTL, role: ROLE.ctl, action: 'Respond' },
    { daysAgo: 5, by: SUPERVISOR, role: ROLE.sup, action: 'Start investigation' },
    { daysAgo: 4, by: SUPERVISOR, role: ROLE.sup, action: 'Log client report', note: 'Report logged in the demo — nothing was sent.' },
  ]);
  const recent = minutesAgo(today, time, 35);
  inc(3, ago(recent.date), recent.time, 'trespass', 'low', 'Unknown person climbing the perimeter wall near gate 2', 'reported', {
    description: 'Resident reported a person on the wall near gate 2. Estate patrol sent to check.', reportedBy: name(workerAt(cur, 3)),
  });
  const responding = minutesAgo(today, time, 22);
  inc(5, ago(responding.date), responding.time, 'assault', 'medium', 'Visitor threatening nursing staff at casualty', 'responding', {
    description: 'Visitor refused to leave casualty and threatened staff. Officer at casualty entrance is on scene; supervisor en route.', reportedBy: name(workerAt(cur, 5)),
  }, [{ daysAgo: ago(responding.date), by: CTL, role: ROLE.ctl, action: 'Incident reported' }, { daysAgo: ago(responding.date), by: CTL, role: ROLE.ctl, action: 'Respond' }]);
  inc(0, 1, '10:15', 'vehicle', 'medium', 'Delivery truck damaged the loading dock boom', 'investigating', {
    description: 'Truck reversed into the boom arm at the loading dock. Driver details and photographs taken.', clientNotifiedAt: '10:30',
  });
  inc(7, 4, '20:05', 'access', 'high', 'Tailgating into the data hall by an unescorted contractor', 'clientreport', {
    description: 'Contractor followed a staff member through the data hall mantrap without badging. Removed from the hall and access card suspended.',
    clientNotifiedAt: '20:20', sapsCase: '', noSapsReason: 'No offence committed — client is handling it as an internal access-policy breach.',
    rootCause: 'Mantrap anti-tailgate sensor was bypassed for maintenance and not re-armed.', outcome: 'Sensor re-armed, contractor re-inducted. Access control officer briefed.',
    clientReportSent: true, clientReportOn: day(-3),
  });
  INCIDENTS.forEach(([si, d, t, type, severity, title, status], i) => inc(si, d, t, type, severity, title, status, {
    description: 'Reported by the officer on post and recorded in the occurrence book. Closed after the client report was accepted.',
    clientNotifiedAt: fromMin(toMin(t) + 15), sapsCase: severity === 'high' ? `DEMO-CAS ${120 + i * 17}/${Number(day(-d).slice(5, 7))}/${day(-d).slice(0, 4)}` : '',
    rootCause: ['Perimeter lighting out of order', 'Post left unattended during a patrol', 'Client access procedure not followed', 'Fence alarm zone bypassed by the client'][i % 4],
    outcome: ['Suspects removed from site; no loss.', 'Damage recorded and recovered from the responsible party.', 'Case handed to SAPS; client insurer informed.', 'Procedure retrained on site; no further action.'][i % 4],
    clientReportSent: true, clientReportOn: day(-d + 3),
  }, [{ daysAgo: d, by: CTL, role: ROLE.ctl, action: 'Incident reported' }, { daysAgo: Math.max(0, d - 4), by: DIRECTOR, role: ROLE.dir, action: 'Close incident' }]));

  /* ---------- Armed response call-outs ---------- */
  const callout = (siteIdx: number, when: { date: string; time: string }, signal: string, zone: string, status: string, extra: Values = {}) => rec('callouts', 'CO', {
    site: sites[siteIdx].id, date: when.date, receivedAt: when.time, signal, zone, ...extra,
  }, { status, createdDaysAgo: ago(when.date), history: [{ daysAgo: ago(when.date), by: CTL, role: ROLE.ctl, action: 'Alarm signal received' }] });
  const plus = (t: string, m: number) => fromMin(toMin(t) + m);
  callout(3, minutesAgo(today, time, 3), 'panic', 'House 41 — panic button', 'received');
  const c2 = minutesAgo(today, time, 9);
  callout(0, c2, 'intruder', 'Zone 7 — rear service corridor', 'dispatched', { vehicle: vehicles[1].id, dispatchedAt: plus(c2.time, 2) });
  const c3 = minutesAgo(today, time, 26);
  callout(13, c3, 'fence', 'Electric fence — yard east', 'onscene', { vehicle: vehicles[2].id, dispatchedAt: plus(c3.time, 2), onSceneAt: plus(c3.time, 12) });
  const responseMins = [7, 9, 12, 6, 17, 11, 8, 13, 10, 22, 9, 14, 7, 11, 19, 8, 12, 10, 6, 13, 9, 11];
  const outcomes = ['false', 'false', 'usererror', 'positive', 'false', 'fault', 'false', 'arrest', 'usererror', 'false'];
  const signals = ['intruder', 'panic', 'fence', 'intruder', 'tamper', 'fire', 'duress', 'intruder'];
  responseMins.forEach((mins, i) => {
    const d = 1 + Math.floor(i * 1.8);
    const si = [3, 0, 10, 1, 5, 13, 7, 4, 3, 6, 11, 0, 8, 3, 10, 12, 1, 5, 9, 0, 3, 2][i];
    const t = fromMin(((i * 173) % 1380) + 20);
    callout(si, { date: day(-d), time: t }, signals[i % signals.length], `Zone ${1 + (i % 9)}`, i === 7 ? 'cancelled' : 'stooddown', i === 7
      ? { notes: 'Client cancelled with the correct password before dispatch.' }
      : { vehicle: vehicles[[0, 1, 2, 5][i % 4]].id, dispatchedAt: plus(t, 1 + (i % 3)), onSceneAt: plus(t, mins), stoodDownAt: plus(t, mins + 12 + (i % 5) * 4), outcome: outcomes[i % outcomes.length] });
  });

  /* ---------- Patrol rounds ---------- */
  const patrolSites = [0, 1, 3, 4, 7, 10];
  const patrol = (siteIdx: number, s: Slot, due: number, status: string, lateBy = 0, missed = 0) => {
    const total = SITES[siteIdx][5];
    const dueAt = at(s, due);
    const started = at(s, due + lateBy);
    return rec('patrols', 'PR', {
      site: sites[siteIdx].id, date: started.date, shift: s.kind, dueAt: dueAt.time, startedAt: started.time, officer: workerAt(s, siteIdx)?.id ?? '', checkpoints: total,
      ...(status === 'completed' ? { completedAt: at(s, due + lateBy + 25 + total).time, scanned: total - missed, missedPoints: missed ? `CP${total - 1} — gate locked, no key on site${missed > 1 ? `; CP${total} — area flooded` : ''}` : '' } : {}),
    }, { status, createdDaysAgo: ago(started.date), history: [] });
  };
  [...past].slice(0, 4).reverse().forEach((s) => patrolSites.forEach((si) => {
    const rounds = s.kind === 'night' ? [120, 420] : [300];
    for (const due of rounds) {
      const a = rnd();
      const b = rnd();
      patrol(si, s, due + si * 5, 'completed', a < 0.14 ? 20 + Math.floor(b * 25) : Math.floor(b * 8), a > 0.84 ? (b > 0.6 ? 2 : 1) : 0);
    }
  }));
  const due1 = Math.max(0, intoShift - 18);
  const due2 = Math.max(0, intoShift - 44);
  patrol(0, cur, due1, 'started', Math.min(4, intoShift - due1));
  patrol(3, cur, due2, 'started', Math.min(31, intoShift - due2));

  /* ---------- Site inspections and corrective actions ---------- */
  const inspection = (siteIdx: number, d: number, scores: number[], status: string, findings = '', inspector = SUPERVISOR) => rec('inspections', 'INS', {
    site: sites[siteIdx].id, date: day(-d), time: fromMin(540 + ((siteIdx * 47 + d * 13) % 420)), inspector,
    uniform: String(scores[0]), postOrders: String(scores[1]), obUpToDate: String(scores[2]), equipment: String(scores[3]), alertness: String(scores[4]), findings,
  }, { status, createdDaysAgo: d, history: [{ daysAgo: d, by: inspector, role: ROLE.sup, action: status === 'submitted' ? 'Submit inspection' : 'Inspection started' }] });
  inspection(5, 0, [2, 1, 0, 2, 2], 'draft', 'Night officer could not name the fire assembly point. Occurrence book not written up since 22:00 the previous night.');
  const findingsText = ['Officer without name badge.', 'Post orders file missing two pages.', 'Occurrence book entries not numbered.', 'Torch not working — battery to be replaced.', 'Officer slow to challenge the inspector at the gate.'];
  const lastBySite: DemoRecord[] = SITES.map((s, si) => {
    const scores = [2, 2, 2, 2, 2];
    if (si % 4 === 1) scores[si % 5] = 1;
    if (si === 6) { scores[2] = 0; scores[4] = 1; }
    const weak = scores.findIndex((x) => x < 2);
    return inspection(si, s[7], scores, 'submitted', weak >= 0 ? findingsText[weak] : '', si % 3 === 2 ? 'Lerato Phiri' : SUPERVISOR);
  });
  SITES.forEach((s, si) => { if (si % 2 === 0) inspection(si, s[7] + 13 + (si % 3), [2, 2, si % 4 === 0 ? 1 : 2, 2, 2], 'submitted', si % 4 === 0 ? findingsText[2] : ''); });
  const action = (siteIdx: number, insp: DemoRecord, description: string, due: number, status: string, owner = SUPERVISOR) => rec('actions', 'CA', {
    site: sites[siteIdx].id, inspection: insp.id, description, owner, due: day(due),
  }, { status, createdDaysAgo: Number(SITES[siteIdx][7]), history: [{ daysAgo: Number(SITES[siteIdx][7]), by: SUPERVISOR, role: ROLE.sup, action: `Raised from inspection ${insp.ref}` }] });
  action(6, lastBySite[6], 'Occurrence book up to date: book not written up for two shifts — retrain both officers and check daily for a week.', -7, 'open');
  action(6, lastBySite[6], 'Alertness: officer found away from post — written warning and follow-up visit.', -4, 'open', HR);
  action(1, lastBySite[1], 'Post orders known: replace the missing pages in the post orders file.', 2, 'open');
  action(5, lastBySite[5], 'Uniform & appearance: issue replacement name badges to the casualty entrance officers.', 5, 'open');
  action(9, lastBySite[9], 'Alertness: gate officer slow to challenge visitors — coached on site, follow-up visit done.', -4, 'done');
  action(13, lastBySite[13], 'Equipment: replace the faulty torch at the showroom post.', -1, 'done', ARMOURY);

  /* ---------- Invoices: the two previous months ---------- */
  const thisPeriod = today.slice(0, 7);
  const prev1 = previousPeriod(thisPeriod);
  const prev2 = previousPeriod(prev1);
  const unfilledHistory: Record<string, number[]> = { [prev2]: [0, 1, 0, 0, 2, 0, 0, 1, 0, 0], [prev1]: [1, 0, 0, 2, 0, 1, 0, 0, 0, 1] };
  const billableHistory: Record<string, number[]> = { [prev2]: [1, 0, 2, 0, 0, 0, 0, 0, 1, 0], [prev1]: [2, 0, 1, 0, 0, 0, 0, 1, 0, 0] };
  for (const period of [prev2, prev1]) {
    contracts.forEach((c, i) => {
      const issueDate = addDays(`${period}-01`, 31).slice(0, 8) + '01';
      const overdue = period === prev2 && i === 8;
      const dueDate = addDays(issueDate, overdue ? 14 : 30);
      const paid = period === prev2 ? !overdue : i === 2 || i === 6;
      const d = ago(issueDate);
      const payAfter = 9 + (i % 6) * 3;
      rec('invoices', 'INV', {
        ...buildInvoiceValues(lookup, c, period, today, time, { unfilled: unfilledHistory[period][i], billable: billableHistory[period][i] }),
        issueDate, dueDate, paidOn: paid ? addDays(issueDate, Math.min(payAfter, d)) : '',
      }, { status: paid ? 'paid' : 'issued', createdDaysAgo: d, history: [{ daysAgo: d, by: ACCOUNTS, role: ROLE.acc, action: 'Issue invoice' }, ...(paid ? [{ daysAgo: Math.max(0, d - payAfter), by: ACCOUNTS, role: ROLE.acc, action: 'Record payment' }] : [])] });
    });
  }
  return collections;
}

export function buildSecuritySeed(today: string) {
  const collections = buildCollections(today);
  const all = ['dashboard', 'roster', 'ob', 'incidents', 'callouts', 'sites', 'patrols', 'inspections', 'officers', 'equipment', 'contracts', 'invoices', 'reports'];
  const users = [
    user('u_dir', DIRECTOR, 'Operations director', 'director', all, [], true),
    user('u_ctl', CTL, 'Control room operator (day)', 'control', ['dashboard', 'roster', 'ob', 'incidents', 'callouts', 'sites', 'patrols', 'officers', 'equipment'], ['roster.manage', 'roster.book', 'ob.record', 'incidents.manage', 'callouts.dispatch', 'patrols']),
    user('u_ctl2', CTL_NIGHT, 'Control room operator (night)', 'control', ['dashboard', 'roster', 'ob', 'incidents', 'callouts', 'sites', 'patrols', 'officers', 'equipment'], ['roster.manage', 'roster.book', 'ob.record', 'incidents.manage', 'callouts.dispatch', 'patrols']),
    user('u_sup', SUPERVISOR, 'Site supervisor / inspector', 'supervisor', ['dashboard', 'roster', 'ob', 'incidents', 'sites', 'patrols', 'inspections', 'officers', 'equipment'], ['roster.book', 'ob.record', 'incidents.manage', 'patrols', 'inspections']),
    user('u_hr', HR, 'HR & compliance officer', 'hr', ['dashboard', 'officers', 'roster', 'inspections', 'reports'], ['compliance', 'hr.notes']),
    user('u_acc', ACCOUNTS, 'Accounts clerk', 'accounts', ['dashboard', 'contracts', 'sites', 'invoices', 'reports'], ['contracts', 'invoicing']),
    user('u_arm', ARMOURY, 'Armoury / equipment controller', 'armoury', ['dashboard', 'equipment', 'officers', 'roster'], ['equipment.issue']),
  ];
  return { users, collections, currentUserId: 'u_dir' };
}
