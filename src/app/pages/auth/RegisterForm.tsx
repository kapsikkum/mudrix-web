import { useState } from 'react';
import { CheckIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { createClient } from 'matrix-js-sdk';
import {
  login,
  resetClientForNewSession,
  persistCredentials,
  requestPersistentStorage,
} from '@/client/initMatrix';
import { useSetAtom } from 'jotai';
import { vars } from '@/theme/vars.css';
import { credentialsAtom } from '@/app/store/atoms';
import { getErrorMessage, MatrixErrorCode } from '@/util/error';
import { checkPassword, type PasswordValidity } from '@/util/password';
import {
  redirectToSso,
  resolveIdpIconUrl,
  RegisterStatus,
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
import type { MatrixCredentials } from '@/client/types';
import { ServerStatus } from './ServerStatus';
import * as css from './WelcomePage.css';

interface Props {
  onSuccess: () => void;
  onShowLogin: () => void;
  serverSelect: string;
  customUrl: string;
  onServerSelect: (value: string) => void;
  onCustomUrlChange: (value: string) => void;
  serverUrl: string;
  capabilities: AuthCapabilities | null;
  capabilitiesLoading: boolean;
  onRetryDiscovery: () => void;
}

export function RegisterForm({
  onSuccess,
  onShowLogin,
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);
  const [pwdValidity, setPwdValidity] = useState(() => checkPassword(''));

  const oidcMetadata = capabilities?.delegatedAuth ? capabilities.authMetadata : undefined;
  const ssoFlow = capabilities?.ssoFlow;
  const ssoBlocked = isTauriMobile();
  const hasSso = !oidcMetadata && Boolean(ssoFlow) && (capabilities?.hasTokenLogin ?? false);
  const idps = ssoFlow?.identity_providers ?? [];

  const registerStatus = capabilities?.registerStatus;
  const hasPasswordRegister = !oidcMetadata && registerStatus === RegisterStatus.Available;
  const isRateLimited = !oidcMetadata && registerStatus === RegisterStatus.RateLimited;
  const discoveryStatus = capabilities?.discoveryStatus;
  const serverUnreachable = discoveryStatus === DiscoveryStatus.Unreachable;
  const wellKnownInvalid = discoveryStatus === DiscoveryStatus.WellKnownInvalid;
  const isChecking = capabilitiesLoading && !capabilities;

  const handleRegister = async () => {
    if (!username || !password || !confirmPassword) {
      setStatus(t('welcome.fillAllFields'));
      setStatusType('error');
      return;
    }
    if (password !== confirmPassword) {
      setStatus(t('welcome.passwordMismatch'));
      setStatusType('error');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const client = createClient({ baseUrl: serverUrl });

      type UiaError = Error & {
        data?: {
          flows?: Array<{ stages?: string[]; type?: string }>;
          session?: string;
          errcode?: string;
          error?: string;
        };
      };

      // Step 1: probe for available auth flows (no auth field = valid per Matrix spec)
      let session: string | null = null;
      try {
        await client.registerRequest({ username, password, refresh_token: true });
      } catch (uiaErr) {
        const err = uiaErr as UiaError;
        const errData = err.data ?? {};
        const flowList = errData.flows;
        session = errData.session ?? null;

        if (!Array.isArray(flowList) || flowList.length === 0) throw uiaErr;

        const dummyOnlyFlow = flowList.find((f) => {
          const stages = Array.isArray(f.stages) ? f.stages : f.type ? [f.type] : [];
          return stages.length === 1 && stages[0] === 'm.login.dummy';
        });

        if (!dummyOnlyFlow) {
          const names = flowList
            .map((f) => (f.stages ?? (f.type ? [f.type] : [])).join(' -> '))
            .join(', ');
          throw new Error(t('welcome.additionalVerification', { names: names || 'unknown' }));
        }
      }

      // Step 2: complete registration with m.login.dummy
      const result = await client.register(username, password, session, {
        type: 'm.login.dummy',
      });

      if (result.access_token && result.user_id && result.device_id) {
        await resetClientForNewSession(result.user_id);
        const credentials: MatrixCredentials = {
          userId: result.user_id,
          accessToken: result.access_token,
          deviceId: result.device_id,
          homeserverUrl: serverUrl,
          refreshToken: result.refresh_token,
          expiresInMs: result.expires_in_ms,
        };
        persistCredentials(credentials);
        requestPersistentStorage();
        setCredentials(credentials);
        onSuccess();
      } else {
        // Server withheld credentials (inhibit_login or non-standard config)
        // fall back to an explicit login call.
        const { credentials } = await login(username, password, serverUrl);
        setCredentials(credentials);
        onSuccess();
      }
    } catch (err) {
      const uiaErr = err as { data?: { errcode?: string; error?: string } } & Error;
      const errcode = uiaErr.data?.errcode;
      if (errcode === MatrixErrorCode.USER_IN_USE) {
        setStatus(t('welcome.usernameTaken'));
      } else if (errcode === MatrixErrorCode.INVALID_USERNAME) {
        setStatus(t('welcome.invalidUsername'));
      } else if (errcode === MatrixErrorCode.EXCLUSIVE) {
        setStatus(t('welcome.usernameReserved'));
      } else if (uiaErr.data?.error) {
        setStatus(t('welcome.registrationFailed', { error: uiaErr.data.error }));
      } else {
        setStatus(t('welcome.registrationFailed', { error: getErrorMessage(err) }));
      }
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSso = (idpId?: string) => redirectToSso(serverUrl, SSOAction.REGISTER, idpId);

  const handleOidc = async () => {
    if (!oidcMetadata) return;
    setLoading(true);
    setStatus('');
    try {
      await startOidcLogin(serverUrl, oidcMetadata, 'register');
    } catch (err) {
      setStatus(t('welcome.registrationFailed', { error: getErrorMessage(err) }));
      setStatusType('error');
      setLoading(false);
    }
  };

  return (
    <div className={css.formSection}>
      <h2 className={css.formTitle}>{t('welcome.register')}</h2>

      <div className={css.serverGroup}>
        <Select
          aria-label={t('welcome.customServer')}
          value={serverSelect}
          options={[...PRESET_SERVERS, { value: 'custom', label: t('welcome.customServer') }]}
          onChange={onServerSelect}
        />
        {serverSelect === 'custom' && (
          <Input
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            type="text"
            placeholder={t('welcome.serverUrl')}
            aria-label={t('welcome.serverUrl')}
            value={customUrl}
            onChange={(e) => onCustomUrlChange(e.target.value)}
            onBlur={onRetryDiscovery}
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
            <Button fullWidth size="lg" variant="primary" onClick={handleOidc} disabled={loading}>
              {loading ? t('welcome.redirecting') : t('welcome.oidcRegister')}
            </Button>
          )}

          {hasPasswordRegister && (
            <>
              <Input
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                type="text"
                placeholder={t('welcome.username')}
                aria-label={t('welcome.username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
              <Input
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                type="password"
                placeholder={t('welcome.password')}
                aria-label={t('welcome.password')}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPwdValidity(checkPassword(e.target.value));
                }}
                autoComplete="new-password"
                showPasswordToggle
              />
              <Input
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                type="password"
                placeholder={t('welcome.confirmPassword')}
                aria-label={t('welcome.confirmPassword')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                showPasswordToggle
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              />

              <div className={css.passwordReqs}>
                <p>{t('welcome.passwordRequirements.title')}</p>
                <ul>
                  {(
                    [
                      ['length', t('welcome.passwordRequirements.length')],
                      ['uppercase', t('welcome.passwordRequirements.uppercase')],
                      ['lowercase', t('welcome.passwordRequirements.lowercase')],
                      ['number', t('welcome.passwordRequirements.number')],
                      ['special', t('welcome.passwordRequirements.special')],
                    ] as [keyof PasswordValidity, string][]
                  ).map(([key, label]) => {
                    const met = pwdValidity[key];
                    return (
                      <li key={key} className={css.reqItem}>
                        {met ? (
                          <CheckIcon size={14} weight="bold" color={vars.color.success} />
                        ) : (
                          <XIcon size={14} weight="bold" color={vars.color.error} />
                        )}
                        {label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <Button
                fullWidth
                size="lg"
                variant="primary"
                onClick={handleRegister}
                disabled={loading}
              >
                {loading ? t('welcome.registering') : t('welcome.registerSubmit')}
              </Button>
            </>
          )}

          {hasSso && !ssoBlocked && (
            <>
              {hasPasswordRegister && <div className={css.divider}>{t('common.or')}</div>}
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

          {isRateLimited && (
            <p className={css.statusText}>{t('welcome.registrationRateLimited')}</p>
          )}

          {!capabilitiesLoading &&
            !hasPasswordRegister &&
            !hasSso &&
            !isRateLimited &&
            !oidcMetadata && (
              <p className={css.statusText}>
                {serverUnreachable && t('welcome.serverUnreachable')}
                {wellKnownInvalid && t('welcome.notMatrixServer')}
                {!serverUnreachable && !wellKnownInvalid && t('welcome.registrationUnavailable')}
              </p>
            )}
        </>
      )}

      {status && (
        <p className={statusType === 'success' ? css.statusSuccess : css.statusText}>{status}</p>
      )}

      <p className={css.switchText}>
        {t('welcome.haveAccount')}{' '}
        <button type="button" className={css.switchLink} onClick={onShowLogin}>
          {t('welcome.login')}
        </button>
      </p>

      {loading && <SpinnerOverlay />}
    </div>
  );
}
