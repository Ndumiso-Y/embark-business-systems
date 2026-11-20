import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from 'react';
import { IcoArrow } from '../components/Icons';
import { circularOffset, slotFor, swipeSteps, wrapIndex } from './coverflow';

export type CoverFlowItem = { id: string; label: string };

type Props<T extends CoverFlowItem> = {
  items: T[];
  /** Index of the centred slide. */
  active: number;
  onActive: (index: number) => void;
  /** Accessible name of the carousel, e.g. "Industry demonstrations". */
  label: string;
  /** What the slides are, for control labels: "industry". */
  noun: string;
  render: (item: T, state: { active: boolean; offset: number }) => ReactNode;
  /** Receives the focusable stage so a "jump to" button elsewhere on the page can focus it. */
  stageRef?: Ref<HTMLDivElement>;
};

/**
 * Cover Flow-style carousel: one large centred slide with smaller neighbours peeking in.
 *
 * Behaviour (documented in docs/design/05_homepage_addendum_2026-11-20.md):
 * - circular — "next" after the last slide is the first; the indicator has one dot per slide;
 * - arrows, dots, Left/Right/Home/End keys, and horizontal drag or swipe all move it;
 * - clicking a neighbour centres it and never navigates; only the centred slide's own
 *   links are reachable by keyboard and screen reader;
 * - never plays by itself; animation is switched off under prefers-reduced-motion (CSS).
 */
export default function CoverFlow<T extends CoverFlowItem>({ items, active, onActive, label, noun, render, stageRef }: Props<T>) {
  const count = items.length;
  const stage = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const current = items[active];

  const go = (index: number) => onActive(wrapIndex(index, count));
  const setStage = (el: HTMLDivElement | null) => {
    stage.current = el;
    if (typeof stageRef === 'function') stageRef(el);
    else if (stageRef) stageRef.current = el;
  };
  const stepPx = () => (stage.current?.querySelector<HTMLElement>('[data-slot="0"]')?.offsetWidth ?? 400) * 0.6;

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: count - 1 }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    // The slide that holds focus is about to become a neighbour: keep focus on the carousel itself.
    if (stage.current?.contains(document.activeElement) && document.activeElement !== stage.current) stage.current.focus({ preventScroll: true });
    go(target);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      // Only a clearly horizontal movement starts a drag, so vertical page scrolling is untouched.
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - d.y)) return;
      d.moved = true;
      setDragging(true);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
    }
    e.currentTarget.style.setProperty('--cf-drag', `${Math.max(-260, Math.min(260, dx))}px`);
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    e.currentTarget.style.removeProperty('--cf-drag');
    if (!d.moved) return;
    setDragging(false);
    // A drag must never also count as a click on whatever was under the pointer.
    swallowClick.current = true;
    window.setTimeout(() => { swallowClick.current = false; }, 0);
    if (!cancelled) {
      const steps = swipeSteps(e.clientX - d.x, stepPx());
      if (steps) go(active + steps);
    }
  };

  return (
    <section className="cf" aria-roledescription="carousel" aria-label={label} onKeyDown={onKeyDown} data-testid="coverflow">
      <div
        ref={setStage}
        className={`cf-stage${dragging ? ' is-dragging' : ''}`}
        tabIndex={0}
        role="group"
        aria-label={`${label}: ${count} slides. Use the left and right arrow keys to move between them.`}
        data-testid="coverflow-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onClickCapture={(e) => { if (swallowClick.current) { e.preventDefault(); e.stopPropagation(); } }}
        onDragStart={(e) => e.preventDefault()}
      >
        <ul className="cf-track">
          {items.map((item, i) => {
            const offset = circularOffset(i, active, count);
            const isActive = offset === 0;
            return (
              <li
                key={item.id}
                className="cf-slide"
                data-slot={slotFor(offset)}
                data-testid={`coverflow-slide-${item.id}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${item.label}, ${i + 1} of ${count}`}
                aria-hidden={isActive ? undefined : true}
                onClickCapture={isActive ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); if (!swallowClick.current) go(i); }}
              >
                {render(item, { active: isActive, offset })}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="cf-controls">
        <button type="button" className="cf-arrow is-prev" aria-label={`Previous ${noun}`} data-testid="coverflow-prev" onClick={() => go(active - 1)}><IcoArrow /></button>
        <div className="cf-dots" role="group" aria-label={`Choose ${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`}>
          {items.map((item, i) => (
            <button key={item.id} type="button" className="cf-dot" aria-label={`${item.label}, ${i + 1} of ${count}`} aria-current={i === active ? 'true' : undefined} data-testid={`coverflow-dot-${item.id}`} onClick={() => go(i)}><i /></button>
          ))}
        </div>
        <button type="button" className="cf-arrow" aria-label={`Next ${noun}`} data-testid="coverflow-next" onClick={() => go(active + 1)}><IcoArrow /></button>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="coverflow-status">{current ? `${current.label}, ${active + 1} of ${count}` : ''}</p>
    </section>
  );
}
