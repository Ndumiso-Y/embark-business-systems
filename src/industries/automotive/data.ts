// Fictional reference lists for the Torque Lane Auto Services demo. People,
// part numbers, suppliers and prices are invented. Vehicle makes are shown only
// as everyday descriptions of customers' cars — no OEM data is used.

export type Opt = { value: string; label: string };

export const BAYS: Opt[] = [
  { value: 'b1', label: 'Bay 1' },
  { value: 'b2', label: 'Bay 2' },
  { value: 'b3', label: 'Bay 3' },
  { value: 'b4', label: 'Bay 4 (alignment)' },
];

export const TECHNICIANS: Array<Opt & { short: string; grade: string }> = [
  { value: 'sn', label: 'Sibusiso Ndaba', short: 'S. Ndaba', grade: 'Qualified technician' },
  { value: 'ad', label: 'Ahmed Davids', short: 'A. Davids', grade: 'Diagnostic technician' },
  { value: 'kf', label: 'Kyle Februarie', short: 'K. Februarie', grade: 'Qualified technician' },
  { value: 'tz', label: 'Thandeka Zwane', short: 'T. Zwane', grade: 'Tyre & brake technician' },
];

export const JOB_TYPES: Opt[] = [
  { value: 'service-minor', label: 'Minor service' },
  { value: 'service-major', label: 'Major service' },
  { value: 'repair', label: 'Repair' },
  { value: 'diagnosis', label: 'Diagnostic' },
  { value: 'tyres', label: 'Tyres & alignment' },
  { value: 'comeback', label: 'Comeback / rework' },
];

export const CUSTOMER_KINDS: Opt[] = [
  { value: 'private', label: 'Private customer' },
  { value: 'account', label: 'Fleet account (30 days)' },
];

export const CONTACT_METHODS: Opt[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'phone', label: 'Phone call' },
  { value: 'email', label: 'Email' },
];

export const PAYMENT_METHODS: Opt[] = [
  { value: 'card', label: 'Card (simulated)' },
  { value: 'eft', label: 'EFT (simulated)' },
  { value: 'cash', label: 'Cash' },
  { value: 'account', label: 'Account remittance' },
];

export const PART_CATEGORIES: Opt[] = [
  { value: 'filters', label: 'Filters' },
  { value: 'fluids', label: 'Oils & fluids' },
  { value: 'brakes', label: 'Brakes' },
  { value: 'ignition', label: 'Ignition & electrical' },
  { value: 'suspension', label: 'Suspension & steering' },
  { value: 'drivetrain', label: 'Clutch & drivetrain' },
  { value: 'tyres', label: 'Tyres' },
  { value: 'sundries', label: 'Workshop sundries' },
];

/** Workshop labour rate, rand per hour excluding VAT (fictional). */
export const LABOUR_RATE = 850;

/** Standard working day per technician / bay, in hours. */
export const DAY_HOURS = 8;

/** Service interval used by the demo: 12 months or 15,000 km, whichever comes first. */
export const SERVICE_INTERVAL = { months: 12, km: 15_000 };

