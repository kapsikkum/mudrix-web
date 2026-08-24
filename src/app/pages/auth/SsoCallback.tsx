import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { credentialsAtom } from '@/app/store/atoms';
import {
  requestPersistentStorage,
  persistCredentials,
  resetClientForNewSession,
} from '@/client/initMatrix';
import { vars } from '@/theme/vars.css';
import {
  exchangeLoginToken,
  readPendingSsoFlow,
  clearPendingSsoFlow,
} from '@/app/features/sso/sso';
import { AppLoading } from '@/app/components/AppLoading';
import type { MatrixCredentials } from '@/client/types';

let inFlightToken: string | null = null;

export function SsoCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setCredentials = useSetAtom(credentialsAtom);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginToken = params.get('loginToken');
    const state = params.get('state');

    if (loginToken && loginToken === inFlightToken) {
      return;
    }

    const pending = readPendingSsoFlow();

    if (!loginToken || !state || !pending || pending.state !== state) {
      clearPendingSsoFlow();
      setError(t('welcome.ssoLoginFailed'));
      return;
    }

    inFlightToken = loginToken;

    const deviceName = navigator.userAgent.includes('Mobile')
      ? 'WizardChat Mobile'
      : 'WizardChat Web';

    (async () => {
      try {
        const result = await exchangeLoginToken(loginToken, pending.homeserverUrl, deviceName);
        await resetClientForNewSession(result.userId);

        const creds: MatrixCredentials = {
          userId: result.userId,
          accessToken: result.accessToken,
          homeserverUrl: pending.homeserverUrl,
          deviceId: result.deviceId,
          refreshToken: result.refreshToken,
          expiresInMs: result.expiresInMs,
        };

        persistCredentials(creds);
        setCredentials(creds);
        requestPersistentStorage();
        navigate('/', { replace: true });
      } catch (err) {
        console.error('[SsoCallback]', err);
        setError(err instanceof Error ? err.message : t('welcome.ssoLoginFailed'));
      } finally {
        clearPendingSsoFlow();
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('loginToken');
        cleanUrl.searchParams.delete('state');
        window.history.replaceState({}, '', cleanUrl.toString());
        inFlightToken = null;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: vars.color.error }}>
        <h2>{t('welcome.ssoError')}</h2>
        <p>{error}</p>
        <button type="button" onClick={() => navigate('/welcome', { replace: true })}>
          {t('welcome.backToLogin')}
        </button>
      </div>
    );
  }

  return <AppLoading />;
}
