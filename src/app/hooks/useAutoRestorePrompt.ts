import { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  autoRestorePromptedAtom,
  autoRestoreTriggerAtom,
  settingsOpenAtom,
  settingsPageAtom,
} from '@/app/store/atoms';

export function useAutoRestorePrompt(client: MatrixClient | null, syncReady: boolean) {
  const [prompted, setPrompted] = useAtom(autoRestorePromptedAtom);
  const setRestoreTrigger = useSetAtom(autoRestoreTriggerAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsPage = useSetAtom(settingsPageAtom);

  useEffect(() => {
    if (!client || !syncReady || prompted) return;

    let cancelled = false;

    const checkAndPrompt = async () => {
      const crypto = client.getCrypto();
      if (!crypto) return;

      try {
        const serverInfo = await crypto.getKeyBackupInfo();
        if (!serverInfo?.version) return;

        const activeVersion = await crypto.getActiveSessionBackupVersion();
        if (activeVersion) return;

        if (cancelled) return;

        setPrompted(true);
        setRestoreTrigger(true);
        setSettingsPage('keybackup');
        setSettingsOpen(true);
      } catch {
        // Silently ignore initial check failures
      }
    };

    checkAndPrompt();

    return () => {
      cancelled = true;
    };
  }, [
    client,
    syncReady,
    prompted,
    setPrompted,
    setRestoreTrigger,
    setSettingsOpen,
    setSettingsPage,
  ]);
}
