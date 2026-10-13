import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { credentialsAtom } from '@/app/store/atoms';
import {
  persistCredentials,
  requestPersistentStorage,
  resetClientForNewSession,
} from '@/client/initMatrix';
import { vars } from '@/theme/vars.css';
import { clearPendingOidcFlow, completeOidcLogin } from '@/app/features/oidc/oidc';
import { AppLoading } from '@/app/components/AppLoading';

let inFlightCode: string | null = null;

function readCallbackParams(): URLSearchParams {
  const params = new URLSearchParams(window.location.search);
  if (!params.get('code') && !params.get('error') && window.location.hash.length > 1) {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    hashParams.forEach((value, key) => params.set(key, value));
  }
  return params;
}

function cleanUrl(): void {
  const clean = new URL(window.location.href);
  ['code', 'state', 'error', 'error_description', 'session_state'].forEach((key) => {
    clean.searchParams.delete(key);
  });
  clean.hash = '';
  window.history.replaceState({}, '', clean.toString());
}

export function OidcCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setCredentials = useSetAtom(credentialsAtom);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = readCallbackParams();
    const code = params.get('code');
    const state = params.get('state');

    if (code && code === inFlightCode) return;
    inFlightCode = code;

    const opError = params.get('error');
    if (opError) {
      setError(params.get('error_description') ?? opError);
      clearPendingOidcFlow();
      cleanUrl();
      inFlightCode = null;
      return;
    }

    if (!code || !state) {
      setError(t('welcome.oidcLoginFailed'));
      clearPendingOidcFlow();
      cleanUrl();
      inFlightCode = null;
      return;
    }

    (async () => {
      try {
        const credentials = await completeOidcLogin({ code, state });
        await resetClientForNewSession(credentials.userId);
        persistCredentials(credentials);
        setCredentials(credentials);
        requestPersistentStorage();
        navigate('/', { replace: true });
      } catch (err) {
        console.error('[OidcCallback]', err);
        setError(err instanceof Error ? err.message : t('welcome.oidcLoginFailed'));
      } finally {
        clearPendingOidcFlow();
        cleanUrl();
        inFlightCode = null;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: vars.color.error }}>
        <h2>{t('welcome.oidcError')}</h2>
        <p>{error}</p>
        <button type="button" onClick={() => navigate('/welcome', { replace: true })}>
          {t('welcome.backToLogin')}
        </button>
      </div>
    );
  }

  return <AppLoading />;
}
