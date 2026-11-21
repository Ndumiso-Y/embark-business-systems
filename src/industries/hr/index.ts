// PLACEHOLDER — replaced by the full Human resources demo. Exists only so the shared dev server can load.
import type { IndustryConfig } from '../../core/types';
import { IcoUsers } from '../../core/components/Icons';
import { seeder, user } from '../../core/seed';

const config: IndustryConfig = {
  id: 'hr',
  industry: 'Human resources',
  businessName: 'Bluegum Distribution',
  monogram: 'BG',
  workspaceTag: 'PEOPLE',
  tagline: 'Human resources (in progress)',
  summary: 'Human resources demonstration (in progress).',
  priority: 13,
  theme: { accent: '#6a43c2', accent2: '#6a43c2', accentSoft: '#dddddd', accentTint: '#f4f4f4', accentLine: '#e4e4e4', accentText: '#333333' },
  roles: [{ key: 'admin', label: 'Administrator' }],
  permissions: [],
  modules: [{ key: 'records', label: 'Records', icon: IcoUsers, collection: 'records', description: 'Placeholder' }],
  collections: [{ key: 'records', singular: 'record', plural: 'records', refPrefix: 'REC', fields: [{ key: 'name', label: 'Name', type: 'text', table: true }], title: (r) => String(r.values.name ?? r.ref) }],
  seed: (today) => {
    const s = seeder(today);
    s.rec('records', 'REC', { name: 'Placeholder' });
    return { users: [user('u_admin', 'Placeholder User', 'Administrator', 'admin', ['dashboard', 'admin', 'records'], [], true)], collections: s.collections, currentUserId: 'u_admin' };
  },
  dashboard: () => null,
  boundaries: [],
  highlights: [],
};

export default config;
