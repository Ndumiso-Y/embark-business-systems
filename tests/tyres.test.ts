import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config, {
  diameterDiffPct, dotAgeYears, dotDate, dotFromDate, fittingProblem, invoiceBalance, isOldDot, parseTyreSize, proRataCredit, sameSize, setTodayForTests, sizeKey,
  stockForSize, treadTone, toolHoursOut, toolNotReturned,
} from '../src/industries/tyres';
import { applyTransition, findRecord, findTransition, num, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import type { DemoRecord, EffectApi, IndustryData, Values } from '../src/core/types';

const TODAY = '2026-11-11';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;
const withValues = (r: DemoRecord, v: Values): DemoRecord => ({ ...r, values: { ...r.values, ...v } });
const swap = (d: IndustryData, collection: string, r: DemoRecord): IndustryData => ({ ...d, collections: { ...d.collections, [collection]: records(d, collection).map((x) => (x.id === r.id ? r : x)) } });
const reg = (j: DemoRecord) => str(findRecord(data, 'vehicles', str(j, 'vehicle')), 'reg');
const todayJob = (status: string, pred: (j: DemoRecord) => boolean = () => true) => records(data, 'jobs').find((j) => str(j, 'workDate') === TODAY && j.status === status && pred(j))!;
const tool = (asset: string) => records(data, 'tools').find((t) => str(t, 'assetNo') === asset)!;
const run = (k: string, r: DemoRecord, to: string, u: string, d = data, note?: string) => applyTransition(wf(k), r, to, user(u), d, note, 'Test');
const reason = (res: ReturnType<typeof run>) => (res.ok ? '' : res.reason);

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('tyres configuration', () => {
  it('is internally consistent', () => {
    expect(validateConfig(config)).toEqual([]);
  });

  it('keeps today’s jobs on fixed ids whatever the weekday, so the guide always opens the same records', () => {
    const shape = (today: string) => {
      const d = buildIndustryData(config, today);
      return records(d, 'jobs').filter((j) => j.id.startsWith('jobs_today_')).map((j) => `${j.id}:${j.status}:${str(j, 'vehicle')}:${str(j, 'technician')}:${str(j, 'bay')}`);
    };
    const base = shape(TODAY);
    expect(base.length).toBe(15);
    expect(base).toContain('jobs_today_5:torque:vehicles_5:sk:b1');
    expect(base).toContain('jobs_today_6:torque:vehicles_12:md:b4');
    expect(base).toContain('jobs_today_11:quoted:vehicles_21:jv:');
    expect(base).toContain('jobs_today_13:inspected:vehicles_2:sk:');
    expect(base).toContain('jobs_today_14:arrived:vehicles_15::');
    for (const day of ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2027-03-01']) expect(shape(day)).toEqual(base);
    for (const g of config.guide ?? []) {
      const [mod, id] = g.to.split('/');
      if (id) expect(findRecord(data, mod, id), g.title).toBeTruthy();
    }
  });

  it('seeds a deterministic fitment centre with history and a full bay queue today', () => {
    const again = buildIndustryData(config, TODAY);
    expect(JSON.stringify(again.collections)).toBe(JSON.stringify(data.collections));
    expect(records(data, 'customers').length).toBe(25);
    expect(records(data, 'customers').filter((c) => str(c, 'kind') === 'fleet').length).toBe(6);
    expect(records(data, 'fleets').length).toBe(6);
    expect(records(data, 'vehicles').length).toBe(30);
    expect(records(data, 'stock').length).toBe(45);
    expect(records(data, 'tools').length).toBe(22);
    expect(records(data, 'claims').length).toBe(10);
    const today = records(data, 'jobs').filter((j) => str(j, 'workDate') === TODAY);
    expect(today.length).toBeGreaterThanOrEqual(12);
    for (const s of ['arrived', 'inspected', 'quoted', 'approved', 'fitting', 'balancing', 'alignment', 'torque', 'ready', 'collected']) expect(today.some((j) => j.status === s)).toBe(true);
    expect(records(data, 'jobs').filter((j) => j.status === 'collected' && str(j, 'workDate') < '2026-09-01').length).toBeGreaterThan(20);
    expect(records(data, 'invoices').length).toBeGreaterThan(100);
    // One torque wrench out of calibration, one checked out overnight.
    expect(str(tool('TR-TW-03'), 'calibrationDue') < TODAY).toBe(true);
    expect(str(tool('TR-TW-02'), 'checkedOutOn')).toBe('2026-11-10');
    expect(toolHoursOut(tool('TR-TW-02'), new Date('2026-11-11T08:00:00'))).toBeGreaterThan(10);
  });

  it('uses only fictional contact details and plates', () => {
    for (const c of records(data, 'customers')) {
      expect(str(c, 'email')).toMatch(/@example\.com$/);
      expect(str(c, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
    }
    for (const v of records(data, 'vehicles')) expect(str(v, 'reg')).toMatch(/^DEMO \d{3} [A-Z]{2}$/);
  });
});

describe('bay queue rules', () => {
  it('needs a tread depth for all four wheel positions before the inspection is complete', () => {
    const job = withValues(todayJob('arrived'), { odometer: 999_999 });
    const none = run('jobs', job, 'inspected', 'u_fit');
    expect(reason(none)).toMatch(/missing LF, RF, LR, RR/);
    const three = run('jobs', withValues(job, { lf_tread: 5.1, rf_tread: 5.0, lr_tread: 6.2 }), 'inspected', 'u_fit');
    expect(reason(three)).toMatch(/missing RR/);
    expect(run('jobs', withValues(job, { lf_tread: 5.1, rf_tread: 5.0, lr_tread: 6.2, rr_tread: 6.0 }), 'inspected', 'u_fit')).toMatchObject({ ok: true });
    expect(reason(run('jobs', withValues(job, { odometer: 10, lf_tread: 5, rf_tread: 5, lr_tread: 5, rr_tread: 5 }), 'inspected', 'u_fit'))).toMatch(/below the last recorded/);
    expect(reason(run('jobs', withValues(job, { lf_tread: 5, rf_tread: 5, lr_tread: 5, rr_tread: 5 }), 'inspected', 'u_adv'))).toBe('Your simulated role does not hold this permission.');
  });

  it('a tyre below 1.0 mm must be quoted for replacement or the customer’s refusal recorded', () => {
    const job = withValues(todayJob('inspected'), { balancing: true });
    expect(Number(job.values.lf_tread)).toBeLessThan(1);
    const blocked = run('jobs', job, 'quoted', 'u_adv');
    expect(reason(blocked)).toMatch(/LF 0\.8 mm below the 1\.0 mm legal minimum/);
    expect(reason(run('jobs', job, 'quoted', 'u_adv', data, 'ok thanks'))).toMatch(/legal minimum/);
    expect(run('jobs', job, 'quoted', 'u_adv', data, 'Mr Nel declined the LF replacement in person — advised it is illegal')).toMatchObject({ ok: true });
    expect(run('jobs', withValues(job, { refusalNote: 'Customer refused by phone.' }), 'quoted', 'u_adv')).toMatchObject({ ok: true });
    const v = findRecord(data, 'vehicles', str(job, 'vehicle'))!;
    const tyre = stockForSize(data, str(v, 'tyreSize')).find((m) => m.exact)!.stock;
    expect(run('jobs', withValues(job, { lf_replace: true, tyresQty: 1, tyreStock: tyre.id }), 'quoted', 'u_adv')).toMatchObject({ ok: true });
    expect(reason(run('jobs', withValues(job, { lf_replace: true, tyresQty: 2, tyreStock: tyre.id }), 'quoted', 'u_adv'))).toMatch(/must match the wheel positions/);
    const wrong = records(data, 'stock').find((s) => !sameSize(str(s, 'size'), str(v, 'tyreSize')))!;
    expect(reason(run('jobs', withValues(job, { lf_replace: true, tyresQty: 1, tyreStock: wrong.id }), 'quoted', 'u_adv'))).toMatch(/does not match/);
  });

  it('fleet jobs need a PO number before approval; retail jobs need the approval channel', () => {
    const fleetJob = todayJob('quoted', (j) => !str(j, 'fleetPo') && records(data, 'customers').some((c) => str(c, 'kind') === 'fleet' && c.id === str(findRecord(data, 'vehicles', str(j, 'vehicle')), 'customer')));
    expect(reason(run('jobs', fleetJob, 'approved', 'u_adv'))).toMatch(/purchase order number/);
    expect(run('jobs', withValues(fleetJob, { fleetPo: 'PO-DEMO-BGL41999' }), 'approved', 'u_adv')).toMatchObject({ ok: true });
    const retail = todayJob('quoted', (j) => j.id !== fleetJob.id);
    expect(str(retail, 'approvalChannel')).toBe('');
    expect(reason(run('jobs', retail, 'approved', 'u_adv'))).toMatch(/how the customer approved/);
    expect(run('jobs', withValues(retail, { approvalChannel: 'whatsapp' }), 'approved', 'u_adv')).toMatchObject({ ok: true });
  });

  it('fitting needs the quoted tyres in stock (size and quantity), and fitting deducts stock', () => {
    const job = todayJob('approved');
    expect(reason(run('jobs', job, 'fitting', 'u_fit'))).toMatch(/fitment bay/);
    const occupant = todayJob('fitting');
    const free = swap(data, 'jobs', { ...occupant, status: 'ready' });
    const inBay = withValues(job, { bay: str(occupant, 'bay') });
    expect(reason(run('jobs', inBay, 'fitting', 'u_fit'))).toMatch(/occupied/);
    const st = findRecord(data, 'stock', str(job, 'tyreStock'))!;
    expect(num(job, 'tyresQty')).toBe(4);
    const short = swap(free, 'stock', withValues(st, { qty: 2 }));
    expect(reason(run('jobs', inBay, 'fitting', 'u_fit', short))).toMatch(/Only 2 × .* in stock — 4 needed/);
    expect(fittingProblem(inBay, free)).toBeNull();
    expect(run('jobs', inBay, 'fitting', 'u_fit', free)).toMatchObject({ ok: true });

    const updates: Array<{ c: string; id: string; v: Values }> = [];
    const api: EffectApi = { create: () => job, update: (c, id, v) => { updates.push({ c, id, v }); }, toast: () => undefined, transition: () => ({ ok: false, reason: 'unused' }) };
    findTransition(wf('jobs'), 'approved', 'fitting')!.after!({ record: inBay, data: free, api, today: TODAY, user: user('u_fit') });
    expect(updates.find((u) => u.c === 'stock')).toEqual({ c: 'stock', id: st.id, v: { qty: num(st, 'qty') - 4 } });
  });

  it('alignment needs before and after readings inside the demo tolerance', () => {
    const job = todayJob('alignment');
    expect(reason(run('jobs', job, 'torque', 'u_align'))).toMatch(/front toe after/);
    const after = { al_after_ftoe: 0.1, al_after_fcam: -0.6, al_after_rtoe: 0.2, al_after_rcam: -0.9 };
    expect(reason(run('jobs', withValues(job, { ...after, al_after_fcam: -2.4 }), 'torque', 'u_align'))).toMatch(/Front camber still outside/);
    expect(run('jobs', withValues(job, after), 'torque', 'u_align')).toMatchObject({ ok: true });
    expect(reason(run('jobs', withValues(job, after), 'torque', 'u_fit'))).toBe('Your simulated role does not hold this permission.');
  });

  it('torque check needs a calibrated wrench checked out to the technician and every wheel in spec', () => {
    const job = todayJob('torque', (j) => str(j, 'technician') === 'sk');
    const qc = { qcRetorque: true, qcPressure: true, qcCaps: true, qcOldTyres: true };
    expect(reason(run('jobs', job, 'ready', 'u_fit'))).toBe('Your simulated role does not hold this permission.');
    expect(reason(run('jobs', job, 'ready', 'u_align'))).toMatch(/QC checklist incomplete/);
    expect(run('jobs', withValues(job, qc), 'ready', 'u_align')).toMatchObject({ ok: true });
    expect(reason(run('jobs', withValues(job, { ...qc, lr_torque: 98 }), 'ready', 'u_align'))).toMatch(new RegExp(`LR 98 Nm outside the 110–120 Nm spec for ${reg(job)}`));
    expect(reason(run('jobs', withValues(job, { ...qc, rr_torque: '' }), 'ready', 'u_align'))).toMatch(/missing RR/);

    // Wrench checked in → blocked.
    const tw1 = tool('TR-TW-01');
    const checkedIn = swap(data, 'tools', { ...tw1, status: 'available', values: { ...tw1.values, holder: '' } });
    expect(reason(run('jobs', withValues(job, qc), 'ready', 'u_align', checkedIn))).toMatch(/No torque wrench is checked out to Sipho Khumalo/);

    // A technician holding only an out-of-calibration wrench is blocked.
    const other = todayJob('torque', (j) => str(j, 'technician') === 'md');
    const full = withValues(other, { ...qc, lf_torque: 150, rf_torque: 150, lr_torque: 150, rr_torque: 150 });
    expect(reason(run('jobs', full, 'ready', 'u_align'))).toMatch(/No torque wrench is checked out to Musa Dlamini/);
    const tw3 = tool('TR-TW-03');
    const expired = swap(data, 'tools', { ...tw3, status: 'checkedout', values: { ...tw3.values, holder: 'md', checkedOutOn: TODAY, checkedOutAt: '08:00' } });
    expect(reason(run('jobs', full, 'ready', 'u_align', expired))).toMatch(/TR-TW-03 held by Musa Dlamini is out of calibration/);
    const tw5 = tool('TR-TW-05');
    const valid = swap(data, 'tools', { ...tw5, status: 'checkedout', values: { ...tw5.values, holder: 'md', checkedOutOn: TODAY, checkedOutAt: '08:00' } });
    expect(run('jobs', full, 'ready', 'u_align', valid)).toMatchObject({ ok: true });

    // Entering the torque check also needs the wrench; the asset number is recorded on the job.
    const balancing = todayJob('balancing');
    expect(run('jobs', balancing, 'torque', 'u_fit')).toMatchObject({ ok: true });
    const updates: Values[] = [];
    const api: EffectApi = { create: () => balancing, update: (_c, _id, v) => { updates.push(v); }, toast: () => undefined, transition: () => ({ ok: false, reason: 'unused' }) };
    findTransition(wf('jobs'), 'balancing', 'torque')!.after!({ record: balancing, data, api, today: TODAY, user: user('u_fit') });
    expect(updates[0]).toMatchObject({ torqueToolAsset: 'TR-TW-02' });
  });

  it('retail vehicles leave only once paid; fleet invoices go on account first', () => {
    const ready = records(data, 'jobs').filter((j) => str(j, 'workDate') === TODAY && j.status === 'ready');
    const reasons = ready.map((j) => reason(run('jobs', j, 'collected', 'u_adv')));
    expect(reasons.some((r) => /Retail customers pay before the vehicle leaves/.test(r))).toBe(true);
    expect(reasons.some((r) => /on the fleet account/.test(r))).toBe(true);
  });
});

describe('tool, invoice and warranty rules', () => {
  it('blocks check-out of a tool whose calibration has expired, or that is out of service', () => {
    const tw3 = tool('TR-TW-03');
    expect(tw3.status).toBe('available');
    expect(reason(run('tools', withValues(tw3, { holder: 'md' }), 'checkedout', 'u_fit'))).toMatch(/TR-TW-03 calibration expired/);
    const tw5 = tool('TR-TW-05');
    expect(reason(run('tools', tw5, 'checkedout', 'u_fit'))).toMatch(/Choose the technician/);
    expect(run('tools', withValues(tw5, { holder: 'md' }), 'checkedout', 'u_fit')).toMatchObject({ ok: true });
    expect(reason(run('tools', withValues(tool('TR-TJ-03'), { holder: 'md' }), 'checkedout', 'u_fit'))).toMatch(/Cannot move from "Out of service"/);
    expect(reason(run('tools', withValues(tw5, { holder: 'md' }), 'checkedout', 'u_fleet'))).toBe('Your simulated role does not hold this permission.');
    // A repaired tool needs its condition updated before it returns to service.
    const iw4 = tool('TR-IW-04');
    expect(reason(run('tools', iw4, 'available', 'u_stock'))).toMatch(/set condition to Good or Fair/);
    expect(run('tools', withValues(iw4, { condition: 'good' }), 'available', 'u_stock')).toMatchObject({ ok: true });
  });

  it('never accepts a payment above the balance, and only fleet customers go on account', () => {
    const retailInv = records(data, 'invoices').find((i) => i.status === 'issued' && str(findRecord(data, 'customers', str(i, 'customer')), 'kind') === 'retail')!;
    expect(reason(run('invoices', retailInv, 'onaccount', 'u_fleet'))).toMatch(/Only fleet account customers/);
    const total = invoiceBalance(retailInv) / 100;
    expect(reason(run('invoices', withValues(retailInv, { paymentAmount: total + 100, paymentMethod: 'card' }), 'paid', 'u_adv'))).toMatch(/exceeds the outstanding balance/);
    expect(reason(run('invoices', withValues(retailInv, { paymentAmount: 100, paymentMethod: 'card' }), 'paid', 'u_adv'))).toMatch(/settled in full/);
    expect(run('invoices', withValues(retailInv, { paymentAmount: total, paymentMethod: 'card' }), 'paid', 'u_adv')).toMatchObject({ ok: true });
    const fleetInv = records(data, 'invoices').find((i) => i.status === 'onaccount' && Number(i.values.paid) === 0)!;
    expect(run('invoices', withValues(fleetInv, { paymentAmount: 100, paymentMethod: 'remittance' }), 'onaccount', 'u_fleet')).toMatchObject({ ok: true });
  });

  it('only manufacturing defects can be sent to the supplier', () => {
    const impact = records(data, 'claims').find((c) => c.status === 'inspected' && str(c, 'damageType') === 'impact')!;
    expect(reason(run('claims', impact, 'sent', 'u_stock'))).toMatch(/not a manufacturing defect/);
    expect(run('claims', withValues(impact, { damageType: 'bulge' }), 'sent', 'u_stock')).toMatchObject({ ok: true });
    const logged = records(data, 'claims').find((c) => c.status === 'logged')!;
    expect(reason(run('claims', logged, 'inspected', 'u_stock'))).toMatch(/tread remaining/);
    expect(proRataCredit(withValues(logged, { treadRemaining: 4.5, originalTread: 8 }))).toBe(50);
  });
});

describe('tyre helpers', () => {
  it('parses and matches tyre sizes', () => {
    expect(parseTyreSize('205/55R16 91V')).toEqual({ width: 205, profile: 55, rim: 16, commercial: false, key: '205/55R16' });
    expect(parseTyreSize('205/55 r16')?.key).toBe('205/55R16');
    expect(parseTyreSize('185R14C')).toEqual({ width: 185, profile: 80, rim: 14, commercial: true, key: '185R14C' });
    expect(parseTyreSize('195/70R15C 104R')?.commercial).toBe(true);
    expect(parseTyreSize('not a tyre')).toBeNull();
    expect(parseTyreSize('205/55R9')).toBeNull();
    expect(sizeKey(' 225/45ZR17 ')).toBe('225/45R17');
    expect(sameSize('205/55 R16', '205/55R16 94V')).toBe(true);
    expect(sameSize('205/55R16', '205/60R16')).toBe(false);
    expect(sameSize('195/70R15C', '195/70R15')).toBe(false);
    expect(diameterDiffPct('205/55R16', '215/55R16')).toBeCloseTo(1.7, 1);
    const m = stockForSize(data, '205/55R16');
    expect(m[0].exact).toBe(true);
    expect(m.every((x) => parseTyreSize(str(x.stock, 'size'))!.rim === 16)).toBe(true);
    expect(m.some((x) => !x.exact)).toBe(true);
  });

  it('works out DOT age and old stock', () => {
    expect(dotDate('0119')).toBe('2019-01-01');
    expect(dotDate('5521')).toBe('');
    expect(dotAgeYears('0119', TODAY)).toBeCloseTo(7.9, 1);
    expect(isOldDot('0119', TODAY)).toBe(true);
    expect(isOldDot('4524', TODAY)).toBe(false);
    expect(isOldDot('bad', TODAY)).toBe(false);
    expect(dotFromDate('2024-03-15')).toBe('1124');
    expect(records(data, 'stock').some((s) => isOldDot(str(s, 'dot'), TODAY))).toBe(true);
  });

  it('colour codes tread depth', () => {
    expect(treadTone(0.8)).toBe('red');
    expect(treadTone(1.0)).toBe('amber');
    expect(treadTone(3.0)).toBe('green');
    expect(treadTone(null)).toBe('none');
  });
});

describe('tool return rule', () => {
  it('flags only tools kept overnight, whatever time the demo is shown', () => {
    const t = tool('TR-TW-02');
    const out = (on: string) => ({ ...t, status: 'checkedout', values: { ...t.values, checkedOutOn: on, checkedOutAt: '07:30' } });
    expect(toolNotReturned(out('2026-11-10'), '2026-11-11')).toBe(true);
    expect(toolNotReturned(out('2026-11-11'), '2026-11-11')).toBe(false);
    expect(toolNotReturned({ ...t, status: 'available' }, '2026-11-11')).toBe(false);
  });
});
