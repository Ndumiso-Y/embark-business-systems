// Fictional seed data for the Human resources demo. Every person, number and document is invented:
// no real ID numbers, tax numbers or bank details are stored (the onboarding checklist only records
// that an item was captured). Dates are relative to `today` and a small PRNG keeps every reset
// identical. Records the walkthrough opens are created first so their ids never move.
import { seeder, user } from '../../core/seed';
import { addDays, daysBetween } from '../../core/lib/dates';
import type { DemoRecord, IndustryData, Values } from '../../core/types';
import { CERT_TYPES, WARNING_MONTHS, jobOf } from './data';
import {
  addMonths, addWorkingDays, annualBalance, completedMonths, fullName, monthEnd, monthStart, nextWorkingDay, packRows, packSnapshot, periodOf, prevWorkingDay,
  requiredOnboarding, weekStart, workingDays,
} from './helpers';

/** Small deterministic PRNG (same generator as the other demos). */
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
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

type Row = {
  first: string; last: string; job: string; site: string; ago: number; status?: string;
  fixedIn?: number; carry?: number; outcome?: string; lastDayIn?: number; exitReason?: string; onboarding?: string[]; salary?: number;
};
/** About fifty people on the books, plus two starters and five who left in the last year. */
const PEOPLE: Row[] = [
  // Head office · Johannesburg
  { first: 'Sipho', last: 'Mahlangu', job: 'md', site: 'ho', ago: 4100, carry: 5 },
  { first: 'Annelie', last: 'van der Walt', job: 'hrmgr', site: 'ho', ago: 2250, carry: 4 },
  { first: 'Kagiso', last: 'Molefe', job: 'hrofficer', site: 'ho', ago: 1150, carry: 2 },
  { first: 'Fatima', last: 'Ebrahim', job: 'payroll', site: 'ho', ago: 1520, carry: 3 },
  { first: 'Thandeka', last: 'Ngubane', job: 'adminclerk', site: 'ho', ago: 760, carry: 1 },
  { first: 'Rajesh', last: 'Govender', job: 'finmgr', site: 'ho', ago: 2600, carry: 5 },
  { first: 'Charmaine', last: 'Adams', job: 'accclerk', site: 'ho', ago: 1880, carry: 2 },
  { first: 'Mandla', last: 'Shezi', job: 'accclerk', site: 'ho', ago: 70, status: 'probation' },
  { first: 'Liezl', last: 'Steyn', job: 'salesmgr', site: 'ho', ago: 3000, carry: 5 },
  { first: 'Tebogo', last: 'Masemola', job: 'kam', site: 'ho', ago: 1200, carry: 2 },
  { first: 'Yusuf', last: 'Cassim', job: 'kam', site: 'ho', ago: 560, carry: 0 },
  // Johannesburg depot
  { first: 'Craig', last: 'Naidoo', job: 'depotmgr', site: 'jhb', ago: 3300, carry: 5 },
  { first: 'Palesa', last: 'Motaung', job: 'whsup', site: 'jhb', ago: 2050, carry: 3 },
  { first: 'Bongani', last: 'Zwane', job: 'forklift', site: 'jhb', ago: 1400, carry: 1 },
  { first: 'Elize', last: 'Jacobs', job: 'picker', site: 'jhb', ago: 980, carry: 4 },
  { first: 'Lucky', last: 'Maluleke', job: 'forklift', site: 'jhb', ago: 1650, carry: 0 },
  { first: 'Precious', last: 'Mabuza', job: 'picker', site: 'jhb', ago: 890, carry: 2 },
  { first: 'Kabelo', last: 'Sebola', job: 'picker', site: 'jhb', ago: 150, fixedIn: 18 },
  { first: 'Ntando', last: 'Cele', job: 'picker', site: 'jhb', ago: 430, carry: 1 },
  { first: 'Willem', last: 'Swart', job: 'fleetctl', site: 'jhb', ago: 2400, carry: 3 },
  { first: 'Themba', last: 'Mkhize', job: 'driver', site: 'jhb', ago: 1750, carry: 2 },
  { first: 'Andile', last: 'Majola', job: 'driver', site: 'jhb', ago: 1300, carry: 1 },
  { first: 'Ricardo', last: 'Februarie', job: 'driver', site: 'jhb', ago: 1020, carry: 0 },
  { first: 'Sibusiso', last: 'Hadebe', job: 'driver', site: 'jhb', ago: 900, status: 'notice', lastDayIn: 12, exitReason: 'resignation', carry: 2 },
  { first: 'Johannes', last: 'Mokoena', job: 'driverasst', site: 'jhb', ago: 640, carry: 1 },
  { first: 'Nadia', last: 'Pillay', job: 'salesrep', site: 'jhb', ago: 1100, carry: 3 },
  { first: 'Dumisani', last: 'Khoza', job: 'salesrep', site: 'jhb', ago: 40, status: 'probation' },
  { first: 'Refilwe', last: 'Seabi', job: 'adminclerk', site: 'jhb', ago: 1250, carry: 2 },
  // Durban depot
  { first: 'Nokuthula', last: 'Zungu', job: 'depotmgr', site: 'dbn', ago: 2900, carry: 4 },
  { first: 'Lerato', last: 'Dube', job: 'picker', site: 'dbn', ago: 1100, carry: 3 },
  { first: 'Sanele', last: 'Ngcobo', job: 'forklift', site: 'dbn', ago: 1500, carry: 5 },
  { first: 'Priya', last: 'Moodley', job: 'picker', site: 'dbn', ago: 820, carry: 4 },
  { first: 'Ayanda', last: 'Mthethwa', job: 'picker', site: 'dbn', ago: 700, carry: 5 },
  { first: 'Kevin', last: 'Chetty', job: 'picker', site: 'dbn', ago: 85, status: 'probation' },
  { first: 'Zodwa', last: 'Gumede', job: 'forklift', site: 'dbn', ago: 1900, carry: 2 },
  { first: 'Siyabonga', last: 'Ntuli', job: 'driver', site: 'dbn', ago: 1350, carry: 1 },
  { first: 'Vusi', last: 'Mabaso', job: 'driver', site: 'dbn', ago: 2200, carry: 3 },
  { first: 'Gary', last: 'Reddy', job: 'driver', site: 'dbn', ago: 600, carry: 0 },
  { first: 'Mlungisi', last: 'Khanyile', job: 'driverasst', site: 'dbn', ago: 480, carry: 1 },
  { first: 'Shanice', last: 'Naicker', job: 'salesrep', site: 'dbn', ago: 950, carry: 2 },
  { first: 'Musa', last: 'Dlamini', job: 'salesrep', site: 'dbn', ago: 1700, carry: 2 },
  { first: 'Roxanne', last: 'Jansen', job: 'adminclerk', site: 'dbn', ago: 530, carry: 1 },
  // Gqeberha depot
  { first: 'Lwazi', last: 'Ntshona', job: 'depotmgr', site: 'gqb', ago: 1850, carry: 3 },
  { first: 'Anathi', last: 'Booi', job: 'picker', site: 'gqb', ago: 1000, carry: 2 },
  { first: 'Chantelle', last: 'Arendse', job: 'forklift', site: 'gqb', ago: 1450, carry: 3 },
  { first: 'Sinazo', last: 'Matiwane', job: 'picker', site: 'gqb', ago: 380, carry: 0 },
  { first: 'Luvuyo', last: 'Peter', job: 'picker', site: 'gqb', ago: 100, status: 'probation' },
  { first: 'Unathi', last: 'Mangcu', job: 'driver', site: 'gqb', ago: 1600, carry: 2 },
  { first: 'Marius', last: 'Olivier', job: 'driver', site: 'gqb', ago: 290, fixedIn: 75 },
  { first: 'Siphesihle', last: 'Gxowa', job: 'driverasst', site: 'gqb', ago: 720, carry: 1 },
  { first: 'Bianca', last: 'Hendricks', job: 'salesrep', site: 'gqb', ago: 1180, carry: 2 },
  { first: 'Nomvuyo', last: 'Tshangela', job: 'adminclerk', site: 'gqb', ago: 2100, carry: 4 },
  // Starting soon (onboarding)
  { first: 'Xolani', last: 'Biyela', job: 'driver', site: 'dbn', ago: 0, status: 'onboarding', onboarding: ['contract', 'idcopy', 'taxno', 'emergency', 'induction'] },
  { first: 'Ruan', last: 'Meyer', job: 'picker', site: 'gqb', ago: -10, status: 'onboarding', onboarding: ['contract', 'idcopy', 'taxno', 'banking'] },
  // Left in the last twelve months
  { first: 'Gift', last: 'Molapo', job: 'driver', site: 'jhb', ago: 1300, status: 'exited', lastDayIn: -40, exitReason: 'resignation' },
  { first: 'Shireen', last: 'Davids', job: 'accclerk', site: 'ho', ago: 820, status: 'exited', lastDayIn: -120, exitReason: 'resignation' },
  { first: 'Pule', last: 'Ramokgopa', job: 'picker', site: 'dbn', ago: 700, status: 'exited', lastDayIn: -200, exitReason: 'dismissal' },
  { first: 'Jacques', last: 'du Plessis', job: 'kam', site: 'ho', ago: 5200, status: 'exited', lastDayIn: -300, exitReason: 'retirement' },
  { first: 'Nosipho', last: 'Maseko', job: 'picker', site: 'gqb', ago: 380, status: 'exited', lastDayIn: -75, exitReason: 'contract' },
];

