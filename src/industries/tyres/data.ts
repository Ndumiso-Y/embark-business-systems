// Fictional reference lists for the TreadRight Tyre & Fitment demo. Brands,
// people, asset numbers, prices and specifications are invented. Torque,
// tread-depth and alignment limits are demo rules — not legal or OEM advice.

export type Opt = { value: string; label: string };

export const label = (list: Opt[], v: unknown) => list.find((x) => x.value === v)?.label ?? (v ? String(v) : '—');

export const BAYS: Opt[] = [
  { value: 'b1', label: 'Bay 1' },
  { value: 'b2', label: 'Bay 2' },
  { value: 'b3', label: 'Bay 3' },
  { value: 'b4', label: 'Bay 4' },
  { value: 'align', label: 'Alignment bay' },
];

export const TECHNICIANS: Array<Opt & { short: string; skill: string }> = [
  { value: 'sk', label: 'Sipho Khumalo', short: 'S. Khumalo', skill: 'Fitment technician' },
  { value: 'jv', label: 'Jaco Venter', short: 'J. Venter', skill: 'Fitment technician' },
  { value: 'np', label: 'Nadia Pillay', short: 'N. Pillay', skill: 'Fitment technician' },
  { value: 'md', label: 'Musa Dlamini', short: 'M. Dlamini', skill: 'Fitment technician' },
  { value: 'lm', label: 'Lerato Molefe', short: 'L. Molefe', skill: 'Alignment technician' },
];

export const techName = (v: unknown) => label(TECHNICIANS, v);

/** Wheel positions recorded on every job, seen from above with the nose at the top. */
export const POSITIONS = [
  { key: 'lf', label: 'LF', name: 'Left front' },
  { key: 'rf', label: 'RF', name: 'Right front' },
  { key: 'lr', label: 'LR', name: 'Left rear' },
  { key: 'rr', label: 'RR', name: 'Right rear' },
] as const;
export const SPARE = { key: 'sp', label: 'Spare', name: 'Spare wheel' } as const;
export type PosKey = (typeof POSITIONS)[number]['key'] | 'sp';

export const CONDITIONS: Opt[] = [
  { value: 'good', label: 'Good' },
  { value: 'worn', label: 'Worn' },
  { value: 'uneven', label: 'Uneven wear' },
  { value: 'puncture', label: 'Puncture' },
  { value: 'sidewall', label: 'Sidewall damage' },
  { value: 'cracked', label: 'Perished / cracked' },
];

/** Demo rules for tread depth (mm). */
export const TREAD_LEGAL_MIN = 1.0;
export const TREAD_ADVISE = 3.0;
/** Demo rule: tyres older than this (from the DOT week/year) are flagged as old stock. */
export const OLD_STOCK_YEARS = 5;
/** Demo rule: rotation every 10,000 km. */
export const ROTATION_KM = 10_000;
/** Demo rule: tools must be back on the tool board by close of business; anything still out from a previous day is "not returned". */
/** Tools whose calibration falls due within this many days are flagged. */
export const CALIBRATION_WARN_DAYS = 14;
/** Warranty claims open longer than this are flagged. */
export const CLAIM_OPEN_DAYS = 21;

/** Demo alignment tolerance (after readings must be inside this). */
export const ALIGN_SPEC = { toe: { min: -1.0, max: 1.0, unit: 'mm' }, camber: { min: -1.5, max: 0.5, unit: '°' } };
export const ALIGN_READINGS = [
  { key: 'ftoe', label: 'Front toe', kind: 'toe' as const },
  { key: 'fcam', label: 'Front camber', kind: 'camber' as const },
  { key: 'rtoe', label: 'Rear toe', kind: 'toe' as const },
  { key: 'rcam', label: 'Rear camber', kind: 'camber' as const },
];

export const VEHICLE_CLASSES: Array<Opt & { torque: [number, number]; kpa: number }> = [
  { value: 'passenger', label: 'Passenger car', torque: [110, 120], kpa: 220 },
  { value: 'suv', label: 'SUV / crossover', torque: [130, 140], kpa: 240 },
  { value: 'bakkie', label: 'Bakkie (LDV)', torque: [140, 160], kpa: 280 },
  { value: 'lcv', label: 'Minibus / LCV', torque: [160, 180], kpa: 350 },
];

export const CUSTOMER_KINDS: Opt[] = [
  { value: 'retail', label: 'Retail (walk-in)' },
  { value: 'fleet', label: 'Fleet account' },
];

