import { useCallback, useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api';
import type { CryptoApi } from 'matrix-js-sdk/lib/crypto-api';

type DeviceTrustStatus = 'verified' | 'needs-verification' | 'unverifiable' | 'pending';

const PENDING_RETRY_DELAY_MS = 8000;
const PENDING_RETRY_MAX = 4;

async function evaluateDeviceTrust(
  client: MatrixClient,
  crypto: CryptoApi
): Promise<DeviceTrustStatus> {
  const ownUserId = client.getUserId();
  const ownDeviceId = client.getDeviceId();
  if (!ownUserId || !ownDeviceId) return 'unverifiable';

  const isSelfSigned = async (): Promise<boolean> => {
    try {
      const [userStatus, deviceStatus] = await Promise.all([
        crypto.getUserVerificationStatus(ownUserId),
        crypto.getDeviceVerificationStatus(ownUserId, ownDeviceId),
      ]);
      return (
        (userStatus?.isCrossSigningVerified() ?? false) && (deviceStatus?.isVerified() ?? false)
      );
    } catch {
      return false;
    }
  };

  let csStatus;
  try {
    csStatus = await crypto.getCrossSigningStatus();
  } catch {
    return 'pending';
  }

  if (!csStatus.publicKeysOnDevice && !csStatus.privateKeysCachedLocally.masterKey) {
    return 'pending';
  }

  if (await isSelfSigned()) return 'verified';

  try {
    const { devices } = await client.getDevices();
    const others = devices?.filter((d) => d.device_id !== ownDeviceId) ?? [];
    if (others.length === 0) return 'unverifiable';

    const statuses = await Promise.all(
      others.map(async (d) => {
        try {
          const status = await crypto.getDeviceVerificationStatus(ownUserId, d.device_id);
          return status?.signedByOwner ?? false;
        } catch {
          return false;
        }
      })
    );
    return statuses.some(Boolean) ? 'needs-verification' : 'unverifiable';
  } catch {
    return 'unverifiable';
  }
}

export function useDeviceTrust(client: MatrixClient | null, syncReady: boolean) {
  const [needsVerification, setNeedsVerification] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const evaluate = useCallback(async () => {
    if (!client) return;
    const crypto = client.getCrypto();
    if (!crypto) return;
    return evaluateDeviceTrust(client, crypto);
  }, [client]);

  const dismiss = useCallback(() => setDismissed(true), []);

  useEffect(() => {
    if (!client || !syncReady) return;

    let cancelled = false;
    let pendingAttempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const runEvaluation = async () => {
      const status = await evaluate();
      if (cancelled) return;
      setNeedsVerification(status === 'needs-verification');
      if (status === 'pending' && pendingAttempts < PENDING_RETRY_MAX) {
        pendingAttempts += 1;
        if (!retryTimer) retryTimer = setTimeout(runEvaluation, PENDING_RETRY_DELAY_MS);
      }
    };

    const initialTimer = setTimeout(runEvaluation, 2500);

    const onChanged = () => runEvaluation();

    client.on(CryptoEvent.UserTrustStatusChanged as Parameters<typeof client.on>[0], onChanged);
    client.on(CryptoEvent.DevicesUpdated as Parameters<typeof client.on>[0], onChanged);
    client.on(CryptoEvent.KeysChanged as Parameters<typeof client.on>[0], onChanged);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      if (retryTimer) clearTimeout(retryTimer);
      client.off(CryptoEvent.UserTrustStatusChanged as Parameters<typeof client.off>[0], onChanged);
      client.off(CryptoEvent.DevicesUpdated as Parameters<typeof client.off>[0], onChanged);
      client.off(CryptoEvent.KeysChanged as Parameters<typeof client.off>[0], onChanged);
    };
  }, [client, syncReady, evaluate]);

  return { needsVerification: needsVerification && !dismissed, dismiss };
}
