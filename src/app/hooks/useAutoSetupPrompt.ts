import { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  autoSetupPromptedAtom,
  pendingCryptoPromptAtom,
  recoveryKeyBadgeAtom,
  settingsOpenAtom,
  settingsPageAtom,
} from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';

export function useAutoSetupPrompt(client: MatrixClient | null, syncReady: boolean) {
  const { t } = useTranslation();
  const [prompted, setPrompted] = useAtom(autoSetupPromptedAtom);
  const [pendingPrompt, setPendingCryptoPrompt] = useAtom(pendingCryptoPromptAtom);
  const setBadge = useSetAtom(recoveryKeyBadgeAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsPage = useSetAtom(settingsPageAtom);
  const toast = useToast();

  useEffect(() => {
    if (!client || !syncReady || prompted || pendingPrompt !== 'setup') return;

    setBadge('setup');
    setPrompted(true);
    setPendingCryptoPrompt(null);

    toast.info(t('settings.keyBackup.setupAvailableToast'), {
      duration: 10_000,
      actionLabel: t('settings.keyBackup.openKeyBackupAction'),
      onClick: () => {
        setSettingsPage('sessions');
        setSettingsOpen(true);
      },
    });
  }, [
    client,
    syncReady,
    prompted,
    pendingPrompt,
    t,
    toast,
    setPrompted,
    setPendingCryptoPrompt,
    setBadge,
    setSettingsOpen,
    setSettingsPage,
  ]);
}