export const APPROVAL_CHANNELS: Opt[] = [
  { value: 'counter', label: 'In person at the counter' },
  { value: 'phone', label: 'Phone call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
];

export const PAYMENT_METHODS: Opt[] = [
  { value: 'card', label: 'Card (simulated)' },
  { value: 'cash', label: 'Cash' },
  { value: 'eft', label: 'EFT (simulated)' },
  { value: 'remittance', label: 'Fleet remittance (simulated)' },
];

export const TOOL_TYPES: Array<Opt & { calibrated: boolean; months: number; prefix: string }> = [
  { value: 'torque', label: 'Torque wrench', calibrated: true, months: 6, prefix: 'TW' },
  { value: 'impact', label: 'Impact wrench', calibrated: false, months: 6, prefix: 'IW' },
  { value: 'changer', label: 'Tyre changer', calibrated: false, months: 12, prefix: 'TC' },
  { value: 'balancer', label: 'Wheel balancer', calibrated: true, months: 12, prefix: 'WB' },
  { value: 'aligner', label: 'Alignment machine', calibrated: true, months: 12, prefix: 'AM' },
  { value: 'jack', label: 'Trolley jack', calibrated: false, months: 12, prefix: 'TJ' },
  { value: 'nitrogen', label: 'Nitrogen generator', calibrated: false, months: 6, prefix: 'NG' },
  { value: 'tpms', label: 'TPMS tool', calibrated: true, months: 12, prefix: 'TP' },
];

export const TOOL_LOCATIONS: Opt[] = [...BAYS, { value: 'store', label: 'Tool store' }];

export const TOOL_CONDITIONS: Opt[] = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair — monitor' },
  { value: 'poor', label: 'Poor — schedule repair' },
];

export const BRANDS: Opt[] = [
  { value: 'veldtrek', label: 'Veldtrek' },
  { value: 'karoo', label: 'Karoo Grip' },
  { value: 'duneline', label: 'Duneline' },
  { value: 'highveld', label: 'Highveld Touring' },
  { value: 'marula', label: 'Marula' },
  { value: 'stormberg', label: 'Stormberg' },
];

export const SPEED_RATINGS: Opt[] = ['Q', 'R', 'S', 'T', 'H', 'V', 'W', 'Y'].map((s) => ({ value: s, label: s }));

export const SUPPLIERS = ['Ridgeway Tyre Distributors (fictional)', 'Kloof Wholesale Tyres (fictional)', 'Vaal Rubber Supply (fictional)'];

export const DAMAGE_TYPES: Array<Opt & { warrantable: boolean }> = [
  { value: 'separation', label: 'Tread separation', warrantable: true },
  { value: 'bulge', label: 'Sidewall bulge (no impact mark)', warrantable: true },
  { value: 'irregular', label: 'Irregular wear (casing defect)', warrantable: true },
  { value: 'bead', label: 'Bead failure', warrantable: true },
  { value: 'impact', label: 'Road hazard / impact', warrantable: false },
  { value: 'puncture', label: 'Puncture', warrantable: false },
  { value: 'runflat', label: 'Run flat / under-inflated', warrantable: false },
];

/** Fictional price list for labour and sundries (rand, excl. VAT). */
export const PRICES = {
  fitment: 95, // per tyre, incl. valve
  balancing: 85, // per wheel
  alignment: 450,
  puncture: 180,
  nitrogen: 40, // per tyre
  rotation: 220,
  disposal: 25, // per old tyre
};

/** Services that can be sold on a job. Keys are job field names. */
export const SERVICES: Array<{ key: string; label: string; short: string }> = [
  { key: 'balancing', label: 'Wheel balancing', short: 'Balance' },
  { key: 'alignment', label: 'Wheel alignment', short: 'Align' },
  { key: 'puncture', label: 'Puncture repair', short: 'Puncture' },
  { key: 'nitrogen', label: 'Nitrogen fill', short: 'N₂' },
  { key: 'rotation', label: 'Tyre rotation', short: 'Rotate' },
];

export const QC_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'qcRetorque', label: 'Wheel nuts torqued in star pattern and re-checked' },
  { key: 'qcPressure', label: 'Pressures set to placard, valve caps fitted' },
  { key: 'qcCaps', label: 'Hub caps / locknut key returned to vehicle' },
  { key: 'qcOldTyres', label: 'Old tyres returned to customer or tagged for disposal' },
];

/**
 * Fictional tyre catalogue: size (with load/speed), brand, pattern, age of stock
 * in days (→ DOT week/year), qty, cost, sell, reorder level, bin.
 */
