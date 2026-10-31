import { useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { defaultDeviceName, getPushStatus, isPushSupported, isTauriIos } from '@/util/desktop';

// The public gateway that turns Matrix push requests into UnifiedPush messages.
const GATEWAY_URL = 'https://matrix.gateway.unifiedpush.org/_matrix/push/v1/notify';
const APP_ID = 'chat.mudrix.mobile.up';
const ENABLED_KEY = 'mx_up_enabled';
const ENDPOINT_KEY = 'mx_up_endpoint';
const APP_ID_KEY = 'mx_up_app_id';
const GATEWAY_KEY = 'mx_up_gateway';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}

export function isUnifiedPushEnabled(): boolean {
  return read(ENABLED_KEY) === '1';
}

export function setUnifiedPushEnabled(enabled: boolean): void {
  write(ENABLED_KEY, enabled ? '1' : null);
  if (!enabled) write(ENDPOINT_KEY, null);
}

// iOS has no APNs for us, so background delivery is either a native keep-alive or the ntfy app.
export type IosPushMode = 'off' | 'keepalive' | 'ntfy';

export const DEFAULT_NTFY_SERVER = 'https://ntfy.sh';
const NTFY_APP_ID = 'chat.mudrix.mobile.ntfy';
const MODE_KEY = 'mx_push_mode';
const NTFY_SERVER_KEY = 'mx_ntfy_server';
const NTFY_TOPIC_KEY = 'mx_ntfy_topic';

export function getIosPushMode(): IosPushMode {
  const mode = read(MODE_KEY);
  return mode === 'keepalive' || mode === 'ntfy' ? mode : 'off';
}

export function setIosPushMode(mode: IosPushMode): void {
  write(MODE_KEY, mode === 'off' ? null : mode);
}

/** Trims and strips trailing slashes; returns null unless it is an http(s) URL. */
export function normalizeNtfyServer(input: string): string | null {
  const value = input.trim().replace(/\/+$/, '');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

export function getNtfyServer(): string {
  return read(NTFY_SERVER_KEY) ?? DEFAULT_NTFY_SERVER;
}

export function setNtfyServer(server: string): void {
  write(NTFY_SERVER_KEY, server === DEFAULT_NTFY_SERVER ? null : server);
}

/** The topic is random and unguessable, which is all that protects it on a public ntfy server. */
export function getNtfyTopic(): string {
  const existing = read(NTFY_TOPIC_KEY);
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const topic = `mudrix-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  write(NTFY_TOPIC_KEY, topic);
  return topic;
}

export function getNtfyTopicUrl(server = getNtfyServer(), topic = getNtfyTopic()): string {
  return `${server}/${topic}`;
}

/**
 * ntfy's Matrix gateway expects the pushkey to be the topic URL with `?up=1`
 * (per the ntfy docs, "Matrix Push Gateway"). That is from memory of the docs and
 * is untested against a live server.
 */
function ntfyPushkey(server: string, topic: string): string {
  return `${getNtfyTopicUrl(server, topic)}?up=1`;
}

interface PusherTarget {
  /** Matrix pusher gateway URL (`data.url`). */
  gatewayUrl?: string;
  appId?: string;
}

/**
 * Registers (or removes) a Matrix pusher for a push endpoint. The app_id and pushkey a pusher was
 * registered with are remembered so removal always targets the same pusher, whatever the caller passes.
 */
export async function setMatrixPusher(
  client: MatrixClient,
  endpoint: string | null,
  { gatewayUrl = GATEWAY_URL, appId = APP_ID }: PusherTarget = {}
) {
  if (endpoint) {
    await client.setPusher({
      kind: 'http',
      app_id: appId,
      app_display_name: 'Mudrix',
      device_display_name: defaultDeviceName(),
      pushkey: endpoint,
      lang: navigator.language || 'en',
      data: { url: gatewayUrl, format: 'event_id_only' },
      append: false,
    });
    write(ENDPOINT_KEY, endpoint);
    write(APP_ID_KEY, appId);
    write(GATEWAY_KEY, gatewayUrl);
    return;
  }
  const previous = read(ENDPOINT_KEY);
  if (previous) {
    await client.setPusher({
      kind: null,
      app_id: read(APP_ID_KEY) ?? appId,
      pushkey: previous,
    } as unknown as Parameters<MatrixClient['setPusher']>[0]);
  }
  write(ENDPOINT_KEY, null);
  write(APP_ID_KEY, null);
  write(GATEWAY_KEY, null);
}

/** Points the Matrix pusher at the ntfy topic for the given server. */
export function setNtfyMatrixPusher(client: MatrixClient, server = getNtfyServer()) {
  return setMatrixPusher(client, ntfyPushkey(server, getNtfyTopic()), {
    gatewayUrl: `${server}/_matrix/push/v1/notify`,
    appId: NTFY_APP_ID,
  });
}

/** True when the registered pusher already matches the current ntfy settings. */
function ntfyPusherCurrent(): boolean {
  const server = getNtfyServer();
  return (
    read(APP_ID_KEY) === NTFY_APP_ID &&
    read(ENDPOINT_KEY) === ntfyPushkey(server, getNtfyTopic()) &&
    read(GATEWAY_KEY) === `${server}/_matrix/push/v1/notify`
  );
}

/**
 * Keeps the Matrix pusher in step with the push setup: on Android with the endpoint the
 * distributor currently reports, on iOS with the ntfy topic when that mode is selected.
 * (iOS keep-alive needs no pusher; the native side persists and restores it itself.)
 */
export function useUnifiedPushSync(client: MatrixClient | null) {
  useEffect(() => {
    if (!client || !isPushSupported()) return undefined;
    const ios = isTauriIos();
    if (ios ? getIosPushMode() !== 'ntfy' : !isUnifiedPushEnabled()) return undefined;
    let cancelled = false;
    const sync = async () => {
      try {
        if (ios) {
          if (!cancelled && !ntfyPusherCurrent()) await setNtfyMatrixPusher(client);
          return;
        }
        const status = await getPushStatus();
        if (cancelled || !status?.endpoint) return;
        if (status.endpoint === read(ENDPOINT_KEY)) return;
        await setMatrixPusher(client, status.endpoint);
      } catch (err) {
        console.warn('[push] could not register the pusher', err);
      }
    };
    sync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [client]);
}
