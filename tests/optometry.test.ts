import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config, { claimProblems, examProblems, setTodayForTests } from '../src/industries/optometry';
import { anisometropia, formatEye, iopFlag, sphericalEquivalent, transpose, validateEye, validVA } from '../src/industries/optometry/rx';
import { applyTransition, findRecord, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import type { DemoRecord, IndustryData } from '../src/core/types';

const TODAY = '2026-11-11';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('optometry configuration', () => {
  it('is internally consistent', () => {
    expect(validateConfig(config)).toEqual([]);
  });
  it('seeds a realistic, deterministic practice', () => {
    const again = buildIndustryData(config, TODAY);
    expect(records(again, 'patients').length).toBe(26);
    expect(records(data, 'appointments').filter((a) => str(a, 'date') === TODAY).length).toBe(16);
    expect(records(data, 'exams').some((e) => e.status === 'draft')).toBe(true);
    expect(records(data, 'orders').some((o) => o.status === 'ready')).toBe(true);
    expect(records(data, 'claims').some((c) => c.status === 'rejected')).toBe(true);
    expect(JSON.stringify(records(again, 'exams').map((e) => e.values))).toBe(JSON.stringify(records(data, 'exams').map((e) => e.values)));
  });
  it('uses only fictional contact details', () => {
    for (const p of records(data, 'patients')) {
      expect(str(p, 'email')).toMatch(/@example\.com$/);
      expect(str(p, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
    }
  });
});

describe('prescription rules (data entry, not clinical advice)', () => {
  it('validates sphere, cylinder, axis and add', () => {
    expect(validateEye({ sph: -1.25, cyl: -0.5, axis: 180, add: 2 })).toEqual({});
    expect(validateEye({ sph: -1.3 })).toHaveProperty('sph');
    expect(validateEye({ sph: 0, cyl: -0.75 })).toHaveProperty('axis');
    expect(validateEye({ sph: 0, cyl: -0.75, axis: 181 })).toHaveProperty('axis');
    expect(validateEye({ sph: 1, add: 4 })).toHaveProperty('add');
    expect(validateEye({ sph: null })).toHaveProperty('sph');
  });
  it('formats, transposes and computes spherical equivalent', () => {
    expect(formatEye({ sph: -1.25, cyl: -0.5, axis: 5 })).toBe('−1.25 / −0.50 × 005');
    expect(formatEye({ sph: 0 })).toBe('Plano DS');
    expect(transpose({ sph: -1.25, cyl: -0.5, axis: 180 })).toEqual({ sph: -1.75, cyl: 0.5, axis: 90 });
    expect(sphericalEquivalent({ sph: 1, cyl: -1 })).toBe(0.5);
    expect(anisometropia({ sph: -1 }, { sph: -3.25 })).toBe(true);
    expect(iopFlag(23)).toBe('review');
    expect(iopFlag(16)).toBe('ok');
    expect(validVA('6/7.5')).toBe(true);
    expect(validVA('20/20')).toBe(false);
  });
});

describe('practice workflows', () => {
  it('cannot finalise an exam without a diagnosis, and issues Rx data once valid', () => {
    const draft = records(data, 'exams').find((e) => e.status === 'draft')!;
    expect(examProblems(draft)).toContain('Select a diagnosis code before finalising.');
    const blocked = applyTransition(wf('exams'), draft, 'final', user('u_opt'), data, undefined, 'Optometrist');
    expect(blocked).toMatchObject({ ok: false });
    const fixed: DemoRecord = { ...draft, values: { ...draft.values, diagnosis: 'H52.1' } };
    expect(applyTransition(wf('exams'), fixed, 'final', user('u_opt'), data, undefined, 'Optometrist')).toMatchObject({ ok: true });
  });
  it('front desk cannot finalise exams (simulated permission)', () => {
    const draft = records(data, 'exams').find((e) => e.status === 'draft')!;
    const fixed = { ...draft, values: { ...draft.values, diagnosis: 'H52.1' } };
    expect(applyTransition(wf('exams'), fixed, 'final', user('u_fd'), data, undefined, 'Front desk')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
  });
  it('only checks patients in on the day of the appointment', () => {
    const future = records(data, 'appointments').find((a) => a.status === 'booked' && str(a, 'date') > TODAY)!;
    const todays = records(data, 'appointments').find((a) => a.status === 'booked' && str(a, 'date') === TODAY)!;
    expect(applyTransition(wf('appointments'), future, 'arrived', user('u_fd'), data, undefined, 'Front desk')).toMatchObject({ ok: false });
    expect(applyTransition(wf('appointments'), todays, 'arrived', user('u_fd'), data, undefined, 'Front desk')).toMatchObject({ ok: true });
  });
  it('blocks lab orders against an expired prescription', () => {
    const quote = records(data, 'orders').find((o) => o.status === 'quote' && str(findRecord(data, 'prescriptions', str(o, 'prescription')), 'expiry') < TODAY)!;
    const res = applyTransition(wf('orders'), quote, 'ordered', user('u_disp'), data, undefined, 'Dispenser');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/expired/);
  });
  it('requires a note to fail quality check', () => {
    const o = { ...records(data, 'orders')[0], status: 'received' };
    expect(applyTransition(wf('orders'), o, 'remake', user('u_disp'), data, '', 'Dispenser')).toMatchObject({ ok: false });
    expect(applyTransition(wf('orders'), o, 'remake', user('u_disp'), data, 'Scratched lens', 'Dispenser')).toMatchObject({ ok: true });
  });
  it('will not submit a medical aid claim without ICD-10 or for a private patient', () => {
    const claim = records(data, 'claims').find((c) => c.status === 'draft' && str(c, 'scheme') !== 'private')!;
    expect(claimProblems(claim, data)).toEqual([]);
    expect(claimProblems({ ...claim, values: { ...claim.values, icd10: '' } }, data)[0]).toMatch(/ICD-10/);
    expect(claimProblems({ ...claim, values: { ...claim.values, scheme: 'private' } }, data)[0]).toMatch(/Private/);
  });
});
