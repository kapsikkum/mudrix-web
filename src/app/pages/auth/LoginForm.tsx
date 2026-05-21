import { useState, useEffect, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  credentialsAtom,
  userIdAtom,
  clientReadyAtom,
  serverUploadLimitAtom,
} from '@/app/store/atoms';
import { login } from '@/client/initMatrix';
import { getErrorMessage } from '@/util/error';
import { fetchServerUploadLimit } from '@/util/serverCapabilities';
import {
  discoverSSOCapabilities,
  getSSOLoginUrl,
  type IdentityProvider,
} from '@/app/features/sso/sso';
import { SpinnerOverlay } from '@/app/components/Spinner';
import * as css from './WelcomePage.css';

const PRESET_SERVERS = [{ label: 'matrix.org', value: 'https://matrix.org' }];

interface Props {
  onSuccess: () => void;
  onShowRegister: () => void;
  defaultServerUrl?: string;
}

export function LoginForm({ onSuccess, onShowRegister, defaultServerUrl }: Props) {
  const { t } = useTranslation();
  const setCredentials = useSetAtom(credentialsAtom);
  const setUserId = useSetAtom(userIdAtom);
  const setClientReady = useSetAtom(clientReadyAtom);
  const setServerUploadLimit = useSetAtom(serverUploadLimitAtom);

  const [serverSelect, setServerSelect] = useState(PRESET_SERVERS[0].value);
  const [customUrl, setCustomUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [idps, setIdps] = useState<IdentityProvider[]>([]);
  const [hasSso, setHasSso] = useState(false);

  const serverUrl = serverSelect === 'custom' ? customUrl : serverSelect;

  const discoverSso = useCallback(async (url: string) => {
    if (!url) return;
    try {
      const caps = await discoverSSOCapabilities(url);
      setHasSso(caps.hasSSOLogin);
      setIdps(caps.identityProviders);
    } catch {
      setHasSso(false);
      setIdps([]);
    }
  }, []);

  useEffect(() => {
    discoverSso(serverUrl);
  }, [serverUrl, discoverSso]);

  useEffect(() => {
    if (defaultServerUrl) {
      setServerSelect('custom');
      setCustomUrl(defaultServerUrl);
    }
  }, [defaultServerUrl]);

  const handleLogin = async () => {
    if (!username || !password) {
      setStatus(t('welcome.loginFailed') + ': ' + t('common.loading'));
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const { client, credentials } = await login(username, password, serverUrl);
      setCredentials(credentials);
      setUserId(client.getUserId() ?? null);
      setServerUploadLimit(await fetchServerUploadLimit(client));
      setClientReady(true);
      onSuccess();
    } catch (err) {
      setStatus(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSso = (idpId?: string) => {
    const redirectUrl = `${window.location.origin}/sso/callback?homeserver=${encodeURIComponent(serverUrl)}`;
    sessionStorage.setItem('sso_redirect_pending', 'true');
    sessionStorage.setItem('sso_homeserver', serverUrl);
    window.location.href = getSSOLoginUrl(serverUrl, redirectUrl, idpId);
  };

  return (
    <div className={css.formSection}>
      <h2 className={css.formTitle}>{t('welcome.login')}</h2>

      <div className={css.serverGroup}>
        <select
          className={css.select}
          value={serverSelect}
          onChange={(e) => setServerSelect(e.target.value)}
        >
          {PRESET_SERVERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
          <option value="custom">{t('welcome.customServer')}</option>
        </select>
        {serverSelect === 'custom' && (
          <input
            className={css.input}
            type="text"
            placeholder={t('welcome.serverUrl')}
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            onBlur={() => discoverSso(customUrl)}
          />
        )}
      </div>

      <input
        className={css.input}
        type="text"
        placeholder={t('welcome.username')}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
      />
      <input
        className={css.input}
        type="password"
        placeholder={t('welcome.password')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
      />

      <button className={css.button} onClick={handleLogin} disabled={loading}>
        {loading ? t('welcome.loggingIn') : t('welcome.login')}
      </button>

      {hasSso && (
        <>
          <div className={css.divider}>{t('common.or')}</div>
          <button className={css.buttonSecondary} onClick={() => handleSso()}>
            {t('welcome.ssoLogin')}
          </button>
          {idps.map((idp) => (
            <button key={idp.id} className={css.idpButton} onClick={() => handleSso(idp.id)}>
              {idp.icon && <img src={idp.icon} alt={idp.name} className={css.idpIcon} />}
              {idp.name}
            </button>
          ))}
        </>
      )}

      {status && <p className={css.statusText}>{status}</p>}

      <p className={css.switchText}>
        {t('welcome.noAccount')}{' '}
        <span className={css.switchLink} onClick={onShowRegister}>
          {t('welcome.register')}
        </span>
      </p>

      {loading && <SpinnerOverlay />}
    </div>
  );
}
