import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import config, {
  SEED, absenteeism, activeShiftFor, availableVehicles, bookOffProblem, buildInvoiceValues, contractMonthly, coverage, coverageNow, currentSlot, dailyCoverage,
  deployability, entrySlot, handoverEntry, inspectionOverdue, inspectionScore, invoiceTotals, issueProblems, kindOf, minutesFromTo, notReturned, officerExpiries,
  patrolLateBy, patrolMissed, postOf, postingProblems, rec, responseMinutes, responseStats, setTodayForTests, siteOfShift, slaState, slotPhase, suggestedTime,
  unfilledShifts,
  workingOfficerId,
} from '../src/industries/security';
import { applyTransition, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import { addDays } from '../src/core/lib/dates';
import { useStore } from '../src/core/store';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { IndustryContext } from '../src/core/context';
import { ModuleDetailView, ModuleView } from '../src/core/components/records';
import type { DemoRecord, EffectApi, IndustryData, Values } from '../src/core/types';

const TODAY = '2026-11-11';
const NOW = '12:00';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;
const withValues = (r: DemoRecord, v: Values): DemoRecord => ({ ...r, values: { ...r.values, ...v } });
const get = (collection: string, id: string) => records(data, collection).find((r) => r.id === id)!;
const move = (collection: string, r: DemoRecord, to: string, who: string, note?: string) => applyTransition(wf(collection), r, to, user(who), data, note, 'Tester');
const reason = (res: ReturnType<typeof move>) => (res.ok ? '' : res.reason);
const mockApi = (): EffectApi => ({ create: vi.fn(), update: vi.fn(), toast: vi.fn(), transition: vi.fn() });

beforeAll(() => {
  setTodayForTests(TODAY, NOW);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('security configuration', () => {
  it('is internally consistent, including the guided walkthrough', () => {
    expect(validateConfig(config)).toEqual([]);
    expect(config.guide?.length).toBeGreaterThanOrEqual(5);
    expect(config.businessName).toBe('Sentinel Ridge Security');
  });

  it('seeds a realistic, deterministic company', () => {
    const again = buildIndustryData(config, TODAY);
    for (const c of config.collections) {
      expect(JSON.stringify(records(again, c.key).map((r) => [r.id, r.status, r.values]))).toBe(JSON.stringify(records(data, c.key).map((r) => [r.id, r.status, r.values])));
    }
    expect(records(data, 'contracts')).toHaveLength(10);
    expect(records(data, 'sites')).toHaveLength(14);
    expect(records(data, 'posts')).toHaveLength(48);
    expect(records(data, 'officers')).toHaveLength(70);
    expect(records(data, 'equipment')).toHaveLength(60);
    expect(records(data, 'incidents')).toHaveLength(18);
    expect(records(data, 'callouts')).toHaveLength(25);
    // 48 posts × (14 days back + today + 3 days ahead).
    expect(records(data, 'roster')).toHaveLength(48 * 18);
    expect(records(data, 'invoices')).toHaveLength(20);
    expect(records(data, 'ob').length).toBeGreaterThan(50);
    expect(records(data, 'patrols').length).toBeGreaterThan(30);
  });

  it('keeps the stored seed under 400 KB', () => {
    expect(JSON.stringify(data).length).toBeLessThan(400_000);
  });

  it('uses only fictional contact details and identifiers', () => {
    for (const o of records(data, 'officers')) {
      expect(str(o, 'email')).toMatch(/@example\.com$/);
      expect(str(o, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
      expect(str(o, 'psiraNo')).toMatch(/^DEMO-PSIRA-\d{7}$/);
    }
    expect(new Set(records(data, 'officers').map((o) => str(o, 'email'))).size).toBe(70);
    for (const c of records(data, 'contracts')) expect(str(c, 'email')).toMatch(/@example\.com$/);
    for (const e of records(data, 'equipment')) expect(str(e, 'serial')).toMatch(/^DEMO-SN-/);
    for (const i of records(data, 'incidents')) if (str(i, 'sapsCase')) expect(str(i, 'sapsCase')).toMatch(/^DEMO-CAS /);
  });

  it('seeds from the date only — the time of day never changes anything', () => {
    const snapshot = (d: IndustryData) => JSON.stringify(config.collections.map((c) => records(d, c.key).map((r) => [r.id, r.status, r.values])));
    for (const time of ['00:20', '03:15', '07:30', '18:01', '23:40']) {
      setTodayForTests(TODAY, time);
      expect(snapshot(buildIndustryData(config, TODAY))).toBe(snapshot(data));
      expect(coverageNow(data, TODAY)).toMatchObject({ covered: 24, posts: 26, slot: { date: TODAY, kind: 'day' } });
    }
    setTodayForTests(TODAY, NOW);
    expect(slotPhase(addDays(TODAY, -1), 'night', TODAY)).toBe('past');
    expect(slotPhase(TODAY, 'day', TODAY)).toBe('current');
    expect(slotPhase(TODAY, 'night', TODAY)).toBe('future');
  });

  it('seeds a roster that obeys its own rules, with everything the walkthrough needs, on every day of the week', () => {
    for (let i = 0; i < 7; i++) {
      const day = addDays(TODAY, i);
      setTodayForTests(day, NOW);
      const d = buildIndustryData(config, day);
      const live = records(d, 'roster').filter((r) => ['posted', 'relief', 'onduty'].includes(r.status ?? '') && slotPhase(str(r, 'date'), kindOf(d, r), day) !== 'past');
      expect(live.length).toBeGreaterThan(150);
      expect(live.filter((r) => postingProblems(d, r, workingOfficerId(r)).length)).toEqual([]);
      // Today's day shift has officers on duty, an absence and an unfilled post.
      const now = coverageNow(d, day);
      expect(now.onDuty).toBeGreaterThan(15);
      expect(now.unfilled.map((u) => u.reason).sort()).toEqual(['No officer posted', 'Officer absent — no relief']);
      const guide = rec(d, 'roster', SEED.guideShift)!;
      expect(guide.status).toBe('open');
      expect(str(guide, 'date')).toBe(addDays(day, 1));
      const candidates = records(d, 'officers').map((o) => postingProblems(d, guide, o.id).length);
      expect(candidates.filter((n) => n === 0).length).toBeGreaterThanOrEqual(2);
      expect(candidates.filter((n) => n > 0).length).toBeGreaterThan(40);
      expect(rec(d, 'callouts', SEED.guideCallout)!.status).toBe('received');
      expect(availableVehicles(d, SEED.guideCallout, day).length).toBeGreaterThanOrEqual(2);
      const firearm = rec(d, 'equipment', SEED.guideFirearm)!;
      expect(firearm.status).toBe('instore');
      const onShift = records(d, 'officers').filter((o) => activeShiftFor(d, o.id, day));
      expect(onShift.filter((o) => !issueProblems(d, firearm, o.id, day).length).length).toBeGreaterThanOrEqual(1);
      expect(onShift.filter((o) => issueProblems(d, firearm, o.id, day).length).length).toBeGreaterThan(20);
      expect(records(d, 'roster').filter((r) => r.status === 'onduty').length).toBeGreaterThan(15);
      expect(rec(d, 'inspections', SEED.guideInspection)).toMatchObject({ status: 'draft', values: { date: day } });
      expect(rec(d, 'incidents', SEED.guideIncident)!.status).toBe('investigating');
    }
    setTodayForTests(TODAY, NOW);
  });
});

describe('duty roster — posting rules', () => {
  const guide = () => get('roster', SEED.guideShift);
  const post = (officer: string, who = 'u_ctl') => move('roster', withValues(guide(), { officer }), 'posted', who);

  it('the walkthrough post is an armed Grade C post, unfilled tomorrow', () => {
    const p = postOf(data, guide())!;
    expect(p.values).toMatchObject({ grade: 'C', armed: true, shift: 'day' });
    expect(str(guide(), 'date')).toBe(addDays(TODAY, 1));
    expect(reason(move('roster', guide(), 'posted', 'u_ctl'))).toMatch(/Choose an officer/);
  });

  it('refuses an officer whose PSIRA registration has expired', () => {
    expect(reason(post(SEED.expiredPsira))).toMatch(/PSIRA registration DEMO-PSIRA-\d+ expired/);
    // The post's regular officer lapsed three days ago, which is why it is unfilled.
    expect(reason(post(SEED.lapsedRegular))).toMatch(/expired on 08 Nov 2026/);
    expect(deployability(get('officers', SEED.lapsedRegular), TODAY)).toMatchObject({ deployable: false });
  });

  it('refuses an officer whose grade is below the post’s grade', () => {
    expect(get('officers', SEED.lowGrade).values.grade).toBe('E');
    expect(reason(post(SEED.lowGrade))).toMatch(/Grade too low: .* is Grade E; this post requires Grade C or higher/);
  });

  it('refuses an armed post without valid firearm competency', () => {
    expect(reason(post(SEED.noCompetency))).toMatch(/Armed post: .* no firearm competency/);
    const lapsed = records(data, 'officers').find((o) => str(o, 'competencyExpiry') && str(o, 'competencyExpiry') < TODAY && str(o, 'employment') === 'active')!;
    expect(reason(post(lapsed.id))).toMatch(/firearm competency expired/);
  });

  it('refuses an officer already posted on an overlapping shift', () => {
    const tomorrow = addDays(TODAY, 1);
    const other = records(data, 'roster').find((r) => r.id !== SEED.guideShift && str(r, 'date') === tomorrow && kindOf(data, r) === 'day' && r.status === 'posted' && postOf(data, r)?.values.armed === true)!;
    const res = post(workingOfficerId(other));
    expect(reason(res)).toMatch(/already posted at Protea Heights Estate — Estate patrol on the same shift/);
  });

  it('applies the demo rest rule: no day shift straight after a night shift', () => {
    const tonight = records(data, 'roster').find((r) => str(r, 'date') === TODAY && kindOf(data, r) === 'night' && r.status === 'posted' && postOf(data, r)?.values.armed === true)!;
    expect(reason(post(workingOfficerId(tonight)))).toMatch(/Demo rest rule: .* no day shift straight after a night shift/);
  });

  it('refuses officers who are suspended or lack the site induction', () => {
    const suspended = records(data, 'officers').find((o) => str(o, 'employment') === 'suspended')!;
    expect(reason(post(suspended.id))).toMatch(/is suspended and cannot be posted/);
    const needsInduction = records(data, 'roster').find((r) => r.status === 'open' && siteOfShift(data, r)?.values.requiresInduction === true && str(r, 'date') > TODAY)!;
    expect(postingProblems(data, needsInduction, SEED.notInducted).join(' ')).toMatch(/has not completed the Marula Data Centre site induction/);
    // The same officer is fine at a site that needs no induction.
    expect(postingProblems(data, guide(), SEED.notInducted)).toEqual([]);
  });

  it('posts an eligible officer, and only with the roster permission', () => {
    expect(postingProblems(data, guide(), SEED.standby)).toEqual([]);
    expect(post(SEED.standby)).toMatchObject({ ok: true });
    expect(post(SEED.standby, 'u_arm')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
  });

  it('runs the same checks on a relief officer and needs a note for an absence', () => {
    const posted = records(data, 'roster').find((r) => r.status === 'posted' && str(r, 'date') === addDays(TODAY, 1) && postOf(data, r)?.values.armed !== true)!;
    expect(move('roster', posted, 'absent', 'u_ctl')).toEqual({ ok: false, reason: 'A note is required for this step.' });
    expect(move('roster', posted, 'absent', 'u_ctl', 'Phoned in sick')).toMatchObject({ ok: true });
    const absent = { ...posted, status: 'absent' };
    expect(reason(move('roster', absent, 'relief', 'u_ctl'))).toMatch(/Choose a relief officer/);
    expect(reason(move('roster', withValues(absent, { reliefOfficer: str(posted, 'officer') }), 'relief', 'u_ctl'))).toMatch(/cannot be the officer who is absent/);
    expect(reason(move('roster', withValues(absent, { reliefOfficer: SEED.expiredPsira }), 'relief', 'u_ctl'))).toMatch(/PSIRA/);
    expect(move('roster', withValues(absent, { reliefOfficer: SEED.standby }), 'relief', 'u_ctl')).toMatchObject({ ok: true });
  });
});

describe('book on, handover and book off', () => {
  it('only books on on the day of the shift', () => {
    const future = records(data, 'roster').find((r) => r.status === 'posted' && str(r, 'date') === addDays(TODAY, 1))!;
    expect(reason(move('roster', future, 'onduty', 'u_ctl'))).toMatch(/only starts at/);
    const tonight = records(data, 'roster').find((r) => r.status === 'posted' && str(r, 'date') === TODAY && kindOf(data, r) === 'night')!;
    expect(move('roster', tonight, 'onduty', 'u_ctl')).toMatchObject({ ok: true });
    const late = records(data, 'roster').find((r) => r.status === 'posted' && str(r, 'date') === TODAY && kindOf(data, r) === 'day')!;
    expect(move('roster', late, 'onduty', 'u_sup')).toMatchObject({ ok: true });
  });

  it('needs a signed handover entry in the site occurrence book before booking off', () => {
    const onDuty = records(data, 'roster').find((r) => r.status === 'onduty')!;
    const site = siteOfShift(data, onDuty)!;
    expect(reason(move('roster', onDuty, 'off', 'u_ctl'))).toMatch(/No signed shift handover entry/);
    const entry = (status: string): DemoRecord => ({ id: 'ob_x', ref: 'OB-9999', status, history: [], createdAt: '', updatedAt: '', values: { site: site.id, date: TODAY, time: '17:55', shift: 'day', type: 'handover', entry: 'Handed over.', by: 'Tester' } });
    const withEntry = (status: string): IndustryData => ({ ...data, collections: { ...data.collections, ob: [entry(status), ...records(data, 'ob')] } });
    expect(bookOffProblem(withEntry('draft'), onDuty)).toMatch(/handover/);
    expect(bookOffProblem(withEntry('signed'), onDuty)).toBeNull();
    expect(applyTransition(wf('roster'), onDuty, 'off', user('u_ctl'), withEntry('signed'), undefined, 'Tester')).toMatchObject({ ok: true });
  });

  it('attributes night-shift entries written after midnight to the previous date’s shift', () => {
    const e = (date: string, time: string, shift: string) => entrySlot({ id: 'x', ref: 'x', history: [], createdAt: '', updatedAt: '', values: { date, time, shift } });
    expect(e('2026-11-11', '05:55', 'night')).toEqual({ date: '2026-11-10', kind: 'night' });
    expect(e('2026-11-11', '22:10', 'night')).toEqual({ date: '2026-11-11', kind: 'night' });
    expect(e('2026-11-11', '17:55', 'day')).toEqual({ date: '2026-11-11', kind: 'day' });
    // An entry tied to its shift by an explicit shift date counts for that shift whenever it is written.
    expect(entrySlot({ id: 'x', ref: 'x', history: [], createdAt: '', updatedAt: '', values: { date: '2026-11-12', time: '09:30', shift: 'day', shiftDate: '2026-11-11' } })).toEqual({ date: '2026-11-11', kind: 'day' });
    expect(currentSlot(TODAY)).toEqual({ date: TODAY, kind: 'day' });
    // Every site handed over the shift that ended at 06:00 this morning.
    for (const s of records(data, 'sites')) expect(handoverEntry(data, s.id, '2026-11-10', 'night')).toBeTruthy();
  });

  it('locks signed occurrence book entries behind a sign step', () => {
    const draft = records(data, 'ob').find((e) => e.status === 'draft')!;
    expect(reason(move('ob', withValues(draft, { entry: ' ' }), 'signed', 'u_ctl'))).toMatch(/Write the entry/);
    expect(move('ob', draft, 'signed', 'u_ctl')).toMatchObject({ ok: true });
    expect(move('ob', draft, 'signed', 'u_acc')).toMatchObject({ ok: false });
    const signed = records(data, 'ob').find((e) => e.status === 'signed')!;
    // No transition leaves "signed": the entry can only be followed up.
    expect(wf('ob').transitions.filter((t) => [t.from].flat().includes('signed'))).toEqual([]);
    expect(move('ob', signed, 'draft', 'u_dir')).toMatchObject({ ok: false });
  });
});

describe('coverage helpers', () => {
  it('computes coverage % for the running shift', () => {
    const day = coverage(data, TODAY, 'day');
    expect(day).toMatchObject({ posts: 26, covered: 24, onDuty: 23, pct: 92 });
    expect(day.unfilled).toHaveLength(2);
    expect(coverageNow(data, TODAY)).toMatchObject({ covered: 24, posts: 26, slot: { date: TODAY, kind: 'day' } });
    const night = coverage(data, TODAY, 'night');
    expect(night.posts).toBe(22);
    expect(night.onDuty).toBe(0);
    const both = dailyCoverage(data, TODAY);
    expect(both.posts).toBe(48);
    expect(both.pct).toBe(Math.round(((day.covered + night.covered) / 48) * 100));
  });

  it('counts unrostered posts as unfilled and reports coverage per site', () => {
    const farFuture = coverage(data, addDays(TODAY, 30), 'day');
    expect(farFuture).toMatchObject({ posts: 26, covered: 0, pct: 0 });
    expect(farFuture.unfilled[0].reason).toBe('Not rostered');
    const site = records(data, 'sites')[0];
    const s = coverage(data, TODAY, 'day', site.id);
    expect(s.posts).toBe(5);
    expect(s.covered).toBe(4);
    expect(s.pct).toBe(80);
  });

  it('measures absenteeism over the roster history', () => {
    const a = absenteeism(data, addDays(TODAY, -14), addDays(TODAY, -1));
    expect(a.absent).toBeGreaterThan(5);
    expect(a.relieved).toBeLessThan(a.absent);
    expect(a.pct).toBe(Math.round((a.absent / a.shifts) * 1000) / 10);
  });
});

describe('armed response call-outs', () => {
  const vehicle = (assetNo: string) => records(data, 'equipment').find((e) => e.values.assetNo === assetNo)!;
  const signal = () => get('callouts', SEED.guideCallout);

  it('needs an available response vehicle to dispatch', () => {
    expect(reason(move('callouts', signal(), 'dispatched', 'u_ctl'))).toMatch(/Choose a response vehicle/);
    expect(reason(move('callouts', withValues(signal(), { vehicle: vehicle(SEED.vehicleRepair).id }), 'dispatched', 'u_ctl'))).toMatch(/in for repair/);
    expect(reason(move('callouts', withValues(signal(), { vehicle: vehicle(SEED.vehicleBusy).id }), 'dispatched', 'u_ctl'))).toMatch(/already committed to CO-0002/);
    expect(reason(move('callouts', withValues(signal(), { vehicle: vehicle('VEH-05').id }), 'dispatched', 'u_ctl'))).toMatch(/licence disc expired/);
    expect(reason(move('callouts', withValues(signal(), { vehicle: get('equipment', SEED.guideFirearm).id }), 'dispatched', 'u_ctl'))).toMatch(/not a vehicle/);
    expect(move('callouts', withValues(signal(), { vehicle: vehicle(SEED.vehicleAvailable).id }), 'dispatched', 'u_ctl')).toMatchObject({ ok: true });
    expect(move('callouts', withValues(signal(), { vehicle: vehicle(SEED.vehicleAvailable).id }), 'dispatched', 'u_acc')).toMatchObject({ ok: false });
    expect(availableVehicles(data, SEED.guideCallout, TODAY).map((v) => v.values.assetNo)).toEqual(['VEH-01', 'VEH-06']);
  });

  it('reports when no vehicle is left to send', () => {
    const none: IndustryData = { ...data, collections: { ...data.collections, equipment: records(data, 'equipment').map((e) => (e.values.category === 'vehicle' ? { ...e, status: 'repair' } : e)) } };
    const res = applyTransition(wf('callouts'), signal(), 'dispatched', user('u_ctl'), none, undefined, 'Tester');
    expect(reason(res)).toMatch(/No response vehicle is available/);
  });

  it('will not record an on-scene time before the dispatch time', () => {
    const dispatched = records(data, 'callouts').find((c) => c.status === 'dispatched')!;
    expect(str(dispatched, 'dispatchedAt')).toBe('07:33');
    expect(reason(move('callouts', withValues(dispatched, { onSceneAt: '07:30' }), 'onscene', 'u_ctl'))).toMatch(/On-scene time 07:30 is before the dispatch time 07:33/);
    expect(move('callouts', withValues(dispatched, { onSceneAt: '07:40' }), 'onscene', 'u_ctl')).toMatchObject({ ok: true });
    // With no time typed the step uses a suggestion derived from the dispatch time, never the clock.
    expect(suggestedTime(dispatched, 'onscene')).toBe('07:41');
    expect(move('callouts', dispatched, 'onscene', 'u_ctl')).toMatchObject({ ok: true });
    expect(minutesFromTo('23:55', '00:06')).toBe(11);
  });

  it('needs an outcome to stand down and a note to cancel', () => {
    const onScene = records(data, 'callouts').find((c) => c.status === 'onscene')!;
    expect(reason(move('callouts', onScene, 'stooddown', 'u_ctl'))).toMatch(/Select the outcome/);
    expect(move('callouts', withValues(onScene, { outcome: 'false' }), 'stooddown', 'u_ctl')).toMatchObject({ ok: true });
    expect(move('callouts', signal(), 'cancelled', 'u_ctl')).toEqual({ ok: false, reason: 'A note is required for this step.' });
  });

  it('measures response time against the SLA', () => {
    const c = (values: Values, status = 'stooddown'): DemoRecord => ({ id: 'c', ref: 'CO-X', status, history: [], createdAt: '', updatedAt: '', values: { site: 'sites_1', date: TODAY, ...values } });
    expect(responseMinutes(c({ receivedAt: '10:00', onSceneAt: '10:12' }))).toBe(12);
    expect(responseMinutes(c({ receivedAt: '23:52', onSceneAt: '00:05' }))).toBe(13);
    expect(responseMinutes(c({ receivedAt: '10:00' }))).toBeNull();
    expect(slaState(data, c({ receivedAt: '10:00', onSceneAt: '10:15' }))).toEqual({ state: 'met', minutes: 15, sla: 15, dueBy: '10:15' });
    expect(slaState(data, c({ receivedAt: '10:00', onSceneAt: '10:16' }))).toEqual({ state: 'breached', minutes: 16, sla: 15, dueBy: '10:15' });
    // The hospital contract has a 10-minute SLA.
    const hospital = records(data, 'sites').find((s) => s.values.code === 'HPH')!;
    expect(slaState(data, c({ site: hospital.id, receivedAt: '10:00', onSceneAt: '10:12' }))).toMatchObject({ state: 'breached', sla: 10 });
    // Until the vehicle arrives the call-out is running against a due-by time (signal + SLA), worked out from the record alone.
    expect(slaState(data, c({ receivedAt: '11:50' }, 'dispatched'))).toEqual({ state: 'running', minutes: 0, sla: 15, dueBy: '12:05' });
    expect(slaState(data, c({ receivedAt: '23:50' }, 'received'))).toMatchObject({ state: 'running', dueBy: '00:05' });
  });

  it('averages response times for the dashboard', () => {
    const stats = responseStats(data, addDays(TODAY, -30), TODAY);
    const done = records(data, 'callouts').filter((c) => str(c, 'date') >= addDays(TODAY, -30) && responseMinutes(c) !== null);
    expect(stats.count).toBe(done.length);
    expect(stats.avg).toBe(Math.round((done.reduce((n, c) => n + responseMinutes(c)!, 0) / done.length) * 10) / 10);
    expect(stats.within + stats.breaches).toBe(stats.count);
    expect(stats.breaches).toBeGreaterThan(0);
    expect(stats.avg).toBeLessThan(15);
  });
});

describe('incidents', () => {
  it('cannot report to the client without a root cause and, if serious, a SAPS case number or reason', () => {
    const breakIn = get('incidents', SEED.guideIncident);
    expect(breakIn).toMatchObject({ status: 'investigating', values: { severity: 'high' } });
    expect(reason(move('incidents', breakIn, 'clientreport', 'u_ctl'))).toMatch(/root cause/);
    const caused = withValues(breakIn, { rootCause: 'East fence alarm zone was bypassed.' });
    expect(reason(move('incidents', caused, 'clientreport', 'u_ctl'))).toMatch(/SAPS case number \(DEMO-CAS/);
    expect(move('incidents', withValues(caused, { sapsCase: 'DEMO-CAS 214/11/2026' }), 'clientreport', 'u_ctl')).toMatchObject({ ok: true });
    expect(move('incidents', withValues(caused, { noSapsReason: 'Client declined to open a case.' }), 'clientreport', 'u_ctl')).toMatchObject({ ok: true });
  });

  it('logs the client report as a side effect without sending anything', () => {
    const t = wf('incidents').transitions.find((x) => x.to === 'clientreport')!;
    const api = mockApi();
    const record = get('incidents', SEED.guideIncident);
    t.after!({ record, data, api, today: TODAY, user: user('u_ctl') });
    expect(api.update).toHaveBeenCalledWith('incidents', record.id, { clientReportSent: true, clientReportOn: TODAY });
    expect(api.toast).toHaveBeenCalledWith(expect.stringMatching(/nothing is actually sent/), 'info');
  });

  it('closing needs root cause, outcome, a logged client report and the close permission', () => {
    const reported = get('incidents', SEED.reportedIncident);
    expect(reported.status).toBe('clientreport');
    expect(reason(move('incidents', reported, 'closed', 'u_dir'))).toMatch(/Outcome not recorded/);
    const done = withValues(reported, { outcome: 'Patrol routine changed; no further loss.' });
    expect(move('incidents', done, 'closed', 'u_ctl')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
    expect(move('incidents', done, 'closed', 'u_dir')).toMatchObject({ ok: true });
    expect(reason(move('incidents', withValues(done, { clientReportSent: false }), 'closed', 'u_dir'))).toMatch(/Client report has not been logged/);
    expect(reason(move('incidents', withValues(done, { rootCause: '' }), 'closed', 'u_dir'))).toMatch(/Root cause/);
    expect(reason(move('incidents', withValues(done, { severity: 'high' }), 'closed', 'u_dir'))).toMatch(/SAPS/);
    expect(move('incidents', withValues(done, { severity: 'high', noSapsReason: 'No offence.' }), 'closed', 'u_dir')).toMatchObject({ ok: true });
  });
});

describe('equipment & armoury', () => {
  const firearm = () => get('equipment', SEED.guideFirearm);
  const issue = (item: DemoRecord, officer: string, who = 'u_arm') => move('equipment', withValues(item, { issuedTo: officer }), 'issued', who);
  const onShift = (armed: boolean) => records(data, 'officers').filter((o) => {
    const s = activeShiftFor(data, o.id, TODAY);
    return s && (postOf(data, s)?.values.armed === true) === armed;
  });

  it('issues a firearm only to a competent officer posted on an armed post this shift', () => {
    expect(reason(move('equipment', firearm(), 'issued', 'u_arm'))).toMatch(/Choose the officer/);
    const unarmedPost = onShift(false).find((o) => !str(o, 'competencyExpiry'))!;
    expect(issueProblems(data, firearm(), unarmedPost.id, TODAY).join(' ')).toMatch(/no firearm competency on record.*not an armed post/);
    expect(issue(firearm(), unarmedPost.id)).toMatchObject({ ok: false });
    // Competent, but not posted anywhere: refused.
    expect(reason(issue(firearm(), SEED.standby))).toMatch(/not posted on today’s day or night shift/);
    // Competent, but posted on an unarmed post: refused.
    const competentUnarmed = onShift(false).find((o) => str(o, 'competencyExpiry') >= TODAY);
    if (competentUnarmed) expect(reason(issue(firearm(), competentUnarmed.id))).toMatch(/not an armed post/);
    const armedPost = onShift(true).find((o) => !issueProblems(data, firearm(), o.id, TODAY).length)!;
    expect(issue(firearm(), armedPost.id)).toMatchObject({ ok: true });
    expect(issue(firearm(), armedPost.id, 'u_ctl')).toMatchObject({ ok: false });
    // One firearm per officer.
    const holder = records(data, 'equipment').find((e) => e.values.category === 'firearm' && e.status === 'issued')!;
    expect(reason(issue(firearm(), str(holder, 'issuedTo')))).toMatch(/already holds FA-00\d/);
  });

  it('never issues a firearm with an expired licence', () => {
    const expired = get('equipment', SEED.expiredFirearm);
    const armedPost = onShift(true).find((o) => !issueProblems(data, firearm(), o.id, TODAY).length)!;
    expect(reason(issue(expired, armedPost.id))).toMatch(/Firearm licence expired on .* cannot be issued/);
  });

  it('issues other equipment to anyone on shift and records the shift it was issued for', () => {
    const radio = records(data, 'equipment').find((e) => e.values.category === 'radio' && e.status === 'instore')!;
    const anyone = onShift(false)[0];
    expect(issue(radio, anyone.id)).toMatchObject({ ok: true });
    expect(reason(issue(radio, SEED.standby))).toMatch(/issued at book-on/);
    const t = wf('equipment').transitions.find((x) => x.to === 'issued')!;
    const api = mockApi();
    t.after!({ record: withValues(radio, { issuedTo: anyone.id }), data, api, today: TODAY, user: user('u_arm') });
    expect(api.update).toHaveBeenCalledWith('equipment', radio.id, { issuedShift: activeShiftFor(data, anyone.id, TODAY)!.id, issuedOn: TODAY });
  });

  it('flags items not returned after the shift they were issued for has ended', () => {
    const late = records(data, 'equipment').filter((e) => notReturned(data, e, TODAY));
    expect(late.map((e) => e.values.assetNo).sort()).toEqual(['BC-08', 'RAD-17']);
    const current = records(data, 'equipment').find((e) => e.status === 'issued' && !notReturned(data, e, TODAY))!;
    expect(notReturned(data, current, addDays(TODAY, 1))).toBe(true);
    // Booking the officer off also makes an unreturned item overdue, the same day.
    const bookedOff: IndustryData = { ...data, collections: { ...data.collections, roster: records(data, 'roster').map((r) => (r.id === current.values.issuedShift ? { ...r, status: 'off' } : r)) } };
    expect(notReturned(bookedOff, current, TODAY)).toBe(true);
    const flags = config.collections.find((c) => c.key === 'equipment')!.flags!(late[0], data, TODAY, user('u_arm'));
    expect(flags.map((f) => f.label)).toContain('Not returned after shift end');
    expect(move('equipment', late[0], 'instore', 'u_arm')).toMatchObject({ ok: true });
    expect(move('equipment', late[0], 'lost', 'u_arm')).toEqual({ ok: false, reason: 'A note is required for this step.' });
  });
});

describe('officers, patrols and inspections', () => {
  it('flags registrations and competencies expiring within 30 days', () => {
    const states = records(data, 'officers').flatMap((o) => officerExpiries(o, TODAY).filter((e) => e.key === 'psiraExpiry').map((e) => e.state));
    expect(states.filter((s) => s === 'overdue')).toHaveLength(2);
    expect(states.filter((s) => s === 'due-soon')).toHaveLength(5);
    const flags = config.collections.find((c) => c.key === 'officers')!.flags!(get('officers', SEED.expiredPsira), data, TODAY, user('u_hr'));
    expect(flags.map((f) => f.label)).toEqual(expect.arrayContaining(['Not deployable', 'PSIRA registration expired']));
    expect(config.collections.find((c) => c.key === 'officers')!.fields.find((f) => f.key === 'hrNotes')!.permission).toBe('hr.notes');
  });

  it('flags missed checkpoints and late rounds, and needs a reason to complete a short round', () => {
    const done = records(data, 'patrols').filter((p) => p.status === 'completed');
    expect(done.some((p) => patrolMissed(p) > 0)).toBe(true);
    expect(done.some((p) => patrolLateBy(p) > 0)).toBe(true);
    const running = records(data, 'patrols').find((p) => p.status === 'started')!;
    expect(reason(move('patrols', running, 'completed', 'u_sup'))).toMatch(/how many checkpoints/);
    expect(reason(move('patrols', withValues(running, { scanned: 6 }), 'completed', 'u_sup'))).toMatch(/2 checkpoint\(s\) not scanned/);
    expect(move('patrols', withValues(running, { scanned: 6, missedPoints: 'CP7, CP8 — gate locked' }), 'completed', 'u_sup')).toMatchObject({ ok: true });
    expect(move('patrols', withValues(running, { scanned: 8 }), 'completed', 'u_sup')).toMatchObject({ ok: true });
    expect(reason(move('patrols', withValues(running, { scanned: 9 }), 'completed', 'u_sup'))).toMatch(/between 0 and 8/);
    const second = records(data, 'patrols').filter((p) => p.status === 'started')[1];
    expect(patrolLateBy(second)).toBe(31);
  });

  it('scores an inspection, raises corrective actions for findings and tracks overdue sites', () => {
    const draft = get('inspections', SEED.guideInspection);
    expect(inspectionScore(draft)).toMatchObject({ score: 7, max: 10, pct: 70, complete: true });
    expect(inspectionScore(draft).failed.map((f) => f.key)).toEqual(['postOrders', 'obUpToDate']);
    expect(reason(move('inspections', withValues(draft, { alertness: '' }), 'submitted', 'u_sup'))).toMatch(/Score all five/);
    expect(reason(move('inspections', withValues(draft, { findings: '' }), 'submitted', 'u_sup'))).toMatch(/Describe the findings/);
    expect(move('inspections', draft, 'submitted', 'u_ctl')).toMatchObject({ ok: false });
    expect(move('inspections', draft, 'submitted', 'u_sup')).toMatchObject({ ok: true });
    const api = mockApi();
    wf('inspections').transitions[0].after!({ record: draft, data, api, today: TODAY, user: user('u_sup') });
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.create).toHaveBeenCalledWith('actions', expect.objectContaining({ site: str(draft, 'site'), inspection: draft.id, due: addDays(TODAY, 3) }), 'open', expect.stringContaining(draft.ref));
    const overdue = records(data, 'sites').filter((s) => inspectionOverdue(data, s.id, TODAY)).map((s) => s.values.code);
    expect(overdue.sort()).toEqual(['HPH', 'MOP', 'SLP']);
  });
});

describe('contracts & invoicing', () => {
  it('builds a monthly invoice from posts × rate, less unfilled-shift penalties, plus call-out extras', () => {
    const contract = records(data, 'contracts')[0];
    const values = buildInvoiceValues(data, contract, TODAY.slice(0, 7), TODAY, { unfilled: 2, billable: 3 });
    const inv: DemoRecord = { id: 'i', ref: 'INV-X', status: 'draft', history: [], createdAt: '', updatedAt: '', values };
    const t = invoiceTotals(inv);
    const guarding = contractMonthly(data, contract.id);
    expect(guarding).toBe(165300);
    expect(t.gross).toBe((guarding + 3 * 480) * 100);
    expect(t.penalty).toBe(2 * 950 * 100);
    expect(t.net).toBe(t.gross - t.penalty);
    expect(t.vat).toBe(Math.round(t.net * 0.15));
    expect(t.total).toBe(t.net + t.vat);
    expect((values.lines as unknown[]).length).toBe(8 + 1);
  });

  it('counts unfilled shifts from the live roster, ignoring shifts that have not ended', () => {
    const contract = records(data, 'contracts')[0];
    const period = TODAY.slice(0, 7);
    const live = unfilledShifts(data, contract.id, period, TODAY);
    expect(live.every((r) => (r.status === 'open' || r.status === 'absent') && str(r, 'date') < TODAY)).toBe(true);
    // Today's absence and tomorrow's unfilled post are not penalised yet; from tomorrow the absence is.
    expect(unfilledShifts(data, contract.id, period, addDays(TODAY, 1)).length).toBe(live.length + 1);
    expect(buildInvoiceValues(data, contract, period, TODAY).unfilledShifts).toBe(live.length);
  });

  it('flags contracts ending within 60 days and overdue invoices', () => {
    const flags = (key: string, r: DemoRecord) => config.collections.find((c) => c.key === key)!.flags!(r, data, TODAY, user('u_acc')).map((f) => f.label);
    const ending = records(data, 'contracts').filter((c) => flags('contracts', c).length);
    expect(ending.map((c) => flags('contracts', c)[0]).sort()).toEqual(['Ends in 20 days', 'Ends in 45 days']);
    const overdue = records(data, 'invoices').filter((i) => flags('invoices', i).length);
    expect(overdue).toHaveLength(1);
    expect(move('invoices', overdue[0], 'paid', 'u_acc')).toMatchObject({ ok: true });
    expect(move('invoices', overdue[0], 'paid', 'u_ctl')).toMatchObject({ ok: false });
  });
});

describe('guided walkthrough, end to end through the store', () => {
  const store = () => useStore.getState();
  const live = () => store().data.security!;
  const act = (collection: string, id: string, to: string, note?: string) => store().transition(config, collection, id, to, note);
  const signIn = (id: string) => store().signInAs('security', id);
  beforeEach(() => {
    useStore.setState({ data: { ...useStore.getState().data, security: buildIndustryData(config, TODAY) } });
  });

  it('every step opens a real screen as a user who can see it', () => {
    for (const step of config.guide!) {
      const [mod] = step.to.split('/');
      const u = data.users.find((x) => x.id === step.as)!;
      expect(u.isSuperAdmin || u.modules.includes(mod)).toBe(true);
    }
  });

  it('step 1: an ineligible officer is refused, an eligible one fills the post', () => {
    signIn('u_ctl');
    store().updateRecord(config, 'roster', SEED.guideShift, { officer: SEED.lowGrade });
    expect(act('roster', SEED.guideShift, 'posted')).toMatchObject({ ok: false });
    store().updateRecord(config, 'roster', SEED.guideShift, { officer: SEED.standby });
    expect(act('roster', SEED.guideShift, 'posted')).toMatchObject({ ok: true });
    expect(rec(live(), 'roster', SEED.guideShift)!.status).toBe('posted');
    expect(coverage(live(), addDays(TODAY, 1), 'day').covered).toBe(coverage(data, addDays(TODAY, 1), 'day').covered + 1);
  });

  it('step 2: book off is refused until the handover entry is signed', () => {
    signIn('u_ctl');
    const shift = records(live(), 'roster').find((r) => r.status === 'onduty')!;
    expect(act('roster', shift.id, 'off')).toMatchObject({ ok: false });
    const entry = store().createRecord(config, 'ob', { site: siteOfShift(live(), shift)!.id, date: TODAY, time: NOW, shift: 'day', type: 'handover', entry: 'Handed over, all in order.', by: 'Tester' }, 'draft');
    expect(act('roster', shift.id, 'off')).toMatchObject({ ok: false });
    expect(act('ob', entry.id, 'signed')).toMatchObject({ ok: true });
    expect(act('roster', shift.id, 'off')).toMatchObject({ ok: true });
    expect(rec(live(), 'roster', shift.id)).toMatchObject({ status: 'off', values: { bookedOff: NOW } });
  });

  it('step 3: dispatch, arrive on scene and stand down, stamping the times', () => {
    signIn('u_ctl');
    const id = SEED.guideCallout;
    expect(act('callouts', id, 'dispatched')).toMatchObject({ ok: false });
    store().updateRecord(config, 'callouts', id, { vehicle: availableVehicles(live(), id, TODAY)[0].id });
    expect(act('callouts', id, 'dispatched')).toMatchObject({ ok: true });
    expect(act('callouts', id, 'onscene')).toMatchObject({ ok: true });
    const c = rec(live(), 'callouts', id)!;
    expect(c.values).toMatchObject({ receivedAt: '07:42', dispatchedAt: '07:44', onSceneAt: '07:52' });
    expect(responseMinutes(c)).toBe(10);
    expect(slaState(live(), c).state).toBe('met');
    // The vehicle is now committed and cannot be sent to a second call-out.
    expect(availableVehicles(live(), 'other', TODAY).some((v) => v.id === c.values.vehicle)).toBe(false);
    expect(act('callouts', id, 'stooddown')).toMatchObject({ ok: false });
    store().updateRecord(config, 'callouts', id, { outcome: 'false' });
    expect(act('callouts', id, 'stooddown')).toMatchObject({ ok: true });
    expect(availableVehicles(live(), 'other', TODAY).some((v) => v.id === c.values.vehicle)).toBe(true);
  });

  it('step 4: the break-in is reported to the client and closed only when complete', () => {
    signIn('u_dir');
    const id = SEED.guideIncident;
    expect(act('incidents', id, 'clientreport')).toMatchObject({ ok: false });
    store().updateRecord(config, 'incidents', id, { rootCause: 'Fence alarm bypassed.', sapsCase: 'DEMO-CAS 301/11/2026' });
    expect(act('incidents', id, 'clientreport')).toMatchObject({ ok: true });
    expect(rec(live(), 'incidents', id)!.values.clientReportSent).toBe(true);
    expect(act('incidents', id, 'closed')).toMatchObject({ ok: false });
    store().updateRecord(config, 'incidents', id, { outcome: 'Stock loss claimed; fence repaired.' });
    expect(act('incidents', id, 'closed')).toMatchObject({ ok: true });
  });

  it('step 5: a firearm goes out to an armed-post officer and comes back', () => {
    signIn('u_arm');
    const id = SEED.guideFirearm;
    const item = rec(live(), 'equipment', id)!;
    const candidates = records(live(), 'officers').filter((o) => activeShiftFor(live(), o.id, TODAY));
    const bad = candidates.find((o) => issueProblems(live(), item, o.id, TODAY).length)!;
    const good = candidates.find((o) => !issueProblems(live(), item, o.id, TODAY).length)!;
    store().updateRecord(config, 'equipment', id, { issuedTo: bad.id });
    expect(act('equipment', id, 'issued')).toMatchObject({ ok: false });
    store().updateRecord(config, 'equipment', id, { issuedTo: good.id });
    expect(act('equipment', id, 'issued')).toMatchObject({ ok: true });
    expect(rec(live(), 'equipment', id)).toMatchObject({ status: 'issued', values: { issuedTo: good.id, issuedShift: activeShiftFor(live(), good.id, TODAY)!.id } });
    expect(act('equipment', id, 'instore')).toMatchObject({ ok: true });
    expect(rec(live(), 'equipment', id)!.values).toMatchObject({ issuedTo: '', issuedShift: '' });
  });

  it('step 6: submitting the inspection raises two corrective actions and clears the overdue flag', () => {
    signIn('u_sup');
    const before = records(live(), 'actions').length;
    const site = str(rec(live(), 'inspections', SEED.guideInspection), 'site');
    expect(inspectionOverdue(live(), site, TODAY)).toBe(true);
    expect(act('inspections', SEED.guideInspection, 'submitted')).toMatchObject({ ok: true });
    const raised = records(live(), 'actions').filter((a) => a.values.inspection === SEED.guideInspection);
    expect(records(live(), 'actions').length).toBe(before + 2);
    expect(raised.map((a) => str(a, 'description').split(':')[0]).sort()).toEqual(['Occurrence book up to date', 'Post orders known']);
    expect(inspectionOverdue(live(), site, TODAY)).toBe(false);
    expect(act('actions', raised[0].id, 'done')).toMatchObject({ ok: false });
    expect(act('actions', raised[0].id, 'done', 'Briefed both officers.')).toMatchObject({ ok: true });
  });
});

describe('screens', () => {
  // Server-renders each screen. The store hook reads its initial state on the server, so the seeded data is placed there.
  const initial = useStore.getInitialState() as { data: Record<string, IndustryData> };
  const original = initial.data;
  afterAll(() => { initial.data = original; });
  const render = (path: string) => renderToStaticMarkup(
    h(IndustryContext.Provider, { value: config }, h(MemoryRouter, { initialEntries: [path] }, h(Routes, null,
      h(Route, { path: '/security', element: h(config.dashboard) }),
      h(Route, { path: '/security/:module', element: h(ModuleView) }),
      h(Route, { path: '/security/:module/:id', element: h(ModuleDetailView) })))),
  );

  it('every module page and a record of every status renders for every simulated user', () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a.map(String).join(' ').slice(0, 300)); });
    for (const time of ['12:00']) {
      setTodayForTests(TODAY, time);
      const seeded = buildIndustryData(config, TODAY);
      for (const u of seeded.users) {
        initial.data = { security: { ...seeded, currentUserId: u.id } };
        const dash = render('/security');
        expect(dash).toContain('posts covered now');
        expect(dash).toContain(config.businessName);
        for (const m of config.modules) {
          expect(render(`/security/${m.key}`), m.key).toContain('<h1');
          if (!m.collection) continue;
          const byStatus = new Map(seeded.collections[m.collection].map((r) => [r.status ?? '', r.id]));
          for (const id of byStatus.values()) expect(render(`/security/${m.key}/${id}`), `${m.key}/${id}`).toContain('<h1');
        }
      }
    }
    spy.mockRestore();
    setTodayForTests(TODAY, NOW);
    expect(errors).toEqual([]);
  });

  it('never hard-codes the business name in a page', () => {
    initial.data = { security: buildIndustryData(config, TODAY) };
    const renamed = { ...config, businessName: 'Example Guarding Co' };
    const html = renderToStaticMarkup(h(IndustryContext.Provider, { value: renamed }, h(MemoryRouter, { initialEntries: ['/security/incidents/incidents_1'] }, h(Routes, null,
      h(Route, { path: '/security/:module/:id', element: h(ModuleDetailView) })))));
    expect(html).toContain('Example Guarding Co control room');
    expect(html).not.toContain('Sentinel Ridge');
  });
});
