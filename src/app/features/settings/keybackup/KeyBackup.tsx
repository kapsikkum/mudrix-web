import { useState, useEffect, useCallback, useRef } from 'react';
import { useSetAtom, useAtom, useAtomValue } from 'jotai';
import { vars } from '@/theme/vars.css';
import { useTranslation } from 'react-i18next';
import { KeyIcon, LockOpenIcon, ArrowClockwiseIcon } from '@phosphor-icons/react';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key';
import type {
  CryptoApi,
  CryptoCallbacks,
  GeneratedSecretStorageKey,
} from 'matrix-js-sdk/lib/crypto-api';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import {
  recoveryKeyModalAtom,
  enterRecoveryKeyModalAtom,
  confirmModalAtom,
  autoSetupTriggerAtom,
} from '@/app/store/atoms';
import * as css from '../Settings.css';

type BackupMode = 'loading' | 'none' | 'available' | 'active';

interface BackupStatus {
  mode: BackupMode;
  serverVersion: string | null; // version string from getKeyBackupInfo()
  activeVersion: string | null; // version string from getActiveSessionBackupVersion()
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

export function KeyBackup() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const setRecoveryKeyModal = useSetAtom(recoveryKeyModalAtom);
  const setEnterKeyModal = useSetAtom(enterRecoveryKeyModalAtom);
  const [, setConfirm] = useAtom(confirmModalAtom);

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
      new Promise((resolve) => setConfirm({ open: true, title, message, danger, resolve })),
    [setConfirm]
  );

  const promptRecoveryKey = useCallback(
    (canSkip = false): Promise<string | null> =>
      new Promise((resolve) => setEnterKeyModal({ open: true, canSkip, resolve })),
    [setEnterKeyModal]
  );

  const handleSetup = async () => {
    if (!client) return;
    const crypto = client.getCrypto();
    if (!crypto) {
      toast.error(t('settings.keyBackup.cryptoNotAvailable'));
      return;
    }

    setLoading(true);
    try {
      const keyData: GeneratedSecretStorageKey = await crypto.createRecoveryKeyFromPassphrase();
      const encodedKey: string | undefined = keyData.encodedPrivateKey;
      if (!encodedKey) throw new Error(t('settings.keyBackup.couldNotGenerateKey'));

      // Inject the private key into the SDK's cryptoCallbacks so that
      // bootstrapSecretStorage can use it when it calls getSecretStorageKey.
      // We must mutate the existing callbacks object in-place — the Rust crypto
      // engine holds a reference to it and won't pick up a replacement object.
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

      // Idempotent — creates cross-signing keys only if not already present,
      // then stores them in the new 4S. Safe to call even if already set up.
      try {
        await crypto.bootstrapCrossSigning({});
      } catch {
        // Non-fatal on servers that require UIA for cross-signing upload.
      }

      await crypto.checkKeyBackupAndEnable();

      setRecoveryKeyModal({ open: true, recoveryKey: encodedKey, isRegenerating: false });
      await refreshStatus();
      toast.success(t('settings.keyBackup.setupSuccess'));
    } catch (err) {
      toast.error(t('settings.keyBackup.setupFailed', { error: getErrorMessage(err) }));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!client) return;
    const crypto = client.getCrypto();
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

      // Must verify a backup exists before attempting to restore
      const backupInfo = await crypto.getKeyBackupInfo();
      if (!backupInfo?.version) {
        throw new Error(t('settings.keyBackup.noKeyBackupFound'));
      }

      // Inject key into callbacks so the SDK can decrypt 4S secrets with it
      const callbacks: CryptoCallbacks = client.cryptoCallbacks;
      callbacks.getSecretStorageKey = async ({ keys }) => {
        const keyId = Object.keys(keys)[0];
        return keyId ? [keyId, privateKey] : null;
      };

      // Fetch the backup decryption key from 4S and cache it in the Rust store
      try {
        await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
      } catch {
        // Fallback: inject the key directly (e.g. if 4S isn't set up on the server)
        await crypto.storeSessionBackupPrivateKey(privateKey, backupInfo.version);
      }

      await crypto.checkKeyBackupAndEnable();

      const result = await crypto.restoreKeyBackup();

      // Idempotent — loads cross-signing keys from 4S if they're there
      try {
        await crypto.bootstrapCrossSigning({});
      } catch {
        // Non-fatal
      }

      await refreshStatus();
      toast.success(
        t('settings.keyBackup.restoreSuccess', { imported: result.imported, total: result.total })
      );
    } catch (err) {
      toast.error(t('settings.keyBackup.restoreFailed', { error: getErrorMessage(err) }));
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!client) return;
    const crypto = client.getCrypto();
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
      // Delete the old backup version first so bootstrapSecretStorage creates a fresh one
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
        await crypto.bootstrapCrossSigning({});
      } catch {
        // Non-fatal
      }

      await crypto.checkKeyBackupAndEnable();

      // isRegenerating: true so the modal shows the stronger danger warning
      setRecoveryKeyModal({ open: true, recoveryKey: encodedKey, isRegenerating: true });
      await refreshStatus();
    } catch (err) {
      toast.error(t('settings.keyBackup.regenerateFailed', { error: getErrorMessage(err) }));
    } finally {
      setLoading(false);
    }
  };

  const { mode, serverVersion, activeVersion } = status;
  const isLoading = mode === 'loading';

  // Auto-trigger setup when navigated from the setup prompt modal
  const autoTrigger = useAtomValue(autoSetupTriggerAtom);
  const setAutoTrigger = useSetAtom(autoSetupTriggerAtom);
  const handleSetupRef = useRef(handleSetup);
  handleSetupRef.current = handleSetup;
  useEffect(() => {
    if (autoTrigger && mode === 'none' && !loading) {
      setAutoTrigger(false);
      handleSetupRef.current();
    }
  }, [autoTrigger, mode, loading, setAutoTrigger]);

  // Status badge — shows backup state only, NOT device verification state.
  // Device verification is shown separately in Settings → Sessions.
  let statusColor: string = vars.color.textMuted;
  let statusLabel = t('settings.keyBackup.checking');
  if (!isLoading) {
    if (mode === 'none') {
      statusLabel = t('settings.keyBackup.notSetUp');
    } else if (mode === 'active') {
      statusColor = vars.color.success;
      statusLabel = t('settings.keyBackup.active', { version: activeVersion });
    } else {
      // available: server has backup but this device hasn't loaded the key
      statusColor = 'orange';
      statusLabel = t('settings.keyBackup.availableOnServer', { version: serverVersion });
    }
  }

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.keyBackup.title')}</h2>

      {/* Status */}
      <div className={css.section}>
        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('settings.keyBackup.backupStatusLabel')}</span>
          </div>
          <span className={css.statusText} style={{ color: statusColor }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Actions context-aware */}
      <div className={css.section}>
        <div className={css.keyBackupActions}>
          {/* ── State: none — no backup on server ── */}
          {mode === 'none' && (
            <button className={css.actionBtn} onClick={handleSetup} disabled={loading || isLoading}>
              <KeyIcon size={14} />
              {t('settings.keyBackup.setupRecoveryKey')}
            </button>
          )}

          {/* State: available backup on server, key not loaded on this device */}
          {mode === 'available' && (
            <>
              {/* Primary: restore */}
              <button className={css.actionBtn} onClick={handleRestore} disabled={loading}>
                <LockOpenIcon size={14} />
                {t('settings.keyBackup.enterRecoveryKeyBtn')}
              </button>

              {/* Secondary danger: replace the whole backup */}
              <button className={css.actionBtnDanger} onClick={handleRegenerate} disabled={loading}>
                <ArrowClockwiseIcon size={14} />
                {t('settings.keyBackup.regenerateRecoveryKey')}
              </button>
            </>
          )}

          {/* State: active backup is running on this device */}
          {mode === 'active' && (
            <button className={css.actionBtnDanger} onClick={handleRegenerate} disabled={loading}>
              <ArrowClockwiseIcon size={14} />
              {t('settings.keyBackup.regenerateRecoveryKey')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
