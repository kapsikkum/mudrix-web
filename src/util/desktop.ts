import { isMac } from '@/app/util/platform';

/**
 * Bridge to the Mudrix Desktop shell (Tauri v2, repo `mudrix-desktop`).
 *
 * Everything here is a no-op in a plain browser: `isTauri()` is false and the
 * `@tauri-apps/api` modules are only ever loaded through dynamic `import()`, so
 * the web build does not pay for them.
 *
 * Native side contract (see `src-tauri/src/commands.rs` in mudrix-desktop):
 *   commands  get_desktop_settings, set_desktop_settings, set_unread_count,
 *             show_notification, open_external, save_download, open_auth_in_browser,
 *             take_pending_navigation, install_update, check_for_updates
 *   events    desktop://open (in-app path or matrix: URI), desktop://auth-callback,
 *             desktop://settings-changed, desktop://visibility, desktop://update-ready,
 *             desktop://update-available
 */

export interface DesktopSettings {
  /** Closing the window hides it to the tray instead of quitting. */
  keepRunningInBackground: boolean;
  /** Start Mudrix when the user logs in to the OS. */
  launchAtLogin: boolean;
  /** When started at login, stay in the tray instead of showing the window. */
  startMinimized: boolean;
  /** Tray "Mute notifications": suppresses banners and sounds. */
  notificationsMuted: boolean;
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  keepRunningInBackground: true,
  launchAtLogin: false,
  startMinimized: false,
  notificationsMuted: false,
};

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** The iOS/Android shell (repo `mudrix-mobile`): same command contract, no window chrome. */
/** A phone or tablet: the phone app, or a touch-first device with a small screen. */
export function isMobileDevice(): boolean {
  if (isTauriMobile()) return true;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    Math.min(window.screen.width, window.screen.height) <= 820
  );
}

export function isTauriMobile(): boolean {
  return (
    isTauri() &&
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

/** The Windows/macOS/Linux shell: tray, window controls, updater, autostart. */
export function isTauriDesktop(): boolean {
  return isTauri() && !isTauriMobile();
}

/** The name a new session of this client gets in the device list. */
export function defaultDeviceName(): string {
  if (isTauriMobile()) return 'Mudrix Mobile';
  if (isTauri()) return 'Mudrix Desktop';
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile')
    ? 'Mudrix Mobile'
    : 'Mudrix Web';
}

/**
 * True when running inside the Tauri shell on macOS. Used to keep the native
 * traffic-light buttons (and reserve room for them in TitleBar) instead of
 * drawing the custom Windows/Linux-style window controls.
 */
export function isTauriMac(): boolean {
  return isTauri() && isMac();
}

async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown> | ArrayBuffer | Uint8Array,
  options?: { headers: Record<string, string> }
): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args, options);
}

// ---------------------------------------------------------------------------
// Cached state kept in sync by events from the native side.
// ---------------------------------------------------------------------------

let cachedSettings: DesktopSettings = DEFAULT_DESKTOP_SETTINGS;
let windowHidden = false;
export interface DesktopUpdateInfo {
  version: string;
  /** Release page; where Linux users download the new build. */
  url: string;
  /** `ready`: downloaded, restart installs it. `available`: must be downloaded manually. */
  kind: 'ready' | 'available';
}

let pendingUpdate: DesktopUpdateInfo | null = null;
const updateListeners = new Set<(info: DesktopUpdateInfo) => void>();

function setPendingUpdate(info: DesktopUpdateInfo): void {
  pendingUpdate = info;
  updateListeners.forEach((cb) => cb(info));
}

/** Sync accessor used on hot paths (notification sounds and banners). */
export function isDesktopMuted(): boolean {
  return isTauri() && cachedSettings.notificationsMuted;
}

/**
 * True while the desktop window is hidden to the tray. The webview's own
 * `document.visibilityState` is not reliable for that on every platform.
 */
export function isDesktopWindowHidden(): boolean {
  return isTauri() && windowHidden;
}

export async function getDesktopSettings(): Promise<DesktopSettings> {
  const settings = await invoke<DesktopSettings>('get_desktop_settings');
  cachedSettings = settings;
  return settings;
}

