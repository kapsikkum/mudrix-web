import { useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { defaultDeviceName, getPushStatus, isPushSupported } from '@/util/desktop';

// The public gateway that turns Matrix push requests into UnifiedPush messages.
const GATEWAY_URL = 'https://matrix.gateway.unifiedpush.org/_matrix/push/v1/notify';
const APP_ID = 'chat.mudrix.mobile.up';
const ENABLED_KEY = 'mx_up_enabled';
const ENDPOINT_KEY = 'mx_up_endpoint';

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

/** Registers (or removes) the Matrix pusher that targets this device's UnifiedPush endpoint. */
export async function setMatrixPusher(client: MatrixClient, endpoint: string | null) {
  if (endpoint) {
    await client.setPusher({
      kind: 'http',
      app_id: APP_ID,
      app_display_name: 'Mudrix',
      device_display_name: defaultDeviceName(),
      pushkey: endpoint,
      lang: navigator.language || 'en',
      data: { url: GATEWAY_URL, format: 'event_id_only' },
      append: false,
    });
    write(ENDPOINT_KEY, endpoint);
    return;
  }
  const previous = read(ENDPOINT_KEY);
  if (previous) {
    await client.setPusher({
      kind: null,
      app_id: APP_ID,
      pushkey: previous,
    } as unknown as Parameters<MatrixClient['setPusher']>[0]);
  }
  write(ENDPOINT_KEY, null);
}

/** Keeps the Matrix pusher in step with the endpoint the distributor currently reports. */
export function useUnifiedPushSync(client: MatrixClient | null) {
  useEffect(() => {
    if (!client || !isPushSupported() || !isUnifiedPushEnabled()) return undefined;
    let cancelled = false;
    const sync = async () => {
      const status = await getPushStatus();
      if (cancelled || !status?.endpoint) return;
      if (status.endpoint === read(ENDPOINT_KEY)) return;
      try {
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
