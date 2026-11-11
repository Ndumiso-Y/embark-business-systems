// Pure, framework-free logic shared by every industry: simulated access,
// workflow transitions, field validation and line totals. Unit tested in
// tests/engine.test.ts. Nothing here is a security boundary.
import type {
  CollectionDef, DemoRecord, DemoUser, FieldDef, IndustryConfig, IndustryData, Line, Transition, Values, WorkflowDef, WorkflowState,
} from './types';
import { computeTotals } from './lib/money';

/* ---------------- Simulated access ---------------- */

/** Modules every industry has: the dashboard and the Users & permissions screen. */
export const BUILTIN_MODULES = ['dashboard', 'admin'];

export function hasModule(user: DemoUser | undefined, moduleKey: string): boolean {
  if (!user) return false;
  return !!user.isSuperAdmin || user.modules.includes(moduleKey);
}

export function can(user: DemoUser | undefined, permission: string | undefined): boolean {
  if (!permission) return true;
  if (!user) return false;
  return !!user.isSuperAdmin || user.permissions.includes(permission);
}

/** "Needs “Dispense” — held by Megan van Wyk (Optical dispenser)". Explains a permission refusal in the UI. */
export function permissionHint(config: IndustryConfig, data: IndustryData, permission: string | undefined): string {
  const label = config.permissions.find((p) => p.key === permission)?.label ?? permission ?? 'this';
  const holders = data.users.filter((u) => !u.isSuperAdmin && !!permission && u.permissions.includes(permission)).map((u) => `${u.name} (${u.title})`);
  const admin = data.users.find((u) => u.isSuperAdmin);
  const who = holders.length ? holders.slice(0, 2).join(' or ') : admin ? `${admin.name} (${admin.title})` : 'an administrator';
  return `Needs the “${label}” permission — switch to ${who} in the top bar.`;
}

export const PERMISSION_REFUSED = 'Your simulated role does not hold this permission.';

export function currentUser(data: IndustryData): DemoUser {
  return data.users.find((u) => u.id === data.currentUserId) ?? data.users[0];
}

/* ---------------- Workflow ---------------- */

const fromList = (t: Transition) => (Array.isArray(t.from) ? t.from : [t.from]);

export function stateOf(wf: WorkflowDef | undefined, key: string | undefined): WorkflowState | undefined {
  if (!wf || !key) return undefined;
  return wf.states.find((s) => s.key === key);
}

export function findTransition(wf: WorkflowDef, from: string | undefined, to: string): Transition | undefined {
  return wf.transitions.find((x) => x.to === to && fromList(x).includes(from ?? wf.initial));
}

/** Transitions leaving the record's current state, each with a reason if blocked. */
export function availableTransitions(
  wf: WorkflowDef,
  record: DemoRecord,
  user: DemoUser,
  data: IndustryData,
): Array<{ transition: Transition; blocked: string | null }> {
  return wf.transitions
    .filter((t) => fromList(t).includes(record.status ?? wf.initial))
    .map((t) => {
      let blocked: string | null = null;
      if (!can(user, t.permission)) blocked = 'Your simulated role does not hold this permission.';
      else if (t.guard) blocked = t.guard({ record, data, user });
      return { transition: t, blocked };
    });
}

export type TransitionResult = { ok: true; record: DemoRecord } | { ok: false; reason: string };

/** Apply a workflow transition, enforcing state, permission, note and guard rules. */
export function applyTransition(
  wf: WorkflowDef,
  record: DemoRecord,
  to: string,
  user: DemoUser,
  data: IndustryData,
  note: string | undefined,
  roleLabel: string,
  nowIso = new Date().toISOString(),
): TransitionResult {
  const from = record.status ?? wf.initial;
  const t = wf.transitions.find((x) => x.to === to && fromList(x).includes(from));
  if (!t) return { ok: false, reason: `Cannot move from "${stateOf(wf, from)?.label ?? from}" to "${stateOf(wf, to)?.label ?? to}".` };
  if (!can(user, t.permission)) return { ok: false, reason: 'Your simulated role does not hold this permission.' };
  if (t.requiresNote && !note?.trim()) return { ok: false, reason: 'A note is required for this step.' };
  const blocked = t.guard?.({ record, data, user, note });
  if (blocked) return { ok: false, reason: blocked };
  return {
    ok: true,
    record: {
      ...record,
      status: to,
      updatedAt: nowIso,
      history: [...record.history, { at: nowIso, by: user.name, role: roleLabel, action: t.label, note: note?.trim() || undefined }],
    },
  };
}

