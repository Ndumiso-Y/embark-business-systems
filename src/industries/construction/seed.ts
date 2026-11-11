// Fictional seed data for Ironbark Building & Civils. Every person, client,
// supplier, subcontractor, grade, reference and amount is invented. Dates are
// relative to `today` so the demo always looks current.
import { seeder, user } from '../../core/seed';
import type { DemoRecord, Values } from '../../core/types';
import { parseIso } from '../../core/lib/dates';
import { computeValuation } from './helpers';

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

export const PEOPLE = {
  md: 'Andile Khumalo',
  pm1: 'Heinrich van der Merwe',
  pm2: 'Nadia Pillay',
  sa: 'Sizwe Ndlovu',
  qs: 'Lindiwe Mahlangu',
  so: 'Johan Erasmus',
  ps: 'Fatima Davids',
} as const;

type H = { daysAgo: number; by: string; role: string; action: string; note?: string };
const ROLE = { md: 'Managing director', pm: 'Project manager', sa: 'Site agent / foreman', qs: 'Quantity surveyor', so: 'Safety officer', ps: 'Procurement & stores' };
const ago = (off: number) => Math.max(0, -off);

/** Phase templates: [name, start fraction, finish fraction, milestone?, trade]. */
type Phase = [string, number, number, boolean, string];
const BUILDING: Phase[] = [
  ['Site establishment', 0, 0.04, false, ''],
  ['Earthworks & excavations', 0.03, 0.12, false, 'earthworks'],
  ['Foundations & surface beds', 0.1, 0.25, false, 'concrete'],
  ['Superstructure — frame & brickwork', 0.22, 0.55, false, 'brickwork'],
  ['Roof structure & covering', 0.5, 0.64, false, 'roofing'],
  ['Milestone: roof on (weathertight)', 0.64, 0.64, true, ''],
  ['Electrical & plumbing first fix', 0.45, 0.8, false, 'plumbing'],
  ['Milestone: services first fix complete', 0.82, 0.82, true, ''],
  ['Windows, doors & glazing', 0.58, 0.75, false, 'glazing'],
  ['Finishes — plaster, tiling & paint', 0.66, 0.92, false, 'painting'],
  ['External works & paving', 0.78, 0.95, false, ''],
  ['Snagging & handover', 0.93, 1, false, ''],
  ['Milestone: practical completion', 1, 1, true, ''],
];
const CIVILS: Phase[] = [
  ['Site establishment & traffic accommodation', 0, 0.05, false, ''],
  ['Clearing, grubbing & bulk earthworks', 0.04, 0.22, false, 'earthworks'],
  ['Stormwater pipes & culverts', 0.15, 0.45, false, 'plumbing'],
  ['Milestone: stormwater outfall complete', 0.45, 0.45, true, ''],
  ['Layer works — subbase & base', 0.35, 0.68, false, ''],
  ['Kerbs & channels', 0.55, 0.78, false, 'concrete'],
  ['Asphalt surfacing', 0.7, 0.9, false, 'surfacing'],
  ['Road marking & signage', 0.88, 0.96, false, ''],
  ['Milestone: practical completion', 1, 1, true, ''],
];

const smooth = (p: number) => { const x = Math.min(1, Math.max(0, p)); return x * x * (3 - 2 * x); };
const round = (n: number, to: number) => Math.round(n / to) * to;