export function buildHrSeed(today: string) {
  const { collections, rec, day } = seeder(today);
  const rnd = prng(20261121);
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const year = today.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const period = periodOf(today);
  const HR = { by: 'Kagiso Molefe', role: 'HR officer' };

  /* ---------- Employees ---------- */
  const emps = PEOPLE.map((p, i) => {
    const job = jobOf(p.job)!;
    const start = day(-p.ago);
    const status = p.status ?? 'active';
    const onboarding = status === 'onboarding' ? (p.onboarding ?? []) : requiredOnboarding({ values: { job: p.job } } as unknown as DemoRecord).map((x) => x.key);
    const values: Values = {
      firstName: p.first, lastName: p.last, job: p.job, site: p.site, manager: '', startDate: start,
      employmentType: p.fixedIn !== undefined ? 'fixed' : 'permanent', fixedTermEnd: p.fixedIn !== undefined ? day(p.fixedIn) : '',
      probationEnd: addMonths(start, 3), salary: Math.round((p.salary ?? job.salary) * (0.94 + ((i * 37) % 13) / 100) / 50) * 50,
      annualCarry: p.carry ?? 0, phone: `0${[82, 71, 83, 60, 72][i % 5]} 555 ${String(1000 + ((i * 7919) % 9000)).padStart(4, '0')}`,
      email: `${slug(p.first)}.${slug(p.last)}@example.com`, onboarding: onboarding.join(','),
      probationOutcome: status === 'probation' || status === 'onboarding' ? '' : 'confirmed',
      probationReviewDate: status === 'probation' || status === 'onboarding' ? '' : addMonths(start, 3),
      probationNotes: '', exitReason: p.exitReason ?? '', lastDay: p.lastDayIn !== undefined ? day(p.lastDayIn) : '',
      exitEquipment: status === 'exited', exitAccess: status === 'exited', exitNotes: status === 'exited' ? 'Exit interview held; certificate of service issued (fictional).' : '', hrNotes: '',
    };
    return rec('employees', 'EMP', values, { status, createdDaysAgo: Math.max(0, p.ago + 14), history: [{ daysAgo: Math.max(0, p.ago + 14), ...HR, action: 'Employee record created (fictional)' }] });
  });
  const E = (first: string) => emps.find((e) => e.values.firstName === first)!;
  // Reporting lines.
  const md = E('Sipho'), hrm = E('Annelie'), fin = E('Rajesh'), salesMgr = E('Liezl');
  const depot: Record<string, DemoRecord> = { jhb: E('Craig'), dbn: E('Nokuthula'), gqb: E('Lwazi') };
  for (const e of emps) {
    const job = String(e.values.job), site = String(e.values.site);
    let mgr: DemoRecord | undefined;
    if (job === 'md') mgr = undefined;
    else if (['depotmgr', 'hrmgr', 'finmgr', 'salesmgr'].includes(job)) mgr = md;
    else if (['hrofficer', 'payroll'].includes(job) || (job === 'adminclerk' && site === 'ho')) mgr = hrm;
    else if (job === 'accclerk') mgr = fin;
    else if (['kam', 'salesrep'].includes(job)) mgr = salesMgr;
    else if (['picker', 'forklift'].includes(job) && site === 'jhb') mgr = E('Palesa');
    else if (['driver', 'driverasst'].includes(job) && site === 'jhb') mgr = E('Willem');
    else mgr = depot[site];
    e.values.manager = mgr?.id ?? '';
  }
  E('Luvuyo').values.probationNotes = 'Review meeting not yet held.';
  E('Sibusiso').values.exitNotes = 'Resigned to join a family business in Polokwane. Handover of route 7 to Andile Majola.';

  /* ---------- Leave ---------- */
  const leave = (who: DemoRecord, type: string, start: string, end: string, status: string, extra: Values = {}, approver = '') => {
    // Decided by the employee's own manager (HR for the managing director).
    const by = approver || (emps.find((x) => x.id === who.values.manager) ? fullName(emps.find((x) => x.id === who.values.manager)) : 'Kagiso Molefe');
    const requestedOn = String(extra.requestedOn ?? (addDays(start, -10) < today ? addDays(start, -10) : today));
    return rec('leave', 'LV', { employee: who.id, type, start, end, reason: '', medicalCert: false, decidedBy: status === 'requested' ? '' : by, coverNote: '', ...extra, requestedOn },
      { status, createdDaysAgo: Math.max(0, daysBetween(requestedOn, today)), history: [{ daysAgo: Math.max(0, daysBetween(requestedOn, today)), by: fullName(who), role: 'Employee',
        action: status === 'requested' ? 'Leave requested' : `Requested; ${status === 'taken' ? 'approved and taken' : 'approved'} by ${by}` }] });
  };
  const nextMon = addDays(weekStart(today), 7);
  const span = (start: string, n: number) => { const s = nextWorkingDay(start); return [s, addWorkingDays(s, n - 1)] as const; };

  // The walkthrough's requests come first so their ids never move.
  const [p1s, p1e] = span(addDays(nextMon, 1), 3);
  leave(E('Priya'), 'annual', p1s, p1e, 'requested', { reason: 'Family wedding in Pietermaritzburg.', requestedOn: day(-1) });
  const [a2s, a2e] = span(addDays(today, 21), 2);
  leave(hrm, 'annual', a2s, a2e, 'requested', { reason: 'School prize-giving and a long weekend.', requestedOn: day(-2) });
  const tEnd = prevWorkingDay(day(-1));
  leave(E('Themba'), 'sick', addWorkingDays(tEnd, -2), tEnd, 'requested', { reason: 'Flu — booked off by a doctor; certificate to follow.', requestedOn: tEnd });
  const [k4s, k4e] = span(addDays(today, 14), 8);
  leave(E('Kabelo'), 'annual', k4s, k4e, 'requested', { reason: 'Travelling home to Limpopo before the contract ends.', requestedOn: day(-4) });
  const inMonth = (offset: number) => {
    let d = addDays(today, offset);
    if (d > monthEnd(period)) d = monthEnd(period);
    d = nextWorkingDay(d < monthStart(period) ? monthStart(period) : d);
    return d > monthEnd(period) ? prevWorkingDay(monthEnd(period)) : d;
  };
  const nUnpaid = inMonth(3);
  leave(E('Nadia'), 'unpaid', nUnpaid, nUnpaid, 'requested', { reason: 'Moving house — annual leave already used for the December trip.', requestedOn: day(-1) });
  // The two Durban warehouse colleagues who are already away next week (the clash behind the first request).
  leave(E('Ayanda'), 'annual', nextWorkingDay(nextMon), addWorkingDays(nextWorkingDay(nextMon), 4), 'approved', { reason: 'Holiday in Port Shepstone.' }, 'Nokuthula Zungu');
  const [s7s, s7e] = span(addDays(nextMon, 1), 3);
  leave(E('Sanele'), 'annual', s7s, s7e, 'approved', { reason: 'Child’s graduation.' }, 'Nokuthula Zungu');
  // Away today.
  leave(E('Elize'), 'annual', addDays(today, -2), addDays(today, 2), 'approved', { reason: 'Mid-year break.' }, 'Palesa Motaung');
  const workToday = nextWorkingDay(today);
  leave(E('Gary'), 'sick', workToday, workToday, 'approved', { reason: 'Phoned in sick at 05:30.' }, 'Nokuthula Zungu');
  leave(E('Tebogo'), 'family', workToday, workToday, 'approved', { reason: 'Child in hospital.' }, 'Liezl Steyn');
  // Unpaid days in this pay period (pulled into the payroll pack).
  const mUnpaid = inMonth(-6);
  leave(E('Musa'), 'unpaid', mUnpaid, addWorkingDays(mUnpaid, 1) > monthEnd(period) ? mUnpaid : addWorkingDays(mUnpaid, 1), mUnpaid <= today ? 'taken' : 'approved', { reason: 'Personal matter — no annual leave left.' }, 'Liezl Steyn');

  // History and future bookings for everyone else, kept within each person's balance.
  const data = () => ({ collections } as unknown as IndustryData);
  const free = (who: DemoRecord, s: string, e: string) => !(collections.leave ?? []).some((l) => l.values.employee === who.id && String(l.values.start) <= e && String(l.values.end) >= s);
  const scripted = new Set(['Priya', 'Kabelo', 'Ayanda', 'Sanele', 'Lerato']);
  for (const e of emps) {
    if (!['probation', 'active', 'notice'].includes(String(e.status))) continue;
    const start = String(e.values.startDate);
    const first = String(e.values.firstName);
    // Annual leave already taken this leave year.
    if (!scripted.has(first)) {
      const earliest = start > yearStart ? addDays(start, 30) : yearStart;
      const room = workingDays(earliest, addDays(today, -4));
      for (let k = 0; k < 3 && room > 6; k++) {
        const avail = annualBalance(data(), e, today).available;
        const n = Math.min(Math.floor(avail * (0.25 + rnd() * 0.3)), 1 + Math.floor(rnd() * 5));
        if (n < 1) break;
        const s = nextWorkingDay(addWorkingDays(earliest, Math.floor(rnd() * Math.max(1, room - n - 2))));
        const en = addWorkingDays(s, n - 1);
        if (en >= addDays(today, -2) || !free(e, s, en)) continue;
        leave(e, 'annual', s, en, 'taken', { reason: pick(['Holiday', 'Family visit', 'Rest', 'School holidays', 'Moving house']) });
      }
      // A December booking for some.
      if (rnd() < 0.3) {
        const s = nextWorkingDay(addDays(today, 8 + Math.floor(rnd() * 20)));
        const n = 2 + Math.floor(rnd() * 4);
        const en = addWorkingDays(s, n - 1);
        if (en.slice(0, 4) === year && free(e, s, en) && annualBalance(data(), e, today).available >= n) leave(e, 'annual', s, en, 'approved', { reason: 'End-of-year break' });
      }
    }
    // Sick spells over the last year (none in the first six months of service).
    if (completedMonths(start, today) >= 6 && !['Themba'].includes(first)) {
      const spells = first === 'Ricardo' ? 5 : rnd() < 0.4 ? 0 : rnd() < 0.55 ? 1 : rnd() < 0.7 ? 2 : 3;
      for (let k = 0; k < spells; k++) {
        const long = rnd() < 0.15;
        const n = long ? 3 : 1 + Math.floor(rnd() * 2);
        const s = nextWorkingDay(addDays(today, -(12 + Math.floor(rnd() * 320))));
        const en = addWorkingDays(s, n - 1);
        if (s < addDays(start, 14) || en >= addDays(today, -1) || !free(e, s, en)) continue;
        leave(e, 'sick', s, en, 'taken', { medicalCert: n > 2, reason: pick(['Flu', 'Stomach bug', 'Back pain', 'Migraine', 'Dental procedure']) });
      }
    }
    if (completedMonths(start, today) >= 5 && rnd() < 0.15) {
      const s = nextWorkingDay(addDays(today, -(20 + Math.floor(rnd() * 200))));
      if (s >= yearStart && free(e, s, s)) leave(e, 'family', s, s, 'taken', { reason: 'Child ill' });
    }
  }
  const lerato = E('Lerato');
  if (free(lerato, addDays(today, -60), addDays(today, -54)) && workingDays(yearStart, addDays(today, -60)) > 0) {
    const s = nextWorkingDay(addDays(today, -60));
    if (s >= yearStart && annualBalance(data(), lerato, today).available >= 3) leave(lerato, 'annual', s, addWorkingDays(s, 2), 'taken', { reason: 'Visiting family in Eshowe' }, 'Nokuthula Zungu');
  }

  /* ---------- Certificates ---------- */
  let certNo = 0;
  const months = (type: string) => CERT_TYPES.find((c) => c.value === type)!.months;
  const cert = (who: DemoRecord, type: string, expiresIn: number, provider: string) => {
    const expires = day(expiresIn);
    certNo += 1;
    return rec('certificates', 'CRT', { employee: who.id, type, number: `DEMO-${type.toUpperCase()}-${String(certNo).padStart(4, '0')}`, issued: addMonths(expires, -months(type)), expires, provider },
      { createdDaysAgo: Math.max(0, -expiresIn + months(type) * 30 - 700) });
  };
  const EXP: Record<string, number> = { Themba: -12, Unathi: 25, Zodwa: -5, Chantelle: 40 };
  for (const e of emps) {
    const job = jobOf(String(e.values.job))!;
    const first = String(e.values.firstName);
    if (e.status === 'exited') continue;
    if (job.driver) cert(e, 'prdp', EXP[first] ?? 90 + Math.floor(rnd() * 500), 'Department of Transport (fictional record)');
    if (job.forklift) cert(e, 'forklift', EXP[first] ?? 80 + Math.floor(rnd() * 500), 'Lift-Right Training (fictional)');
  }
  cert(E('Refilwe'), 'firstaid', 20, 'St Bernard First Aid (fictional)');
  for (const f of ['Palesa', 'Nokuthula', 'Craig', 'Lwazi', 'Nomvuyo']) cert(E(f), 'firstaid', 120 + Math.floor(rnd() * 700), 'St Bernard First Aid (fictional)');
  cert(E('Willem'), 'firstaid', -30, 'St Bernard First Aid (fictional)');

  /* ---------- Training courses ---------- */
  const ids = (...names: string[]) => names.map((n) => E(n).id).join(',');
  rec('courses', 'TRN', { title: 'Forklift operator refresher', certType: 'forklift', date: prevWorkingDay(day(-1)), provider: 'Lift-Right Training (fictional)', venue: 'jhb', attendees: ids('Zodwa', 'Chantelle', 'Bongani'), attended: '', notes: 'Practical assessment on the counterbalance and reach trucks.' },
    { status: 'planned', createdDaysAgo: 30 });
  rec('courses', 'TRN', { title: 'First aid level 1', certType: 'firstaid', date: nextWorkingDay(day(9)), provider: 'St Bernard First Aid (fictional)', venue: 'ho', attendees: ids('Refilwe', 'Roxanne', 'Willem'), attended: '', notes: 'Three-day course.' }, { status: 'planned', createdDaysAgo: 14 });
  rec('courses', 'TRN', { title: 'New-starter induction', certType: '', date: nextWorkingDay(day(3)), provider: 'In-house (HR)', venue: 'dbn', attendees: ids('Xolani', 'Kevin'), attended: '', notes: 'Company rules, leave, safety and the disciplinary code.' }, { status: 'planned', createdDaysAgo: 5 });
  const fm = rec('courses', 'TRN', { title: 'Fire marshal', certType: 'firemarshal', date: prevWorkingDay(day(-90)), provider: 'SafeExit Fire Training (fictional)', venue: 'ho', attendees: ids('Thandeka', 'Palesa'), attended: ids('Thandeka', 'Palesa'), notes: '' }, { status: 'completed', createdDaysAgo: 120 });
  for (const f of ['Thandeka', 'Palesa']) rec('certificates', 'CRT', { employee: E(f).id, type: 'firemarshal', number: `DEMO-FIREMARSHAL-${String(++certNo).padStart(4, '0')}`, issued: String(fm.values.date), expires: addMonths(String(fm.values.date), 24), provider: 'SafeExit Fire Training (fictional)' }, { createdDaysAgo: 90 });
  rec('courses', 'TRN', { title: 'Defensive driving', certType: '', date: prevWorkingDay(day(-45)), provider: 'RoadWise (fictional)', venue: 'dbn', attendees: ids('Siyabonga', 'Vusi', 'Gary', 'Mlungisi'), attended: ids('Siyabonga', 'Vusi', 'Gary'), notes: 'Mlungisi was on leave.' }, { status: 'completed', createdDaysAgo: 70 });

  /* ---------- Discipline & grievances ---------- */
  const caseRec = (who: DemoRecord, values: Values, status: string, ago: number, history: Array<{ daysAgo: number; by: string; role: string; action: string; note?: string }>) =>
    rec('cases', 'CASE', { employee: who.id, investigator: '', hearingDate: '', noticeGiven: '', chairperson: '', finding: '', sanction: '', outcomeNotes: '', appealNotes: '', ...values }, { status, createdDaysAgo: ago, history });
  caseRec(E('Ricardo'), { kind: 'disciplinary', category: 'absenteeism', reportedOn: day(-6), reportedBy: 'Willem Swart', investigator: 'Kagiso Molefe',
    description: 'Did not report for duty on three working days this month without phoning in or applying for leave. Route 4 deliveries were delayed.', confidential: 'Prior counselling in July (on file).' }, 'investigating', 6,
  [{ daysAgo: 6, by: 'Willem Swart', role: 'Fleet controller', action: 'Reported' }, { daysAgo: 4, ...HR, action: 'Investigation started', note: 'Clock-in records and route sheets requested.' }]);
  const hearing = prevWorkingDay(day(-1));
  caseRec(E('Bongani'), { kind: 'disciplinary', category: 'safety', reportedOn: day(-15), reportedBy: 'Palesa Motaung', investigator: 'Palesa Motaung', hearingDate: hearing, noticeGiven: addWorkingDays(hearing, -4),
    description: 'Operated a forklift without the seatbelt fastened; a near miss with a picker in aisle 4 (CCTV reviewed).', confidential: '' }, 'hearing', 15,
  [{ daysAgo: 15, by: 'Palesa Motaung', role: 'Warehouse supervisor', action: 'Reported' }, { daysAgo: 12, ...HR, action: 'Investigation started' }, { daysAgo: 6, ...HR, action: 'Hearing scheduled', note: 'Notice handed over in person; employee may bring a representative.' }]);
  caseRec(E('Priya'), { kind: 'grievance', category: 'shifts', reportedOn: day(-9), reportedBy: 'Priya Moodley', investigator: 'Kagiso Molefe',
    description: 'Says Saturday overtime shifts are offered to the same three people every week.', confidential: '' }, 'investigating', 9,
  [{ daysAgo: 9, by: 'Priya Moodley', role: 'Employee', action: 'Grievance lodged' }, { daysAgo: 7, ...HR, action: 'Investigation started', note: 'Overtime rosters for the last eight weeks requested from the depot.' }]);
  const lucky = caseRec(E('Lucky'), { kind: 'disciplinary', category: 'latecoming', reportedOn: day(-80), reportedBy: 'Palesa Motaung', investigator: 'Palesa Motaung', hearingDate: day(-62), noticeGiven: day(-67),
    chairperson: 'Craig Naidoo', finding: 'guilty', sanction: 'verbal', description: 'Late for the 06:00 shift six times in four weeks.', outcomeNotes: 'Accepted the finding; arranged a lift club.', confidential: '' }, 'closed', 80,
  [{ daysAgo: 80, by: 'Palesa Motaung', role: 'Warehouse supervisor', action: 'Reported' }, { daysAgo: 60, by: 'Craig Naidoo', role: 'Chairperson', action: 'Outcome recorded', note: 'Guilty — verbal warning.' }, { daysAgo: 58, ...HR, action: 'Closed' }]);
  const themba = caseRec(E('Themba'), { kind: 'disciplinary', category: 'vehicle', reportedOn: day(-45), reportedBy: 'Willem Swart', investigator: 'Willem Swart', hearingDate: day(-22), noticeGiven: day(-28),
    chairperson: 'Lwazi Ntshona', finding: 'guilty', sanction: 'final', description: 'Reversed a loaded truck into the loading-bay canopy; second vehicle-damage incident this year.', outcomeNotes: 'Final written warning.', appealNotes: 'Appeal lodged: says the reverse camera was faulty and a job card proves it.', confidential: '' }, 'appeal', 45,
  [{ daysAgo: 45, by: 'Willem Swart', role: 'Fleet controller', action: 'Reported' }, { daysAgo: 20, by: 'Lwazi Ntshona', role: 'Chairperson', action: 'Outcome recorded', note: 'Guilty — final written warning.' }, { daysAgo: 16, ...HR, action: 'Appeal lodged', note: 'Reverse-camera job card attached.' }]);
  caseRec(emps.find((e) => e.values.firstName === 'Pule')!, { kind: 'disciplinary', category: 'stock', reportedOn: day(-230), reportedBy: 'Nokuthula Zungu', investigator: 'Kagiso Molefe', hearingDate: day(-210), noticeGiven: day(-216),
    chairperson: 'Craig Naidoo', finding: 'guilty', sanction: 'dismissal', description: 'Two cases of soft drinks found in a personal vehicle at the gate without a release note.', outcomeNotes: 'Dismissed; last working day set.', confidential: '' }, 'closed', 230,
  [{ daysAgo: 230, by: 'Nokuthula Zungu', role: 'Depot manager', action: 'Reported' }, { daysAgo: 205, by: 'Craig Naidoo', role: 'Chairperson', action: 'Outcome recorded', note: 'Guilty — dismissal.' }, { daysAgo: 180, ...HR, action: 'Closed', note: 'No appeal lodged within the period.' }]);
  caseRec(E('Charmaine'), { kind: 'grievance', category: 'workload', reportedOn: day(-70), reportedBy: 'Charmaine Adams', investigator: 'Annelie van der Walt', chairperson: 'Rajesh Govender', finding: 'partly',
    description: 'Creditors and debtors work combined after a resignation, with no extra help at month-end.', outcomeNotes: 'Temporary help at month-end until the vacancy is filled.', confidential: '' }, 'closed', 70,
  [{ daysAgo: 70, by: 'Charmaine Adams', role: 'Employee', action: 'Grievance lodged' }, { daysAgo: 55, by: 'Rajesh Govender', role: 'Chairperson', action: 'Outcome recorded', note: 'Partly upheld.' }, { daysAgo: 50, ...HR, action: 'Closed' }]);
  const precious = caseRec(E('Precious'), { kind: 'disciplinary', category: 'conduct', reportedOn: day(-270), reportedBy: 'Palesa Motaung', investigator: 'Palesa Motaung', hearingDate: day(-252), noticeGiven: day(-258),
    chairperson: 'Craig Naidoo', finding: 'guilty', sanction: 'written', description: 'Swore at a customer’s receiving clerk during a collection.', outcomeNotes: 'Written warning.', confidential: '' }, 'closed', 270,
  [{ daysAgo: 270, by: 'Palesa Motaung', role: 'Warehouse supervisor', action: 'Reported' }, { daysAgo: 250, by: 'Craig Naidoo', role: 'Chairperson', action: 'Outcome recorded', note: 'Guilty — written warning.' }]);
  const warn = (c: DemoRecord, level: string, issued: string, reason: string) =>
    rec('warnings', 'WRN', { employee: c.values.employee, level, issued, expires: addMonths(issued, WARNING_MONTHS[level]), case: c.id, reason }, { createdDaysAgo: 1 });
  warn(lucky, 'verbal', day(-60), 'Late coming');
  warn(themba, 'final', day(-20), 'Vehicle damage (under appeal)');
  warn(precious, 'written', day(-250), 'Abusive conduct');

  /* ---------- Performance reviews ---------- */
  const cycle = `${year} annual review`;
  const due = day(20);
  const review = (who: DemoRecord, status: string, v: Values) =>
    rec('reviews', 'REV', { employee: who.id, cycle, dueDate: due, selfRating: '', selfComments: '', managerRating: '', managerComments: '', moderatedRating: '', moderationNote: '', pipActions: '', pipReview: '', ...v }, { status, createdDaysAgo: 30 });
  review(E('Ayanda'), 'manager', { selfRating: '3', selfComments: 'I learned the new scanner quickly.', managerRating: '2', managerComments: 'Picking accuracy 96.1% against a 99% target; two late starts in October.' });
  review(E('Sanele'), 'manager', { selfRating: '4', selfComments: 'No incidents this year; trained two new operators.', managerRating: '5', managerComments: 'Zero damage, top pallets-per-hour in all three depots.' });
  review(E('Tebogo'), 'moderation', { selfRating: '3', selfComments: 'Lost one account to a competitor on price.', managerRating: '1', managerComments: 'Missed target in nine of eleven months; account visits not logged.' });
  review(lerato, 'self', {});
  review(E('Zodwa'), 'self', {});
  review(E('Siyabonga'), 'manager', { selfRating: '4', selfComments: 'All deliveries on time on route 2.' });
  for (const [f, r] of [['Craig', '4'], ['Palesa', '3'], ['Fatima', '4'], ['Willem', '3'], ['Charmaine', '3'], ['Vusi', '3']] as const) {
    review(E(f), 'signed', { selfRating: r, selfComments: 'Discussed in the review meeting.', managerRating: r, managerComments: 'Agreed in the review meeting.' });
  }
  review(E('Ntando'), 'signed', { selfRating: '3', selfComments: 'Still learning the pick paths.', managerRating: '2', managerComments: 'Accuracy below target.', pipActions: 'Buddy with Elize for two weeks; weekly accuracy check.', pipReview: day(25) });

  /* ---------- Hiring ---------- */
  const req = (v: Values, status: string, ago: number) => rec('requisitions', 'REQ', { positions: 1, notes: '', ...v }, { status, createdDaysAgo: ago });
  req({ title: 'Fleet controller — Durban', job: 'fleetctl', site: 'dbn', reason: 'growth', budgeted: false, salaryBudget: 22000, hiringManager: depot.dbn.id, notes: 'Two new customer routes from January; no fleet controller at the depot.' }, 'draft', 3);
  const r2 = req({ title: 'Delivery driver — Johannesburg', job: 'driver', site: 'jhb', reason: 'replacement', budgeted: true, salaryBudget: 15800, hiringManager: E('Willem').id, notes: `Replaces ${fullName(E('Gift'))}.` }, 'open', 35);
  const r3 = req({ title: 'Sales representative — Gqeberha', job: 'salesrep', site: 'gqb', reason: 'growth', budgeted: true, salaryBudget: 24000, hiringManager: salesMgr.id, notes: 'Eastern Cape route expansion.' }, 'open', 20);
  const r4 = req({ title: 'Delivery driver — Durban', job: 'driver', site: 'dbn', reason: 'replacement', budgeted: true, salaryBudget: 15800, hiringManager: depot.dbn.id }, 'filled', 60);
  const r5 = req({ title: 'Picker / packer — Gqeberha', job: 'picker', site: 'gqb', reason: 'replacement', budgeted: true, salaryBudget: 9800, hiringManager: depot.gqb.id, notes: `Replaces ${fullName(E('Nosipho'))}.` }, 'filled', 70);
  const app = (first: string, last: string, r: DemoRecord, status: string, v: Values = {}, ago = 14) =>
    rec('applicants', 'APP', { firstName: first, lastName: last, requisition: r.id, phone: `07${Math.floor(rnd() * 9)} 555 ${String(1000 + Math.floor(rnd() * 8999))}`, email: `${slug(first)}.${slug(last)}@example.com`,
      source: pick(['referral', 'website', 'jobboard', 'walkin']), appliedOn: day(-ago), interviewDate: '', interviewScore: '', interviewNotes: '', offerSalary: '', startDate: '', offerAccepted: false, employee: '', ...v }, { status, createdDaysAgo: ago });
  app('Sizwe', 'Nhlapo', r2, 'offer', { interviewDate: day(-8), interviewScore: '4', interviewNotes: 'Eight years on Code 14; clean record; knows the East Rand routes.', offerSalary: 15800, startDate: nextWorkingDay(day(14)), offerAccepted: true }, 28);
  app('Kamogelo', 'Seleke', r2, 'interviewed', { interviewDate: day(-7), interviewScore: '3', interviewNotes: 'Good attitude; PrDP renewal due in two months.' }, 26);
  app('Jaco', 'Visser', r2, 'shortlisted', {}, 20);
  app('Thulisile', 'Mnguni', r2, 'applied', {}, 5);
  app('Ashwin', 'Ramlall', r2, 'declined', { interviewDate: day(-9), interviewScore: '2' }, 30);
  app('Zintle', 'Nkqayi', r3, 'shortlisted', {}, 12);
  app('Morné', 'Smit', r3, 'applied', {}, 4);
  app('Ziyanda', 'Booi', r3, 'interviewed', { interviewDate: day(-3), interviewScore: '4', interviewNotes: 'Strong FMCG background in Mthatha.' }, 15);
  app('Xolani', 'Biyela', r4, 'hired', { interviewDate: day(-30), interviewScore: '4', offerSalary: 15800, startDate: today, offerAccepted: true, employee: E('Xolani').id }, 45);
  app('Ruan', 'Meyer', r5, 'hired', { interviewDate: day(-35), interviewScore: '3', offerSalary: 9800, startDate: day(10), offerAccepted: true, employee: E('Ruan').id }, 50);

  /* ---------- Payroll inputs and packs ---------- */
  const periods = [period, periodOf(addMonths(`${period}-01`, -1))];
  const input = (p: string, who: DemoRecord, kind: string, v: Values) =>
    rec('inputs', 'IN', { period: p, employee: who.id, kind, weekOf: '', hours: '', amount: '', description: '', approvedBy: '', ...v }, { createdDaysAgo: 3, history: [] });
  // Andile and Ricardo only have the long weeks below, so each week's approval covers all of their lines.
  const OT_STAFF = ['Siyabonga', 'Gary', 'Sanele', 'Bongani', 'Unathi', 'Chantelle', 'Johannes', 'Mlungisi'];
  periods.forEach((p, pi) => {
    const weeks: string[] = [];
    for (let w = weekStart(pi === 0 ? today : monthEnd(p)); addDays(w, 6) >= monthStart(p); w = addDays(w, -7)) weeks.push(w);
    weeks.forEach((w, wi) => {
      OT_STAFF.forEach((f, fi) => {
        if ((fi + wi + pi) % 3 === 0) return;
        input(p, E(f), 'overtime', { weekOf: w, hours: 2 + ((fi * 3 + wi * 5 + pi) % 13) / 2, description: pick(['Late deliveries', 'Month-end stock count', 'Saturday loading', 'Extra route']) });
      });
    });
    // Over 10 hours in a week: approved in closed months; this month it is waiting for the manager.
    if (pi === 0) {
      input(p, E('Vusi'), 'overtime', { weekOf: weeks[0], hours: 7, description: 'Saturday loading for a supermarket promotion' });
      input(p, E('Vusi'), 'overtime', { weekOf: weeks[0], hours: 5.5, description: 'Late deliveries — N3 road closure' });
      input(p, E('Andile'), 'overtime', { weekOf: weeks[weeks.length - 1], hours: 11, description: 'Month-end stock run to Pretoria', approvedBy: 'Willem Swart' });
    } else {
      input(p, E('Ricardo'), 'overtime', { weekOf: weeks[1] ?? weeks[0], hours: 10.5, description: 'Holiday-weekend loading', approvedBy: 'Willem Swart' });
    }
    input(p, E('Siyabonga'), 'allowance', { amount: 850, description: 'Standby allowance' });
    input(p, E('Willem'), 'allowance', { amount: 450, description: 'Cellphone allowance' });
    input(p, E('Sanele'), 'allowance', { amount: 1200, description: 'Night-shift allowance' });
    if (pi !== 1) input(p, E('Precious'), 'deduction', { amount: 380, description: 'Staff purchase — beverages' });
    if (pi === 0) input(p, E('Lucky'), 'deduction', { amount: 250, description: 'Replacement hi-vis vest' });
  });
  const pack = (p: string, status: string, v: Values) => rec('payruns', 'PAY', { period: p, cutoff: addDays(monthEnd(p), -5), checkedBy: '', approvedBy: '', sentOn: '', snapshot: '', notes: '', ...v }, { status, createdDaysAgo: 10 });
  pack(periods[0], 'draft', { notes: 'Cut-off for overtime and leave is five days before month-end.' });
  for (const p of periods.slice(1)) {
    pack(p, 'sent', { checkedBy: 'Fatima Ebrahim', approvedBy: 'Sipho Mahlangu', sentOn: addDays(monthEnd(p), -2) > today ? today : addDays(monthEnd(p), -2), snapshot: packSnapshot(packRows(data(), p)) });
  }

  /* ---------- Users (each is also an employee, matched by name) ---------- */
  const users = [
    user('u_hrm', fullName(hrm), 'HR manager', 'hrmgr', [], [], true),
    user('u_hro', fullName(E('Kagiso')), 'HR officer', 'hrofficer',
      ['dashboard', 'employees', 'onboarding', 'leave', 'calendar', 'myleave', 'hiring', 'applicants', 'reviews', 'cases', 'training', 'certificates', 'reports'],
      ['employees.manage', 'hr.notes', 'leave.request', 'leave.approve', 'leave.hr', 'hiring', 'reviews', 'cases', 'training']),
    user('u_pay', fullName(E('Fatima')), 'Payroll administrator', 'payroll',
      ['dashboard', 'employees', 'leave', 'calendar', 'myleave', 'payroll', 'reports'],
      ['pay.view', 'leave.request', 'payroll.prepare']),
    user('u_mgr', fullName(depot.dbn), 'Depot manager · Durban', 'linemgr',
      ['dashboard', 'employees', 'leave', 'calendar', 'myleave', 'payroll', 'reviews', 'cases', 'training', 'certificates'],
      ['leave.request', 'leave.approve', 'overtime.approve', 'reviews']),
    user('u_md', fullName(md), 'Managing director', 'md',
      ['dashboard', 'employees', 'leave', 'calendar', 'myleave', 'payroll', 'hiring', 'applicants', 'reviews', 'cases', 'reports'],
      ['pay.view', 'leave.request', 'leave.approve', 'overtime.approve', 'payroll.approve', 'hiring', 'hiring.unbudgeted', 'reviews', 'reviews.moderate']),
    user('u_emp', fullName(lerato), 'Picker / packer · Durban depot', 'employee', ['dashboard', 'myleave'], ['leave.request']),
  ];
  return { users, collections, currentUserId: 'u_hrm' };
}
