import { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  autoRestorePromptedAtom,
  autoRestoreTriggerAtom,
  settingsOpenAtom,
  settingsPageAtom,
  pendingCryptoPromptAtom,
} from '@/app/store/atoms';

export function useAutoRestorePrompt(client: MatrixClient | null, syncReady: boolean) {
  const [prompted, setPrompted] = useAtom(autoRestorePromptedAtom);
  const [pendingPrompt, setPendingCryptoPrompt] = useAtom(pendingCryptoPromptAtom);
  const setRestoreTrigger = useSetAtom(autoRestoreTriggerAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsPage = useSetAtom(settingsPageAtom);

  useEffect(() => {
    if (!client || !syncReady || prompted || pendingPrompt !== 'restore') return;

    setPendingCryptoPrompt(null);
    setPrompted(true);
    setRestoreTrigger(true);
    setSettingsPage('keybackup');
    setSettingsOpen(true);
  }, [
    client,
    syncReady,
    prompted,
    pendingPrompt,
    setPrompted,
    setPendingCryptoPrompt,
    setRestoreTrigger,
    setSettingsOpen,
    setSettingsPage,
  ]);
}
