// Option lists and demo rules for the shopping-centre demo. Everything here is illustrative:
// tariffs, thresholds and formulas are demo rules, not lease or municipal terms.

export type Opt = { value: string; label: string };
export const label = (list: Opt[], value: string) => list.find((o) => o.value === value)?.label ?? value;

export const VAT_RATE = 15;

/* ---------------- Demo rules ---------------- */
/** Lettings above this GLA need the leasing manager's approval before heads of terms. */
export const APPROVAL_GLA = 500;
/** Rent-to-sales above this is flagged "at risk". */
export const RENT_TO_SALES_RISK = 15;
/** A month's metered usage this far above or below last month's is flagged for review. */
export const USAGE_REVIEW_PCT = 40;
/** Turnover for a month is due by this day of the next month. */
export const DECLARATION_DUE_DAY = 7;
/** Leases ending within this many months are flagged. */
export const EXPIRY_WARNING_MONTHS = 6;
/** A lease still trading this close to its end with no renewal opened is "renewal overdue". */
export const RENEWAL_OVERDUE_DAYS = 90;
/** Invoices are due this many days after the invoice date. */
export const PAYMENT_TERMS_DAYS = 7;
/** A letter of demand can be logged once the oldest unpaid invoice is this many days overdue. */
export const DEMAND_AFTER_DAYS = 30;
/** Demo tariffs for recovering metered utilities (excl. VAT). */
export const ELEC_TARIFF = 2.85;
export const WATER_TARIFF = 48.5;

/* ---------------- Units ---------------- */
export const LEVELS: Opt[] = [
  { value: 'upper', label: 'Upper level' },
  { value: 'food', label: 'Food court' },
  { value: 'ground', label: 'Ground level' },
  { value: 'lower', label: 'Lower mall' },
  { value: 'kiosk', label: 'Kiosks & pads' },
];

export const CATEGORIES: Opt[] = [
  { value: 'grocery', label: 'Grocery anchor' },
  { value: 'department', label: 'Department & majors' },
  { value: 'fashion', label: 'Fashion & footwear' },
  { value: 'health', label: 'Health & beauty' },
  { value: 'electronics', label: 'Electronics & mobile' },
  { value: 'home', label: 'Home & gifts' },
  { value: 'services', label: 'Services' },
  { value: 'restaurant', label: 'Restaurants' },
  { value: 'food', label: 'Food court' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'kiosk', label: 'Kiosks' },
];

/** Soft fills for the stacking plan when coloured by category. */
export const CATEGORY_COLOURS: Record<string, string> = {
  grocery: '#cfe6c9', department: '#d7d3ee', fashion: '#f6cfe3', health: '#c9e7e6', electronics: '#cddcf3', home: '#f3e3c2',
  services: '#e2e2dc', restaurant: '#f7d4c2', food: '#fbe7a8', entertainment: '#dcc9ea', kiosk: '#d9ecf7',
};
export const STATUS_COLOURS: Record<string, string> = { let: '#cfe6d3', fitout: '#cddcf3', offer: '#f6e2b8', vacant: '#f3cdc9' };

