// Helpers for the overview dashboard kit (components in src/core/components/overview.tsx).
import type { KeyboardEvent } from 'react';

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const initialsOf = (name: string) => name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();

/** Escape closes an open disclosure and returns focus to its toggle. Attach to the disclosure's section. */
export function escapeCloses(e: KeyboardEvent<HTMLElement>, open: boolean, set: (v: boolean) => void) {
  if (e.key !== 'Escape' || !open) return;
  e.stopPropagation();
  set(false);
  e.currentTarget.querySelector<HTMLButtonElement>('.od-toggle')?.focus();
}
