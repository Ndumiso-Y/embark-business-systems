import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config, { claimOutstanding, claimProblems, examProblems, orderProblems, setTodayForTests, tariffForExam } from '../src/industries/optometry';
import { anisometropia, formatEye, iopFlag, sphericalEquivalent, transpose, validateEye, validVA } from '../src/industries/optometry/rx';
import { applyTransition, findRecord, findTransition, lines, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import type { DemoRecord, EffectApi, IndustryData, Values } from '../src/core/types';

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

/** Records what a transition's side effect asks the store to do. */
function spyApi() {
  const calls = { created: [] as Array<{ collection: string; values: Values; status?: string }>, updated: [] as Array<{ collection: string; id: string; values: Values }>, moved: [] as Array<{ collection: string; id: string; to: string }>, toasts: [] as string[] };
  const api: EffectApi = {
    create: (collection, values, status) => { calls.created.push({ collection, values, status }); return { id: `${collection}_new`, ref: 'NEW-0001', status, values, history: [], createdAt: '', updatedAt: '' }; },
    update: (collection, id, values) => { calls.updated.push({ collection, id, values }); },
    transition: (collection, id, to) => { calls.moved.push({ collection, id, to }); return { ok: true, value: findRecord(data, collection, id)! }; },
    toast: (text) => { calls.toasts.push(text); },
  };
  return { api, calls };
}

describe('what one step sets in motion', () => {
  it('finalising an exam issues the prescription, supersedes the old one, moves the recall and drafts the exam fee', () => {
    const draft = records(data, 'exams').find((e) => e.status === 'draft')!;
    const exam: DemoRecord = { ...draft, status: 'final', values: { ...draft.values, diagnosis: 'H52.1' } };
    const { api, calls } = spyApi();
    findTransition(wf('exams'), 'draft', 'final')!.after!({ record: exam, data, api, today: TODAY, user: user('u_opt') });
    const patient = str(exam, 'patient');
    expect(calls.updated.find((u) => u.collection === 'patients')).toMatchObject({ id: patient, values: { lastExam: TODAY } });
    const old = records(data, 'prescriptions').filter((r) => str(r, 'patient') === patient && r.status === 'issued').map((r) => r.id);
    expect(calls.moved.map((m) => m.id)).toEqual(old);
    expect(calls.created.find((c) => c.collection === 'prescriptions')).toMatchObject({ status: 'issued', values: { patient, exam: exam.id } });
    const claim = calls.created.find((c) => c.collection === 'claims')!;
    expect(claim).toMatchObject({ status: 'draft', values: { patient, exam: exam.id, icd10: 'H52.1' } });
    expect((claim.values.lines as Array<{ code?: string }>)[0].code).toBe(tariffForExam(exam, data).code);
    expect(calls.toasts[0]).toMatch(/^Prescription issued, recall date updated, draft claim/);
  });
  it('explains every reason a quote cannot go to the lab', () => {
    const quote = records(data, 'orders').find((o) => o.status === 'quote')!;
    const keys = (v: Values) => orderProblems({ ...quote, values: { ...quote.values, ...v } }, data).map((p) => p.key);
    expect(keys({})).toEqual(['expired']);
    const valid = records(data, 'prescriptions').find((r) => r.status === 'issued' && str(r, 'expiry') > TODAY)!.id;
    expect(keys({ prescription: valid })).toEqual([]);
    expect(keys({ prescription: valid, frame: '', pd: null })).toEqual(['pd', 'frame']);
    const cloth = records(data, 'stock').find((x) => str(x, 'category') === 'accessory')!.id;
    expect(keys({ prescription: valid, frame: cloth })).toEqual(['frame']);
    const sold = records(data, 'stock').find((x) => str(x, 'category') === 'frame' && Number(x.values.qty) === 0)!.id;
    expect(keys({ prescription: valid, frame: sold })).toEqual(['stock']);
    expect(keys({ prescription: valid, funding: 'private', deposit: 0 })).toEqual(['deposit']);
    expect(keys({ prescription: valid, kind: 'cl', frame: '', pd: null })).toEqual([]);
  });
  it('passing quality check stamps the ready date; collecting scheme-funded eyewear lands on a claim', () => {
    const order = records(data, 'orders').find((o) => o.status === 'ready' && str(o, 'funding') === 'scheme')!;
    const ready = spyApi();
    findTransition(wf('orders'), 'received', 'ready')!.after!({ record: order, data, api: ready.api, today: TODAY, user: user('u_disp') });
    expect(ready.calls.updated[0]).toMatchObject({ collection: 'orders', id: order.id, values: { readySince: TODAY } });
    const done = spyApi();
    findTransition(wf('orders'), 'ready', 'collected')!.after!({ record: order, data, api: done.api, today: TODAY, user: user('u_disp') });
    const draft = records(data, 'claims').find((c) => str(c, 'patient') === str(order, 'patient') && c.status === 'draft');
    const written = draft ? done.calls.updated.find((u) => u.collection === 'claims')!.values : done.calls.created.find((c) => c.collection === 'claims')!.values;
    expect(written.order).toBe(order.id);
    const added = (written.lines as Array<{ code?: string }>).slice(-lines(order).length);
    expect(added.every((l) => /^DEMO-(FR1|LN1)$/.test(l.code ?? ''))).toBe(true);
  });
  it('submitting stamps the date and settling records what the patient paid', () => {
    const part = records(data, 'claims').find((c) => c.status === 'partpaid')!;
    expect(claimOutstanding(part)).toBeGreaterThan(0);
    const { api, calls } = spyApi();
    findTransition(wf('claims'), 'partpaid', 'settled')!.after!({ record: part, data, api, today: TODAY, user: user('u_mgr') });
    expect(claimOutstanding({ ...part, values: { ...part.values, ...calls.updated[0].values } })).toBe(0);
    const sub = spyApi();
    findTransition(wf('claims'), 'draft', 'submitted')!.after!({ record: part, data, api: sub.api, today: TODAY, user: user('u_mgr') });
    expect(sub.calls.updated[0].values).toEqual({ submittedOn: TODAY });
  });
  it('seeds no recall that fell due before the patient’s latest exam', () => {
    for (const p of records(data, 'patients')) if (str(p, 'lastExam')) expect(str(p, 'recallDue') >= str(p, 'lastExam'), `${p.ref}`).toBe(true);
    expect(records(data, 'patients').filter((p) => str(p, 'recallDue') < TODAY).length).toBeGreaterThanOrEqual(5);
  });
});
