// Fictional reference lists for the real-estate demo (Kestrel Property Group).
// Every suburb, street, person, firm and certificate number is invented.

export type Option = { value: string; label: string };

/** Invented suburbs — none of these is a real place the demo knows about. */
export const SUBURBS: Option[] = [
  { value: 'marula', label: 'Marula Heights' },
  { value: 'fernwood', label: 'Fernwood Ridge' },
  { value: 'silverleaf', label: 'Silverleaf Estate' },
  { value: 'kingfisher', label: 'Kingfisher Bay' },
  { value: 'quartz', label: 'Quartz Hill' },
  { value: 'wildfig', label: 'Wildfig Park' },
  { value: 'stonechat', label: 'Stonechat Village' },
  { value: 'bramble', label: 'Bramble Downs' },
];

export const PROPERTY_TYPES: Option[] = [
  { value: 'house', label: 'Freestanding house' },
  { value: 'townhouse', label: 'Townhouse / cluster' },
  { value: 'apartment', label: 'Apartment (sectional title)' },
  { value: 'plot', label: 'Vacant plot' },
];

export const LEAD_PROPERTY_TYPES: Option[] = [{ value: 'any', label: 'Any type' }, ...PROPERTY_TYPES];

export const MANDATE_TYPES: Option[] = [
  { value: 'sole', label: 'Sole mandate' },
  { value: 'open', label: 'Open mandate' },
  { value: 'dual', label: 'Dual mandate' },
];

export const LEAD_SOURCES: Option[] = [
  { value: 'website', label: 'Agency website enquiry' },
  { value: 'portal', label: 'Property portal enquiry (captured manually — no portal connected)' },
  { value: 'board', label: 'On-show board / walk-in' },
  { value: 'showday', label: 'Show day sign-in sheet' },
  { value: 'referral', label: 'Referral' },
  { value: 'social', label: 'Social media' },
];

export const INTEREST: Option[] = [
  { value: 'hot', label: 'Hot — wants to make an offer' },
  { value: 'warm', label: 'Warm — considering' },
  { value: 'cold', label: 'Cold — not for them' },
];

export const VIEWING_KINDS: Option[] = [
  { value: 'private', label: 'Private viewing' },
  { value: 'showday', label: 'Show day' },
];

export const CONVEYANCERS: Option[] = [
  { value: 'ndaba', label: 'Ndaba & Venter Conveyancers (fictional)' },
  { value: 'coetzee', label: 'Coetzee Lamprecht Inc. (fictional)' },
  { value: 'harbour', label: 'Harbourline Attorneys (fictional)' },
];

export const VETTING: Option[] = [
  { value: 'pending', label: 'Not run yet' },
  { value: 'approved', label: 'Approved (simulated credit & reference check)' },
  { value: 'declined', label: 'Declined (simulated credit & reference check)' },
];

export const MANAGEMENT: Option[] = [
  { value: 'full', label: 'Full management' },
  { value: 'letting', label: 'Letting only (tenant placement)' },
];

export const MAINT_CATEGORIES: Option[] = [
  { value: 'plumbing', label: 'Plumbing / geyser' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'roof', label: 'Roof / damp' },
  { value: 'appliance', label: 'Appliances' },
  { value: 'security', label: 'Security / gate motor' },
  { value: 'general', label: 'General handyman' },
];

export const CONTRACTORS: Option[] = [
  { value: 'flowfix', label: 'FlowFix Plumbing (fictional)' },
  { value: 'brightspark', label: 'Brightspark Electrical (fictional)' },
  { value: 'topcoat', label: 'Topcoat Roofing & Painting (fictional)' },
  { value: 'gatekeeper', label: 'Gatekeeper Gate & Alarm (fictional)' },
  { value: 'handyhands', label: 'Handy Hands Maintenance (fictional)' },
];

export const PRIORITIES: Option[] = [
  { value: 'urgent', label: 'Urgent (24 h)' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

export const DESIGNATIONS: Option[] = [
  { value: 'principal', label: 'Principal property practitioner' },
  { value: 'full', label: 'Full-status property practitioner' },
  { value: 'intern', label: 'Candidate property practitioner (intern)' },
];

/** Demo setting: quotes above this need the owner's written approval. */
export const OWNER_APPROVAL_LIMIT = 2500;
/** Demo default commission rate on the selling price, excl. VAT. */
export const DEFAULT_COMMISSION_RATE = 7.5;
/** Demo default agent share of commission (the company keeps the rest). */
export const DEFAULT_AGENT_SPLIT = 50;
export const VAT_RATE = 15;
/** Buyer budgets match listings within this band (±10%). */
export const BUDGET_BAND = 0.1;

export const label = (list: Option[], v: unknown) => list.find((x) => x.value === v)?.label ?? String(v ?? '—');
export const suburbLabel = (v: unknown) => label(SUBURBS, v);