/* ---------------- Validation ---------------- */

export function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
}

export function validateValues(fields: FieldDef[], values: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = values[f.key];
    if (f.required && isEmpty(v)) { errors[f.key] = `${f.label} is required.`; continue; }
    if (isEmpty(v)) continue;
    if (f.type === 'number' || f.type === 'money') {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) { errors[f.key] = `${f.label} must be a number.`; continue; }
      if (f.min !== undefined && n < f.min) { errors[f.key] = `${f.label} must be at least ${f.min}.`; continue; }
      if (f.max !== undefined && n > f.max) { errors[f.key] = `${f.label} must be at most ${f.max}.`; continue; }
    }
    if (f.type === 'date' && typeof v === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { errors[f.key] = `${f.label} must be a date.`; continue; }
    if (f.type === 'lines' && Array.isArray(v)) {
      const bad = v.find((l) => !l.description.trim() || !(l.qty > 0) || l.unitPrice < 0);
      if (bad) { errors[f.key] = 'Each line needs a description, a quantity above zero and a non-negative price.'; continue; }
    }
    const custom = f.validate?.(v, values);
    if (custom) errors[f.key] = custom;
  }
  return errors;
}

/* ---------------- Lines & money ---------------- */

/** Totals in cents for priced lines. Prices are VAT-exclusive unless stated. */
export function linesTotals(lines: Line[] | undefined, vatRate = 15, pricesIncludeVat = false) {
  return computeTotals(
    (lines ?? []).map((l) => ({ id: l.id, description: l.description, qty: l.qty, unitPrice: l.unitPrice })),
    vatRate,
    pricesIncludeVat,
  );
}

/* ---------------- Lookup helpers ---------------- */

export function collectionDef(config: IndustryConfig, key: string): CollectionDef {
  const def = config.collections.find((c) => c.key === key);
  if (!def) throw new Error(`Unknown collection "${key}" in ${config.id}`);
  return def;
}

export function records(data: IndustryData, key: string): DemoRecord[] {
  return data.collections[key] ?? [];
}

export function findRecord(data: IndustryData, key: string, id: string | undefined): DemoRecord | undefined {
  if (!id) return undefined;
  return records(data, key).find((r) => r.id === id);
}

export function str(r: DemoRecord | undefined, key: string): string {
  const v = r?.values[key];
  return v === undefined || v === null ? '' : String(v);
}

