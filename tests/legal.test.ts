import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config, {
  activationProblems, buildFeeNote, captureProblem, closeProblems, conflictStatus, deadlineWindow, hoursProblem, invoiceTotal, ledgerRows, outflowProblem,
  searchConflicts, setTodayForTests, trustBalance, trustBalanceOf, unbilledEntries, weekStart, workingDays,
} from '../src/industries/legal';
import { applyTransition, can, records, str, validateConfig, validateValues } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import type { DemoRecord, IndustryData } from '../src/core/types';

const TODAY = '2026-11-11';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const def = (k: string) => config.collections.find((c) => c.key === k)!;
const wf = (k: string) => def(k).workflow!;
const matterByName = (prefix: string) => records(data, 'matters').find((m) => str(m, 'name').startsWith(prefix))!;
const txn = (id: string, matter: string, type: string, amount: number, status = 'approved'): DemoRecord => ({
  id, ref: id, status, values: { matter, type, amount, date: TODAY, payee: 'Test', description: 'Test' }, history: [], createdAt: '', updatedAt: '',
});
const withRecords = (k: string, extra: DemoRecord[]): IndustryData => ({ ...data, collections: { ...data.collections, [k]: [...records(data, k), ...extra] } });

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('law firm configuration', () => {
  it('is internally consistent', () => {
    expect(validateConfig(config)).toEqual([]);
  });

  it('seeds a deterministic, realistic practice', () => {
    const again = buildIndustryData(config, TODAY);
    expect(JSON.stringify(again.collections)).toBe(JSON.stringify(data.collections));
    expect(records(data, 'clients').length).toBe(16);
    expect(records(data, 'matters').length).toBeGreaterThanOrEqual(20);
    const states = new Set(records(data, 'matters').map((m) => m.status));
    for (const s of ['intake', 'conflict', 'engagement', 'active', 'closing', 'closed', 'declined']) expect(states.has(s)).toBe(true);
    expect(records(data, 'time').length).toBeGreaterThan(200);
    const trustMatters = new Set(records(data, 'trust').map((t) => str(t, 'matter')));
    expect(trustMatters.size).toBe(8);
    expect(records(data, 'diary').length).toBeGreaterThanOrEqual(20);
    expect(records(data, 'diary').some((d) => d.status === 'upcoming' && str(d, 'date') < TODAY)).toBe(true);
    expect(records(data, 'diary').some((d) => deadlineWindow(d, TODAY) === 'week' && str(d, 'type') === 'prescription')).toBe(true);
    expect(records(data, 'invoices').some((i) => i.status === 'paid')).toBe(true);
    expect(records(data, 'documents').length).toBeGreaterThanOrEqual(12);
  });

  it('uses only fictional contact details and visibly fake case numbers', () => {
    for (const c of records(data, 'clients')) {
      expect(str(c, 'email')).toMatch(/@example\.com$/);
      expect(str(c, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
    }
    for (const m of records(data, 'matters')) if (str(m, 'caseNo')) expect(str(m, 'caseNo')).toMatch(/^DEMO-/);
  });

  it('every seeded approved trust ledger stays at or above zero, and every billed entry links to a fee note', () => {
    for (const id of new Set(records(data, 'trust').map((t) => str(t, 'matter')))) {
      for (const row of ledgerRows(data, id)) expect(row.balance).toBeGreaterThanOrEqual(0);
    }
    for (const t of records(data, 'time').filter((x) => x.status === 'billed')) expect(records(data, 'invoices').some((i) => i.id === str(t, 'invoice'))).toBe(true);
    for (const m of records(data, 'matters').filter((x) => x.status === 'closed')) expect(closeProblems(m, data)).toEqual([]);
  });
});

describe('trust ledger (simulated) never goes negative', () => {
  it('computes balances from approved transactions only, in cents', () => {
    const txns = [txn('a', 'm1', 'deposit', 1000.1), txn('b', 'm1', 'payment', 0.2), txn('c', 'm1', 'transfer', 0.1), txn('d', 'm1', 'payment', 999, 'captured'), txn('e', 'm1', 'payment', 50, 'rejected'), txn('f', 'm2', 'deposit', 7)];
    expect(trustBalanceOf(txns, 'm1')).toBe(99980);
    expect(trustBalanceOf(txns, 'm2')).toBe(700);
    expect(trustBalanceOf(txns, 'none')).toBe(0);
  });

  it('outflowProblem blocks anything above the balance, zero and negatives', () => {
    expect(outflowProblem(10000, 100)).toBeNull();
    expect(outflowProblem(10000, 100.01)).toMatch(/overdraw/);
    expect(outflowProblem(0, 0.01)).toMatch(/overdraw/);
    expect(outflowProblem(10000, 0)).toMatch(/greater than zero/);
    expect(outflowProblem(10000, -5)).toMatch(/greater than zero/);
    expect(outflowProblem(30, 0.1 + 0.2)).toBeNull(); // float noise handled via cents
  });

  it('capture checks the available balance after pending payments', () => {
    const linden = matterByName('Transfer: Erf 1182');
    const available = trustBalance(data, linden.id) - 420000; // R4,200 transfer duty pending
    expect(captureProblem(data, linden.id, 'payment', available / 100)).toBeNull();
    expect(captureProblem(data, linden.id, 'payment', available / 100 + 0.01)).toMatch(/overdraw/);
    expect(captureProblem(data, linden.id, 'deposit', 1_000_000)).toBeNull();
    expect(captureProblem(data, '', 'deposit', 10)).toMatch(/matter/);
  });

  it('approval guard blocks an over-balance payment and allows one within the balance', () => {
    const estate = matterByName('Estate Late Hendrik');
    const big = records(data, 'trust').find((t) => str(t, 'matter') === estate.id && t.status === 'captured')!;
    expect(Number(big.values.amount) * 100).toBeGreaterThan(trustBalance(data, estate.id));
    const res = applyTransition(wf('trust'), big, 'approved', user('u_mp'), data, undefined, 'Managing partner');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/overdraw/);
    const ok = { ...big, values: { ...big.values, amount: trustBalance(data, estate.id) / 100 } };
    expect(applyTransition(wf('trust'), ok, 'approved', user('u_mp'), data, undefined, 'Managing partner')).toMatchObject({ ok: true });
  });

  it('a payment against a matter with no trust money is blocked; the bookkeeper cannot approve', () => {
    const empty = matterByName('Bluegum Software — SaaS');
    expect(trustBalance(data, empty.id)).toBe(0);
    const t = txn('x', empty.id, 'payment', 1);
    expect(applyTransition(wf('trust'), { ...t, status: 'captured' }, 'approved', user('u_mp'), data, undefined, 'MP')).toMatchObject({ ok: false });
    const dep = { ...txn('y', empty.id, 'deposit', 1), status: 'captured' };
    expect(applyTransition(wf('trust'), dep, 'approved', user('u_book'), data, undefined, 'Bookkeeper')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
    expect(applyTransition(wf('trust'), dep, 'approved', user('u_mp'), data, undefined, 'MP')).toMatchObject({ ok: true });
  });

  it('a fee transfer must be linked to a fee note of the same matter', () => {
    const ndlovu = matterByName('Ndlovu — divorce');
    const t = { ...txn('z', ndlovu.id, 'transfer', 1), status: 'captured' };
    const res = applyTransition(wf('trust'), t, 'approved', user('u_mp'), data, undefined, 'MP');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/fee note/);
  });
});

describe('matter lifecycle rules', () => {
  it('engagement is blocked without a cleared conflict check', () => {
    const noCheck = matterByName('Ndlovu — purchase');
    expect(conflictStatus(data, noCheck.id)).toBe('none');
    const r1 = applyTransition(wf('matters'), noCheck, 'engagement', user('u_mp'), data, undefined, 'MP');
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toMatch(/No conflict check/);

    const pending = matterByName('Bluegum Software v Sable');
    expect(conflictStatus(data, pending.id)).toBe('pending');
    const r2 = applyTransition(wf('matters'), pending, 'engagement', user('u_mp'), data, undefined, 'MP');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toMatch(/not been cleared/);

    const cleared = matterByName('Kestrel Engineering — employment');
    expect(conflictStatus(data, cleared.id)).toBe('cleared');
    expect(applyTransition(wf('matters'), cleared, 'engagement', user('u_mp'), data, undefined, 'MP')).toMatchObject({ ok: true });
  });

  it('clearing a potential conflict needs a note; a confirmed conflict cannot be cleared; candidates cannot clear', () => {
    const check = records(data, 'conflicts').find((c) => c.status === 'pending' && str(c, 'outcome') === 'potential')!;
    expect(applyTransition(wf('conflicts'), check, 'cleared', user('u_mp'), data, undefined, 'MP')).toMatchObject({ ok: true });
    const noNote = { ...check, values: { ...check.values, note: '' } };
    expect(applyTransition(wf('conflicts'), noNote, 'cleared', user('u_mp'), data, undefined, 'MP')).toMatchObject({ ok: false });
    expect(applyTransition(wf('conflicts'), noNote, 'cleared', user('u_mp'), data, 'Consent obtained from both clients', 'MP')).toMatchObject({ ok: true });
    const conflict = { ...check, values: { ...check.values, outcome: 'conflict' } };
    expect(applyTransition(wf('conflicts'), conflict, 'cleared', user('u_mp'), data, undefined, 'MP')).toMatchObject({ ok: false });
    expect(applyTransition(wf('conflicts'), check, 'cleared', user('u_cand'), data, undefined, 'Candidate')).toMatchObject({ ok: false });
    // Field rule on the record form: potential needs a note.
    expect(validateValues(def('conflicts').fields, { matter: 'x', searchTerms: 'Sable', outcome: 'potential', note: '' })).toHaveProperty('outcome');
    expect(validateValues(def('conflicts').fields, { matter: 'x', searchTerms: 'Sable', outcome: 'potential', note: 'Waiver signed' })).toEqual({});
  });

  it('conflict search finds clients, opposing parties and other parties', () => {
    const hits = searchConflicts(data, 'sable');
    expect(hits.some((h) => h.role === 'Client')).toBe(true);
    expect(hits.some((h) => h.role === 'Opposing party')).toBe(true);
    expect(searchConflicts(data, 'Umhlanga Bay').some((h) => h.role === 'Other party')).toBe(true);
    expect(searchConflicts(data, 'x')).toEqual([]);
  });

  it('opening for work requires a signed engagement letter and FICA', () => {
    const blocked = matterByName('Khumalo v Metro');
    expect(activationProblems(blocked).join(' ')).toMatch(/FICA/);
    expect(applyTransition(wf('matters'), blocked, 'active', user('u_assoc'), data, undefined, 'Associate')).toMatchObject({ ok: false });
    const ready = matterByName('Zulu v Zulu');
    expect(applyTransition(wf('matters'), ready, 'active', user('u_assoc'), data, undefined, 'Associate')).toMatchObject({ ok: true });
  });

  it('closing is blocked by a trust balance or unbilled time, and allowed when both are clear', () => {
    const trustHeld = matterByName('Venter Family Trust');
    expect(trustBalance(data, trustHeld.id)).toBeGreaterThan(0);
    const r1 = applyTransition(wf('matters'), trustHeld, 'closed', user('u_mp'), data, undefined, 'MP');
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toMatch(/Trust balance must be R0\.00/);

    const unbilled = matterByName('Karoo Ridge Logistics — debt');
    expect(trustBalance(data, unbilled.id)).toBe(0);
    expect(unbilledEntries(data, unbilled.id).length).toBeGreaterThan(0);
    const r2 = applyTransition(wf('matters'), unbilled, 'closed', user('u_mp'), data, undefined, 'MP');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toMatch(/unbilled time/);

    const clean = matterByName('Moosa — will');
    expect(closeProblems(clean, data)).toEqual([]);
    expect(applyTransition(wf('matters'), clean, 'closed', user('u_mp'), data, undefined, 'MP')).toMatchObject({ ok: true });
    // A trust deposit appearing on the clean matter blocks closure again.
    const withDeposit = withRecords('trust', [txn('extra', clean.id, 'deposit', 10)]);
    expect(applyTransition(wf('matters'), clean, 'closed', user('u_mp'), withDeposit, undefined, 'MP')).toMatchObject({ ok: false });
  });

  it('billing unbilled time builds a VAT fee note covering exactly the WIP entries', () => {
    const m = matterByName('Karoo Ridge Logistics — debt');
    const fee = buildFeeNote(data, m.id, TODAY)!;
    const wip = unbilledEntries(data, m.id);
    expect(fee.entryIds).toEqual(wip.map((t) => t.id));
    const fakeInv: DemoRecord = { id: 'inv', ref: 'FN-X', status: 'issued', values: fee.values, history: [], createdAt: '', updatedAt: '' };
    const expected = wip.reduce((n, t) => {
      const excl = Math.round(Number(t.values.hours) * Number(t.values.rate) * 100);
      return n + excl + Math.round(excl * 0.15);
    }, 0);
    expect(invoiceTotal(fakeInv)).toBe(expected);
    // A time entry can only be marked billed through a fee note.
    const entry = wip[0];
    expect(applyTransition(wf('time'), entry, 'billed', user('u_book'), data, undefined, 'Bookkeeper')).toMatchObject({ ok: false });
    const withInv = withRecords('invoices', [fakeInv]);
    expect(applyTransition(wf('time'), { ...entry, values: { ...entry.values, invoice: 'inv' } }, 'billed', user('u_book'), withInv, undefined, 'Bookkeeper')).toMatchObject({ ok: true });
  });
});

describe('time entry validation', () => {
  it('accepts 0.1 increments up to 12 hours', () => {
    for (const h of [0.1, 0.3, 1.2, 7.5, 12]) expect(hoursProblem(h)).toBeNull();
    expect(hoursProblem(0.25)).toMatch(/0\.1/);
    expect(hoursProblem(1.05)).toMatch(/0\.1/);
    expect(hoursProblem(12.1)).toMatch(/12/);
    expect(hoursProblem(0)).toMatch(/more than zero/);
    expect(hoursProblem(-1)).toMatch(/more than zero/);
    expect(hoursProblem('abc')).toMatch(/number/);
  });
  it('enforces the rule through the time entry form fields', () => {
    const fields = def('time').fields;
    const base = { matter: 'm', feeEarner: 'id', date: TODAY, rate: 2100, narrative: 'Drafting', billable: true };
    expect(validateValues(fields, { ...base, hours: 1.3 })).toEqual({});
    expect(validateValues(fields, { ...base, hours: 1.25 })).toHaveProperty('hours');
    expect(validateValues(fields, { ...base, hours: 13 })).toHaveProperty('hours');
    expect(validateValues(fields, { ...base, hours: 2, narrative: '' })).toHaveProperty('narrative');
  });
  it('every seeded entry is valid', () => {
    for (const t of records(data, 'time')) expect(hoursProblem(t.values.hours)).toBeNull();
  });
  it('week and working-day helpers', () => {
    expect(weekStart('2026-11-11')).toBe('2026-11-09');
    expect(weekStart('2026-11-15')).toBe('2026-11-09');
    expect(workingDays('2026-11-09', '2026-11-15')).toBe(5);
  });
});

describe('privileged notes (simulated restriction)', () => {
  it('is a permission-gated field that only some roles can see', () => {
    const f = def('matters').fields.find((x) => x.key === 'privilegedNotes')!;
    expect(f.permission).toBe('privileged.view');
    expect(can(user('u_mp'), f.permission)).toBe(true); // super admin
    expect(can(user('u_assoc'), f.permission)).toBe(true);
    expect(can(user('u_cand'), f.permission)).toBe(true);
    expect(can(user('u_sec'), f.permission)).toBe(false);
    expect(can(user('u_book'), f.permission)).toBe(false);
    const visibleToBookkeeper = def('matters').fields.filter((x) => can(user('u_book'), x.permission)).map((x) => x.key);
    expect(visibleToBookkeeper).not.toContain('privilegedNotes');
    expect(visibleToBookkeeper).toContain('name');
  });
});
