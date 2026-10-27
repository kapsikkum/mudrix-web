import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { createClient } from 'matrix-js-sdk';
import { isSignInWithQRAvailable } from 'matrix-js-sdk/lib/rendezvous';
import { QrCodeIcon } from '@phosphor-icons/react';
import { credentialsAtom } from '@/app/store/atoms';
import { login, normalizeUrl } from '@/client/initMatrix';
import {
  discoverAuthCapabilities,
  redirectToSso,
  resolveIdpIconUrl,
  DiscoveryStatus,
  SSOAction,
  type AuthCapabilities,
} from '@/app/features/sso/sso';
import { startOidcLogin } from '@/app/features/oidc/oidc';
import { SignInWithQrModal } from '@/app/features/qrLogin/SignInWithQrModal';
import { isTauriMobile } from '@/util/desktop';
import { getErrorMessage } from '@/util/error';
import { Button } from '@/app/components/Button';
import { AuthField } from './AuthField';
import { ServerPicker } from './ServerPicker';
import { authErrorMessage, serverProblemMessage } from './authErrors';
import { hostOf, interpretIdentifier, toLoginIdentifier, type SignInIdentifier } from './authInput';
import { rememberHomeserver, type Homeserver } from './useHomeserver';
import * as css from './WelcomePage.css';

export interface ServerPickerState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Props {
  hs: Homeserver;
  picker: ServerPickerState;
  onSuccess: () => void;
  onShowRegister: () => void;
  onShowReset: () => void;
}

/** Is a user id's server some other server than the one selected? */
function isElsewhere(
  id: SignInIdentifier | null,
  hs: Homeserver
): id is Extract<SignInIdentifier, { kind: 'mxid' }> {
  if (id?.kind !== 'mxid') return false;
  const here = [hs.serverName, hostOf(hs.url)].map((s) => s.toLowerCase());
  return !here.includes(id.server);
}

