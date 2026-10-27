import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { onQrImportFailed } from '@/client/qrLoginSecrets';
import { useToast } from '@/app/hooks/useToast';

/**
 * Signing in with a QR code shares the account's cross-signing keys with the new session in the
 * background. If that fails the person is signed in but unverified, so say so instead of leaving it
 * to the console.
 */
export function useQrImportNotice(): void {
  const { t } = useTranslation();
  const toast = useToast();

  useEffect(
    () => onQrImportFailed(() => toast.warning(t('qrLogin.secretsFailed'), { duration: 12000 })),
    [t, toast]
  );
}
