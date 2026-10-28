import { useEffect, useRef } from 'react';
import { vars } from '@/theme/vars.css';

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
// How far a panel stretches when pulled past its open position, as a fraction of its width.
const MAX_STRETCH = 0.14;
// The snap back from a stretch: how long the wobble lasts.
const WOBBLE_MS = 520;

// Swipe-to-reply: a left swipe that starts on a message row (marked `data-swipe-reply`) slides the
// row and replies when released past the threshold. The row fires `SWIPE_REPLY_EVENT`.
export const SWIPE_REPLY_EVENT = 'mudrix:swipe-reply';
const REPLY_THRESHOLD = 64;
const REPLY_MAX = 96;
const REPLY_ICON =
  '<svg viewBox="0 0 256 256" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M232,200a8,8,0,0,1-16,0,88.1,88.1,0,0,0-88-88H35.31l34.35,34.34a8,8,0,0,1-11.32,11.32l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,69.66,69.66L35.31,104H128a104.11,104.11,0,0,1,104,96Z"/></svg>';
const SCRIM_CSS =
  'position:fixed;inset:0;z-index:4999;pointer-events:none;background:rgba(0,0,0,0.5);opacity:0';

const INTERACTIVE =
  'input, textarea, select, [contenteditable="true"], video, audio, [role="slider"], [data-no-swipe]';
const OVERLAYS = '[role="dialog"], [role="menu"], [data-popover], [data-emoji-picker]';

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
  /** The scrim that fades with the drag: a temporary one, standing in for the layout's own. */
  scrim: HTMLElement;
  /** The layout's own scrim for this panel (if mounted), hidden while the drag runs. */
  realScrim: HTMLElement | null;
}

interface ReplyDrag {
  row: HTMLElement;
  eventId: string;
  icon: HTMLElement;
  armed: boolean;
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

/**
 * Pulled past its open position a panel does not leave the screen edge (which would open a gap
 * beside it): it stays put and stretches away from that edge instead, ever more slowly.
 */
function stretchFor(t: Target, dx: number): number {
  const closed = closedOffset(t);
  const raw = (t.from === 'open' ? 0 : closed) + dx;
  const over = t.side === 'left' ? raw : -raw;
  if (over <= 0) return 1;
  return 1 + MAX_STRETCH * Math.tanh((over / t.width) * 1.5);
}

/** The transform for a finger travel of `dx`. */
function transformFor(t: Target, dx: number): string {
  const closed = closedOffset(t);
  const raw = (t.from === 'open' ? 0 : closed) + dx;
  const over = t.side === 'left' ? raw > 0 : raw < 0;
  if (over) return `translateX(0) scaleX(${stretchFor(t, dx)})`;
  return `translateX(${offsetFor(t, dx)}px)`;
}

/** 0 (closed) to 1 (open) for a finger travel of `dx`. */
function opennessFor(t: Target, dx: number): number {
  return Math.min(1, Math.max(0, 1 - Math.abs(offsetFor(t, dx)) / t.width));
}

/** Travel toward the other state (opening if closed, closing if open); negative is the wrong way. */
function progressFor(t: Target, dx: number): number {
  return (t.side === 'left') === (t.from === 'closed') ? dx : -dx;
}

/**
 * Discord-style sideways swipes on phones. A swipe to the right opens the left panel (or closes the
 * right one), a swipe to the left opens the right panel (or closes the left one), except that a left
 * swipe starting on a message row replies to it instead. The panel follows
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
    let reply: ReplyDrag | null = null;
    let row: HTMLElement | null = null;

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
      // The layout's scrim pops in and out with the panel's state; a temporary one follows the finger.
      const realScrim = document.querySelector<HTMLElement>(`[data-swipe-scrim="${side}"]`);
      if (realScrim) realScrim.style.opacity = '0';
      const scrim = document.createElement('div');
      scrim.style.cssText = SCRIM_CSS;
      document.body.appendChild(scrim);
      return { el, side, from, width: el.offsetWidth, scrim, realScrim };
    };

    /** Starts a reply drag when the touch began on a message row and nothing else is open. */
    const pickReply = (): ReplyDrag | null => {
      const o = ref.current;
      if (!row || o.leftOpen || o.rightOpen) return null;
      const eventId = row.getAttribute('data-event-id');
      if (!eventId) return null;
      const icon = document.createElement('div');
      const rect = row.getBoundingClientRect();
      icon.innerHTML = REPLY_ICON;
      icon.style.cssText = `position:fixed;z-index:4000;pointer-events:none;right:18px;top:${
        rect.top + rect.height / 2 - 11
      }px;color:${vars.color.textMuted};opacity:0`;
      document.body.appendChild(icon);
      return { row, eventId, icon, armed: false };
    };

