import { useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api';

export interface UserVerificationInfo {
  /** We have a known cross-signing identity for this user (typically: we share/shared a room). */
  known: boolean;
  verified: boolean;
  /** Their identity changed since we last saw it and needs re-approval. */
  needsApproval: boolean;
}

/** Cross-signing trust for `userId`, re-checked whenever the device list settles. */
export function useUserVerification(
  client: MatrixClient | null | undefined,
  userId: string | null | undefined
): UserVerificationInfo | null {
  const [info, setInfo] = useState<UserVerificationInfo | null>(null);

  useEffect(() => {
    setInfo(null);
    if (!client || !userId) return undefined;
    const crypto = client.getCrypto();
    if (!crypto) return undefined;
    let cancelled = false;

    const check = () => {
      crypto
        .getUserVerificationStatus(userId)
        .then((status) => {
          if (cancelled) return;
          setInfo({
            known: status.known,
            verified: status.isVerified(),
            needsApproval: status.needsUserApproval,
          });
        })
        .catch(() => {
          if (!cancelled) setInfo(null);
        });
    };

    check();
    client.on(CryptoEvent.UserTrustStatusChanged, check);
    client.on(CryptoEvent.DevicesUpdated, check);
    return () => {
      cancelled = true;
      client.off(CryptoEvent.UserTrustStatusChanged, check);
      client.off(CryptoEvent.DevicesUpdated, check);
    };
  }, [client, userId]);

  return info;
}
