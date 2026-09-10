import { useState } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { credentialsAtom } from '@/app/store/atoms';
import { login } from '@/client/initMatrix';
import { getErrorMessage } from '@/util/error';
import {
  redirectToSso,
  resolveIdpIconUrl,
  DiscoveryStatus,
  SSOAction,
  type AuthCapabilities,
} from '@/app/features/sso/sso';
import { PRESET_SERVERS } from '@/app/features/sso/presetServers';
import { SpinnerOverlay } from '@/app/components/Spinner';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import * as css from './WelcomePage.css';

interface Props {
  onSuccess: () => void;
  onShowRegister: () => void;
  onShowReset: () => void;
  serverSelect: string;
  customUrl: string;
  onServerSelect: (value: string) => void;
  onCustomUrlChange: (value: string) => void;
  serverUrl: string;
  capabilities: AuthCapabilities | null;
  capabilitiesLoading: boolean;
  onRetryDiscovery: () => void;
}

export function LoginForm({
  onSuccess,
  onShowRegister,
  onShowReset,
  serverSelect,
  customUrl,
  onServerSelect,
  onCustomUrlChange,
  serverUrl,
  capabilities,
  capabilitiesLoading,
  onRetryDiscovery,
}: Props) {
  const { t } = useTranslation();
  const setCredentials = useSetAtom(credentialsAtom);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const hasPassword =
    !capabilities ||
    capabilities.discoveryStatus !== DiscoveryStatus.Ok ||
    capabilities.hasPasswordLogin;
  const ssoFlow = capabilities?.ssoFlow;
  const hasSso = Boolean(ssoFlow) && (capabilities?.hasTokenLogin ?? false);
  const idps = ssoFlow?.identity_providers ?? [];

  const rawServerUrl = serverSelect === 'custom' ? customUrl : serverSelect;

  const handleLogin = async () => {
    if (!username || !password) {
      setStatus(t('welcome.fillAllFields'));
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const { credentials } = await login(username, password, serverUrl, rawServerUrl);
      setCredentials(credentials);
      onSuccess();
    } catch (err) {
      setStatus(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSso = (idpId?: string) => redirectToSso(serverUrl, SSOAction.LOGIN, idpId);

  const handleForgotPassword = () => {
    if (capabilities?.delegatedAuth && capabilities.accountManagementUri) {
      window.open(capabilities.accountManagementUri, '_blank', 'noopener');
    } else {
      onShowReset();
    }
  };

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
          <Input
            type="text"
            placeholder={t('welcome.serverUrl')}
            aria-label={t('welcome.serverUrl')}
            value={customUrl}
            onChange={(e) => onCustomUrlChange(e.target.value)}
            onBlur={onRetryDiscovery}
          />
        )}
      </div>

      {hasPassword && (
        <>
          <Input
            type="text"
            placeholder={t('welcome.username')}
            aria-label={t('welcome.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <Input
            type="password"
            placeholder={t('welcome.password')}
            aria-label={t('welcome.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            showPasswordToggle
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />

          <p className={css.switchText}>
            <button type="button" className={css.switchLink} onClick={handleForgotPassword}>
              {t('welcome.forgotPassword')}
            </button>
          </p>

          <Button fullWidth size="lg" variant="primary" onClick={handleLogin} disabled={loading}>
            {loading ? t('welcome.loggingIn') : t('welcome.login')}
          </Button>
        </>
      )}

      {hasSso && (
        <>
          {hasPassword && <div className={css.divider}>{t('common.or')}</div>}
          {idps.length === 0 ? (
            <Button fullWidth size="lg" variant="secondary" onClick={() => handleSso()}>
              {t('welcome.ssoLogin')}
            </Button>
          ) : (
            idps.map((idp) => {
              const iconUrl = resolveIdpIconUrl(serverUrl, idp.icon);
              return (
                <Button
                  key={idp.id}
                  fullWidth
                  variant="secondary"
                  onClick={() => handleSso(idp.id)}
                >
                  {iconUrl && <img src={iconUrl} alt="" className={css.idpIcon} />}
                  {t('welcome.continueWithIdp', { name: idp.name })}
                </Button>
              );
            })
          )}
        </>
      )}

      {!capabilitiesLoading && !hasPassword && !hasSso && (
        <p className={css.statusText}>{t('welcome.noLoginMethod')}</p>
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
