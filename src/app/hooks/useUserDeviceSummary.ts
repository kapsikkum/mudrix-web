import { useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { DeviceVerification } from 'matrix-js-sdk/lib/models/device';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api';

export interface UserDeviceSummary {
  count: number;
  verifiedCount: number;
}

/** How many sessions a user has, and how many of them are verified. */
export function useUserDeviceSummary(
  client: MatrixClient | null | undefined,
  userId: string | null | undefined
): UserDeviceSummary | null {
  const [summary, setSummary] = useState<UserDeviceSummary | null>(null);

  useEffect(() => {
    setSummary(null);
    if (!client || !userId) return undefined;
    const crypto = client.getCrypto();
    if (!crypto) return undefined;
    let cancelled = false;

    const check = () => {
      crypto
        .getUserDeviceInfo([userId])
        .then((map) => {
          if (cancelled) return;
          const devices = [...(map.get(userId)?.values() ?? [])].filter((d) => !d.dehydrated);
          if (devices.length === 0) {
            setSummary(null);
            return;
          }
          const verifiedCount = devices.filter(
            (d) => d.verified === DeviceVerification.Verified
          ).length;
          setSummary({ count: devices.length, verifiedCount });
        })
        .catch(() => {
          if (!cancelled) setSummary(null);
        });
    };

    check();
    client.on(CryptoEvent.DevicesUpdated, check);
    return () => {
      cancelled = true;
      client.off(CryptoEvent.DevicesUpdated, check);
    };
  }, [client, userId]);

  return summary;
}
