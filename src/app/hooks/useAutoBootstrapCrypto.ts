import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import type {
  CryptoApi,
  CryptoCallbacks,
  GeneratedSecretStorageKey,
} from 'matrix-js-sdk/lib/crypto-api';
import type { UIAuthCallback } from 'matrix-js-sdk/lib/interactive-auth';
import { buildCrossSigningUiaCallback } from '@/app/features/keybackup/crossSigningUia';
import {
  getEncryptionSetupStatus,
  hasExistingEncryptionSetup,
} from '@/app/features/keybackup/cryptoStatus';
import { useToast } from '@/app/hooks/useToast';
import {
  crossSigningUiaAtom,
  pendingCryptoPromptAtom,
  recoveryKeyBadgeAtom,
  recoveryKeyModalAtom,
} from '@/app/store/atoms';

interface BootstrapOutcome {
  recoveryKey: string;
  crossSigningSkipped: boolean;
}

// Only auto-bootstrap once per SPA session, per user. After a successful run the
// account carries 4S/backup state on the server, so later logins skip cleanly.
let lastAutoBootstrapUserId: string | null = null;

async function bootstrapFreshAccountCrypto(
  client: MatrixClient,
  crypto: CryptoApi,
  authUploadDeviceSigningKeys: UIAuthCallback<void>
): Promise<BootstrapOutcome> {
  const keyData: GeneratedSecretStorageKey = await crypto.createRecoveryKeyFromPassphrase();
  const recoveryKey: string | undefined = keyData.encodedPrivateKey;
  if (!recoveryKey) throw new Error('Failed to generate recovery key');

  const callbacks: CryptoCallbacks = client.cryptoCallbacks;
  callbacks.getSecretStorageKey = async ({ keys }) => {
    const keyId = Object.keys(keys)[0];
    return keyId ? [keyId, keyData.privateKey] : null;
  };
  callbacks.cacheSecretStorageKey = () => {};

  await crypto.bootstrapSecretStorage({
    setupNewSecretStorage: true,
    setupNewKeyBackup: true,
    createSecretStorageKey: async () => keyData,
  });

  let crossSigningSkipped = false;
  try {
    await crypto.bootstrapCrossSigning({
      setupNewCrossSigning: true,
      authUploadDeviceSigningKeys,
    });
  } catch {
    crossSigningSkipped = true;
  }

  await crypto.checkKeyBackupAndEnable();

  return { recoveryKey, crossSigningSkipped };
}

export function useAutoBootstrapCrypto(client: MatrixClient | null, syncReady: boolean) {
  const { t } = useTranslation();
  const toast = useToast();
  const setPendingCryptoPrompt = useSetAtom(pendingCryptoPromptAtom);
  const setRecoveryKeyModal = useSetAtom(recoveryKeyModalAtom);
  const clearBadge = useSetAtom(recoveryKeyBadgeAtom);
  const setCrossSigningUia = useSetAtom(crossSigningUiaAtom);

  useEffect(() => {
    if (!client || !syncReady) return;
    const userId = client.getUserId() ?? null;
    if (!userId) return;

    if (lastAutoBootstrapUserId === userId) return;
    lastAutoBootstrapUserId = userId;

    const crypto = client.getCrypto();
    if (!crypto) return;

    let cancelled = false;

    setPendingCryptoPrompt((prev) => (prev === 'setup' ? null : prev));

    (async () => {
      let status;
      try {
        status = await getEncryptionSetupStatus(client);
      } catch (err) {
        console.warn(
          '[useAutoBootstrapCrypto] Failed to read encryption state, skipping auto-bootstrap:',
          err
        );
        return;
      }
      if (cancelled) return;

      if (status.secretStorageReady) return;

      if (status.keyBackupVersion) {
        setPendingCryptoPrompt('restore');
        return;
      }

      if (hasExistingEncryptionSetup(status)) {
        setPendingCryptoPrompt('existing');
        return;
      }

      setPendingCryptoPrompt(null);

      try {
        const outcome = await bootstrapFreshAccountCrypto(
          client,
          crypto,
          buildCrossSigningUiaCallback(client, setCrossSigningUia, t)
        );

        if (cancelled) return;

        clearBadge(null);
        setRecoveryKeyModal({
          open: true,
          recoveryKey: outcome.recoveryKey,
          isRegenerating: false,
        });
        if (outcome.crossSigningSkipped) {
          toast.warning(t('settings.keyBackup.setupAutoCrossSigningSkipped'));
        } else {
          toast.success(t('settings.keyBackup.setupAutoDone'));
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('[useAutoBootstrapCrypto] Automatic crypto bootstrap failed:', err);
        setPendingCryptoPrompt((prev) => prev ?? 'setup');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    client,
    syncReady,
    t,
    toast,
    setPendingCryptoPrompt,
    setRecoveryKeyModal,
    clearBadge,
    setCrossSigningUia,
  ]);
}
