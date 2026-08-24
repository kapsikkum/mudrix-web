import { useState, useEffect, useCallback } from 'react';
import { useSetAtom, useAtom } from 'jotai';
import { vars } from '@/theme/vars.css';
import { useTranslation } from 'react-i18next';
import { KeyIcon, LockOpenIcon, ArrowClockwiseIcon } from '@phosphor-icons/react';
import { Button } from '@/app/components/Button';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key';
import type {
  CryptoApi,
  CryptoCallbacks,
  GeneratedSecretStorageKey,
} from 'matrix-js-sdk/lib/crypto-api';
import type { UIAuthCallback } from 'matrix-js-sdk/lib/interactive-auth';
import { AuthType } from 'matrix-js-sdk/lib/interactive-auth';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { waitForSsoFallback } from '@/app/features/sso/sso';
import {
  recoveryKeyModalAtom,
  enterRecoveryKeyModalAtom,
  confirmModalAtom,
  recoveryKeyBadgeAtom,
  crossSigningUiaAtom,
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

type CrossSigningUiaResult =
  | { type: 'password'; password: string }
  | { type: 'sso' }
  | { type: 'reset' }
  | null;

export function KeyBackup() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const setRecoveryKeyModal = useSetAtom(recoveryKeyModalAtom);
  const setEnterKeyModal = useSetAtom(enterRecoveryKeyModalAtom);
  const [, setConfirm] = useAtom(confirmModalAtom);
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
      new Promise((resolve) => setConfirm({ open: true, title, message, danger, resolve })),
    [setConfirm]
  );

  const promptRecoveryKey = useCallback(
    (canSkip = false): Promise<string | null> =>
      new Promise((resolve) => setEnterKeyModal({ open: true, canSkip, resolve })),
    [setEnterKeyModal]
  );

  const buildCrossSigningUiaCallback = useCallback(
    (): UIAuthCallback<void> => async (makeRequest) => {
      try {
        await makeRequest(null);
        return;
      } catch (err: unknown) {
        const e = err as {
          httpStatus?: number;
          data?: {
            flows?: { stages: string[] }[];
            session?: string;
            params?: Record<string, { url?: string }>;
          };
        };
        if (e?.httpStatus !== 401) throw err;

        const flows = e.data?.flows ?? [];
        const session = e.data?.session ?? '';

        // Delegated-auth servers point at an account-management page instead of UIA.
        const resetStage = flows.find(
          (f) =>
            f.stages.includes(AuthType.OAuth) || f.stages.includes('org.matrix.cross_signing_reset')
        );
        const resetUrl =
          e.data?.params?.[AuthType.OAuth]?.url ??
          e.data?.params?.['org.matrix.cross_signing_reset']?.url;

        if (resetStage && resetUrl) {
          const result = await new Promise<CrossSigningUiaResult>((resolve) =>
            setCrossSigningUia({ open: true, offerSso: false, resetUrl, resolve })
          );
          if (!result) throw new Error('UIA cancelled');
          await makeRequest({ type: AuthType.OAuth, session });
          return;
        }

        const offersSso = flows.some(
          (f) => f.stages.includes(AuthType.Sso) || f.stages.includes(AuthType.SsoUnstable)
        );

        let modalError: string | undefined;
        while (true) {
          const result = await new Promise<CrossSigningUiaResult>((resolve) =>
            setCrossSigningUia({ open: true, offerSso: offersSso, error: modalError, resolve })
          );

          if (!result) throw new Error('UIA cancelled');
          if (result.type === 'reset') continue; // not offered here; ignore defensively

          if (result.type === 'sso') {
            if (!client) throw new Error('No client');
            try {
              const fallbackUrl = client.getFallbackAuthUrl(AuthType.Sso, session);
              await waitForSsoFallback(fallbackUrl, client.getHomeserverUrl());
              await makeRequest({ session });
              return;
            } catch (ssoErr: unknown) {
              if (ssoErr instanceof Error && ssoErr.message === 'sso_popup_closed') {
                modalError = t('settings.sessions.ssoCancelled');
                continue;
              }
              throw ssoErr;
            }
          }

          try {
            await makeRequest({
              type: AuthType.Password,
              identifier: { type: 'm.id.user', user: client?.getUserId() ?? '' },
              password: result.password,
              session,
            });
            return;
          } catch (retryErr: unknown) {
            const re = retryErr as { httpStatus?: number };
            if (re?.httpStatus === 401) {
              modalError = t('settings.sessions.incorrectPassword');
              // loop — open modal again with error
            } else {
              throw retryErr;
            }
          }
        }
      }
    },
    [client, setCrossSigningUia, t]
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

      try {
        await crypto.bootstrapCrossSigning({
          setupNewCrossSigning: true,
          authUploadDeviceSigningKeys: buildCrossSigningUiaCallback(),
        });
      } catch (crossSigningErr) {
        // Deliberate cancellation isn't an error — backup continues without
        // cross-signing, same as any other cross-signing failure.
        if (!(crossSigningErr instanceof Error && crossSigningErr.message === 'UIA cancelled')) {
          toast.error(
            t('settings.keyBackup.crossSigningFailed', {
              error: getErrorMessage(crossSigningErr),
            })
          );
        }
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

      // Inject key into callbacks so the SDK can decrypt 4S secrets with it.
      // cacheSecretStorageKey is set to a no-op so the SDK doesn't try to
      // persist the key somewhere unexpected during the restore flow.
      const callbacks: CryptoCallbacks = client.cryptoCallbacks;
      callbacks.getSecretStorageKey = async ({ keys }) => {
        const keyId = Object.keys(keys)[0];
        return keyId ? [keyId, privateKey as Uint8Array<ArrayBuffer>] : null;
      };
      callbacks.cacheSecretStorageKey = () => {};

      // Fetch the backup decryption key from 4S and cache it in the Rust store
      try {
        await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
      } catch {
        // Fallback: inject the key directly (e.g. if 4S isn't set up on the server)
        await crypto.storeSessionBackupPrivateKey(privateKey, backupInfo.version);
      }

      await crypto.checkKeyBackupAndEnable();

      const result = await crypto.restoreKeyBackup();

      // Re-establish cross-signing: import keys from 4S and self-sign this device.
      // The getSecretStorageKey callback is still set from above so 4S is accessible.
      let crossSigningOk = true;
      try {
        await crypto.bootstrapCrossSigning({});
      } catch {
        crossSigningOk = false;
      }

      await refreshStatus();
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
        await crypto.bootstrapCrossSigning({
          setupNewCrossSigning: true,
          authUploadDeviceSigningKeys: buildCrossSigningUiaCallback(),
        });
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
      clearBadge(null);
      setLoading(false);
    }
  };

  const { mode, serverVersion, activeVersion } = status;
  const isLoading = mode === 'loading';

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
            <Button
              variant="primary"
              size="sm"
              onClick={handleSetup}
              disabled={loading || isLoading}
            >
              <KeyIcon size={14} />
              {t('settings.keyBackup.setupRecoveryKey')}
            </Button>
          )}

          {/* State: available backup on server, key not loaded on this device */}
          {mode === 'available' && (
            <>
              {/* Primary: restore */}
              <Button variant="primary" size="sm" onClick={handleRestore} disabled={loading}>
                <LockOpenIcon size={14} />
                {t('settings.keyBackup.enterRecoveryKeyBtn')}
              </Button>

              {/* Secondary danger: replace the whole backup */}
              <Button variant="danger" size="sm" onClick={handleRegenerate} disabled={loading}>
                <ArrowClockwiseIcon size={14} />
                {t('settings.keyBackup.regenerateRecoveryKey')}
              </Button>
            </>
          )}

          {/* State: active backup is running on this device */}
          {mode === 'active' && (
            <Button variant="danger" size="sm" onClick={handleRegenerate} disabled={loading}>
              <ArrowClockwiseIcon size={14} />
              {t('settings.keyBackup.regenerateRecoveryKey')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
