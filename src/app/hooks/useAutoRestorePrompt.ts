import { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { STORAGE_KEY_RECOVERY_RESTORE_AUTO_TRIGGERED } from '@/const/storageKeys';
import {
  autoRestorePromptedAtom,
  autoRestoreTriggerAtom,
  settingsOpenAtom,
  settingsPageAtom,
  pendingCryptoPromptAtom,
  recoveryKeyBadgeAtom,
  restoreBannerVisibleAtom,
} from '@/app/store/atoms';

export function useAutoRestorePrompt(client: MatrixClient | null, syncReady: boolean) {
  const [prompted, setPrompted] = useAtom(autoRestorePromptedAtom);
  const [pendingPrompt, setPendingCryptoPrompt] = useAtom(pendingCryptoPromptAtom);
  const setBadge = useSetAtom(recoveryKeyBadgeAtom);
  const setRestoreTrigger = useSetAtom(autoRestoreTriggerAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsPage = useSetAtom(settingsPageAtom);
  const setRestoreBanner = useSetAtom(restoreBannerVisibleAtom);

  useEffect(() => {
    if (!client || !syncReady || prompted || pendingPrompt !== 'restore') return;

    setBadge('restore');
    setPrompted(true);
    setPendingCryptoPrompt(null);

    const alreadyTriggered = localStorage.getItem(STORAGE_KEY_RECOVERY_RESTORE_AUTO_TRIGGERED);
    if (alreadyTriggered) {
      setRestoreBanner(true);
    } else {
      localStorage.setItem(STORAGE_KEY_RECOVERY_RESTORE_AUTO_TRIGGERED, 'true');
      setRestoreTrigger(true);
      setSettingsPage('keybackup');
      setSettingsOpen(true);
    }
  }, [
    client,
    syncReady,
    prompted,
    pendingPrompt,
    setPrompted,
    setPendingCryptoPrompt,
    setBadge,
    setRestoreTrigger,
    setSettingsOpen,
    setSettingsPage,
    setRestoreBanner,
  ]);
}
