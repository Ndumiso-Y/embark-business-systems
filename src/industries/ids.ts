// Every industry id, in gallery order. Shared by the app and vite.config.ts.
// To add an industry: add its folder under src/industries/<id>/ and its id here.
export const INDUSTRY_IDS = ['optometry', 'medical', 'automotive', 'tyres', 'mining', 'construction', 'realestate', 'legal'] as const;

/**
 * Industry families. Each family shares workflows and screens, so a new member
 * (e.g. dental next to optometry, panel beating next to tyres) is mostly configuration.
 * See docs/INDUSTRY_STRATEGY.md.
 */
export const FAMILIES: Array<{ name: string; blurb: string; ids: string[] }> = [
  { name: 'Health practices', blurb: 'Appointments, clinical records, medical aid billing, recalls', ids: ['optometry', 'medical'] },
  { name: 'Vehicles & workshops', blurb: 'Job cards through bays, approvals, parts and tool control', ids: ['automotive', 'tyres'] },
  { name: 'Site & field operations', blurb: 'Daily logs, permits and safety, plant, contractor compliance', ids: ['mining', 'construction'] },
  { name: 'Property & professional services', blurb: 'Pipelines of deals or matters, compliance checks, trust money, fees', ids: ['realestate', 'legal'] },
];