export const STOCK: Array<[string, number, string, string, string, number, number, number, number, number, string]> = [
  ['165/70R14', 81, 'T', 'veldtrek', 'CityTrek', 260, 14, 610, 899, 8, 'A1'],
  ['165/70R14', 81, 'T', 'marula', 'Eco 2', 500, 6, 540, 799, 6, 'A1'],
  ['175/65R14', 82, 'T', 'veldtrek', 'CityTrek', 180, 12, 650, 950, 8, 'A2'],
  ['175/65R14', 82, 'H', 'highveld', 'Touring HT', 420, 4, 720, 1050, 6, 'A2'],
  ['175/70R14', 84, 'T', 'karoo', 'Comfort 4', 300, 10, 690, 999, 8, 'A3'],
  ['175/70R14', 84, 'T', 'marula', 'Eco 2', 1950, 4, 600, 650, 4, 'A3'],
  ['185/60R15', 84, 'H', 'highveld', 'Touring HT', 210, 8, 820, 1190, 6, 'B1'],
  ['185/60R15', 88, 'H', 'duneline', 'Sport D1', 640, 3, 880, 1290, 4, 'B1'],
  ['185/65R15', 88, 'H', 'veldtrek', 'CityTrek', 150, 16, 790, 1150, 8, 'B2'],
  ['185/65R15', 88, 'T', 'karoo', 'Comfort 4', 380, 7, 760, 1099, 6, 'B2'],
  ['185/65R15', 88, 'H', 'stormberg', 'Allroad', 2050, 2, 700, 690, 4, 'B2'],
  ['195/65R15', 91, 'H', 'highveld', 'Touring HT', 240, 9, 880, 1290, 6, 'B3'],
  ['195/65R15', 91, 'V', 'duneline', 'Sport D1', 520, 5, 940, 1350, 4, 'B3'],
  ['195/55R16', 87, 'V', 'duneline', 'Sport D1', 330, 6, 1050, 1490, 4, 'C1'],
  ['195/55R16', 87, 'H', 'veldtrek', 'CityTrek', 140, 2, 980, 1390, 4, 'C1'],
  ['205/55R16', 91, 'V', 'highveld', 'Touring HT', 120, 14, 1120, 1590, 8, 'C2'],
  ['205/55R16', 91, 'V', 'duneline', 'Sport D1', 270, 8, 1190, 1690, 6, 'C2'],
  ['205/55R16', 91, 'H', 'karoo', 'Comfort 4', 600, 4, 1050, 1490, 6, 'C2'],
  ['205/60R16', 92, 'H', 'highveld', 'Touring HT', 360, 6, 1150, 1650, 4, 'C3'],
  ['215/60R16', 95, 'H', 'karoo', 'Comfort 4', 280, 5, 1240, 1790, 4, 'C3'],
  ['215/55R17', 94, 'V', 'duneline', 'Sport D1', 200, 8, 1480, 2090, 4, 'D1'],
  ['215/55R17', 94, 'V', 'highveld', 'Touring HT', 450, 1, 1420, 1990, 4, 'D1'],
  ['225/45R17', 94, 'W', 'duneline', 'Sport D1', 230, 7, 1560, 2190, 4, 'D2'],
  ['225/45R17', 91, 'W', 'stormberg', 'Allroad', 1880, 3, 1350, 1890, 2, 'D2'],
  ['225/50R17', 98, 'V', 'highveld', 'Touring HT', 310, 4, 1610, 2290, 4, 'D2'],
  ['215/65R16', 98, 'H', 'karoo', 'Trail SUV', 260, 8, 1390, 1990, 4, 'D3'],
  ['225/65R17', 102, 'H', 'karoo', 'Trail SUV', 170, 10, 1690, 2390, 6, 'E1'],
  ['225/65R17', 102, 'H', 'veldtrek', 'Trek SUV', 540, 3, 1590, 2250, 4, 'E1'],
  ['235/65R17', 104, 'H', 'karoo', 'Trail SUV', 290, 6, 1840, 2590, 4, 'E2'],
  ['235/60R18', 107, 'V', 'highveld', 'Touring SUV', 350, 4, 2150, 2990, 4, 'E2'],
  ['255/60R18', 112, 'H', 'stormberg', 'Allroad', 410, 2, 2350, 3290, 2, 'E3'],
  ['245/70R16', 111, 'T', 'stormberg', 'All Terrain', 190, 8, 1980, 2790, 4, 'F1'],
  ['245/70R16', 111, 'S', 'veldtrek', 'Trek AT', 470, 4, 1890, 2650, 4, 'F1'],
  ['265/65R17', 112, 'T', 'stormberg', 'All Terrain', 220, 6, 2190, 3090, 4, 'F2'],
  ['265/65R17', 112, 'S', 'veldtrek', 'Trek AT', 380, 2, 2090, 2950, 4, 'F2'],
  ['265/60R18', 110, 'T', 'stormberg', 'All Terrain', 300, 4, 2490, 3450, 4, 'F3'],
  ['255/70R15', 108, 'S', 'veldtrek', 'Trek AT', 2100, 4, 1650, 1990, 2, 'F3'],
  ['195/70R15C', 104, 'R', 'stormberg', 'Cargo C', 160, 12, 1290, 1850, 8, 'G1'],
  ['195/70R15C', 104, 'R', 'karoo', 'Van Pro', 430, 6, 1210, 1750, 6, 'G1'],
  ['215/70R15C', 109, 'R', 'stormberg', 'Cargo C', 250, 8, 1490, 2090, 6, 'G2'],
  ['185R14C', 102, 'Q', 'karoo', 'Van Pro', 340, 6, 1080, 1550, 4, 'G2'],
  ['155/80R13', 79, 'T', 'marula', 'Eco 2', 230, 10, 520, 760, 6, 'H1'],
  ['165/80R13', 83, 'T', 'marula', 'Eco 2', 1990, 3, 540, 780, 4, 'H1'],
  ['185/55R15', 82, 'V', 'duneline', 'Sport D1', 280, 4, 900, 1290, 2, 'H2'],
  ['215/45R17', 91, 'W', 'duneline', 'Sport D1', 330, 2, 1450, 2090, 2, 'H2'],
];
