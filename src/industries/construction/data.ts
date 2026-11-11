// Reference lists for the fictional Ironbark Building & Civils demo.
// Clients, suppliers, subcontractors, grades and reference numbers are invented.

export type Option = { value: string; label: string };

export const label = (list: Option[], v: unknown) => list.find((x) => x.value === v)?.label ?? (v ? String(v) : '—');

/** South African VAT rate used for the illustrative valuations (percent). */
export const VAT_RATE = 15;
/** Demo cap on retention held, as a percentage of the original contract value. */
export const RETENTION_CAP_PCT = 5;

export const PROJECT_MANAGERS: Option[] = [
  { value: 'Heinrich van der Merwe', label: 'Heinrich van der Merwe' },
  { value: 'Nadia Pillay', label: 'Nadia Pillay' },
];

export const CONTRACT_TYPES: Option[] = [
  { value: 'lumpsum', label: 'Lump sum (fixed price)' },
  { value: 'remeasure', label: 'Re-measurable (bill of quantities)' },
  { value: 'designbuild', label: 'Design & build' },
  { value: 'costplus', label: 'Cost-plus / day works' },
];

export const PROJECT_KINDS: Option[] = [
  { value: 'building', label: 'Building' },
  { value: 'civils', label: 'Civils' },
];

export const WEATHER: Option[] = [
  { value: 'fine', label: 'Fine' },
  { value: 'overcast', label: 'Overcast' },
  { value: 'windy', label: 'Windy' },
  { value: 'showers', label: 'Showers — work continued' },
  { value: 'rain', label: 'Rain — work stopped (rain day)' },
];

export const DELAY_CAUSES: Option[] = [
  { value: 'rain', label: 'Rain / wet ground' },
  { value: 'info', label: 'Design information awaited (employer)' },
  { value: 'instruction', label: 'Client instruction / change (employer)' },
  { value: 'access', label: 'Late site access (employer)' },
  { value: 'materials', label: 'Late material delivery' },
  { value: 'plant', label: 'Plant breakdown' },
  { value: 'labour', label: 'Labour shortage / stoppage' },
  { value: 'power', label: 'Power outage / load curtailment' },
];

/** Delay causes that are typically the employer's risk (counted toward a possible extension of time). */
export const EMPLOYER_RISK_CAUSES = ['info', 'instruction', 'access'];

export const TRADES: Option[] = [
  { value: 'earthworks', label: 'Earthworks' },
  { value: 'concrete', label: 'Concrete & formwork' },
  { value: 'rebar', label: 'Reinforcing steel' },
  { value: 'brickwork', label: 'Brickwork & plaster' },
  { value: 'roofing', label: 'Roofing & waterproofing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing & drainage' },
  { value: 'steel', label: 'Structural steel' },
  { value: 'glazing', label: 'Aluminium & glazing' },
  { value: 'painting', label: 'Painting' },
  { value: 'tiling', label: 'Tiling & flooring' },
  { value: 'surfacing', label: 'Road surfacing' },
  { value: 'fencing', label: 'Fencing & gates' },
];

export const PLANT_TYPES: Option[] = [
  { value: 'tlb', label: 'TLB (backhoe loader)' },
  { value: 'excavator', label: 'Excavator' },
  { value: 'mixer', label: 'Concrete mixer' },
  { value: 'scaffold', label: 'Scaffolding' },
  { value: 'generator', label: 'Generator' },
  { value: 'roller', label: 'Roller / compactor' },
  { value: 'tipper', label: 'Tipper truck' },
  { value: 'telehandler', label: 'Telehandler' },
  { value: 'poker', label: 'Poker vibrator' },
];

export const OWNERSHIP: Option[] = [
  { value: 'owned', label: 'Owned' },
  { value: 'hired', label: 'Hired in' },
];

export const PLANT_STATES: Option[] = [
  { value: 'working', label: 'Working' },
  { value: 'idle', label: 'Standing idle' },
  { value: 'breakdown', label: 'Broken down' },
  { value: 'yard', label: 'In yard' },
  { value: 'offhired', label: 'Off-hired / returned' },
];

export const SUPPLIERS: Option[] = [
  { value: 'highveld', label: 'Highveld Brick & Block (fictional)' },
  { value: 'steelcraft', label: 'Steelcraft Reinforcing (fictional)' },
  { value: 'readymix', label: 'Rand Readymix Concrete (fictional)' },
  { value: 'bushveld', label: 'Bushveld Timber & Board (fictional)' },
  { value: 'protea', label: 'Protea Plumbing Supplies (fictional)' },
  { value: 'ukhozi', label: 'Ukhozi Electrical Wholesale (fictional)' },
  { value: 'karoo', label: 'Karoo Aggregates (fictional)' },
  { value: 'summit', label: 'Summit Roofing Sheets (fictional)' },
  { value: 'pipeline', label: 'Pipeline Civils Products (fictional)' },
];

export const SNAG_CATEGORIES: Option[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
];

export const SAFETY_TYPES: Option[] = [
  { value: 'toolbox', label: 'Toolbox talk' },
  { value: 'inspection', label: 'Site inspection' },
  { value: 'nearmiss', label: 'Near miss' },
  { value: 'incident', label: 'Incident / injury' },
];

export const SEVERITIES: Option[] = [
  { value: 'none', label: 'None (talk / inspection)' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
