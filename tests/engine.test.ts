import { describe, expect, it } from 'vitest';
import { applyTransition, availableTransitions, can, hasModule, linesTotals, validateValues } from '../src/core/engine';
import type { DemoRecord, DemoUser, IndustryData, WorkflowDef } from '../src/core/types';
import { countersFrom, seeder } from '../src/core/seed';

const admin: DemoUser = { id: 'a', name: 'Admin', title: 'Admin', role: 'admin', modules: [], permissions: [], isSuperAdmin: true };
const clerk: DemoUser = { id: 'c', name: 'Clerk', title: 'Clerk', role: 'clerk', modules: ['jobs'], permissions: ['jobs.move'] };
const viewer: DemoUser = { id: 'v', name: 'Viewer', title: 'Viewer', role: 'viewer', modules: ['jobs'], permissions: [] };
const data: IndustryData = { version: 1, seededAt: '', currentUserId: 'c', users: [admin, clerk, viewer], collections: {}, counters: {}, activity: [] };

const wf: WorkflowDef = {
  initial: 'open',
  states: [
    { key: 'open', label: 'Open', tone: 'dark' },
    { key: 'approved', label: 'Approved', tone: 'green' },
    { key: 'rejected', label: 'Rejected', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'open', to: 'approved', label: 'Approve', permission: 'jobs.move', guard: ({ record }) => (Number(record.values.amount) > 1000 ? 'Amounts over 1000 need a manager.' : null) },
    { from: 'open', to: 'rejected', label: 'Reject', requiresNote: true },
  ],
};
const rec = (amount: number): DemoRecord => ({ id: 'r1', ref: 'J-0001', status: 'open', values: { amount }, history: [], createdAt: '', updatedAt: '' });

describe('simulated access', () => {
  it('super admin has every module and permission', () => {
    expect(hasModule(admin, 'anything')).toBe(true);
    expect(can(admin, 'anything')).toBe(true);
  });
  it('regular users only hold what they are granted', () => {
    expect(hasModule(clerk, 'jobs')).toBe(true);
    expect(hasModule(clerk, 'admin')).toBe(false);
    expect(can(viewer, 'jobs.move')).toBe(false);
    expect(can(viewer, undefined)).toBe(true);
  });
});

describe('workflow transitions', () => {
  it('applies an allowed transition and records history', () => {
    const res = applyTransition(wf, rec(500), 'approved', clerk, data, undefined, 'Clerk', '2026-01-01T10:00:00Z');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.record.status).toBe('approved');
      expect(res.record.history.at(-1)).toMatchObject({ by: 'Clerk', action: 'Approve' });
    }
  });
  it('blocks a user without the permission', () => {
    const res = applyTransition(wf, rec(500), 'approved', viewer, data, undefined, 'Viewer');
    expect(res).toMatchObject({ ok: false });
  });
  it('blocks when a guard fails and reports the reason', () => {
    const res = applyTransition(wf, rec(5000), 'approved', clerk, data, undefined, 'Clerk');
    expect(res).toEqual({ ok: false, reason: 'Amounts over 1000 need a manager.' });
  });
  it('requires a note where configured', () => {
    expect(applyTransition(wf, rec(1), 'rejected', clerk, data, '  ', 'Clerk')).toMatchObject({ ok: false });
    expect(applyTransition(wf, rec(1), 'rejected', clerk, data, 'Duplicate', 'Clerk')).toMatchObject({ ok: true });
  });
  it('refuses transitions not defined from the current state', () => {
    const r = { ...rec(1), status: 'rejected' };
    expect(applyTransition(wf, r, 'approved', admin, data, undefined, 'Admin')).toMatchObject({ ok: false });
  });
  it('lists available transitions with blocked reasons', () => {
    const opts = availableTransitions(wf, rec(5000), clerk, data);
    expect(opts.map((o) => o.transition.label)).toEqual(['Approve', 'Reject']);
    expect(opts[0].blocked).toMatch(/manager/);
    expect(opts[1].blocked).toBeNull();
  });
});

describe('validation', () => {
  it('checks required, numeric range, date shape and custom rules', () => {
    const errs = validateValues([
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'qty', label: 'Qty', type: 'number', min: 1, max: 10 },
      { key: 'when', label: 'When', type: 'date' },
      { key: 'code', label: 'Code', type: 'text', validate: (v) => (String(v).startsWith('DEMO') ? null : 'Must start with DEMO') },
    ], { name: '', qty: 11, when: '12/01/2026', code: 'X1' });
    expect(Object.keys(errs).sort()).toEqual(['code', 'name', 'qty', 'when']);
  });
  it('rejects invalid priced lines', () => {
    const errs = validateValues([{ key: 'lines', label: 'Lines', type: 'lines' }], { lines: [{ id: '1', description: '', qty: 1, unitPrice: 10 }] });
    expect(errs.lines).toBeDefined();
  });
});

describe('money', () => {
  it('totals lines in integer cents with 15% VAT', () => {
    const t = linesTotals([{ id: '1', description: 'A', qty: 3, unitPrice: 33.33 }, { id: '2', description: 'B', qty: 1, unitPrice: 0.01 }]);
    expect(t.net).toBe(10000);
    expect(t.vat).toBe(1500);
    expect(t.total).toBe(11500);
  });
});

describe('seed helpers', () => {
  it('assigns deterministic ids/refs and counters', () => {
    const s = seeder('2026-03-01');
    s.rec('jobs', 'JB', { a: 1 });
    s.rec('jobs', 'JB', { a: 2 });
    expect(s.collections.jobs.map((r) => [r.id, r.ref])).toEqual([['jobs_1', 'JB-0001'], ['jobs_2', 'JB-0002']]);
    expect(countersFrom(s.collections)).toEqual({ jobs: 2 });
    expect(s.day(-1)).toBe('2026-02-28');
  });
});
