import { useEffect, useRef } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api';
import type { CryptoApi } from 'matrix-js-sdk/lib/crypto-api';
import {
  autoPromptedAtom,
  recoveryKeyBadgeAtom,
  settingsOpenAtom,
  settingsPageAtom,
} from '@/app/store/atoms';
import {
  getEncryptionSetupStatus,
  type EncryptionSetupStatus,
} from '@/app/features/keybackup/cryptoStatus';
import { useToast } from '@/app/hooks/useToast';

type CryptoReadiness = 'ready' | 'needs-attention' | 'pending';

const PENDING_RETRY_DELAY_MS = 8000;
const PENDING_RETRY_MAX = 4;

async function evaluateCryptoReadiness(
  client: MatrixClient,
  crypto: CryptoApi
): Promise<CryptoReadiness> {
  const ownUserId = client.getUserId();
  const ownDeviceId = client.getDeviceId();
  if (!ownUserId || !ownDeviceId) return 'pending';

  let setup: EncryptionSetupStatus;
  try {
    setup = await getEncryptionSetupStatus(client);
  } catch {
    return 'pending';
  }

  if (!setup.secretStorageReady) return 'needs-attention';

  if (!setup.crossSigningIdentityExists && !setup.hasLocalCrossSigningPrivateKeys) {
    return 'pending';
  }

  try {
    const [userStatus, deviceStatus] = await Promise.all([
      crypto.getUserVerificationStatus(ownUserId),
      crypto.getDeviceVerificationStatus(ownUserId, ownDeviceId),
    ]);
    if ((userStatus?.isCrossSigningVerified() ?? false) && (deviceStatus?.isVerified() ?? false)) {
      return 'ready';
    }
  } catch {
    return 'pending';
  }

  return 'needs-attention';
}

export function useAutoPrompt(client: MatrixClient | null, syncReady: boolean) {
  const { t } = useTranslation();
  const [prompted, setPrompted] = useAtom(autoPromptedAtom);
  const setBadge = useSetAtom(recoveryKeyBadgeAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsPage = useSetAtom(settingsPageAtom);
  const toast = useToast();

  const promptedRef = useRef(prompted);
  promptedRef.current = prompted;

  useEffect(() => {
    if (!client || !syncReady) return;

    let cancelled = false;
    let pendingAttempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const runEvaluation = async () => {
      const crypto = client.getCrypto();
      if (!crypto) return;
      const readiness = await evaluateCryptoReadiness(client, crypto);
      if (cancelled) return;

      if (readiness === 'ready') {
        setBadge(null);
        return;
      }

      if (readiness === 'needs-attention') {
        setBadge('restore');
        if (!promptedRef.current) {
          setPrompted(true);
          toast.warning(t('settings.keyBackup.encryptionNotSetUpToast'), {
            duration: 10_000,
            actionLabel: t('settings.keyBackup.openSessionsAction'),
            onClick: () => {
              setSettingsPage('sessions');
              setSettingsOpen(true);
            },
          });
        }
        return;
      }

      if (pendingAttempts < PENDING_RETRY_MAX) {
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
  }, [client, syncReady, t, toast, setPrompted, setBadge, setSettingsOpen, setSettingsPage]);
}
