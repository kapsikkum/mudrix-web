import type { ThemeName } from '@/app/store/atoms/settings';
import { resolveThemeTokens } from '@/theme/customThemes';
import { getThemeTokens, toRgbString } from './callBackground';
import {
  VIDEO_TILE_SELECTOR,
  getTileVm,
  isScreenShareVm,
  subscribeObservable,
} from './elementCallTiles';

export interface CallGridInsets {
  top: number;
  bottom: number;
}

// Element Call picks its layout from the window size: below 601px either way it switches to
// one-on-one / spotlight layouts that leave some participants out of the DOM entirely.
const MIN_EC_WINDOW_SIZE = 601;
const SIDE_PADDING = 12;
const GAP = 8;
const MAX_TILE_ASPECT = 16 / 9;
const MIN_TILE_ASPECT = 3 / 4;
const DEFAULT_INSETS: CallGridInsets = { top: 12, bottom: 76 };

const ATTR_LAYER = 'data-mx-layer';
const ATTR_SPOTLIGHT = 'data-mx-spotlight';
const ATTR_TILE = 'data-mx-tile';
const ATTR_HIDDEN = 'data-mx-hidden';
const ATTR_SCREEN = 'data-mx-screen';
const ATTR_SPEAKING = 'data-mx-speaking';

const SPOTLIGHT_WRAPPER = '[data-maximised]';

interface GridMedia {
  key: string;
  userId: string;
  screen: boolean;
  el: HTMLElement;
}

interface GridShape {
  cols: number;
  rows: number;
  width: number;
  height: number;
}

const patchedWindows = new WeakSet<Window>();

function pinNormalWindowMode(win: Window): void {
  if (patchedWindows.has(win)) return;
  patchedWindows.add(win);
  (['innerWidth', 'innerHeight'] as const).forEach((prop) => {
    const descriptor =
      Object.getOwnPropertyDescriptor(win, prop) ??
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(win), prop);
    const get = descriptor?.get;
    if (!get) return;
    Object.defineProperty(win, prop, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: () => Math.max(get.call(win) as number, MIN_EC_WINDOW_SIZE),
    });
  });
  win.dispatchEvent(new Event('resize'));
}

export function computeGridShape(count: number, width: number, height: number): GridShape {
  let best: GridShape = { cols: 1, rows: 1, width: 0, height: 0 };
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols);
    let tileW = (width - GAP * (cols - 1)) / cols;
    let tileH = (height - GAP * (rows - 1)) / rows;
    if (tileW <= 0 || tileH <= 0) continue;
    if (tileW / tileH > MAX_TILE_ASPECT) tileW = tileH * MAX_TILE_ASPECT;
    if (tileW / tileH < MIN_TILE_ASPECT) tileH = tileW / MIN_TILE_ASPECT;
    if (tileW * tileH > best.width * best.height) {
      best = { cols, rows, width: tileW, height: tileH };
    }
  }
  return best;
}