/** Fictional parts catalogue: partNo, description, category, fits, cost, sell, qty, reorder, bin. */
export const PARTS: Array<[string, string, string, string, number, number, number, number, string]> = [
  ['TL-OF-1021', 'Oil filter (spin-on, small)', 'filters', 'Most 1.0–1.6 petrol hatchbacks', 68, 145, 14, 8, 'A1'],
  ['TL-OF-1044', 'Oil filter (cartridge, diesel)', 'filters', '2.0–2.8 diesel bakkies & SUVs', 112, 235, 9, 6, 'A1'],
  ['TL-AF-2010', 'Air filter element (panel)', 'filters', 'Compact & mid-size petrol', 96, 210, 9, 5, 'A2'],
  ['TL-AF-2033', 'Air filter element (diesel)', 'filters', 'Diesel bakkies & SUVs', 158, 340, 3, 4, 'A2'],
  ['TL-FF-3002', 'Fuel filter (diesel, in-line)', 'filters', 'Common-rail diesel', 215, 465, 4, 3, 'A3'],
  ['TL-CF-3110', 'Cabin pollen filter', 'filters', 'Most passenger vehicles', 74, 175, 11, 6, 'A3'],
  ['TL-EO-5W30', 'Engine oil 5W-30 fully synthetic (5 L)', 'fluids', 'Petrol & diesel (check spec)', 395, 720, 16, 10, 'B1'],
  ['TL-EO-1040', 'Engine oil 10W-40 semi-synthetic (5 L)', 'fluids', 'Older petrol engines', 285, 540, 9, 6, 'B1'],
  ['TL-BF-DOT4', 'Brake fluid DOT 4 (500 ml)', 'fluids', 'All', 58, 125, 18, 8, 'B2'],
  ['TL-CL-5000', 'Coolant concentrate (5 L)', 'fluids', 'All (OAT)', 165, 320, 7, 4, 'B2'],
  ['TL-AC-R134', 'Aircon re-gas & dye (per charge)', 'fluids', 'R134a systems', 280, 650, 6, 3, 'B3'],
  ['TL-BP-F110', 'Brake pads, front axle set', 'brakes', 'Compact hatchbacks & sedans', 340, 690, 6, 4, 'C1'],
  ['TL-BP-F240', 'Brake pads, front axle set (heavy duty)', 'brakes', 'Bakkies & SUVs', 520, 1050, 2, 3, 'C1'],
  ['TL-BP-R115', 'Brake shoes, rear set', 'brakes', 'Compact hatchbacks (drum rear)', 290, 595, 4, 2, 'C2'],
  ['TL-BD-F110', 'Brake disc, front (each)', 'brakes', 'Compact hatchbacks & sedans', 410, 820, 8, 4, 'C2'],
  ['TL-BD-F240', 'Brake disc, front (each, heavy duty)', 'brakes', 'Bakkies & SUVs', 690, 1390, 2, 2, 'C3'],
  ['TL-SP-4IR', 'Spark plug, iridium (each)', 'ignition', '4-cylinder petrol', 95, 210, 24, 12, 'D1'],
  ['TL-BT-652', 'Battery 652 maintenance-free', 'ignition', 'Mid-size sedans & hatchbacks', 1150, 1950, 5, 3, 'D2'],
  ['TL-BT-668', 'Battery 668 heavy duty', 'ignition', 'Bakkies & SUVs', 1620, 2650, 1, 2, 'D2'],
  ['TL-WB-0045', 'Wiper blade pair (universal)', 'ignition', 'Most passenger vehicles', 120, 260, 9, 4, 'D3'],
  ['TL-SA-F210', 'Front shock absorber (each)', 'suspension', 'Compact hatchbacks', 640, 1250, 4, 2, 'E1'],
  ['TL-SL-0330', 'Stabiliser link (each)', 'suspension', 'Compact & mid-size', 185, 380, 6, 4, 'E1'],
  ['TL-TR-0412', 'Tie-rod end (each)', 'suspension', 'Compact & mid-size', 210, 440, 5, 2, 'E2'],
  ['TL-CK-1600', 'Clutch kit (3-piece)', 'drivetrain', '1.4–1.6 petrol manual', 2450, 4300, 1, 1, 'F1'],
  ['TL-CK-2400', 'Clutch kit (3-piece, diesel)', 'drivetrain', '2.4–2.8 diesel bakkies', 4200, 7250, 0, 1, 'F1'],
  ['TL-TB-1600', 'Timing belt kit with tensioner', 'drivetrain', '1.4–1.6 petrol (belt-driven)', 1380, 2550, 2, 1, 'F2'],
  ['TL-TY-1856', 'Tyre 185/65 R15 (each)', 'tyres', 'Compact hatchbacks & sedans', 820, 1290, 10, 8, 'G1'],
  ['TL-TY-2657', 'Tyre 265/65 R17 all-terrain (each)', 'tyres', 'Bakkies & SUVs', 1890, 2790, 3, 4, 'G2'],
  ['TL-TV-0001', 'Tyre valve & balance weights', 'tyres', 'All', 18, 55, 60, 20, 'G3'],
  ['TL-SU-0100', 'Workshop sundries (cleaners, rags, washers)', 'sundries', 'All', 35, 95, 80, 20, 'H1'],
];

