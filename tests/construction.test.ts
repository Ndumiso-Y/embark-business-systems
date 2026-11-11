import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config, {
  computeValuation, diaryEntryFor, diarySignProblem, diarySummary, holders, openCriticalSnags, overdueMilestones, plantCostThisMonth, plantRunningCost, previousCertified, programmeProgress,
  revisedContractSum, setTodayForTests, subcontractorCompliance, taskSlip, valuationFigures,
} from '../src/industries/construction';
import { applyTransition, num, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import { toCents } from '../src/core/lib/money';
import type { DemoRecord, EffectApi, IndustryData, Values } from '../src/core/types';

const TODAY = '2026-11-11';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;
const withValues = (r: DemoRecord, v: Values): DemoRecord => ({ ...r, values: { ...r.values, ...v } });
const project = (name: string) => records(data, 'projects').find((p) => str(p, 'name').startsWith(name))!;
/** A copy of the data with one collection's records patched. */
const patched = (collection: string, fn: (r: DemoRecord) => DemoRecord): IndustryData => ({ ...data, collections: { ...data.collections, [collection]: records(data, collection).map(fn) } });

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('construction configuration', () => {
  it('is internally consistent', () => {
    expect(validateConfig(config)).toEqual([]);
  });

  it('has a guide whose steps point at seeded records in the state the step describes', () => {
    expect(config.guide).toHaveLength(6);
    const at = (to: string) => { const [m, id] = to.split('/'); const col = config.modules.find((x) => x.key === m)!.collection!; return records(data, col).find((r) => r.id === id)!; };
    expect(at('variations/variations_3')).toMatchObject({ status: 'submitted', values: { value: 39_800, instructionRef: 'SI-011' } });
    expect(at('valuations/valuations_6')).toMatchObject({ status: 'draft', values: { valuationNo: 6 } });
    expect(str(at('valuations/valuations_6'), 'project')).toBe(project('Umgeni Ridge').id);
    expect(at('projects/projects_2')).toMatchObject({ status: 'onsite' });
    expect(openCriticalSnags(data, 'projects_2').map((s) => s.ref)).toEqual(['SNG-0016']);
    expect(at('procurement/requisitions_3')).toMatchObject({ status: 'approved', values: { supplier: 'protea', expectedDelivery: '' } });
    expect(at('plant/plant_4')).toMatchObject({ values: { fleetNo: 'HP-EX-311', ownership: 'hired', state: 'idle', dailyRate: 3900 } });
    for (const g of config.guide!) {
      const u = user(g.as!);
      expect(u.isSuperAdmin || u.modules.includes(g.to.split('/')[0]), `${g.title} as ${g.as}`).toBe(true);
    }
  });

  it('seeds exactly one unsignable diary draft on the last working day, whatever the weekday', () => {
    // Wed 11 Nov … Tue 17 Nov 2026 covers every day of the week, including a Sunday and a Monday.
    for (let i = 0; i < 7; i++) {
      const today = `2026-11-${11 + i}`;
      const d = buildIndustryData(config, today);
      const stuck = records(d, 'diary').filter((e) => e.status === 'draft' && diarySignProblem(e));
      expect(stuck.map((e) => str(e, 'project')), today).toEqual(['projects_2']);
      expect(str(stuck[0], 'date') < today && new Date(`${str(stuck[0], 'date')}T12:00:00`).getDay() !== 0, today).toBe(true);
      // The records the guide points at do not move with the weekday.
      expect(records(d, 'valuations').find((v) => v.id === 'valuations_6')).toMatchObject({ status: 'draft' });
      expect(new Set(records(d, 'diary').map((e) => `${str(e, 'project')}|${str(e, 'date')}`)).size).toBe(records(d, 'diary').length);
    }
  });

  it('one diary entry per site per day', () => {
    const entry = records(data, 'diary')[0];
    expect(diaryEntryFor(data, str(entry, 'project'), str(entry, 'date'))?.id).toBe(entry.id);
    expect(diaryEntryFor(data, str(entry, 'project'), str(entry, 'date'), entry.id)).toBeUndefined();
    expect(diaryEntryFor(data, str(entry, 'project'), '2026-11-08')).toBeUndefined(); // a Sunday
  });

  it('holders() names who can do a step, for roles that cannot', () => {
    expect(holders(data, 'valuations')).toBe('Andile Khumalo (Managing director) or Lindiwe Mahlangu (Quantity surveyor)');
    expect(holders(data, 'procurement', 'u_md')).toBe('Fatima Davids (Procurement & stores)');
  });

  it('seeds a realistic, deterministic contractor', () => {
    const again = buildIndustryData(config, TODAY);
    expect(records(data, 'projects')).toHaveLength(7);
    expect(records(data, 'subcontractors')).toHaveLength(14);
    expect(records(data, 'variations')).toHaveLength(16);
    expect(records(data, 'plant')).toHaveLength(17);
    expect(records(data, 'snags')).toHaveLength(25);
    expect(records(data, 'requisitions')).toHaveLength(13);
    // 18 Oct – 11 Nov for the three live sites, Sundays off (18 Oct, 25 Oct, 1 Nov, 8 Nov).
    expect(records(data, 'diary')).toHaveLength(21 * 3);
    expect(records(data, 'valuations').length).toBeGreaterThanOrEqual(12);
    for (const k of config.collections.map((c) => c.key)) {
      expect(JSON.stringify(records(again, k).map((r) => [r.status, r.values]))).toBe(JSON.stringify(records(data, k).map((r) => [r.status, r.values])));
    }
    const stages = records(data, 'projects').map((p) => p.status);
    expect(stages).toEqual(expect.arrayContaining(['tender', 'awarded', 'onsite', 'practical', 'onhold']));
    expect(records(data, 'subcontractors').filter((s) => !subcontractorCompliance(s, TODAY).ok).map((s) => str(s, 'company'))).toEqual([
      'Aqua-Flo Plumbing (fictional)', 'Ndlovu Structural Steel (fictional)', 'Rainbow Painting Contractors (fictional)',
    ]);
    expect(records(data, 'diary').filter((d) => str(d, 'weather') === 'rain').length).toBeGreaterThan(0);
  });

  it('uses only fictional contact details', () => {
    for (const s of records(data, 'subcontractors')) {
      expect(str(s, 'email')).toMatch(/@example\.com$/);
      expect(str(s, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
      expect(str(s, 'company')).toMatch(/\(fictional\)$/);
    }
  });

  it('keeps at most one open valuation per project in the seed', () => {
    for (const p of records(data, 'projects')) {
      expect(records(data, 'valuations').filter((v) => str(v, 'project') === p.id && ['draft', 'submitted'].includes(v.status ?? '')).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('payment valuation maths', () => {
  const base = { workDone: 1_000_000, materialsOnSite: 50_000, variations: 20_000, retentionPct: 5, contractValue: 10_000_000, previousCertified: 600_000 };

  it('computes gross, retention, previous certificates and VAT', () => {
    expect(computeValuation(base)).toEqual({
      gross: 1_070_000_00, retentionCalculated: 53_500_00, retentionCap: 500_000_00, retention: 53_500_00, capped: false,
      netCumulative: 1_016_500_00, previous: 600_000_00, amountDue: 416_500_00, vat: 62_475_00, total: 478_975_00,
    });
  });

  it('caps retention at 5 % of the original contract value', () => {
    const f = computeValuation({ ...base, workDone: 8_000_000, materialsOnSite: 0, variations: 0, retentionPct: 10, previousCertified: 0 });
    expect(f.retentionCalculated).toBe(800_000_00);
    expect(f.retentionCap).toBe(500_000_00);
    expect(f.retention).toBe(500_000_00);
    expect(f.capped).toBe(true);
    expect(f.amountDue).toBe(7_500_000_00);
    // Exactly at the cap is not "capped".
    expect(computeValuation({ ...base, workDone: 5_000_000, materialsOnSite: 0, variations: 0, retentionPct: 10, previousCertified: 0 }).capped).toBe(false);
  });

  it('deducts previous certificates and can produce a credit when over-certified', () => {
    const f = computeValuation({ ...base, previousCertified: 1_100_000 });
    expect(f.amountDue).toBe(-83_500_00);
    expect(f.vat).toBe(-12_525_00);
    expect(f.total).toBe(-96_025_00);
  });

  it('rounds VAT to the cent and ignores negative retention percentages', () => {
    const f = computeValuation({ workDone: 333.33, materialsOnSite: 0, variations: 0, retentionPct: 0, contractValue: 1000, previousCertified: 0 });
    expect(f.vat).toBe(5000); // 15 % of R333.33 = R49.9995 → R50.00
    expect(f.total).toBe(38333);
    expect(computeValuation({ ...base, retentionPct: -5 }).retention).toBe(0);
  });

  it('chains previous certificates through the seeded valuations', () => {
    const wh = project('Rietvlei');
    const vals = records(data, 'valuations').filter((v) => str(v, 'project') === wh.id).sort((a, b) => num(a, 'valuationNo') - num(b, 'valuationNo'));
    const certified = vals.filter((v) => ['certified', 'paid'].includes(v.status ?? ''));
    const last = vals[vals.length - 1];
    expect(last.status).toBe('submitted');
    expect(previousCertified(data, last)).toBeCloseTo(certified.reduce((n, v) => n + num(v, 'certifiedAmount'), 0), 2);
    // Submitted figures were produced by the same calculation.
    expect(valuationFigures(data, last).amountDue).toBe(toCents(num(last, 'submittedAmount')));
    // 10 % retention on a large gross hits the 5 % cap on this project.
    expect(valuationFigures(data, last).capped).toBe(true);
  });

  it('only one open valuation per project; certified cannot exceed submitted', () => {
    const school = project('Umgeni');
    const wh = project('Rietvlei');
    const draft = records(data, 'valuations').find((v) => str(v, 'project') === school.id && v.status === 'draft')!;
    expect(applyTransition(wf('valuations'), draft, 'submitted', user('u_qs'), data, undefined, 'Quantity surveyor')).toMatchObject({ ok: true });
    const clash = applyTransition(wf('valuations'), withValues(draft, { project: wh.id }), 'submitted', user('u_qs'), data, undefined, 'Quantity surveyor');
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.reason).toMatch(/Only one open valuation/);

    const submitted = records(data, 'valuations').find((v) => v.status === 'submitted')!;
    const claim = num(submitted, 'submittedAmount');
    expect(applyTransition(wf('valuations'), withValues(submitted, { certifiedAmount: '' }), 'certified', user('u_qs'), data, undefined, 'QS')).toMatchObject({ ok: false });
    const over = applyTransition(wf('valuations'), withValues(submitted, { certifiedAmount: claim + 1 }), 'certified', user('u_qs'), data, undefined, 'QS');
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toMatch(/exceeds/);
    expect(applyTransition(wf('valuations'), withValues(submitted, { certifiedAmount: claim }), 'certified', user('u_qs'), data, undefined, 'QS')).toMatchObject({ ok: true });
    expect(applyTransition(wf('valuations'), withValues(submitted, { certifiedAmount: claim - 5000 }), 'certified', user('u_qs'), data, undefined, 'QS')).toMatchObject({ ok: true });
    expect(applyTransition(wf('valuations'), withValues(submitted, { certifiedAmount: claim }), 'certified', user('u_sa'), data, undefined, 'Site agent')).toMatchObject({ ok: false });
  });

  it('a valuation number cannot be used twice on a project', () => {
    const draft = records(data, 'valuations').find((v) => v.id === 'valuations_6')!;
    const res = applyTransition(wf('valuations'), withValues(draft, { valuationNo: 3 }), 'submitted', user('u_qs'), data, undefined, 'Quantity surveyor');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Valuation 3 already exists on this project \(VAL-0003\)\. The next number is 7/);
  });

  it('submitting stores the computed amount due', () => {
    const draft = records(data, 'valuations').find((v) => v.status === 'draft')!;
    const t = wf('valuations').transitions.find((x) => x.to === 'submitted')!;
    const api: EffectApi = { create: vi.fn(), update: vi.fn(), toast: vi.fn(), transition: vi.fn() };
    t.after!({ record: draft, data, api, today: TODAY, user: user('u_qs') });
    expect(api.update).toHaveBeenCalledWith('valuations', draft.id, { submittedAmount: valuationFigures(data, draft).amountDue / 100, submittedOn: TODAY });
  });
});

describe('variations', () => {
  it('cannot submit without a written instruction reference or a price', () => {
    const verbal = records(data, 'variations').find((v) => v.status === 'priced' && !str(v, 'instructionRef'))!;
    const res = applyTransition(wf('variations'), verbal, 'submitted', user('u_qs'), data, undefined, 'Quantity surveyor');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/instruction reference/);
    const withRef = withValues(verbal, { instructionRef: 'SI-015' });
    expect(applyTransition(wf('variations'), withRef, 'submitted', user('u_qs'), data, undefined, 'Quantity surveyor')).toMatchObject({ ok: true });
    const noPrice = applyTransition(wf('variations'), withValues(withRef, { value: '' }), 'submitted', user('u_qs'), data, undefined, 'Quantity surveyor');
    expect(noPrice.ok).toBe(false);
    if (!noPrice.ok) expect(noPrice.reason).toMatch(/no price/);
    // Pricing is the QS's job, approval the PM's.
    expect(applyTransition(wf('variations'), withRef, 'submitted', user('u_sa'), data, undefined, 'Site agent')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
  });

  it('cannot price a variation assigned to an expired subcontractor', () => {
    const v = records(data, 'variations').find((x) => x.status === 'instructed' && str(x, 'subcontractor'))!;
    const priced = withValues(v, { value: 48_500, timeImpactDays: 2 });
    const res = applyTransition(wf('variations'), priced, 'priced', user('u_qs'), data, undefined, 'Quantity surveyor');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Ndlovu Structural Steel.*Tax compliance status expired/);
    expect(applyTransition(wf('variations'), withValues(priced, { subcontractor: '' }), 'priced', user('u_qs'), data, undefined, 'Quantity surveyor')).toMatchObject({ ok: true });
    expect(applyTransition(wf('variations'), v, 'priced', user('u_qs'), data, undefined, 'Quantity surveyor')).toMatchObject({ ok: false });
  });

  it('approved variations revise the contract sum', () => {
    const wh = project('Rietvlei');
    expect(revisedContractSum(data, wh)).toBe(32_600_000 + 612_000 + 184_500);
    const pending = records(data, 'variations').find((v) => v.status === 'submitted' && str(v, 'project') === wh.id)!;
    expect(applyTransition(wf('variations'), pending, 'rejected', user('u_pm1'), data, '', 'Project manager')).toEqual({ ok: false, reason: 'A note is required for this step.' });
    const approved = applyTransition(wf('variations'), pending, 'approved', user('u_pm1'), data, undefined, 'Project manager');
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      const next = patched('variations', (r) => (r.id === pending.id ? approved.record : r));
      expect(revisedContractSum(next, wh)).toBe(32_600_000 + 612_000 + 184_500 + 72_300);
    }
  });
});

describe('project completion', () => {
  it('practical completion is blocked by an open critical snag', () => {
    const wh = project('Rietvlei');
    expect(openCriticalSnags(data, wh.id)).toHaveLength(1);
    const res = applyTransition(wf('projects'), wh, 'practical', user('u_pm1'), data, undefined, 'Project manager');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/critical snag/);
    const fixed = patched('snags', (s) => (str(s, 'project') === wh.id && str(s, 'category') === 'critical' ? { ...s, status: 'verified' } : s));
    expect(applyTransition(wf('projects'), wh, 'practical', user('u_pm1'), fixed, undefined, 'Project manager')).toMatchObject({ ok: true });
  });

  it('practical completion needs every snag categorised', () => {
    const school = project('Umgeni');
    const res = applyTransition(wf('projects'), school, 'practical', user('u_pm1'), data, undefined, 'Project manager');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/not categorised/);
    const categorised = patched('snags', (s) => (str(s, 'category') ? s : withValues(s, { category: 'minor' })));
    expect(applyTransition(wf('projects'), school, 'practical', user('u_pm1'), categorised, undefined, 'Project manager')).toMatchObject({ ok: true });
  });

  it('final completion needs a closed snag list and the retention release certificate', () => {
    const clinic = project('Marula');
    const open = applyTransition(wf('projects'), clinic, 'final', user('u_pm2'), data, undefined, 'Project manager');
    expect(open.ok).toBe(false);
    if (!open.ok) expect(open.reason).toMatch(/verified closed/);
    const closed = patched('snags', (s) => ({ ...s, status: 'verified' }));
    const noCert = applyTransition(wf('projects'), clinic, 'final', user('u_pm2'), closed, undefined, 'Project manager');
    expect(noCert.ok).toBe(false);
    if (!noCert.ok) expect(noCert.reason).toMatch(/retention release/);
    expect(applyTransition(wf('projects'), withValues(clinic, { retentionReleaseCert: true }), 'final', user('u_pm2'), closed, undefined, 'Project manager')).toMatchObject({ ok: true });
  });
});

describe('site diary', () => {
  it('a delay needs a cause before the diary is signed', () => {
    const entry = records(data, 'diary').find((d) => d.status === 'draft' && num(d, 'delayHours') > 0 && !str(d, 'delayCause'))!;
    const res = applyTransition(wf('diary'), entry, 'signed', user('u_sa'), data, undefined, 'Site agent');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/delay cause/);
    const withCause = withValues(entry, { delayCause: 'plant' });
    expect(applyTransition(wf('diary'), withCause, 'signed', user('u_sa'), data, undefined, 'Site agent')).toMatchObject({ ok: true });
    expect(applyTransition(wf('diary'), withCause, 'signed', user('u_qs'), data, undefined, 'Quantity surveyor')).toMatchObject({ ok: false });
    expect(applyTransition(wf('diary'), withValues(entry, { delayHours: 0, delayCause: '', weather: 'rain' }), 'signed', user('u_sa'), data, undefined, 'Site agent')).toMatchObject({ ok: false });
  });

  it('counts rain days and employer delays toward an indicative extension of time', () => {
    const wh = project('Rietvlei');
    const s = diarySummary(data, wh.id);
    const rain = records(data, 'diary').filter((d) => str(d, 'project') === wh.id && str(d, 'weather') === 'rain').length;
    expect(s.rainDays).toBe(rain);
    expect(s.employerDelayDays).toBe(1.5); // 4 h + 8 h waiting for design information
    expect(s.indicativeEot).toBe(rain + 1.5);
    const month = diarySummary(data, undefined, '2026-11-01', TODAY);
    expect(month.rainDays).toBe(6); // 9 and 5 November on all three sites
  });
});

describe('procurement, plant, programme and safety', () => {
  it('receiving goods requires a delivery note number', () => {
    const ordered = records(data, 'requisitions').find((r) => r.status === 'ordered')!;
    const res = applyTransition(wf('requisitions'), ordered, 'delivered', user('u_ps'), data, undefined, 'Procurement');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/delivery note/);
    expect(applyTransition(wf('requisitions'), withValues(ordered, { deliveryNote: 'DN-1234' }), 'delivered', user('u_ps'), data, undefined, 'Procurement')).toMatchObject({ ok: true });
    expect(applyTransition(wf('requisitions'), withValues(ordered, { deliveryNote: 'DN-1234' }), 'partial', user('u_ps'), data, undefined, 'Procurement')).toMatchObject({ ok: true });
    expect(applyTransition(wf('requisitions'), withValues(ordered, { deliveryNote: 'DN-1234' }), 'delivered', user('u_sa'), data, undefined, 'Site agent')).toMatchObject({ ok: false });
  });

  it('computes hire cost and flags idle hired plant', () => {
    const ex = records(data, 'plant').find((p) => str(p, 'fleetNo') === 'HP-EX-311')!;
    // On hire from 27 Sep (45 days ago) to today inclusive = 46 days at R3 900.
    expect(plantRunningCost(ex, TODAY)).toBe(46 * 3900);
    expect(plantCostThisMonth(ex, TODAY)).toBe(11 * 3900);
    const flags = config.collections.find((c) => c.key === 'plant')!.flags!(ex, data, TODAY);
    expect(flags.map((f) => f.label)).toEqual(expect.arrayContaining([expect.stringMatching(/idle/), expect.stringMatching(/Off-hire overdue 8 days/)]));
    const returned = records(data, 'plant').find((p) => str(p, 'state') === 'offhired')!;
    expect(plantCostThisMonth(returned, TODAY)).toBe(0);
    expect(plantRunningCost(returned, TODAY)).toBe(71 * 1650);
  });

  it('measures programme progress and slippage', () => {
    const wh = project('Rietvlei');
    const p = programmeProgress(data, wh, TODAY);
    expect(p.elapsed).toBeGreaterThan(p.pct);
    expect(p.overdue.length).toBeGreaterThan(0);
    expect(overdueMilestones(data, TODAY).some((t) => str(t, 'project') === wh.id)).toBe(true);
    const t = records(data, 'tasks')[0];
    expect(taskSlip(withValues({ ...t, status: 'inprogress' }, { plannedStart: '2026-11-01', plannedFinish: '2026-11-20', pctComplete: 10 }), TODAY).state).toBe('behind');
    expect(taskSlip(withValues({ ...t, status: 'inprogress' }, { plannedStart: '2026-11-01', plannedFinish: '2026-11-10', pctComplete: 90 }), TODAY)).toMatchObject({ state: 'overdue', days: 1 });
    expect(taskSlip(withValues({ ...t, status: 'complete' }, { plannedFinish: '2026-11-01', actualFinish: '2026-11-04' }), TODAY)).toMatchObject({ state: 'late', days: 3 });
  });

  it('incidents and near misses close out only with a corrective action', () => {
    const nm = records(data, 'safety').find((s) => s.status === 'open' && str(s, 'type') === 'nearmiss')!;
    expect(applyTransition(wf('safety'), nm, 'closed', user('u_so'), data, undefined, 'Safety officer')).toMatchObject({ ok: false });
    expect(applyTransition(wf('safety'), withValues(nm, { correctiveAction: 'Exclusion zone marked for lifts.' }), 'closed', user('u_so'), data, undefined, 'Safety officer')).toMatchObject({ ok: true });
  });
});
