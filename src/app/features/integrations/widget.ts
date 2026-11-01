/** Pure helpers for running an integration widget. No React, no I/O. */
import { isLocalDevHost, type WidgetPermission } from './manifest';
import { getWidgetCapabilityDef } from './widgetCapabilities';

/**
 * The widget runs in an iframe with allow-same-origin, which only means "its OWN origin". If the
 * widget were served from Mudrix's origin, allow-same-origin plus allow-scripts would let it
 * remove the sandbox and read the user's session. So a widget URL on the app's origin must never
 * be loaded (see isSameOriginAsApp / assertWidgetUrlAllowed).
 */
export const WIDGET_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups';
/** Permissions policy for the iframe: nothing (no camera, microphone, geolocation...). */
export const WIDGET_ALLOW = '';

/** True when the URL is on the app's own origin. Unparseable URLs count as same-origin (fail closed). */
export function isSameOriginAsApp(url: string): boolean {
  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return true;
  }
}

export type WidgetUrlCheck = { ok: true } | { ok: false; error: string };

/** Call at install and at every open. Rejects the app's own origin, non-https and credentials. */
export function assertWidgetUrlAllowed(url: string): WidgetUrlCheck {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, error: 'The widget address is not a valid URL' };
  }
  if (u.origin === window.location.origin)
    return { ok: false, error: 'A widget can not run on the same origin as this app' };
  const devLocal = import.meta.env.DEV && u.protocol === 'http:' && isLocalDevHost(u.host);
  if (u.protocol !== 'https:' && !devLocal)
    return { ok: false, error: 'A widget must be served over https' };
  if (u.username || u.password)
    return { ok: false, error: 'The widget address must not contain credentials' };
  return { ok: true };
}

export interface WidgetUrlContext {
  roomId: string;
  userId: string;
  displayName: string;
  theme: 'light' | 'dark';
  lang: string;
}

/** theme and lang always; room_id, user_id, display_name only if the widget declared them. */
export function buildWidgetUrl(
  widget: Pick<WidgetPermission, 'url' | 'parameters'>,
  ctx: WidgetUrlContext
): string {
  const u = new URL(widget.url);
  u.searchParams.set('theme', ctx.theme);
  u.searchParams.set('lang', ctx.lang);
  const wanted = widget.parameters ?? [];
  if (wanted.includes('room_id')) u.searchParams.set('room_id', ctx.roomId);
  if (wanted.includes('user_id')) u.searchParams.set('user_id', ctx.userId);
  if (wanted.includes('display_name')) u.searchParams.set('display_name', ctx.displayName);
  return u.toString();
}

/**
 * The Widget API capability strings the widget asked for that the approved catalogue ids cover;
 * everything else is dropped. The per-room timeline capability is granted only for `roomId`
 * and only when an approved id needs it.
 */
export function resolveCapabilities(
  requested: Iterable<string>,
  approvedIds: readonly string[],
  roomId?: string
): Set<string> {
  const allowed = new Set<string>();
  approvedIds.forEach((id) => {
    const def = getWidgetCapabilityDef(id);
    if (!def) return;
    def.capabilities.forEach((c) => allowed.add(c));
    if (def.needsTimeline && roomId) allowed.add(`org.matrix.msc2762.timeline:${roomId}`);
  });
  const out = new Set<string>();
  for (const r of requested) if (allowed.has(r)) out.add(r);
  return out;
}
