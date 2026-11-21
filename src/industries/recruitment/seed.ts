// Fictional seed data for the recruitment agency demo. Every person, company,
// email address, phone number and amount is invented. Dates are relative to
// `today` so the demo always looks current. Deterministic: a seeded PRNG, never
// Math.random. The records the guided walkthrough links to are created first,
// so their ids never change with the day of the week.
import { seeder, user } from '../../core/seed';
import type { DemoRecord, Values } from '../../core/types';
import { addDays, daysBetween } from '../../core/lib/dates';
import { addMonths, guaranteeEndFor, mondayOf, workday } from './helpers';

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

// name, role, desk, monthly target, demo user
const CONSULTANTS: Array<[string, string, string, number, string]> = [
  ['Zanele Mahlangu', 'director', 'finance', 100000, 'u_dir'],
  ['Ayesha Patel', 'senior', 'it', 110000, 'u_senior'],
  ['Sipho Nkosi', 'consultant', 'it', 70000, 'u_cons'],
  ['Marelize Botha', 'consultant', 'engineering', 80000, ''],
  ['Thabo Sithole', 'consultant', 'sales', 65000, ''],
  ['Lindiwe Dube', 'resourcer', 'it', 0, 'u_res'],
];

// name, sector, contact, contact role, fee %, payment days, guarantee months, remedy, terms status, signed days ago, expires in days, owner index
const CLIENTS: Array<[string, string, string, string, number, number, number, string, string, number, number, number]> = [
  ['Umoya Crest Wind Energy', 'energy', 'Nandi Khumalo', 'Head of People', 20, 30, 3, 'replacement', 'sent', 0, 0, 1],
  ['Kalahari Byte Labs', 'software', 'Johan Pretorius', 'Chief Technology Officer', 18, 30, 3, 'replacement', 'signed', 210, 155, 1],
  ['Bluegum Ridge Financial', 'financial', 'Priya Naidoo', 'Finance Director', 17.5, 30, 3, 'refund', 'signed', 300, 65, 0],
  ['Protea Forge Engineering', 'manufacturing', 'Willem Steyn', 'Plant Manager', 20, 45, 3, 'replacement', 'signed', 150, 215, 3],
  ['Karoo Lantern Logistics', 'logistics', 'Busisiwe Zulu', 'HR Business Partner', 18, 30, 3, 'refund', 'signed', 347, 18, 4],
  ['Riverbend Orchard Foods', 'food', 'Gerhard le Roux', 'Financial Controller', 16, 30, 2, 'refund', 'signed', 120, 245, 0],
  ['Sable Lane Retail', 'retail', 'Fiona Mthembu', 'Regional Sales Director', 18, 30, 3, 'replacement', 'signed', 90, 275, 4],
  ['Ironwood Shaft Services', 'mining', 'Andile Mabuza', 'Engineering Manager', 22, 30, 6, 'replacement', 'signed', 200, 165, 3],
  ['Inkwazi Telecom Networks', 'telecoms', 'Rashid Essop', 'Talent Acquisition Lead', 18, 60, 3, 'refund', 'signed', 60, 305, 2],
  ['Marula Shield Insurance', 'insurance', 'Carol Jacobs', 'Head of Finance', 17, 30, 3, 'refund', 'expired', 385, -20, 0],
  ['Highveld Arc Fabrication', 'manufacturing', 'Dineo Molefe', 'Operations Director', 20, 30, 3, 'replacement', 'draft', 0, 0, 3],
  ['Baobab Cloud Systems', 'software', 'Kyle Fortuin', 'Engineering Manager', 19, 30, 3, 'refund', 'signed', 240, 125, 1],
];

const FIRST = ['Thandiwe', 'Johan', 'Ayanda', 'Nomvula', 'Pieter', 'Fatima', 'Megan', 'Mpho', 'Ruan', 'Zodwa', 'Craig', 'Palesa', 'Hendrik', 'Nokuthula', 'Brandon', 'Kagiso',
  'Shireen', 'Lwazi', 'Anika', 'Thulani', 'Precious', 'Dylan', 'Refilwe', 'Wikus', 'Zinhle', 'Imraan', 'Busi', 'Tiago', 'Lindokuhle', 'Chantelle', 'Mandla', 'Keabetswe',
  'Ravi', 'Ilse', 'Themba', 'Ashwin', 'Nthabiseng', 'Jaco', 'Ntombi', 'Ziyaad', 'Rendani', 'Kayla', 'Musa', 'Liezl', 'Sizwe', 'Aaliyah', 'Vusi', 'Tumelo', 'Charmaine', 'Xolani',
  'Dineo', 'Gareth', 'Sanele', 'Michelle', 'Katlego', 'Farzana'];
const LAST = ['Ndlovu', 'Govender', 'Pretorius', 'Dlamini', 'Venter', 'Sithebe', 'Coetzee', 'Mthethwa', 'Reddy', 'Molefe', 'du Plessis', 'Nxumalo', 'Adams', 'Maseko', 'Fourie',
  'Hendricks', 'Zwane', 'Smit', 'Chetty', 'Radebe', 'Nel', 'Ntuli', 'Abrahams', 'Baloyi', 'Kruger', 'Mohamed', 'Mkhize', 'Swart', 'Tshabalala', 'Maharaj', 'Shabangu',
  'Engelbrecht', 'Mathebula', 'Ngcobo', 'Ferreira', 'Moodley', 'Phiri', 'Sibiya', 'Joubert', 'Petersen', 'Nhlapo', 'Rossouw', 'Mashaba', 'Marais', 'Mokwena', 'Cele'];

