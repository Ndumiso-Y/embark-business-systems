// Helpers for writing deterministic fictional seed data relative to "today".
import type { DemoRecord, DemoUser, IndustryConfig, IndustryData, Line, Values } from './types';
import { addDays } from './lib/dates';
import { formatRef } from './engine';

export const SCHEMA_VERSION = 1;

type RecOpts = { status?: string; createdDaysAgo?: number; history?: Array<{ daysAgo: number; by: string; role: string; action: string; note?: string }> };

/**
 * Seed builder. `rec()` assigns deterministic ids (`<collection>_<n>`) and refs
 * (`<PREFIX>-000n`) so tests and cross-references are stable.
 */
export function seeder(today: string) {
  const collections: Record<string, DemoRecord[]> = {};
  const day = (offset: number) => addDays(today, offset);
  const ts = (daysAgo: number, hour = 9, minute = 0) => {
    const d = new Date(`${addDays(today, -daysAgo)}T00:00:00`);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  function rec(collection: string, prefix: string, values: Values, opts: RecOpts = {}): DemoRecord {
    const list = (collections[collection] ??= []);
    const n = list.length + 1;
    const created = ts(opts.createdDaysAgo ?? 30);
    const r: DemoRecord = {
      id: `${collection}_${n}`,
      ref: formatRef(prefix, n),
      status: opts.status,
      values,
      createdAt: created,
      updatedAt: created,
      history: (opts.history ?? [{ daysAgo: opts.createdDaysAgo ?? 30, by: 'Seed data', role: 'System', action: 'Created (fictional record)' }]).map((h) => ({
        at: ts(h.daysAgo, 9 + (n % 7), (n * 7) % 60), by: h.by, role: h.role, action: h.action, note: h.note,
      })),
    };
    list.push(r);
    return r;
  }
  let lineSeq = 0;
  const line = (description: string, qty: number, unitPrice: number, code?: string): Line => ({ id: `ln_${++lineSeq}`, description, qty, unitPrice, code });
  return { collections, rec, day, ts, line };
}

/** Highest numeric ref per collection, so new records continue the sequence. */
export function countersFrom(collections: Record<string, DemoRecord[]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, list] of Object.entries(collections)) {
    out[k] = list.reduce((m, r) => Math.max(m, Number(r.ref.split('-').pop()) || 0), 0);
  }
  return out;
}

export function buildIndustryData(config: IndustryConfig, today: string): IndustryData {
  const s = config.seed(today);
  const collections: Record<string, DemoRecord[]> = {};
  for (const c of config.collections) collections[c.key] = s.collections[c.key] ?? [];
  return {
    version: SCHEMA_VERSION,
    seededAt: new Date().toISOString(),
    currentUserId: s.currentUserId,
    users: s.users,
    collections,
    counters: countersFrom(collections),
    activity: [],
  };
}

/** Convenience to declare a fictional user. */
export function user(id: string, name: string, title: string, role: string, modules: string[], permissions: string[], isSuperAdmin = false): DemoUser {
  return { id, name, title, role, modules, permissions, isSuperAdmin };
}
