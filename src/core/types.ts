// ---------------------------------------------------------------------------
// Embark Digitals industry-demo foundation — core contracts.
//
// An industry demo is a plain configuration object (IndustryConfig) that
// declares its fictional business, roles, users, modules, record collections,
// workflows, seed data and dashboard. The shared shell, store, register,
// detail, board and admin screens read that configuration. Nothing here talks
// to a server: all records are fictional and live in the visitor's browser.
// ---------------------------------------------------------------------------
import type { ComponentType, CSSProperties } from 'react';

export type Tone = 'green' | 'amber' | 'red' | 'dark' | 'accent' | 'blue';

/** One priced line (estimate, invoice, claim). Amounts are rand as entered. */
export type Line = {
  id: string;
  code?: string;
  description: string;
  qty: number;
  unitPrice: number;
};

export type Value = string | number | boolean | null | undefined | Line[];
export type Values = Record<string, Value>;

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'time' | 'select' | 'ref' | 'boolean' | 'lines';

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** For `select`. */
  options?: Array<{ value: string; label: string }>;
  /** For `ref`: key of another collection in the same industry. */
  ref?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  placeholder?: string;
  /** Show as a column in the register table. */
  table?: boolean;
  /** Full-width in forms. */
  wide?: boolean;
  /** Hidden from users without this permission (simulated, e.g. clinical notes). */
  permission?: string;
  /** For `ref`: limit which records can be picked (e.g. only frames, only this patient's prescriptions). */
  refFilter?: (target: DemoRecord, values: Values, data: IndustryData) => boolean;
  /** Internal value: kept on the record but left out of generic forms, details and tables. */
  hidden?: boolean;
  /** Unit shown after a number in details and tables, e.g. "km". */
  unit?: string;
  /** Cross-field / domain validation. Return an error message or null. */
  validate?: (value: Value, values: Values) => string | null;
};

export type WorkflowState = { key: string; label: string; tone: Tone; terminal?: boolean; hint?: string };

export type GuardContext = { record: DemoRecord; data: IndustryData; user: DemoUser; note?: string };

export type Transition = {
  from: string | string[];
  to: string;
  label: string;
  /** Permission key required (super admins bypass). */
  permission?: string;
  requiresNote?: boolean;
  /** Shown in the note dialog: what the note should say (e.g. "How did the customer approve?"). */
  noteHint?: string;
  /** Business rule. Return a reason string to block the transition. */
  guard?: (ctx: GuardContext) => string | null;
  /** Visual weight of the button. */
  intent?: 'primary' | 'danger' | 'default';
  /** Side effect after the step succeeds (create a linked record, adjust stock …). */
  after?: (ctx: EffectContext) => void;
};

export type EffectApi = {
  create: (collection: string, values: Values, status?: string, action?: string) => DemoRecord;
  update: (collection: string, id: string, values: Values, action?: string, note?: string) => void;
  /** Move another record through its own workflow (its rules still apply). */
  transition: (collection: string, id: string, to: string, note?: string) => { ok: true; value: DemoRecord } | { ok: false; reason: string };
  toast: (text: string, tone?: 'ok' | 'err' | 'info') => void;
};

export type EffectContext = { record: DemoRecord; data: IndustryData; api: EffectApi; today: string; user: DemoUser; note?: string };

export type WorkflowDef = { states: WorkflowState[]; initial: string; transitions: Transition[] };

export type HistoryEntry = { at: string; by: string; role: string; action: string; note?: string };

/** A generic stored record. Domain values live in `values`. */
export type DemoRecord = {
  id: string;
  ref: string;
  status?: string;
  values: Values;
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

export type Flag = { tone: Tone; label: string };

export type CollectionDef = {
  key: string;
  singular: string;
  plural: string;
  /** Prefix for human-readable references, e.g. "PT" → PT-0007. */
  refPrefix: string;
  fields: FieldDef[];
  workflow?: WorkflowDef;
  /** Primary label for a record. */
  title: (r: DemoRecord, data: IndustryData) => string;
  subtitle?: (r: DemoRecord, data: IndustryData) => string;
  /** Computed warning/attention tags (overdue, low stock …). */
  flags?: (r: DemoRecord, data: IndustryData, today: string, user?: DemoUser) => Flag[];
  /** Permission needed to create / edit / delete (super admins bypass). */
  editPermission?: string;
  /** Starting values for the "New …" form, e.g. today's date. */
  createDefaults?: (today: string, data: IndustryData) => Values;
  /** Field keys shown when creating (defaults to all visible fields). */
  createFields?: string[];
  /** Default sort, newest first by default. */
  sort?: (a: DemoRecord, b: DemoRecord) => number;
};

export type ModuleDef = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  description: string;
  /** Sidebar group heading. */
  group?: string;
  /** Primary collection: enables the generic register and /:module/:id detail. */
  collection?: string;
  /** Default register view. */
  view?: 'table' | 'board';
  /** Custom main page. Falls back to the generic register for `collection`. */
  page?: ComponentType;
  /** Custom detail page for /:module/:id. Falls back to the generic record detail. */
  detail?: ComponentType;
};

export type RoleDef = { key: string; label: string };
export type PermissionDef = { key: string; label: string; description: string };

export type DemoUser = {
  id: string;
  name: string;
  title: string;
  role: string;
  modules: string[];
  permissions: string[];
  isSuperAdmin?: boolean;
};

export type Activity = { id: string; at: string; title: string; detail: string; tone: Tone; module?: string };

export type IndustryData = {
  version: number;
  seededAt: string;
  currentUserId: string;
  users: DemoUser[];
  collections: Record<string, DemoRecord[]>;
  counters: Record<string, number>;
  activity: Activity[];
};

export type Theme = {
  accent: string;
  accent2: string;
  accentSoft: string;
  accentTint: string;
  accentLine: string;
  accentText: string;
};

export type IndustryId = 'optometry' | 'medical' | 'automotive' | 'mining' | 'legal' | 'realestate' | 'construction' | 'tyres' | 'security' | 'cleaning';

export type IndustryConfig = {
  id: IndustryId;
  /** Industry name shown in the gallery, e.g. "Optometry". */
  industry: string;
  /** Fictional business name. */
  businessName: string;
  monogram: string;
  workspaceTag: string;
  tagline: string;
  summary: string;
  priority?: number;
  theme: Theme;
  roles: RoleDef[];
  permissions: PermissionDef[];
  modules: ModuleDef[];
  collections: CollectionDef[];
  /** Builds fresh fictional data relative to `today` (YYYY-MM-DD). */
  seed: (today: string) => Pick<IndustryData, 'users' | 'collections' | 'currentUserId'>;
  dashboard: ComponentType;
  /** Lines shown on the Settings page under "What this demo does not do". */
  boundaries: string[];
  /** Short highlights for the gallery card. */
  highlights: string[];
  /** Set at runtime by client branding (see core/brand.ts): the client's logo and name. */
  logo?: string;
  brandedFor?: string;
  /** Guided walkthrough shown on the dashboard: the few things a first-time visitor should try. */
  guide?: GuideStep[];
};

export type GuideStep = {
  /** Imperative and short, e.g. "Check a patient in". */
  title: string;
  /** What to click and what will happen, in one or two sentences. */
  detail: string;
  /** Module key to open (optionally "module/recordId"); empty string for the dashboard. */
  to: string;
  /** User id to switch to first, when the step needs a particular role. */
  as?: string;
};
