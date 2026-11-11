import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config, {
  assignmentProblem, attendance, budgetState, checklistState, chemTrainedAt, complaintClock, consumablesUsed, contractInvoiceValues, dayStaffing, hoursBetween,
  inspectionFailed, inspectionScore, invoiceFigures, lowStock, quoteApprovalReasons, quoteFigures, rosterProblems, setTodayForTests, shiftCleaners, siteBelowSla,
  sitesOverBudget, sitesToInvoice, staffByRef, staffing, staffingPct, unstaffedCredit,
} from '../src/industries/cleaning';
import { applyTransition, findRecord, findTransition, hasModule, num, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import { addDays, todayIso } from '../src/core/lib/dates';
import { useStore } from '../src/core/store';
import type { DemoRecord, EffectApi, IndustryData, Values } from '../src/core/types';

const TODAY = '2026-11-11';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;
const get = (collection: string, id: string) => findRecord(data, collection, id)!;
const withValues = (r: DemoRecord, v: Values, status = r.status): DemoRecord => ({ ...r, status, values: { ...r.values, ...v } });
/** A copy of the data with one collection's records patched. */
const patched = (collection: string, fn: (r: DemoRecord) => DemoRecord, base = data): IndustryData => ({ ...base, collections: { ...base.collections, [collection]: records(base, collection).map(fn) } });
const site = (name: string) => records(data, 'sites').find((s) => str(s, 'name').startsWith(name))!;
const staffNamed = (first: string) => records(data, 'staff').find((s) => str(s, 'firstName') === first)!;
const stockNamed = (name: string) => records(data, 'stock').find((s) => str(s, 'name') === name)!;
const move = (collection: string, r: DemoRecord, to: string, userId: string, note?: string, d = data) => applyTransition(wf(collection), r, to, user(userId), d, note, 'Tester');
const fakeApi = (): EffectApi => ({ create: vi.fn((c: string) => ({ id: `${c}_new`, ref: 'NEW-0001', values: {}, history: [], createdAt: '', updatedAt: '' })), update: vi.fn(), toast: vi.fn(), transition: vi.fn() });
const reason = (res: ReturnType<typeof move>) => (res.ok ? '' : res.reason);

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('cleaning configuration', () => {
  it('is internally consistent, including the guide', () => {
    expect(validateConfig(config)).toEqual([]);
    expect(config.guide!.length).toBeGreaterThanOrEqual(5);
    for (const g of config.guide!) expect(hasModule(user(g.as!), g.to.split('/')[0])).toBe(true);
  });

  it('seeds a realistic, deterministic company', () => {
    const again = buildIndustryData(config, TODAY);
    for (const k of config.collections.map((c) => c.key)) {
      expect(JSON.stringify(records(again, k).map((r) => [r.id, r.status, r.values]))).toBe(JSON.stringify(records(data, k).map((r) => [r.id, r.status, r.values])));
    }
    expect(records(data, 'clients')).toHaveLength(12);
    expect(records(data, 'sites')).toHaveLength(16);
    expect(records(data, 'staff')).toHaveLength(60);
    expect(records(data, 'complaints')).toHaveLength(20);
    expect(records(data, 'equipment')).toHaveLength(35);
    expect(records(data, 'quotes')).toHaveLength(11);
    expect(records(data, 'inspections').length).toBeGreaterThanOrEqual(40);
    expect(records(data, 'stock').length).toBeGreaterThanOrEqual(30);
    expect(records(data, 'periodic').length).toBeGreaterThanOrEqual(36);
    // Two weeks of history, a shift at every site today and the next three days.
    const shifts = records(data, 'shifts');
    expect(shifts.filter((s) => str(s, 'date') === TODAY)).toHaveLength(16);
    expect(shifts.filter((s) => str(s, 'date') < TODAY).every((s) => s.status === 'completed' && str(s, 'date') >= addDays(TODAY, -14))).toBe(true);
    expect(shifts.filter((s) => str(s, 'date') > TODAY).every((s) => str(s, 'date') <= addDays(TODAY, 3))).toBe(true);
    expect(shifts.map((s) => s.status)).toEqual(expect.arrayContaining(['draft', 'scheduled', 'clockedin', 'short', 'completed']));
    // Every rostered reference is a real staff member.
    for (const s of shifts) for (const ref of shiftCleaners(s)) expect(staffByRef(data, ref)).toBeTruthy();
  });

  it('keeps the stored demo small', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
    expect(bytes).toBeLessThan(400_000);
  });

  it('uses only fictional contact details and never hard-codes the business name in records', () => {
    for (const s of records(data, 'staff')) expect(str(s, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
    for (const c of [...records(data, 'clients'), ...records(data, 'quotes')]) {
      expect(str(c, 'email')).toMatch(/@example\.com$/);
      expect(str(c, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
    }
    expect(JSON.stringify(data.collections)).not.toContain('BrightPath');
  });

  it('gives the dashboard something to show on a fresh seed', () => {
    const today = dayStaffing(data, TODAY);
    expect(today.contracted).toBe(50);
    expect(today.short.map((s) => str(findRecord(data, 'sites', str(s, 'site')), 'name'))).toEqual(expect.arrayContaining(['Umthombo Day Clinic', 'Acacia Junction Mall']));
    expect(today.late).toBeGreaterThan(0);
    expect(lowStock(data).length).toBeGreaterThanOrEqual(4);
    expect(sitesOverBudget(data, '2026-11').map((s) => str(s, 'name'))).toEqual(['Protea Ridge Primary School', 'Baobab Square Shopping Centre']);
    expect(records(data, 'sites').filter((s) => siteBelowSla(data, s)).map((s) => str(s, 'name'))).toEqual(['Highveld College — Main Campus', 'Acacia Junction Mall', 'Blue Crane Attorneys']);
    expect(config.collections.find((c) => c.key === 'sites')!.flags!(site('Sedibeng'), data, TODAY).map((f) => f.label)).toContain('Contract ends in 38 days');
  });
});

describe('rostering and attendance rules', () => {
  // shifts_1 is the guide's shift: Umthombo Day Clinic today, one cleaner absent, relief needed.
  const clinicShift = () => get('shifts', 'shifts_1');
  const relief = (first: string) => move('shifts', withValues(clinicShift(), { reliefPick: staffNamed(first).id }), 'relief', 'u_sup');

  it('starts from a short-staffed clinic shift', () => {
    expect(clinicShift().status).toBe('short');
    expect(str(site('Umthombo'), 'siteType')).toBe('clinic');
    expect(staffing(clinicShift(), data)).toMatchObject({ contracted: 3, rostered: 2, present: 2, absent: 1, unfilled: 1, pct: 67 });
    expect(reason(move('shifts', clinicShift(), 'relief', 'u_sup'))).toMatch(/Choose a relief cleaner/);
  });

  it('will not assign a cleaner who is already on an overlapping shift', () => {
    expect(reason(relief('Hlengiwe'))).toMatch(/already on an overlapping shift at Highveld College — Main Campus/);
    // The same cleaner is fine once the other shift no longer overlaps.
    const moved = patched('shifts', (s) => (str(s, 'date') === TODAY && str(s, 'site') === site('Highveld College — Main').id ? withValues(s, { start: '15:00', end: '19:00' }) : s));
    expect(move('shifts', withValues(clinicShift(), { reliefPick: staffNamed('Hlengiwe').id }), 'relief', 'u_sup', undefined, moved)).toMatchObject({ ok: true });
  });

  it('will not assign a cleaner without the site induction', () => {
    expect(reason(relief('Innocent'))).toMatch(/has not completed the site induction for Umthombo Day Clinic/);
  });

  it('requires in-date infection-control training at clinic sites only', () => {
    expect(reason(relief('Joyce'))).toMatch(/infection-control training expired/);
    const joyce = staffNamed('Joyce');
    const officeShift = withValues(clinicShift(), { site: site('Meridian Office Park — Block A').id, start: '21:00', end: '23:00' });
    expect(assignmentProblem(withValues(joyce, { inductions: site('Meridian Office Park — Block A').ref }), officeShift, data)).toBeNull();
    // Tomorrow's dialysis roster includes her, so it cannot be confirmed.
    const draft = records(data, 'shifts').find((s) => s.status === 'draft' && str(s, 'date') === addDays(TODAY, 1))!;
    expect(rosterProblems(draft, data).join(' ')).toMatch(/Joyce .* infection-control/);
    expect(reason(move('shifts', draft, 'scheduled', 'u_ops'))).toMatch(/infection-control/);
  });

  it('accepts an eligible relief cleaner and adds them to the roster', () => {
    const shift = withValues(clinicShift(), { reliefPick: staffNamed('Gift').id });
    const res = move('shifts', shift, 'relief', 'u_sup');
    expect(res).toMatchObject({ ok: true });
    const api = fakeApi();
    findTransition(wf('shifts'), 'short', 'relief')!.after!({ record: shift, data, api, today: TODAY, user: user('u_sup') });
    expect(api.update).toHaveBeenCalledWith('shifts', 'shifts_1', expect.objectContaining({ cleaners: `${str(shift, 'cleaners')},${staffNamed('Gift').ref}`, reliefPick: '' }), expect.stringContaining('Gift'));
    // Cleaners on leave cannot be rostered at all.
    expect(assignmentProblem(records(data, 'staff').find((s) => s.status === 'leave'), clinicShift(), data)).toMatch(/on leave/);
  });

  it('needs a note and a named cleaner to log an absence', () => {
    const scheduled = records(data, 'shifts').find((s) => s.status === 'scheduled' && str(s, 'date') === TODAY)!;
    const first = shiftCleaners(scheduled)[0];
    expect(reason(move('shifts', withValues(scheduled, { absentees: first }), 'short', 'u_sup', ' '))).toMatch(/note is required/);
    expect(reason(move('shifts', scheduled, 'short', 'u_sup', 'No show'))).toMatch(/Mark who is absent/);
    expect(move('shifts', withValues(scheduled, { absentees: first }), 'short', 'u_sup', 'No show, phone off')).toMatchObject({ ok: true });
  });

  it('starts a shift only on its day, once somebody has clocked in', () => {
    const scheduled = records(data, 'shifts').find((s) => s.status === 'scheduled' && str(s, 'date') === TODAY)!;
    expect(reason(move('shifts', scheduled, 'clockedin', 'u_sup'))).toMatch(/Clock in at least one cleaner/);
    expect(move('shifts', withValues(scheduled, { clockIns: `${shiftCleaners(scheduled)[0]}=07:02` }), 'clockedin', 'u_sup')).toMatchObject({ ok: true });
    const tomorrow = records(data, 'shifts').find((s) => s.status === 'scheduled' && str(s, 'date') > TODAY)!;
    expect(reason(move('shifts', withValues(tomorrow, { clockIns: `${shiftCleaners(tomorrow)[0]}=07:02` }), 'clockedin', 'u_sup'))).toMatch(/only be started on its own day/);
    expect(reason(move('shifts', scheduled, 'clockedin', 'u_stores'))).toMatch(/simulated role/);
  });

  it('completes a shift only with the daily checklist ticked, or a note saying what was missed', () => {
    const shift = records(data, 'shifts').find((s) => s.status === 'clockedin' && checklistState(s, data).missing.length > 0)!;
    expect(checklistState(shift, data).tasks).toHaveLength(6);
    expect(reason(move('shifts', shift, 'completed', 'u_sup'))).toMatch(/daily tasks? not ticked .* add a note/);
    expect(move('shifts', shift, 'completed', 'u_sup', 'Boardrooms in use until 15:00 — client aware')).toMatchObject({ ok: true });
    expect(move('shifts', withValues(shift, { missedNote: 'Kitchen closed for pest control' }), 'completed', 'u_sup')).toMatchObject({ ok: true });
    expect(move('shifts', withValues(shift, { checklist: '1,2,3,4,5,6' }), 'completed', 'u_sup')).toMatchObject({ ok: true });
    expect(reason(move('shifts', withValues(shift, { checklist: '1,2,3,4,5,6', date: addDays(TODAY, 1) }), 'completed', 'u_sup'))).toMatch(/future shift/);
  });

  it('computes staffing and attendance percentages', () => {
    expect(staffingPct(3, 4)).toBe(75);
    expect(staffingPct(0, 0)).toBe(0);
    const late = records(data, 'shifts').find((s) => str(s, 'date') === TODAY && str(s, 'site') === site('Meridian Office Park — Block A').id)!;
    expect(staffing(late, data)).toMatchObject({ contracted: 4, present: 4, pct: 100 });
    expect(staffing(late, data).late).toHaveLength(1);
    const acacia = records(data, 'shifts').find((s) => str(s, 'date') === TODAY && str(s, 'site') === site('Acacia').id)!;
    expect(staffing(acacia, data)).toMatchObject({ contracted: 5, rostered: 4, unfilled: 1, pct: 80 });
    const history = attendance(records(data, 'shifts').filter((s) => str(s, 'date') < TODAY), data);
    expect(history.shifts).toBeGreaterThan(150);
    expect(history.pct).toBeGreaterThan(88);
    expect(history.pct).toBeLessThan(100);
    expect(history.pct).toBe(staffingPct(history.present, history.contracted));
  });
});

describe('quality rules', () => {
  // inspections_1 is the guide's draft: ablutions scored 2, no corrective action yet.
  const draft = () => get('inspections', 'inspections_1');

  it('scores an inspection as a percentage of the areas scored', () => {
    expect(inspectionScore(draft())).toBe(63); // 19 of 30
    expect(inspectionScore(withValues(draft(), { s_reception: 5, s_ablutions: 5, s_kitchens: 5, s_floors: 5, s_bins: 5, s_glass: 5 }))).toBe(100);
    expect(inspectionScore(withValues(draft(), { s_reception: 4, s_ablutions: '', s_kitchens: '', s_floors: '', s_bins: '', s_glass: '' }))).toBe(80);
    expect(inspectionScore(withValues(draft(), { s_reception: '', s_ablutions: '', s_kitchens: '', s_floors: '', s_bins: '', s_glass: '' }))).toBeNull();
  });

  it('needs a corrective action with a due date when an area scores 2 or below', () => {
    expect(draft().status).toBe('draft');
    expect(reason(move('inspections', draft(), 'submitted', 'u_sup'))).toMatch(/Ablutions \(2\) scored 2 or below — record a corrective action/);
    expect(reason(move('inspections', withValues(draft(), { correctiveAction: 'Retrain on restocking' }), 'submitted', 'u_sup'))).toMatch(/needs a due date/);
    expect(move('inspections', withValues(draft(), { correctiveAction: 'Retrain on restocking', correctiveDue: addDays(TODAY, 5) }), 'submitted', 'u_sup')).toMatchObject({ ok: true });
    expect(reason(move('inspections', withValues(draft(), { s_ablutions: 3, s_glass: '' }), 'submitted', 'u_sup'))).toMatch(/Score every area/);
    expect(reason(move('inspections', withValues(draft(), { s_ablutions: 3 }), 'submitted', 'u_liaison'))).toMatch(/simulated role/);
  });

  it('schedules a re-inspection within 7 days when a submitted inspection is below SLA', () => {
    const after = findTransition(wf('inspections'), 'draft', 'submitted')!.after!;
    expect(inspectionFailed(draft(), data)).toBe(true);
    const api = fakeApi();
    after({ record: draft(), data, api, today: TODAY, user: user('u_sup') });
    expect(api.create).toHaveBeenCalledWith('inspections', expect.objectContaining({ site: str(draft(), 'site'), kind: 'reinspection', date: '2026-11-18', followUpOf: 'inspections_1' }), 'draft', expect.any(String));
    const good = withValues(draft(), { s_reception: 5, s_ablutions: 4, s_kitchens: 5, s_floors: 4, s_bins: 4, s_glass: 5 });
    expect(inspectionFailed(good, data)).toBe(false);
    const quiet = fakeApi();
    after({ record: good, data, api: quiet, today: TODAY, user: user('u_sup') });
    expect(quiet.create).not.toHaveBeenCalled();
  });

  it('logs client sign-off only with a note, by a user allowed to', () => {
    const submitted = records(data, 'inspections').find((i) => i.status === 'submitted')!;
    expect(reason(move('inspections', submitted, 'signedoff', 'u_liaison'))).toMatch(/note is required/);
    expect(move('inspections', submitted, 'signedoff', 'u_liaison', 'Signed by the facilities manager on site')).toMatchObject({ ok: true });
    expect(reason(move('inspections', submitted, 'signedoff', 'u_sup', 'Signed'))).toMatch(/simulated role/);
  });

  it('tracks the complaint response clock and requires a resolution', () => {
    expect(hoursBetween('2026-11-10 15:10', '2026-11-11 12:00')).toBe(20.8);
    const urgent = records(data, 'complaints').find((c) => c.status === 'logged' && str(c, 'priority') === 'urgent')!;
    expect(complaintClock(urgent, `${TODAY} 12:00`)).toMatchObject({ target: 2, breached: true });
    const fresh = records(data, 'complaints').find((c) => c.status === 'logged' && str(c, 'date') === TODAY)!;
    expect(complaintClock(fresh, `${TODAY} 12:00`)).toMatchObject({ target: 24, breached: false });
    expect(records(data, 'complaints').filter((c) => complaintClock(c).late)).not.toHaveLength(0);

    const open = records(data, 'complaints').find((c) => c.status === 'inprogress')!;
    expect(reason(move('complaints', open, 'resolved', 'u_liaison'))).toMatch(/what was done/);
    expect(move('complaints', withValues(open, { resolution: 'Floors re-mopped and method corrected' }), 'resolved', 'u_liaison')).toMatchObject({ ok: true });
    const resolved = records(data, 'complaints').find((c) => c.status === 'resolved')!;
    expect(reason(move('complaints', resolved, 'inprogress', 'u_liaison'))).toMatch(/note is required/);
    expect(move('complaints', resolved, 'inprogress', 'u_liaison', 'Client says the dispensers were empty again')).toMatchObject({ ok: true });
    const acknowledged = records(data, 'complaints').find((c) => c.status === 'acknowledged')!;
    expect(reason(move('complaints', acknowledged, 'inprogress', 'u_liaison'))).toMatch(/Assign a supervisor/);
  });

  it('moves a periodic task on to its next due date when it is done', () => {
    const task = records(data, 'periodic').find((p) => p.status === 'inprogress' && str(p, 'frequency') === 'monthly') ?? withValues(records(data, 'periodic')[0], { frequency: 'monthly' }, 'inprogress');
    const api = fakeApi();
    findTransition(wf('periodic'), 'inprogress', 'done')!.after!({ record: withValues(task, { frequency: 'monthly' }), data, api, today: TODAY, user: user('u_sup') });
    expect(api.update).toHaveBeenCalledWith('periodic', task.id, { lastDone: TODAY, nextDue: '2026-12-11' }, expect.any(String));
    // Work at height needs a team leader with in-date training.
    const windows = records(data, 'periodic').find((p) => str(p, 'task') === 'windows' && str(p, 'site') === site('Meridian Office Park — Block A').id)!;
    expect(reason(move('periodic', windows, 'inprogress', 'u_sup'))).toMatch(/working-at-heights/);
    expect(reason(move('periodic', withValues(windows, { assignedTo: '' }), 'inprogress', 'u_sup'))).toMatch(/Assign a team leader/);
    expect(move('periodic', withValues(windows, { atHeight: false }), 'inprogress', 'u_sup')).toMatchObject({ ok: true });
  });
});

describe('stores rules', () => {
  // The guide's three open requests: issues_1 hazardous to an untrained site, issues_2 more than is in store, issues_3 fine.
  it('cannot issue more than is in store', () => {
    const request = get('issues', 'issues_2');
    expect(num(request, 'qty')).toBeGreaterThan(num(stockNamed('Toilet paper 2-ply'), 'qty'));
    expect(reason(move('issues', request, 'issued', 'u_stores'))).toMatch(/Only 18 × Toilet paper 2-ply in store — 40 cannot be issued/);
    expect(move('issues', withValues(request, { qty: 18 }), 'issued', 'u_stores')).toMatchObject({ ok: true });
    expect(reason(move('issues', withValues(request, { qty: 5 }), 'issued', 'u_sup'))).toMatch(/simulated role/);
  });

  it('deducts stock when an issue goes out', () => {
    const request = get('issues', 'issues_3');
    const soap = stockNamed('Hand soap');
    expect(move('issues', request, 'issued', 'u_stores')).toMatchObject({ ok: true });
    const api = fakeApi();
    findTransition(wf('issues'), 'requested', 'issued')!.after!({ record: request, data, api, today: TODAY, user: user('u_stores') });
    expect(api.update).toHaveBeenCalledWith('stock', soap.id, { qty: num(soap, 'qty') - 4 }, expect.stringContaining('issued to Umthombo Day Clinic'));
  });

  it('issues hazardous chemicals only to sites with a trained cleaner and with an SDS on file', () => {
    const request = get('issues', 'issues_1');
    const bleach = stockNamed('Bleach');
    expect(bleach.values.hazardous).toBe(true);
    expect(chemTrainedAt(data, site('Sedibeng'), TODAY)).toHaveLength(0);
    expect(reason(move('issues', request, 'issued', 'u_stores'))).toMatch(/Bleach is hazardous: no cleaner based at Sedibeng Logistics Offices holds in-date chemical-handling training/);
    // The same chemical can go to a site whose team leader is trained …
    expect(chemTrainedAt(data, site('Umthombo'), TODAY).length).toBeGreaterThan(0);
    expect(move('issues', withValues(request, { site: site('Umthombo').id }), 'issued', 'u_stores')).toMatchObject({ ok: true });
    // … and a non-hazardous item can go to the untrained site.
    expect(move('issues', withValues(request, { item: stockNamed('Hand soap').id }), 'issued', 'u_stores')).toMatchObject({ ok: true });
    // No SDS on file blocks even a trained site.
    const stripper = stockNamed('Floor stripper');
    expect(stripper.values.sdsOnFile).toBe(false);
    expect(reason(move('issues', withValues(request, { site: site('Umthombo').id, item: stripper.id, qty: 1 }), 'issued', 'u_stores'))).toMatch(/no safety data sheet \(SDS\) on file/);
  });

  it('measures consumables issued against each site budget', () => {
    const baobab = site('Baobab');
    const used = consumablesUsed(data, baobab.id, '2026-11');
    expect(used).toBe(9730);
    expect(budgetState(data, baobab, '2026-11')).toMatchObject({ used: 9730, budget: 8700, pct: 112, over: true });
    expect(budgetState(data, site('Umthombo'), '2026-11')).toMatchObject({ over: false, pct: 72 });
    // Requests that are not yet issued do not count.
    expect(consumablesUsed(data, site('Sedibeng').id, '2026-11')).toBe(budgetState(data, site('Sedibeng'), '2026-11').used);
    expect(budgetState(data, withValues(baobab, { consumablesBudget: 0 }), '2026-11')).toMatchObject({ over: false, pct: 0 });
  });

  it('receives a purchase order into stock and blocks equipment with an overdue electrical test', () => {
    const order = records(data, 'purchaseOrders').find((p) => p.status === 'ordered')!;
    const item = get('stock', str(order, 'item'));
    const api = fakeApi();
    findTransition(wf('purchaseOrders'), 'ordered', 'received')!.after!({ record: order, data, api, today: TODAY, user: user('u_stores') });
    expect(api.update).toHaveBeenCalledWith('stock', item.id, { qty: num(item, 'qty') + num(order, 'qty') }, expect.any(String));

    const overdue = records(data, 'equipment').find((e) => e.status === 'available' && str(e, 'site') && str(e, 'electricalTestDue') && str(e, 'electricalTestDue') < TODAY)!;
    expect(reason(move('equipment', overdue, 'onsite', 'u_stores'))).toMatch(/overdue test cannot be allocated/);
    expect(move('equipment', withValues(overdue, { electricalTestDue: addDays(TODAY, 200) }), 'onsite', 'u_stores')).toMatchObject({ ok: true });
    expect(reason(move('equipment', withValues(overdue, { site: '', electricalTestDue: addDays(TODAY, 200) }), 'onsite', 'u_stores'))).toMatch(/Choose the site/);
    expect(records(data, 'equipment').filter((e) => e.status === 'onsite').every((e) => !str(e, 'electricalTestDue') || str(e, 'electricalTestDue') >= TODAY)).toBe(true);
  });
});

describe('commercial rules', () => {
  // quotes_1 is the guide's draft: R19,270 excl. VAT, above the R15,000 approval threshold.
  it('needs “Approve quotes” to send a quote above the threshold or below the minimum margin', () => {
    const big = get('quotes', 'quotes_1');
    expect(quoteFigures(big)).toMatchObject({ net: 19_270_00, marginPct: 36.2 });
    expect(quoteApprovalReasons(big)).toHaveLength(1);
    expect(reason(move('quotes', big, 'sent', 'u_liaison'))).toMatch(/Approval needed: the value of R19,270\.00 excl\. VAT is above the R15,000\.00 threshold/);
    expect(move('quotes', big, 'sent', 'u_ops')).toMatchObject({ ok: true });

    const thin = get('quotes', 'quotes_2');
    expect(quoteFigures(thin).marginPct).toBeLessThan(25);
    expect(reason(move('quotes', thin, 'sent', 'u_liaison'))).toMatch(/margin of 18\.8% is below the 25% minimum/);
    expect(move('quotes', thin, 'sent', 'u_md')).toMatchObject({ ok: true });

    const fine = get('quotes', 'quotes_3');
    expect(quoteApprovalReasons(fine)).toEqual([]);
    expect(move('quotes', fine, 'sent', 'u_liaison')).toMatchObject({ ok: true });
    expect(reason(move('quotes', withValues(fine, { costEstimate: 0 }), 'sent', 'u_liaison'))).toMatch(/estimated cost/);
  });

  it('schedules an accepted job only with a date and a team size', () => {
    const accepted = records(data, 'quotes').find((q) => q.status === 'accepted')!;
    expect(reason(move('quotes', accepted, 'scheduled', 'u_liaison'))).toMatch(/Set the job date/);
    expect(reason(move('quotes', withValues(accepted, { jobDate: addDays(TODAY, 6) }), 'scheduled', 'u_liaison'))).toMatch(/team size/);
    expect(move('quotes', withValues(accepted, { jobDate: addDays(TODAY, 6), teamSize: 5 }), 'scheduled', 'u_liaison')).toMatchObject({ ok: true });
  });

  it('raises a draft invoice from a completed job', () => {
    const done = records(data, 'quotes').find((q) => q.status === 'completed')!;
    expect(reason(move('quotes', done, 'invoiced', 'u_liaison'))).toMatch(/simulated role/);
    const api = fakeApi();
    findTransition(wf('quotes'), 'completed', 'invoiced')!.after!({ record: done, data, api, today: TODAY, user: user('u_acc') });
    expect(api.create).toHaveBeenCalledWith('invoices', expect.objectContaining({ kind: 'onceoff', billTo: str(done, 'clientName'), quote: done.id, dueDate: '2026-11-25' }), 'draft', expect.any(String));
    expect(api.update).toHaveBeenCalledWith('quotes', done.id, { invoice: 'invoices_new' });
  });

  it('credits contracted cleaners missing from completed shifts on the monthly invoice', () => {
    const acacia = site('Acacia');
    const credit = unstaffedCredit(data, acacia, '2026-11');
    expect(credit.rate).toBe(650); // R71,500 ÷ (5 cleaners × 22 days)
    expect(credit.cleanerShifts).toBeGreaterThan(0);
    expect(credit.amount).toBe(credit.cleanerShifts * 650);

    expect(sitesToInvoice(data, '2026-11')).toHaveLength(16);
    expect(sitesToInvoice(data, '2026-10')).toHaveLength(0);
    const values = contractInvoiceValues(data, acacia, '2026-11', TODAY);
    expect(values).toMatchObject({ kind: 'contract', site: acacia.id, period: '2026-11', billTo: 'Acacia Junction Mall', dueDate: '2026-12-11', credit: credit.amount });
    const figures = invoiceFigures({ ...acacia, values });
    expect(figures.gross).toBeGreaterThanOrEqual(71_500_00);
    expect(figures.net).toBe(figures.gross - credit.amount * 100);
    expect(figures.total).toBe(figures.net + Math.round(figures.net * 0.15));
  });

  it('issues, flags and settles invoices', () => {
    const flags = config.collections.find((c) => c.key === 'invoices')!.flags!;
    const overdue = records(data, 'invoices').filter((i) => flags(i, data, TODAY).some((f) => /Overdue/.test(f.label)));
    expect(overdue.length).toBeGreaterThanOrEqual(2);
    expect(overdue.every((i) => i.status === 'issued')).toBe(true);
    const issued = overdue[0];
    expect(reason(move('invoices', issued, 'paid', 'u_liaison'))).toMatch(/simulated role/);
    expect(move('invoices', issued, 'paid', 'u_acc')).toMatchObject({ ok: true });
    expect(reason(move('invoices', withValues(issued, { lines: [] }, 'draft'), 'issued', 'u_acc'))).toMatch(/at least one invoice line/);
    expect(reason(move('invoices', issued, 'void', 'u_acc'))).toMatch(/note is required/);
  });

  it('hides HR notes from roles without the permission', () => {
    const field = config.collections.find((c) => c.key === 'staff')!.fields.find((f) => f.key === 'hrNotes')!;
    expect(field.permission).toBe('hr.view');
    expect(user('u_ops').permissions).toContain('hr.view');
    expect(user('u_sup').permissions).not.toContain('hr.view');
    const flags = config.collections.find((c) => c.key === 'staff')!.flags!;
    expect(flags(staffNamed('Joyce'), data, TODAY).map((f) => f.label)).toContain('Infection control expired');
  });
});

// The walkthrough on the dashboard must work on a fresh seed, whatever the real date is.
// These run through the real store (transition + side effects) with the real clock.
describe('guide steps on a fresh seed, through the store', () => {
  const store = () => useStore.getState();
  const live = () => store().data.cleaning!;
  const rec = (collection: string, id: string) => findRecord(live(), collection, id)!;
  const named = (first: string) => records(live(), 'staff').find((s) => str(s, 'firstName') === first)!;
  const failure = (res: ReturnType<ReturnType<typeof store>['transition']>) => (res.ok ? '' : res.reason);

  beforeAll(() => {
    setTodayForTests(null);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store().reset(config);
  });
  afterAll(() => { vi.useRealTimers(); setTodayForTests(TODAY); });

  it('1 · takes attendance on today’s board', () => {
    store().signInAs('cleaning', 'u_sup');
    const shift = records(live(), 'shifts').find((s) => s.status === 'scheduled' && str(s, 'date') === todayIso())!;
    const first = shiftCleaners(shift)[0];
    store().updateRecord(config, 'shifts', shift.id, { clockIns: `${first}=07:01` }, 'Clocked in');
    expect(store().transition(config, 'shifts', shift.id, 'clockedin')).toMatchObject({ ok: true });
    expect(staffing(rec('shifts', shift.id), live()).present).toBe(1);
  });

  it('2 · covers the absence at the clinic with the one eligible relief cleaner', () => {
    const attempt = (first: string) => {
      store().updateRecord(config, 'shifts', 'shifts_1', { reliefPick: named(first).id });
      return store().transition(config, 'shifts', 'shifts_1', 'relief');
    };
    expect(rec('shifts', 'shifts_1').status).toBe('short');
    expect(failure(attempt('Hlengiwe'))).toMatch(/overlapping shift/);
    expect(failure(attempt('Innocent'))).toMatch(/site induction/);
    expect(failure(attempt('Joyce'))).toMatch(/infection-control/);
    expect(attempt('Gift')).toMatchObject({ ok: true });
    const shift = rec('shifts', 'shifts_1');
    expect(shift.status).toBe('relief');
    expect(shiftCleaners(shift)).toContain(named('Gift').ref);
    expect(str(shift, 'reliefPick')).toBe('');
    expect(staffing(shift, live())).toMatchObject({ rostered: 3, unfilled: 0 });
  });

  it('3 · submits the failed inspection once it has a corrective action, which schedules a re-inspection', () => {
    const before = records(live(), 'inspections').length;
    expect(failure(store().transition(config, 'inspections', 'inspections_1', 'submitted'))).toMatch(/corrective action/);
    store().updateRecord(config, 'inspections', 'inspections_1', { correctiveAction: 'Restock rota at 10:00 and 13:00; supervisor to check daily', correctiveDue: addDays(todayIso(), 3) });
    expect(store().transition(config, 'inspections', 'inspections_1', 'submitted')).toMatchObject({ ok: true });
    const created = records(live(), 'inspections').filter((i) => str(i, 'followUpOf') === 'inspections_1');
    expect(records(live(), 'inspections')).toHaveLength(before + 1);
    expect(created[0]).toMatchObject({ status: 'draft', values: { kind: 'reinspection', date: addDays(todayIso(), 7) } });
  });

  it('4 · issues stock: two requests are refused, the third deducts the store', () => {
    store().signInAs('cleaning', 'u_stores');
    const soap = records(live(), 'stock').find((s) => str(s, 'name') === 'Hand soap')!;
    const before = num(soap, 'qty');
    expect(records(live(), 'issues').filter((i) => i.status === 'requested').map((i) => i.id).sort()).toEqual(['issues_1', 'issues_2', 'issues_3']);
    expect(failure(store().transition(config, 'issues', 'issues_1', 'issued'))).toMatch(/hazardous/);
    expect(failure(store().transition(config, 'issues', 'issues_2', 'issued'))).toMatch(/in store/);
    expect(store().transition(config, 'issues', 'issues_3', 'issued')).toMatchObject({ ok: true });
    expect(num(rec('stock', soap.id), 'qty')).toBe(before - 4);
  });

  it('5 · sends the large quote only as a user who may approve quotes', () => {
    store().signInAs('cleaning', 'u_liaison');
    expect(failure(store().transition(config, 'quotes', 'quotes_1', 'sent'))).toMatch(/Approval needed/);
    store().signInAs('cleaning', 'u_ops');
    expect(store().transition(config, 'quotes', 'quotes_1', 'sent')).toMatchObject({ ok: true });
    expect(rec('quotes', 'quotes_1').values).toMatchObject({ sentOn: todayIso(), approvedBy: 'Deon Fortuin' });
  });

  it('6 · drafts one contract invoice per site for the month', () => {
    store().signInAs('cleaning', 'u_acc');
    const month = todayIso().slice(0, 7);
    const pending = sitesToInvoice(live(), month);
    expect(pending).toHaveLength(16);
    for (const s of pending) store().createRecord(config, 'invoices', contractInvoiceValues(live(), s, month, todayIso()), 'draft');
    expect(sitesToInvoice(live(), month)).toHaveLength(0);
    const drafts = records(live(), 'invoices').filter((i) => i.status === 'draft');
    expect(drafts).toHaveLength(16);
    expect(drafts.every((i) => invoiceFigures(i).total > 0)).toBe(true);
    expect(store().transition(config, 'invoices', drafts[0].id, 'issued')).toMatchObject({ ok: true });
  });
});
