import { useState, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key';
import type {
  CryptoApi,
  CryptoCallbacks,
  GeneratedSecretStorageKey,
} from 'matrix-js-sdk/lib/crypto-api';
import type { UIAuthCallback } from 'matrix-js-sdk/lib/interactive-auth';
import type { MatrixClient } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { buildCrossSigningUiaCallback as buildCrossSigningUiaCallbackShared } from '@/app/features/keybackup/crossSigningUia';
import {
  recoveryKeyModalAtom,
  enterRecoveryKeyModalAtom,
  recoveryKeyBadgeAtom,
  crossSigningUiaAtom,
} from '@/app/store/atoms';
import { useConfirm } from '@/app/hooks/useConfirm';

export function useRecoveryKeyActions(client: MatrixClient | null) {
  const { t } = useTranslation();
  const toast = useToast();
  const setRecoveryKeyModal = useSetAtom(recoveryKeyModalAtom);
  const setEnterKeyModal = useSetAtom(enterRecoveryKeyModalAtom);
  const confirmDialog = useConfirm();
  const clearBadge = useSetAtom(recoveryKeyBadgeAtom);
  const setCrossSigningUia = useSetAtom(crossSigningUiaAtom);

  const [loading, setLoading] = useState(false);

  const confirm = useCallback(
    (title: string, message: string, danger = false): Promise<boolean> =>
      confirmDialog({ title, message, danger }),
    [confirmDialog]
  );

  const promptRecoveryKey = useCallback(
    (canSkip = false): Promise<string | null> =>
      new Promise((resolve) => setEnterKeyModal({ open: true, canSkip, resolve })),
    [setEnterKeyModal]
  );

  const buildCrossSigningUiaCallback = useCallback((): UIAuthCallback<void> => {
    if (!client) throw new Error('No client');
    return buildCrossSigningUiaCallbackShared(client, setCrossSigningUia, t);
  }, [client, setCrossSigningUia, t]);

  const handleRestore = useCallback(async () => {
    if (!client) return;
    const crypto: CryptoApi | undefined = client.getCrypto();
    if (!crypto) {
      toast.error(t('settings.keyBackup.cryptoNotAvailable'));
      return;
    }

    const recoveryKey = await promptRecoveryKey(false);
    if (!recoveryKey) return;

    setLoading(true);
    try {
      let privateKey: Uint8Array;
      try {
        privateKey = decodeRecoveryKey(recoveryKey);
      } catch {
        throw new Error(t('settings.keyBackup.invalidRecoveryKey'));
      }

      const backupInfo = await crypto.getKeyBackupInfo();
      if (!backupInfo?.version) {
        throw new Error(t('settings.keyBackup.noKeyBackupFound'));
      }

      const callbacks: CryptoCallbacks = client.cryptoCallbacks;
      callbacks.getSecretStorageKey = async ({ keys }) => {
        const keyId = Object.keys(keys)[0];
        return keyId ? [keyId, privateKey as Uint8Array<ArrayBuffer>] : null;
      };
      callbacks.cacheSecretStorageKey = () => {};

      try {
        await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
      } catch {
        await crypto.storeSessionBackupPrivateKey(privateKey, backupInfo.version);
      }

      await crypto.checkKeyBackupAndEnable();

      const result = await crypto.restoreKeyBackup();

      let crossSigningOk = true;
      try {
        await crypto.bootstrapCrossSigning({});
      } catch {
        crossSigningOk = false;
      }

      if (crossSigningOk) {
        toast.success(
          t('settings.keyBackup.restoreSuccess', { imported: result.imported, total: result.total })
        );
      } else {
        toast.success(
          t('settings.keyBackup.restoreSuccessNoCSigning', {
            imported: result.imported,
            total: result.total,
          })
        );
      }
    } catch {
      toast.error(t('settings.keyBackup.restoreFailed'));
    } finally {
      clearBadge(null);
      setLoading(false);
    }
  }, [client, t, toast, promptRecoveryKey, clearBadge]);

  const handleRegenerate = useCallback(async () => {
    if (!client) return;
    const crypto: CryptoApi | undefined = client.getCrypto();
    if (!crypto) {
      toast.error(t('settings.keyBackup.cryptoNotAvailable'));
      return;
    }

    const ok = await confirm(
      t('settings.keyBackup.regenerateRecoveryKey') + '?',
      t('settings.keyBackup.regenerateConfirm'),
      true
    );
    if (!ok) return;

    setLoading(true);
    try {
      const oldInfo = await crypto.getKeyBackupInfo();
      if (oldInfo?.version) {
        await crypto.deleteKeyBackupVersion(oldInfo.version);
      }

      const keyData: GeneratedSecretStorageKey = await crypto.createRecoveryKeyFromPassphrase();
      const encodedKey: string | undefined = keyData.encodedPrivateKey;
      if (!encodedKey) throw new Error(t('settings.keyBackup.couldNotGenerateKeyNew'));

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

      try {
        await crypto.bootstrapCrossSigning({
          setupNewCrossSigning: true,
          authUploadDeviceSigningKeys: buildCrossSigningUiaCallback(),
        });
      } catch {
        // Non-fatal
      }

      await crypto.checkKeyBackupAndEnable();

      setRecoveryKeyModal({ open: true, recoveryKey: encodedKey, isRegenerating: true });
    } catch (err) {
      toast.error(t('settings.keyBackup.regenerateFailed', { error: getErrorMessage(err) }));
    } finally {
      clearBadge(null);
      setLoading(false);
    }
  }, [client, t, toast, confirm, buildCrossSigningUiaCallback, setRecoveryKeyModal, clearBadge]);

  return { loading, handleRestore, handleRegenerate };
}
