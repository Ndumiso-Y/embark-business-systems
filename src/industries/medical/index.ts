// TEMPORARY STUB — replaced by the full configuration.
import type { IndustryConfig } from '../../core/types';
import { seeder, user } from '../../core/seed';
import { IcoDoc } from '../../core/components/Icons';
import Placeholder from '../../core/pages/NotFound';

const config: IndustryConfig = {
  id: 'medical', industry: 'General practice', businessName: 'General practice demo', monogram: 'XX', workspaceTag: 'WORKSPACE', tagline: '', summary: 'Stub', priority: 5,
  theme: { accent: '#777', accent2: '#888', accentSoft: '#ccc', accentTint: '#eee', accentLine: '#ddd', accentText: '#444' },
  roles: [{ key: 'admin', label: 'Admin' }], permissions: [{ key: 'edit', label: 'Edit', description: 'Edit' }],
  modules: [{ key: 'items', label: 'Items', icon: IcoDoc, description: 'Stub', collection: 'items' }],
  collections: [{ key: 'items', singular: 'Item', plural: 'Items', refPrefix: 'IT', title: (r) => String(r.values.name ?? ''), fields: [{ key: 'name', label: 'Name', type: 'text', required: true, table: true }] }],
  seed: (today) => { const s = seeder(today); s.rec('items', 'IT', { name: 'Example' }); return { users: [user('u1', 'Demo Admin', 'Admin', 'admin', [], [], true)], collections: s.collections, currentUserId: 'u1' }; },
  dashboard: Placeholder, boundaries: [], highlights: [],
};
export default config;
