import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthType } from 'matrix-js-sdk/lib/interactive-auth';
import type { AuthDict, IAuthData } from 'matrix-js-sdk/lib/interactive-auth';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Input } from '@/app/components/Input';
import { Button } from '@/app/components/Button';
import { UiaPanel, offersPassword, offersSso } from '../sessions/UiaPanel';
import * as css from '../Settings.css';

export function ChangePassword() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [challenge, setChallenge] = useState<IAuthData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!client) return null;

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError(t('settings.account.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('settings.account.passwordsDoNotMatch'));
      return;
    }

    setSubmitting(true);
    try {
      await client.setPassword(undefined as unknown as AuthDict, newPassword);
      toast.success(t('settings.account.passwordChanged'));
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const mErr = err as { httpStatus?: number; data?: IAuthData };
      if (mErr?.httpStatus === 401 && mErr.data?.flows) {
        setChallenge(mErr.data);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUiaSubmit = async (password: string) => {
    if (!challenge?.session) return;
    setSubmitting(true);
    try {
      const authDict = {
        type: AuthType.Password,
        identifier: { type: 'm.id.user' as const, user: client.getUserId() ?? '' },
        password,
        session: challenge.session,
      };
      await client.setPassword(authDict as never, newPassword);
      toast.success(t('settings.account.passwordChanged'));
      setChallenge(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const mErr = err as { httpStatus?: number; data?: IAuthData };
      if (mErr?.httpStatus === 401 && mErr.data?.flows) {
        setChallenge(mErr.data);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (challenge) {
    const flows = challenge.flows;
    if (!offersPassword(flows) && !offersSso(flows)) {
      setError(t('settings.account.authMethodUnsupported'));
      setChallenge(null);
    }
    return (
      <UiaPanel
        challenge={{ authData: challenge, deviceId: '', displayName: '' }}
        onSubmitPassword={handleUiaSubmit}
        onSso={() => {}}
        onCancel={() => setChallenge(null)}
        submitting={submitting}
        description={t('settings.account.uiaPasswordDesc')}
        submitLabel={t('settings.account.changePassword')}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className={css.fieldGroup}>
      <Input
        label={t('settings.account.newPassword')}
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className={css.inputFull}
        autoComplete="new-password"
        disabled={submitting}
      />
      <Input
        label={t('settings.account.confirmNewPassword')}
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className={css.inputFull}
        autoComplete="new-password"
        disabled={submitting}
      />
      {error && <p className={css.warningBox}>{error}</p>}
      <Button type="submit" variant="primary" loading={submitting}>
        {t('settings.account.changePassword')}
      </Button>
    </form>
  );
}
