import { useState, useEffect, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Method, type MatrixClient } from 'matrix-js-sdk';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key';
import type {
  CryptoApi,
  CryptoCallbacks,
  GeneratedSecretStorageKey,
  KeyBackupInfo,
} from 'matrix-js-sdk/lib/crypto-api';
import type { UIAuthCallback } from 'matrix-js-sdk/lib/interactive-auth';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { buildCrossSigningUiaCallback as buildCrossSigningUiaCallbackShared } from '@/app/features/keybackup/crossSigningUia';
import {
  getEncryptionSetupStatus,
  hasExistingEncryptionSetup,
} from '@/app/features/keybackup/cryptoStatus';
import {
  recoveryKeyModalAtom,
  enterRecoveryKeyModalAtom,
  recoveryKeyBadgeAtom,
  crossSigningUiaAtom,
} from '@/app/store/atoms';
import { useConfirm } from '@/app/hooks/useConfirm';

function makeSecretStorageKeyCallback(
  client: MatrixClient,
  privateKey: Uint8Array
): NonNullable<CryptoCallbacks['getSecretStorageKey']> {
  return async ({ keys }) => {
    const key = privateKey as Uint8Array<ArrayBuffer>;
    const defaultKeyId = await client.secretStorage.getDefaultKeyId();

    const matchingKeyIds: string[] = [];
    for (const [keyId, keyInfo] of Object.entries(keys)) {
      if (await client.secretStorage.checkKey(key, keyInfo)) {
        matchingKeyIds.push(keyId);
      }
    }

    if (matchingKeyIds.length === 0) return null;

    const keyId =
      defaultKeyId && matchingKeyIds.includes(defaultKeyId) ? defaultKeyId : matchingKeyIds[0];
    return [keyId, key];
  };
}

export type BackupMode = 'loading' | 'none' | 'available' | 'active';

interface BackupStatus {
  mode: BackupMode;
  serverVersion: string | null;
  activeVersion: string | null;
}

async function fetchBackupStatus(crypto: CryptoApi): Promise<BackupStatus> {
  const [activeVersion, serverInfo] = await Promise.all([
    crypto.getActiveSessionBackupVersion(),
    crypto.getKeyBackupInfo(),
  ]);

  const serverVersion = serverInfo?.version ?? null;

  let mode: BackupMode;
  if (!serverVersion) {
    mode = 'none';
  } else if (activeVersion) {
    mode = 'active';
  } else {
    mode = 'available';
  }

  return { mode, serverVersion, activeVersion };
}

