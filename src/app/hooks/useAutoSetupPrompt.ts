import { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { autoSetupPromptedAtom, setupRecoveryKeyModalOpenAtom } from '@/app/store/atoms';

export function useAutoSetupPrompt(client: MatrixClient | null, syncReady: boolean) {
  const [prompted, setPrompted] = useAtom(autoSetupPromptedAtom);
  const setModalOpen = useSetAtom(setupRecoveryKeyModalOpenAtom);

  useEffect(() => {
    if (!client || !syncReady || prompted) return;

    let cancelled = false;

    const checkAndPrompt = async () => {
      const crypto = client.getCrypto();
      if (!crypto) return;

      try {
        const serverInfo = await crypto.getKeyBackupInfo();
        if (serverInfo?.version) return; // Backup exists — no prompt needed

        if (cancelled) return;

        setPrompted(true);
        setModalOpen(true);
      } catch {
        // Silent — don't bother the user on transient errors
      }
    };

    checkAndPrompt();

    return () => {
      cancelled = true;
    };
  }, [client, syncReady, prompted, setPrompted, setModalOpen]);
}
