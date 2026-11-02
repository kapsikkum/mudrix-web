import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMatrixClientOrNull, logout } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { useConfirm } from '@/app/hooks/useConfirm';
import { Button } from '@/app/components/Button';
import { ToggleRow } from '@/app/components/Toggle/Toggle';
import { UiaPanel } from '../sessions/UiaPanel';
import { useUiaAction } from '../useUiaAction';
import * as css from '../Settings.css';

export function DeactivateAccount() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const confirm = useConfirm();

  const [expanded, setExpanded] = useState(false);
  const [erase, setErase] = useState(false);
  const [localError, setLocalError] = useState('');

  const uia = useUiaAction({
    client,
    onSuccess: async () => {
      toast.success(t('settings.account.accountDeactivated'));
      await logout();
    },
  });

  if (!client) return null;

  const handleDeactivate = async () => {
    const ok = await confirm({
      title: t('settings.account.deactivateAccount'),
      message: t('settings.account.deactivateConfirm'),
      danger: true,
      confirmLabel: t('settings.account.deactivateAccount'),
    });
    if (!ok) return;

    setLocalError('');
    await uia.execute((auth) => client.deactivateAccount(auth as never, erase));
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
        submitLabel={t('settings.account.deactivateAccount')}
      />
    );
  }

  if (!expanded) {
    return (
      <Button variant="danger" onClick={() => setExpanded(true)}>
        {t('settings.account.deactivateAccount')}
      </Button>
    );
  }

  const displayError = localError || uia.error;

  return (
    <div className={css.fieldGroup}>
      <ToggleRow
        label={t('settings.account.eraseData')}
        checked={erase}
        onChange={setErase}
        disabled={uia.submitting}
      />
      {displayError && <p className={css.warningBox}>{displayError}</p>}
      <div className={css.actions}>
        <Button variant="danger" loading={uia.submitting} onClick={handleDeactivate}>
          {t('settings.account.deactivateAccount')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setExpanded(false);
            setErase(false);
            setLocalError('');
          }}
        >
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
