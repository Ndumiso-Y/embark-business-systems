import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config, { addMonths, checkInProblem, invoiceBalance, labourLine, nextService, serviceDue, setTodayForTests, splitTotals } from '../src/industries/automotive';
import { applyTransition, findRecord, findTransition, linesTotals, num, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import type { DemoRecord, EffectApi, IndustryData, Values } from '../src/core/types';

const TODAY = '2026-11-11';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;
const withValues = (r: DemoRecord, v: Values): DemoRecord => ({ ...r, values: { ...r.values, ...v } });
/** A copy of the data with one record replaced. */
const swap = (collection: string, r: DemoRecord): IndustryData => ({ ...data, collections: { ...data.collections, [collection]: records(data, collection).map((x) => (x.id === r.id ? r : x)) } });

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('automotive configuration', () => {
  it('is internally consistent', () => {
    expect(validateConfig(config)).toEqual([]);
  });
  it('seeds a deterministic workshop with history and a full board today', () => {
    const again = buildIndustryData(config, TODAY);
    expect(records(data, 'customers').length).toBe(20);
    expect(records(data, 'vehicles').length).toBe(24);
    expect(records(data, 'parts').length).toBe(30);
    expect(records(data, 'jobs').filter((j) => j.status === 'collected').length).toBeGreaterThan(40);
    for (const s of ['booked', 'checkedin', 'diagnosing', 'approval', 'inprogress', 'qc', 'ready']) expect(records(data, 'jobs').some((j) => j.status === s)).toBe(true);
    expect(records(data, 'jobs').filter((j) => str(j, 'workDate') === TODAY).length).toBeGreaterThanOrEqual(10);
    expect(records(data, 'jobs').some((j) => str(j, 'jobType') === 'comeback')).toBe(true);
    expect(records(data, 'invoices').some((i) => i.status === 'issued' && str(i, 'issuedOn') < '2026-10-11')).toBe(true);
    expect(JSON.stringify(again.collections)).toBe(JSON.stringify(data.collections));
  });
  it('uses only fictional contact details, plates and VINs', () => {
    for (const c of records(data, 'customers')) {
      expect(str(c, 'email')).toMatch(/@example\.com$/);
      expect(str(c, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
    }
    for (const v of records(data, 'vehicles')) {
      expect(str(v, 'reg')).toMatch(/^DEMO \d{3} [A-Z]{2}$/);
      expect(str(v, 'vin')).toMatch(/^DEMO.{13}$/);
    }
  });
});

describe('workshop rules', () => {
  it('blocks work without a customer-approved estimate', () => {
    const job = records(data, 'jobs').find((j) => j.status === 'approval' && findRecord(data, 'estimates', str(j, 'estimate'))?.status === 'sent')!;
    const blocked = applyTransition(wf('jobs'), job, 'inprogress', user('u_tech'), data, undefined, 'Technician');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toMatch(/approv/);
    const est = findRecord(data, 'estimates', str(job, 'estimate'))!;
    const approvedData = swap('estimates', { ...est, status: 'approved' });
    expect(applyTransition(wf('jobs'), job, 'inprogress', user('u_tech'), approvedData, undefined, 'Technician')).toMatchObject({ ok: true });
    const noEstimate = withValues(job, { estimate: '' });
    expect(applyTransition(wf('jobs'), noEstimate, 'inprogress', user('u_tech'), data, undefined, 'Technician')).toMatchObject({ ok: false });
  });

  it('will not check a vehicle in with an odometer below its last reading', () => {
    const job = records(data, 'jobs').find((j) => j.status === 'booked' && str(j, 'workDate') === TODAY)!;
    const last = num(findRecord(data, 'vehicles', str(job, 'vehicle')), 'odometer');
    expect(checkInProblem(job, data)).toMatch(/odometer/i);
    const low = withValues(job, { odometerIn: last - 500 });
    const res = applyTransition(wf('jobs'), low, 'checkedin', user('u_adv'), data, undefined, 'Service advisor');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/below the last recorded reading/);
    expect(applyTransition(wf('jobs'), withValues(job, { odometerIn: last + 120 }), 'checkedin', user('u_adv'), data, undefined, 'Service advisor')).toMatchObject({ ok: true });
  });

  it('requires a note saying how the customer approved an estimate', () => {
    const est = records(data, 'estimates').find((e) => e.status === 'sent')!;
    expect(applyTransition(wf('estimates'), est, 'approved', user('u_adv'), data, '', 'Service advisor')).toEqual({ ok: false, reason: 'A note is required for this step.' });
    const vague = applyTransition(wf('estimates'), est, 'approved', user('u_adv'), data, 'ok', 'Service advisor');
    expect(vague.ok).toBe(false);
    if (!vague.ok) expect(vague.reason).toMatch(/phone, WhatsApp, in person or email/);
    expect(applyTransition(wf('estimates'), est, 'approved', user('u_adv'), data, 'Mr Ferreira approved via WhatsApp at 10:12', 'Service advisor')).toMatchObject({ ok: true });
    expect(applyTransition(wf('estimates'), est, 'approved', user('u_tech'), data, 'Approved by phone', 'Technician')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
  });

  it('only lets the foreman pass QC, and only with a complete checklist', () => {
    const job = records(data, 'jobs').find((j) => j.status === 'qc')!;
    expect(applyTransition(wf('jobs'), job, 'ready', user('u_tech'), data, undefined, 'Technician')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
    const incomplete = applyTransition(wf('jobs'), job, 'ready', user('u_fore'), data, undefined, 'Workshop foreman');
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) expect(incomplete.reason).toMatch(/QC checklist incomplete/);
    const ticked = withValues(job, { qcRoadTest: true, qcTorque: true, qcFluids: true, qcClean: true });
    expect(applyTransition(wf('jobs'), ticked, 'ready', user('u_fore'), data, undefined, 'Workshop foreman')).toMatchObject({ ok: true });
  });

  it('never accepts a payment larger than the outstanding balance', () => {
    const inv = records(data, 'invoices').find((i) => i.status === 'issued' && num(i, 'paid') === 0)!;
    const balance = invoiceBalance(inv) / 100;
    const over = applyTransition(wf('invoices'), withValues(inv, { paymentAmount: balance + 50 }), 'partpaid', user('u_clerk'), data, undefined, 'Clerk');
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toMatch(/exceeds the outstanding balance/);
    expect(applyTransition(wf('invoices'), withValues(inv, { paymentAmount: balance + 50 }), 'paid', user('u_clerk'), data, undefined, 'Clerk')).toMatchObject({ ok: false });
    expect(applyTransition(wf('invoices'), withValues(inv, { paymentAmount: 100 }), 'paid', user('u_clerk'), data, undefined, 'Clerk')).toMatchObject({ ok: false });
    expect(applyTransition(wf('invoices'), withValues(inv, { paymentAmount: 100 }), 'partpaid', user('u_clerk'), data, undefined, 'Clerk')).toMatchObject({ ok: true });
    expect(applyTransition(wf('invoices'), withValues(inv, { paymentAmount: balance }), 'paid', user('u_clerk'), data, undefined, 'Clerk')).toMatchObject({ ok: true });
  });

  it('does not release a private customer’s vehicle before the invoice is paid', () => {
    const ready = records(data, 'jobs').filter((j) => j.status === 'ready');
    const privateJob = ready.find((j) => str(findRecord(data, 'customers', str(findRecord(data, 'vehicles', str(j, 'vehicle')), 'customer')), 'kind') === 'private')!;
    const accountJob = ready.find((j) => j !== privateJob)!;
    expect(applyTransition(wf('jobs'), privateJob, 'collected', user('u_adv'), data, undefined, 'Service advisor')).toMatchObject({ ok: false });
    expect(applyTransition(wf('jobs'), accountJob, 'collected', user('u_adv'), data, undefined, 'Service advisor')).toMatchObject({ ok: true });
  });

  it('collecting a service job updates the odometer and sets the next service due', () => {
    const job = withValues(records(data, 'jobs').find((j) => j.status === 'ready')!, { jobType: 'service-minor', odometerIn: 150_000 });
    const updates: Array<{ collection: string; values: Values }> = [];
    const api: EffectApi = { create: () => job, update: (collection, _id, values) => { updates.push({ collection, values }); }, toast: () => undefined, transition: () => ({ ok: false, reason: 'not used' }) };
    findTransition(wf('jobs'), 'ready', 'collected')!.after!({ record: job, data, api, today: TODAY, user: user('u_adv') });
    const v = updates.find((u) => u.collection === 'vehicles')!.values;
    expect(v).toMatchObject({ odometer: 150_000, lastServiceDate: TODAY, nextServiceDate: '2027-11-11', nextServiceKm: 165_000 });
  });
});

describe('helpers', () => {
  it('prices labour as hours × rate and splits labour from parts', () => {
    const ls = [labourLine('a', 'Replace clutch', 2.5, 850), { id: 'b', code: 'TL-CK-1600', description: 'Clutch kit', qty: 1, unitPrice: 4300 }];
    const s = splitTotals(ls);
    expect(s.labour).toBe(212_500);
    expect(s.parts).toBe(430_000);
    expect(s.hours).toBe(2.5);
    expect(s.total).toBe(linesTotals(ls).total);
    expect(s.total).toBe(Math.round((2125 + 4300) * 1.15 * 100));
  });
  it('flags service due by date or by estimated kilometres', () => {
    const base = records(data, 'vehicles')[0];
    const v = (vals: Values) => withValues(base, vals);
    expect(serviceDue(v({ nextServiceDate: '2026-10-01', nextServiceKm: 999_999, odometer: 10_000, odometerOn: TODAY, kmPerMonth: 1000 }), TODAY)).toMatchObject({ state: 'overdue', by: 'date' });
    expect(serviceDue(v({ nextServiceDate: '2027-06-01', nextServiceKm: 20_000, odometer: 15_000, odometerOn: '2026-05-11', kmPerMonth: 1000 }), TODAY)).toMatchObject({ state: 'overdue', by: 'km' });
    expect(serviceDue(v({ nextServiceDate: '2027-06-01', nextServiceKm: 20_000, odometer: 19_500, odometerOn: TODAY, kmPerMonth: 1000 }), TODAY)).toMatchObject({ state: 'due-soon', by: 'km' });
    expect(serviceDue(v({ nextServiceDate: '2027-06-01', nextServiceKm: 40_000, odometer: 19_500, odometerOn: TODAY, kmPerMonth: 1000 }), TODAY)).toMatchObject({ state: 'ok' });
    expect(nextService('2026-01-31', 50_000)).toEqual({ nextServiceDate: '2027-01-31', nextServiceKm: 65_000 });
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
  });
});
