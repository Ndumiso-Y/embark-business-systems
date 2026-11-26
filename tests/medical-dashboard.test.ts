import { describe, expect, it } from 'vitest';
import type { DemoRecord } from '../src/core/types';
import { cliniciansNow, flowRing, nowAndNext, visitFlow, visitsByHour, waitingLongest } from '../src/industries/medical/dashboardModel';
import medical from '../src/industries/medical';

const visit = (id: string, time: string, status: string, extra: Record<string, string> = {}): DemoRecord =>
  ({ id, ref: id, status, values: { time, date: '2026-11-26', patient: `p_${id}`, clinician: 'rc', ...extra }, createdAt: '', updatedAt: '', history: [] }) as unknown as DemoRecord;

const day = [
  visit('v1', '08:00', 'done'), visit('v2', '08:15', 'done', { clinician: 'tm' }), visit('v3', '08:30', 'billing'),
  visit('v4', '09:00', 'withdoctor', { clinician: 'tm' }), visit('v5', '09:15', 'triaged', { arrivedAt: '09:05' }),
  visit('v6', '09:30', 'arrived', { arrivedAt: '08:55' }), visit('v7', '10:00', 'booked'), visit('v8', '14:00', 'booked'),
  visit('v9', '08:45', 'dna'), visit('v10', '11:00', 'cancelled'),
];

describe('medical dashboard model', () => {
  it('counts the day by visit state; cancelled visits are left out of the total', () => {
    const f = visitFlow(day);
    expect(f).toMatchObject({ expected: 9, booked: 2, waiting: 2, withDoctor: 1, billing: 1, done: 2, dna: 1, cancelled: 1 });
    expect(f.booked + f.waiting + f.withDoctor + f.billing + f.done + f.dna).toBe(f.expected);
  });

  it('percentage is done ÷ visits not cancelled, as a whole number', () => {
    expect(visitFlow(day).donePct).toBe(22); // 2 of 9
    expect(visitFlow([visit('x', '08:00', 'cancelled')]).donePct).toBe(0);
    expect(visitFlow([]).donePct).toBe(0);
  });

  it('ring segments run from done to still to arrive, skip empty states and fill the ring', () => {
    const segs = flowRing(visitFlow(day));
    expect(segs.map((s) => s.key)).toEqual(['done', 'billing', 'withdoctor', 'waiting', 'booked', 'dna']);
    expect(segs.reduce((n, s) => n + s.share, 0)).toBeCloseTo(1, 10);
    expect(flowRing(visitFlow([]))).toEqual([]);
  });

  it('schedule preview: everyone in the practice, then the next to arrive, in time order', () => {
    expect(nowAndNext(day, 5).map((v) => v.id)).toEqual(['v3', 'v4', 'v5', 'v6', 'v7']);
    expect(nowAndNext([visit('a', '08:00', 'done'), visit('b', '09:00', 'done'), visit('c', '16:00', 'booked')], 2).map((v) => v.id)).toEqual(['b', 'c']);
  });

  it('waiting longest: arrived or triaged, earliest arrival first', () => {
    expect(waitingLongest(day).map((v) => v.id)).toEqual(['v6', 'v5']);
    expect(waitingLongest([visit('a', '08:00', 'arrived'), visit('b', '08:30', 'triaged', { arrivedAt: '08:20' })]).map((v) => v.id)).toEqual(['b', 'a']);
  });

  it('visits by hour cover at least 07:00 to 17:00 and add up to the day', () => {
    const hours = visitsByHour(day);
    expect(hours[0].hour).toBe(7);
    expect(hours[hours.length - 1].hour).toBe(17);
    expect(hours.reduce((n, h) => n + h.count, 0)).toBe(day.length);
    expect(hours.find((h) => h.hour === 8)?.count).toBe(4);
  });

  it('clinicians now: who each is with, seen today (billing or done) and still booked', () => {
    const list = cliniciansNow(day, [{ value: 'tm', label: 'Dr T', short: 'Dr T', role: 'GP' }, { value: 'rc', label: 'Dr R', short: 'Dr R', role: 'GP' }]);
    expect(list[0]).toMatchObject({ value: 'tm', seen: 1, booked: 0 });
    expect(list[0].current?.id).toBe('v4');
    expect(list[1]).toMatchObject({ value: 'rc', seen: 2, booked: 2, current: null });
  });

  it('uses only states that exist in the visits workflow, and opts into the navy shell', () => {
    const states = medical.collections.find((c) => c.key === 'visits')!.workflow!.states.map((s) => s.key);
    expect(states.sort()).toEqual(['arrived', 'billing', 'booked', 'cancelled', 'dna', 'done', 'triaged', 'withdoctor']);
    expect(medical.shell).toBe('navy');
  });
});
