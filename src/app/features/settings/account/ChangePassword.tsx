import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { Input } from '@/app/components/Input';
import { Button } from '@/app/components/Button';
import { UiaPanel } from '../sessions/UiaPanel';
import { useUiaAction } from '../useUiaAction';
import * as css from '../Settings.css';

export function ChangePassword() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const uia = useUiaAction({
    client,
    onSuccess: () => {
      toast.success(t('settings.account.passwordChanged'));
      setNewPassword('');
      setConfirmPassword('');
    },
  });

  if (!client) return null;

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLocalError('');

    if (newPassword.length < 8) {
      setLocalError(t('settings.account.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError(t('settings.account.passwordsDoNotMatch'));
      return;
    }

    await uia.execute((auth) => client.setPassword(auth as never, newPassword));
  };

  if (uia.challenge) {
    return (
      <UiaPanel
        challenge={uia.challenge}
        onSubmitPassword={uia.handlePassword}
        onSso={uia.handleSso}
        onCancel={uia.handleCancel}
        submitting={uia.submitting}
        description={t('settings.account.uiaPasswordDesc')}
        submitLabel={t('settings.account.changePassword')}
      />
    );
  }

  const displayError = localError || uia.error;

  return (
    <form onSubmit={handleSubmit} className={css.fieldGroup}>
      <Input
        label={t('settings.account.newPassword')}
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className={css.inputFull}
        autoComplete="new-password"
        disabled={uia.submitting}
      />
      <Input
        label={t('settings.account.confirmNewPassword')}
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className={css.inputFull}
        autoComplete="new-password"
        disabled={uia.submitting}
      />
      {displayError && <p className={css.warningBox}>{displayError}</p>}
      <Button type="submit" variant="primary" loading={uia.submitting}>
        {t('settings.account.changePassword')}
      </Button>
    </form>
  );
}
