import { describe, expect, it } from 'vitest';
import type { DemoRecord } from '../src/core/types';
import { byStart, capacity, openJobCards, pctOf, stageRing, STAGES, workshopStages } from '../src/industries/automotive/dashboardModel';
import { IN_WORKSHOP } from '../src/industries/automotive/helpers';
import automotive from '../src/industries/automotive';

const job = (id: string, status: string, extra: Record<string, unknown> = {}): DemoRecord =>
  ({ id, ref: id.toUpperCase(), status, values: { ...extra }, createdAt: '', updatedAt: '', history: [] }) as unknown as DemoRecord;

const jobs = [
  job('j1', 'checkedin', { checkedInOn: '2026-11-26' }), job('j2', 'diagnosing', { checkedInOn: '2026-11-25' }), job('j3', 'approval', { checkedInOn: '2026-11-23' }),
  job('j4', 'approval', { checkedInOn: '2026-11-24' }), job('j5', 'inprogress', { checkedInOn: '2026-11-24' }), job('j6', 'qc'), job('j7', 'ready', { checkedInOn: '2026-11-20' }),
  job('j8', 'booked'), job('j9', 'collected'), job('j10', 'cancelled'),
];

describe('automotive dashboard model', () => {
  it('counts vehicles on site by stage; booked, collected and cancelled are not on site', () => {
    const { onSite, stages } = workshopStages(jobs);
    expect(onSite).toBe(7);
    expect(stages.map((s) => [s.key, s.count])).toEqual([['checkedin', 1], ['diagnosing', 1], ['approval', 2], ['inprogress', 1], ['qc', 1], ['ready', 1]]);
    expect(stages.reduce((n, s) => n + s.share, 0)).toBeCloseTo(1, 10);
    expect(workshopStages([job('x', 'booked')]).onSite).toBe(0);
    expect(workshopStages([]).stages.every((s) => s.share === 0)).toBe(true);
  });

  it('stages match the job-card workflow and the dashboard definition of "on site"', () => {
    const states = automotive.collections.find((c) => c.key === 'jobs')!.workflow!.states.map((s) => s.key);
    for (const s of STAGES) expect(states).toContain(s.key);
    expect(STAGES.map((s) => s.key)).toEqual(IN_WORKSHOP);
    expect(automotive.shell).toBe('navy');
  });

  it('ring segments skip empty stages and keep flow order', () => {
    const ring = stageRing(workshopStages([job('a', 'approval'), job('b', 'ready'), job('c', 'ready')]).stages);
    expect(ring.map((r) => r.key)).toEqual(['approval', 'ready']);
    expect(ring.map((r) => r.tone)).toEqual(['warn', 'ok']);
    expect(pctOf(ring[1].share)).toBe(67);
  });

  it('bay capacity is hours booked against bays × hours per bay', () => {
    expect(capacity({ b1: 5.25, b2: 3.5, b3: 5, b4: 4.5 }, 4, 8)).toEqual({ booked: 18.25, available: 32, pct: 57 });
    expect(capacity({}, 4, 8)).toEqual({ booked: 0, available: 32, pct: 0 });
    expect(capacity({ b1: 10 }, 0, 8).pct).toBe(0);
  });

  it('open job cards: on site only, longest on site first', () => {
    expect(openJobCards(jobs, IN_WORKSHOP).map((j) => j.id)).toEqual(['j7', 'j3', 'j4', 'j5', 'j2', 'j1', 'j6']);
  });

  it('bookings sort by start time, unknown times last', () => {
    const list = [job('a', 'booked', { startTime: '10:00' }), job('b', 'booked'), job('c', 'booked', { startTime: '07:30' })].sort(byStart);
    expect(list.map((j) => j.id)).toEqual(['c', 'a', 'b']);
  });
});
