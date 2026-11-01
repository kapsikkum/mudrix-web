import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createClient, type RegisterResponse } from 'matrix-js-sdk';
import { useSetAtom } from 'jotai';
import {
  login,
  resetClientForNewSession,
  persistCredentials,
  requestPersistentStorage,
} from '@/client/initMatrix';
import { credentialsAtom } from '@/app/store/atoms';
import { MatrixErrorCode } from '@/util/error';
import { passwordStrength } from '@/util/password';
import {
  redirectToSso,
  resolveIdpIconUrl,
  RegisterStatus,
  DiscoveryStatus,
  REGISTRATION_TOKEN_STAGES,
  SSOAction,
  type AuthCapabilities,
} from '@/app/features/sso/sso';
import { startOidcLogin } from '@/app/features/oidc/oidc';
import { isTauriMobile } from '@/util/desktop';
import { Button } from '@/app/components/Button';
import type { MatrixCredentials } from '@/client/types';
import { AuthField } from './AuthField';
import { ServerPicker } from './ServerPicker';
import type { ServerPickerState } from './LoginForm';
import { authErrorMessage, serverProblemMessage } from './authErrors';
import { rememberHomeserver, type Homeserver } from './useHomeserver';
import * as css from './WelcomePage.css';

interface Props {
  hs: Homeserver;
  picker: ServerPickerState;
  onSuccess: () => void;
  onShowLogin: () => void;
}

const LOCALPART_RE = /^[a-z0-9._=\-/+]+$/;
const USERNAME_CHECK_DELAY_MS = 500;

type UsernameState = 'idle' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid';

const MIN_PASSWORD_LENGTH = 8;
const STRENGTH_BARS = { weak: 1, okay: 2, strong: 3 } as const;
const STRENGTH_CLASS = {
  weak: css.strengthBarWeak,
  okay: css.strengthBarOkay,
  strong: css.strengthBarStrong,
} as const;

const DUMMY = 'm.login.dummy';
const DOABLE = new Set([DUMMY, ...REGISTRATION_TOKEN_STAGES]);

/** A registration flow this form can finish by itself; a dummy-only flow first. */
function pickFlow(flows: string[][] | undefined): string[] | null {
  if (!flows) return null;
  const doable = flows.filter((stages) => stages.every((s) => DOABLE.has(s)));
  return doable.find((s) => s.length === 1 && s[0] === DUMMY) ?? doable[0] ?? null;
}

type UiaError = Error & {
  httpStatus?: number;
  data?: {
    flows?: Array<{ stages?: string[]; type?: string }>;
    session?: string;
    completed?: string[];
    errcode?: string;
    error?: string;
  };
};

