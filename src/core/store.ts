// One persisted zustand store holds every industry's fictional data, keyed by
// industry id. Persistence is the visitor's localStorage only — no backend.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Activity, DemoRecord, DemoUser, IndustryConfig, IndustryData, IndustryId, Tone, Values } from './types';
import { applyTransition, collectionDef, currentUser, findTransition, formatRef } from './engine';
import { buildIndustryData, SCHEMA_VERSION } from './seed';
import { todayIso } from './lib/dates';

export const STORAGE_KEY = 'embark-industry-demos-v1';

let seq = Date.now() % 100000;
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}_${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type Toast = { id: string; text: string; tone: 'ok' | 'err' | 'info' };
export type Result<T = undefined> = { ok: true; value: T } | { ok: false; reason: string };

type State = {
  data: Partial<Record<IndustryId, IndustryData>>;
  toasts: Toast[];
  ensure: (config: IndustryConfig) => void;
  reset: (config: IndustryConfig) => void;
  signInAs: (id: IndustryId, userId: string) => void;
  createRecord: (config: IndustryConfig, collection: string, values: Values, status?: string, action?: string) => DemoRecord;
  updateRecord: (config: IndustryConfig, collection: string, id: string, patch: Values, action?: string, note?: string) => void;
  deleteRecord: (config: IndustryConfig, collection: string, id: string) => void;
  transition: (config: IndustryConfig, collection: string, id: string, to: string, note?: string) => Result<DemoRecord>;
  upsertUser: (id: IndustryId, user: DemoUser) => void;
  deleteUser: (id: IndustryId, userId: string) => Result;
  resetUsers: (config: IndustryConfig) => void;
  log: (id: IndustryId, a: Omit<Activity, 'id' | 'at'>) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
};

const nowIso = () => new Date().toISOString();

function roleLabel(config: IndustryConfig, u: DemoUser) {
  return config.roles.find((r) => r.key === u.role)?.label ?? u.role;
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** Immutable update of one industry's data. */
      const patch = (id: IndustryId, fn: (d: IndustryData) => IndustryData) =>
        set((s) => {
          const d = s.data[id];
          return d ? { data: { ...s.data, [id]: fn(d) } } : s;
        });

      const pushActivity = (d: IndustryData, a: Omit<Activity, 'id' | 'at'>): Activity[] =>
        [{ ...a, id: newId('act'), at: nowIso() }, ...d.activity].slice(0, 60);

      return {
        data: {},
        toasts: [],

        ensure: (config) => {
          const d = get().data[config.id];
          if (!d || d.version !== SCHEMA_VERSION) set((s) => ({ data: { ...s.data, [config.id]: buildIndustryData(config, todayIso()) } }));
        },

        reset: (config) => set((s) => ({ data: { ...s.data, [config.id]: buildIndustryData(config, todayIso()) } })),

        signInAs: (id, userId) => patch(id, (d) => ({ ...d, currentUserId: userId })),

        createRecord: (config, collection, values, status, action) => {
          const def = collectionDef(config, collection);
          const d = get().data[config.id]!;
          const u = currentUser(d);
          const n = (d.counters[collection] ?? 0) + 1;
          const at = nowIso();
          const rec: DemoRecord = {
            id: newId(collection),
            ref: formatRef(def.refPrefix, n),
            status: status ?? def.workflow?.initial,
            values,
            createdAt: at,
            updatedAt: at,
            history: [{ at, by: u.name, role: roleLabel(config, u), action: action ?? `${def.singular} created` }],
          };
          patch(config.id, (x) => ({
            ...x,
            counters: { ...x.counters, [collection]: n },
            collections: { ...x.collections, [collection]: [rec, ...(x.collections[collection] ?? [])] },
            activity: pushActivity(x, { title: `${def.singular} ${rec.ref} created`, detail: def.title(rec, x), tone: 'accent', module: collection }),
          }));
          return rec;
        },

        updateRecord: (config, collection, id, values, action, note) => {
          const def = collectionDef(config, collection);
          patch(config.id, (x) => {
            const u = currentUser(x);
            const at = nowIso();
            const list = (x.collections[collection] ?? []).map((r) =>
              r.id === id
                ? {
                    ...r,
                    values: { ...r.values, ...values },
                    updatedAt: at,
                    history: action ? [...r.history, { at, by: u.name, role: roleLabel(config, u), action, note }] : r.history,
                  }
                : r,
            );
            const rec = list.find((r) => r.id === id);
            return {
              ...x,
              collections: { ...x.collections, [collection]: list },
              activity: action && rec ? pushActivity(x, { title: `${rec.ref} · ${action}`, detail: def.title(rec, x), tone: 'blue', module: collection }) : x.activity,
            };
          });
        },

        deleteRecord: (config, collection, id) => {
          const def = collectionDef(config, collection);
          patch(config.id, (x) => {
            const rec = (x.collections[collection] ?? []).find((r) => r.id === id);
            return {
              ...x,
              collections: { ...x.collections, [collection]: (x.collections[collection] ?? []).filter((r) => r.id !== id) },
              activity: rec ? pushActivity(x, { title: `${def.singular} ${rec.ref} deleted`, detail: def.title(rec, x), tone: 'red', module: collection }) : x.activity,
            };
          });
        },

        transition: (config, collection, id, to, note) => {
          const def = collectionDef(config, collection);
          const d = get().data[config.id];
          const rec = d?.collections[collection]?.find((r) => r.id === id);
          if (!d || !rec || !def.workflow) return { ok: false, reason: 'Record not found.' };
          const u = currentUser(d);
          const res = applyTransition(def.workflow, rec, to, u, d, note, roleLabel(config, u));
          if (!res.ok) return res;
          const st = def.workflow.states.find((s) => s.key === to);
          patch(config.id, (x) => ({
            ...x,
            collections: { ...x.collections, [collection]: (x.collections[collection] ?? []).map((r) => (r.id === id ? res.record : r)) },
            activity: pushActivity(x, { title: `${rec.ref} → ${st?.label ?? to}`, detail: def.title(rec, x), tone: (st?.tone ?? 'dark') as Tone, module: collection }),
          }));
          const t = findTransition(def.workflow, rec.status, to);
          if (t?.after) {
            const s = get();
            t.after({
              record: res.record,
              data: s.data[config.id]!,
              today: todayIso(),
              api: {
                create: (c, v, st2, a) => s.createRecord(config, c, v, st2, a),
                update: (c, i, v, a, n) => s.updateRecord(config, c, i, v, a, n),
                toast: s.toast,
              },
            });
          }
          return { ok: true, value: res.record };
        },

        upsertUser: (id, user) =>
          patch(id, (x) => ({
            ...x,
            users: x.users.some((u) => u.id === user.id) ? x.users.map((u) => (u.id === user.id ? user : u)) : [...x.users, user],
          })),

        deleteUser: (id, userId) => {
          const d = get().data[id];
          if (!d) return { ok: false, reason: 'No data.' };
          if (d.currentUserId === userId) return { ok: false, reason: 'Switch to another user before removing this one.' };
          const target = d.users.find((u) => u.id === userId);
          if (target?.isSuperAdmin && d.users.filter((u) => u.isSuperAdmin).length === 1) return { ok: false, reason: 'At least one super admin must remain.' };
          patch(id, (x) => ({ ...x, users: x.users.filter((u) => u.id !== userId) }));
          return { ok: true, value: undefined };
        },

        resetUsers: (config) => {
          const fresh = config.seed(todayIso());
          patch(config.id, (x) => ({ ...x, users: fresh.users, currentUserId: fresh.currentUserId }));
        },

        log: (id, a) => patch(id, (x) => ({ ...x, activity: pushActivity(x, a) })),

        toast: (text, tone = 'ok') => {
          const t = { id: newId('t'), text, tone };
          set((s) => ({ toasts: [...s.toasts, t].slice(-4) }));
          setTimeout(() => get().dismissToast(t.id), 4200);
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      };
    },
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ data: s.data }),
    },
  ),
);