    const onStart = (e: TouchEvent) => {
      start = null;
      lock = null;
      target = null;
      reply = null;
      row = null;
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (touch.clientX < EDGE_GUARD || touch.clientX > window.innerWidth - EDGE_GUARD) return;
      if (startsInSwipeBlocker(e.target)) return;
      start = { x: touch.clientX, y: touch.clientY, t: Date.now() };
      row =
        e.target instanceof Element ? e.target.closest<HTMLElement>('[data-swipe-reply]') : null;
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
        // A left swipe on a message replies; elsewhere it opens the members panel.
        reply = dx < 0 ? pickReply() : null;
        if (!reply) target = pickTarget(dx);
      }
      // A sideways swipe must not also scroll the page behind it.
      if (e.cancelable) e.preventDefault();
      if (reply) {
        const pull = Math.min(
          REPLY_MAX,
          -dx > REPLY_THRESHOLD ? REPLY_THRESHOLD + (-dx - REPLY_THRESHOLD) * 0.4 : -dx
        );
        const shown = Math.max(0, pull);
        reply.row.style.transition = 'none';
        reply.row.style.transform = `translateX(${-shown}px)`;
        const armed = shown >= REPLY_THRESHOLD;
        if (armed !== reply.armed) {
          reply.armed = armed;
          reply.icon.style.color = armed ? vars.color.accent : vars.color.textMuted;
          if (armed) navigator.vibrate?.(8);
        }
        const k = Math.min(1, shown / REPLY_THRESHOLD);
        reply.icon.style.opacity = String(k);
        reply.icon.style.transform = `scale(${0.6 + 0.4 * k})`;
        return;
      }
      if (!target) return;
      target.el.style.transition = 'none';
      // Stretch from the screen edge the panel is anchored to.
      target.el.style.transformOrigin = target.side === 'left' ? 'left center' : 'right center';
      target.el.style.transform = transformFor(target, dx);
      target.scrim.style.transition = 'none';
      target.scrim.style.opacity = String(opennessFor(target, dx));
    };

    const finishReply = (r: ReplyDrag, cancelled: boolean) => {
      r.row.style.transition = `transform ${FAST_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      r.row.style.transform = 'translateX(0)';
      r.icon.style.transition = `opacity ${FAST_MS}ms`;
      r.icon.style.opacity = '0';
      window.setTimeout(() => {
        r.row.style.transition = '';
        r.row.style.transform = '';
        r.icon.remove();
      }, FAST_MS + 40);
      if (r.armed && !cancelled) {
        r.row.dispatchEvent(
          new CustomEvent(SWIPE_REPLY_EVENT, { bubbles: true, detail: { eventId: r.eventId } })
        );
      }
    };

    const finish = (e: TouchEvent, cancelled: boolean) => {
      const t = target;
      const s = start;
      const r = reply;
      start = null;
      lock = null;
      target = null;
      reply = null;
      row = null;
      if (r) {
        finishReply(r, cancelled);
        return;
      }
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
      // A panel let go while stretched snaps back with a little wobble.
      const stretched = open ? stretchFor(t, dx) : 1;
      if (stretched > 1.004) {
        t.el.style.transition = 'none';
        t.el.style.transform = 'translateX(0)';
        const wobble = t.el.animate(
          [
            { transform: `translateX(0) scaleX(${stretched})` },
            { transform: `translateX(0) scaleX(${1 - (stretched - 1) * 0.35})`, offset: 0.35 },
            { transform: `translateX(0) scaleX(${1 + (stretched - 1) * 0.12})`, offset: 0.65 },
            { transform: 'translateX(0) scaleX(1)' },
          ],
          { duration: WOBBLE_MS, easing: 'ease-out' }
        );
        const done = () => {
          t.el.style.transition = '';
          t.el.style.transform = '';
          t.el.style.transformOrigin = '';
        };
        wobble.onfinish = done;
        wobble.oncancel = done;
      } else {
        t.el.style.transition = `transform ${ms}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
        t.el.style.transform = `translateX(${open ? 0 : closedOffset(t)}px)`;
        window.setTimeout(() => {
          t.el.style.transition = '';
          t.el.style.transform = '';
          t.el.style.transformOrigin = '';
        }, ms + 40);
      }

      // The scrim fades to the same end; the layout's own scrim takes over once it has settled.
      t.scrim.style.transition = `opacity ${ms}ms ease`;
      t.scrim.style.opacity = open ? '1' : '0';
      const realScrim = () => document.querySelector<HTMLElement>(`[data-swipe-scrim="${t.side}"]`);
      window.setTimeout(() => {
        t.scrim.remove();
        const real = realScrim();
        if (real) real.style.opacity = '';
      }, ms + 40);

      if (commit) {
        // Opening or closing a panel puts the keyboard away.
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        const o = ref.current;
        if (t.side === 'left') o.setLeftOpen(t.from === 'closed');
        else o.setRightOpen(t.from === 'closed');
        if (open) {
          // A scrim that mounts now stays invisible until the temporary one is done.
          const hide = () => {
            const real = realScrim();
            if (real) real.style.opacity = '0';
          };
          queueMicrotask(hide);
          requestAnimationFrame(hide);
        }
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
