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
// People tiles stay Discord-sized (16:9, at most this wide) instead of filling the call; only
// screen shares grow to use the space.
const MAX_PERSON_TILE_WIDTH = 480;
const DEFAULT_INSETS: CallGridInsets = { top: 12, bottom: 76 };
// With a tile focused, the others sit in a strip of this height (capped to a share of the area).
const STRIP_HEIGHT = 112;
const STRIP_MAX_SHARE = 0.22;

const ATTR_LAYER = 'data-mx-layer';
const ATTR_SPOTLIGHT = 'data-mx-spotlight';
const ATTR_TILE = 'data-mx-tile';
const ATTR_HIDDEN = 'data-mx-hidden';
const ATTR_SCREEN = 'data-mx-screen';
const ATTR_SPEAKING = 'data-mx-speaking';
const ATTR_FOCUSED = 'data-mx-focused';

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

export function computeGridShape(
  count: number,
  width: number,
  height: number,
  maxTileWidth = Infinity
): GridShape {
  let best: GridShape = { cols: 1, rows: 1, width: 0, height: 0 };
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols);
    let tileW = (width - GAP * (cols - 1)) / cols;
    let tileH = (height - GAP * (rows - 1)) / rows;
    if (tileW <= 0 || tileH <= 0) continue;
    if (tileW / tileH > MAX_TILE_ASPECT) tileW = tileH * MAX_TILE_ASPECT;
    if (tileW / tileH < MIN_TILE_ASPECT) tileH = tileW / MIN_TILE_ASPECT;
    if (tileW > maxTileWidth) {
      tileW = maxTileWidth;
      tileH = Math.min(tileH, tileW / MAX_TILE_ASPECT);
    }
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
    `${tile}[${ATTR_SPEAKING}][data-video-enabled="true"]{box-shadow:0 0 0 2px ${speak},0 0 16px 2px rgba(${speakRgb},.45)!important;}`,
    // EC sizes avatars from its own (larger) layout; size them from our tile instead.
    `${tile} span[role="img"][data-type="round"]{width:calc(var(--mx-h) * .42)!important;` +
      `height:calc(var(--mx-h) * .42)!important;font-size:calc(var(--mx-h) * .2)!important;` +
      `transition:box-shadow .18s ease;` +
      `box-shadow:0 0 0 0 rgba(${speakRgb},0),0 0 0 0 rgba(${speakRgb},0);}`,
    `${tile}[${ATTR_SPEAKING}] span[role="img"][data-type="round"]{` +
      `box-shadow:0 0 0 3px ${speak},0 0 22px 6px rgba(${speakRgb},.5);}`,
    // Mudrix's own avatar and decoration over EC's (CallTileAvatars). Hidden with the camera on.
    `${tile}[data-mx-avatar] span[role="img"][data-type="round"]{visibility:hidden!important;}`,
    `.mx-tile-avatar-layer{position:absolute;inset:0;display:flex;align-items:center;` +
      `justify-content:center;pointer-events:none;}`,
    `${tile}[data-video-enabled="true"] .mx-tile-avatar-layer{display:none;}`,
    `.mx-tile-avatar-wrap{position:relative;width:calc(var(--mx-h) * .42);height:calc(var(--mx-h) * .42);}`,
    `.mx-tile-avatar{position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;` +
      `display:flex;align-items:center;justify-content:center;transition:box-shadow .18s ease;` +
      `box-shadow:0 0 0 0 rgba(${speakRgb},0),0 0 0 0 rgba(${speakRgb},0);}`,
    `${tile}[${ATTR_SPEAKING}] .mx-tile-avatar{box-shadow:0 0 0 3px ${speak},0 0 22px 6px rgba(${speakRgb},.5);}`,
    `.mx-tile-avatar-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}`,
    `.mx-tile-avatar-mark{width:58%;height:58%;}`,
    `.mx-tile-avatar-decoration{position:absolute;top:50%;left:50%;width:120%;height:120%;` +
      `max-width:none;max-height:none;transform:translate(-50%,-50%);}`,
    `${tile}:not([${ATTR_SCREEN}]) video{object-fit:cover!important;}`,
    `${tile}[${ATTR_SCREEN}] video{object-fit:contain!important;background:#000!important;}`,
    `${tile} div:has(>[data-testid="name_tag"]){background:rgba(0,0,0,.6)!important;color:#fff!important;` +
      `border-radius:6px!important;box-shadow:none!important;}`,
    `${tile}{cursor:pointer;}`,
    `${tile}[${ATTR_FOCUSED}]{cursor:zoom-out;}`,
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

  /** Tile shown large, Discord style: click a tile to focus it, click it again to go back. */
  private focusedKey: string | null = null;

  /** Small views (the popout): while someone shares a screen, show only the share. */
  private screenOnly = false;

  private readonly onClick = (e: MouseEvent) => {
    const tile = this.tileFromEvent(e);
    if (!tile) return;
    this.focusedKey = this.focusedKey === tile ? null : tile;
    this.schedule();
  };

  private readonly onDoubleClick = (e: MouseEvent) => {
    const tile = this.tileFromEvent(e);
    if (!tile) return;
    // The first click of the pair toggled focus; a double-click means "this one, full screen".
    this.focusedKey = tile;
    this.schedule();
    const owner = this.iframe.ownerDocument;
    if (owner.fullscreenElement) owner.exitFullscreen().catch(() => {});
    // The container, not the iframe, so our call controls (portaled next to it) stay on screen.
    else (this.iframe.parentElement ?? this.iframe).requestFullscreen().catch(() => {});
  };

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
    doc.addEventListener('click', this.onClick);
    doc.addEventListener('dblclick', this.onDoubleClick);
    this.schedule();
  }

  public setInsets(insets: CallGridInsets): void {
    if (insets.top === this.insets.top && insets.bottom === this.insets.bottom) return;
    this.insets = insets;
    this.schedule();
  }

  public setScreenOnly(on: boolean): void {
    if (on === this.screenOnly) return;
    this.screenOnly = on;
    this.schedule();
  }

  public dispose(): void {
    this.detach();
    this.userOrder.clear();
    this.focusedKey = null;
  }

  /** The key of the tile a click landed on, unless it hit one of the tile's own controls. */
  private tileFromEvent(e: MouseEvent): string | null {
    const target = e.target as Element | null;
    if (!target || target.closest('button, a, input, [role="menu"], [role="menuitem"]'))
      return null;
    const el = target.closest<HTMLElement>(`[${ATTR_TILE}]`);
    return el?.dataset.mxKey ?? null;
  }

  private detach(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.doc?.removeEventListener('click', this.onClick);
    this.doc?.removeEventListener('dblclick', this.onDoubleClick);
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

    let media = this.collect(doc);
    if (this.screenOnly && media.some(({ screen }) => screen)) {
      media.forEach(({ el, screen }) => {
        if (!screen) el.setAttribute(ATTR_HIDDEN, '');
      });
      media = media.filter(({ screen }) => screen);
    }
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

    if (this.focusedKey && !media.some(({ key }) => key === this.focusedKey)) {
      this.focusedKey = null;
    }
    const focused = media.find(({ key }) => key === this.focusedKey);
    const place = (item: GridMedia, x: number, y: number, w: number, h: number) => {
      const { el, screen, key } = item;
      el.removeAttribute(ATTR_HIDDEN);
      el.setAttribute(ATTR_TILE, '');
      el.dataset.mxKey = key;
      el.toggleAttribute(ATTR_SCREEN, screen);
      el.toggleAttribute(ATTR_FOCUSED, item === focused);
      el.style.setProperty('--mx-x', `${Math.round(x)}px`);
      el.style.setProperty('--mx-y', `${Math.round(y)}px`);
      el.style.setProperty('--mx-w', `${Math.round(w)}px`);
      el.style.setProperty('--mx-h', `${Math.round(h)}px`);
      if (!el.closest(SPOTLIGHT_WRAPPER) && el.parentElement) {
        el.parentElement.setAttribute(ATTR_LAYER, '');
      }
    };

    if (focused) {
      // Focused: one big tile, the rest in a strip underneath.
      const rest = media.filter((item) => item !== focused);
      const stripH = rest.length ? Math.min(STRIP_HEIGHT, areaH * STRIP_MAX_SHARE) : 0;
      const mainH = areaH - (rest.length ? stripH + GAP : 0);
      place(focused, SIDE_PADDING, this.insets.top, areaW, mainH);
      if (rest.length) {
        const tileW = Math.min(
          stripH * MAX_TILE_ASPECT,
          (areaW - GAP * (rest.length - 1)) / rest.length
        );
        const rowW = rest.length * tileW + (rest.length - 1) * GAP;
        const y = this.insets.top + mainH + GAP;
        rest.forEach((item, i) =>
          place(item, SIDE_PADDING + (areaW - rowW) / 2 + i * (tileW + GAP), y, tileW, stripH)
        );
      }
    } else {
      const hasScreen = media.some(({ screen }) => screen);
      const shape = computeGridShape(
        media.length,
        areaW,
        areaH,
        hasScreen ? Infinity : MAX_PERSON_TILE_WIDTH
      );
      const totalH = shape.rows * shape.height + (shape.rows - 1) * GAP;
      const top = this.insets.top + Math.max(0, (areaH - totalH) / 2);
      media.forEach((item, index) => {
        const row = Math.floor(index / shape.cols);
        const inRow = row < shape.rows - 1 ? shape.cols : media.length - row * shape.cols;
        const col = index - row * shape.cols;
        const rowW = inRow * shape.width + (inRow - 1) * GAP;
        const x = SIDE_PADDING + (areaW - rowW) / 2 + col * (shape.width + GAP);
        const y = top + row * (shape.height + GAP);
        place(item, x, y, shape.width, shape.height);
      });
    }

    doc.querySelectorAll<HTMLElement>(`[${ATTR_TILE}]`).forEach((el) => {
      if (!shown.has(el)) el.removeAttribute(ATTR_TILE);
    });
  }
}