const HEADLINES: Record<string, string[]> = {
  finance: ['Financial Accountant', 'Management Accountant', 'Senior Accountant', 'Credit Controller', 'Tax Consultant', 'Financial Manager', 'Payroll Administrator', 'Cost Accountant'],
  it: ['Full-stack Developer', 'DevOps Engineer', 'Data Engineer', 'QA Automation Engineer', 'Business Analyst', '.NET Developer', 'Data Analyst', 'IT Support Engineer'],
  engineering: ['Mechanical Engineer', 'Electrical Engineer', 'Project Engineer', 'Maintenance Planner', 'Process Engineer', 'Production Engineer'],
  sales: ['Key Account Manager', 'Sales Representative', 'Business Development Manager', 'Sales Engineer', 'Regional Sales Manager', 'Area Sales Manager'],
};
const SKILLS: Record<string, string[]> = {
  finance: ['IFRS reporting', 'month-end close', 'consolidations', 'SAP FI', 'Sage 300', 'VAT and provisional tax', 'budgeting', 'debtors management', 'payroll (VIP)', 'Excel modelling'],
  it: ['TypeScript', 'React', 'C# / .NET', 'Azure', 'AWS', 'Kubernetes', 'Python', 'SQL', 'Power BI', 'test automation (Playwright)', 'Terraform', 'agile delivery'],
  engineering: ['AutoCAD', 'SolidWorks', 'planned maintenance (SAP PM)', 'GCC', 'medium-voltage reticulation', 'root-cause analysis', 'project scheduling', 'lean manufacturing'],
  sales: ['key accounts', 'FMCG trade', 'B2B new business', 'CRM discipline', 'tender submissions', 'territory planning', 'negotiation', 'technical selling'],
};
const PACKAGE: Record<string, [number, number]> = { finance: [380000, 1050000], it: [450000, 1200000], engineering: [480000, 1100000], sales: [360000, 900000] };
const LOCS = ['jhb', 'cpt', 'dbn', 'pta', 'jhb', 'cpt', 'gqb', 'stb', 'remote'];
const NOTICES = ['1m', '1m', '1m', '2w', '3m', '2m', 'immediate', '1m'];
const SRCS = ['database', 'referral', 'jobboard', 'linkedin', 'website', 'headhunt'];
const INTERVIEWERS = ['Karabo Seleka', 'Anton Meyer', 'Gugu Dube', 'Sarah Chen', 'Lungile Nkabinde', 'Marius Viljoen', 'Hlengiwe Shange', 'Deshen Pillay'];

const POOL_SIZE = 88;
/** Fee invoices for these placements are still unpaid past their due date. */
const SLOW_PAYERS = ['Tax Consultant', 'Data Analyst'];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
const round5k = (n: number) => Math.round(n / 5000) * 5000;

