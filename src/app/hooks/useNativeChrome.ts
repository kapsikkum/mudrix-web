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

function parseRgb(css: string): Rgb | null {
  // color-mix() computes to color(srgb r g b) with channels from 0 to 1; other spaces (oklch, a
  // custom theme's lab) are not read, and the look goes on up the tree.
  const unit = css.startsWith('color(srgb ') ? 255 : css.startsWith('rgb') ? 1 : 0;
  if (!unit) return null;
  const parts = css.match(/[\d.]+/g)?.map(Number);
  if (!parts || parts.length < 3) return null;
  if (parts.length > 3 && parts[3] < 0.5) return null;
  return { r: parts[0] * unit, g: parts[1] * unit, b: parts[2] * unit };
}

/** The colour actually painted at a point: the first background up the tree that is not clear. */
function colourAt(x: number, y: number): Rgb | null {
  let el: Element | null = document.elementFromPoint(x, y);
  while (el) {
    const rgb = parseRgb(getComputedStyle(el).backgroundColor);
    if (rgb) return rgb;
    el = el.parentElement;
  }
  return parseRgb(getComputedStyle(document.body).backgroundColor);
}

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
    const push = () => {
      frame = 0;
      // Near the left edge, past the margin that cards leave, where the page itself shows.
      const x = 4;
      const top = colourAt(x, 1);
      const bottom = colourAt(x, window.innerHeight - 2);
      if (!top || !bottom) return;
      const key = `${hex(top)}${hex(bottom)}`;
      if (key === last) return;
      last = key;
      bridge.setBackground(hex(top), hex(bottom), isLight(top), isLight(bottom));
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
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, { capture: true });
      document.removeEventListener('visibilitychange', resend);
      window.removeEventListener('focus', resend);
      window.removeEventListener('pageshow', resend);
      media.removeEventListener('change', schedule);
    };
  }, []);
}
