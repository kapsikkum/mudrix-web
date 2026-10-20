import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api';
import {
  hasRestoredBackupVersion,
  restoreKeyBackupNow,
} from '@/app/features/keybackup/keyBackupRestore';
import { useToast } from '@/app/hooks/useToast';

const START_DELAY_MS = 4000;
const MIN_RETRY_INTERVAL_MS = 60_000;

/**
 * Download every room key from the key backup once this device is able to read it.
 *
 * "Able to" means the backup is trusted and its decryption key is cached locally, which happens
 * after the recovery key was entered or after verifying this device from another one (the key
 * arrives by secret sharing). Nothing is trusted or skipped here: without the cached key this does
 * nothing. Individual missing sessions are also fetched on demand by the SDK; this just fills in
 * the rest of the history once, instead of one session per scrolled message.
 */
export function useAutoKeyBackupRestore(client: MatrixClient | null, syncReady: boolean) {
  const { t } = useTranslation();
  const toast = useToast();

  useEffect(() => {
    if (!client || !syncReady) return;

    let cancelled = false;
    let lastAttempt = 0;

    const attempt = async () => {
      const crypto = client.getCrypto();
      if (!crypto || cancelled) return;
      if (Date.now() - lastAttempt < MIN_RETRY_INTERVAL_MS) return;

      try {
        const [version, key] = await Promise.all([
          crypto.getActiveSessionBackupVersion(),
          crypto.getSessionBackupPrivateKey(),
        ]);
        if (cancelled || !version || key === null) return;
        if (hasRestoredBackupVersion(client, version)) return;

        lastAttempt = Date.now();
        const result = await restoreKeyBackupNow(client);
        if (!cancelled && result.imported > 0) {
          toast.success(
            t('settings.keyBackup.autoRestoreDone', {
              imported: result.imported,
              total: result.total,
            })
          );
        }
      } catch {
        // Offline or backup temporarily unavailable; the next backup event or start retries.
      }
    };

    const startTimer = setTimeout(attempt, START_DELAY_MS);
    const onBackupChanged = () => {
      attempt();
    };

    client.on(
      CryptoEvent.KeyBackupDecryptionKeyCached as Parameters<typeof client.on>[0],
      onBackupChanged
    );
    client.on(CryptoEvent.KeyBackupStatus as Parameters<typeof client.on>[0], onBackupChanged);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      client.off(
        CryptoEvent.KeyBackupDecryptionKeyCached as Parameters<typeof client.off>[0],
        onBackupChanged
      );
      client.off(CryptoEvent.KeyBackupStatus as Parameters<typeof client.off>[0], onBackupChanged);
    };
  }, [client, syncReady, t, toast]);
}
