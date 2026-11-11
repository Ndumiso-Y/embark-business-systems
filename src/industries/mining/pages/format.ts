// Formatting helpers shared by the mining pages.
import type { Tone } from '../../../core/types';
import { monthShort } from '../../../core/lib/dates';

export const tonnes = (n: number) => `${Math.round(n).toLocaleString('en-ZA')} t`;

/** "07 Nov" style label for chart axes. */
export const shortDate = (iso: string) => `${iso.slice(8, 10)} ${monthShort(iso.slice(0, 7))}`;

export const pctTone = (pct: number): Tone => (pct >= 95 ? 'green' : pct >= 85 ? 'amber' : 'red');
