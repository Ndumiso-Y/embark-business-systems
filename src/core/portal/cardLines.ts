// One short factual line per industry for the homepage cards. Each line only names
// modules that exist in that demo. The full description stays in the industry config
// (`summary`), which is not changed; an industry without a line here falls back to the
// first clause of its summary.
import type { IndustryConfig } from '../types';

export const CARD_LINES: Record<string, string> = {
  optometry: 'Diary, eye exams, lab orders and recalls.',
  medical: 'Waiting room, consultations, scripts and claims.',
  automotive: 'Job cards, estimates, parts and invoices.',
  tyres: 'Bay queue, wheel checks, tools and tyre stock.',
  mining: 'Shift production, safety, permits and equipment.',
  construction: 'Projects, site diary, valuations and safety.',
  realestate: 'Mandates, viewings, offers, transfers and leases.',
  legal: 'Matters, time and fee notes, trust ledger, court diary.',
  security: 'Rosters, occurrence books, call-outs and patrols.',
  cleaning: 'Site contracts, shifts, inspections and complaints.',
  education: 'Admissions, registers, marks, reports and fees.',
  mall: 'Units, leases, rent roll, arrears and maintenance.',
};

export function cardLine(c: Pick<IndustryConfig, 'id' | 'summary'>): string {
  const line = CARD_LINES[c.id];
  if (line) return line;
  const first = c.summary.split(/[:;.]/)[0]?.trim() ?? '';
  return first ? `${first}.` : '';
}
