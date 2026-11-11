// React bindings: the active industry config plus hooks bound to it.
import { createContext, useContext, useMemo } from 'react';
import type { DemoRecord, IndustryConfig, IndustryData, Values } from './types';
import { useStore } from './store';
import { can, collectionDef, currentUser, hasModule } from './engine';

export const IndustryContext = createContext<IndustryConfig | null>(null);

export function useIndustry(): IndustryConfig {
  const c = useContext(IndustryContext);
  if (!c) throw new Error('useIndustry must be used inside an industry route');
  return c;
}

export function useData(): IndustryData {
  const config = useIndustry();
  const d = useStore((s) => s.data[config.id]);
  if (!d) throw new Error('Industry data not initialised');
  return d;
}

export function useUser() {
  const config = useIndustry();
  const data = useData();
  const user = currentUser(data);
  const roleLabel = config.roles.find((r) => r.key === user.role)?.label ?? user.role;
  return { user, roleLabel, can: (p?: string) => can(user, p), hasModule: (m: string) => hasModule(user, m) };
}

export function useRecords(collection: string): DemoRecord[] {
  const data = useData();
  return data.collections[collection] ?? [];
}

/** Store actions pre-bound to the active industry. */
export function useActions() {
  const config = useIndustry();
  const s = useStore.getState();
  return useMemo(
    () => ({
      create: (collection: string, values: Values, status?: string, action?: string) => s.createRecord(config, collection, values, status, action),
      update: (collection: string, id: string, values: Values, action?: string, note?: string) => s.updateRecord(config, collection, id, values, action, note),
      remove: (collection: string, id: string) => s.deleteRecord(config, collection, id),
      transition: (collection: string, id: string, to: string, note?: string) => s.transition(config, collection, id, to, note),
      toast: s.toast,
      log: (title: string, detail: string) => s.log(config.id, { title, detail, tone: 'accent' }),
      def: (collection: string) => collectionDef(config, collection),
    }),
    [config, s],
  );
}

/** Base path for links inside the active industry, e.g. `/optometry`. */
export function useBase(): string {
  return `/${useIndustry().id}`;
}
