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

/** Marker classes the layout puts on the panels the swipe moves. */
export const SWIPE_PANEL_LEFT = 'swipe-panel-left';
export const SWIPE_PANEL_RIGHT = 'swipe-panel-right';

// Travel before a swipe locks to horizontal, how close to the screen edge it may start (the Android
// system back gesture owns those edges; iOS has none in the webview), when releasing commits, and how
// much of the pull past the open position shows.
const LOCK_DISTANCE = 6;
const EDGE_GUARD = /Android/i.test(navigator.userAgent) ? 24 : 0;
const COMMIT_FRACTION = 0.35;
const FLICK_VELOCITY = 0.35; // px per ms
const FLICK_MIN_DISTANCE = 24;
const FAST_MS = 170;
const SETTLE_MS = 240;
const RUBBER = 0.15;

const INTERACTIVE =
  'input, textarea, select, [contenteditable="true"], video, audio, [role="slider"], [data-no-swipe]';
const OVERLAYS = '[role="dialog"], [role="menu"], [data-popover], [data-emoji-picker]';

/**
 * The on-screen keyboard is up: a text field has focus, the iOS shell says so, or the visual
 * viewport shrank. (Where the web view itself is resized, as on Android and with the iOS plugin, the
 * visual viewport stays the size of the window.)
 */
function keyboardIsOpen(): boolean {
  if (document.documentElement.classList.contains('ios-keyboard-open')) return true;
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

interface Target {
  el: HTMLElement;
  side: 'left' | 'right';
  from: 'open' | 'closed';
  width: number;
}

function findPanel(side: 'left' | 'right'): HTMLElement | null {
  if (side === 'left') return document.querySelector<HTMLElement>(`.${SWIPE_PANEL_LEFT}`);
  // Threads render on top of the members panel, so the last one is the one on screen.
  const all = document.querySelectorAll<HTMLElement>(`.${SWIPE_PANEL_RIGHT}`);
  return all.length ? all[all.length - 1] : null;
}

/** Offset of the panel's closed position from its open one. */
function closedOffset(t: Target): number {
  return t.side === 'left' ? -t.width : t.width;
}

/** Where the panel sits for a finger travel of `dx`; past either end it only rubber-bands. */
function offsetFor(t: Target, dx: number): number {
  const closed = closedOffset(t);
  const raw = (t.from === 'open' ? 0 : closed) + dx;
  const lo = Math.min(0, closed);
  const hi = Math.max(0, closed);
  if (raw < lo) return lo + (raw - lo) * RUBBER;
  if (raw > hi) return hi + (raw - hi) * RUBBER;
  return raw;
}

/** Travel toward the other state (opening if closed, closing if open); negative is the wrong way. */
function progressFor(t: Target, dx: number): number {
  return (t.side === 'left') === (t.from === 'closed') ? dx : -dx;
}

/**
 * Discord-style sideways swipes on phones. A swipe to the right opens the left panel (or closes the
 * right one), a swipe to the left opens the right panel (or closes the left one). The panel follows
 * the finger while it is held (and only rubber-bands past its open position); a quick flick
 * settles with the fast animation, a slow release finishes from where it was let go.
 */
export function useSwipePanels(opts: SwipePanels) {
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    if (!opts.enabled) return undefined;
    let start: { x: number; y: number; t: number } | null = null;
    let lock: 'h' | 'v' | null = null;
    let target: Target | null = null;

    const pickTarget = (dx: number): Target | null => {
      const o = ref.current;
      let side: 'left' | 'right' | null = null;
      let from: 'open' | 'closed' = 'closed';
      if (dx > 0) {
        if (o.rightOpen) {
          side = 'right';
          from = 'open';
        } else {
          side = 'left';
          from = o.leftOpen ? 'open' : 'closed';
        }
      } else if (o.leftOpen) {
        side = 'left';
        from = 'open';
      } else if (o.rightOpen) {
        side = 'right';
        from = 'open';
      } else if (o.canOpenRight) {
        side = 'right';
      }
      if (!side) return null;
      const el = findPanel(side);
      if (!el) return null;
      return { el, side, from, width: el.offsetWidth };
    };

    const onStart = (e: TouchEvent) => {
      start = null;
      lock = null;
      target = null;
      if (e.touches.length !== 1) return;
      if (keyboardIsOpen()) return;
      const touch = e.touches[0];
      if (touch.clientX < EDGE_GUARD || touch.clientX > window.innerWidth - EDGE_GUARD) return;
      if (startsInSwipeBlocker(e.target)) return;
      start = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    };

    const onMove = (e: TouchEvent) => {
      if (!start || lock === 'v') return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (!lock) {
        if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.5) {
          lock = 'v';
          return;
        }
        lock = 'h';
        target = pickTarget(dx);
      }
      // A sideways swipe must not also scroll the page behind it.
      if (e.cancelable) e.preventDefault();
      if (!target) return;
      target.el.style.transition = 'none';
      target.el.style.transform = `translateX(${offsetFor(target, dx)}px)`;
    };

    const finish = (e: TouchEvent, cancelled: boolean) => {
      const t = target;
      const s = start;
      start = null;
      lock = null;
      target = null;
      if (!t || !s) return;
      const dx = cancelled ? 0 : e.changedTouches[0].clientX - s.x;
      const elapsed = Math.max(1, Date.now() - s.t);
      const travelled = progressFor(t, dx);
      const flick = travelled > FLICK_MIN_DISTANCE && travelled / elapsed > FLICK_VELOCITY;
      const commit = travelled > t.width * COMMIT_FRACTION || flick;
      const open = t.from === 'closed' ? commit : !commit;
      const ms = flick ? FAST_MS : SETTLE_MS;

      // Animate to the settled end by hand, then hand the position back to the layout's classes
      // (which by then say the same thing).
      t.el.style.transition = `transform ${ms}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      t.el.style.transform = `translateX(${open ? 0 : closedOffset(t)}px)`;
      window.setTimeout(() => {
        t.el.style.transition = '';
        t.el.style.transform = '';
      }, ms + 40);

      if (commit) {
        const o = ref.current;
        if (t.side === 'left') o.setLeftOpen(t.from === 'closed');
        else o.setRightOpen(t.from === 'closed');
      }
    };

    const onEnd = (e: TouchEvent) => finish(e, false);
    const onCancel = (e: TouchEvent) => finish(e, true);

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
    };
  }, [opts.enabled]);
}
