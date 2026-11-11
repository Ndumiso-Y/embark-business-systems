// Formatting helpers and the shared clock hook for the security pages.
import { useEffect, useState } from 'react';
import type { Tone } from '../../../core/types';
import { monthShort } from '../../../core/lib/dates';
import { nowTime, todayStr } from '../helpers';

/** Today's date and the wall-clock time, refreshed every 30 seconds so elapsed timers keep moving. */
export function useClock() {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  return { today: todayStr(), time: nowTime() };
}

/** "07 Nov" style label for chart axes. */
export const shortDate = (iso: string) => `${iso.slice(8, 10)} ${monthShort(iso.slice(0, 7))}`;
export const pctTone = (p: number): Tone => (p >= 98 ? 'green' : p >= 92 ? 'amber' : 'red');