/** A job template used by the seed and the "quick estimate" picker. */
export type JobTemplate = {
  key: string;
  type: string;
  label: string;
  complaint: string;
  /** Labour lines: description and hours. */
  labour: Array<[string, number]>;
  /** Parts lines: part number and quantity. Use the diesel variants for bakkies. */
  parts: Array<[string, number]>;
  partsDiesel?: Array<[string, number]>;
};

export const JOB_TEMPLATES: JobTemplate[] = [
  {
    key: 'minor', type: 'service-minor', label: 'Minor service', complaint: 'Scheduled minor service. Customer reports no problems.',
    labour: [['Minor service: oil & filter, safety inspection', 1.5]],
    parts: [['TL-OF-1021', 1], ['TL-EO-5W30', 1], ['TL-SU-0100', 1]],
    partsDiesel: [['TL-OF-1044', 1], ['TL-EO-5W30', 2], ['TL-SU-0100', 1]],
  },
  {
    key: 'major', type: 'service-major', label: 'Major service', complaint: 'Scheduled major service due by kilometres.',
    labour: [['Major service: filters, plugs, fluids, full inspection', 3.5]],
    parts: [['TL-OF-1021', 1], ['TL-EO-5W30', 1], ['TL-AF-2010', 1], ['TL-CF-3110', 1], ['TL-SP-4IR', 4], ['TL-SU-0100', 1]],
    partsDiesel: [['TL-OF-1044', 1], ['TL-EO-5W30', 2], ['TL-AF-2033', 1], ['TL-FF-3002', 1], ['TL-CF-3110', 1], ['TL-SU-0100', 1]],
  },
  {
    key: 'brakes', type: 'repair', label: 'Front brakes', complaint: 'Grinding noise from the front when braking.',
    labour: [['Replace front pads & discs, bleed brakes', 2.5]],
    parts: [['TL-BP-F110', 1], ['TL-BD-F110', 2], ['TL-BF-DOT4', 1]],
    partsDiesel: [['TL-BP-F240', 1], ['TL-BD-F240', 2], ['TL-BF-DOT4', 1]],
  },
  {
    key: 'clutch', type: 'repair', label: 'Clutch replacement', complaint: 'Clutch slipping on hills; burning smell.',
    labour: [['Remove gearbox, replace clutch kit, refit', 5]],
    parts: [['TL-CK-1600', 1], ['TL-SU-0100', 1]],
    partsDiesel: [['TL-CK-2400', 1], ['TL-SU-0100', 1]],
  },
  {
    key: 'aircon', type: 'repair', label: 'Aircon re-gas', complaint: 'Aircon blowing warm air.',
    labour: [['Aircon leak test, evacuate & re-gas', 1.5]],
    parts: [['TL-AC-R134', 1], ['TL-CF-3110', 1]],
  },
  {
    key: 'diag', type: 'diagnosis', label: 'Engine warning light', complaint: 'Engine warning light on; rough idle when cold.',
    labour: [['Diagnostic scan & fault finding', 1]],
    parts: [['TL-SP-4IR', 4]],
  },
  {
    key: 'battery', type: 'diagnosis', label: 'Battery & charging', complaint: 'Slow cranking in the mornings.',
    labour: [['Battery & charging system test, replace battery', 0.5]],
    parts: [['TL-BT-652', 1]],
    partsDiesel: [['TL-BT-668', 1]],
  },
  {
    key: 'suspension', type: 'repair', label: 'Suspension knock', complaint: 'Knocking from front suspension over speed bumps.',
    labour: [['Replace front stabiliser links & shock absorbers', 2], ['Wheel alignment', 0.75]],
    parts: [['TL-SL-0330', 2], ['TL-SA-F210', 2]],
    partsDiesel: [['TL-SL-0330', 2], ['TL-TR-0412', 2]],
  },
  {
    key: 'tyres', type: 'tyres', label: 'Tyres & alignment', complaint: 'Front tyres worn on the inside edge.',
    labour: [['Fit & balance 2 tyres, wheel alignment', 1]],
    parts: [['TL-TY-1856', 2], ['TL-TV-0001', 2]],
    partsDiesel: [['TL-TY-2657', 2], ['TL-TV-0001', 2]],
  },
];

export const label = (list: Opt[], v: unknown) => list.find((x) => x.value === v)?.label ?? (v ? String(v) : '—');
