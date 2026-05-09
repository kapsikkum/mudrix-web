import { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import type { CryptoCallbacks } from 'matrix-js-sdk/lib/crypto-api';
import type { SecretStorageKeyDescription } from 'matrix-js-sdk/lib/secret-storage';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key';
import { autoRestorePromptedAtom, enterRecoveryKeyModalAtom } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';

export function useAutoRestorePrompt(client: MatrixClient | null, syncReady: boolean) {
  const [prompted, setPrompted] = useAtom(autoRestorePromptedAtom);
  const setEnterKeyModal = useSetAtom(enterRecoveryKeyModalAtom);
  const toast = useToast();

  useEffect(() => {
    if (!client || !syncReady || prompted) return;

    let cancelled = false;

    const checkAndPrompt = async () => {
      const crypto = client.getCrypto();
      if (!crypto) return;

      try {
        // Check whether a backup exists on the server
        const serverInfo = await crypto.getKeyBackupInfo();
        if (!serverInfo?.version) return; // No backup — nothing to prompt about

        // Check whether this device already has the key loaded
        const activeVersion = await crypto.getActiveSessionBackupVersion();
        if (activeVersion) return; // Already active — no prompt needed

        if (cancelled) return;

        // Mark as prompted before opening the modal so that even if the
        // component unmounts mid-prompt we don't show it again this session.
        setPrompted(true);

        // Open the enter-key modal with canSkip=true (user can dismiss)
        const recoveryKey = await new Promise<string | null>((resolve) => {
          setEnterKeyModal({ open: true, canSkip: true, resolve });
        });

        if (!recoveryKey || cancelled) return;

        let privateKey: Uint8Array;
        try {
          privateKey = decodeRecoveryKey(recoveryKey);
        } catch {
          toast.error(
            'Invalid recovery key format. You can enter it manually in Settings → Key Backup.'
          );
          return;
        }

        // Re-fetch backup info in case it changed while the modal was open
        const backupInfo = await crypto.getKeyBackupInfo();
        if (!backupInfo?.version) {
          toast.error('Key backup was removed while the prompt was open.');
          return;
        }

        // Inject the key into the SDK's cryptoCallbacks so it can decrypt 4S
        const callbacks: CryptoCallbacks = client.cryptoCallbacks;
        callbacks.getSecretStorageKey = async ({
          keys,
        }: {
          keys: Record<string, SecretStorageKeyDescription>;
        }) => {
          const keyId = Object.keys(keys)[0];
          return keyId ? [keyId, privateKey] : null;
        };

        // Load backup key from 4S (preferred) or inject directly as fallback
        try {
          await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
        } catch {
          await crypto.storeSessionBackupPrivateKey(privateKey, backupInfo.version);
        }

        await crypto.checkKeyBackupAndEnable();
        const result = await crypto.restoreKeyBackup();

        // Best-effort cross-signing bootstrap
        try {
          await crypto.bootstrapCrossSigning({});
        } catch {
          // Non-fatal
        }

        toast.success(`Restored ${result.imported} of ${result.total} room keys.`);
      } catch (err) {
        // Don't surface errors from the auto-prompt aggressively — just log
        console.warn('[AutoRestore] Failed:', getErrorMessage(err));
      }
    };

    checkAndPrompt();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, syncReady, prompted]);
}
