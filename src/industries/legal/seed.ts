// Fictional seed data for Mahlaba & Rossouw Attorneys. Every person, company,
// case number and amount is invented. Dates are relative to `today` so the demo
// always looks current. Deterministic: a seeded PRNG, never Math.random.
import { seeder, user } from '../../core/seed';
import type { DemoRecord, Line } from '../../core/types';
import { lines, linesTotals } from '../../core/engine';
import { daysBetween, formatDate, parseIso } from '../../core/lib/dates';
import { FEE_EARNERS } from './data';
import { VAT_RATE } from './helpers';

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

// name, kind, contact person, FICA status, FICA expiry offset (days from today)
const CLIENTS: Array<[string, 'individual' | 'company', string, string, number | null]> = [
  ['Karoo Ridge Logistics (Pty) Ltd', 'company', 'Werner Smit', 'verified', 300],
  ['Thandiwe Ndlovu', 'individual', '', 'verified', 500],
  ['Bluegum Software (Pty) Ltd', 'company', 'Ayesha Khan', 'verified', 20],
  ['Marius van der Berg', 'individual', '', 'verified', 400],
  ['Umhlanga Bay Developments (Pty) Ltd', 'company', 'Dev Pillay', 'verified', 250],
  ['Fatima Patel', 'individual', '', 'verified', -15],
  ['Highveld Fresh Produce CC', 'company', 'Koos Botha', 'verified', 600],
  ['Sipho Khumalo', 'individual', '', 'pending', null],
  ['Kestrel Engineering (Pty) Ltd', 'company', 'Lerato Molefe', 'verified', 180],
  ['Anna Pretorius', 'individual', '', 'verified', 700],
  ['Lungile Zulu', 'individual', '', 'verified', 330],
  ['Sable Retail Group (Pty) Ltd', 'company', 'Grant Naidoo', 'verified', 90],
  ['Rashid Moosa', 'individual', '', 'verified', 410],
  ['Charlene October', 'individual', '', 'outstanding', null],
  ['Venter Family Trust', 'company', 'Johan Venter (trustee)', 'verified', 220],
  ['Nokuthula Dube', 'individual', '', 'pending', null],
];

type MatterSeed = {
  name: string; client: number; type: string; opp: string; others: string; fe: string; basis: string; estimate: number;
  status: string; opened: number; caseNo?: string; court?: string; priv: string; end?: number;
};

