// Position maths for the homepage Cover Flow. Pure functions (unit tested in
// tests/coverflow.test.ts) so the same data can later drive a full-grid "Demos" page.

/** Wraps any integer onto 0…count-1. The carousel is circular: next after the last is the first. */
export function wrapIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((Math.round(index) % count) + count) % count;
}

/**
 * Signed distance of slide `index` from the active slide going the short way round,
 * e.g. with 12 slides and slide 0 active, slide 11 is at -1 and slide 6 is at -6.
 */
export function circularOffset(index: number, active: number, count: number): number {
  if (count <= 0) return 0;
  const half = Math.floor(count / 2);
  return wrapIndex(index - active + half, count) - half;
}

/** Slides further than this from the centre are not drawn. */
export const MAX_VISIBLE_OFFSET = 2;

/** Slot name used by the stylesheet: -2…2 are drawn, anything further is parked off-stage. */
export function slotFor(offset: number): string {
  if (offset < -MAX_VISIBLE_OFFSET) return 'out-left';
  if (offset > MAX_VISIBLE_OFFSET) return 'out-right';
  return String(offset);
}

/**
 * How many slides a horizontal drag moves: none below the threshold, otherwise one per
 * `stepPx` dragged (at least one, at most three). Dragging left (negative dx) moves forward.
 */
export function swipeSteps(dx: number, stepPx: number, thresholdPx = 36): number {
  if (!Number.isFinite(dx) || Math.abs(dx) < thresholdPx) return 0;
  const steps = Math.min(3, Math.max(1, Math.round(Math.abs(dx) / Math.max(stepPx, 1))));
  return dx < 0 ? steps : -steps;
}

/** Zero-padded position label, e.g. "03 / 12". */
export function positionLabel(active: number, count: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(active + 1)} / ${pad(count)}`;
}
