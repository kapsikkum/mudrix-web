import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import {
  credentialsAtom,
  userIdAtom,
  clientReadyAtom,
  serverUploadLimitAtom,
} from '@/app/store/atoms';
import { resume } from '@/client/initMatrix';
import { fetchServerUploadLimit } from '@/util/serverCapabilities';
import { STORAGE_KEY_CREDENTIALS } from '@/const/storageKeys';
import { vars } from '@/theme/vars.css';
import { exchangeLoginToken } from '@/app/features/sso/sso';
import { AppLoading } from '@/app/components/AppLoading';
import type { MatrixCredentials } from '@/client/types';

export function SsoCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setCredentials = useSetAtom(credentialsAtom);
  const setUserId = useSetAtom(userIdAtom);
  const setClientReady = useSetAtom(clientReadyAtom);
  const setServerUploadLimit = useSetAtom(serverUploadLimitAtom);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cancelledRef = { current: false };

    const params = new URLSearchParams(window.location.search);
    const loginToken = params.get('loginToken');
    const homeserverUrl = params.get('homeserver') ?? sessionStorage.getItem('sso_homeserver');

    const pending = sessionStorage.getItem('sso_redirect_pending');

    if (!loginToken || !homeserverUrl || pending !== 'true') {
      navigate('/welcome', { replace: true });
      return;
    }

    sessionStorage.removeItem('sso_redirect_pending');
    sessionStorage.removeItem('sso_homeserver');

    // Clean URL
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('loginToken');
    cleanUrl.searchParams.delete('homeserver');
    window.history.replaceState({}, '', cleanUrl.toString());

    const deviceId = `WIZARD_${Math.random().toString(36).substring(2, 10)}`;
    const deviceName = navigator.userAgent.includes('Mobile')
      ? 'WizardChat Mobile'
      : 'WizardChat Web';

    exchangeLoginToken(loginToken, homeserverUrl, deviceId, deviceName)
      .then(async (result) => {
        if (cancelledRef.current) return;
        const creds: MatrixCredentials = {
          userId: result.user_id,
          accessToken: result.access_token,
          homeserverUrl,
          deviceId: result.device_id ?? deviceId,
        };
        localStorage.setItem(STORAGE_KEY_CREDENTIALS, JSON.stringify(creds));

        const client = await resume(creds);
        if (cancelledRef.current) return;
        setCredentials(creds);
        setUserId(client.getUserId() ?? null);
        setServerUploadLimit(await fetchServerUploadLimit(client));
        setClientReady(true);
        navigate('/', { replace: true });
      })
      .catch((err) => {
        if (cancelledRef.current) return;
        console.error('[SsoCallback]', err);
        setError(err instanceof Error ? err.message : t('welcome.ssoLoginFailed'));
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [navigate, setCredentials, setUserId, setClientReady, setServerUploadLimit, t]);

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: vars.color.error }}>
        <h2>{t('welcome.ssoError')}</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/welcome', { replace: true })}>
          {t('welcome.backToLogin')}
        </button>
      </div>
    );
  }

  return <AppLoading />;
}
