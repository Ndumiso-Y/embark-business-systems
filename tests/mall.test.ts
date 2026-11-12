import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config, {
  addMonths, ageing, arrearsList, atRisk, bookingClash, breakpoint, buildInvoice, consumption, declarationDue, declarationFor, declarationOverdue, densityByCategory, draftCatchUp, escalatedRate, escalationState,
  expectedRentRoll, expectedUnitState, footfallCompare, invoiceTotals, leaseArrears, leaseExpiring, leasesToInvoice, marketingFund, monthBilling, monthsBetween, needsReview, nextEscalation,
  occupancy, overlaps, paymentProblem, pendingRecharges, periodEnd, permitExpired, permitProblems, readingFor, readingProblem, renewalOverdue, rentToSales, responseOverdue, setTodayForTests,
  tenantMix, tenantSales, tradingDensity, tradingProblems, turnoverRent, usageChange,
} from '../src/industries/mall';
import { applyTransition, findRecord, findTransition, hasModule, lines, linesTotals, num, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import { addDays, todayIso } from '../src/core/lib/dates';
import { useStore } from '../src/core/store';
import type { DemoRecord, EffectApi, IndustryData, Line, Values } from '../src/core/types';

const TODAY = '2026-11-12';
const PERIOD = '2026-11';
const LAST = '2026-10';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;
const get = (collection: string, id: string) => findRecord(data, collection, id)!;
const withValues = (r: DemoRecord, v: Values, status = r.status): DemoRecord => ({ ...r, status, values: { ...r.values, ...v } });
/** A copy of the data with one collection's records patched. */
const patched = (collection: string, fn: (r: DemoRecord) => DemoRecord, base = data): IndustryData => ({ ...base, collections: { ...base.collections, [collection]: records(base, collection).map(fn) } });
const withRecord = (collection: string, r: DemoRecord, base = data): IndustryData => patched(collection, (x) => (x.id === r.id ? r : x), base);
const unit = (shop: string, d = data) => records(d, 'units').find((u) => str(u, 'shop') === shop)!;
const leaseOfTenant = (tenant: string, d = data) => records(d, 'leases').find((l) => str(l, 'tenant') === tenant)!;
const move = (collection: string, r: DemoRecord, to: string, userId: string, note?: string, d = data) => applyTransition(wf(collection), r, to, user(userId), d, note, 'Tester');
const reason = (res: ReturnType<typeof move>) => (res.ok ? '' : res.reason);
const fakeApi = (): EffectApi => ({ create: vi.fn((c: string) => ({ id: `${c}_new`, ref: 'NEW-0001', values: {}, history: [], createdAt: '', updatedAt: '' })), update: vi.fn(), toast: vi.fn(), transition: vi.fn(() => ({ ok: true as const, value: {} as DemoRecord })) });
const blank = (collection: string, values: Values, status: string): DemoRecord => ({ id: `${collection}_x`, ref: 'X-0001', status, values, history: [], createdAt: '', updatedAt: '' });

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('shopping-centre configuration', () => {
  it('is internally consistent, including the guide', () => {
    expect(validateConfig(config)).toEqual([]);
    expect(config.guide).toHaveLength(6);
    for (const g of config.guide!) expect(hasModule(user(g.as!), g.to.split('/')[0])).toBe(true);
    expect(config.businessName).toBe('Harbour Crossing Mall');
    expect(config.priority).toBe(12);
  });

  it('seeds a realistic, deterministic centre', () => {
    const again = buildIndustryData(config, TODAY);
    for (const k of config.collections.map((c) => c.key)) {
      expect(JSON.stringify(records(again, k).map((r) => [r.id, r.status, r.values]))).toBe(JSON.stringify(records(data, k).map((r) => [r.id, r.status, r.values])));
    }
    const units = records(data, 'units');
    expect(units).toHaveLength(66);
    const occ = occupancy(units);
    expect(occ.gla).toBeGreaterThan(35000);
    expect(occ.gla).toBeLessThan(41000);
    expect([occ.vacantUnits, occ.offerUnits, occ.fitoutUnits, occ.letUnits]).toEqual([4, 2, 2, 58]);
    expect(new Set(units.map((u) => str(u, 'level'))).size).toBe(5);
    const leases = records(data, 'leases');
    expect(leases.length).toBeGreaterThanOrEqual(62);
    expect(new Set(leases.map((l) => l.status))).toEqual(new Set(['application', 'hot', 'signed', 'fitout', 'trading', 'renewal', 'notice', 'vacated', 'declined']));
    expect(leases.filter((l) => leaseExpiring(l, TODAY)).length).toBeGreaterThanOrEqual(5);
    expect(records(data, 'prospects')).toHaveLength(12);
    expect(records(data, 'workorders')).toHaveLength(25);
    expect(records(data, 'permits').length).toBeGreaterThanOrEqual(8);
    expect(records(data, 'opslog')).toHaveLength(30);
    expect(records(data, 'incidents')).toHaveLength(12);
    expect(records(data, 'bookings').length).toBeGreaterThanOrEqual(10);
    // Six months of rent roll, three months of readings.
    expect(new Set(records(data, 'invoices').map((i) => str(i, 'period')))).toEqual(new Set(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']));
    expect(new Set(records(data, 'readings').map((r) => str(r, 'period')))).toEqual(new Set(['2026-08', '2026-09', '2026-10']));
    expect(records(data, 'turnover').some((d) => declarationOverdue(d, TODAY))).toBe(true);
  });

  it('keeps every unit’s status in step with its lease', () => {
    for (const u of records(data, 'units')) expect(`${str(u, 'shop')}:${u.status}`).toBe(`${str(u, 'shop')}:${expectedUnitState(data, u.id)}`);
  });

  it('keeps the stored seed under 380 KB and free of real-looking details', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
    expect(bytes).toBeLessThan(380_000);
    const text = JSON.stringify(data.collections);
    expect(text).not.toContain('Harbour Crossing');
    for (const l of records(data, 'leases')) {
      if (str(l, 'email')) expect(str(l, 'email')).toMatch(/example\.com$/);
      if (str(l, 'phone')) expect(str(l, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
      if (str(l, 'cooNumber')) expect(str(l, 'cooNumber')).toMatch(/^DEMO-COO-/);
    }
  });

  it('gives the guided records the same id and state on the 1st, the 31st and mid-month', () => {
    for (const day of ['2026-10-31', '2026-11-01', '2026-03-01', '2027-01-15']) {
      const d = buildIndustryData(config, day);
      expect([findRecord(d, 'leases', 'leases_1')?.status, findRecord(d, 'leases', 'leases_2')?.status, findRecord(d, 'cases', 'cases_1')?.status, findRecord(d, 'permits', 'permits_1')?.status]).toEqual(['application', 'fitout', 'reminded', 'requested']);
      expect(str(findRecord(d, 'units', str(findRecord(d, 'leases', 'leases_1'), 'unit')), 'shop')).toBe('G14');
      // Month-end still makes sense: every trading lease is waiting for this month's invoice and last month is billed.
      const period = day.slice(0, 7);
      expect(leasesToInvoice(d, period)).toHaveLength(58);
      expect(monthBilling(d, addMonths(period, -1)).count).toBe(58);
      expect(monthBilling(d, period).count).toBe(0);
    }
  });
});

describe('leasing rules', () => {
  it('refuses heads of terms without an approved credit check, and above 500 m² without the leasing manager’s approval', () => {
    const app = get('leases', 'leases_1');
    expect(num(unit('G14'), 'gla')).toBeGreaterThan(500);
    expect(reason(move('leases', app, 'hot', 'u_la'))).toMatch(/approved credit check/);
    expect(reason(move('leases', withValues(app, { creditCheck: 'declined' }), 'hot', 'u_la'))).toMatch(/declined/);
    expect(reason(move('leases', withValues(app, { creditCheck: 'approved' }), 'hot', 'u_la'))).toMatch(/above 500 m² needs the leasing manager’s approval/);
    expect(move('leases', withValues(app, { creditCheck: 'approved', approvedBy: 'Pieter van der Walt' }), 'hot', 'u_la').ok).toBe(true);
    // A small shop needs no approval; someone without “Manage leases” cannot move it at all.
    const small = withValues(app, { unit: unit('L09').id, creditCheck: 'approved' });
    expect(move('leases', small, 'hot', 'u_la').ok).toBe(true);
    expect(reason(move('leases', small, 'hot', 'u_tc'))).toMatch(/does not hold this permission/);
    expect(reason(move('leases', withValues(small, { baseRent: 0 }), 'hot', 'u_la'))).toMatch(/base rent/);
  });

  it('never lets a unit that already has an active lease', () => {
    const app = withValues(get('leases', 'leases_1'), { unit: unit('G04').id, creditCheck: 'approved' });
    const d = withRecord('leases', app);
    expect(reason(move('leases', app, 'hot', 'u_lm', undefined, d))).toMatch(/Shop G04 already has an active lease .*Indigo Reef.*cannot be let twice/);
    // The same applies to a unit that is only under offer.
    const offer = withValues(app, { unit: unit('G18').id });
    expect(reason(move('leases', offer, 'hot', 'u_lm', undefined, withRecord('leases', offer)))).toMatch(/Fixit Phone Clinic.*Heads of terms/);
    // And a unit cannot be marked let by hand.
    expect(reason(move('units', unit('G14'), 'let', 'u_cm'))).toMatch(/follows its lease/);
    expect(reason(move('units', unit('G04'), 'vacant', 'u_cm'))).toMatch(/follows its lease/);
    // A prospect cannot be converted onto a held unit either.
    const prospect = withValues(get('prospects', 'prospects_2'), { unit: unit('G04').id });
    expect(reason(move('prospects', prospect, 'converted', 'u_la'))).toMatch(/no longer available/);
  });

  it('moves the unit when the lease moves', () => {
    const app = withValues(get('leases', 'leases_1'), { creditCheck: 'approved', approvedBy: 'x' }, 'hot');
    const api = fakeApi();
    findTransition(wf('leases'), 'application', 'hot')!.after!({ record: app, data: withRecord('leases', app), api, today: TODAY, user: user('u_lm') });
    expect(api.transition).toHaveBeenCalledWith('units', unit('G14').id, 'offer');
    // Handing over opens a fit-out project when there is none.
    const signed = get('leases', 'leases_4');
    const api2 = fakeApi();
    const handed = withValues(signed, {}, 'fitout');
    findTransition(wf('leases'), 'signed', 'fitout')!.after!({ record: handed, data: withRecord('leases', handed), api: api2, today: TODAY, user: user('u_lm') });
    expect(api2.transition).toHaveBeenCalledWith('units', unit('L12').id, 'fitout');
    expect(api2.create).toHaveBeenCalledWith('fitouts', expect.objectContaining({ lease: signed.id }), 'submitted', expect.any(String));
    // Converting a prospect opens an application at the unit's asking rent.
    const api3 = fakeApi();
    findTransition(wf('prospects'), 'proposal', 'converted')!.after!({ record: get('prospects', 'prospects_2'), data, api: api3, today: TODAY, user: user('u_la') });
    expect(api3.create).toHaveBeenCalledWith('leases', expect.objectContaining({ unit: unit('L09').id, tenant: 'Marula & Mint Skincare', baseRent: 365, creditCheck: 'pending' }), 'application', expect.any(String));
  });

  it('refuses “Lease signed” without a deposit or guarantee and FICA', () => {
    const hot = get('leases', 'leases_5');
    expect(reason(move('leases', hot, 'signed', 'u_lm'))).toMatch(/deposit or bank guarantee/);
    expect(reason(move('leases', withValues(hot, { depositType: 'guarantee', depositAmount: 110000, depositReceived: true }), 'signed', 'u_lm'))).toMatch(/FICA/);
    expect(reason(move('leases', withValues(hot, { depositType: 'cash', depositAmount: 0, depositReceived: true, fica: true }), 'signed', 'u_lm'))).toMatch(/deposit or bank guarantee/);
    expect(move('leases', withValues(hot, { depositType: 'guarantee', depositAmount: 110000, depositReceived: true, fica: true }), 'signed', 'u_lm').ok).toBe(true);
  });

  it('refuses “Start trading” without fit-out sign-off, a certificate of occupancy number and tenant insurance', () => {
    const building = get('leases', 'leases_3'); // fit-out still under way
    expect(reason(move('leases', withValues(building, { cooNumber: 'DEMO-COO-0900', insuranceExpiry: addDays(TODAY, 200) }), 'trading', 'u_lm'))).toMatch(/fit-out \(FO-0002\) is not signed off/);
    const ready = get('leases', 'leases_2'); // fit-out signed off
    expect(tradingProblems(data, ready, TODAY)).toHaveLength(2);
    expect(reason(move('leases', ready, 'trading', 'u_lm'))).toMatch(/certificate of occupancy/);
    expect(reason(move('leases', withValues(ready, { cooNumber: '12345' }), 'trading', 'u_lm'))).toMatch(/certificate of occupancy/);
    expect(reason(move('leases', withValues(ready, { cooNumber: 'DEMO-COO-0412' }), 'trading', 'u_lm'))).toMatch(/insurance is not on file/);
    expect(reason(move('leases', withValues(ready, { cooNumber: 'DEMO-COO-0412', insuranceExpiry: addDays(TODAY, -1) }), 'trading', 'u_lm'))).toMatch(/insurance expired/);
    expect(move('leases', withValues(ready, { cooNumber: 'DEMO-COO-0412', insuranceExpiry: TODAY }), 'trading', 'u_lm').ok).toBe(true);
  });

  it('runs a vacant shop to trading through the store, and the unit follows', () => {
    setTodayForTests(todayIso());
    try {
      const s = useStore.getState();
      s.ensure(config);
      const live = () => useStore.getState().data.mall!;
      const g14 = () => records(live(), 'units').find((u) => str(u, 'shop') === 'G14')!;
      const go = (c: string, id: string, to: string, note?: string) => useStore.getState().transition(config, c, id, to, note);
      s.signInAs('mall', 'u_cm');
      expect(g14().status).toBe('vacant');
      expect(go('leases', 'leases_1', 'hot').ok).toBe(false);
      s.updateRecord(config, 'leases', 'leases_1', { creditCheck: 'approved', approvedBy: 'Zanele Mokoena' });
      expect(go('leases', 'leases_1', 'hot').ok).toBe(true);
      expect(g14().status).toBe('offer');
      s.updateRecord(config, 'leases', 'leases_1', { depositType: 'cash', depositAmount: 300000, depositReceived: true, fica: true });
      expect(go('leases', 'leases_1', 'signed').ok).toBe(true);
      expect(go('leases', 'leases_1', 'fitout').ok).toBe(true);
      expect(g14().status).toBe('fitout');
      const fit = records(live(), 'fitouts').find((f) => str(f, 'lease') === 'leases_1')!;
      expect(fit.status).toBe('submitted');
      expect(go('leases', 'leases_1', 'trading').ok).toBe(false);
      expect(go('fitouts', fit.id, 'approved').ok).toBe(true);
      expect(go('fitouts', fit.id, 'inducted').ok).toBe(false);
      s.updateRecord(config, 'fitouts', fit.id, { contractor: 'Shopfit Squared', insuranceExpiry: addDays(todayIso(), 200), inducted: true });
      for (const to of ['inducted', 'works', 'snag']) expect(go('fitouts', fit.id, to).ok).toBe(true);
      expect(go('fitouts', fit.id, 'signedoff').ok).toBe(false);
      s.updateRecord(config, 'fitouts', fit.id, { snagsCleared: true });
      expect(go('fitouts', fit.id, 'signedoff').ok).toBe(true);
      s.updateRecord(config, 'leases', 'leases_1', { cooNumber: 'DEMO-COO-0777', insuranceExpiry: addDays(todayIso(), 300) });
      expect(go('leases', 'leases_1', 'trading').ok).toBe(true);
      expect(g14().status).toBe('let');
      expect(str(g14(), 'vacantSince')).toBe('');
      expect(occupancy(records(live(), 'units')).vacantUnits).toBe(3);
      // The new tenant joins the month-end run.
      expect(leasesToInvoice(live(), todayIso().slice(0, 7)).some((l) => l.id === 'leases_1')).toBe(true);
      // Notice, then vacated: the shop is back on the vacancy list from today.
      expect(go('leases', 'leases_1', 'notice', 'Tenant gave notice.').ok).toBe(true);
      expect(go('leases', 'leases_1', 'vacated', 'Keys returned.').ok).toBe(true);
      expect([g14().status, str(g14(), 'vacantSince')]).toEqual(['vacant', todayIso()]);
    } finally {
      setTodayForTests(TODAY);
    }
  });

  it('escalates the base rent on the anniversary', () => {
    expect(escalatedRate(285, 7)).toBe(304.95);
    expect(escalatedRate(304.95, 7)).toBe(326.3);
    expect(escalatedRate(100, 0)).toBe(100);
    const due = leaseOfTenant('Saffron Thread'); // started two years ago this month; only the first anniversary applied
    expect(nextEscalation(due)).toBe('2026-11-01');
    expect(escalationState(due, TODAY)).toBe('due');
    expect(escalationState(due, '2026-11-30')).toBe('due');
    expect(escalationState(due, '2026-12-01')).toBe('overdue');
    const applied = withValues(due, { lastEscalated: nextEscalation(due), baseRent: escalatedRate(num(due, 'baseRent'), num(due, 'escalationPct')) });
    expect(num(applied, 'baseRent')).toBe(Math.round(360 * (100 + num(due, 'escalationPct'))) / 100);
    expect(num(applied, 'baseRent')).toBeGreaterThan(380);
    expect(escalationState(applied, TODAY)).toBeNull();
    expect(nextEscalation(applied)).toBe('2027-11-01');
    expect(escalationState(leaseOfTenant('Linen Lighthouse'), TODAY)).toBe('overdue');
    expect(records(data, 'leases').filter((l) => escalationState(l, TODAY) === 'due').map((l) => str(l, 'tenant')).sort()).toEqual(['Bunny Chow Bros', 'Saffron Thread', 'Tidy Paws Pet Supplies']);
    // Renewal: overdue when still trading within 90 days of the end with nothing opened.
    expect(renewalOverdue(leaseOfTenant('QuickStitch Alterations'), TODAY)).toBe(true);
    expect(renewalOverdue(leaseOfTenant('Harbourside Dry Cleaners'), TODAY)).toBe(true); // in negotiation but already expired
    expect(renewalOverdue(leaseOfTenant('Urban Tern'), TODAY)).toBe(false); // negotiation open, not yet expired
    const renewing = leaseOfTenant('Urban Tern');
    expect(reason(move('leases', renewing, 'trading', 'u_lm'))).toMatch(/new end date under “Renewal terms”/);
    expect(reason(move('leases', withValues(renewing, { renewEnd: str(renewing, 'endDate') }), 'trading', 'u_lm'))).toMatch(/must be after the current end date/);
    expect(move('leases', withValues(renewing, { renewEnd: '2029-12-31' }), 'trading', 'u_lm').ok).toBe(true);
  });
});

describe('turnover, metering and billing', () => {
  it('calculates turnover rent, the breakpoint, trading density and rent-to-sales', () => {
    expect(turnoverRent(2_000_000, 7, 131_100)).toBe(8900);
    expect(turnoverRent(1_500_000, 7, 131_100)).toBe(0); // below the breakpoint
    expect(turnoverRent(1_872_857.14, 7, 131_100)).toBe(0); // at the breakpoint
    expect(turnoverRent(0, 7, 131_100)).toBe(0);
    expect(turnoverRent(2_000_000, 0, 131_100)).toBe(0);
    expect(breakpoint(131_100, 7)).toBe(1_872_857.14);
    expect(tradingDensity(2_000_000, 380)).toBe(5263);
    expect(tradingDensity(0, 380)).toBe(0);
    expect(rentToSales(131_100, 2_000_000)).toBe(6.6);
    expect(rentToSales(131_100, 0)).toBeNull();
    expect([atRisk(15), atRisk(15.1), atRisk(null)]).toEqual([false, true, false]);
    const sales = tenantSales(data);
    expect(sales.filter((s) => s.atRisk).map((s) => str(s.lease, 'tenant')).sort()).toEqual(['Salt & Silk', 'The Copper Skillet']);
    expect(sales.filter((s) => s.turnoverRent > 0).length).toBeGreaterThanOrEqual(2);
    const food = densityByCategory(data).find((c) => c.key === 'food')!;
    expect(food.density).toBeGreaterThan(densityByCategory(data).find((c) => c.key === 'grocery')!.density);
  });

  it('flags a declaration overdue only after the 7th of the next month', () => {
    const awaited = records(data, 'turnover').find((d) => d.status === 'awaited' && str(d, 'period') === LAST)!;
    expect(declarationDue(LAST)).toBe('2026-11-07');
    expect([declarationOverdue(awaited, '2026-11-07'), declarationOverdue(awaited, '2026-11-08')]).toEqual([false, true]);
    expect(declarationOverdue(withValues(awaited, {}, 'declared'), '2026-11-20')).toBe(false);
  });

  it('only lets a holder of “Verify turnover” verify, and needs a figure to declare', () => {
    const declared = records(data, 'turnover').find((d) => d.status === 'declared')!;
    expect(reason(move('turnover', declared, 'verified', 'u_lm'))).toMatch(/does not hold this permission/);
    expect(move('turnover', declared, 'verified', 'u_acc').ok).toBe(true);
    expect(reason(move('turnover', declared, 'queried', 'u_acc'))).toMatch(/note is required/);
    const awaited = records(data, 'turnover').find((d) => d.status === 'awaited')!;
    expect(reason(move('turnover', awaited, 'declared', 'u_acc'))).toMatch(/Type the turnover/);
    expect(move('turnover', withValues(awaited, { amount: 250000 }), 'declared', 'u_acc').ok).toBe(true);
    expect(move('turnover', awaited, 'verified', 'u_acc').ok).toBe(false); // cannot skip the declaration
  });

  it('refuses a meter reading below the previous one and flags unusual usage', () => {
    const u = unit('F05'); // Burger Buoy: electricity and water, last month's reading still to capture
    expect(readingFor(data, u.id, LAST)).toBeUndefined();
    const prev = readingFor(data, u.id, '2026-09')!;
    const due = (v: Values) => blank('readings', { unit: u.id, period: LAST, ...v }, 'due');
    expect(reason(move('readings', due({}), 'captured', 'u_ops'))).toMatch(/Type the electricity/);
    expect(reason(move('readings', due({ elec: num(prev, 'elec') - 1, water: num(prev, 'water') + 40 }), 'captured', 'u_ops'))).toMatch(/electricity reading .* is below the previous reading .* cannot run backwards/);
    expect(reason(move('readings', due({ elec: num(prev, 'elec') + 5000 }), 'captured', 'u_ops'))).toMatch(/Type the water/);
    expect(reason(move('readings', due({ elec: num(prev, 'elec') + 5000, water: num(prev, 'water') - 1 }), 'captured', 'u_ops'))).toMatch(/water reading .* below/);
    expect(move('readings', due({ elec: num(prev, 'elec'), water: num(prev, 'water') }), 'captured', 'u_ops').ok).toBe(true); // closed shop: no usage
    expect(reason(move('readings', due({ elec: num(prev, 'elec') + 5000, water: num(prev, 'water') + 40 }), 'captured', 'u_acc'))).toMatch(/does not hold this permission/);
    expect(readingProblem({ elec: 10 }, undefined, false)).toBeNull(); // opening reading
    // Usage ±40% against the month before is flagged until someone reviews it.
    const used = consumption(data, prev)!;
    const jump = blank('readings', { unit: u.id, period: LAST, elec: num(prev, 'elec') + Math.round(used.elec * 1.6), water: num(prev, 'water') + used.water }, 'captured');
    const d = { ...data, collections: { ...data.collections, readings: [...records(data, 'readings'), jump] } };
    expect(usageChange(d, jump)).toBe(60);
    expect(needsReview(d, jump)).toBe(true);
    expect(needsReview(d, withValues(jump, { reviewedBy: 'Rajesh Naidoo' }))).toBe(false);
    const steady = withValues(jump, { elec: num(prev, 'elec') + Math.round(used.elec * 1.2) });
    expect(needsReview({ ...d, collections: { ...d.collections, readings: [...records(data, 'readings'), steady] } }, steady)).toBe(false);
    expect(records(data, 'readings').filter((r) => needsReview(data, r))).toHaveLength(2);
  });

  it('builds a month’s invoice from a lease', () => {
    const lease = leaseOfTenant('Peri Dock Chicken'); // 90 m², turnover clause, electricity and water
    const gla = 90;
    const verified = patched('turnover', (d) => (str(d, 'lease') === lease.id && str(d, 'period') === LAST ? withValues(d, { amount: 900_000 }, 'verified') : d));
    const draft = buildInvoice(verified, lease, PERIOD, TODAY);
    const ls = draft.values.lines as Line[];
    expect(ls.map((l) => l.id)).toEqual(['rent', 'ops', 'mkt', 'elec', 'water', 'tr']);
    expect(ls[0]).toMatchObject({ qty: gla, unitPrice: num(lease, 'baseRent') });
    const used = consumption(verified, readingFor(verified, str(lease, 'unit'), LAST))!;
    expect(ls[3]).toMatchObject({ qty: used.elec, unitPrice: 2.85 });
    expect(ls[4]).toMatchObject({ qty: used.water, unitPrice: 48.5 });
    const base = gla * num(lease, 'baseRent');
    expect(ls[5].unitPrice).toBe(turnoverRent(900_000, 9, base));
    expect(ls[5].unitPrice).toBe(Math.round((900_000 * 0.09 - base) * 100) / 100);
    expect(draft.values).toMatchObject({ lease: lease.id, period: PERIOD, date: TODAY, dueDate: addDays(TODAY, 7), paid: 0, levy: gla * num(lease, 'mktRate') });
    expect(draft.notes).toEqual([]);
    const t = linesTotals(ls, 15);
    expect(t.total).toBe(t.net + t.vat);
    expect(Math.abs(t.vat - t.net * 0.15)).toBeLessThan(ls.length); // VAT is rounded per line
    expect(invoiceTotals(blank('invoices', draft.values, 'draft')).total).toBe(t.total);

    // Below the breakpoint: no line, and a note says why.
    const low = buildInvoice(patched('turnover', (d) => (str(d, 'lease') === lease.id && str(d, 'period') === LAST ? withValues(d, { amount: 500_000 }, 'verified') : d)), lease, PERIOD, TODAY);
    expect((low.values.lines as Line[]).some((l) => l.id === 'tr')).toBe(false);
    expect(low.notes.join(' ')).toMatch(/No turnover rent for Oct 2026/);
    // Declared but not verified (as seeded): not billed, with a note.
    const unverified = buildInvoice(data, lease, PERIOD, TODAY);
    expect(declarationFor(data, lease.id, LAST)?.status).toBe('declared');
    expect(unverified.unverifiedTurnover).toBe(true);
    expect(String(unverified.values.notes)).toMatch(/declared but not yet verified/);

    // A missing reading leaves the utilities line off but the invoice still drafts.
    const noReading = buildInvoice(data, leaseOfTenant('Burger Buoy'), PERIOD, TODAY);
    expect(noReading.missingReading).toBe(true);
    expect((noReading.values.lines as Line[]).map((l) => l.id)).toEqual(['rent', 'ops', 'mkt', 'tr'].filter((id) => id !== 'tr' || (noReading.values.lines as Line[]).some((l) => l.id === 'tr')));
    expect(String(noReading.values.notes)).toMatch(/Utilities for Oct 2026 not billed: no meter reading captured for Shop F05/);

    // A completed tenant-responsibility repair is recharged once.
    const saffron = leaseOfTenant('Saffron Thread');
    expect(pendingRecharges(data, str(saffron, 'unit'))).toHaveLength(1);
    const recharge = buildInvoice(data, saffron, PERIOD, TODAY);
    expect((recharge.values.lines as Line[]).find((l) => l.id.startsWith('wo-'))).toMatchObject({ qty: 1, unitPrice: 1850 });
    const billed = patched('workorders', (w) => (w.id === recharge.recharged[0].id ? withValues(w, { rechargeInvoice: 'INV-0400' }) : w));
    expect(pendingRecharges(billed, str(saffron, 'unit'))).toHaveLength(0);

    // A draft made before the reading came in can pick the line up afterwards; a once-off invoice does not stand in for the month's rent.
    const burger = leaseOfTenant('Burger Buoy');
    const early = blank('invoices', noReading.values, 'draft');
    expect(draftCatchUp(data, early)).toBeNull();
    const prev = readingFor(data, str(burger, 'unit'), '2026-09')!;
    const late = { ...data, collections: { ...data.collections, readings: [...records(data, 'readings'), blank('readings', { unit: str(burger, 'unit'), period: LAST, elec: num(prev, 'elec') + 5000, water: num(prev, 'water') + 40 }, 'captured')] } };
    expect(draftCatchUp(late, early)?.add.map((l) => [l.id, l.qty])).toEqual([['elec', 5000], ['water', 40]]);
    expect(draftCatchUp(late, withValues(early, {}, 'issued'))).toBeNull();
    const onceOff = { ...data, collections: { ...data.collections, invoices: [...records(data, 'invoices'), blank('invoices', { lease: burger.id, period: PERIOD, lines: [{ id: 'x1', description: 'Signage fee', qty: 1, unitPrice: 500 }] }, 'draft')] } };
    expect(leasesToInvoice(onceOff, PERIOD)).toHaveLength(58);
    expect(leasesToInvoice({ ...data, collections: { ...data.collections, invoices: [...records(data, 'invoices'), early] } }, PERIOD)).toHaveLength(57);

    // The run picks up every trading lease once.
    expect(leasesToInvoice(data, PERIOD)).toHaveLength(58);
    expect(leasesToInvoice(data, LAST)).toHaveLength(0);
    const roll = expectedRentRoll(data);
    expect(roll.leases).toBe(58);
    expect(roll.total).toBe(roll.net + Math.round(roll.net * 0.15));
  });

  it('never accepts a payment above the balance', () => {
    const inv = records(data, 'invoices').find((i) => i.status === 'issued')!;
    const { total, balance } = invoiceTotals(inv);
    expect(balance).toBe(total);
    const over = withValues(inv, { receipt: balance / 100 + 0.01 });
    expect(reason(move('invoices', over, 'partpaid', 'u_acc'))).toMatch(/more than the balance .* cannot be overpaid/);
    expect(reason(move('invoices', over, 'paid', 'u_acc'))).toMatch(/more than the balance/);
    expect(reason(move('invoices', withValues(inv, { receipt: 0 }), 'partpaid', 'u_acc'))).toMatch(/Type the amount received/);
    const half = withValues(inv, { receipt: 1000 });
    expect(move('invoices', half, 'partpaid', 'u_acc').ok).toBe(true);
    expect(reason(move('invoices', half, 'paid', 'u_acc'))).toMatch(/less than the balance/);
    expect(move('invoices', withValues(inv, { receipt: balance / 100 }), 'paid', 'u_acc').ok).toBe(true);
    expect(reason(move('invoices', withValues(inv, { receipt: balance / 100 }), 'partpaid', 'u_acc'))).toMatch(/settles the invoice/);
    expect(reason(move('invoices', half, 'partpaid', 'u_ops'))).toMatch(/does not hold this permission/);
    expect(paymentProblem(withValues(inv, {}, 'draft'), 100)).toMatch(/issued invoice/);
    // The part payment adds up; a second one is checked against what is left.
    const api = fakeApi();
    findTransition(wf('invoices'), 'issued', 'partpaid')!.after!({ record: withValues(half, {}, 'partpaid'), data, api, today: TODAY, user: user('u_acc') });
    expect(api.update).toHaveBeenCalledWith('invoices', inv.id, { paid: 1000, paidOn: TODAY, receipt: 0 }, expect.stringContaining('R1,000.00'));
    const second = withValues(inv, { paid: 1000, receipt: balance / 100 }, 'partpaid');
    expect(reason(move('invoices', second, 'partpaid', 'u_acc'))).toMatch(/more than the balance/);
    expect(invoiceTotals(second).balance).toBe(balance - 100000);
  });

  it('ages arrears into 30 / 60 / 90 day buckets', () => {
    const inv = (dueDate: string, status = 'issued', paid = 0) => blank('invoices', { dueDate, paid, lines: [{ id: 'a', description: 'Rent', qty: 1, unitPrice: 1000 }] }, status);
    const a = ageing([inv(addDays(TODAY, 3)), inv(TODAY), inv(addDays(TODAY, -1)), inv(addDays(TODAY, -30)), inv(addDays(TODAY, -31)), inv(addDays(TODAY, -60), 'partpaid', 150), inv(addDays(TODAY, -61)), inv(addDays(TODAY, -90)), inv(addDays(TODAY, -91)), inv(addDays(TODAY, -200), 'paid', 1150), inv(addDays(TODAY, -200), 'draft')], TODAY);
    expect(a).toEqual({ current: 230000, d30: 230000, d60: 215000, d90: 230000, d90plus: 115000, overdue: 790000, total: 1020000, oldest: 91 });
    const skillet = leaseArrears(data, leaseOfTenant('The Copper Skillet').id, TODAY);
    expect(skillet.d90plus).toBeGreaterThan(0);
    expect(skillet.oldest).toBeGreaterThan(90);
    const list = arrearsList(data, TODAY);
    expect(list[0].age.oldest).toBeGreaterThanOrEqual(list[list.length - 1].age.oldest);
    expect(list.find((r) => str(r.lease, 'tenant') === 'The Copper Skillet')?.caseRec?.id).toBe('cases_1');
    expect(list.filter((r) => !r.caseRec).length).toBeGreaterThanOrEqual(3);
    const oct = monthBilling(data, LAST);
    expect(oct.pct).toBeGreaterThan(85);
    expect(oct.pct).toBeLessThan(100);
    expect(monthBilling(data, '2026-05').pct).toBe(100);
  });

  it('walks credit control in order', () => {
    const c = get('cases', 'cases_1');
    expect(reason(move('cases', c, 'arrangement', 'u_acc'))).toMatch(/monthly instalment/);
    expect(reason(move('cases', withValues(c, { instalment: 15000 }), 'arrangement', 'u_acc'))).toMatch(/date of the first instalment/);
    expect(reason(move('cases', withValues(c, { instalment: 15000, firstPayment: addDays(TODAY, -1) }), 'arrangement', 'u_acc'))).toMatch(/cannot be in the past/);
    expect(move('cases', withValues(c, { instalment: 15000, firstPayment: addDays(TODAY, 7) }), 'arrangement', 'u_acc').ok).toBe(true);
    expect(move('cases', c, 'demand', 'u_acc').ok).toBe(true);
    expect(reason(move('cases', c, 'handedover', 'u_acc', 'x'))).toMatch(/Cannot move/); // not before a letter of demand
    expect(reason(move('cases', withValues(c, {}, 'demand'), 'handedover', 'u_acc'))).toMatch(/note is required/);
    expect(reason(move('cases', c, 'settled', 'u_acc'))).toMatch(/still owes .* overdue/);
    expect(reason(move('cases', c, 'demand', 'u_lm'))).toMatch(/does not hold this permission/);
    // A tenant only a few days late gets a reminder, not a letter of demand.
    const fresh = patched('invoices', (i) => (str(i, 'lease') === str(c, 'lease') ? withValues(i, { dueDate: addDays(TODAY, -5) }) : i));
    expect(reason(move('cases', c, 'demand', 'u_acc', undefined, fresh))).toMatch(/30 days overdue \(it is 5 days\)/);
  });
});

describe('operations rules', () => {
  it('decides responsibility before a work order is assessed or assigned', () => {
    const logged = records(data, 'workorders').find((w) => w.status === 'logged')!;
    expect(reason(move('workorders', logged, 'assessed', 'u_ops'))).toMatch(/Decide who is responsible/);
    expect(move('workorders', withValues(logged, { responsibility: 'landlord' }), 'assessed', 'u_ops').ok).toBe(true);
    const assessed = withValues(logged, {}, 'assessed');
    expect(reason(move('workorders', assessed, 'assigned', 'u_ops'))).toMatch(/Decide who is responsible/);
    expect(reason(move('workorders', withValues(assessed, { responsibility: 'landlord' }), 'assigned', 'u_ops'))).toMatch(/Name the contractor/);
    expect(move('workorders', withValues(assessed, { responsibility: 'landlord', contractor: 'PipeWright Plumbing' }), 'assigned', 'u_ops').ok).toBe(true);
    // A tenant-responsibility job is either recharged or closed with a note.
    const tenant = withValues(assessed, { responsibility: 'tenant', contractor: 'PipeWright Plumbing' });
    expect(reason(move('workorders', tenant, 'assigned', 'u_ops'))).toMatch(/agree a recharge amount .* or close the job with a note/);
    expect(move('workorders', withValues(tenant, { rechargeAmount: 950 }), 'assigned', 'u_ops').ok).toBe(true);
    expect(reason(move('workorders', tenant, 'closed', 'u_ops'))).toMatch(/note is required/);
    expect(move('workorders', tenant, 'closed', 'u_ops', 'Tenant to call their own plumber by Friday.').ok).toBe(true);
    expect(reason(move('workorders', withValues(assessed, { responsibility: 'landlord' }), 'closed', 'u_ops', 'x'))).toMatch(/Only a tenant-responsibility job/);
    expect(reason(move('workorders', logged, 'assessed', 'u_acc'))).toMatch(/does not hold this permission/);
    // Response targets count days, by priority.
    const wo = (priority: string, ago: number, status = 'logged') => blank('workorders', { priority, reportedOn: addDays(TODAY, -ago) }, status);
    expect([responseOverdue(wo('emergency', 0), TODAY), responseOverdue(wo('emergency', 1), TODAY), responseOverdue(wo('urgent', 2), TODAY), responseOverdue(wo('urgent', 4), TODAY), responseOverdue(wo('routine', 7), TODAY), responseOverdue(wo('routine', 9), TODAY)]).toEqual([0, 1, 0, 2, 0, 2]);
    expect(responseOverdue(wo('urgent', 9, 'assigned'), TODAY)).toBe(0);
  });

  it('refuses a hot-work permit without in-date insurance and a named fire watch', () => {
    const p = get('permits', 'permits_1');
    expect(str(p, 'type')).toBe('hot');
    expect(permitProblems(p)).toHaveLength(2);
    expect(reason(move('permits', p, 'approved', 'u_tc'))).toMatch(/public-liability insurance expires on .* before the work ends/);
    const insured = withValues(p, { insuranceExpiry: addDays(TODAY, 90) });
    expect(reason(move('permits', insured, 'approved', 'u_tc'))).toMatch(/Hot work needs a named fire watch/);
    expect(reason(move('permits', withValues(insured, { fireWatch: 'Sipho M', inducted: false }), 'approved', 'u_tc'))).toMatch(/site induction/);
    expect(reason(move('permits', withValues(p, { insuranceExpiry: '', fireWatch: 'Sipho M' }), 'approved', 'u_tc'))).toMatch(/not on file/);
    const ok = withValues(insured, { fireWatch: 'Sipho M' });
    expect(move('permits', ok, 'approved', 'u_tc').ok).toBe(true);
    expect(reason(move('permits', ok, 'approved', 'u_sec'))).toMatch(/does not hold this permission/);
    // Only active on its own dates; hot work is closed after the fire watch.
    const approved = withValues(ok, {}, 'approved');
    expect(reason(move('permits', approved, 'active', 'u_tc'))).toMatch(/only valid from/);
    const today = withValues(approved, { validFrom: TODAY, validTo: TODAY });
    expect(move('permits', today, 'active', 'u_tc').ok).toBe(true);
    expect(reason(move('permits', withValues(approved, { validFrom: addDays(TODAY, -3), validTo: addDays(TODAY, -1) }), 'active', 'u_tc'))).toMatch(/expired on/);
    const active = withValues(today, {}, 'active');
    expect(reason(move('permits', active, 'closed', 'u_tc'))).toMatch(/fire watch stayed for 60 minutes/);
    expect(move('permits', withValues(active, { fireWatchDone: true }), 'closed', 'u_tc').ok).toBe(true);
    // Sprinkler isolation needs a reinstatement date and time.
    const sprinkler = get('permits', 'permits_2');
    expect(reason(move('permits', sprinkler, 'approved', 'u_ops'))).toMatch(/reinstatement date and time/);
    expect(reason(move('permits', withValues(sprinkler, { reinstateDate: str(sprinkler, 'validFrom') }), 'approved', 'u_ops'))).toMatch(/reinstatement date and time/);
    expect(move('permits', withValues(sprinkler, { reinstateDate: str(sprinkler, 'validFrom'), reinstateTime: '05:00' }), 'approved', 'u_ops').ok).toBe(true);
    // Expired but still active is flagged.
    expect(records(data, 'permits').filter((x) => permitExpired(x, TODAY)).map((x) => x.id)).toEqual(['permits_5']);
    expect(permitExpired(active, addDays(TODAY, 1))).toBe(true);
  });

  it('keeps fit-out sign-off separate and complete', () => {
    const f = withValues(get('fitouts', 'fitouts_2'), {}, 'approved');
    expect(move('fitouts', f, 'inducted', 'u_tc').ok).toBe(true);
    expect(reason(move('fitouts', withValues(f, { insuranceExpiry: addDays(TODAY, 2) }), 'inducted', 'u_tc'))).toMatch(/insurance expires on .* before the work ends/);
    expect(reason(move('fitouts', withValues(f, { inducted: false }), 'inducted', 'u_tc'))).toMatch(/site induction is not recorded/);
    expect(reason(move('fitouts', withValues(f, { contractor: '' }), 'inducted', 'u_tc'))).toMatch(/Name the fit-out contractor/);
    const snag = get('fitouts', 'fitouts_4');
    expect(reason(move('fitouts', snag, 'signedoff', 'u_ops'))).toMatch(/Snags are still open/);
    expect(reason(move('fitouts', withValues(snag, { snagsCleared: true }), 'signedoff', 'u_tc'))).toMatch(/does not hold this permission/);
    expect(move('fitouts', withValues(snag, { snagsCleared: true }), 'signedoff', 'u_ops').ok).toBe(true);
  });

  it('needs a response, findings and — for injury or damage — an insurance reference on an incident', () => {
    const reported = records(data, 'incidents').find((i) => i.status === 'reported')!;
    expect(reason(move('incidents', reported, 'responded', 'u_sec'))).toMatch(/who responded and what was done/);
    expect(move('incidents', withValues(reported, { responder: 'Bongani Sithole', action: 'First aid given.' }), 'responded', 'u_sec').ok).toBe(true);
    const injury = records(data, 'incidents').find((i) => i.status === 'investigated' && i.values.injury === true)!;
    expect(reason(move('incidents', injury, 'closed', 'u_sec'))).toMatch(/insurance reference is needed/);
    expect(reason(move('incidents', withValues(injury, { insuranceRef: 'CLM-991' }), 'closed', 'u_sec'))).toMatch(/starts with DEMO-CLM-/);
    expect(move('incidents', withValues(injury, { insuranceRef: 'DEMO-CLM-3301' }), 'closed', 'u_sec').ok).toBe(true);
    expect(move('incidents', withValues(injury, { injury: false }), 'closed', 'u_sec').ok).toBe(true);
    expect(reason(move('incidents', injury, 'closed', 'u_mkt'))).toMatch(/does not hold this permission/);
  });

  it('compares footfall with the same weekday a week earlier', () => {
    const cmp = footfallCompare(data, TODAY)!;
    expect(cmp).toMatchObject({ date: addDays(TODAY, -1), isToday: false });
    expect(cmp.lastWeek).toBe(num(records(data, 'opslog').find((l) => str(l, 'date') === addDays(TODAY, -8)), 'footfall'));
    const withToday = { ...data, collections: { ...data.collections, opslog: [...records(data, 'opslog'), blank('opslog', { date: TODAY, footfall: 20000 }, '')] } };
    expect(footfallCompare(withToday, TODAY)).toMatchObject({ isToday: true, footfall: 20000, lastWeek: num(records(data, 'opslog').find((l) => str(l, 'date') === addDays(TODAY, -7)), 'footfall') });
  });
});

describe('marketing rules', () => {
  it('never double-books an exhibition space', () => {
    const quoted = get('bookings', 'bookings_5'); // same court as a confirmed booking, overlapping dates
    const confirmed = get('bookings', 'bookings_3');
    expect([str(quoted, 'space'), quoted.status, confirmed.status]).toEqual([str(confirmed, 'space'), 'quoted', 'confirmed']);
    expect(bookingClash(data, quoted)?.id).toBe('bookings_3');
    expect(reason(move('bookings', quoted, 'confirmed', 'u_mkt'))).toMatch(/already booked by Evergreen Vehicle Display \(EX-0003\).*cannot be double-booked/);
    // Even with the deposit in, the clash still refuses it.
    expect(reason(move('bookings', withValues(quoted, { depositPaid: true }), 'confirmed', 'u_mkt'))).toMatch(/double-booked/);
    // Another space, or dates after the other booking ends, are fine once the deposit is received.
    const moved = withValues(quoted, { startDate: addDays(str(confirmed, 'endDate'), 1), endDate: addDays(str(confirmed, 'endDate'), 4) });
    expect(reason(move('bookings', moved, 'confirmed', 'u_mkt'))).toMatch(/only confirmed once the deposit is received/);
    expect(move('bookings', withValues(moved, { depositPaid: true }), 'confirmed', 'u_mkt').ok).toBe(true);
    expect(move('bookings', withValues(quoted, { space: 'court-l', startDate: addDays(TODAY, 40), endDate: addDays(TODAY, 42), depositPaid: true }), 'confirmed', 'u_mkt').ok).toBe(true);
    // Touching dates clash (the end day is still occupied); an enquiry on the same dates does not block.
    expect(overlaps('2026-11-01', '2026-11-05', '2026-11-05', '2026-11-08')).toBe(true);
    expect(overlaps('2026-11-01', '2026-11-05', '2026-11-06', '2026-11-08')).toBe(false);
    expect(bookingClash(data, confirmed)).toBeUndefined();
    expect(reason(move('bookings', withValues(moved, { depositPaid: true }), 'confirmed', 'u_ops'))).toMatch(/does not hold this permission/);
    expect(reason(move('bookings', get('bookings', 'bookings_3'), 'live', 'u_mkt'))).toMatch(/only starts on/);
  });

  it('keeps campaign spend within the marketing fund', () => {
    const fund = marketingFund(data);
    expect(fund.levies).toBeGreaterThan(0);
    expect(fund.balance).toBe(fund.levies - fund.spent - fund.approved);
    const planned = records(data, 'campaigns').find((c) => c.status === 'planned')!;
    expect(move('campaigns', planned, 'approved', 'u_mkt').ok).toBe(true);
    expect(reason(move('campaigns', withValues(planned, { cost: fund.balance / 100 + 1 }), 'approved', 'u_mkt'))).toMatch(/more than the .* left in the marketing fund/);
    expect(reason(move('campaigns', withValues(planned, { cost: 0 }), 'approved', 'u_mkt'))).toMatch(/Type the cost/);
  });
});

describe('reports', () => {
  it('measures occupancy by GLA, not by unit count', () => {
    const u = (gla: number, status: string) => blank('units', { gla }, status);
    expect(occupancy([u(4000, 'let'), u(500, 'fitout'), u(300, 'offer'), u(200, 'vacant')])).toEqual({ gla: 5000, occupied: 4500, vacant: 500, pct: 90, vacantUnits: 1, offerUnits: 1, fitoutUnits: 1, letUnits: 1 });
    expect(occupancy([]).pct).toBe(0);
    const mix = tenantMix(data);
    expect(Math.round(mix.reduce((n, m) => n + m.pct, 0))).toBe(100);
    expect(mix[0].gla).toBeGreaterThanOrEqual(mix[1].gla);
  });

  it('handles month arithmetic at year ends', () => {
    expect([addMonths('2026-11', 2), addMonths('2026-01', -1), addMonths('2026-03', -6)]).toEqual(['2027-01', '2025-12', '2025-09']);
    expect([periodEnd('2026-02'), periodEnd('2028-02'), periodEnd('2026-12')]).toEqual(['2026-02-28', '2028-02-29', '2026-12-31']);
    expect([monthsBetween('2026-06-15', '2026-11-12'), monthsBetween('2026-06-12', '2026-11-12'), monthsBetween('2026-11-12', '2026-06-12')]).toEqual([4, 5, 0]);
    expect(lines(records(data, 'invoices')[0]).length).toBeGreaterThan(0);
  });
});