/* ---------------- Leases ---------------- */
export const DEPOSIT_TYPES: Opt[] = [
  { value: 'cash', label: 'Cash deposit' },
  { value: 'guarantee', label: 'Bank guarantee' },
];
export const CREDIT_CHECK: Opt[] = [
  { value: 'pending', label: 'Not done' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
];
/** Lease states in which the tenant holds the unit. */
export const ACTIVE_LEASE = ['hot', 'signed', 'fitout', 'trading', 'renewal', 'notice'];
/** Lease states that are billed every month. */
export const BILLED_LEASE = ['trading', 'renewal', 'notice'];

export const PROSPECT_SOURCES: Opt[] = [
  { value: 'broker', label: 'Broker' },
  { value: 'walkin', label: 'Walk-in / centre management office' },
  { value: 'website', label: 'Website enquiry' },
  { value: 'existing', label: 'Existing tenant expanding' },
  { value: 'canvass', label: 'Canvassed by leasing' },
];

/* ---------------- Operations ---------------- */
export const WO_CATEGORIES: Opt[] = [
  { value: 'electrical', label: 'Electrical & lighting' },
  { value: 'plumbing', label: 'Plumbing & drainage' },
  { value: 'hvac', label: 'Air conditioning' },
  { value: 'roof', label: 'Roof & leaks' },
  { value: 'lifts', label: 'Lifts & escalators' },
  { value: 'shopfront', label: 'Shopfront & doors' },
  { value: 'fire', label: 'Fire equipment' },
  { value: 'general', label: 'General building' },
];
export const WO_SOURCES: Opt[] = [
  { value: 'tenant', label: 'Tenant request' },
  { value: 'common', label: 'Common area' },
  { value: 'inspection', label: 'Found on inspection' },
];
/** Days allowed between logging a job and assigning a contractor (date-only rule). */
export const PRIORITIES: Array<Opt & { days: number }> = [
  { value: 'emergency', label: 'Emergency — same day', days: 0 },
  { value: 'urgent', label: 'Urgent — 2 days', days: 2 },
  { value: 'routine', label: 'Routine — 7 days', days: 7 },
];
export const RESPONSIBILITY: Opt[] = [
  { value: 'landlord', label: 'Landlord' },
  { value: 'tenant', label: 'Tenant' },
];

export const PERMIT_TYPES: Opt[] = [
  { value: 'hot', label: 'Hot work' },
  { value: 'heights', label: 'Working at heights' },
  { value: 'sprinkler', label: 'Sprinkler isolation' },
  { value: 'electrical', label: 'Electrical isolation' },
  { value: 'general', label: 'General contractor work' },
];
export const PERMIT_WINDOWS: Opt[] = [
  { value: 'day', label: 'Trading hours' },
  { value: 'afterhours', label: 'After hours' },
];

export const INCIDENT_TYPES: Opt[] = [
  { value: 'slip', label: 'Slip-and-fall' },
  { value: 'theft', label: 'Theft / shoplifting' },
  { value: 'fire', label: 'Fire alarm' },
  { value: 'medical', label: 'Medical' },
  { value: 'power', label: 'Power outage' },
  { value: 'damage', label: 'Property damage' },
];

/* ---------------- Marketing ---------------- */
export const SPACES: Opt[] = [
  { value: 'court-g', label: 'Promotions court (Ground)' },
  { value: 'court-l', label: 'Centre court (Lower mall)' },
  { value: 'pad-a', label: 'Kiosk pad A (Ground, east)' },
  { value: 'pad-b', label: 'Kiosk pad B (Upper, cinema foyer)' },
  { value: 'forecourt', label: 'Entrance 2 forecourt' },
];
export const BOOKING_TYPES: Opt[] = [
  { value: 'promotion', label: 'Brand promotion' },
  { value: 'exhibition', label: 'Exhibition / display' },
  { value: 'popup', label: 'Pop-up kiosk' },
  { value: 'charity', label: 'Charity / community' },
];
export const CAMPAIGN_KINDS: Opt[] = [
  { value: 'event', label: 'Centre event' },
  { value: 'advertising', label: 'Advertising' },
  { value: 'decor', label: 'Seasonal décor' },
  { value: 'digital', label: 'Digital & social' },
];

/* ---------------- Workflow state labels (shared by the config and by rule messages) ---------------- */
export const LEASE_STATES: Record<string, string> = {
  application: 'Application', hot: 'Heads of terms', signed: 'Lease signed', fitout: 'Fit-out', trading: 'Trading',
  renewal: 'Renewal negotiation', notice: 'Notice given', vacated: 'Vacated', declined: 'Declined / withdrawn',
};
export const UNIT_STATES: Record<string, string> = { let: 'Let', fitout: 'Fit-out', offer: 'Under offer', vacant: 'Vacant' };
