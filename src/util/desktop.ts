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
 *             show_notification, open_external, open_auth_in_browser,
 *             take_pending_navigation, install_update
 *   events    desktop://open (in-app path or matrix: URI), desktop://auth-callback,
 *             desktop://settings-changed, desktop://visibility, desktop://update-ready
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

/**
 * True when running inside the Tauri shell on macOS. Used to keep the native
 * traffic-light buttons (and reserve room for them in TitleBar) instead of
 * drawing the custom Windows/Linux-style window controls.
 */
export function isTauriMac(): boolean {
  return isTauri() && isMac();
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// ---------------------------------------------------------------------------
// Cached state kept in sync by events from the native side.
// ---------------------------------------------------------------------------

let cachedSettings: DesktopSettings = DEFAULT_DESKTOP_SETTINGS;
let windowHidden = false;
let updateReady = false;
const updateListeners = new Set<() => void>();

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

/** Tray icon, tooltip, taskbar overlay and dock badge. */
export function setDesktopUnreadCount(total: number, highlight: number): void {
  if (!isTauri()) return;
  invoke('set_unread_count', { total, highlight }).catch(() => {});
}

export async function showDesktopNotification(
  title: string,
  body: string,
  roomUrl?: string
): Promise<void> {
  if (!isTauri() || cachedSettings.notificationsMuted) return;
  try {
    await invoke('show_notification', { title, body, roomUrl: roomUrl ?? null });
  } catch (err) {
    console.warn('[desktop] show_notification failed', err);
  }
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

export function onDesktopUpdateReady(cb: () => void): () => void {
  updateListeners.add(cb);
  if (updateReady) cb();
  return () => {
    updateListeners.delete(cb);
  };
}

export function installDesktopUpdate(): void {
  invoke('install_update').catch((err) => console.warn('[desktop] install_update failed', err));
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

/** Call once at start-up. Does nothing outside the desktop shell. */
export async function initDesktop(): Promise<void> {
  if (!isTauri()) return;
  document.documentElement.classList.add('tauri');
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
    listen('desktop://update-ready', () => {
      updateReady = true;
      updateListeners.forEach((cb) => cb());
    }),
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