export function buildConstructionSeed(today: string) {
  const rnd = prng(20261111);
  const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const { collections, rec, day } = seeder(today);

  const users = [
    user('u_md', PEOPLE.md, 'Managing director', 'md', [], [], true),
    user('u_pm1', PEOPLE.pm1, 'Project manager', 'pm',
      ['dashboard', 'projects', 'programme', 'diary', 'variations', 'valuations', 'procurement', 'plant', 'snags', 'subcontractors', 'safety'],
      ['projects.manage', 'programme', 'diary', 'diary.sign', 'variations.record', 'variations.approve', 'procurement.request', 'snags', 'safety.report']),
    user('u_pm2', PEOPLE.pm2, 'Project manager', 'pm',
      ['dashboard', 'projects', 'programme', 'diary', 'variations', 'valuations', 'procurement', 'plant', 'snags', 'subcontractors', 'safety'],
      ['projects.manage', 'programme', 'diary', 'diary.sign', 'variations.record', 'variations.approve', 'procurement.request', 'snags', 'safety.report']),
    user('u_sa', PEOPLE.sa, 'Site agent', 'site',
      ['dashboard', 'projects', 'programme', 'diary', 'variations', 'procurement', 'plant', 'snags', 'safety', 'subcontractors'],
      ['programme', 'diary', 'diary.sign', 'variations.record', 'procurement.request', 'plant', 'snags', 'safety.report']),
    user('u_qs', PEOPLE.qs, 'Quantity surveyor', 'qs',
      ['dashboard', 'projects', 'programme', 'variations', 'valuations', 'procurement', 'plant', 'subcontractors'],
      ['variations.record', 'variations.price', 'valuations', 'subcontractors']),
    user('u_so', PEOPLE.so, 'Safety officer (SHE)', 'safety',
      ['dashboard', 'projects', 'diary', 'snags', 'plant', 'safety', 'subcontractors'],
      ['safety.report', 'safety', 'subcontractors']),
    user('u_ps', PEOPLE.ps, 'Procurement & stores', 'procurement',
      ['dashboard', 'projects', 'procurement', 'plant', 'subcontractors'],
      ['procurement', 'procurement.request', 'plant']),
  ];

  /* ---------- Subcontractors ---------- */
  type Sub = [string, string, string, string, string, number, number, boolean];
  const subs: Sub[] = [
    // company, trade, contact first, contact last, grade, COIDA offset, tax offset, safety file approved
    ['Masakhane Earthworks', 'earthworks', 'Bongani', 'Sithole', '6 CE', 120, 200, true],
    ['Kwezi Formwork & Concrete', 'concrete', 'Riaan', 'Botha', '5 GB', 90, 45, true],
    ['Steelfix Rebar Services', 'rebar', 'Mpho', 'Lekganyane', '4 GB', 60, 150, true],
    ['Sunrise Brick & Plaster', 'brickwork', 'Elias', 'Mokoena', '3 GB', 25, 180, true],
    ['Overberg Roofing & Waterproofing', 'roofing', 'Liezel', 'Fourie', '4 GB', 200, 12, true],
    ['Lumen Electrical Contractors', 'electrical', 'Yusuf', 'Adams', '5 EP', 150, 90, true],
    ['Aqua-Flo Plumbing', 'plumbing', 'Tshepo', 'Molefe', '4 ME', -18, 60, true],
    ['Ndlovu Structural Steel', 'steel', 'Themba', 'Ndlovu', '5 SQ', 110, -9, true],
    ['Clearview Aluminium & Glazing', 'glazing', 'Priya', 'Naidoo', '3 SH', 80, 140, true],
    ['Rainbow Painting Contractors', 'painting', 'Sipho', 'Dube', '2 GB', 170, 210, false],
    ['Tile Masters', 'tiling', 'Marco', 'de Sousa', '2 GB', 65, 75, true],
    ['Asphaltech Surfacing', 'surfacing', 'Gerhard', 'Venter', '7 CE', 140, 100, true],
    ['Secure Perimeter Fencing', 'fencing', 'Lerato', 'Mabaso', '2 GB', 40, 28, true],
    ['Mzansi Drainage & Civils', 'plumbing', 'Andries', 'Mahlangu', '5 CE', 100, 160, true],
  ];
  const subRecs = subs.map(([company, trade, first, last, grade, coida, tax, file], i) => rec('subcontractors', 'SUB', {
    company: `${company} (fictional)`, trade, contactName: `${first} ${last}`,
    phone: `0${[82, 83, 72, 61, 79][i % 5]} 555 ${String(3100 + i * 37).slice(-4)}`,
    email: `${first.toLowerCase()}.${last.toLowerCase().replace(/\s+/g, '')}@example.com`,
    cidbRegNo: `DEMO-CRS-${10240 + i * 13}`, cidbGrade: `${grade} (demo)`,
    coidaExpiry: day(coida), taxExpiry: day(tax), safetyFileApproved: file,
    notes: file ? '' : 'Safety file submitted — awaiting SHE officer review.',
  }, { createdDaysAgo: 400 - i * 11 }));
  const subBy = (name: string) => subRecs.find((s) => String(s.values.company).startsWith(name))!;
  const subForTrade = (trade: string) => subRecs.find((s) => s.values.trade === trade && !['Aqua-Flo Plumbing', 'Ndlovu Structural Steel'].some((x) => String(s.values.company).startsWith(x)));

  /* ---------- Projects ---------- */
  type P = {
    key: string; name: string; client: string; site: string; kind: 'building' | 'civils'; contractType: string; value: number; start: number; end: number;
    retention: number; pm: string; agent: string; status: string; budget: number; costShare: number; eot: number; factor: number; holdAt?: number; pc?: number; notes?: string;
  };
  const projects: P[] = [
    { key: 'school', name: 'Umgeni Ridge Primary — classroom block', client: 'Umgeni Ridge Schools Trust (fictional)', site: 'Erf 1182, Umgeni Ridge (fictional)', kind: 'building', contractType: 'lumpsum', value: 18_450_000, start: -190, end: 75, retention: 5, pm: PEOPLE.pm1, agent: PEOPLE.sa, status: 'onsite', budget: 16_300_000, costShare: 0.8, eot: 0, factor: 1 },
    { key: 'warehouse', name: 'Rietvlei Business Park — Unit C warehouse', client: 'Rietvlei Property Holdings (fictional)', site: 'Stand 44, Rietvlei Business Park (fictional)', kind: 'building', contractType: 'designbuild', value: 32_600_000, start: -250, end: 20, retention: 10, pm: PEOPLE.pm1, agent: 'Tiaan Koekemoer', status: 'onsite', budget: 29_100_000, costShare: 0.86, eot: 5, factor: 0.84 },
    { key: 'roads', name: 'Sonop Ext 4 — roads & stormwater upgrade', client: 'Sonop Local Development Agency (fictional)', site: 'Sonop Extension 4 (fictional)', kind: 'civils', contractType: 'remeasure', value: 24_500_000, start: -130, end: 200, retention: 10, pm: PEOPLE.pm2, agent: 'Bheki Zwane', status: 'onsite', budget: 21_700_000, costShare: 0.78, eot: 0, factor: 1 },
    { key: 'clinic', name: 'Marula Heights clinic extension', client: 'Marula Health Partners (fictional)', site: '12 Marula Avenue, Marula Heights (fictional)', kind: 'building', contractType: 'lumpsum', value: 9_800_000, start: -330, end: -25, retention: 5, pm: PEOPLE.pm2, agent: PEOPLE.sa, status: 'practical', budget: 8_750_000, costShare: 0.84, eot: 10, factor: 1, pc: -12 },
    { key: 'bluegum', name: 'Bluegum Retirement Village — phase 2', client: 'Bluegum Lifestyle Estates (fictional)', site: 'Portion 7, Bluegum Farm (fictional)', kind: 'building', contractType: 'designbuild', value: 41_200_000, start: 14, end: 430, retention: 5, pm: PEOPLE.pm1, agent: 'Tiaan Koekemoer', status: 'awarded', budget: 36_900_000, costShare: 0, eot: 0, factor: 1 },
    { key: 'ridgeview', name: 'Ridgeview townhouses (24 units)', client: 'Ridgeview Developments (fictional)', site: 'Erf 3301, Ridgeview (fictional)', kind: 'building', contractType: 'lumpsum', value: 27_900_000, start: -95, end: 270, retention: 10, pm: PEOPLE.pm2, agent: 'Bheki Zwane', status: 'onhold', budget: 24_800_000, costShare: 1.6, eot: 0, factor: 1, holdAt: -40, notes: 'Work suspended: developer funding tranche delayed (fictional). Site secured; scaffolding still on hire.' },
    { key: 'hillcrest', name: 'Hillcrest Mall parking deck', client: 'Hillcrest Retail Fund (fictional)', site: 'Hillcrest Mall, Lot 9 (fictional)', kind: 'building', contractType: 'remeasure', value: 56_000_000, start: 60, end: 480, retention: 10, pm: PEOPLE.pm1, agent: '', status: 'tender', budget: 50_400_000, costShare: 0, eot: 0, factor: 1 },
  ];
  const projRec: Record<string, DemoRecord> = {};
  for (const p of projects) {
    const history: H[] = [{ daysAgo: ago(p.start) + 90, by: PEOPLE.md, role: ROLE.md, action: 'Tender captured' }];
    if (p.status !== 'tender') history.push({ daysAgo: ago(p.start) + 30, by: PEOPLE.md, role: ROLE.md, action: 'Mark awarded' });
    if (['onsite', 'practical', 'onhold'].includes(p.status)) history.push({ daysAgo: ago(p.start), by: p.pm, role: ROLE.pm, action: 'Start on site' });
    if (p.status === 'onhold') history.push({ daysAgo: ago(p.holdAt!), by: p.pm, role: ROLE.pm, action: 'Put on hold', note: p.notes });
    if (p.status === 'practical') history.push({ daysAgo: ago(p.pc!), by: p.pm, role: ROLE.pm, action: 'Certify practical completion', note: 'Practical completion inspection with the principal agent (fictional). Snag list issued.' });
    projRec[p.key] = rec('projects', 'PRJ', {
      name: p.name, client: p.client, site: p.site, kind: p.kind, contractType: p.contractType, contractValue: p.value,
      startDate: day(p.start), plannedCompletion: day(p.end), retentionPct: p.retention, projectManager: p.pm, siteAgent: p.agent,
      budgetCost: p.budget, otherCostToDate: 0, eotDaysGranted: p.eot,
      practicalCompletionDate: p.pc !== undefined ? day(p.pc) : '', retentionReleaseCert: false, notes: p.notes ?? '',
    }, { status: p.status, createdDaysAgo: ago(p.start) + 90, history });
  }

  /* ---------- Programme tasks ---------- */
  for (const p of projects) {
    if (p.status === 'tender') continue;
    const pr = projRec[p.key];
    const dur = p.end - p.start;
    const asAt = p.holdAt ?? 0; // on-hold programmes froze when work stopped
    const phases = p.kind === 'civils' ? CIVILS : BUILDING;
    const created: DemoRecord[] = [];
    for (const [name, f0, f1, milestone, trade] of phases) {
      const s = p.start + Math.round(f0 * dur);
      const f = p.start + Math.round(f1 * dur);
      const expected = asAt < s ? 0 : asAt >= f ? 100 : Math.round(((asAt - s + 1) / (f - s + 1)) * 100);
      let pct = 0;
      let actualStart = '';
      let actualFinish = '';
      if (milestone) {
        const before = created.filter((t) => String(t.values.plannedFinish) <= day(f));
        const allDone = before.every((t) => t.values.pctComplete === 100);
        if (asAt >= f && allDone) {
          pct = 100;
          const latest = before.map((t) => String(t.values.actualFinish)).sort().pop() ?? day(f);
          actualFinish = latest > day(f) ? latest : day(f);
          actualStart = actualFinish;
        }
      } else if (expected > 0) {
        const lateDays = p.factor < 1 ? between(5, 20) : between(0, 3);
        if (expected === 100 && (p.factor >= 0.95 || f <= -40)) {
          pct = 100;
          actualFinish = day(Math.min(asAt - 1, f + lateDays));
        } else {
          pct = Math.max(5, Math.min(95, Math.round(expected * p.factor) + between(-8, 6)));
        }
        actualStart = day(Math.min(asAt, s + between(0, 3)));
      }
      if (p.key === 'roads' && name.startsWith('Stormwater')) pct = Math.max(5, pct - 18); // rain-affected trenching
      const sub = trade ? (p.key === 'school' && trade === 'plumbing' ? subBy('Aqua-Flo') : subForTrade(trade)) : undefined;
      const status = pct >= 100 ? 'complete' : pct > 0 ? 'inprogress' : 'planned';
      created.push(rec('tasks', 'TSK', {
        project: pr.id, name, milestone, plannedStart: day(s), plannedFinish: day(f), actualStart, actualFinish,
        pctComplete: pct, subcontractor: sub?.id ?? '', notes: '',
      }, { status, createdDaysAgo: ago(p.start) + 10 }));
    }
  }

  /* ---------- Site diary: last ~25 days for the three live sites (Sundays off) ---------- */
  const RAIN = new Set([2, 6, 13, 19]);
  const SHOWERS = new Set([5, 12, 20]);
  const live = ['school', 'warehouse', 'roads'];
  const work: Record<string, string[]> = {
    school: ['Brickwork to east-wing classrooms 3–6 at wall-plate level', 'Roof trusses lifted and braced over classrooms 1–2', 'First-fix conduit and plumbing chases to ablution block', 'Plastering internal walls classrooms 1–3', 'Casting lintels and ring beam, east wing', 'Window frames built in, classrooms 5–6'],
    warehouse: ['Mezzanine slab shuttering and rebar fixing', 'Mezzanine slab pour (48 m³) and power float', 'IBR roof sheeting to east bay', 'Office block internal partitions and ceilings', 'Dock leveller pits formed and cast', 'Fire services pipework to racking zone'],
    roads: ['Excavating trench for 600 mm stormwater line ch 0+700–0+780', 'Laying and bedding 600 mm pipes ch 0+780–0+840', 'Subbase layer compaction Street 3 (density tests passed)', 'Culvert headwall formwork at ch 0+840', 'Bulk earthworks cut-to-fill Street 5', 'G5 base layer placed and compacted Street 2'],
  };
  const plantText: Record<string, string> = {
    school: 'TLB IB-TLB-02, mixer IB-MX-03, scaffolding KS-SC-01, generator IB-GN-02',
    warehouse: 'Excavator HP-EX-311 (standing), telehandler HP-TH-02, poker IB-PV-03',
    roads: '20 t excavator HP-EX-207, TLB IB-TLB-01, roller HP-RL-05, tipper IB-TP-07, generator VG-GN-12',
  };
  const DELAY_NOTES: Record<string, string> = {
    materials: 'Delivery arrived after midday.', plant: 'Hydraulic hose failure — fitter called out.',
    power: 'Load curtailment 10:00–12:30; generator on standby only for the office.', labour: 'Late transport for general workers.',
  };
  const visitorsList = ['Principal agent — fortnightly site meeting (fictional)', 'Municipal building inspector (fictional)', 'Client representative walk-through', 'External safety audit (fictional consultant)', 'Structural engineer — rebar inspection (fictional)'];
  // The most recent working day before today (yesterday, or Saturday when today is a Monday).
  const lastWorkDay = parseIso(day(-1)).getDay() === 0 ? 2 : 1;
  for (let d = 24; d >= 0; d--) {
    const date = day(-d);
    const dow = parseIso(date).getDay();
    if (dow === 0) continue;
    for (const key of live) {
      const p = projects.find((x) => x.key === key)!;
      const civils = p.kind === 'civils';
      const rain = RAIN.has(d) && !(key === 'warehouse' && d === 19);
      const weather = rain ? 'rain' : SHOWERS.has(d) ? 'showers' : pick(['fine', 'fine', 'fine', 'overcast', 'windy'] as const);
      let delayHours = 0;
      let delayCause = '';
      let delayNotes = '';
      if (rain) { delayHours = 8; delayCause = 'rain'; delayNotes = 'Heavy rain from early morning; site flooded, work stopped. Labour sent home at 10:00.'; }
      else if (rnd() < 0.14) {
        delayCause = pick(['materials', 'plant', 'power', 'labour'] as const);
        delayHours = between(1, 4);
        delayNotes = DELAY_NOTES[delayCause] ?? '';
      }
      if (key === 'warehouse' && (d === 7 || d === 8)) { delayCause = 'info'; delayHours = d === 7 ? 4 : 8; delayNotes = 'Revised mezzanine edge-beam drawing awaited from the client’s structural engineer (fictional). RFI-018 outstanding.'; }
      const sat = dow === 6;
      const scale = sat ? 0.5 : rain ? 0.6 : 1;
      const values: Values = {
        project: projRec[key].id, date, weather,
        labourGeneral: Math.round(between(civils ? 14 : 10, civils ? 22 : 18) * scale),
        labourArtisans: Math.round(between(civils ? 2 : 6, civils ? 4 : 12) * scale),
        labourSteel: Math.round(between(civils ? 0 : 2, civils ? 2 : 6) * scale),
        labourSubcontract: Math.round(between(civils ? 6 : 4, civils ? 12 : 14) * scale),
        plantOnSite: plantText[key],
        workDone: rain ? 'No productive work — rain. Pumped out excavations once rain cleared.' : `${pick(work[key])}${sat ? ' (Saturday half-day)' : ''}.`,
        delayHours, delayCause, delayNotes,
        visitors: rnd() < 0.18 ? pick(visitorsList) : '',
        signedBy: '',
      };
      let status = d >= 2 ? 'signed' : 'draft';
      // The last working day's warehouse entry records a delay with no cause — signing is blocked (on any day of the week).
      if (key === 'warehouse' && d === lastWorkDay) { status = 'draft'; Object.assign(values, { weather: 'fine', delayHours: 3, delayCause: '', delayNotes: 'Waited for crane — see note from foreman.', workDone: 'Office block ceilings; racking zone fire pipework.' }); }
      const agent = p.agent || PEOPLE.sa;
      if (status === 'signed') values.signedBy = agent;
      rec('diary', 'SD', values, {
        status, createdDaysAgo: d,
        history: [
          { daysAgo: d, by: agent, role: ROLE.sa, action: 'Diary entry captured' },
          ...(status === 'signed' ? [{ daysAgo: Math.max(0, d - 1), by: agent, role: ROLE.sa, action: 'Sign diary' }] : []),
        ],
      });
    }
  }

  /* ---------- Variations ---------- */
  type V = [string, string, string, number, number | '', string, number, string];
  const variations: V[] = [
    // project, instruction ref, description, value, time impact, status, instructed (days ago), subcontractor
    ['school', 'SI-003', 'Additional store room partition and door to classroom 2', 48_600, 2, 'approved', 120, ''],
    ['school', 'SI-007', 'Acoustic ceiling tiles in two music classrooms', 86_200, 3, 'approved', 75, ''],
    ['school', 'SI-011', 'Additional stormwater sump at the play area', 39_800, 1, 'submitted', 22, ''],
    ['school', '', 'Relocate distribution board per principal’s verbal request', 12_400, 0, 'priced', 9, 'Lumen'],
    ['warehouse', 'SI-002', 'Mezzanine floor extension (120 m²)', 612_000, 12, 'approved', 160, 'Kwezi'],
    ['warehouse', 'SI-005', 'Upgrade dock levellers to 10 t capacity', 184_500, 0, 'approved', 130, ''],
    ['warehouse', 'SI-009', 'Additional fire hose reels (4 no.)', 72_300, 2, 'submitted', 30, ''],
    ['warehouse', 'SI-012', 'Change office glazing to tinted laminated glass', 96_800, 0, 'priced', 14, 'Clearview'],
    ['warehouse', 'SI-013', 'Extra roller shutter door at east elevation', 0, '', 'instructed', 5, 'Ndlovu Structural'],
    ['warehouse', 'SI-004', 'Raised access floor in server room', 140_000, 3, 'rejected', 110, ''],
    ['roads', 'SI-001', 'Additional 600 mm culvert at chainage 0+840', 268_000, 6, 'approved', 80, 'Mzansi'],
    ['roads', 'SI-006', 'Relocate water main conflicting with the stormwater line', 154_900, 4, 'submitted', 26, 'Mzansi'],
    ['roads', 'SI-008', 'Additional speed humps (6 no.) on Streets 2 and 5', 0, '', 'instructed', 3, ''],
    ['clinic', 'SI-010', 'Additional ramp handrails and tactile paving', 64_500, 3, 'approved', 140, ''],
    ['clinic', 'SI-014', 'Upgrade consulting-room vinyl to sheet vinyl with coved skirting', 38_900, 0, 'rejected', 90, 'Tile Masters'],
    ['ridgeview', 'SI-002', 'Change roof pitch to 26° per revised architect drawing', 210_000, 8, 'priced', 50, 'Overberg'],
  ];
  for (const [key, ref, description, value, time, status, dAgo, subName] of variations) {
    const p = projects.find((x) => x.key === key)!;
    const history: H[] = [{ daysAgo: dAgo, by: p.agent || p.pm, role: ROLE.sa, action: 'Instruction recorded' }];
    if (status !== 'instructed') history.push({ daysAgo: Math.max(0, dAgo - 4), by: PEOPLE.qs, role: ROLE.qs, action: 'Mark priced' });
    if (['submitted', 'approved', 'rejected'].includes(status)) history.push({ daysAgo: Math.max(0, dAgo - 6), by: PEOPLE.qs, role: ROLE.qs, action: 'Submit to client' });
    if (status === 'approved') history.push({ daysAgo: Math.max(0, dAgo - 20), by: p.pm, role: ROLE.pm, action: 'Record client approval' });
    if (status === 'rejected') history.push({ daysAgo: Math.max(0, dAgo - 18), by: p.pm, role: ROLE.pm, action: 'Record rejection', note: 'Client declined — item omitted from scope (fictional).' });
    rec('variations', 'VO', {
      project: projRec[key].id, instructionRef: ref, description, value: value || '', timeImpactDays: time,
      instructedBy: ref ? 'Principal agent (fictional)' : 'Client representative (verbal)', instructedOn: day(-dAgo),
      subcontractor: subName ? subBy(subName).id : '',
      approvedOn: status === 'approved' ? day(-Math.max(0, dAgo - 20)) : '',
      notes: ref ? '' : 'Verbal instruction on site — written site instruction requested from the principal agent.',
    }, { status, createdDaysAgo: dAgo, history });
  }
  const approvedTotal = (key: string) => variations.filter((v) => v[0] === key && v[5] === 'approved').reduce((n, v) => n + v[3], 0);

  /* ---------- Payment valuations (monthly, cumulative) ---------- */
  const lastStatus: Record<string, string[]> = {
    // statuses for the most recent valuations, newest last; earlier ones are paid
    school: ['paid', 'draft'], warehouse: ['certified', 'submitted'], roads: ['paid', 'draft'], clinic: ['paid', 'certified'], ridgeview: ['paid', 'certified'],
  };
  for (const p of projects) {
    if (!lastStatus[p.key]) continue;
    const pr = projRec[p.key];
    const ends: number[] = [];
    const stop = p.holdAt ?? -3;
    for (let off = p.start + 30; off <= stop; off += 30) ends.push(off);
    let previous = 0;
    const tail = lastStatus[p.key];
    ends.forEach((off, i) => {
      const k = i + 1;
      const n = ends.length;
      const status = i >= n - tail.length ? tail[i - (n - tail.length)] : 'paid';
      const progress = ((off - p.start) / (p.end - p.start)) * p.factor;
      const workDone = round(p.value * smooth(progress) * 0.97, 1000);
      const materialsOnSite = progress >= 0.95 ? 0 : round(p.value * (0.008 + rnd() * 0.012), 500);
      const variationsToDate = k >= n - 1 ? approvedTotal(p.key) : k >= n / 2 ? round(approvedTotal(p.key) * 0.5, 100) : 0;
      const f = computeValuation({ workDone, materialsOnSite, variations: variationsToDate, retentionPct: p.retention, contractValue: p.value, previousCertified: previous });
      const submitted = status !== 'draft' ? f.amountDue / 100 : '';
      const certified = ['certified', 'paid'].includes(status) ? (k % 3 === 0 ? Math.round((f.amountDue / 100) * 0.985) : f.amountDue / 100) : '';
      if (certified !== '') previous += certified;
      const history: H[] = [{ daysAgo: ago(off), by: PEOPLE.qs, role: ROLE.qs, action: 'Valuation prepared' }];
      if (status !== 'draft') history.push({ daysAgo: ago(off + 2), by: PEOPLE.qs, role: ROLE.qs, action: 'Submit valuation' });
      if (['certified', 'paid'].includes(status)) history.push({ daysAgo: ago(off + 12), by: PEOPLE.qs, role: ROLE.qs, action: 'Record certificate', note: certified !== submitted ? 'Principal agent adjusted measured quantities (fictional).' : undefined });
      if (status === 'paid') history.push({ daysAgo: ago(off + 28), by: PEOPLE.md, role: ROLE.md, action: 'Mark paid' });
      rec('valuations', 'VAL', {
        project: pr.id, valuationNo: k, periodEnd: day(off), workDone, materialsOnSite, variationsToDate,
        submittedAmount: submitted, certifiedAmount: certified,
        certificateRef: certified !== '' ? `DEMO-PC-${String(k).padStart(2, '0')}` : '',
        submittedOn: status !== 'draft' ? day(off + 2) : '', certifiedOn: certified !== '' ? day(off + 12) : '', paidOn: status === 'paid' ? day(off + 28) : '',
        notes: '',
      }, { status, createdDaysAgo: ago(off), history });
    });
  }

  // Labour & subcontract cost to date: a share of the amount certified (standing time makes the on-hold job cost more than certified).
  for (const p of projects) {
    const certifiedTotal = (collections.valuations ?? []).filter((v) => v.values.project === projRec[p.key].id && v.values.certifiedAmount !== '').reduce((n, v) => n + Number(v.values.certifiedAmount), 0);
    projRec[p.key].values.otherCostToDate = round(certifiedTotal * p.costShare * 0.85, 1000);
  }

  /* ---------- Procurement ---------- */
  type R = [string, string, string, Array<[string, number, number]>, string, number, number | null, string, number];
  const reqs: R[] = [
    // project, description, supplier, lines, status, required-by offset, expected delivery offset, delivery note, created days ago
    ['school', 'Face brick for classroom block east wing', 'highveld', [['NFX face brick (per 1 000)', 18, 4850], ['Brickforce 150 mm roll', 40, 96]], 'delivered', -22, -20, 'HBB-DN-44120', 35],
    ['school', 'Ceiling boards & brandering', 'bushveld', [['Gypsum ceiling board 6.4 mm', 220, 118], ['Brandering 38 × 38 (per m)', 900, 14.5]], 'ordered', 6, 5, '', 12],
    ['school', 'Sanitaryware for the ablution block', 'protea', [['WC pan & cistern (school spec)', 14, 1890], ['Wash-hand basin', 12, 760]], 'approved', 20, null, '', 6],
    ['school', 'Electrical cable & distribution boards', 'ukhozi', [['4 mm² 3-core cable (m)', 600, 38], ['Distribution board 24-way', 2, 3450]], 'requested', 25, null, '', 2],
    ['warehouse', 'Y12 / Y16 reinforcing for the mezzanine', 'steelcraft', [['Y12 high-tensile rebar (t)', 6.5, 16800], ['Y16 high-tensile rebar (t)', 4.2, 16500]], 'partial', -8, -6, 'SCR-55871', 20],
    ['warehouse', '35 MPa ready-mix for the mezzanine slab', 'readymix', [['35 MPa concrete (m³)', 48, 1980], ['Concrete pump hire (per pour)', 1, 6500]], 'delivered', -10, -10, 'RRC-2231', 18],
    ['warehouse', 'IBR roof sheeting — east bay', 'summit', [['IBR 0.53 mm Z275 sheet (m)', 640, 168], ['Fixings & sealant pack', 12, 840]], 'ordered', -5, -4, '', 16],
    ['warehouse', 'Fire hose reels and cabinets', 'protea', [['Fire hose reel 30 m', 4, 4650]], 'requested', 14, null, '', 1],
    ['roads', '600 mm concrete pipes class 100D', 'pipeline', [['600 mm spigot & socket pipe (2.44 m)', 86, 2350], ['Bedding sand (m³)', 60, 310]], 'delivered', -30, -28, 'PCP-90412', 40],
    ['roads', 'G5 base course material', 'karoo', [['G5 natural gravel (m³)', 1450, 145]], 'ordered', -3, -2, '', 15],
    ['roads', 'Barrier kerbs and channels', 'pipeline', [['Barrier kerb FK (m)', 820, 96], ['Channel 300 mm (m)', 820, 74]], 'approved', 30, null, '', 4],
    ['clinic', 'Replacement skirting & door stops for snags', 'bushveld', [['Meranti skirting (m)', 40, 52], ['Door stop (chrome)', 18, 65]], 'delivered', -6, -5, 'BTB-77310', 10],
    ['ridgeview', 'Face brick — block B (suspended)', 'highveld', [['Satin face brick (per 1 000)', 22, 5200]], 'cancelled', -30, null, '', 48],
  ];
  reqs.forEach(([key, description, supplier, ls, status, req, exp, dn, dAgo], i) => {
    const p = projects.find((x) => x.key === key)!;
    const history: H[] = [{ daysAgo: dAgo, by: p.agent || PEOPLE.sa, role: ROLE.sa, action: 'Requisition raised' }];
    if (['approved', 'ordered', 'partial', 'delivered'].includes(status)) history.push({ daysAgo: Math.max(0, dAgo - 1), by: p.pm, role: ROLE.pm, action: 'Approve requisition' });
    if (['ordered', 'partial', 'delivered'].includes(status)) history.push({ daysAgo: Math.max(0, dAgo - 2), by: PEOPLE.ps, role: ROLE.ps, action: 'Issue purchase order' });
    if (status === 'partial') history.push({ daysAgo: Math.max(0, -(exp ?? 0)), by: PEOPLE.ps, role: ROLE.ps, action: 'Receive part delivery', note: 'Y16 delivered in full; Y12 short by 2.1 t (back-order).' });
    if (status === 'delivered') history.push({ daysAgo: Math.max(0, -(exp ?? 0)), by: PEOPLE.ps, role: ROLE.ps, action: 'Receive in full' });
    if (status === 'cancelled') history.push({ daysAgo: 40, by: p.pm, role: ROLE.pm, action: 'Cancel requisition', note: 'Project on hold — order not placed.' });
    rec('requisitions', 'REQ', {
      project: projRec[key].id, description, supplier, requestedBy: p.agent || PEOPLE.sa, requiredBy: day(req),
      lines: ls.map(([d, q, u], j) => ({ id: `rq${i + 1}_${j + 1}`, description: d, qty: q, unitPrice: u })),
      poNumber: ['ordered', 'partial', 'delivered'].includes(status) ? `PO-DEMO-${String(4100 + i * 7)}` : '',
      expectedDelivery: exp === null ? '' : day(exp), deliveryNote: dn, receivedOn: ['partial', 'delivered'].includes(status) && exp !== null ? day(exp) : '',
      notes: '',
    }, { status, createdDaysAgo: dAgo, history });
  });

  /* ---------- Plant & equipment ---------- */
  type PL = [string, string, string, string, string, string, number | null, number | null, number | null, number, string, number | null];
  const plant: PL[] = [
    // description, fleet no, type, ownership, project, state, hire start, off-hire due, off-hired on, daily rate, supplier, next service
    ['TLB 4×4 backhoe loader', 'IB-TLB-01', 'tlb', 'owned', 'roads', 'working', null, null, null, 0, '', 40],
    ['TLB 4×4 backhoe loader', 'IB-TLB-02', 'tlb', 'owned', 'school', 'working', null, null, null, 0, '', -3],
    ['20 t tracked excavator', 'HP-EX-207', 'excavator', 'hired', 'roads', 'working', -60, 30, null, 4850, 'Mopani Plant Hire (fictional)', 20],
    ['14 t tracked excavator', 'HP-EX-311', 'excavator', 'hired', 'warehouse', 'idle', -45, -8, null, 3900, 'Mopani Plant Hire (fictional)', 35],
    ['Concrete mixer 350 L', 'IB-MX-03', 'mixer', 'owned', 'school', 'working', null, null, null, 0, '', 60],
    ['Concrete mixer 350 L', 'IB-MX-04', 'mixer', 'owned', '', 'yard', null, null, null, 0, '', 75],
    ['Scaffolding — east elevation (480 m²)', 'KS-SC-01', 'scaffold', 'hired', 'school', 'working', -70, 40, null, 1250, 'Klipspringer Scaffolding (fictional)', null],
    ['Scaffolding — warehouse office block (260 m²)', 'KS-SC-02', 'scaffold', 'hired', 'warehouse', 'idle', -90, -15, null, 980, 'Klipspringer Scaffolding (fictional)', null],
    ['Scaffolding — townhouse block A (300 m²)', 'KS-SC-03', 'scaffold', 'hired', 'ridgeview', 'idle', -80, -40, null, 640, 'Klipspringer Scaffolding (fictional)', null],
    ['Generator 60 kVA (silent)', 'VG-GN-12', 'generator', 'hired', 'roads', 'working', -30, 45, null, 1150, 'Voltline Generator Hire (fictional)', 12],
    ['Generator 20 kVA', 'IB-GN-02', 'generator', 'owned', 'school', 'working', null, null, null, 0, '', 10],
    ['Pad-foot roller 12 t', 'HP-RL-05', 'roller', 'hired', 'roads', 'working', -20, 25, null, 3200, 'Mopani Plant Hire (fictional)', 50],
    ['Pedestrian double-drum roller', 'HP-RL-06', 'roller', 'hired', 'roads', 'breakdown', -15, 10, null, 850, 'Mopani Plant Hire (fictional)', 30],
    ['Tipper truck 10 m³', 'IB-TP-07', 'tipper', 'owned', 'roads', 'working', null, null, null, 0, '', 22],
    ['Telehandler 3.5 t', 'HP-TH-02', 'telehandler', 'hired', 'warehouse', 'working', -40, 12, null, 2650, 'Mopani Plant Hire (fictional)', 45],
    ['Mini excavator 1.7 t', 'HP-EX-188', 'excavator', 'hired', 'clinic', 'offhired', -120, -55, -50, 1650, 'Mopani Plant Hire (fictional)', null],
    ['Poker vibrator 50 mm', 'IB-PV-03', 'poker', 'owned', 'warehouse', 'working', null, null, null, 0, '', 5],
  ];
  for (const [description, fleetNo, type, ownership, key, state, hs, due, off, rate, supplier, svc] of plant) {
    rec('plant', 'PL', {
      description, fleetNo, type, ownership, project: key ? projRec[key].id : '', state,
      hireStart: hs === null ? '' : day(hs), offHireDue: due === null ? '' : day(due), offHiredOn: off === null ? '' : day(off),
      dailyRate: rate || '', hireCompany: supplier, nextServiceDue: svc === null ? '' : day(svc),
      notes: state === 'breakdown' ? 'Drum vibration fault — hire company notified; hire charges disputed while broken down.' : '',
    }, { createdDaysAgo: hs === null ? 300 : ago(hs) });
  }

  /* ---------- Snags & defects ---------- */
  type S = [string, string, string, string, string, number, string];
  const snags: S[] = [
    // project, location, description, category, status, raised days ago, responsible subcontractor
    ['clinic', 'Consulting room 1', 'Door closer adjusting — door slams', 'minor', 'verified', 30, ''],
    ['clinic', 'Waiting area', 'Paint touch-ups to columns', 'minor', 'verified', 30, 'Rainbow'],
    ['clinic', 'Ramp', 'Handrail end caps missing', 'minor', 'verified', 30, ''],
    ['clinic', 'Dispensary', 'Burglar bar weld spatter not ground', 'minor', 'verified', 28, 'Ndlovu Structural'],
    ['clinic', 'Ablutions', 'Cracked floor tile at entrance', 'minor', 'verified', 28, 'Tile Masters'],
    ['clinic', 'Consulting room 2', 'Plug socket not working (circuit 4)', 'major', 'verified', 26, 'Lumen'],
    ['clinic', 'Roof', 'Missing ridge flashing over passage', 'major', 'verified', 26, 'Overberg'],
    ['clinic', 'Store room', 'Shelving not fixed to wall', 'minor', 'verified', 24, ''],
    ['clinic', 'External', 'Paving settlement at entrance', 'major', 'verified', 24, ''],
    ['clinic', 'Nurses’ station', 'Silicone to counter top incomplete', 'minor', 'fixed', 18, ''],
    ['clinic', 'Waiting area', 'Ceiling board joint cracking', 'minor', 'fixed', 18, ''],
    ['clinic', 'Ablutions', 'Basin waste leaking', 'major', 'fixed', 14, 'Aqua-Flo'],
    ['clinic', 'Consulting room 3', 'Roof leak above consulting room 3 after storm', 'critical', 'open', 6, 'Overberg'],
    ['clinic', 'Passage', 'Skirting loose at fire door', 'minor', 'open', 6, ''],
    ['clinic', 'External', 'Stormwater gully grating missing', 'major', 'open', 5, ''],
    ['warehouse', 'Stair 2', 'Fire door to stair 2 not self-closing', 'critical', 'open', 9, 'Ndlovu Structural'],
    ['warehouse', 'Dock 3', 'Dock leveller lip not engaging', 'major', 'open', 9, ''],
    ['warehouse', 'Office block', 'Ceiling tiles stained near AC unit', 'major', 'open', 7, ''],
    ['warehouse', 'Racking zone', 'Floor joint sealant missing (grid C–D)', 'minor', 'fixed', 12, 'Kwezi'],
    ['warehouse', 'Office block', 'Window handle missing, office 4', 'minor', 'open', 7, 'Clearview'],
    ['school', 'Classroom 4', 'Cracked window pane', '', 'open', 4, 'Clearview'],
    ['school', 'Classroom 1', 'Plaster hairline cracks at lintel', 'minor', 'open', 8, 'Sunrise'],
    ['school', 'Classroom 2', 'Store room door binding', 'minor', 'open', 8, ''],
    ['school', 'Ablution block', 'Floor fall to drain incorrect — ponding', 'major', 'fixed', 15, 'Tile Masters'],
    ['school', 'Classroom 1', 'Light switch plate missing', 'minor', 'verified', 20, 'Lumen'],
  ];
  for (const [key, location, description, category, status, dAgo, subName] of snags) {
    const p = projects.find((x) => x.key === key)!;
    const history: H[] = [{ daysAgo: dAgo, by: p.pm, role: ROLE.pm, action: 'Snag raised' }];
    if (status !== 'open') history.push({ daysAgo: Math.max(0, dAgo - 5), by: p.agent || PEOPLE.sa, role: ROLE.sa, action: 'Mark fixed' });
    if (status === 'verified') history.push({ daysAgo: Math.max(0, dAgo - 7), by: p.pm, role: ROLE.pm, action: 'Verify fix', note: 'Inspected and accepted.' });
    rec('snags', 'SNG', {
      project: projRec[key].id, location, description, category, responsible: subName ? subBy(subName).id : '',
      raisedOn: day(-dAgo), dueBy: day(-dAgo + (category === 'critical' ? 3 : 14)),
      fixedOn: status !== 'open' ? day(-Math.max(0, dAgo - 5)) : '', notes: '',
    }, { status, createdDaysAgo: dAgo, history });
  }

  /* ---------- Health & safety ---------- */
  type HS = [string, string, string, string, number, boolean, number, string, string];
  const safety: HS[] = [
    // type, project, title, severity, attendees, lost time, days ago, corrective action, status
    ['toolbox', 'school', 'Working at height — scaffold inspection tags', 'none', 32, false, 20, '', 'closed'],
    ['toolbox', 'roads', 'Trench safety, shoring and safe access', 'none', 24, false, 16, '', 'closed'],
    ['toolbox', 'warehouse', 'Heat stress and hydration', 'none', 28, false, 9, '', 'closed'],
    ['toolbox', 'school', 'Hand and power tool safety', 'none', 0, false, 1, '', 'open'],
    ['inspection', 'school', 'Weekly scaffold inspection — east elevation', 'low', 0, false, 6, 'Two missing toe boards replaced; tag updated.', 'closed'],
    ['inspection', 'roads', 'Excavation inspection ch 0+600 – 0+900', 'medium', 0, false, 3, '', 'open'],
    ['nearmiss', 'roads', 'Unsecured load on tipper leaving site', 'medium', 0, false, 33, 'Load-check at gate added to security checklist; driver re-briefed.', 'closed'],
    ['nearmiss', 'warehouse', 'Brick pallet swung near workers during telehandler lift', 'high', 0, false, 4, '', 'open'],
    ['incident', 'warehouse', 'Labourer cut hand on exposed rebar end — no caps fitted', 'medium', 0, true, 47, 'Mushroom caps fitted to all starter bars; daily check added to foreman’s list.', 'closed'],
    ['incident', 'roads', 'Twisted ankle stepping into unmarked trench edge', 'low', 0, false, 2, 'Trench edges barricaded and lit; night inspection added.', 'open'],
  ];
  for (const [type, key, title, severity, attendees, lostTime, dAgo, action, status] of safety) {
    const p = projects.find((x) => x.key === key)!;
    rec('safety', 'HS', {
      date: day(-dAgo), type, project: projRec[key].id, title, severity, attendees: attendees || '', lostTime, reportedBy: type === 'toolbox' ? p.agent || PEOPLE.sa : PEOPLE.so,
      description: `${title} (fictional account).`, correctiveAction: action,
    }, {
      status, createdDaysAgo: dAgo,
      history: [
        { daysAgo: dAgo, by: type === 'toolbox' ? p.agent || PEOPLE.sa : PEOPLE.so, role: type === 'toolbox' ? ROLE.sa : ROLE.so, action: 'Recorded' },
        ...(status === 'closed' ? [{ daysAgo: Math.max(0, dAgo - 2), by: PEOPLE.so, role: ROLE.so, action: 'Close out' }] : []),
      ],
    });
  }

  return { users, collections, currentUserId: 'u_md' };
}
