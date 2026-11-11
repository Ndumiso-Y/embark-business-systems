import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config, { allergyConflict, claimProblems, consultProblems, resultFlags, setTodayForTests, vitalAlerts, vitalsProblems } from '../src/industries/medical';
import { applyTransition, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import type { DemoRecord, IndustryData } from '../src/core/types';

const TODAY = '2026-11-11';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;
const VITALS = { bpSys: 128, bpDia: 82, pulse: 76, temp: 36.8, spo2: 98, weight: 72 };

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('medical configuration', () => {
  it('is internally consistent', () => {
    expect(validateConfig(config)).toEqual([]);
  });
  it('seeds a realistic, deterministic practice', () => {
    const again = buildIndustryData(config, TODAY);
    expect(records(data, 'patients').length).toBe(24);
    const today = records(data, 'visits').filter((v) => str(v, 'date') === TODAY);
    expect(today.length).toBe(14);
    for (const s of ['booked', 'arrived', 'triaged', 'withdoctor', 'billing', 'done', 'dna']) expect(today.some((v) => v.status === s)).toBe(true);
    expect(records(data, 'consults').length).toBeGreaterThan(40);
    expect(records(data, 'results').some((r) => r.status === 'received' && r.values.abnormal)).toBe(true);
    expect(records(data, 'claims').some((c) => c.status === 'rejected')).toBe(true);
    expect(JSON.stringify(again.collections)).toBe(JSON.stringify(data.collections));
  });
  it('uses only fictional contact details and visibly fake tariff codes', () => {
    for (const p of records(data, 'patients')) {
      expect(str(p, 'email')).toMatch(/@example\.com$/);
      expect(str(p, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
    }
    for (const c of records(data, 'claims')) for (const l of (c.values.lines as Array<{ code?: string }>)) expect(l.code).toMatch(/^DEMO-/);
  });
});

describe('helpers (demo rules, not clinical advice)', () => {
  it('matches recorded allergies to medicine groups', () => {
    expect(allergyConflict('Penicillin (rash)', 'amoxicillin')).toMatchObject({ group: 'penicillin' });
    expect(allergyConflict('Sulphonamides (rash)', 'cotrimoxazole')).toMatchObject({ group: 'sulphonamide' });
    expect(allergyConflict('Aspirin and NSAIDs (wheeze)', 'ibuprofen')).toMatchObject({ group: 'NSAID' });
    expect(allergyConflict('No known allergies', 'amoxicillin')).toBeNull();
    expect(allergyConflict('Penicillin (rash)', 'azithromycin')).toBeNull();
    expect(allergyConflict('', 'amoxicillin')).toBeNull();
  });
  it('flags vitals for doctor review and validates triage entries', () => {
    expect(vitalAlerts(VITALS)).toEqual([]);
    expect(vitalAlerts({ ...VITALS, bpSys: 140 })[0].label).toMatch(/BP 140\/82 — for doctor review \(demo rule\)/);
    expect(vitalAlerts({ ...VITALS, bpDia: 90 })).toHaveLength(1);
    expect(vitalAlerts({ ...VITALS, temp: 38.0 })[0].label).toMatch(/Temp 38\.0/);
    expect(vitalAlerts({ ...VITALS, spo2: 93 })[0]).toMatchObject({ tone: 'red' });
    expect(vitalAlerts({ ...VITALS, spo2: 94 })).toEqual([]);
    expect(vitalsProblems(VITALS)).toEqual([]);
    expect(vitalsProblems({ ...VITALS, pulse: '' })[0]).toMatch(/missing: pulse/);
    expect(vitalsProblems({ ...VITALS, bpDia: 130, bpSys: 120 })[0]).toMatch(/Diastolic/);
    expect(vitalsProblems({ pulse: 110, temp: 37, spo2: 98, weight: 14 }, true)).toEqual([]);
  });
  it('flags results awaiting more than 7 days and abnormal unreviewed results', () => {
    const r = (status: string, requestedOn: string, abnormal = false) => ({ id: 'x', ref: 'LR-1', status, values: { requestedOn, abnormal }, history: [], createdAt: '', updatedAt: '' }) as DemoRecord;
    expect(resultFlags(r('requested', '2026-11-03'), TODAY)[0].label).toBe('Awaiting result > 7 days');
    expect(resultFlags(r('requested', '2026-11-05'), TODAY)).toEqual([]);
    expect(resultFlags(r('received', '2026-11-05', true), TODAY)[0].label).toBe('Abnormal, not yet reviewed');
  });
});

describe('practice workflows', () => {
  it('blocks issuing a script when the recorded allergy matches the drug group', () => {
    const draft = records(data, 'scripts').find((s) => s.status === 'draft' && str(s, 'medicine') === 'amoxicillin')!;
    const res = applyTransition(wf('scripts'), draft, 'issued', user('u_locum'), data, undefined, 'GP / locum doctor');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/^Recorded allergy: "Penicillin \(hives\)"/);
    const swapped: DemoRecord = { ...draft, values: { ...draft.values, medicine: 'azithromycin', strength: '500 mg tablet' } };
    expect(applyTransition(wf('scripts'), swapped, 'issued', user('u_locum'), data, undefined, 'GP / locum doctor')).toMatchObject({ ok: true });
    // Nurse cannot prescribe (simulated permission).
    expect(applyTransition(wf('scripts'), swapped, 'issued', user('u_nurse'), data, undefined, 'Practice nurse')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
  });
  it('requires vitals before a visit is triaged', () => {
    const arrived = records(data, 'visits').find((v) => v.status === 'arrived' && str(v, 'date') === TODAY)!;
    const blocked = applyTransition(wf('visits'), arrived, 'triaged', user('u_nurse'), data, undefined, 'Practice nurse');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toMatch(/Capture vitals before triage/);
    const withVitals: DemoRecord = { ...arrived, values: { ...arrived.values, ...VITALS } };
    expect(applyTransition(wf('visits'), withVitals, 'triaged', user('u_nurse'), data, undefined, 'Practice nurse')).toMatchObject({ ok: true });
    expect(applyTransition(wf('visits'), withVitals, 'triaged', user('u_rec'), data, undefined, 'Reception')).toMatchObject({ ok: false });
  });
  it('cannot sign a consultation without an ICD-10 code; reception cannot sign at all', () => {
    const draft = records(data, 'consults').find((c) => c.status === 'draft')!;
    expect(consultProblems(draft)).toContain('Select an ICD-10 code before signing.');
    const blocked = applyTransition(wf('consults'), draft, 'signed', user('u_locum'), data, undefined, 'GP / locum doctor');
    expect(blocked).toEqual({ ok: false, reason: 'Select an ICD-10 code before signing.' });
    const fixed: DemoRecord = { ...draft, values: { ...draft.values, icd10: 'J02.9' } };
    expect(applyTransition(wf('consults'), fixed, 'signed', user('u_locum'), data, undefined, 'GP / locum doctor')).toMatchObject({ ok: true, record: { status: 'signed' } });
    expect(applyTransition(wf('consults'), fixed, 'signed', user('u_rec'), data, undefined, 'Reception')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
    expect(applyTransition(wf('consults'), { ...fixed, status: 'signed' }, 'addendum', user('u_locum'), data, '', 'GP / locum doctor')).toMatchObject({ ok: false });
  });
  it('only a doctor (results.review) can mark a result as reviewed', () => {
    const received = records(data, 'results').find((r) => r.status === 'received' && r.values.abnormal)!;
    expect(applyTransition(wf('results'), received, 'reviewed', user('u_nurse'), data, undefined, 'Practice nurse')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
    expect(applyTransition(wf('results'), received, 'reviewed', user('u_gp'), data, undefined, 'GP / locum doctor')).toMatchObject({ ok: true });
  });
  it('sends a visit to billing only after its consultation is signed', () => {
    const withDoctor = records(data, 'visits').filter((v) => v.status === 'withdoctor' && str(v, 'date') === TODAY);
    for (const v of withDoctor) expect(applyTransition(wf('visits'), v, 'billing', user('u_gp'), data, undefined, 'GP')).toMatchObject({ ok: false });
  });
  it('will not submit a scheme claim without ICD-10 or a membership number', () => {
    const claim = records(data, 'claims').find((c) => c.status === 'draft' && str(c, 'scheme') !== 'private')!;
    expect(claimProblems(claim, data)).toEqual([]);
    expect(claimProblems({ ...claim, values: { ...claim.values, icd10: '' } }, data)[0]).toMatch(/ICD-10/);
    expect(claimProblems({ ...claim, values: { ...claim.values, memberNo: '' } }, data)[0]).toMatch(/membership/);
    expect(applyTransition(wf('claims'), { ...claim, values: { ...claim.values, icd10: '' } }, 'submitted', user('u_bill'), data, undefined, 'Billing')).toMatchObject({ ok: false });
    expect(applyTransition(wf('claims'), claim, 'submitted', user('u_bill'), data, undefined, 'Billing')).toMatchObject({ ok: true });
  });
});

describe('clinical flags respect the simulated role', () => {
  it('shows vitals alerts to clinicians but not to reception', () => {
    const visits = config.collections.find((c) => c.key === 'visits')!;
    const gp = data.users.find((u) => u.id === 'u_gp')!;
    const rec = data.users.find((u) => u.id === 'u_rec')!;
    const alerted = records(data, 'visits').find((v) => (visits.flags?.(v, data, TODAY, gp) ?? []).length > 0);
    expect(alerted).toBeDefined();
    expect(visits.flags!(alerted!, data, TODAY, rec)).toEqual([]);
  });
});
