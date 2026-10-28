import { useEffect } from 'react';

/** Exposed by the Android shell (see MainActivity.kt); absent in a browser and the desktop app. */
interface ChromeBridge {
  setBackground(top: string, bottom: string, lightTop: boolean, lightBottom: boolean): void;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** The side panels that slide over the page (see useSwipePanels) and the scrims behind them. */
const OVERLAY_PANELS = '.swipe-panel-left, .swipe-panel-right, [data-swipe-scrim]';

function parseRgb(css: string): Rgb | null {
  // color-mix() computes to color(srgb r g b) with channels from 0 to 1; other spaces (oklch, a
  // custom theme's lab) are not read, and the look goes on down the stack.
  const unit = css.startsWith('color(srgb ') ? 255 : css.startsWith('rgb') ? 1 : 0;
  if (!unit) return null;
  const parts = css.match(/[\d.]+/g)?.map(Number);
  if (!parts || parts.length < 3) return null;
  // See-through layers (a dimming scrim, a backdrop) are not the page: the bars skip them.
  if (parts.length > 3 && parts[3] < 0.99) return null;
  return { r: parts[0] * unit, g: parts[1] * unit, b: parts[2] * unit };
}

/** The colour of the page at a point: the first opaque background stacked there, panels aside. */
function colourAt(x: number, y: number): Rgb | null {
  const stack = document.elementsFromPoint(x, y);
  stack.push(document.body);
  for (const el of stack) {
    // Side drawers slide over the page; the bars keep the page's own colours.
    if (el.closest(OVERLAY_PANELS)) continue;
    const rgb = parseRgb(getComputedStyle(el).backgroundColor);
    if (rgb) return rgb;
  }
  return null;
}

/** How long a colour must hold before the system bars take it. */
const SETTLE_MS = 160;

const hex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

const isLight = ({ r, g, b }: Rgb) => (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;

/**
 * Tells the Android shell what colour the app is at the very top and bottom of the web view, so the
 * system bars it leaves around it (status bar, navigation bar, camera cutout) continue the page
 * from top to bottom, and the clock and battery icons stay readable on a light theme.
 */
export function useNativeChrome(): void {
  useEffect(() => {
    const bridge = (window as unknown as { MudrixChrome?: ChromeBridge }).MudrixChrome;
    if (!bridge) return undefined;

    let last = '';
    let frame = 0;
    let settle = 0;
    let pending = '';
    // The colours at the top and bottom edges right now.
    const read = () => {
      // Near the left edge, past the margin that cards leave, where the page itself shows.
      const x = 4;
      const top = colourAt(x, 1);
      const bottom = colourAt(x, window.innerHeight - 2);
      if (!top || !bottom) return null;
      return { top, bottom, key: `${hex(top)}${hex(bottom)}` };
    };
    const push = () => {
      frame = 0;
      const now = read();
      if (!now) return;
      if (now.key === last) {
        window.clearTimeout(settle);
        pending = '';
        return;
      }
      // Panels slide and fade over the page for a moment; only a colour that holds is sent, so the
      // bars do not flicker through the ones in between.
      if (now.key === pending) return;
      pending = now.key;
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        pending = '';
        // Nothing changes in the DOM when an animation ends, so look again before sending.
        const held = read();
        if (!held || held.key !== now.key) {
          schedule();
          return;
        }
        last = held.key;
        bridge.setBackground(
          hex(held.top),
          hex(held.bottom),
          isLight(held.top),
          isLight(held.bottom)
        );
      }, SETTLE_MS);
    };
    // Layout changes constantly while chatting; look at most once a frame, and only after it settles.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(push);
    };

    schedule();
    // Themes switch by class, inline variables or a custom theme's style element; screens switch the
    // header and composer under the bars.
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { attributes: true });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', schedule);
    // A panel finishing its slide changes what is at the edges without touching the DOM.
    document.addEventListener('transitionend', schedule, true);
    document.addEventListener('animationend', schedule, true);
    // Scrolling moves different content under the edges without changing the DOM.
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    // Coming back to the app: the shell may have lost the colours (its window was recreated), and
    // nothing here changed to trigger a new report, so send them again.
    const resend = () => {
      if (document.visibilityState === 'hidden') return;
      last = '';
      schedule();
    };
    document.addEventListener('visibilitychange', resend);
    window.addEventListener('focus', resend);
    window.addEventListener('pageshow', resend);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('transitionend', schedule, true);
      document.removeEventListener('animationend', schedule, true);
      window.removeEventListener('scroll', schedule, { capture: true });
      document.removeEventListener('visibilitychange', resend);
      window.removeEventListener('focus', resend);
      window.removeEventListener('pageshow', resend);
      media.removeEventListener('change', schedule);
    };
  }, []);
}
