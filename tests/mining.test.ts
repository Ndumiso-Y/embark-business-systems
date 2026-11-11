import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config, {
  contractorClearance, daysSinceLastLti, gasTestProblem, holders, permitExpired, productionToDate, sectionsToDate, serviceState, setTodayForTests,
} from '../src/industries/mining';
import { applyTransition, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import type { DemoRecord, EffectApi, IndustryData, Values } from '../src/core/types';

const TODAY = '2026-11-11';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;
const withValues = (r: DemoRecord, v: Values): DemoRecord => ({ ...r, values: { ...r.values, ...v } });

beforeAll(() => {
  setTodayForTests(TODAY, '12:00');
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('mining configuration', () => {
  it('is internally consistent', () => {
    expect(validateConfig(config)).toEqual([]);
  });

  it('has a guide whose steps point at seeded records in the state the step describes', () => {
    expect(config.guide).toHaveLength(6);
    const at = (to: string) => { const [m, id] = to.split('/'); const col = config.modules.find((x) => x.key === m)!.collection!; return records(data, col).find((r) => r.id === id)!; };
    expect(at('production/shifts_535')).toMatchObject({ status: 'open', values: { date: TODAY, section: 'l7e', shift: 'day' } });
    expect(at('permits/permits_4')).toMatchObject({ status: 'approved', values: { type: 'confined', gasO2: 18.9, isolationConfirmed: true } });
    expect(at('incidents/incidents_12')).toMatchObject({ status: 'investigating', values: { rootCause: '' } });
    expect(at('workorders/workorders_13')).toMatchObject({ status: 'planned', values: { type: 'planned' } });
    expect(at('environment/envreadings_40')).toMatchObject({ status: 'recorded', values: { parameter: 'dust', value: 1.7 } });
    // Each step's user can open the module it points at.
    for (const g of config.guide!) {
      const u = user(g.as!);
      expect(u.isSuperAdmin || u.modules.includes(g.to.split('/')[0]), `${g.title} as ${g.as}`).toBe(true);
    }
  });

  it('holders() names who can do a step, for roles that cannot', () => {
    expect(holders(data, 'production.verify')).toBe('Zodwa Mthethwa (Mine manager)');
    expect(holders(data, 'production.verify', 'u_mm')).toMatch(/nobody yet/);
    expect(holders(data, 'maintenance')).toBe('Zodwa Mthethwa (Mine manager) or Ruan Visagie (Maintenance planner)');
  });

  it('seeds a realistic, deterministic mine', () => {
    const again = buildIndustryData(config, TODAY);
    // 90 days × 2 shifts × 3 sections, less tonight's three not-yet-started shifts.
    expect(records(data, 'shifts').length).toBe(537);
    expect(records(data, 'equipment').length).toBe(14);
    expect(records(data, 'contractors').length).toBe(18);
    expect(records(data, 'workorders').length).toBe(20);
    expect(records(data, 'envreadings').length).toBe(40);
    expect(records(data, 'permits').length).toBeGreaterThanOrEqual(10);
    for (const k of ['shifts', 'incidents', 'permits', 'workorders', 'envreadings']) {
      expect(JSON.stringify(records(again, k).map((r) => [r.status, r.values]))).toBe(JSON.stringify(records(data, k).map((r) => [r.status, r.values])));
    }
    expect(records(data, 'incidents').filter((i) => i.values.lti === true).length).toBe(1);
    expect(records(data, 'permits').filter((p) => p.status === 'active' && permitExpired(p, TODAY)).length).toBe(1);
    expect(records(data, 'equipment').filter((e) => serviceState(e) === 'overdue').length).toBeGreaterThan(0);
  });

  it('uses only fictional contact details', () => {
    for (const c of records(data, 'contractors')) {
      expect(str(c, 'email')).toMatch(/@example\.com$/);
      expect(str(c, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
    }
  });
});

describe('production helpers', () => {
  it('computes month-to-date tonnes against plan', () => {
    const mtd = productionToDate(data, TODAY);
    // 1–10 Nov: 2 shifts × (1 120 + 1 030 t). Today's day shift is still open, so it is excluded.
    expect(mtd.target).toBe(10 * (1120 + 1030));
    expect(mtd.shifts).toBe(10 * 6);
    expect(mtd.tonnes).toBeGreaterThan(0);
    expect(mtd.pct).toBe(Math.round((mtd.tonnes / mtd.target) * 100));
    const bySection = sectionsToDate(data, TODAY);
    expect(bySection.reduce((n, s) => n + s.tonnes, 0)).toBe(mtd.tonnes);
  });

  it('counts days since the last lost-time injury', () => {
    expect(daysSinceLastLti(data, TODAY)).toBe(40);
    expect(daysSinceLastLti({ ...data, collections: { ...data.collections, incidents: [] } }, TODAY)).toBeNull();
  });
});

describe('shift verification', () => {
  const pending = () => records(data, 'shifts').find((s) => s.status === 'submitted' && Number(s.values.delayMinutes) > 30 && !str(s, 'delayReason'))!;

  it('requires a delay reason when delays exceed 30 minutes', () => {
    const res = applyTransition(wf('shifts'), pending(), 'verified', user('u_mm'), data, undefined, 'Mine manager');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/delay reason/);
    expect(applyTransition(wf('shifts'), withValues(pending(), { delayReason: 'lhd' }), 'verified', user('u_mm'), data, undefined, 'Mine manager')).toMatchObject({ ok: true });
  });

  it('supervisors cannot verify, and nobody verifies their own shift', () => {
    const fixed = withValues(pending(), { delayReason: 'lhd' });
    expect(applyTransition(wf('shifts'), fixed, 'verified', user('u_pc'), data, undefined, 'Shift supervisor')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
    const own = { ...fixed, history: [...fixed.history, { at: '2026-11-11T08:00:00Z', by: user('u_mm').name, role: 'Mine manager', action: 'Submit shift' }] };
    const res = applyTransition(wf('shifts'), own, 'verified', user('u_mm'), data, undefined, 'Mine manager');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/different person/);
  });
});

describe('permits to work', () => {
  const approved = (type: string) => records(data, 'permits').find((p) => p.status === 'approved' && str(p, 'type') === type)!;

  it('validates the confined-space oxygen band (19.5–23.5 %)', () => {
    expect(gasTestProblem(20.9)).toBeNull();
    expect(gasTestProblem(19.5)).toBeNull();
    expect(gasTestProblem(23.5)).toBeNull();
    expect(gasTestProblem(19.4)).toMatch(/below/);
    expect(gasTestProblem(23.6)).toMatch(/above/);
    expect(gasTestProblem(null)).toMatch(/gas test/);
    expect(gasTestProblem('')).toMatch(/gas test/);
  });

  it('blocks confined-space activation on a failed gas test', () => {
    const p = approved('confined');
    const res = applyTransition(wf('permits'), p, 'active', user('u_so'), data, undefined, 'Safety officer');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Oxygen 18\.9%/);
    expect(applyTransition(wf('permits'), withValues(p, { gasO2: 20.8 }), 'active', user('u_so'), data, undefined, 'Safety officer')).toMatchObject({ ok: true });
  });

  it('requires isolation to be confirmed before a permit goes active', () => {
    const p = approved('hot');
    const res = applyTransition(wf('permits'), p, 'active', user('u_so'), data, undefined, 'Safety officer');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Isolation/);
    expect(applyTransition(wf('permits'), withValues(p, { isolationConfirmed: true }), 'active', user('u_so'), data, undefined, 'Safety officer')).toMatchObject({ ok: true });
    expect(applyTransition(wf('permits'), withValues(p, { isolationConfirmed: true }), 'active', user('u_pc'), data, undefined, 'Shift supervisor')).toMatchObject({ ok: false });
  });

  it('will not approve a permit for a contractor who is not cleared for site', () => {
    const p = records(data, 'permits').find((x) => x.status === 'requested' && str(x, 'holder') === 'Karabo Seleka')!;
    const res = applyTransition(wf('permits'), p, 'approved', user('u_so'), data, undefined, 'Safety officer');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/not cleared/);
  });

  it('flags a permit active past its expiry time', () => {
    const p = approved('hot');
    expect(permitExpired(withValues(p, { validTo: TODAY, expiresAt: '11:59' }), TODAY, '12:00')).toBe(true);
    expect(permitExpired(withValues(p, { validTo: TODAY, expiresAt: '14:00' }), TODAY, '12:00')).toBe(false);
  });
});

describe('incidents', () => {
  it('cannot move to corrective actions without a root cause', () => {
    const inv = records(data, 'incidents').find((i) => i.status === 'investigating' && !str(i, 'rootCause'))!;
    const res = applyTransition(wf('incidents'), inv, 'actions', user('u_so'), data, undefined, 'Safety officer');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/root cause/);
    const fixed = withValues(inv, { rootCause: 'Arrestor latch worn.', correctiveActions: 'Replace latch.', actionOwner: 'Ruan Visagie', actionDue: '2026-11-20' });
    expect(applyTransition(wf('incidents'), fixed, 'actions', user('u_so'), data, undefined, 'Safety officer')).toMatchObject({ ok: true });
  });

  it('cannot close while actions are due in the future and not complete; closing needs a note', () => {
    const open = records(data, 'incidents').find((i) => i.status === 'actions' && str(i, 'actionDue') > TODAY)!;
    expect(applyTransition(wf('incidents'), open, 'closed', user('u_so'), data, 'Checked', 'Safety officer')).toMatchObject({ ok: false });
    const done = withValues(open, { actionsComplete: true });
    expect(applyTransition(wf('incidents'), done, 'closed', user('u_so'), data, '', 'Safety officer')).toEqual({ ok: false, reason: 'A note is required for this step.' });
    expect(applyTransition(wf('incidents'), done, 'closed', user('u_so'), data, 'Verified on site', 'Safety officer')).toMatchObject({ ok: true });
  });

  it('cannot close with overdue corrective actions that are not marked complete', () => {
    const overdue = records(data, 'incidents').find((i) => i.status === 'actions' && str(i, 'actionDue') < TODAY && !i.values.actionsComplete)!;
    const res = applyTransition(wf('incidents'), overdue, 'closed', user('u_so'), data, 'Closing anyway', 'Safety officer');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/not marked complete \(overdue since/);
    expect(applyTransition(wf('incidents'), withValues(overdue, { actionsComplete: true }), 'closed', user('u_so'), data, 'Mesh installed', 'Safety officer')).toMatchObject({ ok: true });
  });
});

