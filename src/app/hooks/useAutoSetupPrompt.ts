import { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { STORAGE_KEY_RECOVERY_SETUP_INIT_MODAL } from '@/const/storageKeys';
import {
  autoSetupPromptedAtom,
  pendingCryptoPromptAtom,
  recoveryKeyBadgeAtom,
  setupRecoveryKeyModalOpenAtom,
} from '@/app/store/atoms';

export function useAutoSetupPrompt(client: MatrixClient | null, syncReady: boolean) {
  const [prompted, setPrompted] = useAtom(autoSetupPromptedAtom);
  const [pendingPrompt, setPendingCryptoPrompt] = useAtom(pendingCryptoPromptAtom);
  const setBadge = useSetAtom(recoveryKeyBadgeAtom);
  const setSetupModal = useSetAtom(setupRecoveryKeyModalOpenAtom);

  useEffect(() => {
    if (!client || !syncReady || prompted || pendingPrompt !== 'setup') return;

    setBadge('setup');
    setPrompted(true);
    setPendingCryptoPrompt(null);

    if (!localStorage.getItem(STORAGE_KEY_RECOVERY_SETUP_INIT_MODAL)) {
      localStorage.setItem(STORAGE_KEY_RECOVERY_SETUP_INIT_MODAL, 'true');
      setSetupModal(true);
    }
  }, [
    client,
    syncReady,
    prompted,
    pendingPrompt,
    setPrompted,
    setPendingCryptoPrompt,
    setBadge,
    setSetupModal,
  ]);
}
