// Reference lists for the fictional Ridgeback Minerals — Kgotso Shaft demo.
// Section names, fleet numbers, monitoring points and thresholds are invented.

export type Option = { value: string; label: string };

export const SECTIONS: Option[] = [
  { value: 'l7e', label: 'Level 7 East' },
  { value: 'l7w', label: 'Level 7 West' },
  { value: 'l9n', label: 'Level 9 North' },
];

/** Location options for incidents and permits: production sections plus shaft infrastructure. */
export const LOCATIONS: Option[] = [
  ...SECTIONS,
  { value: 'shaft', label: 'Main shaft & station' },
  { value: 'workshop', label: 'Underground workshop (L8)' },
  { value: 'pumpstation', label: 'Level 9 pump station' },
  { value: 'surface', label: 'Surface plant & yard' },
];

export const SHIFTS: Option[] = [
  { value: 'day', label: 'Day shift (06:00–14:00)' },
  { value: 'night', label: 'Night shift (22:00–06:00)' },
];

/** Planned tonnes per shift, per section (fictional mine plan). */
export const SHIFT_TARGETS: Record<string, { day: number; night: number }> = {
  l7e: { day: 440, night: 400 },
  l7w: { day: 380, night: 350 },
  l9n: { day: 300, night: 280 },
};

export const DELAY_REASONS: Option[] = [
  { value: 'hoist', label: 'Hoist / winder stoppage' },
  { value: 'lhd', label: 'LHD breakdown' },
  { value: 'reentry', label: 'Re-entry gas / smoke clearance' },
  { value: 'fog', label: 'Fall of ground — area barricaded' },
  { value: 'power', label: 'Power outage / load curtailment' },
  { value: 'seismic', label: 'Seismic event — re-entry inspection' },
  { value: 'blasting', label: 'Blasting / explosives delay' },
  { value: 'water', label: 'Water / pumping problem' },
  { value: 'safety', label: 'Safety stoppage' },
  { value: 'late', label: 'Late start / shift change' },
];

export const SUPERVISORS: Option[] = [
  { value: 'pc', label: 'Pieter-Jan Coetzee' },
  { value: 'kt', label: 'Kabelo Tau' },
];

export const CREWS: Record<string, string[]> = {
  l7e: ['Crew A — TL Sizwe Ndaba', 'Crew B — TL Johan Kruger'],
  l7w: ['Crew C — TL Mpho Lekganyane', 'Crew D — TL Andile Mkhize'],
  l9n: ['Crew E — TL Refilwe Motaung', 'Crew F — TL Hendrik Swart'],
};

/* ---------- Safety ---------- */
export const INCIDENT_CATEGORIES: Option[] = [
  { value: 'fog', label: 'Fall of ground' },
  { value: 'tmm', label: 'Trackless mobile machinery interaction' },
  { value: 'rail', label: 'Rail-bound equipment' },
  { value: 'slip', label: 'Slip, trip or fall' },
  { value: 'handling', label: 'Material handling' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'gas', label: 'Gas, dust or ventilation' },
  { value: 'fire', label: 'Fire or smoke' },
];

export const INCIDENT_TYPES: Option[] = [
  { value: 'nearmiss', label: 'Near miss' },
  { value: 'injury', label: 'Injury' },
  { value: 'damage', label: 'Equipment / property damage' },
];

export const SEVERITIES: Option[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const PERMIT_TYPES: Option[] = [
  { value: 'hot', label: 'Hot work' },
  { value: 'confined', label: 'Confined space entry' },
  { value: 'height', label: 'Working at height' },
  { value: 'electrical', label: 'Electrical isolation' },
];

/** Demo acceptance band for oxygen before confined-space entry (illustrative, not a regulatory limit). */
export const O2_MIN = 19.5;
export const O2_MAX = 23.5;

/* ---------- Assets ---------- */
export const EQUIPMENT_CATEGORIES: Option[] = [
  { value: 'lhd', label: 'Load-haul-dump (LHD)' },
  { value: 'drill', label: 'Drill rig' },
  { value: 'bolter', label: 'Roof bolter' },
  { value: 'loco', label: 'Battery locomotive' },
  { value: 'fan', label: 'Auxiliary ventilation fan' },
  { value: 'pump', label: 'Dewatering pump' },
  { value: 'uv', label: 'Utility vehicle' },
];

export const AVAILABILITY: Option[] = [
  { value: 'available', label: 'Available' },
  { value: 'down', label: 'Down for repair' },
  { value: 'standby', label: 'Standby' },
];

export const WO_TYPES: Option[] = [
  { value: 'planned', label: 'Planned service' },
  { value: 'breakdown', label: 'Breakdown' },
];

export const PRIORITIES: Option[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergency', label: 'Emergency' },
];

export const ARTISANS: Option[] = [
  { value: 'dm', label: 'Dumisani Mahlangu (diesel mechanic)' },
  { value: 'ef', label: 'Elsabé Fourie (electrician)' },
  { value: 'tn', label: 'Tshepo Nkadimeng (fitter)' },
  { value: 'gv', label: 'Gert van Rooyen (boilermaker)' },
];

/* ---------- Compliance ---------- */
export const TRADES: Option[] = [
  { value: 'shaftsinking', label: 'Shaft services' },
  { value: 'drilling', label: 'Exploration drilling' },
  { value: 'ventilation', label: 'Ventilation' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'civils', label: 'Civils & construction' },
  { value: 'pumps', label: 'Pump maintenance' },
  { value: 'rockeng', label: 'Rock engineering support' },
];

export const ENV_POINTS: Option[] = [
  { value: 'upcast', label: 'Upcast ventilation shaft' },
  { value: 'l7e-tip', label: 'Level 7 East tip' },
  { value: 'l9n-face', label: 'Level 9 North development end' },
  { value: 'crusher', label: 'Surface crusher' },
  { value: 'rwd', label: 'Return water dam' },
  { value: 'boundary', label: 'North boundary fence' },
];

export type EnvParam = { value: string; label: string; unit: string; min?: number; max?: number; points: string[] };

/** Demo thresholds only — NOT regulatory or licence limits. */
export const ENV_PARAMS: EnvParam[] = [
  { value: 'dust', label: 'Respirable dust', unit: 'mg/m³', max: 1.5, points: ['upcast', 'l7e-tip', 'l9n-face', 'crusher'] },
  { value: 'noise', label: 'Noise', unit: 'dB(A)', max: 85, points: ['l7e-tip', 'crusher', 'boundary'] },
  { value: 'ph', label: 'Water pH', unit: '', min: 6, max: 9, points: ['rwd'] },
];

/** Value with its unit, e.g. "1.2 mg/m³" (pH has no unit). */
export const withUnit = (v: number | string, unit: string | undefined) => (unit ? `${v} ${unit}` : String(v));

export const label = (list: Option[], v: unknown) => list.find((x) => x.value === v)?.label ?? (v ? String(v) : '—');
