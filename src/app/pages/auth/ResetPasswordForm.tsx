import { useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MatrixError } from 'matrix-js-sdk';
import { getErrorMessage } from '@/util/error';
import { checkPassword, isPasswordValid } from '@/util/password';
import { generateClientSecret } from '@/util/clientSecret';
import {
  requestPasswordReset,
  completePasswordReset,
  DiscoveryStatus,
  type AuthCapabilities,
} from '@/app/features/sso/sso';
import { Button } from '@/app/components/Button';
import { AuthField } from './AuthField';
import { PasswordChecklist } from './PasswordChecklist';
import { ServerPicker } from './ServerPicker';
import type { ServerPickerState } from './LoginForm';
import { authErrorMessage, serverProblemMessage } from './authErrors';
import type { Homeserver } from './useHomeserver';
import * as css from './WelcomePage.css';

type ResetStep = 'email' | 'password' | 'done';

interface Props {
  hs: Homeserver;
  picker: ServerPickerState;
  onBackToLogin: () => void;
}

export function ResetPasswordForm({ hs, picker, onBackToLogin }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'email' | 'password' | 'confirm', string>>>(
    {}
  );
  const [formError, setFormError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  // Kept for the whole flow: the server ties the emailed link to them.
  const [clientSecret] = useState(generateClientSecret);
  const [sid, setSid] = useState('');
  // The server the link was sent from; the new password must go to the same one.
  const [resetServer, setResetServer] = useState('');

  const caps = hs.current ?? hs.methods;
  const portal = caps?.delegatedAuth ? caps.accountManagementUri : undefined;

  const currentServer = async (): Promise<AuthCapabilities | null> => {
    const c = await hs.ensure();
    if (!c || c.discoveryStatus !== DiscoveryStatus.Ok) {
      setFormError(serverProblemMessage(c, t));
      return null;
    }
    return c;
  };

  const handleRequestReset = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim()) {
      setErrors({ email: t('welcome.emailRequired') });
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      const c = await currentServer();
      if (!c) return;
      const requestSid = await requestPasswordReset(c.resolvedBaseUrl, email.trim(), clientSecret);
      setSid(requestSid);
      setResetServer(c.resolvedBaseUrl);
      setStep('password');
      setInfo(t('welcome.resetLinkSent', { email: email.trim() }));
    } catch (err) {
      // 404 / unrecognised: no reset endpoint. THREEPID_DENIED / MEDIUM_NOT_SUPPORTED: the
      // server cannot send email at all (Synapse and Tuwunel without an email setup).
      const notSupportedCodes = [
        'M_UNRECOGNIZED',
        'M_THREEPID_DENIED',
        'M_THREEPID_MEDIUM_NOT_SUPPORTED',
      ];
      const notSupported =
        (err instanceof MatrixError &&
          (err.httpStatus === 404 || notSupportedCodes.includes(err.errcode ?? ''))) ||
        notSupportedCodes.some((c) => getErrorMessage(err).includes(c));
      const unknownEmail = err instanceof MatrixError && err.errcode === 'M_THREEPID_NOT_FOUND';
      if (notSupported) setFormError(t('welcome.resetNotSupported'));
      else if (unknownEmail) {
        setErrors({ email: t('welcome.resetEmailUnknown', { server: hs.host }) });
        emailRef.current?.focus();
      } else setFormError(authErrorMessage(err, t, { server: hs.host }));
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteReset = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    if (!newPassword) next.password = t('welcome.passwordRequired');
    else if (!isPasswordValid(checkPassword(newPassword)))
      next.password = t('welcome.passwordTooWeak');
    if (newPassword && confirmPassword !== newPassword)
      next.confirm = t('welcome.passwordMismatch');
    setErrors(next);
    if (next.password || next.confirm) {
      (next.password ? pwRef : confirmRef).current?.focus();
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await completePasswordReset(resetServer, sid, clientSecret, newPassword);
      setStep('done');
      setInfo('');
    } catch (err) {
      const msg = getErrorMessage(err);
      if (
        (err instanceof MatrixError && err.httpStatus === 401) ||
        msg.includes('M_UNAUTHORIZED') ||
        msg.includes('401')
      ) {
        setFormError(t('welcome.resetClickLinkFirst'));
      } else {
        setFormError(authErrorMessage(err, t, { server: hs.host }));
      }
    } finally {
      setBusy(false);
    }
  };

  const picker_ = (
    <ServerPicker
      hs={hs}
      label={t('welcome.serverLabelReset')}
      open={picker.open && step === 'email'}
      onOpenChange={picker.onOpenChange}
      onAddressEntered={() => emailRef.current?.focus()}
      disabled={step !== 'email'}
    />
  );

  const backLink = (
    <p className={css.altText}>
      <button type="button" className={css.inlineLink} onClick={onBackToLogin}>
        {t('welcome.backToLogin')}
      </button>
    </p>
  );

  if (portal && step === 'email') {
    return (
      <div className={css.form}>
        {picker_}
        <p className={css.note}>{t('welcome.resetDelegatedInfo')}</p>
        <Button
          fullWidth
          size="lg"
          variant="primary"
          className={css.submit}
          onClick={() => window.open(portal, '_blank', 'noopener')}
        >
          {t('welcome.resetOpenAccountPortal')}
        </Button>
        {backLink}
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className={css.form}>
        <p className={css.formSuccess} role="status">
          {t('welcome.resetSuccess')}
        </p>
        <Button
          fullWidth
          size="lg"
          variant="primary"
          className={css.submit}
          onClick={onBackToLogin}
        >
          {t('welcome.backToLogin')}
        </Button>
      </div>
    );
  }

  if (step === 'password') {
    return (
      <form
        className={css.form}
        onSubmit={handleCompleteReset}
        noValidate
        aria-label={t('welcome.resetTitle')}
      >
        {picker_}
        <p className={css.note} role="status">
          {info}
        </p>
        <AuthField
          ref={pwRef}
          label={t('welcome.newPassword')}
          showRequired
          name="new-password"
          type="password"
          autoComplete="new-password"
          showPasswordToggle
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setErrors((p) => ({ ...p, password: undefined }));
          }}
          error={errors.password}
        />
        <PasswordChecklist password={newPassword} />
        <AuthField
          ref={confirmRef}
          label={t('welcome.confirmPassword')}
          showRequired
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          enterKeyHint="go"
          showPasswordToggle
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setErrors((p) => ({ ...p, confirm: undefined }));
          }}
          error={errors.confirm}
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
          loading={busy}
          spinnerWhileLoading
        >
          {busy ? t('welcome.resetting') : t('welcome.resetComplete')}
        </Button>
        {backLink}
      </form>
    );
  }

  return (
    <form
      className={css.form}
      onSubmit={handleRequestReset}
      noValidate
      aria-label={t('welcome.resetTitle')}
    >
      {picker_}
      <p className={css.note}>{t('welcome.resetEmailPrompt')}</p>
      <AuthField
        ref={emailRef}
        label={t('welcome.email')}
        showRequired
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        enterKeyHint="send"
        placeholder={t('welcome.emailPlaceholder')}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErrors({});
        }}
        error={errors.email}
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
        loading={busy}
        spinnerWhileLoading
        disabled={hs.notAServer}
      >
        {busy ? t('welcome.sending') : t('welcome.resetSendCode')}
      </Button>
      {backLink}
    </form>
  );
}
