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
import { startOidcLogin } from '@/app/features/oidc/oidc';
import { isTauriMobile } from '@/util/desktop';
import { PRESET_SERVERS } from '@/app/features/sso/presetServers';
import { SpinnerOverlay, Spinner } from '@/app/components/Spinner';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { Select } from '@/app/components/Select';
import { ServerStatus } from './ServerStatus';
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
  const [oidcLoading, setOidcLoading] = useState(false);

  const oidcMetadata = capabilities?.delegatedAuth ? capabilities.authMetadata : undefined;
  // A server can offer OIDC and password login together (e.g. Continuwuity); password stays
  // available so a failed OIDC client registration never locks anyone out.
  const advertisesPassword =
    !capabilities ||
    capabilities.discoveryStatus !== DiscoveryStatus.Ok ||
    capabilities.hasPasswordLogin;
  const ssoFlow = capabilities?.ssoFlow;
  const ssoBlocked = isTauriMobile();
  const hasSso = !oidcMetadata && Boolean(ssoFlow) && (capabilities?.hasTokenLogin ?? false);
  // When discovery turns up no usable method (e.g. the OIDC metadata failed to load) fall back to
  // the plain login form instead of a dead end; the server still has the final say.
  const hasPassword = advertisesPassword || (!oidcMetadata && !hasSso);
  const idps = ssoFlow?.identity_providers ?? [];
  const isChecking = capabilitiesLoading && !capabilities;
  // Something answered, but it is not a Matrix homeserver: no point trying to log in.
  const notAServer = !!capabilities && capabilities.discoveryStatus !== DiscoveryStatus.Ok;

  const handleLogin = async () => {
    if (notAServer) return;
    if (!username || !password) {
      setStatus(t('welcome.fillAllFields'));
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const { credentials } = await login(username, password, serverUrl);
      setCredentials(credentials);
      onSuccess();
    } catch (err) {
      setStatus(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSso = (idpId?: string) => redirectToSso(serverUrl, SSOAction.LOGIN, idpId);

  const handleOidc = async () => {
    if (!oidcMetadata) return;
    setOidcLoading(true);
    setStatus('');
    try {
      await startOidcLogin(serverUrl, oidcMetadata, 'login');
    } catch (err) {
      setStatus(getErrorMessage(err));
      setOidcLoading(false);
    }
  };

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
        <Select
          aria-label={t('welcome.customServer')}
          value={serverSelect}
          options={[...PRESET_SERVERS, { value: 'custom', label: t('welcome.customServer') }]}
          onChange={onServerSelect}
        />
        {serverSelect === 'custom' && (
          <Input
            type="text"
            placeholder={t('welcome.serverUrl')}
            aria-label={t('welcome.serverUrl')}
            value={customUrl}
            onChange={(e) => onCustomUrlChange(e.target.value)}
            onBlur={onRetryDiscovery}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
        <ServerStatus capabilities={capabilities} checking={isChecking} />
      </div>

      {isChecking ? (
        <div className={css.checkingServer}>
          <Spinner size="sm" />
          <span>{t('welcome.checkingServer')}</span>
        </div>
      ) : (
        <>
          {ssoBlocked && (oidcMetadata || hasSso) && (
            <p className={css.statusText}>{t('welcome.ssoUnavailableMobile')}</p>
          )}

          {oidcMetadata && !ssoBlocked && (
            <Button
              fullWidth
              size="lg"
              variant="primary"
              onClick={handleOidc}
              disabled={oidcLoading}
            >
              {oidcLoading ? t('welcome.redirecting') : t('welcome.oidcLogin')}
            </Button>
          )}

          {oidcMetadata && hasPassword && <div className={css.divider}>{t('common.or')}</div>}

          {hasPassword && (
            <>
              <Input
                type="text"
                placeholder={t('welcome.username')}
                aria-label={t('welcome.username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <Input
                type="password"
                placeholder={t('welcome.password')}
                aria-label={t('welcome.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                showPasswordToggle
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />

              <p className={css.switchText}>
                <button type="button" className={css.switchLink} onClick={handleForgotPassword}>
                  {t('welcome.forgotPassword')}
                </button>
              </p>

              <Button
                fullWidth
                size="lg"
                variant="primary"
                onClick={handleLogin}
                disabled={loading || notAServer}
              >
                {loading ? t('welcome.loggingIn') : t('welcome.login')}
              </Button>
            </>
          )}

          {hasSso && !ssoBlocked && (
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
