import { describe, expect, it } from 'vitest';
import { circularOffset, MAX_VISIBLE_OFFSET, positionLabel, slotFor, swipeSteps, wrapIndex } from '../src/core/portal/coverflow';
import { CARD_LINES, cardLine } from '../src/core/portal/cardLines';
import { INDUSTRY_IDS } from '../src/industries/ids';

describe('cover flow position maths', () => {
  it('wraps indexes in both directions', () => {
    expect(wrapIndex(12, 12)).toBe(0);
    expect(wrapIndex(-1, 12)).toBe(11);
    expect(wrapIndex(25, 12)).toBe(1);
    expect(wrapIndex(3, 0)).toBe(0);
  });

  it('measures the short way round', () => {
    expect(circularOffset(0, 0, 12)).toBe(0);
    expect(circularOffset(1, 0, 12)).toBe(1);
    expect(circularOffset(11, 0, 12)).toBe(-1);
    expect(circularOffset(6, 0, 12)).toBe(-6);
    expect(circularOffset(0, 11, 12)).toBe(1);
  });

  it('gives every slide exactly one position and exactly one centre', () => {
    for (let active = 0; active < 12; active++) {
      const offsets = Array.from({ length: 12 }, (_, i) => circularOffset(i, active, 12));
      expect(new Set(offsets).size).toBe(12);
      expect(offsets.filter((o) => o === 0)).toHaveLength(1);
      expect(offsets.filter((o) => Math.abs(o) <= MAX_VISIBLE_OFFSET)).toHaveLength(2 * MAX_VISIBLE_OFFSET + 1);
    }
  });

  it('names the stylesheet slot', () => {
    expect(slotFor(0)).toBe('0');
    expect(slotFor(-2)).toBe('-2');
    expect(slotFor(3)).toBe('out-right');
    expect(slotFor(-6)).toBe('out-left');
  });

  it('turns a drag into steps: left moves forward, small drags do nothing, never more than three', () => {
    expect(swipeSteps(-20, 280)).toBe(0);
    expect(swipeSteps(20, 280)).toBe(0);
    expect(swipeSteps(-60, 280)).toBe(1);
    expect(swipeSteps(60, 280)).toBe(-1);
    expect(swipeSteps(-600, 280)).toBe(2);
    expect(swipeSteps(-5000, 280)).toBe(3);
    expect(swipeSteps(Number.NaN, 280)).toBe(0);
  });

  it('labels the position honestly', () => {
    expect(positionLabel(0, 12)).toBe('01 / 12');
    expect(positionLabel(11, 12)).toBe('12 / 12');
  });
});

describe('homepage card lines', () => {
  it('has one short line for every industry and none for unknown ones', () => {
    expect(Object.keys(CARD_LINES).sort()).toEqual([...INDUSTRY_IDS].sort());
    for (const id of INDUSTRY_IDS) {
      expect(CARD_LINES[id].length).toBeGreaterThan(20);
      expect(CARD_LINES[id].length).toBeLessThanOrEqual(56);
      expect(CARD_LINES[id]).toMatch(/\.$/);
    }
  });

  it('falls back to the first clause of the summary', () => {
    expect(cardLine({ id: 'dental' as never, summary: 'A dental practice: charting, claims and recalls.' })).toBe('A dental practice.');
    expect(cardLine({ id: 'optometry', summary: 'ignored' })).toBe(CARD_LINES.optometry);
  });
});
