import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api';
import type { VerificationRequest } from 'matrix-js-sdk/lib/crypto-api/verification';
import { verificationBannerAtom } from '@/app/store/atoms';

export function useVerification(client: MatrixClient | null) {
  const { t } = useTranslation();
  const setBanner = useSetAtom(verificationBannerAtom);

  useEffect(() => {
    if (!client) return;

    const onVerificationRequest = (request: VerificationRequest) => {
      const otherUser = request.otherUserId;
      const isSelf = request.isSelfVerification;

      setBanner({
        visible: true,
        text: isSelf
          ? t('verification.newSignInDetected', { otherUser })
          : t('verification.verificationRequestFrom', { otherUser }),
        request,
      });
    };

    client.on(
      CryptoEvent.VerificationRequestReceived as Parameters<typeof client.on>[0],
      onVerificationRequest
    );

    return () => {
      client.off(
        CryptoEvent.VerificationRequestReceived as Parameters<typeof client.off>[0],
        onVerificationRequest
      );
    };
  }, [client, setBanner, t]);
}
