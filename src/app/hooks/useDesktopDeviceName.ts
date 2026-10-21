import { useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { defaultDeviceName, isTauri } from '@/util/desktop';
import { useSyncReady } from '@/app/hooks/useSync';

const WEB_DEVICE_NAME = 'Mudrix Web';

/**
 * Sessions created before the desktop app knew it was the desktop app are named "Mudrix Web".
 * Rename the current one once so the device list says "Mudrix Desktop". A name the user chose
 * themselves is left alone.
 */
export function useDesktopDeviceName(client: MatrixClient | null): void {
  const syncReady = useSyncReady();

  useEffect(() => {
    const deviceId = client?.getDeviceId();
    if (!client || !deviceId || !syncReady || !isTauri()) return;
    let cancelled = false;
    client
      .getDevice(deviceId)
      .then((device) => {
        if (cancelled || device.display_name !== WEB_DEVICE_NAME) return;
        return client.setDeviceDetails(deviceId, { display_name: defaultDeviceName() });
      })
      .catch(() => {
        // Cosmetic: the next start tries again.
      });
    return () => {
      cancelled = true;
    };
  }, [client, syncReady]);
}