export function buildCallGridStyles(theme?: ThemeName): string {
  const tokens = theme ? resolveThemeTokens(theme) : getThemeTokens();
  const speak = tokens.color.success;
  const speakRgb = toRgbString(speak) ?? '35, 165, 90';
  const tile = `[data-testid="videoTile"][${ATTR_TILE}]`;

  return [
    `[${ATTR_LAYER}]{position:fixed!important;inset:0!important;width:auto!important;height:auto!important;` +
      `align-self:stretch!important;justify-self:stretch!important;contain:none!important;overflow:hidden!important;}`,
    `[${ATTR_SPOTLIGHT}]{transform:none!important;inset:0!important;width:100%!important;height:100%!important;` +
      `box-shadow:none!important;background:none!important;pointer-events:none!important;}`,
    `[${ATTR_SPOTLIGHT}]>:first-child{position:static!important;contain:none!important;overflow:visible!important;` +
      `box-shadow:none!important;border-radius:0!important;}`,
    `[${ATTR_SPOTLIGHT}]>:not(:first-child){display:none!important;}`,
    `[${ATTR_HIDDEN}]{visibility:hidden!important;pointer-events:none!important;}`,
    `${tile}{position:absolute!important;left:var(--mx-x)!important;top:var(--mx-y)!important;` +
      `inset-block-start:var(--mx-y)!important;width:var(--mx-w)!important;height:var(--mx-h)!important;` +
      `transform:none!important;margin:0!important;opacity:1!important;pointer-events:auto!important;` +
      `--media-view-border-radius:10px;--video-tile-background:${tokens.color.bgTertiary};` +
      `border-radius:10px!important;outline:none!important;box-shadow:0 0 0 0 rgba(${speakRgb},0)!important;` +
      `transition:left .2s ease,top .2s ease,width .2s ease,height .2s ease,box-shadow .18s ease!important;}`,
    `${tile}::before{display:none!important;}`,
    `${tile}[${ATTR_SPEAKING}]{box-shadow:0 0 0 2px ${speak},0 0 16px 2px rgba(${speakRgb},.45)!important;}`,
    `${tile} span[role="img"][data-type="round"]{transition:box-shadow .18s ease;` +
      `box-shadow:0 0 0 0 rgba(${speakRgb},0),0 0 0 0 rgba(${speakRgb},0);}`,
    `${tile}[${ATTR_SPEAKING}] span[role="img"][data-type="round"]{` +
      `box-shadow:0 0 0 3px ${speak},0 0 22px 6px rgba(${speakRgb},.5);}`,
    `${tile}:not([${ATTR_SCREEN}]) video{object-fit:cover!important;}`,
    `${tile}[${ATTR_SCREEN}] video{object-fit:contain!important;background:#000!important;}`,
    `${tile} div:has(>[data-testid="name_tag"]){background:rgba(0,0,0,.6)!important;color:#fff!important;` +
      `border-radius:6px!important;box-shadow:none!important;}`,
  ].join('');
}

export class CallGridLayout {
  private doc: Document | null = null;

  private mutationObserver: MutationObserver | null = null;

  private resizeObserver: ResizeObserver | null = null;

  private frame: number | null = null;

  private insets: CallGridInsets = DEFAULT_INSETS;

  private readonly userOrder = new Map<string, number>();

  private readonly speakingSubs = new Map<HTMLElement, () => void>();

  constructor(private readonly iframe: HTMLIFrameElement) {}