export function num(r: DemoRecord | undefined, key: string): number {
  const v = r?.values[key];
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function lines(r: DemoRecord | undefined, key = 'lines'): Line[] {
  const v = r?.values[key];
  return Array.isArray(v) ? v : [];
}

export function formatRef(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

/** Text used for workspace search: ref, title, subtitle and text values. */
export function searchText(def: CollectionDef, r: DemoRecord, data: IndustryData): string {
  const parts = [r.ref, def.title(r, data), def.subtitle?.(r, data) ?? ''];
  for (const f of def.fields) {
    const v = r.values[f.key];
    if (typeof v === 'string' && f.type !== 'date') parts.push(v);
  }
  return parts.join(' ').toLowerCase();
}

/** Every module key must point at real collections and every ref field at a declared collection. */
export function validateConfig(config: IndustryConfig): string[] {
  const problems: string[] = [];
  const keys = new Set(config.collections.map((c) => c.key));
  const perms = new Set(config.permissions.map((p) => p.key));
  for (const m of config.modules) {
    if (m.collection && !keys.has(m.collection)) problems.push(`Module ${m.key} → unknown collection ${m.collection}`);
    if (!m.collection && !m.page) problems.push(`Module ${m.key} has neither a collection nor a page`);
  }
  for (const c of config.collections) {
    for (const f of c.fields) {
      if (f.type === 'ref' && (!f.ref || !keys.has(f.ref))) problems.push(`${c.key}.${f.key} → unknown ref ${f.ref}`);
      if (f.type === 'select' && !f.options?.length) problems.push(`${c.key}.${f.key} select has no options`);
      if (f.permission && !perms.has(f.permission)) problems.push(`${c.key}.${f.key} → unknown permission ${f.permission}`);
    }
    if (c.editPermission && !perms.has(c.editPermission)) problems.push(`${c.key} → unknown edit permission ${c.editPermission}`);
    const wf = c.workflow;
    if (wf) {
      const states = new Set(wf.states.map((s) => s.key));
      if (!states.has(wf.initial)) problems.push(`${c.key} workflow initial ${wf.initial} not a state`);
      for (const t of wf.transitions) {
        for (const f of fromList(t)) if (!states.has(f)) problems.push(`${c.key} transition from unknown ${f}`);
        if (!states.has(t.to)) problems.push(`${c.key} transition to unknown ${t.to}`);
        if (t.permission && !perms.has(t.permission)) problems.push(`${c.key} transition ${t.label} → unknown permission ${t.permission}`);
      }
    }
  }
  const moduleKeys = new Set(config.modules.map((m) => m.key));
  const seed = config.seed('2026-01-15');
  for (const u of seed.users) {
    for (const m of u.modules) if (!moduleKeys.has(m) && !BUILTIN_MODULES.includes(m)) problems.push(`User ${u.id} → unknown module ${m}`);
    for (const p of u.permissions) if (!perms.has(p)) problems.push(`User ${u.id} → unknown permission ${p}`);
  }
  for (const g of config.guide ?? []) {
    const mod = g.to.split('?')[0].split('/')[0];
    if (mod && !moduleKeys.has(mod) && !['admin', 'settings'].includes(mod)) problems.push(`Guide step "${g.title}" → unknown module ${mod}`);
    if (g.as && !seed.users.some((u) => u.id === g.as)) problems.push(`Guide step "${g.title}" → unknown user ${g.as}`);
  }
  // Guide links to a specific record must point at the same kind of record on every day of the week
  // (seeds that skip weekends shift sequential ids).
  const guided = (config.guide ?? []).map((g) => ({ ...g, to: g.to.split('?')[0] })).filter((g) => g.to.includes('/'));
  if (guided.length) {
    const seen = new Map<string, Set<string>>();
    for (let d = 15; d < 22; d++) {
      const s = config.seed(`2026-01-${d}`);
      for (const g of guided) {
        const [mod, recId] = g.to.split('/');
        const col = config.modules.find((m) => m.key === mod)?.collection;
        const rec = col ? (s.collections[col] ?? []).find((r) => r.id === recId) : undefined;
        if (!rec) { problems.push(`Guide step "${g.title}" → no record ${g.to} when seeded on 2026-01-${d}`); continue; }
        const set = seen.get(g.to) ?? seen.set(g.to, new Set()).get(g.to)!;
        set.add(rec.status ?? '-');
      }
    }
    for (const [to, statuses] of seen) if (statuses.size > 1) problems.push(`Guide record ${to} has a different status depending on the day (${[...statuses].join(', ')}) — give it a fixed id`);
  }
  for (const [k, recs] of Object.entries(seed.collections)) {
    if (!keys.has(k)) { problems.push(`Seed has undeclared collection ${k}`); continue; }
    const def = config.collections.find((c) => c.key === k)!;
    for (const r of recs) {
      if (def.workflow && r.status && !def.workflow.states.some((s) => s.key === r.status)) problems.push(`${k} ${r.ref} has unknown status ${r.status}`);
      for (const f of def.fields) {
        if (f.type === 'ref' && r.values[f.key]) {
          const target = seed.collections[f.ref!] ?? [];
          if (!target.some((t) => t.id === r.values[f.key])) problems.push(`${k} ${r.ref}.${f.key} → missing ${f.ref} ${String(r.values[f.key])}`);
        }
      }
    }
  }
  return problems;
}
