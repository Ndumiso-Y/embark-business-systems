import { describe, expect, it } from 'vitest';
import type { DemoRecord } from '../src/core/types';
import { flowSegments, flowSummary, nowAndNext, recentPatients } from '../src/industries/optometry/dashboardModel';
import optometry from '../src/industries/optometry';

const appt = (id: string, time: string, status: string, patient = `p_${id}`): DemoRecord =>
  ({ id, ref: id, status, values: { time, patient, date: '2026-11-20' }, createdAt: '', updatedAt: '', history: [] }) as unknown as DemoRecord;

const day = [
  appt('a1', '08:00', 'completed'), appt('a2', '08:30', 'completed'), appt('a3', '09:00', 'noshow'),
  appt('a4', '09:30', 'dispensing'), appt('a5', '10:00', 'inexam'), appt('a6', '10:30', 'pretest'), appt('a7', '10:45', 'arrived'),
  appt('a8', '11:00', 'booked'), appt('a9', '11:30', 'booked'), appt('a10', '12:00', 'cancelled'),
];

describe('optometry dashboard model', () => {
  it('counts the day by state; cancelled visits are left out of the total', () => {
    const f = flowSummary(day);
    expect(f).toMatchObject({ expected: 9, booked: 2, inPractice: 4, completed: 2, noShow: 1, cancelled: 1 });
    expect(f.booked + f.inPractice + f.completed + f.noShow).toBe(f.expected);
    expect(f.stages).toEqual([{ key: 'arrived', count: 1 }, { key: 'pretest', count: 1 }, { key: 'inexam', count: 1 }, { key: 'dispensing', count: 1 }]);
  });

  it('percentage is completed ÷ visits not cancelled, as a whole number', () => {
    expect(flowSummary(day).completedPct).toBe(22); // 2 of 9
    expect(flowSummary([appt('x', '08:00', 'completed')]).completedPct).toBe(100);
    expect(flowSummary([appt('x', '08:00', 'cancelled')]).completedPct).toBe(0);
    expect(flowSummary([]).completedPct).toBe(0);
  });

  it('ring segments add up to the whole ring and skip empty states', () => {
    const segs = flowSegments(flowSummary(day));
    expect(segs.map((s) => s.key)).toEqual(['completed', 'inPractice', 'booked', 'noShow']);
    expect(segs.reduce((n, s) => n + s.share, 0)).toBeCloseTo(1, 10);
    expect(flowSegments(flowSummary([appt('x', '08:00', 'booked')]))).toEqual([{ key: 'booked', share: 1 }]);
    expect(flowSegments(flowSummary([]))).toEqual([]);
  });

  it('diary preview: in the practice first, then still to arrive, shown in time order', () => {
    expect(nowAndNext(day, 4).map((a) => a.id)).toEqual(['a4', 'a5', 'a6', 'a7']);
    expect(nowAndNext(day, 6).map((a) => a.id)).toEqual(['a4', 'a5', 'a6', 'a7', 'a8', 'a9']);
    // When the day is almost over, the latest finished visits fill the rest.
    expect(nowAndNext([appt('a1', '08:00', 'completed'), appt('a2', '09:00', 'completed'), appt('a3', '16:00', 'booked')], 2).map((a) => a.id)).toEqual(['a2', 'a3']);
    expect(nowAndNext([], 4)).toEqual([]);
  });

  it('recent patients: seen or being seen, newest first, one row per patient', () => {
    expect(recentPatients(day, 3).map((a) => a.id)).toEqual(['a7', 'a6', 'a5']);
    const repeat = [appt('a1', '08:00', 'completed', 'p1'), appt('a2', '09:00', 'dispensing', 'p1'), appt('a3', '10:00', 'booked', 'p2'), appt('a4', '07:00', 'noshow', 'p3')];
    expect(recentPatients(repeat, 3).map((a) => a.id)).toEqual(['a2']);
  });

  it('uses only statuses that exist in the appointment workflow', () => {
    const states = optometry.collections.find((c) => c.key === 'appointments')!.workflow!.states.map((s) => s.key);
    for (const key of ['booked', 'arrived', 'pretest', 'inexam', 'dispensing', 'completed', 'noshow', 'cancelled']) expect(states).toContain(key);
    expect(states).toHaveLength(8);
  });
});
