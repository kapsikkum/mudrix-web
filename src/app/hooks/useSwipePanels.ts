import { useEffect, useRef } from 'react';

interface SwipePanels {
  enabled: boolean;
  /** Left panel (spaces and rooms) */
  leftOpen: boolean;
  setLeftOpen: (open: boolean) => void;
  /** Right panel (members or threads). Opening is only offered when `canOpenRight`. */
  rightOpen: boolean;
  setRightOpen: (open: boolean) => void;
  canOpenRight: boolean;
}

// Distance and shape a swipe needs before it counts, and how close to the screen edge it may start
// (the system back gesture owns the edges).
const MIN_DISTANCE = 64;
const MAX_DURATION_MS = 700;
const EDGE_GUARD_ANDROID = 24;
// iOS has no system back swipe in the webview, so swipes may start right at the screen edge.
const EDGE_GUARD = /Android/i.test(navigator.userAgent) ? EDGE_GUARD_ANDROID : 0;

const INTERACTIVE =
  'input, textarea, select, [contenteditable="true"], video, audio, [role="slider"], [data-no-swipe]';
const OVERLAYS = '[role="dialog"], [role="menu"], [data-popover], [data-emoji-picker]';

/** The on-screen keyboard is up (a text field has focus, or the visual viewport shrank). */
function keyboardIsOpen(): boolean {
  const el = document.activeElement;
  if (
    el instanceof HTMLElement &&
    (el.isContentEditable ||
      el.matches('input:not([type="checkbox"]):not([type="radio"]), textarea'))
  ) {
    return true;
  }
  const vv = window.visualViewport;
  return !!vv && window.innerHeight - vv.height > 120;
}

/** True when the touch began somewhere a sideways swipe means something else. */
function startsInSwipeBlocker(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  if (el?.closest(INTERACTIVE) || el?.closest(OVERLAYS)) return true;
  // Horizontally scrollable content (code blocks, galleries, carousels) keeps its own swipe.
  while (el && el !== document.body) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Discord-style sideways swipes on phones: a swipe to the right opens the left panel (or closes the
 * right one), a swipe to the left opens the right panel (or closes the left one).
 */
export function useSwipePanels(opts: SwipePanels) {
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    if (!opts.enabled) return undefined;
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      if (keyboardIsOpen()) return;
      const touch = e.touches[0];
      if (touch.clientX < EDGE_GUARD || touch.clientX > window.innerWidth - EDGE_GUARD) return;
      if (startsInSwipeBlocker(e.target)) return;
      start = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    };

    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const s = start;
      start = null;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;
      if (Date.now() - s.t > MAX_DURATION_MS) return;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 2) return;
      const o = ref.current;
      if (dx > 0) {
        if (o.rightOpen) o.setRightOpen(false);
        else if (!o.leftOpen) o.setLeftOpen(true);
      } else if (o.leftOpen) {
        o.setLeftOpen(false);
      } else if (!o.rightOpen && o.canOpenRight) {
        o.setRightOpen(true);
      }
    };

    const onCancel = () => {
      start = null;
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
    };
  }, [opts.enabled]);
}