export async function setDesktopSettings(
  patch: Partial<DesktopSettings>
): Promise<DesktopSettings> {
  const settings = await invoke<DesktopSettings>('set_desktop_settings', { patch });
  cachedSettings = settings;
  return settings;
}

/** The operating system's accent colour as `#rrggbb`, or null when it has none (or in a browser). */
export async function getSystemAccent(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const accent = await invoke<string | null>('get_system_accent');
    return typeof accent === 'string' && /^#[0-9a-f]{6}$/i.test(accent) ? accent : null;
  } catch {
    return null; // an older desktop build without the command
  }
}

/** Window/taskbar and idle tray icon. A logo URL themes them; null restores the bundled icons. */
export async function setDesktopAppIcon(logoUrl: string | null): Promise<void> {
  if (!isTauri()) return;
  try {
    if (!logoUrl) {
      await invoke('set_app_icon', { png: null });
      return;
    }
    const img = new Image();
    img.src = logoUrl;
    await img.decode();
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    await invoke('set_app_icon', { png: Array.from(new Uint8Array(await blob.arrayBuffer())) });
  } catch (err) {
    console.warn('[desktop] set_app_icon failed', err);
  }
}

/** Tray icon, tooltip, taskbar overlay and dock badge. */
export function setDesktopUnreadCount(total: number, highlight: number): void {
  if (!isTauri()) return;
  invoke('set_unread_count', { total, highlight }).catch(() => {});
}

export async function showDesktopNotification(
  title: string,
  body: string,
  roomUrl?: string,
  /** Mobile shell: bundled sound to play with the notification, or "silent". */
  sound?: string
): Promise<void> {
  if (!isTauri() || cachedSettings.notificationsMuted) return;
  try {
    await invoke('show_notification', {
      title,
      body,
      roomUrl: roomUrl ?? null,
      sound: sound ?? null,
    });
  } catch (err) {
    console.warn('[desktop] show_notification failed', err);
  }
}

/**
 * Save a downloaded attachment (`src` is a blob: or http(s) URL) into the Downloads folder.
 * Webview `<a download>` links do nothing in the shell, so the bytes go to the native side.
 * Resolves with the saved path.
 */
export async function saveDesktopDownload(src: string, filename: string): Promise<string> {
  const bytes = new Uint8Array(await (await fetch(src)).arrayBuffer());
  return invoke<string>('save_download', bytes, {
    headers: { 'x-filename': encodeURIComponent(filename) },
  });
}

/** Open an http(s)/mailto URL in the system browser. */
export function openExternalUrl(url: string): void {
  invoke('open_external', { url }).catch((err) =>
    console.warn('[desktop] open_external failed', err)
  );
}

/**
 * Send an SSO or OIDC authorization URL to the system browser. The native side
 * runs a loopback listener and brings the result back via `desktop://auth-callback`.
 */
export async function openAuthInBrowser(url: string): Promise<void> {
  await invoke('open_auth_in_browser', { url });
}

export function onDesktopUpdate(cb: (info: DesktopUpdateInfo) => void): () => void {
  updateListeners.add(cb);
  if (pendingUpdate) cb(pendingUpdate);
  return () => {
    updateListeners.delete(cb);
  };
}

export type DesktopUpdateCheck = 'upToDate' | 'ready' | 'available' | 'error';

/** Manual "Check for updates"; the toast also appears when one is found. */
export async function checkForDesktopUpdates(): Promise<DesktopUpdateCheck> {
  if (!isTauri()) return 'upToDate';
  try {
    return await invoke<DesktopUpdateCheck>('check_for_updates');
  } catch {
    return 'error';
  }
}

export function installDesktopUpdate(): void {
  invoke('install_update').catch((err) => console.warn('[desktop] install_update failed', err));
}

// ---------------------------------------------------------------------------
// Background push (Android, UnifiedPush)
// ---------------------------------------------------------------------------