  public attach(): void {
    const win = this.iframe.contentWindow;
    const doc = this.iframe.contentDocument;
    if (!win || !doc?.body || doc.location.href === 'about:blank') return;
    pinNormalWindowMode(win);
    if (doc === this.doc) {
      this.schedule();
      return;
    }

    this.detach();
    this.doc = doc;
    this.mutationObserver = new MutationObserver(() => this.schedule());
    this.mutationObserver.observe(doc.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-id', 'data-maximised'],
    });
    this.resizeObserver = new ResizeObserver(() => this.schedule());
    this.resizeObserver.observe(this.iframe);
    this.schedule();
  }

  public setInsets(insets: CallGridInsets): void {
    if (insets.top === this.insets.top && insets.bottom === this.insets.bottom) return;
    this.insets = insets;
    this.schedule();
  }

  public dispose(): void {
    this.detach();
    this.userOrder.clear();
  }

  private detach(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.speakingSubs.forEach((unsubscribe) => unsubscribe());
    this.speakingSubs.clear();
    this.doc = null;
  }

  private schedule(): void {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.layout();
    });
  }

  private collect(doc: Document): GridMedia[] {
    const byKey = new Map<string, GridMedia>();
    doc.querySelectorAll<HTMLElement>(VIDEO_TILE_SELECTOR).forEach((el) => {
      const vm = getTileVm(el);
      const userId = vm?.userId;
      if (!vm || typeof userId !== 'string') {
        el.setAttribute(ATTR_HIDDEN, '');
        return;
      }
      const key = typeof vm.id === 'string' ? vm.id : (el.getAttribute('data-id') ?? userId);
      const inSpotlight = !!el.closest(SPOTLIGHT_WRAPPER);
      const existing = byKey.get(key);
      if (existing && (inSpotlight || !existing.el.closest(SPOTLIGHT_WRAPPER))) {
        el.setAttribute(ATTR_HIDDEN, '');
        return;
      }
      if (existing) existing.el.setAttribute(ATTR_HIDDEN, '');
      byKey.set(key, { key, userId, screen: isScreenShareVm(vm), el });
      this.trackSpeaking(el, vm.speaking$);
    });

    const media = Array.from(byKey.values());
    media.forEach(({ userId }) => {
      if (!this.userOrder.has(userId)) this.userOrder.set(userId, this.userOrder.size);
    });
    return media.sort(
      (a, b) =>
        (this.userOrder.get(a.userId) ?? 0) - (this.userOrder.get(b.userId) ?? 0) ||
        Number(a.screen) - Number(b.screen) ||
        a.key.localeCompare(b.key)
    );
  }

  private trackSpeaking(el: HTMLElement, speaking$: unknown): void {
    if (this.speakingSubs.has(el)) return;
    const unsubscribe = subscribeObservable(speaking$, (speaking) => {
      el.toggleAttribute(ATTR_SPEAKING, !!speaking);
    });
    if (unsubscribe) this.speakingSubs.set(el, unsubscribe);
  }

  private layout(): void {
    const doc = this.doc;
    if (!doc?.body) return;

    this.speakingSubs.forEach((unsubscribe, el) => {
      if (el.isConnected) return;
      unsubscribe();
      this.speakingSubs.delete(el);
    });

    const media = this.collect(doc);
    const shown = new Set(media.map(({ el }) => el));

    doc.querySelectorAll<HTMLElement>(SPOTLIGHT_WRAPPER).forEach((wrapper) => {
      wrapper.setAttribute(ATTR_SPOTLIGHT, '');
      if (wrapper.parentElement) wrapper.parentElement.setAttribute(ATTR_LAYER, '');
      const visible = media.some(({ el }) => wrapper.contains(el));
      wrapper.toggleAttribute(ATTR_HIDDEN, !visible);
    });

    const width = doc.documentElement.clientWidth;
    const height = doc.documentElement.clientHeight;
    const areaW = Math.max(0, width - SIDE_PADDING * 2);
    const areaH = Math.max(0, height - this.insets.top - this.insets.bottom);
    const shape = computeGridShape(media.length, areaW, areaH);
    const totalH = shape.rows * shape.height + (shape.rows - 1) * GAP;
    const top = this.insets.top + Math.max(0, (areaH - totalH) / 2);

    media.forEach(({ el, screen }, index) => {
      const row = Math.floor(index / shape.cols);
      const inRow = row < shape.rows - 1 ? shape.cols : media.length - row * shape.cols;
      const col = index - row * shape.cols;
      const rowW = inRow * shape.width + (inRow - 1) * GAP;
      const x = SIDE_PADDING + (areaW - rowW) / 2 + col * (shape.width + GAP);
      const y = top + row * (shape.height + GAP);

      el.removeAttribute(ATTR_HIDDEN);
      el.setAttribute(ATTR_TILE, '');
      el.toggleAttribute(ATTR_SCREEN, screen);
      el.style.setProperty('--mx-x', `${Math.round(x)}px`);
      el.style.setProperty('--mx-y', `${Math.round(y)}px`);
      el.style.setProperty('--mx-w', `${Math.round(shape.width)}px`);
      el.style.setProperty('--mx-h', `${Math.round(shape.height)}px`);
      if (!el.closest(SPOTLIGHT_WRAPPER) && el.parentElement) {
        el.parentElement.setAttribute(ATTR_LAYER, '');
      }
    });

    doc.querySelectorAll<HTMLElement>(`[${ATTR_TILE}]`).forEach((el) => {
      if (!shown.has(el)) el.removeAttribute(ATTR_TILE);
    });
  }
}