describe('maintenance and compliance', () => {
  it('completing a planned work order resets the machine service hours', () => {
    const wo = records(data, 'workorders').find((w) => w.status === 'planned' && str(w, 'type') === 'planned')!;
    const inProgress = { ...wo, status: 'inprogress' };
    expect(applyTransition(wf('workorders'), inProgress, 'completed', user('u_mp'), data, undefined, 'Maintenance planner')).toMatchObject({ ok: false });
    const eq = records(data, 'equipment').find((e) => e.id === wo.values.equipment)!;
    const hrs = Number(eq.values.engineHours) + 4;
    const ready = withValues(inProgress, { hoursAtService: hrs, workDone: 'Service done.' });
    expect(applyTransition(wf('workorders'), ready, 'completed', user('u_mp'), data, undefined, 'Maintenance planner')).toMatchObject({ ok: true });
    const t = wf('workorders').transitions.find((x) => x.to === 'completed')!;
    const api: EffectApi = { create: vi.fn(), update: vi.fn(), toast: vi.fn(), transition: vi.fn() };
    t.after!({ record: ready, data, api, today: TODAY, user: user('u_mp') });
    expect(api.update).toHaveBeenCalledWith('equipment', eq.id, expect.objectContaining({
      lastServiceHours: hrs, nextServiceHours: hrs + Number(eq.values.serviceInterval), lastServiceDate: TODAY, availability: 'available',
    }), expect.any(String));
  });

  it('contractors with expired induction or medical are not cleared for site', () => {
    const byName = (last: string) => records(data, 'contractors').find((c) => c.values.lastName === last)!;
    expect(contractorClearance(byName('Seleka'), TODAY)).toMatchObject({ cleared: false });
    expect(contractorClearance(byName('Seleka'), TODAY).reasons).toHaveLength(2);
    expect(contractorClearance(byName('Zungu'), TODAY).reasons[0]).toMatch(/induction/i);
    expect(contractorClearance(byName('Mavuso'), TODAY)).toEqual({ cleared: true, reasons: [] });
    // Lapsed competency restricts the trade work only.
    expect(contractorClearance(byName('Ntuli'), TODAY).cleared).toBe(true);
  });

  it('environmental exceedances need a review note', () => {
    const readings = records(data, 'envreadings').filter((r) => r.status === 'recorded');
    const exceed = readings.find((r) => str(r, 'parameter') === 'ph' && Number(r.values.value) < 6)!;
    const normal = readings.find((r) => str(r, 'parameter') === 'noise' && Number(r.values.value) <= 85)!;
    expect(applyTransition(wf('envreadings'), exceed, 'reviewed', user('u_eo'), data, undefined, 'Environmental officer')).toMatchObject({ ok: false });
    expect(applyTransition(wf('envreadings'), exceed, 'reviewed', user('u_eo'), data, 'Lime dosing increased; resampled.', 'Environmental officer')).toMatchObject({ ok: true });
    expect(applyTransition(wf('envreadings'), normal, 'reviewed', user('u_eo'), data, undefined, 'Environmental officer')).toMatchObject({ ok: true });
    expect(applyTransition(wf('envreadings'), normal, 'reviewed', user('u_so'), data, undefined, 'Safety officer')).toMatchObject({ ok: false });
  });
});
