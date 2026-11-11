// Fictional seed data for Ridgeback Minerals — Kgotso Shaft. Every person,
// company, fleet number, permit and reading is invented. Dates are relative to
// `today` so the demo always looks current.
import { seeder, user } from '../../core/seed';
import type { DemoRecord, Values } from '../../core/types';
import { CREWS, DELAY_REASONS, ENV_PARAMS, SECTIONS, SHIFT_TARGETS } from './data';

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

export const MINE_MANAGER = 'Zodwa Mthethwa';
type H = { daysAgo: number; by: string; role: string; action: string; note?: string };
const SUP = { pc: 'Pieter-Jan Coetzee', kt: 'Kabelo Tau' } as const;
const SAFETY = 'Ayanda Ngcobo';
const PLANNER = 'Ruan Visagie';
const ENVIRO = 'Fikile Shabalala';
const COORD = 'Marisa Pillay';

export function buildMiningSeed(today: string) {
  const rnd = prng(20260704);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const { collections, rec, day } = seeder(today);

  const users = [
    user('u_mm', MINE_MANAGER, 'Mine manager', 'manager', [], [], true),
    user('u_pc', SUP.pc, 'Shift supervisor (day)', 'supervisor', ['dashboard', 'production', 'incidents', 'permits', 'equipment', 'workorders', 'contractors'], ['production.log', 'safety.report', 'permits.request']),
    user('u_kt', SUP.kt, 'Shift supervisor (night)', 'supervisor', ['dashboard', 'production', 'incidents', 'permits', 'equipment', 'workorders', 'contractors'], ['production.log', 'safety.report', 'permits.request']),
    user('u_so', SAFETY, 'Safety officer', 'safety', ['dashboard', 'incidents', 'permits', 'contractors', 'environment', 'reports'], ['safety.report', 'safety.investigate', 'permits.request', 'permits.issue']),
    user('u_mp', PLANNER, 'Maintenance planner', 'maintenance', ['dashboard', 'equipment', 'workorders', 'permits', 'reports'], ['maintenance', 'permits.request', 'safety.report']),
    user('u_eo', ENVIRO, 'Environmental officer', 'environment', ['dashboard', 'environment', 'incidents', 'reports'], ['environment', 'safety.report']),
    user('u_cc', COORD, 'Contractor coordinator', 'contractors', ['dashboard', 'contractors', 'permits', 'incidents'], ['contractors', 'permits.request', 'safety.report']),
  ];

  /* ---------- Shift production log: ~3 months, 2 shifts/day, 3 sections ---------- */
  const bigReasons = ['hoist', 'power', 'seismic', 'fog'];
  const allReasons = DELAY_REASONS.map((r) => r.value);
  for (let d = 89; d >= 0; d--) {
    for (const shift of ['day', 'night'] as const) {
      if (d === 0 && shift === 'night') continue; // tonight's shift has not started
      for (const s of SECTIONS) {
        const target = SHIFT_TARGETS[s.value][shift];
        const r = rnd();
        let delay = 0;
        let reason = '';
        if (r < 0.55) delay = Math.round(rnd() * 4) * 5;
        else if (r < 0.9) { delay = 35 + Math.floor(rnd() * 10) * 10; reason = pick(allReasons); }
        else { delay = 150 + Math.floor(rnd() * 6) * 25; reason = pick(bigReasons); }
        let tonnes = Math.max(0, Math.round(target * (0.95 + rnd() * 0.17) - (target * delay) / 480));
        const sup = shift === 'day' ? 'pc' : 'kt';
        let status = d >= 2 ? 'verified' : 'submitted';
        let notes = delay >= 150 ? 'Extended stoppage — see delay reason. Crew redeployed to cleaning and support installation.' : '';
        // Awaiting verification: one log with a long delay but no reason (verification is blocked).
        if (d === 1 && shift === 'night' && s.value === 'l7w') { delay = 55; reason = ''; tonnes = 286; notes = 'Loading box chute blocked mid-shift.'; }
        if (d === 0) { status = 'open'; tonnes = Math.round(target * 0.55); delay = s.value === 'l9n' ? 20 : 0; reason = ''; notes = 'Shift in progress — figures to date.'; }
        const history = status === 'open'
          ? [{ daysAgo: 0, by: SUP[sup], role: 'Shift supervisor', action: 'Shift log opened' }]
          : [
            { daysAgo: d, by: SUP[sup], role: 'Shift supervisor', action: 'Submit shift' },
            ...(status === 'verified' ? [{ daysAgo: d - 1, by: MINE_MANAGER, role: 'Mine manager', action: 'Verify shift' }] : []),
          ];
        rec('shifts', 'SHF', {
          date: day(-d), shift, section: s.value, crew: CREWS[s.value][shift === 'day' ? 0 : 1], supervisor: sup,
          tonnesHoisted: tonnes, targetTonnes: target, delayMinutes: delay, delayReason: reason, notes,
        }, { status, createdDaysAgo: d, history });
      }
    }
  }

  /* ---------- Contractors ---------- */
  const companies: Array<[string, string, string]> = [
    ['Umkhonto Shaft Services', 'shaftsinking', 'Shaft examiner certificate (demo)'],
    ['Granite Edge Drilling', 'drilling', 'Drill operator competency (demo)'],
    ['Vaal Air Ventilation', 'ventilation', 'Ventilation officer certificate (demo)'],
    ['Ironveld Electrical', 'electrical', 'Electrician trade certificate (demo)'],
    ['Bokamoso Civils', 'civils', 'Working at height competency (demo)'],
    ['Sedibeng Pump Services', 'pumps', 'Confined space entrant (demo)'],
    ['Strata Rock Engineering', 'rockeng', 'Strata control competency (demo)'],
  ];
  const people: Array<[string, string, number, number, number, number]> = [
    // first, last, company idx, induction offset, medical offset, competency offset (days from today)
    ['Thulani', 'Mavuso', 0, 210, 160, 400],
    ['Christo', 'Bezuidenhout', 0, 18, 220, 300],
    ['Neo', 'Masemola', 1, 140, 95, 520],
    ['Busisiwe', 'Zungu', 1, -12, 130, 260],
    ['Francois', 'du Toit', 2, 250, 26, 330],
    ['Lwazi', 'Gumede', 2, 75, 190, 190],
    ['Karabo', 'Seleka', 3, -35, -20, 410],
    ['Annemarie', 'Visser', 3, 160, 280, 9],
    ['Sibusiso', 'Ntuli', 3, 300, 110, -15],
    ['Tebogo', 'Mashaba', 4, 120, -6, 220],
    ['Wian', 'Erasmus', 4, 22, 300, 600],
    ['Nokuthula', 'Dube', 5, 190, 150, 280],
    ['Mandla', 'Shongwe', 5, 330, 240, 350],
    ['Charmaine', 'Adonis', 6, 95, 60, 700],
    ['Kgomotso', 'Moloi', 6, 270, 200, 150],
    ['Dewald', 'Pienaar', 1, 45, 12, 330],
    ['Lindokuhle', 'Biyela', 0, 180, 170, 240],
    ['Ofentse', 'Matlala', 2, 230, 85, 110],
  ];
  const contractors = people.map(([first, last, ci, ind, med, comp], i) => {
    const [company, trade, competency] = companies[ci];
    return rec('contractors', 'CON', {
      firstName: first, lastName: last, company, trade,
      phone: `0${[72, 82, 83, 61, 79][i % 5]} 555 ${String(2100 + i * 41).slice(-4)}`,
      email: `${first.toLowerCase()}.${last.toLowerCase().replace(/\s+/g, '')}@example.com`,
      accessCard: `DEMO-KG${String(3100 + i * 7)}`,
      inductionExpiry: day(ind), medicalExpiry: day(med), competency, competencyExpiry: day(comp),
    }, { createdDaysAgo: 200 - i * 3 });
  });
  const contractorBy = (last: string) => contractors.find((c) => c.values.lastName === last)!;

  /* ---------- Safety incidents (mostly near misses, one LTI ~40 days ago) ---------- */
  type Inc = [number, string, string, string, string, boolean, string, string, string, string, number, boolean, string];
  const incidents: Inc[] = [
    // daysAgo, title, type, category, severity, lti, location, status, rootCause, correctiveActions, actionDue offset, actionsComplete, reportedBy
    [84, 'LHD passed pedestrian outside refuge bay at L7E tip', 'nearmiss', 'tmm', 'medium', false, 'l7e', 'closed', 'Pedestrian walked the tip cross-cut during tramming; no lockout of the tip area during loading.', 'Barrier and flashing light installed at tip entrance; tip access procedure re-communicated at line-out.', -60, true, SUP.pc],
    [77, 'Hangingwall slab fell after barring down — area clear', 'nearmiss', 'fog', 'medium', false, 'l7w', 'closed', 'Joint set intersecting the hangingwall not identified at entry examination.', 'Additional rock bolts installed; examination checklist updated to include joint mapping.', -50, true, SUP.kt],
    [70, 'Loco derailment at station turnout', 'damage', 'rail', 'low', false, 'shaft', 'closed', 'Worn switch blade at turnout 3.', 'Switch blade replaced; turnouts added to weekly track inspection.', -55, true, SUP.pc],
    [63, 'Unisolated pump starter found with cover removed', 'nearmiss', 'electrical', 'high', false, 'workshop', 'closed', 'Previous job not closed out; isolation removed before cover refitted.', 'Lock-out/tag-out refresher for artisans; permit close-out now checked by supervisor.', -40, true, SAFETY],
    [55, 'Worker slipped on wet footwall at L9N travelling way', 'nearmiss', 'slip', 'low', false, 'l9n', 'closed', 'Leaking water column flooding travelling way.', 'Column repaired; drainage channel cleaned.', -45, true, SUP.kt],
    [40, 'Fractured finger while changing LHD bucket teeth', 'injury', 'handling', 'high', true, 'l7e', 'closed', 'Bucket not lowered to the floor and supported before the teeth change; pinch point between tooth and adapter.', 'Bucket-teeth change procedure revised (bucket on floor, blocked); task observation for all LHD crews; lifting tool issued.', -10, true, SUP.pc],
    [33, 'Elevated CO at L9N development end before re-entry', 'nearmiss', 'gas', 'medium', false, 'l9n', 'closed', 'Auxiliary fan ducting torn 40 m from the face, reducing airflow.', 'Ducting replaced; re-entry gas check now logged on the shift sheet.', -15, true, SUP.kt],
    [26, 'Contractor twisted wrist stepping off surface platform', 'injury', 'slip', 'low', false, 'surface', 'closed', 'Missing step on temporary platform.', 'Platform step replaced and handrail extended. First aid only — no lost time.', -18, true, COORD],
    [19, 'Utility vehicle reversed towards drill rig — proximity alarm ignored', 'nearmiss', 'tmm', 'high', false, 'l7w', 'actions', 'Operator acknowledged proximity warning without stopping; reversing alarm muted.', 'Disable alarm-mute function on UV fleet; operator re-training; spot checks for two weeks.', 10, false, SUP.pc],
    [14, 'Fall of ground damaged ventilation duct at L7E', 'damage', 'fog', 'medium', false, 'l7e', 'actions', 'Support spacing exceeded standard after recent blast.', 'Install mesh and additional bolts; supervisor to measure support spacing every shift.', -3, false, SUP.kt],
    [9, 'Smoke from overheated hydraulic hose on roof bolter', 'nearmiss', 'fire', 'medium', false, 'workshop', 'investigating', 'Hose chafing against boom bracket; no protective sleeve fitted.', '', 0, false, PLANNER],
    [6, 'Runaway mine car stopped by arrestor at station', 'nearmiss', 'rail', 'high', false, 'shaft', 'investigating', '', '', 0, false, SUP.pc],
    [2, 'Loose drill steel fell from storage rack', 'nearmiss', 'handling', 'low', false, 'l9n', 'reported', '', '', 0, false, SUP.kt],
    [1, 'Twisted ankle on wet walkway at pump station', 'injury', 'slip', 'low', false, 'pumpstation', 'reported', '', '', 0, false, SUP.kt],
  ];
  for (const [dAgo, title, type, category, severity, lti, location, status, rootCause, correctiveActions, dueOff, done, reportedBy] of incidents) {
    const v: Values = {
      date: day(-dAgo), title, type, category, severity, lti, lostDays: lti ? 9 : 0, location, reportedBy,
      description: `${title}. Reported at the start of the following shift (fictional account).`,
      rootCause, correctiveActions,
      actionOwner: correctiveActions ? (category === 'tmm' || category === 'rail' ? PLANNER : SUP.pc) : '',
      actionDue: correctiveActions ? day(dueOff) : '', actionsComplete: done,
    };
    const history: H[] = [{ daysAgo: dAgo, by: reportedBy, role: 'Reporter', action: 'Incident reported' }];
    if (status !== 'reported') history.push({ daysAgo: Math.max(0, dAgo - 1), by: SAFETY, role: 'Safety officer', action: 'Start investigation' });
    if (status === 'actions' || status === 'closed') history.push({ daysAgo: Math.max(0, dAgo - 3), by: SAFETY, role: 'Safety officer', action: 'Agree corrective actions' });
    if (status === 'closed') history.push({ daysAgo: Math.max(0, dAgo - 25), by: SAFETY, role: 'Safety officer', action: 'Close incident', note: 'Actions verified complete on site.' });
    rec('incidents', 'INC', v, { status, createdDaysAgo: dAgo, history });
  }

  /* ---------- Permits to work ---------- */
  type Pm = { type: string; location: string; description: string; holder: string; contractor?: DemoRecord; from: number; to: number; at: string; iso: boolean; points: string; o2?: number; status: string; note?: string };
  const permits: Pm[] = [
    { type: 'hot', location: 'workshop', description: 'Weld repair on LHD-05 bucket lip', holder: 'Gert van Rooyen', from: 0, to: 0, at: '23:59', iso: true, points: 'LHD-05 parked, battery isolator locked out (lock 14).', status: 'active' },
    { type: 'confined', location: 'pumpstation', description: 'Desilting of Level 9 main sump', holder: 'Nokuthula Dube', contractor: contractorBy('Dube'), from: -1, to: -1, at: '18:00', iso: true, points: 'Sump pumps 1 & 2 isolated at MCC, locks 21–22.', o2: 20.8, status: 'active' },
    { type: 'electrical', location: 'l7e', description: 'Replace starter on auxiliary fan FAN-L7-01', holder: 'Elsabé Fourie', from: 0, to: 1, at: '14:00', iso: true, points: 'Fan feeder isolated at L7 sub, lock 9. Tested dead.', status: 'active' },
    { type: 'confined', location: 'l9n', description: 'Inspect settler tank internals', holder: 'Mandla Shongwe', contractor: contractorBy('Shongwe'), from: 0, to: 0, at: '23:59', iso: true, points: 'Inlet valve chained and locked (lock 30).', o2: 18.9, status: 'approved' },
    { type: 'hot', location: 'l7w', description: 'Cut and weld rail at L7W loading box', holder: 'Wian Erasmus', contractor: contractorBy('Erasmus'), from: 0, to: 1, at: '14:00', iso: false, points: 'Loading box chute and conveyor to be isolated.', status: 'approved' },
    { type: 'height', location: 'shaft', description: 'Shaft steelwork inspection — bunton bolts', holder: 'Thulani Mavuso', contractor: contractorBy('Mavuso'), from: 1, to: 1, at: '16:00', iso: false, points: 'Winder in inspection mode, signalling locked.', status: 'requested' },
    { type: 'confined', location: 'pumpstation', description: 'Pump column flange replacement', holder: 'Lindokuhle Biyela', from: 1, to: 2, at: '16:00', iso: false, points: '', status: 'requested' },
    { type: 'electrical', location: 'l9n', description: 'Cable termination at L9N mini-substation', holder: 'Karabo Seleka', contractor: contractorBy('Seleka'), from: 1, to: 1, at: '17:00', iso: false, points: '', status: 'requested' },
    { type: 'electrical', location: 'surface', description: 'Substation feeder isolation for breaker maintenance', holder: 'Elsabé Fourie', from: 0, to: 0, at: '23:59', iso: true, points: 'Feeder 3 racked out, earthed, lock 2.', status: 'suspended', note: 'Lightning warning for the area — work suspended until the storm passes.' },
    { type: 'hot', location: 'surface', description: 'Hardfacing of crusher liners', holder: 'Gert van Rooyen', from: -6, to: -6, at: '17:00', iso: true, points: 'Crusher isolated at MCC, lock 5.', status: 'closed' },
    { type: 'height', location: 'l7e', description: 'Install ventilation duct hangers above conveyor', holder: 'Francois du Toit', contractor: contractorBy('du Toit'), from: -4, to: -4, at: '16:00', iso: true, points: 'Conveyor isolated, lock 11.', status: 'closed' },
  ];
  for (const p of permits) {
    const created = Math.max(0, -p.from + 1);
    const history: H[] = [{ daysAgo: created, by: p.contractor ? COORD : SUP.pc, role: p.contractor ? 'Contractor coordinator' : 'Shift supervisor', action: 'Permit requested' }];
    if (p.status !== 'requested') history.push({ daysAgo: Math.max(0, -p.from), by: SAFETY, role: 'Safety officer', action: 'Approve permit' });
    if (['active', 'suspended', 'closed'].includes(p.status)) history.push({ daysAgo: Math.max(0, -p.from), by: SAFETY, role: 'Safety officer', action: 'Activate permit' });
    if (p.status === 'suspended') history.push({ daysAgo: 0, by: SAFETY, role: 'Safety officer', action: 'Suspend permit', note: p.note });
    if (p.status === 'closed') history.push({ daysAgo: Math.max(0, -p.to), by: SAFETY, role: 'Safety officer', action: 'Close permit', note: 'Work complete, area inspected and isolations removed.' });
    rec('permits', 'PTW', {
      type: p.type, location: p.location, description: p.description, holder: p.holder, contractor: p.contractor?.id ?? '',
      validFrom: day(p.from), validTo: day(p.to), expiresAt: p.at, isolationConfirmed: p.iso, isolationPoints: p.points,
      gasO2: p.o2 ?? null, gasTestedBy: p.o2 !== undefined ? 'Ayanda Ngcobo' : '', precautions: p.type === 'hot' ? 'Fire extinguisher and fire watch for 60 minutes after work.' : p.type === 'height' ? 'Full-body harness, double lanyard, rescue plan.' : p.type === 'confined' ? 'Continuous gas monitoring, standby person at entry.' : 'Test before touch; earth applied.',
    }, { status: p.status, createdDaysAgo: created, history });
  }

  /* ---------- Equipment register ---------- */
  const fleet: Array<[string, string, string, string, number, number, number, string, number]> = [
    // fleetNo, model, category, location, engineHours, lastServiceHours, interval, availability, lastServiceDaysAgo
    ['LHD-03', 'Kudu K14 loader', 'lhd', 'l7e', 12480, 12250, 250, 'available', 20],
    ['LHD-05', 'Kudu K14 loader', 'lhd', 'l7e', 9875, 9600, 250, 'available', 26],
    ['LHD-07', 'Kudu K10 loader', 'lhd', 'l7w', 7340, 7200, 250, 'down', 14],
    ['LHD-09', 'Kudu K10 loader', 'lhd', 'l9n', 3120, 3000, 250, 'available', 11],
    ['DR-02', 'Bushbuck twin-boom drill rig', 'drill', 'l7e', 5460, 5300, 200, 'available', 18],
    ['DR-04', 'Bushbuck twin-boom drill rig', 'drill', 'l9n', 4210, 4100, 200, 'available', 12],
    ['BLT-01', 'Ratel roof bolter', 'bolter', 'l7w', 2890, 2700, 200, 'available', 22],
    ['LOCO-11', 'Mole 8 t battery locomotive', 'loco', 'shaft', 15200, 14800, 500, 'available', 30],
    ['LOCO-12', 'Mole 8 t battery locomotive', 'loco', 'shaft', 14950, 14400, 500, 'available', 41],
    ['FAN-L7-01', 'Aero 45 kW auxiliary fan', 'fan', 'l7e', 21900, 21000, 1000, 'available', 38],
    ['FAN-L9-01', 'Aero 75 kW auxiliary fan', 'fan', 'l9n', 18400, 17500, 1000, 'available', 36],
    ['PMP-L9-02', 'Tsessebe multistage dewatering pump', 'pump', 'pumpstation', 26310, 25500, 750, 'available', 34],
    ['PMP-L9-03', 'Tsessebe multistage dewatering pump', 'pump', 'pumpstation', 24100, 23700, 750, 'standby', 17],
    ['UV-21', 'Springbok 4x4 utility vehicle', 'uv', 'l7w', 6620, 6400, 250, 'available', 25],
  ];
  const eq: Record<string, DemoRecord> = {};
  for (const [fleetNo, model, category, location, engineHours, lastServiceHours, interval, availability, lsd] of fleet) {
    eq[fleetNo] = rec('equipment', 'EQ', {
      fleetNo, model, category, location, engineHours, lastServiceHours, serviceInterval: interval, nextServiceHours: lastServiceHours + interval,
      availability, lastServiceDate: day(-lsd),
    }, { createdDaysAgo: 400 });
  }

  /* ---------- Maintenance work orders ---------- */
  type Wo = [string, string, string, string, string, number, number | null, string, string, number | null, number];
  const wos: Wo[] = [
    // fleetNo, type, title, priority, status, raisedDaysAgo, plannedOffset, artisan, workDone, hoursAtService, downtimeHours
    ['LHD-03', 'planned', '250 h service', 'routine', 'completed', 22, -20, 'dm', 'Engine oil & filters, greasing, brake test.', 12250, 6],
    ['LHD-05', 'planned', '250 h service', 'routine', 'completed', 28, -26, 'dm', 'Engine oil & filters, transmission filter, tyre check.', 9600, 7],
    ['LHD-07', 'planned', '250 h service', 'routine', 'completed', 16, -14, 'dm', 'Full 250 h service.', 7200, 6],
    ['LHD-09', 'breakdown', 'Hydraulic hose burst on bucket ram', 'urgent', 'completed', 40, -40, 'tn', 'Hose replaced, hydraulic oil topped up.', 2960, 5],
    ['DR-02', 'breakdown', 'Boom 2 feed motor failure', 'urgent', 'completed', 33, -33, 'tn', 'Feed motor exchanged from stores.', 5380, 11],
    ['BLT-01', 'breakdown', 'Hydraulic hose overheated — smoke', 'emergency', 'completed', 9, -9, 'tn', 'Hose replaced with sleeved hose; bracket re-routed.', 2860, 8],
    ['BLT-01', 'planned', '200 h service', 'routine', 'completed', 24, -22, 'tn', '200 h service.', 2700, 5],
    ['LOCO-11', 'planned', '500 h service & battery check', 'routine', 'completed', 32, -30, 'ef', 'Service complete; cell 14 replaced.', 14800, 9],
    ['FAN-L9-01', 'breakdown', 'Fan tripped on overload', 'emergency', 'completed', 50, -50, 'ef', 'Starter contactor replaced; insulation test passed.', 17320, 4],
    ['PMP-L9-03', 'planned', '750 h service', 'routine', 'completed', 19, -17, 'tn', 'Bearings greased, gland packing replaced.', 23700, 8],
    ['UV-21', 'breakdown', 'Starter motor failure', 'urgent', 'completed', 12, -12, 'dm', 'Starter motor replaced.', 6560, 4],
    ['LHD-07', 'breakdown', 'Transmission oil leak — machine stopped', 'urgent', 'inprogress', 2, 0, 'dm', '', null, 0],
    ['LHD-05', 'planned', '250 h service (overdue)', 'urgent', 'planned', 3, 1, 'dm', '', null, 0],
    ['PMP-L9-02', 'planned', '750 h service', 'urgent', 'planned', 4, 0, 'tn', '', null, 0],
    ['DR-02', 'planned', '200 h service', 'routine', 'planned', 2, 2, 'tn', '', null, 0],
    ['LOCO-12', 'planned', '500 h service & battery check', 'urgent', 'raised', 5, null, '', '', null, 0],
    ['UV-21', 'planned', '250 h service', 'routine', 'raised', 1, null, '', '', null, 0],
    ['FAN-L7-01', 'breakdown', 'High vibration alarm on fan motor', 'urgent', 'raised', 0, null, '', '', null, 0],
    ['LHD-03', 'breakdown', 'Cab air-conditioner not cooling', 'routine', 'cancelled', 15, null, '', '', null, 0],
    ['DR-04', 'planned', '200 h service', 'routine', 'completed', 14, -12, 'tn', '200 h service.', 4100, 5],
  ];
  for (const [fleetNo, type, title, priority, status, raised, plannedOff, artisan, workDone, hrs, downtime] of wos) {
    const history: H[] = [{ daysAgo: raised, by: type === 'breakdown' ? SUP.pc : PLANNER, role: type === 'breakdown' ? 'Shift supervisor' : 'Maintenance planner', action: 'Work order raised' }];
    if (!['raised', 'cancelled'].includes(status)) history.push({ daysAgo: Math.max(0, raised - 1), by: PLANNER, role: 'Maintenance planner', action: 'Plan & assign' });
    if (status === 'inprogress' || status === 'completed') history.push({ daysAgo: plannedOff !== null ? Math.max(0, -plannedOff) : 0, by: PLANNER, role: 'Maintenance planner', action: 'Start work' });
    if (status === 'completed') history.push({ daysAgo: plannedOff !== null ? Math.max(0, -plannedOff) : 0, by: PLANNER, role: 'Maintenance planner', action: 'Complete work order' });
    if (status === 'cancelled') history.push({ daysAgo: Math.max(0, raised - 2), by: PLANNER, role: 'Maintenance planner', action: 'Cancel', note: 'Duplicate of an earlier request — combined with next service.' });
    rec('workorders', 'WO', {
      equipment: eq[fleetNo].id, type, title, priority, raisedOn: day(-raised), plannedDate: plannedOff !== null ? day(plannedOff) : '', assignedTo: artisan,
      description: type === 'breakdown' ? `${title}. Reported by the section (fictional).` : `Scheduled ${title} per the demo maintenance plan.`,
      workDone, hoursAtService: hrs, downtimeHours: downtime || null, completedOn: status === 'completed' && plannedOff !== null ? day(plannedOff) : '',
    }, { status, createdDaysAgo: raised, history });
  }

  /* ---------- Environmental monitoring (demo thresholds) ---------- */
  // Parameters cycle dust → noise → pH, so index % 3 picks the parameter.
  const exceed: Record<number, number> = { 6: 1.9, 16: 88, 38: 5.6, 39: 1.7 };
  const reviewNotes: Record<number, string> = {
    6: 'Water sprays at the tip were blocked. Sprays cleaned and re-checked next shift: 0.9 mg/m³.',
    16: 'Crusher screen panels worn. Hearing protection zone re-signed; panels scheduled for replacement.',
  };
  for (let i = 0; i < 40; i++) {
    const p = ENV_PARAMS[i % ENV_PARAMS.length];
    const point = p.points[Math.floor(i / ENV_PARAMS.length) % p.points.length];
    const base = p.value === 'dust' ? 0.55 + rnd() * 0.7 : p.value === 'noise' ? 76 + rnd() * 8 : 6.8 + rnd() * 1.4;
    let value = Math.round(base * (p.value === 'noise' ? 1 : 100)) / (p.value === 'noise' ? 1 : 100);
    if (exceed[i] !== undefined) value = exceed[i];
    const dAgo = Math.max(0, Math.round(60 - i * 1.5));
    const status = dAgo > 7 ? 'reviewed' : 'recorded';
    const history: H[] = [{ daysAgo: dAgo, by: ENVIRO, role: 'Environmental officer', action: 'Reading recorded' }];
    if (status === 'reviewed') history.push({ daysAgo: Math.max(0, dAgo - 2), by: ENVIRO, role: 'Environmental officer', action: 'Mark reviewed', note: reviewNotes[i] });
    rec('envreadings', 'ENV', {
      date: day(-dAgo), time: ['08:30', '10:15', '13:40', '15:20'][i % 4], point, parameter: p.value, value,
      instrument: p.value === 'dust' ? 'Gravimetric sampler GS-2 (demo)' : p.value === 'noise' ? 'Sound level meter SLM-7 (demo)' : 'Portable pH meter PH-3 (demo)',
      recordedBy: ENVIRO, notes: '',
    }, { status, createdDaysAgo: dAgo, history });
  }

  return { users, collections, currentUserId: 'u_mm' };
}