export function RegisterForm({ hs, picker, onSuccess, onShowLogin }: Props) {
  const { t } = useTranslation();
  const setCredentials = useSetAtom(credentialsAtom);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameState, setUsernameState] = useState<UsernameState>('idle');
  const [token, setToken] = useState('');
  const [errors, setErrors] = useState<
    Partial<Record<'username' | 'password' | 'token', string>>
  >({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const refs = {
    username: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    token: useRef<HTMLInputElement>(null),
  };

  const methods = hs.methods;
  const oidcOffered = Boolean(methods?.delegatedAuth && methods.authMetadata);
  const ssoFlow = methods?.ssoFlow;
  const ssoBlocked = isTauriMobile();
  const ssoOffered = !oidcOffered && Boolean(ssoFlow) && (methods?.hasTokenLogin ?? false);
  const idps = ssoFlow?.identity_providers ?? [];
  const registerStatus = methods?.registerStatus;
  const flow = pickFlow(methods?.registerFlows);
  // Until a server has answered, show the usual form rather than an empty card.
  // The server wants steps this form cannot show (a captcha, terms, an email code).
  const needsWebsite = !!methods?.registerFlows?.length && !flow;
  const passwordOffered =
    !methods ||
    (!oidcOffered && registerStatus === RegisterStatus.Available && !needsWebsite) ||
    !!username ||
    !!password;
  const needsToken = !!flow && flow.some((s) => REGISTRATION_TOKEN_STAGES.includes(s));
  const isRateLimited = !oidcOffered && registerStatus === RegisterStatus.RateLimited;
  const nothingOffered =
    !!methods && !passwordOffered && !oidcOffered && !ssoOffered && !isRateLimited;

  const localpart = username.trim().replace(/^@/, '');
  const fullId = localpart && hs.serverName ? `@${localpart.toLowerCase()}:${hs.serverName}` : '';
  const strength = password ? passwordStrength(password) : null;
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const canCheckUsername = !!localpart && passwordOffered && !!hs.methods && !hs.notAServer;
  const checkBaseUrl = hs.baseUrl;

  // Asks the server, a moment after typing stops, whether the name is free.
  useEffect(() => {
    if (!canCheckUsername) {
      setUsernameState('idle');
      return;
    }
    if (!LOCALPART_RE.test(localpart.toLowerCase())) {
      setUsernameState('invalid');
      return;
    }
    setUsernameState('checking');
    let cancelled = false;
    const timer = setTimeout(() => {
      createClient({ baseUrl: checkBaseUrl })
        .isUsernameAvailable(localpart.toLowerCase())
        .then((available) => {
          if (!cancelled) setUsernameState(available ? 'available' : 'taken');
        })
        .catch((err: { errcode?: string; data?: { errcode?: string } }) => {
          if (cancelled) return;
          const errcode = err?.errcode ?? err?.data?.errcode;
          if (errcode === MatrixErrorCode.USER_IN_USE) setUsernameState('taken');
          else if (errcode === MatrixErrorCode.INVALID_USERNAME) setUsernameState('invalid');
          else if (errcode === MatrixErrorCode.EXCLUSIVE) setUsernameState('reserved');
          else setUsernameState('idle');
        });
    }, USERNAME_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [localpart, canCheckUsername, checkBaseUrl]);

  const usernameProblem =
    usernameState === 'taken'
      ? t('welcome.usernameTaken')
      : usernameState === 'reserved'
        ? t('welcome.usernameReserved')
        : usernameState === 'invalid'
          ? t('welcome.usernameInvalidChars')
          : undefined;
  const idPreview = !fullId
    ? t('welcome.registerUsernameHint')
    : usernameState === 'available'
      ? t('welcome.usernameAvailable', { id: fullId })
      : usernameState === 'checking'
        ? t('welcome.usernameChecking', { id: fullId })
        : t('welcome.registerIdPreview', { id: fullId });

  const currentServer = async (): Promise<AuthCapabilities | null> => {
    const caps = await hs.ensure();
    if (!caps || caps.discoveryStatus !== DiscoveryStatus.Ok) {
      setFormError(serverProblemMessage(caps, t));
      return null;
    }
    return caps;
  };

  const finish = async (result: RegisterResponse, serverUrl: string) => {
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
    } else {
      // Server withheld credentials (inhibit_login or non-standard config): log in explicitly.
      const { credentials } = await login(localpart, password, serverUrl);
      setCredentials(credentials);
    }
    rememberHomeserver(hs.url);
    onSuccess();
  };

  const handleRegister = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    if (!localpart) next.username = t('welcome.usernameRequired');
    else if (usernameProblem) next.username = usernameProblem;
    if (!password) next.password = t('welcome.passwordRequired');
    else if (passwordTooShort) next.password = t('welcome.passwordTooShort');
    if (needsToken && !token.trim()) next.token = t('welcome.tokenRequired');
    setErrors(next);
    const firstBad = (['username', 'password', 'token'] as const).find((k) => next[k]);
    if (firstBad) {
      refs[firstBad].current?.focus();
      return;
    }

    setBusy(true);
    setFormError('');
    try {
      const caps = await currentServer();
      if (!caps) return;
      const serverUrl = caps.resolvedBaseUrl;
      const client = createClient({ baseUrl: serverUrl });
      const params = { username: localpart, password, refresh_token: true };

      // Step 1: ask without auth; the server answers with the flows it accepts (Matrix UIA).
      let session: string | undefined;
      let stages: string[] = [];
      try {
        const done = await client.registerRequest(params);
        await finish(done, serverUrl);
        return;
      } catch (uiaErr) {
        const err = uiaErr as UiaError;
        const flowList = err.data?.flows;
        if (err.httpStatus !== 401 || !Array.isArray(flowList) || flowList.length === 0)
          throw uiaErr;
        session = err.data?.session;
        const chosen = pickFlow(flowList.map((f) => f.stages ?? (f.type ? [f.type] : [])));
        if (!chosen) {
          const names = flowList
            .map((f) => (f.stages ?? (f.type ? [f.type] : [])).join(' -> '))
            .join(', ');
          setFormError(t('welcome.additionalVerification', { names: names || 'unknown' }));
          return;
        }
        stages = chosen;
      }

      // Step 2: complete each stage of the chosen flow.
      for (const stage of stages) {
        const auth = REGISTRATION_TOKEN_STAGES.includes(stage)
          ? { type: stage, token: token.trim(), session }
          : { type: stage, session };
        try {
          const done = await client.registerRequest({ ...params, auth });
          await finish(done, serverUrl);
          return;
        } catch (stageErr) {
          const err = stageErr as UiaError;
          if (err.httpStatus === 401 && err.data?.completed?.includes(stage) && !err.data.errcode) {
            session = err.data.session ?? session;
            continue;
          }
          throw stageErr;
        }
      }
      throw new Error(t('welcome.registrationIncomplete'));
    } catch (err) {
      const uiaErr = err as UiaError;
      const errcode = uiaErr.data?.errcode;
      if (errcode === MatrixErrorCode.USER_IN_USE) {
        setErrors({ username: t('welcome.usernameTaken') });
        refs.username.current?.focus();
      } else if (errcode === MatrixErrorCode.INVALID_USERNAME) {
        setErrors({ username: t('welcome.invalidUsername') });
        refs.username.current?.focus();
      } else if (errcode === MatrixErrorCode.EXCLUSIVE) {
        setErrors({ username: t('welcome.usernameReserved') });
        refs.username.current?.focus();
      } else if (needsToken && uiaErr.httpStatus === 401) {
        setErrors({ token: t('welcome.tokenInvalid') });
        refs.token.current?.focus();
      } else if (errcode === 'M_WEAK_PASSWORD') {
        setErrors({ password: uiaErr.data?.error ?? t('welcome.weakPassword') });
        refs.password.current?.focus();
      } else if (errcode === 'M_LIMIT_EXCEEDED' || !errcode) {
        setFormError(authErrorMessage(err, t, { server: hs.host }));
      } else {
        setFormError(t('welcome.registrationFailed', { error: uiaErr.data?.error ?? errcode }));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSso = async (idpId?: string) => {
    if (busy) return;
    setFormError('');
    const caps = await currentServer();
    if (!caps) return;
    rememberHomeserver(hs.url);
    redirectToSso(caps.resolvedBaseUrl, SSOAction.REGISTER, idpId);
  };

  const handleOidc = async () => {
    if (busy) return;
    setBusy(true);
    setFormError('');
    try {
      const caps = await currentServer();
      if (!caps?.authMetadata) {
        if (caps) setFormError(t('welcome.oidcUnavailable'));
        setBusy(false);
        return;
      }
      rememberHomeserver(hs.url);
      await startOidcLogin(caps.resolvedBaseUrl, caps.authMetadata, 'register');
    } catch (err) {
      setFormError(authErrorMessage(err, t, { server: hs.host }));
      setBusy(false);
    }
  };

  const clearError = (k: keyof typeof errors) =>
    setErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));

  const ssoButtons = () =>
    idps.length === 0 ? (
      <Button
        fullWidth
        size="lg"
        variant="secondary"
        className={css.submit}
        onClick={() => handleSso()}
        disabled={hs.notAServer}
      >
        {t('welcome.ssoLogin')}
      </Button>
    ) : (
      idps.map((idp) => {
        const iconUrl = resolveIdpIconUrl(hs.baseUrl, idp.icon);
        return (
          <Button
            key={idp.id}
            fullWidth
            size="lg"
            variant="secondary"
            className={css.submit}
            onClick={() => handleSso(idp.id)}
            disabled={hs.notAServer}
          >
            {iconUrl && <img src={iconUrl} alt="" className={css.idpIcon} />}
            {t('welcome.continueWithIdp', { name: idp.name })}
          </Button>
        );
      })
    );

  return (
    <form
      className={css.form}
      onSubmit={handleRegister}
      noValidate
      aria-label={t('welcome.registerTitle')}
    >
      <ServerPicker
        hs={hs}
        label={t('welcome.serverLabelRegister')}
        open={picker.open}
        onOpenChange={picker.onOpenChange}
        onAddressEntered={() => refs.username.current?.focus()}
      />

      {ssoBlocked && (oidcOffered || ssoOffered) && (
        <p className={css.note}>{t('welcome.ssoUnavailableMobileRegister')}</p>
      )}

      {oidcOffered && !ssoBlocked && (
        <>
          <p className={css.note}>{t('welcome.browserSignUpNote', { server: hs.methodsHost })}</p>
          <Button
            fullWidth
            size="lg"
            variant="primary"
            className={css.submit}
            onClick={handleOidc}
            loading={busy}
            spinnerWhileLoading
            disabled={hs.notAServer}
          >
            {busy
              ? t('welcome.redirecting')
              : t('welcome.oidcRegisterOn', { server: hs.methodsHost })}
          </Button>
        </>
      )}

      {passwordOffered && (
        <>
          <AuthField
            ref={refs.username}
            label={t('welcome.username')}
            showRequired
            name="username"
            type="text"
            autoComplete="username"
            enterKeyHint="next"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              clearError('username');
            }}
            hint={idPreview}
            error={errors.username ?? usernameProblem}
          />
          <AuthField
            ref={refs.password}
            label={t('welcome.password')}
            showRequired
            name="new-password"
            type="password"
            autoComplete="new-password"
            enterKeyHint={needsToken ? 'next' : 'go'}
            showPasswordToggle
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError('password');
            }}
            hint={
              strength && !passwordTooShort ? (
                <span className={css.strength} aria-live="polite">
                  <span className={css.strengthBars} aria-hidden>
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={
                          i <= STRENGTH_BARS[strength] ? STRENGTH_CLASS[strength] : css.strengthBar
                        }
                      />
                    ))}
                  </span>
                  <span>{t(`welcome.passwordStrength.${strength}`)}</span>
                </span>
              ) : undefined
            }
            error={errors.password ?? (passwordTooShort ? t('welcome.passwordTooShort') : undefined)}
          />
          {needsToken && (
            <AuthField
              ref={refs.token}
              label={t('welcome.token')}
              showRequired
              name="registration-token"
              type="text"
              autoComplete="off"
              enterKeyHint="go"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                clearError('token');
              }}
              hint={t('welcome.tokenHint')}
              error={errors.token}
            />
          )}
          <div className={css.formError} role="alert">
            {formError}
          </div>
          <Button
            type="submit"
            fullWidth
            size="lg"
            variant={oidcOffered ? 'secondary' : 'primary'}
            className={css.submit}
            loading={busy}
            spinnerWhileLoading
            disabled={hs.notAServer}
          >
            {busy ? t('welcome.registering') : t('welcome.registerSubmit')}
          </Button>
        </>
      )}

      {!passwordOffered && (
        <div className={css.formError} role="alert">
          {formError ||
            (isRateLimited
              ? t('welcome.registrationRateLimited')
              : needsWebsite && !oidcOffered
                ? t('welcome.registrationNeedsWebsite', { server: hs.host })
                : nothingOffered
                  ? t('welcome.registrationUnavailable')
                  : '')}
        </div>
      )}

      {ssoOffered && !ssoBlocked && (
        <>
          <div className={css.divider}>{t('common.or')}</div>
          <div className={css.altMethods}>{ssoButtons()}</div>
        </>
      )}

      <p className={css.altText}>
        {t('welcome.haveAccount')}{' '}
        <button type="button" className={css.inlineLink} onClick={onShowLogin}>
          {t('welcome.loginLink')}
        </button>
      </p>
    </form>
  );
}
