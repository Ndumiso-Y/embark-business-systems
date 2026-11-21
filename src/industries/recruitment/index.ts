// PLACEHOLDER — replaced by the full Recruitment agency demo. Exists only so the shared dev server can load.
import type { IndustryConfig } from '../../core/types';
import { IcoBriefcase } from '../../core/components/Icons';
import { seeder, user } from '../../core/seed';

const config: IndustryConfig = {
  id: 'recruitment',
  industry: 'Recruitment agency',
  businessName: 'Fynbos Talent Partners',
  monogram: 'FT',
  workspaceTag: 'DESK',
  tagline: 'Recruitment agency (in progress)',
  summary: 'Recruitment agency demonstration (in progress).',
  priority: 14,
  theme: { accent: '#0e7490', accent2: '#0e7490', accentSoft: '#dddddd', accentTint: '#f4f4f4', accentLine: '#e4e4e4', accentText: '#333333' },
  roles: [{ key: 'admin', label: 'Administrator' }],
  permissions: [],
  modules: [{ key: 'records', label: 'Records', icon: IcoBriefcase, collection: 'records', description: 'Placeholder' }],
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