export function buildRecruitmentSeed(today: string) {
  const { collections, rec, day } = seeder(today);
  const rnd = prng(20261121);
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const shuffle = <T,>(list: T[]) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  /** A weekday `n` working days from today (0 = today, or the next weekday at a weekend). */
  const wd = (n: number) => workday(today, n);
  const lastMonday = addDays(mondayOf(today), -7);

  const users = [
    user('u_dir', 'Zanele Mahlangu', 'Director', 'director', [], [], true),
    user('u_senior', 'Ayesha Patel', 'Senior consultant — IT & software', 'senior',
      ['dashboard', 'jobs', 'pipeline', 'candidates', 'interviews', 'clients', 'placements', 'contractors', 'invoices', 'reports'],
      ['clients.manage', 'terms.manage', 'jobs.manage', 'candidates.manage', 'longlist', 'submit', 'interviews', 'placements.manage', 'fees.view']),
    user('u_cons', 'Sipho Nkosi', 'Consultant — IT & software', 'consultant',
      ['dashboard', 'jobs', 'pipeline', 'candidates', 'interviews', 'clients', 'placements', 'reports'],
      ['jobs.manage', 'candidates.manage', 'longlist', 'submit', 'interviews', 'placements.manage', 'fees.view']),
    user('u_res', 'Lindiwe Dube', 'Resourcer', 'resourcer',
      ['dashboard', 'jobs', 'pipeline', 'candidates', 'interviews'],
      ['candidates.manage', 'longlist', 'interviews']),
    user('u_contracts', 'Riaan Jacobs', 'Contracts & timesheet administrator', 'contracts',
      ['dashboard', 'contractors', 'timesheets', 'candidates', 'clients', 'invoices'],
      ['assignments.manage', 'timesheets.manage', 'timesheets.invoice']),
    user('u_fin', 'Fatima Abrahams', 'Finance', 'finance',
      ['dashboard', 'invoices', 'placements', 'timesheets', 'contractors', 'clients', 'reports'],
      ['invoices.manage', 'timesheets.invoice', 'fees.view']),
  ];

  /* ---------- Consultants ---------- */
  const cons = CONSULTANTS.map(([name, role, discipline, monthlyTarget, userId]) =>
    rec('consultants', 'CON', { name, role, discipline, email: `${slug(name)}@example.com`, monthlyTarget, userId }, { createdDaysAgo: 400 }));
  const C = (i: number) => cons[i].id;

  /* ---------- Clients & terms of business ---------- */
  const clients = CLIENTS.map(([name, sector, contactName, contactRole, feePct, paymentDays, guaranteeMonths, remedy, status, signedAgo, expiresIn, owner], i) => rec('clients', 'CLI', {
    name, sector, contactName, contactRole, email: `${slug(contactName)}@example.com`, phone: `0${[11, 21, 31, 12, 41][i % 5]} 555 ${String(3100 + i * 211).slice(0, 4)}`,
    feePct, paymentDays, guaranteeMonths, remedy,
    termsSentOn: status === 'draft' ? '' : status === 'sent' ? day(-5) : day(-signedAgo - 6),
    termsSignedOn: ['signed', 'expired'].includes(status) ? day(-signedAgo) : '',
    termsExpiry: ['signed', 'expired'].includes(status) ? day(expiresIn) : '',
    owner: C(owner), notes: '',
  }, { status, createdDaysAgo: Math.max(30, signedAgo + 10) }));
  const K = (i: number) => clients[i - 1].id;

  /* ---------- Candidates ---------- */
  type Consent = 'current' | 'expired' | 'expiring' | 'noshare' | 'none';
  const consent = (kind: Consent, agoDays: number): Values => {
    if (kind === 'none') return { consentGiven: '', consentExpiry: '', consentShare: false };
    if (kind === 'expired') return { consentGiven: day(-400 - agoDays), consentExpiry: addMonths(day(-400 - agoDays), 12), consentShare: true };
    if (kind === 'expiring') { const given = addDays(addMonths(today, -12), 6 + (agoDays % 18)); return { consentGiven: given, consentExpiry: addMonths(given, 12), consentShare: true }; }
    const given = day(-agoDays);
    return { consentGiven: given, consentExpiry: addMonths(given, 12), consentShare: kind !== 'noshare' };
  };
  let phoneSeq = 0;
  const cand = (first: string, last: string, discipline: string, o: { headline?: string; exp?: number; cur?: number; notice?: string; loc?: string; consent?: Consent; status?: string; owner?: number; phone?: string; email?: string; ago?: number } = {}): DemoRecord => {
    const [lo, hi] = PACKAGE[discipline];
    const exp = o.exp ?? round5k(lo + rnd() * (hi - lo));
    const skills = shuffle(SKILLS[discipline]).slice(0, 4).join(', ');
    phoneSeq++;
    const ago = o.ago ?? 20 + Math.floor(rnd() * 260);
    return rec('candidates', 'CAN', {
      firstName: first, lastName: last, email: o.email ?? `${slug(first)}.${slug(last)}@example.com`,
      phone: o.phone ?? `0${[72, 82, 83, 61, 71, 79][phoneSeq % 6]} 555 ${String(1000 + ((phoneSeq * 389) % 9000)).padStart(4, '0')}`,
      discipline, headline: o.headline ?? pick(HEADLINES[discipline]), skills, currentPackage: o.cur ?? round5k(exp * 0.88), expectedPackage: exp,
      notice: o.notice ?? pick(NOTICES), location: o.loc ?? pick(LOCS), source: pick(SRCS), ...consent(o.consent ?? 'current', ago),
      owner: C(o.owner ?? ({ finance: 0, it: 2, engineering: 3, sales: 4 } as Record<string, number>)[discipline]), notes: '',
    }, { status: o.status ?? 'active', createdDaysAgo: ago });
  };

  // Walkthrough candidates first (fixed ids).
  const kevin = cand('Kevin', 'Naidoo', 'it', { headline: 'Full-stack Developer', exp: 760000, notice: '1m', loc: 'cpt', consent: 'expired' });
  const lerato = cand('Lerato', 'Mokoena', 'it', { headline: 'Senior .NET Developer', exp: 820000, notice: '1m', loc: 'jhb' });
  const bongani = cand('Bongani', 'Khumalo', 'it', { headline: 'Full-stack Developer', exp: 720000, notice: '1m', loc: 'remote' });
  const naledi = cand('Naledi', 'Pillay', 'it', { headline: 'Data Engineer', exp: 850000, cur: 760000, notice: '1m', loc: 'jhb' });
  const tshepo = cand('Tshepo', 'Mabena', 'sales', { headline: 'Key Account Manager', exp: 640000, notice: '1m', loc: 'jhb' });
  const riana = cand('Riana', 'van Wyk', 'finance', { headline: 'Management Accountant', exp: 690000, notice: '1m', loc: 'cpt', status: 'placed' });
  const yusuf = cand('Yusuf', 'Isaacs', 'it', { headline: 'DevOps Engineer (contract)', exp: 1000000, notice: 'immediate', loc: 'cpt' });

  // The pool. A few flags on purpose: consent states, a duplicate pair, people not looking.
  const pool: DemoRecord[] = [];
  const cycle = ['it', 'finance', 'engineering', 'sales', 'it', 'finance', 'engineering', 'sales', 'it', 'finance', 'engineering', 'sales', 'it'];
  for (let i = 0; i < POOL_SIZE; i++) {
    const discipline = cycle[i % cycle.length];
    const kind: Consent = i % 13 === 5 ? 'expired' : i % 11 === 3 ? 'expiring' : i % 17 === 8 ? 'noshare' : i % 19 === 14 ? 'none' : 'current';
    const status = kind === 'none' ? 'new' : i % 23 === 7 ? 'notlooking' : i % 29 === 20 ? 'screened' : 'active';
    pool.push(cand(FIRST[i % FIRST.length], LAST[(i * 7 + Math.floor(i / FIRST.length) * 3) % LAST.length], discipline, { consent: kind, status }));
  }
  // Duplicate: the same person captured twice with a shortened first name and the same mobile number.
  const dupOf = pool[0];
  cand('Thandi', str(dupOf, 'lastName'), str(dupOf, 'discipline'), { phone: str(dupOf, 'phone'), email: `thandi.${slug(str(dupOf, 'lastName'))}@example.com`, consent: 'none', status: 'new', ago: 2 });
  const poolBy = (discipline: string) => pool.filter((p) => str(p, 'discipline') === discipline && p.status === 'active');
  const used = new Set<string>();
  /** Next unused active pool candidate in a discipline (deterministic). */
  const next = (discipline: string) => {
    const c = poolBy(discipline).find((p) => !used.has(p.id) && !['expired', 'none'].includes(consentKind(p)));
    if (!c) throw new Error(`Seed ran out of ${discipline} candidates`);
    used.add(c.id);
    return c;
  };
  function consentKind(p: DemoRecord) { return !str(p, 'consentGiven') ? 'none' : str(p, 'consentExpiry') < today ? 'expired' : 'ok'; }
  /** Candidates whose CV has gone to each client, so the seed itself respects the ownership rule. */
  const sentTo = new Map<string, Set<string>>();
  const turn: Record<string, number> = {};
  /** A candidate who interviewed and was turned down: may also appear on other clients' jobs, never twice at one client. */
  const loser_ = (discipline: string, clientId: string) => {
    const list = poolBy(discipline).filter((p) => !['expired', 'none'].includes(consentKind(p)) && !sentTo.get(clientId)?.has(p.id));
    if (!list.length) throw new Error(`Seed ran out of ${discipline} candidates for ${clientId}`);
    turn[discipline] = ((turn[discipline] ?? 0) + 7) % list.length;
    return list[turn[discipline]];
  };

  /* ---------- Builders ---------- */
  const job = (title: string, client: number, discipline: string, pkg: number, owner: number, status: string, o: { opened?: number; filled?: number; type?: string; priority?: string; loc?: string; feePct?: number; notes?: string; replacementFor?: string } = {}) => {
    const cl = clients[client - 1];
    return rec('jobs', 'JOB', {
      title, client: cl.id, discipline, location: o.loc ?? pick(LOCS.slice(0, 6)), package: pkg, feePct: o.feePct ?? (status === 'draft' ? '' : (cl.values.feePct as number)),
      type: o.type ?? 'contingent', priority: o.priority ?? 'normal', owner: C(owner), openedOn: o.opened !== undefined ? day(-o.opened) : '', filledOn: o.filled !== undefined ? day(-o.filled) : '',
      replacementFor: o.replacementFor ?? '', notes: o.notes ?? '',
    }, { status, createdDaysAgo: (o.opened ?? 3) + 1 });
  };
  const sub = (candidate: DemoRecord, j: DemoRecord, status: string, o: { sent?: number; by?: number; offer?: number; start?: string; offerAgo?: number; acceptedAgo?: number; long?: number } = {}) => {
    if (o.sent !== undefined) { const set = sentTo.get(String(j.values.client)) ?? new Set<string>(); set.add(candidate.id); sentTo.set(String(j.values.client), set); }
    return rec('submissions', 'SUB', {
    candidate: candidate.id, job: j.id, longlistedBy: C(o.long ?? 5), submittedBy: o.sent !== undefined ? C(o.by ?? 2) : '', submittedOn: o.sent !== undefined ? day(-o.sent) : '',
    offerPackage: o.offer ?? '', offerStart: o.start ?? '', offerMadeOn: o.offerAgo !== undefined ? day(-o.offerAgo) : '', acceptedOn: o.acceptedAgo !== undefined ? day(-o.acceptedAgo) : '', notes: '',
  }, { status, createdDaysAgo: (o.sent ?? 2) + 2 });
  };
  const iv = (s: DemoRecord, date: string, time: string, status: string, round: string, o: { format?: string; rating?: string; outcome?: string; feedback?: string; duration?: number } = {}) => rec('interviews', 'INT', {
    submission: s.id, date, time, duration: o.duration ?? 60, format: o.format ?? pick(['inperson', 'video', 'video', 'assessment']), round, interviewer: pick(INTERVIEWERS),
    location: o.format === 'inperson' ? 'Client offices (fictional address)' : 'Video link (fictional)', rating: o.rating ?? '', outcome: o.outcome ?? '', feedback: o.feedback ?? '', reminderLogged: '',
  }, { status, createdDaysAgo: 5 });
  const placement = (s: DemoRecord, j: DemoRecord, status: string, acceptedAgo: number, startAgo: number, o: { fellOff?: number; notes?: string } = {}) => {
    const cl = clients.find((c) => c.id === j.values.client)!;
    const months = Number(cl.values.guaranteeMonths) || 3;
    const start = day(-startAgo);
    const feePct = Number(j.values.feePct) || 0;
    const pkg = Number(s.values.offerPackage);
    return rec('placements', 'PLC', {
      submission: s.id, candidate: s.values.candidate, job: j.id, client: cl.id, consultant: s.values.submittedBy, acceptedOn: day(-acceptedAgo), startDate: start, package: pkg,
      feePct, fee: Math.round(pkg * feePct) / 100, guaranteeMonths: months, guaranteeEnd: guaranteeEndFor(start, months), remedy: cl.values.remedy,
      fellOffOn: o.fellOff !== undefined ? day(-o.fellOff) : '', invoice: '', creditNote: '', replacementJob: '', notes: o.notes ?? '',
    }, { status, createdDaysAgo: acceptedAgo });
  };
  const feeInvoice = (p: DemoRecord) => {
    const cl = clients.find((c) => c.id === p.values.client)!;
    const date = String(p.values.startDate);
    const due = addDays(date, Number(cl.values.paymentDays) || 30);
    // Paid by the due date — except two slow payers, which are overdue.
    const status = due >= today || SLOW_PAYERS.includes(String(collections.jobs.find((x) => x.id === p.values.job)?.values.title)) ? 'issued' : 'paid';
    const j = collections.jobs.find((x) => x.id === p.values.job)!;
    const inv = rec('invoices', 'INV', {
      kind: 'fee', client: cl.id, placement: p.id, timesheet: '', creditFor: '', consultant: p.values.consultant, date, dueDate: due, paidOn: status === 'paid' ? addDays(due, -3) : '',
      lines: [{ id: `ln_fee_${p.id}`, description: `Permanent placement fee — ${str(collections.candidates.find((c) => c.id === p.values.candidate), 'firstName')} ${str(collections.candidates.find((c) => c.id === p.values.candidate), 'lastName')} as ${String(j.values.title)} (${p.values.feePct}% of R${Number(p.values.package).toLocaleString('en-US')} annual package)`, qty: 1, unitPrice: Number(p.values.fee) }],
      notes: '',
    }, { status, createdDaysAgo: Math.max(0, daysBetween(date, today)) });
    p.values.invoice = inv.id;
    return inv;
  };

  /* ---------- Walkthrough records (fixed ids) ---------- */
  // jobs_1: drafted for a client whose terms are sent but not signed.
  job('Senior Electrical Engineer — Wind Farms', 1, 'engineering', 840000, 1, 'draft', { type: 'exclusive', priority: 'high', loc: 'gqb', notes: 'Brief taken by phone; the client wants a shortlist within two weeks of the job opening.' });
  // jobs_2: a shortlist in progress — three longlisted CVs, each showing a different send rule.
  const j2 = job('Senior Full-stack Developer', 2, 'it', 780000, 2, 'shortlist', { opened: 16, type: 'exclusive', loc: 'cpt' });
  // jobs_3: final interviews done — ready for an offer.
  const j3 = job('Data Engineer', 9, 'it', 860000, 2, 'interviewing', { opened: 34, loc: 'jhb' });
  // jobs_4 and jobs_5: the same sales candidate is in play for both (interview clash check).
  const j4 = job('Key Account Manager — FMCG', 7, 'sales', 650000, 4, 'shortlist', { opened: 12, loc: 'jhb' });
  const j5 = job('Regional Sales Manager', 5, 'sales', 720000, 4, 'interviewing', { opened: 26, loc: 'jhb' });
  // jobs_6: filled — its placement started 40 days ago and is inside the guarantee.
  const j6 = job('Senior Management Accountant', 3, 'finance', 690000, 0, 'filled', { opened: 95, filled: 55, loc: 'cpt' });

  sub(kevin, j2, 'longlist', { long: 5 });
  sub(lerato, j2, 'longlist', { long: 5 });
  sub(bongani, j2, 'longlist', { long: 5 });
  const s4 = sub(naledi, j3, 'final', { sent: 24, by: 2 });
  sub(tshepo, j4, 'reviewing', { sent: 5, by: 4 });
  const s6 = sub(tshepo, j5, 'interview', { sent: 11, by: 4 });
  const s7 = sub(riana, j6, 'accepted', { sent: 80, by: 0, offer: 690000, start: day(-40), offerAgo: 58, acceptedAgo: 55 });

  iv(s6, wd(2), '10:00', 'scheduled', 'first', { format: 'inperson' });
  iv(s4, day(-14), '09:30', 'completed', 'first', { format: 'video', rating: '4', outcome: 'progress', feedback: 'Strong on pipelines and SQL; wants to see more cloud cost awareness. Invite to the final panel.' });
  iv(s4, day(-3), '14:00', 'completed', 'final', { format: 'inperson', rating: '5', outcome: 'progress', feedback: 'Panel unanimous. Client would like to make an offer close to her expected package with a start in about a month.' });

  const p1 = placement(s7, j6, 'started', 55, 40);
  feeInvoice(p1);

  const a1 = rec('assignments', 'ASG', {
    candidate: yusuf.id, client: K(12), role: 'Contract DevOps Engineer', consultant: C(1), payRate: 520, chargeRate: 680, hoursPerWeek: 40, startDate: day(-75), endDate: day(90), notes: 'Platform migration to managed Kubernetes.',
  }, { status: 'active', createdDaysAgo: 80 });
  rec('timesheets', 'TS', { assignment: a1.id, weekStart: lastMonday, h0: 10, h1: 10, h2: 10, h3: 9, h4: 9, h5: 0, h6: 0, invoice: '', notes: 'Cut-over weekend prep — overtime agreed verbally with the client.' }, { status: 'submitted', createdDaysAgo: 2 });

  /* ---------- More of the walkthrough jobs' pipelines ---------- */
  sub(next('it'), j2, 'reviewing', { sent: 9, by: 2 });
  sub(next('it'), j2, 'submitted', { sent: 3, by: 1 });
  sub(loser_('it', K(2)), j2, 'rejected', { sent: 12, by: 2 });
  const s3b = sub(next('it'), j3, 'interview', { sent: 24, by: 1 });
  iv(s3b, day(-9), '11:00', 'completed', 'first', { format: 'video', rating: '3', outcome: 'hold', feedback: 'Good communicator, lighter on streaming data than the role needs. Hold as a back-up.' });
  sub(loser_('it', K(9)), j3, 'rejected', { sent: 26, by: 2 });
  sub(next('sales'), j4, 'submitted', { sent: 4, by: 4 });
  sub(next('sales'), j4, 'longlist', { long: 5 });
  const s5b = sub(next('sales'), j5, 'final', { sent: 18, by: 4 });
  iv(s5b, day(-8), '13:00', 'completed', 'first', { format: 'inperson', rating: '4', outcome: 'progress', feedback: 'Solid territory numbers and a calm manner with difficult accounts.' });
  iv(s5b, wd(1), '15:00', 'scheduled', 'final', { format: 'inperson' });
  sub(loser_('sales', K(5)), j5, 'rejected', { sent: 20, by: 4 });

  /* ---------- History: filled jobs and placements over six months ---------- */
  // title, client, discipline, package, owner, opened days ago, accepted days ago, start days ago (negative = in the future)
  const HIST: Array<[string, number, string, number, number, number, number, number]> = [
    ['DevOps Engineer', 2, 'it', 880000, 1, 120, 95, 64],
    ['Financial Accountant', 6, 'finance', 520000, 0, 225, 200, 172],
    ['Mechanical Engineer', 4, 'engineering', 640000, 3, 215, 190, 160],
    ['Key Account Manager', 7, 'sales', 560000, 4, 200, 178, 150],
    ['.NET Developer', 12, 'it', 780000, 2, 190, 165, 135],
    ['Credit Controller', 5, 'finance', 410000, 0, 170, 150, 128],
    ['Electrical Engineer', 8, 'engineering', 820000, 3, 160, 140, 108],
    ['Business Analyst', 9, 'it', 700000, 1, 150, 125, 96],
    ['Sales Engineer', 4, 'sales', 600000, 4, 140, 118, 88],
    ['Tax Consultant', 3, 'finance', 750000, 0, 130, 108, 78],
    ['Data Analyst', 12, 'it', 620000, 2, 110, 86, 57],
    ['Project Engineer', 8, 'engineering', 900000, 3, 100, 70, 26],
    ['Area Sales Manager', 5, 'sales', 680000, 4, 75, 52, 22],
    ['QA Automation Engineer', 2, 'it', 690000, 1, 70, 45, 12],
    ['Cost Accountant', 6, 'finance', 560000, 0, 60, 30, 5],
    ['Full-stack Developer', 9, 'it', 820000, 2, 50, 26, 0],
    ['Financial Accountant', 6, 'finance', 540000, 0, 45, 6, -12],
    ['Production Engineer', 4, 'engineering', 610000, 3, 140, 115, 75],
  ];
  HIST.forEach(([title, client, discipline, pkg, owner, opened, accepted, start], i) => {
    const j = job(title, client, discipline, pkg, owner, 'filled', { opened, filled: accepted });
    const winner = next(discipline);
    const by = owner === 0 && i % 2 ? 0 : owner;
    const sent = opened - 8;
    const sAcc = sub(winner, j, 'accepted', { sent, by, offer: round5k(pkg * 1.02), start: day(-start), offerAgo: accepted + 3, acceptedAgo: accepted });
    iv(sAcc, day(-(sent - 7)), '10:00', 'completed', 'first', { rating: '4', outcome: 'progress', feedback: 'Strong technical interview; progress to final.' });
    iv(sAcc, day(-(accepted + 6)), '14:00', 'completed', 'final', { rating: '5', outcome: 'progress', feedback: 'Panel recommends an offer.' });
    const loser = loser_(discipline, K(client));
    const sRej = sub(loser, j, 'rejected', { sent: sent - 1, by });
    if (i % 2 === 0) iv(sRej, day(-(sent - 8)), '11:30', 'completed', 'first', { rating: '2', outcome: 'reject', feedback: 'Not enough depth for the seniority of the role.' });
    // The first one is where the walkthrough's ownership rule comes from: Lerato was sent to this client by Ayesha.
    if (i === 0) sub(lerato, j, 'rejected', { sent: 55, by: 1 });
    const fellOff = title === 'Production Engineer';
    const status = fellOff ? 'felloff' : start < 0 ? 'accepted' : guaranteeEndFor(day(-start), Number(clients[client - 1].values.guaranteeMonths)) < today ? 'guaranteed' : 'started';
    const p = placement(sAcc, j, status, accepted, start, fellOff ? { fellOff: 40, notes: 'Left for a role closer to home in month two.' } : {});
    if (start >= 0) feeInvoice(p);
    if (status !== 'felloff') winner.status = 'placed';
    if (fellOff) {
      // Protea Forge's terms give a free replacement: the replacement job is open and being sourced.
      const r = job('Production Engineer (free replacement)', client, discipline, pkg, owner, 'sourcing', { opened: 40, feePct: 0, priority: 'high', type: 'exclusive', replacementFor: p.id, notes: 'Free replacement under the client’s terms — no fee on this placement.' });
      p.values.replacementJob = r.id;
      sub(next(discipline), r, 'submitted', { sent: 6, by: owner });
      sub(next(discipline), r, 'longlist');
    }
  });

  // A refund fall-off: Karoo Lantern's terms give a pro-rata credit note.
  {
    const j = job('Logistics Accountant', 5, 'finance', 580000, 0, 'filled', { opened: 150, filled: 120 });
    const w = next('finance');
    const s = sub(w, j, 'accepted', { sent: 140, by: 0, offer: 580000, start: day(-95), offerAgo: 124, acceptedAgo: 120 });
    const p = placement(s, j, 'felloff', 120, 95, { fellOff: 50, notes: 'Resigned in month two after a restructure at the client.' });
    const inv = feeInvoice(p);
    const total = Math.round(Number(p.values.fee) * 100);
    const days = 92;
    const usedDays = 45;
    const refund = Math.round((total * (days - usedDays)) / days) / 100;
    const cn = rec('invoices', 'INV', {
      kind: 'credit', client: K(5), placement: p.id, timesheet: '', creditFor: inv.id, consultant: C(0), date: day(-49), dueDate: day(-49), paidOn: day(-30),
      lines: [{ id: `ln_cn_${p.id}`, description: `Pro-rata refund — candidate left on day ${usedDays} of a ${days}-day guarantee`, qty: 1, unitPrice: refund }], notes: '',
    }, { status: 'paid', createdDaysAgo: 49 });
    p.values.creditNote = cn.id;
  }

  /* ---------- Other live job orders ---------- */
  job('Payroll Administrator', 6, 'finance', 420000, 0, 'open', { opened: 21, notes: 'VIP payroll experience essential.' });
  const jQa = job('QA Automation Engineer', 2, 'it', 650000, 2, 'sourcing', { opened: 6 });
  sub(next('it'), jQa, 'longlist');
  sub(next('it'), jQa, 'longlist');
  const jMech = job('Mechanical Engineer — Plant', 4, 'engineering', 690000, 3, 'interviewing', { opened: 30, priority: 'high' });
  const sm1 = sub(next('engineering'), jMech, 'interview', { sent: 14, by: 3 });
  iv(sm1, wd(0), '11:00', 'scheduled', 'first', { format: 'inperson' });
  const sm2 = sub(next('engineering'), jMech, 'interview', { sent: 13, by: 3 });
  iv(sm2, wd(1), '09:00', 'scheduled', 'first', { format: 'video' });
  sub(next('engineering'), jMech, 'reviewing', { sent: 6, by: 3 });
  const jCc = job('Credit Controller', 5, 'finance', 450000, 0, 'offer', { opened: 28 });
  const sc = sub(next('finance'), jCc, 'offer', { sent: 22, by: 0, offer: 440000, start: day(30), offerAgo: 2 });
  iv(sc, day(-12), '10:00', 'completed', 'first', { rating: '4', outcome: 'progress', feedback: 'Firm but friendly on collections calls; good with Sage.' });
  iv(sc, day(-6), '10:00', 'completed', 'final', { rating: '4', outcome: 'progress', feedback: 'Offer to follow.' });
  const jTax = job('Tax Consultant', 3, 'finance', 780000, 0, 'shortlist', { opened: 19, type: 'exclusive' });
  sub(next('finance'), jTax, 'reviewing', { sent: 10, by: 0 });
  sub(next('finance'), jTax, 'submitted', { sent: 8, by: 0 });
  job('Business Development Manager', 9, 'sales', 820000, 4, 'onhold', { opened: 44, notes: 'Client froze the headcount until their new financial year.' });
  const jMp = job('Maintenance Planner', 8, 'engineering', 610000, 3, 'sourcing', { opened: 9 });
  sub(next('engineering'), jMp, 'submitted', { sent: 2, by: 3 });
  const jEe = job('Electrical Engineer — Shafts', 8, 'engineering', 980000, 3, 'offer', { opened: 40, type: 'exclusive', priority: 'high' });
  const se = sub(next('engineering'), jEe, 'offer', { sent: 30, by: 3, offer: 960000, start: day(45), offerAgo: 4 });
  iv(se, day(-15), '09:00', 'completed', 'first', { rating: '5', outcome: 'progress', feedback: 'Excellent MV experience.' });
  iv(se, day(-7), '09:00', 'completed', 'final', { rating: '4', outcome: 'progress', feedback: 'Go ahead with an offer.' });
  job('Sales Representative', 7, 'sales', 380000, 4, 'lost', { opened: 60, notes: 'Filled internally by the client.' });
  const jDa = job('Data Analyst', 12, 'it', 600000, 1, 'interviewing', { opened: 22 });
  const sd = sub(next('it'), jDa, 'interview', { sent: 12, by: 1 });
  iv(sd, wd(3), '14:00', 'scheduled', 'first', { format: 'assessment', duration: 90 });
  sub(next('it'), jDa, 'reviewing', { sent: 7, by: 1 });
  const jBa = job('Business Analyst', 10, 'it', 720000, 2, 'sourcing', { opened: 33, notes: 'Client terms have lapsed — renew before sending more CVs.' });
  sub(next('it'), jBa, 'submitted', { sent: 25, by: 2 });

  /* ---------- Contractor desk ---------- */
  // candidate, client, role, consultant, pay, charge, hours/week, start (days ago), end (days from today), status
  const ASSIGN: Array<[string, number, string, number, number, number, number, number, number, string]> = [
    ['finance', 5, 'Data Capturer (contract)', 0, 95, 140, 40, 80, 40, 'active'],
    ['finance', 6, 'Payroll Clerk (contract)', 0, 115, 165, 40, 97, 60, 'active'],
    ['finance', 3, 'Contract Accountant — year-end', 0, 450, 600, 40, 40, 50, 'active'],
    ['engineering', 4, 'Electrical Technician (contract)', 3, 210, 290, 40, 30, 60, 'active'],
    ['it', 9, 'Contract Java Developer', 1, 600, 780, 40, -10, 120, 'pending'],
    ['sales', 7, 'Merchandiser (contract)', 4, 85, 125, 40, 150, -20, 'ended'],
    ['it', 2, 'Help-desk Technician (contract)', 2, 130, 185, 40, 60, 5, 'active'],
  ];
  const assignments: DemoRecord[] = [a1];
  for (const [discipline, client, role, consultant, payRate, chargeRate, hoursPerWeek, startAgo, endIn, status] of ASSIGN) {
    assignments.push(rec('assignments', 'ASG', {
      candidate: next(discipline).id, client: K(client), role, consultant: C(consultant), payRate, chargeRate, hoursPerWeek, startDate: day(-startAgo), endDate: day(endIn), notes: '',
    }, { status, createdDaysAgo: Math.max(5, startAgo + 7) }));
  }
  // Weekly timesheets: the last five weeks for each running assignment (older ones invoiced, then approved, submitted and this week's draft).
  const thisMonday = mondayOf(today);
  for (const a of assignments) {
    if (!['active', 'ended'].includes(a.status ?? '')) continue;
    const start = String(a.values.startDate);
    const end = String(a.values.endDate);
    const clientRec = clients.find((c) => c.id === a.values.client)!;
    for (let w = 5; w >= 0; w--) {
      const week = addDays(thisMonday, -7 * w);
      if (a.id === a1.id && week === lastMonday) continue; // the walkthrough's timesheet
      if (addDays(week, 6) < start || week > end) continue;
      const hrs = [0, 1, 2, 3, 4, 5, 6].map((d): number => {
        const date = addDays(week, d);
        if (d > 4 || date < start || date > end || (w === 0 && date >= today)) return 0;
        return a.values.role === 'Data Capturer (contract)' && d === 4 ? 9 : 8;
      });
      if (!hrs.some((h) => h > 0) && w !== 0) continue;
      const status = a.status === 'ended' ? 'invoiced' : w === 0 ? 'draft' : w === 1 ? 'submitted' : w === 2 ? 'approved' : 'invoiced';
      const ts = rec('timesheets', 'TS', { assignment: a.id, weekStart: week, h0: hrs[0], h1: hrs[1], h2: hrs[2], h3: hrs[3], h4: hrs[4], h5: hrs[5], h6: hrs[6], invoice: '', notes: '' }, { status, createdDaysAgo: 7 * w });
      if (status === 'invoiced') {
        const date = addDays(week, 9);
        const due = addDays(date, Number(clientRec.values.paymentDays) || 30);
        const hours = hrs.reduce((n, h) => n + h, 0);
        const inv = rec('invoices', 'INV', {
          kind: 'contract', client: clientRec.id, placement: '', timesheet: ts.id, creditFor: '', consultant: a.values.consultant, date, dueDate: due, paidOn: due < today ? addDays(due, -2) : '',
          lines: [{ id: `ln_ts_${ts.id}`, description: `${String(a.values.role)}, week of ${week}`, qty: hours, unitPrice: Number(a.values.chargeRate) }], notes: '',
        }, { status: due < today ? 'paid' : 'issued', createdDaysAgo: Math.max(0, 7 * w - 9) });
        ts.values.invoice = inv.id;
      }
    }
  }

  return { users, collections, currentUserId: 'u_dir' };
}

function str(r: DemoRecord | undefined, k: string) { const v = r?.values[k]; return v === undefined || v === null ? '' : String(v); }