export function useRecoveryKeyActions(client: MatrixClient | null) {
  const { t } = useTranslation();
  const toast = useToast();
  const setRecoveryKeyModal = useSetAtom(recoveryKeyModalAtom);
  const setEnterKeyModal = useSetAtom(enterRecoveryKeyModalAtom);
  const confirmDialog = useConfirm();
  const clearBadge = useSetAtom(recoveryKeyBadgeAtom);
  const setCrossSigningUia = useSetAtom(crossSigningUiaAtom);

  const [status, setStatus] = useState<BackupStatus>({
    mode: 'loading',
    serverVersion: null,
    activeVersion: null,
  });
  const [loading, setLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!client) return;
    const crypto = client.getCrypto();
    if (!crypto) return;
    setStatus((s) => ({ ...s, mode: 'loading' }));
    try {
      setStatus(await fetchBackupStatus(crypto));
    } catch {
      setStatus({ mode: 'none', serverVersion: null, activeVersion: null });
    }
  }, [client]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const confirm = useCallback(
    (title: string, message: string, danger = false): Promise<boolean> =>
      confirmDialog({ title, message, danger }),
    [confirmDialog]
  );

  const promptRecoveryKey = useCallback(
    (): Promise<string | null> =>
      new Promise((resolve) => setEnterKeyModal({ open: true, resolve })),
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

    const recoveryKey = await promptRecoveryKey();
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
      callbacks.getSecretStorageKey = makeSecretStorageKeyCallback(client, privateKey);
      callbacks.cacheSecretStorageKey = () => {};

      await crypto.loadSessionBackupPrivateKeyFromSecretStorage();

      await crypto.checkKeyBackupAndEnable();

      const result = await crypto.restoreKeyBackup();

      await refreshStatus();

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
  }, [client, t, toast, promptRecoveryKey, clearBadge, refreshStatus]);

  const handleSetup = useCallback(async () => {
    if (!client) return;
    const crypto: CryptoApi | undefined = client.getCrypto();
    if (!crypto) {
      toast.error(t('settings.keyBackup.cryptoNotAvailable'));
      return;
    }

    try {
      const status = await getEncryptionSetupStatus(client);
      if (hasExistingEncryptionSetup(status)) {
        const ok = await confirm(
          t('crypto.setupOverwritesTitle'),
          t('crypto.setupOverwritesConfirm'),
          true
        );
        if (!ok) return;
      }
    } catch {
      const ok = await confirm(
        t('crypto.setupOverwritesTitle'),
        t('crypto.setupOverwritesConfirm'),
        true
      );
      if (!ok) return;
    }

    setLoading(true);
    try {
      const keyData: GeneratedSecretStorageKey = await crypto.createRecoveryKeyFromPassphrase();
      const encodedKey: string | undefined = keyData.encodedPrivateKey;
      if (!encodedKey) throw new Error(t('settings.keyBackup.couldNotGenerateKey'));

      const callbacks: CryptoCallbacks = client.cryptoCallbacks;
      callbacks.getSecretStorageKey = makeSecretStorageKeyCallback(client, keyData.privateKey);
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
      } catch (crossSigningErr) {
        if (crossSigningErr instanceof Error && crossSigningErr.message === 'UIA cancelled') {
          throw crossSigningErr;
        }
        toast.error(
          t('settings.keyBackup.crossSigningFailed', {
            error: getErrorMessage(crossSigningErr),
          })
        );
      }

      await crypto.checkKeyBackupAndEnable();

      setRecoveryKeyModal({ open: true, recoveryKey: encodedKey, isRegenerating: false });
      await refreshStatus();
      toast.success(t('settings.keyBackup.setupSuccess'));
    } catch (err) {
      toast.error(t('settings.keyBackup.setupFailed', { error: getErrorMessage(err) }));
    } finally {
      clearBadge(null);
      setLoading(false);
    }
  }, [
    client,
    t,
    toast,
    confirm,
    buildCrossSigningUiaCallback,
    setRecoveryKeyModal,
    clearBadge,
    refreshStatus,
  ]);

  const handleRegenerate = useCallback(async () => {
    if (!client) return;
    const crypto: CryptoApi | undefined = client.getCrypto();
    if (!crypto) {
      toast.error(t('settings.keyBackup.cryptoNotAvailable'));
      return;
    }

    const oldInfo = await crypto.getKeyBackupInfo();

    let restoredOk = false;
    if (oldInfo?.version) {
      try {
        await crypto.restoreKeyBackup();
        restoredOk = true;
      } catch {
        // no usable backup key available locally
      }
    } else {
      restoredOk = true;
    }

    const confirmMessage = restoredOk
      ? t('settings.keyBackup.regenerateConfirm')
      : t('settings.keyBackup.regenerateConfirmNoRestore');

    const ok = await confirm(
      t('settings.keyBackup.resetEncryptionKeys') + '?',
      confirmMessage,
      true
    );
    if (!ok) return;

    setLoading(true);
    let issuedKey: string | null = null;
    try {
      const keyData: GeneratedSecretStorageKey = await crypto.createRecoveryKeyFromPassphrase();
      const encodedKey: string | undefined = keyData.encodedPrivateKey;
      if (!encodedKey) throw new Error(t('settings.keyBackup.couldNotGenerateKeyNew'));

      const callbacks: CryptoCallbacks = client.cryptoCallbacks;
      callbacks.getSecretStorageKey = makeSecretStorageKeyCallback(client, keyData.privateKey);
      callbacks.cacheSecretStorageKey = () => {};

      await crypto.bootstrapSecretStorage({
        setupNewSecretStorage: true,
        setupNewKeyBackup: false,
        createSecretStorageKey: async () => keyData,
      });
      issuedKey = encodedKey;

      try {
        await crypto.bootstrapCrossSigning({
          authUploadDeviceSigningKeys: buildCrossSigningUiaCallback(),
        });
      } catch {
        // Non-fatal
      }

      await crypto.resetKeyBackup();

      const newInfo: KeyBackupInfo | null = await client.http
        .authedRequest<KeyBackupInfo>(Method.Get, '/room_keys/version')
        .catch(() => null);
      const trustInfo = newInfo ? await crypto.isKeyBackupTrusted(newInfo) : null;
      if (
        !newInfo?.version ||
        newInfo.version === oldInfo?.version ||
        !trustInfo?.trusted ||
        !trustInfo.matchesDecryptionKey
      ) {
        throw new Error(t('settings.keyBackup.regenerateBackupNotActive'));
      }

      setRecoveryKeyModal({ open: true, recoveryKey: encodedKey, isRegenerating: true });
      await refreshStatus();
    } catch (err) {
      if (issuedKey) {
        setRecoveryKeyModal({ open: true, recoveryKey: issuedKey, isRegenerating: true });
        await refreshStatus();
      }
      toast.error(t('settings.keyBackup.regenerateFailed', { error: getErrorMessage(err) }));
    } finally {
      clearBadge(null);
      setLoading(false);
    }
  }, [
    client,
    t,
    toast,
    confirm,
    buildCrossSigningUiaCallback,
    setRecoveryKeyModal,
    clearBadge,
    refreshStatus,
  ]);

  return { loading, mode: status.mode, handleSetup, handleRestore, handleRegenerate };
}