export function LoginForm({ hs, picker, onSuccess, onShowRegister, onShowReset }: Props) {
  const { t } = useTranslation();
  const setCredentials = useSetAtom(credentialsAtom);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [idError, setIdError] = useState('');
  const [pwError, setPwError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState<'password' | 'oidc' | null>(null);
  const [qrAvailable, setQrAvailable] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const idRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  // Which ways in to offer follows the last server that answered, not every half-typed address.
  const methods = hs.methods;
  const oidcOffered = Boolean(methods?.delegatedAuth && methods.authMetadata);
  const ssoFlow = methods?.ssoFlow;
  const ssoOffered = !oidcOffered && Boolean(ssoFlow) && (methods?.hasTokenLogin ?? false);
  const ssoBlocked = isTauriMobile();
  const idps = ssoFlow?.identity_providers ?? [];
  // A server can offer OIDC and password login together (matrix.org, Continuwuity); password
  // stays available so a failed OIDC client registration never locks anyone out. With nothing
  // usable advertised, fall back to the password form; the server has the final say. Once
  // someone has typed into it, the form stays put whatever the server turns out to offer.
  const passwordOffered =
    !methods ||
    methods.hasPasswordLogin ||
    (!oidcOffered && !ssoOffered) ||
    !!identifier ||
    !!password;
  const browserMethods = !ssoBlocked && (oidcOffered || ssoOffered);

  // Signing in by scanning a QR code with another signed-in device needs OIDC and MSC4108.
  const qrServerUrl = oidcOffered ? methods?.resolvedBaseUrl : undefined;
  useEffect(() => {
    setQrAvailable(false);
    if (!qrServerUrl) return undefined;
    let cancelled = false;
    void isSignInWithQRAvailable(createClient({ baseUrl: qrServerUrl }))
      .catch(() => false)
      .then((available) => {
        if (!cancelled) setQrAvailable(available);
      });
    return () => {
      cancelled = true;
    };
  }, [qrServerUrl]);

  const parsed = interpretIdentifier(identifier, hs.serverName);
  const elsewhere = isElsewhere(parsed, hs) ? parsed : null;
  const canSubmit = !hs.notAServer || !!elsewhere;

  let idHint: React.ReactNode = '';
  if (elsewhere) {
    idHint = (
      <>
        {t('welcome.idOtherServer', { server: elsewhere.server })}{' '}
        <button
          type="button"
          className={css.inlineLink}
          onClick={() => hs.setInput(elsewhere.server, { now: true })}
        >
          {t('welcome.idSwitch', { server: elsewhere.server })}
        </button>
      </>
    );
  } else if (parsed?.kind === 'email') {
    idHint = t('welcome.idEmail');
  } else if (parsed?.kind === 'phone') {
    idHint = t('welcome.idPhone');
  } else if (parsed?.kind === 'mxid') {
    idHint = t('welcome.idPreview', { id: parsed.user });
  } else if (parsed?.kind === 'user' && hs.serverName && !parsed.user.includes(':')) {
    // Shows what a Matrix id looks like, and that the name is enough.
    idHint = t('welcome.idPreview', { id: `@${parsed.user}:${hs.serverName}` });
  }

  /** The current server's answer, waiting for it if a check is still running. */
  const currentServer = async (): Promise<AuthCapabilities | null> => {
    const caps = await hs.ensure();
    if (!caps || caps.discoveryStatus !== DiscoveryStatus.Ok) {
      setFormError(serverProblemMessage(caps, t));
      return null;
    }
    return caps;
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (busy) return;
    const missingId = !identifier.trim();
    const missingPw = !password;
    setIdError(missingId ? t('welcome.idRequired') : '');
    setPwError(missingPw ? t('welcome.passwordRequired') : '');
    if (missingId || missingPw) {
      (missingId ? idRef : pwRef).current?.focus();
      return;
    }
    setBusy('password');
    setFormError('');
    let id: SignInIdentifier | null = parsed;
    let serverLabel = hs.host;
    try {
      let baseUrl: string;
      let usedServer = hs.url;
      const other = elsewhere
        ? await discoverAuthCapabilities(normalizeUrl(elsewhere.server))
        : null;
      if (elsewhere && other?.discoveryStatus === DiscoveryStatus.Ok) {
        // `@name:other.org` typed while another server is selected: sign in where the id lives.
        baseUrl = other.resolvedBaseUrl;
        usedServer = normalizeUrl(elsewhere.server);
        serverLabel = elsewhere.server;
        hs.setInput(elsewhere.server, { now: true });
      } else {
        const caps = await currentServer();
        if (!caps) return;
        baseUrl = caps.resolvedBaseUrl;
        id = interpretIdentifier(identifier, caps.serverName ?? hs.serverName);
      }
      if (!id) return;
      const who = id.kind === 'user' || id.kind === 'mxid' ? id.user : toLoginIdentifier(id);
      const { credentials } = await login(who, password, baseUrl);
      rememberHomeserver(usedServer);
      setCredentials(credentials);
      onSuccess();
    } catch (err) {
      setFormError(
        authErrorMessage(err, t, {
          server: serverLabel,
          byEmail: id?.kind === 'email' || id?.kind === 'phone',
        })
      );
      pwRef.current?.select();
    } finally {
      setBusy(null);
    }
  };

  const handleOidc = async () => {
    if (busy) return;
    setFormError('');
    setBusy('oidc');
    try {
      const caps = await currentServer();
      if (!caps?.authMetadata) {
        if (caps) setFormError(t('welcome.oidcUnavailable'));
        setBusy(null);
        return;
      }
      rememberHomeserver(hs.url);
      await startOidcLogin(caps.resolvedBaseUrl, caps.authMetadata, 'login');
    } catch (err) {
      setFormError(getErrorMessage(err));
      setBusy(null);
    }
  };

  const handleSso = async (idpId?: string) => {
    if (busy) return;
    setFormError('');
    const caps = await currentServer();
    if (!caps) return;
    rememberHomeserver(hs.url);
    redirectToSso(caps.resolvedBaseUrl, SSOAction.LOGIN, idpId);
  };

  const handleForgotPassword = () => {
    const caps = hs.current ?? methods;
    if (caps?.delegatedAuth && caps.accountManagementUri) {
      window.open(caps.accountManagementUri, '_blank', 'noopener');
    } else {
      onShowReset();
    }
  };

  const oidcButton = (primary: boolean) => (
    <Button
      key="oidc"
      fullWidth
      size="lg"
      variant={primary ? 'primary' : 'secondary'}
      className={css.submit}
      onClick={handleOidc}
      loading={busy === 'oidc'}
      spinnerWhileLoading
      disabled={hs.notAServer}
    >
      {busy === 'oidc'
        ? t('welcome.redirecting')
        : t('welcome.oidcContinue', { server: hs.methodsHost })}
    </Button>
  );

  const qrButton = () =>
    qrAvailable && qrServerUrl ? (
      <Button
        key="qr"
        fullWidth
        size="lg"
        variant="secondary"
        className={css.submit}
        onClick={() => setQrOpen(true)}
      >
        <QrCodeIcon size={18} />
        {t('qrLogin.signInTitle')}
      </Button>
    ) : null;

  const ssoButtons = () =>
    idps.length === 0 ? (
      <Button
        key="sso"
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
      onSubmit={handleSubmit}
      noValidate
      aria-label={t('welcome.loginTitle')}
    >
      <ServerPicker
        hs={hs}
        label={t('welcome.serverLabelLogin')}
        open={picker.open}
        onOpenChange={picker.onOpenChange}
        onAddressEntered={() => (passwordOffered ? idRef.current?.focus() : undefined)}
      />

      {ssoBlocked && (oidcOffered || ssoOffered) && (
        <p className={css.note}>{t('welcome.ssoUnavailableMobile')}</p>
      )}

      {passwordOffered ? (
        <>
          <AuthField
            ref={idRef}
            label={t('welcome.identifier')}
            showRequired
            name="username"
            type="text"
            inputMode="email"
            autoComplete="username"
            enterKeyHint="next"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setIdError('');
            }}
            hint={idHint}
            error={idError}
          />
          <AuthField
            ref={pwRef}
            label={t('welcome.password')}
            showRequired
            name="password"
            type="password"
            autoComplete="current-password"
            enterKeyHint="go"
            showPasswordToggle
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPwError('');
            }}
            error={pwError}
            hint={
              <button type="button" className={css.textLink} onClick={handleForgotPassword}>
                {t('welcome.forgotPassword')}
              </button>
            }
          />
          <div className={css.formError} role="alert">
            {formError}
          </div>
          <Button
            type="submit"
            fullWidth
            size="lg"
            variant="primary"
            className={css.submit}
            loading={busy === 'password'}
            spinnerWhileLoading
            disabled={!canSubmit}
          >
            {busy === 'password' ? t('welcome.loggingIn') : t('welcome.loginSubmit')}
          </Button>
          <p className={css.altText}>
            {t('welcome.noAccount')}{' '}
            <button type="button" className={css.inlineLink} onClick={onShowRegister}>
              {t('welcome.registerLink')}
            </button>
          </p>
          {browserMethods && (
            <>
              <div className={css.divider}>{t('common.or')}</div>
              <div className={css.altMethods}>
                {oidcOffered && oidcButton(false)}
                {oidcOffered && qrButton()}
                {ssoOffered && ssoButtons()}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {browserMethods && (
            <>
              <p className={css.note}>
                {t('welcome.browserSignInNote', { server: hs.methodsHost })}
              </p>
              <div className={css.altMethods}>
                {oidcOffered && oidcButton(true)}
                {oidcOffered && qrButton()}
                {ssoOffered && ssoButtons()}
              </div>
            </>
          )}
          <div className={css.formError} role="alert">
            {formError}
          </div>
          <p className={css.altText}>
            {t('welcome.noAccount')}{' '}
            <button type="button" className={css.inlineLink} onClick={onShowRegister}>
              {t('welcome.registerLink')}
            </button>
          </p>
        </>
      )}
      {qrOpen && qrServerUrl && (
        <SignInWithQrModal
          serverUrl={qrServerUrl}
          onClose={() => setQrOpen(false)}
          onSuccess={onSuccess}
        />
      )}
    </form>
  );
}
