import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from './useConfirm';

/**
 * For the desktop and phone apps, where the SSO re-authentication page opens in the system browser:
 * asks the person to say when they have finished there. Pass the result as `confirmDone` to
 * `waitForSsoFallback`.
 */
export function useSsoBrowserDone(): () => Promise<boolean> {
  const { t } = useTranslation();
  const confirm = useConfirm();
  return useCallback(
    () =>
      confirm({
        title: t('settings.sessions.ssoBrowserTitle'),
        message: t('settings.sessions.ssoBrowserMessage'),
        confirmLabel: t('settings.sessions.ssoBrowserDone'),
      }),
    [confirm, t]
  );
}
