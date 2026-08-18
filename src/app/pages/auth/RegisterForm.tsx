import { useState, useEffect, useCallback } from 'react';
import { CheckIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { createClient } from 'matrix-js-sdk';
import { login, normalizeUrl } from '@/client/initMatrix';
import { useSetAtom } from 'jotai';
import { vars } from '@/theme/vars.css';
import { credentialsAtom } from '@/app/store/atoms';
import { getErrorMessage, MatrixErrorCode } from '@/util/error';
import {
  discoverSSOCapabilities,
  redirectToSso,
  type IdentityProvider,
} from '@/app/features/sso/sso';
import { PRESET_SERVERS } from '@/app/features/sso/presetServers';
import { SpinnerOverlay } from '@/app/components/Spinner';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import * as css from './WelcomePage.css';

interface PasswordValidity {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

function checkPassword(p: string): PasswordValidity {
  return {
    length: p.length >= 8,
    uppercase: /[A-Z]/.test(p),
    lowercase: /[a-z]/.test(p),
    number: /[0-9]/.test(p),
    special: /[^A-Za-z0-9]/.test(p),
  };
}

interface Props {
  onSuccess: () => void;
  onShowLogin: () => void;
  serverSelect: string;
  customUrl: string;
  onServerSelect: (value: string) => void;
  onCustomUrlChange: (value: string) => void;
}

export function RegisterForm({
  onSuccess,
  onShowLogin,
  serverSelect,
  customUrl,
  onServerSelect,
  onCustomUrlChange,
}: Props) {
  const { t } = useTranslation();
  const setCredentials = useSetAtom(credentialsAtom);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);
  const [idps, setIdps] = useState<IdentityProvider[]>([]);
  const [hasSso, setHasSso] = useState(false);
  const [pwdValidity, setPwdValidity] = useState(() => checkPassword(''));

  const rawServerUrl = serverSelect === 'custom' ? customUrl : serverSelect;
  const serverUrl = normalizeUrl(rawServerUrl);

  const discoverSso = useCallback(async (url: string) => {
    if (!url) return;
    try {
      const caps = await discoverSSOCapabilities(url);
      setHasSso(caps.hasSSORegister);
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
        // Server returned credentials directly — resume the client without a
        // separate login round-trip.
        const credentials = {
          userId: result.user_id,
          accessToken: result.access_token,
          deviceId: result.device_id,
          homeserverUrl: serverUrl,
        };
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

  const handleSso = (idpId?: string) => redirectToSso(serverUrl, idpId);

  return (
    <div className={css.formSection}>
      <h2 className={css.formTitle}>{t('welcome.register')}</h2>

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
            onBlur={() => discoverSso(serverUrl)}
          />
        )}
      </div>

      {!hasSso && (
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
            onChange={(e) => {
              setPassword(e.target.value);
              setPwdValidity(checkPassword(e.target.value));
            }}
            autoComplete="new-password"
          />
          <Input
            type="password"
            placeholder={t('welcome.confirmPassword')}
            aria-label={t('welcome.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
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

          <Button fullWidth size="lg" variant="primary" onClick={handleRegister} disabled={loading}>
            {loading ? t('welcome.registering') : t('welcome.registerSubmit')}
          </Button>
        </>
      )}

      {hasSso && (
        <>
          <Button fullWidth size="lg" variant="secondary" onClick={() => handleSso()}>
            {t('welcome.ssoLogin')}
          </Button>
          {idps.map((idp) => (
            <Button key={idp.id} fullWidth variant="secondary" onClick={() => handleSso(idp.id)}>
              {idp.icon && <img src={idp.icon} alt={idp.name} className={css.idpIcon} />}
              {idp.name}
            </Button>
          ))}
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