export interface PushStatus {
  supported: boolean;
  /** Installed UnifiedPush distributor apps (package names). */
  distributors: string[];
  distributor: string | null;
  /** Endpoint URL once the distributor has issued one; used as the Matrix pushkey. */
  endpoint: string | null;
  error: string | null;
  notificationsAllowed: boolean;
  /** Foreground service keeping the app connected in the background (no distributor needed). */
  keepAlive?: boolean;
}

export function isPushSupported(): boolean {
  return isTauriMobile() && /Android/i.test(navigator.userAgent);
}

export async function getPushStatus(): Promise<PushStatus | null> {
  if (!isPushSupported()) return null;
  try {
    const status = await invoke<PushStatus>('push_status');
    return status.supported ? status : null;
  } catch {
    return null;
  }
}

export async function registerPush(distributor?: string): Promise<void> {
  await invoke('push_register', { distributor: distributor ?? null });
}

export async function unregisterPush(): Promise<void> {
  await invoke('push_unregister');
}

export async function setPushKeepAlive(enabled: boolean): Promise<void> {
  await invoke('push_keepalive', { enabled });
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** Map a `matrix:` URI (MSC2312) to an in-app route, or null if unsupported. */
export function matrixUriToPath(uri: string): string | null {
  if (!uri.toLowerCase().startsWith('matrix:')) return null;
  const rest = uri.slice('matrix:'.length).replace(/^\/\//, '');
  const [pathPart] = rest.split(/[?#]/);
  const segments = pathPart.split('/').map((s) => decodeURIComponent(s));
  const [kind, id] = segments;
  if (!kind || !id) return null;
  if (kind === 'roomid') return `/r/${encodeURIComponent(`!${id}`)}`;
  if (kind === 'r') return `/r/${encodeURIComponent(`#${id}`)}`;
  return null;
}

function navigateInApp(path: string): void {
  if (!path.startsWith('/')) return;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function handleOpen(target: string): void {
  const path = target.startsWith('/') ? target : matrixUriToPath(target);
  if (path) navigateInApp(path);
}

// ---------------------------------------------------------------------------
// Start-up wiring
// ---------------------------------------------------------------------------

/**
 * `window.open(url, '_blank', 'noopener...')` and external anchors go to the
 * system browser. Popups that need `window.opener` (the SSO UIA fallback) are
 * left alone.
 */
function installExternalLinkHandling(): void {
  const isExternal = (url: URL) =>
    (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') &&
    url.origin !== window.location.origin;

  const nativeOpen = window.open.bind(window);
  window.open = (url, target, features) => {
    if (url && features?.includes('noopener')) {
      try {
        const parsed = new URL(url.toString(), window.location.href);
        if (isExternal(parsed)) {
          openExternalUrl(parsed.toString());
          return null;
        }
      } catch {
        // fall through to the native implementation
      }
    }
    return nativeOpen(url, target, features);
  };

  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!anchor) return;
      try {
        const parsed = new URL((anchor as HTMLAnchorElement).href, window.location.href);
        if (!isExternal(parsed)) return;
        event.preventDefault();
        openExternalUrl(parsed.toString());
      } catch {
        // not a valid URL; let the webview handle it
      }
    },
    true
  );
}

/**
 * iOS shell only: if the webview fills the screen but reports no safe-area insets, content ends up
 * under the status bar / Dynamic Island and the home indicator and cannot be tapped. In that case
 * give the layout notch-sized insets instead of none.
 */
function applyIosSafeAreaFallback(): void {
  if (!isTauriMobile() || !/iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const reported = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  probe.remove();
  const fullScreen = window.innerHeight >= window.screen.height - 2;
  // Notched iPhones are 812pt tall or more; older ones have no inset to report.
  if (reported > 0 || !fullScreen || window.screen.height < 812) return;
  const root = document.documentElement.style;
  root.setProperty('--safe-top', '59px');
  root.setProperty('--safe-bottom', '34px');
}

/**
 * The iOS shell's `ios-webview` plugin (repo `mudrix-mobile`) keeps the web view itself from
 * scrolling and shrinks it to the area above the keyboard, the way Android does. Its init script
 * sets this flag and the `ios-native-keyboard` class on <html> before the app loads; keyboard
 * changes then toggle `ios-keyboard-open` and set `--ios-keyboard-height` on <html>.
 */
export function hasNativeIosKeyboard(): boolean {
  return (
    typeof window !== 'undefined' &&
    ((window as { __MUDRIX_IOS_NATIVE_KEYBOARD__?: boolean }).__MUDRIX_IOS_NATIVE_KEYBOARD__ ===
      true ||
      document.documentElement.classList.contains('ios-native-keyboard'))
  );
}

/**
 * Android, and iOS builds without the `ios-webview` plugin. (Android resizes the web view for the
 * keyboard, so there this only keeps the page at the top.) On iOS the keyboard only shrinks the
 * visual viewport and iOS scrolls the page to keep the focused field in view. The page is sized to
 * the visual viewport and the scroll is put back at the top, so the app ends at the keyboard and
 * doesn't move. (It is not also offset by the viewport's pan: the scroll reset removes the pan.)
 */
function lockMobileViewport(): void {
  const root = document.documentElement;
  const vv = window.visualViewport;
  // The bottom inset (home indicator) is covered by the keyboard, so the composer sits flush on it.
  const baseSafeBottom = root.style.getPropertyValue('--safe-bottom');
  const resetScroll = () => {
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    if (document.scrollingElement && document.scrollingElement.scrollTop) {
      document.scrollingElement.scrollTop = 0;
    }
  };
  const sync = () => {
    const keyboardOpen = window.innerHeight - (vv?.height ?? window.innerHeight) > 120;
    if (keyboardOpen) root.style.setProperty('--safe-bottom', '0px');
    else if (baseSafeBottom) root.style.setProperty('--safe-bottom', baseSafeBottom);
    else root.style.removeProperty('--safe-bottom');
    root.style.setProperty('--vvh', `${Math.round(vv?.height ?? window.innerHeight)}px`);
    root.style.setProperty('--vvw', `${Math.round(vv?.width ?? window.innerWidth)}px`);
    resetScroll();
  };
  sync();
  vv?.addEventListener('resize', sync);
  // A pan changes no size; only the scroll needs putting back.
  vv?.addEventListener('scroll', resetScroll);
  window.addEventListener('scroll', resetScroll, { passive: true });
  window.addEventListener('orientationchange', sync);
}

/** Call once at start-up. Does nothing outside the desktop shell. */
export async function initDesktop(): Promise<void> {
  if (!isTauri()) return;
  document.documentElement.classList.add('tauri');
  if (isTauriMobile()) document.documentElement.classList.add('tauri-mobile');
  applyIosSafeAreaFallback();
  // With the native plugin the web view already ends at the keyboard and never scrolls; the page
  // just fills it. Android resizes its web view natively too, but has always gone through here.
  if (isTauriMobile() && !hasNativeIosKeyboard()) lockMobileViewport();
  if (isMac()) document.documentElement.classList.add('tauri-darwin');
  installExternalLinkHandling();

  const { listen } = await import('@tauri-apps/api/event');
  await Promise.all([
    listen<string>('desktop://open', (e) => handleOpen(e.payload)),
    listen<string>('desktop://auth-callback', (e) => {
      // A full load: the callback pages read the code/token from window.location.
      window.location.assign(e.payload);
    }),
    listen<DesktopSettings>('desktop://settings-changed', (e) => {
      cachedSettings = e.payload;
    }),
    listen<boolean>('desktop://visibility', (e) => {
      windowHidden = !e.payload;
    }),
    listen<{ version: string; url: string }>('desktop://update-ready', (e) =>
      setPendingUpdate({ ...e.payload, kind: 'ready' })
    ),
    listen<{ version: string; url: string }>('desktop://update-available', (e) =>
      setPendingUpdate({ ...e.payload, kind: 'available' })
    ),
  ]);

  try {
    await getDesktopSettings();
    windowHidden = !(await invoke<boolean>('is_window_visible'));
    const pending = await invoke<string | null>('take_pending_navigation');
    if (pending) handleOpen(pending);
  } catch (err) {
    console.warn('[desktop] init failed', err);
  }
}
