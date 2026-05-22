import { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  autoSetupPromptedAtom,
  setupRecoveryKeyModalOpenAtom,
  pendingCryptoPromptAtom,
} from '@/app/store/atoms';

export function useAutoSetupPrompt(client: MatrixClient | null, syncReady: boolean) {
  const [prompted, setPrompted] = useAtom(autoSetupPromptedAtom);
  const [pendingPrompt, setPendingCryptoPrompt] = useAtom(pendingCryptoPromptAtom);
  const setModalOpen = useSetAtom(setupRecoveryKeyModalOpenAtom);

  useEffect(() => {
    if (!client || !syncReady || prompted || pendingPrompt !== 'setup') return;

    setPendingCryptoPrompt(null);
    setPrompted(true);
    setModalOpen(true);
  }, [
    client,
    syncReady,
    prompted,
    pendingPrompt,
    setPrompted,
    setPendingCryptoPrompt,
    setModalOpen,
  ]);
}