const MATTERS: MatterSeed[] = [
  { name: 'Karoo Ridge Logistics v Tshwane Haulage Co', client: 0, type: 'litigation', opp: 'Tshwane Haulage Co (Pty) Ltd', others: 'Mutual Indemnity Insurers Ltd', fe: 'nm', basis: 'hourly', estimate: 380000, status: 'active', opened: 150, caseNo: 'DEMO-4417/2026', court: 'High Court, Gauteng (fictional roll)', priv: 'Client concedes late delivery on two loads. Strategy: dispute quantum, not liability. Do not disclose the internal incident report.' },
  { name: 'Ndlovu — divorce and maintenance', client: 1, type: 'family', opp: 'Bheki Ndlovu', others: '', fe: 'id', basis: 'hourly', estimate: 180000, status: 'active', opened: 120, caseNo: 'DEMO-2231/2026', court: 'Regional Court (demo)', priv: 'Client wants to keep the Durban flat; open to a lower maintenance figure in exchange.' },
  { name: 'Bluegum Software — SaaS reseller agreement', client: 2, type: 'commercial', opp: 'Kalahari Cloud Distributors (Pty) Ltd', others: '', fe: 'nm', basis: 'fixed', estimate: 60000, status: 'active', opened: 70, priv: 'IP warranty position is weak on the legacy module. Negotiate a liability cap rather than an indemnity carve-out.' },
  { name: 'Transfer: Erf 1182 Linden — van der Berg to Moosa', client: 3, type: 'conveyancing', opp: '', others: 'Rashid Moosa; Lindela Home Loans Ltd', fe: 'id', basis: 'fixed', estimate: 65000, status: 'active', opened: 60, court: 'Deeds Office (simulated)', priv: 'Bond approval is conditional on valuation. Seller is aware and has agreed to a 30-day extension.' },
  { name: 'Umhlanga Bay Developments — phase 2 sectional title sales', client: 4, type: 'conveyancing', opp: '', others: 'Coastal Heights Body Corporate', fe: 'nm', basis: 'hourly', estimate: 220000, status: 'active', opened: 140, court: 'Deeds Office (simulated)', priv: 'Developer is under cash-flow pressure; prioritise units with cash buyers.' },
  { name: 'Patel v Greenway Pharmacies — unfair dismissal', client: 5, type: 'labour', opp: 'Greenway Pharmacies (Pty) Ltd', others: 'Lindiwe Mokoena (witness)', fe: 'id', basis: 'contingency', estimate: 120000, status: 'active', opened: 100, caseNo: 'DEMO-0912/2026', court: 'Arbitration (simulated referral)', priv: 'Client admits one prior written warning that was not disclosed in the referral.' },
  { name: 'Highveld Fresh Produce v Orange River Packers', client: 6, type: 'litigation', opp: 'Orange River Packers CC', others: '', fe: 'nm', basis: 'hourly', estimate: 250000, status: 'active', opened: 90, caseNo: 'DEMO-3380/2026', court: 'High Court, Gauteng (fictional roll)', priv: 'Expert report on cold-chain failure is favourable but the expert is unavailable in March.' },
  { name: 'Khumalo v Metro Commuter Bus Services — personal injury', client: 7, type: 'litigation', opp: 'Metro Commuter Bus Services (Pty) Ltd', others: '', fe: 'id', basis: 'contingency', estimate: 150000, status: 'engagement', opened: 12, priv: 'Accident date close to three years ago. Summons must be served before the prescription date.' },
  { name: 'Kestrel Engineering — shareholder agreement', client: 8, type: 'commercial', opp: '', others: 'Falcon Ridge Capital (Pty) Ltd', fe: 'nm', basis: 'fixed', estimate: 85000, status: 'active', opened: 50, priv: 'Founders disagree on the drag-along threshold; client\'s fallback is 75%.' },
  { name: 'Estate Late Hendrik Pretorius', client: 9, type: 'estates', opp: '', others: 'Pieter Pretorius; Elna Pretorius', fe: 'zm', basis: 'hourly', estimate: 120000, status: 'active', opened: 110, caseNo: 'DEMO-EST-0331/2026', court: 'Master of the High Court (simulated)', priv: 'Possible dispute between heirs about the farm valuation.' },
  { name: 'Zulu v Zulu — maintenance variation', client: 10, type: 'family', opp: 'Sizwe Zulu', others: '', fe: 'id', basis: 'hourly', estimate: 40000, status: 'engagement', opened: 9, priv: 'Ex-spouse has changed employer; income evidence needed.' },
  { name: 'Sable Retail Group — lease renewal, Menlyn store', client: 11, type: 'commercial', opp: 'Menlyn Square Property Fund', others: '', fe: 'nm', basis: 'hourly', estimate: 55000, status: 'active', opened: 80, priv: 'Client will walk away above an 8% escalation.' },
  { name: 'Moosa — will and estate plan', client: 12, type: 'estates', opp: '', others: '', fe: 'zm', basis: 'fixed', estimate: 8500, status: 'closing', opened: 75, end: -36, priv: 'Testator wishes to exclude one adult child; reasons recorded in a separate memo.' },
  { name: 'October v Brightside Motors — consumer claim', client: 13, type: 'litigation', opp: 'Brightside Motors (Pty) Ltd', others: '', fe: 'id', basis: 'hourly', estimate: 30000, status: 'intake', opened: 3, priv: 'Vehicle defects reported within six months of purchase.' },
  { name: 'Venter Family Trust — amendment of trust deed', client: 14, type: 'estates', opp: '', others: 'Johan Venter; Marlene Venter', fe: 'nm', basis: 'fixed', estimate: 25000, status: 'closing', opened: 85, end: -36, priv: 'Trustees disagree about adding grandchildren as beneficiaries.' },
  { name: 'Dube — antenuptial contract', client: 15, type: 'family', opp: '', others: 'Kabelo Sithebe (intended spouse)', fe: 'zm', basis: 'fixed', estimate: 6500, status: 'intake', opened: 2, priv: 'Accrual system preferred; client owns a small business.' },
  { name: 'Karoo Ridge Logistics — debt recovery from Ubuntu Freight', client: 0, type: 'litigation', opp: 'Ubuntu Freight Services CC', others: '', fe: 'id', basis: 'hourly', estimate: 45000, status: 'closing', opened: 95, caseNo: 'DEMO-1876/2026', court: 'Magistrate\'s Court (demo)', priv: 'Debtor paid in full after default judgment.' },
  { name: 'Bluegum Software v Sable Retail Group — licence fees', client: 2, type: 'litigation', opp: 'Sable Retail Group (Pty) Ltd', others: '', fe: 'nm', basis: 'hourly', estimate: 120000, status: 'conflict', opened: 4, priv: 'Claim for unpaid licence fees of roughly R480,000.' },
  { name: 'Kestrel Engineering — employment contracts review', client: 8, type: 'labour', opp: '', others: '', fe: 'id', basis: 'fixed', estimate: 18000, status: 'conflict', opened: 5, priv: 'Restraint clauses likely unenforceable as drafted.' },
  { name: 'Ndlovu — purchase of Unit 14, Coastal Heights', client: 1, type: 'conveyancing', opp: '', others: 'Umhlanga Bay Developments (Pty) Ltd', fe: 'id', basis: 'fixed', estimate: 28000, status: 'conflict', opened: 1, priv: 'Client is buying from a developer the firm also acts for.' },
  { name: 'Highveld Fresh Produce — trade mark registration', client: 6, type: 'commercial', opp: '', others: '', fe: 'nm', basis: 'fixed', estimate: 15000, status: 'closed', opened: 160, end: -45, priv: 'No opposition expected.' },
  { name: 'Estate Late Grace Zulu', client: 10, type: 'estates', opp: '', others: 'Lungile Zulu; Bongani Zulu', fe: 'zm', basis: 'hourly', estimate: 30000, status: 'closed', opened: 170, end: -45, caseNo: 'DEMO-EST-0117/2026', court: 'Master of the High Court (simulated)', priv: 'Small estate; no disputes.' },
  { name: 'Dube v Kestrel Engineering — wrongful dismissal', client: 15, type: 'labour', opp: 'Kestrel Engineering (Pty) Ltd', others: '', fe: 'id', basis: 'contingency', estimate: 35000, status: 'declined', opened: 30, priv: 'Prospective client referred to another firm.' },
];

