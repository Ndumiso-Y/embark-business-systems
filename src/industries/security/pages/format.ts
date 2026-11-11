// Formatting helpers and the shared date hook for the security pages.
import type { Tone } from '../../../core/types';
import { monthShort } from '../../../core/lib/dates';
import { nowTime, todayStr } from '../helpers';

/**
 * Today's date for rules and flags, plus the clock time. The time is only ever used to
 * pre-fill a time box when the user records something — no rule or flag reads it.
 */
export function useClock() {
  return { today: todayStr(), time: nowTime() };
}

/** "07 Nov" style label for chart axes. */
export const shortDate = (iso: string) => `${iso.slice(8, 10)} ${monthShort(iso.slice(0, 7))}`;
export const pctTone = (p: number): Tone => (p >= 98 ? 'green' : p >= 92 ? 'amber' : 'red');
