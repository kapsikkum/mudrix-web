import { useState, useEffect, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  credentialsAtom,
  userIdAtom,
  clientReadyAtom,
  serverUploadLimitAtom,
} from '@/app/store/atoms';
import { login, normalizeUrl } from '@/client/initMatrix';
import { getErrorMessage } from '@/util/error';
import { fetchServerUploadLimit } from '@/util/serverCapabilities';
import {
  discoverSSOCapabilities,
  redirectToSso,
  type IdentityProvider,
} from '@/app/features/sso/sso';
import { PRESET_SERVERS } from '@/app/features/sso/presetServers';
import { SpinnerOverlay } from '@/app/components/Spinner';
import * as css from './WelcomePage.css';

interface Props {
  onSuccess: () => void;
  onShowRegister: () => void;
  serverSelect: string;
  customUrl: string;
  onServerSelect: (value: string) => void;
  onCustomUrlChange: (value: string) => void;
}

export function LoginForm({
  onSuccess,
  onShowRegister,
  serverSelect,
  customUrl,
  onServerSelect,
  onCustomUrlChange,
}: Props) {
  const { t } = useTranslation();
  const setCredentials = useSetAtom(credentialsAtom);
  const setUserId = useSetAtom(userIdAtom);
  const setClientReady = useSetAtom(clientReadyAtom);
  const setServerUploadLimit = useSetAtom(serverUploadLimitAtom);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [idps, setIdps] = useState<IdentityProvider[]>([]);
  const [hasSso, setHasSso] = useState(false);

  const rawServerUrl = serverSelect === 'custom' ? customUrl : serverSelect;
  const serverUrl = normalizeUrl(rawServerUrl);

  const discoverSso = useCallback(async (url: string) => {
    if (!url) return;
    try {
      const caps = await discoverSSOCapabilities(url);
      setHasSso(caps.hasSSOLogin);
      setIdps(caps.identityProviders);
    } catch (err) {
      console.warn('[SSO] discovery error', err);
      setHasSso(false);
      setIdps([]);
    }
  }, []);

  useEffect(() => {
    discoverSso(serverUrl);
  }, [serverUrl, discoverSso]);

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

  const handleSso = (idpId?: string) => redirectToSso(serverUrl, idpId);

  return (
    <div className={css.formSection}>
      <h2 className={css.formTitle}>{t('welcome.login')}</h2>

      <div className={css.serverGroup}>
        <select
          className={css.select}
          value={serverSelect}
          onChange={(e) => onServerSelect(e.target.value)}
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
            onChange={(e) => onCustomUrlChange(e.target.value)}
            onBlur={() => discoverSso(serverUrl)}
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

      <button type="button" className={css.button} onClick={handleLogin} disabled={loading}>
        {loading ? t('welcome.loggingIn') : t('welcome.login')}
      </button>

      {hasSso && (
        <>
          <div className={css.divider}>{t('common.or')}</div>
          <button type="button" className={css.buttonSecondary} onClick={() => handleSso()}>
            {t('welcome.ssoLogin')}
          </button>
          {idps.map((idp) => (
            <button
              type="button"
              key={idp.id}
              className={css.idpButton}
              onClick={() => handleSso(idp.id)}
            >
              {idp.icon && <img src={idp.icon} alt={idp.name} className={css.idpIcon} />}
              {idp.name}
            </button>
          ))}
        </>
      )}

      {status && <p className={css.statusText}>{status}</p>}

      <p className={css.switchText}>
        {t('welcome.noAccount')}{' '}
        <button type="button" className={css.switchLink} onClick={onShowRegister}>
          {t('welcome.register')}
        </button>
      </p>

      {loading && <SpinnerOverlay />}
    </div>
  );
}