const NARRATIVES: Record<string, string[]> = {
  litigation: ['Perusal of opponent\'s plea and annexures', 'Drafting discovery affidavit', 'Telephone consultation with client', 'Preparing brief to counsel', 'Pre-trial preparation and bundle', 'Correspondence with opposing attorneys', 'Research on quantum of damages'],
  conveyancing: ['Drafting transfer documents', 'Correspondence with bond attorneys', 'Following up rates clearance (simulated)', 'Preparing deeds for lodgement', 'Consultation with purchaser', 'Checking title deed conditions'],
  family: ['Consultation with client', 'Drafting settlement proposal', 'Correspondence with opposing attorney', 'Preparing financial disclosure schedule', 'Attending mediation session'],
  commercial: ['Drafting agreement', 'Reviewing counterparty mark-up', 'Negotiation call', 'Due diligence review', 'Drafting board resolution'],
  labour: ['Consultation with client', 'Preparing statement of case', 'Reviewing disciplinary record', 'Indexing and paginating bundle', 'Correspondence with employer\'s representative'],
  estates: ['Reporting estate to the Master (simulated)', 'Drafting notice to creditors', 'Correspondence with heirs', 'Drafting liquidation and distribution account', 'Following up asset valuations'],
};

const HISTORY_DAYS = 84;
const RUN_A = -61; // first billing run: entries up to day -62
const RUN_B = -31; // second billing run: entries day -61 … -32

