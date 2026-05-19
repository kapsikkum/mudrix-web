import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createClient } from 'matrix-js-sdk';
import { login, resume } from '@/client/initMatrix';
import { useSetAtom } from 'jotai';
import {
  credentialsAtom,
  userIdAtom,
  clientReadyAtom,
  serverUploadLimitAtom,
} from '@/app/store/atoms';
import { getErrorMessage, MatrixErrorCode } from '@/util/error';
import { fetchServerUploadLimit } from '@/util/serverCapabilities';
import {
  discoverSSOCapabilities,
  getSSORegisterUrl,
  type IdentityProvider,
} from '@/app/features/sso/sso';
import { SpinnerOverlay } from '@/app/components/Spinner';
import * as css from './WelcomePage.css';

const PRESET_SERVERS = [{ label: 'matrix.org', value: 'https://matrix.org' }];

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
}

export function RegisterForm({ onSuccess, onShowLogin }: Props) {
  const { t } = useTranslation();
  const setCredentials = useSetAtom(credentialsAtom);
  const setUserId = useSetAtom(userIdAtom);
  const setClientReady = useSetAtom(clientReadyAtom);
  const setServerUploadLimit = useSetAtom(serverUploadLimitAtom);

  const [serverSelect, setServerSelect] = useState(PRESET_SERVERS[0].value);
  const [customUrl, setCustomUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);
  const [idps, setIdps] = useState<IdentityProvider[]>([]);
  const [hasSso, setHasSso] = useState(false);
  const [pwdValidity, setPwdValidity] = useState<PasswordValidity>(checkPassword(''));

  const serverUrl = serverSelect === 'custom' ? customUrl : serverSelect;

  const discoverSso = useCallback(async (url: string) => {
    if (!url) return;
    try {
      const caps = await discoverSSOCapabilities(url);
      setHasSso(caps.hasSSORegister);
      setIdps(caps.identityProviders);
    } catch {
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
            .map((f) => (f.stages ?? (f.type ? [f.type] : [])).join(' → '))
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
        const resumedClient = await resume(credentials);
        setCredentials(credentials);
        setUserId(result.user_id);
        setServerUploadLimit(await fetchServerUploadLimit(resumedClient));
        setClientReady(true);
        onSuccess();
      } else {
        // Server withheld credentials (inhibit_login or non-standard config)
        // fall back to an explicit login call.
        const { client: c, credentials } = await login(username, password, serverUrl);
        setCredentials(credentials);
        setUserId(c.getUserId() ?? null);
        setServerUploadLimit(await fetchServerUploadLimit(c));
        setClientReady(true);
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
        setStatus(`Registration failed: ${uiaErr.data.error}`);
      } else {
        setStatus(`Registration failed: ${getErrorMessage(err)}`);
      }
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSso = (idpId?: string) => {
    const redirectUrl = `${window.location.origin}/sso/callback?homeserver=${encodeURIComponent(serverUrl)}`;
    sessionStorage.setItem('sso_redirect_pending', 'true');
    sessionStorage.setItem('sso_homeserver', serverUrl);
    window.location.href = getSSORegisterUrl(serverUrl, redirectUrl, idpId);
  };

  return (
    <div className={css.formSection}>
      <h2 className={css.formTitle}>{t('welcome.register')}</h2>

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
          />
        )}
      </div>

      {!hasSso && (
        <>
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
            onChange={(e) => {
              setPassword(e.target.value);
              setPwdValidity(checkPassword(e.target.value));
            }}
            autoComplete="new-password"
          />
          <input
            className={css.input}
            type="password"
            placeholder={t('welcome.confirmPassword')}
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
              ).map(([key, label]) => (
                <li key={key} className={pwdValidity[key] ? css.reqItemMet : css.reqItem}>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <button className={css.button} onClick={handleRegister} disabled={loading}>
            {loading ? t('welcome.registering') : t('welcome.registerSubmit')}
          </button>
        </>
      )}

      {hasSso && (
        <>
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

      {status && (
        <p className={statusType === 'success' ? css.statusSuccess : css.statusText}>{status}</p>
      )}

      <p className={css.switchText}>
        {t('welcome.haveAccount')}{' '}
        <span className={css.switchLink} onClick={onShowLogin}>
          {t('welcome.login')}
        </span>
      </p>

      {loading && <SpinnerOverlay />}
    </div>
  );
}
