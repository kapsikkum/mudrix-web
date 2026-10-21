import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { LogoLoader } from '@/app/components/AppLoading/LogoLoader';
import { Button } from '@/app/components/Button';
import { getActiveAccountId } from '@/client/accounts';
import { STORAGE_KEY_ACTIVE_ACCOUNT } from '@/const/storageKeys';
import * as css from './AccountSwitchGuard.css';
import { publicUrl } from '@/util/publicUrl';

const RELOAD_DELAY_MS = 3000;

function localpart(userId: string): string {
  return userId.replace(/^@/, '').split(':')[0];
}

interface Props {
  client: MatrixClient | null;
}

export function AccountSwitchGuard({ client }: Props) {
  const { t } = useTranslation();
  const [conflictId, setConflictId] = useState<string | null | undefined>(() => {
    if (!client) return undefined;
    const myId = client.getUserId();
    if (!myId) return undefined;
    const activeId = getActiveAccountId();
    return activeId === myId ? undefined : activeId;
  });

  useEffect(() => {
    if (!client) return;
    const myId = client.getUserId();
    if (!myId) return;

    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY_ACTIVE_ACCOUNT) return;
      if (e.newValue === myId) return;
      setConflictId(e.newValue);
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [client]);

  const hasConflict = conflictId !== undefined;

  useEffect(() => {
    if (!hasConflict) return;
    if (client) {
      try {
        client.stopClient();
      } catch {
        // ignore
      }
    }
    const timer = setTimeout(() => {
      window.location.href = publicUrl('');
    }, RELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasConflict, client]);

  if (!hasConflict) return null;

  const accountLabel = conflictId ? localpart(conflictId) : null;

  return (
    <div className={css.overlay} role="alertdialog" aria-modal="true">
      <LogoLoader />
      <div className={css.box}>
        <h2 className={css.heading}>
          {accountLabel ? t('auth.accountSwitchedTitle') : t('auth.signedOutElsewhereTitle')}
        </h2>
        <p className={css.message}>
          {accountLabel
            ? t('auth.accountSwitchedMessage', { account: accountLabel })
            : t('auth.signedOutElsewhereMessage')}
        </p>
        <Button variant="primary" onClick={() => (window.location.href = publicUrl(''))}>
          {t('auth.reloadNow')}
        </Button>
      </div>
    </div>
  );
}