export function buildLegalSeed(today: string) {
  const rnd = prng(20261105);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const { collections, rec, day } = seeder(today);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const users = [
    user('u_mp', 'Nandi Mahlaba', 'Managing partner', 'partner', [], [], true),
    user('u_assoc', 'Imran Desai', 'Associate attorney', 'associate', ['dashboard', 'matters', 'conflicts', 'clients', 'documents', 'time', 'trust', 'invoices', 'diary', 'reports'], ['matters.manage', 'intake', 'time.record', 'privileged.view', 'diary']),
    user('u_cand', 'Zinhle Mthembu', 'Candidate attorney', 'candidate', ['dashboard', 'matters', 'conflicts', 'clients', 'documents', 'time', 'diary'], ['time.record', 'privileged.view', 'diary']),
    user('u_sec', 'Carmen Jacobs', 'Legal secretary & paralegal', 'secretary', ['dashboard', 'matters', 'conflicts', 'clients', 'documents', 'time', 'trust', 'diary'], ['intake', 'time.record', 'diary', 'trust.record']),
    user('u_book', 'Elsabé Fourie', 'Bookkeeper', 'bookkeeper', ['dashboard', 'matters', 'clients', 'time', 'trust', 'invoices', 'reports'], ['trust.record', 'billing']),
  ];
  const H = (daysAgo: number, by: string, role: string, action: string, note?: string) => ({ daysAgo, by, role, action, note });

  /* ---------- Clients ---------- */
  const clients = CLIENTS.map(([name, kind, contact, ficaStatus, exp], i) => {
    const slug = name.toLowerCase().replace(/\(pty\) ltd|cc|family trust/g, '').trim().split(/\s+/).slice(0, 2).join('.').replace(/[^a-z.]/g, '');
    return rec('clients', 'CL', {
      name, kind, contact,
      phone: `0${[11, 21, 31, 12, 82, 72][i % 6]} 555 ${String(2100 + i * 47).slice(-4)}`,
      email: `${slug}@example.com`,
      ficaStatus, ficaExpiry: exp === null ? '' : day(exp),
      address: `${10 + i * 3} ${['Main Road', 'Church Street', 'Oak Avenue', 'Beach Road', 'Jacaranda Lane', 'Station Street'][i % 6]}, Demo Town`,
      notes: '',
    }, { createdDaysAgo: 400 - i * 11 });
  });

  /* ---------- Matters ---------- */
  const matters = MATTERS.map((m) => rec('matters', 'MAT', {
    name: m.name, client: clients[m.client].id, type: m.type, opposingParty: m.opp, otherParties: m.others, feeEarner: m.fe, feeBasis: m.basis,
    estimate: m.estimate, caseNo: m.caseNo ?? '', court: m.court ?? '', opened: day(-m.opened),
    engagementSigned: ['active', 'closing', 'closed'].includes(m.status) || m.status === 'engagement',
    ficaVerified: ['active', 'closing', 'closed'].includes(m.status) || m.name.startsWith('Zulu v Zulu'),
    privilegedNotes: m.priv,
  }, {
    status: m.status, createdDaysAgo: m.opened,
    history: [
      H(m.opened, 'Carmen Jacobs', 'Legal secretary / paralegal', 'Matter opened at intake'),
      ...(['conflict', 'engagement', 'active', 'closing', 'closed', 'declined'].includes(m.status) ? [H(Math.max(0, m.opened - 1), 'Carmen Jacobs', 'Legal secretary / paralegal', 'Send for conflict check')] : []),
      ...(['engagement', 'active', 'closing', 'closed'].includes(m.status) ? [H(Math.max(0, m.opened - 2), 'Nandi Mahlaba', 'Managing partner', 'Conflict cleared — prepare engagement')] : []),
      ...(['active', 'closing', 'closed'].includes(m.status) ? [H(Math.max(0, m.opened - 5), 'Nandi Mahlaba', 'Managing partner', 'Open for work (engagement signed, FICA verified)')] : []),
      ...(m.status === 'closing' ? [H(5, 'Nandi Mahlaba', 'Managing partner', 'Start closing')] : []),
      ...(m.status === 'closed' ? [H(30, 'Nandi Mahlaba', 'Managing partner', 'Start closing')] : []),
      ...(m.status === 'closed' ? [H(25, 'Nandi Mahlaba', 'Managing partner', 'Close matter')] : []),
      ...(m.status === 'declined' ? [H(27, 'Nandi Mahlaba', 'Managing partner', 'Decline matter', 'Conflict of interest: Kestrel Engineering is an existing client. Prospective client referred to another firm.')] : []),
    ],
  }));
  const M = (i: number) => matters[i];

  /* ---------- Conflict checks ---------- */
  MATTERS.forEach((m, i) => {
    if (['intake'].includes(m.status) || i === 17 || i === 19) return;
    if (m.status === 'conflict' && i === 18) {
      rec('conflicts', 'CC', { matter: M(i).id, searchTerms: 'Kestrel Engineering; employment contracts', hits: 2, hitSummary: 'Kestrel Engineering is an existing client (shareholder agreement). Same client — no adverse party.', outcome: 'clear', note: '', checkedOn: day(-4) },
        { status: 'cleared', createdDaysAgo: 4, history: [H(4, 'Carmen Jacobs', 'Legal secretary / paralegal', 'Conflict search recorded'), H(3, 'Nandi Mahlaba', 'Managing partner', 'Clear for engagement')] });
      return;
    }
    if (m.status === 'declined') {
      rec('conflicts', 'CC', { matter: M(i).id, searchTerms: 'Kestrel Engineering', hits: 3, hitSummary: 'Kestrel Engineering (Pty) Ltd is a current client on two matters.', outcome: 'conflict', note: 'Acting against a current client on a related employment issue. Cannot act.', checkedOn: day(-29) },
        { status: 'conflict', createdDaysAgo: 29, history: [H(29, 'Carmen Jacobs', 'Legal secretary / paralegal', 'Conflict search recorded'), H(28, 'Nandi Mahlaba', 'Managing partner', 'Confirm conflict', 'Existing client — cannot act against them.')] });
      return;
    }
    rec('conflicts', 'CC', { matter: M(i).id, searchTerms: [CLIENTS[m.client][0], m.opp].filter(Boolean).join('; '), hits: 1, hitSummary: 'Only the instructing client matched. No adverse hits.', outcome: 'clear', note: '', checkedOn: day(-m.opened + 1) },
      { status: 'cleared', createdDaysAgo: m.opened - 1, history: [H(m.opened - 1, 'Carmen Jacobs', 'Legal secretary / paralegal', 'Conflict search recorded'), H(Math.max(0, m.opened - 2), 'Nandi Mahlaba', 'Managing partner', 'Clear for engagement')] });
  });
  // Pending potential conflict: Bluegum suing Sable, both clients of the firm.
  rec('conflicts', 'CC', { matter: M(17).id, searchTerms: 'Sable Retail Group; Bluegum Software', hits: 3, hitSummary: 'Sable Retail Group (Pty) Ltd is a current client (lease renewal matter). Bluegum Software is a current client.', outcome: 'potential', note: 'Unrelated subject matter. Written informed consent requested from both clients before we can act.', checkedOn: day(-3) },
    { status: 'pending', createdDaysAgo: 3, history: [H(3, 'Carmen Jacobs', 'Legal secretary / paralegal', 'Conflict search recorded')] });

  /* ---------- Time entries (about 12 weeks) ---------- */
  type Window = { m: DemoRecord; seed: MatterSeed; start: number; end: number };
  const windows: Window[] = MATTERS.map((s, i) => ({ m: M(i), seed: s, start: -Math.min(s.opened - 3, HISTORY_DAYS), end: s.end ?? 0 }))
    .filter((w) => ['active', 'closing', 'closed'].includes(w.seed.status));
  const weighted = (pool: Window[]) => {
    let x = rnd() * pool.reduce((n, w) => n + w.seed.estimate, 0);
    for (const w of pool) { x -= w.seed.estimate; if (x <= 0) return w; }
    return pool[pool.length - 1];
  };
  const perDay: Record<string, [number, number]> = { nm: [1, 2], id: [2, 3], zm: [2, 3], cj: [1, 2] };
  const timeRecs: DemoRecord[] = [];
  for (let d = -HISTORY_DAYS; d <= 0; d++) {
    const dow = parseIso(day(d)).getDay();
    if (dow === 0 || dow === 6) continue;
    for (const fe of FEE_EARNERS) {
      const open = windows.filter((w) => d >= w.start && d <= w.end);
      const own = open.filter((w) => w.seed.fe === fe.value);
      if (!open.length) continue;
      const [lo, hi] = perDay[fe.value];
      const count = d === 0 ? 1 : lo + Math.floor(rnd() * (hi - lo + 1));
      for (let k = 0; k < count; k++) {
        // Support staff split time between their own files and everyone else's; bigger matters attract more time.
        const pool = own.length && rnd() < (fe.value === 'nm' || fe.value === 'id' ? 0.65 : 0.4) ? own : open;
        const w = weighted(pool);
        const hours = r1(0.3 + rnd() * (fe.value === 'nm' ? 2.4 : 2.9));
        const billable = rnd() < (fe.value === 'cj' ? 0.8 : 0.9);
        const t = rec('time', 'TE', {
          matter: w.m.id, feeEarner: fe.value, date: day(d), hours, rate: fe.rate, billable,
          narrative: pick(NARRATIVES[w.seed.type]), invoice: '',
        }, { status: 'unbilled', createdDaysAgo: -d, history: [H(-d, fe.label, fe.role, 'Time recorded')] });
        timeRecs.push(t);
      }
    }
  }

  /* ---------- Billing runs: fee notes from time ---------- */
  const companyClient = (m: DemoRecord) => collections.clients.find((c) => c.id === m.values.client)?.values.kind === 'company';
  const invoices: DemoRecord[] = [];
  const bill = (runDay: number, from: number, to: number) => {
    for (const w of windows) {
      const entries = timeRecs.filter((t) => t.values.matter === w.m.id && t.values.billable === true && String(t.values.date) >= day(from) && String(t.values.date) <= day(to));
      const billNow: DemoRecord[] = [];
      for (const t of entries) {
        if (rnd() < 0.04) {
          t.status = 'writtenoff';
          t.history.push({ at: t.history[0].at, by: 'Nandi Mahlaba', role: 'Managing partner', action: 'Write off', note: 'Duplicated effort — not chargeable to client.' });
        } else billNow.push(t);
      }
      if (!billNow.length) continue;
      const feeLines: Line[] = billNow.map((t) => ({
        id: `ln_${t.id}`, code: FEE_EARNERS.find((f) => f.value === t.values.feeEarner)!.short,
        description: `${formatDate(String(t.values.date))} — ${String(t.values.narrative)}`, qty: Number(t.values.hours), unitPrice: Number(t.values.rate),
      }));
      const terms = companyClient(w.m) ? 45 : 14;
      const inv = rec('invoices', 'FN', {
        matter: w.m.id, date: day(runDay), dueDate: day(runDay + terms), paid: 0,
        notes: `Fees for ${billNow.length} time entries to ${formatDate(day(to))}.`, lines: feeLines,
      }, { status: 'issued', createdDaysAgo: -runDay, history: [H(-runDay, 'Elsabé Fourie', 'Bookkeeper', 'Fee note issued from unbilled time')] });
      for (const t of billNow) {
        t.status = 'billed';
        t.values.invoice = inv.id;
        t.history.push({ at: inv.createdAt, by: 'Elsabé Fourie', role: 'Bookkeeper', action: `Billed on fee note ${inv.ref}` });
      }
      invoices.push(inv);
    }
  };
  bill(RUN_A, -HISTORY_DAYS, RUN_A - 1);
  bill(RUN_B, RUN_A, RUN_B - 1);

  const total = (inv: DemoRecord) => linesTotals(lines(inv), VAT_RATE).total; // cents
  const settle = (inv: DemoRecord, paidCents: number, by = 'Elsabé Fourie', note?: string) => {
    inv.values.paid = r2(paidCents / 100);
    const full = paidCents >= total(inv);
    inv.status = full ? 'paid' : paidCents > 0 ? 'partpaid' : 'issued';
    if (paidCents > 0) inv.history.push({ at: inv.history[0].at, by, role: 'Bookkeeper', action: full ? 'Record payment in full' : 'Record part payment', note });
  };

  /* ---------- Trust ledger (simulated) ---------- */
  const trustPaidMatters = new Set([M(1).id, M(9).id, M(14).id, M(21).id]);
  const T = (matterIdx: number, type: string, offset: number, amount: number, payee: string, description: string, status = 'approved', invoice = '') => {
    const by = status === 'captured' ? [H(-offset, 'Elsabé Fourie', 'Bookkeeper', 'Trust transaction captured')] : [
      H(-offset, 'Elsabé Fourie', 'Bookkeeper', 'Trust transaction captured'),
      H(Math.max(0, -offset - 1), 'Nandi Mahlaba', 'Managing partner', 'Approve (simulated)'),
    ];
    return rec('trust', 'TR', {
      matter: M(matterIdx).id, type, date: day(offset), amount: r2(amount), payee, invoice,
      bankRef: `DEMO-EFT-${String(4000 + (collections.trust?.length ?? 0) * 37).slice(-4)}`, description,
    }, { status, createdDaysAgo: -offset, history: by });
  };
  /** Fee transfers from trust for each fee note of a matter, keeping `reserve` cents in trust. */
  const feeTransfers = (matterIdx: number, availableCents: number, reserve = 0) => {
    let avail = availableCents - reserve;
    let spent = 0;
    for (const inv of invoices.filter((x) => x.values.matter === M(matterIdx).id)) {
      const amt = Math.min(total(inv), avail);
      if (amt <= 0) continue;
      T(matterIdx, 'transfer', daysBetween(today, String(inv.values.date)) + 3, amt / 100, 'Mahlaba & Rossouw business account', `Fees per fee note ${inv.ref}`, 'approved', inv.id);
      settle(inv, amt, 'Elsabé Fourie', 'Paid by transfer from trust (simulated)');
      avail -= amt; spent += amt;
    }
    return spent;
  };

  // 1. Karoo Ridge litigation: deposit on account of counsel's fees, payment to counsel.
  T(0, 'deposit', -80, 50000, 'Karoo Ridge Logistics (Pty) Ltd', 'Deposit on account of counsel\'s fees');
  T(0, 'payment', -40, 35000, 'Adv. T. Mokoena (fictional counsel)', 'Counsel\'s fees — pre-trial opinion');
  // 2. Ndlovu divorce: deposit on account, fee transfers.
  T(1, 'deposit', -110, 30000, 'Thandiwe Ndlovu', 'Deposit on account of fees');
  feeTransfers(1, 3000000, 250000);
  // 4. Linden transfer: purchaser deposit, rates clearance, pending transfer duty payment.
  T(3, 'deposit', -50, 150000, 'Rashid Moosa', 'Deposit per sale agreement — held pending registration');
  T(3, 'payment', -20, 12450.8, 'Municipality — rates clearance (simulated)', 'Rates clearance figures');
  T(3, 'payment', -1, 4200, 'Transfer duty (simulated)', 'Transfer duty on Erf 1182 Linden', 'captured');
  // 5. Umhlanga phase 2: purchaser deposits and a release on registration.
  T(4, 'deposit', -120, 95000, 'Purchaser — Unit 7 (fictional)', 'Deposit, Unit 7 Coastal Heights');
  T(4, 'deposit', -64, 60000, 'Purchaser — Unit 11 (fictional)', 'Deposit, Unit 11 Coastal Heights');
  T(4, 'payment', -22, 95000, 'Umhlanga Bay Developments (Pty) Ltd', 'Release of Unit 7 deposit on registration');
  // 10. Estate Pretorius: estate funds, creditor payments, fee transfers, and a distribution that is too large.
  T(9, 'deposit', -100, 480000, 'Estate Late H. Pretorius — closed bank account', 'Estate funds received');
  T(9, 'payment', -90, 23400, 'Peaceful Rest Funeral Services (fictional)', 'Funeral account');
  T(9, 'payment', -70, 8750, 'Municipality (simulated)', 'Final municipal account');
  feeTransfers(9, 48000000 - 2340000 - 875000);
  T(9, 'payment', -2, 460000, 'Heirs — Pieter and Elna Pretorius', 'Interim distribution to heirs (captured for approval)', 'captured');
  // 15. Venter Family Trust: deposit on account; a refund is still owed so the matter cannot close.
  T(14, 'deposit', -82, 25000, 'Venter Family Trust', 'Deposit on account of fixed fee');
  feeTransfers(14, 2500000, 185000);
  // 17. Karoo Ridge debt recovery: collected from debtor and paid over to the client.
  T(16, 'deposit', -26, 18600, 'Ubuntu Freight Services CC', 'Payment received from debtor after judgment');
  T(16, 'payment', -24, 18600, 'Karoo Ridge Logistics (Pty) Ltd', 'Collected amount paid over to client');
  // 22. Estate Late Grace Zulu (closed): balance taken to zero.
  const zuluTotal = invoices.filter((x) => x.values.matter === M(21).id).reduce((n, x) => n + total(x), 0);
  const zuluDeposit = zuluTotal + 7500000;
  T(21, 'deposit', -88, zuluDeposit / 100, 'Estate Late G. Zulu — bank account', 'Estate funds received');
  T(21, 'payment', -70, 60000, 'Lungile Zulu (heir)', 'Distribution to heir');
  feeTransfers(21, zuluDeposit - 6000000, 1500000);
  T(21, 'payment', -27, 15000, 'Bongani Zulu (heir)', 'Final distribution to heir');

  /* ---------- Fee note payments not from trust ---------- */
  const closedOrClosing = new Set([M(12).id, M(20).id, M(16).id]);
  invoices.forEach((inv, i) => {
    if (trustPaidMatters.has(String(inv.values.matter)) || inv.status !== 'issued') return;
    const runA = inv.values.date === day(RUN_A);
    if (closedOrClosing.has(String(inv.values.matter))) settle(inv, total(inv));
    else if (runA) settle(inv, inv.values.matter === M(6).id ? Math.round(total(inv) * 0.6) : total(inv));
    else if (i % 3 === 1) settle(inv, total(inv));
    else if (i % 3 === 2) settle(inv, Math.round(total(inv) * 0.5));
  });

  /* ---------- Court diary & deadlines ---------- */
  const D = (matterIdx: number, type: string, offset: number, time: string, title: string, venue: string, fe: string, status = 'upcoming', notes = '', newDate = '') =>
    rec('diary', 'DY', { matter: M(matterIdx).id, type, title, date: day(offset), time, venue, feeEarner: fe, notes, newDate }, {
      status, createdDaysAgo: Math.max(1, 20 - Math.min(offset, 0)),
      history: [H(Math.max(1, 20 - Math.min(offset, 0)), 'Carmen Jacobs', 'Legal secretary / paralegal', 'Diary entry created'),
        ...(status === 'done' ? [H(Math.max(0, -offset), 'Carmen Jacobs', 'Legal secretary / paralegal', 'Mark done')] : []),
        ...(status === 'postponed' ? [H(Math.max(0, -offset), 'Carmen Jacobs', 'Legal secretary / paralegal', 'Postpone', `Postponed by agreement to ${formatDate(newDate)}.`)] : [])],
    });
  D(7, 'prescription', 5, '', 'Prescription date — claim against Metro Commuter Bus Services', 'Serve summons before this date', 'id', 'upcoming', 'Three years from the date of the accident (fictional). Summons must be issued and served before this date.');
  D(13, 'prescription', 26, '', 'Prescription date — consumer claim against Brightside Motors', 'Letter of demand / summons', 'id');
  D(17, 'prescription', 40, '', 'Prescription date — unpaid licence fees (oldest invoice)', 'Requires conflict clearance first', 'nm');
  D(0, 'filing', -2, '16:00', 'Discovery affidavit due', 'Deliver to opposing attorneys', 'nm', 'upcoming', 'Notice to compel threatened if late.');
  D(6, 'filing', 3, '15:00', 'Deliver replication', 'Opposing attorneys + court file', 'nm');
  D(1, 'meeting', 1, '10:00', 'Consultation: settlement proposal', 'Boardroom 1', 'id');
  D(2, 'meeting', 2, '11:30', 'Negotiation meeting — Kalahari Cloud Distributors', 'Video call', 'nm');
  D(5, 'filing', 4, '12:00', 'Deliver bundle of documents', 'Arbitration (simulated)', 'id');
  D(1, 'court', 6, '09:30', 'Interim maintenance application — hearing', 'Regional Court (demo), Court 4', 'id');
  D(3, 'meeting', 8, '14:00', 'Signing of transfer documents with seller', 'Boardroom 2', 'cj');
  D(5, 'court', 9, '09:00', 'Arbitration hearing — Patel v Greenway Pharmacies', 'Arbitration venue (simulated)', 'id');
  D(8, 'meeting', 11, '10:00', 'Shareholder agreement sign-off', 'Client offices', 'nm');
  D(0, 'court', 12, '10:00', 'Pre-trial conference', 'High Court, Gauteng (fictional roll)', 'nm');
  D(4, 'filing', 14, '12:00', 'Lodge phase 2 transfers (simulated Deeds Office)', 'Deeds Office (simulated)', 'cj');
  D(9, 'filing', 18, '12:00', 'Lodge liquidation and distribution account (simulated)', 'Master of the High Court (simulated)', 'zm');
  D(6, 'court', 21, '10:00', 'Trial — supply contract dispute', 'High Court, Gauteng (fictional roll)', 'nm');
  D(10, 'court', 33, '09:00', 'Maintenance variation hearing', 'Maintenance Court (demo)', 'id');
  D(11, 'meeting', 0, '14:00', 'Lease renewal call with landlord', 'Phone', 'nm');
  D(0, 'court', -20, '10:00', 'Case management meeting', 'High Court, Gauteng (fictional roll)', 'nm', 'done');
  D(6, 'filing', -10, '15:00', 'Deliver discovery notice', 'Opposing attorneys', 'zm', 'done');
  D(1, 'court', -14, '09:30', 'Interim maintenance application — first hearing', 'Regional Court (demo), Court 4', 'id', 'postponed', '', day(6));
  D(16, 'court', -30, '09:00', 'Default judgment application', 'Magistrate\'s Court (demo)', 'id', 'done');

  /* ---------- Documents register ---------- */
  const DOC = (matterIdx: number, title: string, docType: string, version: string, author: string, status: string, ago: number, filedOn = '') =>
    rec('documents', 'DOC', { matter: M(matterIdx).id, title, docType, version, author, filedOn, notes: '' }, {
      status, createdDaysAgo: ago,
      history: [H(ago, FEE_EARNERS.find((f) => f.value === author)!.label, 'Fee earner', 'Draft started'),
        ...(['review', 'signed', 'filed'].includes(status) ? [H(Math.max(0, ago - 2), FEE_EARNERS.find((f) => f.value === author)!.label, 'Fee earner', 'Send for partner review')] : []),
        ...(['signed', 'filed'].includes(status) ? [H(Math.max(0, ago - 3), 'Nandi Mahlaba', 'Managing partner', 'Approve & sign')] : []),
        ...(status === 'filed' ? [H(Math.max(0, ago - 4), 'Carmen Jacobs', 'Legal secretary / paralegal', 'Mark filed (simulated)')] : [])],
    });
  DOC(0, 'Plea and counterclaim', 'pleading', 'v3', 'nm', 'filed', 48, day(-44));
  DOC(0, 'Discovery affidavit', 'affidavit', 'v1', 'zm', 'drafting', 6);
  DOC(1, 'Founding affidavit — interim maintenance', 'affidavit', 'v2', 'id', 'review', 9);
  DOC(2, 'SaaS reseller agreement', 'agreement', 'v4', 'nm', 'review', 12);
  DOC(3, 'Power of attorney to pass transfer', 'deed', 'v1', 'cj', 'signed', 25);
  DOC(4, 'Phase 2 sale agreements (batch)', 'agreement', 'v2', 'nm', 'signed', 70);
  DOC(5, 'Statement of case', 'pleading', 'v2', 'id', 'filed', 80, day(-76));
  DOC(6, 'Replication', 'pleading', 'v1', 'zm', 'drafting', 4);
  DOC(8, 'Shareholder agreement', 'agreement', 'v5', 'nm', 'review', 15);
  DOC(9, 'Liquidation and distribution account', 'will', 'v2', 'zm', 'drafting', 10);
  DOC(11, 'Lease renewal heads of terms', 'agreement', 'v1', 'nm', 'drafting', 7);
  DOC(12, 'Last will and testament — R. Moosa', 'will', 'v3', 'zm', 'signed', 45);
  DOC(16, 'Letter of demand — Ubuntu Freight', 'letter', 'v1', 'id', 'signed', 90);
  DOC(10, 'Notice of motion — maintenance variation', 'pleading', 'v1', 'id', 'drafting', 3);

  return { users, collections, currentUserId: 'u_mp' };
}

